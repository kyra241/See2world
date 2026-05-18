# See2world 🌍

Application de Watch Party — regardez des films ensemble à distance en temps réel.

## Structure
- `/server` — Serveur de signalisation Node.js + Socket.io
- `/client` — Frontend React + Vite + Tailwind CSS + Electron

## Démarrage (développement)

```bash
# 1. Serveur
cd server && npm install && node index.js

# 2. Client web
cd client && npm install && npm run dev

# 3. Application Desktop
cd client && npm run electron:dev
```

## Technologies
- WebRTC (P2P audio/video/screen sharing)
- Socket.io (signalisation temps réel)
- React + Vite + Tailwind CSS v4
- Electron (app Windows)
