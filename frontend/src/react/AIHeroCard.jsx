import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { askAI } from "../api.js";

// Home hero card: "MathVision AI". A scripted demo types a question and answers it step by step,
// and the input row calls askAI() from src/api.js (the hook for the real AI backend).
const DEMOS = [
  { q: "Find the determinant of [[2,3],[1,4]]", a: ["Multiply the main diagonal: 2 × 4 = 8", "Multiply the other diagonal: 3 × 1 = 3", "Subtract: 8 − 3 = 5"], r: "det = 5" },
  { q: "Convert 156 to binary", a: ["156 ÷ 2 = 78 remainder 0", "78 ÷ 2 = 39 remainder 0", "Read the remainders upward"], r: "10011100" },
  { q: "Is A ∩ B = {3, 4} for A={1,2,3,4}, B={3,4,5,6}?", a: ["Elements in both sets: 3 and 4", "1, 2 are only in A; 5, 6 only in B"], r: "Yes, A ∩ B = {3, 4}" },
];

export default function AIHeroCard() {
  const [d, setD] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState("typing"); // typing | thinking | answer
  const [shown, setShown] = useState(0);
  const [live, setLive] = useState(null); // { q, a, loading }
  const [val, setVal] = useState("");
  const timers = useRef([]);
  const after = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); };
  const demo = DEMOS[d];

  useEffect(() => {
    if (live) return;
    setTyped(""); setPhase("typing"); setShown(0);
    let i = 0;
    const type = () => {
      i++; setTyped(demo.q.slice(0, i));
      if (i < demo.q.length) after(type, 32);
      else { after(() => setPhase("thinking"), 350); after(() => { setPhase("answer"); let k = 0; const nx = () => { k++; setShown(k); if (k < demo.a.length + 1) after(nx, 650); else after(() => setD((x) => (x + 1) % DEMOS.length), 3600); }; nx(); }, 1500); }
    };
    after(type, 500);
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, [d, live]);

  const ask = async (e) => {
    e.preventDefault();
    const q = val.trim(); if (!q) return;
    setVal(""); setLive({ q, loading: true });
    const { reply } = await askAI(q, { page: "home" });
    setLive({ q, a: reply, loading: false });
  };
  const bubble = { initial: { opacity: 0, y: 10, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { type: "spring", stiffness: 340, damping: 26 } };

  return (
    <motion.div className="aic" initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 90, damping: 16, delay: 0.6 }}>
      <div className="aic-head">
        <span className="aic-badge"><i>✦</i> MathVision AI</span>
        <span className="aic-live"><b /> online</span>
      </div>
      <div className="aic-body">
        {live ? (
          <>
            <motion.div className="aic-msg me" {...bubble}>{live.q}</motion.div>
            {live.loading ? <div className="aic-msg bot"><span className="aic-dots"><i /><i /><i /></span></div> : <motion.div className="aic-msg bot" {...bubble}>{live.a}</motion.div>}
            <button className="aic-back" onClick={() => setLive(null)}>↺ Back to demo</button>
          </>
        ) : (
          <>
            <motion.div key={`q${d}`} className="aic-msg me" {...bubble}>{typed}{phase === "typing" && <span className="aic-caret" />}</motion.div>
            <AnimatePresence>
              {phase === "thinking" && <motion.div key="t" className="aic-msg bot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><span className="aic-dots"><i /><i /><i /></span></motion.div>}
            </AnimatePresence>
            {phase === "answer" && (
              <motion.div key={`a${d}`} className="aic-msg bot" {...bubble}>
                {demo.a.slice(0, shown).map((s, i) => <motion.p key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}><em>{i + 1}</em>{s}</motion.p>)}
                {shown > demo.a.length - 0 && null}
                {shown >= demo.a.length && <motion.strong initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 18 }}>{demo.r}</motion.strong>}
              </motion.div>
            )}
          </>
        )}
      </div>
      <form className="aic-form" onSubmit={ask}>
        <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Ask MathVision AI…" aria-label="Ask MathVision AI" />
        <motion.button type="submit" whileTap={{ scale: 0.9 }} aria-label="Send">➤</motion.button>
      </form>
    </motion.div>
  );
}
