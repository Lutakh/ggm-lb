// migrate7-class-update.js
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
        console.log('\n--- Starting V7 Migration (Class Renaming) ---');
        await client.query('BEGIN');

        // Étape 1: Renommer 'Tank' en 'Swordbearer'
        await client.query("UPDATE players SET class = 'Swordbearer' WHERE class = 'Tank'");
        console.log('✅ Class "Tank" renamed to "Swordbearer".');

        // Étape 2: Renommer 'Heal' en 'Acolyte'
        await client.query("UPDATE players SET class = 'Acolyte' WHERE class = 'Heal'");
        console.log('✅ Class "Heal" renamed to "Acolyte".');

        // Étape 3: Supprimer la classe pour les joueurs 'DPS'
        await client.query("UPDATE players SET class = '' WHERE class = 'DPS'");
        console.log('✅ Class "DPS" cleared for all relevant players.');

        await client.query('COMMIT');
        console.log('\n--- 🎉 Migration V7 completed successfully! ---');

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