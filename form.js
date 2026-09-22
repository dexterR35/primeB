/* Adresa Secretă — formulare de acces conectate la Google Apps Script.
   După deploy, pune URL-ul /exec în ENDPOINT. Nu folosi endpoint-ul primeA:
   acesta trebuie să fie deployment-ul legat de spreadsheet-ul prime_2026_B. */
(() => {
  'use strict';

  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbxiskFiTGyhbpWKNCFBYbpiC2coVF0Xfq9PBmxeK1LKYu-_cDpil415aj-m2-LFRQBp/exec';
  // Allow Apps Script cold starts, but bound the entire submission to one minute.
  const TOKEN_TIMEOUT_MS = 45000;
  const SUBMIT_TIMEOUT_MS = 60000;
  const TOKEN_MIN_AGE_MS = 1300;
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
    token: 'Sesiunea a expirat. Reîncarcă pagina și încearcă din nou.',
    busy: 'Primim multe cereri acum. Te rugăm să revii în câteva minute.',
    server: 'Ceva nu a funcționat. Te rugăm să încerci din nou.',
    endpoint:
      'Serviciul formularului nu a răspuns corect. Te rugăm să revii mai târziu.',
    timeout: 'Nu am primit confirmarea la timp. Te rugăm să încerci din nou peste câteva minute.',
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
            if (response.ok === false) throw requestError('server');
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

  function delay(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
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

  const tokens = (() => {
    let pending = null;

    function refresh(timeoutMs = TOKEN_TIMEOUT_MS) {
      if (!ENDPOINT) return null;

      pending = fetchJsonWithTimeout(
        `${ENDPOINT}?action=token`,
        {
          method: 'GET',
          mode: 'cors',
          redirect: 'follow',
          credentials: 'omit',
          cache: 'no-store'
        },
        timeoutMs
      )
        .then(data => {
          if (data?.ok && typeof data.token === 'string' && data.token) {
            // The server rejects tokens younger than 1200 ms, including autofill submits.
            return { token: data.token, readyAt: Date.now() + TOKEN_MIN_AGE_MS, error: null };
          }
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
      take(timeoutMs) {
        // Consume each token once. Fetch another only when another attempt needs it.
        const current = pending || refresh(timeoutMs);
        pending = null;
        return current || Promise.resolve({ token: '', error: null });
      }
    };
  })();

  function sendRequest(token, data, timeoutMs) {
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
          company: data.company,
          token
        })
      },
      timeoutMs
    ).catch(error => {
      // A lost POST response cannot tell us whether the server already wrote the row.
      error.code = error.code === 'timeout' ? 'timeout' : 'unconfirmed';
      error.requestSent = true;
      throw error;
    });
  }

  function submitRequest(data) {
    let tokenRetries = 0;
    const deadline = Date.now() + SUBMIT_TIMEOUT_MS;
    const remaining = () => {
      const ms = deadline - Date.now();
      if (ms <= 0) throw requestError('timeout');
      return ms;
    };

    async function attempt() {
      const tokenState = await tokens.take(Math.min(TOKEN_TIMEOUT_MS, remaining()));
      if (!tokenState.token) throw tokenState.error || requestError('network');
      const waitForToken = Math.max(0, tokenState.readyAt - Date.now());
      if (waitForToken) await delay(Math.min(waitForToken, remaining()));
      const result = await sendRequest(tokenState.token, data, remaining());
      // Only a rejected token is safe to retry automatically: no row was written.
      if (result.error === 'token' && tokenRetries < 1) {
        tokenRetries += 1;
        return attempt();
      }
      return result;
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
        if (submitting && status) {
          status.textContent = 'Confirmarea durează puțin mai mult. Te rugăm să aștepți…';
        }
      }, 10000);

      data.company = honeypot?.value || '';
      submitRequest(data)
        .then(result => {
          if (result?.ok) {
            showSuccess();
            return;
          }
          fail(result?.error || 'server');
        })
        .catch(error => fail(error?.code || 'network', submitButton,
          error?.requestSent && error.code === 'timeout'
            ? 'Nu am primit confirmarea la timp. Cererea poate fi deja înregistrată. Dacă reîncerci și adresa apare ca folosită, solicitarea există deja.'
            : undefined));
    });
  }

  document.querySelectorAll('form.access-form').forEach(initForm);
})();
