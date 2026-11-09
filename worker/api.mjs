import { ApiError, cardPayment, quote, validateGuest, orderPayload, orderState, sha256, validSignature } from './payment.mjs';
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const apiJson = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
async function body(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415, 'Envie JSON.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Dados ausentes.');
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 8192) { await reader.cancel(); throw new ApiError(413, 'Dados excedem o limite.'); }
    chunks.push(value);
  }
  try { return JSON.parse(await new Blob(chunks).text()); } catch { throw new ApiError(400, 'JSON inválido.'); }
}
function configured(env) { return env.PAYMENTS_ENABLED === 'true' && !!env.MP_ACCESS_TOKEN && !!env.MP_WEBHOOK_SECRET && !!env.DB; }
async function mp(env, resource, options = {}) {
  const response = await (env.MP_FETCH || fetch)('https://api.mercadopago.com/v1/orders' + resource, {
    ...options, signal: AbortSignal.timeout(12000), headers: {
      Authorization: 'Bearer ' + env.MP_ACCESS_TOKEN, 'Content-Type': 'application/json', ...options.headers
    }
  });
  if (!response.ok) {
    const error = new ApiError(502, 'Não foi possível consultar o Mercado Pago. Tente novamente com a mesma solicitação.');
    error.providerStatus = response.status;
    throw error;
  }
  return response.json();
}
async function limit(request, env, action, max) {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const bucket = action + ':' + await sha256(ip + ':' + Math.floor(Date.now() / 600000));
  const record = await env.DB.prepare('INSERT INTO request_limits(bucket,count) VALUES (?,1) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket).first();
  if (record.count > max) throw new ApiError(429, 'Muitas tentativas. Aguarde alguns minutos.');
}
async function findBooking(env, id) { return env.DB.prepare('SELECT * FROM bookings WHERE id=?').bind(id).first(); }
async function saveOrderState(env, booking, order) {
  const status = orderState(order, booking);
  const statements = [env.DB.prepare("UPDATE bookings SET status=?,last_checked=? WHERE id=? AND status NOT IN ('approved','review')").bind(status, Date.now(), booking.id)];
  // Uma ordem já aprovada nunca libera noites automaticamente, mesmo após reembolso.
  if (status === 'canceled' && !['approved', 'review'].includes(booking.status)) statements.push(env.DB.prepare("DELETE FROM night_locks WHERE booking_id=? AND EXISTS(SELECT 1 FROM bookings WHERE id=? AND status='canceled')").bind(booking.id, booking.id));
  await env.DB.batch(statements);
  return findBooking(env, booking.id);
}
async function refresh(env, booking, force = false) {
  if (!booking.order_id || (!force && Date.now() - booking.last_checked < 15000)) return booking;
  return saveOrderState(env, booking, await mp(env, '/' + encodeURIComponent(booking.order_id)));
}
function publicBooking(booking) {
  return { id: booking.id, status: booking.status, checkin: booking.checkin, checkout: booking.checkout,
    total: (booking.total_cents / 100).toFixed(2), expiresAt: booking.expires_at,
    pixCopiaECola: booking.status === 'pending' ? booking.qr_code : null,
    pixQrBase64: booking.status === 'pending' ? booking.qr_base64 : null };
}
async function createPayment(request, env) {
  if (!configured(env)) throw new ApiError(503, 'Pagamentos online ainda não estão disponíveis.');
  if (request.headers.get('origin') !== env.PUBLIC_BASE_URL) throw new ApiError(403, 'Origem inválida.');
  const id = request.headers.get('idempotency-key') || '', access = request.headers.get('x-booking-key') || '';
  if (!uuidPattern.test(id) || !/^[a-f0-9]{64}$/.test(access)) throw new ApiError(400, 'Identificador de solicitação inválido.');
  const data = await body(request);
  const q = quote(data), guest = validateGuest(data);
  const card = data.card ? cardPayment(data.card) : null;
  if (card && (!env.MP_PUBLIC_KEY || env.MP_CARD_ENABLED !== 'true')) throw new ApiError(503, 'Cartão parcelado ainda não está disponível.');
  const requestHash = await sha256(JSON.stringify({ ...q, ...guest, ...(card ? { card } : {}) })), accessHash = await sha256(access);
  let booking = await findBooking(env, id);
  if (booking) {
    if (booking.access_hash !== accessHash) throw new ApiError(403, 'Solicitação inválida.');
    if (booking.request_hash !== requestHash) throw new ApiError(409, 'Esta solicitação já usa outros dados.');
  } else {
    await limit(request, env, 'create', 5);
    const payload = orderPayload(id, q.totalCents, guest.email, card), now = Date.now();
    try {
      await env.DB.batch([
        env.DB.prepare('INSERT INTO bookings(id,access_hash,request_hash,checkin,checkout,total_cents,guest_name,guest_email,order_payload,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
          .bind(id, accessHash, requestHash, q.checkin, q.checkout, q.totalCents, guest.name, guest.email, JSON.stringify(payload), now, now + 30 * 60000),
        ...q.dates.map(date => env.DB.prepare('INSERT INTO night_locks(night,booking_id) VALUES (?,?)').bind(date, id))
      ]);
    } catch {
      // Uma repetição concorrente da mesma solicitação pode ter vencido a corrida.
      booking = await findBooking(env, id);
      if (!booking || booking.access_hash !== accessHash || booking.request_hash !== requestHash) throw new ApiError(409, 'Uma ou mais noites já estão reservadas ou aguardando pagamento.');
    }
    booking = await findBooking(env, id);
  }
  if (!booking.order_id && booking.status === 'creating') {
    // A chave é persistente: falhas de rede nunca geram uma segunda cobrança.
    let order;
    try { order = await mp(env, '', { method: 'POST', headers: { 'X-Idempotency-Key': id }, body: booking.order_payload }); }
    catch (error) {
      // Rejeição definitiva da criação não deve prender datas. Timeouts e 5xx
      // são ambíguos: conservar bloqueio e reutilizar a mesma chave.
      if ([400, 401, 403, 422].includes(error.providerStatus)) {
        await env.DB.batch([
          env.DB.prepare("UPDATE bookings SET status='canceled' WHERE id=? AND order_id IS NULL AND status='creating'").bind(id),
          env.DB.prepare("DELETE FROM night_locks WHERE booking_id=? AND EXISTS(SELECT 1 FROM bookings WHERE id=? AND status='canceled' AND order_id IS NULL)").bind(id,id)
        ]);
        throw new ApiError(400, 'O Mercado Pago não aceitou criar a cobrança. Confira o e-mail ou fale com o anfitrião. Nenhuma reserva foi confirmada.');
      }
      throw error;
    }
    if (!/^ORD[A-Z0-9]+$/i.test(order.id || '')) throw new ApiError(502, 'Resposta inesperada do Mercado Pago.');
    const method = order.transactions?.payments?.[0]?.payment_method;
    const bound = { ...booking, order_id: order.id };
    const state = orderState(order, bound);
    if (state === 'pending' && JSON.parse(booking.order_payload).transactions.payments[0].payment_method.id === 'pix' && (!method?.qr_code || !method?.qr_code_base64)) throw new ApiError(502, 'O Mercado Pago ainda não retornou os dados do PIX. Tente novamente.');
    await env.DB.prepare("UPDATE bookings SET order_id=?,qr_code=?,qr_base64=?,status=?,last_checked=? WHERE id=? AND order_id IS NULL")
      .bind(order.id, method?.qr_code || null, method?.qr_code_base64 || null, state, Date.now(), id).run();
    booking = await findBooking(env, id);
    if (state === 'canceled') booking = await saveOrderState(env, booking, order);
  }
  return apiJson(publicBooking(await refresh(env, booking)));
}
async function webhook(request, env, url) {
  if (!env.MP_WEBHOOK_SECRET || !env.MP_ACCESS_TOKEN || !env.DB) throw new ApiError(503, 'Webhook ainda não configurado.');
  const id = url.searchParams.get('data.id');
  if (!/^ORD[A-Z0-9]+$/i.test(id || '') || !await validSignature(request, env.MP_WEBHOOK_SECRET, id)) throw new ApiError(401, 'Assinatura inválida.');
  // O conteúdo da notificação não comprova aprovação; consultar sempre a API.
  const order = await mp(env, '/' + encodeURIComponent(id));
  const booking = await findBooking(env, order.external_reference || '');
  if (!booking) return apiJson({ received: true });
  if (booking.order_id && booking.order_id !== order.id) throw new ApiError(409, 'Ordem divergente.');
  if (!booking.order_id) {
    // A resposta de criação pode ter se perdido após o provedor criar a ordem.
    await env.DB.prepare('UPDATE bookings SET order_id=? WHERE id=? AND order_id IS NULL').bind(order.id, booking.id).run();
  }
  await saveOrderState(env, await findBooking(env, booking.id), order);
  return apiJson({ received: true });
}
export async function api(request, env) {
  const url = new URL(request.url), pathname = url.pathname;
  try {
    if (pathname === '/api/config' && request.method === 'GET') return apiJson({ paymentsEnabled: configured(env), cardEnabled: configured(env) && env.MP_CARD_ENABLED === 'true' && !!env.MP_PUBLIC_KEY, publicKey: env.MP_PUBLIC_KEY || '', maxInstallments: 12, interestPayer: 'buyer', dailyRate: 600, cleaningFee: 150, currency: 'BRL' });
    if (pathname === '/api/quote' && request.method === 'POST') {
      if (request.headers.get('origin') !== env.PUBLIC_BASE_URL) throw new ApiError(403, 'Origem inválida.');
      const q = quote(await body(request));
      return apiJson({ checkin: q.checkin, checkout: q.checkout, nights: q.nights, total: (q.totalCents / 100).toFixed(2) });
    }
    if (pathname === '/api/create-payment' && request.method === 'POST') return await createPayment(request, env);
    if (pathname === '/api/mercadopago-webhook' && request.method === 'POST') return await webhook(request, env, url);
    if (pathname === '/api/availability' && request.method === 'GET') {
      if (!env.DB) throw new ApiError(503, 'Calendário indisponível.');
      await limit(request, env, 'availability', 120);
      const stale = await env.DB.prepare("SELECT * FROM bookings WHERE status='pending' AND order_id IS NOT NULL AND expires_at<? AND last_checked<? LIMIT 8").bind(Date.now(), Date.now() - 60000).all();
      for (const booking of stale.results) { try { await refresh(env, booking, true); } catch { /* preservar bloqueio na dúvida */ } }
      const locks = await env.DB.prepare('SELECT night FROM night_locks ORDER BY night').all();
      return apiJson({ blockedDates: locks.results.map(x => x.night) });
    }
    if (pathname.startsWith('/api/check-payment/') && request.method === 'GET') {
      if (!env.DB) throw new ApiError(503, 'Serviço indisponível.');
      const booking = await findBooking(env, pathname.slice('/api/check-payment/'.length));
      if (!booking || booking.access_hash !== await sha256(request.headers.get('x-booking-key') || '')) throw new ApiError(404, 'Reserva não encontrada.');
      await limit(request, env, 'status', 150);
      return apiJson(publicBooking(await refresh(env, booking)));
    }
    return apiJson({ error: 'Rota não encontrada.' }, 404);
  } catch (error) {
    // Não registrar corpos, dados pessoais, assinaturas ou credenciais.
    return apiJson({ error: error instanceof ApiError ? error.message : 'Serviço temporariamente indisponível. Tente novamente.' }, error instanceof ApiError ? error.status : 503);
  }
}
