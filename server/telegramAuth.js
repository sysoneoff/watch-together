// server/telegramAuth.js
//
// Telegram Mini App orqali kelgan foydalanuvchi ma'lumotini (initData) haqiqiyligini
// tekshirish. Bu ixtiyoriy qadam — MVP uchun shart emas, lekin agar kimdir
// soxta ism/foydalanuvchi ID yuborishining oldini olmoqchi bo'lsangiz, buni ishlatib
// clientdan kelgan ismga emas, shu tasdiqlangan ismga ishoning.
//
// Ishlatish uchun .env yoki muhit o'zgaruvchisida TELEGRAM_BOT_TOKEN kerak
// (BotFather @newbot orqali bergan token).

const crypto = require("crypto");

function validateTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computedHash !== hash) return null; // soxta yoki buzilgan ma'lumot

  const userStr = params.get("user");
  return userStr ? JSON.parse(userStr) : null;
}

module.exports = { validateTelegramInitData };
