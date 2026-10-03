/* ==========================================================================
   DEMO ENGINE  -  TEMPORARY, FRONTEND-ONLY
   --------------------------------------------------------------------------
   This file produces placeholder results + step lists so the UI animations
   have something to play. It is NOT the real maths backend.
   The backend team replaces this by changing src/api.js only; the UI never
   imports this file directly.

   Every function returns the same shape:
     { result: {...}, steps: [{ title, text, visual }] }
   `visual` is a small HTML string (matrix grids, chips...) shown in a step.
   ========================================================================== */

import { Fr, F, ZERO, esc, grid, chips, row, op, fmt } from "./ui-helpers.js";
export { Fr, grid, chips };

// ---------- MATRIX ----------
const det = (M) => {
  const n = M.length;
  if (n === 1) return M[0][0];
  if (n === 2) return M[0][0].mul(M[1][1]).sub(M[0][1].mul(M[1][0]));
  let s = ZERO;
  for (let j = 0; j < n; j++) {
    const t = M[0][j].mul(det(minor(M, 0, j)));
    s = j % 2 ? s.sub(t) : s.add(t);
  }
  return s;
};
const minor = (M, r, c) => M.filter((_, i) => i !== r).map((rw) => rw.filter((_, j) => j !== c));

export function matrixDemo(opName, A, B) {
  const n = A.length;
  const steps = [];
  let result;
  if (opName === "add" || opName === "sub") {
    const sign = opName === "add" ? "+" : "−";
    const R = A.map((r) => r.map(() => ZERO));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) R[i][j] = opName === "add" ? A[i][j].add(B[i][j]) : A[i][j].sub(B[i][j]);
      const partial = R.map((r, k) => r.map((v, j) => (k <= i ? v : "·")));
      steps.push({
        title: `Row ${i + 1}`,
        text: A[i].map((a, j) => `${a} ${sign} ${B[i][j]} = ${R[i][j]}`).join("   ·   "),
        visual: row(grid(fmt(A), { hl: A[i].map((_, j) => [i, j]), label: "A" }), op(sign), grid(fmt(B), { hl: B[i].map((_, j) => [i, j]), label: "B" }), op("="), grid(fmt(partial), { hl: R[i].map((_, j) => [i, j]), label: "Result" })),
      });
    }
    result = { kind: "matrix", value: fmt(R) };
  } else if (opName === "mult") {
    const R = A.map((r) => r.map(() => null));
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        let s = ZERO;
        const parts = [];
        for (let k = 0; k < n; k++) { s = s.add(A[i][k].mul(B[k][j])); parts.push(`${A[i][k]}×${B[k][j]}`); }
        R[i][j] = s;
        steps.push({
          title: `Row ${i + 1} × Column ${j + 1}`,
          text: `${parts.join(" + ")} = ${s}`,
          visual: row(grid(fmt(A), { hl: A[i].map((_, k) => [i, k]), label: "A" }), op("×"), grid(fmt(B), { hl: B.map((_, k) => [k, j]), label: "B" }), op("="), grid(R.map((r) => r.map((v) => (v === null ? "·" : String(v)))), { hl: [[i, j]], label: "Result" })),
        });
      }
    result = { kind: "matrix", value: fmt(R) };
  } else if (opName === "transpose") {
    const R = A[0].map((_, j) => A.map((r) => r[j]));
    for (let i = 0; i < n; i++)
      steps.push({
        title: `Row ${i + 1} becomes column ${i + 1}`,
        text: `Row ${i + 1} (${A[i].join(", ")}) is written as column ${i + 1}.`,
        visual: row(grid(fmt(A), { hl: A[i].map((_, j) => [i, j]), label: "A" }), op("→"), grid(fmt(R), { hl: R.map((_, k) => [k, i]), label: "Aᵀ" })),
      });
    result = { kind: "matrix", value: fmt(R) };
  } else if (opName === "determinant") {
    const d = det(A);
    if (n === 1) steps.push({ title: "1 × 1 matrix", text: `The determinant is the single entry: ${d}.`, visual: grid(fmt(A), { hl: [[0, 0]] }) });
    else if (n === 2) {
      const [a, b, c, e] = [A[0][0], A[0][1], A[1][0], A[1][1]];
      steps.push({ title: "Main diagonal", text: `a × d = ${a} × ${e} = ${a.mul(e)}`, visual: grid(fmt(A), { hl: [[0, 0], [1, 1]] }) });
      steps.push({ title: "Other diagonal", text: `b × c = ${b} × ${c} = ${b.mul(c)}`, visual: grid(fmt(A), { hl: [[0, 1], [1, 0]] }) });
      steps.push({ title: "Subtract", text: `ad − bc = ${a.mul(e)} − ${b.mul(c)} = ${d}`, visual: grid(fmt(A)) });
    } else {
      let run = ZERO;
      for (let j = 0; j < n; j++) {
        const m = det(minor(A, 0, j));
        const term = A[0][j].mul(m);
        run = j % 2 ? run.sub(term) : run.add(term);
        steps.push({
          title: `Expand along row 1, entry ${j + 1}`,
          text: `${j % 2 ? "−" : "+"} ${A[0][j]} × det(minor) = ${j % 2 ? "−" : "+"} ${A[0][j]} × ${m} = ${j % 2 ? term.neg() : term}.  Running total: ${run}`,
          visual: row(grid(fmt(A), { hl: [[0, j]], label: "A" }), op("minor"), grid(fmt(minor(A, 0, j)), { label: `M1${j + 1}` })),
        });
      }
    }
    result = { kind: "scalar", value: String(d) };
  } else {
    const d = det(A);
    steps.push({ title: "Check the determinant", text: `det(A) = ${d}. ${d.isZero() ? "It is 0, so the inverse does not exist." : "It is not 0, so the inverse exists."}`, visual: grid(fmt(A)) });
    if (d.isZero()) result = { kind: "text", value: "Not invertible (determinant is 0)" };
    else {
      const M = A.map((r, i) => [...r, ...r.map((_, j) => F(i === j ? 1 : 0))]);
      const show = (hl) => grid(fmt(M), { hl, sep: n - 1, label: "[ A | I ]" });
      for (let c = 0; c < n; c++) {
        let p = c;
        while (M[p][c].isZero()) p++;
        if (p !== c) { [M[p], M[c]] = [M[c], M[p]]; steps.push({ title: `Swap R${c + 1} and R${p + 1}`, text: "The pivot position was 0, so rows are swapped.", visual: show(M[c].map((_, j) => [c, j])) }); }
        const pv = M[c][c];
        if (!pv.mul(F(1)).sub(F(1)).isZero()) { M[c] = M[c].map((v) => v.div(pv)); steps.push({ title: `R${c + 1} ← R${c + 1} ÷ ${pv}`, text: "Make the pivot equal to 1.", visual: show(M[c].map((_, j) => [c, j])) }); }
        for (let r = 0; r < n; r++) {
          if (r === c || M[r][c].isZero()) continue;
          const f = M[r][c];
          M[r] = M[r].map((v, j) => v.sub(f.mul(M[c][j])));
          steps.push({ title: `R${r + 1} ← R${r + 1} − (${f}) × R${c + 1}`, text: `Make column ${c + 1} zero in row ${r + 1}.`, visual: show(M[r].map((_, j) => [r, j])) });
        }
      }
      result = { kind: "matrix", value: fmt(M.map((r) => r.slice(n))) };
    }
  }
  steps.push({ title: "Answer", text: "Final result", visual: result.kind === "matrix" ? grid(result.value, { hl: result.value.flatMap((r, i) => r.map((_, j) => [i, j])) }) : `<div class="big-answer">${esc(result.value)}</div>` });
  return { result, steps };
}

