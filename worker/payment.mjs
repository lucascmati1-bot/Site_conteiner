export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const DAILY = 60000;
export const CLEANING = 15000;
// Total temporário solicitado pelo proprietário para teste de transação.
export const TEST_TOTAL_CENTS = 50;
const EXTRAS = { 'extra-cesta': 12000, 'extra-fogueira': 8000, 'extra-romantico': 16000 };
export function dateValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError(400, 'Data inválida.');
  const ms = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) throw new ApiError(400, 'Data inválida.');
  return ms;
}
export function quote(input, now = Date.now()) {
  const start = dateValue(input.checkin), end = dateValue(input.checkout);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
  if (input.checkin < today || start > now + 366 * 86400000 || end <= start) throw new ApiError(400, 'Escolha datas futuras e saída após a entrada.');
  const nights = (end - start) / 86400000;
  if (nights < 2) throw new ApiError(400, 'A estadia mínima é de 2 diárias.');
  if (nights > 30) throw new ApiError(400, 'Para estadias acima de 30 noites, fale com o anfitrião.');
  const extras = input.extras ?? [];
  if (!Array.isArray(extras) || extras.length > 3 || new Set(extras).size !== extras.length || extras.some(x => !Object.hasOwn(EXTRAS, x))) throw new ApiError(400, 'Adicionais inválidos.');
  if (!Number.isInteger(input.guests) || input.guests < 1 || input.guests > 8) throw new ApiError(400, 'Informe de 1 a 8 hóspedes, não incluindo bebês.');
  if (input.adults !== undefined || input.children !== undefined || input.infants !== undefined) {
    if (!Number.isSafeInteger(input.adults) || input.adults < 1 || !Number.isSafeInteger(input.children) || input.children < 0 || !Number.isSafeInteger(input.infants) || input.infants < 0 || input.adults + input.children !== input.guests) throw new ApiError(400, 'Informe a quantidade válida de adultos, crianças e bebês, com pelo menos um adulto.');
  }
  return { checkin: input.checkin, checkout: input.checkout, guests: input.guests, extras: [...extras].sort(), nights,
    totalCents: TEST_TOTAL_CENTS,
    dates: Array.from({ length: nights }, (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10)) };
}
export function validateGuest(input) {
  const name = String(input.name || '').trim(), email = String(input.email || '').trim().toLowerCase();
  if (name.length < 3 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new ApiError(400, 'Preencha nome e e-mail válidos.');
  return { name, email };
}
export function amountCents(value) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value)) return -1;
  return Math.round(Number(value) * 100);
}
export function cardPayment(input) {
  if (!input || input.type !== 'credit_card' || !/^[a-zA-Z0-9_-]{1,60}$/.test(input.id || '') || !/^[a-zA-Z0-9_-]{10,256}$/.test(input.token || '') || !Number.isInteger(input.installments) || input.installments < 1 || input.installments > 12) throw new ApiError(400, 'Dados de cartão ou parcelamento inválidos.');
  const identification = input.identification;
  if (!identification || !['CPF','CNPJ'].includes(identification.type) || !/^\d{11,14}$/.test(identification.number || '')) throw new ApiError(400, 'Documento do titular inválido.');
  return { id: input.id, type: 'credit_card', token: input.token, installments: input.installments, identification: { type: identification.type, number: identification.number } };
}
export function orderPayload(id, totalCents, email, card = null) {
  const amount = (totalCents / 100).toFixed(2);
  return { type: 'online', processing_mode: 'automatic', total_amount: amount, external_reference: id,
    config: { location: { state_id: 'BR-SP' } },
    transactions: { payments: [card ? { amount, payment_method: { id: card.id, type: 'credit_card', token: card.token, installments: card.installments } } : { amount, payment_method: { id: 'pix', type: 'bank_transfer' }, expiration_time: 'PT30M' }] },
    payer: card ? { email, identification: card.identification } : { email } };
}
export function orderState(order, booking) {
  if (order.id !== booking.order_id || order.external_reference !== booking.id || amountCents(order.total_amount) !== booking.total_cents || (order.currency_id && order.currency_id !== 'BRL') || (order.country_code && order.country_code !== 'BRA')) return 'review';
  const payments = order.transactions?.payments || [];
  if (order.status === 'processed' && order.status_detail === 'accredited') {
    let expected = { id: 'pix', type: 'bank_transfer' };
    try { expected = JSON.parse(booking.order_payload).transactions.payments[0].payment_method; } catch { /* reservas PIX antigas */ }
    const paid = payments.filter(p => p.status === 'processed' && p.status_detail === 'accredited' && p.payment_method?.id === expected.id && (expected.type !== 'credit_card' || (p.payment_method?.type === 'credit_card' && p.payment_method?.installments === expected.installments)));
    const sum = paid.reduce((n, p) => n + Math.max(0, amountCents(p.paid_amount ?? p.amount)), 0);
    return sum === booking.total_cents && amountCents(order.total_paid_amount) === booking.total_cents ? 'approved' : 'review';
  }
  if (booking.status === 'approved' || booking.status === 'review') return booking.status;
  if (['canceled', 'cancelled', 'failed'].includes(order.status) && !payments.some(p => p.status === 'processed')) return 'canceled';
  return 'pending';
}
export async function sha256(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function validSignature(request, secret, id, now = Date.now()) {
  const parts = (request.headers.get('x-signature') || '').split(',').map(x => x.trim().split('='));
  const sig = Object.fromEntries(parts), rid = request.headers.get('x-request-id');
  if (!secret || !rid || !/^\d{10,13}$/.test(sig.ts || '') || !/^[a-f0-9]{64}$/i.test(sig.v1 || '')) return false;
  const ts = Number(sig.ts) * (sig.ts.length === 10 ? 1000 : 1);
  if (Math.abs(now - ts) > 5 * 60 * 1000) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const signature = new Uint8Array(sig.v1.match(/../g).map(x => parseInt(x, 16)));
  return crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(`id:${id.toLowerCase()};request-id:${rid};ts:${sig.ts};`));
}
