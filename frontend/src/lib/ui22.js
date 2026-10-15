/* UI polish pack (items 1-22 of the animation list). Everything here is DOM enhancement on top of the
   existing pages, built with Motion (free). It never touches api.js / backend-adapter.js. */
import { A } from "./fx.js";
import { setVal } from "./extras.js";
import { TYPES, typeValue, cellSteppers, tabChevrons } from "./ui25.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const spring = { type: "spring", stiffness: 420, damping: 32 };
const PAGE_NAMES = { index: "Home", set: "Sets", matrix: "Matrices", relation: "Relations", converter: "Converter", practice: "Practice", history: "History", about: "About" };

// ---- 5. breadcrumbs ----
export function breadcrumbs() {
  const page = document.body.dataset.page;
  if (!page || page === "index") return;
  const nav = document.createElement("nav");
  nav.className = "crumbs"; nav.setAttribute("aria-label", "Breadcrumb");
  nav.innerHTML = `<a href="index.html">Home</a><i>›</i><span class="crumb-page">${PAGE_NAMES[page] || page}</span><span class="crumb-op" hidden><i>›</i><b></b></span>`;
  $("header")?.after(nav);
  A(nav, { opacity: [0, 1], y: [-8, 0] }, { duration: 0.4 });
  const op = $(".crumb-op", nav);
  $$(".operations .button-group button").forEach((b) => b.addEventListener("click", () => {
    op.hidden = false; $("b", op).textContent = b.textContent.replace(/\s*·.*$/, "");
    A(op, { opacity: [0, 1], x: [-8, 0] }, { duration: 0.3 });
  }));
}

// ---- 1. NumberField stepper for the matrix size ----
export function sizeStepper() {
  const input = $("#matrixSize"); if (!input) return;
  input.max = 6; input.min = 1;
  const wrap = document.createElement("div"); wrap.className = "numfield";
  wrap.innerHTML = `<button type="button" aria-label="Decrease size">−</button><output></output><button type="button" aria-label="Increase size">+</button>`;
  input.style.display = "none"; input.after(wrap);
  const [dec, , inc] = wrap.children, out = $("output", wrap);
  const draw = (bump) => {
    const v = +input.value || 2; out.textContent = v; dec.disabled = v <= 1; inc.disabled = v >= 6;
    if (bump) A(out, { y: [bump * 10, 0], opacity: [0, 1] }, { duration: 0.22 });
  };
  const set = (v) => { v = Math.max(1, Math.min(6, v)); const cur = +input.value; if (v === cur) return; input.value = v; draw(v > cur ? 1 : -1); input.dispatchEvent(new Event("change", { bubbles: true })); };
  dec.onclick = () => set((+input.value || 2) - 1); inc.onclick = () => set((+input.value || 2) + 1);
  input.value = input.value || 2; draw();
  const label = $("label[for=matrixSize]"); if (label) label.textContent = "Matrix size";
  const hint = $(".size-hint"); if (hint) hint.textContent = "1 to 6. Determinant works up to 4 x 4. The size creates a square Matrix A and Matrix B.";
}

// ---- 4. animated select (wraps a native <select>; native stays as the value source) ----
export function enhanceSelect(native, { onPick } = {}) {
  const wrap = document.createElement("div"); wrap.className = "dd";
  native.after(wrap); wrap.append(native); native.classList.add("dd-native"); native.tabIndex = -1;
  const btn = document.createElement("button"); btn.type = "button"; btn.className = "dd-btn"; btn.setAttribute("aria-haspopup", "listbox");
  const menu = document.createElement("ul"); menu.className = "dd-menu"; menu.setAttribute("role", "listbox"); menu.hidden = true;
  wrap.append(btn, menu);
  const label = () => (btn.innerHTML = `<span>${native.options[native.selectedIndex]?.text ?? ""}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 9 6 6 6-6"/></svg>`);
  const build = () => { menu.innerHTML = [...native.options].map((o, i) => `<li role="option" data-i="${i}" class="${i === native.selectedIndex ? "on" : ""}">${o.text}</li>`).join(""); label(); };
  let open = false;
  const toggle = (v) => {
    open = v; btn.setAttribute("aria-expanded", v);
    if (v) { build(); menu.hidden = false; A(menu, { opacity: [0, 1], y: [-8, 0], scale: [0.96, 1] }, { type: "spring", stiffness: 500, damping: 32 }); A($$("li", menu), { opacity: [0, 1], x: [-8, 0] }, { duration: 0.2, delay: (i) => i * 0.025 }); }
    else A(menu, { opacity: 0, y: -6 }, { duration: 0.14 }).then(() => { if (!open) menu.hidden = true; });
  };
  btn.onclick = () => toggle(!open);
  menu.onclick = (e) => { const li = e.target.closest("li"); if (!li) return; native.selectedIndex = +li.dataset.i; native.dispatchEvent(new Event("change", { bubbles: true })); onPick?.(native.value); label(); toggle(false); };
  document.addEventListener("click", (e) => open && !wrap.contains(e.target) && toggle(false));
  document.addEventListener("keydown", (e) => e.key === "Escape" && open && toggle(false));
  build(); return wrap;
}

