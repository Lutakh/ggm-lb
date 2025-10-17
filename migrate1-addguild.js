// migrate-v3.js (Corrigé)
const sqlite3 = require('sqlite3').verbose();

// Se connecter à la base de données existante
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        return console.error("Erreur de connexion à la base de données :", err.message);
    }
    console.log('Connecté à la base de données de production.');
});

db.serialize(() => {
    console.log('Démarrage du processus de migration...');

    // Étape 1: Créer la table des guildes
    db.run(`
        CREATE TABLE IF NOT EXISTS guilds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    `, (err) => {
        if (err) return console.error("Erreur création table guilds:", err.message);
        console.log("Étape 1/4 : Table 'guilds' créée.");

        // Étape 2: Ajouter la colonne 'guild' (MAINTENANT À L'INTÉRIEUR DU CALLBACK)
        db.run(`ALTER TABLE players ADD COLUMN guild TEXT`, (err) => {
            if (err && !err.message.includes("duplicate column")) {
                return console.error("Erreur ajout colonne guild:", err.message);
            }
            console.log("Étape 2/4 : Colonne 'guild' ajoutée aux joueurs.");

            // Étape 3: Créer la guilde par défaut
            db.run(`INSERT OR IGNORE INTO guilds (name) VALUES ('Olympus')`, (err) => {
                if (err) return console.error("Erreur insertion guilde par défaut:", err.message);
                console.log("Étape 3/4 : Guilde par défaut 'Olympus' assurée.");
                
                // Étape 4: Assigner la guilde par défaut aux joueurs existants
                db.run(`UPDATE players SET guild = 'Olympus' WHERE guild IS NULL OR guild = ''`, (err) => {
                    if (err) return console.error("Erreur MAJ joueurs existants:", err.message);
                    console.log("Étape 4/4 : Joueurs existants assignés à la guilde 'Olympus'.");
                    
                    // On ne ferme la base de données qu'une fois que TOUT est terminé.
                    db.close((err) => {
                        if (err) return console.error("Erreur lors de la fermeture de la DB :", err.message);
                        console.log('\n✅ Migration terminée avec succès !');
                    });
                });
            });
        });
    });
});
