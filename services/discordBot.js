// services/discordBot.js
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, Events, MessageFlags } = require('discord.js');
const db = require('./db');
require('dotenv').config();

let discordClient = null;
let isReady = false;

const PLANNER_CHANNEL_ID = process.env.PLANNER_CHANNEL_ID;

// --- SYSTÈME DE TRADUCTION (i18n) ---
const DEFAULT_LOCALE = 'en-US';
const LOCALES = {
    'fr': {
        panel_title: '📅 Team Planner',
        panel_desc: "Cliquez ci-dessous pour planifier une nouvelle activité.\nLes activités créées s'afficheront dans ce canal.",
        btn_new_activity: 'Nouvelle Activité',
        ask_activity_type: 'Quel type d\'activité voulez-vous créer ?',
        placeholder_activity_type: 'Choisissez le type d\'activité',
        modal_title_create: 'Créer : {type}',
        label_subtype: 'Détails (ex: Boss, Niveau...)',
        label_date: 'Date/Heure (JJ/MM/AAAA HH:mm)',
        label_notes: 'Notes (Optionnel)',
        error_date_format: '❌ Format de date invalide. Utilisez JJ/MM/AAAA HH:mm (ex: 25/12/2024 21:00)',
        error_db: '❌ Une erreur est survenue en base de données.',
        activity_created: '✅ Activité **{type}** créée pour le <t:{timestamp}:F> !',
        join_not_linked: '❌ Votre compte Discord n\'est pas lié. Veuillez utiliser le bouton "Rejoindre" pour rechercher et lier votre personnage.',
        activity_not_found: '❌ Activité introuvable (peut-être supprimée).',
        activity_full: '❌ L\'activité est complète !',
        left_activity: '✅ Vous avez quitté l\'activité.',
        only_creator_delete: '❌ Seul le créateur peut supprimer cette activité via Discord.',
        activity_deleted: '🗑️ Activité supprimée.',
        modal_title_search: 'Recherche ton personnage',
        label_search_name: 'Nom du personnage (partiel)',
        search_no_results: '❌ Aucun personnage trouvé avec ce nom.',
        placeholder_select_player: 'Sélectionnez votre personnage',
        joined_as: '✅ Vous avez rejoint l\'activité en tant que **{name}** !',
        reminder_text: '⏰ **RAPPEL** : {type} commence dans environ 5 minutes !',
        btn_join: 'Rejoindre',
        btn_leave: 'Quitter',
        footer_text: 'Go Go Muffin Planner',
        participants_list: '👥 **Participants ({current}/{max}) :**',
        no_participants: '*Aucun participant*',
        empty_slot: '🔲 *Place libre*'
    },
    'en-US': {
        panel_title: '📅 Team Planner',
        panel_desc: "Click below to plan a new activity.\nCreated activities will appear in this channel.",
        btn_new_activity: 'New Activity',
        ask_activity_type: 'What type of activity do you want to create?',
        placeholder_activity_type: 'Choose activity type',
        modal_title_create: 'Create: {type}',
        label_subtype: 'Details (e.g. Boss, Level...)',
        label_date: 'Date/Time (DD/MM/YYYY HH:mm)',
        label_notes: 'Notes (Optional)',
        error_date_format: '❌ Invalid date format. Use DD/MM/YYYY HH:mm (e.g. 25/12/2024 21:00)',
        error_db: '❌ A database error occurred.',
        activity_created: '✅ Activity **{type}** created for <t:{timestamp}:F>!',
        join_not_linked: '❌ Your Discord account is not linked. Please use the "Join" button to search and link your character.',
        activity_not_found: '❌ Activity not found (might be deleted).',
        activity_full: '❌ Activity is full!',
        left_activity: '✅ You left the activity.',
        only_creator_delete: '❌ Only the creator can delete this activity via Discord.',
        activity_deleted: '🗑️ Activity deleted.',
        modal_title_search: 'Search your character',
        label_search_name: 'Character Name (partial)',
        search_no_results: '❌ No character found with this name.',
        placeholder_select_player: 'Select your character',
        joined_as: '✅ You joined the activity as **{name}**!',
        reminder_text: '⏰ **REMINDER**: {type} starts in about 5 minutes!',
        btn_join: 'Join',
        btn_leave: 'Leave',
        footer_text: 'Go Go Muffin Planner',
        participants_list: '👥 **Participants ({current}/{max}):**',
        no_participants: '*No participants*',
        empty_slot: '🔲 *Empty Slot*'
    }
};

