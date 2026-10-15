/* ==========================================================================
   BACKEND ADAPTER  (Matrix + Number System backend, repo: Mini-project)
   --------------------------------------------------------------------------
   The only place that knows the backend's request/response format.
   - toBackend*():  UI values -> backend request bodies
   - fromBackend():  backend response -> the UI shape  { result, steps:[{title,text,visual}] }
   - errors:         backend { success:false, error:{...} } -> { error: "message" }
   Add a new module (Sets, Relations...) by adding one section here and one
   branch in src/api.js. Nothing in the UI needs to change.
   ========================================================================== */
import { grid, chips, row, op, esc } from "./ui-helpers.js";
import { groupSteps } from "./readable-steps.js";
import { writtenWorking } from "./written-working.js";

export const API_URL = (import.meta.env?.VITE_API_URL || "").replace(/\/+$/, "");
export const backendEnabled = true; // same-origin /api is the default, never silently use demo results

const MATRIX_ROUTES = { add: "add", sub: "subtract", mult: "multiply", transpose: "transpose", determinant: "determinant" };
const BASES = { Binary: 2, Octal: 8, Decimal: 10, Hexadecimal: 16 };
export const BACKEND_MATRIX_OPS = Object.keys(MATRIX_ROUTES);

const toNum = (fr) => Number(fr.n) / Number(fr.d); // fractions from the UI -> JSON numbers
const numMatrix = (M) => M.map((r) => r.map(toNum));

async function post(path, body, detail = "full") {
  let res;
  try {
    res = await fetch(`${API_URL}${path}?detail=${detail}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    return { error: `Can't reach the backend. Run the API on port 3000 with the frontend dev server, or use the integrated Vercel preview. For a separate API host, check VITE_API_URL and CORS_ORIGIN.` };
  }
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  if (res.status === 429) return { error: `Too many requests. Wait ${res.headers.get("Retry-After") || "a few"} seconds and try again.` };
  if (!data) return { error: `Backend returned an unreadable response (HTTP ${res.status}).` };
  if (data.success === false || !res.ok) return { error: data.error?.message || `Backend error (HTTP ${res.status}).` };
  if (data.schemaVersion && data.schemaVersion !== "1.0") console.warn("Backend schemaVersion is", data.schemaVersion, "- adapter was written for 1.0");
  return { data };
}

// ---------- backend step -> UI step ----------
const cell = (v) => (v === null || v === undefined ? "·" : String(v));
const mat = (M) => M.map((r) => r.map(cell));
const hlOf = (hls, name) => (hls || []).filter((h) => h.matrix === name).map((h) => [h.row, h.column]);

// ---------- plain-language step display ----------
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n) => String(n).replace(/\d/g, (d) => SUP[d]);
const EQ = /-?\d+(?:\.\d+)?(?: [*+\-\/] -?\d+(?:\.\d+)?)+ = -?\d+(?:\.\d+)?/;
const OPS = { "*": "×", "/": "÷", "-": "−", "+": "+", "=": "=" };
const num = (v, cls = "") => `<span class="eqn${cls ? " " + cls : ""}">${esc(v)}</span>`;
const sym = (v) => `<span class="eqo">${esc(v)}</span>`;
const txt = (v) => `<span class="eqt">${esc(v)}</span>`;
const work = (...parts) => `<div class="work">${parts.join("")}</div>`;
// pull a worked sum like "1 * 16 = 16" out of the backend's own explanation and draw it as boxes
function equation(text) {
  const m = String(text || "").match(EQ);
  if (!m) return "";
  const t = m[0].split(" ");
  return t.map((x, i) => (OPS[x] ? sym(OPS[x]) : num(x, i === t.length - 1 ? "res" : ""))).join("");
}
const totalBar = (label, v) => `<div class="total"><span>${esc(label)}</span><b>${esc(v)}</b></div>`;

