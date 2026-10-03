import { askAI } from "../api.js";
import { A, stagger, interactiveButtons } from "./fx.js";

export function mountAIPanel() {
  const fab = document.createElement("button");
  fab.className = "ai-fab"; fab.setAttribute("aria-label", "Open AI helper");
  fab.innerHTML = `<span class="ai-spark">✦</span><span>AI</span>`;
  const panel = document.createElement("aside");
  panel.className = "ai-panel"; panel.hidden = true; panel.setAttribute("aria-label", "AI math helper");
  panel.innerHTML = `
    <div class="ai-head"><div><b>AI Math Helper</b><small>Ask about any step</small></div><button class="ai-close" aria-label="Close">×</button></div>
    <div class="ai-body"><div class="ai-msg bot">Hi, I can explain a step, check your working or give a hint. Ask me anything about this page.</div></div>
    <div class="ai-chips"><button>Explain this step</button><button>Give me a hint</button><button>Why does this work?</button></div>
    <form class="ai-form"><input placeholder="Ask a question…" aria-label="Message" autocomplete="off"><button type="submit" aria-label="Send">➤</button></form>`;
  document.body.append(fab, panel);
  interactiveButtons(panel); interactiveButtons(document.body);
  const body = panel.querySelector(".ai-body"), input = panel.querySelector("input");
  let open = false;
  const toggle = (v) => {
    open = v;
    if (open) {
      panel.hidden = false;
      A(panel, { opacity: [0, 1], y: [30, 0], scale: [0.92, 1] }, { type: "spring", stiffness: 320, damping: 26 });
      A(fab.querySelector(".ai-spark"), { rotate: [0, 180] }, { duration: 0.4 });
      input.focus();
    } else {
      A(panel, { opacity: 0, y: 20, scale: 0.95 }, { duration: 0.2 }).then(() => (panel.hidden = true));
    }
  };
  fab.onclick = () => toggle(!open);
  panel.querySelector(".ai-close").onclick = () => toggle(false);
  document.addEventListener("keydown", (e) => e.key === "Escape" && open && toggle(false));
  const add = (text, who) => {
    const m = document.createElement("div"); m.className = `ai-msg ${who}`; m.textContent = text; body.append(m);
    A(m, { opacity: [0, 1], y: [10, 0] }, { duration: 0.3 }); body.scrollTop = body.scrollHeight; return m;
  };
  const send = async (text) => {
    if (!text.trim()) return;
    add(text, "user"); input.value = "";
    const t = add("…", "bot typing");
    A(t, { opacity: [0.4, 1] }, { duration: 0.6, repeat: Infinity, repeatType: "reverse" });
    const { reply } = await askAI(text, { page: document.body.dataset.page });
    t.remove(); add(reply, "bot");
  };
  panel.querySelector("form").onsubmit = (e) => { e.preventDefault(); send(input.value); };
  panel.querySelectorAll(".ai-chips button").forEach((b) => (b.onclick = () => send(b.textContent)));
}
