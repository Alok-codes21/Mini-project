import { solveSets, addHistory } from "../api.js";
import { exampleBar, setVal } from "../lib/extras.js";
import { tabGroup, mountPlayer, showLoading, showError, pop, A, stagger } from "../lib/fx.js";

const OPS = { unionBtn: ["union", "Union"], intersectionBtn: ["intersection", "Intersection"], differenceBtn: ["difference", "Difference"], symDifferenceBtn: ["symdiff", "Symmetric Difference"], cartesianBtn: ["cartesian", "Cartesian Product"], powerBtn: ["power", "Power Set"] };

const vennSvg = (v) => {
  const { op, onlyA, both, onlyB } = v;
  const show = (arr) => (arr.slice(0, 4).join(", ") + (arr.length > 4 ? "…" : "")) || "";
  const fillA = op === "union" || op === "difference" || op === "symdiff";
  const fillB = op === "union" || op === "symdiff";
  return `<svg class="venn" viewBox="0 0 420 240" role="img" aria-label="Venn diagram">
    <defs>
      <clipPath id="cpB"><circle cx="250" cy="120" r="85"/></clipPath>
      <mask id="mA"><rect width="420" height="240" fill="white"/><circle cx="250" cy="120" r="85" fill="black"/></mask>
      <mask id="mB"><rect width="420" height="240" fill="white"/><circle cx="170" cy="120" r="85" fill="black"/></mask>
    </defs>
    <g class="shape">
      ${op === "union" ? `<circle cx="170" cy="120" r="85" class="fill"/><circle cx="250" cy="120" r="85" class="fill"/>` : ""}
      ${op === "intersection" ? `<circle cx="170" cy="120" r="85" class="fill" clip-path="url(#cpB)"/>` : ""}
      ${op === "difference" ? `<circle cx="170" cy="120" r="85" class="fill" mask="url(#mA)"/>` : ""}
      ${op === "symdiff" ? `<circle cx="170" cy="120" r="85" class="fill" mask="url(#mA)"/><circle cx="250" cy="120" r="85" class="fill" mask="url(#mB)"/>` : ""}
    </g>
    <circle class="ring" cx="170" cy="120" r="85"/><circle class="ring" cx="250" cy="120" r="85"/>
    <text x="95" y="38" class="lbl">A</text><text x="325" y="38" class="lbl">B</text>
    <text x="120" y="125" class="el" text-anchor="middle">${show(onlyA)}</text>
    <text x="210" y="125" class="el" text-anchor="middle">${show(both)}</text>
    <text x="300" y="125" class="el" text-anchor="middle">${show(onlyB)}</text>
  </svg>`;
};

export default function init() {
  const a = document.getElementById("setA"), b = document.getElementById("setB");
  const diagram = document.querySelector(".diagram-box"), resultBox = document.querySelector(".result-box"), stepsBox = document.querySelector(".explanation-box");
  const tabs = tabGroup(document.querySelector(".operations .button-group"));
  exampleBar(".set-section", [
    { label: "Numbers", fill: () => { setVal(a, "1,2,3,4,5"); setVal(b, "4,5,6,7"); } },
    { label: "Letters", fill: () => { setVal(a, "a,b,c"); setVal(b, "b,c,d,e"); } },
    { label: "Disjoint sets", fill: () => { setVal(a, "1,2,3"); setVal(b, "7,8,9"); } },
  ]);
  // live preview chips while typing
  [a, b].forEach((inp) => {
    const prev = document.createElement("div"); prev.className = "live-digits"; inp.after(prev);
    inp.addEventListener("input", () => {
      const els = [...new Set(inp.value.split(",").map((x) => x.trim()).filter(Boolean))];
      prev.innerHTML = els.slice(0, 14).map((c) => `<span>${c}</span>`).join("");
      A(prev.querySelectorAll("span"), { opacity: [0, 1], scale: [0.7, 1] }, { duration: 0.2, delay: stagger(0.02) });
    });
  });
  Object.entries(OPS).forEach(([id, [op, label]]) => {
    document.getElementById(id).addEventListener("click", async () => {
      if (!a.value.trim()) return showError(resultBox, "Please enter Set A.");
      if (op !== "power" && !b.value.trim()) return showError(resultBox, "Please enter Set B.");
      showLoading(resultBox); showLoading(stepsBox); diagram.textContent = "Drawing…";
      const res = await solveSets(op, a.value, b.value);
      if (res.error) return showError(resultBox, res.error);
      const r = res.result;
      resultBox.innerHTML = `<div class="set-answer"><span class="mx-label">${r.label}</span><div class="chips big">${(r.value.slice(0, 60).map((x) => `<span class="chip">${x}</span>`).join("")) || '<span class="chip">∅</span>'}</div></div>`;
      pop(resultBox.querySelectorAll(".chip"));
      if (r.venn) {
        diagram.innerHTML = vennSvg(r.venn);
        A(diagram.querySelectorAll(".ring"), { opacity: [0, 1], scale: [0.5, 1] }, { type: "spring", stiffness: 200, damping: 18, delay: stagger(0.12) });
        A(diagram.querySelector(".shape"), { opacity: [0, 1] }, { duration: 0.6, delay: 0.4 });
        A(diagram.querySelectorAll(".el, .lbl"), { opacity: [0, 1] }, { duration: 0.4, delay: 0.6 });
      } else {
        diagram.innerHTML = `<div class="mx-label">${r.label}</div><div class="chips big">${r.value.slice(0, 64).map((x) => `<span class="chip">${x}</span>`).join("")}</div>`;
        pop(diagram.querySelectorAll(".chip"));
      }
      mountPlayer(stepsBox, res.steps);
      addHistory({ module: "Sets", operation: label, result: `${r.label} = { ${r.value.slice(0, 12).join(", ")}${r.value.length > 12 ? ", …" : ""} }` });
    });
  });
}
