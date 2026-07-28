// public/js/room.js

const params = new URLSearchParams(window.location.search);
const action = params.get("action"); // 'create' | 'join'
let roomId = (params.get("room") || "").toUpperCase();
const myName = decodeURIComponent(params.get("name") || "Mehmon");
const createPassword = params.get("password") || null;
let joinPassword = params.get("password") || null;

const socket = io(RESOLVED_SERVER_URL);

let isHost = false;
let ytPlayer = null;
let ytReady = false;
let currentVideoType = null; // 'youtube' | 'file'
let suppressEvents = false; // sinxronlash paytida o'z eventlarimizni qayta yubormaslik uchun
let currentUsers = [];
let currentPlaylist = [];

const el = (id) => document.getElementById(id);

// ---------- Xonaga kirish ----------
socket.on("connect", () => {
  if (action === "create") {
    socket.emit("room:create", { name: myName, password: createPassword }, (res) => {
      roomId = res.roomId;
      
      // REFRESH MUAMMOSI YECHIMI: URL'ni avtomat ravishda 'join' ga o'zgartirish
      const newUrl = `${window.location.origin}${window.location.pathname}?action=join&room=${roomId}&name=${encodeURIComponent(myName)}`;
      window.history.replaceState(null, '', newUrl);

      onRoomReady(res.users, res.video, [], true, res.playlist, res.hasPassword);
    });
  } else {
    if (!roomId) {
      showToast("Xona kodi topilmadi", "error");
      setTimeout(() => (window.location.href = "/"), 1200);
      return;
    }
    joinRoom();
  }
});

function joinRoom() {
  socket.emit("room:join", { roomId, name: myName, password: joinPassword }, (res) => {
    if (res.error) {
      if (res.needsPassword) {
        const pw = prompt("Bu xona parol bilan qulflangan. Parolni kiriting:");
        if (pw !== null) {
          joinPassword = pw;
          joinRoom();
          return;
        }
      }
      window.location.href = `/?err=${encodeURIComponent(res.error)}`;
      return;
    }
    onRoomReady(res.users, res.video, res.messages, false, res.playlist, !!joinPassword);
  });
}

function onRoomReady(users, video, messages, hostFlag, playlist, hasPassword) {
  el("roomCodeLabel").textContent = roomId;
  document.title = `Xona ${roomId} — BirgaTomosha`;
  el("lockIcon").style.display = hasPassword ? "inline" : "none";

  isHost = hostFlag || users.find((u) => u.socketId === socket.id)?.isHost;
  currentUsers = users;
  updateUserList(users);
  el("hostControls").style.display = isHost ? "flex" : "none";

  (messages || []).forEach(renderChatMessage);

  currentPlaylist = playlist || [];
  renderPlaylist();

  if (video && video.source) {
    loadVideo(video.type, video.source, video.title);
    setTimeout(() => applyRemoteVideoState(video), 1200);
  }
}

// ---------- Foydalanuvchilar ro'yxati ----------
socket.on("room:users", (users) => {
  currentUsers = users;
  const mine = users.find((u) => u.socketId === socket.id);
  if (mine) isHost = mine.isHost;
  el("hostControls").style.display = isHost ? "flex" : "none";
  updateUserList(users);
});

socket.on("room:kicked", () => {
  showToast("Siz xonadan chiqarib yuborildingiz", "error");
  setTimeout(() => (window.location.href = "/"), 1500);
});

function updateUserList(users) {
  el("userList").innerHTML = users
    .map((u) => {
      const controls =
        isHost && u.socketId !== socket.id
          ? `<button class="mini-btn" title="Xo'jayin qilish" onclick="transferHostTo('${u.socketId}')">👑</button>
             <button class="mini-btn" title="Chiqarib yuborish" onclick="kickUser('${u.socketId}')">✕</button>`
          : "";
      return `<span class="user-chip ${u.isHost ? "host" : ""}">${avatarHtml(u.name)} ${escapeHtml(u.name)}${u.isHost ? " 👑" : ""}${controls}</span>`;
    })
    .join("");
}

