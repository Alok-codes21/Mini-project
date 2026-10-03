import { convertNumber, addHistory } from "../api.js";
import { exampleBar, setVal } from "../lib/extras.js";
import { mountPlayer, showLoading, showError, A, stagger } from "../lib/fx.js";

export default function init() {
  const input = document.getElementById("numberInput"), from = document.getElementById("fromBase"), to = document.getElementById("toBase");
  const resultBox = document.querySelector(".result-box"), stepsBox = document.querySelector(".explanation-box");
  const reset = () => { resultBox.textContent = "Converted value will appear here."; stepsBox.textContent = "Step-by-step conversion will appear here"; };

  const run = async () => {
    if (!input.value.trim()) return showError(resultBox, "Please enter a number.");
    showLoading(resultBox); showLoading(stepsBox);
    const res = await convertNumber(input.value, from.value, to.value);
    if (res.error) { stepsBox.textContent = "Step-by-step conversion will appear here"; return showError(resultBox, res.error); }
    const v = res.result.value;
    resultBox.innerHTML = `<div class="big-answer">${[...v].map((c) => `<span class="digit">${c}</span>`).join("")}</div>`;
    A(resultBox.querySelectorAll(".digit"), { opacity: [0, 1], y: [24, 0], filter: ["blur(6px)", "blur(0px)"] }, { duration: 0.5, delay: stagger(0.06) });
    mountPlayer(stepsBox, res.steps);
    addHistory({ module: "Converter", operation: `${from.value} → ${to.value}`, result: `${input.value.trim()} = ${v}` });
  };
  document.getElementById("convertBtn").addEventListener("click", run);
  input.addEventListener("keydown", (e) => e.key === "Enter" && run());
  document.getElementById("clearBtn").addEventListener("click", () => { input.value = ""; from.selectedIndex = 0; to.selectedIndex = 0; reset(); A(resultBox, { opacity: [0, 1] }, { duration: 0.3 }); });
  const ex = (v, f, t) => () => { setVal(input, v); from.value = f; to.value = t; run(); };
  exampleBar(".converter-section", [
    { label: "1011 binary → decimal", fill: ex("1011", "Binary", "Decimal") },
    { label: "156 decimal → binary", fill: ex("156", "Decimal", "Binary") },
    { label: "FF hex → decimal", fill: ex("FF", "Hexadecimal", "Decimal") },
    { label: "Swap bases", fill: () => { const f = from.value; from.value = to.value; to.value = f; [from, to].forEach((s) => A(s, { scale: [0.94, 1] }, { duration: 0.3 })); } },
  ]);
  // live hint: show the digits being typed as chips
  const hint = document.createElement("div"); hint.className = "live-digits"; input.after(hint);
  input.addEventListener("input", () => {
    hint.innerHTML = [...input.value.trim().toUpperCase()].map((c) => `<span>${c}</span>`).join("");
    A(hint.lastElementChild || [], { opacity: [0, 1], y: [8, 0], scale: [0.7, 1] }, { duration: 0.2 });
  });
  // swap on change: quick visual feedback
  [from, to].forEach((s) => s.addEventListener("change", () => A(s, { scale: [0.97, 1] }, { duration: 0.25 })));
}
