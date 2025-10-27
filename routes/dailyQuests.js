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
    const playerIds = req.query.playerIds;
    // --- START DEBUG LOG ---
    // console.log(`[API /daily-quests/status] Received request for playerIds: ${playerIds}`);
    // --- END DEBUG LOG ---
    if (!playerIds) {
        console.error('[API /daily-quests/status] Error: playerIds parameter missing');
        return res.status(400).json({ error: 'playerIds parameter is required' });
    }

    const idsArray = playerIds.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
    if (idsArray.length === 0) {
        console.error(`[API /daily-quests/status] Error: Invalid playerIds parameter: ${playerIds}`);
        return res.status(400).json({ error: 'Invalid playerIds parameter' });
    }

    const lastResetDate = getLastDailyReset();
    const lastResetISO = lastResetDate.toISOString();
    // --- START DEBUG LOG ---
    // console.log(`[API /daily-quests/status] Calculated last reset date: ${lastResetISO}`);
    // console.log(`[API /daily-quests/status] Fetching data for IDs: ${idsArray.join(', ')}`);
    // --- END DEBUG LOG ---

    try {
        const placeholders = idsArray.map((_, i) => `$${i + 1}`).join(',');
        const queryParamsPlayers = [...idsArray];
        const queryParamsQuests = [...idsArray, lastResetISO]; // Date is the last parameter

        // --- START DEBUG LOG ---
        // console.log(`[API /daily-quests/status] Player Query Placeholders: ${placeholders}`);
        // console.log(`[API /daily-quests/status] Player Query Params:`, queryParamsPlayers);
        // --- END DEBUG LOG ---
        // 1. Récupérer les données des joueurs (stamina)
        const playersResult = await db.query(
            `SELECT id, name, stamina, stamina_last_updated FROM players WHERE id IN (${placeholders})`,
            queryParamsPlayers // Utiliser les paramètres préparés
        );
        // --- START DEBUG LOG ---
        // console.log(`[API /daily-quests/status] Players Result Rows:`, playersResult.rows);
        // --- END DEBUG LOG ---


        // --- START DEBUG LOG ---
        // console.log(`[API /daily-quests/status] Quest Query Placeholders: ${placeholders}, $${idsArray.length + 1}`);
        // console.log(`[API /daily-quests/status] Quest Query Params:`, queryParamsQuests);
        // --- END DEBUG LOG ---
        // 2. Récupérer le statut des quêtes complétées depuis le dernier reset
        const questsResult = await db.query(
            `SELECT player_id, quest_key
             FROM daily_quest_status
             WHERE player_id IN (${placeholders}) AND completed_at >= $${idsArray.length + 1}`, // Date is the parameter after all IDs
            queryParamsQuests // Utiliser les paramètres préparés
        );
        // --- START DEBUG LOG ---
        // console.log(`[API /daily-quests/status] Quests Result Rows:`, questsResult.rows);
        // --- END DEBUG LOG ---


        // 3. Calculer la stamina actuelle et formater les résultats
        const now = new Date();
        const results = playersResult.rows.map(player => {
            // --- START DEBUG LOG ---
            // console.log(`[API /daily-quests/status] Processing player: ${player.name} (ID: ${player.id})`);
            // --- END DEBUG LOG ---
            const lastUpdated = new Date(player.stamina_last_updated);
            // Safety check for invalid date
            if (isNaN(lastUpdated.getTime())) {
                console.warn(`[API /daily-quests/status] Invalid stamina_last_updated for player ${player.id}: ${player.stamina_last_updated}`);
                // Handle as if stamina hasn't regenerated since last manual update
                return {
                    playerId: player.id,
                    name: player.name,
                    stamina: Math.min(MAX_STAMINA, player.stamina || 0), // Use stored stamina, capped
                    staminaLastUpdated: player.stamina_last_updated,
                    completedQuests: questsResult.rows
                        .filter(q => q.player_id === player.id)
                        .map(q => q.quest_key) || [] // Ensure array
                };
            }

            const minutesPassed = Math.floor((now - lastUpdated) / (1000 * 60));
            const regeneratedStamina = minutesPassed > 0 ? Math.floor(minutesPassed / STAMINA_REGEN_RATE_MINUTES) : 0;
            const currentStamina = Math.min(MAX_STAMINA, (player.stamina || 0) + regeneratedStamina);

            const completedQuests = questsResult.rows
                .filter(q => q.player_id === player.id)
                .map(q => q.quest_key);

            return {
                playerId: player.id,
                name: player.name,
                stamina: currentStamina,
                staminaLastUpdated: player.stamina_last_updated,
                completedQuests: completedQuests // Already an array from map
            };
        });
        // --- START DEBUG LOG ---
        // console.log(`[API /daily-quests/status] Final processed results:`, results);
        // --- END DEBUG LOG ---

        res.json({ players: results, questsList: dailyQuestsList });

    } catch (err) {
        // Log the detailed error on the server
        console.error('[API /daily-quests/status] FATAL ERROR:', err);
        // Send a generic error response to the client
        res.status(500).json({ error: 'Failed to fetch status' }); // Keep this generic for the client
    }
});

