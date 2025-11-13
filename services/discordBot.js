// services/discordBot.js
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, Events, MessageFlags } = require('discord.js');
const db = require('./db');
require('dotenv').config();

let discordClient = null;
let isReady = false;

const PLANNER_CHANNEL_ID = process.env.PLANNER_CHANNEL_ID;

// --- Timezone List ---
const COMMON_TIMEZONES = [
    { label: "(GMT-07:00) Los Angeles (PT)", value: "America/Los_Angeles" },
    { label: "(GMT-06:00) Chicago (CT)", value: "America/Chicago" },
    { label: "(GMT-05:00) New York (ET)", value: "America/New_York" },
    { label: "(GMT-03:00) São Paulo", value: "America/Sao_Paulo" },
    { label: "(GMT+00:00) London (GMT/BST)", value: "Europe/London" },
    { label: "(GMT+01:00) Paris (CET/CEST)", value: "Europe/Paris" },
    { label: "(GMT+03:00) Moscow", value: "Europe/Moscow" },
    { label: "(GMT+07:00) Bangkok", value: "Asia/Bangkok" },
    { label: "(GMT+08:00) Singapore/Perth", value: "Asia/Singapore" },
    { label: "(GMT+09:00) Tokyo", value: "Asia/Tokyo" },
    { label: "(GMT+10:00) Sydney (AEST/AEDT)", value: "Australia/Sydney" },
    { label: "(GMT+12:00) Auckland", value: "Pacific/Auckland" },
    { label: "(GMT+00:00) UTC", value: "UTC" }
];


// --- SYSTÈME DE TRADUCTION (i18n) - Anglais Uniquement ---
const DEFAULT_LOCALE = 'en-US';
const LOCALES = {
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
        error_date_format: '❌ Invalid date format. Use DD/MM/YYYY HH:mm (e.g. 25/12/2024 15:00)',
        placeholder_date: 'ex: 25/12/2024 15:00 (Your Local Time)',

        ask_timezone: 'Please select your primary timezone to continue. This is a one-time setup for your character.',
        placeholder_select_timezone: 'Select your timezone',
        timezone_set: '✅ Timezone set to **{timezone}**! You can now continue.',

        ask_creator_character: 'Which character is organizing this activity?',
        placeholder_select_creator: 'Select your organizer character',

        activity_created_thread: '✅ Activity **{type}** created in <#{threadId}>!',

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

function t(key, args = {}) {
    let text = LOCALES[DEFAULT_LOCALE][key] || key;
    for (const [k, v] of Object.entries(args)) {
        text = text.replace(`{${k}}`, v);
    }
    return text;
}

function getOffsetString(date, timezone) {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            timeZoneName: 'longOffset',
        });
        const parts = formatter.formatToParts(date);
        const offsetPart = parts.find(p => p.type === 'timeZoneName');

        if (!offsetPart) return '+00:00';

        let offset = offsetPart.value.replace('GMT', '');

        if (!offset.includes(':')) {
            const sign = offset[0];
            const hours = offset.substring(1);
            offset = `${sign}${hours.padStart(2, '0')}:00`;
        } else if (offset.split(':')[0].length < 3) {
            const sign = offset[0];
            const parts = offset.substring(1).split(':');
            offset = `${sign}${parts[0].padStart(2, '0')}:${parts[1]}`;
        }

        return offset;

    } catch (e) {
        console.error(`Error getting offset for timezone ${timezone}:`, e);
        return '+00:00';
    }
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
// *** MODIFIÉ POUR SUPPRIMER L'ANCIEN PANNEAU ET REPOSTER ***
async function deployPlannerPanel() {
    if (!PLANNER_CHANNEL_ID) return;
    try {
        const channel = await discordClient.channels.fetch(PLANNER_CHANNEL_ID);
        if (!channel) return console.error("Planner channel not found.");

        const messages = await channel.messages.fetch({ limit: 50 });

        // Trouver TOUS les anciens panneaux
        const existingPanels = messages.filter(m =>
            m.author.id === discordClient.user.id &&
            m.embeds.length > 0 &&
            m.embeds[0].title === t('panel_title')
        );

        // Supprimer tous les anciens panneaux
        if (existingPanels.size > 0) {
            console.log(`[Deploy] Found ${existingPanels.size} old panel(s). Deleting...`);
            await Promise.all(existingPanels.map(panel => panel.delete().catch(e => console.warn(`Warn: Could not delete old panel: ${e.message}`))));
        }

        // Poster le nouveau panneau
        const embed = new EmbedBuilder()
            .setColor('#8c5a3a')
            .setTitle(t('panel_title'))
            .setDescription(t('panel_desc'))
            .setFooter({ text: t('footer_text') });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_create_activity_start')
                    .setLabel(t('btn_new_activity'))
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('📅')
            );

        await channel.send({ embeds: [embed], components: [row] });
        console.log("✅ New planner panel successfully deployed.");

    } catch (e) {
        console.error("Error deploying planner panel:", e);
    }
}
// *** FIN DE LA MODIFICATION ***

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

        if (error.code === 10062 || error.code === 40060) {
            console.warn(`[Warn] Interaction ${interaction.id} (customId: ${interaction.customId}) was unknown or already acknowledged. Likely due to bot restart.`);
            return;
        }

        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'An error occurred.', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.followUp({ content: 'An error occurred after acknowledging.', flags: MessageFlags.Ephemeral });
            }
        } catch (replyError) {
            console.error("[Critical] Failed to send error reply to interaction:", replyError);
        }
    }
}

