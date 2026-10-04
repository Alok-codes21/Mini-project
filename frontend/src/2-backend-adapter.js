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

export const API_URL = (import.meta.env?.VITE_API_URL || "").replace(/\/+$/, "");
export const backendEnabled = true; // same-origin /api is the default, never silently use demo results

const MATRIX_ROUTES = { add: "add", sub: "subtract", mult: "multiply", transpose: "transpose", determinant: "determinant" };
const BASES = { Binary: 2, Octal: 8, Decimal: 10, Hexadecimal: 16 };
export const BACKEND_MATRIX_OPS = Object.keys(MATRIX_ROUTES);

const toNum = (fr) => Number(fr.n) / Number(fr.d); // fractions from the UI -> JSON numbers
const numMatrix = (M) => M.map((r) => r.map(toNum));

async function post(path, body) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}?detail=full`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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

function kvChips(state, skip) {
  const items = Object.entries(state || {}).filter(([k, v]) => !skip.includes(k) && v !== undefined);
  if (!items.length) return "";
  return `<div class="kvs">${items.map(([k, v]) => `<span class="kv"><i>${esc(k)}</i><b>${esc(Array.isArray(v) ? v.join(" ") || "none" : typeof v === "object" ? JSON.stringify(v) : v)}</b></span>`).join("")}</div>`;
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
    if (Array.isArray(st.result)) { parts.push(op(data.operation === "transpose" ? "→" : "=")); parts.push(grid(mat(st.result), { hl: [...hlOf(hl, "C"), ...hlOf(hl, "result")], label: "Result" })); }
    v += row(...parts);
    v += kvChips(st, ["A", "B", "result"]);
  } else {
    const digits = String(st.digits ?? (step.stage === "verify" ? data.result : data.input?.number) ?? "").replace("-", "").toUpperCase();
    const hot = new Set(hl.filter((h) => h.digitIndex !== undefined).map((h) => h.digitIndex));
    if (digits && step.stage !== "encode") v += `<div class="pvrow">${[...digits].map((c, i) => `<span class="pv${hot.has(i) ? " hl" : ""}"><b>${esc(c)}</b></span>`).join("")}</div>`;
    if (Array.isArray(st.remainders)) v += chips(st.remainders.map(String));
    v += kvChips(st, ["remainders", "digits"]);
  }
  const formula = step.displayFormula || step.formula;
  if (formula) v += `<div class="formula"><code>${esc(formula)}</code></div>`;
  if (step.keyPoints?.length) v += `<ul class="kp">${step.keyPoints.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>`;
  return v;
}

function fromBackend(data) {
  const r = data.result;
  const result = Array.isArray(r) ? { kind: "matrix", value: r.map((row) => row.map(String)) } : typeof r === "number" ? { kind: "scalar", value: String(r) } : { kind: "text", value: String(r) };
  const steps = data.steps.map((s) => ({ title: s.title, text: s.explanation, visual: stepVisual(s, data) }));
  if (data.summary?.notes?.length) steps[steps.length - 1].text += ` Note: ${data.summary.notes.join(" ")}`;
  return { result, steps };
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
