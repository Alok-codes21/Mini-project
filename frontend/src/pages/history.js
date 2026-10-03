import { getHistory, clearHistory } from "../api.js";
import { A, stagger, interactiveButtons } from "../lib/fx.js";

export default function init() {
  const tbody = document.querySelector(".history-table tbody");
  const wrap = document.querySelector(".history-table");
  const btn = document.createElement("button");
  btn.className = "clear-history"; btn.textContent = "Clear history";
  wrap.append(btn); interactiveButtons(wrap);
  const draw = () => {
    const rows = getHistory();
    tbody.innerHTML = rows.length
      ? rows.map((h) => `<tr><td>${new Date(h.date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</td><td>${h.module}</td><td>${h.operation}</td><td class="res">${h.result}</td><td><span class="pill">${h.status}</span></td></tr>`).join("")
      : `<tr><td colspan="5" class="empty">Nothing here yet. Solve something and it will show up.</td></tr>`;
    A(tbody.querySelectorAll("tr"), { opacity: [0, 1], x: [-24, 0] }, { duration: 0.4, delay: stagger(0.05) });
    btn.style.display = rows.length ? "" : "none";
  };
  btn.addEventListener("click", () => { clearHistory(); draw(); });
  draw();
}
