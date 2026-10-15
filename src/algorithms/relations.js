import { InputError, requireObject, trace, finish } from '../common.js';
import { parseSet, isElement, key, show, fmt } from './sets.js';

const MAX_ELEMENTS = 8, MAX_PAIRS = 64;
export const RELATION_OPERATIONS = ['analyze', 'relation', 'matrix', 'directed-graph'];

const pk = (a, b) => JSON.stringify([a, b]);
const fp = ([a, b]) => `(${show(a)}, ${show(b)})`;
const fps = pairs => (pairs.length ? `{${pairs.map(fp).join(', ')}}` : '{ }');

function parseRelation(value, name, { domain, notes = [] } = {}) {
  if (value === undefined) throw new InputError(`${name} is required.`, name);
  if (!Array.isArray(value)) throw new InputError(`${name} must be an array of pairs, for example [[1, 2], [2, 3]].`, name);
  if (value.length > MAX_PAIRS) throw new InputError(`${name} can have at most ${MAX_PAIRS} pairs here.`, name);
  const inDomain = new Set(domain.map(key)), seen = new Set(), out = [];
  value.forEach((pair, index) => {
    if (!Array.isArray(pair) || pair.length !== 2 || !isElement(pair[0]) || !isElement(pair[1])) {
      throw new InputError(`${name}[${index}] must be a pair [a, b] of numbers or short texts.`, name);
    }
    const clean = pair.map(element => element === 0 ? 0 : element);
    if (!inDomain.has(key(clean[0])) || !inDomain.has(key(clean[1]))) {
      throw new InputError(`${name}[${index}] = ${fp(clean)} uses an element that is not in the set A.`, name);
    }
    const pairKey = pk(...clean);
    if (!seen.has(pairKey)) {
      seen.add(pairKey);
      out.push(clean);
    }
  });
  if (out.length < value.length) notes.push(`${name} contained repeated pairs. A relation is a set of pairs, so each was kept once.`);
  return out;
}

const FORMULA = {
  reflexive: 'reflexive: (a, a) ∈ R for every a ∈ A',
  symmetric: 'symmetric: (a, b) ∈ R implies (b, a) ∈ R',
  antisymmetric: 'antisymmetric: (a, b) ∈ R and (b, a) ∈ R imply a = b',
  transitive: 'transitive: (a, b) ∈ R and (b, c) ∈ R imply (a, c) ∈ R'
};

function conclude(t, property, holds, counterexamples, text) {
  t.add('calculate', 'property-result', `${holds ? 'R is' : 'R is not'} ${property}`, text, FORMULA[property], [FORMULA[property]],
    { property, holds, counterexamples });
  return { holds, counterexamples };
}

