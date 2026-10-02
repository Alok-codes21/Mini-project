import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import http from 'node:http';
import { createApp } from '../src/app.js';

const ORIGIN = 'http://localhost:5173';
const quiet = { logRequests: false };
const servers = [];
async function start(options = {}) {
  const server = createApp({ ...quiet, nodeEnv: 'test', corsOrigins: [ORIGIN], rateLimit: { windowMs: 60000, max: 1000 }, ...options }).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}
let base;
before(async () => { base = await start(); });
after(async () => { await Promise.all(servers.map(s => new Promise(resolve => s.close(resolve)))); });

const json = { 'Content-Type': 'application/json' };
async function post(route, body, url = base) {
  const response = await fetch(url + route, { method: 'POST', headers: json, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json(), headers: response.headers };
}
function assertErrorShape(data, code) {
  assert.equal(data.success, false);
  assert.equal(typeof data.error.message, 'string');
  assert.equal(data.error.code, code);
  assert.ok(data.error.requestId);
  assert.ok(!JSON.stringify(data).includes('node_modules') && !/\\n\s+at /.test(JSON.stringify(data)), 'no stack trace');
}

test('health and route discovery', async () => {
  assert.equal((await (await fetch(base + '/health')).json()).status, 'ok');
  const api = await (await fetch(base + '/api')).json();
  assert.equal(api.routes.length, 6);
  assert.equal(api.limits.rateLimit.requests, 1000);
});

test('OpenAPI document covers every discovered route', async () => {
  const api = await (await fetch(base + '/api')).json();
  const doc = await (await fetch(base + api.openapi)).json();
  for (const route of api.routes) {
    const path = route.replace('POST ', '');
    assert.ok(doc.paths[path]?.post, `${path} documented`);
  }
});

test('all operation endpoints return the full response contract', async () => {
  for (const op of ['add', 'subtract', 'multiply', 'transpose', 'determinant']) {
    const { status, data } = await post(`/api/matrix/${op}`, { A: [[1, 2], [3, 4]], B: [[5, 6], [7, 8]] });
    assert.equal(status, 200);
    for (const key of ['success', 'schemaVersion', 'module', 'operation', 'level', 'input', 'result', 'steps', 'summary']) assert.ok(key in data, `${op} has ${key}`);
    assert.equal(data.operation, op);
    assert.equal(data.summary.totalSteps, data.steps.length);
    assert.ok(data.steps.every(x => x.formula && x.explanation && x.keyPoints.length));
  }
  const { status, data } = await post('/api/number-system/convert', { number: '13', fromBase: 10, toBase: 2 });
  assert.equal(status, 200); assert.equal(data.result, '1101'); assert.equal(data.module, 'number-system');
});

test('documented multiply example returns result and trace', async () => {
  const { data } = await post('/api/matrix/multiply', { A: [[1, 2], [3, 4]], B: [[5, 6], [7, 8]] });
  assert.deepEqual(data.result, [[19, 22], [43, 50]]);
  assert.ok(data.steps.length > 20);
});

test('validation errors are 400 with a consistent structure and field', async () => {
  const cases = [
    ['/api/matrix/add', { A: [[1]] }, 'B'],
    ['/api/matrix/add', { B: [[1]] }, 'A'],
    ['/api/matrix/add', { A: null, B: [[1]] }, 'A'],
    ['/api/matrix/add', { A: { 0: [1] }, B: [[1]] }, 'A'],
    ['/api/matrix/add', { A: [1, 2], B: [[1]] }, 'A'],
    ['/api/matrix/add', { A: [[1, 2]], B: [[1]] }, 'B'],
    ['/api/matrix/multiply', { A: [[1, 2]], B: [[1, 2]] }, 'B'],
    ['/api/matrix/determinant', { A: [[1, 2, 3], [4, 5, 6]] }, 'A'],
    ['/api/matrix/determinant', { A: Array.from({ length: 5 }, () => Array(5).fill(1)) }, 'A'],
    ['/api/number-system/convert', { fromBase: 10, toBase: 2 }, 'number'],
    ['/api/number-system/convert', { number: 13, fromBase: 10, toBase: 2 }, 'number'],
    ['/api/number-system/convert', { number: '13', fromBase: 3, toBase: 2 }, 'fromBase'],
    ['/api/number-system/convert', { number: '13', fromBase: 10, toBase: '2' }, 'toBase'],
    ['/api/number-system/convert', { number: '0x1F', fromBase: 16, toBase: 2 }, 'number'],
    ['/api/number-system/convert', { number: '1.5', fromBase: 10, toBase: 2 }, 'number']
  ];
  for (const [route, body, field] of cases) {
    const { status, data } = await post(route, body);
    assert.equal(status, 400, `${route} ${JSON.stringify(body)}`);
    assertErrorShape(data, 'INVALID_INPUT');
    assert.equal(data.error.field, field);
  }
});

test('non-object JSON bodies and empty bodies are rejected', async () => {
  for (const body of [[], 'text', 5, null]) {
    const r = await fetch(base + '/api/number-system/convert', { method: 'POST', headers: json, body: JSON.stringify(body) });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).success, false);
  }
  const noBody = await fetch(base + '/api/matrix/transpose', { method: 'POST' });
  assert.equal(noBody.status, 400);
  assertErrorShape(await noBody.json(), 'INVALID_INPUT');
});

