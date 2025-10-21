// public/js/main.js

import { initNavigation } from './modules/navigation.js';
import { initPlayerForm } from './modules/playerForm.js';
import { initLeaderboardFilters } from './modules/leaderboardFilters.js';
import { initPerilousTrials } from './modules/perilousTrials.js'; // Assurez-vous que l'import est correct
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

// Fonction globale pour afficher les notes
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
const initialPlayerModalZIndex = playerDetailModal?.style.zIndex || 1001;
const initialPlayerBackdropZIndex = playerDetailBackdrop?.style.zIndex || 1000;

// Map pour stocker les rangs des joueurs
const playerRankMap = new Map();
// Map pour stocker les données complètes des joueurs par leur nom
const allPlayersMap = new Map();

// MODIFIÉ : La fonction est maintenant définie ici pour être passée en argument
function showPlayerDetails(playerRow, isFromTeamModal = false) {
    if (!playerDetailModal || !playerRow) return;

    if (isFromTeamModal) {
        playerDetailModal.style.zIndex = '1011';
        playerDetailBackdrop.style.zIndex = '1010';
    } else {
        playerDetailModal.style.zIndex = initialPlayerModalZIndex;
        playerDetailBackdrop.style.zIndex = initialPlayerBackdropZIndex;
    }


    const data = playerRow.dataset;
    // NOUVEAU: Essayer de récupérer l'objet joueur complet si possible pour des données plus fiables
    const fullPlayerData = allPlayersMap.get(data.name);
    const playSlots = fullPlayerData?.play_slots ? fullPlayerData.play_slots : JSON.parse(data.playSlots || '[]');
    const notes = fullPlayerData?.notes ? fullPlayerData.notes : data.notes;
    const combatPower = fullPlayerData?.combat_power ? fullPlayerData.combat_power : data.cp;
    const playerClass = fullPlayerData?.class ? fullPlayerData.class : data.class;
    const guild = fullPlayerData?.guild ? fullPlayerData.guild : data.guild;
    const team = fullPlayerData?.team ? fullPlayerData.team : data.team;
    const updatedAt = fullPlayerData?.updated_at ? fullPlayerData.updated_at : data.updated;


    let playHoursHtml = '-';
    // Vérification plus robuste de playSlots
    if (Array.isArray(playSlots) && playSlots.length > 0 && playSlots[0] && playSlots[0].start_minutes !== undefined) {
        playHoursHtml = playSlots.map(slot =>
            `<div>${minutesToFormattedTime(slot.start_minutes)} - ${minutesToFormattedTime(slot.end_minutes)}</div>`
        ).join('');
    }

    playerDetailTitle.innerHTML = `<span class="class-tag class-${String(playerClass || 'unknown').toLowerCase()}">${data.name}</span>`;

    playerDetailBody.innerHTML = `
        <ul class="player-detail-list">
            <li><strong>Rank:</strong> <span>${data.rank || 'N/A'}</span></li>
            <li><strong>CP:</strong> <span>${formatCP(combatPower)}</span></li>
            <li><strong>Class:</strong> <span><span class="class-tag class-${String(playerClass || 'unknown').toLowerCase()}">${playerClass || 'Unknown'}</span></span></li>
            <li><strong>Guild:</strong> <span>${guild || '-'}</span></li>
            <li><strong>Team:</strong> <span>${team || '-'}</span></li>
            <li><strong>Play Hours:</strong> ${playHoursHtml}</li>
            <li><strong>Notes:</strong> <span>${notes || '-'}</span></li>
            <li><strong>Updated:</strong> <span>${formatRelativeTimeShort(updatedAt)}</span></li>
        </ul>
    `;

    playerDetailModal.style.display = 'flex';
    playerDetailBackdrop.style.display = 'block';
}

function closePlayerDetailModal() {
    if (playerDetailModal) playerDetailModal.style.display = 'none';
    if (playerDetailBackdrop) playerDetailBackdrop.style.display = 'none';
}

// --- MODALE DE DÉTAIL D'ÉQUIPE (MOBILE) ---
const teamDetailModal = document.getElementById('team-detail-modal');
const teamDetailBackdrop = document.getElementById('team-detail-modal-backdrop');
const teamDetailTitle = document.getElementById('team-detail-modal-title');
const teamDetailBody = document.getElementById('team-detail-modal-body');
const teamDetailCloseBtn = document.getElementById('team-detail-close-btn');

const shortClassLegendHtml = `
 <div class="leaderboard-legend short-legend">
    <div class="legend-item"><span class="class-tag class-swordbearer"></span> Swd</div>
    <div class="legend-item"><span class="class-tag class-acolyte"></span> Aco</div>
    <div class="legend-item"><span class="class-tag class-wayfarer"></span> Way</div>
    <div class="legend-item"><span class="class-tag class-scholar"></span> Sch</div>
    <div class="legend-item"><span class="class-tag class-shadowlash"></span> Sha</div>
 </div>
 `;

