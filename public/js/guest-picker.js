(() => {
  const picker = document.getElementById('guest-picker');
  if (!picker) return;
  const summary = document.getElementById('guest-summary');
  const total = document.getElementById('guest-count');
  const fields = Object.fromEntries(['adults', 'children', 'infants'].map(key => [key, document.getElementById('guest-' + key)]));
  const buttons = [...document.querySelectorAll('.guest-step[data-guest]')];
  const count = key => Number(fields[key].dataset.count);
  function update() {
    total.value = count('adults') + count('children');
    summary.textContent = total.value + (Number(total.value) === 1 ? ' hóspede' : ' hóspedes') + (count('infants') ? ', ' + count('infants') + (count('infants') === 1 ? ' bebê' : ' bebês') : '');
    for (const button of buttons) {
      const key = button.dataset.guest.replace('guest-', '');
      button.disabled = Number(button.dataset.step) < 0 ? count(key) <= (key === 'adults' ? 1 : 0) : key !== 'infants' && Number(total.value) >= 8;
    }
  }
  for (const button of buttons) button.addEventListener('click', () => {
    const field = document.getElementById(button.dataset.guest);
    field.dataset.count = Number(field.dataset.count) + Number(button.dataset.step);
    field.textContent = field.dataset.count;
    update();
    total.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const serviceInfo = document.getElementById('service-animal-info');
  const serviceDialog = document.getElementById('service-animal-dialog');
  let previousOverflow = '';
  serviceInfo.addEventListener('click', () => {
    previousOverflow = document.body.style.overflow;
    serviceDialog.showModal();
    document.body.style.overflow = 'hidden';
  });
  document.getElementById('service-animal-close').addEventListener('click', () => serviceDialog.close());
  serviceDialog.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    serviceInfo.focus();
  });
  const trigger = picker.querySelector('summary');
  function close(focus = false) { picker.open = false; if (focus) trigger.focus(); }
  document.getElementById('guest-picker-close').addEventListener('click', () => close(true));
  document.addEventListener('click', event => { if (picker.open && !serviceDialog.open && !serviceDialog.contains(event.target) && !picker.contains(event.target)) close(); });
  picker.addEventListener('keydown', event => { if (event.key === 'Escape' && picker.open && !serviceDialog.open) { event.preventDefault(); close(true); } });
  update();
})();