function transferHostTo(targetSocketId) {
  if (!confirm("Xona egaligini shu foydalanuvchiga o'tkazasizmi?")) return;
  socket.emit("host:transfer", { roomId, targetSocketId });
}

function kickUser(targetSocketId) {
  if (!confirm("Bu foydalanuvchini xonadan chiqarib yubormoqchimisiz?")) return;
  socket.emit("host:kick", { roomId, targetSocketId });
}

// ---------- Havolani nusxalash ----------
el("copyLinkBtn").onclick = () => {
  const link = `${window.location.origin}/room.html?action=join&room=${roomId}`;
  navigator.clipboard.writeText(link);
  showToast("Havola nusxalandi ✓", "success");
};

// ================== VIDEO: YOUTUBE ==================
function onYouTubeIframeAPIReady() {
  ytReady = true;
}
window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

function extractYoutubeId(url) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : (url.length === 11 ? url : null);
}

el("loadYoutubeBtn").onclick = () => {
  const url = el("youtubeInput").value.trim();
  const videoId = extractYoutubeId(url);
  if (!videoId) {
    showToast("YouTube havolasi noto'g'ri ko'rinadi", "error");
    return;
  }
  socket.emit("video:set", { roomId, type: "youtube", source: videoId, title: `YouTube: ${videoId}` });
  loadVideo("youtube", videoId);
  el("youtubeInput").value = "";
};

el("addToPlaylistBtn").onclick = () => {
  const url = el("youtubeInput").value.trim();
  const videoId = extractYoutubeId(url);
  if (!videoId) {
    showToast("YouTube havolasi noto'g'ri ko'rinadi", "error");
    return;
  }
  socket.emit("playlist:add", { roomId, item: { type: "youtube", source: videoId, title: `YouTube: ${videoId}` } });
  el("youtubeInput").value = "";
  showToast("Navbatga qo'shildi ✓", "success");
};

