#!/usr/bin/env node
import { calculateMatrix } from './algorithms/matrix.js';
import { convertNumber } from './algorithms/number-system.js';
import { colorEnabled, makeStyler, moduleKey, MODULE_COLORS } from './style.js';

const OPS = ['add', 'subtract', 'transpose', 'multiply', 'determinant', 'convert'];
const USAGE = `Usage:
  node src/cli.js <add|subtract|transpose|multiply|determinant> '{"A":[[1,2],[3,4]],"B":[[5,6],[7,8]]}' [--detail=beginner|compact|full]
  node src/cli.js convert '{"number":"13","fromBase":10,"toBase":2}'
Colours turn off when output is piped or NO_COLOR is set. Use --color to force them.`;

const fmtMatrix = m => (Array.isArray(m) && Array.isArray(m[0]) ? m.map(r => `[ ${r.join('  ')} ]`).join('  ') : String(m));

export function render(response, s) {
  const key = moduleKey(response);
  const out = [];
  out.push(s.accent(key, `== ${response.module} / ${response.operation} ==`));
  for (const step of response.steps) {
    out.push('');
    out.push(`${s.grey(`step ${step.id}`)} ${s.bold(s.white(step.title))}`);
    if (step.formula) out.push(`  ${s.grey('formula')} ${s.white(step.displayFormula ?? step.formula)}`);
    if (step.explanation) out.push(`  ${s.white(step.explanation)}`);
    for (const note of step.keyPoints ?? []) out.push(`  ${s.grey('|')} ${s.grey(note)}`);
  }
  out.push('');
  const result = Array.isArray(response.result) ? fmtMatrix(response.result) : JSON.stringify(response.result);
  out.push(`${s.grey('answer')} ${s.gold(result)}`);
  return out.join('\n');
}

export function run(argv, { stream = process.stdout, env = process.env } = {}) {
  const args = argv.filter(a => !a.startsWith('--'));
  const flags = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
  const [op, json] = args;
  if (!OPS.includes(op) || !json) return { code: 2, text: USAGE };
  let body;
  try { body = JSON.parse(json); } catch { return { code: 2, text: 'Input must be valid JSON.\n' + USAGE }; }
  const detail = flags.detail ?? 'beginner';
  try {
    const response = op === 'convert' ? convertNumber(body, { detail }) : calculateMatrix(op, body, { detail });
    const on = 'color' in flags ? true : colorEnabled(stream, env);
    return { code: 0, text: render(response, makeStyler(on)) };
  } catch (err) {
    return { code: 1, text: `Error: ${err.message}` };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { code, text } = run(process.argv.slice(2));
  (code === 0 ? process.stdout : process.stderr).write(text + '\n');
  process.exitCode = code;
}
export { MODULE_COLORS };
