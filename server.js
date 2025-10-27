// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');

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
const dailyQuestsRoutes = require('./routes/dailyQuests'); // <-- Make sure this line exists and points to the correct file

// Montage des routes (Note: on utilise '/' pour garder les chemins des formulaires simples)
app.use('/', mainRoutes);
app.use('/', playerRoutes);
app.use('/', guildRoutes);
app.use('/', ptRoutes);
app.use('/', adminRoutes);
app.use('/', dailyQuestsRoutes); // <-- Ensure this line uses the imported variable


app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});