// public/js/main.js

import { initNavigation } from './modules/navigation.js';
import { initPlayerForm } from './modules/playerForm.js';
import { initLeaderboardFilters } from './modules/leaderboardFilters.js';
import { initPerilousTrials } from './modules/perilousTrials.js';
// MODIFICATION : Ajout de minutesToFormattedTime et formatRelativeTimeShort
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
    if (!note || note.trim() === '' || note.trim() === '-') {
        return;
    }
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

// Map pour stocker les rangs des joueurs
const playerRankMap = new Map();
// Map pour stocker les données complètes des joueurs par leur nom
const allPlayersMap = new Map();

function showPlayerDetails(playerRow) {
    if (!playerDetailModal || !playerRow) return;

    const data = playerRow.dataset;
    const playSlots = JSON.parse(data.playSlots || '[]');

    let playHoursHtml = '-';
    if (playSlots.length > 0 && playSlots[0] !== null) { // Vérifie que playSlots n'est pas juste [null]
        playHoursHtml = playSlots.map(slot =>
            `<div>${minutesToFormattedTime(slot.start_minutes)} - ${minutesToFormattedTime(slot.end_minutes)}</div>`
        ).join('');
    }

    playerDetailTitle.innerHTML = `<span class="class-tag class-${data.class.toLowerCase()}">${data.name}</span>`;

    // --- MODIFICATION ICI ---
    // Ajout de la ligne pour la Classe
    playerDetailBody.innerHTML = `
        <ul class="player-detail-list">
            <li><strong>Rank:</strong> <span>${data.rank || 'N/A'}</span></li>
            <li><strong>CP:</strong> <span>${formatCP(data.cp)}</span></li>
            <li><strong>Class:</strong> <span><span class="class-tag class-${data.class.toLowerCase()}">${data.class}</span></span></li>
            <li><strong>Guild:</strong> <span>${data.guild || '-'}</span></li>
            <li><strong>Team:</strong> <span>${data.team || '-'}</span></li>
            <li><strong>Play Hours:</strong> ${playHoursHtml}</li>
            <li><strong>Notes:</strong> <span>${data.notes || '-'}</span></li>
            <li><strong>Updated:</strong> <span>${formatRelativeTimeShort(data.updated)}</span></li>
        </ul>
    `;
    // --- FIN DE LA MODIFICATION ---

    playerDetailModal.style.display = 'flex';
    playerDetailBackdrop.style.display = 'block';
}

function closePlayerDetailModal() {
    if (playerDetailModal) playerDetailModal.style.display = 'none';
    if (playerDetailBackdrop) playerDetailBackdrop.style.display = 'none';
}

// --- NOUVELLE MODALE DE DÉTAIL D'ÉQUIPE (MOBILE) ---
const teamDetailModal = document.getElementById('team-detail-modal');
const teamDetailBackdrop = document.getElementById('team-detail-modal-backdrop');
const teamDetailTitle = document.getElementById('team-detail-modal-title');
const teamDetailBody = document.getElementById('team-detail-modal-body');
const teamDetailCloseBtn = document.getElementById('team-detail-close-btn');

function showTeamDetails(teamRow) {
    if (!teamDetailModal || !teamRow) return;
    const data = teamRow.dataset;
    const members = JSON.parse(data.members || '[]');

    teamDetailTitle.innerHTML = `<span>${data.teamName}</span><span class="guild-name-modal">${data.guildName}</span>`;

    let membersHtml = '<div class="team-detail-list">';
    members.forEach((player, index) => {
        membersHtml += `
            <div class="team-detail-player" data-player-name="${player.name}">
                <span class="team-detail-player-cp">${formatCP(player.combat_power)}</span>
                <span class="class-tag class-${player.class.toLowerCase()}">${player.name}</span>
            </div>
        `;
    });
    membersHtml += '</div>';
    teamDetailBody.innerHTML = membersHtml;

    // Attacher les écouteurs pour le clic nidé
    teamDetailBody.querySelectorAll('.team-detail-player').forEach(playerEl => {
        playerEl.addEventListener('click', (e) => {
            e.stopPropagation(); // Empêche la fermeture de la modale d'équipe
            const playerName = playerEl.dataset.playerName;
            const player = allPlayersMap.get(playerName);
            if (player) {
                // Créer un objet "fakeRow" pour passer à showPlayerDetails
                const fakeRow = {
                    dataset: {
                        ...player,
                        rank: playerRankMap.get(playerName) || 'N/A', // Récupérer le rang individuel
                        cp: player.combat_power,
                        playSlots: JSON.stringify(player.play_slots || '[]'),
                        updated: player.updated_at
                    }
                };
                showPlayerDetails(fakeRow);
            }
        });
    });

    teamDetailModal.style.display = 'flex';
    teamDetailBackdrop.style.display = 'block';
}

function closeTeamDetailModal() {
    if (teamDetailModal) teamDetailModal.style.display = 'none';
    if (teamDetailBackdrop) teamDetailBackdrop.style.display = 'none';
}

// --- NOUVELLE MODALE DE DÉTAIL DE GUILDE (MOBILE) ---
const guildDetailModal = document.getElementById('guild-detail-modal');
const guildDetailBackdrop = document.getElementById('guild-detail-modal-backdrop');
const guildDetailTitle = document.getElementById('guild-detail-modal-title');
const guildDetailBody = document.getElementById('guild-detail-modal-body');
const guildDetailCloseBtn = document.getElementById('guild-detail-close-btn');

