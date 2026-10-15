import { getPracticeQuestion, checkPracticeAnswer, addHistory } from "../api.js";
import { showLoading, A, countUp, interactiveButtons } from "../lib/fx.js";

export default function init() {
  const topic = document.getElementById("topic"), level = document.getElementById("difficulty"), ans = document.getElementById("answerInput");
  const qBox = document.querySelector(".question-box"), result = document.querySelector(".result-box");
  let q = null, tries = 0, done = false;
  const st = JSON.parse(localStorage.getItem("mathvision-score") || '{"right":0,"total":0,"streak":0}');
  const save = () => localStorage.setItem("mathvision-score", JSON.stringify(st));
  const drawScore = (msg = "", cls = "") => {
    result.innerHTML = `<div class="score"><div class="s-big"><b id="sc">0</b><span>/ ${st.total} correct</span></div><div class="s-meta">Streak <b>${st.streak}</b></div>${msg ? `<div class="fb ${cls}">${msg}</div>` : ""}</div>`;
    countUp(result.querySelector("#sc"), st.right, 0.6);
    if (msg) A(result.querySelector(".fb"), cls === "bad" ? { x: [-10, 10, -6, 6, 0] } : { scale: [0.8, 1], opacity: [0, 1] }, { duration: 0.4 });
  };
  const next = async () => {
    showLoading(qBox); ans.value = ""; tries = 0; done = false;
    q = await getPracticeQuestion(topic.value, level.value);
    qBox.textContent = q.question;
    A(qBox, { opacity: [0, 1], x: [60, 0] }, { duration: 0.45, ease: [0.22, 1, 0.36, 1] });
    drawScore(); ans.focus();
  };
  const submit = async () => {
    if (!q || done) return;
    if (!ans.value.trim()) return drawScore("Type an answer first.", "bad");
    const ok = await checkPracticeAnswer(q, ans.value);
    tries++;
    if (ok) { st.right++; st.total++; st.streak++; done = true; save(); drawScore("Correct. Well done.", "good"); addHistory({ module: "Practice", operation: `${topic.value} · ${level.value}`, result: "Correct" }); }
    else if (tries >= 2) { st.total++; st.streak = 0; done = true; save(); drawScore(`Not quite. The answer was ${q.answer}.`, "bad"); addHistory({ module: "Practice", operation: `${topic.value} · ${level.value}`, result: "Incorrect", status: "Missed" }); }
    else drawScore("Not correct. Try once more.", "bad");
  };
  document.getElementById("submitBtn").addEventListener("click", submit);
  // Answer is checked only through the explicit submit button.
  document.getElementById("nextBtn").addEventListener("click", next);
  [topic, level].forEach((s) => s.addEventListener("change", () => { q = null; qBox.textContent = "Click Next Question to load your selection."; }));
  next();
}
