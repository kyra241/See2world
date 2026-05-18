# See2world 🌍

> Application de Watch Party — regardez des films ensemble à distance en temps réel.

## ✨ Fonctionnalités

- 🎬 **Partage d'écran** en temps réel via WebRTC
- 📹 **Webcam** dans une barre latérale minimaliste (avec option Hide)
- 🎙️ **Micro** avec mute/unmute à la volée
- 🔊 **Contrôle du volume** global des participants
- 💬 **Chat** intégré dans la salle
- 🌐 **Navigateur intégré** pour streamer directement depuis l'app
- 🖥️ **Double mode plein écran** (lecteur interne + app complète)
- 🪟 **Fenêtre native** avec barre de titre personnalisée (réduire, agrandir, fermer)
- 📋 **Code de salle** partageable en 1 clic

## 🏗️ Structure du projet

```
see2world/
├── server/          # Serveur de signalisation Node.js + Socket.io
└── client/          # Frontend React + Vite + Tailwind CSS + Electron
```

## 🚀 Lancer en développement

### 1. Démarrer le serveur
```bash
cd server
npm install
npm start
```

### 2. Démarrer l'app (navigateur)
```bash
cd client
npm install
npm run dev
```

### 3. Démarrer l'app (Electron - Desktop)
```bash
cd client
npm run electron:dev
```

## 📦 Créer l'installeur Windows (.exe)

```bash
cd client
npm run electron:build
```

L'installeur sera généré dans `client/release/`.

## 🌐 Déploiement

- **Frontend** → [Netlify](https://netlify.com) (dossier `client`, build: `npm run build`, publish: `dist`)
- **Serveur** → [Render.com](https://render.com) (dossier `server`, start: `npm start`)

Configurer la variable d'environnement sur Netlify :
```
VITE_SERVER_URL=https://VOTRE_URL_RENDER.onrender.com
```

## 🛠️ Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Desktop | Electron |
| Temps réel | WebRTC + Socket.io |
| Serveur | Node.js + Express |
| Build | electron-builder (NSIS) |
