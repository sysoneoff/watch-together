# BirgaTomosha 🎬

Yaqinlaringiz bilan real vaqtda birga video tomosha qilish, yozishish va ovozli suhbatlashish uchun bepul, open-source platforma. Web va Android (APK) versiyalari bitta koddan ishlaydi.

## Imkoniyatlari
- Xona yaratish/qo'shilish (6 xonali kod orqali)
- **YouTube** videolarini sinxron tomosha qilish (host-authoritative: play/pause/seek xona egasidan boshqalarga tarqaladi)
- **O'z qurilmangizdan video yuklab** birga tomosha qilish (serverga yuklanadi, hammaga uzatiladi)
- Real vaqtda **matnli chat**
- **Ovozli suhbat** — WebRTC orqali to'g'ridan-to'g'ri (peer-to-peer), audio hech qachon serverdan o'tmaydi
- Web + Android APK (Capacitor orqali)
- **Telegram Mini App** — bot orqali to'g'ridan-to'g'ri Telegram ichida ochiladi

## Texnologiyalar (barchasi bepul/open-source)
- Backend: Node.js, Express, Socket.io, Multer
- Frontend: vanilla HTML/CSS/JS (build qadam kerak emas)
- Video: YouTube IFrame API + HTML5 `<video>`
- Ovozli chat: WebRTC (STUN: bepul Google STUN serveri)
- Mobil: Capacitor (web ilovani Android APK'ga o'raydi)

---

## 1. Lokal ishga tushirish

```bash
npm install
npm start
```

Server `http://localhost:3000` da ishga tushadi. Brauzerda oching, xona yarating, boshqa vkladkada/qurilmada xonaga qo'shiling.

> Development uchun avtomatik qayta yuklanadi: `npm run dev`

## 2. Bepul serverga joylashtirish (deploy)

Kodning o'zi bepul, lekin internetda ishlashi uchun serverga (hosting) joylashtirish kerak. Eng arzon/bepul variantlar:

### A) Oracle Cloud Free Tier (doimiy bepul VM)
1. https://www.oracle.com/cloud/free/ orqali ro'yxatdan o'ting (ARM Ampere, 4 core / 24GB RAM — bepul tarifda)
2. Ubuntu VM yarating, Node.js 18+ o'rnating
3. Loyihani serverga ko'chiring (`git clone` yoki `scp`), `npm install && npm start`
4. `pm2` bilan doimiy ishlatib qo'ying: `npm i -g pm2 && pm2 start server/index.js`
5. Portni (3000) firewall/Security List'da oching, yoki Nginx orqali 80/443 ga proksi qiling

### B) Render.com yoki Railway.app (bepul tarif)
1. Repozitoriyani GitHub'ga push qiling
2. Render/Railway'da "New Web Service" → repo tanlang
3. Build command: `npm install`, Start command: `npm start`
4. Sizga bepul subdomen beriladi (masalan `https://birgatomosha.onrender.com`)

**MUHIM:** Server manzilini oldindan bilib oling — u `public/js/config.js` faylida kerak bo'ladi (APK ichida ishlashi uchun).

## 3. Android APK yasash (GitHub Actions orqali, avtomatik)

1. **Server manzilini kiriting** — `public/js/config.js` faylini oching va shu qatorni to'ldiring:
   ```js
   const SERVER_URL = "https://sizning-domeningiz.com"; // 2-qadamda olgan manzilingiz
   ```
   Bu shart, chunki APK ichida sahifa `file://`dan yuklanadi va nisbiy so'rovlar ishlamaydi.

2. Loyihani o'z GitHub repozitoriyangizga push qiling:
   ```bash
   git init
   git add .
   git commit -m "BirgaTomosha MVP"
   git branch -M main
   git remote add origin https://github.com/FOYDALANUVCHI/repo-nomi.git
   git push -u origin main
   ```

3. GitHub'da repo sahifasiga o'ting → **Actions** bo'limi → "Android APK build" workflow avtomatik ishga tushadi (yoki "Run workflow" tugmasi bilan qo'lda ishga tushiring).

4. Build tugagach, **Actions → tegishli run → Artifacts** bo'limidan `birgatomosha-debug-apk` faylini yuklab oling — bu sizning tayyor **APK** faylingiz.

5. Telefoningizga o'tkazib, "Noma'lum manbalardan o'rnatish"ni yoqib, o'rnating.

> Eslatma: bu **debug** APK (imzosiz, test uchun yetarli). Play Store'ga chiqarish uchun keyinchalik `assembleRelease` + imzolash kaliti (keystore) kerak bo'ladi — xohlasangiz shu qadamni ham keyin qo'shib beraman.

