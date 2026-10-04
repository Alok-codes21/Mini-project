import { solveMatrix, addHistory, backendEnabled } from "../api.js";
import { Fr, grid } from "../ui-helpers.js";
import { exampleBar, setVal } from "../lib/extras.js";
import { tabGroup, mountPlayer, showLoading, showError, pop, A } from "../lib/fx.js";

const OPS = {
  addBtn: ["add", "Addition", 2], subBtn: ["sub", "Subtraction", 2], multBtn: ["mult", "Multiplication", 2],
  transposeBtn: ["transpose", "Transpose", 1], determinantBtn: ["determinant", "Determinant", 1], inverseBtn: ["inverse", "Inverse", 1],
};

const readMatrix = (id) => {
  const inputs = [...document.querySelectorAll(`#${id} input`)];
  const n = Math.round(Math.sqrt(inputs.length));
  const vals = inputs.map((i) => i.value.trim());
  if (vals.some((v) => v === "")) return { error: "Fill every cell of the matrix first." };
  if (vals.some((v) => !Fr.parse(v))) return { error: "Only numbers are allowed in the matrix." };
  return { M: Array.from({ length: n }, (_, r) => vals.slice(r * n, r * n + n).map((v) => Fr.parse(v))) };
};

export default function init() {
  const group = document.querySelector(".operations .button-group");
  const resultBox = document.querySelector(".result-box");
  const stepsBox = document.querySelector(".explanation-box");
  const bCard = document.getElementById("matrixB")?.parentElement;
  const tabs = tabGroup(group);
  if (backendEnabled) { const inv = document.getElementById("inverseBtn"); inv.textContent = "Inverse · soon"; inv.title = "Not available from the backend yet"; }

  Object.entries(OPS).forEach(([id, [op, label, needs]]) => {
    const btn = document.getElementById(id);
    btn.addEventListener("click", async () => {
      if (bCard) { bCard.style.display = needs === 2 ? "" : "none"; if (needs === 2) A(bCard, { opacity: [0, 1], scale: [0.96, 1] }, { duration: 0.35 }); }
      const a = readMatrix("matrixA");
      const b = needs === 2 ? readMatrix("matrixB") : { M: null };
      const err = a.error || b.error;
      if (err) { showError(resultBox, err); stepsBox.innerHTML = "Step-by-step calculations will be displayed here."; return; }
      showLoading(resultBox); showLoading(stepsBox);
      const res = await solveMatrix(op, a.M, b.M);
      if (res.error) { stepsBox.textContent = "Fix the input and try again."; return showError(resultBox, res.error); }
      const r = res.result;
      resultBox.innerHTML = r.kind === "matrix" ? grid(r.value, { hl: [] }) : r.kind === "scalar" ? `<div class="big-answer">${r.value}</div>` : `<div class="big-answer small">${r.value}</div>`;
      pop(resultBox.querySelectorAll(".c, .big-answer"));
      mountPlayer(stepsBox, res.steps);
      addHistory({ module: "Matrix", operation: label, result: r.kind === "matrix" ? r.value.map((x) => `[${x.join(" ")}]`).join(" ") : r.value });
      document.querySelector(".explanation").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
  const fillAll = (a, b) => {
    const A_ = [...document.querySelectorAll("#matrixA input")], B_ = [...document.querySelectorAll("#matrixB input")];
    A_.forEach((el, i) => setTimeout(() => setVal(el, a(i, A_.length)), i * 40));
    B_.forEach((el, i) => setTimeout(() => setVal(el, b(i, B_.length)), i * 40));
  };
  exampleBar(".size-controls", [
    { label: "Random numbers", fill: () => fillAll(() => Math.floor(Math.random() * 9) + 1, () => Math.floor(Math.random() * 9) + 1) },
    { label: "Identity", fill: () => fillAll((i, n) => (i % (Math.sqrt(n) + 1) === 0 ? 1 : 0), (i, n) => (i % (Math.sqrt(n) + 1) === 0 ? 1 : 0)) },
    { label: "Clear all", fill: () => fillAll(() => "", () => "") },
  ]);
  // first tab looks selected
  requestAnimationFrame(() => tabs.select(document.getElementById("addBtn"), true));
}
