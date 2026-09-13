/* Adresa Secretă — modalul de acces.
   Butoanele roșii „VREAU SĂ AFLU" deschid modalul în loc să coboare la
   formularul din josul paginii (care rămâne acolo, neschimbat).
   Modalul se închide DOAR din butonul ÎNCHIDE: nici clicul pe fundal,
   nici Escape nu îl închid. */
(() => {
  'use strict';

  const doc = document;
  const modal = doc.getElementById('acces-modal');
  if (!modal) return;

  const closeBtn = modal.querySelector('.modal-close');
  const form = modal.querySelector('form');
  const firstField = modal.querySelector('input');
  let opener = null; // butonul de unde s-a deschis, ca să-i redăm focusul

  const focusable = () =>
    [...modal.querySelectorAll('button, input, a[href], [tabindex]:not([tabindex="-1"])')]
      .filter((el) => !el.disabled && el.offsetParent !== null);

  const open = (trigger = null) => {
    if (!modal.hidden) return;
    opener = trigger;
    modal.hidden = false;
    doc.documentElement.classList.add('modal-open');
    // un frame ca tranziția să pornească din starea închisă
    requestAnimationFrame(() => {
      modal.classList.add('is-open');
      (firstField ?? closeBtn)?.focus({ preventScroll: true });
    });
  };

  const close = () => {
    if (modal.hidden) return;
    modal.classList.remove('is-open');
    doc.documentElement.classList.remove('modal-open');

    const done = () => {
      modal.hidden = true;
      opener?.focus({ preventScroll: true });
      opener = null;
    };
    // ascundem după ce se termină estomparea
    const timer = setTimeout(done, 400);
    modal.addEventListener('transitionend', function once(e) {
      if (e.target !== modal || e.propertyName !== 'opacity') return;
      modal.removeEventListener('transitionend', once);
      clearTimeout(timer);
      done();
    });
  };

  /* Butoanele roșii care duceau la #contact deschid acum modalul.
     Link-urile de navigație „Contact" continuă să coboare la secțiune. */
  doc.addEventListener('click', (e) => {
    const trigger = e.target.closest('a.primary[href="#contact"], [data-modal="acces"]');
    if (trigger) {
      e.preventDefault();
      open(trigger);
      return;
    }
    if (e.target.closest('.modal-close')) close();
  });

  closeBtn?.addEventListener('click', close);

  /* Focusul rămâne în modal cât timp e deschis. */
  doc.addEventListener('keydown', (e) => {
    if (modal.hidden || e.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) return;

    const first = items[0];
    const last = items.at(-1);
    if (e.shiftKey && doc.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && doc.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  /* Demo, ca și formularul din pagină: nu trimite nimic. */
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    form.classList.add('sent');
    form.querySelector('.success')?.focus?.();
  });
})();
