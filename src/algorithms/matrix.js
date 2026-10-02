import { InputError, requireObject, trace, finish } from '../common.js';

const MAX_SIZE = 8;
const MAX_VALUE = 1_000_000;
const matrixCopy = m => m.map(row => row.map(x => (x === 0 ? 0 : x))); // also turns -0 into 0
function matrix(value, name) {
  if (value === undefined) throw new InputError(`${name} is required.`, name);
  if (!Array.isArray(value)) throw new InputError(`${name} must be an array of rows, for example [[1, 2], [3, 4]].`, name);
  if (value.length < 1 || value.length > MAX_SIZE) {
    throw new InputError(`${name} must have 1 to ${MAX_SIZE} rows.`, name);
  }
  if (!Array.isArray(value[0])) throw new InputError(`${name} must be an array of rows; row 1 is not an array.`, name);
  const width = value[0].length;
  if (width < 1 || width > MAX_SIZE) throw new InputError(`${name} must have 1 to ${MAX_SIZE} columns.`, name);
  value.forEach((row, i) => {
    if (!Array.isArray(row)) throw new InputError(`${name} must be an array of rows; row ${i + 1} is not an array.`, name);
    if (row.length !== width) throw new InputError(`${name} must be rectangular; row ${i + 1} has the wrong length.`, name);
    row.forEach((x, j) => {
      if (typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > MAX_VALUE) {
        throw new InputError(`${name}[${i}][${j}] must be a finite number with absolute value at most ${MAX_VALUE}.`, name);
      }
    });
  });
  return matrixCopy(value);
}
// Every computed value passes through here. It cleans binary floating-point noise
// (0.1 + 0.2 -> 0.3), turns -0 into 0, and refuses results that cannot be shown accurately.
function checked(value) {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    throw new InputError('The calculation produces numbers too large to show exactly. Use smaller entries.', 'A', { code: 'RESULT_TOO_LARGE', status: 422 });
  }
  const clean = Number.isInteger(value) ? value : Number(value.toPrecision(15));
  return clean === 0 ? 0 : clean;
}
const dims = m => `${m.length} x ${m[0].length}`;
const point = (matrix, row, column) => ({ matrix, row, column });
export function calculateMatrix(operation, body) {
  requireObject(body);
  const allowed = ['add', 'subtract', 'transpose', 'multiply', 'determinant'];
  if (!allowed.includes(operation)) throw new InputError('Unknown matrix operation.', 'operation');
  const A = matrix(body.A, 'A');
  const unary = operation === 'transpose' || operation === 'determinant';
  const B = unary ? undefined : matrix(body.B, 'B');
  const input = unary ? { A } : { A, B };
  const t = trace();
  const r = A.length, c = A[0].length;
  const rules = {
    add: 'The matrices must have the same number of rows and columns.',
    subtract: 'The matrices must have the same number of rows and columns.',
    multiply: 'The number of columns in A must equal the number of rows in B.',
    transpose: 'Each row of A becomes a column of the result.',
    determinant: 'A determinant is defined for a square matrix.'
  };
  if (['add', 'subtract'].includes(operation) && (r !== B.length || c !== B[0].length)) throw new InputError(rules[operation], 'B');
  if (operation === 'multiply' && c !== B.length) throw new InputError(rules.multiply, 'B');
  if (operation === 'determinant' && r !== c) throw new InputError(rules.determinant, 'A');
  if (operation === 'determinant' && r > 4) throw new InputError('For readable cofactor explanations, determinants support at most 4 x 4 matrices.', 'A');
  t.add('understand', 'inspect-dimensions', 'Read the matrix dimensions',
    `A has ${r} rows and ${c} columns${B ? `; B has ${B.length} rows and ${B[0].length} columns` : ''}. A row runs horizontally and a column runs vertically.`,
    'dimensions = number of rows x number of columns', [rules[operation], 'Array indices start at 0; explanation labels start at 1.'],
    { A, ...(B ? { B } : {}) });
  const formula = operation === 'multiply' ? 'C[i][j] = sum(A[i][k] * B[k][j], k = 0..columns(A)-1)'
    : operation === 'transpose' ? 'C[j][i] = A[i][j]'
    : operation === 'determinant' ? 'det(M) = sum((-1)^(1+j) * M[1][j] * det(minor(1,j)), j = 1..n)'
    : `C[i][j] = A[i][j] ${operation === 'add' ? '+' : '-'} B[i][j]`;
  t.add('validate', 'check-rule', 'Check whether the operation is allowed',
    operation === 'multiply' ? `${c} columns in A match ${B.length} rows in B, so multiplication is allowed. The result will have ${r} rows and ${B[0].length} columns.`
      : operation === 'determinant' ? `A has ${r} rows and ${c} columns, so it is square.`
      : operation === 'transpose' ? `Swapping ${r} rows and ${c} columns gives a ${c} x ${r} result.`
      : `Both matrices have dimensions ${dims(A)}, so corresponding entries can be ${operation === 'add' ? 'added' : 'subtracted'}.`,
    formula, [rules[operation]], { valid: true });
  if (operation === 'determinant') {
    const result = determinant(A, t, 'A', 0);
    t.add('complete', 'final-result', 'The determinant is complete', `The determinant of A is ${result}.`, formula,
      ['A determinant is one number, not a matrix.', 'A zero determinant means the square matrix is singular.'], { result });
    return finish('matrix', operation, 'advanced', input, result, t, [rules[operation], 'Uses recursive cofactor expansion along the first row.']);
  }
  const rows = operation === 'transpose' ? c : r;
  const cols = operation === 'transpose' ? r : operation === 'multiply' ? B[0].length : c;
  // null means not calculated yet; it does not mean zero.
  const C = Array.from({ length: rows }, () => Array(cols).fill(null));
  t.add('prepare', 'create-result', 'Prepare the result matrix',
    `Create a ${rows} x ${cols} result matrix. Each null cell has not been calculated yet.`, formula,
    ['Fill one result cell at a time.'], { result: C });
  for (let i = 0; i < r; i++) for (let j = 0; j < (operation === 'multiply' ? cols : c); j++) {
    if (operation === 'multiply') {
      const row = [...A[i]], column = B.map(x => x[j]);
      const terms = []; let sum = 0;
      t.add('calculate', 'select-row-column', `Select row ${i + 1} and column ${j + 1}`,
        `To calculate C at row ${i + 1}, column ${j + 1}, use row ${i + 1} of A (${row.join(', ')}) and column ${j + 1} of B (${column.join(', ')}). Match entries by their position. Start the running sum at 0.`,
        formula, ['Matrix multiplication uses a row from A and a column from B, not entry-by-entry multiplication.'],
        { row, column, runningSum: 0, result: C }, [point('C', i, j)]);
      for (let k = 0; k < c; k++) {
        const product = checked(A[i][k] * B[k][j]); terms.push(product);
        t.add('calculate', 'multiply-pair', `Multiply pair ${k + 1}`,
          `Multiply ${A[i][k]} from A by ${B[k][j]} from B: ${A[i][k]} * ${B[k][j]} = ${product}.`,
          `product = A[${i}][${k}] * B[${k}][${j}]`, ['Only matching positions in the selected row and column are paired.'],
          { product, terms, runningSum: sum, result: C }, [point('A', i, k), point('B', k, j)]);
        const previous = sum; sum = checked(sum + product);
        t.add('calculate', 'add-product', `Add product ${k + 1} to the running sum`,
          `The previous sum is ${previous}. Add the product ${product}: ${previous} + ${product} = ${sum}.`,
          'newSum = previousSum + product', ['Include every product before storing this result cell.'],
          { previousSum: previous, product, runningSum: sum, terms, result: C });
      }
      C[i][j] = sum;
      t.add('calculate', 'store-cell', `Store C at row ${i + 1}, column ${j + 1}`,
        `All ${c} pairs have been multiplied and added. Store ${sum} in this cell.`, formula,
        ['Do not move to the next cell until the current row-column calculation is complete.'], { result: C }, [point('C', i, j)]);
    } else if (operation === 'transpose') {
      t.add('calculate', 'select-entry', `Read A at row ${i + 1}, column ${j + 1}`,
        `This entry is ${A[i][j]}. Swap its row and column positions.`, formula,
        ['Transposing moves entries; it does not change their values.'], { value: A[i][j], result: C }, [point('A', i, j)]);
      C[j][i] = A[i][j];
      t.add('calculate', 'store-cell', `Write C at row ${j + 1}, column ${i + 1}`,
        `Write ${A[i][j]} at the swapped position.`, formula, [rules.transpose], { result: C }, [point('C', j, i)]);
    } else {
      const symbol = operation === 'add' ? '+' : '-';
      t.add('calculate', 'select-pair', `Select row ${i + 1}, column ${j + 1}`,
        `Read ${A[i][j]} from A and ${B[i][j]} from B at the same position.`, formula,
        ['Use corresponding entries, not a row-column dot product.'], { left: A[i][j], right: B[i][j], result: C }, [point('A', i, j), point('B', i, j)]);
      const value = checked(operation === 'add' ? A[i][j] + B[i][j] : A[i][j] - B[i][j]);
      t.add('calculate', 'evaluate-pair', `${operation === 'add' ? 'Add' : 'Subtract'} the selected entries`,
        `${A[i][j]} ${symbol} ${B[i][j]} = ${value}.`, formula,
        [operation === 'subtract' ? 'Order matters: subtract B from A.' : 'Add the two values at this position.'], { value, result: C });
      C[i][j] = value;
      t.add('calculate', 'store-cell', `Store C at row ${i + 1}, column ${j + 1}`,
        `Write ${value} in the result at this same position.`, formula, ['The other result cells are unchanged.'], { result: C }, [point('C', i, j)]);
    }
  }
  t.add('complete', 'final-result', 'The result matrix is complete',
    'Every result cell has been calculated. The result matrix is shown in state.result.', formula,
    [rules[operation], 'Review the earlier steps to see how each entry was obtained.'], { result: C });
  return finish('matrix', operation, operation === 'multiply' ? 'intermediate' : 'beginner', input, C, t, [rules[operation]]);
}
function determinant(M, t, label, depth) {
  const n = M.length; let total = 0;
  const rule = 'det(M) = sum(sign * firstRowEntry * minorDeterminant)';
  t.add('calculate', 'start-expansion', `Find det(${label})`,
    `This is a ${n} x ${n} matrix. ${n === 1 ? 'For a 1 x 1 matrix, the only entry is the determinant.' : 'Expand along the first row; calculate each minor before its parent term.'}`,
    n === 1 ? 'det([[a]]) = a' : rule, ['Each recursive call works on a smaller square matrix.'], { matrix: M, label, depth });
  if (n === 1) {
    t.add('calculate', 'base-case', `Return det(${label})`, `The only entry is ${M[0][0]}, so the determinant is ${M[0][0]}.`,
      'det([[a]]) = a', ['This is the base case; no smaller minor is needed.'], { determinant: M[0][0], label, depth });
    return M[0][0];
  }
  for (let j = 0; j < n; j++) {
    const sign = j % 2 === 0 ? 1 : -1;
    t.add('calculate', 'choose-cofactor', `Select column ${j + 1} of ${label}`,
      `The first-row entry is ${M[0][j]}. Its cofactor sign is ${sign} because (-1)^(1 + ${j + 1}) = ${sign}. Signs alternate +, -, +, -.`,
      'sign = (-1)^(rowNumber + columnNumber)', ['Row and column numbers in this sign formula start at 1.'], { entry: M[0][j], sign, label, depth });
    const minor = M.slice(1).map(row => row.filter((_, k) => k !== j));
    const minorLabel = `${label}/minor-${j + 1}`;
    t.add('calculate', 'build-minor', `Build ${minorLabel}`,
      `Remove row 1 and column ${j + 1} from ${label}. The remaining entries form the ${n - 1} x ${n - 1} minor shown in state.minor.`,
      'minor = matrix with the selected row and column removed', ['Preserve the relative order of the remaining entries.'], { minor, label, minorLabel, depth });
    const minorDet = determinant(minor, t, minorLabel, depth + 1);
    const signedEntry = checked(sign * M[0][j]);
    t.add('calculate', 'apply-sign', `Apply the sign for column ${j + 1}`,
      `${sign} * ${M[0][j]} = ${signedEntry}.`, 'signedEntry = sign * firstRowEntry',
      ['Apply the sign before multiplying by the minor determinant.'], { signedEntry, minorDeterminant: minorDet, label, depth });
    const term = checked(signedEntry * minorDet);
    t.add('calculate', 'cofactor-product', `Calculate term ${j + 1} of ${label}`,
      `The minor determinant is ${minorDet}. Multiply it by the signed entry: ${signedEntry} * ${minorDet} = ${term}.`,
      'term = signedEntry * minorDeterminant', ['This term contributes to the determinant of the parent matrix.'], { term, minorDeterminant: minorDet, label, depth });
    const previous = total; total = checked(total + term);
    t.add('calculate', 'accumulate-term', `Add term ${j + 1} of ${label}`,
      `Start from ${previous} and add ${term}: ${previous} + ${term} = ${total}.`, 'newTotal = previousTotal + term',
      ['Calculate all first-row terms, including terms whose entry is zero.'], { previousTotal: previous, term, runningTotal: total, label, depth });
  }
  t.add('calculate', 'return-determinant', `Return det(${label})`, `All ${n} terms are included; det(${label}) = ${total}.`,
    rule, ['Return this value to the parent calculation, or use it as the final determinant.'], { determinant: total, label, depth });
  return total;
                                 }
