// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { initDiscordBot, isBotReady } = require('./services/discordBot'); // Importer l'init du bot et isBotReady
const { startScheduler } = require('./services/scheduler'); // Importer le démarrage du scheduler

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const mainRoutes = require('./routes/index');
const playerRoutes = require('./routes/players');
const guildRoutes = require('./routes/guilds');
const ptRoutes = require('./routes/perilousTrials');
const adminRoutes = require('./routes/admin');
const dailyQuestsRoutes = require('./routes/dailyQuests');

// Montage des routes
app.use('/', mainRoutes);
app.use('/', playerRoutes);
app.use('/', guildRoutes);
app.use('/', ptRoutes);
app.use('/', adminRoutes);
app.use('/', dailyQuestsRoutes);


// Initialiser le Bot Discord
console.log("Attempting to initialize Discord Bot...");
const discordClient = initDiscordBot();

// Démarrer le serveur et la tâche planifiée
function startServerAndScheduler() {
    app.listen(PORT, () => {
        console.log(`🚀 Server started on http://localhost:${PORT}`);
        // Démarrer le scheduler après le démarrage du serveur (le scheduler attendra que le bot soit prêt)
        startScheduler();
    });
}

// Logique de démarrage améliorée
if (discordClient) {
    console.log("Discord client initialized, waiting for 'ready' event or timeout...");
    let serverStarted = false; // Flag pour éviter double démarrage

    // Attendre que le bot soit prêt
    discordClient.once('ready', () => {
        if (!serverStarted) {
            console.log("Discord Bot ready, starting server and scheduler...");
            serverStarted = true;
            startServerAndScheduler();
        }
    });

    // Timeout de sécurité si l'événement 'ready' tarde trop
    const startTimeout = setTimeout(() => {
        if (!isBotReady() && !serverStarted) { // Vérifier si le bot n'est toujours pas prêt ET que le serveur n'a pas démarré
            console.warn("⚠️ Bot not ready after timeout, starting server anyway but Discord features might fail.");
            serverStarted = true;
            startServerAndScheduler();
        } else if (isBotReady() && !serverStarted) {
            // Cas rare où le bot est prêt mais l'événement n'a pas déclenché le start
            console.log("Bot is ready but 'ready' event might have been missed, starting server...");
            serverStarted = true;
            startServerAndScheduler();
        }
    }, 20000); // Attendre 20 secondes max

    // Si le bot se déconnecte plus tard
    discordClient.on('disconnect', () => {
        console.warn("🔌 Discord Bot Disconnected.");
        // Optionnel : Tenter de relancer ? Ou juste arrêter le scheduler ?
        // stopScheduler();
    });

} else {
    // Si le bot n'a pas pu être initialisé (pas de token), démarrer sans lui
    console.warn("⚠️ Discord Bot could not be initialized (likely no token). Starting server without Discord features.");
    startServerAndScheduler();
}