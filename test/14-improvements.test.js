import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createApp } from '../src/app.js';
import { calculateMatrix, checked } from '../src/algorithms/matrix.js';
import { convertNumber } from '../src/algorithms/number-system.js';
import { checkPractice } from '../src/algorithms/practice.js';
import { displayFormula, InputError } from '../src/common.js';
import { loadConfig } from '../src/config.js';

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
const ident = n => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 2 : 1)));
const A = [[1, 2], [3, 4]], B = [[5, 6], [7, 8]];

// 1. proxy warning and render.yaml
test('item 1: production without TRUST_PROXY warns; set or non-production does not', () => {
  assert.match(loadConfig({ NODE_ENV: 'production' }).warnings[0], /TRUST_PROXY/);
  assert.match(loadConfig({ NODE_ENV: 'production', TRUST_PROXY: '' }).warnings[0], /TRUST_PROXY/);
  assert.deepEqual(loadConfig({ NODE_ENV: 'production', TRUST_PROXY: '1' }).warnings, []);
  assert.deepEqual(loadConfig({ NODE_ENV: 'production', TRUST_PROXY: '0' }).warnings, []);
  assert.deepEqual(loadConfig({ NODE_ENV: 'development' }).warnings, []);
});
test('item 1: render.yaml sets the required values and health check', () => {
  const yaml = readFileSync(new URL('../render.yaml', import.meta.url), 'utf8');
  for (const needle of [/key: NODE_ENV\s+value: production/, /key: TRUST_PROXY\s+value: "1"/, /key: NODE_VERSION\s+value: "22"/, /healthCheckPath: \/health/]) {
    assert.match(yaml, needle);
  }
});

// 2 and 3. documentation and CI
test('item 2: README documents the in-memory rate limiter', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /in-memory/i);
  assert.match(readme, /Redis/);
});
test('item 3: CI runs on push and pull_request with Node 22, npm ci and npm test', () => {
  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(ci, /^\s{2}push:\s*$/m);
  assert.match(ci, /^\s{2}pull_request:/m);
  assert.match(ci, /node-version: 22/);
  assert.match(ci, /npm ci/);
  assert.match(ci, /npm test/);
});

// 4. compression and detail
function rawGet(route, headers) {
  return new Promise((resolve, reject) => {
    const request = http.request(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers } }, response => {
      const chunks = []; response.on('data', c => chunks.push(c)); response.on('end', () => resolve({ headers: response.headers, body: Buffer.concat(chunks) }));
    });
    request.on('error', reject);
    request.end(JSON.stringify({ A: ident(8), B: ident(8) }));
  });
}
test('item 4: large responses are gzipped when the client accepts it, and plain otherwise', async () => {
  const zipped = await rawGet('/api/matrix/multiply', { 'Accept-Encoding': 'gzip' });
  assert.equal(zipped.headers['content-encoding'], 'gzip');
  const plain = await rawGet('/api/matrix/multiply', { 'Accept-Encoding': 'identity' });
  assert.equal(plain.headers['content-encoding'], undefined);
  assert.ok(zipped.body.length < plain.body.length / 5);
});
test('item 4: default detail is full and unchanged; compact has fewer steps, same result', async () => {
  const full = await post('/api/matrix/multiply', { A: ident(8), B: ident(8) });
  const explicit = await post('/api/matrix/multiply?detail=full', { A: ident(8), B: ident(8) });
  assert.equal(full.data.steps.length, 1156);
  assert.deepEqual(explicit.data, full.data);
  assert.equal(full.data.summary.detail, undefined);
  const compact = await post('/api/matrix/multiply?detail=compact', { A: ident(8), B: ident(8) });
  assert.equal(compact.status, 200);
  assert.deepEqual(compact.data.result, full.data.result);
  assert.equal(compact.data.steps.length, 4 + 64);
  assert.equal(compact.data.summary.totalSteps, compact.data.steps.length);
  assert.equal(compact.data.summary.detail, 'compact');
  assert.deepEqual(compact.data.steps.map(s => s.id), compact.data.steps.map((_, i) => i + 1));
  for (const s of compact.data.steps) assert.ok(s.explanation && s.formula && s.keyPoints.length && Array.isArray(s.highlights));
});
test('item 4: compact works for every operation and for number conversion (one step per digit)', async () => {
  for (const op of ['add', 'subtract', 'transpose', 'determinant', 'multiply']) {
    const full = await post(`/api/matrix/${op}`, { A, B });
    const compact = await post(`/api/matrix/${op}?detail=compact`, { A, B });
    assert.deepEqual(compact.data.result, full.data.result, op);
    assert.ok(compact.data.steps.length < full.data.steps.length, op);
  }
  const body = { number: 'FF', fromBase: 16, toBase: 2 };
  const full = await post('/api/number-system/convert', body);
  const compact = await post('/api/number-system/convert?detail=compact', body);
  assert.equal(compact.data.result, full.data.result);
  assert.ok(compact.data.steps.length < full.data.steps.length / 2);
  assert.equal(compact.data.steps.filter(s => s.action === 'record-remainder').length, 8);
});
test('item 4: unknown, empty or repeated detail values are 400 INVALID_INPUT with field detail', async () => {
  for (const q of ['detail=tiny', 'detail=', 'detail=full&detail=compact', 'detail=COMPACT']) {
    for (const route of ['/api/matrix/add', '/api/number-system/convert']) {
      const { status, data } = await post(`${route}?${q}`, { A, B, number: '1', fromBase: 10, toBase: 2 });
      assert.equal(status, 400, q);
      assert.equal(data.error.code, 'INVALID_INPUT');
      assert.equal(data.error.field, 'detail');
    }
  }
});

