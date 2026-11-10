(() => {
  const button = document.getElementById('btn-pix-checkout');
  const dialog = document.getElementById('pix-checkout');
  const form = document.getElementById('pix-form');
  const status = document.getElementById('pix-status');
  const details = document.getElementById('pix-details');
  const feedback = document.getElementById('pix-feedback');
  const submit = document.getElementById('pix-submit');
  const welcome = document.createElement('a');
  welcome.href = '/guia-hospede.html';
  welcome.className = 'welcome-button';
  welcome.textContent = 'Abrir manual digital de boas-vindas →';
  welcome.hidden = true;
  details.append(welcome);
  let serverQuote, cardConfig, cardController, cardLoading = false, submitting = false, selected, poll, polling = false, attempt = null;
  const formatDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('/') : value;
  const money = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  function reportCardTiming(stage, ms) {
    if (!Number.isFinite(ms)) return;
    fetch('/api/card-load-timing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage, ms: Math.round(ms) }), keepalive: true }).catch(() => {});
  }
  function selectionIdentity(data) {
    return JSON.stringify([data.checkin, data.checkout, Number(data.guests), Number(data.adults ?? data.guests), Number(data.children || 0), Number(data.infants || 0), [...(data.extras || [])].sort()]);
  }
  const attemptStorageKey = 'eco_pix_attempt:' + selectionIdentity(capture());
  try {
    const legacy = JSON.parse(sessionStorage.getItem('eco_pix_attempt') || 'null');
    if (legacy?.payload) {
      const legacyKey = 'eco_pix_attempt:' + selectionIdentity(legacy.payload);
      if (!sessionStorage.getItem(legacyKey)) sessionStorage.setItem(legacyKey, JSON.stringify(legacy));
      sessionStorage.removeItem('eco_pix_attempt');
    }
    attempt = JSON.parse(sessionStorage.getItem(attemptStorageKey) || 'null');
    if (document.body.dataset.reservationPage === 'true') {
      const others = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (!key.startsWith('eco_pix_attempt:') || key === attemptStorageKey) continue;
        try { const previous = JSON.parse(sessionStorage.getItem(key)); if (previous?.payload) others.push(previous.payload); } catch { /* registro inválido */ }
      }
      if (others.length) {
        const note = document.createElement('aside'); note.className = 'previous-attempts';
        const label = document.createElement('p'); label.textContent = 'Há solicitações anteriores neste navegador. Elas não foram canceladas nem substituídas por esta reserva.'; note.append(label);
        others.forEach(payload => {
          const link = document.createElement('a');
          const params = new URLSearchParams({checkin:payload.checkin,checkout:payload.checkout,adults:String(payload.adults ?? payload.guests),children:String(payload.children || 0),infants:String(payload.infants || 0)});
          link.href = '/reservar.html?' + params;
          link.textContent = 'Consultar ' + formatDate(payload.checkin) + ' até ' + formatDate(payload.checkout);
          note.append(link);
        });
        form.before(note);
      }
    }
  } catch { /* armazenamento indisponível */ }
  function save() { try { attempt ? sessionStorage.setItem(attemptStorageKey, JSON.stringify(attempt)) : sessionStorage.removeItem(attemptStorageKey); } catch { /* funciona na sessão atual */ } }
  async function api(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
    const data = await response.json();
    if (!response.ok) { const error = new Error(data.error || 'Serviço indisponível.'); error.status = response.status; throw error; }
    return data;
  }
  function stopPolling() { clearInterval(poll); poll = null; }
  function showBooking(data) {
    welcome.hidden = data.status !== 'approved';
    form.hidden = true; details.hidden = false;
    const cardSection = document.getElementById('card-section'); if (cardSection) cardSection.hidden = true;
    document.getElementById('pix-reservation').textContent = data.id;
    document.getElementById('pix-amount').textContent = money(data.total);
    document.getElementById('pix-period').textContent = `${formatDate(data.checkin)} até ${formatDate(data.checkout)}`;
    const image = document.getElementById('pix-image'), code = document.getElementById('pix-code'), copy = document.getElementById('pix-copy');
    image.hidden = true; code.hidden = true; copy.hidden = true;
    if (data.status === 'approved') {
      status.textContent = 'Pagamento confirmado pelo Mercado Pago. Sua reserva está confirmada. Guarde o identificador abaixo e fale com o anfitrião para receber as instruções de acesso.';
      stopPolling(); attempt = null; save(); refreshAvailability();
    } else if (data.status === 'canceled') {
      status.textContent = 'A cobrança foi cancelada ou expirou no Mercado Pago. Nenhuma reserva foi confirmada. Você pode fechar esta janela e consultar novas datas.';
      stopPolling(); attempt = null; save(); refreshAvailability();
    } else if (data.status === 'review') {
      status.textContent = 'Este pagamento precisa de conferência pelo anfitrião. Não faça outro pagamento. Informe o identificador abaixo pelo WhatsApp.';
      stopPolling();
    } else {
      const expired = Date.now() > data.expiresAt;
      status.textContent = expired ? 'O prazo de pagamento terminou. Estamos conferindo a situação no Mercado Pago. Não pague este código; não gere outra solicitação antes da confirmação.' : 'Aguardando confirmação do Mercado Pago. Sua reserva será confirmada somente após a verificação do pagamento.';
      if (!expired && data.pixQrBase64 && data.pixCopiaECola) {
        image.src = 'data:image/png;base64,' + data.pixQrBase64;
        image.hidden = false; code.value = data.pixCopiaECola; code.hidden = false; copy.hidden = false;
      }
    }
  }
  async function check() {
    if (!attempt || polling) return;
    polling = true;
    try { showBooking(await api('/api/check-payment/' + attempt.id, { headers: { 'X-Booking-Key': attempt.key } })); feedback.textContent = ''; }
    catch (e) { feedback.textContent = e.message + ' Não faça outro pagamento enquanto conferimos esta solicitação.'; }
    finally { polling = false; }
  }
  function startPolling() { stopPolling(); poll = setInterval(check, 20000); }
  function capture() {
    return { checkin: document.getElementById('checkin-date').value, checkout: document.getElementById('checkout-date').value,
      guests: Number(document.getElementById('guest-count').value), adults: Number(document.getElementById('guest-adults').textContent), children: Number(document.getElementById('guest-children').textContent), infants: Number(document.getElementById('guest-infants').textContent), extras: [] };
  }
  async function refreshAvailability() {
    try {
      const data = await api('/api/availability');
      window.ecoBlockedDates = data.blockedDates;
      window.dispatchEvent(new Event('eco-availability'));
      document.getElementById('availability-note').textContent = 'Datas ocupadas ou aguardando pagamento são bloqueadas. A disponibilidade é conferida novamente ao gerar o PIX.';
    } catch {
      window.dispatchEvent(new Event('eco-availability-error'));
      document.getElementById('availability-note').textContent = 'Não foi possível atualizar o calendário. A disponibilidade será conferida ao gerar o PIX.';
    }
  }
  async function openCheckout() {
    feedback.textContent = ''; details.hidden = true; form.hidden = false; status.textContent = '';
    if (dialog.tagName === 'DIALOG') dialog.showModal();
    if (attempt) {
      form.hidden = true; details.hidden = false; status.textContent = 'Conferindo sua solicitação anterior…';
      if (attempt.retry) { form.hidden = false; details.hidden = true; submit.textContent = 'Tentar novamente a mesma solicitação'; }
      else { await check(); if (attempt) startPolling(); return; }
    }
    try {
      selected = attempt?.payload || capture();
      const q = await api('/api/quote', { method: 'POST', body: JSON.stringify(selected) });
      serverQuote = q;
      document.getElementById('pix-summary').textContent = `${formatDate(q.checkin)} até ${formatDate(q.checkout)} · ${q.nights} noites · Total ${money(q.total)}`;
      submit.disabled = document.body.dataset.reservationPage === 'true';
      if (document.body.dataset.reservationPage === 'true') { document.getElementById('reservation-total').textContent = money(q.total); document.getElementById('reservation-nights').textContent = q.nights + ' diárias × R$ 600,00'; document.dispatchEvent(new Event('eco-payment-config')); updatePaymentChoice(); }
      if (attempt?.payload) { form.elements.name.value = attempt.payload.name; form.elements.email.value = attempt.payload.email; }
    } catch (e) { feedback.textContent = e.message; submit.disabled = true; }
  }
  if (document.body.dataset.reservationPage === 'true') openCheckout();
  else button?.addEventListener('click', () => {
    if (window.validateBookingDates && !window.validateBookingDates()) { document.getElementById('checkin-date').reportValidity(); return; }
    const selection = capture();
    if (!selection.checkin || !selection.checkout || (Date.parse(selection.checkout)-Date.parse(selection.checkin))/86400000 < 2) { alert('Selecione uma estadia de pelo menos 2 diárias.'); return; }
    location.href = '/reservar.html?' + new URLSearchParams(Object.entries(selection).filter(([key]) => key !== 'extras'));
  });
  document.getElementById('pix-close')?.addEventListener('click', () => { dialog.close(); stopPolling(); });
  dialog?.addEventListener('close', stopPolling);
  async function processPayment(event, card = null) {
    event.preventDefault();
    if (submitting) return;
    if (!card && document.getElementById('card-choice')?.checked) { feedback.textContent = 'Conclua o pagamento no formulário seguro de cartão abaixo.'; return; }
    submitting = true; submit.disabled = true; feedback.textContent = card ? 'Processando pagamento com cartão…' : 'Gerando sua cobrança PIX…';
    if (!attempt) {
      const key = [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, '0')).join('');
      attempt = { id: crypto.randomUUID(), key, retry: true, payload: { ...selected, name: form.elements.name.value, email: form.elements.email.value, ...(card ? { card } : {}) } }; save();
    }
    try {
      const booking = await api('/api/create-payment', { method: 'POST', headers: { 'Idempotency-Key': attempt.id, 'X-Booking-Key': attempt.key }, body: JSON.stringify(attempt.payload) });
      attempt.retry = false; save(); feedback.textContent = ''; showBooking(booking); if (attempt) startPolling(); refreshAvailability();
    } catch (e) {
      feedback.textContent = e.message;
      if (e.status === 400 || e.status === 409) {
        attempt = null; save(); submit.disabled = true;
        feedback.textContent += ' Feche esta janela e confira as datas para tentar de novo.';
      } else submit.textContent = 'Tentar novamente a mesma solicitação';
    } finally { submitting = false; if (attempt) submit.disabled = false; }
  }
  form?.addEventListener('submit', event => processPayment(event));
  document.getElementById('pix-copy')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(document.getElementById('pix-code').value); feedback.textContent = 'Código PIX copiado.'; }
    catch { feedback.textContent = 'Selecione o código e copie manualmente.'; }
  });
  async function updatePaymentChoice() {
    if (document.body.dataset.reservationPage !== 'true') return;
    const cardSelected = document.getElementById('card-choice').checked;
    submit.hidden = cardSelected;
    const section = document.getElementById('card-section');
    const paymentOpen = !document.getElementById('payment-step').hidden;
    section.hidden = !cardSelected || !paymentOpen;
    section.inert = false;
    const pixOption = document.getElementById('pix-option-details'); if (pixOption) pixOption.hidden = cardSelected;
    const interestNote = document.getElementById('card-installment-note'); if (interestNote) interestNote.hidden = !cardSelected;
    if (!cardSelected || !paymentOpen || cardController || cardLoading || !cardConfig?.cardEnabled || !serverQuote) return;
    cardLoading = true;
    const mountStarted = performance.now();
    const sdkResource = performance.getEntriesByType('resource').find(entry => entry.name.startsWith('https://sdk.mercadopago.com/js/v2'));
    if (sdkResource) reportCardTiming('sdk_download', sdkResource.duration);
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation) reportCardTiming('page_response', navigation.responseEnd - navigation.requestStart);
    const loadingStatus = document.getElementById('card-loading-status');
    const retry = document.getElementById('card-retry');
    loadingStatus.hidden = false; loadingStatus.textContent = 'Carregando formulário seguro do Mercado Pago…'; retry.hidden = true;
    const loadingTimeout = setTimeout(() => { reportCardTiming('fields_timeout', performance.now() - mountStarted); loadingStatus.textContent = 'O formulário está demorando para carregar. Confira sua conexão ou tente novamente.'; retry.hidden = false; }, 20000);
    try {
      if (!window.MercadoPago) throw new Error('Não foi possível carregar o formulário do Mercado Pago. Atualize a página.');
      const mp = new MercadoPago(cardConfig.publicKey, { locale: 'pt-BR' });
      cardController = await mp.bricks().create('cardPayment', 'card-payment-brick', {
        initialization: { amount: Number(serverQuote.total), payer: { email: form.elements.email.value } },
        customization: { paymentMethods: { minInstallments: 1, maxInstallments: 12, types: { excluded: ['debit_card', 'prepaid_card'] } } },
        callbacks: { onReady: () => { reportCardTiming('fields_ready', performance.now() - mountStarted); clearTimeout(loadingTimeout); loadingStatus.hidden = true; retry.hidden = true; }, onError: error => { reportCardTiming('fields_error', performance.now() - mountStarted); clearTimeout(loadingTimeout); loadingStatus.hidden = false; loadingStatus.textContent = 'Não foi possível carregar ou validar o formulário do Mercado Pago. Tente novamente.'; retry.hidden = false; }, onSubmit: async (data, extra) => {
          if (!cardConfig.cardEnabled || !form.reportValidity() || document.getElementById('payment-step').hidden) throw new Error('Conclua seus dados antes de continuar.');
          if (extra.paymentTypeId !== 'credit_card') throw new Error('Escolha um cartão de crédito.');
          await processPayment({ preventDefault() {} }, { type: 'credit_card', id: data.payment_method_id, token: data.token, installments: Number(data.installments), identification: data.payer.identification });
        } }
      });
      reportCardTiming('brick_created', performance.now() - mountStarted);
    } catch (error) { reportCardTiming('init_error', performance.now() - mountStarted); clearTimeout(loadingTimeout); loadingStatus.textContent = error.message || 'Não foi possível carregar o formulário seguro.'; retry.hidden = false; } finally { cardLoading = false; }
  }
  document.querySelectorAll('input[name="payment-choice"]').forEach(input => input.addEventListener('change', updatePaymentChoice));
  window.addEventListener('eco-payment-step', updatePaymentChoice);
  document.getElementById('card-retry')?.addEventListener('click', async () => {
    if (cardLoading) { location.reload(); return; }
    await cardController?.unmount(); cardController = null;
    document.getElementById('card-payment-brick').replaceChildren();
    updatePaymentChoice();
  });
  window.addEventListener('pagehide', () => { stopPolling(); cardController?.unmount(); });
  api('/api/config').then(config => {
    cardConfig = config;
    if (document.getElementById('card-choice')) {
      document.getElementById('card-choice').disabled = !config.cardEnabled;
      document.getElementById('card-availability').hidden = config.cardEnabled;
    }
    if (button) button.hidden = false;
    document.getElementById('payments-note').hidden = document.body.dataset.reservationPage !== 'true' || config.paymentsEnabled;
    if (document.body.dataset.reservationPage === 'true') { window.ecoPaymentsEnabled = config.paymentsEnabled; document.dispatchEvent(new Event('eco-payment-config')); updatePaymentChoice(); }
  }).catch(() => { if (button) button.hidden = false; });
  refreshAvailability();
})();
