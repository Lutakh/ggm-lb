// migrate-v4.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
});

async function migrate() {
    const client = await pool.connect();
    console.log('🚀 Connected to PostgreSQL database for migration.');

    try {
        console.log('\n--- Starting V4 Migration (Server Settings & PT Rework) ---');
        await client.query('BEGIN');

        // 1. Create server_settings table and populate it
        await client.query(`
            CREATE TABLE IF NOT EXISTS server_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        `);
        console.log('✅ Table "server_settings" created or already exists.');

        await client.query(`INSERT INTO server_settings (key, value) VALUES ('server_name', 'S81') ON CONFLICT (key) DO NOTHING;`);
        await client.query(`INSERT INTO server_settings (key, value) VALUES ('server_open_date', '2024-09-24T00:00:00.000Z') ON CONFLICT (key) DO NOTHING;`);
        console.log('✅ Default server settings populated.');

        // 2. Drop old pt_leaderboard table and recreate it for 4-player teams
        await client.query('DROP TABLE IF EXISTS pt_leaderboard;');
        console.log('⚠️ Old "pt_leaderboard" table dropped.');

        await client.query(`
            CREATE TABLE pt_leaderboard (
                id SERIAL PRIMARY KEY,
                pt_id INTEGER NOT NULL REFERENCES perilous_trials(id) ON DELETE CASCADE,
                rank INTEGER NOT NULL,
                player1_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
                player2_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
                player3_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
                player4_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
                player1_name TEXT,
                player2_name TEXT,
                player3_name TEXT,
                player4_name TEXT,
                UNIQUE(pt_id, rank)
            );
        `);
        console.log('✅ New "pt_leaderboard" table for 4-player teams created.');

        await client.query('COMMIT');
        console.log('\n--- 🎉 Migration V4 completed successfully! ---');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ MIGRATION FAILED! Changes have been rolled back.', e);
    } finally {
        client.release();
        await pool.end();
        console.log('Database connection closed.');
    }
}

migrate();
