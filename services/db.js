// services/db.js
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
});

const initializeDb = async () => {
    let client;
    try {
        client = await pool.connect();
        console.log('🚀 Checking and initializing database schema...');
        await client.query('BEGIN');

        // ... (tables existantes: guilds, players ...)
        await client.query(`CREATE TABLE IF NOT EXISTS guilds (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE);`);
        await client.query(`
            CREATE TABLE IF NOT EXISTS players (
                                                   id SERIAL PRIMARY KEY,
                                                   name TEXT NOT NULL UNIQUE,
                                                   class TEXT NOT NULL,
                                                   combat_power BIGINT NOT NULL,
                                                   team TEXT,
                                                   guild TEXT,
                                                   notes TEXT,
                                                   updated_at TIMESTAMPTZ DEFAULT NOW(),
                                                   stamina INTEGER DEFAULT 0,
                                                   stamina_last_updated TIMESTAMPTZ DEFAULT NOW(),
                                                   discord_user_id TEXT NULL,
                                                   last_stamina_notification_level INTEGER DEFAULT 0,
                                                   cp_last_updated TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // --- NOUVELLE COLONNE TIMEZONE ---
        await client.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS timezone TEXT NULL;`);
        // ---------------------------------

        // ... (autres tables existantes ...)
        await client.query(`CREATE TABLE IF NOT EXISTS play_slots (id SERIAL PRIMARY KEY, player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE, start_minutes INTEGER NOT NULL, end_minutes INTEGER NOT NULL);`);
        await client.query(`CREATE TABLE IF NOT EXISTS perilous_trials (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE);`);
        await client.query(`CREATE TABLE IF NOT EXISTS server_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
        await client.query(`CREATE TABLE IF NOT EXISTS class_change_timers (id SERIAL PRIMARY KEY, label TEXT NOT NULL, weeks_after_start INTEGER NOT NULL, is_active BOOLEAN DEFAULT true);`);
        await client.query(`CREATE TABLE IF NOT EXISTS player_pt_tags (player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE, pt_id INTEGER NOT NULL REFERENCES perilous_trials(id) ON DELETE CASCADE, PRIMARY KEY (player_id, pt_id));`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS planned_activities (
                                                              id SERIAL PRIMARY KEY,
                                                              activity_type TEXT NOT NULL,
                                                              activity_subtype TEXT,
                                                              scheduled_time TIMESTAMPTZ NOT NULL,
                                                              creator_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
                                                              notes TEXT,
                                                              created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // --- NOUVEAUX CHAMPS POUR DISCORD ---
        await client.query(`ALTER TABLE planned_activities ADD COLUMN IF NOT EXISTS discord_message_id TEXT NULL;`);
        await client.query(`ALTER TABLE planned_activities ADD COLUMN IF NOT EXISTS discord_channel_id TEXT NULL;`);
        await client.query(`ALTER TABLE planned_activities ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;`);
        // ------------------------------------

        await client.query(`
            CREATE TABLE IF NOT EXISTS activity_participants (
                                                                 activity_id INTEGER REFERENCES planned_activities(id) ON DELETE CASCADE,
                                                                 player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
                                                                 joined_at TIMESTAMPTZ DEFAULT NOW(),
                                                                 PRIMARY KEY (activity_id, player_id)
            );
        `);

        // ... (reste de l'initialisation: pt_leaderboard, daily_quest_status, triggers, data init ...)
        // (Je ne remets pas tout le code existant ici pour faire court, mais assurez-vous de garder le reste de votre fichier db.js intact)
        // Assurez-vous que le reste de initializeDb est présent ici.

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

        await client.query(`
            CREATE TABLE IF NOT EXISTS daily_quest_status (
                                                              player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                                                              quest_key TEXT NOT NULL,
                                                              completed_at TIMESTAMPTZ NOT NULL,
                                                              PRIMARY KEY (player_id, quest_key)
            );
        `);

        // Trigger updated_at (si pas déjà fait dans votre fichier complet)
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
            BEGIN
                IF TG_OP = 'UPDATE' THEN
                    NEW.updated_at = NOW();
                END IF;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);
        // ... (triggers et insertions de données initiales existantes)

        await client.query('COMMIT');
        console.log('✅ Database schema initialization/check complete.');
    } catch (err) {
        console.error('❌ Error during database schema initialization:', err);
        if (client) { try { await client.query('ROLLBACK'); } catch (rollbackErr) { console.error('Rollback error:', rollbackErr); } }
        throw err;
    } finally {
        if (client) client.release();
    }
};

// Lance l'init au démarrage
initializeDb().catch(err => {
    console.error("CRITICAL: Database initialization failed.", err);
    // process.exit(1); // Optionnel : peut-être ne pas crash tout le serveur si la DB a un hoquet temporaire, mais c'est souvent mieux de fail-fast.
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
};