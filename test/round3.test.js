import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from '../src/app.js';
import { checkPractice } from '../src/algorithms/practice.js';

let server, base;
before(async () => {
  server = createApp({ logRequests: false, nodeEnv: 'test', corsOrigins: [], rateLimit: { windowMs: 60000, max: 10000 } }).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
const post = async (route, body) => {
  const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
};
const A = [[1, 2], [3, 4]], B = [[5, 6], [7, 8]];
const KEYS = ['action', 'confidence', 'highlights', 'hint', 'id', 'reason', 'stage', 'title'];

// Round 3, fix 1: the practice check must not reveal the correct result.
const wrongCases = [
  ['13 to binary, digits reversed', { operation: 'convert', input: { number: '13', fromBase: 10, toBase: 2 }, answer: '1011' }, '1101'],
  ['13 to binary, wrong digit', { operation: 'convert', input: { number: '13', fromBase: 10, toBase: 2 }, answer: '1001' }, '1101'],
  ['255 to hex', { operation: 'convert', input: { number: '255', fromBase: 10, toBase: 16 }, answer: 'FE' }, 'FF'],
  ['binary to decimal', { operation: 'convert', input: { number: '1101', fromBase: 2, toBase: 10 }, answer: '12' }, '13'],
  ['2x2 multiply', { operation: 'multiply', input: { A, B }, answer: [[19, 22], [43, 49]] }, '50'],
  ['2x2 add', { operation: 'add', input: { A, B }, answer: [[6, 8], [10, 11]] }, '12'],
  ['2x2 subtract', { operation: 'subtract', input: { A, B }, answer: [[-4, -4], [-4, 4]] }, '-4, -4]]'],
  ['transpose', { operation: 'transpose', input: { A: [[1, 2], [3, 9]] }, answer: [[1, 3], [2, 4]] }, '9'],
  ['2x2 determinant', { operation: 'determinant', input: { A }, answer: 5 }, '-2'],
  ['3x3 determinant', { operation: 'determinant', input: { A: [[2, 1, 3], [0, 4, 5], [1, 0, 6]] }, answer: 999 }, '41']
];
for (const [name, body, secret] of wrongCases) {
  test(`practice leak: ${name} does not reveal ${secret}`, async () => {
    const { status, data } = await post('/api/practice/check', body);
    assert.equal(status, 200);
    assert.equal(data.correct, false);
    assert.ok(!('explanation' in data.firstWrongStep));
    assert.ok(!JSON.stringify(data).includes(secret), JSON.stringify(data));
    assert.deepEqual(Object.keys(data.firstWrongStep).sort(), KEYS);
    assert.equal(checkPractice(body).firstWrongStep.explanation, undefined);
  });
}
test('practice: reveal still returns expected when asked, and the step id points into the full trace', async () => {
  const body = { operation: 'convert', input: { number: '13', fromBase: 10, toBase: 2 }, answer: '1011' };
  const revealed = await post('/api/practice/check', { ...body, reveal: true });
  assert.equal(revealed.data.expected, '1101');
  assert.equal(revealed.data.firstWrongStep.explanation, undefined);
  const full = await post('/api/number-system/convert', body.input);
  const step = full.data.steps.find(s => s.id === revealed.data.firstWrongStep.id);
  assert.equal(step.action, revealed.data.firstWrongStep.action);
  assert.ok(step.explanation.includes('1101'));
});

// Round 3, fix 2: every calculation response echoes the detail mode.
const routes = [
  ['/api/matrix/add', { A, B }], ['/api/matrix/subtract', { A, B }], ['/api/matrix/multiply', { A, B }],
  ['/api/matrix/transpose', { A }], ['/api/matrix/determinant', { A }],
  ['/api/number-system/convert', { number: '13', fromBase: 10, toBase: 2 }]
];
for (const [route, body] of routes) {
  test(`detail echo: ${route}`, async () => {
    const plain = await post(route, body);
    assert.equal(plain.data.detail, 'full');
    assert.equal(plain.data.summary.detail, undefined);
    for (const mode of ['full', 'compact', 'beginner']) {
      const { status, data } = await post(`${route}?detail=${mode}`, body);
      assert.equal(status, 200);
      assert.equal(data.detail, mode);
      assert.equal(data.summary.detail, mode === 'full' ? undefined : mode);
      assert.equal(JSON.stringify(data.result), JSON.stringify(plain.data.result));
    }
  });
}
test('detail echo: invalid mode is still 400 and the examples and OpenAPI document the field', () => {
  for (const f of ['multiply', 'decimal-to-binary']) {
    assert.equal(JSON.parse(readFileSync(new URL(`../examples/${f}-response.json`, import.meta.url))).detail, 'full');
  }
  const doc = JSON.parse(readFileSync(new URL('../docs/openapi.json', import.meta.url)));
  assert.deepEqual(doc.components.schemas.Response.properties.detail.enum, ['full', 'compact', 'beginner']);
  assert.ok(doc.components.schemas.Response.required.includes('detail'));
  const props = JSON.stringify(doc.paths['/api/practice/check']);
  assert.ok(!props.includes('"explanation"'));
});
test('detail echo: unknown mode returns 400', async () => {
  const r = await post('/api/matrix/add?detail=tiny', { A, B });
  assert.equal(r.status, 400);
  assert.equal(r.data.error.field, 'detail');
});
