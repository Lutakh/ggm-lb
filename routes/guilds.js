[original_file:lutakh/ggm-lb/ggm-lb-gemini/routes/guilds.js]
const express = require('express');
const router = express.Router();
const db = require('../services/db');

router.post('/add-guild', async (req, res) => {
    if (req.body.admin_password !== process.env.ADMIN_PASSWORD) { return res.redirect('/?notification=Incorrect admin password.'); }
    try {
        await db.query(`INSERT INTO guilds (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [req.body.guild_name]);
        res.redirect(`/?notification=Guild '${req.body.guild_name}' added.`);
    } catch (err) { console.error("Error adding guild:", err); res.redirect('/?notification=Error adding guild.'); }
});

router.post('/rename-guild', async (req, res) => {
    if (req.body.admin_password !== process.env.ADMIN_PASSWORD) { return res.redirect('/?notification=Incorrect admin password.'); }
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE players SET guild = $1 WHERE guild = $2`, [req.body.new_guild_name, req.body.old_guild_name]);
        await client.query(`UPDATE guilds SET name = $1 WHERE name = $2`, [req.body.new_guild_name, req.body.old_guild_name]);
        await client.query('COMMIT');
        res.redirect(`/?notification=Guild renamed.`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error renaming guild:", err);
        res.redirect('/?notification=Error renaming guild.');
    } finally { client.release(); }
});

router.post('/delete-guild', async (req, res) => {
    if (req.body.admin_password !== process.env.ADMIN_PASSWORD) { return res.redirect('/?notification=Incorrect admin password.'); }
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE players SET guild = NULL WHERE guild = $1`, [req.body.guild_name]);
        await client.query(`DELETE FROM guilds WHERE name = $1`, [req.body.guild_name]);
        await client.query('COMMIT');
        res.redirect(`/?notification=Guild '${req.body.guild_name}' deleted.`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error deleting guild:", err);
        res.redirect('/?notification=Error deleting guild.');
    } finally { client.release(); }
});

// NOUVEAU : API pour récupérer les membres d'une guilde (JSON)
router.get('/api/guild-members/:guildName', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, name, class, combat_power, cp_last_updated
            FROM players
            WHERE guild = $1
            ORDER BY combat_power DESC
        `, [req.params.guildName]);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching guild members:", err);
        res.status(500).json({ error: "Failed to fetch members" });
    }
});

// NOUVEAU : API pour retirer un joueur d'une guilde (AJAX, sans redirect)
router.post('/api/remove-from-guild', async (req, res) => {
    // Vérification mot de passe admin (envoyé dans le corps de la requête JSON)
    if (req.body.admin_password !== process.env.ADMIN_PASSWORD) {
        return res.status(403).json({ success: false, error: 'Incorrect admin password.' });
    }
    try {
        await db.query('UPDATE players SET guild = NULL, updated_at = NOW() WHERE id = $1', [req.body.player_id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Error removing player from guild:", err);
        res.status(500).json({ success: false, error: 'Database error.' });
    }
});

module.exports = router;