// ---- 4. matrix type select (Country-style dropdown) for Matrix A / B ----
export function matrixPresets() {
  $$(".matrix-card").forEach((card) => {
    const grid = $(".matrix-grid-container", card); if (!grid) return;
    const sel = document.createElement("select");
    sel.innerHTML = TYPES.map(([v, t]) => `<option value="${v}">${t}</option>`).join("");
    const row = document.createElement("div"); row.className = "preset-row"; row.innerHTML = `<span class="preset-lab">Matrix type</span>`; row.append(sel);
    $("h2", card).after(row);
    enhanceSelect(sel, { onPick: (v) => {
      const ins = $$("input", grid), n = Math.round(Math.sqrt(ins.length));
      if (!v) return;
      ins.forEach((el, i) => setTimeout(() => setVal(el, typeValue(v, i, n)), i * 30));
    } });
    grid.addEventListener("input", () => {});
  });
}

// ---- 2/3. press feedback for the pill buttons ----
export function pillButtons() {
  $$("#generateBtn, .button-group button, .primary-btn, .secondary-btn, .btn").forEach((b) => b.classList.add("pill-btn"));
}

// ---- 9. search field (History filter + navbar page search) ----
const SEARCH_INDEX = [["Home", "index.html"], ["Set operations (union, intersection, difference)", "set.html"], ["Matrix visualizer (add, multiply, determinant)", "Matrix.html"], ["Relations (reflexive, symmetric, transitive)", "relation.html"], ["Number converter (binary, octal, hex)", "converter.html"], ["Practice questions", "practice.html"], ["History", "history.html"], ["About", "about.html"]];
const searchIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;
export function historySearch() {
  const table = $(".history-table"); if (!table) return;
  const f = document.createElement("div"); f.className = "sf";
  f.innerHTML = `${searchIcon}<input type="search" placeholder="Search your history…" aria-label="Search history"><button type="button" class="sf-x" aria-label="Clear search" hidden>✕</button>`;
  table.prepend(f);
  const inp = $("input", f), x = $(".sf-x", f);
  const run = () => { const q = inp.value.trim().toLowerCase(); x.hidden = !q; $$("tbody tr", table).forEach((tr) => { const hit = !q || tr.textContent.toLowerCase().includes(q); tr.style.display = hit ? "" : "none"; }); };
  inp.addEventListener("input", run); x.onclick = () => { inp.value = ""; run(); inp.focus(); };
  new MutationObserver(run).observe($("tbody", table), { childList: true });
}
export function navSearch() {
  const actions = $(".nav-actions"); if (!actions) return;
  const box = document.createElement("div"); box.className = "nsearch";
  box.innerHTML = `<button type="button" class="ns-btn" aria-label="Search">${searchIcon}</button><input type="search" placeholder="Search pages…" aria-label="Search pages"><ul class="ns-list" hidden></ul>`;
  actions.prepend(box);
  const btn = $(".ns-btn", box), inp = $("input", box), list = $(".ns-list", box); let open = false;
  const show = (v) => { open = v; box.classList.toggle("open", v); if (v) inp.focus(); else { list.hidden = true; inp.value = ""; } };
  const draw = () => { const q = inp.value.trim().toLowerCase(); const hits = q ? SEARCH_INDEX.filter(([t]) => t.toLowerCase().includes(q)) : []; list.hidden = !hits.length; list.innerHTML = hits.map(([t, h]) => `<li><a href="${h}">${t}</a></li>`).join(""); if (hits.length) A(list, { opacity: [0, 1], y: [-6, 0] }, { duration: 0.18 }); };
  btn.onclick = () => show(!open); inp.addEventListener("input", draw);
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") $("a", list)?.click(); if (e.key === "Escape") show(false); });
  document.addEventListener("click", (e) => open && !box.contains(e.target) && show(false));
}

// ---- 11/16. textareas with a border trail on focus ----
export function trailTextareas() {
  $$("input#setA, input#setB, input#universalSet, input#relationInput").forEach((inp) => {
    const ta = document.createElement("textarea");
    ["id", "placeholder", "value"].forEach((k) => (ta[k] = inp[k]));
    ta.rows = 2; ta.spellcheck = false; ta.setAttribute("aria-label", inp.id);
    ta.addEventListener("input", () => { if (ta.value.includes("\n")) { const p = ta.selectionStart; ta.value = ta.value.replace(/\n+/g, ", "); ta.selectionStart = ta.selectionEnd = p; } });
    ta.addEventListener("keydown", (e) => e.key === "Enter" && e.preventDefault());
    const trail = document.createElement("div"); trail.className = "trail"; trail.append(ta);
    inp.replaceWith(trail);
  });
}

