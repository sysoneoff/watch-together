// server/index.js
const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const { Server } = require("socket.io");
const { nanoid } = require("nanoid");
const roomsStore = require("./rooms");
const { validateTelegramInitData } = require("./telegramAuth");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // productionda o'z domeningizga cheklang
  maxHttpBufferSize: 1e8,
});

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/uploads", express.static(UPLOAD_DIR));

// ---- Video fayl yuklash (foydalanuvchi videosi) ----
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".mp4";
    cb(null, `${nanoid(10)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit, kerak bo'lsa o'zgartiring
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("video/")) {
      return cb(new Error("Faqat video fayllarga ruxsat berilgan"));
    }
    cb(null, true);
  },
});

app.post("/api/upload", upload.single("video"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Fayl topilmadi" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

// ---- Telegram Mini App: initData'ni tasdiqlash (ixtiyoriy) ----
// Frontend Telegram'dan olingan initData'ni shu yerga yuborsa, server uni
// TELEGRAM_BOT_TOKEN yordamida tekshiradi va haqiqiy foydalanuvchi ma'lumotini qaytaradi.
app.post("/api/telegram-verify", (req, res) => {
  const { initData } = req.body || {};
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return res.status(501).json({ error: "TELEGRAM_BOT_TOKEN sozlanmagan" });
  }
  const user = validateTelegramInitData(initData, botToken);
  if (!user) return res.status(401).json({ error: "initData yaroqsiz" });
  res.json({ user });
});

// ---- Socket.io: real-vaqt xona, sinxronizatsiya, chat, WebRTC signalling ----
io.on("connection", (socket) => {
  let currentRoomId = null;

  socket.on("room:create", ({ name, password }, cb) => {
    const roomId = nanoid(6).toUpperCase();
    const room = roomsStore.createRoom(roomId, socket.id, name || "Mehmon", password);
    socket.join(roomId);
    currentRoomId = roomId;
    cb({
      roomId,
      users: roomsStore.listUsers(roomId),
      video: room.video,
      playlist: room.playlist,
      hasPassword: !!room.password,
    });
  });

  socket.on("room:join", ({ roomId, name, password }, cb) => {
    const room = roomsStore.getRoom(roomId);
    if (!room) return cb({ error: "Bunday xona topilmadi" });
    if (room.password && room.password !== password) {
      return cb({ error: "Parol noto'g'ri", needsPassword: true });
    }
    roomsStore.addUser(roomId, socket.id, name || "Mehmon");
    socket.join(roomId);
    currentRoomId = roomId;
    cb({
      roomId,
      users: roomsStore.listUsers(roomId),
      video: room.video,
      messages: room.messages,
      playlist: room.playlist,
    });
    socket.to(roomId).emit("room:users", roomsStore.listUsers(roomId));
    socket.to(roomId).emit("chat:system", `${name || "Mehmon"} xonaga qo'shildi`);
  });

  // ---- Xo'jayinni almashtirish ----
  socket.on("host:transfer", ({ roomId, targetSocketId }) => {
    const room = roomsStore.getRoom(roomId);
    if (!room || room.hostSocketId !== socket.id) return;
    roomsStore.transferHost(roomId, targetSocketId);
    io.to(roomId).emit("room:users", roomsStore.listUsers(roomId));
    io.to(roomId).emit("chat:system", "Xona egasi almashtirildi");
  });

  // ---- Foydalanuvchini chiqarib yuborish (kick) ----
  socket.on("host:kick", ({ roomId, targetSocketId }) => {
    const room = roomsStore.getRoom(roomId);
    if (!room || room.hostSocketId !== socket.id) return;
    io.to(targetSocketId).emit("room:kicked");
    io.sockets.sockets.get(targetSocketId)?.leave(roomId);
    roomsStore.removeUser(roomId, targetSocketId);
    io.to(roomId).emit("room:users", roomsStore.listUsers(roomId));
  });

  // ---- Video sinxronizatsiyasi (faqat xona egasi boshqaradi - host-authoritative) ----
  socket.on("video:set", ({ roomId, type, source, title }) => {
    const room = roomsStore.getRoom(roomId);
    if (!room || room.hostSocketId !== socket.id) return; // faqat host video tanlashi mumkin
    roomsStore.updateVideoState(roomId, { type, source, title: title || null, isPlaying: false, currentTime: 0 });
    io.to(roomId).emit("video:changed", { type, source, title: title || null });
  });

  // ---- Playlist / navbat ----
  socket.on("playlist:add", ({ roomId, item }) => {
    const room = roomsStore.getRoom(roomId);
    if (!room || room.hostSocketId !== socket.id) return;
    const fullItem = { id: nanoid(8), ...item };
    roomsStore.addToPlaylist(roomId, fullItem);
    io.to(roomId).emit("playlist:updated", { playlist: roomsStore.getRoom(roomId).playlist });
  });

  socket.on("playlist:remove", ({ roomId, itemId }) => {
    const room = roomsStore.getRoom(roomId);
    if (!room || room.hostSocketId !== socket.id) return;
    roomsStore.removeFromPlaylist(roomId, itemId);
    io.to(roomId).emit("playlist:updated", { playlist: roomsStore.getRoom(roomId).playlist });
  });

  socket.on("playlist:play", ({ roomId, itemId }) => {
    const room = roomsStore.getRoom(roomId);
    if (!room || room.hostSocketId !== socket.id) return;
    const index = room.playlist.findIndex((i) => i.id === itemId);
    if (index === -1) return;
    const item = room.playlist[index];
    roomsStore.setPlaylistIndex(roomId, index);
    roomsStore.updateVideoState(roomId, {
      type: item.type,
      source: item.source,
      title: item.title || null,
      isPlaying: false,
      currentTime: 0,
    });
    io.to(roomId).emit("video:changed", { type: item.type, source: item.source, title: item.title || null });
    io.to(roomId).emit("playlist:index-changed", { index });
  });

  socket.on("playlist:next", ({ roomId }) => {
    const room = roomsStore.getRoom(roomId);
    if (!room || room.hostSocketId !== socket.id) return;
    const nextIndex = room.playlistIndex + 1;
    if (nextIndex >= room.playlist.length) return;
    const item = room.playlist[nextIndex];
    roomsStore.setPlaylistIndex(roomId, nextIndex);
    roomsStore.updateVideoState(roomId, {
      type: item.type,
      source: item.source,
      title: item.title || null,
      isPlaying: false,
      currentTime: 0,
    });
    io.to(roomId).emit("video:changed", { type: item.type, source: item.source, title: item.title || null });
    io.to(roomId).emit("playlist:index-changed", { index: nextIndex });
  });

  // ---- Emoji reaksiyalar ----
  socket.on("reaction:send", ({ roomId, emoji, name }) => {
    io.to(roomId).emit("reaction:show", { emoji, name });
  });

  socket.on("video:play", ({ roomId, currentTime }) => {
    const room = roomsStore.getRoom(roomId);
    if (!room || room.hostSocketId !== socket.id) return;
    roomsStore.updateVideoState(roomId, { isPlaying: true, currentTime });
    socket.to(roomId).emit("video:play", { currentTime });
  });

  socket.on("video:pause", ({ roomId, currentTime }) => {
    const room = roomsStore.getRoom(roomId);
    if (!room || room.hostSocketId !== socket.id) return;
    roomsStore.updateVideoState(roomId, { isPlaying: false, currentTime });
    socket.to(roomId).emit("video:pause", { currentTime });
  });

  socket.on("video:seek", ({ roomId, currentTime }) => {
    const room = roomsStore.getRoom(roomId);
    if (!room || room.hostSocketId !== socket.id) return;
    roomsStore.updateVideoState(roomId, { currentTime });
    socket.to(roomId).emit("video:seek", { currentTime });
  });

  // Yangi qo'shilgan a'zo hozirgi holatni so'rashi mumkin
  socket.on("video:sync-request", ({ roomId }, cb) => {
    const room = roomsStore.getRoom(roomId);
    if (!room) return cb && cb({ error: "Xona topilmadi" });
    cb && cb({ video: room.video });
  });

  // ---- Matnli chat ----
  socket.on("chat:message", ({ roomId, name, text }) => {
    if (!text || !text.trim()) return;
    const message = { name, text: text.slice(0, 1000), time: Date.now() };
    roomsStore.addMessage(roomId, message);
    io.to(roomId).emit("chat:message", message);
  });

  // ---- WebRTC signalling (ovozli chat uchun) ----
  // Har bir client boshqalarga to'g'ridan-to'g'ri (mesh) ulanadi, server faqat signal almashinuvchi vosita.
  socket.on("voice:join", ({ roomId }) => {
    socket.to(roomId).emit("voice:peer-joined", { socketId: socket.id });
  });

  socket.on("voice:signal", ({ targetSocketId, signal }) => {
    io.to(targetSocketId).emit("voice:signal", { fromSocketId: socket.id, signal });
  });

  socket.on("voice:leave", ({ roomId }) => {
    socket.to(roomId).emit("voice:peer-left", { socketId: socket.id });
  });

  socket.on("disconnect", () => {
    if (!currentRoomId) return;
    const room = roomsStore.removeUser(currentRoomId, socket.id);
    io.to(currentRoomId).emit("voice:peer-left", { socketId: socket.id });
    if (room) {
      io.to(currentRoomId).emit("room:users", roomsStore.listUsers(currentRoomId));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server ${PORT}-portda ishga tushdi: http://localhost:${PORT}`);
});
