// public/js/common.js

// ---------- TOAST XABARLAR ----------
function showToast(text, type = "info") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = text;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ---------- TEMA (dark/light) ----------
function initTheme() {
  const saved = localStorage.getItem("bt_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("bt_theme", next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById("themeToggleBtn");
  if (btn) btn.textContent = theme === "dark" ? "🌙" : "☀️";
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  const btn = document.getElementById("themeToggleBtn");
  if (btn) btn.onclick = toggleTheme;
});

// ---------- PWA: Service Worker ro'yxatdan o'tkazish ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker ro'yxatdan o'tmadi:", err);
    });
  });
}

// ---------- AVATAR (ism asosida barqaror rang) ----------
const AVATAR_COLORS = ["#6c5ce7", "#e17055", "#00b894", "#0984e3", "#fdcb6e", "#e84393", "#00cec9", "#fab1a0"];

function nameToColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function avatarHtml(name) {
  const letter = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const color = nameToColor(name || "?");
  return `<span class="avatar" style="background:${color}">${letter}</span>`;
}
