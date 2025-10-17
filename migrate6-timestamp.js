// migrate6-timestamp.js
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
        console.log('\n--- Starting V6 Migration (Add Last Modified Timestamp) ---');
        await client.query('BEGIN');

        // 1. Ajouter la colonne si elle n'existe pas déjà
        await client.query(`
            ALTER TABLE players
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
        `);
        console.log('✅ Column "updated_at" added to players table.');

        // 2. Créer une fonction de trigger pour mettre à jour automatiquement le timestamp
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
               NEW.updated_at = NOW(); 
               RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);
        console.log('✅ Trigger function "update_updated_at_column" created or replaced.');

        // 3. Appliquer le trigger à la table players
        // On supprime d'abord l'ancien trigger s'il existe pour éviter les erreurs
        await client.query('DROP TRIGGER IF EXISTS update_players_updated_at ON players;');
        await client.query(`
            CREATE TRIGGER update_players_updated_at
            BEFORE UPDATE ON players
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        `);
        console.log('✅ Trigger "update_players_updated_at" applied to players table.');

        await client.query('COMMIT');
        console.log('\n--- 🎉 Migration V6 completed successfully! ---');

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