// 5. limits unchanged
test('item 5: body limit still 64 KB and rate limit still applies', async () => {
  const tooBig = await post('/api/matrix/add', { A: [[1]], B: [[1]], pad: 'x'.repeat(70 * 1024) });
  assert.equal(tooBig.status, 413);
  const limited = createApp({ logRequests: false, nodeEnv: 'test', rateLimit: { windowMs: 60000, max: 2 } }).listen(0);
  await new Promise(resolve => limited.once('listening', resolve));
  const url = `http://127.0.0.1:${limited.address().port}/api/matrix/add?detail=compact`;
  const send = () => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ A, B }) });
  assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 200);
  const third = await send();
  assert.equal(third.status, 429);
  assert.equal((await third.json()).error.code, 'RATE_LIMITED');
  await new Promise(resolve => limited.close(resolve));
});
test('item 5: worst-case 64-digit conversion stays within the documented size', async () => {
  const response = await fetch(base + '/api/number-system/convert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number: 'F'.repeat(64), fromBase: 16, toBase: 2 }) });
  const bytes = (await response.arrayBuffer()).byteLength;
  assert.ok(bytes < 2_500_000, `${bytes} bytes`);
});

// 6. rounding notes
test('item 6: summary.notes appears only when rounding changed a value', () => {
  assert.equal(calculateMatrix('add', { A: [[0.1]], B: [[0.2]] }).result[0][0], 0.3);
  assert.match(calculateMatrix('add', { A: [[0.1]], B: [[0.2]] }).summary.notes[0], /15 significant digits/);
  assert.equal(calculateMatrix('add', { A: [[0.5]], B: [[0.25]] }).summary.notes, undefined);
  assert.equal(calculateMatrix('add', { A, B }).summary.notes, undefined);
  assert.equal(calculateMatrix('multiply', { A: [[0.1, 0.2]], B: [[0.3], [0.4]] }).summary.notes.length, 1);
  assert.equal(calculateMatrix('determinant', { A: [[0.1, 0.2], [0.3, 0.7]] }).summary.notes.length, 1);
});
test('item 6: rounding behavior itself did not change', () => {
  assert.equal(checked(0.1 + 0.2), 0.3);
  assert.equal(checked(-0), 0);
  assert.equal(checked(1 / 3), 0.333333333333333);
  assert.equal(checked(1234567890123456), 1234567890123456);
});

// 7. correct field for RESULT_TOO_LARGE
test('item 7: RESULT_TOO_LARGE reports "result" for computed values and honors an explicit field', async () => {
  const huge = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => (i === j ? 1_000_000 : 0)));
  assert.throws(() => calculateMatrix('determinant', { A: huge }), e => e instanceof InputError && e.code === 'RESULT_TOO_LARGE' && e.field === 'result' && e.status === 422);
  assert.throws(() => checked(Infinity, 'B'), e => e.code === 'RESULT_TOO_LARGE' && e.field === 'B');
  assert.throws(() => checked(2 ** 60, 'A'), e => e.field === 'A');
  assert.throws(() => checked(2 ** 60), e => e.field === 'result');
  const { status, data } = await post('/api/matrix/determinant', { A: huge });
  assert.equal(status, 422);
  assert.equal(data.error.field, 'result');
});