// --- 1. GESTION DES BOUTONS ---
async function handleButton(interaction) {
    const { customId } = interaction;

    if (customId === 'btn_create_activity_start') {
        const playerRes = await db.query('SELECT id, name, class, timezone FROM players WHERE discord_user_id = $1 ORDER BY combat_power DESC', [interaction.user.id]);

        if (playerRes.rows.length === 0) {
            return interaction.reply({ content: t('join_not_linked'), flags: MessageFlags.Ephemeral });
        }

        if (playerRes.rows.length === 1) {
            const creator = playerRes.rows[0];

            if (!creator.timezone) {
                const options = COMMON_TIMEZONES.map(tz =>
                    new StringSelectMenuOptionBuilder().setLabel(tz.label).setValue(tz.value)
                );
                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`select_timezone_for_creator|${creator.id}`)
                        .setPlaceholder(t('placeholder_select_timezone'))
                        .addOptions(options)
                );
                return interaction.reply({ content: t('ask_timezone'), components: [row], flags: MessageFlags.Ephemeral });
            }

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`select_activity_type_creator|${creator.id}`)
                    .setPlaceholder(t('placeholder_activity_type'))
                    .addOptions(
                        new StringSelectMenuOptionBuilder().setLabel('Perilous Trial').setValue('Perilous Trial').setEmoji('⚔️'),
                        new StringSelectMenuOptionBuilder().setLabel('Wave of Horror').setValue('Wave of Horror').setEmoji('🌊'),
                        new StringSelectMenuOptionBuilder().setLabel('Echo of Battlefield').setValue('Echo of Battlefield').setEmoji('🛡️'),
                        new StringSelectMenuOptionBuilder().setLabel('Echo of War').setValue('Echo of War').setEmoji('🐲'),
                        new StringSelectMenuOptionBuilder().setLabel('Dragon Hunt').setValue('Dragon Hunt').setEmoji('🐉'),
                        new StringSelectMenuOptionBuilder().setLabel('Other').setValue('Other').setEmoji('📅')
                    )
            );
            return interaction.reply({ content: t('ask_activity_type'), components: [row], flags: MessageFlags.Ephemeral });
        }

        const classEmojis = { 'Swordbearer': '🛡️', 'Acolyte': '💖', 'Wayfarer': '🏹', 'Scholar': '✨', 'Shadowlash': '🗡️', 'Unknown': '❓' };
        const options = playerRes.rows.map(p =>
            new StringSelectMenuOptionBuilder()
                .setLabel(p.name)
                .setDescription(p.class || 'Unknown')
                .setValue(p.id.toString())
                .setEmoji(classEmojis[p.class] || '👤')
        );

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_creator_character_for_activity')
                .setPlaceholder(t('placeholder_select_creator'))
                .addOptions(options)
        );

        return interaction.reply({ content: t('ask_creator_character'), components: [row], flags: MessageFlags.Ephemeral });
    }

    else if (customId.startsWith('btn_join_')) {
        const activityId = customId.replace('btn_join_', '');
        const modal = new ModalBuilder()
            .setCustomId(`modal_join_search|${activityId}`)
            .setTitle(t('modal_title_search'));

        const nameInput = new TextInputBuilder()
            .setCustomId('search_name')
            .setLabel(t('label_search_name'))
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
    const { customId, values } = interaction;

    // Étape 2: L'utilisateur a choisi son personnage organisateur
    if (customId === 'select_creator_character_for_activity') {
        const creatorId = values[0];
        const playerRes = await db.query('SELECT timezone FROM players WHERE id = $1', [creatorId]);
        const playerTimezone = playerRes.rows[0]?.timezone;

        if (!playerTimezone) {
            const options = COMMON_TIMEZONES.map(tz =>
                new StringSelectMenuOptionBuilder().setLabel(tz.label).setValue(tz.value)
            );
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`select_timezone_for_creator|${creatorId}`) // Utilisation de |
                    .setPlaceholder(t('placeholder_select_timezone'))
                    .addOptions(options)
            );
            return interaction.update({ content: t('ask_timezone'), components: [row] });
        }

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`select_activity_type_creator|${creatorId}`) // Utilisation de |
                .setPlaceholder(t('placeholder_activity_type'))
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Perilous Trial').setValue('Perilous Trial').setEmoji('⚔️'),
                    new StringSelectMenuOptionBuilder().setLabel('Wave of Horror').setValue('Wave of Horror').setEmoji('🌊'),
                    new StringSelectMenuOptionBuilder().setLabel('Echo of Battlefield').setValue('Echo of Battlefield').setEmoji('🛡️'),
                    new StringSelectMenuOptionBuilder().setLabel('Echo of War').setValue('Echo of War').setEmoji('🐲'),
                    new StringSelectMenuOptionBuilder().setLabel('Dragon Hunt').setValue('Dragon Hunt').setEmoji('🐉'),
                    new StringSelectMenuOptionBuilder().setLabel('Other').setValue('Other').setEmoji('📅')
                )
        );
        return interaction.update({ content: t('ask_activity_type'), components: [row] });
    }

    // L'utilisateur vient de choisir sa timezone
    if (customId.startsWith('select_timezone_for_creator|')) {
        const selectedTimezone = values[0];
        const creatorIdForTimezone = customId.split('|')[1];

        await db.query('UPDATE players SET timezone = $1 WHERE id = $2', [selectedTimezone, creatorIdForTimezone]);

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`select_activity_type_creator|${creatorIdForTimezone}`) // Utilisation de |
                .setPlaceholder(t('placeholder_activity_type'))
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Perilous Trial').setValue('Perilous Trial').setEmoji('⚔️'),
                    new StringSelectMenuOptionBuilder().setLabel('Wave of Horror').setValue('Wave of Horror').setEmoji('🌊'),
                    new StringSelectMenuOptionBuilder().setLabel('Echo of Battlefield').setValue('Echo of Battlefield').setEmoji('🛡️'),
                    new StringSelectMenuOptionBuilder().setLabel('Echo of War').setValue('Echo of War').setEmoji('🐲'),
                    new StringSelectMenuOptionBuilder().setLabel('Dragon Hunt').setValue('Dragon Hunt').setEmoji('🐉'),
                    new StringSelectMenuOptionBuilder().setLabel('Other').setValue('Other').setEmoji('📅')
                )
        );

        return interaction.update({
            content: `${t('timezone_set', {timezone: selectedTimezone})}\n\n${t('ask_activity_type')}`,
            components: [row]
        });
    }

    // Étape 3: L'utilisateur a choisi le type d'activité
    if (customId.startsWith('select_activity_type_creator|')) {
        const activityType = values[0];
        const creatorIdFromActivity = customId.split('|')[1];

        const modal = new ModalBuilder()
            .setCustomId(`modal_create_activity|${creatorIdFromActivity}|${activityType}`) // Utilisation de |
            .setTitle(t('modal_title_create', { type: activityType }));

        const subtypeInput = new TextInputBuilder()
            .setCustomId('subtype')
            .setLabel(t('label_subtype'))
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const dateInput = new TextInputBuilder()
            .setCustomId('datetime')
            .setLabel(t('label_date'))
            .setPlaceholder(t('placeholder_date'))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const notesInput = new TextInputBuilder()
            .setCustomId('notes')
            .setLabel(t('label_notes'))
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(subtypeInput),
            new ActionRowBuilder().addComponents(dateInput),
            new ActionRowBuilder().addComponents(notesInput)
        );

        await interaction.showModal(modal);
    }

    // Logique pour REJOINDRE
    else if (customId.startsWith('menu_join_player_')) {
        const playerId = values[0];
        await interaction.deferUpdate();
        const activityId = customId.replace('menu_join_player_', '');

        try {
            const actRes = await db.query('SELECT activity_type FROM planned_activities WHERE id = $1', [activityId]);
            if (actRes.rows.length === 0) return interaction.followUp({ content: t('activity_not_found'), flags: MessageFlags.Ephemeral });
            const type = actRes.rows[0].activity_type;
            const max = (type === 'Echo of War' || type === 'Dragon Hunt') ? 6 : 4;
            const countRes = await db.query('SELECT COUNT(*) FROM activity_participants WHERE activity_id = $1', [activityId]);
            if (parseInt(countRes.rows[0].count) >= max) {
                return interaction.followUp({ content: t('activity_full'), flags: MessageFlags.Ephemeral });
            }

            await db.query('UPDATE players SET discord_user_id = $1 WHERE id = $2', [interaction.user.id, playerId]);
            await db.query('INSERT INTO activity_participants (activity_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [activityId, playerId]);

            const playerRes = await db.query('SELECT name FROM players WHERE id = $1', [playerId]);
            const playerName = playerRes.rows[0]?.name || 'Unknown';

            await interaction.followUp({ content: t('joined_as', { name: playerName }), flags: MessageFlags.Ephemeral });
            await updateActivityEmbed(activityId);

        } catch (err) {
            console.error("Error joining via menu:", err);
            await interaction.followUp({ content: t('error_db'), flags: MessageFlags.Ephemeral });
        }
    }
}


