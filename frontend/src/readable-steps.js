/* Beginner-friendly steps: folds the backend's long step list (often 20-60 steps) into a few simple ones.
   The backend is not changed. Numbers shown come from the backend response (result, step states) or are
   re-computed here only to lay out an example (matrix cells). Raw backend steps stay available in "Show raw data (JSON)". */
import { grid, chips, row, op, esc } from "./ui-helpers.js";

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n) => String(n).replace(/\d/g, (d) => SUP[d]);
const NAME = { 2: "binary", 8: "octal", 10: "decimal", 16: "hexadecimal" };
const fmt = (x) => String(Math.round(Number(x) * 1e9) / 1e9);
const mat = (M) => M.map((r) => r.map(fmt));
const dims = (M) => `${M.length} × ${M[0].length}`;

const num = (v, cls = "") => `<span class="eqn${cls ? " " + cls : ""}">${esc(v)}</span>`;
const sym = (v) => `<span class="eqo">${esc(v)}</span>`;
const txt = (v) => `<span class="eqt">${esc(v)}</span>`;
const work = (...p) => `<div class="work">${p.join("")}</div>`;
const workNw = (...p) => `<div class="work nw">${p.join("")}</div>`;
const rows = (...p) => `<div class="rows">${p.join("")}</div>`;
const total = (label, v) => `<div class="total"><span>${esc(label)}</span><b>${esc(v)}</b></div>`;
const step = (title, text, visual, raw) => ({ title, text, visual: visual + rawToggle(raw) });
function rawToggle(raw) {
  return `<details class="raw"><summary>Show raw data (JSON)</summary><pre>${esc(JSON.stringify(raw, null, 2))}</pre></details>`;
}
const digitRow = (digits, base) =>
  `<div class="pvrow">${[...digits].map((c, i) => `<span class="pv"><b>${esc(c)}</b><i>${base}${sup(digits.length - 1 - i)}</i></span>`).join("")}</div>`;

// ---------------- number converter ----------------
export function groupConverter(data) {
  const S = data.steps, { number, fromBase: f, toBase: t } = data.input;
  const by = (stage, action) => S.filter((s) => s.stage === stage && s.action === action);
  const neg = String(number).trim().startsWith("-");
  const out = [];
  const digits = String(S[0].state?.digits ?? String(number).replace("-", "")).toUpperCase();
  out.push(step("Your number", `${number} is a ${NAME[f]} number (base ${f}). We turn it into ${NAME[t]} (base ${t}).`, digitRow(digits, f) + (neg ? work(txt("Negative: we convert the number first, then put the minus sign back.")) : ""), [S[0]]));

  const reads = by("decode", "read-digit"), places = by("decode", "calculate-place-value"), cons = by("decode", "calculate-contribution");
  if (reads.length && reads.length === cons.length && places.length === cons.length) {
    const lines = reads.map((r, i) => {
      const st = r.state, letter = String(st.symbol) !== String(st.digitValue);
      return work(txt(`${f}${sup(st.position)}`), num(st.symbol, "hl"), letter ? txt(`(${st.digitValue})`) : "", sym("×"), num(places[i].state.placeValue), sym("="), num(cons[i].state.contribution, "res"));
    });
    out.push(step("Multiply each digit by its place value", `Each place is worth ${f} times the place on its right.`, rows(...lines), [...reads, ...places, ...cons]));
    const fin = by("decode", "finish-positional-expansion")[0];
    const parts = cons.map((c, i) => (i ? sym("+") : "") + num(c.state.contribution));
    out.push(step("Add them up", `Add the results. That gives the number in decimal.`, work(...parts, sym("="), num(fin?.state?.decimalMagnitude ?? "", "res")), [...by("decode", "add-contribution"), fin].filter(Boolean)));
  }

  const divs = by("encode", "divide"), recs = by("encode", "record-remainder"), rev = by("encode", "reverse-remainders")[0];
  if (divs.length && divs.length === recs.length) {
    const lines = divs.map((d, i) => {
      const r = recs[i].state;
      return workNw(num(d.state.currentValue), sym("÷"), num(t), sym("="), num(d.state.quotient), txt("rem"), num(r.digit, "hl"));
    });
    out.push(step(`Divide by ${t} again and again`, `rem = remainder (what is left over). Write it each time. Stop when the answer is 0.`, rows(...lines), [...divs, ...recs]));
    if (rev) out.push(step("Read the remainders backwards", `The last remainder goes first.`, chips(rev.state.remainders.map(String)) + work(txt("Backwards:"), num(rev.state.outputDigits, "res")), [rev]));
  }

  const cmp = S.filter((s) => s.action === "compare-values").pop();
  out.push(step("Answer", "", work(num(number), txt(`base ${f}`), sym("="), num(data.result, "res"), txt(`base ${t}`)) + (cmp?.state?.passed ? work(txt("✓ Checked: reading the answer back gives the same value.")) : ""), cmp ? [cmp] : []));
  return out;
}

// ---------------- matrix ----------------
const det = (M) => (M.length === 1 ? M[0][0] : M.length === 2 ? M[0][0] * M[1][1] - M[0][1] * M[1][0] : M[0].reduce((s, a, j) => s + (j % 2 ? -1 : 1) * a * det(minor(M, j)), 0));
const minor = (M, j) => M.slice(1).map((r) => r.filter((_, k) => k !== j));
const signed = (parts) => parts.map((v, i) => (i === 0 ? num(fmt(v)) : v < 0 ? sym("−") + num(fmt(-v)) : sym("+") + num(fmt(v)))).join("");

