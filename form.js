/* Adresa Secretă — formulare de acces conectate la Google Apps Script.
   După deploy, pune URL-ul /exec în ENDPOINT. Nu folosi endpoint-ul primeA:
   acesta trebuie să fie deployment-ul legat de spreadsheet-ul prime_2026_B. */
(() => {
  'use strict';

  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbzOXTmCwRHkqVIzWHSxhaIDF5pZODY7NbPzZC6GMSV51F9y_U7lKY2sMhQfAozZ0XL_/exec';
  // Apps Script cold starts can take 15-20s+; keep time for a write confirmation after.
  const SUBMIT_TIMEOUT_MS = 60000;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} '’.\-]*$/u;

  const ERRORS = {
    config:
      'Formularul nu este disponibil momentan. Te rugăm să revii mai târziu.',
    validation: 'Te rugăm să corectezi câmpurile marcate și să trimiți din nou.',
    invalid_name: 'Numele nu pare valid. Folosește doar litere.',
    invalid_email: 'Adresa de email nu pare validă.',
    invalid_signature: 'Semnătura nu pare validă. Scrie-ți numele complet.',
    duplicate: 'Această adresă de email a trimis deja o cerere.',
    busy: 'Primim multe cereri acum. Te rugăm să revii în câteva minute.',
    server: 'Ceva nu a funcționat. Te rugăm să încerci din nou.',
    endpoint:
      'Serviciul formularului nu a răspuns corect. Te rugăm să revii mai târziu.',
    timeout: 'Nu am primit confirmarea la timp. Cererea poate fi deja înregistrată. Dacă reîncerci și adresa apare ca folosită, solicitarea există deja.',
    unconfirmed: 'Conexiunea s-a întrerupt înainte de confirmare. Cererea poate fi deja înregistrată. Dacă reîncerci și adresa apare ca folosită, solicitarea există deja.',
    network: 'Nu am putut contacta serviciul formularului. Verifică conexiunea și încearcă din nou.'
  };

  function requestError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  }

  async function fetchJsonWithTimeout(url, options, timeoutMs) {
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer;

    try {
      // The deadline covers headers AND the body: response.text() can also stall.
      return await Promise.race([
        Promise.resolve()
          .then(() => fetch(url, { ...options, ...(controller ? { signal: controller.signal } : {}) }))
          .then(response => {
            if (response.ok === false) throw requestError('endpoint');
            return readJson(response);
          }),
        new Promise((resolve, reject) => {
          timer = window.setTimeout(() => {
            reject(requestError('timeout'));
            controller?.abort();
          }, timeoutMs);
        })
      ]);
    } finally {
      window.clearTimeout(timer);
    }
  }

  function readJson(response) {
    return response.text().then(text => {
      try {
        const data = JSON.parse(text);
        if (!data || typeof data.ok !== 'boolean' ||
            (!data.ok && typeof data.error !== 'string')) {
          throw new Error('invalid_response');
        }
        return data;
      } catch (parseError) {
        const error = new Error('invalid_response');
        error.code = 'endpoint';
        throw error;
      }
    });
  }

  function sendRequest(data, timeoutMs) {
    return fetchJsonWithTimeout(
      ENDPOINT,
      {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        credentials: 'omit',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email,
          signature: data.signature,
          company: data.company
        })
      },
      timeoutMs
    ).catch(error => {
      // A lost POST response cannot tell us whether the server already wrote the row.
      error.code = error.code === 'timeout' ? 'timeout' : 'unconfirmed';
      throw error;
    });
  }

  function validateName(value, emptyMessage, shortMessage) {
    if (!value) return emptyMessage;
    if (value.length < 2) return shortMessage;
    if (value.length > 80 || !NAME_RE.test(value)) {
      return 'Folosește doar litere și semne specifice unui nume.';
    }
    return '';
  }

  function initForm(form) {
    const submitButton = form.querySelector('button[type="submit"]');
    const status = form.querySelector('.form-status');
    const success = form.querySelector('.success');
    const submitLabel = submitButton?.textContent || '';
    let submitting = false;
    let slowTimer;

    const rules = {
      fullName: value =>
        validateName(
          value,
          'Te rugăm să îți scrii numele complet.',
          'Numele pare prea scurt.'
        ),
      email: value => {
        if (!value) return 'Te rugăm să îți scrii adresa de email.';
        if (value.length > 254 || !EMAIL_RE.test(value)) {
          return 'Adresa de email nu pare validă.';
        }
        return '';
      },
      signature: (value, data) => {
        if (value !== data.fullName) {
          return 'Semnătura trebuie să fie identică cu numele complet.';
        }
        return validateName(
          value,
          'Completează mai întâi numele complet.',
          'Numele pare prea scurt.'
        );
      }
    };

    function values() {
      return Object.keys(rules).reduce((data, name) => {
        data[name] = (form.elements[name]?.value || '').trim();
        return data;
      }, {});
    }

    function showError(name, message) {
      const input = form.elements[name];
      const error = form.querySelector(`[data-error-for="${name}"]`);

      input?.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (!error) return;
      error.textContent = message;
      error.hidden = !message;
    }

    function finishSubmitting(sent = false) {
      submitting = false;
      window.clearTimeout(slowTimer);
      form.removeAttribute('aria-busy');
      if (submitButton) {
        submitButton.disabled = sent;
        submitButton.textContent = sent ? 'CERERE TRIMISĂ' : submitLabel;
      }
    }

    function notify(kind, title, message, focusTarget) {
      form.dispatchEvent(new CustomEvent('access:result', {
        bubbles: true,
        detail: { kind, title, message, focusTarget }
      }));
    }

    function fail(code, focusTarget = submitButton, message = ERRORS[code] || ERRORS.server) {
      finishSubmitting();
      if (status) status.textContent = message;
      const title = code === 'validation' ? 'Verifică datele completate' :
        code === 'duplicate' ? 'Există deja o cerere' :
        code === 'timeout' || code === 'unconfirmed' ? 'Trimitere neconfirmată' :
        'Cererea nu a fost trimisă';
      notify('error', title, message, focusTarget);
    }

    function showSuccess() {
      form.classList.add('sent');
      finishSubmitting(true);
      if (status) status.textContent = '';
      success?.focus({ preventScroll: true });
      notify('success', 'Cererea a fost trimisă',
        'Am primit cererea ta. O vom analiza personal și te vom contacta discret, la adresa de e-mail indicată.',
        success || submitButton);
    }

    Object.keys(rules).forEach(name => {
      const input = form.elements[name];
      if (!input) return;

      input.addEventListener('input', () => showError(name, ''));
      input.addEventListener('blur', () => {
        const data = values();
        showError(name, rules[name](data[name], data));
      });
    });

    const fullNameInput = form.elements.fullName;
    const signatureInput = form.elements.signature;
    const requestStamp = form.querySelector('.request-stamp');
    const syncRequestStamp = () => {
      if (!requestStamp) return;
      const data = values();
      const ready = !rules.fullName(data.fullName) && !rules.email(data.email);
      requestStamp.classList.toggle('is-ready', ready);
      const label = ready ? 'ACCES' : 'CONFIDENȚIAL';
      if (requestStamp.textContent !== label) requestStamp.textContent = label;
    };
    const syncSignature = () => {
      if (!signatureInput) return;
      signatureInput.value = fullNameInput?.value || '';
      showError('signature', '');
    };
    fullNameInput?.addEventListener('input', syncSignature);
    syncSignature();
    form.addEventListener('input', syncRequestStamp);
    form.addEventListener('change', syncRequestStamp);
    form.addEventListener('reset', () => {
      window.setTimeout(() => {
        if (!submitting) {
          form.classList.remove('sent');
          finishSubmitting();
          if (status) status.textContent = '';
        }
        syncSignature();
        syncRequestStamp();
      }, 0);
    });
    window.addEventListener('pageshow', syncRequestStamp);
    syncRequestStamp();

    form.addEventListener('submit', event => {
      event.preventDefault();
      if (submitting || form.classList.contains('sent')) return;

      const honeypot = form.elements.company;
      if (honeypot?.value) {
        showSuccess();
        return;
      }

      syncSignature();
      const data = values();
      let firstInvalid = '';

      Object.keys(rules).forEach(name => {
        const message = rules[name](data[name], data);
        showError(name, message);
        if (message && !firstInvalid) firstInvalid = name;
      });

      if (firstInvalid) {
        fail('validation', form.elements[firstInvalid]);
        return;
      }

      if (!ENDPOINT) {
        fail('config');
        return;
      }

      if (status) status.textContent = '';
      submitting = true;
      form.setAttribute('aria-busy', 'true');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Se trimite…';
      }
      slowTimer = window.setTimeout(() => {
        if (status) status.textContent = 'Încă așteptăm confirmarea înregistrării. Te rugăm să aștepți…';
      }, 10000);

      data.company = honeypot?.value || '';
      sendRequest(data, SUBMIT_TIMEOUT_MS)
        .then(result => {
          if (result?.ok) {
            showSuccess();
            return;
          }
          fail(result?.error || 'server');
        })
        .catch(error => fail(error?.code || 'network'));
    });
  }

  document.querySelectorAll('form.access-form').forEach(initForm);
})();
