import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

// Live step card for the home hero (demo content: det [[2,3],[1,4]]).
const M = [[2, 3], [1, 4]];
const STEPS = [
  { t: "Pick the main diagonal", hl: [[0, 0], [1, 1]], f: "a × d", r: "2 × 4 = 8" },
  { t: "Pick the other diagonal", hl: [[0, 1], [1, 0]], f: "b × c", r: "3 × 1 = 3" },
  { t: "Subtract", hl: [], f: "ad − bc", r: "8 − 3 = 5" },
];

export default function HeroCard() {
  const [i, setI] = useState(0);
  const [play, setPlay] = useState(true);
  useEffect(() => {
    if (!play) return;
    const id = setInterval(() => setI((x) => (x + 1) % STEPS.length), 2200);
    return () => clearInterval(id);
  }, [play]);
  const s = STEPS[i];
  const hot = (r, c) => s.hl.some(([a, b]) => a === r && b === c);
  return (
    <div className="hc-wrap">
      <motion.div className="hc" initial={{ opacity: 0, y: 40, rotateX: 12 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ type: "spring", stiffness: 90, damping: 16, delay: 0.5 }} whileHover={{ y: -6 }}>
        <div className="hc-top"><small>MATRIX · DETERMINANT</small><button className="hc-play" onClick={() => setPlay(!play)} aria-label="Play or pause">{play ? "❚❚" : "▶"}</button></div>
        <div className="hc-body">
          <div className="hc-grid">
            {M.flatMap((row, r) => row.map((v, c) => (
              <motion.b key={`${r}${c}`} className={hot(r, c) ? "on" : ""} animate={{ scale: hot(r, c) ? 1.08 : 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }}>{v}</motion.b>
            )))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={i} className="hc-calc" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}>
              <span>{s.t}</span><code>{s.f}</code><strong>{s.r}</strong>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="hc-dots">{STEPS.map((_, k) => <button key={k} className={k === i ? "on" : ""} onClick={() => { setPlay(false); setI(k); }} aria-label={`Step ${k + 1}`} />)}</div>
        <div className="hc-bar"><motion.i animate={{ width: `${((i + 1) / STEPS.length) * 100}%` }} /></div>
      </motion.div>
      <motion.div className="hc-float f1" animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>1011₂ → 11₁₀</motion.div>
      <motion.div className="hc-float f2" animate={{ y: [0, 10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>A ∪ B = {"{1,2,3,4}"}</motion.div>
    </div>
  );
}