// ================== VIDEO: FAYL YUKLASH ==================
el("fileInput").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  el("uploadStatus").textContent = "Yuklanmoqda...";

  const formData = new FormData();
  formData.append("video", file);

  try {
    const resp = await fetch(`${RESOLVED_SERVER_URL}/api/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await resp.json();
    if (data.url) {
      const fullUrl = `${RESOLVED_SERVER_URL}${data.url}`;
      socket.emit("video:set", { roomId, type: "file", source: fullUrl, title: file.name });
      loadVideo("file", fullUrl, file.name);
      el("uploadStatus").textContent = "Yuklandi ✓";
      showToast("Video yuklandi ✓", "success");
    } else {
      el("uploadStatus").textContent = "Xatolik yuz berdi";
      showToast("Video yuklashda xatolik", "error");
    }
  } catch (err) {
    console.error(err);
    el("uploadStatus").textContent = "Yuklashda xatolik";
    showToast("Video yuklashda xatolik", "error");
  }
};

// ---------- Videoni yuklash (umumiy) ----------
function loadVideo(type, source, title) {
  currentVideoType = type;
  el("noVideoMsg").style.display = "none";

  if (type === "youtube") {
    el("filePlayer").style.display = "none";
    el("youtubePlayer").style.display = "block";
    createOrUpdateYoutubePlayer(source);
  } else if (type === "file") {
    el("youtubePlayer").style.display = "none";
    const player = el("filePlayer");
    player.style.display = "block";
    player.src = source;
    attachFilePlayerEvents();
  }
}

function createOrUpdateYoutubePlayer(videoId) {
  const start = () => {
    if (ytPlayer) {
      // Pleyer hali to'liq yuklanmagan bo'lsa, kutib turamiz
      if (typeof ytPlayer.loadVideoById !== "function") {
        setTimeout(() => createOrUpdateYoutubePlayer(videoId), 300);
        return;
      }
      ytPlayer.loadVideoById(videoId);
      return;
    }
    ytPlayer = new YT.Player("youtubePlayer", {
      height: "100%",
      width: "100%",
      videoId,
      playerVars: { rel: 0, playsinline: 1 }, 
      events: {
        onReady: () => attachYoutubePlayerEvents(),
        onStateChange: onYoutubeStateChange,
      },
    });
  };
  if (ytReady) start();
  else {
    const iv = setInterval(() => {
      if (ytReady) {
        clearInterval(iv);
        start();
      }
    }, 200);
  }
}

function attachYoutubePlayerEvents() {
  // onStateChange allaqachon Player konfiguratsiyasida bog'langan
}

function onYoutubeStateChange(e) {
  if (suppressEvents || !isHost) {
    return;
  }
  if (e.data === YT.PlayerState.PLAYING) {
    socket.emit("video:play", { roomId, currentTime: ytPlayer.getCurrentTime() });
  } else if (e.data === YT.PlayerState.PAUSED) {
    socket.emit("video:pause", { roomId, currentTime: ytPlayer.getCurrentTime() });
  } else if (e.data === YT.PlayerState.ENDED) {
    socket.emit("playlist:next", { roomId });
  }
}

function attachFilePlayerEvents() {
  const player = el("filePlayer");
  player.onplay = () => {
    if (suppressEvents || !isHost) return;
    socket.emit("video:play", { roomId, currentTime: player.currentTime });
  };
  player.onpause = () => {
    if (suppressEvents || !isHost) return;
    socket.emit("video:pause", { roomId, currentTime: player.currentTime });
  };
  player.onseeked = () => {
    if (suppressEvents || !isHost) return;
    socket.emit("video:seek", { roomId, currentTime: player.currentTime });
  };
  player.onended = () => {
    if (!isHost) return;
    socket.emit("playlist:next", { roomId });
  };
}

// ---------- Boshqa foydalanuvchilardan kelgan video hodisalari ----------
socket.on("video:changed", ({ type, source, title }) => loadVideo(type, source, title));

socket.on("video:play", ({ currentTime }) => applyRemoteVideoState({ isPlaying: true, currentTime }));
socket.on("video:pause", ({ currentTime }) => applyRemoteVideoState({ isPlaying: false, currentTime }));
socket.on("video:seek", ({ currentTime }) => applyRemoteVideoState({ currentTime }));

function applyRemoteVideoState(state) {
  suppressEvents = true;
  try {
    if (currentVideoType === "youtube" && ytPlayer && typeof ytPlayer.seekTo === "function") {
      if (typeof state.currentTime === "number") ytPlayer.seekTo(state.currentTime, true);
      if (state.isPlaying === true) ytPlayer.playVideo();
      if (state.isPlaying === false) ytPlayer.pauseVideo();
    } else if (currentVideoType === "file") {
      const player = el("filePlayer");
      if (typeof state.currentTime === "number" && Math.abs(player.currentTime - state.currentTime) > 1) {
        player.currentTime = state.currentTime;
      }
      if (state.isPlaying === true) player.play();
      if (state.isPlaying === false) player.pause();
    }
  } catch (err) {
    console.warn("Sinxronlashda xatolik (kutilmoqda):", err);
  } finally {
    setTimeout(() => (suppressEvents = false), 300);
  }
}

// ================== PLAYLIST / NAVBAT ==================
socket.on("playlist:updated", ({ playlist }) => {
  currentPlaylist = playlist;
  renderPlaylist();
});

socket.on("playlist:index-changed", ({ index }) => {
  renderPlaylist(index);
});

function renderPlaylist(activeIndex) {
  const container = el("playlistItems");
  if (!currentPlaylist.length) {
    container.innerHTML = `<p class="playlist-empty">Navbat bo'sh</p>`;
    el("nextVideoBtn").style.display = "none";
    return;
  }
  container.innerHTML = currentPlaylist
    .map((item, idx) => {
      const active = idx === activeIndex ? "active" : "";
      const removeBtn = isHost
        ? `<button class="mini-btn" onclick="removeFromPlaylist('${item.id}')">✕</button>`
        : "";
      return `<div class="playlist-item ${active}">
        <span class="playlist-item-title" ${isHost ? `onclick="playFromPlaylist('${item.id}')" style="cursor:pointer"` : ""}>
          ${item.type === "youtube" ? "▶️" : "📁"} ${escapeHtml(item.title || item.source)}
        </span>
        ${removeBtn}
      </div>`;
    })
    .join("");
  el("nextVideoBtn").style.display = isHost && currentPlaylist.length > 0 ? "inline-block" : "none";
}

