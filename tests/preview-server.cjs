'use strict';

// Local browser fixture only. It never forwards submissions or stores form data.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const HOST = '127.0.0.1';
const PORT = 8767;
const ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = '/__fixture/form';
const FIXTURE_URL = `http://${HOST}:${PORT}${FIXTURE_PATH}`;
const PRODUCTION_DECLARATION = "const ENDPOINT = 'https://script.google.com/macros/s/AKfycbxiskFiTGyhbpWKNCFBYbpiC2coVF0Xfq9PBmxeK1LKYu-_cDpil415aj-m2-LFRQBp/exec';";
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

function isInsideRoot(filePath) {
  const relative = path.relative(ROOT, filePath);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function reply(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function formFixture(req, res) {
  if (req.method === 'GET') {
    reply(res, 200, { ok: true, token: `fixture-${randomUUID()}` });
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    reply(res, 405, { ok: false, error: 'method' });
    return;
  }

  let body = '';
  let oversized = false;
  for await (const chunk of req) {
    if (Buffer.byteLength(body) + chunk.length > 16384) oversized = true;
    if (!oversized) body += chunk.toString('utf8');
  }
  if (oversized) {
    reply(res, 413, { ok: false, error: 'body_too_large' });
    return;
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    reply(res, 400, { ok: false, error: 'invalid_json' });
    return;
  }
  const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
  const result = email === 'success@example.test'
    ? { ok: true }
    : { ok: false, error: email === 'duplicate@example.test' ? 'duplicate' : 'server' };
  reply(res, 200, result);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Even an unexpected client script cannot contact an external form service.
  res.setHeader('Content-Security-Policy', "connect-src 'self'; form-action 'self'; base-uri 'none'");

  try {
    let pathname;
    try {
      pathname = decodeURIComponent((req.url || '/').split(/[?#]/, 1)[0]).replaceAll('\\', '/');
    } catch {
      reply(res, 400, 'Invalid URL', 'text/plain; charset=utf-8');
      return;
    }
    if (!pathname.startsWith('/') || pathname.includes('\0') || pathname.split('/').includes('..')) {
      reply(res, 403, 'Forbidden path', 'text/plain; charset=utf-8');
      return;
    }
    if (pathname === FIXTURE_PATH) {
      await formFixture(req, res);
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      reply(res, 405, 'Method not allowed', 'text/plain; charset=utf-8');
      return;
    }

    let filePath = path.resolve(ROOT, `.${pathname}`);
    if (!isInsideRoot(filePath)) {
      reply(res, 403, 'Forbidden path', 'text/plain; charset=utf-8');
      return;
    }
    if ((await fs.stat(filePath)).isDirectory()) filePath = path.join(filePath, 'index.html');
    filePath = await fs.realpath(filePath);
    if (!isInsideRoot(filePath)) {
      reply(res, 403, 'Forbidden path', 'text/plain; charset=utf-8');
      return;
    }

    let content = await fs.readFile(filePath);
    if (path.relative(ROOT, filePath) === 'form.js') {
      const source = content.toString('utf8');
      if (source.split(PRODUCTION_DECLARATION).length !== 2) {
        reply(res, 503, '// Fixture refused form.js: expected ENDPOINT declaration changed.', 'text/javascript; charset=utf-8');
        return;
      }
      content = Buffer.from(source.replace(PRODUCTION_DECLARATION, `const ENDPOINT = '${FIXTURE_URL}';`));
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': content.length
    });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (res.headersSent) {
      res.end();
      return;
    }
    const status = ['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : 500;
    reply(res, status, status === 404 ? 'Not found' : 'Local fixture error', 'text/plain; charset=utf-8');
  }
});

server.on('error', (error) => {
  console.error(`Local fixture could not start: ${error.message}`);
  process.exitCode = 1;
});
server.listen(PORT, HOST, () => {
  console.log('LOCAL FORM FIXTURE — NO EXTERNAL REQUESTS');
  console.log(`Preview: http://${HOST}:${PORT}`);
  console.log('Emails: success@example.test, error@example.test, duplicate@example.test');
});
