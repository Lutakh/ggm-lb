import { initNavigation } from './modules/navigation.js';
import { initPlayerForm } from './modules/playerForm.js';
import { initLeaderboardFilters } from './modules/leaderboardFilters.js';
import { initPerilousTrials } from './modules/perilousTrials.js';
import { updateTimers, formatCP, formatRelativeTime, formatRelativeTimeShort, minutesToFormattedTime } from './modules/utils.js';
import { initDiscordWidget } from './modules/discordWidget.js';

// --- MODALE DES NOTES ---
const notesModal = document.getElementById('notes-modal');
const notesBackdrop = document.getElementById('notes-modal-backdrop');
const notesTitle = document.getElementById('notes-modal-title');
const notesBody = document.getElementById('notes-modal-body');
const notesCloseBtn = document.getElementById('notes-modal-close-btn');

function closeNotesModal() {
    if (notesModal) notesModal.style.display = 'none';
    if (notesBackdrop) notesBackdrop.style.display = 'none';
}

window.showFullNote = function(playerName, note) {
    if (!note || note.trim() === '' || note.trim() === '-') return;
    notesTitle.textContent = `Notes for ${playerName}`;
    notesBody.textContent = note;
    notesModal.style.display = 'flex';
    notesBackdrop.style.display = 'block';
}

// --- MODALE DE DÉTAIL DU JOUEUR (MOBILE) ---
const playerDetailModal = document.getElementById('player-detail-modal');
const playerDetailBackdrop = document.getElementById('player-detail-modal-backdrop');
const playerDetailTitle = document.getElementById('player-detail-modal-title');
const playerDetailBody = document.getElementById('player-detail-modal-body');
const playerDetailCloseBtn = document.getElementById('player-detail-modal-close-btn');

function showPlayerDetails(playerRow) {
    if (!playerDetailModal || !playerRow) return;

    const data = playerRow.dataset;
    const playSlots = JSON.parse(data.playSlots || '[]');

    let playHoursHtml = '-';
    if (playSlots.length > 0 && playSlots[0] !== null) {
        playHoursHtml = playSlots.map(slot =>
            `<div>${minutesToFormattedTime(slot.start_minutes)} - ${minutesToFormattedTime(slot.end_minutes)}</div>`
        ).join('');
    }

    playerDetailTitle.innerHTML = `<span class="class-tag class-${data.class.toLowerCase()}">${data.name}</span>`;

    // MODIFICATION (Req 1) : Ajout de la ligne pour la classe
    playerDetailBody.innerHTML = `
        <ul class="player-detail-list">
            <li><strong>Rank:</strong> <span>${data.rank}</span></li>
            <li><strong>CP:</strong> <span>${formatCP(data.cp)}</span></li>
            <li><strong>Class:</strong> <span><span class="class-tag class-${data.class.toLowerCase()}">${data.class}</span></span></li>
            <li><strong>Guild:</strong> <span>${data.guild || '-'}</span></li>
            <li><strong>Team:</strong> <span>${data.team || '-'}</span></li>
            <li><strong>Play Hours:</strong> ${playHoursHtml}</li>
            <li><strong>Notes:</strong> <span>${data.notes || '-'}</span></li>
            <li><strong>Updated:</strong> <span>${formatRelativeTimeShort(data.updated)}</span></li>
        </ul>
    `;

    playerDetailModal.style.display = 'flex';
    playerDetailBackdrop.style.display = 'block';
}

function closePlayerDetailModal() {
    if (playerDetailModal) playerDetailModal.style.display = 'none';
    if (playerDetailBackdrop) playerDetailBackdrop.style.display = 'none';
}

// --- MODALE DE FILTRES ---
const filtersModal = document.getElementById('filters-modal');
const filtersBackdrop = document.getElementById('filters-modal-backdrop');
const openFiltersBtn = document.getElementById('open-filters-btn');
const closeFiltersBtn = document.getElementById('filters-modal-close-btn');

function openFiltersModal() {
    if (filtersModal) filtersModal.style.display = 'flex';
    if (filtersBackdrop) filtersBackdrop.style.display = 'block';
}
function closeFiltersModal() {
    if (filtersModal) filtersModal.style.display = 'none';
    if (filtersBackdrop) filtersBackdrop.style.display = 'none';
}

