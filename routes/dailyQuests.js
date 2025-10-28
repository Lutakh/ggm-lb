// routes/dailyQuests.js
const express = require('express');
const router = express.Router(); // Ensure router is created
const db = require('../services/db');

const STAMINA_REGEN_RATE_MINUTES = 24;
const MAX_STAMINA = 60; // Limite mise à jour

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
    const playerIds = req.query.playerIds;
    // console.log(`[API /daily-quests/status] Received request for playerIds: ${playerIds}`);
    if (!playerIds) { /* ... gestion erreur ... */ return res.status(400).json({ error: 'playerIds parameter is required' }); }
    const idsArray = playerIds.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
    if (idsArray.length === 0) { /* ... gestion erreur ... */ return res.status(400).json({ error: 'Invalid playerIds parameter' }); }

    const lastResetDate = getLastDailyReset();
    const lastResetISO = lastResetDate.toISOString();
    // console.log(`[API /daily-quests/status] Calculated last reset date: ${lastResetISO}`);
    // console.log(`[API /daily-quests/status] Fetching data for IDs: ${idsArray.join(', ')}`);

    try {
        const placeholders = idsArray.map((_, i) => `$${i + 1}`).join(',');
        const queryParamsPlayers = [...idsArray];
        const queryParamsQuests = [...idsArray, lastResetISO];

        // console.log(`[API /daily-quests/status] Player Query Params:`, queryParamsPlayers);
        const playersResult = await db.query(
            `SELECT id, name, stamina, stamina_last_updated FROM players WHERE id IN (${placeholders})`,
            queryParamsPlayers
        );
        // console.log(`[API /daily-quests/status] Players Result Rows:`, playersResult.rows);

        // console.log(`[API /daily-quests/status] Quest Query Params:`, queryParamsQuests);
        const questsResult = await db.query(
            `SELECT player_id, quest_key
             FROM daily_quest_status
             WHERE player_id IN (${placeholders}) AND completed_at >= $${idsArray.length + 1}`,
            queryParamsQuests
        );
        // console.log(`[API /daily-quests/status] Quests Result Rows:`, questsResult.rows);

        const now = new Date(); // Utiliser une seule date 'now' pour tous les calculs de cette requête
        const results = playersResult.rows.map(player => {
            // console.log(`[API /daily-quests/status] Processing player: ${player.name} (ID: ${player.id})`);
            const lastUpdated = new Date(player.stamina_last_updated);
            if (isNaN(lastUpdated.getTime())) {
                console.warn(`[API /daily-quests/status] Invalid stamina_last_updated for player ${player.id}: ${player.stamina_last_updated}`);
                return { // Renvoyer une structure de base même avec une date invalide
                    playerId: player.id,
                    name: player.name,
                    stamina: Math.min(MAX_STAMINA, player.stamina || 0),
                    staminaLastUpdated: player.stamina_last_updated,
                    completedQuests: questsResult.rows.filter(q => q.player_id === player.id).map(q => q.quest_key) || []
                };
            }

            // Calcul fait ici pour être cohérent avec ce que le client *devrait* calculer
            const minutesPassed = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60)); // Utiliser getTime()
            const regeneratedStamina = minutesPassed > 0 ? Math.floor(minutesPassed / STAMINA_REGEN_RATE_MINUTES) : 0;
            const currentStamina = Math.min(MAX_STAMINA, (player.stamina || 0) + regeneratedStamina);

            const completedQuests = questsResult.rows
                .filter(q => q.player_id === player.id)
                .map(q => q.quest_key);

            return {
                playerId: player.id,
                name: player.name,
                stamina: currentStamina, // Renvoyer la valeur calculée par le serveur
                staminaLastUpdated: player.stamina_last_updated, // Mais garder le timestamp original pour le client
                completedQuests: completedQuests
            };
        });
        // console.log(`[API /daily-quests/status] Final processed results:`, results);

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


