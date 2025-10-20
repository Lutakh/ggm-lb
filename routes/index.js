const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { calculateClassChangeTimers } = require('../utils/timers');

router.get('/', async (req, res) => {
    try {
        const playersSql = `
            SELECT p.*,
                   (SELECT json_agg(json_build_object('start_minutes', ps.start_minutes, 'end_minutes', ps.end_minutes))
                    FROM play_slots ps WHERE ps.player_id = p.id) as play_slots,
                   (SELECT json_agg(pt.name)
                    FROM player_pt_tags ppt
                             JOIN perilous_trials pt ON pt.id = ppt.pt_id
                    WHERE ppt.player_id = p.id) as pt_tags
            FROM players p
            ORDER BY p.combat_power DESC, p.name;`;

        const [
            playersResult,
            guildsResult,
            trialsResult,
            settingsResult,
            ccTimersResult
        ] = await Promise.all([
            db.query(playersSql),
            db.query('SELECT name FROM guilds ORDER BY name;'),
            db.query('SELECT id, name FROM perilous_trials ORDER BY id;'),
            db.query('SELECT key, value FROM server_settings;'),
            db.query('SELECT id, label, weeks_after_start, is_active FROM class_change_timers ORDER BY id;')
        ]);
        const serverSettings = settingsResult.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});

        // Add a fallback for server_open_date
        if (!serverSettings.server_open_date) {
            serverSettings.server_open_date = new Date().toISOString();
        }
        const players = playersResult.rows.map(p => ({ ...p, play_slots: p.play_slots || [], pt_tags: p.pt_tags || [] }));
        const guilds = guildsResult.rows.map(g => g.name);
        const perilousTrials = trialsResult.rows;
        const allTeamNames = [...new Set(players.map(p => p.team).filter(Boolean).filter(t => t !== 'No Team'))];

        const teamsData = players.reduce((acc, player) => {
            const teamName = player.team;
            if (teamName && teamName !== 'No Team') {
                if (!acc[teamName]) acc[teamName] = { members: [], total_cp: 0, guilds: new Set(), class_distribution: { Swordbearer: 0, Acolyte: 0, Wayfarer: 0, Scholar: 0, Shadowlash: 0 } };
                acc[teamName].members.push(player);
                acc[teamName].total_cp += Number(player.combat_power);
                if(player.guild) acc[teamName].guilds.add(player.guild);
                if (acc[teamName].class_distribution[player.class] !== undefined) {
                    acc[teamName].class_distribution[player.class]++;
                }
            }
            return acc;
        }, {});
        const rankedTeams = Object.entries(teamsData).map(([name, data]) => ({ name, total_cp: data.total_cp, members: data.members.sort((a, b) => b.combat_power - a.combat_power), member_count: data.members.length, class_distribution: data.class_distribution, guild: data.guilds.size === 1 ? [...data.guilds][0] : 'Mixed' })).sort((a, b) => b.total_cp - a.total_cp);

        const guildsData = players.reduce((acc, player) => {
            const guildName = player.guild;
            if (guildName) {
                if (!acc[guildName]) acc[guildName] = { members: [], total_cp: 0, class_distribution: { Swordbearer: 0, Acolyte: 0, Wayfarer: 0, Scholar: 0, Shadowlash: 0 } };
                acc[guildName].members.push(player);
                acc[guildName].total_cp += Number(player.combat_power);
                if (acc[guildName].class_distribution[player.class] !== undefined) {
                    acc[guildName].class_distribution[player.class]++;
                }
            }
            return acc;
        }, {});
        const rankedGuilds = Object.entries(guildsData).map(([name, data]) => ({ name, total_cp: data.total_cp, member_count: data.members.length, class_distribution: data.class_distribution })).sort((a, b) => b.total_cp - a.total_cp);

        // --- LOGIQUE DES TIMERS ---
        const serverOffsetHours = -4; // Décalage UTC-4 pour l'heure serveur
        const now = new Date();
        // Calculer l'heure serveur actuelle
        const serverTime = new Date(now.valueOf() + (serverOffsetHours * 60 * 60 * 1000));
        const serverDay = serverTime.getUTCDay(); // Dimanche = 0, Lundi = 1, ..., Samedi = 6

        // Fonction pour calculer la prochaine date de reset (Daily, Weekly, Event)
        // Utilise l'heure du serveur pour la logique de comparaison, mais fixe l'heure UTC du reset
        const getNextReset = (targetDay) => {
            const reset = new Date(serverTime);
            // CORRECTION: Mettre l'heure du reset serveur (5h du matin) en UTC => 9h UTC
            reset.setUTCHours(9, 0, 0, 0);

            if (targetDay !== undefined) { // Pour Weekly et Event
                const daysUntilTarget = (targetDay - serverDay + 7) % 7;
                reset.setUTCDate(reset.getUTCDate() + daysUntilTarget);
            }
            // Si le reset calculé (ex: aujourd'hui 9h UTC) est DÉJÀ PASSÉ par rapport à l'heure serveur ACTUELLE
            if (reset < serverTime) {
                // Avance au prochain jour (pour daily) ou à la semaine suivante (pour weekly/event)
                reset.setUTCDate(reset.getUTCDate() + (targetDay === undefined ? 1 : 7));
            }
            return reset;
        };

        // Calcul des timers Class Change (utilise sa propre logique UTC dans utils/timers.js)
        const allClassChangeTimers = calculateClassChangeTimers(serverSettings.server_open_date, ccTimersResult.rows);
        const activeClassChangeTimer = allClassChangeTimers.find(t => t.milliseconds > 0);

        // Calcul des informations serveur et Paper Plane
        const serverStartDate = new Date(serverSettings.server_open_date);
        const serverAgeInDays = Math.floor((now - serverStartDate) / (1000 * 60 * 60 * 24));

        // CORRECTION: Le numéro du Paper Plane est basé sur le nombre de semaines COMPLÈTES écoulées + 1
        const paperPlaneNumber = Math.floor(serverAgeInDays / 7) + 1;
        const nextPaperPlaneReset = getNextReset(3); // Mercredi = 3

        // Calcul des prochains resets pour le tooltip Paper Plane
        const futurePaperPlaneResets = [];
        let currentResetDate = new Date(nextPaperPlaneReset.getTime());
        // Calcule les 4 prochains resets HEBDOMADAIRES après celui affiché
        for (let i = 1; i <= 4; i++) {
            // Crée une nouvelle date basée sur le reset précédent pour éviter la mutation
            let nextDate = new Date(currentResetDate.getTime());
            nextDate.setUTCDate(nextDate.getUTCDate() + (7 * i)); // Ajoute i*7 jours
            futurePaperPlaneResets.push({
                number: paperPlaneNumber + i,
                // Le temps restant est calculé par rapport à l'heure ACTUELLE (now)
                milliseconds: nextDate - now
            });
        }

        res.render('index', {
            players, rankedTeams, rankedGuilds, allTeamNames, guilds, perilousTrials, serverSettings,
            classChangeTimers: ccTimersResult.rows,
            notification: req.query.notification || null,
            timers: {
                daily: getNextReset() - serverTime, // Temps restant jusqu'au prochain reset journalier
                weekly: getNextReset(1) - serverTime, // Temps restant jusqu'au prochain Lundi (1)
                event: nextPaperPlaneReset - serverTime, // Temps restant jusqu'au prochain Mercredi (3)
                classChange: activeClassChangeTimer,
                allClassChanges: allClassChangeTimers,
                serverDay: serverAgeInDays,
                paperPlaneNumber: paperPlaneNumber,
                futurePaperPlanes: futurePaperPlaneResets
            },
        });
    } catch (err) {
        console.error("Erreur critique:", err);
        res.status(500).send("A critical error occurred.");
    }
});

module.exports = router;