// 8. 1-based display formulas
test('item 8: displayFormula is 1-based; machine indices and highlights stay 0-based', () => {
  assert.equal(displayFormula('product = A[0][1] * B[1][0]'), 'product = A[1][2] * B[2][1]');
  assert.equal(displayFormula('C[i][j] = A[i][j] + B[i][j]'), 'C[i][j] = A[i][j] + B[i][j]');
  assert.equal(displayFormula('det(M) = M[1][j]'), 'det(M) = M[1][j]');
  const r = calculateMatrix('multiply', { A: [[1, 2]], B: [[3], [4]] });
  const pair = r.steps.find(s => s.action === 'multiply-pair' && s.formula.includes('A[0][1]'));
  assert.equal(pair.formula, 'product = A[0][1] * B[1][0]');
  assert.equal(pair.displayFormula, 'product = A[1][2] * B[2][1]');
  assert.deepEqual(pair.highlights, [{ matrix: 'A', row: 0, column: 1 }, { matrix: 'B', row: 1, column: 0 }]);
  assert.ok(r.steps.find(s => s.action === 'select-row-column').displayFormula.includes('k = 1..columns(A)'));
  assert.equal(r.steps.find(s => s.action === 'select-row-column').formula.includes('k = 0..'), true);
});

// 9. beginner intro
test('item 9: ?detail=beginner adds one intro step first and changes nothing else', async () => {
  for (const [route, body] of [['/api/matrix/add', { A, B }], ['/api/matrix/determinant', { A }], ['/api/number-system/convert', { number: '13', fromBase: 10, toBase: 2 }]]) {
    const full = await post(route, body);
    const beginner = await post(`${route}?detail=beginner`, body);
    assert.equal(beginner.status, 200);
    assert.equal(beginner.data.steps.length, full.data.steps.length + 1);
    assert.equal(beginner.data.steps[0].action, 'before-you-start');
    assert.equal(beginner.data.steps[0].id, 1);
    assert.deepEqual(beginner.data.steps.map(s => s.id), beginner.data.steps.map((_, i) => i + 1));
    assert.equal(beginner.data.summary.detail, 'beginner');
    assert.deepEqual(beginner.data.result, full.data.result);
    assert.deepEqual(beginner.data.steps.slice(1).map(s => s.action), full.data.steps.map(s => s.action));
  }
  assert.match(convertNumber({ number: '13', fromBase: 10, toBase: 2 }, { detail: 'beginner' }).steps[0].explanation, /place/i);
  assert.match(calculateMatrix('add', { A, B }, { detail: 'beginner' }).steps[0].explanation, /row/i);
});

// 10. why line
test('item 10: every step ends its keyPoints with a "Why:" line', () => {
  const responses = [
    ...['add', 'subtract', 'transpose', 'multiply', 'determinant'].map(op => calculateMatrix(op, { A, B })),
    convertNumber({ number: '-1F', fromBase: 16, toBase: 8 }), convertNumber({ number: '0', fromBase: 10, toBase: 2 }),
    convertNumber({ number: '13', fromBase: 10, toBase: 10 }), calculateMatrix('determinant', { A: [[5]] }),
    calculateMatrix('multiply', { A, B }, { detail: 'beginner' })
  ];
  for (const r of responses) for (const step of r.steps) {
    assert.match(step.keyPoints.at(-1), /^Why: /, `${r.operation} ${step.action}`);
    assert.equal(step.keyPoints.filter(k => k.startsWith('Why: ')).length, 1);
  }
});

