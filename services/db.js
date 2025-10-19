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
    console.log('🚀 Checking and initializing database schema...');
    try {
        await client.query('BEGIN');

        // Création de toutes les tables si elles n'existent pas
        await client.query(`CREATE TABLE IF NOT EXISTS guilds (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE);`);
        await client.query(`CREATE TABLE IF NOT EXISTS players (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, class TEXT NOT NULL, combat_power BIGINT NOT NULL, team TEXT, guild TEXT, notes TEXT, updated_at TIMESTAMPTZ DEFAULT NOW());`);
        await client.query(`CREATE TABLE IF NOT EXISTS play_slots (id SERIAL PRIMARY KEY, player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE, start_minutes INTEGER NOT NULL, end_minutes INTEGER NOT NULL);`);
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

        // Trigger pour mettre à jour 'updated_at' sur la table 'players'
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
               NEW.updated_at = NOW(); 
               RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);
        await client.query('DROP TRIGGER IF EXISTS update_players_updated_at ON players;');
        await client.query(`
            CREATE TRIGGER update_players_updated_at
            BEFORE UPDATE ON players
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        `);

        // --- Logique de peuplement initial (remplace les migrations) ---

        // 1. Peupler les Perilous Trials de 1 à 8 si la table est vide
        const ptCount = await client.query('SELECT COUNT(*) FROM perilous_trials');
        if (ptCount.rows[0].count === '0') {
            console.log('⏳ Populating "perilous_trials" table for the first time...');
            for (let i = 1; i <= 8; i++) {
                await client.query('INSERT INTO perilous_trials (name) VALUES ($1)', [`PT${i}`]);
            }
            console.log('✅ Populated "perilous_trials" with PT1 through PT8.');
        }

        // 2. Insérer les paramètres serveur par défaut s'ils n'existent pas
        await client.query(`INSERT INTO server_settings (key, value) VALUES ('server_name', 'SXX') ON CONFLICT (key) DO NOTHING;`);
        await client.query(`INSERT INTO server_settings (key, value) VALUES ('server_open_date', '${new Date().toISOString()}') ON CONFLICT (key) DO NOTHING;`);

        await client.query('COMMIT');
        console.log('✅ Database schema is up to date.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error initializing database schema:', err);
        throw err; // Propage l'erreur pour arrêter le démarrage du serveur si la DB échoue
    } finally {
        client.release();
    }
};

// Lancer l'initialisation au démarrage de l'application
initializeDb().catch(err => {
    console.error("Could not initialize the database. Exiting.", err);
    process.exit(1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
};