// routes/teamPlanner.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// Obtenir toutes les activités (futures ET passées)
router.get('/team-planner/activities', async (req, res) => {
    try {
        // Pas de filtrage par date ici, on renvoie tout l'historique.
        // Le front-end se chargera de séparer futur/passé.
        const activitiesRes = await db.query(`
            SELECT pa.*,
                   p_creator.name as creator_name,
                   (SELECT json_agg(json_build_object(
                           'id', p.id,
                           'name', p.name,
                           'class', p.class,
                           'guild', p.guild,
                           'combat_power', p.combat_power
                                    ))
                    FROM activity_participants ap
                             JOIN players p ON ap.player_id = p.id
                    WHERE ap.activity_id = pa.id
                   ) as participants
            FROM planned_activities pa
                     LEFT JOIN players p_creator ON pa.creator_id = p_creator.id
            ORDER BY pa.scheduled_time ASC
        `);

        res.json(activitiesRes.rows);
    } catch (err) {
        console.error("Error fetching activities:", err);
        res.status(500).json({ error: "Failed to fetch activities" });
    }
});

// Créer une nouvelle activité
router.post('/team-planner/create', async (req, res) => {
    const { activity_type, activity_subtype, scheduled_time, creator_id, notes } = req.body;

    if (!activity_type || !scheduled_time || !creator_id) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Créer l'activité
        const insertRes = await client.query(`
            INSERT INTO planned_activities (activity_type, activity_subtype, scheduled_time, creator_id, notes)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, [activity_type, activity_subtype, scheduled_time, creator_id, notes]);
        const activityId = insertRes.rows[0].id;

        // Ajouter le créateur comme premier participant automatiquement
        await client.query(`
            INSERT INTO activity_participants (activity_id, player_id)
            VALUES ($1, $2)
        `, [activityId, creator_id]);

        await client.query('COMMIT');
        res.json({ success: true, message: "Activity created!" });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error creating activity:", err);
        res.status(500).json({ error: "Failed to create activity." });
    } finally {
        client.release();
    }
});

// Rejoindre une activité
router.post('/team-planner/join', async (req, res) => {
    const { activity_id, player_id } = req.body;
    try {
        // Vérifier s'il reste de la place
        const activityRes = await db.query("SELECT activity_type FROM planned_activities WHERE id = $1", [activity_id]);
        if (activityRes.rows.length === 0) return res.status(404).json({ error: "Activity not found" });
        const type = activityRes.rows[0].activity_type;
        const maxPlayers = (type === 'Echo of War' || type === 'Dragon Hunt') ? 6 : 4;

        const countRes = await db.query("SELECT COUNT(*) FROM activity_participants WHERE activity_id = $1", [activity_id]);
        if (parseInt(countRes.rows[0].count) >= maxPlayers) {
            return res.status(400).json({ error: "Activity is full." });
        }

        await db.query(`
            INSERT INTO activity_participants (activity_id, player_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
        `, [activity_id, player_id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Error joining activity:", err);
        res.status(500).json({ error: "Failed to join activity." });
    }
});

// Quitter une activité
router.post('/team-planner/leave', async (req, res) => {
    const { activity_id, player_id } = req.body;
    try {
        await db.query(`DELETE FROM activity_participants WHERE activity_id = $1 AND player_id = $2`, [activity_id, player_id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Error leaving activity:", err);
        res.status(500).json({ error: "Failed to leave activity." });
    }
});

// KICK un joueur (Admin seulement)
router.post('/team-planner/kick', async (req, res) => {
    const { activity_id, target_player_id, admin_password } = req.body;

    // Vérification simple du mot de passe admin
    if (admin_password !== process.env.ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Incorrect admin password.' });
    }

    try {
        await db.query(`DELETE FROM activity_participants WHERE activity_id = $1 AND player_id = $2`, [activity_id, target_player_id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Error kicking player from activity:", err);
        res.status(500).json({ error: "Failed to kick player." });
    }
});

// Supprimer une activité (Admin seulement pour l'instant)
router.post('/team-planner/delete', async (req, res) => {
    if (req.body.admin_password !== process.env.ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Incorrect admin password.' });
    }
    try {
        await db.query("DELETE FROM planned_activities WHERE id = $1", [req.body.activity_id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Error deleting activity:", err);
        res.status(500).json({ error: "Failed to delete activity." });
    }
});

module.exports = router;