import { initNavigation } from './modules/navigation.js';
import { initPlayerForm } from './modules/playerForm.js';
import { initLeaderboardFilters } from './modules/leaderboardFilters.js';
import { initPerilousTrials } from './modules/perilousTrials.js';
// MODIFICATION : Ajout de minutesToFormattedTime
import { updateTimers, formatCP, formatRelativeTime, minutesToFormattedTime } from './modules/utils.js';
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

// --- NOUVELLE LOGIQUE POUR LA MODALE DE DÉTAIL DU JOUEUR (MOBILE) ---
const playerDetailModal = document.getElementById('player-detail-modal');
const playerDetailBackdrop = document.getElementById('player-detail-modal-backdrop');
const playerDetailTitle = document.getElementById('player-detail-modal-title');
const playerDetailBody = document.getElementById('player-detail-modal-body');
const playerDetailCloseBtn = document.getElementById('player-detail-modal-close-btn');

/**
 * Ouvre la modale de détail du joueur et la remplit avec les données de la ligne.
 * @param {HTMLElement} playerRow - L'élément TR qui a été cliqué.
 */
function showPlayerDetails(playerRow) {
    if (!playerDetailModal || !playerRow) return;

    const data = playerRow.dataset;
    const playSlots = JSON.parse(data.playSlots || '[]');

    let playHoursHtml = '-';
    if (playSlots.length > 0) {
        playHoursHtml = playSlots.map(slot =>
            // Utilise la fonction importée pour formater les heures
            `<div>${minutesToFormattedTime(slot.start_minutes)} - ${minutesToFormattedTime(slot.end_minutes)}</div>`
        ).join('');
    }

    // Remplit le titre avec le nom et le tag de classe
    playerDetailTitle.innerHTML = `<span class="class-tag class-${data.class.toLowerCase()}">${data.name}</span>`;

    // Remplit le corps avec une liste de détails
    playerDetailBody.innerHTML = `
        <ul class="player-detail-list">
            <li><strong>Rank:</strong> <span>${data.rank}</span></li>
            <li><strong>CP:</strong> <span>${formatCP(data.cp)}</span></li>
            <li><strong>Guild:</strong> <span>${data.guild || '-'}</span></li>
            <li><strong>Team:</strong> <span>${data.team || '-'}</span></li>
            <li><strong>Play Hours:</strong> ${playHoursHtml}</li>
            <li><strong>Notes:</strong> <span>${data.notes || '-'}</span></li>
            <li><strong>Updated:</strong> <span>${formatRelativeTime(data.updated)}</span></li>
        </ul>
    `;

    playerDetailModal.style.display = 'flex';
    playerDetailBackdrop.style.display = 'block';
}

/**
 * Ferme la modale de détail du joueur.
 */
function closePlayerDetailModal() {
    if (playerDetailModal) playerDetailModal.style.display = 'none';
    if (playerDetailBackdrop) playerDetailBackdrop.style.display = 'none';
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

    // --- NOUVEAUX ÉVÉNEMENTS POUR LA MODALE DE DÉTAIL DU JOUEUR ---
    if (playerDetailCloseBtn) playerDetailCloseBtn.addEventListener('click', closePlayerDetailModal);
    if (playerDetailBackdrop) playerDetailBackdrop.addEventListener('click', closePlayerDetailModal);

    // Ajouter un écouteur de clic au corps du tableau des joueurs
    const playerTableBody = document.querySelector('#leaderboard-table tbody');
    if (playerTableBody) {
        playerTableBody.addEventListener('click', (e) => {
            const playerRow = e.target.closest('tr');

            // Ne rien faire si la ligne n'est pas trouvée
            if (!playerRow) return;

            // Ne pas déclencher si on clique sur la colonne des notes (qui a son propre modal)
            // ou sur les actions admin (qui ont leurs propres clics)
            if (e.target.closest('.notes-col') || e.target.closest('.admin-actions')) {
                return;
            }

            // Si l'écran est petit (mobile, vérifié via CSS media query), on ouvre la modale
            // window.innerWidth est un bon proxy pour savoir si on est en affichage mobile
            if (window.innerWidth <= 768) {
                e.preventDefault();
                showPlayerDetails(playerRow);
            }
        });
    }
});