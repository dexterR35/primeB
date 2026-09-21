/* Adresa Secretă — formulare de acces conectate la Google Apps Script.
   După deploy, pune URL-ul /exec în ENDPOINT. Nu folosi endpoint-ul primeA:
   acesta trebuie să fie deployment-ul legat de spreadsheet-ul prime_2026_B. */
(() => {
  'use strict';

  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbxiskFiTGyhbpWKNCFBYbpiC2coVF0Xfq9PBmxeK1LKYu-_cDpil415aj-m2-LFRQBp/exec';
  // Apps Script poate avea un cold start de peste 20 s. Nu întrerupem
  // prematur requestul și nu raportăm greșit timeout-ul drept lipsă de internet.
  const TOKEN_TIMEOUT_MS = 45000;
  const SUBMIT_TIMEOUT_MS = 60000;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} '’.\-]*$/u;

  const ERRORS = {
    config:
      'Formularul nu este încă legat la Google Sheets. Configurează URL-ul Apps Script.',
    invalid_name: 'Numele nu pare valid. Folosește doar litere.',
    invalid_email: 'Adresa de email nu pare validă.',
    invalid_signature: 'Semnătura nu pare validă. Scrie-ți numele complet.',
    duplicate: 'Această adresă de email a trimis deja o cerere.',
    token: 'Sesiunea a expirat. Reîncarcă pagina și încearcă din nou.',
    busy: 'Primim multe cereri acum. Te rugăm să revii în câteva minute.',
    server: 'Ceva nu a funcționat. Te rugăm să încerci din nou.',
    endpoint:
      'Serviciul formularului nu a răspuns corect. Verifică deployment-ul Apps Script.',
    network: 'Nu am putut contacta serviciul formularului. Încearcă din nou.'
  };

  function fetchWithTimeout(url, options, timeoutMs) {
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer;

    if (controller) options.signal = controller.signal;

    return new Promise((resolve, reject) => {
      timer = window.setTimeout(() => {
        controller?.abort();
        reject(new Error('timeout'));
      }, timeoutMs);

      fetch(url, options).then(resolve, reject);
    }).then(
      response => {
        window.clearTimeout(timer);
        return response;
      },
      error => {
        window.clearTimeout(timer);
        throw error;
      }
    );
  }

  function delay(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  function readJson(response) {
    return response.text().then(text => {
      try {
        return JSON.parse(text);
      } catch (parseError) {
        const error = new Error('invalid_response');
        error.code = 'endpoint';
        throw error;
      }
    });
  }

  const tokens = (() => {
    let pending = null;

    function refresh() {
      if (!ENDPOINT) return null;

      pending = fetchWithTimeout(
        `${ENDPOINT}?action=token`,
        {
          method: 'GET',
          mode: 'cors',
          redirect: 'follow',
          credentials: 'omit',
          cache: 'no-store'
        },
        TOKEN_TIMEOUT_MS
      )
        .then(readJson)
        .then(data => {
          if (data?.ok && data.token) return { token: data.token, error: null };
          const error = new Error('invalid_token_response');
          error.code = 'endpoint';
          return { token: '', error };
        })
        .catch(error => ({ token: '', error }));

      return pending;
    }

    return {
      prime() {
        if (!pending) refresh();
      },
      take() {
        // Dacă prime() nu a apucat să ruleze (autocomplete fără focus, de
        // exemplu), cerem un token acum și îl consumăm pe ACELA. Înainte,
        // `current || pending` întorcea tokenul proaspăt fără să-l scoată din
        // pending, deci aceeași valoare pleca și la trimiterea următoare —
        // a doua oară serverul o refuza, fiind deja consumată.
        const current = pending || refresh();
        pending = null;
        refresh();
        return current || Promise.resolve({ token: '', error: null });
      }
    };
  })();

  function sendRequest(token, data) {
    return fetchWithTimeout(
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
          company: data.company,
          token
        })
      },
      SUBMIT_TIMEOUT_MS
    ).then(readJson);
  }

  function submitRequest(data) {
    let tokenRetries = 0;
    let busyRetries = 0;
    let networkRetries = 0;
    let ambiguousRetry = false;

    function attempt() {
      return tokens
        .take()
        .then(tokenState => {
          if (!tokenState.token) {
            throw tokenState.error || new Error('token_fetch');
          }
          return sendRequest(tokenState.token, data);
        })
        .then(
          result => {
            if (result?.ok) return result;

            const code = result?.error || 'server';
            // Dacă răspunsul primei încercări s-a pierdut după scriere,
            // duplicate la retry înseamnă că cererea a ajuns cu succes.
            if (code === 'duplicate' && ambiguousRetry) return { ok: true };
            if (code === 'token' && tokenRetries < 1) {
              tokenRetries += 1;
              return delay(1600).then(attempt);
            }
            if (code === 'busy' && busyRetries < 1) {
              busyRetries += 1;
              return delay(1200).then(attempt);
            }
            return result;
          },
          error => {
            if (networkRetries < 1) {
              networkRetries += 1;
              ambiguousRetry = true;
              return delay(1200).then(attempt);
            }
            throw error;
          }
        );
    }

    return attempt();
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

    function fail(code) {
      submitting = false;
      if (status) status.textContent = ERRORS[code] || ERRORS.server;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitLabel;
      }
    }

    function showSuccess() {
      form.classList.add('sent');
      if (success) {
        success.focus({ preventScroll: true });
      }
    }

    form.addEventListener(
      'focusin',
      () => {
        tokens.prime();
      },
      { once: true }
    );

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
    const syncSignature = () => {
      if (!signatureInput) return;
      signatureInput.value = fullNameInput?.value || '';
      showError('signature', '');
    };
    fullNameInput?.addEventListener('input', syncSignature);
    syncSignature();

    form.addEventListener('submit', event => {
      event.preventDefault();
      if (submitting) return;

      const honeypot = form.elements.company;
      if (honeypot?.value) {
        showSuccess();
        return;
      }

      const data = values();
      let firstInvalid = '';

      Object.keys(rules).forEach(name => {
        const message = rules[name](data[name], data);
        showError(name, message);
        if (message && !firstInvalid) firstInvalid = name;
      });

      if (firstInvalid) {
        if (status) status.textContent = 'Te rugăm să corectezi câmpurile marcate.';
        form.elements[firstInvalid]?.focus();
        return;
      }

      if (!ENDPOINT) {
        fail('config');
        return;
      }

      if (status) status.textContent = '';
      submitting = true;
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Se trimite…';
      }

      data.company = honeypot?.value || '';
      submitRequest(data)
        .then(result => {
          if (result?.ok) {
            showSuccess();
            return;
          }
          fail(result?.error || 'server');
        })
        .catch(error => fail(error?.code === 'endpoint' ? 'endpoint' : 'network'));
    });
  }

  document.querySelectorAll('form.access-form').forEach(initForm);
})();
