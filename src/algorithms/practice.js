import { InputError, requireObject } from '../common.js';
import { calculateMatrix } from './matrix.js';
import { convertNumber } from './number-system.js';

const MATRIX_OPERATIONS = ['add', 'subtract', 'transpose', 'multiply', 'determinant'];
export const PRACTICE_OPERATIONS = [...MATRIX_OPERATIONS, 'convert'];
const MAX_ANSWER_LENGTH = 300;
const same = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

const HINTS = {
  shape: 'The answer has the wrong number of rows or columns. Check the dimension rule first.',
  'cell-mismatch': 'This is the first result cell (in calculation order) that does not match. Redo its calculation from here.',
  'stopped-early': 'Your value equals a running total before the last step. Make sure every pair or term is included.',
  sign: 'Your value is what you get if one term had the wrong sign. Check the alternating signs.',
  'term-skipped': 'Your value is what you get if one term was left out. Include every first-row term, even when the entry is 0.',
  'invalid-digit': 'The answer contains a symbol that does not exist in the target base.',
  'sign-mismatch': 'Check whether the result should have a minus sign.',
  reversed: 'Your digits are in the opposite order. The first remainder is the rightmost digit.',
  'remainder-mismatch': 'This is the first digit (counting from the right) that differs. Redo this division.',
  'extra-digits': 'Your answer has more digits than the division produces. Stop when the quotient reaches 0.',
  'digit-mismatch': 'Redo the place-value expansion from here.',
  unknown: 'I could not tell exactly where it went wrong, so this is the first place to start checking.'
};

// Never include step.explanation here: it can state the correct result. Learners fetch the full text from the normal endpoint using the step id.
function stepSummary(step, reason, confidence) {
  return {
    id: step.id, stage: step.stage, action: step.action, title: step.title,
    highlights: step.highlights, reason, confidence, hint: HINTS[reason]
  };
}

function matrixAnswer(answer, operation) {
  const bad = message => new InputError(message, 'answer');
  if (answer === undefined) throw bad('answer is required.');
  if (operation === 'determinant') {
    if (typeof answer !== 'number' || !Number.isFinite(answer)) throw bad('answer must be a finite number for a determinant.');
    return answer;
  }
  if (!Array.isArray(answer) || answer.length < 1 || answer.length > 8 || answer.some(row => !Array.isArray(row) || row.length < 1 || row.length > 8)) {
    throw bad('answer must be a matrix: an array of 1 to 8 rows, each an array of 1 to 8 numbers.');
  }
  if (answer.some(row => row.some(x => typeof x !== 'number' || !Number.isFinite(x)))) throw bad('answer entries must be finite numbers.');
  return answer;
}

function checkMatrix(operation, input, rawAnswer) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('input must be an object such as { "A": [[1]], "B": [[1]] }.', 'input');
  const answer = matrixAnswer(rawAnswer, operation);
  const response = calculateMatrix(operation, input);
  const { steps, result } = response;
  const base = { module: 'matrix', operation, expected: result, totalSteps: steps.length };
  if (operation === 'determinant') {
    if (same(answer, result)) return { ...base, correct: true };
    const top = steps.filter(s => s.state?.depth === 0);
    const choose = top.filter(s => s.action === 'choose-cofactor');
    if (!choose.length) return { ...base, correct: false, firstWrongStep: stepSummary(top.find(s => s.action === 'base-case') ?? steps[steps.length - 1], 'unknown', 'high') };
    const terms = top.filter(s => s.action === 'cofactor-product').map(s => s.state.term);
    let partial = 0;
    for (let m = 1; m < terms.length; m++) {
      partial += terms[m - 1];
      if (same(answer, partial)) return { ...base, correct: false, firstWrongStep: stepSummary(choose[m], 'stopped-early', 'high') };
    }
    for (let j = 0; j < terms.length; j++) {
      if (same(answer, result - 2 * terms[j])) return { ...base, correct: false, firstWrongStep: stepSummary(choose[j], 'sign', 'medium') };
      if (same(answer, result - terms[j])) return { ...base, correct: false, firstWrongStep: stepSummary(choose[j], 'term-skipped', 'medium') };
    }
    return { ...base, correct: false, firstWrongStep: stepSummary(choose[0], 'unknown', 'low') };
  }
  if (answer.length !== result.length || answer.some(row => row.length !== result[0].length)) {
    return { ...base, correct: false, firstWrongStep: stepSummary(steps.find(s => s.action === 'create-result'), 'shape', 'high') };
  }
  const transposed = operation === 'transpose';
  const startAction = { multiply: 'select-row-column', add: 'select-pair', subtract: 'select-pair', transpose: 'select-entry' }[operation];
  const rows = transposed ? result[0].length : result.length, cols = transposed ? result.length : result[0].length;
  // Walk the cells in the same order the trace calculates them.
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const [ri, rj] = transposed ? [j, i] : [i, j];
    if (same(answer[ri][rj], result[ri][rj])) continue;
    const at = steps.findIndex(s => s.action === startAction && s.highlights.some(h => h.row === i && h.column === j && (transposed ? h.matrix === 'A' : true)));
    if (operation === 'multiply') {
      // A value equal to a running sum before the last pair means the learner stopped adding early.
      const pairs = [];
      for (let k = at + 1; steps[k] && steps[k].action !== 'store-cell'; k++) if (steps[k].action === 'add-product') pairs.push(k);
      for (let p = 0; p < pairs.length - 1; p++) {
        if (same(answer[ri][rj], steps[pairs[p]].state.runningSum)) return { ...base, correct: false, firstWrongStep: stepSummary(steps[pairs[p] + 1], 'stopped-early', 'high') };
      }
    }
    return { ...base, correct: false, firstWrongStep: stepSummary(steps[at], 'cell-mismatch', 'medium') };
  }
  return { ...base, correct: true };
}

