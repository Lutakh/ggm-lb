// services/scheduler.js
const db = require('./db');
const { sendDiscordDM, isBotReady } = require('./discordBot'); // Importer aussi isBotReady

const STAMINA_REGEN_RATE_MINUTES = 24;
const MAX_STAMINA = 60; // Assurer la cohérence
const CHECK_INTERVAL_MS = 60 * 1000; // Vérifier toutes les minutes

let intervalId = null;

// Fonction de calcul (similaire au frontend/backend GET)
function calculateCurrentStamina(baseStamina, lastUpdatedISO) {
    if (!lastUpdatedISO) return baseStamina || 0;
    const lastUpdated = new Date(lastUpdatedISO);
    const now = new Date(); // Utiliser l'heure actuelle du serveur pour le calcul
    if (isNaN(lastUpdated.getTime())) return baseStamina || 0;

    // Utiliser getTime() pour des calculs fiables indépendamment des fuseaux horaires
    const minutesPassed = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60));

    if (minutesPassed < 0) {
        console.warn(`[Scheduler Calc] Negative minutes passed detected (${minutesPassed}) for timestamp ${lastUpdatedISO}. Clock skew possible.`);
        // Retourner la valeur de base semble le plus sûr
        return Math.min(MAX_STAMINA, baseStamina || 0);
    }

    const regeneratedStamina = Math.floor(minutesPassed / STAMINA_REGEN_RATE_MINUTES);
    return Math.min(MAX_STAMINA, (baseStamina || 0) + regeneratedStamina);
}

async function checkStaminaLevels() {
    // Ne rien faire si le bot n'est pas prêt
    if (!isBotReady()) {
        // console.log('[Scheduler] Bot not ready, skipping check.'); // Log verbeux
        return;
    }

    // console.log('[Scheduler] Running stamina check...'); // Log verbeux
    try {
        // Sélectionner les joueurs qui ont un ID Discord et ne sont pas déjà au max notifié (ou marqué comme non notifiable)
        const result = await db.query(
            `SELECT id, name, stamina, stamina_last_updated, discord_user_id, last_stamina_notification_level
             FROM players
             WHERE discord_user_id IS NOT NULL
               AND discord_user_id <> ''
               AND last_stamina_notification_level < $1`, // Ne pas re-vérifier ceux déjà notifiés pour 60
            [MAX_STAMINA]
        );

        if (result.rows.length === 0) {
            // console.log('[Scheduler] No players found needing stamina check.'); // Log verbeux
            return;
        }

        console.log(`[Scheduler] Checking stamina for ${result.rows.length} players.`);

        for (const player of result.rows) {
            const currentStamina = calculateCurrentStamina(player.stamina, player.stamina_last_updated);
            let newNotificationLevel = player.last_stamina_notification_level;
            let notificationSentSuccessfully = false; // Flag pour savoir si une notif a VRAIMENT été envoyée

            // Atteint 40 ?
            if (currentStamina >= 40 && player.last_stamina_notification_level < 40) {
                console.log(`[Scheduler] Player ${player.name} (ID: ${player.id}) reached 40 stamina (${currentStamina}). Attempting DM to ${player.discord_user_id}...`);
                const success = await sendDiscordDM(player.discord_user_id, `Hey ${player.name}, your stamina reached ${currentStamina}/${MAX_STAMINA}!`);
                if (success) {
                    newNotificationLevel = 40; // Marquer 40 comme atteint
                    notificationSentSuccessfully = true;
                }
                // Si !success, on ne met pas à jour le niveau, on réessaiera la prochaine fois
            }

            // Atteint 60 ? (Vérifier même si 40 vient d'être atteint/tenté)
            if (currentStamina >= MAX_STAMINA && player.last_stamina_notification_level < MAX_STAMINA) {
                console.log(`[Scheduler] Player ${player.name} (ID: ${player.id}) reached MAX (${MAX_STAMINA}) stamina. Attempting DM to ${player.discord_user_id}...`);
                const success = await sendDiscordDM(player.discord_user_id, `⚡️ ${player.name}, your stamina is FULL (${currentStamina}/${MAX_STAMINA})! ⚡️`);
                if (success) {
                    newNotificationLevel = MAX_STAMINA; // 60 a priorité sur 40 si atteint dans la même vérification
                    notificationSentSuccessfully = true;
                }
                // Si !success, on ne met pas à jour le niveau, on réessaiera la prochaine fois
            }

            // Mettre à jour le niveau notifié en BDD SI une notification a été envoyée avec succès ET le niveau a changé
            if (notificationSentSuccessfully && newNotificationLevel > player.last_stamina_notification_level) {
                console.log(`[Scheduler] Updating notification level for ${player.name} (ID: ${player.id}) to ${newNotificationLevel}`);
                try {
                    await db.query(
                        'UPDATE players SET last_stamina_notification_level = $1 WHERE id = $2',
                        [newNotificationLevel, player.id]
                    );
                } catch (updateErr) {
                    console.error(`[Scheduler] Failed to update notification level for player ${player.id}:`, updateErr);
                    // Que faire ici ? L'utilisateur pourrait être re-notifié la prochaine fois.
                }
            } else if (!notificationSentSuccessfully && newNotificationLevel > player.last_stamina_notification_level) {
                // Si on a déterminé qu'un nouveau niveau est atteint MAIS l'envoi a échoué
                console.log(`[Scheduler] Notification failed for ${player.name} (ID: ${player.id}) at level ${newNotificationLevel}. Will retry next cycle.`);
            }

            // La réinitialisation du niveau (si stamina < 40) est gérée dans la route /update-stamina
        }

    } catch (err) {
        console.error('[Scheduler] Error during stamina check task:', err);
    }
}

function startScheduler() {
    if (intervalId) {
        console.warn('[Scheduler] Scheduler already running.');
        return;
    }
    console.log(`[Scheduler] Starting stamina check interval (${CHECK_INTERVAL_MS / 1000} seconds)...`);
    // Exécuter immédiatement une fois (après un petit délai pour laisser le bot se connecter?), puis lancer l'intervalle
    setTimeout(() => {
        if (isBotReady()) { // Vérifier si le bot est prêt avant le premier check
            checkStaminaLevels();
        } else {
            console.warn('[Scheduler] Bot not ready for initial check, will wait for the first interval.');
        }
        // Lancer l'intervalle indépendamment du premier check
        intervalId = setInterval(checkStaminaLevels, CHECK_INTERVAL_MS);
    }, 5000); // Délai initial de 5 secondes

}

function stopScheduler() {
    if (intervalId) {
        console.log('[Scheduler] Stopping stamina check interval...');
        clearInterval(intervalId);
        intervalId = null;
    }
}

module.exports = {
    startScheduler,
    stopScheduler
};