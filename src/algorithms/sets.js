import { InputError, requireObject, trace, finish } from '../common.js';

const MAX_SET = 20, MAX_POWER = 8, MAX_PRODUCT = 10, MAX_TEXT = 20, MAX_NUMBER = 1_000_000;
export const SET_OPERATIONS = ['union', 'intersection', 'difference', 'symmetric-difference', 'power-set', 'cartesian-product'];

export const key = x => JSON.stringify(x); // 1 and "1" are different elements
// Quote text values in learner-facing output so 1 and "1" stay distinguishable.
export const show = x => (typeof x === 'string' ? JSON.stringify(x) : String(x));
export const fmt = list => `{${list.map(show).join(', ')}}`;
const fmtSubsets = list => `{${list.map(s => fmt(s)).join(', ')}}`;

export const isElement = x =>
  (typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= MAX_NUMBER) ||
  (typeof x === 'string' && x.length >= 1 && x.length <= MAX_TEXT);

// Validates a set given as an array. Duplicates are removed (a set has no repeats) and reported in notes.
export function parseSet(value, name, { max = MAX_SET, min = 0, notes = [] } = {}) {
  if (value === undefined) throw new InputError(`${name} is required.`, name);
  if (!Array.isArray(value)) throw new InputError(`${name} must be an array of elements, for example [1, 2, 3] or ["a", "b"].`, name);
  if (value.length > max) throw new InputError(`${name} can have at most ${max} elements here.`, name);
  const seen = new Set(), out = [];
  value.forEach((x, i) => {
    if (!isElement(x)) throw new InputError(`${name}[${i}] must be a finite number (absolute value at most ${MAX_NUMBER}) or a text of 1 to ${MAX_TEXT} characters.`, name);
    const clean = x === 0 ? 0 : x;
    if (!seen.has(key(clean))) { seen.add(key(clean)); out.push(clean); }
  });
  if (out.length < min) throw new InputError(`${name} must have at least ${min} element${min > 1 ? 's' : ''}.`, name);
  if (out.length < value.length) notes.push(`${name} contained repeated elements. A set has no repeats, so each was kept once.`);
  return out;
}

const FORMULA = {
  union: 'A ∪ B = { x | x ∈ A or x ∈ B }',
  intersection: 'A ∩ B = { x | x ∈ A and x ∈ B }',
  difference: 'A − B = { x | x ∈ A and x ∉ B }',
  'symmetric-difference': 'A Δ B = (A − B) ∪ (B − A)',
  'power-set': 'P(A) = { S | S ⊆ A }, |P(A)| = 2^|A|',
  'cartesian-product': 'A × B = { (a, b) | a ∈ A and b ∈ B }, |A × B| = |A| · |B|'
};
const RULE = {
  union: 'Every element of A or B appears once in the union.',
  intersection: 'Only elements that are in both sets are kept.',
  difference: 'Order matters: A − B is not the same as B − A.',
  'symmetric-difference': 'Keep elements that are in exactly one of the two sets.',
  'power-set': 'The empty set and the set itself are always in the power set.',
  'cartesian-product': 'Order matters: (a, b) is not the same as (b, a).'
};
// ?detail=compact keeps setup, one step per decision and the final result.
const COMPACT_ACTIONS = new Set(['read-sets', 'check-input', 'start-result', 'add-element', 'skip-element', 'double-subsets', 'add-pair', 'complete-result']);

// One "look at the element" step and one "decide" step per element of `list`.
function walk(t, ctx, name, list, decide) {
  list.forEach((e, i) => {
    const hl = [{ set: name, index: i }];
    t.add('calculate', 'select-element', `Look at ${show(e)} from ${name}`, `Take element ${i + 1} of ${name}: ${show(e)}.`,
      ctx.formula, [ctx.rule], { element: e, result: ctx.result }, hl);
    const { take, why } = decide(e);
    if (take) ctx.result.push(e);
    const [action, verb] = take ? ctx.yes : ctx.no;
    t.add('calculate', action, `${verb} ${show(e)}`, why, ctx.formula, [ctx.rule], { element: e, included: take, result: ctx.result }, hl);
  });
}
const ADD = ['add-element', 'Add'], SKIP = ['skip-element', 'Skip'];

