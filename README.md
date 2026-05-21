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

## Serveur
 - **Serveur** → [bonto.dev](https://bonto.dev) ou autre hébergeur Node.js (dossier `server`, start: `npm start`).

## Déploiement

Voici la configuration recommandée pour la production :

- Domaine serveur (Bonto): `https://see2world.bonto.run` — pointé vers la machine qui héberge le dossier `server`.
- Frontend (Netlify) : déploiement manuel (tu préfères gérer le build et la mise en ligne toi-même).

### Déploiement du serveur (automatique depuis la branche `server`)

Un workflow GitHub Actions est fourni : `.github/workflows/server-deploy.yml`.
Il s'exécute sur les pushs vers la branche `server` et synchronise le dossier `server/` vers la machine distante via `rsync`+`ssh`, puis installe les dépendances et redémarre l'app avec `pm2`.

Par défaut, le workflow utilisera `BONTO_HOST=see2world.bonto.run` si tu n'as pas configuré de secret différent.

Secrets GitHub requis pour le workflow serveur :

- `BONTO_SSH_PRIVATE_KEY` : clé privée SSH pour se connecter à l'hôte Bonto
- `BONTO_HOST` : (optionnel) nom d'hôte SSH ; si absent, la valeur `see2world.bonto.run` est utilisée
- `BONTO_USER` : utilisateur SSH sur la machine distante
- `BONTO_DEPLOY_PATH` : chemin distant où déposer l'application (ex: `/var/www/see2world`)

### Déploiement du frontend (manuel sur Netlify)

Puisque tu souhaites déployer manuellement le frontend, voici la procédure recommandée :

1. Construire le site :

```bash
cd client
npm ci
npm run build
```

2. Déployer avec le CLI Netlify (ou via l'interface Netlify)

```bash
# installer le CLI si nécessaire
npm i -g netlify-cli

# déployer en production (nécessite NETLIFY_AUTH_TOKEN et NETLIFY_SITE_ID)
netlify deploy --prod --dir=dist --site=$NETLIFY_SITE_ID
```

Variables utiles pour le client en production :

- `VITE_SERVER_URL` : URL publique du serveur de signalisation (ex: `https://see2world.bonto.run`). Définis-la dans l'UI Netlify ou dans tes variables d'environnement avant le build.

### Remarques

- Si tu préfères automatiser le déploiement du frontend depuis une branche dédiée (`client`), on peut réactiver ou ajouter un workflow GitHub Actions.
- Si tu veux que j'adapte le workflow serveur pour une autre méthode (Docker, API d'hébergement), dis-moi quelle méthode tu préfères.

## Technologies
- WebRTC (P2P audio/video/screen sharing)
- Socket.io (signalisation temps réel)
- React + Vite + Tailwind CSS
- Electron (app Desktop)

- Domaine serveur (Bonto): `https://see2world.bonto.run` — pointé vers la machine qui héberge le dossier `server`.
- Frontend (Netlify) : déploiement manuel (tu préfères gérer le build et la mise en ligne toi-même).

### Déploiement du serveur (automatique depuis la branche `server`)

Un workflow GitHub Actions est fourni : `.github/workflows/server-deploy.yml`.
Il s'exécute sur les pushs vers la branche `server` et synchronise le dossier `server/` vers la machine distante via `rsync`+`ssh`, puis installe les dépendances et redémarre l'app avec `pm2`.

Par défaut, le workflow utilisera `BONTO_HOST=see2world.bonto.run` si tu n'as pas configuré de secret différent.

Secrets GitHub requis pour le workflow serveur :

- `BONTO_SSH_PRIVATE_KEY` : clé privée SSH pour se connecter à l'hôte Bonto
- `BONTO_HOST` : (optionnel) nom d'hôte SSH ; si absent, la valeur `see2world.bonto.run` est utilisée
- `BONTO_USER` : utilisateur SSH sur la machine distante
- `BONTO_DEPLOY_PATH` : chemin distant où déposer l'application (ex: `/var/www/see2world`)

### Déploiement du frontend (manuel sur Netlify)

Puisque tu souhaites déployer manuellement le frontend, voici la procédure recommandée :

1. Construire le site :

```bash
cd client
npm ci
npm run build
```

2. Déployer avec le CLI Netlify (ou via l'interface Netlify)

```bash
# installer le CLI si nécessaire
npm i -g netlify-cli

# déployer en production (nécessite NETLIFY_AUTH_TOKEN et NETLIFY_SITE_ID)
netlify deploy --prod --dir=dist --site=$NETLIFY_SITE_ID
```

Variables utiles pour le client en production :

- `VITE_SERVER_URL` : URL publique du serveur de signalisation (ex: `https://see2world.bonto.run`). Définis-la dans l'UI Netlify ou dans tes variables d'environnement avant le build.

### Remarques

- Si tu préfères automatiser le déploiement du frontend depuis une branche dédiée (`client`), on peut réactiver ou ajouter un workflow GitHub Actions.
- Si tu veux que j'adapte le workflow serveur pour une autre méthode (Docker, API d'hébergement), dis-moi quelle méthode tu préfères.

## Technologies
- WebRTC (P2P audio/video/screen sharing)
- Socket.io (signalisation temps réel)
- React + Vite + Tailwind CSS
- Electron (app Desktop)

