import { analyzeRelation, addHistory } from "../api.js";
import { grid } from "../ui-helpers.js";
import { exampleBar, setVal } from "../lib/extras.js";
import { tabGroup, mountPlayer, showLoading, showError, pop, A, stagger } from "../lib/fx.js";

function graphSvg(U, pairs) {
  const W = 460, H = 320, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 55;
  const pos = Object.fromEntries(U.map((u, i) => { const t = (2 * Math.PI * i) / U.length - Math.PI / 2; return [u, [cx + R * Math.cos(t), cy + R * Math.sin(t)]]; }));
  const has = (a, b) => pairs.some(([x, y]) => x === a && y === b);
  const edges = pairs.map(([a, b]) => {
    const [x1, y1] = pos[a], [x2, y2] = pos[b];
    if (a === b) {
      const dx = x1 - cx, dy = y1 - cy, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      const ox = x1 + ux * 34, oy = y1 + uy * 34, px = -uy * 16, py = ux * 16;
      return `<path class="edge" pathLength="1" marker-end="url(#ah)" d="M ${x1 + ux * 18 + px} ${y1 + uy * 18 + py} C ${ox + px * 2} ${oy + py * 2}, ${ox - px * 2} ${oy - py * 2}, ${x1 + ux * 18 - px} ${y1 + uy * 18 - py}"/>`;
    }
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
    const bend = has(b, a) ? 22 : 0, nx = -uy * bend, ny = ux * bend;
    const sx = x1 + ux * 20, sy = y1 + uy * 20, ex = x2 - ux * 22, ey = y2 - uy * 22;
    return `<path class="edge" pathLength="1" marker-end="url(#ah)" d="M ${sx} ${sy} Q ${(sx + ex) / 2 + nx} ${(sy + ey) / 2 + ny} ${ex} ${ey}"/>`;
  }).join("");
  const nodes = U.map((u) => `<g class="node"><circle cx="${pos[u][0]}" cy="${pos[u][1]}" r="18"/><text x="${pos[u][0]}" y="${pos[u][1] + 5}" text-anchor="middle">${u}</text></g>`).join("");
  return `<svg class="graph" viewBox="0 0 ${W} ${H}"><defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="arrow"/></marker></defs>${edges}${nodes}</svg>`;
}

export default function init() {
  const u = document.getElementById("universalSet"), r = document.getElementById("relationInput");
  const vis = document.querySelector(".visual-box"), resultBox = document.querySelector(".result-box"), stepsBox = document.querySelector(".explanation-box");
  tabGroup(document.querySelector(".operations .button-group"));
  exampleBar(".relation-input", [
    { label: "Equivalence", fill: () => { setVal(u, "1,2,3"); setVal(r, "(1,1),(2,2),(3,3),(1,2),(2,1)"); } },
    { label: "Partial order", fill: () => { setVal(u, "1,2,3"); setVal(r, "(1,1),(2,2),(3,3),(1,2),(1,3),(2,3)"); } },
    { label: "Not transitive", fill: () => { setVal(u, "1,2,3,4"); setVal(r, "(1,2),(2,3),(3,4)"); } },
  ]);
  const run = (mode, label) => async () => {
    if (!u.value.trim()) return showError(resultBox, "Please enter the Universal Set.");
    if (!r.value.trim()) return showError(resultBox, "Please enter the Relation.");
    showLoading(resultBox); showLoading(stepsBox); vis.textContent = "Drawing…";
    const res = await analyzeRelation(u.value, r.value);
    if (res.error) { vis.textContent = "Graph visualization will appear here."; return showError(resultBox, res.error); }
    const x = res.result;
    if (mode === "matrix") {
      vis.innerHTML = `<div class="rel-matrix"><div class="rm-cols"><span></span>${x.U.map((c) => `<b>${c}</b>`).join("")}</div>${x.matrix.map((row, i) => `<div class="rm-row"><b>${x.U[i]}</b>${row.map((c) => `<span class="c${c === "1" ? " hl" : ""}">${c}</span>`).join("")}</div>`).join("")}</div>`;
      pop(vis.querySelectorAll(".c"));
    } else {
      vis.innerHTML = graphSvg(x.U, x.pairs);
      A(vis.querySelectorAll(".node"), { opacity: [0, 1], scale: [0.4, 1] }, { type: "spring", stiffness: 260, damping: 16, delay: stagger(0.08) });
      A(vis.querySelectorAll(".edge"), { strokeDashoffset: [1, 0], opacity: [0, 1] }, { duration: 0.8, delay: stagger(0.12, { startDelay: 0.4 }) });
    }
    resultBox.innerHTML = `<div class="props">${x.props.map((p) => `<div class="prop"><span class="p-name">${p.name}</span><span class="p-val ${p.ok ? "yes" : "no"}">${p.ok ? "Yes" : "No"}</span></div>`).join("")}<div class="prop-type">${x.type}</div></div>`;
    A(resultBox.querySelectorAll(".prop, .prop-type"), { opacity: [0, 1], x: [-20, 0] }, { duration: 0.4, delay: stagger(0.1) });
    mountPlayer(stepsBox, res.steps);
    addHistory({ module: "Relations", operation: label, result: x.type });
  };
  document.getElementById("analyzeBtn").addEventListener("click", run("graph", "Analyze"));
  document.getElementById("matrixBtn").addEventListener("click", run("matrix", "Relation Matrix"));
  document.getElementById("graphBtn").addEventListener("click", run("graph", "Directed Graph"));
}
