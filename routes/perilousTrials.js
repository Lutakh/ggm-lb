const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { capitalize, parseCombatPower } = require('../utils/helpers');

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

// Route de soumission du classement (NOUVELLE LOGIQUE)
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

        // On itère sur les 4 joueurs de l'équipe
        for (let i = 0; i < 4; i++) {
            const playerData = teamData[i];
            const name = playerData.name;

            if (name && name.trim() !== '') {
                const capitalizedName = capitalize(name.trim());
                
                // 1. Chercher si le joueur existe déjà
                let playerRes = await client.query('SELECT id FROM players WHERE name ILIKE $1', [capitalizedName]);
                let playerId = playerRes.rows[0]?.id;

                // 2. S'il n'existe pas, le créer
                if (!playerId) {
                    const newPlayerClass = playerData.class || 'Unknown';
                    const newPlayerCp = parseCombatPower(playerData.cp) || 0;
                    const newPlayerGuild = playerData.guild || null;

                    const newPlayerRes = await client.query(
                        `INSERT INTO players (name, class, combat_power, guild, team, notes) 
                         VALUES ($1, $2, $3, $4, 'No Team', 'Created from PT leaderboard') 
                         RETURNING id`,
                        [capitalizedName, newPlayerClass, newPlayerCp, newPlayerGuild]
                    );
                    playerId = newPlayerRes.rows[0].id;
                }
                
                // 3. Ajouter le tag PT
                await client.query(
                    'INSERT INTO player_pt_tags (player_id, pt_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [playerId, pt_id]
                );
                
                // 4. Stocker les infos pour la table leaderboard
                playerIds[i] = playerId;
                finalPlayerNames[i] = capitalizedName;
            }
        }

        // 5. Insérer ou mettre à jour le classement
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
