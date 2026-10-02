import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMatrix } from '../src/algorithms/matrix.js';
import { convertNumber } from '../src/algorithms/number-system.js';
import { InputError } from '../src/common.js';
import { loadConfig, parseOrigins } from '../src/config.js';

const inputError = field => err => err instanceof InputError && err.status >= 400 && (!field || err.field === field);

test('validation throws InputError (never a generic Error) with the right field', () => {
  assert.throws(() => calculateMatrix('add', { B: [[1]] }), inputError('A'));
  assert.throws(() => calculateMatrix('add', { A: [[1]] }), inputError('B'));
  assert.throws(() => calculateMatrix('add', { A: 'x', B: [[1]] }), inputError('A'));
  assert.throws(() => calculateMatrix('add', { A: [[1], 'x'], B: [[1]] }), inputError('A'));
  assert.throws(() => calculateMatrix('rotate', { A: [[1]] }), inputError('operation'));
  assert.throws(() => calculateMatrix('add', undefined), inputError('body'));
  for (const bad of [-1000001, 1e308, 'NaN', true, {}, [1]]) {
    assert.throws(() => calculateMatrix('transpose', { A: [[bad]] }), inputError('A'));
  }
});

test('matrix boundary sizes: 8x8 accepted, 9 rows or columns rejected', () => {
  const m = n => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const x = calculateMatrix('multiply', { A: m(8), B: m(8) });
  assert.deepEqual(x.result, m(8));
  assert.equal(x.summary.totalSteps, x.steps.length);
  assert.throws(() => calculateMatrix('transpose', { A: m(9) }), inputError('A'));
  assert.throws(() => calculateMatrix('transpose', { A: [Array(9).fill(1)] }), inputError('A'));
  const edge = Array.from({ length: 8 }, () => Array(8).fill(1_000_000));
  assert.equal(calculateMatrix('multiply', { A: edge, B: edge }).result[0][0], 8e12);
});

test('8x8 multiplication trace stays a reasonable size', () => {
  const m = Array.from({ length: 8 }, () => Array(8).fill(1));
  const started = Date.now();
  const bytes = Buffer.byteLength(JSON.stringify(calculateMatrix('multiply', { A: m, B: m })));
  assert.ok(Date.now() - started < 2000, 'finishes quickly');
  assert.ok(bytes < 8_000_000, `response is ${bytes} bytes`);
});

test('decimal arithmetic has no binary floating-point noise', () => {
  assert.deepEqual(calculateMatrix('add', { A: [[0.1]], B: [[0.2]] }).result, [[0.3]]);
  assert.deepEqual(calculateMatrix('multiply', { A: [[0.1, 0.2]], B: [[3], [3]] }).result, [[0.9]]);
  assert.deepEqual(calculateMatrix('subtract', { A: [[0.3]], B: [[0.1]] }).result, [[0.2]]);
  const step = calculateMatrix('add', { A: [[0.1]], B: [[0.2]] }).steps.find(s => s.action === 'evaluate-pair');
  assert.match(step.explanation, /0\.1 \+ 0\.2 = 0\.3\./);
});

test('negative zero never appears in results or traces', () => {
  const x = calculateMatrix('multiply', { A: [[-0, 1]], B: [[5], [7]] });
  assert.ok(Object.is(x.result[0][0], 7));
  const d = calculateMatrix('determinant', { A: [[0, 0], [0, 0]] });
  assert.ok(Object.is(d.result, 0));
  assert.ok(!JSON.stringify(d).includes('-0'));
  assert.ok(Object.is(calculateMatrix('subtract', { A: [[0]], B: [[0]] }).result[0][0], 0));
});

test('determinant checked against known values, including rectangular-free edge cases', () => {
  const cases = [
    [[[0]], 0], [[[-5]], -5], [[[2, 0], [0, 3]], 6], [[[0, 1], [1, 0]], -1],
    [[[1.5, 2], [3, 4]], 0], [[[2, -1, 0], [-1, 2, -1], [0, -1, 2]], 4],
    [[[1, 0, 0, 0], [0, 0, 1, 0], [0, 1, 0, 0], [0, 0, 0, 1]], -1],
    [[[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]], 0]
  ];
  for (const [A, expected] of cases) assert.equal(calculateMatrix('determinant', { A }).result, expected, JSON.stringify(A));
});

