// routes/dailyQuests.js
const express = require('express');
const router = express.Router(); // Ensure router is created
const db = require('../services/db');

const STAMINA_REGEN_RATE_MINUTES = 24;
const MAX_STAMINA = 99;

// Liste des quêtes (clés et descriptions)
const dailyQuestsList = [
    { key: 'spend_stamina', label: 'Spend 20 Stamina' },
    { key: 'manual_skill', label: 'Use Manual Skill (Class)' },
    { key: 'dragon_hunt', label: 'Dragon Hunt' },
    { key: 'upgrade_skill', label: 'Upgrade Class Skill' },
    { key: 'upgrade_melo', label: 'Upgrade Melo' },
    { key: 'enhance_gear', label: 'Enhance Gear' },
    { key: 'guild_activities', label: 'Guild Activities (3)' },
    { key: 'quick_purchase', label: 'Quick Purchase (Shop)' },
    { key: 'collect_artifact_res', label: 'Collect Artifact Resources' },
    { key: 'artifact_treasure_hunt', label: 'Artifact Treasure Hunt' },
    { key: 'quick_collect_res', label: 'Quick Collect Resources' },
    { key: 'buy_hamster_store', label: 'Buy from Hamster Store' },
    { key: 'claim_activity_points', label: 'Claim Daily Activity Points' },
    { key: 'check_event_page', label: 'Check Event Page' },
    { key: 'upgrade_artifact', label: 'Upgrade Artifact' },
];

// Fonction pour calculer la date du dernier reset quotidien (09:00 UTC)
const getLastDailyReset = () => {
    const now = new Date();
    const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9, 0, 0, 0));
    if (now < reset) { // Si l'heure actuelle est avant 9h UTC
        reset.setUTCDate(reset.getUTCDate() - 1); // Prendre le reset de la veille
    }
    return reset;
};

// Obtenir le statut des quêtes et la stamina pour plusieurs joueurs
router.get('/daily-quests/status', async (req, res) => {
    const playerIds = req.query.playerIds; // Attendu comme "1,2,3"
    if (!playerIds) {
        return res.status(400).json({ error: 'playerIds parameter is required' });
    }

    const idsArray = playerIds.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
    if (idsArray.length === 0) {
        return res.status(400).json({ error: 'Invalid playerIds parameter' });
    }

    const lastResetDate = getLastDailyReset();
    const lastResetISO = lastResetDate.toISOString();

    try {
        const placeholders = idsArray.map((_, i) => `$${i + 1}`).join(',');

        // 1. Récupérer les données des joueurs (stamina)
        const playersResult = await db.query(
            `SELECT id, name, stamina, stamina_last_updated FROM players WHERE id IN (${placeholders})`,
            idsArray
        );

        // 2. Récupérer le statut des quêtes complétées depuis le dernier reset
        const questsResult = await db.query(
            `SELECT player_id, quest_key
             FROM daily_quest_status
             WHERE player_id IN (${placeholders}) AND completed_at >= $${idsArray.length + 1}`, // Le dernier placeholder est pour la date
            [...idsArray, lastResetISO]
        );

        // 3. Calculer la stamina actuelle et formater les résultats
        const now = new Date();
        const results = playersResult.rows.map(player => {
            const lastUpdated = new Date(player.stamina_last_updated);
            const minutesPassed = Math.floor((now - lastUpdated) / (1000 * 60));
            const regeneratedStamina = Math.floor(minutesPassed / STAMINA_REGEN_RATE_MINUTES);
            const currentStamina = Math.min(MAX_STAMINA, (player.stamina || 0) + regeneratedStamina);

            const completedQuests = questsResult.rows
                .filter(q => q.player_id === player.id)
                .map(q => q.quest_key);

            return {
                playerId: player.id,
                name: player.name,
                stamina: currentStamina,
                staminaLastUpdated: player.stamina_last_updated, // Utile pour le debug ou affichage ?
                completedQuests: completedQuests
            };
        });

        res.json({ players: results, questsList: dailyQuestsList });

    } catch (err) {
        console.error('Error fetching daily quest status:', err);
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

// Mettre à jour le statut d'une quête
router.post('/daily-quests/update', async (req, res) => {
    const { playerId, questKey, completed } = req.body;
    if (!playerId || !questKey || typeof completed !== 'boolean') {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    const completionTime = new Date(); // Maintenant
    const lastResetDate = getLastDailyReset();

    // Vérifier si la complétion est pour la journée actuelle (après le dernier reset)
    if (completionTime < lastResetDate) {
        return res.status(400).json({ error: 'Cannot update status for a previous day.' });
    }

    try {
        if (completed) {
            // Insérer ou ignorer si déjà marqué comme complété pour AUJOURD'HUI
            // ON CONFLICT utilise la clé primaire (player_id, quest_key, DATE(completed_at))
            await db.query(
                `INSERT INTO daily_quest_status (player_id, quest_key, completed_at)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (player_id, quest_key, DATE(completed_at AT TIME ZONE 'UTC')) DO NOTHING`,
                [playerId, questKey, completionTime]
            );
        } else {
            // Supprimer seulement si la complétion était aujourd'hui
            await db.query(
                'DELETE FROM daily_quest_status WHERE player_id = $1 AND quest_key = $2 AND completed_at >= $3',
                [playerId, questKey, lastResetDate]
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating daily quest status:', err);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Mettre à jour manuellement la stamina
router.post('/daily-quests/update-stamina', async (req, res) => {
    const { playerId, stamina } = req.body;
    const staminaValue = parseInt(stamina, 10);

    if (!playerId || isNaN(staminaValue) || staminaValue < 0 || staminaValue > MAX_STAMINA) {
        return res.status(400).json({ error: 'Invalid parameters. Stamina must be between 0 and 99.' });
    }

    try {
        await db.query(
            'UPDATE players SET stamina = $1, stamina_last_updated = NOW() WHERE id = $2',
            [staminaValue, playerId]
        );
        res.json({ success: true, stamina: staminaValue, staminaLastUpdated: new Date().toISOString() });
    } catch (err) {
        console.error('Error updating stamina:', err);
        res.status(500).json({ error: 'Failed to update stamina' });
    }
});

// THIS IS THE CRUCIAL LINE - MAKE SURE IT'S HERE AND CORRECT
module.exports = router;