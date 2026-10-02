import { InputError, requireObject, trace, finish } from '../common.js';
const DIGITS = '0123456789ABCDEF';
const BASES = [2, 8, 10, 16];
function expand(digits, base, t, stage, label) {
  let total = 0n;
  const b = BigInt(base);
  const formula = 'decimalValue = sum(digitValue * base^position), positions counted from the right starting at 0';
  t.add(stage, 'start-positional-expansion', `Read ${label} by place value`,
    `Start the total at 0. The rightmost digit has position 0. Moving one place left increases the position by 1. For base ${base}, each place is ${base} times the place to its right.`,
    formula, ['A digit symbol and its numeric value can differ: A=10, B=11, C=12, D=13, E=14, F=15.'], { digits, base, runningTotal: '0' });
  for (let index = 0; index < digits.length; index++) {
    const symbol = digits[index], value = DIGITS.indexOf(symbol), position = digits.length - 1 - index;
    t.add(stage, 'read-digit', `Read digit ${index + 1} of ${label}`,
      `The symbol ${symbol} has value ${value}. It is at position ${position}, counting from the right starting at 0.`,
      'position = number of digits to the right', ['The leftmost digit is processed first here; place positions still count from the right.'],
      { index, symbol, digitValue: value, position, runningTotal: total.toString() }, [{ digitIndex: index }]);
    // Compute powers without a mathematical library.
    let place = 1n;
    for (let p = 1; p <= position; p++) place *= b;
    t.add(stage, 'calculate-place-value', `Calculate place value for position ${position}`,
      position === 0 ? `${base}^0 = 1. Every base to the power 0 is 1.`
        : `${base}^${position} means multiplying ${position} factors of ${base}: ${Array(position).fill(base).join(' * ')} = ${place}.`,
      'placeValue = base^position', ['A power describes a place value, not the digit itself.'], { position, placeValue: place.toString() });
    const contribution = BigInt(value) * place;
    t.add(stage, 'calculate-contribution', `Calculate the contribution of ${symbol}`,
      `${value} * ${place} = ${contribution}. This is how much the selected digit contributes to the decimal total.`,
      'contribution = digitValue * placeValue', ['A zero digit contributes 0 but still occupies a place.'], { contribution: contribution.toString(), digitValue: value, placeValue: place.toString() });
    const previous = total; total += contribution;
    t.add(stage, 'add-contribution', `Add digit ${index + 1} to the total`,
      `${previous} + ${contribution} = ${total}.`, 'newTotal = previousTotal + contribution',
      ['Include every digit, even a zero.'], { previousTotal: previous.toString(), contribution: contribution.toString(), runningTotal: total.toString() });
  }
  t.add(stage, 'finish-positional-expansion', `Finish reading ${label}`,
    `Every digit has been included. The decimal magnitude is ${total}.`, formula,
    ['Magnitude means the value without its sign.'], { decimalMagnitude: total.toString() });
  return total;
}
export function convertNumber(body) {
  requireObject(body);
  const { number, fromBase, toBase } = body;
  if (!BASES.includes(fromBase)) throw new InputError('fromBase must be the number 2, 8, 10 or 16.', 'fromBase');
  if (!BASES.includes(toBase)) throw new InputError('toBase must be the number 2, 8, 10 or 16.', 'toBase');
  if (typeof number !== 'string' || number.length < 1 || number.length > 65) throw new InputError('number must be a string containing 1 to 64 digits and an optional leading minus sign.', 'number');
  const upper = number.toUpperCase();
  const negative = upper.startsWith('-');
  const rawDigits = negative ? upper.slice(1) : upper;
  if (!rawDigits || rawDigits.length > 64 || [...rawDigits].some(x => DIGITS.indexOf(x) < 0 || DIGITS.indexOf(x) >= fromBase)) {
    throw new InputError(`number contains an invalid base-${fromBase} digit. Use digits only, with an optional leading minus sign; do not use prefixes, spaces, fractions or exponent notation.`, 'number');
  }
  const digits = rawDigits.replace(/^0+(?=.)/, '');
  const t = trace();
  t.add('understand', 'validate-digits', 'Check the input and bases',
    `${number} is valid in base ${fromBase}. Each digit must be between 0 and ${fromBase - 1}. We will convert its magnitude first, then restore a negative sign if needed.`,
    '0 <= digitValue < sourceBase', ['This endpoint converts signed integers, not fractions or two\'s-complement bit patterns.', 'Exact integer arithmetic is used, even beyond JavaScript\'s safe-number range.'],
    { original: number, digits, negative, fromBase, toBase });
  const magnitude = expand(digits, fromBase, t, 'decode', 'the input');
  let outputDigits;
  const rule = 'value = quotient * targetBase + remainder; 0 <= remainder < targetBase';
  if (toBase === 10) {
    outputDigits = magnitude.toString();
    t.add('encode', 'decimal-output', 'Use the decimal magnitude',
      `The target base is 10, so the place-value total ${magnitude} is already the required decimal magnitude.`,
      'decimalOutput = decodedDecimalMagnitude', ['There is no repeated division needed when the target is decimal.'], { outputDigits });
  } else if (magnitude === 0n) {
    outputDigits = '0';
    t.add('encode', 'zero-case', 'Handle zero', 'Zero is written as 0 in every supported base. No divisions are needed.',
      '0 in any base = 0', ['The output is 0, never an empty string or -0.'], { outputDigits });
  } else {
    let current = magnitude; const remainders = [];
    t.add('encode', 'start-division', 'Prepare repeated division',
      `Start with ${current}. Repeatedly divide by ${toBase}. Record the quotient and remainder each time; continue with the quotient until it is 0.`,
      rule, ['The first remainder is the rightmost output digit because it represents the smallest place.'], { currentValue: current.toString(), remainders: [] });
    while (current > 0n) {
      const quotient = current / BigInt(toBase);
      t.add('encode', 'divide', `Divide ${current} by ${toBase}`,
        `${current} divided by ${toBase} has whole-number quotient ${quotient}. Keep this quotient for the next division.`,
        'quotient = floor(currentValue / targetBase)', ['Use a whole-number quotient, not a decimal fraction.'], { currentValue: current.toString(), quotient: quotient.toString(), targetBase: toBase });
      const covered = quotient * BigInt(toBase);
      t.add('encode', 'quotient-product', 'Find the amount covered by the quotient',
        `${quotient} * ${toBase} = ${covered}. Subtract this covered amount from the current value to find what is left over.`,
        'coveredAmount = quotient * targetBase', ['The remainder is the part not covered by whole groups of the target base.'], { coveredAmount: covered.toString() });
      const remainder = current - covered;
      remainders.push(DIGITS[Number(remainder)]);
      t.add('encode', 'record-remainder', `Record remainder ${remainders.length}`,
        `${current} - ${covered} = ${remainder}. The remainder ${remainder} is written as ${DIGITS[Number(remainder)]} in base ${toBase}.`,
        'remainder = currentValue - quotient * targetBase', ['A remainder is always smaller than the target base.', 'These digits are recorded from the smallest place to the largest place.'],
        { remainder: remainder.toString(), digit: DIGITS[Number(remainder)], remainders });
      current = quotient;
      t.add('encode', 'continue-with-quotient', current === 0n ? 'Stop dividing' : 'Continue with the quotient',
        current === 0n ? 'The quotient is 0. There are no higher places left to calculate, so stop.'
          : `Use ${current}, the quotient, as the current value for the next division. Do not divide the remainder.`,
        'nextCurrentValue = quotient', ['Stop only when the quotient reaches 0.'], { currentValue: current.toString(), remainders });
    }
    outputDigits = [...remainders].reverse().join('');
    t.add('encode', 'reverse-remainders', 'Read the remainders from bottom to top',
      `Recorded from first to last, the remainders are ${remainders.join(', ')}. The first belongs on the right, and the last belongs on the left. Read them in reverse order: ${outputDigits}.`,
      'outputDigits = reverse(recordedRemainders)', ['First remainder = smallest place (rightmost digit).', 'Last remainder = largest place (leftmost digit).'],
      { remainders, outputDigits });
  }
  const hasNegativeSign = negative && magnitude !== 0n;
  const result = `${hasNegativeSign ? '-' : ''}${outputDigits}`;
  t.add('encode', 'restore-sign', 'Write the signed result',
    hasNegativeSign ? `The original value was negative. Put a minus sign before ${outputDigits}: ${result}.`
      : `Use ${result} without a minus sign${magnitude === 0n ? '; zero has no negative sign' : ''}.`,
    'signedResult = sign + magnitudeDigits', ['This is signed mathematical notation, not a fixed-width machine encoding.'], { result });
  const verified = expand(outputDigits, toBase, t, 'verify', 'the result');
  if (verified !== magnitude) throw new Error('Conversion verification failed.');
  t.add('verify', 'compare-values', 'Verify that the value is unchanged',
    `Reading the result in base ${toBase} gives magnitude ${verified}, which matches the original magnitude ${magnitude}. With the original sign, both represent ${hasNegativeSign ? '-' : ''}${magnitude} in decimal.`,
    'decodedOutputMagnitude = decodedInputMagnitude', ['Changing the base changes the written digits, not the number\'s value.'],
    { passed: true, originalDecimal: `${hasNegativeSign ? '-' : ''}${magnitude}`, verifiedDecimal: `${hasNegativeSign ? '-' : ''}${verified}` });
  return finish('number-system', 'convert', fromBase === 10 || toBase === 10 ? 'beginner' : 'intermediate',
    { number, fromBase, toBase }, result, t, ['Decode the source digits by place value.', 'Encode the magnitude in the target base.', 'Verify the output by converting it back by place value.']);
}