test('malformed JSON is 400 INVALID_JSON', async () => {
  const bad = await fetch(base + '/api/matrix/add', { method: 'POST', headers: json, body: '{' });
  assert.equal(bad.status, 400);
  assertErrorShape(await bad.json(), 'INVALID_JSON');
});

test('wrong content type is 415', async () => {
  const r = await fetch(base + '/api/matrix/add', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{"A":[[1]],"B":[[1]]}' });
  assert.equal(r.status, 415);
  assertErrorShape(await r.json(), 'UNSUPPORTED_MEDIA_TYPE');
});

test('unsupported content encoding and charset are 415', async () => {
  const gz = await fetch(base + '/api/matrix/add', { method: 'POST', headers: { ...json, 'Content-Encoding': 'foo' }, body: JSON.stringify({ A: [[1]], B: [[1]] }) });
  assert.equal(gz.status, 415);
  assertErrorShape(await gz.json(), 'UNSUPPORTED_ENCODING');
  const cs = await fetch(base + '/api/matrix/add', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=iso-8859-1' }, body: '{}' });
  assert.equal(cs.status, 415);
  assertErrorShape(await cs.json(), 'UNSUPPORTED_ENCODING');
});

test('corrupt compressed bodies are 400, not 500', async () => {
  const r = await fetch(base + '/api/matrix/add', { method: 'POST', headers: { ...json, 'Content-Encoding': 'br' }, body: '{}' });
  assert.equal(r.status, 400);
  assertErrorShape(await r.json(), 'BAD_REQUEST');
});

test('gzip request bodies are still accepted', async () => {
  const body = gzipSync(JSON.stringify({ A: [[1]], B: [[2]] }));
  const r = await fetch(base + '/api/matrix/add', { method: 'POST', headers: { ...json, 'Content-Encoding': 'gzip' }, body });
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).result, [[3]]);
});

test('oversized body is 413, body just under the limit is not', async () => {
  const x = await post('/api/matrix/add', { padding: 'x'.repeat(70000) });
  assert.equal(x.status, 413); assertErrorShape(x.data, 'BODY_TOO_LARGE');
  const ok = await post('/api/matrix/add', { padding: 'x'.repeat(60000) });
  assert.equal(ok.status, 400); assert.equal(ok.data.error.field, 'A');
});

test('unknown routes are 404 and wrong methods are 405 with Allow', async () => {
  const missing = await fetch(base + '/missing');
  assert.equal(missing.status, 404); assertErrorShape(await missing.json(), 'NOT_FOUND');
  const get = await fetch(base + '/api/matrix/add');
  assert.equal(get.status, 405);
  assert.match(get.headers.get('Allow'), /POST/);
  assertErrorShape(await get.json(), 'METHOD_NOT_ALLOWED');
  const del = await fetch(base + '/api/number-system/convert', { method: 'DELETE' });
  assert.equal(del.status, 405);
});

test('results too large to show exactly return 422, not a wrong number', async () => {
  const big = [[1e6, 0, 0, 0], [0, 1e6, 0, 0], [0, 0, 1e6, 0], [0, 0, 0, 1e6]]; // true determinant 1e24
  const r = await post('/api/matrix/determinant', { A: big });
  assert.equal(r.status, 422);
  assertErrorShape(r.data, 'RESULT_TOO_LARGE');
});