function playFromPlaylist(itemId) {
  socket.emit("playlist:play", { roomId, itemId });
}

function removeFromPlaylist(itemId) {
  socket.emit("playlist:remove", { roomId, itemId });
}

el("nextVideoBtn").onclick = () => socket.emit("playlist:next", { roomId });

// ================== EMOJI REAKSIYALAR ==================
document.querySelectorAll(".reaction-btn").forEach((btn) => {
  btn.onclick = () => {
    const emoji = btn.dataset.emoji;
    socket.emit("reaction:send", { roomId, emoji, name: myName });
  };
});

socket.on("reaction:show", ({ emoji }) => {
  spawnReaction(emoji);
});

function spawnReaction(emoji) {
  const layer = el("reactionLayer");
  const span = document.createElement("span");
  span.className = "floating-reaction";
  span.textContent = emoji;
  span.style.left = `${20 + Math.random() * 60}%`;
  layer.appendChild(span);
  setTimeout(() => span.remove(), 2200);
}

// ================== TO'LIQ EKRAN (Mobil/Bot moslashtirilgan) ==================
el("fullscreenBtn").onclick = () => {
  const wrap = el("playerWrap");
  
  // Telegram Bot ichida oynani iloji boricha kengaytirish
  if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.expand();
  }

  if (!wrap.classList.contains("fullscreen-active")) {
    // CSS class orqali majburiy fullscreen
    wrap.classList.add("fullscreen-active");
    
    // Web uchun standart fullscreen API chaqirish
    if (wrap.requestFullscreen) {
      wrap.requestFullscreen().catch(()=>{});
    } else if (wrap.webkitRequestFullscreen) {
      wrap.webkitRequestFullscreen();
    }
  } else {
    wrap.classList.remove("fullscreen-active");
    // Web uchun standart ekrandan chiqish
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(()=>{});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
};

document.addEventListener("fullscreenchange", () => {
  el("playerWrap").classList.toggle("fullscreen-active", !!document.fullscreenElement);
});

// ================== CHAT ==================
function renderChatMessage(msg) {
  const div = document.createElement("div");
  div.className = "chat-msg";
  div.innerHTML = `${avatarHtml(msg.name)} <b>${escapeHtml(msg.name)}:</b> ${escapeHtml(msg.text)}`;
  el("chatMessages").appendChild(div);
  el("chatMessages").scrollTop = el("chatMessages").scrollHeight;
}

socket.on("chat:message", renderChatMessage);
socket.on("chat:system", (text) => {
  const div = document.createElement("div");
  div.className = "chat-system";
  div.textContent = text;
  el("chatMessages").appendChild(div);
  el("chatMessages").scrollTop = el("chatMessages").scrollHeight;
});

function sendChat() {
  const text = el("chatInput").value.trim();
  if (!text) return;
  socket.emit("chat:message", { roomId, name: myName, text });
  el("chatInput").value = "";
}
el("sendChatBtn").onclick = sendChat;
el("chatInput").onkeydown = (e) => {
  if (e.key === "Enter") sendChat();
};

// ================== OVOZLI SUHBAT (WebRTC mesh) ==================
let localStream = null;
let voiceActive = false;
const peers = new Map(); // socketId -> RTCPeerConnection

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