function showTeamDetails(teamRow) {
    if (!teamDetailModal || !teamRow) return;
    const data = teamRow.dataset;
    const members = JSON.parse(data.members || '[]');
    const guildName = data.guildName;
    const teamName = data.teamName;

    teamDetailTitle.innerHTML = `<span class="guild-prefix">[${guildName}]</span> <span class="team-name">${teamName}</span>`;

    let membersHtml = '<div class="team-detail-list">';
    members.forEach((player, index) => {
        membersHtml += `
            <div class="team-detail-player" data-player-name="${player.name}">
                <span class="class-tag class-${String(player.class || 'unknown').toLowerCase()}">${player.name}</span>
                <span class="team-detail-player-cp">${formatCP(player.combat_power)}</span>
            </div>
        `;
    });
    membersHtml += '</div>';

    teamDetailBody.innerHTML = membersHtml + shortClassLegendHtml;

    teamDetailBody.querySelectorAll('.team-detail-player').forEach(playerEl => {
        playerEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const playerName = playerEl.dataset.playerName;
            const player = allPlayersMap.get(playerName);
            if (player) {
                const fakeRow = {
                    dataset: {
                        ...player,
                        rank: playerRankMap.get(playerName) || 'N/A',
                        cp: player.combat_power,
                        playSlots: JSON.stringify(player.play_slots || '[]'),
                        updated: player.updated_at
                    }
                };
                showPlayerDetails(fakeRow, true);
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

// --- MODALE DE DÉTAIL DE GUILDE (MOBILE) ---
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
        <div class="guild-class-distrib centered">
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
            <li class="distrib-item">
                <strong class="centered-title">Class Distribution</strong>
                ${classDistribHtml}
                ${shortClassLegendHtml}
            </li>
        </ul>
    `;

    guildDetailModal.style.display = 'flex';
    guildDetailBackdrop.style.display = 'block';
}

function closeGuildDetailModal() {
    if (guildDetailModal) guildDetailModal.style.display = 'none';
    if (guildDetailBackdrop) guildDetailBackdrop.style.display = 'none';
}


// --- MODALE DE FILTRES (JOUEURS UNIQUEMENT) ---
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


document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initPlayerForm();
    initLeaderboardFilters(); // Filtres JOUEURS uniquement via modale

    // Peupler les maps AVANT d'initialiser PT
    const playersDataEl = document.getElementById('players-data');
    if (playersDataEl) {
        try {
            const playersData = JSON.parse(playersDataEl.textContent || '[]');
            playersData.forEach(p => allPlayersMap.set(p.name, p));
        } catch (e) {
            console.error("Erreur lors du parsing des données joueurs:", e);
        }
    }
    document.querySelectorAll('#leaderboard-table tbody tr').forEach(row => {
        playerRankMap.set(row.dataset.name, row.dataset.rank);
        if (!allPlayersMap.has(row.dataset.name)) {
            try {
                const playerData = {
                    id: row.dataset.id || null, // Assumer qu'un data-id existe ou ajouter le
                    name: row.dataset.name,
                    class: row.dataset.class,
                    combat_power: row.dataset.cp,
                    team: row.dataset.team,
                    guild: row.dataset.guild,
                    notes: row.dataset.notes,
                    updated_at: row.dataset.updated,
                    play_slots: JSON.parse(row.dataset.playSlots || '[]'),
                    pt_tags: JSON.parse(row.dataset.ptTags || '[]')
                };
                allPlayersMap.set(playerData.name, playerData);
            } catch(e){
                console.error("Erreur lors de la reconstruction des données joueur depuis data-*:", e, row.dataset.name);
            }
        }
    });

    // MODIFIÉ: Passer les arguments nécessaires à initPerilousTrials
    initPerilousTrials(showPlayerDetails, allPlayersMap);

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
            if (e.target.closest('.notes-col') || e.target.closest('.admin-actions')) {
                return;
            }
            if (window.innerWidth <= 768) {
                e.preventDefault();
                showPlayerDetails(playerRow);
            }
        });
    }

    // --- ÉVÉNEMENTS POUR LA MODALE DE FILTRES JOUEURS ---
    if (openFiltersBtn) openFiltersBtn.addEventListener('click', openFiltersModal);
    if (closeFiltersBtn) closeFiltersBtn.addEventListener('click', closeFiltersModal);
    if (filtersBackdrop) filtersBackdrop.addEventListener('click', closeFiltersModal);

    // --- ÉVÉNEMENTS POUR LES MODALES DE DÉTAIL (ÉQUIPE/GUILDE) ---
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

    // --- Logique pour le filtre mobile des équipes ---
    const teamMobileFilter = document.getElementById('team-guild-filter-mobile');
    const allTeamRows = document.querySelectorAll('#teams-leaderboard-table tbody tr.team-data-row');

    function applyTeamMobileFilter() {
        if (!teamMobileFilter) return;
        const selectedGuild = teamMobileFilter.value;
        let visibleRank = 1;
        allTeamRows.forEach(row => {
            const memberCount = parseInt(row.dataset.memberCountVal || 0, 10);
            const isVisible = (selectedGuild === 'All') ||
                (selectedGuild === 'Incomplete' && memberCount < 4) ||
                (row.dataset.guildName === selectedGuild);

            row.style.display = isVisible ? '' : 'none';
            if (row.nextElementSibling && row.nextElementSibling.classList.contains('team-members-row')) {
                row.nextElementSibling.style.display = 'none';
            }


            if (isVisible) {
                const rankCell = row.querySelector('.rank-col');
                if (rankCell) rankCell.textContent = visibleRank;

                row.classList.remove('rank-1', 'rank-2', 'rank-3');
                if(visibleRank <= 3) row.classList.add(`rank-${visibleRank}`);
                visibleRank++;
            }
        });
    }

    if (teamMobileFilter) {
        teamMobileFilter.addEventListener('change', applyTeamMobileFilter);
        if (window.innerWidth <= 768) {
            applyTeamMobileFilter();
        }
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768 && teamMobileFilter) {
            applyTeamMobileFilter();
        } else if (window.innerWidth > 768) {
            allTeamRows.forEach(row => {
                row.style.display = '';
                const rankCell = row.querySelector('.rank-col');
                // Note: idéalement, il faudrait relire le rang initial ou recalculer
            });
            document.querySelectorAll('#teams-leaderboard-table tbody tr.team-members-row').forEach(row => {
                row.style.display = 'none';
            });

        }
    });

});