## 4. Loyiha strukturasi

```
watch-together/
├── server/
│   ├── index.js        # Express + Socket.io asosiy server
│   └── rooms.js         # Xonalar holatini boshqarish (xotirada)
├── public/
│   ├── index.html       # Bosh sahifa (xona yaratish/qo'shilish)
│   ├── room.html         # Xona sahifasi (video, chat, ovoz)
│   ├── css/style.css
│   └── js/
│       ├── config.js    # Server manzili (APK uchun MUHIM)
│       └── room.js       # Asosiy client logikasi
├── uploads/              # Yuklangan videolar shu yerda saqlanadi
├── capacitor.config.json # Android o'rash sozlamalari
└── .github/workflows/build-apk.yml  # Avtomatik APK build
```

## 5. Telegram Mini App sifatida ishga tushirish

Ilova endi Telegram Mini App sifatida ham ishlaydi — foydalanuvchi ismi Telegramdan avtomatik olinadi, mavzu (dark/light) Telegram sozlamasiga moslashadi, va "Orqaga" tugmasi Telegramning o'z interfeysida ko'rinadi.

### Talablar
- Ilova **HTTPS** orqali xizmat ko'rsatishi shart (Telegram HTTP domenlarni qabul qilmaydi). Yuqoridagi Render/Railway/Oracle+Nginx+Let's Encrypt variantlaridan biri mos keladi.

### Bot yaratish (BotFather orqali)
1. Telegram'da [@BotFather](https://t.me/BotFather) bilan suhbat oching
2. `/newbot` buyrug'ini yuboring, bot nomi va username'ini kiriting (masalan `BirgaTomoshaBot`)
3. BotFather sizga **bot token** beradi — buni saqlab qo'ying (ixtiyoriy xavfsizlik qadami uchun kerak bo'ladi)

### Mini App'ni ulash
1. BotFather'da `/newapp` buyrug'ini yuboring (yoki mavjud botni tanlab "Bot Settings → Menu Button")
2. So'ralganda:
   - **Web App URL**: sizning HTTPS domeningiz (masalan `https://birgatomosha.onrender.com`)
   - Ilova nomi, qisqa tavsif, rasm — xohlashingizga ko'ra
3. Botga o'ting → pastdagi menyu tugmasi (yoki "Play" tugmasi) orqali ilova to'g'ridan-to'g'ri Telegram ichida ochiladi

### (Ixtiyoriy) Xavfsizlik: foydalanuvchi ma'lumotini tasdiqlash
Standart holatda, frontend Telegramdan olingan ismga ishonadi (bu aksariyat loyihalar uchun yetarli). Agar birov soxta ism yuborishining oldini olishni istasangiz:

1. Serverga `TELEGRAM_BOT_TOKEN` muhit o'zgaruvchisini qo'shing:
   ```bash
   set TELEGRAM_BOT_TOKEN=sizning_bot_tokeningiz && npm start
   ```
2. Frontend `Telegram.WebApp.initData`ni `/api/telegram-verify` endpointiga yuborib, tasdiqlangan foydalanuvchi ma'lumotini oladi (`server/telegramAuth.js` shu tekshiruvni bajaradi).

### Cheklovlar
- **Ovozli suhbat (WebRTC)**: ba'zi Telegram mobil versiyalarida ilova ichidagi WebView mikrofon ruxsatini cheklashi mumkin — agar ishlamasa, foydalanuvchini "Brauzerda ochish" tugmasi orqali tashqi brauzerga yo'naltirish tavsiya etiladi.
- **Fayl yuklash**: katta video fayllarni Telegram WebView ichida yuklash sekinroq bo'lishi mumkin — kichikroq fayllar bilan sinab ko'ring.

## 6. Keyingi qadamlar (agar xohlasangiz)

- **Instagram/Facebook kontenti**: rasmiy playback API yo'qligi sababli frame-aniq sinxron tomosha texnik jihatdan imkonsiz; faqat "havolani birga ochish" tarzida qo'shish mumkin.
- **Katta fayllar/ko'p foydalanuvchi**: xona holatini Redis'ga ko'chirish (hozir xotirada, server qayta ishga tushsa yo'qoladi).
- **Video sifat moslashuvi**: ffmpeg orqali HLS transkoding qo'shish (turli tezlikdagi internetga moslashish uchun).
- **Autentifikatsiya**: hozircha ism bilan kirish; agar profil/tarix kerak bo'lsa, foydalanuvchi tizimi qo'shish mumkin.

Savol yoki keyingi funksiyani qo'shishda yordam kerak bo'lsa — ayting, birga davom ettiramiz.