function t(locale, key, args = {}) {
    const lang = LOCALES[locale] ? locale : DEFAULT_LOCALE;
    let text = LOCALES[lang][key] || LOCALES[DEFAULT_LOCALE][key] || key;
    for (const [k, v] of Object.entries(args)) {
        text = text.replace(`{${k}}`, v);
    }
    return text;
}

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
            GatewayIntentBits.MessageContent
        ],
        partials: [Partials.Channel]
    });

    discordClient.once(Events.ClientReady, async () => {
        console.log(`✅ Discord Bot logged in as ${discordClient.user.tag}`);
        isReady = true;
        await deployPlannerPanel();
    });

    discordClient.on(Events.InteractionCreate, handleInteraction);

    discordClient.login(process.env.BOT_TOKEN).catch(err => {
        console.error('❌ Discord Login Failed:', err.message);
        isReady = false;
    });

    return discordClient;
}

// --- DÉPLOIEMENT DU PANNEAU PERMANENT ---
async function deployPlannerPanel() {
    if (!PLANNER_CHANNEL_ID) return;
    try {
        const channel = await discordClient.channels.fetch(PLANNER_CHANNEL_ID);
        if (!channel) return console.error("Planner channel not found.");

        const messages = await channel.messages.fetch({ limit: 10 });
        const existingPanel = messages.find(m => m.author.id === discordClient.user.id && m.embeds.length > 0 && (m.embeds[0].title === LOCALES['fr'].panel_title || m.embeds[0].title === LOCALES['en-US'].panel_title));

        if (!existingPanel) {
            const lang = 'en-US';
            const embed = new EmbedBuilder()
                .setColor('#8c5a3a')
                .setTitle(t(lang, 'panel_title'))
                .setDescription(t(lang, 'panel_desc'))
                .setFooter({ text: t(lang, 'footer_text') });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('btn_create_activity_start')
                        .setLabel(t(lang, 'btn_new_activity'))
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
            // Utilisation de flags ici aussi pour les erreurs inattendues
            await interaction.reply({ content: 'Error.', flags: MessageFlags.Ephemeral });
        }
    }
}

// --- 1. GESTION DES BOUTONS ---
async function handleButton(interaction) {
    const { customId, locale } = interaction;

    if (customId === 'btn_create_activity_start') {
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_activity_type')
                .setPlaceholder(t(locale, 'placeholder_activity_type'))
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Perilous Trial').setValue('Perilous Trial').setEmoji('⚔️'),
                    new StringSelectMenuOptionBuilder().setLabel('Wave of Horror').setValue('Wave of Horror').setEmoji('🌊'),
                    new StringSelectMenuOptionBuilder().setLabel('Echo of Battlefield').setValue('Echo of Battlefield').setEmoji('🛡️'),
                    new StringSelectMenuOptionBuilder().setLabel('Echo of War').setValue('Echo of War').setEmoji('🐲'),
                    new StringSelectMenuOptionBuilder().setLabel('Dragon Hunt').setValue('Dragon Hunt').setEmoji('🐉'),
                    new StringSelectMenuOptionBuilder().setLabel('Other').setValue('Other').setEmoji('📅')
                )
        );
        // Remplacement de ephemeral: true par flags: MessageFlags.Ephemeral
        await interaction.reply({ content: t(locale, 'ask_activity_type'), components: [row], flags: MessageFlags.Ephemeral });
    }
    else if (customId.startsWith('btn_join_')) {
        const activityId = customId.replace('btn_join_', '');
        const modal = new ModalBuilder()
            .setCustomId(`modal_join_search_${activityId}`)
            .setTitle(t(locale, 'modal_title_search'));

        const nameInput = new TextInputBuilder()
            .setCustomId('search_name')
            .setLabel(t(locale, 'label_search_name'))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
        await interaction.showModal(modal);
    }
    else if (customId.startsWith('btn_leave_')) {
        await handleLeave(interaction);
    }
    else if (customId.startsWith('btn_delete_')) {
        await handleDeleteActivity(interaction);
    }
}