export function groupMatrix(data) {
  const A = data.input.A, B = data.input.B, R = data.result, o = data.operation, raw = data.steps;
  const G = (M, label, hl = []) => grid(mat(M), { label, hl });
  const pick = (...a) => raw.filter((s) => a.includes(s.action));
  if (o === "add" || o === "subtract") {
    const s = o === "add" ? "+" : "−", w = o === "add" ? "Add" : "Subtract", a = A[0][0], b = B[0][0];
    return [
      step("Check the sizes", `Both are ${dims(A)}, so we can ${w.toLowerCase()} them.`, row(G(A, "A"), op(s), G(B, "B")), pick("inspect-dimensions", "check-rule")),
      step(`${w} matching positions`, `Take the two numbers in the same position.`, row(G(A, "A", [[0, 0]]), op(s), G(B, "B", [[0, 0]]), op("="), G(R, "Result", [[0, 0]])) + work(txt("Top-left:"), num(fmt(a)), sym(s), num(fmt(b)), sym("="), num(fmt(R[0][0]), "res")) + work(txt("Do the same for every position.")), raw.slice(2)),
    ];
  }
  if (o === "transpose") {
    return [
      step("Check the size", `A is ${dims(A)}, so the answer is ${R.length} × ${R[0].length}.`, G(A, "A"), pick("inspect-dimensions", "check-rule")),
      step("Swap rows and columns", `Row 1 of A becomes column 1 of the answer.`, row(G(A, "A", A[0].map((_, j) => [0, j])), op("→"), G(R, "Answer", R.map((_, i) => [i, 0]))), raw.slice(2)),
    ];
  }
  if (o === "multiply") {
    const cell = (i, j) => A[i].map((a, k) => [a, B[k][j]]);
    const eq = (i, j) => [...cell(i, j).flatMap(([a, b], k) => (k ? [sym("+")] : []).concat([num(fmt(a)), sym("×"), num(fmt(b))])), sym("="), num(fmt(R[i][j]), "res")];
    const all = R.length * R[0].length <= 9 ? rows(...R.flatMap((r, i) => r.map((_, j) => `<div class="cellline">${txt(`Row ${i + 1} × column ${j + 1}`)}${work(...eq(i, j))}</div>`))) : "";
    return [
      step("Check the sizes", `A has ${A[0].length} columns and B has ${B.length} rows. They match, so the answer is ${R.length} × ${R[0].length}.`, row(G(A, "A"), op("×"), G(B, "B")), pick("inspect-dimensions", "check-rule")),
      step("Multiply a row by a column", `Row 1 of A with column 1 of B: multiply the pairs, then add.`, row(G(A, "A", A[0].map((_, j) => [0, j])), op("×"), G(B, "B", B.map((_, i) => [i, 0]))) + work(...eq(0, 0)), raw.filter((s) => s.action.includes("pair") || s.action === "select-row-column" || s.action === "add-product").slice(0, 8)),
      step("Do this for every cell", `Each answer cell is one row times one column.`, all + row(G(R, "Result")), raw.slice(-2)),
    ];
  }
  if (o === "determinant") {
    const n = A.length, d = data.result;
    const first = step("Check the size", `A is ${dims(A)}. It is square, so it has a determinant.`, G(A, "A"), pick("inspect-dimensions", "check-rule"));
    if (n === 1) return [first, step("Answer", `One number: the determinant is that number.`, work(num(fmt(d), "res")), raw.slice(2))];
    if (n === 2) {
      const [[a, b], [c, e]] = A;
      return [first, step("Cross multiply and subtract", `Multiply the diagonals, then subtract.`, G(A, "A", [[0, 0], [1, 1]]) + work(num(fmt(a)), sym("×"), num(fmt(e)), sym("−"), num(fmt(b)), sym("×"), num(fmt(c)), sym("="), num(fmt(d), "res")), raw.slice(2))];
    }
    const terms = A[0].map((a, j) => (j % 2 ? -1 : 1) * a * det(minor(A, j)));
    if (Math.abs(terms.reduce((x, y) => x + y, 0) - d) > 1e-6) return null; // layout disagrees with backend: show full steps instead
    const lines = A[0].map((a, j) => row(sym(j % 2 ? "−" : "+"), num(fmt(a), "hl"), sym("×"), grid(mat(minor(A, j)), { label: "what is left" }), sym("="), num(fmt(terms[j]), "res")));
    return [
      first,
      step("Go along the first row", `For each number, cover its row and column. Multiply by what is left. Signs go + − + −.`, rows(...lines), raw.slice(2)),
      step("Add the pieces", ``, work(signed(terms), sym("="), num(fmt(d), "res")), raw.slice(-1)),
    ];
  }
  return null;
}

export function groupSteps(data) {
  try {
    const g = data.module === "matrix" ? groupMatrix(data) : groupConverter(data);
    return g && g.length ? g : null;
  } catch (e) {
    console.warn("Step grouping failed, showing full steps", e);
    return null;
  }
}
