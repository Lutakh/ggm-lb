// routes/index.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');
// Import BOTH timer functions
const { calculateClassChangeTimers, calculateLevelCapTimers } = require('../utils/timers'); // Updated import

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
            ccTimersResult // Keep this for class change
        ] = await Promise.all([
            db.query(playersSql),
            db.query('SELECT name FROM guilds ORDER BY name;'),
            db.query('SELECT id, name FROM perilous_trials ORDER BY id;'),
            db.query('SELECT key, value FROM server_settings;'),
            db.query('SELECT id, label, weeks_after_start, is_active FROM class_change_timers ORDER BY id;') // Keep fetching CC timers
        ]);
        const serverSettings = settingsResult.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});

        // Add a fallback for server_open_date
        if (!serverSettings.server_open_date) {
            serverSettings.server_open_date = new Date().toISOString().split('T')[0]; // Use YYYY-MM-DD format
        }

        const players = playersResult.rows.map(p => ({ ...p, play_slots: p.play_slots || [], pt_tags: p.pt_tags || [] }));
        const guilds = guildsResult.rows.map(g => g.name);
        const perilousTrials = trialsResult.rows;
        const allTeamNames = [...new Set(players.map(p => p.team).filter(Boolean).filter(t => t !== 'No Team'))];

        const teamsData = players.reduce((acc, player) => {
            const teamName = player.team;
            if (teamName && teamName !== 'No Team') {
                if (!acc[teamName]) acc[teamName] = { members: [], total_cp: 0, guilds: new Set(), class_distribution: { Swordbearer: 0, Acolyte: 0, Wayfarer: 0, Scholar: 0, Shadowlash: 0 } };
                acc[teamName].members.push(player); // player est l'objet complet
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

        // --- NOUVEAU: Préparer la liste des joueurs pour les sélecteurs ---
        const playerListForSelectors = players.map(p => ({ id: p.id, name: p.name }));


        // --- TIMERS LOGIC ---
        const now = new Date();
        const currentUTCDay = now.getUTCDay(); // 0=Dim, 1=Lun, 2=Mar, 3=Mer...

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


        // Calculate Class Change timers (existing)
        const allClassChangeTimers = calculateClassChangeTimers(serverSettings.server_open_date, ccTimersResult.rows);
        const activeClassChangeTimer = allClassChangeTimers.find(t => t.milliseconds > 0);

        // *** NEW: Calculate Level Cap timers ***
        const levelCapTimers = calculateLevelCapTimers(serverSettings.server_open_date); // Call the new function

        // --- Paper Plane Logic (existing) ---
        const importantPaperPlanes = [2, 5, 9, 12, 14, 18, 21, 23, 24, 25, 28, 33];
        const serverStartDate = new Date(serverSettings.server_open_date + 'T00:00:00Z');
        // Temps écoulé en millisecondes depuis le début du serveur
        const timeSinceStart = now.getTime() - serverStartDate.getTime();
        // ...
// Nombre de jours COMPLETS écoulés
        const serverAgeInDays = Math.floor(timeSinceStart / (1000 * 60 * 60 * 24));

// --- NOUVELLE LOGIQUE Corrigée pour paperPlaneNumber ---
        const serverStartDay = serverStartDate.getUTCDay(); // 0=Dim, 3=Wed
        const daysUntilFirstWed = (3 - serverStartDay + 7) % 7;
        const firstEventReset = new Date(serverStartDate.getTime());
        firstEventReset.setUTCDate(firstEventReset.getUTCDate() + daysUntilFirstWed);
        firstEventReset.setUTCHours(9, 0, 0, 0);

// Si le serveur a démarré un mercredi MAIS *après* 9h UTC, le premier reset est la semaine d'après
        if (firstEventReset < serverStartDate) {
            firstEventReset.setUTCDate(firstEventReset.getUTCDate() + 7);
        }

        const timeSinceFirstReset = now.getTime() - firstEventReset.getTime();
        let paperPlaneNumber;

        if (timeSinceFirstReset < 0) {
            // Nous sommes dans la première "semaine" partielle (PP0) avant le premier reset
            paperPlaneNumber = 0;
        } else {
            // Calculer le nombre de semaines complètes *depuis* le premier reset et ajouter 1 (pour PP1, PP2...)
            const weeksSinceFirstReset = Math.floor(timeSinceFirstReset / (1000 * 60 * 60 * 24 * 7));
            paperPlaneNumber = weeksSinceFirstReset + 1;
        }
// --- FIN NOUVELLE LOGIQUE ---
        

        // Obtenir le timer du prochain reset (via la fonction corrigée)
        const nextPaperPlaneReset = getNextReset(3); // Mercredi = 3 (09:00 UTC)

        // *** CORRECTION: Calculer l'heure de FIN de l'événement actuel ***
        const paperPlaneEndTime = new Date(nextPaperPlaneReset.getTime() - (60 * 60 * 1000)); // Soustrait 1 heure (08:00 UTC)


        // Calcul des prochains resets pour le tooltip Paper Plane
        const tooltipPaperPlanes = [];
        let tooltipStartDate = new Date(nextPaperPlaneReset.getTime());
        for (let i = 0; i < 4; i++) {
            let nextDate = new Date(tooltipStartDate.getTime());
            nextDate.setUTCDate(nextDate.getUTCDate() + (7 * i));
            const nextPlaneNumber = paperPlaneNumber + i + 1;
            tooltipPaperPlanes.push({
                number: nextPlaneNumber,
                milliseconds: nextDate - now,
                // [MODIFICATION] Ajout de la vérification pour le tooltip
                isImportant: importantPaperPlanes.includes(nextPlaneNumber)
            });
        }


        res.render('index', {
            players, // Gardez la liste complète pour les classements
            playerListForSelectors, // Ajoutez la liste simplifiée pour les dropdowns
            rankedTeams, rankedGuilds, allTeamNames, guilds, perilousTrials, serverSettings,
            classChangeTimers: ccTimersResult.rows, // Still needed for admin maybe?
            notification: req.query.notification || null,
            timers: {
                daily: getNextReset() - now,
                weekly: getNextReset(1) - now, // Monday reset
                // *** MODIFIÉ: Utiliser l'heure de FIN pour le timer principal ***
                event: paperPlaneEndTime - now, // Temps jusqu'à la FIN du PP actuel (Mercredi 08:00 UTC)
                classChange: activeClassChangeTimer,
                allClassChanges: allClassChangeTimers,
                serverDay: serverAgeInDays,
                paperPlaneNumber: paperPlaneNumber,
                isPaperPlaneImportant: importantPaperPlanes.includes(paperPlaneNumber),
                futurePaperPlanes: tooltipPaperPlanes, // Le tooltip montre toujours le début des suivants (09:00 UTC)
                // *** NEW: Pass level cap data ***
                levelCapTimers: levelCapTimers
            },
        });
    } catch (err) {
        console.error("Erreur critique:", err);
        res.status(500).send("A critical error occurred.");
    }
});

module.exports = router;