// Mettre à jour manuellement la stamina ET/OU le timer (avec réinitialisation notif)
router.post('/daily-quests/update-stamina', async (req, res) => {
    const { playerId, stamina, minutesUntilNext, secondsUntilNext } = req.body;

    const staminaValue = parseInt(stamina, 10);
    const minutesValue = minutesUntilNext !== undefined && minutesUntilNext !== null && minutesUntilNext !== '' ? parseInt(minutesUntilNext, 10) : null;
    const secondsValue = secondsUntilNext !== undefined && secondsUntilNext !== null && secondsUntilNext !== '' ? parseInt(secondsUntilNext, 10) : null;

    // console.log(`[API /update-stamina] Received: Player ${playerId}, Stamina ${stamina}, Min ${minutesUntilNext}, Sec ${secondsUntilNext} -> Parsed: Stam ${staminaValue}, Min ${minutesValue}, Sec ${secondsValue}`); // Debug Log

    // --- Validation (MAX_STAMINA mis à jour) ---
    if (!playerId || isNaN(staminaValue) || staminaValue < 0 || staminaValue > MAX_STAMINA) {
        console.error('[API /update-stamina] Invalid stamina value:', staminaValue);
        return res.status(400).json({ error: `Invalid parameters. PlayerId and Stamina (0-${MAX_STAMINA}) are required.` });
    }
    if (minutesValue !== null && (isNaN(minutesValue) || minutesValue < 0 || minutesValue >= STAMINA_REGEN_RATE_MINUTES)) { /* ... gestion erreur ... */ }
    if (secondsValue !== null && (isNaN(secondsValue) || secondsValue < 0 || secondsValue > 59)) { /* ... gestion erreur ... */ }
    if (minutesValue === null && secondsValue !== null && secondsValue !== 0) { /* ... gestion erreur ... */ }
    // --- Fin Validation ---

    try {
        let newStaminaLastUpdated = new Date(); // Base timestamp is 'now' (UTC implicit)
        const baseTimeLog = newStaminaLastUpdated.toISOString(); // Log base time

        // Si minutes/secondes sont fournies (et valides) ET que la stamina n'est pas déjà max
        if (minutesValue !== null && staminaValue < MAX_STAMINA) {
            const validSeconds = (secondsValue === null) ? 0 : secondsValue;
            // console.log(`[API /update-stamina] Adjusting timestamp based on Min: ${minutesValue}, Sec: ${validSeconds}`); // Debug Log
            const totalSecondsRemaining = (minutesValue * 60) + validSeconds;
            const cycleSeconds = STAMINA_REGEN_RATE_MINUTES * 60;
            const secondsAgo = cycleSeconds - totalSecondsRemaining;
            // console.log(`[API /update-stamina] Calculation: cycleSec=${cycleSeconds}, remainingSec=${totalSecondsRemaining}, secondsAgo=${secondsAgo}`);
            newStaminaLastUpdated.setTime(newStaminaLastUpdated.getTime() - (secondsAgo * 1000));
        } else if (minutesValue !== null && staminaValue >= MAX_STAMINA) {
            // console.log(`[API /update-stamina] Stamina is max (${staminaValue}), ignoring timer. Timestamp set to now.`); // Debug Log
            newStaminaLastUpdated = new Date();
        }
        // Si minutesValue est null, newStaminaLastUpdated reste à 'now'

        const newStaminaLastUpdatedISO = newStaminaLastUpdated.toISOString();
        // console.log(`[API /update-stamina] Player ${playerId}: BaseTime=${baseTimeLog}, Final Calculated Timestamp=${newStaminaLastUpdatedISO}`);

        // --- NOUVEAU : Réinitialiser le niveau de notification si < 55 ---
        let notificationLevelUpdateClause = '';
        const queryParams = [staminaValue, newStaminaLastUpdatedISO, playerId];
        if (staminaValue < 55) {
            notificationLevelUpdateClause = ', last_stamina_notification_level = $4'; // Placeholder $4
            queryParams.push(0); // Ajouter la valeur 0 pour le $4
            console.log(`[API /update-stamina] Stamina < 55, resetting notification level for player ${playerId}`);
        }
        // ----------------------------------------------------------------

        // Mettre à jour la BDD (avec la mise à jour conditionnelle du niveau)
        // Les placeholders ($1, $2, $3, $4) sont gérés par le driver pg
        const updateQuery = `UPDATE players SET stamina = $1, stamina_last_updated = $2 ${notificationLevelUpdateClause} WHERE id = $3`;
        // console.log("[API /update-stamina] Query:", updateQuery, "Params:", queryParams); // Debug query
        await db.query(updateQuery, queryParams);

        // Renvoyer les valeurs confirmées
        res.json({ success: true, stamina: staminaValue, staminaLastUpdated: newStaminaLastUpdatedISO });

    } catch (err) {
        console.error('[API /update-stamina] Error:', err);
        res.status(500).json({ error: 'Failed to update stamina' });
    }
});


module.exports = router; // Make sure this is the last line