function checkConvert(input, rawAnswer) {
  if (typeof rawAnswer !== 'string' || rawAnswer.length < 1 || rawAnswer.length > MAX_ANSWER_LENGTH) {
    throw new InputError(`answer must be a string of 1 to ${MAX_ANSWER_LENGTH} characters.`, 'answer');
  }
  const response = convertNumber(input);
  const { steps, result } = response;
  const { toBase } = response.input;
  const normalize = text => {
    const upper = text.trim().toUpperCase();
    const negative = upper.startsWith('-');
    const digits = (negative ? upper.slice(1) : upper).replace(/^0+(?=.)/, '');
    return { negative: negative && digits !== '0', digits };
  };
  const user = normalize(rawAnswer), expected = normalize(result);
  const base = { module: 'number-system', operation: 'convert', expected: result, totalSteps: steps.length };
  if (user.negative === expected.negative && user.digits === expected.digits) return { ...base, correct: true };
  const nth = (action, n, stage) => steps.filter(s => s.action === action && (!stage || s.stage === stage))[n];
  const wrong = (step, reason, confidence) => ({ ...base, correct: false, firstWrongStep: stepSummary(step, reason, confidence) });
  const symbols = '0123456789ABCDEF'.slice(0, toBase);
  if (![...user.digits].every(x => symbols.includes(x))) {
    return wrong(toBase === 10 ? steps.find(s => s.action === 'decimal-output') : nth('record-remainder', 0), 'invalid-digit', 'high');
  }
  if (user.digits === expected.digits) return wrong(steps.find(s => s.action === 'restore-sign'), 'sign-mismatch', 'high');
  if (toBase === 10) {
    const totals = steps.filter(s => s.stage === 'decode' && s.action === 'add-contribution');
    for (let k = 0; k < totals.length - 1; k++) {
      if (totals[k].state.runningTotal === user.digits) return wrong(steps.filter(s => s.stage === 'decode' && s.action === 'read-digit')[k + 1], 'stopped-early', 'high');
    }
    return wrong(steps.find(s => s.stage === 'decode' && s.action === 'read-digit'), 'digit-mismatch', 'low');
  }
  const reverse = text => [...text].reverse().join('');
  if (user.digits === reverse(expected.digits)) return wrong(steps.find(s => s.action === 'reverse-remainders'), 'reversed', 'high');
  // Compare from the right: the first remainder is the rightmost digit.
  const mine = reverse(user.digits), want = reverse(expected.digits);
  let m = 0;
  while (m < mine.length && m < want.length && mine[m] === want[m]) m++;
  if (m >= want.length) return wrong(steps.filter(s => s.action === 'continue-with-quotient').at(-1), 'extra-digits', 'medium');
  if (m >= mine.length) return wrong(nth('divide', m), 'stopped-early', 'medium');
  return wrong(nth('record-remainder', m), 'remainder-mismatch', 'high');
}

export function checkPractice(body) {
  requireObject(body);
  const { operation, input, answer, reveal } = body;
  if (!PRACTICE_OPERATIONS.includes(operation)) {
    throw new InputError(`operation must be one of: ${PRACTICE_OPERATIONS.join(', ')}.`, 'operation');
  }
  if (reveal !== undefined && typeof reveal !== 'boolean') throw new InputError('reveal must be true or false.', 'reveal');
  if (input === undefined) throw new InputError('input is required.', 'input');
  const outcome = operation === 'convert' ? checkConvert(input, answer) : checkMatrix(operation, input, answer);
  const { expected, ...rest } = outcome;
  return { success: true, schemaVersion: '1.0', ...rest, ...(reveal === true ? { expected } : {}) };
}