// Mettre à jour le statut d'une quête (CORRIGÉ pour ON CONFLICT)
router.post('/daily-quests/update', async (req, res) => {
    const { playerId, questKey, completed } = req.body;
    if (!playerId || !questKey || typeof completed !== 'boolean') {
        console.error('[API /daily-quests/update] Error: Missing parameters', req.body);
        return res.status(400).json({ error: 'Missing parameters' });
    }

    const completionTime = new Date(); // Timestamp actuel
    const lastResetDate = getLastDailyReset(); // Timestamp du dernier reset
    const lastResetISO = lastResetDate.toISOString();

    // -- DEBUG LOG --
    // console.log(`[API /daily-quests/update] Request: Player ${playerId}, Quest ${questKey}, Completed: ${completed}`);
    // console.log(`[API /daily-quests/update] Current Time: ${completionTime.toISOString()}`);
    // console.log(`[API /daily-quests/update] Last Reset: ${lastResetISO}`);
    // -- END DEBUG LOG --

    // Vérifier si la demande concerne bien la journée actuelle (après le dernier reset)
    // Utile surtout pour le DELETE, car l'INSERT/UPDATE gère l'ancien timestamp
    if (completionTime < lastResetDate && !completed) {
        console.warn(`[API /daily-quests/update] Attempt to uncheck quest from a previous day denied.`);
        // On pourrait techniquement autoriser la suppression, mais cela complexifie.
        // Pour l'instant, on interdit la modification d'un état passé via décochage.
        return res.status(400).json({ error: 'Cannot update status for a previous day.' });
    }

    const client = await db.getClient(); // Use a client for potential transaction

    try {
        await client.query('BEGIN'); // Start transaction

        if (completed) {
            // Essayer d'insérer. Si ça échoue (conflit sur player_id, quest_key),
            // alors mettre à jour la ligne existante SEULEMENT si son completed_at est AVANT le dernier reset.
            // Si elle date déjà d'aujourd'hui, l'UPDATE ne fera rien grâce à la clause WHERE.
            const insertQuery = `
                INSERT INTO daily_quest_status (player_id, quest_key, completed_at)
                VALUES ($1, $2, $3)
                    ON CONFLICT (player_id, quest_key)
                DO UPDATE SET completed_at = EXCLUDED.completed_at
                   WHERE daily_quest_status.completed_at < $4; -- Only update if the existing row is from a previous day
            `;
            // $1=playerId, $2=questKey, $3=completionTime, $4=lastResetISO
            const result = await client.query(insertQuery, [playerId, questKey, completionTime, lastResetISO]);
            // -- DEBUG LOG --
            // console.log('[API /daily-quests/update] INSERT/UPDATE result:', result.command, result.rowCount);

        } else {
            // Supprimer seulement si la complétion à supprimer date d'APRÈS le dernier reset.
            // Cela empêche de supprimer accidentellement une ancienne entrée si on décoche "trop tard".
            const deleteQuery = `
                DELETE FROM daily_quest_status
                WHERE player_id = $1 AND quest_key = $2 AND completed_at >= $3;
            `;
            // $1=playerId, $2=questKey, $3=lastResetISO
            const result = await client.query(deleteQuery, [playerId, questKey, lastResetISO]);
            // -- DEBUG LOG --
            // console.log('[API /daily-quests/update] DELETE result:', result.command, result.rowCount);
        }

        await client.query('COMMIT'); // Commit transaction
        res.json({ success: true });

    } catch (err) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error('[API /daily-quests/update] FATAL ERROR:', err);
        res.status(500).json({ error: 'Failed to update status' });
    } finally {
        client.release(); // Release client
    }
});