// --- 2. GESTION DES MENUS DÉROULANTS ---
async function handleSelectMenu(interaction) {
    const { customId, locale, values } = interaction;

    if (customId === 'select_activity_type') {
        const activityType = values[0];
        const modal = new ModalBuilder()
            .setCustomId(`modal_create_activity_${activityType}`)
            .setTitle(t(locale, 'modal_title_create', { type: activityType }));

        const subtypeInput = new TextInputBuilder()
            .setCustomId('subtype')
            .setLabel(t(locale, 'label_subtype'))
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const dateInput = new TextInputBuilder()
            .setCustomId('datetime')
            .setLabel(t(locale, 'label_date'))
            .setPlaceholder("ex: 25/12/2024 21:00")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const notesInput = new TextInputBuilder()
            .setCustomId('notes')
            .setLabel(t(locale, 'label_notes'))
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(subtypeInput),
            new ActionRowBuilder().addComponents(dateInput),
            new ActionRowBuilder().addComponents(notesInput)
        );

        await interaction.showModal(modal);
    }
    else if (customId.startsWith('menu_join_player_')) {
        await interaction.deferUpdate();
        const activityId = customId.replace('menu_join_player_', '');
        const playerId = values[0];

        try {
            const actRes = await db.query('SELECT activity_type FROM planned_activities WHERE id = $1', [activityId]);
            if (actRes.rows.length === 0) return interaction.followUp({ content: t(locale, 'activity_not_found'), flags: MessageFlags.Ephemeral });
            const type = actRes.rows[0].activity_type;
            const max = (type === 'Echo of War' || type === 'Dragon Hunt') ? 6 : 4;
            const countRes = await db.query('SELECT COUNT(*) FROM activity_participants WHERE activity_id = $1', [activityId]);
            if (parseInt(countRes.rows[0].count) >= max) {
                return interaction.followUp({ content: t(locale, 'activity_full'), flags: MessageFlags.Ephemeral });
            }

            await db.query('UPDATE players SET discord_user_id = $1 WHERE id = $2', [interaction.user.id, playerId]);
            await db.query('INSERT INTO activity_participants (activity_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [activityId, playerId]);

            const playerRes = await db.query('SELECT name FROM players WHERE id = $1', [playerId]);
            const playerName = playerRes.rows[0]?.name || 'Unknown';

            await interaction.followUp({ content: t(locale, 'joined_as', { name: playerName }), flags: MessageFlags.Ephemeral });
            await updateActivityEmbed(activityId);

        } catch (err) {
            console.error("Error joining via menu:", err);
            await interaction.followUp({ content: t(locale, 'error_db'), flags: MessageFlags.Ephemeral });
        }
    }
}

