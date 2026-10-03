/* ==========================================================================
   API LAYER  -  the ONLY file the UI talks to for maths results.
   --------------------------------------------------------------------------
   Matrix + Converter go to the real backend when VITE_API_URL is set
   (via ./backend-adapter.js). Sets, Relations, practice questions and the
   Inverse button still use ./demo-engine.js (placeholder logic).

   TO CONNECT THE REAL BACKEND: replace the body of each function below with
   a call to your team's endpoint and return the SAME shape:
       { result, steps: [{ title, text, visual }] }   or   { error: "message" }
   Nothing else in the UI needs to change.
   `visual` is an HTML string (see demo-engine.js for the helpers/classes).
   History is stored in localStorage under HISTORY_KEY; swap the three
   history functions to use the server if the team stores it there.
   ========================================================================== */
import { matrixDemo, converterDemo, setsDemo, relationDemo, practiceDemo, checkAnswerDemo } from "./demo-engine.js";
import { backendEnabled, backendMatrix, backendConvert } from "./backend-adapter.js";

// Backend is used for Matrix (add, subtract, multiply, transpose, determinant) and the Number Converter
// when VITE_API_URL is set (see .env.example). Everything else stays on the demo engine for now.
export { backendEnabled };

const wait = (ms) => new Promise((r) => setTimeout(r, ms)); // fake latency so loading states are visible

/** op: "add" | "sub" | "mult" | "transpose" | "determinant" | "inverse"; A, B: arrays of arrays of strings */
export async function solveMatrix(op, A, B) {
  if (backendEnabled) return backendMatrix(op, A, B); // inverse: backend has no route yet, adapter returns "coming soon"
  await wait(350); return matrixDemo(op, A, B);
}

/** value: string, fromBase/toBase: "Binary" | "Octal" | "Decimal" | "Hexadecimal" */
export async function convertNumber(value, fromBase, toBase) {
  if (backendEnabled) return backendConvert(value, fromBase, toBase);
  await wait(350); return converterDemo(value, fromBase, toBase);
}

/** op: "union" | "intersection" | "difference" | "symdiff" | "cartesian" | "power"; setA/setB: "1,2,3" */
export async function solveSets(op, setA, setB) { await wait(350); return setsDemo(op, setA, setB); }

/** universal: "1,2,3,4", relation: "(1,2),(2,3)" */
export async function analyzeRelation(universal, relation) { await wait(350); return relationDemo(universal, relation); }

/** topic: Matrix | Sets | Relations | Number Systems ; level: Easy | Medium | Hard -> { question, answer, type } */
export async function getPracticeQuestion(topic, level) { await wait(250); return practiceDemo(topic, level); }
export async function checkPracticeAnswer(question, given) { await wait(150); return checkAnswerDemo(question, given); }

// ---- history (localStorage for now) ----
const HISTORY_KEY = "mathvision-history";
export function getHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; } }
export function addHistory(entry) { const h = [{ date: new Date().toISOString(), status: "Solved", ...entry }, ...getHistory()].slice(0, 50); localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); }
export function clearHistory() { localStorage.removeItem(HISTORY_KEY); }

// ---- AI math helper (UI only, no model wired) ----
/** HOOK: connect the AI model here. message: string, context: { page } -> returns { reply: string }.
 *  No keys or model calls live in the frontend; call your team's server endpoint from here. */
export async function askAI(message, context) {
  await wait(600);
  return { reply: "The AI helper is not connected yet. This panel is ready for it: connect askAI() in src/api.js." };
}