// --- 3. GESTION DES MODALS ---
async function handleModalSubmit(interaction) {
    const { customId, fields } = interaction;

    // Étape 4: L'utilisateur soumet le modal de création
    if (customId.startsWith('modal_create_activity|')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const parts = customId.replace('modal_create_activity|', '').split('|');
        const creatorId = parts[0];
        const activityType = parts[1];

        const subtype = fields.getTextInputValue('subtype');
        const datetimeStr = fields.getTextInputValue('datetime');
        const notes = fields.getTextInputValue('notes');

        const [datePart, timePart] = datetimeStr.split(' ');
        if (!datePart || !timePart) return interaction.editReply({ content: t('error_date_format') });
        const [day, month, year] = datePart.split('/');
        const [hour, minute] = timePart.split(':');

        if (!day || !month || !year || !hour || !minute) {
            return interaction.editReply({ content: t('error_date_format') });
        }

        const playerRes = await db.query('SELECT timezone FROM players WHERE id = $1', [creatorId]);
        const playerTimezone = playerRes.rows[0]?.timezone;
        if (!playerTimezone) {
            return interaction.editReply({ content: 'Error: Timezone not found for creator. Please try again.' });
        }

        let scheduledTime;
        try {
            const tempDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute)));
            if (isNaN(tempDate.getTime())) throw new Error('Invalid date components');

            const offsetString = getOffsetString(tempDate, playerTimezone);
            const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00${offsetString}`;
            scheduledTime = new Date(isoString);
            if (isNaN(scheduledTime.getTime())) throw new Error('Invalid ISO string conversion');

        } catch(e) {
            console.error("Date parsing error:", e);
            return interaction.editReply({ content: t('error_date_format') });
        }

        try {
            const creatorNameRes = await db.query('SELECT name FROM players WHERE id = $1', [creatorId]);
            const creatorName = creatorNameRes.rows[0]?.name || 'Unknown';
            const dateString = `${day.padStart(2, '0')}/${month.padStart(2, '0')}`;
            const threadName = `${activityType} ${subtype || ''} - ${dateString} (${creatorName})`.substring(0, 100);

            const thread = await interaction.channel.threads.create({
                name: threadName,
                autoArchiveDuration: 1440,
                reason: `Activity created by ${creatorName}`
            });

            const insertRes = await db.query(`
                INSERT INTO planned_activities (activity_type, activity_subtype, scheduled_time, creator_id, notes, discord_channel_id)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, scheduled_time
            `, [activityType, subtype, scheduledTime.toISOString(), creatorId, notes, thread.id]);

            const activityId = insertRes.rows[0].id;
            const finalTimestamp = Math.floor(new Date(insertRes.rows[0].scheduled_time).getTime() / 1000);

            await db.query('INSERT INTO activity_participants (activity_id, player_id) VALUES ($1, $2)', [activityId, creatorId]);

            const { embed, row } = await createActivityEmbedData(activityId);
            const message = await thread.send({ embeds: [embed], components: [row] });

            await db.query('UPDATE planned_activities SET discord_message_id = $1 WHERE id = $2', [message.id, activityId]);

            await interaction.editReply({
                content: t('activity_created_thread', { type: activityType, threadId: thread.id })
            });

        } catch (err) {
            console.error("Error creating activity:", err);
            await interaction.editReply({ content: t('error_db') });
        }
    }

    else if (customId.startsWith('modal_join_search|')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const activityId = customId.split('|')[1];
        const searchName = fields.getTextInputValue('search_name').trim();

        try {
            const res = await db.query('SELECT id, name, class, combat_power FROM players WHERE name ILIKE $1 ORDER BY combat_power DESC LIMIT 25', [`%${searchName}%`]);

            if (res.rows.length === 0) {
                return interaction.editReply({ content: t('search_no_results') });
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
                    .setPlaceholder(t('placeholder_select_player'))
                    .addOptions(options)
            );

            await interaction.editReply({ content: t('placeholder_select_player') + ' :', components: [row] });

        } catch (err) {
            console.error("Error searching player:", err);
            await interaction.editReply({ content: t('error_db') });
        }
    }
}

// --- 4. LEAVE & DELETE ---
async function handleLeave(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { customId, user } = interaction;
    const activityId = customId.replace('btn_leave_', '');

    const playerRes = await db.query('SELECT id FROM players WHERE discord_user_id = $1', [user.id]);
    if (playerRes.rows.length === 0) {
        return interaction.editReply({ content: t('join_not_linked') });
    }
    const playerId = playerRes.rows[0].id;

    try {
        await db.query('DELETE FROM activity_participants WHERE activity_id = $1 AND player_id = $2', [activityId, playerId]);
        await interaction.editReply({ content: t('left_activity') });
        await updateActivityEmbed(activityId);
    } catch (err) {
        console.error("Error leaving:", err);
        await interaction.editReply({ content: t('error_db') });
    }
}

async function handleDeleteActivity(interaction) {
    const { customId, user } = interaction;
    const activityId = customId.replace('btn_delete_', '');

    const actRes = await db.query(`SELECT creator_id FROM planned_activities WHERE id = $1`, [activityId]);
    if (actRes.rows.length === 0) return interaction.reply({ content: t('activity_not_found'), flags: MessageFlags.Ephemeral });

    const creatorRes = await db.query('SELECT discord_user_id FROM players WHERE id = $1', [actRes.rows[0].creator_id]);
    const creatorDiscordId = creatorRes.rows[0]?.discord_user_id;

    if (creatorDiscordId !== user.id) {
        return interaction.reply({ content: t('only_creator_delete'), flags: MessageFlags.Ephemeral });
    }

    await interaction.deferUpdate();

    const threadChannel = interaction.channel;

    await db.query('DELETE FROM planned_activities WHERE id = $1', [activityId]);

    await interaction.message.delete().catch((e) => console.warn(`Warn: Could not delete message: ${e.message}`));

    if (threadChannel && threadChannel.isThread()) {
        await threadChannel.delete('Activity deleted by creator').catch((e) => console.warn(`Warn: Could not delete thread: ${e.message}`));
    }
}

// --- HELPERS & EXPORTS ---
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

    const colors = { 'Perilous Trial': 0xe57373, 'Wave of Horror': 0x81c784, 'Echo of Battlefield': 0x64b5f6, 'Dragon Hunt': 0xffb74d, 'Echo of War': 0x9575cd, 'Other': 0x9e9e9e };
    const classEmojis = { 'Swordbearer': '🛡️', 'Acolyte': '💖', 'Wayfarer': '🏹', 'Scholar': '✨', 'Shadowlash': '🗡️', 'Unknown': '❓' };

    let participantsText = participants.map(p => `${classEmojis[p.class] || '❓'} **${p.name}** (${formatCP(p.cp)})`).join('\n');
    if (participants.length === 0) participantsText = t('no_participants');
    for (let i = participants.length; i < maxPlayers; i++) participantsText += `\n${t('empty_slot')}`;

    const embed = new EmbedBuilder()
        .setColor(colors[act.activity_type] || 0xffffff)
        .setTitle(`${act.activity_type} ${act.activity_subtype ? `- ${act.activity_subtype}` : ''}`)
        .setDescription(`**📅 :** <t:${timestamp}:F> (<t:${timestamp}:R>)\n**👑 :** ${act.creator_name}\n\n${act.notes ? `📝 **Notes :**\n${act.notes}\n\n` : ''}${t('participants_list', {current: participants.length, max: maxPlayers})}\n${participantsText}`)
        .setFooter({ text: `ID: ${activityId} • ${t('footer_text')}` });

    const isFull = participants.length >= maxPlayers;
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`btn_join_${activityId}`).setLabel(t('btn_join')).setStyle(isFull ? ButtonStyle.Secondary : ButtonStyle.Primary).setDisabled(isFull),
        new ButtonBuilder().setCustomId(`btn_leave_${activityId}`).setLabel(t('btn_leave')).setStyle(ButtonStyle.Danger),
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

        const data = await createActivityEmbedData(activityId);
        if (data) await message.edit({ embeds: [data.embed], components: [data.row] });
        else await message.delete().catch(() => {});
    } catch (e) { console.error(`Failed to update Discord embed for activity ${activityId}:`, e.message); }
}

async function deleteActivityMessage(activityId) {
    if (!discordClient || !isReady) return;
    let channel;
    try {
        const res = await db.query('SELECT discord_channel_id, discord_message_id FROM planned_activities WHERE id = $1', [activityId]);
        if (res.rows.length > 0 && res.rows[0].discord_message_id) {
            const channelId = res.rows[0].discord_channel_id;
            const messageId = res.rows[0].discord_message_id;

            channel = await discordClient.channels.fetch(channelId);
            if (channel) {
                const msg = await channel.messages.fetch(messageId);
                if (msg) await msg.delete();

                if (channel.isThread()) {
                    await channel.delete('Activity deleted from web panel');
                }
            }
        }
    } catch (e) {
        console.warn(`Warn: Failed to delete activity message/thread ${activityId}: ${e.message}`);
        if (channel && channel.isThread()) {
            await channel.delete('Activity deleted from web panel').catch(() => {});
        }
    }
}

async function sendActivityReminder(activity) {
    if (!discordClient || !isReady || !activity.discord_channel_id) return;
    try {
        const channel = await discordClient.channels.fetch(activity.discord_channel_id);
        if (!channel) return;

        const res = await db.query(`SELECT p.discord_user_id FROM activity_participants ap JOIN players p ON ap.player_id = p.id WHERE ap.activity_id = $1 AND p.discord_user_id IS NOT NULL`, [activity.id]);
        const mentions = res.rows.map(r => `<@${r.discord_user_id}>`).join(' ');

        if (mentions) {
            await channel.send(`${t('reminder_text', { type: activity.activity_type })} ${mentions}`);
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