test('results that cannot be shown exactly are refused instead of rounded', () => {
  const diag = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => (i === j ? 1e6 : 0)));
  assert.throws(() => calculateMatrix('determinant', { A: diag }), err => err.code === 'RESULT_TOO_LARGE' && err.status === 422);
});

test('trace steps are well formed, sequential and have valid highlights', () => {
  const A = [[1, 2, 3], [4, 5, 6]], B = [[1, 2], [3, 4], [5, 6]];
  for (const response of [
    calculateMatrix('multiply', { A, B }), calculateMatrix('transpose', { A }), calculateMatrix('add', { A, B: A }),
    calculateMatrix('subtract', { A, B: A }), calculateMatrix('determinant', { A: [[1, 2], [3, 4]] }),
    convertNumber({ number: '-FF', fromBase: 16, toBase: 8 })
  ]) {
    const shapes = { A: [A.length, A[0].length], B: [B.length, B[0].length] };
    response.steps.forEach((step, i) => {
      assert.equal(step.id, i + 1);
      for (const key of ['stage', 'action', 'title', 'explanation', 'formula']) assert.equal(typeof step[key], 'string');
      assert.ok(Array.isArray(step.keyPoints) && Array.isArray(step.highlights) && typeof step.state === 'object');
    });
    assert.equal(response.summary.totalSteps, response.steps.length);
    assert.equal(response.steps.at(-1).stage, response.module === 'matrix' ? 'complete' : 'verify');
    assert.doesNotThrow(() => JSON.stringify(response));
    if (response.operation === 'multiply') {
      const out = [A.length, B[0].length];
      for (const step of response.steps) for (const h of step.highlights) {
        const [rows, cols] = h.matrix === 'C' ? out : shapes[h.matrix];
        assert.ok(h.row >= 0 && h.row < rows && h.column >= 0 && h.column < cols, `highlight ${JSON.stringify(h)} in range`);
      }
    }
  }
});

test('trace states are snapshots: later steps and caller edits cannot change earlier ones', () => {
  const x = calculateMatrix('multiply', { A: [[1, 2], [3, 4]], B: [[5, 6], [7, 8]] });
  const first = JSON.stringify(x.steps.find(s => s.action === 'create-result').state);
  const snapshots = x.steps.filter(s => s.state.result).map(s => s.state.result);
  assert.equal(new Set(snapshots).size, snapshots.length, 'each snapshot is its own object');
  x.result[0][0] = 999; x.input.A[0][0] = 999;
  assert.equal(JSON.stringify(x.steps.find(s => s.action === 'create-result').state), first);
  assert.equal(x.steps.at(-1).state.result[0][0], 19);
  assert.equal(x.steps.find(s => s.action === 'inspect-dimensions').state.A[0][0], 1);
});

test('request input objects are not mutated by calculations', () => {
  const body = { A: [[1, 2], [3, 4]], B: [[5, 6], [7, 8]] };
  const copy = structuredClone(body);
  calculateMatrix('multiply', body);
  assert.deepEqual(body, copy);
});

test('uncalculated cells are null in the trace, never a fake zero', () => {
  const x = calculateMatrix('add', { A: [[1, 2]], B: [[3, 4]] });
  const prepared = x.steps.find(s => s.action === 'create-result').state.result;
  assert.deepEqual(prepared, [[null, null]]);
  const afterFirst = x.steps.filter(s => s.action === 'store-cell')[0].state.result;
  assert.deepEqual(afterFirst, [[4, null]]);
  assert.deepEqual(x.result, [[4, 6]]);
});

test('final trace values agree with the returned result', () => {
  assert.equal(convertNumber({ number: '255', fromBase: 10, toBase: 16 }).steps.at(-1).state.verifiedDecimal, '255');
  const d = calculateMatrix('determinant', { A: [[1, 2], [3, 4]] });
  assert.equal(d.steps.at(-1).state.result, d.result);
});

