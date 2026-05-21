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
- **Serveur** → [bonto.dev](https://bonto.dev) ou autre hébergeur Node.js (dossier `server`, start: `npm start`)

Un workflow GitHub Actions a été ajouté dans `.github/workflows/netlify-deploy.yml` pour déployer automatiquement le frontend lorsque la branche `main` est mise à jour.

### Configuration Netlify

1. Ajouter ces secrets dans votre dépôt GitHub :
   - `NETLIFY_AUTH_TOKEN`
   - `NETLIFY_SITE_ID`
   - `VITE_SERVER_URL` (exemple : `https://see2world.bonto.run`)

2. Si votre site Netlify est déjà connecté au dépôt, la branche `main` déclenchera automatiquement le déploiement.

### Configuration du serveur

- Le frontend en production pointe par défaut vers `https://see2world.bonto.run`.
- Si vous utilisez un autre hébergeur pour le backend, définissez `VITE_SERVER_URL` dans les secrets GitHub ou dans l'environnement de Netlify.

## 🛠️ Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Desktop | Electron |
| Temps réel | WebRTC + Socket.io |
| Serveur | Node.js + Express |
| Build | electron-builder (NSIS) |