function plainWork(step, data) {
  const st = step.state || {}, a = step.action, inp = data.input || {};
  const base = step.stage === "verify" ? inp.toBase : inp.fromBase;
  const eq = equation(step.explanation);
  switch (a) {
    case "read-digit":
      return work(txt("Digit"), num(st.symbol, "hl"), txt("is at place"), num(`${base}${sup(st.position)}`));
    case "calculate-place-value":
      return work(num(`${base}${sup(st.position)}`), sym("="), eq || num(st.placeValue, "res"));
    case "add-contribution":
    case "accumulate-term":
      return work(eq) + totalBar("Total so far", st.runningTotal);
    case "add-product":
      return work(eq) + totalBar("Sum so far", st.runningSum);
    case "divide":
      return work(num(st.currentValue), sym("÷"), num(st.targetBase), sym("→"), txt("quotient"), num(st.quotient, "res"));
    case "reverse-remainders":
      return chips(st.remainders.map(String)) + work(txt("Read backwards:"), num(st.outputDigits, "res"));
    case "record-remainder":
      return (eq ? work(eq) : "") + work(txt("Remainders so far:"), ...st.remainders.map((r) => num(r)));
    case "compare-values":
      return work(num(st.originalDecimal), sym(st.passed ? "=" : "≠"), num(st.verifiedDecimal), txt(st.passed ? "✓ matches" : "✗ differs"));
    case "select-row-column":
      return work(txt("Row of A:"), ...st.row.map((x) => num(x, "hl")), txt("Column of B:"), ...st.column.map((x) => num(x, "hl")));
    case "multiply-pair":
    case "evaluate-pair":
    case "apply-sign":
    case "cofactor-product":
      return eq ? work(eq) : "";
    default:
      return eq ? work(eq) : "";
  }
}

function stepVisual(step, data) {
  const st = step.state || {}, hl = step.highlights || [];
  let v = "";
  if (data.module === "matrix") {
    const input = data.input || {};
    const parts = [];
    const A = st.A || input.A, B = st.B || input.B;
    if (A) parts.push(grid(mat(A), { hl: hlOf(hl, "A"), label: "A" }));
    if (B && data.operation !== "determinant" && data.operation !== "transpose") { parts.push(op(data.operation === "multiply" ? "×" : data.operation === "subtract" ? "−" : "+")); parts.push(grid(mat(B), { hl: hlOf(hl, "B"), label: "B" })); }
    if (Array.isArray(st.matrix)) parts.push(grid(mat(st.matrix), { label: st.label || "Matrix" }));
    if (Array.isArray(st.minor)) parts.push(grid(mat(st.minor), { label: "Smaller matrix (minor)" }));
    if (Array.isArray(st.result)) { parts.push(op(data.operation === "transpose" ? "→" : "=")); parts.push(grid(mat(st.result), { hl: [...hlOf(hl, "C"), ...hlOf(hl, "result")], label: "Result" })); }
    v += row(...parts);
  } else {
    const raw = String(st.digits ?? (step.stage === "verify" ? data.result : data.input?.number) ?? "").replace("-", "").toUpperCase();
    const hot = new Set(hl.filter((h) => h.digitIndex !== undefined).map((h) => h.digitIndex));
    const base = step.stage === "verify" ? data.input?.toBase : data.input?.fromBase;
    const showPlaces = ["decode", "verify"].includes(step.stage) && step.action !== "compare-values";
    if (raw && step.stage !== "encode") v += `<div class="pvrow">${[...raw].map((c, i) => `<span class="pv${hot.has(i) ? " hl" : ""}"><b>${esc(c)}</b>${showPlaces ? `<i>${base}${sup(raw.length - 1 - i)}</i>` : ""}</span>`).join("")}</div>`;
  }
  v += plainWork(step, data);
  return v;
}

