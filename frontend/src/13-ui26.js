// mobile navigation: hamburger that opens a full-width menu with every link
export function mobileNav() {
  const nav = document.querySelector(".navbar"), links = document.querySelector(".nav-links"), actions = document.querySelector(".nav-actions");
  if (!nav || !links || !actions || actions.querySelector(".nav-burger")) return;
  const b = document.createElement("button");
  b.type = "button"; b.className = "nav-burger"; b.setAttribute("aria-label", "Open menu"); b.setAttribute("aria-expanded", "false");
  b.innerHTML = "<span></span><span></span><span></span>";
  actions.append(b);
  const set = (open) => { document.body.classList.toggle("nav-open", open); b.setAttribute("aria-expanded", String(open)); b.setAttribute("aria-label", open ? "Close menu" : "Open menu"); };
  b.addEventListener("click", (e) => { e.stopPropagation(); set(!document.body.classList.contains("nav-open")); });
  links.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
  document.addEventListener("click", (e) => { if (!nav.contains(e.target)) set(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
  window.addEventListener("resize", () => { if (innerWidth > 980) set(false); });
}
