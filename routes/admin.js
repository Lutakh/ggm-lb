const express = require('express');
const router = express.Router();
const db = require('../services/db');

router.post('/verify-admin', (req, res) => { 
    res.json({ success: req.body.password === process.env.ADMIN_PASSWORD }); 
});

router.post('/update-server-settings', async (req, res) => {
    if (req.body.admin_password !== process.env.ADMIN_PASSWORD) {
        return res.status(403).json({ success: false, message: 'Incorrect admin password.' });
    }

    const { server_name, server_open_date, cc_timers } = req.body;
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        
        await client.query(`UPDATE server_settings SET value = $1 WHERE key = 'server_name'`, [server_name]);
        await client.query(`UPDATE server_settings SET value = $1 WHERE key = 'server_open_date'`, [server_open_date]);

        if (cc_timers && Array.isArray(cc_timers)) {
            for (const timer of cc_timers) {
                const id = parseInt(timer.id, 10);
                const weeks = parseInt(timer.weeks, 10);
                if (!isNaN(id) && !isNaN(weeks)) {
                    await client.query(
                        `UPDATE class_change_timers SET weeks_after_start = $1 WHERE id = $2`,
                        [weeks, id]
                    );
                }
            }
        }
        
        await client.query('COMMIT');
        res.json({ success: true, message: 'Server settings updated!' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error updating server settings:", err);
        res.status(500).json({ success: false, message: 'Error updating settings.' });
    } finally {
        client.release();
    }
});

module.exports = router;
