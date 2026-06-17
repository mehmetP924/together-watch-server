const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.get('/', (req, res) => {
  res.send('TogetherWatch server is running.');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const rooms = new Map();

function makeRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('create-room', ({ name }, callback) => {
    const roomCode = makeRoomCode();
    rooms.set(roomCode, { users: new Map() });
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.name = name || 'Kullanıcı';
    rooms.get(roomCode).users.set(socket.id, socket.data.name);

    callback?.({ ok: true, roomCode });
    io.to(roomCode).emit('room-users', Array.from(rooms.get(roomCode).users.values()));
  });

  socket.on('join-room', ({ roomCode, name }, callback) => {
    roomCode = String(roomCode || '').trim().toUpperCase();
    if (!rooms.has(roomCode)) {
      callback?.({ ok: false, message: 'Oda bulunamadı.' });
      return;
    }

    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.name = name || 'Kullanıcı';
    rooms.get(roomCode).users.set(socket.id, socket.data.name);

    callback?.({ ok: true, roomCode });
    socket.to(roomCode).emit('system-message', `${socket.data.name} odaya katıldı.`);
    io.to(roomCode).emit('room-users', Array.from(rooms.get(roomCode).users.values()));
  });

  socket.on('chat-message', ({ roomCode, name, message }) => {
    roomCode = String(roomCode || socket.data.roomCode || '').trim().toUpperCase();
    if (!roomCode) return;
    io.to(roomCode).emit('chat-message', {
      name: name || socket.data.name || 'Kullanıcı',
      message: String(message || '').slice(0, 500),
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('video-event', (payload) => {
    const roomCode = String(payload?.roomCode || socket.data.roomCode || '').trim().toUpperCase();
    if (!roomCode) return;
    socket.to(roomCode).emit('video-event', {
      type: payload.type,
      currentTime: payload.currentTime,
      paused: payload.paused,
      sentAt: Date.now()
    });
  });

  socket.on('sync-request', ({ roomCode }) => {
    roomCode = String(roomCode || socket.data.roomCode || '').trim().toUpperCase();
    if (!roomCode) return;
    socket.to(roomCode).emit('sync-request');
  });

  socket.on('webrtc-offer', ({ roomCode, offer }) => {
  roomCode = String(roomCode || socket.data.roomCode || '').trim().toUpperCase();
  if (!roomCode) return;

  socket.to(roomCode).emit('webrtc-offer', {
    offer,
    from: socket.id
  });
});

socket.on('webrtc-answer', ({ roomCode, answer }) => {
  roomCode = String(roomCode || socket.data.roomCode || '').trim().toUpperCase();
  if (!roomCode) return;

  socket.to(roomCode).emit('webrtc-answer', {
    answer,
    from: socket.id
  });
});

socket.on('webrtc-ice-candidate', ({ roomCode, candidate }) => {
  roomCode = String(roomCode || socket.data.roomCode || '').trim().toUpperCase();
  if (!roomCode) return;

  socket.to(roomCode).emit('webrtc-ice-candidate', {
    candidate,
    from: socket.id
  });
});

  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode;
    if (roomCode && rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      const name = room.users.get(socket.id) || 'Kullanıcı';
      room.users.delete(socket.id);
      socket.to(roomCode).emit('system-message', `${name} odadan ayrıldı.`);
      io.to(roomCode).emit('room-users', Array.from(room.users.values()));
      if (room.users.size === 0) rooms.delete(roomCode);
    }
    console.log('Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`TogetherWatch server running on http://localhost:${PORT}`);
});


