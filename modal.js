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
  const firstField = modal.querySelector('input:not([tabindex="-1"])');
  let opener = null; // butonul de unde s-a deschis, ca să-i redăm focusul

  const focusable = () =>
    [...modal.querySelectorAll('button, input:not([tabindex="-1"]), a[href], [tabindex]:not([tabindex="-1"])')]
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
      clearTimeout(timer);
      modal.removeEventListener('transitionend', onEnd);
      modal.hidden = true;
      opener?.focus({ preventScroll: true });
      opener = null;
    };
    const onEnd = (e) => {
      if (e.target !== modal || e.propertyName !== 'opacity') return;
      done();
    };
    /* Plasa de siguranță pentru cazul în care estomparea nu pornește deloc
       (filă în fundal, animații oprite din sistem): ascundem oricum după
       400 ms. Ascultătorul se scoate pe AMBELE drumuri — altfel cel rămas
       prindea tranziția următoarei deschideri și închidea modalul singur. */
    const timer = setTimeout(done, 400);
    modal.addEventListener('transitionend', onEnd);
  };

  /* Butoanele roșii care duceau la #contact deschid acum modalul.
     Link-urile de navigație „Contact" continuă să coboare la secțiune. */
  doc.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const trigger = target?.closest('a.primary[href="#contact"], [data-modal="acces"]');
    if (trigger) {
      e.preventDefault();
      open(trigger);
    }
  });

  /* Închiderea trece doar pe aici: clicul pe .modal-close urcă oricum până la
     buton. Înainte mai exista și o ramură în listener-ul de mai sus, deci
     close() rula de două ori la fiecare clic, cu două cronometre în paralel. */
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
})();
