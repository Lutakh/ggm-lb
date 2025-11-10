// services/scheduler.js
const db = require('./db');
// Assurez-vous que sendDiscordDM, isBotReady ET sendActivityReminder sont bien exportés depuis discordBot.js
const { sendDiscordDM, isBotReady, sendActivityReminder } = require('./discordBot');

const STAMINA_REGEN_RATE_MINUTES = 24;
const MAX_STAMINA = 60;
const STAMINA_CHECK_INTERVAL_MS = 60 * 1000; // Vérifier stamina toutes les minutes
const REMINDER_CHECK_INTERVAL_MS = 60 * 1000; // Vérifier rappels toutes les minutes

let staminaIntervalId = null;
let reminderIntervalId = null;

// --- FONCTIONS STAMINA ---

function calculateCurrentStamina(baseStamina, lastUpdatedISO) {
    if (!lastUpdatedISO) return baseStamina || 0;
    const lastUpdated = new Date(lastUpdatedISO);
    const now = new Date();
    if (isNaN(lastUpdated.getTime())) return baseStamina || 0;

    const minutesPassed = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60));

    if (minutesPassed < 0) {
        // Horloge légèrement désynchronisée ou changement d'heure, on retourne la valeur de base par sécurité
        return Math.min(MAX_STAMINA, baseStamina || 0);
    }

    const regeneratedStamina = Math.floor(minutesPassed / STAMINA_REGEN_RATE_MINUTES);
    return Math.min(MAX_STAMINA, (baseStamina || 0) + regeneratedStamina);
}

async function checkStaminaLevels() {
    if (!isBotReady()) return;

    try {
        // Sélectionner les joueurs avec ID Discord qui ne sont pas déjà au max notifié
        const result = await db.query(
            `SELECT id, name, stamina, stamina_last_updated, discord_user_id, last_stamina_notification_level
             FROM players
             WHERE discord_user_id IS NOT NULL
               AND discord_user_id <> ''
               AND last_stamina_notification_level < $1`,
            [MAX_STAMINA]
        );

        if (result.rows.length === 0) return;

        for (const player of result.rows) {
            const currentStamina = calculateCurrentStamina(player.stamina, player.stamina_last_updated);
            let newNotificationLevel = player.last_stamina_notification_level;
            let notificationSent = false;

            // Seuil 40
            if (currentStamina >= 40 && player.last_stamina_notification_level < 40) {
                const success = await sendDiscordDM(player.discord_user_id, `Hey ${player.name}, your stamina reached ${currentStamina}/${MAX_STAMINA}!`);
                if (success) {
                    newNotificationLevel = 40;
                    notificationSent = true;
                }
            }

            // Seuil Max (60) - Prioritaire si atteint en même temps que 40
            if (currentStamina >= MAX_STAMINA && player.last_stamina_notification_level < MAX_STAMINA) {
                const success = await sendDiscordDM(player.discord_user_id, `⚡️ ${player.name}, your stamina is FULL (${currentStamina}/${MAX_STAMINA})! ⚡️`);
                if (success) {
                    newNotificationLevel = MAX_STAMINA;
                    notificationSent = true;
                }
            }

            // Mise à jour BDD si notification envoyée
            if (notificationSent && newNotificationLevel > player.last_stamina_notification_level) {
                await db.query(
                    'UPDATE players SET last_stamina_notification_level = $1 WHERE id = $2',
                    [newNotificationLevel, player.id]
                );
            }
        }
    } catch (err) {
        console.error('[Scheduler] Error during stamina check:', err);
    }
}

// --- FONCTIONS RAPPELS ACTIVITÉS ---

async function checkActivityReminders() {
    // Si le bot n'est pas prêt, on ne peut pas envoyer de rappels
    if (!isBotReady()) return;

    try {
        // Chercher les activités qui commencent bientôt (entre 5 et 6 minutes à partir de maintenant)
        // et pour lesquelles aucun rappel n'a été envoyé.
        const now = new Date();
        const fiveMinFromNow = new Date(now.getTime() + 5 * 60000);
        const sixMinFromNow = new Date(now.getTime() + 6 * 60000);

        const res = await db.query(`
            SELECT * FROM planned_activities
            WHERE scheduled_time > $1 AND scheduled_time <= $2
              AND reminder_sent = FALSE
              AND discord_channel_id IS NOT NULL
        `, [fiveMinFromNow.toISOString(), sixMinFromNow.toISOString()]);

        if (res.rows.length > 0) {
            console.log(`[Scheduler] Found ${res.rows.length} activities to remind.`);
            for (const activity of res.rows) {
                await sendActivityReminder(activity);
                // Marquer comme rappelé pour éviter les doublons si le scheduler redémarre
                await db.query('UPDATE planned_activities SET reminder_sent = TRUE WHERE id = $1', [activity.id]);
            }
        }
    } catch (err) {
        console.error('[Scheduler] Error checking activity reminders:', err);
    }
}

// --- GESTION DU SCHEDULER ---

function startScheduler() {
    if (staminaIntervalId || reminderIntervalId) {
        console.warn('[Scheduler] Scheduler already running.');
        return;
    }

    console.log('⏰ Scheduler started.');

    // Démarrage initial différé pour laisser le temps au bot de se connecter
    setTimeout(() => {
        // Lancement des premières vérifications
        checkStaminaLevels();
        checkActivityReminders();

        // Mise en place des intervalles
        staminaIntervalId = setInterval(checkStaminaLevels, STAMINA_CHECK_INTERVAL_MS);
        reminderIntervalId = setInterval(checkActivityReminders, REMINDER_CHECK_INTERVAL_MS);
    }, 5000);
}

function stopScheduler() {
    if (staminaIntervalId) clearInterval(staminaIntervalId);
    if (reminderIntervalId) clearInterval(reminderIntervalId);
    staminaIntervalId = null;
    reminderIntervalId = null;
    console.log('⏰ Scheduler stopped.');
}

module.exports = {
    startScheduler,
    stopScheduler
};