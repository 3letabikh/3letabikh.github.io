/* Portfolio of Ali Tabikh - menu, theme, active link, reveal on scroll. No libraries. */

/* ---- settings: paste your LinkedIn link here when it exists ---- */
const LINKEDIN_URL = "https://www.linkedin.com/in/ali-tabikh";

if (LINKEDIN_URL) {
  document.querySelectorAll(".linkedin").forEach(el => (el.hidden = false));
  document.querySelectorAll(".linkedin-link").forEach(a => (a.href = LINKEDIN_URL));
}

/* ---- mobile menu ---- */
const menu = document.getElementById("nav-menu");
document.getElementById("nav-toggle").addEventListener("click", () => menu.classList.add("show-menu"));
document.getElementById("nav-close").addEventListener("click", () => menu.classList.remove("show-menu"));
document.querySelectorAll(".nav__link").forEach(l => l.addEventListener("click", () => menu.classList.remove("show-menu")));

/* ---- header shadow when the page is scrolled ---- */
const header = document.getElementById("header");
const onScroll = () => header.classList.toggle("header--shadow", window.scrollY > 40);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* ---- dark / light theme (remembered in this browser) ---- */
const root = document.documentElement;
const themeBtn = document.getElementById("theme-button");
const isDark = () => root.dataset.theme === "dark" ||
  (!root.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
const setIcon = () => (themeBtn.innerHTML = isDark() ? '<i class="ri-sun-line"></i>' : '<i class="ri-moon-line"></i>');
themeBtn.addEventListener("click", () => {
  root.dataset.theme = isDark() ? "light" : "dark";
  try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
  setIcon();
});
setIcon();

/* ---- active menu link + reveal on scroll ---- */
const links = [...document.querySelectorAll(".nav__link")];
const sectionObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    links.forEach(l => l.classList.toggle("active", l.getAttribute("href") === "#" + e.target.id));
  });
}, { rootMargin: "-45% 0px -50% 0px" });
document.querySelectorAll("section[id]").forEach(s => sectionObs.observe(s));

const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("is-visible"); revealObs.unobserve(e.target); }
  });
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach(el => revealObs.observe(el));

/* ---- email: opens Gmail in a new tab (works without a mail app) and copies the address ---- */
const EMAIL = "alitabikh31@gmail.com";
document.querySelectorAll(".email-link").forEach(a => a.addEventListener("click", () => {
  try { navigator.clipboard.writeText(EMAIL); } catch (e) {}
  const label = a.querySelector(".email-label");
  if (label) {
    const old = label.textContent;
    label.textContent = "Address copied \u2713";
    setTimeout(() => (label.textContent = old), 2500);
  }
}));
