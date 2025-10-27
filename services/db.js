// olympus-roster/services/db.js
const { Pool } = require('pg');

const pool = new Pool({
    // Make sure these match your .env file or environment variables
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
});

const initializeDb = async () => {
    let client; // Define client outside try block for access in finally
    try {
        client = await pool.connect(); // Assign client here
        console.log('🚀 Checking and initializing database schema...');
        await client.query('BEGIN');

        // Création des tables existantes
        await client.query(`CREATE TABLE IF NOT EXISTS guilds (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE);`);

        // Table players - Ensure CREATE TABLE includes the new columns for first-time setup
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
                stamina INTEGER DEFAULT 0,                 -- Ensure included here
                stamina_last_updated TIMESTAMPTZ DEFAULT NOW() -- Ensure included here
            );
        `);
        // Add columns if they don't exist (for existing tables)
        console.log('Checking players table for stamina columns...');
        await client.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS stamina INTEGER DEFAULT 0;`);
        await client.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS stamina_last_updated TIMESTAMPTZ DEFAULT NOW();`);
        console.log('Columns stamina and stamina_last_updated ensured.');


        await client.query(`CREATE TABLE IF NOT EXISTS play_slots (id SERIAL PRIMARY KEY, player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE, start_minutes INTEGER NOT NULL, end_minutes INTEGER NOT NULL);`);
        await client.query(`CREATE TABLE IF NOT EXISTS perilous_trials (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE);`);
        await client.query(`CREATE TABLE IF NOT EXISTS server_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
        await client.query(`CREATE TABLE IF NOT EXISTS class_change_timers (id SERIAL PRIMARY KEY, label TEXT NOT NULL, weeks_after_start INTEGER NOT NULL, is_active BOOLEAN DEFAULT true);`);
        await client.query(`CREATE TABLE IF NOT EXISTS player_pt_tags (
                                                                          player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                                                                          pt_id INTEGER NOT NULL REFERENCES perilous_trials(id) ON DELETE CASCADE,
                                                                          PRIMARY KEY (player_id, pt_id)
                            );`);

        // --- Logique de migration intelligente pour pt_leaderboard ---
        const checkColumn = await client.query(`
            SELECT 1 FROM information_schema.columns
            WHERE table_name='pt_leaderboard' AND column_name='player1_id'
        `);

        if (checkColumn.rowCount === 0) {
            console.log('⚠️ Old "pt_leaderboard" structure detected. Recreating table...');
            await client.query(`DROP TABLE IF EXISTS pt_leaderboard CASCADE;`); // Use CASCADE if needed
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
            // Ensure table exists even if structure was correct
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
            // console.log('Table "pt_leaderboard" structure confirmed or created.'); // Optional log
        }

        // Nouvelle table pour le statut des quêtes quotidiennes
        await client.query(`
            CREATE TABLE IF NOT EXISTS daily_quest_status (
                player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                quest_key TEXT NOT NULL,
                completed_at TIMESTAMPTZ NOT NULL,
                -- Use DATE part for uniqueness constraint per day UTC
                PRIMARY KEY (player_id, quest_key, DATE(completed_at AT TIME ZONE 'UTC'))
            );
        `);
        console.log('✅ Table "daily_quest_status" ensured.');

        // Trigger pour 'updated_at' sur players
        console.log('Ensuring update_updated_at_column function and trigger...');
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
            BEGIN
                -- Check if the column exists before trying to set it
                IF TG_OP = 'UPDATE' THEN
                    NEW.updated_at = NOW();
                END IF;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);
        // Drop trigger first to avoid errors if it exists but is different
        await client.query('DROP TRIGGER IF EXISTS update_players_updated_at ON players;');
        // Recreate the trigger
        await client.query(`
            CREATE TRIGGER update_players_updated_at
            BEFORE UPDATE ON players
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        `);
        console.log('✅ Trigger function and trigger "update_players_updated_at" ensured.');


        // --- Logique de peuplement initial (only if tables were truly empty) ---
        const ptCountRes = await client.query('SELECT COUNT(*) FROM perilous_trials');
        const ptCount = parseInt(ptCountRes.rows[0].count, 10);
        if (ptCount === 0) {
            console.log('⏳ Populating "perilous_trials" table with initial PTs...');
            for (let i = 1; i <= 8; i++) {
                await client.query('INSERT INTO perilous_trials (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [`PT${i}`]);
            }
            console.log('✅ Initial PTs populated.');
        }

        const ccCountRes = await client.query('SELECT COUNT(*) FROM class_change_timers');
        const ccCount = parseInt(ccCountRes.rows[0].count, 10);
        if (ccCount === 0) {
            console.log('⏳ Populating "class_change_timers" table...');
            const defaultTimers = [
                { label: 'Class Change 1', weeks: 1 }, { label: 'Class Change 2', weeks: 4 },
                { label: 'Class Change 3', weeks: 13 }, { label: 'Class Change 4', weeks: 22 },
                { label: 'Class Change 5', weeks: 31 }, { label: 'Class Change 6', weeks: 42 },
                { label: 'Class Change 7', weeks: 53 }, { label: 'Class Change 8', weeks: 64 },
                { label: 'Class Change 9', weeks: 75 }, { label: 'Class Change 10', weeks: 86 },
            ];
            for (const timer of defaultTimers) {
                // Use ON CONFLICT DO NOTHING in case it runs multiple times somehow
                await client.query('INSERT INTO class_change_timers (label, weeks_after_start) VALUES ($1, $2) ON CONFLICT DO NOTHING', [timer.label, timer.weeks]);
            }
            console.log('✅ Default class change timers populated.');
        }

        // Add default server settings only if they don't exist
        await client.query(`INSERT INTO server_settings (key, value) VALUES ('server_name', 'SXX') ON CONFLICT (key) DO NOTHING;`);
        await client.query(`INSERT INTO server_settings (key, value) VALUES ('server_open_date', '${new Date().toISOString().split('T')[0]}') ON CONFLICT (key) DO NOTHING;`); // Store only date part? Or keep full ISO? Using full ISO as before.


        await client.query('COMMIT');
        console.log('✅ Database schema initialization/check complete.');
    } catch (err) {
        console.error('❌ Error during database schema initialization:', err);
        if (client) { // Rollback only if client was acquired
            try {
                await client.query('ROLLBACK');
                console.log('Database transaction rolled back.');
            } catch (rollbackErr) {
                console.error('Error rolling back transaction:', rollbackErr);
            }
        }
        throw err; // Re-throw the error to signal failure
    } finally {
        if (client) {
            client.release(); // Ensure client is always released
            // console.log('Database client released.'); // Optional log
        }
    }
};

// Run initialization on module load
initializeDb().then(() => {
    console.log('Database initialization successful.');
}).catch(err => {
    console.error("CRITICAL: Database initialization failed. Exiting.", err);
    process.exit(1); // Stop the process if DB init fails critically
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
};