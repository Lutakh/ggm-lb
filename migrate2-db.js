// migrate-sqlite-to-psql.js
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

// Connexion à l'ancienne base de données SQLite
const sqliteDb = new sqlite3.Database('./database.sqlite', sqlite3.OPEN_READONLY, (err) => {
    if (err) return console.error("Erreur de connexion à la base de données source (SQLite):", err.message);
    console.log('📦 Connecté à la base de données source (SQLite).');
});

// Connexion à la nouvelle base de données PostgreSQL
// Le script s'exécutant à l'intérieur du conteneur 'web', il utilise les variables d'environnement de Docker.
const pgPool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

async function migrate() {
    const pgClient = await pgPool.connect();
    console.log('🚚 Connecté à la base de données de destination (PostgreSQL).');

    try {
        console.log('\n--- Début de la migration ---');
        await pgClient.query('BEGIN'); // Démarre une transaction pour garantir l'intégrité des données

        // 1. Migrer les Guildes
        const guilds = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM guilds', [], (err, rows) => err ? reject(err) : resolve(rows || []));
        });
        for (const guild of guilds) {
            await pgClient.query('INSERT INTO guilds (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [guild.name]);
        }
        console.log(`✅ ${guilds.length} guildes migrées.`);

        // 2. Migrer les Joueurs et garder une trace des IDs
        const players = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM players', [], (err, rows) => err ? reject(err) : resolve(rows || []));
        });
        const idMap = new Map(); // Map pour faire correspondre l'ancien ID SQLite au nouvel ID PostgreSQL
        for (const player of players) {
            const res = await pgClient.query(
                'INSERT INTO players (name, class, combat_power, team, guild, notes) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (name) DO UPDATE SET class = EXCLUDED.class, combat_power = EXCLUDED.combat_power, team = EXCLUDED.team, guild = EXCLUDED.guild, notes = EXCLUDED.notes RETURNING id',
                [player.name, player.class, player.combat_power, player.team, player.guild, player.notes]
            );
            idMap.set(player.id, res.rows[0].id);
        }
        console.log(`✅ ${players.length} joueurs migrés.`);

        // 3. Migrer les Tranches Horaires en utilisant la map des IDs
        const slots = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM play_slots', [], (err, rows) => err ? reject(err) : resolve(rows || []));
        });
        for (const slot of slots) {
            const newPlayerId = idMap.get(slot.player_id);
            if (newPlayerId) {
                await pgClient.query(
                    'INSERT INTO play_slots (player_id, start_minutes, end_minutes) VALUES ($1, $2, $3)',
                    [newPlayerId, slot.start_minutes, slot.end_minutes]
                );
            }
        }
        console.log(`✅ ${slots.length} tranches horaires migrées.`);
        
        await pgClient.query('COMMIT'); // Valide toutes les modifications
        console.log('\n--- 🎉 Migration terminée avec succès ! ---');
        
    } catch (e) {
        await pgClient.query('ROLLBACK'); // Annule tout en cas d'erreur
        console.error('❌ ERREUR LORS DE LA MIGRATION ! Les changements ont été annulés.', e);
    } finally {
        pgClient.release();
        sqliteDb.close();
        await pgPool.end();
        console.log('Connexions aux bases de données fermées.');
    }
}

// Lancer la migration
migrate();
