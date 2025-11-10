// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { initDiscordBot, isBotReady } = require('./services/discordBot');
const { startScheduler } = require('./services/scheduler');

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
const teamPlannerRoutes = require('./routes/teamPlanner');

// Montage des routes
app.use('/', mainRoutes);
app.use('/', playerRoutes);
app.use('/', guildRoutes);
app.use('/', ptRoutes);
app.use('/', adminRoutes);
app.use('/', dailyQuestsRoutes);
app.use('/', teamPlannerRoutes);

// Initialiser le Bot Discord
console.log("Attempting to initialize Discord Bot...");
const discordClient = initDiscordBot();

// Fonction de démarrage du serveur et du scheduler
function startServerAndScheduler() {
    app.listen(PORT, () => {
        console.log(`🚀 Server started on http://localhost:${PORT}`);
        // Démarrer le scheduler après le démarrage du serveur
        startScheduler();
    });
}

// Logique de démarrage
if (discordClient) {
    console.log("Discord client initialized, checking status...");
    let serverStarted = false;

    // Fonction helper pour lancer une seule fois
    const launch = (source) => {
        if (!serverStarted) {
            console.log(`Starting server (Source: ${source})...`);
            serverStarted = true;
            startServerAndScheduler();
        }
    };

    // 1. Si le bot est DÉJÀ prêt (race condition évitée)
    if (isBotReady()) {
        launch('Immediate Check');
    } else {
        // 2. Sinon on attend l'événement 'clientReady' (minuscule 'c' !)
        console.log("Waiting for 'clientReady' event...");
        discordClient.once('clientReady', () => launch('Event'));

        // 3. Timeout de sécurité au cas où Discord ne répond pas
        setTimeout(() => {
            if (!serverStarted) {
                console.warn("⚠️ Timeout reached waiting for Discord Bot. Starting server anyway.");
                launch('Timeout');
            }
        }, 15000); // 15 secondes de timeout
    }

} else {
    // Si pas de bot (pas de token), on démarre direct
    console.warn("⚠️ Discord Bot not initialized (no token?). Starting server without it.");
    startServerAndScheduler();
}