const CHECKS = {
  reflexive(t, A, R, has) {
    const missing = [];
    A.forEach(a => {
      const found = has(a, a);
      if (!found) missing.push([a, a]);
      t.add('calculate', 'check-pair', `Is ${fp([a, a])} in R?`, found ? `Yes, ${fp([a, a])} is in R.` : `No, ${fp([a, a])} is not in R, so R is not reflexive.`,
        FORMULA.reflexive, ['Every element must be related to itself.'], { pair: [a, a], found, missing }, [{ pair: [a, a] }]);
    });
    return conclude(t, 'reflexive', missing.length === 0, missing, missing.length ? `These pairs are missing: ${fps(missing)}.` : 'Every element is related to itself.');
  },
  symmetric(t, A, R, has) {
    const missing = [];
    R.forEach(([a, b]) => {
      const found = has(b, a);
      if (!found) missing.push([b, a]);
      t.add('calculate', 'check-pair', `Is the mirror of ${fp([a, b])} in R?`,
        a === b ? `${fp([a, b])} is its own mirror image, so it is fine.` : found ? `Yes, ${fp([b, a])} is in R.` : `No, ${fp([b, a])} is not in R, so R is not symmetric.`,
        FORMULA.symmetric, ['Look for the pair with its two parts swapped.'], { pair: [a, b], mirror: [b, a], found, missing }, [{ pair: [a, b] }]);
    });
    return conclude(t, 'symmetric', missing.length === 0, missing, missing.length ? `These mirror pairs are missing: ${fps(missing)}.` : 'Every pair has its mirror pair in R.');
  },
  antisymmetric(t, A, R, has) {
    const violations = [], reported = new Set();
    R.forEach(([a, b]) => {
      const violation = key(a) !== key(b) && has(b, a);
      if (violation && !reported.has(pk(a, b))) {
        reported.add(pk(b, a));
        violations.push([a, b]);
      }
      t.add('calculate', 'check-pair', `Check ${fp([a, b])} for antisymmetry`,
        key(a) === key(b) ? `Here the two parts are equal, so ${fp([a, b])} cannot break antisymmetry.`
          : violation ? `Both ${fp([a, b])} and ${fp([b, a])} are in R but ${show(a)} ≠ ${show(b)}, so R is not antisymmetric.`
          : `${fp([b, a])} is not in R, so there is no problem.`,
        FORMULA.antisymmetric, ['Only pairs with two different parts can break antisymmetry.'], { pair: [a, b], violation, violations }, [{ pair: [a, b] }]);
    });
    return conclude(t, 'antisymmetric', violations.length === 0, violations, violations.length ? `These pairs go both ways between different elements: ${fps(violations)}.` : 'No two different elements are related in both directions.');
  },
  transitive(t, A, R, has) {
    const missing = [], seen = new Set();
    let chains = 0;
    for (const [a, b] of R) for (const [middle, c] of R) {
      if (key(b) !== key(middle)) continue;
      chains++;
      const found = has(a, c);
      if (!found && !seen.has(pk(a, c))) {
        seen.add(pk(a, c));
        missing.push([a, c]);
      }
      t.add('calculate', 'check-pair', `Chain ${fp([a, b])} and ${fp([b, c])}`,
        found ? `${fp([a, c])} is in R, so this chain is fine.` : `${fp([a, c])} is not in R, so R is not transitive.`,
        FORMULA.transitive, ['Look for pairs where the second part of one equals the first part of the next.'], { chain: [[a, b], [b, c]], needed: [a, c], found, missing }, [{ pair: [a, b] }, { pair: [b, c] }]);
    }
    if (!chains) t.add('calculate', 'check-pair', 'Look for chains', 'No two pairs link up, so there is nothing to check and the condition holds trivially.',
      FORMULA.transitive, ['A condition with no cases to check is true.'], { chains: 0, missing });
    return conclude(t, 'transitive', missing.length === 0, missing, missing.length ? `These shortcut pairs are missing: ${fps(missing)}.` : 'Every chain has its shortcut pair in R.');
  }
};

const COMPACT_ACTIONS = new Set(['read-relation', 'check-input', 'start-result', 'property-result', 'store-cell', 'add-pair', 'complete-result']);

