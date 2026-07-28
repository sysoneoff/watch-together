// server/rooms.js
// Xotirada (in-memory) xonalarni boshqarish.
// Katta loyiha uchun buni Redis'ga ko'chirish tavsiya etiladi (bir nechta server instance bo'lganda).

const rooms = new Map();

function createRoom(roomId, hostSocketId, hostName, password) {
  const room = {
    id: roomId,
    hostSocketId,
    password: password || null, // null = ochiq xona
    users: new Map(), // socketId -> {name}
    video: {
      type: null,      // 'youtube' | 'file'
      source: null,    // youtube video id yoki fayl URL
      title: null,
      isPlaying: false,
      currentTime: 0,
      updatedAt: Date.now(),
    },
    playlist: [],   // [{id, type, source, title}]
    playlistIndex: -1,
    messages: [], // oxirgi 100 ta chat xabari
    createdAt: Date.now(),
  };
  room.users.set(hostSocketId, { name: hostName });
  rooms.set(roomId, room);
  return room;
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function addUser(roomId, socketId, name) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.users.set(socketId, { name });
  return room;
}

function removeUser(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.users.delete(socketId);

  // Agar xona egasi chiqib ketsa, birinchi qolgan foydalanuvchini yangi xo'jayin qilamiz
  if (room.hostSocketId === socketId && room.users.size > 0) {
    room.hostSocketId = room.users.keys().next().value;
  }

  if (room.users.size === 0) {
    rooms.delete(roomId);
    return null;
  }
  return room;
}

function updateVideoState(roomId, state) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.video = { ...room.video, ...state, updatedAt: Date.now() };
  return room;
}

function addMessage(roomId, message) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.messages.push(message);
  if (room.messages.length > 100) room.messages.shift();
  return room;
}

function listUsers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.users.entries()).map(([socketId, u]) => ({
    socketId,
    name: u.name,
    isHost: socketId === room.hostSocketId,
  }));
}

function transferHost(roomId, newHostSocketId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  if (!room.users.has(newHostSocketId)) return null;
  room.hostSocketId = newHostSocketId;
  return room;
}

function addToPlaylist(roomId, item) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.playlist.push(item);
  return room;
}

function removeFromPlaylist(roomId, itemId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.playlist = room.playlist.filter((i) => i.id !== itemId);
  return room;
}

function setPlaylistIndex(roomId, index) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.playlistIndex = index;
  return room;
}

module.exports = {
  createRoom,
  getRoom,
  addUser,
  removeUser,
  updateVideoState,
  addMessage,
  listUsers,
  transferHost,
  addToPlaylist,
  removeFromPlaylist,
  setPlaylistIndex,
};
