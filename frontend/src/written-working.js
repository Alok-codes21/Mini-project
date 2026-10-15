/* "Written working": the solution written the way a student solves it by hand
   (Given, Formula, line-by-line solution, Answer). Built only from the backend response; backend unchanged. */
import { esc } from "./ui-helpers.js";

const fmt = (x) => String(Math.round(Number(x) * 1e9) / 1e9);
const p = (v) => (Number(v) < 0 ? `(${fmt(v)})` : fmt(v)); // negative numbers get brackets
const sub = (v) => `<sub>${esc(v)}</sub>`;
const sp = (v) => `<sup>${esc(v)}</sup>`;
const L = (html, cls = "") => `<div class="ww-line${cls ? " " + cls : ""}">${html}</div>`;
const sec = (label, ...lines) => `<div class="ww-sec"><div class="ww-lab">${label}</div>${lines.join("")}</div>`;
const mx = (M) => `<span class="ww-m"><table>${M.map((r) => `<tr>${r.map((v) => `<td>${esc(fmt(v))}</td>`).join("")}</tr>`).join("")}</table></span>`;
const res = (v) => `<b class="ww-res">${v}</b>`;
const box = (v, ok) => `<span class="ww-box">${v}</span>${ok ? `<span class="ww-ok">✓ checked</span>` : ""}`;
const wrap = (...s) => `<div class="ww">${s.join("")}</div>`;
const MAXCELLS = 16;

function converter(data) {
  const S = data.steps, { number, fromBase: f, toBase: t } = data.input;
  const by = (stage, action) => S.filter((s) => s.stage === stage && s.action === action);
  const neg = String(number).trim().startsWith("-");
  const cons = by("decode", "calculate-contribution"), places = by("decode", "calculate-place-value"), reads = by("decode", "read-digit");
  const fin = by("decode", "finish-positional-expansion")[0];
  const divs = by("encode", "divide"), recs = by("encode", "record-remainder"), rev = by("encode", "reverse-remainders")[0];
  const cmp = S.filter((s) => s.action === "compare-values").pop();
  const hasDecode = f !== 10 && reads.length && reads.length === cons.length && places.length === cons.length;
  const hasEncode = divs.length && divs.length === recs.length;
  const formula = [hasDecode ? "Digit × base<sup>place</sup>, then add" : "", hasEncode ? `Divide by ${t}, note the remainder` : ""].filter(Boolean);
  const out = [];
  out.push(sec("Given", L(`(${esc(number)})${sub(f)} = (?)${sub(t)}` + (neg ? ` <span class="ww-note">(minus sign is put back at the end)</span>` : ""))));
  if (formula.length) out.push(sec("Formula", ...formula.map((x) => L(x))));
  const sol = [];
  if (hasDecode) {
    const terms = reads.map((r, i) => `${esc(r.state.symbol)}×${f}${sp(r.state.position)}`);
    sol.push(L("= " + terms.join(" + ")));
    sol.push(L("= " + cons.map((c) => fmt(c.state.contribution)).join(" + ")));
    sol.push(L("= " + res(esc(fin?.state?.decimalMagnitude ?? "")), ""));
  }
  if (hasEncode) {
    const w = String(Math.max(...divs.map((d) => String(d.state.currentValue).length)));
    divs.forEach((d, i) => sol.push(L(`${t} ) <span class="ww-pad">${esc(String(d.state.currentValue).padStart(+w, "\u00a0"))}</span> → rem <b>${esc(recs[i].state.digit)}</b>`)));
    if (rev) sol.push(L(`Read the remainders <span class="ww-hl">bottom → top ↑</span> = ${res(esc(rev.state.outputDigits))}`));
  }
  out.push(sec("Solution", ...sol));
  out.push(sec("Answer", L(box(`(${esc(number)})${sub(f)} = (${esc(data.result)})${sub(t)}`, cmp?.state?.passed))));
  return wrap(...out);
}

