// public/js/config.js
//
// MUHIM: Android APK (Capacitor) ichida bu sahifa "file://" yoki
// "capacitor://" manzilidan yuklanadi, shuning uchun nisbiy (relative) so'rovlar
// ishlamaydi. Shu sababli server manzilini ANIQ (masalan sizning Render/VPS/Oracle
// domeningiz) yozib qo'yish kerak.
//
// Lokal test uchun (brauzerda, kompyuterda) bo'sh qoldirsangiz ham bo'ladi —
// o'shanda joriy sahifa manzili ishlatiladi.

const SERVER_URL = "https://watch-together-sysone.onrender.com";

// Agar bo'sh bo'lsa, joriy manzil (web uchun) ishlatiladi:
const RESOLVED_SERVER_URL = SERVER_URL || window.location.origin;