// ---------- NUMBER CONVERTER ----------
const BASES = { Binary: 2, Octal: 8, Decimal: 10, Hexadecimal: 16 };
const DIG = "0123456789ABCDEF";
export function converterDemo(input, fromName, toName) {
  const from = BASES[fromName], to = BASES[toName];
  let s = input.trim().toUpperCase();
  const neg = s.startsWith("-");
  if (neg) s = s.slice(1);
  if (!s || [...s].some((ch) => DIG.indexOf(ch) < 0 || DIG.indexOf(ch) >= from)) return { error: `"${input.trim()}" is not a valid ${fromName} number.` };
  const steps = [];
  const digits = [...s];
  let dec = 0n;
  digits.forEach((ch) => (dec = dec * BigInt(from) + BigInt(DIG.indexOf(ch))));
  if (from !== 10) {
    const L = digits.length;
    const cells = digits.map((ch, i) => `<span class="pv"><b>${ch}</b><i>${from}<sup>${L - 1 - i}</sup></i></span>`).join("");
    steps.push({ title: `${fromName} to decimal`, text: `Multiply each digit by ${from} raised to its place, then add: ${digits.map((ch, i) => `${DIG.indexOf(ch)}×${from}^${L - 1 - i}`).join(" + ")} = ${dec}`, visual: `<div class="pvrow">${cells}</div>` });
  }
  let out;
  if (to === 10) out = dec.toString();
  else if (dec === 0n) out = "0";
  else {
    let q = dec; const rem = []; const rows = [];
    while (q > 0n) { const r = q % BigInt(to); rows.push(`<div class="divrow"><span>${q} ÷ ${to}</span><span>= ${q / BigInt(to)}</span><span class="r">remainder ${DIG[Number(r)]}</span></div>`); rem.push(DIG[Number(r)]); q /= BigInt(to); }
    out = rem.reverse().join("");
    steps.push({ title: `Decimal to ${toName}`, text: `Divide by ${to} again and again, keep the remainders. Read them from bottom to top: ${out}`, visual: `<div class="divtable">${rows.join("")}</div>` });
  }
  if (!steps.length) steps.push({ title: "Same base", text: "Nothing to convert, both bases are the same.", visual: "" });
  const value = (neg && out !== "0" ? "-" : "") + out;
  steps.push({ title: "Answer", text: `${input.trim()} (${fromName}) = ${value} (${toName})`, visual: `<div class="big-answer">${esc(value)}</div>` });
  return { result: { kind: "text", value }, steps };
}

