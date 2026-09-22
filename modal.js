
(() => {
  'use strict';

  const doc = document;
  const modal = doc.getElementById('acces-modal');
  if (!modal) return;

  const resultDialog = doc.getElementById('request-result');
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

    const timer = setTimeout(done, 400);
    modal.addEventListener('transitionend', onEnd);
  };

  /* Native links keep their #contact fallback and modified-click behavior. */
  doc.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const target = e.target instanceof Element ? e.target : null;
    const trigger = target?.closest('a.primary[href="#contact"], [data-modal="acces"]');
    if (trigger) {
      e.preventDefault();
      open(trigger);
    }
  });


  closeBtn?.addEventListener('click', close);


  if (resultDialog instanceof HTMLDialogElement) {
    const resultTitle = resultDialog.querySelector('#request-result-title');
    const resultMessage = resultDialog.querySelector('#request-result-message');
    const resultIcon = resultDialog.querySelector('.request-result-icon');
    let resultFocusTarget = null;

    doc.addEventListener('access:result', (event) => {
      const form = event.target;
      const detail = event.detail;
      if (!(form instanceof HTMLFormElement) || !form.matches('.access-form')) return;
      if (!detail || !['success', 'error'].includes(detail.kind)) return;
      if (typeof detail.title !== 'string' || typeof detail.message !== 'string') return;

      resultDialog.dataset.kind = detail.kind;
      resultTitle.textContent = detail.title;
      resultMessage.textContent = detail.message;
      resultIcon.textContent = detail.kind === 'success' ? '✓' : '!';
      resultFocusTarget = detail.focusTarget instanceof HTMLElement
        ? detail.focusTarget
        : form.querySelector('button[type="submit"]');

      if (!resultDialog.open) resultDialog.showModal();
      doc.documentElement.classList.add('result-open');
      resultDialog.scrollTop = 0;
      resultTitle.focus({ preventScroll: true });
    });

    resultDialog.querySelectorAll('[data-result-close]').forEach((button) => {
      button.addEventListener('click', () => resultDialog.close());
    });
    resultDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      resultDialog.close();
    });
    resultDialog.addEventListener('close', () => {
      // Un rezultat nou poate fi deschis înaintea acestui eveniment asincron.
      if (resultDialog.open) return;
      doc.documentElement.classList.remove('result-open');
      const target = resultFocusTarget;
      resultFocusTarget = null;
      if (target?.isConnected && !target.disabled && target.getClientRects().length) {
        target.focus({ preventScroll: true });
      } else if (!modal.hidden) {
        (firstField ?? closeBtn)?.focus({ preventScroll: true });
      }
    });
  }


  doc.addEventListener('keydown', (e) => {
    if (modal.hidden || resultDialog?.open || e.key !== 'Tab') return;
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
