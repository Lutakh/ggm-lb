# Étape 1: Utiliser une image Node.js légère et officielle
FROM node:18-alpine

# Étape 2: Définir le répertoire de travail à l'intérieur du conteneur
WORKDIR /usr/src/app

RUN apk add --no-cache nano
# Étape 3: Copier les fichiers de dépendances et les installer
# On copie ces fichiers en premier pour profiter du cache Docker.
COPY package*.json ./
RUN npm install

# Étape 4: Copier tout le reste du code de l'application
COPY . .

# Étape 5: Exposer le port sur lequel l'application écoute
EXPOSE 3000

# Étape 6: La commande pour démarrer l'application
CMD [ "node", "server.js" ]
