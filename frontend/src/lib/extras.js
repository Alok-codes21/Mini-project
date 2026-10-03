import { animate, scroll, hover } from "motion";
import { A, stagger, interactiveButtons, countUp } from "./fx.js";

// thin scroll progress bar + back-to-top
export function scrollUI() {
  const bar = document.createElement("div"); bar.className = "scroll-bar"; document.body.append(bar);
  scroll(animate(bar, { scaleX: [0, 1] }, { ease: "linear" }));
  const up = document.createElement("button");
  up.className = "to-top"; up.setAttribute("aria-label", "Back to top"); up.textContent = "↑";
  document.body.append(up);
  let shown = false;
  addEventListener("scroll", () => {
    const s = scrollY > 500;
    if (s !== shown) { shown = s; A(up, { opacity: s ? 1 : 0, y: s ? 0 : 20, scale: s ? 1 : 0.8 }, { duration: 0.25 }); up.style.pointerEvents = s ? "auto" : "none"; }
  }, { passive: true });
  up.onclick = () => scrollTo({ top: 0, behavior: "smooth" });
  interactiveButtons(document.body);
}

// click ripple on buttons
export function ripples() {
  document.addEventListener("pointerdown", (e) => {
    const b = e.target.closest("button, .primary-btn, .secondary-btn, .btn");
    if (!b || b.classList.contains("p-dot") || b.classList.contains("hc-dots")) return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2;
    const s = document.createElement("span"); s.className = "ripple";
    s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    if (getComputedStyle(b).position === "static") b.style.position = "relative";
    b.style.overflow = "hidden"; b.append(s);
    A(s, { scale: [0, 1], opacity: [0.35, 0] }, { duration: 0.6 }).then(() => s.remove());
  });
}

// magnetic pull on main call-to-action buttons
export function magnetic(sel) {
  document.querySelectorAll(sel).forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      A(el, { x: (e.clientX - r.left - r.width / 2) * 0.25, y: (e.clientY - r.top - r.height / 2) * 0.35 }, { duration: 0.2 });
    });
    el.addEventListener("mouseleave", () => A(el, { x: 0, y: 0 }, { type: "spring", stiffness: 300, damping: 14 }));
  });
}

// smooth fade when leaving a page
export function pageExit() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || u.pathname === location.pathname || !u.pathname.endsWith(".html")) return;
    e.preventDefault();
    A(document.body, { opacity: 0, y: -8 }, { duration: 0.22 }).then(() => (location.href = a.href));
  });
}

// floating math symbols that drift and lean away from the cursor (home hero)
export function floatingSymbols(host) {
  const syms = ["∑", "π", "∫", "√", "∞", "Δ", "≠", "θ", "÷", "%"];
  const layer = document.createElement("div"); layer.className = "sym-layer"; host.prepend(layer);
  const els = syms.map((s, i) => {
    const e = document.createElement("span"); e.textContent = s;
    e.style.cssText = `left:${(i * 37 + 8) % 92}%;top:${(i * 53 + 10) % 85}%;font-size:${22 + (i % 4) * 10}px`;
    layer.append(e);
    animate(e, { y: [0, i % 2 ? -22 : 22, 0], rotate: [0, i % 2 ? 12 : -12, 0] }, { duration: 6 + (i % 5), repeat: Infinity, ease: "easeInOut" });
    return e;
  });
  A(els, { opacity: [0, 0.22] }, { duration: 1.2, delay: stagger(0.1) });
  host.addEventListener("mousemove", (e) => {
    const r = host.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    A(layer, { x: -x * 30, y: -y * 20 }, { duration: 0.5 });
  });
}

// stats strip with count-up when in view
export function statsStrip(after) {
  const sec = document.createElement("section"); sec.className = "stats";
  const data = [[4, "Learning modules"], [6, "Matrix operations"], [6, "Set operations"], [4, "Relation properties"]];
  sec.innerHTML = data.map(([n, l]) => `<div class="stat"><b data-n="${n}">0</b><span>${l}</span></div>`).join("");
  after.after(sec);
  import("motion").then(({ inView }) => inView(sec, () => {
    sec.querySelectorAll("b").forEach((b) => countUp(b, b.dataset.n, 1));
    A(sec.querySelectorAll(".stat"), { opacity: [0, 1], y: [24, 0] }, { duration: 0.5, delay: stagger(0.1) });
  }));
  sec.querySelectorAll(".stat").forEach((s) => (s.style.opacity = 0));
}

// "Try an example" chips under a page's inputs
export function exampleBar(anchorSel, examples) {
  const anchor = document.querySelector(anchorSel);
  if (!anchor) return;
  const bar = document.createElement("div"); bar.className = "examples";
  bar.innerHTML = `<span>Try an example:</span>` + examples.map((e, i) => `<button type="button" data-i="${i}">${e.label}</button>`).join("");
  anchor.after(bar);
  bar.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => examples[b.dataset.i].fill()));
  A(bar.querySelectorAll("button"), { opacity: [0, 1], y: [10, 0] }, { duration: 0.4, delay: stagger(0.06, { startDelay: 0.6 }) });
  interactiveButtons(bar);
}

export const setVal = (el, v) => {
  el.value = v; el.dispatchEvent(new Event("input", { bubbles: true }));
  A(el, { scale: [1, 1.04, 1], boxShadow: ["0 0 0 0 rgba(37,99,235,0)", "0 0 0 4px rgba(37,99,235,.25)", "0 0 0 0 rgba(37,99,235,0)"] }, { duration: 0.5 });
};