// ---------- SETS ----------
const parseSet = (s) => {
  const out = [];
  s.split(",").map((x) => x.trim()).filter(Boolean).forEach((x) => { if (!out.includes(x)) out.push(x); });
  return out.every((x) => !isNaN(x)) ? out.sort((a, b) => a - b) : out;
};
export function setsDemo(opName, aText, bText) {
  const A = parseSet(aText), B = parseSet(bText);
  const inB = (x) => B.includes(x), inA = (x) => A.includes(x);
  const onlyA = A.filter((x) => !inB(x)), both = A.filter(inB), onlyB = B.filter((x) => !inA(x));
  const steps = [{ title: "Write the sets", text: "Duplicates are removed.", visual: row(`<div><div class="mx-label">A</div>${chips(A)}</div>`, `<div><div class="mx-label">B</div>${chips(B)}</div>`) }];
  let res, label;
  const NAMES = { union: "A ∪ B", intersection: "A ∩ B", difference: "A − B", symdiff: "A Δ B", cartesian: "A × B", power: "P(A)" };
  if (opName === "union") { res = [...A, ...onlyB]; steps.push({ title: "Take everything", text: "Union keeps every element that is in A or in B, each one once.", visual: chips(res, onlyB) }); }
  else if (opName === "intersection") { res = both; steps.push({ title: "Take the common ones", text: "Intersection keeps only elements found in both sets.", visual: chips(both, both) }); }
  else if (opName === "difference") { res = onlyA; steps.push({ title: "Remove B's elements from A", text: "Difference keeps elements of A that are not in B.", visual: chips(onlyA, onlyA) }); }
  else if (opName === "symdiff") { res = [...onlyA, ...onlyB]; steps.push({ title: "Elements in exactly one set", text: "Symmetric difference = (A − B) ∪ (B − A).", visual: chips(res, res) }); }
  else if (opName === "cartesian") { res = A.flatMap((a) => B.map((b) => `(${a}, ${b})`)); steps.push({ title: "Pair every a with every b", text: `${A.length} × ${B.length} = ${res.length} pairs.`, visual: chips(res.slice(0, 40)) + (res.length > 40 ? `<div class="mx-label">…and ${res.length - 40} more</div>` : "") }); }
  else {
    const n = Math.min(A.length, 6);
    const base = A.slice(0, n);
    res = [];
    for (let m = 0; m < 1 << n; m++) res.push("{" + base.filter((_, i) => m & (1 << i)).join(", ") + "}");
    res = res.map((x) => (x === "{}" ? "∅" : x));
    steps.push({ title: "Every possible subset", text: `A set with ${A.length} elements has 2^${A.length} = ${2 ** A.length} subsets${A.length > 6 ? " (demo shows the first 6 elements only)" : ""}.`, visual: chips(res.slice(0, 64)) });
  }
  label = NAMES[opName];
  const venn = ["union", "intersection", "difference", "symdiff"].includes(opName) ? { op: opName, onlyA, both, onlyB } : null;
  steps.push({ title: "Answer", text: `${label} = { ${res.join(", ") || "∅"} }`, visual: chips(res) });
  return { result: { kind: "set", label, value: res, venn }, steps };
}

