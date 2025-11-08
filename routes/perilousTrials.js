// routes/perilousTrials.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { parseCombatPower } = require('../utils/helpers');

router.get('/pt-leaderboard/global', async (req, res) => {
    const { mode } = req.query;
    let sql;
    if (mode === 'best') {
        sql = `WITH player_scores AS ( SELECT player_id, pt_id, MAX(51 - rank) as points FROM ( SELECT pt_id, rank, player1_id AS player_id FROM pt_leaderboard WHERE player1_id IS NOT NULL AND rank <= 50 UNION ALL SELECT pt_id, rank, player2_id AS player_id FROM pt_leaderboard WHERE player2_id IS NOT NULL AND rank <= 50 UNION ALL SELECT pt_id, rank, player3_id AS player_id FROM pt_leaderboard WHERE player3_id IS NOT NULL AND rank <= 50 UNION ALL SELECT pt_id, rank, player4_id AS player_id FROM pt_leaderboard WHERE player4_id IS NOT NULL AND rank <= 50 ) as scores GROUP BY player_id, pt_id ), total_points AS ( SELECT player_id, SUM(points) as total_points FROM player_scores GROUP BY player_id ) SELECT p.id, p.name, p.class, p.combat_power, tp.total_points as points FROM players p JOIN total_points tp ON p.id = tp.player_id ORDER BY tp.total_points DESC, p.combat_power DESC;`;
    } else {
        sql = `WITH player_points AS ( SELECT player_id, SUM(points) as total_points FROM ( SELECT player1_id AS player_id, 51 - rank AS points FROM pt_leaderboard WHERE player1_id IS NOT NULL AND rank <= 50 UNION ALL SELECT player2_id AS player_id, 51 - rank AS points FROM pt_leaderboard WHERE player2_id IS NOT NULL AND rank <= 50 UNION ALL SELECT player3_id AS player_id, 51 - rank AS points FROM pt_leaderboard WHERE player3_id IS NOT NULL AND rank <= 50 UNION ALL SELECT player4_id AS player_id, 51 - rank AS points FROM pt_leaderboard WHERE player4_id IS NOT NULL AND rank <= 50 ) as scores GROUP BY player_id ) SELECT p.id, p.name, p.class, p.combat_power, pp.total_points as points FROM players p JOIN player_points pp ON p.id = pp.player_id ORDER BY pp.total_points DESC, p.combat_power DESC;`;
    }
    try { const result = await db.query(sql); res.json(result.rows); } catch (err) { console.error(err); res.status(500).json([]); }
});

router.get('/pt-leaderboard/:ptId/next-rank', async (req, res) => {
    const { ptId } = req.params;
    if (!ptId || ptId === 'global') return res.json({ nextRank: 1 });
    try { const result = await db.query('SELECT MAX(rank) as max_rank FROM pt_leaderboard WHERE pt_id = $1', [ptId]); res.json({ nextRank: (result.rows[0]?.max_rank || 0) + 1 }); } catch (err) { console.error(err); res.status(500).json({ nextRank: 1 }); }
});

router.get('/pt-leaderboard/:ptId', async (req, res) => {
    const { ptId } = req.params;
    try { const result = await db.query(`SELECT lb.rank, lb.player1_name, p1.class as player1_class, lb.player2_name, p2.class as player2_class, lb.player3_name, p3.class as player3_class, lb.player4_name, p4.class as player4_class FROM pt_leaderboard lb LEFT JOIN players p1 ON lb.player1_id = p1.id LEFT JOIN players p2 ON lb.player2_id = p2.id LEFT JOIN players p3 ON lb.player3_id = p3.id LEFT JOIN players p4 ON lb.player4_id = p4.id WHERE lb.pt_id = $1 ORDER BY lb.rank;`, [ptId]); res.json(result.rows); } catch (err) { console.error(err); res.status(500).json([]); }
});

