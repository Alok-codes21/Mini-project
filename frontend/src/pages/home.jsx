import { createRoot } from "react-dom/client";
import HeroCard from "../react/HeroCard.jsx";
import { floatingSymbols, statsStrip } from "../lib/extras.js";
import { A, animate, stagger } from "../lib/fx.js";

export default function init() {
  // React hero card replaces the placeholder image
  const slot = document.querySelector(".hero-image");
  if (slot) { slot.innerHTML = ""; createRoot(slot).render(<HeroCard />); }

  const hero = document.querySelector(".hero"); if (hero) { hero.style.position = "relative"; floatingSymbols(hero); }
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
      card.style.transform = `perspective(700px) rotateX(${((y / r.height) - 0.5) * -6}deg) rotateY(${((x / r.width) - 0.5) * 6}deg) translateY(-4px)`;
    });
    card.addEventListener("mouseleave", () => (card.style.transform = ""));
  });

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
}