// ---------- RELATIONS ----------
export function relationDemo(uText, rText) {
  const U = parseSet(uText);
  const pairs = [...rText.matchAll(/\(\s*([^,()]+?)\s*,\s*([^,()]+?)\s*\)/g)].map((m) => [m[1], m[2]]);
  if (!U.length) return { error: "Universal set is empty." };
  if (!pairs.length) return { error: "Could not read any pairs. Use the form (1,2),(2,3)." };
  const bad = pairs.find(([a, b]) => !U.includes(a) || !U.includes(b));
  if (bad) return { error: `(${bad[0]},${bad[1]}) uses an element that is not in the universal set.` };
  const has = (a, b) => pairs.some(([x, y]) => x === a && y === b);
  const uniq = pairs.filter(([a, b], i) => pairs.findIndex(([x, y]) => x === a && y === b) === i);
  const m = U.map((a) => U.map((b) => (has(a, b) ? "1" : "0")));
  const missingRef = U.filter((a) => !has(a, a));
  const symBad = uniq.find(([a, b]) => !has(b, a));
  const antiBad = uniq.find(([a, b]) => a !== b && has(b, a));
  let transBad = null;
  for (const [a, b] of uniq) for (const [c, d] of uniq) if (b === c && !has(a, d)) { transBad = [a, b, d]; break; }
  const props = [
    { name: "Reflexive", ok: !missingRef.length, why: missingRef.length ? `(${missingRef[0]},${missingRef[0]}) is missing.` : "Every element is related to itself." },
    { name: "Symmetric", ok: !symBad, why: symBad ? `(${symBad[0]},${symBad[1]}) is there but (${symBad[1]},${symBad[0]}) is not.` : "Every (a,b) has its (b,a)." },
    { name: "Antisymmetric", ok: !antiBad, why: antiBad ? `(${antiBad[0]},${antiBad[1]}) and (${antiBad[1]},${antiBad[0]}) are both there with different elements.` : "No two different elements are related both ways." },
    { name: "Transitive", ok: !transBad, why: transBad ? `(${transBad[0]},${transBad[1]}) and (${transBad[1]},${transBad[2]}) are there but (${transBad[0]},${transBad[2]}) is not.` : "Whenever (a,b) and (b,c) are there, (a,c) is too." },
  ];
  const steps = [
    { title: "Read the relation", text: `Universal set U and relation R with ${uniq.length} pairs.`, visual: row(`<div><div class="mx-label">U</div>${chips(U)}</div>`, `<div><div class="mx-label">R</div>${chips(uniq.map(([a, b]) => `(${a},${b})`))}</div>`) },
    ...props.map((p) => ({ title: `${p.name}: ${p.ok ? "Yes" : "No"}`, text: p.why, visual: `<div class="verdict ${p.ok ? "yes" : "no"}">${p.ok ? "Yes" : "No"}</div>` })),
  ];
  const kind = props[0].ok && props[1].ok && props[3].ok ? "Equivalence relation" : props[0].ok && props[2].ok && props[3].ok ? "Partial order" : "Neither equivalence nor partial order";
  steps.push({ title: "Answer", text: kind, visual: `<div class="big-answer small">${kind}</div>` });
  return { result: { kind: "relation", props, type: kind, U, pairs: uniq, matrix: m }, steps };
}

