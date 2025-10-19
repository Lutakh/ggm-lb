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
        await client.query(`CREATE TABLE IF NOT EXISTS server_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
        await client.query(`CREATE TABLE IF NOT EXISTS class_change_timers (id SERIAL PRIMARY KEY, label TEXT NOT NULL, weeks_after_start INTEGER NOT NULL, is_active BOOLEAN DEFAULT true);`);
        await client.query(`CREATE TABLE IF NOT EXISTS player_pt_tags (
                                                                          player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                                                                          pt_id INTEGER NOT NULL REFERENCES perilous_trials(id) ON DELETE CASCADE,
                                                                          PRIMARY KEY (player_id, pt_id)
                            );`);

        // --- CORRECTION : Logique de migration intelligente pour pt_leaderboard ---
        const checkColumn = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='pt_leaderboard' AND column_name='player1_id'
        `);

        if (checkColumn.rowCount === 0) {
            console.log('⚠️ Old "pt_leaderboard" structure detected. Recreating table...');
            await client.query(`DROP TABLE IF EXISTS pt_leaderboard CASCADE;`);
            await client.query(`CREATE TABLE pt_leaderboard (
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
            console.log('✅ Table "pt_leaderboard" recreated with new structure.');
        } else {
            // Si la table a déjà la bonne structure, on s'assure qu'elle existe (pour le tout premier lancement)
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
        }

        // Trigger pour 'updated_at'
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
            BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
            $$ language 'plpgsql';
        `);
        await client.query('DROP TRIGGER IF EXISTS update_players_updated_at ON players;');
        await client.query(`
            CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `);

        // --- Logique de peuplement initial ---
        const ptCount = await client.query('SELECT COUNT(*) FROM perilous_trials');
        if (ptCount.rows[0].count === '0') {
            console.log('⏳ Populating "perilous_trials" table...');
            for (let i = 1; i <= 8; i++) {
                await client.query('INSERT INTO perilous_trials (name) VALUES ($1)', [`PT${i}`]);
            }
        }

        const ccCount = await client.query('SELECT COUNT(*) FROM class_change_timers');
        if (ccCount.rows[0].count === '0') {
            console.log('⏳ Populating "class_change_timers" table...');
            const defaultTimers = [
                { label: 'Class Change 1', weeks: 1 }, { label: 'Class Change 2', weeks: 4 },
                { label: 'Class Change 3', weeks: 13 }, { label: 'Class Change 4', weeks: 22 },
                { label: 'Class Change 5', weeks: 31 }, { label: 'Class Change 6', weeks: 42 },
                { label: 'Class Change 7', weeks: 53 }, { label: 'Class Change 8', weeks: 64 },
                { label: 'Class Change 9', weeks: 75 }, { label: 'Class Change 10', weeks: 86 },
            ];
            for (const timer of defaultTimers) {
                await client.query('INSERT INTO class_change_timers (label, weeks_after_start) VALUES ($1, $2)', [timer.label, timer.weeks]);
            }
        }

        await client.query(`INSERT INTO server_settings (key, value) VALUES ('server_name', 'SXX') ON CONFLICT (key) DO NOTHING;`);
        await client.query(`INSERT INTO server_settings (key, value) VALUES ('server_open_date', '${new Date().toISOString()}') ON CONFLICT (key) DO NOTHING;`);

        await client.query('COMMIT');
        console.log('✅ Database schema is up to date.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error initializing database schema:', err);
        throw err;
    } finally {
        client.release();
    }
};

initializeDb().catch(err => {
    console.error("Could not initialize the database. Exiting.", err);
    process.exit(1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
};