/* Round 5 additions: NumberField cells, matrix type select, tab chevrons, text scramble, text roll,
   infinite slider, nav glyph ripple. Original code, Motion only. Frontend only. */
import { A } from "./fx.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- NumberField cells (- value +) for Matrix A / B ----
export function cellSteppers() {
  ["matrixA", "matrixB"].forEach((id) => {
    const box = document.getElementById(id); if (!box) return;
    const wrapAll = () => $$("input", box).forEach((inp) => {
      if (inp.closest(".nf-cell")) return;
      const w = document.createElement("span"); w.className = "nf-cell";
      inp.replaceWith(w);
      const mk = (cls, sign, label) => { const b = document.createElement("button"); b.type = "button"; b.tabIndex = -1; b.className = "nf-b " + cls; b.textContent = sign; b.setAttribute("aria-label", label);
        b.onclick = () => { const v = parseFloat(inp.value); const n = (isNaN(v) ? 0 : v) + (sign === "+" ? 1 : -1); inp.value = String(Math.round(n * 1e6) / 1e6); inp.dispatchEvent(new Event("input", { bubbles: true })); A(inp, { scale: [1.12, 1] }, { duration: 0.2 }); }; return b; };
      w.append(mk("nf-dec", "−", "Decrease cell"), inp, mk("nf-inc", "+", "Increase cell"));
    });
    new MutationObserver(wrapAll).observe(box, { childList: true, subtree: true }); wrapAll();
  });
}

// ---- Matrix type select (replaces the "fill with" presets) ----
export const TYPES = [["", "✎  Custom"], ["identity", "I  Identity"], ["zero", "0  Zero"], ["diagonal", "\\  Diagonal"], ["upper", "◥  Upper triangular"], ["lower", "◣  Lower triangular"], ["symmetric", "⇄  Symmetric"], ["random", "?  Random 0-9"]];
export function typeValue(kind, i, n) {
  const r = Math.floor(i / n), c = i % n, rnd = () => String(1 + Math.floor(Math.random() * 9));
  if (kind === "identity") return r === c ? "1" : "0";
  if (kind === "zero") return "0";
  if (kind === "diagonal") return r === c ? rnd() : "0";
  if (kind === "upper") return c >= r ? rnd() : "0";
  if (kind === "lower") return c <= r ? rnd() : "0";
  if (kind === "symmetric") { const a = Math.min(r, c), b = Math.max(r, c); return String(((a * 7 + b * 3) % 9) + 1); }
  if (kind === "random") return String(Math.floor(Math.random() * 10));
  return null;
}

// ---- tab group with scroll chevrons and fade edges ----
export function tabChevrons(sel = ".operations .button-group") {
  $$(sel).forEach((g) => {
    if (g.parentElement.classList.contains("tabs-scroll")) return;
    const w = document.createElement("div"); w.className = "tabs-scroll"; g.before(w); w.append(g);
    const l = document.createElement("button"), r = document.createElement("button");
    [l, r].forEach((b, i) => { b.type = "button"; b.className = "tc " + (i ? "tc-r" : "tc-l"); b.setAttribute("aria-label", i ? "Scroll tabs right" : "Scroll tabs left"); b.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="${i ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"}"/></svg>`; b.onclick = () => g.scrollBy({ left: (i ? 1 : -1) * Math.max(120, g.clientWidth * 0.6), behavior: "smooth" }); });
    w.append(l, r);
    const upd = () => { const max = g.scrollWidth - g.clientWidth - 1; w.classList.toggle("can-l", g.scrollLeft > 2); w.classList.toggle("can-r", g.scrollLeft < max); };
    g.addEventListener("scroll", upd, { passive: true }); addEventListener("resize", upd); new ResizeObserver(upd).observe(g); upd();
  });
}

// ---- text scramble (letters shuffle then settle left to right) ----
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-=×÷∑∫√π";
export function scramble(el, { duration = 900 } = {}) {
  if (reduce || el._scr) return;
  const txt = (el.dataset.scr ?? (el.dataset.scr = el.textContent.replace(/\s+/g, " ").trim())), n = txt.length; el._scr = true;
  el.setAttribute("aria-label", txt); const t0 = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / duration); let out = "";
    for (let i = 0; i < n; i++) { const ch = txt[i]; out += ch === " " || ch === "\n" ? ch : p * 1.25 - (i / n) * 0.25 > 0.9 || i / n < (p - 0.1) * 1.12 ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]; }
    el.textContent = out;
    if (p < 1) requestAnimationFrame(tick); else { el.textContent = txt; el._scr = false; }
  };
  requestAnimationFrame(tick);
}
export function scrambleOnView(els) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); scramble(e.target, { duration: 800 + Math.min(600, e.target.textContent.length * 4) }); } }), { threshold: 0.6 });
  els.forEach((e) => io.observe(e));
}

// ---- text roll (each letter rolls up and a copy rolls in, staggered) ----
export function textRoll(el, trigger = el) {
  if (!el || el.dataset.roll) return; el.dataset.roll = "1";
  const txt = el.textContent; el.setAttribute("aria-label", txt);
  el.innerHTML = [...txt].map((c) => c === " " ? `<span class="rl-sp"> </span>` : `<span class="rl" aria-hidden="true"><span class="rl-in"><i>${c}</i><i>${c}</i></span></span>`).join("");
  const chars = $$(".rl-in", el); let busy = false;
  const run = async () => {
    if (busy || reduce) return; busy = true;
    await Promise.all(chars.map((c, i) => A(c, { y: ["0%", "-50%"] }, { duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] })));
    chars.forEach((c) => (c.style.transform = "")); busy = false;
  };
  ["pointerenter", "focusin", "pointerdown"].forEach((ev) => trigger.addEventListener(ev, run));
  return run;
}

