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
        const serverOffsetHours = -4;
        const now = new Date();
        const serverTime = new Date(now.valueOf() + (serverOffsetHours * 60 * 60 * 1000));
        const serverDay = serverTime.getUTCDay(); // Dimanche = 0, Lundi = 1, ..., Samedi = 6

        const getNextReset = (targetDay) => {
            const reset = new Date(serverTime);
            // On met l'heure du reset (5h du matin serveur, donc 9h UTC)
            reset.setUTCHours(9, 0, 0, 0);
            if (targetDay !== undefined) {
                // Calcule le nombre de jours jusqu'au prochain targetDay (ex: Lundi=1)
                const daysUntilTarget = (targetDay - serverDay + 7) % 7;
                reset.setUTCDate(reset.getUTCDate() + daysUntilTarget);
            }
            // Si le reset calculé est déjà passé pour aujourd'hui (ou cette semaine pour les resets hebdo)
            if (reset < serverTime) {
                // Ajoute 1 jour (pour daily) ou 7 jours (pour weekly)
                reset.setUTCDate(reset.getUTCDate() + (targetDay === undefined ? 1 : 7));
            }
            return reset;
        };

        const allClassChangeTimers = calculateClassChangeTimers(serverSettings.server_open_date, ccTimersResult.rows);
        const activeClassChangeTimer = allClassChangeTimers.find(t => t.milliseconds > 0);


        const serverStartDate = new Date(serverSettings.server_open_date);
        const serverAgeInDays = Math.floor((now - serverStartDate) / (1000 * 60 * 60 * 24));

        // Calcul du numéro du Paper Plane actuel
        const paperPlaneNumber = Math.floor(serverAgeInDays / 7) + 1;
        const nextPaperPlaneReset = getNextReset(3); // Mercredi = 3

        // Calcul des prochains resets pour le tooltip Paper Plane
        const futurePaperPlaneResets = [];
        let currentResetDate = new Date(nextPaperPlaneReset.getTime());
        for (let i = 1; i <= 4; i++) { // Calcule les 4 prochains
            currentResetDate.setUTCDate(currentResetDate.getUTCDate() + 7);
            futurePaperPlaneResets.push({
                number: paperPlaneNumber + i,
                milliseconds: currentResetDate - now
            });
        }


        res.render('index', {
            players, rankedTeams, rankedGuilds, allTeamNames, guilds, perilousTrials, serverSettings,
            classChangeTimers: ccTimersResult.rows,
            notification: req.query.notification || null,
            timers: {
                daily: getNextReset() - serverTime,
                weekly: getNextReset(1) - serverTime, // Lundi = 1
                event: nextPaperPlaneReset - serverTime,
                classChange: activeClassChangeTimer,
                allClassChanges: allClassChangeTimers,
                serverDay: serverAgeInDays,
                paperPlaneNumber: paperPlaneNumber,
                futurePaperPlanes: futurePaperPlaneResets // Ajout des timers futurs
            },
        });
    } catch (err) {
        console.error("Erreur critique:", err);
        res.status(500).send("A critical error occurred.");
    }
});

module.exports = router;