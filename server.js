// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { initDiscordBot, isBotReady } = require('./services/discordBot');
const { startScheduler } = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const mainRoutes = require('./routes/index');
const playerRoutes = require('./routes/players');
const guildRoutes = require('./routes/guilds');
const ptRoutes = require('./routes/perilousTrials');
const adminRoutes = require('./routes/admin');
const dailyQuestsRoutes = require('./routes/dailyQuests');
const teamPlannerRoutes = require('./routes/teamPlanner');

app.use('/', mainRoutes);
app.use('/', playerRoutes);
app.use('/', guildRoutes);
app.use('/', ptRoutes);
app.use('/', adminRoutes);
app.use('/', dailyQuestsRoutes);
app.use('/', teamPlannerRoutes);

console.log("Attempting to initialize Discord Bot...");
const discordClient = initDiscordBot();

function startServerAndScheduler() {
    app.listen(PORT, () => {
        console.log(`🚀 Server started on http://localhost:${PORT}`);
        startScheduler();
    });
}

if (discordClient) {
    console.log("Discord client initialized, waiting for 'ClientReady' event or timeout...");
    let serverStarted = false;

    // CORRECTION ICI : 'ClientReady' au lieu de 'ready'
    discordClient.once('ClientReady', () => {
        if (!serverStarted) {
            console.log("Discord Bot ready, starting server and scheduler...");
            serverStarted = true;
            startServerAndScheduler();
        }
    });

    setTimeout(() => {
        if (!isBotReady() && !serverStarted) {
            console.warn("⚠️ Bot not ready after timeout, starting server anyway.");
            serverStarted = true;
            startServerAndScheduler();
        }
    }, 20000);

} else {
    console.warn("⚠️ Discord Bot could not be initialized.");
    startServerAndScheduler();
}