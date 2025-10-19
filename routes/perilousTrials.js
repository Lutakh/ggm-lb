const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { parseCombatPower } = require('../utils/helpers');

// NOUVELLE ROUTE : Obtenir le classement global des PT
router.get('/pt-leaderboard/global', async (req, res) => {
    const sql = `
        SELECT
            rank,
            player1_id, player2_id, player3_id, player4_id
        FROM pt_leaderboard
        WHERE rank <= 50;
    `;
    try {
        const leaderboardEntries = await db.query(sql);
        const playerPoints = {};

        // Calcul des points
        leaderboardEntries.rows.forEach(entry => {
            const points = 51 - entry.rank;
            for (let i = 1; i <= 4; i++) {
                const playerId = entry[`player${i}_id`];
                if (playerId) {
                    if (!playerPoints[playerId]) {
                        playerPoints[playerId] = 0;
                    }
                    playerPoints[playerId] += points;
                }
            }
        });

        const playerIds = Object.keys(playerPoints);
        if (playerIds.length === 0) {
            return res.json([]);
        }

        // Récupération des détails des joueurs
        const playersInfoSql = `
            SELECT id, name, class, combat_power
            FROM players
            WHERE id = ANY($1::int[]);
        `;
        const playersInfo = await db.query(playersInfoSql, [playerIds]);

        const globalLeaderboard = playersInfo.rows.map(player => ({
            ...player,
            points: playerPoints[player.id]
        })).sort((a, b) => b.points - a.points);

        res.json(globalLeaderboard);
    } catch (err) {
        console.error(`Error fetching global PT leaderboard:`, err);
        res.status(500).json([]);
    }
});

// NOUVELLE ROUTE : Obtenir le prochain rang libre pour un PT
router.get('/pt-leaderboard/:ptId/next-rank', async (req, res) => {
    const { ptId } = req.params;
    if (!ptId || ptId === 'global') {
        return res.json({ nextRank: 1 });
    }
    const sql = `
        SELECT MAX(rank) as max_rank
        FROM pt_leaderboard
        WHERE pt_id = $1;
    `;
    try {
        const result = await db.query(sql, [ptId]);
        const nextRank = (result.rows[0]?.max_rank || 0) + 1;
        res.json({ nextRank });
    } catch (err) {
        console.error(`Error fetching next rank for PT ID ${ptId}:`, err);
        res.status(500).json({ nextRank: 1 });
    }
});

// Route pour obtenir le classement d'un PT (inchangée)
router.get('/pt-leaderboard/:ptId', async (req, res) => {
    const { ptId } = req.params;
    const sql = `
        SELECT
            lb.rank,
            lb.player1_name, p1.class as player1_class,
            lb.player2_name, p2.class as player2_class,
            lb.player3_name, p3.class as player3_class,
            lb.player4_name, p4.class as player4_class
        FROM pt_leaderboard lb
                 LEFT JOIN players p1 ON lb.player1_id = p1.id
                 LEFT JOIN players p2 ON lb.player2_id = p2.id
                 LEFT JOIN players p3 ON lb.player3_id = p3.id
                 LEFT JOIN players p4 ON lb.player4_id = p4.id
        WHERE lb.pt_id = $1
        ORDER BY lb.rank;
    `;
    try {
        const result = await db.query(sql, [ptId]);
        res.json(result.rows);
    } catch (err) {
        console.error(`Error fetching leaderboard for PT ID ${ptId}:`, err);
        res.status(500).json([]);
    }
});

// Route pour vérifier si un rang est déjà pris (inchangée)
router.get('/pt-leaderboard/:ptId/rank/:rank', async (req, res) => {
    const { ptId, rank } = req.params;
    try {
        const result = await db.query('SELECT player1_name, player2_name, player3_name, player4_name FROM pt_leaderboard WHERE pt_id = $1 AND rank = $2', [ptId, rank]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.json(null);
        }
    } catch (err) {
        res.status(500).json(null);
    }
});

