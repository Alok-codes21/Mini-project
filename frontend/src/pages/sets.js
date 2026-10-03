import { solveSets, addHistory } from "../api.js";
import { exampleBar, setVal } from "../lib/extras.js";
import { tabGroup, mountPlayer, showLoading, showError, pop, A, stagger } from "../lib/fx.js";

const OPS = { unionBtn: ["union", "Union"], intersectionBtn: ["intersection", "Intersection"], differenceBtn: ["difference", "Difference"], symDifferenceBtn: ["symdiff", "Symmetric Difference"], cartesianBtn: ["cartesian", "Cartesian Product"], powerBtn: ["power", "Power Set"] };

const vennSvg = (v) => {
  const { op, onlyA, both, onlyB } = v;
  const show = (arr) => (arr.slice(0, 4).join(", ") + (arr.length > 4 ? "…" : "")) || "";
  const R = 118, ax = 210, bx = 330, cy = 160;
  const inA = op === "union" || op === "difference" || op === "symdiff" || op === "intersection";
  const circ = (x, cls, extra = "") => `<circle cx="${x}" cy="${cy}" r="${R}" class="${cls}" ${extra}/>`;
  const regionA = op === "union" ? circ(ax, "fill") : op === "difference" || op === "symdiff" ? circ(ax, "fill", 'mask="url(#mA)"') : "";
  const regionB = op === "union" ? circ(bx, "fill") : op === "symdiff" ? circ(bx, "fill", 'mask="url(#mB)"') : "";
  const lens = op === "intersection" || op === "union" ? circ(bx, "lens", 'clip-path="url(#cpA)"') : "";
  const hasBoth = both.length > 0;
  return `<svg class="venn" viewBox="0 0 540 320" role="img" aria-label="Venn diagram of A and B. Overlap holds ${both.length} element(s)">
    <defs>
      <clipPath id="cpA"><circle cx="${ax}" cy="${cy}" r="${R}"/></clipPath>
      <mask id="mA"><rect width="540" height="320" fill="white"/><circle cx="${bx}" cy="${cy}" r="${R}" fill="black"/></mask>
      <mask id="mB"><rect width="540" height="320" fill="white"/><circle cx="${ax}" cy="${cy}" r="${R}" fill="black"/></mask>
    </defs>
    <g class="shape">${regionA}${regionB}${lens}</g>
    <circle class="ring" cx="${ax}" cy="${cy}" r="${R}"/><circle class="ring" cx="${bx}" cy="${cy}" r="${R}"/>
    <text x="${ax - 80}" y="34" class="lbl">A</text><text x="${bx + 80}" y="34" class="lbl">B</text>
    <text x="${ax - 55}" y="${cy + 5}" class="el" text-anchor="middle">${show(onlyA)}</text>
    <text x="270" y="${cy + 5}" class="el both" text-anchor="middle">${show(both)}</text>
    ${hasBoth ? `<text x="270" y="${cy + 28}" class="tag" text-anchor="middle">A ∩ B</text>` : `<text x="270" y="${cy + 5}" class="tag" text-anchor="middle">no overlap</text>`}
    <text x="${bx + 55}" y="${cy + 5}" class="el" text-anchor="middle">${show(onlyB)}</text>
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
