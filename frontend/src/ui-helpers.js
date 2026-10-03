/* Shared UI helpers: exact fractions for input parsing, and small HTML builders for step visuals.
   Used by the page code, the demo engine and the backend adapter. Keep this file when demo-engine.js is deleted. */

// ---------- tiny fraction helper (exact arithmetic for demo) ----------
const gcd = (a, b) => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
export class Fr {
  constructor(n, d = 1n) {
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d) || 1n;
    this.n = n / g; this.d = d / g;
  }
  static parse(s) {
    s = String(s).trim();
    if (!/^-?\d*\.?\d+$/.test(s)) return null;
    const neg = s.startsWith("-");
    const [i, f = ""] = s.replace("-", "").split(".");
    const n = BigInt((i || "0") + f);
    return new Fr(neg ? -n : n, 10n ** BigInt(f.length));
  }
  add(o) { return new Fr(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return new Fr(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new Fr(this.n * o.n, this.d * o.d); }
  div(o) { return new Fr(this.n * o.d, this.d * o.n); }
  neg() { return new Fr(-this.n, this.d); }
  isZero() { return this.n === 0n; }
  toString() { return this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`; }
}
export const F = (x) => (x instanceof Fr ? x : new Fr(BigInt(x)));
export const ZERO = new Fr(0n);

// ---------- html helpers ----------
export const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
export const grid = (M, { hl = [], sep = -1, label = "" } = {}) => {
  const cols = M[0].length;
  const cells = M.map((row, i) =>
    row.map((v, j) => `<span class="c${hl.some(([a, b]) => a === i && b === j) ? " hl" : ""}${j === sep ? " sep" : ""}">${esc(v)}</span>`).join("")
  ).join("");
  return `<div class="mx-wrap">${label ? `<div class="mx-label">${esc(label)}</div>` : ""}<div class="mx" style="--cols:${cols}">${cells}</div></div>`;
};
export const chips = (arr, hl = []) =>
  `<div class="chips">${arr.map((x) => `<span class="chip${hl.includes(x) ? " hl" : ""}">${esc(x)}</span>`).join("") || '<span class="chip">∅</span>'}</div>`;
export const row = (...parts) => `<div class="vrow">${parts.join("")}</div>`;
export const op = (s) => `<div class="mx-op">${esc(s)}</div>`;
export const fmt = (M) => M.map((r) => r.map(String));

