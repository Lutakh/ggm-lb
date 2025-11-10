// services/discordBot.js
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const db = require('./db');
require('dotenv').config();

let discordClient = null;
let isReady = false;

// ID du canal où le planner doit vivre (à mettre dans .env)
const PLANNER_CHANNEL_ID = process.env.PLANNER_CHANNEL_ID;

function initDiscordBot() {
    if (!process.env.BOT_TOKEN) {
        console.warn('⚠️ BOT_TOKEN missing. Discord features disabled.');
        return null;
    }
    if (discordClient) return discordClient;

    console.log('🤖 Initializing Discord Bot...');
    discordClient = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.MessageContent // Nécessaire parfois pour lire les commandes si pas en slash
        ],
        partials: [Partials.Channel] // Pour les DMs
    });

    discordClient.once('ready', async () => {
        console.log(`✅ Discord Bot logged in as ${discordClient.user.tag}`);
        isReady = true;
        await deployPlannerPanel(); // Déploie le panneau permanent au démarrage
    });

    discordClient.on('interactionCreate', handleInteraction);

    discordClient.login(process.env.BOT_TOKEN).catch(err => {
        console.error('❌ Discord Login Failed:', err.message);
        isReady = false;
    });

    return discordClient;
}

// --- DÉPLOIEMENT DU PANNEAU PERMANENT ---
async function deployPlannerPanel() {
    if (!PLANNER_CHANNEL_ID) {
        console.warn('⚠️ PLANNER_CHANNEL_ID not set in .env. Planner panel not deployed.');
        return;
    }
    try {
        const channel = await discordClient.channels.fetch(PLANNER_CHANNEL_ID);
        if (!channel) return console.error("Planner channel not found.");

        // Cherche si le panneau existe déjà (on pourrait stocker son ID, mais scanner les derniers messages marche aussi pour un canal dédié)
        const messages = await channel.messages.fetch({ limit: 10 });
        const existingPanel = messages.find(m => m.author.id === discordClient.user.id && m.embeds.length > 0 && m.embeds[0].title === "📅 Team Planner");

        if (!existingPanel) {
            const embed = new EmbedBuilder()
                .setColor('#8c5a3a')
                .setTitle('📅 Team Planner')
                .setDescription("Cliquez ci-dessous pour planifier une nouvelle activité.\nLes activités créées s'afficheront dans ce canal.")
                .setFooter({ text: 'Go Go Muffin Leaderboard' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('btn_create_activity_start')
                        .setLabel('New Activity')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('📅')
                );

            await channel.send({ embeds: [embed], components: [row] });
            console.log("✅ Planner panel deployed.");
        }
    } catch (e) {
        console.error("Error deploying planner panel:", e);
    }
}

// --- GESTION DES INTERACTIONS ---
async function handleInteraction(interaction) {
    try {
        if (interaction.isButton()) {
            await handleButton(interaction);
        } else if (interaction.isStringSelectMenu()) {
            await handleSelectMenu(interaction);
        } else if (interaction.isModalSubmit()) {
            await handleModalSubmit(interaction);
        }
    } catch (error) {
        console.error("Interaction Error:", error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Une erreur est survenue.', ephemeral: true });
        }
    }
}

// --- 1. GESTION DES BOUTONS ---
async function handleButton(interaction) {
    const { customId, user } = interaction;

    // >> BOUTON START CRÉATION
    if (customId === 'btn_create_activity_start') {
        // Étape 1 : Sélection du type via un menu déroulant (éphémère)
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_activity_type')
                .setPlaceholder('Choisissez le type d\'activité')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Perilous Trial').setValue('Perilous Trial').setEmoji('⚔️'),
                    new StringSelectMenuOptionBuilder().setLabel('Wave of Horror').setValue('Wave of Horror').setEmoji('🌊'),
                    new StringSelectMenuOptionBuilder().setLabel('Echo of Battlefield').setValue('Echo of Battlefield').setEmoji('🛡️'),
                    new StringSelectMenuOptionBuilder().setLabel('Echo of War').setValue('Echo of War').setEmoji('🐲'),
                    new StringSelectMenuOptionBuilder().setLabel('Dragon Hunt').setValue('Dragon Hunt').setEmoji('🐉'),
                    new StringSelectMenuOptionBuilder().setLabel('Other').setValue('Other').setEmoji('📅')
                )
        );
        await interaction.reply({ content: 'Quel type d\'activité voulez-vous créer ?', components: [row], ephemeral: true });
    }
    // >> BOUTON REJOINDRE
    else if (customId.startsWith('btn_join_')) {
        await handleJoinLeave(interaction, 'join');
    }
    // >> BOUTON QUITTER
    else if (customId.startsWith('btn_leave_')) {
        await handleJoinLeave(interaction, 'leave');
    }
    // >> BOUTON SUPPRIMER (Admin/Créateur)
    else if (customId.startsWith('btn_delete_')) {
        await handleDeleteActivity(interaction);
    }
}

