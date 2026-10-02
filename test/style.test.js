import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/cli.js';
import { addStyleHints, MODULE_COLORS } from '../src/style.js';
import { calculateMatrix } from '../src/algorithms/matrix.js';
import { createApp } from '../src/app.js';

const M = '{"A":[[1,2],[3,4]],"B":[[5,6],[7,8]]}';
const C = '{"number":"13","fromBase":10,"toBase":2}';

test('six modules have distinct colours', () => {
  const hex = Object.values(MODULE_COLORS).map(c => c.hex);
  assert.equal(new Set(hex).size, 6);
});
test('cli is plain when not a TTY or NO_COLOR is set', () => {
  assert.ok(!run(['multiply', M], { stream: { isTTY: false }, env: {} }).text.includes('\x1b['));
  assert.ok(!run(['multiply', M], { stream: { isTTY: true }, env: { NO_COLOR: '1' } }).text.includes('\x1b['));
});
test('cli colours on TTY and answer is gold', () => {
  const { text } = run(['multiply', M], { stream: { isTTY: true }, env: {} });
  assert.match(text, /\x1b\[1;38;2;184;164;58m\[ 19  22 \]/);
});
test('cli runs convert and rejects bad input', () => {
  assert.match(run(['convert', C], { stream: {}, env: {} }).text, /answer "1101"/);
  assert.equal(run(['nope', M]).code, 2);
  assert.equal(run(['multiply', '{bad']).code, 2);
});
test('hints add style without changing result', () => {
  const r = calculateMatrix('determinant', { A: [[1, 2], [3, 4]] });
  const h = addStyleHints(r);
  assert.deepEqual(h.result, r.result);
  assert.equal(h.style.accent, MODULE_COLORS.determinant.hex);
});
test('API: style only with ?style=hints', async () => {
  const server = createApp({ logRequests: false, nodeEnv: 'test' }).listen(0);
  await new Promise(r => server.once('listening', r));
  const url = `http://127.0.0.1:${server.address().port}/api/matrix/add`;
  const post = q => fetch(url + q, { method: 'POST', headers: { 'content-type': 'application/json' }, body: M }).then(r => r.json());
  assert.equal((await post('')).style, undefined);
  const h = await post('?style=hints');
  assert.equal(h.style.module, 'add');
  server.close();
});

test('module headers use exact true-colour hex and all six differ', async () => {
  const { makeStyler, MODULE_COLORS } = await import('../src/style.js');
  const s = makeStyler(true);
  const seen = new Set();
  for (const [key, c] of Object.entries(MODULE_COLORS)) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(c.hex.slice(i, i + 2), 16));
    const out = s.accent(key, 'x');
    assert.equal(out, `\x1b[1;38;2;${r};${g};${b}mx\x1b[0m`);
    seen.add(out);
  }
  assert.equal(seen.size, 6);
});
