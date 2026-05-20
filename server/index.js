const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

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

  socket.on('join-room', (roomId) => {
    socket.join(roomId);

    // Initialize room if it doesn't exist — first joiner is the host
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { hostId: socket.id, participants: new Set() });
    }
    const room = rooms.get(roomId);
    room.participants.add(socket.id);

    const isHost = room.hostId === socket.id;
    const participantCount = room.participants.size;

    console.log(`User ${socket.id} joined room ${roomId} (host: ${isHost}, count: ${participantCount})`);

    // Send room info to the newly joined user
    socket.emit('room-info', {
      hostId: room.hostId,
      isHost,
      participantCount
    });

    // Notify all other users in the room of the new count
    socket.to(roomId).emit('room-count', { participantCount });

    // Notify other users that a new peer connected (for WebRTC)
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

      const room = rooms.get(roomId);
      if (!room) continue;

      room.participants.delete(socket.id);

      if (room.participants.size === 0) {
        // Empty room — clean up
        rooms.delete(roomId);
      } else {
        // If host left, assign a new host
        if (room.hostId === socket.id) {
          room.hostId = [...room.participants][0];
          io.to(roomId).emit('host-changed', { newHostId: room.hostId });
        }
        // Notify others of updated count and disconnection
        const participantCount = room.participants.size;
        socket.to(roomId).emit('user-disconnected', socket.id);
        socket.to(roomId).emit('room-count', { participantCount });
      }
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
