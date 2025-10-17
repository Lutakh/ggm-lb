// olympus-roster/services/db.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

const initializeDb = async () => {
    const client = await pool.connect();
    console.log('🚀 Checking database schema...');
    try {
        await client.query('BEGIN');

        // Tables originales
        await client.query(`CREATE TABLE IF NOT EXISTS guilds (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE);`);
        await client.query(`CREATE TABLE IF NOT EXISTS players (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, class TEXT NOT NULL, combat_power BIGINT NOT NULL, team TEXT, guild TEXT, notes TEXT);`);
        await client.query(`CREATE TABLE IF NOT EXISTS play_slots (id SERIAL PRIMARY KEY, player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE, start_minutes INTEGER NOT NULL, end_minutes INTEGER NOT NULL);`);

        // Tables des migrations suivantes (Perilous Trials, Settings, etc.)
        await client.query(`CREATE TABLE IF NOT EXISTS perilous_trials (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE);`);
        await client.query(`CREATE TABLE IF NOT EXISTS pt_leaderboard (
            id SERIAL PRIMARY KEY,
            pt_id INTEGER NOT NULL REFERENCES perilous_trials(id) ON DELETE CASCADE,
            rank INTEGER NOT NULL,
            player1_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
            player2_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
            player3_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
            player4_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
            player1_name TEXT, player2_name TEXT, player3_name TEXT, player4_name TEXT,
            UNIQUE(pt_id, rank)
        );`);
        await client.query(`CREATE TABLE IF NOT EXISTS player_pt_tags (
            player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            pt_id INTEGER NOT NULL REFERENCES perilous_trials(id) ON DELETE CASCADE,
            PRIMARY KEY (player_id, pt_id)
        );`);
        await client.query(`CREATE TABLE IF NOT EXISTS server_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
        await client.query(`CREATE TABLE IF NOT EXISTS class_change_timers (id SERIAL PRIMARY KEY, label TEXT NOT NULL, weeks_after_start INTEGER NOT NULL, is_active BOOLEAN DEFAULT true);`);

        await client.query('COMMIT');
        console.log('✅ Database schema is up to date.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error initializing database schema:', err);
    } finally {
        client.release();
    }
};

// Lancer l'initialisation au démarrage de l'application
initializeDb().catch(console.error);

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};
