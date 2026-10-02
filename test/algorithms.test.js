import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMatrix } from '../src/algorithms/matrix.js';
import { convertNumber } from '../src/algorithms/number-system.js';
function checkTrace(response) {
  assert.equal(response.success, true);
  assert.ok(response.steps.length > 0);
  for (const [index, step] of response.steps.entries()) {
    assert.equal(step.id, index + 1);
    for (const field of ['title', 'explanation', 'formula', 'stage', 'action']) assert.ok(typeof step[field] === 'string' && step[field].length > 0);
    assert.ok(Array.isArray(step.keyPoints) && step.keyPoints.length > 0);
    assert.ok(step.state && typeof step.state === 'object');
  }
  assert.equal(response.summary.totalSteps, response.steps.length);
  assert.doesNotThrow(() => JSON.stringify(response));
}
test('add and subtract with decimals and negative entries', () => {
  const A = [[1, -2], [0.5, 4]], B = [[5, 6], [1.5, -8]];
  assert.deepEqual(calculateMatrix('add', { A, B }).result, [[6, 4], [2, -4]]);
  const x = calculateMatrix('subtract', { A, B });
  assert.deepEqual(x.result, [[-4, -8], [-1, 12]]); checkTrace(x);
});
test('rectangular transpose and transpose twice', () => {
  const A = [[1, 2, 3], [4, 5, 6]];
  const x = calculateMatrix('transpose', { A });
  assert.deepEqual(x.result, [[1, 4], [2, 5], [3, 6]]);
  assert.deepEqual(calculateMatrix('transpose', { A: x.result }).result, A); checkTrace(x);
});
test('approved multiplication example has separate multiply and add steps', () => {
  const x = calculateMatrix('multiply', { A: [[1, 2], [3, 4]], B: [[5, 6], [7, 8]] });
  assert.deepEqual(x.result, [[19, 22], [43, 50]]);
  assert.equal(x.steps.filter(s => s.action === 'multiply-pair').length, 8);
  assert.equal(x.steps.filter(s => s.action === 'add-product').length, 8);
  assert.equal(x.steps.filter(s => s.action === 'store-cell').length, 4);
  assert.deepEqual(x.steps.find(s => s.action === 'create-result').state.result, [[null, null], [null, null]]);
  assert.deepEqual(x.steps.find(s => s.action === 'store-cell').state.result, [[19, null], [null, null]]);
  checkTrace(x);
});
test('rectangular multiplication and single-cell multiplication', () => {
  assert.deepEqual(calculateMatrix('multiply', { A: [[1, 2, 3]], B: [[4], [5], [6]] }).result, [[32]]);
  assert.deepEqual(calculateMatrix('multiply', { A: [[-2]], B: [[3]] }).result, [[-6]]);
});
test('determinants 1x1 to 4x4 and singular matrix', () => {
  for (const [A, expected] of [
    [[[7]], 7], [[[1, 2], [3, 4]], -2], [[[1, 2], [2, 4]], 0],
    [[[6, 1, 1], [4, -2, 5], [2, 8, 7]], -306],
    [[[1, 2, 3, 4], [0, 2, 3, 4], [0, 0, 3, 4], [0, 0, 0, 4]], 24]
  ]) { const x = calculateMatrix('determinant', { A }); assert.equal(x.result, expected); checkTrace(x); }
});
test('matrix input validation', () => {
  for (const A of [[], [[]], [[1], [1, 2]], [['2']], [[null]], [[NaN]], [[Infinity]], [[1000001]], Array.from({ length: 9 }, () => [1])]) {
    assert.throws(() => calculateMatrix('transpose', { A }));
  }
  assert.throws(() => calculateMatrix('add', { A: [[1]], B: [[1, 2]] }));
  assert.throws(() => calculateMatrix('multiply', { A: [[1, 2]], B: [[1, 2]] }));
  assert.throws(() => calculateMatrix('determinant', { A: [[1, 2]] }));
  assert.throws(() => calculateMatrix('determinant', { A: Array.from({ length: 5 }, () => Array(5).fill(1)) }));
  assert.throws(() => calculateMatrix('transpose', null));
});
test('13 decimal to binary and verification trace', () => {
  const x = convertNumber({ number: '13', fromBase: 10, toBase: 2 });
  assert.equal(x.result, '1101');
  assert.deepEqual(x.steps.filter(s => s.action === 'record-remainder').map(s => s.state.digit), ['1', '0', '1', '1']);
  assert.equal(x.steps.at(-1).state.passed, true); checkTrace(x);
});
test('zero, minus zero, negative and lowercase hex, leading zeros, same base', () => {
  for (const [number, fromBase, toBase, expected] of [
    ['0', 10, 2, '0'], ['-000', 8, 16, '0'], ['-13', 10, 2, '-1101'],
    ['ff', 16, 10, '255'], ['0001101', 2, 8, '15'], ['00af', 16, 16, 'AF'], ['1010', 2, 16, 'A']
  ]) { const x = convertNumber({ number, fromBase, toBase }); assert.equal(x.result, expected); checkTrace(x); }
});
test('all 16 source-target combinations across 200 exact integers', () => {
  const bases = [2, 8, 10, 16];
  for (let i = 0n; i < 200n; i++) for (const fromBase of bases) for (const toBase of bases) {
    const x = convertNumber({ number: i.toString(fromBase).toUpperCase(), fromBase, toBase });
    assert.equal(x.result, i.toString(toBase).toUpperCase());
  }
});
test('exact conversion beyond safe integer range and maximum source size', () => {
  const big = (2n ** 200n + 123456789n).toString();
  assert.equal(convertNumber({ number: big, fromBase: 10, toBase: 16 }).result, BigInt(big).toString(16).toUpperCase());
  const x = convertNumber({ number: 'F'.repeat(64), fromBase: 16, toBase: 2 });
  assert.equal(x.result, '1'.repeat(256)); checkTrace(x);
});
test('number-system validation', () => {
  for (const number of ['', '-', '2', '10.1', '0b10', ' 10', '+10', '1e2', '1'.repeat(65), 10, null]) {
    assert.throws(() => convertNumber({ number, fromBase: 2, toBase: 10 }));
  }
  for (const fromBase of [3, '2', undefined]) assert.throws(() => convertNumber({ number: '1', fromBase, toBase: 10 }));
  assert.throws(() => convertNumber({ number: '1', fromBase: 10, toBase: 3 }));
  assert.throws(() => convertNumber([]));
});