const det = (M) => (M.length === 1 ? M[0][0] : M.length === 2 ? M[0][0] * M[1][1] - M[0][1] * M[1][0] : M[0].reduce((s, a, j) => s + (j % 2 ? -1 : 1) * a * det(minor(M, j)), 0));
const minor = (M, j) => M.slice(1).map((r) => r.filter((_, k) => k !== j));
const sg = (v) => (v < 0 ? "−" : "+");

function matrix(data) {
  const A = data.input.A, B = data.input.B, R = data.result, o = data.operation;
  const lines = [];
  const cells = (fn) => {
    const all = [];
    R.forEach((r, i) => r.forEach((_, j) => all.push([i, j])));
    const shown = all.length <= MAXCELLS ? all : all.filter(([i]) => i === 0);
    shown.forEach(([i, j]) => lines.push(L(fn(i, j))));
    if (shown.length < all.length) lines.push(L(`<span class="ww-note">Same way for every other cell.</span>`));
  };
  let given, formula;
  if (o === "add" || o === "subtract") {
    const s = o === "add" ? "+" : "−";
    given = L(`${mx(A)} ${s} ${mx(B)}`);
    formula = o === "add" ? "Add the numbers in the same position" : "Subtract the numbers in the same position";
    cells((i, j) => `C${sub(`${i + 1}${j + 1}`)} = ${p(A[i][j])} ${s} ${p(B[i][j])} = ${res(fmt(R[i][j]))}`);
  } else if (o === "transpose") {
    given = L(`A = ${mx(A)}`);
    formula = "Rows become columns: C" + sub("ji") + " = A" + sub("ij");
    A.forEach((r, i) => lines.push(L(`Row ${i + 1} of A → column ${i + 1}: ${r.map((v) => fmt(v)).join(", ")}`)));
  } else if (o === "multiply") {
    given = L(`${mx(A)} × ${mx(B)}`);
    formula = "Row × Column, then add";
    cells((i, j) => `C${sub(`${i + 1}${j + 1}`)} = ${A[i].map((a, k) => `${p(a)}×${p(B[k][j])}`).join(" + ")} = ${A[i].map((a, k) => fmt(a * B[k][j])).join(" + ")} = ${res(fmt(R[i][j]))}`);
  } else if (o === "determinant") {
    const n = A.length, d = data.result;
    given = L(`|A| = ${mx(A)}`.replace("|A| =", "det(A) ="));
    if (n === 1) { formula = "One number: det = that number"; lines.push(L(`det(A) = ${res(fmt(d))}`)); }
    else if (n === 2) {
      const [[a, b], [c, e]] = A;
      formula = "det = ad − bc";
      lines.push(L(`= ${p(a)}×${p(e)} − ${p(b)}×${p(c)}`), L(`= ${fmt(a * e)} − ${p(b * c)}`), L(`= ${res(fmt(d))}`));
    } else {
      formula = "Go along the first row: +a×(minor) − b×(minor) + …";
      const terms = A[0].map((a, j) => (j % 2 ? -1 : 1) * a * det(minor(A, j)));
      if (Math.abs(terms.reduce((x, y) => x + y, 0) - d) > 1e-6) return null;
      A[0].forEach((a, j) => lines.push(L(`${j % 2 ? "−" : "+"} ${p(a)} × det${mx(minor(A, j))} = ${j % 2 ? "−" : "+"} ${p(a)} × ${p(det(minor(A, j)))} = ${fmt(terms[j])}`)));
      lines.push(L(`= ${terms.map((v, i) => (i ? sg(v) + " " + fmt(Math.abs(v)) : fmt(v))).join(" ")} = ${res(fmt(d))}`));
    }
  } else return null;
  const ans = Array.isArray(R) ? L(`${mx(R)} <span class="ww-ok">✓ checked</span>`) : L(box(`det(A) = ${fmt(R)}`, true));
  return wrap(sec("Given", given), sec("Formula", L(formula)), sec("Solution", ...lines), sec("Answer", ans));
}

export function writtenWorking(data) {
  try {
    return data.module === "matrix" ? matrix(data) : converter(data);
  } catch (e) {
    console.warn("Written working failed, showing steps only", e);
    return null;
  }
}