router.get('/pt-leaderboard/:ptId/rank/:rank', async (req, res) => {
    try { const result = await db.query('SELECT player1_name, player2_name, player3_name, player4_name FROM pt_leaderboard WHERE pt_id = $1 AND rank = $2', [req.params.ptId, req.params.rank]); res.json(result.rows.length > 0 ? result.rows[0] : null); } catch (err) { console.error(err); res.status(500).json(null); }
});

router.post('/pt-leaderboard', async (req, res) => {
    if (req.body.admin_password !== process.env.ADMIN_PASSWORD) return res.status(403).redirect('/?notification=Incorrect admin password.');
    const { pt_id, rank, players: teamData } = req.body;
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const playerIds = [null, null, null, null];
        const finalPlayerNames = [null, null, null, null];

        for (let i = 0; i < 4; i++) {
            const name = teamData[i].name?.trim();
            if (name) {
                const newCp = parseCombatPower(teamData[i].cp) || 0;
                let playerRes = await client.query('SELECT id FROM players WHERE name ILIKE $1', [name]);
                let playerId = playerRes.rows[0]?.id;

                if (playerId) {
                    // MISE A JOUR CP + TIMESTAMP SI CHANGEMENT
                    if (newCp > 0) {
                        await client.query(
                            `UPDATE players SET
                                combat_power = $1,
                                cp_last_updated = CASE WHEN combat_power != $1 THEN NOW() ELSE cp_last_updated END,
                                updated_at = NOW()
                             WHERE id = $2`,
                            [newCp, playerId]
                        );
                    }
                    // Mise à jour guilde si fournie
                    if (teamData[i].guild) {
                        await client.query('UPDATE players SET guild = $1 WHERE id = $2', [teamData[i].guild.trim() || null, playerId]);
                    }

                } else {
                    const pClass = teamData[i].class || 'Unknown';
                    const guild = teamData[i].guild?.trim() || null;
                    if (guild) await client.query('INSERT INTO guilds (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [guild]);
                    const newRes = await client.query(
                        `INSERT INTO players (name, class, combat_power, guild, team, notes, updated_at, cp_last_updated)
                         VALUES ($1, $2, $3, $4, 'No Team', 'Created from PT', NOW(), NOW()) RETURNING id`,
                        [name, pClass, newCp, guild]
                    );
                    playerId = newRes.rows[0].id;
                }
                await client.query('INSERT INTO player_pt_tags (player_id, pt_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [playerId, pt_id]);
                playerIds[i] = playerId;
                finalPlayerNames[i] = name;
            }
        }

        await client.query(
            `INSERT INTO pt_leaderboard (pt_id, rank, player1_id, player2_id, player3_id, player4_id, player1_name, player2_name, player3_name, player4_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (pt_id, rank) DO UPDATE SET
                                                     player1_id = EXCLUDED.player1_id, player2_id = EXCLUDED.player2_id, player3_id = EXCLUDED.player3_id, player4_id = EXCLUDED.player4_id,
                                                     player1_name = EXCLUDED.player1_name, player2_name = EXCLUDED.player2_name, player3_name = EXCLUDED.player3_name, player4_name = EXCLUDED.player4_name`,
            [pt_id, rank, ...playerIds, ...finalPlayerNames]
        );
        await client.query('COMMIT');

        // Auto-create PTs if needed
        try {
            const maxPtRes = await db.query("SELECT id FROM perilous_trials ORDER BY id DESC LIMIT 1");
            const currentMax = maxPtRes.rows[0]?.id || 0;
            const target = Math.max(8, parseInt(pt_id) + 3);
            if (currentMax < target) {
                for (let i = currentMax + 1; i <= target; i++) {
                    await db.query("INSERT INTO perilous_trials (name) VALUES ($1) ON CONFLICT DO NOTHING", [`PT${i}`]);
                }
            }
        } catch (e) { console.error("Auto-create PT error:", e); }

        res.redirect(`/?notification=${encodeURIComponent(`Leaderboard updated!`)}&section=perilous-trials-section&pt_id=${pt_id}`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating PT leaderboard:', err);
        res.status(500).redirect('/?notification=Error updating PT leaderboard.');
    } finally { client.release(); }
});

module.exports = router;