// ---- 14. sliding highlight pill across cards ----
export function cardPill(containerSel, cardSel) {
  const box = $(containerSel); if (!box) return;
  box.style.position = "relative";
  const pill = document.createElement("span"); pill.className = "card-pill"; box.prepend(pill);
  let shown = false;
  const go = (card) => {
    const r = card.getBoundingClientRect(), b = box.getBoundingClientRect();
    A(pill, { x: r.left - b.left, y: r.top - b.top, width: r.width, height: r.height, opacity: 1 }, shown ? spring : { duration: 0 }); shown = true;
  };
  $$(cardSel, box).forEach((c) => { c.addEventListener("pointerenter", () => go(c)); c.addEventListener("focusin", () => go(c)); });
  box.addEventListener("pointerleave", () => { shown = false; A(pill, { opacity: 0 }, { duration: 0.2 }); });
}

// ---- 15. "Show more" disclosure ----
export function showMore(containerSel, visible = 3) {
  const box = $(containerSel); if (!box) return;
  const cards = [...box.children].filter((c) => !c.classList.contains("card-pill"));
  const extra = cards.slice(visible); if (!extra.length) return;
  const wrap = document.createElement("div"); wrap.className = "more-wrap"; wrap.style.cssText = "grid-column:1/-1;overflow:hidden;height:0;display:grid;";
  extra.forEach((c) => wrap.append(c)); box.append(wrap);
  const lay = () => { const cs = getComputedStyle(box); wrap.style.gridTemplateColumns = cs.gridTemplateColumns; wrap.style.gap = cs.gap; wrap.style.display = "grid"; }; lay(); addEventListener("resize", lay);
  const btn = document.createElement("button"); btn.type = "button"; btn.className = "more-btn"; btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = `<span>Show more</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 9 6 6 6-6"/></svg>`;
  box.after(btn);
  let open = false;
  btn.onclick = async () => {
    open = !open; btn.setAttribute("aria-expanded", open); $("span", btn).textContent = open ? "Show less" : "Show more";
    A($("svg", btn), { rotate: open ? 180 : 0 }, spring);
    const h = wrap.scrollHeight;
    if (open) { await A(wrap, { height: [0, h] }, { type: "spring", stiffness: 260, damping: 30 }); wrap.style.height = "auto"; A($$(":scope > *", wrap), { opacity: [0, 1], y: [14, 0] }, { duration: 0.3 }); }
    else { wrap.style.height = h + "px"; await A(wrap, { height: 0 }, { type: "spring", stiffness: 300, damping: 34 }); }
  };
}

// ---- 18. theme switch: slider that follows the device light/dark setting ----
export function themeSwitch() {
  const t = $(".theme-toggle"); if (!t) return;
  t.classList.add("tsw");
  const knob = $(".theme-icon", t); t.insertAdjacentHTML("afterbegin", `<span class="tsw-stars"><i></i><i></i><i></i></span>`);
  const sync = (instant) => { const dark = document.body.classList.contains("dark"); A(knob, { x: dark ? 28 : 0 }, instant ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 24 }); };
  new MutationObserver(() => sync(false)).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const follow = (dark) => { if (document.body.classList.contains("dark") !== dark) t.click(); };
  if (!localStorage.getItem("mathvision-theme") && mq.matches) follow(true);
  mq.addEventListener("change", (e) => follow(e.matches)); // device goes dark/light -> slider slides by itself
  sync(true);
}

// ---- 19. blur layer at the top while scrolling ----
export function topBlur() {
  const d = document.createElement("div"); d.className = "top-blur"; d.setAttribute("aria-hidden", "true"); document.body.append(d);
  const on = () => d.classList.toggle("on", scrollY > 8); on(); addEventListener("scroll", on, { passive: true });
}

// ---- 20. logo with spinning text ring ----
export function logoRing() {
  $$(".logo").forEach((logo, i) => {
    const txt = logo.textContent.trim() || "MathVision";
    const id = `lr${i}`;
    logo.innerHTML = `<span class="logo-mark" aria-hidden="true"><svg viewBox="0 0 100 100"><defs><path id="${id}" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0"/></defs><text><textPath href="#${id}" textLength="236">MATHVISION • MATHVISION • </textPath></text></svg><b>∑</b></span><span class="logo-word">${txt}</span>`;
  });
}

export function initUI22() {
  topBlur(); logoRing(); breadcrumbs(); themeSwitch(); navSearch(); pillButtons();
  const page = document.body.dataset.page;
  if (page === "matrix") { sizeStepper(); matrixPresets(); cellSteppers(); }
  if (page === "matrix" || page === "set") tabChevrons();
  if (page === "set" || page === "relation") trailTextareas();
  if (page === "converter") $$("select").forEach((s) => enhanceSelect(s));
  if (page === "history") historySearch();
  if (page === "index") { cardPill(".feature-container", ".feature-card"); cardPill(".module-container", ".module-card"); showMore(".module-container", 3); }
}
