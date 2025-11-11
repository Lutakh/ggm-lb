// routes/players.js
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
        console.error(`Error fetching player details for "${req.params.name}":`, err);
        res.status(500).json(null);
    }
});

// NOUVEAU : Endpoint pour l'historique des meilleurs rangs PT d'un joueur
router.get('/api/player-pt-history/:playerId', async (req, res) => {
    const playerId = parseInt(req.params.playerId, 10);
    if (isNaN(playerId)) return res.status(400).json({ error: "Invalid player ID" });

    try {
        // Cette requête trouve d'abord le meilleur rang pour chaque PT où le joueur est présent,
        // puis joint pour obtenir les détails complets de l'équipe pour ce rang précis.
        const sql = `
            WITH BestRanks AS (
                SELECT pt_id, MIN(rank) as rank
                FROM pt_leaderboard
                WHERE player1_id = $1 OR player2_id = $1 OR player3_id = $1 OR player4_id = $1
                GROUP BY pt_id
            )
            SELECT lb.pt_id, pt.name as pt_name, lb.rank,
                   lb.player1_name, p1.class as player1_class,
                   lb.player2_name, p2.class as player2_class,
                   lb.player3_name, p3.class as player3_class,
                   lb.player4_name, p4.class as player4_class
            FROM pt_leaderboard lb
                     JOIN BestRanks br ON lb.pt_id = br.pt_id AND lb.rank = br.rank
                     JOIN perilous_trials pt ON lb.pt_id = pt.id
                     LEFT JOIN players p1 ON lb.player1_id = p1.id
                     LEFT JOIN players p2 ON lb.player2_id = p2.id
                     LEFT JOIN players p3 ON lb.player3_id = p3.id
                     LEFT JOIN players p4 ON lb.player4_id = p4.id
            WHERE (lb.player1_id = $1 OR lb.player2_id = $1 OR lb.player3_id = $1 OR lb.player4_id = $1)
            ORDER BY lb.pt_id DESC;
        `;

        const result = await db.query(sql, [playerId]);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching player PT history:", err);
        res.status(500).json({ error: "Failed to fetch PT history" });
    }
});

router.post('/add-player', async (req, res) => {
    let { name, pClass, cp, team, guild, notes, play_start = [], play_end = [], discord_user_id } = req.body;
    name = name ? name.trim() : '';
    const discordId = (discord_user_id && String(discord_user_id).trim()) ? String(discord_user_id).trim() : null;

    if (!name) return res.redirect(`/?notification=${encodeURIComponent('Player name cannot be empty.')}`);

    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const existingPlayerRes = await client.query(`SELECT * FROM players WHERE name ILIKE $1`, [name]);
        const existingPlayer = existingPlayerRes.rows[0];

        const combatPowerNumeric = parseCombatPower(cp);
        const startTimes = Array.isArray(play_start) ? play_start : [play_start].filter(t => t);
        const endTimes = Array.isArray(play_end) ? play_end : [play_end].filter(t => t);
        const newSlots = startTimes
            .map((st, i) => ({ start: timeToMinutes(st), end: timeToMinutes(endTimes[i]) }))
            .filter(s => s.start !== null && s.end !== null);

        let playerId;
        if (existingPlayer) {
            playerId = existingPlayer.id;
            const finalClass = pClass || existingPlayer.class;
            const finalCp = cp ? combatPowerNumeric : existingPlayer.combat_power;
            const finalTeam = team === undefined ? existingPlayer.team : (team || 'No Team');
            const finalGuild = guild === undefined ? existingPlayer.guild : (guild || null);
            const finalNotes = notes !== undefined ? notes : existingPlayer.notes;
            const finalDiscordId = discord_user_id !== undefined ? discordId : existingPlayer.discord_user_id;

            await client.query(
                `UPDATE players SET
                                        name = $1,
                                        class = $2,
                                        cp_last_updated = CASE WHEN combat_power != $3 THEN NOW() ELSE cp_last_updated END,
                                        combat_power = $3,
                                        team = $4,
                                        guild = $5,
                                        notes = $6,
                                        discord_user_id = $7,
                                        updated_at = NOW()
                                     WHERE id = $8`,
                [name, finalClass, finalCp, finalTeam, finalGuild, finalNotes, finalDiscordId, playerId]
            );

            await client.query(`DELETE FROM play_slots WHERE player_id = $1`, [playerId]);
            if (newSlots.length > 0) {
                const slotValues = newSlots.map(slot => `(${playerId}, ${slot.start}, ${slot.end})`).join(',');
                await client.query(`INSERT INTO play_slots (player_id, start_minutes, end_minutes) VALUES ${slotValues}`);
            }

        } else {
            if (!pClass || !cp) { return res.redirect(`/?notification=${encodeURIComponent(`Class and CP are required for new players.`)}`); }
            const finalGuild = guild && guild.trim() ? guild.trim() : null;

            const insertRes = await client.query(
                `INSERT INTO players (name, class, combat_power, team, guild, notes, discord_user_id, updated_at, cp_last_updated)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id`,
                [name, pClass, combatPowerNumeric, team || 'No Team', finalGuild, notes || null, discordId]
            );
            playerId = insertRes.rows[0].id;

            if (newSlots.length > 0) {
                const slotValues = newSlots.map(slot => `(${playerId}, ${slot.start}, ${slot.end})`).join(',');
                await client.query(`INSERT INTO play_slots (player_id, start_minutes, end_minutes) VALUES ${slotValues}`);
            }
        }
        await client.query('COMMIT');
        res.redirect(`/?notification=${encodeURIComponent(`Player '${name}' submitted!`)}`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Transaction Error in /add-player:', err);
        res.status(500).redirect(`/?notification=${encodeURIComponent('An error occurred.')}`);
    } finally {
        client.release();
    }
});

router.post('/delete-player/:id', async (req, res) => {
    if (req.body.admin_password !== process.env.ADMIN_PASSWORD) return res.redirect('/?notification=Incorrect admin password.');
    try { await db.query('DELETE FROM players WHERE id = $1', [req.params.id]); res.redirect('/?notification=Player deleted.'); }
    catch (err) { console.error(err); res.redirect('/?notification=Error deleting player.'); }
});

router.post('/update-team/:id', async (req, res) => {
    if (req.body.admin_password !== process.env.ADMIN_PASSWORD) return res.redirect('/?notification=Incorrect admin password.');
    try { await db.query('UPDATE players SET team = $1, updated_at = NOW() WHERE id = $2', [req.body.team, req.params.id]); res.redirect('/?notification=Team updated.'); }
    catch (err) { console.error(err); res.redirect('/?notification=Error updating team.'); }
});

router.post('/rename-team', async (req, res) => {
    if (req.body.admin_password !== process.env.ADMIN_PASSWORD) return res.redirect('/?notification=Incorrect admin password.');
    try { await db.query('UPDATE players SET team = $1, updated_at = NOW() WHERE team = $2', [req.body.new_team_name, req.body.old_team_name]); res.redirect(`/?notification=Team renamed.`); }
    catch (err) { console.error(err); res.redirect('/?notification=Error renaming team.'); }
});

module.exports = router;