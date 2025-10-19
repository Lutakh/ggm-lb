const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { parseCombatPower } = require('../utils/helpers');

// Obtenir le classement global des PT (version corrigée avec calcul SQL)
router.get('/pt-leaderboard/global', async (req, res) => {
    const sql = `
        WITH player_points AS (
            SELECT player_id, SUM(points) as total_points
            FROM (
                     SELECT player1_id AS player_id, 51 - rank AS points FROM pt_leaderboard WHERE player1_id IS NOT NULL AND rank <= 50
                     UNION ALL
                     SELECT player2_id AS player_id, 51 - rank AS points FROM pt_leaderboard WHERE player2_id IS NOT NULL AND rank <= 50
                     UNION ALL
                     SELECT player3_id AS player_id, 51 - rank AS points FROM pt_leaderboard WHERE player3_id IS NOT NULL AND rank <= 50
                     UNION ALL
                     SELECT player4_id AS player_id, 51 - rank AS points FROM pt_leaderboard WHERE player4_id IS NOT NULL AND rank <= 50
                 ) as scores
            GROUP BY player_id
        )
        SELECT
            p.id,
            p.name,
            p.class,
            p.combat_power,
            pp.total_points as points
        FROM players p
                 JOIN player_points pp ON p.id = pp.player_id
        ORDER BY pp.total_points DESC, p.combat_power DESC;
    `;
    try {
        const result = await db.query(sql);
        res.json(result.rows);
    } catch (err) {
        console.error(`Error fetching global PT leaderboard:`, err);
        res.status(500).json([]);
    }
});

// Obtenir le prochain rang libre pour un PT
router.get('/pt-leaderboard/:ptId/next-rank', async (req, res) => {
    const { ptId } = req.params;
    if (!ptId || ptId === 'global') {
        return res.json({ nextRank: 1 });
    }
    try {
        const result = await db.query('SELECT MAX(rank) as max_rank FROM pt_leaderboard WHERE pt_id = $1', [ptId]);
        const nextRank = (result.rows[0]?.max_rank || 0) + 1;
        res.json({ nextRank });
    } catch (err) {
        console.error(`Error fetching next rank for PT ID ${ptId}:`, err);
        res.status(500).json({ nextRank: 1 });
    }
});

// Obtenir le classement d'un PT
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

// Vérifier si un rang est déjà pris
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
        console.error(`Error checking rank for PT ${ptId}:`, err);
        res.status(500).json(null);
    }
});

// Soumission du classement
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
                    if (newPlayerCp > 0) {
                        await client.query('UPDATE players SET combat_power = $1 WHERE id = $2', [newPlayerCp, playerId]);
                    }
                } else {
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

        try {
            const highestPtWithTeamResult = await db.query(`
                SELECT pt.id FROM perilous_trials pt
                WHERE EXISTS (SELECT 1 FROM pt_leaderboard lb WHERE lb.pt_id = pt.id)
                ORDER BY pt.id DESC LIMIT 1
            `);
            const highestPtWithTeam = highestPtWithTeamResult.rows[0]?.id || 0;

            const maxExistingPtResult = await db.query("SELECT id FROM perilous_trials ORDER BY id DESC LIMIT 1");
            const maxExistingPt = maxExistingPtResult.rows[0]?.id || 0;

            const targetMaxPt = highestPtWithTeam > 0 ? highestPtWithTeam + 3 : 8;

            if (maxExistingPt < targetMaxPt) {
                for (let i = maxExistingPt + 1; i <= targetMaxPt; i++) {
                    const newPtName = `PT${i}`;
                    await db.query("INSERT INTO perilous_trials (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [newPtName]);
                    console.log(`✅ Automatically created Perilous Trial: ${newPtName}`);
                }
            }
        } catch (autoCreateError) {
            console.error("❌ Error during automatic PT creation:", autoCreateError);
        }

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