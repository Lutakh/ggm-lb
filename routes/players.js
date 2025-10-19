const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { parseCombatPower, timeToMinutes } = require('../utils/helpers');

router.get('/player-details/:name', async (req, res) => {
    const sql = `SELECT p.*,
                        json_agg(json_build_object('start_minutes', ps.start_minutes, 'end_minutes', ps.end_minutes)) FILTER (WHERE ps.id IS NOT NULL) as play_slots
                 FROM players p
                          LEFT JOIN play_slots ps ON p.id = ps.player_id
                 WHERE p.name ILIKE $1 GROUP BY p.id`;
    try {
        const result = await db.query(sql, [req.params.name]);
        if (result.rows.length === 0) return res.json(null);
        const player = {...result.rows[0], play_slots: result.rows[0].play_slots || []};
        res.json(player);
    } catch (err) {
        console.error("Error fetching player details:", err);
        res.status(500).json(null);
    }
});

router.post('/add-player', async (req, res) => {
    let { name, pClass, cp, team, guild, notes, play_start = [], play_end = [] } = req.body;
    name = name.trim();

    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const existingPlayerRes = await client.query(`SELECT * FROM players WHERE name ILIKE $1`, [name]);
        const existingPlayer = existingPlayerRes.rows[0];

        const combatPowerNumeric = parseCombatPower(cp);
        const startTimes = Array.isArray(play_start) ? play_start : [play_start];
        const endTimes = Array.isArray(play_end) ? play_end : [play_end];
        const newSlots = startTimes.map((st, i) => ({ start: timeToMinutes(st), end: timeToMinutes(endTimes[i]) })).filter(s => s.start !== null && s.end !== null);

        let playerId;
        if (existingPlayer) {
            playerId = existingPlayer.id;
            const finalClass = pClass || existingPlayer.class;
            const finalCp = cp ? combatPowerNumeric : existingPlayer.combat_power;
            const finalTeam = team === undefined ? existingPlayer.team : (team || 'No Team');
            const finalGuild = guild === undefined ? existingPlayer.guild : guild;
            const finalNotes = notes !== undefined ? notes : existingPlayer.notes;

            await client.query(`UPDATE players SET name = $1, class = $2, combat_power = $3, team = $4, guild = $5, notes = $6, updated_at = NOW() WHERE id = $7`,
                [name, finalClass, finalCp, finalTeam, finalGuild, finalNotes, playerId]);

            await client.query(`DELETE FROM play_slots WHERE player_id = $1`, [playerId]);
            for (const slot of newSlots) {
                await client.query(`INSERT INTO play_slots (player_id, start_minutes, end_minutes) VALUES ($1, $2, $3)`, [playerId, slot.start, slot.end]);
            }
        } else {
            if (!name || !pClass || !cp) { return res.redirect(`/?notification=${encodeURIComponent(`Name, Class and CP are required for new players.`)}`); }
            const insertRes = await client.query(`INSERT INTO players (name, class, combat_power, team, guild, notes, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
                [name, pClass, combatPowerNumeric, team || 'No Team', guild || null, notes]);
            playerId = insertRes.rows[0].id;
            for (const slot of newSlots) {
                await client.query(`INSERT INTO play_slots (player_id, start_minutes, end_minutes) VALUES ($1, $2, $3)`, [playerId, slot.start, slot.end]);
            }
        }
        await client.query('COMMIT');
        res.redirect(`/?notification=${encodeURIComponent(`Player '${name}' submitted!`)}`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Transaction Error in /add-player:', err);
        res.status(500).redirect(`/?notification=${encodeURIComponent('An error occurred. Please try again.')}`);
    } finally {
        client.release();
    }
});


router.post('/delete-player/:id', async (req, res) => {
    if (req.body.admin_password !== process.env.ADMIN_PASSWORD) { return res.redirect('/?notification=' + encodeURIComponent('Incorrect admin password.')); }
    try {
        await db.query('DELETE FROM players WHERE id = $1', [req.params.id]);
        res.redirect('/?notification=' + encodeURIComponent('Player deleted.'));
    } catch (err) { console.error("Error deleting player:", err); res.redirect('/?notification=Error deleting player.'); }
});

router.post('/update-team/:id', async (req, res) => {
    if (req.body.admin_password !== process.env.ADMIN_PASSWORD) { return res.redirect('/?notification=' + encodeURIComponent('Incorrect admin password.')); }
    try {
        await db.query('UPDATE players SET team = $1, updated_at = NOW() WHERE id = $2', [req.body.team, req.params.id]);
        res.redirect('/?notification=' + encodeURIComponent('Team updated.'));
    } catch (err) { console.error("Error updating team:", err); res.redirect('/?notification=Error updating team.'); }
});

router.post('/rename-team', async (req, res) => {
    if (req.body.admin_password !== process.env.ADMIN_PASSWORD) { return res.redirect('/?notification=' + encodeURIComponent('Incorrect admin password.')); }
    try {
        await db.query('UPDATE players SET team = $1, updated_at = NOW() WHERE team = $2', [req.body.new_team_name, req.body.old_team_name]);
        res.redirect(`/?notification=` + encodeURIComponent(`Team '${req.body.old_team_name}' renamed to '${req.body.new_team_name}'.`));
    } catch (err) { console.error("Error renaming team:", err); res.redirect('/?notification=Error renaming team.'); }
});

module.exports = router;