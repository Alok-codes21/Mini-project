import "./enhance.css";
import { scrollUI, ripples, magnetic, pageExit } from "./lib/extras.js";
import { mountAIPanel } from "./lib/ai-panel.js";
import { revealWords, interactiveButtons, revealOnScroll, navPill, themeSpin, A } from "./lib/fx.js";

const page = document.body.dataset.page;

// global polish (every page)
A(document.body, { opacity: [0, 1] }, { duration: 0.5 });
navPill();
themeSpin();
const h1 = document.querySelector(".page-title h1, .hero-text h1");
if (h1) revealWords(h1, 0.1);
const lead = document.querySelector(".page-title p, .hero-text > p");
if (lead) A(lead, { opacity: [0, 1], y: [14, 0] }, { duration: 0.6, delay: 0.5 });
revealOnScroll(".feature-card, .module-card, .matrix-card, .set-card, .relation-card, .converter-card, .converter-card-2, .practice-card, .about-card, .result, .explanation, .diagram, .visualization, .history-table, .question, .answer, .size-controls, .operations");
interactiveButtons();
mountAIPanel();
scrollUI(); ripples(); pageExit(); magnetic(".primary-btn, .nav-actions .btn");

const pages = {
  index: () => import("./pages/home.jsx"),
  matrix: () => import("./pages/matrix.js"),
  set: () => import("./pages/sets.js"),
  relation: () => import("./pages/relation.js"),
  converter: () => import("./pages/converter.js"),
  practice: () => import("./pages/practice.js"),
  history: () => import("./pages/history.js"),
  about: () => import("./pages/about.js"),
};
pages[page]?.().then((m) => m.default?.());