function fromBackend(data) {
  const r = data.result;
  const result = Array.isArray(r) ? { kind: "matrix", value: r.map((row) => row.map(String)) } : typeof r === "number" ? { kind: "scalar", value: String(r) } : { kind: "text", value: String(r) };
  const detailed = data.steps.map((s) => ({ title: s.title, text: s.explanation, visual: stepVisual(s, data) }));
  const short = groupSteps(data);
  const steps = short || detailed;
  if (data.summary?.notes?.length) for (const list of [steps, detailed]) list[list.length - 1].text += ` Note: ${data.summary.notes.join(" ")}`;
  return { result, steps, detailedSteps: short ? detailed : null, written: writtenWorking(data) };
}

// ---------- public ----------
export async function backendMatrix(opName, A, B) {
  const route = MATRIX_ROUTES[opName];
  if (!route) return { error: opName === "inverse" ? "Inverse is not available yet (coming soon)." : `Unknown operation: ${opName}` };
  if (opName === "determinant" && A.length > 4) return { error: "Determinants support at most 4 × 4 matrices. Choose a smaller matrix size." };
  const body = { A: numMatrix(A) };
  if (B) body.B = numMatrix(B);
  const { data, error } = await post(`/api/matrix/${route}`, body);
  return error ? { error } : fromBackend(data);
}

export async function backendConvert(value, fromName, toName) {
  const { data, error } = await post("/api/number-system/convert", { number: String(value).trim(), fromBase: BASES[fromName], toBase: BASES[toName] });
  return error ? { error } : fromBackend(data);
}

// ---------- Sets + Relations (real backend: /api/sets/*, /api/relations/*) ----------
const SET_ROUTES = { union: "union", intersection: "intersection", difference: "difference", symdiff: "symmetric-difference", cartesian: "cartesian-product", power: "power-set" };
const SET_NAMES = { union: "A ∪ B", intersection: "A ∩ B", difference: "A − B", symdiff: "A Δ B", cartesian: "A × B", power: "P(A)" };
const parseElement = (t) => (/^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t);
const parseList = (text) => String(text || "").split(",").map((x) => x.trim()).filter(Boolean).map(parseElement);
const parsePairs = (text) => [...String(text || "").matchAll(/\(\s*([^,()]+?)\s*,\s*([^,()]+?)\s*\)/g)].map((m) => [parseElement(m[1]), parseElement(m[2])]);
const el = (x) => String(x);
const pairStr = ([a, b]) => `(${el(a)}, ${el(b)})`;
const subsetStr = (s) => (s.length ? `{${s.map(el).join(", ")}}` : "∅");
const isPair = (x) => Array.isArray(x) && x.length === 2 && !Array.isArray(x[0]);

// step visual: show what has been built so far (backend state.result) as chips or a 0/1 grid
function setStepVisual(step) {
  const r = step.state?.result;
  if (Array.isArray(r) && r.length && Array.isArray(r[0]) && r[0].every((c) => c === 0 || c === 1 || c === null)) return grid(mat(r), { label: "Matrix" });
  if (Array.isArray(r)) {
    const items = r.map((x) => (Array.isArray(x) ? (isPair(x) ? pairStr(x) : subsetStr(x)) : x && typeof x === "object" ? `${el(x.from)} → ${el(x.to)}` : el(x)));
    return `<div class="mx-label">Result so far</div>` + (items.length ? chips(items.slice(0, 64)) : chips(["∅"]));
  }
  return "";
}
const mapSteps = (data) => data.steps.map((s) => ({ title: esc(s.title), text: esc(s.explanation), visual: setStepVisual(s) }));

// short steps (compact) + detailed steps (full); the full response is the source of truth for the result
async function twoViews(path, body) {
  const [full, compact] = await Promise.all([post(path, body), post(path, body, "compact")]);
  return { full, compact };
}

