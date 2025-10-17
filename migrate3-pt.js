// migrate-pt.js
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
        console.log('\n--- Starting Perilous Trial Migration ---');
        await client.query('BEGIN');

        // 1. Create the perilous_trials table
        await client.query(`
            CREATE TABLE IF NOT EXISTS perilous_trials (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE
            );
        `);
        console.log('✅ Table "perilous_trials" created or already exists.');

        // 2. Create the pt_leaderboard table
        await client.query(`
            CREATE TABLE IF NOT EXISTS pt_leaderboard (
                id SERIAL PRIMARY KEY,
                pt_id INTEGER NOT NULL REFERENCES perilous_trials(id) ON DELETE CASCADE,
                rank INTEGER NOT NULL,
                player_id INTEGER REFERENCES players(id) ON DELETE SET NULL, -- Can be null for on-the-fly players
                player_name TEXT NOT NULL, -- Always store the name
                UNIQUE(pt_id, rank)
            );
        `);
        console.log('✅ Table "pt_leaderboard" created or already exists.');

        // 3. Create the player_pt_tags table for completions
        await client.query(`
            CREATE TABLE IF NOT EXISTS player_pt_tags (
                player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                pt_id INTEGER NOT NULL REFERENCES perilous_trials(id) ON DELETE CASCADE,
                PRIMARY KEY (player_id, pt_id)
            );
        `);
        console.log('✅ Table "player_pt_tags" created or already exists.');
        
        // 4. Populate perilous_trials table from PT1 to PT20
        console.log('⏳ Populating "perilous_trials" table...');
        for (let i = 1; i <= 20; i++) {
            await client.query('INSERT INTO perilous_trials (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [`PT${i}`]);
        }
        console.log('✅ Populated "perilous_trials" with PT1 through PT20.');

        await client.query('COMMIT');
        console.log('\n--- 🎉 Migration completed successfully! ---');

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