// --- NOUVELLE MODALE POUR LES TIMERS MOBILES (Req 3) ---
const timerDetailModal = document.getElementById('timer-detail-modal');
const timerDetailBackdrop = document.getElementById('timer-detail-modal-backdrop');
const timerDetailTitle = document.getElementById('timer-detail-modal-title');
const timerDetailBody = document.getElementById('timer-detail-modal-body');
const timerDetailCloseBtn = document.getElementById('timer-detail-modal-close-btn');

function showTimerDetails(timerElement) {
    if (!timerElement || !timerDetailModal) return;

    const type = timerElement.dataset.timerType; // paper-plane ou class-change
    const title = timerElement.querySelector('.timer-label').textContent;
    let tooltipContent = '';

    // Trouver le contenu du tooltip associé (caché en CSS sur mobile)
    const tooltipElement = timerElement.querySelector('.timer-tooltip');
    if (tooltipElement) {
        tooltipContent = tooltipElement.innerHTML; // Copie le HTML interne du tooltip
    } else {
        tooltipContent = "<p>No further details available.</p>"; // Fallback
    }

    timerDetailTitle.textContent = title.replace(' in', ''); // Enlève " in" du titre
    timerDetailBody.innerHTML = tooltipContent; // Injecte le contenu du tooltip

    timerDetailModal.style.display = 'flex';
    timerDetailBackdrop.style.display = 'block';
}

function closeTimerDetailModal() {
    if (timerDetailModal) timerDetailModal.style.display = 'none';
    if (timerDetailBackdrop) timerDetailBackdrop.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initPlayerForm();
    initLeaderboardFilters();
    initPerilousTrials();
    initDiscordWidget('https://discord.com/api/guilds/1425816979641466912/widget.json');

    setInterval(updateTimers, 1000);
    updateTimers();

    document.querySelectorAll('.cp-display').forEach(el => {
        el.textContent = formatCP(el.dataset.cp);
    });

    document.querySelectorAll('[data-timestamp]').forEach(el => {
        el.textContent = formatRelativeTimeShort(el.dataset.timestamp);
    });

    // --- MODALE DES NOTES ---
    if (notesCloseBtn) notesCloseBtn.addEventListener('click', closeNotesModal);
    if (notesBackdrop) notesBackdrop.addEventListener('click', closeNotesModal);

    // --- MODALE DÉTAIL JOUEUR (MOBILE) ---
    if (playerDetailCloseBtn) playerDetailCloseBtn.addEventListener('click', closePlayerDetailModal);
    if (playerDetailBackdrop) playerDetailBackdrop.addEventListener('click', closePlayerDetailModal);

    const playerTableBody = document.querySelector('#leaderboard-table tbody');
    if (playerTableBody) {
        playerTableBody.addEventListener('click', (e) => {
            const playerRow = e.target.closest('tr');
            if (!playerRow) return;
            if (e.target.closest('.notes-col') || e.target.closest('.admin-actions')) return;
            if (window.innerWidth <= 768) {
                e.preventDefault();
                showPlayerDetails(playerRow);
            }
        });
    }

    // --- MODALE DE FILTRES ---
    if (openFiltersBtn) openFiltersBtn.addEventListener('click', openFiltersModal);
    if (closeFiltersBtn) closeFiltersBtn.addEventListener('click', closeFiltersModal);
    if (filtersBackdrop) filtersBackdrop.addEventListener('click', closeFiltersModal);

    // --- NOUVELLE MODALE DE TIMERS MOBILES (Req 3) ---
    if (timerDetailCloseBtn) timerDetailCloseBtn.addEventListener('click', closeTimerDetailModal);
    if (timerDetailBackdrop) timerDetailBackdrop.addEventListener('click', closeTimerDetailModal);

    // Ajouter des écouteurs de clic aux timers concernés (Paper Plane & Class Change) sur mobile
    document.querySelectorAll('.timer-entry[data-timer-type="paper-plane"], .timer-entry[data-timer-type="class-change"]').forEach(timerEntry => {
        timerEntry.addEventListener('click', () => {
            // N'ouvre la modale que sur mobile
            if (window.innerWidth <= 768) {
                showTimerDetails(timerEntry);
            }
        });
    });

});