const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { calculateClassChangeTimers } = require('../utils/timers');

router.get('/', async (req, res) => {
    try {
        const playersSql = `
            SELECT p.*,
                   (SELECT json_agg(json_build_object('start_minutes', ps.start_minutes, 'end_minutes', ps.end_minutes))
                    FROM play_slots ps WHERE ps.player_id = p.id) as play_slots,
                   (SELECT json_agg(pt.name)
                    FROM player_pt_tags ppt
                             JOIN perilous_trials pt ON pt.id = ppt.pt_id
                    WHERE ppt.player_id = p.id) as pt_tags
            FROM players p
            ORDER BY p.combat_power DESC, p.name;`;

        const [
            playersResult,
            guildsResult,
            trialsResult,
            settingsResult,
            ccTimersResult
        ] = await Promise.all([
            db.query(playersSql),
            db.query('SELECT name FROM guilds ORDER BY name;'),
            db.query('SELECT id, name FROM perilous_trials ORDER BY id;'),
            db.query('SELECT key, value FROM server_settings;'),
            db.query('SELECT id, label, weeks_after_start, is_active FROM class_change_timers ORDER BY id;')
        ]);
        const serverSettings = settingsResult.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});

        // Add a fallback for server_open_date
        if (!serverSettings.server_open_date) {
            serverSettings.server_open_date = new Date().toISOString();
        }
        const players = playersResult.rows.map(p => ({ ...p, play_slots: p.play_slots || [], pt_tags: p.pt_tags || [] }));
        const guilds = guildsResult.rows.map(g => g.name);
        const perilousTrials = trialsResult.rows;
        const allTeamNames = [...new Set(players.map(p => p.team).filter(Boolean).filter(t => t !== 'No Team'))];

        const teamsData = players.reduce((acc, player) => {
            const teamName = player.team;
            if (teamName && teamName !== 'No Team') {
                if (!acc[teamName]) acc[teamName] = { members: [], total_cp: 0, guilds: new Set(), class_distribution: { Swordbearer: 0, Acolyte: 0, Wayfarer: 0, Scholar: 0, Shadowlash: 0 } };
                acc[teamName].members.push(player);
                acc[teamName].total_cp += Number(player.combat_power);
                if(player.guild) acc[teamName].guilds.add(player.guild);
                if (acc[teamName].class_distribution[player.class] !== undefined) {
                    acc[teamName].class_distribution[player.class]++;
                }
            }
            return acc;
        }, {});
        const rankedTeams = Object.entries(teamsData).map(([name, data]) => ({ name, total_cp: data.total_cp, members: data.members.sort((a, b) => b.combat_power - a.combat_power), member_count: data.members.length, class_distribution: data.class_distribution, guild: data.guilds.size === 1 ? [...data.guilds][0] : 'Mixed' })).sort((a, b) => b.total_cp - a.total_cp);

        const guildsData = players.reduce((acc, player) => {
            const guildName = player.guild;
            if (guildName) {
                if (!acc[guildName]) acc[guildName] = { members: [], total_cp: 0, class_distribution: { Swordbearer: 0, Acolyte: 0, Wayfarer: 0, Scholar: 0, Shadowlash: 0 } };
                acc[guildName].members.push(player);
                acc[guildName].total_cp += Number(player.combat_power);
                if (acc[guildName].class_distribution[player.class] !== undefined) {
                    acc[guildName].class_distribution[player.class]++;
                }
            }
            return acc;
        }, {});
        const rankedGuilds = Object.entries(guildsData).map(([name, data]) => ({ name, total_cp: data.total_cp, member_count: data.members.length, class_distribution: data.class_distribution })).sort((a, b) => b.total_cp - a.total_cp);

        // --- LOGIQUE DES TIMERS ---
        // [MODIFICATION 1: LIGNES SUPPRIMÉES (serverOffsetHours, serverTime, serverDay)]
        const now = new Date();
        const currentUTCDay = now.getUTCDay(); // 0=Dim, 1=Lun, 2=Mar, 3=Mer... [MODIFICATION 2: LIGNE AJOUTÉE]


        // [MODIFICATION 3: FONCTION getNextReset REMPLACÉE]
        // Fonction pour calculer la prochaine date de reset (Daily, Weekly, Event)
        // TOUT est basé sur 09:00 UTC
        const getNextReset = (targetDay) => { // targetDay: 0=Dim, 1=Lun, 3=Mer
            const reset = new Date(now.getTime());
            reset.setUTCHours(9, 0, 0, 0); // Heure du reset: 09:00 UTC

            if (targetDay !== undefined) {
                // Calcule le nombre de jours jusqu'au prochain targetDay
                const daysUntilTarget = (targetDay - currentUTCDay + 7) % 7;
                reset.setUTCDate(reset.getUTCDate() + daysUntilTarget);
            }

            // Si le reset calculé (aujourd'hui 9h UTC, ou ce Mercredi 9h UTC)
            // est DÉJÀ PASSÉ par rapport à l'heure ACTUELLE
            if (reset < now) {
                // Avance au prochain reset
                reset.setUTCDate(reset.getUTCDate() + (targetDay === undefined ? 1 : 7));
            }
            return reset;
        };


        // Calcul des timers Class Change (utilise sa propre logique UTC dans utils/timers.js - 13h UTC)
        const allClassChangeTimers = calculateClassChangeTimers(serverSettings.server_open_date, ccTimersResult.rows);
        const activeClassChangeTimer = allClassChangeTimers.find(t => t.milliseconds > 0);

        // Calcul des informations serveur et Paper Plane
        const serverStartDate = new Date(serverSettings.server_open_date);
        // Temps écoulé en millisecondes depuis le début du serveur
        const timeSinceStart = now.getTime() - serverStartDate.getTime();
        // Nombre de jours COMPLETS écoulés
        const serverAgeInDays = Math.floor(timeSinceStart / (1000 * 60 * 60 * 24));


        // [MODIFICATION 4: BLOC DE CALCUL paperPlaneNumber REMPLACÉ]
        // CORRECTION: La logique du Paper Plane doit se baser sur le nombre de resets du Mercredi (jour 3) à 09:00 UTC

        // 1. Trouver la date du premier reset (le premier Mercredi à 9h UTC post-lancement)
        const firstReset = new Date(serverStartDate.getTime());
        firstReset.setUTCHours(9, 0, 0, 0);
        const startDay = serverStartDate.getUTCDay(); // 0=Dim, 3=Mer
        // Calcule les jours jusqu'au premier Mercredi
        const daysUntilFirstWed = (3 - startDay + 7) % 7;
        firstReset.setUTCDate(firstReset.getUTCDate() + daysUntilFirstWed);

        // Si le premier reset (Mercredi 9h) est avant même le démarrage du serveur (ex: start Mercredi 10h)
        if (firstReset < serverStartDate) {
            firstReset.setUTCDate(firstReset.getUTCDate() + 7);
        }

        // 2. Calculer le numéro du plane actuel
        const msSinceFirstReset = now.getTime() - firstReset.getTime();
        let paperPlaneNumber;

        if (msSinceFirstReset < 0) {
            // On est avant le tout premier reset
            paperPlaneNumber = 1;
        } else {
            // Calculer combien de semaines complètes se sont écoulées *depuis le premier reset*
            const weeksPassed = Math.floor(msSinceFirstReset / (1000 * 60 * 60 * 24 * 7));
            // Le Plane #1 est avant le firstReset. Le Plane #2 commence *après* le firstReset (weeksPassed = 0).
            paperPlaneNumber = weeksPassed + 2;
        }

        // 3. Obtenir le timer du prochain reset (via la fonction corrigée)
        const nextPaperPlaneReset = getNextReset(3); // Mercredi = 3


        // Calcul des prochains resets pour le tooltip Paper Plane
        const futurePaperPlaneResets = [];
        let currentResetDate = new Date(nextPaperPlaneReset.getTime());
        // Calcule les 4 prochains resets HEBDOMADAIRES après celui affiché
        for (let i = 1; i <= 4; i++) {
            // Crée une nouvelle date basée sur le reset PRÉCÉDENT pour éviter la mutation
            let nextDate = new Date(currentResetDate.getTime());
            nextDate.setUTCDate(nextDate.getUTCDate() + (7 * (i-1))); // Ajoute (i-1)*7 jours au *prochain* reset
            futurePaperPlaneResets.push({
                number: paperPlaneNumber + i,
                // Le temps restant est calculé par rapport à l'heure ACTUELLE (now)
                milliseconds: nextDate - now
            });
        }
        // Correction pour s'assurer que le premier élément du tooltip est bien le suivant
        let tooltipStartDate = new Date(nextPaperPlaneReset.getTime());
        const tooltipPaperPlanes = [];
        for (let i = 0; i < 4; i++) { // Calcule les 4 prochains resets en incluant le suivant immédiat
            let nextDate = new Date(tooltipStartDate.getTime());
            nextDate.setUTCDate(nextDate.getUTCDate() + (7 * i));
            tooltipPaperPlanes.push({
                number: paperPlaneNumber + i + 1, // On calcule le numéro du *prochain* avion
                milliseconds: nextDate - now
            });
        }


        res.render('index', {
            players, rankedTeams, rankedGuilds, allTeamNames, guilds, perilousTrials, serverSettings,
            classChangeTimers: ccTimersResult.rows,
            notification: req.query.notification || null,
            timers: {
                daily: getNextReset() - now, // Utilise 'now' pour calculer le temps restant
                weekly: getNextReset(1) - now, // Lundi = 1
                event: nextPaperPlaneReset - now, // Mercredi = 3
                classChange: activeClassChangeTimer,
                allClassChanges: allClassChangeTimers,
                serverDay: serverAgeInDays,
                paperPlaneNumber: paperPlaneNumber,
                futurePaperPlanes: tooltipPaperPlanes // Utilisation de la nouvelle variable
            },
        });
    } catch (err) {
        console.error("Erreur critique:", err);
        res.status(500).send("A critical error occurred.");
    }
});

module.exports = router;