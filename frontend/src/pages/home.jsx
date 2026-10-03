import { createRoot } from "react-dom/client";
import AIHeroCard from "../react/AIHeroCard.jsx";
import { mountAsciiField } from "../lib/ascii-field.js";
import { floatingSymbols, statsStrip } from "../lib/extras.js";
import { A, animate, stagger } from "../lib/fx.js";
import { scrambleOnView, textRoll, infiniteSlider, navRipple } from "../lib/ui25.js";

export default function init() {
  // React hero card replaces the placeholder image
  const slot = document.querySelector(".hero-image");
  if (slot) { slot.innerHTML = ""; createRoot(slot).render(<AIHeroCard />); }

  const hero = document.querySelector(".hero");
  if (hero) {
    hero.classList.add("hero-motion");
    const field = document.createElement("div"); field.className = "hero-field"; hero.prepend(field);
    mountAsciiField(field);
    navRipple(field);
  }
  const atTop = () => document.body.classList.toggle("at-top", scrollY < 12); atTop(); addEventListener("scroll", atTop, { passive: true });
  const m = document.querySelector(".marquee"); 
  // hero buttons: real destinations
  document.querySelectorAll(".primary-btn").forEach((b) => b.setAttribute("href", "Matrix.html"));
  document.querySelector(".secondary-btn")?.setAttribute("href", "#modules");
  document.querySelector(".modules")?.setAttribute("id", "modules");
  document.querySelectorAll(".nav-actions .btn").forEach((b) => b.setAttribute("href", "practice.html"));

  // spotlight + tilt on feature / module cards
  document.querySelectorAll(".feature-card, .module-card").forEach((card) => {
    card.classList.add("spot");
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      card.style.setProperty("--mx", `${x}px`); card.style.setProperty("--my", `${y}px`);
    });
    
  });

  // 6. round close X on every tool popup
  document.querySelectorAll(".popup-content").forEach((c) => { const x = document.createElement("button"); x.type = "button"; x.className = "popup-x"; x.setAttribute("aria-label", "Close"); x.textContent = "✕"; x.onclick = () => c.querySelector(".close-popup-btn")?.click(); c.prepend(x); });
  // popup open animation
  document.querySelectorAll(".popup-overlay").forEach((o) => {
    new MutationObserver(() => {
      if (!o.classList.contains("hidden")) {
        A(o, { opacity: [0, 1] }, { duration: 0.2 });
        A(o.querySelector(".popup-content"), { opacity: [0, 1], scale: [0.88, 1], y: [24, 0] }, { type: "spring", stiffness: 320, damping: 24 });
      }
    }).observe(o, { attributes: true, attributeFilter: ["class"] });
  });

  // auto-sliding strip (right to left)
  const feat = document.querySelector(".features");
  if (feat) {
    const items = ["Matrix Visualizer", "Set Operations", "Relation Graphs", "Number Converter", "Step-by-Step", "Practice Mode", "History"];
    const strip = document.createElement("div");
    strip.className = "marquee";
    const row = items.concat(items).map((t) => `<span>${t}</span>`).join("");
    strip.innerHTML = `<div class="m-track">${row}${row}</div>`;
    feat.after(strip);
    statsStrip(strip);
    const track = strip.firstChild;
    const anim = animate(track, { x: ["0%", "-50%"] }, { duration: 40, ease: "linear", repeat: Infinity });
    strip.addEventListener("mouseenter", () => anim.pause());
    strip.addEventListener("mouseleave", () => anim.play());
  }

  // round 5: scramble, roll, slider
  scrambleOnView([document.querySelector(".hero-text p"), ...document.querySelectorAll(".feature-card p, .feature-subtitle, .module-subtitle")].filter(Boolean));
  document.querySelectorAll(".nav-links a").forEach((a) => { if (!a.children.length) textRoll(a); });
  document.querySelectorAll(".feature-card h3, .module-card h3").forEach((h) => textRoll(h, h.closest(".feature-card, .module-card")));
  infiniteSlider(document.querySelector(".modules"));
}