test('number conversion: strict input format', () => {
  for (const number of ['-', '--5', '-+5', '5-', ' 5', '5 ', '+5', '0x1F', '0o17', '1_0', '1.0', '.5', 'G', '1\n0', '١٢', '', '1'.repeat(65), '-' + '1'.repeat(65)]) {
    assert.throws(() => convertNumber({ number, fromBase: 16, toBase: 10 }), inputError('number'), JSON.stringify(number));
  }
  for (const number of [undefined, null, 5, true, [], {}]) assert.throws(() => convertNumber({ number, fromBase: 10, toBase: 2 }), inputError('number'));
  for (const number of ['1e3', '0b101', '0x1F', '1E+3']) assert.throws(() => convertNumber({ number, fromBase: 10, toBase: 2 }), inputError('number'));
  for (const [fromBase, digit] of [[2, '2'], [8, '8'], [10, 'A']]) assert.throws(() => convertNumber({ number: digit, fromBase, toBase: 2 }), inputError('number'));
  for (const base of [0, 1, 3, 32, -2, 2.5, '2', null, NaN]) {
    assert.throws(() => convertNumber({ number: '1', fromBase: base, toBase: 2 }), inputError('fromBase'));
    assert.throws(() => convertNumber({ number: '1', fromBase: 2, toBase: base }), inputError('toBase'));
  }
});

test('number conversion: maximum length and random large values match BigInt', () => {
  assert.equal(convertNumber({ number: '1'.repeat(64), fromBase: 2, toBase: 16 }).result, BigInt('0b' + '1'.repeat(64)).toString(16).toUpperCase());
  assert.equal(convertNumber({ number: '-' + '7'.repeat(64), fromBase: 8, toBase: 2 }).result, '-' + '1'.repeat(192));
  assert.equal(convertNumber({ number: '0'.repeat(64), fromBase: 2, toBase: 16 }).result, '0');
  let seed = 12345n;
  for (let i = 0; i < 40; i++) {
    seed = (seed * 6364136223846793005n + 1442695040888963407n) % (1n << 200n);
    const sign = i % 2 ? '-' : '';
    for (const [fromBase, toBase] of [[10, 2], [10, 16], [16, 8], [2, 10], [8, 16]]) {
      const source = sign + seed.toString(fromBase);
      if (source.length > 65) continue;
      const expected = (sign && seed !== 0n ? '-' : '') + seed.toString(toBase).toUpperCase();
      assert.equal(convertNumber({ number: source, fromBase, toBase }).result, expected);
    }
  }
});

test('config: defaults, validation and safe production CORS', () => {
  const c = loadConfig({});
  assert.equal(c.port, 3000); assert.equal(c.nodeEnv, 'development'); assert.deepEqual(c.corsOrigins, []);
  assert.equal(c.rateLimit.max, 120);
  assert.throws(() => loadConfig({ PORT: '0' }), /PORT/);
  assert.throws(() => loadConfig({ PORT: 'abc' }), /PORT/);
  assert.throws(() => loadConfig({ PORT: '70000' }), /PORT/);
  assert.throws(() => loadConfig({ NODE_ENV: 'prod' }), /NODE_ENV/);
  assert.throws(() => loadConfig({ RATE_LIMIT_MAX: '0' }), /RATE_LIMIT_MAX/);
  assert.throws(() => loadConfig({ RATE_LIMIT_WINDOW_MS: '5' }), /RATE_LIMIT_WINDOW_MS/);
  assert.throws(() => loadConfig({ TRUST_PROXY: 'yes' }));
  assert.throws(() => loadConfig({ NODE_ENV: 'production', CORS_ORIGIN: '*' }), /production/);
  assert.throws(() => loadConfig({ NODE_ENV: 'production', CORS_ORIGIN: 'https://a.example, *' }), /production/);
  assert.throws(() => parseOrigins('https://app.example.com/'), /exact origins/);
  assert.throws(() => parseOrigins('app.example.com'), /invalid origin/);
  assert.deepEqual(parseOrigins('https://a.example, http://localhost:5173', true), ['https://a.example', 'http://localhost:5173']);
  assert.equal(loadConfig({ PORT: '8080', RATE_LIMIT_MAX: '10', TRUST_PROXY: '1' }).trustProxy, 1);
});