test('security headers are present and nothing leaks the server stack', async () => {
  const r = await fetch(base + '/health');
  assert.equal(r.headers.get('x-powered-by'), null);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(r.headers.get('content-security-policy'));
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.match(r.headers.get('content-type'), /application\/json/);
});

test('request ids: generated, echoed when safe, replaced when unsafe', async () => {
  const a = await fetch(base + '/health');
  assert.ok(a.headers.get('x-request-id'));
  const b = await fetch(base + '/health', { headers: { 'X-Request-Id': 'client-123' } });
  assert.equal(b.headers.get('x-request-id'), 'client-123');
  const c = await fetch(base + '/health', { headers: { 'X-Request-Id': 'bad id with spaces' } });
  assert.notEqual(c.headers.get('x-request-id'), 'bad id with spaces');
});

test('CORS allows only configured origins and handles preflight', async () => {
  const allowed = await fetch(base + '/health', { headers: { Origin: ORIGIN } });
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.match(allowed.headers.get('Vary'), /Origin/);
  const denied = await fetch(base + '/health', { headers: { Origin: 'https://other.example' } });
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
  const local = await fetch(base + '/health', { headers: { Origin: 'http://localhost:9999' } });
  assert.equal(local.headers.get('Access-Control-Allow-Origin'), null, 'configured list replaces localhost default');
  const pre = await fetch(base + '/api/matrix/add', { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.match(pre.headers.get('Access-Control-Allow-Methods'), /POST/);
  assert.match(pre.headers.get('Access-Control-Allow-Headers'), /Content-Type/i);
  const badPre = await fetch(base + '/api/matrix/add', { method: 'OPTIONS', headers: { Origin: 'https://other.example', 'Access-Control-Request-Method': 'POST' } });
  assert.equal(badPre.headers.get('Access-Control-Allow-Origin'), null);
});

test('CORS defaults: development allows localhost only, production allows nothing', async () => {
  const dev = await start({ nodeEnv: 'development', corsOrigins: [] });
  const ok = await fetch(dev + '/health', { headers: { Origin: 'http://localhost:3001' } });
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), 'http://localhost:3001');
  const no = await fetch(dev + '/health', { headers: { Origin: 'https://evil.example' } });
  assert.equal(no.headers.get('Access-Control-Allow-Origin'), null);
  const prod = await start({ nodeEnv: 'production', corsOrigins: [] });
  const none = await fetch(prod + '/health', { headers: { Origin: 'http://localhost:3001' } });
  assert.equal(none.headers.get('Access-Control-Allow-Origin'), null);
});

test('rate limiting returns structured 429 and does not apply to /health', async () => {
  const url = await start({ rateLimit: { windowMs: 60000, max: 3 } });
  for (let i = 0; i < 3; i++) assert.equal((await post('/api/number-system/convert', { number: '1', fromBase: 10, toBase: 2 }, url)).status, 200);
  const limited = await post('/api/number-system/convert', { number: '1', fromBase: 10, toBase: 2 }, url);
  assert.equal(limited.status, 429);
  assertErrorShape(limited.data, 'RATE_LIMITED');
  assert.ok(Number(limited.headers.get('Retry-After')) >= 1);
  assert.ok(limited.headers.get('RateLimit') || limited.headers.get('ratelimit-remaining'));
  assert.equal((await fetch(url + '/health')).status, 200);
});

test('rate limit counts requests per client, not globally for CORS preflights', async () => {
  const url = await start({ rateLimit: { windowMs: 60000, max: 2 } });
  for (let i = 0; i < 5; i++) {
    const pre = await fetch(url + '/api/matrix/add', { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' } });
    assert.equal(pre.status, 204);
  }
  assert.equal((await post('/api/matrix/transpose', { A: [[1]] }, url)).status, 200);
});

test('server error responses hide internals', async () => {
  // A request whose socket closes mid-body must not crash the server.
  await new Promise(resolve => {
    const req = http.request(base + '/api/matrix/add', { method: 'POST', headers: { ...json, 'Content-Length': 100 } });
    req.on('error', resolve); req.write('{"A":'); setTimeout(() => { req.destroy(); resolve(); }, 50);
  });
  assert.equal((await fetch(base + '/health')).status, 200);
});