export async function backendSets(opName, aText, bText) {
  const route = SET_ROUTES[opName];
  if (!route) return { error: `Unknown set operation: ${opName}` };
  const body = { A: parseList(aText) };
  if (opName !== "power") body.B = parseList(bText);
  const { full, compact } = await twoViews(`/api/sets/${route}`, body);
  if (full.error) return { error: full.error };
  const data = full.data, r = data.result;
  const value = opName === "power" ? r.map(subsetStr) : opName === "cartesian" ? r.map(pairStr) : r.map(el);
  const A = data.input.A, B = data.input.B || [];
  const inA = new Set(A.map((x) => JSON.stringify(x))), inB = new Set(B.map((x) => JSON.stringify(x)));
  const onlyA = A.filter((x) => !inB.has(JSON.stringify(x))).map(el), both = A.filter((x) => inB.has(JSON.stringify(x))).map(el), onlyB = B.filter((x) => !inA.has(JSON.stringify(x))).map(el);
  const venn = ["union", "intersection", "difference", "symdiff"].includes(opName) ? { op: opName, onlyA, both, onlyB } : null;
  const detailed = mapSteps(data);
  const short = compact.error ? null : mapSteps(compact.data);
  const notes = data.summary?.notes?.length ? ` Note: ${data.summary.notes.join(" ")}` : "";
  const last = (list) => { if (notes && list.length) list[list.length - 1].text += esc(notes); };
  last(detailed); if (short) last(short);
  return { result: { kind: "set", label: SET_NAMES[opName], value, venn }, steps: short || detailed, detailedSteps: short ? detailed : null };
}

export async function backendRelation(uText, rText) {
  const U = parseList(uText), pairs = parsePairs(rText);
  if (!U.length) return { error: "Universal set is empty." };
  if (!pairs.length) return { error: "Could not read any pairs. Use the form (1,2),(2,3)." };
  const body = { A: U, R: pairs };
  const [an, mx, anC] = await Promise.all([post("/api/relations/analyze", body), post("/api/relations/matrix", body), post("/api/relations/analyze", body, "compact")]);
  if (an.error) return { error: an.error };
  if (mx.error) return { error: mx.error };
  const d = an.data, P = d.result.properties, C = d.result.counterexamples || {};
  const why = (name, key, yes) => (P[key] ? yes : `Fails: ${(C[key] || []).slice(0, 3).map(pairStr).join(", ")}${(C[key] || []).length > 3 ? ", …" : ""}.`);
  const props = [
    { name: "Reflexive", ok: P.reflexive, why: why("Reflexive", "reflexive", "Every element is related to itself.") },
    { name: "Symmetric", ok: P.symmetric, why: why("Symmetric", "symmetric", "Every (a,b) has its (b,a).") },
    { name: "Antisymmetric", ok: P.antisymmetric, why: why("Antisymmetric", "antisymmetric", "No two different elements are related both ways.") },
    { name: "Transitive", ok: P.transitive, why: why("Transitive", "transitive", "Whenever (a,b) and (b,c) are there, (a,c) is too.") },
  ];
  const type = P.equivalence && P.partialOrder ? "Equivalence relation and partial order" : P.equivalence ? "Equivalence relation" : P.partialOrder ? "Partial order" : "Neither equivalence nor partial order";
  const detailed = mapSteps(d);
  const short = anC.error ? null : mapSteps(anC.data);
  const notes = d.summary?.notes?.length ? ` Note: ${d.summary.notes.join(" ")}` : "";
  const fin = (list) => { if (list.length) { list[list.length - 1].text += esc(notes); list[list.length - 1].visual += `<div class="big-answer small">${esc(type)}</div>`; } };
  fin(detailed); if (short) fin(short);
  const U2 = d.input.A.map(el), pairs2 = d.input.R.map(([a, b]) => [el(a), el(b)]);
  return { result: { kind: "relation", props, type, U: U2, pairs: pairs2, matrix: mx.data.result.matrix.map((r) => r.map(String)) }, steps: short || detailed, detailedSteps: short ? detailed : null };
}
