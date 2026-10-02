import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
let server, base;
before(async () => {
  server = createApp({ corsOrigin: 'http://localhost:5173' }).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); });
async function post(route, body) {
  const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}
test('health and route discovery', async () => {
  assert.equal((await (await fetch(base + '/health')).json()).status, 'ok');
  assert.equal((await (await fetch(base + '/api')).json()).routes.length, 6);
});
test('all six operation endpoints return step explanations', async () => {
  for (const op of ['add', 'subtract', 'multiply', 'transpose', 'determinant']) {
    const { status, data } = await post(`/api/matrix/${op}`, { A: [[1, 2], [3, 4]], B: [[5, 6], [7, 8]] });
    assert.equal(status, 200); assert.ok(data.steps.every(x => x.formula && x.explanation && x.keyPoints.length));
  }
  const { status, data } = await post('/api/number-system/convert', { number: '13', fromBase: 10, toBase: 2 });
  assert.equal(status, 200); assert.equal(data.result, '1101');
});
test('400 on bad input or malformed JSON and 404 on missing route', async () => {
  const x = await post('/api/matrix/add', { A: [[1]] });
  assert.equal(x.status, 400); assert.equal(x.data.error.field, 'B');
  const bad = await fetch(base + '/api/matrix/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(bad.status, 400); assert.equal((await bad.json()).error.code, 'INVALID_JSON');
  assert.equal((await fetch(base + '/missing')).status, 404);
  const array = await post('/api/number-system/convert', []); assert.equal(array.status, 400);
  const noBody = await fetch(base + '/api/matrix/transpose', { method: 'POST' }); assert.equal(noBody.status, 400);
});
test('413 on oversized body', async () => {
  const x = await post('/api/matrix/add', { padding: 'x'.repeat(70000) });
  assert.equal(x.status, 413); assert.equal(x.data.error.code, 'BODY_TOO_LARGE');
});
test('CORS only permits the configured origin', async () => {
  const allowed = await fetch(base + '/health', { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173');
  const denied = await fetch(base + '/health', { headers: { Origin: 'https://other.example' } });
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
  const preflight = await fetch(base + '/api/matrix/add', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' } });
  assert.equal(preflight.status, 204);
});
