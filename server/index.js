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

    // Get active sockets in the room from the socket.io adapter
    const activeSockets = io.sockets.adapter.rooms.get(roomId);
    const participants = activeSockets ? Array.from(activeSockets) : [socket.id];

    // If the room doesn't exist in our map or the host is no longer in the room, assign a new host
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { hostId: socket.id });
    }
    const room = rooms.get(roomId);

    // Verify if the current host is actually in the room, else fallback to the first active socket
    if (!participants.includes(room.hostId)) {
      room.hostId = participants[0] || socket.id;
    }

    const isHost = room.hostId === socket.id;
    const participantCount = participants.length;

    console.log(`User ${socket.id} joined room ${roomId} (host: ${room.hostId}, isHost: ${isHost}, count: ${participantCount})`);

    // Send room-info to the joining user
    socket.emit('room-info', {
      hostId: room.hostId,
      isHost,
      participantCount
    });

    // Notify all participants in the room of the updated count
    io.to(roomId).emit('room-count', { participantCount });

    // Notify all other participants that a user connected (for WebRTC)
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

      // Check on the next tick so that the socket has actually finished leaving the room
      process.nextTick(() => {
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
      });

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