// --- 3. GESTION DES MODALS ---
async function handleModalSubmit(interaction) {
    const { customId, locale, fields, user } = interaction;

    if (customId.startsWith('modal_create_activity_')) {
        // Remplacement ici aussi pour deferReply
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const activityType = customId.replace('modal_create_activity_', '');
        const subtype = fields.getTextInputValue('subtype');
        const datetimeStr = fields.getTextInputValue('datetime');
        const notes = fields.getTextInputValue('notes');

        const playerRes = await db.query('SELECT id, name FROM players WHERE discord_user_id = $1', [user.id]);
        if (playerRes.rows.length === 0) {
            return interaction.editReply({ content: t(locale, 'join_not_linked') });
        }
        const creator = playerRes.rows[0];

        const [datePart, timePart] = datetimeStr.split(' ');
        if (!datePart || !timePart) return interaction.editReply({ content: t(locale, 'error_date_format') });
        const [day, month, year] = datePart.split('/');
        const [hour, minute] = timePart.split(':');
        let scheduledTime = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);

        if (isNaN(scheduledTime.getTime())) {
            return interaction.editReply({ content: t(locale, 'error_date_format') });
        }

        try {
            const insertRes = await db.query(`
                INSERT INTO planned_activities (activity_type, activity_subtype, scheduled_time, creator_id, notes, discord_channel_id)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, scheduled_time
            `, [activityType, subtype, scheduledTime.toISOString(), creator.id, notes, interaction.channelId]);
            const activityId = insertRes.rows[0].id;
            const finalTimestamp = Math.floor(new Date(insertRes.rows[0].scheduled_time).getTime() / 1000);

            await db.query('INSERT INTO activity_participants (activity_id, player_id) VALUES ($1, $2)', [activityId, creator.id]);

            const { embed, row } = await createActivityEmbedData(activityId, locale);
            const message = await interaction.channel.send({ embeds: [embed], components: [row] });
            await db.query('UPDATE planned_activities SET discord_message_id = $1 WHERE id = $2', [message.id, activityId]);

            await interaction.editReply({ content: t(locale, 'activity_created', { type: activityType, timestamp: finalTimestamp }) });

        } catch (err) {
            console.error("Error creating activity:", err);
            await interaction.editReply({ content: t(locale, 'error_db') });
        }
    }
    else if (customId.startsWith('modal_join_search_')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const activityId = customId.replace('modal_join_search_', '');
        const searchName = fields.getTextInputValue('search_name').trim();

        try {
            const res = await db.query('SELECT id, name, class, combat_power FROM players WHERE name ILIKE $1 ORDER BY combat_power DESC LIMIT 25', [`%${searchName}%`]);

            if (res.rows.length === 0) {
                return interaction.editReply({ content: t(locale, 'search_no_results') });
            }

            const options = res.rows.map(p => {
                const classEmojis = { 'Swordbearer': '🛡️', 'Acolyte': '💖', 'Wayfarer': '🏹', 'Scholar': '✨', 'Shadowlash': '🗡️', 'Unknown': '❓' };
                return new StringSelectMenuOptionBuilder()
                    .setLabel(p.name)
                    .setDescription(`${p.class} - ${formatCP(p.combat_power)} CP`)
                    .setValue(p.id.toString())
                    .setEmoji(classEmojis[p.class] || '👤');
            });

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`menu_join_player_${activityId}`)
                    .setPlaceholder(t(locale, 'placeholder_select_player'))
                    .addOptions(options)
            );

            await interaction.editReply({ content: t(locale, 'placeholder_select_player') + ' :', components: [row] });

        } catch (err) {
            console.error("Error searching player:", err);
            await interaction.editReply({ content: t(locale, 'error_db') });
        }
    }
}

// --- 4. LEAVE & DELETE ---
async function handleLeave(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { customId, locale, user } = interaction;
    const activityId = customId.replace('btn_leave_', '');

    const playerRes = await db.query('SELECT id FROM players WHERE discord_user_id = $1', [user.id]);
    if (playerRes.rows.length === 0) {
        return interaction.editReply({ content: t(locale, 'join_not_linked') });
    }
    const playerId = playerRes.rows[0].id;

    try {
        await db.query('DELETE FROM activity_participants WHERE activity_id = $1 AND player_id = $2', [activityId, playerId]);
        await interaction.editReply({ content: t(locale, 'left_activity') });
        await updateActivityEmbed(activityId);
    } catch (err) {
        console.error("Error leaving:", err);
        await interaction.editReply({ content: t(locale, 'error_db') });
    }
}

async function handleDeleteActivity(interaction) {
    const { customId, locale, user } = interaction;
    const activityId = customId.replace('btn_delete_', '');

    const actRes = await db.query(`SELECT creator_id FROM planned_activities WHERE id = $1`, [activityId]);
    if (actRes.rows.length === 0) return interaction.reply({ content: t(locale, 'activity_not_found'), flags: MessageFlags.Ephemeral });

    const creatorRes = await db.query('SELECT discord_user_id FROM players WHERE id = $1', [actRes.rows[0].creator_id]);
    const creatorDiscordId = creatorRes.rows[0]?.discord_user_id;

    if (creatorDiscordId !== user.id) {
        return interaction.reply({ content: t(locale, 'only_creator_delete'), flags: MessageFlags.Ephemeral });
    }

    await interaction.deferUpdate();
    await db.query('DELETE FROM planned_activities WHERE id = $1', [activityId]);
    await interaction.message.delete().catch(() => {});
}

