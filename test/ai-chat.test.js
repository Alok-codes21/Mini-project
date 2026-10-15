import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { resetAiState, freeModels } from '../src/ai-chat.js';

async function post(app, body) {
  const server = app.listen(0);
  try {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, json: await r.json() };
  } finally { server.close(); }
}
const make = env => createApp({ nodeEnv: 'test', logRequests: false, env, aiModels: ['m1', 'm2'] });

test('ai chat: empty message is rejected', async () => {
  assert.equal((await post(make({ OPENROUTER_API_KEY: 'k' }), { message: ' ' })).status, 400);
});
test('ai chat: no key gives a friendly 503 and no key leak', async () => {
  const r = await post(make({}), { message: 'hi' });
  assert.equal(r.status, 503);
  assert.match(r.json.error.message, /busy/);
});
test('ai chat: falls back to the next free model', async () => {
  const real = globalThis.fetch, seen = [];
  globalThis.fetch = async (url, opt) => {
    if (!String(url).includes('openrouter.ai')) return real(url, opt);
    const b = JSON.parse(opt.body); seen.push(b.model);
    assert.equal(opt.headers.Authorization, 'Bearer secret-key');
    if (b.model === 'm1') return new Response('{}', { status: 429 });
    return new Response(JSON.stringify({ choices: [{ message: { content: '2 + 2 = 4' } }] }), { status: 200 });
  };
  try {
    const r = await post(make({ OPENROUTER_API_KEY: 'secret-key' }), { message: '2+2?', history: [{ role: 'system', content: 'x' }] });
    assert.equal(r.status, 200);
    assert.equal(r.json.reply, '2 + 2 = 4');
    assert.deepEqual(seen, ['m1', 'm2']);
    assert.ok(!JSON.stringify(r.json).includes('secret-key'));
  } finally { globalThis.fetch = real; }
});
test('ai chat: all models failing gives the busy message', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opt) => String(url).includes('openrouter.ai') ? new Response('{}', { status: 402 }) : real(url, opt);
  try {
    const r = await post(make({ OPENROUTER_API_KEY: 'k' }), { message: 'x' });
    assert.equal(r.status, 503);
    assert.equal(r.json.error.code, 'AI_BUSY');
  } finally { globalThis.fetch = real; }
});

test('ai chat: cools down a rate-limited model and cycles through the live free list', async () => {
  resetAiState();
  const real = globalThis.fetch, calls = [];
  globalThis.fetch = async (url, opt) => {
    const u = String(url);
    if (u.includes('/api/v1/models')) return new Response(JSON.stringify({ data: [{ id: 'a/x:free' }, { id: 'b/paid' }, { id: 'c/guard-safety:free' }, { id: 'd/y:free' }] }));
    if (!u.includes('openrouter.ai')) return real(url, opt);
    const m = JSON.parse(opt.body).model; calls.push(m);
    if (m === 'openrouter/free' || m === 'a/x:free') return new Response('{}', { status: 429 });
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));
  };
  try {
    const app = createApp({ nodeEnv: 'test', logRequests: false, env: { OPENROUTER_API_KEY: 'k' } });
    assert.deepEqual(await freeModels(), ['openrouter/free', 'a/x:free', 'd/y:free']);
    assert.equal((await post(app, { message: 'q1' })).json.reply, 'ok');
    assert.deepEqual(calls, ['openrouter/free', 'a/x:free', 'd/y:free']);
    calls.length = 0;
    assert.equal((await post(app, { message: 'q2' })).json.reply, 'ok');
    assert.deepEqual(calls, ['d/y:free']); // the two limited models are skipped during cooldown
  } finally { globalThis.fetch = real; resetAiState(); }
});