export function calculateRelation(operation, body, { detail = 'full' } = {}) {
  requireObject(body);
  if (!RELATION_OPERATIONS.includes(operation)) throw new InputError('Unknown relation operation.', 'operation');
  const notes = [];
  const A = parseSet(body.A, 'A', { max: MAX_ELEMENTS, min: 1, notes });
  const R = parseRelation(body.R, 'R', { domain: A, notes });
  const input = { A, R };
  const relationSet = new Set(R.map(pair => pk(...pair)));
  const has = (a, b) => relationSet.has(pk(a, b));
  const t = trace();
  if (detail === 'beginner') t.add('intro', 'before-you-start', 'Before you start: relations',
    'A relation R on a set A is a set of ordered pairs (a, b) with a and b in A. Writing (a, b) ∈ R means "a is related to b". The order matters: (1, 2) is not the same pair as (2, 1).',
    '(a, b) ∈ R means a is related to b', ['Pairs are written as [a, b] in the request data.'], { example: [[1, 2], [1, 3], [2, 3]] });

  const rule = 'A relation is a set of ordered pairs; the order inside each pair matters.';
  t.add('understand', 'read-relation', 'Read the relation',
    `A = ${fmt(A)}. R = ${fps(R)} has ${R.length} pair${R.length === 1 ? '' : 's'}.`,
    'R ⊆ A × A', [rule], { A, R });
  t.add('validate', 'check-input', 'Check the input', `Every pair in R uses only elements of A. ${rule}`, 'R ⊆ A × A', [rule], { valid: true });

  let result, level = 'beginner', keyPoints = [rule];
  const done = (text, formula) => t.add('complete', 'complete-result', 'The result is complete', text, formula, [rule], { result });

  if (operation === 'analyze' || operation === 'relation') {
    level = 'intermediate';
    const checks = Object.fromEntries(Object.entries(CHECKS).map(([property, check]) => [property, check(t, A, R, has)]));
    const properties = Object.fromEntries(Object.entries(checks).map(([property, check]) => [property, check.holds]));
    const counterexamples = Object.fromEntries(Object.entries(checks).map(([property, check]) => [property, check.counterexamples]));
    properties.irreflexive = !R.some(([a, b]) => key(a) === key(b));
    properties.equivalence = properties.reflexive && properties.symmetric && properties.transitive;
    properties.partialOrder = properties.reflexive && properties.antisymmetric && properties.transitive;
    result = { properties, counterexamples };
    done(`reflexive: ${properties.reflexive}, symmetric: ${properties.symmetric}, antisymmetric: ${properties.antisymmetric}, transitive: ${properties.transitive}. Equivalence relation: ${properties.equivalence}. Partial order: ${properties.partialOrder}.`,
      'equivalence = reflexive + symmetric + transitive; partial order = reflexive + antisymmetric + transitive');
    keyPoints = Object.values(FORMULA);
  } else if (operation === 'matrix') {
    const matrix = A.map(() => A.map(() => null));
    t.add('prepare', 'start-result', 'Prepare the relation matrix', `Create a ${A.length} x ${A.length} grid. Rows and columns follow the order of A: ${fmt(A)}. A cell is 1 if (row element, column element) is in R, otherwise 0.`,
      'M[i][j] = 1 if (A[i], A[j]) ∈ R, else 0', [rule], { elements: A, result: matrix });
    A.forEach((a, i) => A.forEach((b, j) => {
      matrix[i][j] = has(a, b) ? 1 : 0;
      t.add('calculate', 'store-cell', `Fill row ${i + 1}, column ${j + 1}`, `${fp([a, b])} ${matrix[i][j] ? 'is' : 'is not'} in R, so write ${matrix[i][j]}.`,
        'M[i][j] = 1 if (A[i], A[j]) ∈ R, else 0', ['Row = first part of the pair, column = second part.'], { elements: A, result: matrix }, [{ matrix: 'M', row: i, column: j }]);
    }));
    result = { elements: A, matrix };
    done('Every cell is filled. The matrix is shown in state.result.', 'M[i][j] = 1 if (A[i], A[j]) ∈ R, else 0');
  } else {
    const edges = [];
    t.add('prepare', 'start-result', 'Prepare the directed graph', `Create one vertex for each element of A: ${fmt(A)}. Each ordered pair in R becomes a directed edge.`,
      'a → b for every (a, b) ∈ R', [rule], { nodes: A, result: edges });
    R.forEach(([a, b], index) => {
      const edge = { from: a, to: b };
      edges.push(edge);
      t.add('calculate', 'add-pair', `Add directed edge ${show(a)} → ${show(b)}`, `The pair ${fp([a, b])} means there is a directed edge from ${show(a)} to ${show(b)}.`,
        'a → b for every (a, b) ∈ R', [rule], { edge, nodes: A, result: edges }, [{ pair: [a, b], index }]);
    });
    result = { nodes: A, edges };
    done(`The graph has ${A.length} vertices and ${edges.length} directed edges.`, 'a → b for every (a, b) ∈ R');
  }

  if (detail === 'compact') t.compact(step => COMPACT_ACTIONS.has(step.action));
  return finish('relations', operation, level, input, result, t, keyPoints, { detail, notes });
}
