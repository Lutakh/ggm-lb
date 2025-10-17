// migrate5-cc.js
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
        console.log('\n--- Starting V5 Migration (Class Change Timers) ---');
        await client.query('BEGIN');

        // 1. Create class_change_timers table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS class_change_timers (
                id SERIAL PRIMARY KEY,
                label TEXT NOT NULL,
                weeks_after_start INTEGER NOT NULL,
                is_active BOOLEAN DEFAULT true
            );
        `);
        console.log('✅ Table "class_change_timers" created or already exists.');

        // 2. Vide la table pour s'assurer que les nouvelles valeurs sont les seules présentes
        await client.query('TRUNCATE TABLE class_change_timers RESTART IDENTITY;');
        console.log('🗑️ "class_change_timers" table has been cleared.');
        
        // 3. Insère les nouvelles valeurs fixes
        const defaultTimers = [
            { label: 'Class Change 1', weeks: 1 },
            { label: 'Class Change 2', weeks: 4 },
            { label: 'Class Change 3', weeks: 13 },
            { label: 'Class Change 4', weeks: 22 },
            { label: 'Class Change 5', weeks: 31 },
            { label: 'Class Change 6', weeks: 42 },
            { label: 'Class Change 7', weeks: 53 },
            { label: 'Class Change 8', weeks: 64 },
            { label: 'Class Change 9', weeks: 75 },
            { label: 'Class Change 10', weeks: 86 },
        ];
        for (const timer of defaultTimers) {
            await client.query(
                'INSERT INTO class_change_timers (label, weeks_after_start) VALUES ($1, $2)',
                [timer.label, timer.weeks]
            );
        }
        console.log('✅ Populated "class_change_timers" with new fixed values.');

        await client.query('COMMIT');
        console.log('\n--- 🎉 Migration V5 completed successfully! ---');

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