// ---------- PRACTICE ----------
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
export function practiceDemo(topic, level) {
  const L = ["Easy", "Medium", "Hard"].indexOf(level);
  if (topic === "Matrix") {
    if (L === 0) { const [a, b, c, d] = [rnd(1, 6), rnd(1, 6), rnd(1, 6), rnd(1, 6)]; return { question: `Find the determinant of [[${a}, ${b}], [${c}, ${d}]].`, answer: String(a * d - b * c), type: "number" }; }
    if (L === 1) { const A = [[rnd(1, 4), rnd(1, 4)], [rnd(1, 4), rnd(1, 4)]], B = [[rnd(1, 4), rnd(1, 4)], [rnd(1, 4), rnd(1, 4)]]; return { question: `For A = ${JSON.stringify(A)} and B = ${JSON.stringify(B)}, what is the top-left entry of A × B?`, answer: String(A[0][0] * B[0][0] + A[0][1] * B[1][0]), type: "number" }; }
    const M = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => rnd(0, 4)));
    return { question: `Find the determinant of ${JSON.stringify(M)}.`, answer: String(det(M.map((r) => r.map(F)))), type: "number" };
  }
  if (topic === "Sets") {
    const A = [...new Set(Array.from({ length: 4 + L }, () => rnd(1, 9)))].sort((a, b) => a - b), B = [...new Set(Array.from({ length: 4 + L }, () => rnd(1, 9)))].sort((a, b) => a - b);
    const U = [...new Set([...A, ...B])], I = A.filter((x) => B.includes(x));
    if (L === 0) return { question: `A = {${A}}, B = {${B}}. How many elements are in A ∪ B?`, answer: String(U.length), type: "number" };
    if (L === 1) return { question: `A = {${A}}, B = {${B}}. Write A ∩ B (comma separated, or 0 if empty).`, answer: I.length ? I.join(",") : "0", type: "set" };
    return { question: `A = {${A}}, B = {${B}}. Write A Δ B, the symmetric difference (comma separated, or 0 if empty).`, answer: [...A.filter((x) => !B.includes(x)), ...B.filter((x) => !A.includes(x))].sort((a, b) => a - b).join(",") || "0", type: "set" };
  }
  if (topic === "Relations") {
    const U = [1, 2, 3];
    const kinds = ["reflexive", "symmetric", "transitive"];
    const k = kinds[Math.min(L, 2)];
    const all = U.flatMap((a) => U.map((b) => [a, b]));
    const R = all.filter(() => Math.random() < 0.5);
    if (!R.length) R.push([1, 1]);
    const has = (a, b) => R.some(([x, y]) => x === a && y === b);
    const ok = k === "reflexive" ? U.every((a) => has(a, a)) : k === "symmetric" ? R.every(([a, b]) => has(b, a)) : R.every(([a, b]) => R.every(([c, d]) => b !== c || has(a, d)));
    return { question: `On U = {1, 2, 3}, R = {${R.map(([a, b]) => `(${a},${b})`).join(", ")}}. Is R ${k}? Answer yes or no.`, answer: ok ? "yes" : "no", type: "yn" };
  }
  if (L === 0) { const n = rnd(2, 15); return { question: `Convert ${n.toString(2)} (binary) to decimal.`, answer: String(n), type: "number" }; }
  if (L === 1) { const n = rnd(10, 63); return { question: `Convert ${n} (decimal) to binary.`, answer: n.toString(2), type: "text" }; }
  const n = rnd(32, 255); return { question: `Convert ${n.toString(16).toUpperCase()} (hexadecimal) to decimal.`, answer: String(n), type: "number" };
}
export function checkAnswerDemo(q, given) {
  const norm = (s) => String(s).toLowerCase().replace(/[{}\s]/g, "");
  if (q.type === "set") return norm(given).split(",").filter(Boolean).sort((a, b) => a - b).join(",") === norm(q.answer);
  return norm(given) === norm(q.answer);
}
