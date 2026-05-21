const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Health check
app.get('/', (req, res) => res.json({ status: 'ok', service: 'see2world-signaling' }));

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Track rooms: { roomId: { hostId, participants: Set<socketId> } }
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (data) => {
    let roomId, isCreator;
    if (data && typeof data === 'object') {
      roomId = data.roomId;
      isCreator = !!data.isCreator;
    } else {
      roomId = data;
      isCreator = false;
    }

    // Validate roomId format (simple alphanumeric check)
    if (!roomId || typeof roomId !== 'string' || !/^[-A-Za-z0-9_]{3,64}$/.test(roomId)) {
      socket.emit('room-not-found', { roomId });
      console.log(`User ${socket.id} provided invalid room id ${roomId} — rejected.`);
      return;
    }

    // --- Room validation ---
    // A participant (non-creator) cannot join a room that doesn't exist yet
    if (!isCreator && !rooms.has(roomId)) {
      socket.emit('room-not-found', { roomId });
      console.log(`User ${socket.id} tried to join non-existent room ${roomId} — rejected.`);
      return;
    }

    socket.join(roomId);

    // Get active sockets after joining
    const activeSockets = io.sockets.adapter.rooms.get(roomId);
    const participants = activeSockets ? Array.from(activeSockets) : [socket.id];

    // If the room doesn't exist in our map yet, this is the creator opening it
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { hostId: socket.id });
    }

    const room = rooms.get(roomId);

    // If creator is joining and the current host is gone, reassign to creator
    if (isCreator && !participants.includes(room.hostId)) {
      room.hostId = socket.id;
    }

    // Safety: if host is no longer in the room, fallback to first participant
    if (!participants.includes(room.hostId)) {
      room.hostId = participants[0] || socket.id;
    }

    // If creator is alone in the room, they are definitively the host
    if (isCreator && participants.length === 1) {
      room.hostId = socket.id;
    }

    const isHost = room.hostId === socket.id;
    const participantCount = participants.length;
    const role = isHost ? 'host' : 'participant';

    console.log(`User ${socket.id} joined room ${roomId} — isHost: ${isHost}, count: ${participantCount}, role: ${role}, isCreator: ${isCreator}`);

    // Send room-info to the joining user
    socket.emit('room-info', { hostId: room.hostId, isHost, participantCount, role });

    // Broadcast updated count to everyone in the room
    io.to(roomId).emit('room-count', { participantCount });

    // Notify other peers (for WebRTC negotiation)
    socket.to(roomId).emit('user-connected', socket.id);
  });

  // WebRTC Signaling: Offer
  socket.on('offer', (payload) => {
    io.to(payload.target).emit('offer', payload);
  });

  // WebRTC Signaling: Answer
  socket.on('answer', (payload) => {
    io.to(payload.target).emit('answer', payload);
  });

  // WebRTC Signaling: ICE Candidate
  socket.on('ice-candidate', (payload) => {
    io.to(payload.target).emit('ice-candidate', payload);
  });

  // Chat message — broadcast to others only (sender adds locally)
  socket.on('chat-message', (payload) => {
    socket.to(payload.roomId).emit('chat-message', payload);
  });

  // Browser synchronization (URL + mode)
  socket.on('browser-sync', (payload) => {
    socket.to(payload.roomId).emit('browser-sync', payload);
  });

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue;

      // Check after a small delay so that the socket has actually finished leaving the room
      setTimeout(() => {
        const activeSockets = io.sockets.adapter.rooms.get(roomId);
        if (!activeSockets || activeSockets.size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} is now empty and has been deleted.`);
          return;
        }

        const participants = Array.from(activeSockets);
        const room = rooms.get(roomId);
        if (room) {
          // If the host is no longer in the room, reassign host
          if (!participants.includes(room.hostId)) {
            room.hostId = participants[0];
            io.to(roomId).emit('host-changed', { newHostId: room.hostId });
            console.log(`Host left Room ${roomId}. New host is ${room.hostId}`);
          }

          const participantCount = participants.length;
          io.to(roomId).emit('room-count', { participantCount });
        }
      }, 100);

      // Notify other peers in the room immediately to tear down WebRTC connection
      socket.to(roomId).emit('user-disconnected', socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server listening on port ${PORT}`);
});
