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
