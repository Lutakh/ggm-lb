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

module.exports = router;
