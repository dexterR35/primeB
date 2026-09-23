'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const formScript = fs.readFileSync(path.join(__dirname, '..', 'form.js'), 'utf8');

class Element {
  constructor(textContent = '') {
    this.textContent = textContent;
    this.value = '';
    this.hidden = false;
    this.disabled = false;
    this.attributes = new Map();
    this.listeners = new Map();
    this.classes = new Set();
    this.classList = {
      add: name => this.classes.add(name),
      remove: name => this.classes.delete(name),
      contains: name => this.classes.has(name),
      toggle: (name, enabled) => {
        const add = enabled === undefined ? !this.classes.has(name) : enabled;
        if (add) this.classes.add(name);
        else this.classes.delete(name);
        return add;
      }
    };
  }

  addEventListener(type, listener, options = {}) {
    const listeners = this.listeners.get(type) || [];
    listeners.push({ listener, once: options.once });
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    if (!event.target) event.target = this;
    event.currentTarget = this;
    for (const entry of [...(this.listeners.get(event.type) || [])]) {
      if (entry.once) {
        this.listeners.set(event.type, this.listeners.get(event.type).filter(item => item !== entry));
      }
      entry.listener.call(this, event);
    }
    return !event.defaultPrevented;
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  focus() { this.focused = true; }
}

function createForm(name) {
  const form = new Element();
  form.id = name;
  form.button = new Element('TRIMITE CEREREA');
  form.status = new Element();
  form.success = new Element('Cererea a fost trimisă.');
  form.stamp = new Element();
  form.errors = {};
  form.elements = {};
  for (const field of ['fullName', 'email', 'signature', 'company']) {
    form.elements[field] = new Element();
    form.errors[field] = new Element();
  }
  form.elements.fullName.value = 'Ana Popescu';
  form.elements.email.value = `${name}@example.com`;
  form.querySelector = selector => {
    if (selector === 'button[type="submit"]') return form.button;
    if (selector === '.form-status') return form.status;
    if (selector === '.success') return form.success;
    if (selector === '.request-stamp') return form.stamp;
    const match = selector.match(/^\[data-error-for="(.+)"\]$/);
    return match ? form.errors[match[1]] : null;
  };
  form.results = [];
  form.addEventListener('access:result', event => form.results.push(event));
  form.submit = () => form.dispatchEvent({
    type: 'submit',
    preventDefault() { this.defaultPrevented = true; }
  });
  return form;
}

async function flushMicrotasks() {
  for (let i = 0; i < 40; i += 1) await Promise.resolve();
}

function setup({ post, formCount = 1 } = {}) {
  const forms = Array.from({ length: formCount }, (_, index) => createForm(`request-${index}`));
  const timers = new Map();
  const requests = [];
  const window = new Element();
  let now = 0;
  let nextTimer = 0;
  window.setTimeout = (callback, delay = 0) => {
    const id = ++nextTimer;
    timers.set(id, { callback, at: now + delay });
    return id;
  };
  window.clearTimeout = id => timers.delete(id);
  const response = data => ({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(data)) });
  const fetch = async (url, options = {}) => {
    const request = { url, ...options, startedAt: now, payload: JSON.parse(options.body) };
    requests.push(request);
    return post ? post(request, requests.length, response) : response({ ok: true });
  };
  class CustomEvent {
    constructor(type, options = {}) { this.type = type; Object.assign(this, options); }
  }
  class ClockDate extends Date {
    static now() { return now; }
  }
  vm.runInNewContext(formScript, {
    window,
    document: { querySelectorAll: selector => selector === 'form.access-form' ? forms : [] },
    fetch,
    AbortController,
    CustomEvent,
    Date: ClockDate,
    console
  }, { filename: 'form.js' });

  async function advance(milliseconds = 2500) {
    const end = now + milliseconds;
    await flushMicrotasks();
    for (;;) {
      const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, timer] = next;
      timers.delete(id);
      now = timer.at;
      timer.callback();
      await flushMicrotasks();
    }
    now = end;
    await flushMicrotasks();
  }

  return { forms, requests, advance };
}

function assertResult(form, kind) {
  const event = form.results.at(-1);
  assert.ok(event, 'The form emits a result for its popup.');
  assert.equal(event.bubbles, true);
  assert.equal(event.detail.kind, kind);
  assert.equal(typeof event.detail.title, 'string');
  assert.ok(event.detail.title.length);
  assert.equal(typeof event.detail.message, 'string');
  assert.ok(event.detail.message.length);
  assert.ok(event.detail.focusTarget, 'The popup knows where to return focus.');
  assert.notEqual(form.getAttribute('aria-busy'), 'true');
  assert.notEqual(form.button.getAttribute('aria-busy'), 'true');
  return event.detail;
}

function assertRecoverableError(form) {
  const detail = assertResult(form, 'error');
  assert.equal(form.button.disabled, false);
  assert.equal(form.button.textContent, 'TRIMITE CEREREA');
  assert.equal(form.classList.contains('sent'), false);
  return detail;
}

