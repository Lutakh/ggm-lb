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
        const serverDay = serverTime.getUTCDay();

        const getNextReset = (targetDay) => {
            const reset = new Date(serverTime);
            reset.setUTCHours(5, 0, 0, 0);
            if (targetDay !== undefined) {
                const daysUntilTarget = (targetDay - serverDay + 7) % 7;
                reset.setUTCDate(reset.getUTCDate() + daysUntilTarget);
            }
            if (reset < serverTime) {
                reset.setUTCDate(reset.getUTCDate() + (targetDay === undefined ? 1 : 7));
            }
            return reset;
        };

        const classChangeTimer = calculateClassChangeTimers(serverSettings.server_open_date, ccTimersResult.rows);

        const serverStartDate = new Date(serverSettings.server_open_date);
        const serverAgeInDays = Math.floor((now - serverStartDate) / (1000 * 60 * 60 * 24));


        res.render('index', {
            players, rankedTeams, rankedGuilds, allTeamNames, guilds, perilousTrials, serverSettings,
            classChangeTimers: ccTimersResult.rows,
            notification: req.query.notification || null,
            timers: {
                daily: getNextReset() - serverTime,
                weekly: getNextReset(1) - serverTime,
                event: getNextReset(3) - serverTime,
                classChange: classChangeTimer,
                serverDay: serverAgeInDays
            },
        });
    } catch (err) {
        console.error("Erreur critique:", err);
        res.status(500).send("A critical error occurred.");
    }
});

module.exports = router;