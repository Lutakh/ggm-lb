// routes/players.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { parseCombatPower, timeToMinutes } = require('../utils/helpers');

// GET /player-details/:name (Renvoyer aussi l'ID Discord)
router.get('/player-details/:name', async (req, res) => {
    const sql = `SELECT p.*,
                        json_agg(json_build_object('start_minutes', ps.start_minutes, 'end_minutes', ps.end_minutes)) FILTER (WHERE ps.id IS NOT NULL) as play_slots
                 FROM players p
                          LEFT JOIN play_slots ps ON p.id = ps.player_id
                 WHERE p.name ILIKE $1 GROUP BY p.id`; // ILIKE pour insensible à la casse
    try {
        const result = await db.query(sql, [req.params.name]);
        if (result.rows.length === 0) return res.json(null); // Renvoyer null si non trouvé

        // Assurer que play_slots est un tableau vide si null
        const player = {...result.rows[0], play_slots: result.rows[0].play_slots || []};
        res.json(player); // Renvoyer toutes les colonnes, y compris discord_user_id
    } catch (err) {
        console.error(`Error fetching player details for "${req.params.name}":`, err);
        res.status(500).json(null); // Renvoyer null en cas d'erreur serveur
    }
});


router.post('/add-player', async (req, res) => {
    // Ajouter discord_user_id
    let { name, pClass, cp, team, guild, notes, play_start = [], play_end = [], discord_user_id } = req.body;
    name = name ? name.trim() : ''; // Assurer que name n'est pas null/undefined
    const discordId = (discord_user_id && String(discord_user_id).trim()) ? String(discord_user_id).trim() : null; // Nettoyer l'ID Discord, s'assurer que c'est une string ou null

    if (!name) {
        // Gérer le cas où le nom est vide
        return res.redirect(`/?notification=${encodeURIComponent('Player name cannot be empty.')}`);
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const existingPlayerRes = await client.query(`SELECT * FROM players WHERE name ILIKE $1`, [name]);
        const existingPlayer = existingPlayerRes.rows[0];

        const combatPowerNumeric = parseCombatPower(cp);
        const startTimes = Array.isArray(play_start) ? play_start : [play_start].filter(t => t); // Filtrer les undefined/null potentiels
        const endTimes = Array.isArray(play_end) ? play_end : [play_end].filter(t => t);
        const newSlots = startTimes
            .map((st, i) => ({ start: timeToMinutes(st), end: timeToMinutes(endTimes[i]) }))
            .filter(s => s.start !== null && s.end !== null);

        let playerId;
        if (existingPlayer) {
            playerId = existingPlayer.id;
            // Utiliser les valeurs existantes comme fallback si les nouvelles sont vides/undefined
            const finalClass = pClass || existingPlayer.class;
            const finalCp = cp ? combatPowerNumeric : existingPlayer.combat_power;
            const finalTeam = team === undefined ? existingPlayer.team : (team || 'No Team');
            const finalGuild = guild === undefined ? existingPlayer.guild : (guild || null); // Utiliser null si vide
            const finalNotes = notes !== undefined ? notes : existingPlayer.notes;
            // Gérer la mise à jour de l'ID Discord : si une nouvelle valeur est fournie (même vide), elle prend le dessus
            const finalDiscordId = discord_user_id !== undefined ? discordId : existingPlayer.discord_user_id;

            // Ajouter discord_user_id à l'UPDATE
            await client.query(
                `UPDATE players SET name = $1, class = $2, combat_power = $3, team = $4, guild = $5, notes = $6, discord_user_id = $7, updated_at = NOW()
                 WHERE id = $8`,
                [name, finalClass, finalCp, finalTeam, finalGuild, finalNotes, finalDiscordId, playerId]
            );

            // Gérer les slots
            await client.query(`DELETE FROM play_slots WHERE player_id = $1`, [playerId]);
            if (newSlots.length > 0) {
                const slotValues = newSlots.map(slot => `(${playerId}, ${slot.start}, ${slot.end})`).join(',');
                await client.query(`INSERT INTO play_slots (player_id, start_minutes, end_minutes) VALUES ${slotValues}`);
            }

        } else { // Nouveau joueur
            if (!pClass || !cp) { return res.redirect(`/?notification=${encodeURIComponent(`Class and CP are required for new players.`)}`); }

            // Assurer que guild est null si vide
            const finalGuild = guild && guild.trim() ? guild.trim() : null;

            // Ajouter discord_user_id à l'INSERT
            const insertRes = await client.query(
                `INSERT INTO players (name, class, combat_power, team, guild, notes, discord_user_id, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
                [name, pClass, combatPowerNumeric, team || 'No Team', finalGuild, notes || null, discordId] // Utiliser discordId nettoyé
            );
            playerId = insertRes.rows[0].id;

            // Insérer les slots pour le nouveau joueur
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