export function calculateSets(operation, body, { detail = 'full' } = {}) {
  requireObject(body);
  if (!SET_OPERATIONS.includes(operation)) throw new InputError('Unknown set operation.', 'operation');
  const notes = [];
  const unary = operation === 'power-set';
  const A = parseSet(body.A, 'A', { notes });
  const B = unary ? undefined : parseSet(body.B, 'B', { notes });
  if (operation === 'power-set' && A.length > MAX_POWER) throw new InputError(`For readable steps, the power set supports at most ${MAX_POWER} elements (${2 ** MAX_POWER} subsets).`, 'A');
  if (operation === 'cartesian-product') {
    if (A.length > MAX_PRODUCT) throw new InputError(`A can have at most ${MAX_PRODUCT} elements for a Cartesian product.`, 'A');
    if (B.length > MAX_PRODUCT) throw new InputError(`B can have at most ${MAX_PRODUCT} elements for a Cartesian product.`, 'B');
  }
  const inA = new Set(A.map(key)), inB = new Set((B ?? []).map(key));
  const input = { A, ...(B ? { B } : {}) };
  const formula = FORMULA[operation], rule = RULE[operation];
  const t = trace();
  if (detail === 'beginner') t.add('intro', 'before-you-start', 'Before you start: sets',
    'A set is a collection of distinct elements. Order does not matter and repeats are ignored, so {1, 2, 2, 3} is the same set as {3, 2, 1}. We write x ∈ A to say x is in A, and x ∉ A to say it is not. The empty set { } has no elements.',
    'x ∈ A means x is an element of A', ['Elements here are numbers or short texts; the number 1 and the text "1" are different elements.'], { example: [1, 2, 3] });
  t.add('understand', 'read-sets', 'Read the sets',
    `A = ${fmt(A)} has ${A.length} element${A.length === 1 ? '' : 's'}${B ? `; B = ${fmt(B)} has ${B.length}` : ''}.`,
    formula, [rule], { A, ...(B ? { B } : {}) });
  t.add('validate', 'check-input', 'Check the input',
    `The input is valid. ${rule}`,
    formula, [rule], { valid: true });

  let result, level = 'beginner';
  const ctx = { formula, rule, result: [], yes: ADD, no: SKIP };
  const start = text => t.add('prepare', 'start-result', 'Start with an empty result', text, formula, [rule], { result: ctx.result });

  if (operation === 'union') {
    start('Begin with the empty set. Add every element of A, then every element of B that is not already there.');
    walk(t, ctx, 'A', A, e => ({ take: true, why: `${show(e)} is not in the result yet, so add it.` }));
    walk(t, ctx, 'B', B, e => inA.has(key(e))
      ? { take: false, why: `${show(e)} is already in the result because it is also in A. A set has no repeats, so skip it.` }
      : { take: true, why: `${show(e)} is not in the result yet, so add it.` });
    result = ctx.result;
  } else if (operation === 'intersection' || operation === 'difference') {
    const wantIn = operation === 'intersection';
    start(`Begin with the empty set. Check each element of A against B.`);
    walk(t, ctx, 'A', A, e => {
      const found = inB.has(key(e));
      return found === wantIn
        ? { take: true, why: `${show(e)} is ${found ? 'in B as well' : 'not in B'}, so it belongs in the result.` }
        : { take: false, why: `${show(e)} is ${found ? 'in B' : 'not in B'}, so it does not belong in the result.` };
    });
    result = ctx.result;
  } else if (operation === 'symmetric-difference') {
    start('Begin with the empty set. Keep elements of A that are not in B, then elements of B that are not in A.');
    const decide = (other, label, otherLabel) => e => other.has(key(e))
      ? { take: false, why: `${show(e)} is also in ${otherLabel}, so it is in both sets and is skipped.` }
      : { take: true, why: `${show(e)} is only in ${label}, so add it.` };
    walk(t, ctx, 'A', A, decide(inB, 'A', 'B'));
    walk(t, ctx, 'B', B, decide(inA, 'B', 'A'));
    result = ctx.result;
  } else if (operation === 'power-set') {
    level = 'intermediate';
    let subsets = [[]];
    t.add('prepare', 'start-result', 'Start with the empty subset', 'The empty set is a subset of every set, so the power set always contains it.', formula, [rule], { result: subsets });
    A.forEach((e, i) => {
      const added = subsets.map(s => [...s, e]), before = subsets.length;
      subsets = [...subsets, ...added];
      t.add('calculate', 'double-subsets', `Include ${show(e)}`,
        `Copy every subset found so far and add ${show(e)} to each copy: ${fmtSubsets(added)}. The number of subsets doubles from ${before} to ${subsets.length}.`,
        formula, [rule, `With ${i + 1} element${i ? 's' : ''} considered there are 2^${i + 1} = ${subsets.length} subsets.`], { element: e, newSubsets: added, result: subsets }, [{ set: 'A', index: i }]);
    });
    result = subsets;
  } else { // cartesian-product
    level = 'intermediate';
    const pairs = [];
    t.add('prepare', 'start-result', 'Start with an empty list of pairs', `The result will have ${A.length} * ${B.length} = ${A.length * B.length} ordered pairs.`, formula, [rule], { result: pairs });
    A.forEach((a, i) => B.forEach((b, j) => {
      pairs.push([a, b]);
      t.add('calculate', 'add-pair', `Pair ${show(a)} with ${show(b)}`, `Take ${show(a)} from A and ${show(b)} from B and write the ordered pair (${show(a)}, ${show(b)}).`,
        formula, [rule], { pair: [a, b], result: pairs }, [{ set: 'A', index: i }, { set: 'B', index: j }]);
    }));
    result = pairs;
  }
  const shown = operation === 'power-set' ? `P(A) has ${result.length} subsets: ${fmtSubsets(result)}.`
    : operation === 'cartesian-product' ? `A × B has ${result.length} pairs.`
    : `The result is ${fmt(result)}.`;
  t.add('complete', 'complete-result', 'The result is complete', shown, formula, [rule], { result });
  if (detail === 'compact') t.compact(step => COMPACT_ACTIONS.has(step.action));
  return finish('sets', operation, level, input, result, t, [rule], { detail, notes });
}