// 11. practice endpoint
const check = body => checkPractice(body);
test('item 11: correct answers are reported correct', () => {
  assert.equal(check({ operation: 'multiply', input: { A, B }, answer: [[19, 22], [43, 50]] }).correct, true);
  assert.equal(check({ operation: 'add', input: { A, B }, answer: [[6, 8], [10, 12]] }).correct, true);
  assert.equal(check({ operation: 'subtract', input: { A, B }, answer: [[-4, -4], [-4, -4]] }).correct, true);
  assert.equal(check({ operation: 'transpose', input: { A }, answer: [[1, 3], [2, 4]] }).correct, true);
  assert.equal(check({ operation: 'determinant', input: { A }, answer: -2 }).correct, true);
  assert.equal(check({ operation: 'add', input: { A: [[0.1]], B: [[0.2]] }, answer: [[0.3]] }).correct, true);
  assert.equal(check({ operation: 'convert', input: { number: '13', fromBase: 10, toBase: 2 }, answer: '1101' }).correct, true);
  assert.equal(check({ operation: 'convert', input: { number: '255', fromBase: 10, toBase: 16 }, answer: ' 0ff ' }).correct, true);
  assert.equal(check({ operation: 'convert', input: { number: '-0', fromBase: 10, toBase: 2 }, answer: '-0' }).correct, true);
});
test('item 11: wrong matrix answers point at the first wrong cell in calculation order', () => {
  const r = check({ operation: 'multiply', input: { A, B }, answer: [[19, 22], [43, 49]] });
  assert.equal(r.correct, false);
  assert.equal(r.firstWrongStep.action, 'select-row-column');
  assert.deepEqual(r.firstWrongStep.highlights, [{ matrix: 'C', row: 1, column: 1 }]);
  assert.equal(r.expected, undefined);
  const early = check({ operation: 'multiply', input: { A, B }, answer: [[5, 22], [43, 50]] });
  assert.equal(early.firstWrongStep.reason, 'stopped-early');
  assert.equal(early.firstWrongStep.action, 'multiply-pair');
  const shape = check({ operation: 'add', input: { A, B }, answer: [[6, 8]] });
  assert.equal(shape.firstWrongStep.reason, 'shape');
  const sub = check({ operation: 'subtract', input: { A, B }, answer: [[-4, -4], [-4, 4]] });
  assert.deepEqual(sub.firstWrongStep.highlights[0], { matrix: 'A', row: 1, column: 1 });
  const tr = check({ operation: 'transpose', input: { A }, answer: [[1, 2], [3, 4]] });
  assert.equal(tr.firstWrongStep.action, 'select-entry');
  assert.deepEqual(tr.firstWrongStep.highlights, [{ matrix: 'A', row: 0, column: 1 }]);
  assert.ok(r.firstWrongStep.id >= 1 && r.firstWrongStep.id <= r.totalSteps);
});
test('item 11: wrong determinant and number answers get a reason and a step', () => {
  const M = [[2, 1, 3], [0, 4, 5], [1, 0, 6]];
  assert.equal(check({ operation: 'determinant', input: { A: M }, answer: 41 }).correct, true);
  assert.equal(check({ operation: 'determinant', input: { A: M }, answer: 48 }).firstWrongStep.reason, 'stopped-early');
  assert.equal(check({ operation: 'determinant', input: { A: M }, answer: 41 - 2 * 48 }).firstWrongStep.reason, 'sign');
  assert.equal(check({ operation: 'determinant', input: { A: M }, answer: 41 - 5 }).firstWrongStep.reason, 'term-skipped');
  assert.equal(check({ operation: 'determinant', input: { A: M }, answer: 999 }).firstWrongStep.confidence, 'low');
  const conv = answer => check({ operation: 'convert', input: { number: '13', fromBase: 10, toBase: 2 }, answer });
  assert.equal(conv('1011').firstWrongStep.reason, 'reversed');
  assert.equal(conv('1011').firstWrongStep.action, 'reverse-remainders');
  assert.equal(conv('1001').firstWrongStep.action, 'record-remainder');
  assert.equal(conv('1001').firstWrongStep.title, 'Record remainder 3');
  assert.equal(conv('2').firstWrongStep.reason, 'invalid-digit');
  assert.equal(conv('-1101').firstWrongStep.action, 'restore-sign');
  assert.equal(conv('11101').firstWrongStep.reason, 'extra-digits');
  assert.equal(conv('101').firstWrongStep.reason, 'stopped-early');
  assert.equal(check({ operation: 'convert', input: { number: 'FF', fromBase: 16, toBase: 10 }, answer: '240' }).firstWrongStep.reason, 'stopped-early');
});
test('item 11: POST /api/practice/check over HTTP, reveal, and validation', async () => {
  const ok = await post('/api/practice/check', { operation: 'multiply', input: { A, B }, answer: [[19, 22], [43, 50]] });
  assert.equal(ok.status, 200);
  assert.deepEqual([ok.data.success, ok.data.correct, ok.data.firstWrongStep], [true, true, undefined]);
  const bad = await post('/api/practice/check', { operation: 'multiply', input: { A, B }, answer: [[0, 0], [0, 0]], reveal: true });
  assert.equal(bad.data.correct, false);
  assert.deepEqual(bad.data.expected, [[19, 22], [43, 50]]);
  assert.ok(bad.data.firstWrongStep.id >= 1);
  const cases = [
    [{ operation: 'rotate', input: { A }, answer: 1 }, 'operation'],
    [{ operation: 'multiply', answer: [[1]] }, 'input'],
    [{ operation: 'multiply', input: { A, B } }, 'answer'],
    [{ operation: 'multiply', input: { A, B }, answer: 'x' }, 'answer'],
    [{ operation: 'multiply', input: { A, B }, answer: [[1, 'a']] }, 'answer'],
    [{ operation: 'determinant', input: { A }, answer: [[1]] }, 'answer'],
    [{ operation: 'convert', input: { number: '1', fromBase: 10, toBase: 2 }, answer: 5 }, 'answer'],
    [{ operation: 'convert', input: { number: '1', fromBase: 10, toBase: 2 }, answer: 'x'.repeat(301) }, 'answer'],
    [{ operation: 'add', input: { A, B }, answer: [[1]], reveal: 'yes' }, 'reveal'],
    [{ operation: 'add', input: { A: [[1]], B: [[1], [2]] }, answer: [[1]] }, 'B'],
    [{ operation: 'convert', input: { number: '9', fromBase: 2, toBase: 10 }, answer: '9' }, 'number']
  ];
  for (const [body, field] of cases) {
    const { status, data } = await post('/api/practice/check', body);
    assert.equal(status, 400, JSON.stringify(body));
    assert.equal(data.error.code, 'INVALID_INPUT');
    assert.equal(data.error.field, field);
  }
  assert.equal((await post('/api/practice/check', [1])).status, 400);
  const wrongMethod = await fetch(base + '/api/practice/check');
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get('allow'), 'POST, OPTIONS');
});
test('item 11: route is listed and documented', async () => {
  const api = await (await fetch(base + '/api')).json();
  assert.equal(api.routes.length, 6);
  assert.deepEqual(api.optionalRoutes, ['POST /api/practice/check']);
  const doc = await (await fetch(base + '/api/openapi.json')).json();
  assert.ok(doc.paths['/api/practice/check'].post);
  for (const path of ['/api/matrix/add', '/api/matrix/multiply', '/api/matrix/transpose', '/api/matrix/subtract', '/api/matrix/determinant', '/api/number-system/convert']) {
    const parameter = doc.paths[path].post.parameters.find(p => p.name === 'detail');
    assert.deepEqual(parameter.schema.enum, ['full', 'compact', 'beginner']);
  }
});
