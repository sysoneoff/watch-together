// public/js/telegram.js
//
// Ilova Telegram Mini App sifatida ochilganda (Telegram ichida) qo'shimcha
// imkoniyatlarni yoqadi: Telegram mavzusiga moslashish, foydalanuvchi ismini
// avtomatik olish, "Orqaga" tugmasi va boshqalar.
//
// Oddiy brauzerda ochilganda (Telegram tashqarisida) bu fayl hech narsa qilmaydi —
// ilova xuddi avvalgidek ishlayveradi.

const tg = window.Telegram?.WebApp || null;
const isTelegram = !!(tg && tg.initData);

function initTelegram() {
  if (!tg) return;
  tg.ready();
  tg.expand(); // ilovani to'liq balandlikka yozadi
  try {
    tg.disableVerticalSwipes?.(); // pastga tortib yopib yubormasligi uchun
  } catch (e) {}

  applyTelegramTheme();
  tg.onEvent("themeChanged", applyTelegramTheme);

  // Telegram o'zi mavzuni boshqargani uchun bizning tema tugmamizni yashiramiz
  const themeBtn = document.getElementById("themeToggleBtn");
  if (isTelegram && themeBtn) themeBtn.style.display = "none";
}

function applyTelegramTheme() {
  if (!tg) return;
  const tp = tg.themeParams || {};
  const root = document.documentElement;
  const theme = tg.colorScheme === "dark" ? "dark" : "light";
  root.setAttribute("data-theme", theme);

  if (tp.bg_color) root.style.setProperty("--bg", tp.bg_color);
  if (tp.secondary_bg_color) root.style.setProperty("--bg-card", tp.secondary_bg_color);
  if (tp.text_color) root.style.setProperty("--text", tp.text_color);
  if (tp.hint_color) root.style.setProperty("--text-dim", tp.hint_color);
  if (tp.hint_color) root.style.setProperty("--text-faint", tp.hint_color);
  if (tp.button_color) root.style.setProperty("--accent", tp.button_color);
  if (tp.button_color) root.style.setProperty("--accent-light", tp.button_color);
}

// Telegram foydalanuvchisi haqida ma'lumot (agar mavjud bo'lsa)
function getTelegramUser() {
  if (!tg || !tg.initDataUnsafe || !tg.initDataUnsafe.user) return null;
  const u = tg.initDataUnsafe.user;
  return {
    id: u.id,
    name: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "Foydalanuvchi",
    username: u.username || null,
    photoUrl: u.photo_url || null,
  };
}

// "Orqaga" tugmasini sozlash (Telegram interfeysining o'zida ko'rinadi)
function setupTelegramBackButton(onBack) {
  if (!tg) return;
  tg.BackButton.show();
  tg.BackButton.onClick(onBack);
}

function hideTelegramBackButton() {
  if (!tg) return;
  tg.BackButton.hide();
}

document.addEventListener("DOMContentLoaded", initTelegram);