function showGuildDetails(guildRow) {
    if (!guildDetailModal || !guildRow) return;
    const data = guildRow.dataset;
    const classDistrib = JSON.parse(data.classDistrib || '{}');

    guildDetailTitle.textContent = data.guildName;

    const classDistribHtml = `
        <div class="guild-class-distrib">
            <span class="class-tag class-swordbearer" title="Swordbearer">${classDistrib.Swordbearer || 0}</span>
            <span class="class-tag class-acolyte" title="Acolyte">${classDistrib.Acolyte || 0}</span>
            <span class="class-tag class-wayfarer" title="Wayfarer">${classDistrib.Wayfarer || 0}</span>
            <span class="class-tag class-scholar" title="Scholar">${classDistrib.Scholar || 0}</span>
            <span class="class-tag class-shadowlash" title="Shadowlash">${classDistrib.Shadowlash || 0}</span>
        </div>
    `;

    guildDetailBody.innerHTML = `
        <ul class="guild-detail-list">
            <li><strong>Rank:</strong> <span>${data.rank}</span></li>
            <li><strong>Total CP:</strong> <span>${formatCP(data.totalCp)}</span></li>
            <li><strong>Members:</strong> <span>${data.memberCount} / 120</span></li>
            <li><strong>Class Distribution:</strong> ${classDistribHtml}</li>
        </ul>
    `;

    guildDetailModal.style.display = 'flex';
    guildDetailBackdrop.style.display = 'block';
}

function closeGuildDetailModal() {
    if (guildDetailModal) guildDetailModal.style.display = 'none';
    if (guildDetailBackdrop) guildDetailBackdrop.style.display = 'none';
}


// --- NOUVELLE MODALE DE FILTRES (Req 1) ---
const filtersModal = document.getElementById('filters-modal');
const filtersBackdrop = document.getElementById('filters-modal-backdrop');
const openFiltersBtn = document.getElementById('open-filters-btn');
const openFiltersBtnTeams = document.getElementById('open-filters-btn-teams'); // Nouveau
const openFiltersBtnGuilds = document.getElementById('open-filters-btn-guilds'); // Nouveau
const closeFiltersBtn = document.getElementById('filters-modal-close-btn');

function openFiltersModal() {
    if (filtersModal) filtersModal.style.display = 'flex';
    if (filtersBackdrop) filtersBackdrop.style.display = 'block';
}
function closeFiltersModal() {
    if (filtersModal) filtersModal.style.display = 'none';
    if (filtersBackdrop) filtersBackdrop.style.display = 'none';
}


document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initPlayerForm();
    initLeaderboardFilters();
    initPerilousTrials();
    initDiscordWidget('https://discord.com/api/guilds/1425816979641466912/widget.json');

    setInterval(updateTimers, 1000);
    updateTimers();

    // Peupler les maps de joueurs pour les modales
    const playersDataEl = document.getElementById('players-data');
    if (playersDataEl) {
        const allPlayers = JSON.parse(playersDataEl.textContent);
        allPlayers.forEach(p => allPlayersMap.set(p.name, p));
    }
    document.querySelectorAll('#leaderboard-table tbody tr').forEach(row => {
        playerRankMap.set(row.dataset.name, row.dataset.rank);
    });


    document.querySelectorAll('.cp-display').forEach(el => {
        el.textContent = formatCP(el.dataset.cp);
    });

    // MODIFICATION (Req 3) : Utilise le format court pour la date
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
            if (e.target.closest('.notes-col') || e.target.closest('.admin-actions')) {
                return;
            }
            // Ouvre la modale de détail uniquement sur mobile
            if (window.innerWidth <= 768) {
                e.preventDefault();
                showPlayerDetails(playerRow);
            }
        });
    }

    // --- NOUVEAUX ÉVÉNEMENTS POUR LA MODALE DE FILTRES (Req 1) ---
    if (openFiltersBtn) openFiltersBtn.addEventListener('click', openFiltersModal);
    if (openFiltersBtnTeams) openFiltersBtnTeams.addEventListener('click', openFiltersModal); // Nouveau
    if (openFiltersBtnGuilds) openFiltersBtnGuilds.addEventListener('click', openFiltersModal); // Nouveau
    if (closeFiltersBtn) closeFiltersBtn.addEventListener('click', closeFiltersModal);
    if (filtersBackdrop) filtersBackdrop.addEventListener('click', closeFiltersModal);

    // --- NOUVEAUX ÉVÉNEMENTS POUR LES MODALES DE DÉTAIL (ÉQUIPE/GUILDE) ---
    if (teamDetailCloseBtn) teamDetailCloseBtn.addEventListener('click', closeTeamDetailModal);
    if (teamDetailBackdrop) teamDetailBackdrop.addEventListener('click', closeTeamDetailModal);
    if (guildDetailCloseBtn) guildDetailCloseBtn.addEventListener('click', closeGuildDetailModal);
    if (guildDetailBackdrop) guildDetailBackdrop.addEventListener('click', closeGuildDetailModal);

    const teamTableBody = document.getElementById('teams-tbody');
    if (teamTableBody) {
        teamTableBody.addEventListener('click', (e) => {
            const teamRow = e.target.closest('.team-data-row');
            if (!teamRow) return;
            if (window.innerWidth <= 768) {
                e.preventDefault();
                showTeamDetails(teamRow);
            }
        });
    }

    const guildTableBody = document.getElementById('guilds-tbody');
    if (guildTableBody) {
        guildTableBody.addEventListener('click', (e) => {
            const guildRow = e.target.closest('tr');
            if (!guildRow) return;
            if (window.innerWidth <= 768) {
                e.preventDefault();
                showGuildDetails(guildRow);
            }
        });
    }
});