test('both access forms finish successfully in a single request and cannot resubmit completed requests', async () => {
  const app = setup({ formCount: 2 });
  for (const form of app.forms) {
    form.submit();
    await app.advance();
    assertResult(form, 'success');
    assert.equal(form.classList.contains('sent'), true);
    assert.equal(form.button.textContent, 'CERERE TRIMISĂ');
    assert.equal(form.button.disabled, true);
    form.submit();
    await app.advance();
    assert.equal(form.results.length, 1);
  }
  assert.equal(app.requests.length, 2, 'Each submit is exactly one request — no token round trip.');
  assert.equal(app.requests[0].method, 'POST');
});

test('invalid fields produce a popup and focus target without sending a request', async () => {
  const app = setup();
  const [form] = app.forms;
  form.elements.email.value = 'invalid-address';
  form.submit();
  await app.advance();
  const detail = assertRecoverableError(form);
  assert.equal(detail.focusTarget, form.elements.email);
  assert.equal(form.elements.email.getAttribute('aria-invalid'), 'true');
  assert.equal(form.errors.email.hidden, false);
  assert.equal(app.requests.length, 0);
});

test('a server rejection restores the submit button and reports an error', async () => {
  const app = setup({ post: (_request, _count, response) => response({ ok: false, error: 'server' }) });
  app.forms[0].submit();
  await app.advance();
  assertRecoverableError(app.forms[0]);
  assert.equal(app.requests.length, 1);
});

test('a duplicate request stays an error and is never reported as a new success', async () => {
  const app = setup({ post: (_request, _count, response) => response({ ok: false, error: 'duplicate' }) });
  app.forms[0].submit();
  await app.advance();
  const detail = assertRecoverableError(app.forms[0]);
  assert.match(detail.message, /deja/i);
  assert.equal(app.requests.length, 1);
});

test('a busy backend restores the submit button and reports an error', async () => {
  const app = setup({ post: (_request, _count, response) => response({ ok: false, error: 'busy' }) });
  app.forms[0].submit();
  await app.advance();
  const detail = assertRecoverableError(app.forms[0]);
  assert.match(detail.message, /multe cereri/i);
  assert.equal(app.requests.length, 1);
});

test('a lost request is not automatically retried and a deliberate retry remains possible', async () => {
  const app = setup({
    post: (_request, count, response) => {
      if (count === 1) throw new TypeError('Failed to fetch');
      return response({ ok: true });
    }
  });
  const [form] = app.forms;
  form.submit();
  await app.advance(120000);
  assertRecoverableError(form);
  assert.equal(app.requests.length, 1, 'An ambiguous network failure must not repeat a write.');
  form.submit();
  await app.advance();
  assertResult(form, 'success');
  assert.equal(app.requests.length, 2);
});

test('the deadline includes reading the response body and releases loading state', async () => {
  const app = setup({ post: () => ({ ok: true, status: 200, text: () => new Promise(() => {}) }) });
  const [form] = app.forms;
  form.submit();
  await app.advance();
  assert.equal(form.button.disabled, true);
  assert.equal(form.results.length, 0);
  await app.advance(60000);
  const timeout = assertRecoverableError(form);
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].signal.aborted, true);
  assert.match(timeout.message, /poate fi deja înregistrată/);

  const network = setup({ post: () => Promise.reject(new TypeError('Failed to fetch')) });
  network.forms[0].submit();
  await network.advance(120000);
  assert.notEqual(timeout.message, assertRecoverableError(network.forms[0]).message,
    'A confirmed-in-flight timeout must be explained separately from a network error.');
});

test('a slow connection shows a waiting notice without changing the request count', async () => {
  const app = setup({ post: () => ({ ok: true, status: 200, text: () => new Promise(() => {}) }) });
  const [form] = app.forms;
  form.submit();
  await app.advance(10000);
  assert.match(form.status.textContent, /Încă așteptăm confirmarea/);
  assert.equal(app.requests.length, 1);
});

test('a backend "config" rejection shows unavailable and restores the submit button', async () => {
  const app = setup({ post: (_request, _count, response) => response({ ok: false, error: 'config' }) });
  app.forms[0].submit();
  await app.advance();
  const detail = assertRecoverableError(app.forms[0]);
  assert.match(detail.message, /nu este disponibil/);
  assert.equal(app.requests.length, 1);
});

test('additional submits while a request is pending do not send duplicate requests', async () => {
  let finishBody;
  const app = setup({
    post: () => ({ ok: true, status: 200, text: () => new Promise(resolve => { finishBody = resolve; }) })
  });
  const [form] = app.forms;
  form.submit();
  await app.advance();
  assert.equal(form.button.disabled, true);
  assert.equal(form.getAttribute('aria-busy'), 'true');
  form.submit();
  await app.advance();
  assert.equal(app.requests.length, 1);
  assert.equal(form.results.length, 0);
  finishBody(JSON.stringify({ ok: true }));
  await app.advance();
  assertResult(form, 'success');
  assert.equal(form.results.length, 1);
});

test('an invalid response body produces a recoverable error', async () => {
  const app = setup({ post: () => ({ ok: true, status: 200, text: () => Promise.resolve('<html>Unavailable</html>') }) });
  app.forms[0].submit();
  await app.advance(120000);
  assertRecoverableError(app.forms[0]);
  assert.equal(app.requests.length, 1);
});

test('the honeypot field short-circuits to success without sending a request', async () => {
  const app = setup();
  const [form] = app.forms;
  form.elements.company.value = 'bot filled this in';
  form.submit();
  await app.advance();
  assertResult(form, 'success');
  assert.equal(app.requests.length, 0);
});
