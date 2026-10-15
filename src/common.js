export class InputError extends Error {
  constructor(message, field, { code = 'INVALID_INPUT', status = 400 } = {}) {
    super(message);
    this.field = field;
    this.code = code;
    this.status = status;
  }
}
export function requireObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new InputError('Send a JSON object as the request body.', 'body');
  }
}

export const DETAIL_LEVELS = ['full', 'compact', 'beginner'];
// Reads the optional ?detail= query value. Missing means "full". Anything else unknown is a 400.
export function parseDetail(value) {
  if (value === undefined) return 'full';
  if (typeof value !== 'string' || !DETAIL_LEVELS.includes(value)) {
    throw new InputError(`detail must be one of: ${DETAIL_LEVELS.join(', ')}.`, 'detail');
  }
  return value;
}

// One sentence per step action that explains why the step exists. Added to every step's keyPoints.
const WHY = {
  'inspect-dimensions': 'Why: the sizes decide which operations are allowed and how big the result is.',
  'check-rule': 'Why: an operation on the wrong sizes has no answer, so we check first.',
  'create-result': 'Why: an empty result grid lets us fill in one cell at a time and keep track of progress.',
  'select-row-column': 'Why: each result cell depends on exactly one row of A and one column of B.',
  'multiply-pair': 'Why: matching entries are multiplied first because a cell is a sum of such products.',
  'add-product': 'Why: the cell value is the sum of all the products, so each one is added in turn.',
  'store-cell': 'Why: the finished value belongs in its own position in the result.',
  'select-entry': 'Why: transposing is done entry by entry, so we look at one entry at a time.',
  'select-pair': 'Why: add and subtract only combine entries that sit in the same position.',
  'evaluate-pair': 'Why: this is the actual arithmetic for this position.',
  'final-result': 'Why: every cell is done, so the result can be read as a whole.',
  'start-expansion': 'Why: a big determinant is broken into smaller ones that are easier to calculate.',
  'base-case': 'Why: a 1 x 1 matrix cannot be split further, so its entry is the answer.',
  'choose-cofactor': 'Why: the first row gives one term per column, and the sign alternates.',
  'build-minor': 'Why: the minor is the smaller matrix that the next determinant is taken of.',
  'apply-sign': 'Why: the cofactor sign must be applied before the term is added to the total.',
  'cofactor-product': 'Why: each term is the signed entry times the determinant of its minor.',
  'accumulate-term': 'Why: the determinant is the sum of all the terms.',
  'return-determinant': 'Why: the parent calculation needs this value for its own term.',
  'validate-digits': 'Why: a digit that is too big for the base makes the number invalid.',
  'start-positional-expansion': 'Why: place value is how any written number gets its value.',
  'read-digit': 'Why: each digit is worth its value times the place it sits in.',
  'calculate-place-value': 'Why: the place value says how much one unit of this digit is worth.',
  'calculate-contribution': 'Why: the digit value times the place value is this digit\'s share of the total.',
  'add-contribution': 'Why: the number is the sum of the shares of all its digits.',
  'finish-positional-expansion': 'Why: with every digit included, the total is the number\'s value.',
  'decimal-output': 'Why: place-value expansion already produces a decimal number, so no division is needed.',
  'zero-case': 'Why: repeated division never starts for 0, so it is handled directly.',
  'start-division': 'Why: dividing by the target base peels off one output digit at a time.',
  'divide': 'Why: the quotient is what is left to convert after taking off one digit.',
  'quotient-product': 'Why: subtracting the covered amount leaves the remainder, which is the digit.',
  'record-remainder': 'Why: each remainder is one digit of the answer, starting from the smallest place.',
  'continue-with-quotient': 'Why: the next digit comes from dividing the quotient, not the remainder.',
  'reverse-remainders': 'Why: the first remainder is the smallest place, so the digits are read backwards.',
  'restore-sign': 'Why: the sign was set aside at the start and is put back at the end.',
  'compare-values': 'Why: converting back and getting the same value proves the conversion is right.',
  'before-you-start': 'Why: these few ideas make every later step easier to follow.',
  'read-sets': 'Why: knowing the exact elements and sizes is the starting point of every set operation.',
  'read-relation': 'Why: a relation is just a set of ordered pairs, so we first list them.',
  'check-input': 'Why: the operation is only defined when the input follows the rules, so we check first.',
  'start-result': 'Why: we build the answer one piece at a time, starting from nothing.',
  'select-element': 'Why: each element is tested on its own so no element is forgotten.',
  'add-element': 'Why: this element passes the test, so it belongs in the result.',
  'skip-element': 'Why: this element fails the test, so it stays out (or is a repeat).',
  'record-missing': 'Why: one such element is enough to show the property fails.',
  'confirm-element': 'Why: every element must pass, so each one is confirmed in turn.',
  'count-element': 'Why: the size of a set is found by counting each distinct element once.',
  'double-subsets': 'Why: each new element is either left out or put into every earlier subset, which doubles the count.',
  'add-pair': 'Why: this pair belongs in the answer, so it is written down.',
  'skip-duplicate': 'Why: a set has no repeats, so a pair that is already there is not added again.',
  'skip-pair': 'Why: nothing needs to be added here because the pair is already present.',
  'check-pair': 'Why: a property is true only if it holds for every pair, so each pair is checked.',
  'property-result': 'Why: after every check we can say whether the property holds.',
  'invert-pair': 'Why: the inverse swaps the two parts of every pair.',
  'select-intermediate': 'Why: Warshall\'s method allows one more element at a time as a stepping stone between two others.',
  'build-class': 'Why: an equivalence class collects everything related to one element.',
  'complete-result': 'Why: every element has been handled, so the result is final.'
};

// Machine indices are 0-based, learner text is 1-based. Only concrete references like A[0][2]
// and the "k = 0..columns(A)-1" range change; the original formula stays as it was.
export function displayFormula(formula) {
  return formula
    .replace(/\b([ABC])((?:\[\d+\])+)/g, (_, m, idx) => m + idx.replace(/\d+/g, n => Number(n) + 1))
    .replace('k = 0..columns(A)-1', 'k = 1..columns(A)');
}

export function trace() {
  const steps = [];
  return {
    steps,
    add(stage, action, title, explanation, formula, keyPoints, state = {}, highlights = []) {
      const step = {
        id: steps.length + 1, stage, action, title, explanation, formula, keyPoints: WHY[action] ? [...keyPoints, WHY[action]] : keyPoints,
        state: structuredClone(state), highlights: structuredClone(highlights)
      };
      const display = displayFormula(formula);
      if (display !== formula) step.displayFormula = display;
      steps.push(step);
    },
    // Compact mode: keep only the actions in `keep` and renumber ids so they stay sequential.
    compact(keep) {
      const kept = steps.filter(step => keep(step));
      steps.length = 0;
      kept.forEach((step, index) => { step.id = index + 1; steps.push(step); });
    }
  };
}
export function finish(module, operation, level, input, result, t, keyPoints, { detail = 'full', notes = [] } = {}) {
  const summary = { totalSteps: t.steps.length, keyPoints };
  if (detail !== 'full') summary.detail = detail;
  if (notes.length) summary.notes = notes;
  return { success: true, schemaVersion: '1.0', module, operation, detail, level, input, result, steps: t.steps, summary };
}