// Mettre à jour manuellement la stamina ET/OU le timer (MODIFIÉ)
router.post('/daily-quests/update-stamina', async (req, res) => {
    const { playerId, stamina, minutesUntilNext } = req.body; // minutesUntilNext est optionnel

    const staminaValue = parseInt(stamina, 10);
    // Convertir '' ou undefined en null, puis parser
    const minutesValue = minutesUntilNext !== undefined && minutesUntilNext !== null && minutesUntilNext !== '' ? parseInt(minutesUntilNext, 10) : null;

    // console.log(`[API /update-stamina] Received: Player ${playerId}, Stamina ${stamina}, Minutes ${minutesUntilNext} -> Parsed Minutes: ${minutesValue}`); // Debug

    if (!playerId || isNaN(staminaValue) || staminaValue < 0 || staminaValue > MAX_STAMINA) {
        console.error('[API /update-stamina] Invalid stamina value:', staminaValue);
        return res.status(400).json({ error: 'Invalid parameters. PlayerId and Stamina (0-99) are required.' });
    }
    // Validation pour les minutes restantes (seulement si non null)
    if (minutesValue !== null && (isNaN(minutesValue) || minutesValue < 0 || minutesValue >= STAMINA_REGEN_RATE_MINUTES)) {
        console.error('[API /update-stamina] Invalid minutes value:', minutesValue);
        return res.status(400).json({ error: `Invalid parameters. Minutes until next must be between 0 and ${STAMINA_REGEN_RATE_MINUTES - 1}.` });
    }

    try {
        let newStaminaLastUpdated = new Date(); // Base timestamp is 'now'

        // Si les minutes restantes sont fournies (et valides) ET que la stamina n'est pas déjà max
        if (minutesValue !== null && staminaValue < MAX_STAMINA) {
            // console.log(`[API /update-stamina] Adjusting timestamp based on minutesUntilNext: ${minutesValue}`); // Debug
            // Calculate the timestamp of the *last* stamina gain
            // Time elapsed since last gain = REGEN_RATE - minutes_remaining
            const minutesAgo = STAMINA_REGEN_RATE_MINUTES - minutesValue;
            // Adjust the base 'now' timestamp backwards
            newStaminaLastUpdated.setMinutes(newStaminaLastUpdated.getMinutes() - minutesAgo);
            // Optional: zero out seconds/ms for 'cleaner' timestamps aligned with minute changes
            newStaminaLastUpdated.setSeconds(0, 0);
        } else if (minutesValue !== null && staminaValue >= MAX_STAMINA) {
            // console.log(`[API /update-stamina] Stamina is max (${staminaValue}), ignoring minutesUntilNext. Timestamp set to now.`); // Debug
            // If stamina is max, the 'last updated' time reflecting the timer doesn't matter as much,
            // setting it to 'now' is acceptable as regen won't happen anyway.
            newStaminaLastUpdated = new Date();
        }
        // If minutesValue is null (not provided or cleared), newStaminaLastUpdated remains 'now',
        // effectively resetting the timer based on the current manual stamina setting.

        const newStaminaLastUpdatedISO = newStaminaLastUpdated.toISOString();
        // console.log(`[API /update-stamina] Final stamina: ${staminaValue}, Final timestamp: ${newStaminaLastUpdatedISO}`); // Debug

        // Update DB with the set stamina value and the calculated/current timestamp
        await db.query(
            'UPDATE players SET stamina = $1, stamina_last_updated = $2 WHERE id = $3',
            [staminaValue, newStaminaLastUpdatedISO, playerId]
        );

        // Return the confirmed values
        res.json({ success: true, stamina: staminaValue, staminaLastUpdated: newStaminaLastUpdatedISO });

    } catch (err) {
        console.error('[API /update-stamina] Error:', err);
        res.status(500).json({ error: 'Failed to update stamina' });
    }
});


module.exports = router; // Make sure this is the last line