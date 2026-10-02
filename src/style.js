// Shared look for the worked examples: gold for answers and remainders, grey for labels,
// bold white for numbers. Each module gets its own accent colour.
export const PALETTE = { gold: '#B8A43A', grey: '#8A8A85', text: '#FFFFFF' };

export const MODULE_COLORS = {
  add: { name: 'teal', hex: '#3FA7A0', ansi: 36 },
  subtract: { name: 'rose', hex: '#D9778F', ansi: 35 },
  transpose: { name: 'slate-blue', hex: '#7C8FD9', ansi: 34 },
  multiply: { name: 'violet', hex: '#A78BFA', ansi: 95 },
  determinant: { name: 'steel', hex: '#8FA3B8', ansi: 96 },
  convert: { name: 'peach', hex: '#E0A07A', ansi: 37 }
};

// Which colour role a step stage uses in the images.
const STAGE_ROLE = { calculate: 'number', encode: 'number', decode: 'number', complete: 'answer', verify: 'answer' };

export function moduleKey(response) {
  return response.module === 'matrix' ? response.operation : 'convert';
}

// Optional hints for API clients (?style=hints). Pure addition; nothing else in the response changes.
export function addStyleHints(response) {
  const key = moduleKey(response);
  const steps = response.steps.map(s => ({ ...s, styleRole: STAGE_ROLE[s.stage] ?? 'label' }));
  return {
    ...response,
    steps,
    style: {
      module: key,
      accent: MODULE_COLORS[key].hex,
      palette: PALETTE,
      roles: { answer: 'gold', label: 'grey', number: 'bold white', text: 'white' }
    }
  };
}

// ANSI helpers. Colour only when asked for, so piped output and NO_COLOR stay plain.
export function colorEnabled(stream = process.stdout, env = process.env) {
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return false;
  if (env.FORCE_COLOR && env.FORCE_COLOR !== '0') return true;
  return Boolean(stream && stream.isTTY);
}

export function makeStyler(enabled) {
  const wrap = (open, close = 0) => text => (enabled ? `\x1b[${open}m${text}\x1b[${close}m` : String(text));
  return {
    gold: text => (enabled ? `\x1b[1;38;2;184;164;58m${text}\x1b[0m` : String(text)),
    grey: text => (enabled ? `\x1b[38;2;138;138;133m${text}\x1b[0m` : String(text)),
    bold: wrap(1, 22),
    white: wrap(97, 39),
    accent: (key, text) => {
      if (!enabled) return String(text);
      const [r, g, b] = [1, 3, 5].map(i => parseInt(MODULE_COLORS[key].hex.slice(i, i + 2), 16));
      return `\x1b[1;38;2;${r};${g};${b}m${text}\x1b[0m`;
    }
  };
}
