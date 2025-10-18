import { initNavigation } from './modules/navigation.js';
import { initPlayerForm } from './modules/playerForm.js';
import { initLeaderboardFilters } from './modules/leaderboardFilters.js';
import { initPerilousTrials } from './modules/perilousTrials.js';
import { updateTimers, formatCP, formatRelativeTime } from './modules/utils.js';
import { initDiscordWidget } from './modules/discordWidget.js'; // AJOUT : Import de la nouvelle fonction

// --- NOUVELLE LOGIQUE POUR LA MODALE DES NOTES ---
const notesModal = document.getElementById('notes-modal');
const notesBackdrop = document.getElementById('notes-modal-backdrop');
const notesTitle = document.getElementById('notes-modal-title');
const notesBody = document.getElementById('notes-modal-body');
const notesCloseBtn = document.getElementById('notes-modal-close-btn');

function closeNotesModal() {
    if (notesModal) notesModal.style.display = 'none';
    if (notesBackdrop) notesBackdrop.style.display = 'none';
}

// La fonction est maintenant attachée à l'objet window pour rester accessible depuis l'attribut onclick
window.showFullNote = function(playerName, note) {
    if (!note || note.trim() === '' || note.trim() === '-') {
        return;
    }

    notesTitle.textContent = `Notes for ${playerName}`;
    notesBody.textContent = note;

    notesModal.style.display = 'flex';
    notesBackdrop.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initPlayerForm();
    initLeaderboardFilters();
    initPerilousTrials();

    // AJOUT : Appel de la fonction pour le widget Discord
    initDiscordWidget('https://discord.com/api/guilds/1425816979641466912/widget.json');

    setInterval(updateTimers, 1000);
    updateTimers();

    document.querySelectorAll('.cp-display').forEach(el => {
        el.textContent = formatCP(el.dataset.cp);
    });

    document.querySelectorAll('[data-timestamp]').forEach(el => {
        el.textContent = formatRelativeTime(el.dataset.timestamp);
    });

    // Ajout des écouteurs pour fermer la modale des notes
    if (notesCloseBtn) notesCloseBtn.addEventListener('click', closeNotesModal);
    if (notesBackdrop) notesBackdrop.addEventListener('click', closeNotesModal);
});