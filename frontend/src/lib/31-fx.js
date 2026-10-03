import { animate, stagger, inView, hover, press } from "motion";

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const A = (el, kf, opt) => (reduce ? animate(el, Object.fromEntries(Object.entries(kf).map(([k, v]) => [k, Array.isArray(v) ? v[v.length - 1] : v])), { duration: 0 }) : animate(el, kf, opt));
export { animate, stagger, A };

// ---- split an element's text into words and reveal them one by one ----
export function splitWords(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((w) => {
          if (!w) return;
          if (/^\s+$/.test(w)) return frag.append(w);
          const s = document.createElement("span");
          s.className = "fx-word" + (n.parentElement.closest("h1 > span, h1 span:not(.fx-word)") ? " in-span" : ""); s.textContent = w; frag.append(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(el);
  return [...el.querySelectorAll(".fx-word")];
}
export function revealWords(el, delay = 0) {
  const words = splitWords(el);
  A(words, { opacity: [0, 1], y: [22, 0], filter: ["blur(8px)", "blur(0px)"] }, { duration: 0.7, delay: stagger(0.07, { startDelay: delay }), ease: [0.22, 1, 0.36, 1] });
}

// ---- generic button hover / press ----
export function interactiveButtons(root = document) {
  root.querySelectorAll("button, .btn, .primary-btn, .secondary-btn, .module-card a, .close-popup-btn").forEach((b) => {
    if (b.dataset.fx) return; b.dataset.fx = "1";
    hover(b, () => { A(b, { y: -3 }, { duration: 0.18 }); return () => A(b, { y: 0 }, { duration: 0.18 }); });
    press(b, () => { A(b, { scale: 0.96 }, { duration: 0.1 }); return () => A(b, { scale: 1 }, { type: "spring", stiffness: 500, damping: 18 }); });
  });
}

// ---- cards fade/slide in when scrolled into view ----
export function revealOnScroll(selector) {
  document.querySelectorAll(selector).forEach((el) => {
    if (el.dataset.rv) return; el.dataset.rv = "1";
    el.style.opacity = "0";
    inView(el, () => { A(el, { opacity: [0, 1], y: [28, 0] }, { duration: 0.6, ease: [0.22, 1, 0.36, 1] }); }, { margin: "0px 0px -8% 0px" });
  });
}

// ---- sliding pill behind nav links ----
export function navPill() {
  const ul = document.querySelector(".nav-links");
  if (!ul) return;
  ul.style.position = "relative";
  const pill = document.createElement("span");
  pill.className = "nav-pill"; ul.prepend(pill);
  const links = [...ul.querySelectorAll("a")];
  const here = location.pathname.split("/").pop() || "index.html";
  const active = links.find((a) => a.getAttribute("href").toLowerCase() === here.toLowerCase()) || links[0];
  active.classList.add("is-current");
  const move = (a, instant) => {
    const r = a.getBoundingClientRect(), p = ul.getBoundingClientRect();
    A(pill, { x: r.left - p.left - 12, width: r.width + 24, opacity: 1 }, instant ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 });
  };
  move(active, true);
  links.forEach((a) => { a.addEventListener("mouseenter", () => move(a)); });
  ul.addEventListener("mouseleave", () => move(active));
  window.addEventListener("resize", () => move(active, true));
  document.fonts?.ready.then(() => move(active, true));
}

// ---- theme toggle icon spin ----
export function themeSpin() {
  const t = document.querySelector(".theme-toggle");
  t?.addEventListener("click", () => A(t.querySelector(".theme-icon"), { rotate: [-120, 0], scale: [0.5, 1] }, { type: "spring", stiffness: 260, damping: 14 }));
}

// ---- tab-style button groups with a sliding underline ----
export function tabGroup(group, onSelect) {
  group.style.position = "relative";
  group.classList.add("fx-tabs");
  const bar = document.createElement("span"); bar.className = "tab-bar"; group.append(bar);
  const btns = [...group.querySelectorAll("button")];
  const select = (btn, instant) => {
    btns.forEach((b) => b.classList.toggle("is-active", b === btn));
    const r = btn.getBoundingClientRect(), g = group.getBoundingClientRect();
    A(bar, { x: r.left - g.left + group.scrollLeft, y: r.top - g.top, width: r.width, height: r.height, opacity: 1 }, instant ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 });
  };
  btns.forEach((b) => b.addEventListener("click", () => select(b)));
  window.addEventListener("resize", () => { const a = group.querySelector(".is-active"); a && select(a, true); });
  return { select };
}

// ---- boxes ----
export function showLoading(box, label = "Working it out") {
  box.innerHTML = `<div class="ring-load" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100"><div class="rl-ring"><div><b>0%</b><small>Complete</small></div></div></div>`;
  const ring = box.querySelector(".rl-ring"), pct = box.querySelector("b");
  const c = animate(0, 92, { duration: 4, ease: [0.1, 0.7, 0.2, 1], onUpdate: (v) => { ring.style.setProperty("--p", v); pct.textContent = Math.round(v) + "%"; } });
  box._stopLoad = c;
}
export function showError(box, msg) {
  box.innerHTML = `<div class="err-msg">${String(msg).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</div>`;
  A(box.firstChild, { x: [-8, 8, -5, 5, 0], opacity: [0, 1] }, { duration: 0.4 });
}
export function pop(els) { A(els, { opacity: [0, 1], scale: [0.6, 1] }, { type: "spring", stiffness: 380, damping: 20, delay: stagger(0.04) }); }

// ---- count up ----
export function countUp(el, to, dur = 0.8) {
  const n = Number(to);
  if (!Number.isFinite(n)) { el.textContent = to; return; }
  A(0, n, { duration: dur, ease: "easeOut", onUpdate: (v) => (el.textContent = Math.round(v)) });
}

// ---- step player: prev / play / next, dots, progress, slide transitions ----
export function mountPlayer(box, steps, { autoplay = true, onDone } = {}) {
  if (box._timer) clearInterval(box._timer);
  let i = 0, dir = 1, timer = null;
  box.innerHTML = `
    <div class="player">
      <div class="p-head"><span class="p-count"></span><span class="p-pct"></span><div class="p-ctrl">
        <button class="p-btn" data-a="prev" aria-label="Previous step">‹</button>
        <button class="p-btn p-play" data-a="play" aria-label="Play or pause">❚❚</button>
        <button class="p-btn" data-a="next" aria-label="Next step">›</button>
      </div></div>
      <div class="p-bar"><i></i></div>
      <div class="p-stage"><div class="p-step"></div></div>
      <div class="p-dots"></div>
    </div>`;
  const $ = (s) => box.querySelector(s);
  const dots = steps.map((_, k) => { const d = document.createElement("button"); d.className = "p-dot"; d.setAttribute("aria-label", `Step ${k + 1}`); d.onclick = () => { stop(); go(k); }; return d; });
  $(".p-dots").append(...dots);
  const render = () => {
    const s = steps[i], el = $(".p-step");
    $(".p-count").textContent = `Step ${i + 1} of ${steps.length}`; { const pc = $(".p-pct"); if (pc) pc.textContent = `${Math.round(((i + 1) / steps.length) * 100)}%`; }
    el.innerHTML = `<h3>${s.title}</h3><p>${s.text}</p><div class="p-visual">${s.visual || ""}</div>`;
    dots.forEach((d, k) => d.classList.toggle("on", k === i));
    A($(".p-bar i"), { width: `${((i + 1) / steps.length) * 100}%` }, { duration: 0.4, ease: "easeOut" });
    A(el, { opacity: [0, 1], x: [dir * 40, 0] }, { duration: 0.45, ease: [0.22, 1, 0.36, 1] });
    const cells = el.querySelectorAll(".c.hl, .chip.hl, .pv, .divrow, .chip");
    if (cells.length) A(cells, { opacity: [0, 1], scale: [0.85, 1] }, { duration: 0.35, delay: stagger(0.025, { startDelay: 0.15 }) });
    if (i === steps.length - 1) { pop(el.querySelectorAll(".big-answer")); onDone?.(); }
  };
  const go = (k) => { dir = k >= i ? 1 : -1; i = Math.max(0, Math.min(steps.length - 1, k)); render(); };
  const stop = () => { clearInterval(timer); box._timer = null; $(".p-play").textContent = "▶"; };
  const play = () => {
    if (i >= steps.length - 1) go(0);
    $(".p-play").textContent = "❚❚";
    timer = setInterval(() => { if (!$(".p-play")) return clearInterval(timer); if (i >= steps.length - 1) return stop(); go(i + 1); }, steps.length > 12 ? 1000 : 2000);
    box._timer = timer;
  };
  box.querySelector("[data-a=prev]").onclick = () => { stop(); go(i - 1); };
  box.querySelector("[data-a=next]").onclick = () => { stop(); go(i + 1); };
  box.querySelector("[data-a=play]").onclick = () => (box._timer ? stop() : play());
  interactiveButtons(box);
  render();
  autoplay && steps.length <= 60 ? play() : stop();
}
