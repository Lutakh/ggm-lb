// services/discordBot.js
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config(); // Charger les variables d'environnement

let discordClient = null;
let isReady = false;

function initDiscordBot() {
    if (!process.env.BOT_TOKEN) {
        console.warn('⚠️ BOT_TOKEN not found in environment variables. Discord notifications will be disabled.');
        return null;
    }

    if (discordClient) {
        console.log('🤖 Discord Bot already initialized.');
        return discordClient;
    }

    console.log('🤖 Initializing Discord Bot...');
    // Intents minimalistes pour envoyer des MPs. Guilds peut être utile pour le cache initial.
    discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages] }); // Ajout DirectMessages pour plus de clarté

    discordClient.once('ready', () => {
        console.log(`✅ Discord Bot logged in as ${discordClient.user.tag}`);
        isReady = true;
    });

    discordClient.on('error', (error) => {
        console.error('❌ Discord Bot Error:', error);
        isReady = false; // Marquer comme non prêt en cas d'erreur
    });

    discordClient.on('warn', (warning) => {
        console.warn('⚠️ Discord Bot Warning:', warning);
    });

    discordClient.login(process.env.BOT_TOKEN)
        .catch(err => {
            console.error('❌ Discord Bot Login Failed:', err.message); // Log l'erreur spécifique
            discordClient = null; // Réinitialiser si le login échoue
            isReady = false;
        });

    return discordClient;
}

async function sendDiscordDM(userId, message) {
    if (!discordClient || !isReady) {
        // console.warn('Discord Bot not ready or not initialized, cannot send DM.');
        return false;
    }
    if (!userId || typeof userId !== 'string' || !/^\d+$/.test(userId)) { // Vérifier que l'ID est une chaîne de chiffres
        console.warn(`Attempted to send DM with invalid userId: ${userId}`);
        return false;
    }

    try {
        // Tenter de récupérer l'utilisateur depuis le cache ou l'API
        const user = await discordClient.users.fetch(userId, { cache: true, force: false }); // force: false pour éviter erreur si non trouvé immédiatement
        if (user) {
            await user.send(message);
            console.log(`✉️ Sent DM to user ${user.tag} (ID: ${userId})`);
            return true;
        } else {
            // Ne pas logger comme avertissement si l'utilisateur n'est simplement pas joignable par le bot (cache)
            // console.log(`Could not resolve Discord user with ID: ${userId} from cache. Fetch might be needed.`);
            // Tentative de fetch forcée (peut échouer si le bot ne partage aucun serveur)
            try {
                const forcedUser = await discordClient.users.fetch(userId, { force: true });
                await forcedUser.send(message);
                console.log(`✉️ Sent DM to user ${forcedUser.tag} (ID: ${userId}) after forced fetch.`);
                return true;
            } catch (fetchError) {
                console.warn(`Could not find or fetch Discord user with ID: ${userId}. Maybe bot doesn't share a server?`);
                return false;
            }
        }
    } catch (error) {
        console.error(`❌ Failed to send DM to user ID ${userId}:`, error.message);
        // Gérer les erreurs spécifiques comme les MPs désactivés
        if (error.code === 50007) { // Cannot send messages to this user
            console.warn(`   -> User ${userId} might have DMs disabled or blocked the bot.`);
            // Ici, on pourrait mettre à jour la BDD pour ne plus notifier cet utilisateur
            // await db.query('UPDATE players SET last_stamina_notification_level = $1 WHERE discord_user_id = $2', [MAX_STAMINA + 1, userId]); // Marquer comme "ne pas notifier"
        }
        return false;
    }
}

module.exports = {
    initDiscordBot,
    sendDiscordDM,
    getClient: () => discordClient, // Exporter pour accès potentiel
    isBotReady: () => isReady // Fonction pour vérifier l'état
};