el("voiceToggleBtn").onclick = async () => {
  if (!voiceActive) {
    try {
      // Eski va yangi mobil brauzerlar uchun moslashtirilgan kod
      const getUserMedia = navigator.mediaDevices?.getUserMedia || 
                           navigator.getUserMedia || 
                           navigator.webkitGetUserMedia || 
                           navigator.mozGetUserMedia;
                           
      if (!getUserMedia) {
        throw new Error("Mikrofon qo'llab-quvvatlanmaydi");
      }

      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceActive = true;
      el("voiceToggleBtn").textContent = "🔇 Ovozli suhbatdan chiqish";
      el("voiceStatus").textContent = "Ulanmoqda...";
      socket.emit("voice:join", { roomId });
    } catch (err) {
      console.error(err);
      showToast("Mikrofonga ruxsat berilmadi yoki tizim chekladi", "error");
    }
  } else {
    leaveVoice();
  }
};

function leaveVoice() {
  voiceActive = false;
  el("voiceToggleBtn").textContent = "🎙️ Ovozli suhbatga qo'shilish";
  el("voiceStatus").textContent = "";
  socket.emit("voice:leave", { roomId });
  peers.forEach((pc) => pc.close());
  peers.clear();
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  document.querySelectorAll("audio[data-peer]").forEach((a) => a.remove());
}

function createPeerConnection(targetSocketId) {
  const pc = new RTCPeerConnection(ICE_SERVERS);
  localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit("voice:signal", {
        targetSocketId,
        signal: { type: "candidate", candidate: e.candidate },
      });
    }
  };

  pc.ontrack = (e) => {
    let audio = document.querySelector(`audio[data-peer="${targetSocketId}"]`);
    if (!audio) {
      audio = document.createElement("audio");
      audio.dataset.peer = targetSocketId;
      audio.autoplay = true;
      document.body.appendChild(audio);
    }
    audio.srcObject = e.streams[0];
  };

  peers.set(targetSocketId, pc);
  return pc;
}

socket.on("voice:peer-joined", async ({ socketId }) => {
  if (!voiceActive) return;
  const pc = createPeerConnection(socketId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("voice:signal", { targetSocketId: socketId, signal: { type: "offer", sdp: offer } });
  el("voiceStatus").textContent = "Ulandi ✓";
});

socket.on("voice:signal", async ({ fromSocketId, signal }) => {
  let pc = peers.get(fromSocketId);

  if (signal.type === "offer") {
    if (!voiceActive) return;
    if (!pc) pc = createPeerConnection(fromSocketId);
    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("voice:signal", { targetSocketId: fromSocketId, signal: { type: "answer", sdp: answer } });
    el("voiceStatus").textContent = "Ulandi ✓";
  } else if (signal.type === "answer") {
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
  } else if (signal.type === "candidate") {
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } catch (err) {
        console.warn("ICE candidate xatosi", err);
      }
    }
  }
});

socket.on("voice:peer-left", ({ socketId }) => {
  const pc = peers.get(socketId);
  if (pc) {
    pc.close();
    peers.delete(socketId);
  }
  const audio = document.querySelector(`audio[data-peer="${socketId}"]`);
  if (audio) audio.remove();
});

// ---------- Yordamchi ----------
function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

window.addEventListener("beforeunload", () => {
  if (voiceActive) socket.emit("voice:leave", { roomId });
});

// ---------- Telegram Mini App: "Orqaga" tugmasi ----------
if (typeof setupTelegramBackButton === "function") {
  setupTelegramBackButton(() => {
    if (voiceActive) socket.emit("voice:leave", { roomId });
    window.location.href = "/";
  });
}

// ---------- XONANI YOPISH ----------
const closeBtn = el("closeRoomBtn");
if (closeBtn) {
  closeBtn.onclick = () => {
    if(confirm("Xonani butunlay yopmoqchimisiz? Barcha foydalanuvchilar chiqarib yuboriladi.")) {
      socket.emit("room:close", { roomId });
    }
  };
}

socket.on("room:closed", () => {
  alert("Xona egasi tomonidan yopildi.");
  window.location.href = "/"; 
});