// --- 2. GESTION DES MENUS DÉROULANTS ---
async function handleSelectMenu(interaction) {
    if (interaction.customId === 'select_activity_type') {
        const activityType = interaction.values[0];
        // Affiche la modale pour les détails
        const modal = new ModalBuilder()
            .setCustomId(`modal_create_activity_${activityType}`) // On passe le type dans l'ID
            .setTitle(`Créer : ${activityType}`);

        const subtypeInput = new TextInputBuilder()
            .setCustomId('subtype')
            .setLabel("Détails (ex: Boss, Niveau, Difficulté)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        // Pour la date, on demande un format spécifique pour essayer de parser correctement
        const dateInput = new TextInputBuilder()
            .setCustomId('datetime')
            .setLabel("Date et Heure (Format: JJ/MM/AAAA HH:mm)")
            .setPlaceholder("ex: 25/12/2024 21:00")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        // Nouveau champ pour le fuseau horaire relatif à UTC (simplifié)
        // Pour l'instant, on assume Paris (CET/CEST) si l'utilisateur ne précise pas,
        // ou on demande l'heure de Paris directement.
        // Simplification: on demandera l'heure de Paris (UTC+1/+2).

        const notesInput = new TextInputBuilder()
            .setCustomId('notes')
            .setLabel("Notes (Optionnel)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(subtypeInput),
            new ActionRowBuilder().addComponents(dateInput),
            new ActionRowBuilder().addComponents(notesInput)
        );

        await interaction.showModal(modal);
    }
}

// --- 3. GESTION DES MODALS (Soumission du formulaire) ---
async function handleModalSubmit(interaction) {
    if (interaction.customId.startsWith('modal_create_activity_')) {
        await interaction.deferReply({ ephemeral: true }); // On prend du temps pour traiter

        const activityType = interaction.customId.replace('modal_create_activity_', '');
        const subtype = interaction.fields.getTextInputValue('subtype');
        const datetimeStr = interaction.fields.getTextInputValue('datetime');
        const notes = interaction.fields.getTextInputValue('notes');

        // 1. Identifier le joueur Discord
        const discordId = interaction.user.id;
        const playerRes = await db.query('SELECT id, name FROM players WHERE discord_user_id = $1', [discordId]);
        if (playerRes.rows.length === 0) {
            return interaction.editReply({ content: '❌ Vous devez lier votre compte Discord à votre personnage sur le Web Planner avant de pouvoir créer une activité.' });
        }
        const creator = playerRes.rows[0];

        // 2. Parser la date (JJ/MM/AAAA HH:mm -> Objet Date)
        // On suppose que l'heure saisie est l'heure locale Française (Europe/Paris) pour simplifier l'UX des utilisateurs visés.
        const [datePart, timePart] = datetimeStr.split(' ');
        if (!datePart || !timePart) return interaction.editReply({ content: '❌ Format de date invalide. Utilisez JJ/MM/AAAA HH:mm' });
        const [day, month, year] = datePart.split('/');
        const [hour, minute] = timePart.split(':');

        // Création d'une date en UTC en compensant le fuseau horaire (approximatif si on ne gère pas l'été/hiver parfaitement ici,
        // mais JS peut aider si le serveur est sur le bon fuseau, sinon on force un offset).
        // Mieux : utiliser une lib comme dayjs ou luxon, mais essayons sans dépendance lourde si possible.
        // Astuce : créer une string ISO et laisser Postgres ou JS gérer si le serveur est bien configuré.
        // Pour être sûr, on va assumer que l'input est "Local Time" du serveur (souvent UTC ou CET).
        // Si votre serveur Node est en UTC, et que les utilisateurs sont en France (UTC+1/+2), il faut ajuster.

        // Supposons que l'input est en heure locale Française.
        // On peut utiliser le constructeur Date avec une string complète si le format est bon, mais DD/MM/YYYY n'est pas standard JS.
        const isoLikeString = `${year}-${month}-${day}T${hour}:${minute}:00`;
        // On crée un objet date qui sera interprété selon le fuseau du SERVEUR.
        let scheduledTime = new Date(isoLikeString);

        // VERIFICATION SIMPLE : si la date est invalide
        if (isNaN(scheduledTime.getTime())) {
            return interaction.editReply({ content: '❌ Date invalide. Vérifiez le format (JJ/MM/AAAA HH:mm).' });
        }

        // 3. Créer l'activité en BDD
        try {
            const insertRes = await db.query(`
                INSERT INTO planned_activities (activity_type, activity_subtype, scheduled_time, creator_id, notes, discord_channel_id)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, scheduled_time
            `, [activityType, subtype, scheduledTime.toISOString(), creator.id, notes, interaction.channelId]);
            const activityId = insertRes.rows[0].id;
            const finalScheduledTime = new Date(insertRes.rows[0].scheduled_time);

            // 4. Ajouter le créateur comme participant
            await db.query('INSERT INTO activity_participants (activity_id, player_id) VALUES ($1, $2)', [activityId, creator.id]);

            // 5. Créer l'Embed Discord
            const { embed, row } = await createActivityEmbedData(activityId);
            const message = await interaction.channel.send({ embeds: [embed], components: [row] });

            // 6. Sauvegarder l'ID du message pour mises à jour futures
            await db.query('UPDATE planned_activities SET discord_message_id = $1 WHERE id = $2', [message.id, activityId]);

            await interaction.editReply({ content: `✅ Activité **${activityType}** créée pour le <t:${Math.floor(finalScheduledTime.getTime() / 1000)}:F> !` });

        } catch (err) {
            console.error("Error creating activity from Discord:", err);
            await interaction.editReply({ content: '❌ Erreur lors de la création de l\'activité en base de données.' });
        }
    }
}

// --- 4. LOGIQUE JOIN / LEAVE ---
async function handleJoinLeave(interaction, action) {
    await interaction.deferUpdate(); // Ne pas envoyer de nouveau message, juste ack l'interaction
    const activityId = interaction.customId.split('_')[2];
    const discordId = interaction.user.id;

    // Trouver le joueur
    const playerRes = await db.query('SELECT id FROM players WHERE discord_user_id = $1', [discordId]);
    if (playerRes.rows.length === 0) {
        return interaction.followUp({ content: '❌ Vous devez lier votre compte Discord sur le Web Planner d\'abord.', ephemeral: true });
    }
    const playerId = playerRes.rows[0].id;

    try {
        if (action === 'join') {
            // Vérifier si plein
            const actRes = await db.query('SELECT activity_type FROM planned_activities WHERE id = $1', [activityId]);
            if (actRes.rows.length === 0) return interaction.followUp({ content: 'Activité introuvable.', ephemeral: true });
            const type = actRes.rows[0].activity_type;
            const max = (type === 'Echo of War' || type === 'Dragon Hunt') ? 6 : 4;
            const countRes = await db.query('SELECT COUNT(*) FROM activity_participants WHERE activity_id = $1', [activityId]);
            if (parseInt(countRes.rows[0].count) >= max) {
                return interaction.followUp({ content: '❌ L\'activité est complète !', ephemeral: true });
            }

            await db.query('INSERT INTO activity_participants (activity_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [activityId, playerId]);
        } else {
            await db.query('DELETE FROM activity_participants WHERE activity_id = $1 AND player_id = $2', [activityId, playerId]);
        }

        // Mettre à jour l'embed
        await updateActivityEmbed(activityId);

    } catch (err) {
        console.error(`Error during ${action} activity:`, err);
        interaction.followUp({ content: 'Une erreur est survenue.', ephemeral: true });
    }
}

// --- 5. SUPPRESSION (ADMIN) ---
async function handleDeleteActivity(interaction) {
    const activityId = interaction.customId.split('_')[2];
    const discordId = interaction.user.id;

    // Vérifier droits (Créateur ou Admin codé en dur pour l'instant, ou via rôle Discord si vous préférez)
    // Pour simplifier : seul le créateur peut supprimer via Discord pour l'instant, ou un admin Web.
    const actRes = await db.query(`
        SELECT pa.creator_id, p.discord_user_id as creator_discord_id
        FROM planned_activities pa
        LEFT JOIN players p ON pa.creator_id = p.id
        WHERE pa.id = $1
    `, [activityId]);

    if (actRes.rows.length === 0) return interaction.reply({ content: 'Activité déjà supprimée.', ephemeral: true });

    // TODO: Ajouter une vérification de rôle Admin Discord ici si souhaité
    if (actRes.rows[0].creator_discord_id !== discordId) {
        return interaction.reply({ content: '❌ Seul le créateur peut supprimer cette activité (ou un admin via le Web).', ephemeral: true });
    }

    await interaction.deferUpdate();
    await db.query('DELETE FROM planned_activities WHERE id = $1', [activityId]);
    await interaction.message.delete().catch(() => {}); // Supprime le message de l'activité
}


// --- HELPERS ---

// Génère les données de l'Embed et des Boutons pour une activité
async function createActivityEmbedData(activityId) {
    const res = await db.query(`
        SELECT pa.*, pc.name as creator_name,
               (SELECT json_agg(json_build_object('name', p.name, 'class', p.class, 'cp', p.combat_power))
                FROM activity_participants ap
                JOIN players p ON ap.player_id = p.id
                WHERE ap.activity_id = pa.id) as participants
        FROM planned_activities pa
        LEFT JOIN players pc ON pa.creator_id = pc.id
        WHERE pa.id = $1
    `, [activityId]);

    if (res.rows.length === 0) return null;
    const act = res.rows[0];
    const participants = act.participants || [];
    const maxPlayers = (act.activity_type === 'Echo of War' || act.activity_type === 'Dragon Hunt') ? 6 : 4;
    const timestamp = Math.floor(new Date(act.scheduled_time).getTime() / 1000);

    // Couleurs par type
    const colors = {
        'Perilous Trial': 0xe57373, // Rouge
        'Wave of Horror': 0x81c784, // Vert
        'Echo of Battlefield': 0x64b5f6, // Bleu
        'Dragon Hunt': 0xffb74d, // Orange
        'Echo of War': 0x9575cd, // Violet
        'Other': 0x9e9e9e // Gris
    };

    // Construction de la liste des participants avec classes
    const classEmojis = {
        'Swordbearer': '🛡️', 'Acolyte': '💖', 'Wayfarer': '🏹', 'Scholar': '✨', 'Shadowlash': '🗡️', 'Unknown': '❓'
    };
    let participantsText = participants.map(p => `${classEmojis[p.class] || '❓'} **${p.name}** (${formatCP(p.cp)})`).join('\n');
    if (participants.length === 0) participantsText = "*Aucun participant*";

    // Remplissage des slots vides
    for (let i = participants.length; i < maxPlayers; i++) {
        participantsText += `\n🔲 *Place libre*`;
    }

    const embed = new EmbedBuilder()
        .setColor(colors[act.activity_type] || 0xffffff)
        .setTitle(`${act.activity_type} ${act.activity_subtype ? `- ${act.activity_subtype}` : ''}`)
        .setDescription(`**Quand :** <t:${timestamp}:F> (<t:${timestamp}:R>)\n**Organisateur :** ${act.creator_name}\n\n${act.notes ? `📝 **Notes :**\n${act.notes}\n\n` : ''}👥 **Participants (${participants.length}/${maxPlayers}) :**\n${participantsText}`)
        .setFooter({ text: `ID: ${activityId} • Go Go Muffin Planner` });

    // Boutons
    const isFull = participants.length >= maxPlayers;
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`btn_join_${activityId}`)
            .setLabel('Rejoindre')
            .setStyle(isFull ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(isFull),
        new ButtonBuilder()
            .setCustomId(`btn_leave_${activityId}`)
            .setLabel('Quitter')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder() // Bouton discret pour le créateur pour supprimer
            .setCustomId(`btn_delete_${activityId}`)
            .setLabel('🗑️')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embed, row };
}

// Fonction publique pour mettre à jour un Embed existant (appelée par Web ou Discord interactions)
async function updateActivityEmbed(activityId) {
    if (!discordClient || !isReady) return;
    try {
        // Récupérer infos message
        const res = await db.query('SELECT discord_channel_id, discord_message_id FROM planned_activities WHERE id = $1', [activityId]);
        if (res.rows.length === 0) return; // Activité supprimée ?
        const { discord_channel_id, discord_message_id } = res.rows[0];
        if (!discord_channel_id || !discord_message_id) return; // Pas de message Discord lié

        const channel = await discordClient.channels.fetch(discord_channel_id);
        if (!channel) return;
        const message = await channel.messages.fetch(discord_message_id);
        if (!message) return;

        const data = await createActivityEmbedData(activityId);
        if (data) {
            await message.edit({ embeds: [data.embed], components: [data.row] });
        } else {
            // Si data est null, l'activité n'existe plus en DB, on supprime le message
            await message.delete().catch(() => {});
        }
    } catch (e) {
        console.error(`Failed to update Discord embed for activity ${activityId}:`, e.message);
    }
}

// Fonction pour supprimer un message quand supprimé depuis le Web
async function deleteActivityMessage(activityId) {
    if (!discordClient || !isReady) return;
    try {
        const res = await db.query('SELECT discord_channel_id, discord_message_id FROM planned_activities WHERE id = $1', [activityId]);
        if (res.rows.length > 0 && res.rows[0].discord_message_id) {
            const channel = await discordClient.channels.fetch(res.rows[0].discord_channel_id);
            if (channel) {
                const msg = await channel.messages.fetch(res.rows[0].discord_message_id);
                if (msg) await msg.delete();
            }
        }
    } catch (e) { /* Ignorer erreur si message déjà supprimé */ }
}

// Petite fonction utilitaire pour formater le CP dans l'embed (copiée du front)
function formatCP(num) {
    if (!num) return 'N/A';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
    return num.toString();
}

// --- EXPORTS ---
module.exports = {
    initDiscordBot,
    updateActivityEmbed, // À utiliser dans routes/teamPlanner.js
    deleteActivityMessage, // À utiliser dans routes/teamPlanner.js
    getClient: () => discordClient,
    isBotReady: () => isReady
};