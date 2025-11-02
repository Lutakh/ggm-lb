// routes/dailyQuests.js
const express = require('express');
const router = express.Router(); // Ensure router is created
const db = require('../services/db');

const STAMINA_REGEN_RATE_MINUTES = 24;
const MAX_STAMINA = 60; // <<< LIMITE MISE A JOUR

// Liste des quêtes (clés et descriptions)
const dailyQuestsList = [
    { key: 'spend_stamina', label: 'Spend 20 Stamina' },
    { key: 'dragon_hunt', label: 'Dragon Hunt' },
    { key: 'manual_skill', label: 'Use Manual Skill (Class)' },
    { key: 'upgrade_skill', label: 'Upgrade Class Skill' },
    { key: 'upgrade_melo', label: 'Upgrade Melo' },
    { key: 'enhance_gear', label: 'Enhance Gear' },
    { key: 'guild_activities', label: 'Guild Activities (3)' },
    { key: 'quick_collect_res', label: 'Quick Collect Resources' },
    { key: 'quick_purchase', label: 'Quick Purchase (Shop)' },
    { key: 'buy_hamster_store', label: 'Buy from Hamster Store' },
    { key: 'artifact_treasure_hunt', label: 'Artifact Treasure Hunt' },
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
    const playerIds = req.query.playerIds;
    if (!playerIds) { return res.status(400).json({ error: 'playerIds parameter is required' }); }
    const idsArray = playerIds.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
    if (idsArray.length === 0) { return res.status(400).json({ error: 'Invalid playerIds parameter' }); }

    const lastResetDate = getLastDailyReset();
    const lastResetISO = lastResetDate.toISOString();

    try {
        const placeholders = idsArray.map((_, i) => `$${i + 1}`).join(',');
        const queryParamsPlayers = [...idsArray];
        const queryParamsQuests = [...idsArray, lastResetISO];

        // Fetch player data including raw stamina and timestamp
        const playersResult = await db.query(
            `SELECT id, name, stamina, stamina_last_updated FROM players WHERE id IN (${placeholders})`,
            queryParamsPlayers
        );

        // Fetch completed quests since last reset
        const questsResult = await db.query(
            `SELECT player_id, quest_key
             FROM daily_quest_status
             WHERE player_id IN (${placeholders}) AND completed_at >= $${idsArray.length + 1}`,
            queryParamsQuests
        );

        const results = playersResult.rows.map(player => {
            const completedQuests = questsResult.rows
                .filter(q => q.player_id === player.id)
                .map(q => q.quest_key);

            // *** MODIFICATION START ***
            // Return the raw stamina value from the database.
            // The frontend will calculate the current value based on this and the timestamp.
            return {
                playerId: player.id,
                name: player.name,
                stamina: player.stamina || 0, // Return raw DB value (base stamina)
                staminaLastUpdated: player.stamina_last_updated, // Return raw DB timestamp
                completedQuests: completedQuests
            };
            // *** MODIFICATION END ***
        });

        res.json({ players: results, questsList: dailyQuestsList });

    } catch (err) {
        console.error('[API /daily-quests/status] FATAL ERROR:', err);
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

// Mettre à jour le statut d'une quête
router.post('/daily-quests/update', async (req, res) => {
    // ... (Logique inchangée depuis la correction ON CONFLICT) ...
    const { playerId, questKey, completed } = req.body;
    if (!playerId || !questKey || typeof completed !== 'boolean') { return res.status(400).json({ error: 'Missing parameters' }); }
    const completionTime = new Date();
    const lastResetDate = getLastDailyReset();
    const lastResetISO = lastResetDate.toISOString();
    if (completionTime < lastResetDate && !completed) { return res.status(400).json({ error: 'Cannot update status for a previous day.' }); }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        if (completed) {
            const insertQuery = ` INSERT INTO daily_quest_status (player_id, quest_key, completed_at) VALUES ($1, $2, $3) ON CONFLICT (player_id, quest_key) DO UPDATE SET completed_at = EXCLUDED.completed_at WHERE daily_quest_status.completed_at < $4; `;
            await client.query(insertQuery, [playerId, questKey, completionTime, lastResetISO]);
        } else {
            const deleteQuery = ` DELETE FROM daily_quest_status WHERE player_id = $1 AND quest_key = $2 AND completed_at >= $3; `;
            await client.query(deleteQuery, [playerId, questKey, lastResetISO]);
        }
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[API /daily-quests/update] FATAL ERROR:', err);
        res.status(500).json({ error: 'Failed to update status' });
    } finally {
        client.release();
    }
});


// Mettre à jour manuellement la stamina ET/OU le timer
router.post('/daily-quests/update-stamina', async (req, res) => {
    const { playerId, stamina, minutesUntilNext, secondsUntilNext } = req.body;

    const staminaValue = parseInt(stamina, 10);
    const minutesValue = minutesUntilNext !== undefined && minutesUntilNext !== null && minutesUntilNext !== '' ? parseInt(minutesUntilNext, 10) : null;
    const secondsValue = secondsUntilNext !== undefined && secondsUntilNext !== null && secondsUntilNext !== '' ? parseInt(secondsUntilNext, 10) : null;

    // --- Validation (remains the same) ---
    if (!playerId || isNaN(staminaValue) || staminaValue < 0 || staminaValue > MAX_STAMINA) { return res.status(400).json({ error: 'Invalid stamina value.' }); }
    if (minutesValue !== null && (isNaN(minutesValue) || minutesValue < 0 || minutesValue >= STAMINA_REGEN_RATE_MINUTES)) { return res.status(400).json({ error: 'Invalid minutes value.' }); }
    if (secondsValue !== null && (isNaN(secondsValue) || secondsValue < 0 || secondsValue > 59)) { return res.status(400).json({ error: 'Invalid seconds value.' }); }
    if (minutesValue === null && secondsValue !== null && secondsValue !== 0) { return res.status(400).json({ error: 'Cannot set only seconds without minutes.' }); }
    // --- Fin Validation ---

    try {
        let newStaminaLastUpdated = new Date(); // Base timestamp is 'now'
        const nowTimestampForLog = Date.now(); // For logging
        const baseTimeLog = newStaminaLastUpdated.toISOString(); // For logging

        // *** MODIFIED TIMESTAMP CALCULATION ***
        if (minutesValue !== null && staminaValue < MAX_STAMINA) {
            const validSeconds = (secondsValue === null) ? 0 : secondsValue;
            const totalSecondsRemaining = (minutesValue * 60) + validSeconds;
            const cycleMilliseconds = STAMINA_REGEN_RATE_MINUTES * 60 * 1000; // Cycle duration in ms

            // 1. Calculate the exact time the *next* point *would* be gained
            const nextRegenTime = new Date(nowTimestampForLog + (totalSecondsRemaining * 1000));

            // 2. Subtract one full cycle to find when the *current* stamina level was reached
            newStaminaLastUpdated = new Date(nextRegenTime.getTime() - cycleMilliseconds);

        } else if (staminaValue >= MAX_STAMINA) {
            // If stamina is max, the last update time is effectively 'now' as regen has stopped.
            newStaminaLastUpdated = new Date(nowTimestampForLog);
        }
        // If minutesValue is null (only stamina was updated), newStaminaLastUpdated remains 'now'

        const newStaminaLastUpdatedISO = newStaminaLastUpdated.toISOString();

        console.log(`[UPDATE STAMINA v2] Player ${playerId}: Input(S:${staminaValue}, M:${minutesValue}, Sec:${secondsValue}) -> NowMillis:${nowTimestampForLog}, NowISO:${baseTimeLog}, Calculated TimestampISO: ${newStaminaLastUpdatedISO}`);

        // --- Réinitialiser le niveau de notification si < 40 (remains the same) ---
        let notificationLevelUpdateClause = '';
        const queryParams = [staminaValue, newStaminaLastUpdatedISO, playerId];
        if (staminaValue < 40) {
            notificationLevelUpdateClause = ', last_stamina_notification_level = $4';
            queryParams.push(0);
        }
        // ----------------------------------------------------------------

        const updateQuery = `UPDATE players SET stamina = $1, stamina_last_updated = $2 ${notificationLevelUpdateClause} WHERE id = $3`;
        await db.query(updateQuery, queryParams);

        // *** MODIFICATION: Respond with the exact values saved ***
        res.json({ success: true, stamina: staminaValue, staminaLastUpdated: newStaminaLastUpdatedISO });

    } catch (err) {
        console.error('[API /update-stamina] Error:', err);
        res.status(500).json({ error: 'Failed to update stamina' });
    }
});


module.exports = router; // Make sure this is the last line