// Route de soumission du classement (MODIFIÉE)
router.post('/pt-leaderboard', async (req, res) => {
    if (req.body.admin_password !== process.env.ADMIN_PASSWORD) {
        return res.status(403).redirect('/?notification=' + encodeURIComponent('Incorrect admin password.'));
    }

    const { pt_id, rank, players: teamData } = req.body;

    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        const playerIds = [null, null, null, null];
        const finalPlayerNames = [null, null, null, null];

        for (let i = 0; i < 4; i++) {
            const playerData = teamData[i];
            const name = playerData.name;

            if (name && name.trim() !== '') {
                const trimmedName = name.trim();
                const newPlayerCp = parseCombatPower(playerData.cp) || 0;

                let playerRes = await client.query('SELECT id FROM players WHERE name ILIKE $1', [trimmedName]);
                let playerId = playerRes.rows[0]?.id;

                if (playerId) {
                    // Si le joueur existe et qu'un CP est fourni, on le met à jour
                    if (newPlayerCp > 0) {
                        await client.query('UPDATE players SET combat_power = $1 WHERE id = $2', [newPlayerCp, playerId]);
                    }
                } else {
                    // Si le joueur n'existe pas, on le crée
                    const newPlayerClass = playerData.class || 'Unknown';
                    const newPlayerGuild = (playerData.guild && playerData.guild.trim() !== '') ? playerData.guild.trim() : null;

                    if (newPlayerGuild) {
                        await client.query('INSERT INTO guilds (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [newPlayerGuild]);
                    }

                    const newPlayerRes = await client.query(
                        `INSERT INTO players (name, class, combat_power, guild, team, notes)
                         VALUES ($1, $2, $3, $4, 'No Team', 'Created from PT leaderboard')
                         RETURNING id`,
                        [trimmedName, newPlayerClass, newPlayerCp, newPlayerGuild]
                    );
                    playerId = newPlayerRes.rows[0].id;
                }

                await client.query(
                    'INSERT INTO player_pt_tags (player_id, pt_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [playerId, pt_id]
                );

                playerIds[i] = playerId;
                finalPlayerNames[i] = trimmedName;
            }
        }

        await client.query(
            `INSERT INTO pt_leaderboard (pt_id, rank, player1_id, player2_id, player3_id, player4_id, player1_name, player2_name, player3_name, player4_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (pt_id, rank)
                 DO UPDATE SET
                               player1_id = EXCLUDED.player1_id, player2_id = EXCLUDED.player2_id, player3_id = EXCLUDED.player3_id, player4_id = EXCLUDED.player4_id,
                               player1_name = EXCLUDED.player1_name, player2_name = EXCLUDED.player2_name, player3_name = EXCLUDED.player3_name, player4_name = EXCLUDED.player4_name`,
            [pt_id, rank, ...playerIds, ...finalPlayerNames]
        );

        await client.query('COMMIT');

        // --- DÉBUT DE LA LOGIQUE DE CRÉATION AUTOMATIQUE ---
        try {
            const maxPtResult = await db.query("SELECT id FROM perilous_trials ORDER BY id DESC LIMIT 1");
            const maxPtId = maxPtResult.rows[0]?.id;

            if (maxPtId) {
                const updatedPtId = parseInt(pt_id, 10);
                const triggerPtId = maxPtId - 3;

                // On vérifie aussi qu'il y a au moins une équipe dans ce PT pour être sûr
                if (updatedPtId === triggerPtId) {
                    const teamCountResult = await db.query('SELECT COUNT(*) FROM pt_leaderboard WHERE pt_id = $1', [triggerPtId]);
                    if (teamCountResult.rows[0].count > 0) {
                        const newPtNumber = maxPtId + 1;
                        const newPtName = `PT${newPtNumber}`;
                        await db.query("INSERT INTO perilous_trials (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [newPtName]);
                        console.log(`✅ Automatically created Perilous Trial: ${newPtName}`);
                    }
                }
            }
        } catch (autoCreateError) {
            console.error("❌ Error during automatic PT creation:", autoCreateError);
        }
        // --- FIN DE LA LOGIQUE DE CRÉATION AUTOMATIQUE ---

        res.redirect(`/?notification=${encodeURIComponent(`Leaderboard updated!`)}&section=perilous-trials-section&pt_id=${pt_id}`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating PT leaderboard:', err);
        res.status(500).redirect('/?notification=' + encodeURIComponent('Error updating PT leaderboard.'));
    } finally {
        client.release();
    }
});

module.exports = router;