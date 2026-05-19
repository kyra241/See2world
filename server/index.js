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

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
    // Notify other users in the room
    socket.to(roomId).emit('user-connected', socket.id);
  });

  // WebRTC Signaling: Offer
  socket.on('offer', (payload) => {
    // payload: { target: socketId, caller: socketId, sdp: RTCSessionDescription }
    io.to(payload.target).emit('offer', payload);
  });

  // WebRTC Signaling: Answer
  socket.on('answer', (payload) => {
    // payload: { target: socketId, caller: socketId, sdp: RTCSessionDescription }
    io.to(payload.target).emit('answer', payload);
  });

  // WebRTC Signaling: ICE Candidate
  socket.on('ice-candidate', (payload) => {
    // payload: { target: socketId, caller: socketId, candidate: RTCIceCandidate }
    io.to(payload.target).emit('ice-candidate', payload);
  });

  // Chat message
  socket.on('chat-message', (payload) => {
    // payload: { roomId: string, sender: string, text: string, timestamp: number }
    socket.to(payload.roomId).emit('chat-message', payload);
  });

  // Browser synchronization
  socket.on('browser-sync', (payload) => {
    // payload: { roomId: string, isBrowserMode: boolean, currentUrl: string }
    socket.to(payload.roomId).emit('browser-sync', payload);
  });

  socket.on('disconnecting', () => {
    // Notify all rooms the user is in
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit('user-disconnected', socket.id);
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
