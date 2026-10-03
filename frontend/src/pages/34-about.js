import { A, stagger } from "../lib/fx.js";
export default function init() {
  document.querySelectorAll(".about-card").forEach((card) => {
    const li = card.querySelectorAll("li");
    if (!li.length) return;
    card.addEventListener("mouseenter", () => A(li, { x: [0, 6, 0] }, { duration: 0.4, delay: stagger(0.04) }));
  });
}