// --- HELPERS & EXPORTS ---
async function createActivityEmbedData(activityId, targetLocale = DEFAULT_LOCALE) {
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

    const colors = { 'Perilous Trial': 0xe57373, 'Wave of Horror': 0x81c784, 'Echo of Battlefield': 0x64b5f6, 'Dragon Hunt': 0xffb74d, 'Echo of War': 0x9575cd, 'Other': 0x9e9e9e };
    const classEmojis = { 'Swordbearer': '🛡️', 'Acolyte': '💖', 'Wayfarer': '🏹', 'Scholar': '✨', 'Shadowlash': '🗡️', 'Unknown': '❓' };

    let participantsText = participants.map(p => `${classEmojis[p.class] || '❓'} **${p.name}** (${formatCP(p.cp)})`).join('\n');
    if (participants.length === 0) participantsText = t(targetLocale, 'no_participants');
    for (let i = participants.length; i < maxPlayers; i++) participantsText += `\n${t(targetLocale, 'empty_slot')}`;

    const embed = new EmbedBuilder()
        .setColor(colors[act.activity_type] || 0xffffff)
        .setTitle(`${act.activity_type} ${act.activity_subtype ? `- ${act.activity_subtype}` : ''}`)
        .setDescription(`**📅 :** <t:${timestamp}:F> (<t:${timestamp}:R>)\n**👑 :** ${act.creator_name}\n\n${act.notes ? `📝 **Notes :**\n${act.notes}\n\n` : ''}${t(targetLocale, 'participants_list', {current: participants.length, max: maxPlayers})}\n${participantsText}`)
        .setFooter({ text: `ID: ${activityId} • ${t(targetLocale, 'footer_text')}` });

    const isFull = participants.length >= maxPlayers;
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`btn_join_${activityId}`).setLabel(t(targetLocale, 'btn_join')).setStyle(isFull ? ButtonStyle.Secondary : ButtonStyle.Primary).setDisabled(isFull),
        new ButtonBuilder().setCustomId(`btn_leave_${activityId}`).setLabel(t(targetLocale, 'btn_leave')).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`btn_delete_${activityId}`).setLabel('🗑️').setStyle(ButtonStyle.Secondary)
    );

    return { embed, row };
}

async function updateActivityEmbed(activityId) {
    if (!discordClient || !isReady) return;
    try {
        const res = await db.query('SELECT discord_channel_id, discord_message_id FROM planned_activities WHERE id = $1', [activityId]);
        if (res.rows.length === 0) return;
        const { discord_channel_id, discord_message_id } = res.rows[0];
        if (!discord_channel_id || !discord_message_id) return;

        const channel = await discordClient.channels.fetch(discord_channel_id);
        if (!channel) return;
        const message = await channel.messages.fetch(discord_message_id);
        if (!message) return;

        const data = await createActivityEmbedData(activityId, DEFAULT_LOCALE);
        if (data) await message.edit({ embeds: [data.embed], components: [data.row] });
        else await message.delete().catch(() => {});
    } catch (e) { console.error(`Failed to update Discord embed for activity ${activityId}:`, e.message); }
}

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
    } catch (e) { /* Ignorer si déjà supprimé */ }
}

async function sendActivityReminder(activity) {
    if (!discordClient || !isReady || !activity.discord_channel_id) return;
    try {
        const channel = await discordClient.channels.fetch(activity.discord_channel_id);
        if (!channel) return;

        const res = await db.query(`SELECT p.discord_user_id FROM activity_participants ap JOIN players p ON ap.player_id = p.id WHERE ap.activity_id = $1 AND p.discord_user_id IS NOT NULL`, [activity.id]);
        const mentions = res.rows.map(r => `<@${r.discord_user_id}>`).join(' ');

        if (mentions) {
            await channel.send(`${t(DEFAULT_LOCALE, 'reminder_text', { type: activity.activity_type })} ${mentions}`);
        }
    } catch (e) { console.error("Failed to send reminder:", e); }
}

function formatCP(num) {
    if (!num) return 'N/A';
    if (num >= 1000000) return (num / 1000000).toFixed(2).replace(/\.00$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
    return num.toString();
}
module.exports = {
    initDiscordBot,
    updateActivityEmbed,
    deleteActivityMessage,
    sendActivityReminder,
    sendDiscordDM: async (userId, message) => {
        if (!discordClient || !isReady) return false;
        try {
            const user = await discordClient.users.fetch(userId);
            await user.send(message);
            return true;
        } catch (e) { console.error("DM Error:", e.message); return false; }
    },
    getClient: () => discordClient,
    isBotReady: () => isReady
};