// ---- infinite slider of tool cards (auto-scroll, slows on hover, edge fade) ----
const ART = {
  matrix: `<svg viewBox="0 0 120 80"><g fill="none" stroke="#2563eb" stroke-width="2"><path d="M20 12v56M100 12v56M20 12h8M20 68h8M100 12h-8M100 68h-8"/></g><g fill="#2563eb"><rect x="34" y="20" width="14" height="14" rx="3"/><rect x="53" y="20" width="14" height="14" rx="3" opacity=".4"/><rect x="72" y="20" width="14" height="14" rx="3" opacity=".4"/><rect x="34" y="40" width="14" height="14" rx="3" opacity=".4"/><rect x="53" y="40" width="14" height="14" rx="3"/><rect x="72" y="40" width="14" height="14" rx="3" opacity=".4"/></g></svg>`,
  sets: `<svg viewBox="0 0 120 80"><circle cx="46" cy="40" r="26" fill="#2563eb" opacity=".35"/><circle cx="74" cy="40" r="26" fill="#7c3aed" opacity=".35"/><path d="M60 18a26 26 0 0 1 0 44a26 26 0 0 1 0-44z" fill="#1d4ed8" opacity=".75"/></svg>`,
  relation: `<svg viewBox="0 0 120 80"><g stroke="#2563eb" stroke-width="2" fill="none"><path d="M30 55 60 20 90 55M30 55h60"/></g><g fill="#2563eb"><circle cx="30" cy="55" r="7"/><circle cx="60" cy="20" r="7"/><circle cx="90" cy="55" r="7"/></g></svg>`,
  convert: `<svg viewBox="0 0 120 80"><text x="60" y="36" text-anchor="middle" font-family="monospace" font-size="20" fill="#2563eb" font-weight="700">156</text><path d="M60 44v10m-6-4 6 6 6-6" stroke="#2563eb" stroke-width="2.4" fill="none"/><text x="60" y="72" text-anchor="middle" font-family="monospace" font-size="16" fill="#7c3aed" font-weight="700">10011100</text></svg>`,
  practice: `<svg viewBox="0 0 120 80"><rect x="22" y="14" width="76" height="52" rx="8" fill="none" stroke="#2563eb" stroke-width="2.4"/><path d="m40 42 12 12 28-28" stroke="#ec4899" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  history: `<svg viewBox="0 0 120 80"><circle cx="60" cy="40" r="26" fill="none" stroke="#2563eb" stroke-width="2.4"/><path d="M60 24v17l12 8" stroke="#2563eb" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
};
const SLIDES = [["Matrix Visualizer", "Matrix.html", "matrix", "Add, multiply, determinant"], ["Set Operations", "set.html", "sets", "Venn diagrams, power sets"], ["Relation Graphs", "relation.html", "relation", "Graphs and matrices"], ["Number Converter", "converter.html", "convert", "Binary, octal, hex"], ["Practice Mode", "practice.html", "practice", "Questions with feedback"], ["History", "history.html", "history", "Your past solves"]];
export function infiniteSlider(after) {
  if (!after) return;
  const sec = document.createElement("section"); sec.className = "inf-slider"; sec.setAttribute("aria-label", "Tools");
  const card = ([t, h, k, d]) => `<a class="inf-card" href="${h}" tabindex="-1"><div class="inf-art">${ART[k]}</div><b>${t}</b><span>${d}</span></a>`;
  const row = SLIDES.map(card).join("");
  sec.innerHTML = `<h2>Jump into a tool</h2><div class="inf-view"><div class="inf-track">${row}${row}${row}</div></div>`;
  after.after(sec);
  const track = $(".inf-track", sec), view = $(".inf-view", sec);
  let x = 0, speed = 1, target = 1, last = 0, vis = true;
  new IntersectionObserver(([e]) => (vis = e.isIntersecting)).observe(sec);
  view.addEventListener("pointerenter", () => (target = 0.18)); view.addEventListener("pointerleave", () => (target = 1));
  const loop = (now) => {
    const dt = Math.min(48, now - (last || now)); last = now;
    if (vis && !reduce) { speed += (target - speed) * 0.08; x -= (dt * 0.05) * speed; const w = track.scrollWidth / 3; if (x <= -w) x += w; track.style.transform = `translate3d(${x}px,0,0)`; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// ---- nav hover: glyph field ripples under the nav + links brighten ----
export function navRipple(fieldHost) {
  const nav = $(".navbar"); if (!nav || !fieldHost) return;
  nav.addEventListener("pointermove", (e) => { if (e.pointerType === "touch") return; fieldHost.dispatchEvent(new PointerEvent("pointermove", { clientX: e.clientX, clientY: e.clientY, pointerType: "mouse" })); });
  nav.addEventListener("pointerleave", () => fieldHost.dispatchEvent(new PointerEvent("pointerleave")));
}
