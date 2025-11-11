// routes/index.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { calculateClassChangeTimers, calculateLevelCapTimers } = require('../utils/timers');

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

        const [playersResult, guildsResult, trialsResult, settingsResult, ccTimersResult] = await Promise.all([
            db.query(playersSql),
            db.query('SELECT name FROM guilds ORDER BY name;'),
            // REQUÊTE MODIFIÉE POUR INCLURE LE NOMBRE D'ÉQUIPES
            db.query(`
                SELECT pt.id, pt.name, COUNT(lb.rank) as team_count
                FROM perilous_trials pt
                         LEFT JOIN pt_leaderboard lb ON pt.id = lb.pt_id
                GROUP BY pt.id, pt.name
                ORDER BY pt.id;
            `),
            db.query('SELECT key, value FROM server_settings;'),
            db.query('SELECT id, label, weeks_after_start, is_active FROM class_change_timers ORDER BY id;')
        ]);

        const serverSettings = settingsResult.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
        if (!serverSettings.server_open_date) serverSettings.server_open_date = new Date().toISOString().split('T')[0];

        // *** MODIFICATION AJOUTÉE ***
        serverSettings.ga_measurement_id = process.env.GA_MEASUREMENT_ID || '';

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
                if (acc[teamName].class_distribution[player.class] !== undefined) { acc[teamName].class_distribution[player.class]++; }
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
                if (acc[guildName].class_distribution[player.class] !== undefined) { acc[guildName].class_distribution[player.class]++; }
            }
            return acc;
        }, {});
        const rankedGuilds = Object.entries(guildsData).map(([name, data]) => ({ name, total_cp: data.total_cp, member_count: data.members.length, class_distribution: data.class_distribution })).sort((a, b) => b.total_cp - a.total_cp);

        const playerListForSelectors = players.map(p => ({ id: p.id, name: p.name }));

        const now = new Date();
        const currentUTCDay = now.getUTCDay();
        const getNextReset = (targetDay) => {
            const reset = new Date(now.getTime());
            reset.setUTCHours(10, 0, 0, 0);
            if (targetDay !== undefined) {
                const daysUntilTarget = (targetDay - currentUTCDay + 7) % 7;
                reset.setUTCDate(reset.getUTCDate() + daysUntilTarget);
            }
            if (reset < now) { reset.setUTCDate(reset.getUTCDate() + (targetDay === undefined ? 1 : 7)); }
            return reset;
        };

        const allClassChangeTimers = calculateClassChangeTimers(serverSettings.server_open_date, ccTimersResult.rows);
        const activeClassChangeTimer = allClassChangeTimers.find(t => t.milliseconds > 0);
        const levelCapTimers = calculateLevelCapTimers(serverSettings.server_open_date);

        const importantPaperPlanes = [2, 5, 9, 12, 14, 18, 21, 23, 24, 25, 28, 33];
        const serverStartDate = new Date(serverSettings.server_open_date + 'T00:00:00Z');
        const timeSinceStart = now.getTime() - serverStartDate.getTime();
        const serverAgeInDays = Math.floor(timeSinceStart / (1000 * 60 * 60 * 24));
        const serverStartDay = serverStartDate.getUTCDay();
        const daysUntilFirstWed = (3 - serverStartDay + 7) % 7;
        const firstEventReset = new Date(serverStartDate.getTime());
        firstEventReset.setUTCDate(firstEventReset.getUTCDate() + daysUntilFirstWed);
        firstEventReset.setUTCHours(9, 0, 0, 0);
        if (firstEventReset < serverStartDate) { firstEventReset.setUTCDate(firstEventReset.getUTCDate() + 7); }
        const timeSinceFirstReset = now.getTime() - firstEventReset.getTime();
        let paperPlaneNumber = (timeSinceFirstReset < 0) ? 0 : Math.floor(timeSinceFirstReset / (1000 * 60 * 60 * 24 * 7));
        const nextPaperPlaneReset = getNextReset(3);
        const paperPlaneEndTime = new Date(nextPaperPlaneReset.getTime() - (60 * 60 * 1000));
        const tooltipPaperPlanes = [];
        let tooltipStartDate = new Date(nextPaperPlaneReset.getTime());
        for (let i = 0; i < 4; i++) {
            let nextDate = new Date(tooltipStartDate.getTime());
            nextDate.setUTCDate(nextDate.getUTCDate() + (7 * i));
            const nextPlaneNumber = paperPlaneNumber + i + 1;
            tooltipPaperPlanes.push({ number: nextPlaneNumber, milliseconds: nextDate - now, isImportant: importantPaperPlanes.includes(nextPlaneNumber) });
        }

        res.render('index', {
            players, playerListForSelectors, rankedTeams, rankedGuilds, allTeamNames, guilds, perilousTrials, serverSettings,
            classChangeTimers: ccTimersResult.rows,
            notification: req.query.notification || null,
            currentCC: levelCapTimers.currentLevelCap ? levelCapTimers.currentLevelCap.cc : 0,
            timers: {
                daily: getNextReset() - now,
                weekly: getNextReset(1) - now,
                event: paperPlaneEndTime - now,
                classChange: activeClassChangeTimer,
                allClassChanges: allClassChangeTimers,
                serverDay: serverAgeInDays,
                paperPlaneNumber: paperPlaneNumber,
                isPaperPlaneImportant: importantPaperPlanes.includes(paperPlaneNumber),
                futurePaperPlanes: tooltipPaperPlanes,
                levelCapTimers: levelCapTimers
            },
        });
    } catch (err) {
        console.error("Erreur critique:", err);
        res.status(500).send("A critical error occurred.");
    }
});

module.exports = router;