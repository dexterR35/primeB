const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const properties = new Map();
const cache = new Map();
const rows = [];
const expectedSpreadsheetId = '11JX3Xl-RZUaT-3BuVnLrnpIiTLdIvHOQKOnHpZsF760';

function makeRange(row, column, rowCount, columnCount) {
  return {
    getValues() {
      return Array.from({ length: rowCount }, (_, rowOffset) =>
        Array.from({ length: columnCount }, (_, columnOffset) =>
          rows[row - 1 + rowOffset]?.[column - 1 + columnOffset] ?? ''
        )
      );
    },
    setValues(values) {
      values[0].forEach(value => {
        if (typeof value === 'string' && /^[=+\-@]/.test(value)) {
          throw new Error('Formula reached the sheet: ' + value);
        }
      });
      rows[row - 1] = values[0].map(value =>
        typeof value === 'string' && value.startsWith("'")
          ? value.slice(1)
          : value
      );
      return this;
    },
    setFontWeight() {
      return this;
    }
  };
}

const sheet = {
  getName: () => 'prime_2026_B',
  getLastRow: () => rows.length,
  getRange: makeRange,
  setFrozenRows() {},
  setColumnWidth() {}
};

const spreadsheet = {
  getId: () => expectedSpreadsheetId,
  tabs: {},
  inserted: [],
  getSheetByName(name) {
    return this.tabs[name] || null;
  },
  insertSheet(name, index) {
    this.inserted.push({ name, index });
    this.tabs[name] = sheet;
    return sheet;
  }
};

const openedSpreadsheetIds = [];

const sandbox = {
  console,
  Date,
  JSON,
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: key => properties.get(key) || null,
      setProperty: (key, value) => properties.set(key, value)
    })
  },
  CacheService: {
    getScriptCache: () => ({
      get: key => cache.get(key) || null,
      put: (key, value) => cache.set(key, value)
    })
  },
  LockService: {
    getScriptLock: () => ({
      tryLock: () => true,
      releaseLock() {}
    })
  },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    base64Encode: value => Buffer.from(String(value)).toString('base64'),
    base64EncodeWebSafe: value =>
      Buffer.from(value)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_'),
    computeHmacSha256Signature: (message, key) =>
      Array.from(
        crypto.createHmac('sha256', String(key)).update(String(message)).digest()
      ),
    formatDate: () => '21.09.2026 12:34'
  },
  ContentService: {
    MimeType: { JSON: 'json' },
    createTextOutput: text => ({
      text,
      setMimeType() {
        return this;
      },
      getContent() {
        return this.text;
      }
    })
  },
  SpreadsheetApp: {
    getActive() {
      throw new Error('Web app execution has no active spreadsheet.');
    },
    openById(id) {
      openedSpreadsheetIds.push(id);
      assert.strictEqual(id, spreadsheet.getId(), 'unexpected spreadsheet destination');
      return spreadsheet;
    },
    flush() {}
  }
};

vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'),
  sandbox,
  { filename: 'Code.gs' }
);

function post(overrides = {}) {
  const body = {
    fullName: 'Ana Maria Popescu',
    email: `ana-${Math.random().toString(36).slice(2)}@example.com`,
    signature: 'Ana Maria Popescu',
    company: '',
    ...overrides
  };
  const output = sandbox.doPost({
    postData: { contents: JSON.stringify(body) }
  });
  return JSON.parse(output.getContent());
}

sandbox.RATE_MAX = 100000;
// Stale properties must never redirect requests away from the verified destination.
properties.set('SPREADSHEET_ID', 'different-spreadsheet');
sandbox.setup();

assert.strictEqual(sandbox.SPREADSHEET_ID, expectedSpreadsheetId);
assert(spreadsheet.tabs.prime_2026_B, 'target tab was not created');
assert.strictEqual(
  JSON.stringify(rows[0]),
  JSON.stringify(['Data', 'Nume complet', 'Email', 'Signature'])
);

// Web app requests must work without an active container and use the explicit ID.
const opensBeforeRequest = openedSpreadsheetIds.length;
const ok = post({ email: 'ana@example.com' });
assert.strictEqual(ok.ok, true);
assert.strictEqual(openedSpreadsheetIds.length, opensBeforeRequest + 1);
assert.strictEqual(
  JSON.stringify(rows[1]),
  JSON.stringify([
    '21.09.2026 12:34',
    'Ana Maria Popescu',
    'ana@example.com',
    'Ana Maria Popescu'
  ])
);

assert.strictEqual(post({ email: 'ana@example.com' }).error, 'duplicate');
assert.strictEqual(post({ fullName: '=IMPORTXML("x")' }).error, 'invalid_name');
assert.strictEqual(post({ email: 'not-an-email' }).error, 'invalid_email');
assert.strictEqual(post({ signature: '' }).error, 'invalid_signature');
assert.strictEqual(
  post({ signature: 'Alt Nume' }).error,
  'invalid_signature'
);

const beforeHoneypot = rows.length;
assert.strictEqual(post({ company: 'bot' }).ok, true);
assert.strictEqual(rows.length, beforeHoneypot);

// Setup uses the same explicit destination without relying on an active container.
assert.doesNotThrow(() => sandbox.setup());
assert.strictEqual(sandbox.SPREADSHEET_ID, expectedSpreadsheetId);

// Missing configuration is explicit, and must never fall back to an active sheet.
const beforeMissingConfig = rows.length;
const opensBeforeMissingConfig = openedSpreadsheetIds.length;
sandbox.SPREADSHEET_ID = '';
assert.strictEqual(post().error, 'config');
assert.strictEqual(rows.length, beforeMissingConfig);
assert.strictEqual(openedSpreadsheetIds.length, opensBeforeMissingConfig);
assert.throws(() => sandbox.setup(), /config/);
sandbox.SPREADSHEET_ID = expectedSpreadsheetId;

assert.doesNotThrow(() =>
  sandbox.writeRow({
    receivedAt: '+1',
    fullName: '=EVIL()',
    email: 'literal@example.com',
    signature: '@SUM(A1:A2)'
  })
);

console.log('All Apps Script checks passed.');
