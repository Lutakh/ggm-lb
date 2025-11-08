// public/js/main.js
import { initNavigation } from './modules/navigation.js';
import { initPlayerForm } from './modules/playerForm.js';
import { initLeaderboardFilters } from './modules/leaderboardFilters.js';
import { initPerilousTrials } from './modules/perilousTrials.js';
import { initDailyQuests } from './modules/dailyQuests.js';
import { initPlayerSelectModal } from './modules/playerSelectModal.js';
import { updateTimers, formatCP, formatRelativeTimeShort, minutesToFormattedTime } from './modules/utils.js';
import { initDiscordWidget } from './modules/discordWidget.js';
import { initTeamPlanner } from './modules/teamPlanner.js';
import { initGuildSelectModal } from './modules/guildSelectModal.js';

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
    if (notesTitle) notesTitle.textContent = `Notes for ${playerName}`;
    if (notesBody) notesBody.textContent = note;
    if (notesModal) notesModal.style.display = 'flex';
    if (notesBackdrop) notesBackdrop.style.display = 'block';
}

// --- MODALE DE DÉTAIL DU JOUEUR (MOBILE) ---
const playerDetailModal = document.getElementById('player-detail-modal');
const playerDetailBackdrop = document.getElementById('player-detail-modal-backdrop');
const playerDetailTitle = document.getElementById('player-detail-modal-title');
const playerDetailBody = document.getElementById('player-detail-modal-body');
const playerDetailCloseBtn = document.getElementById('player-detail-modal-close-btn');
const initialPlayerModalZIndex = playerDetailModal?.style.zIndex || 1001;
const initialPlayerBackdropZIndex = playerDetailBackdrop?.style.zIndex || 1000;

const playerRankMap = new Map();
const allPlayersMap = new Map();

function showPlayerDetails(playerRow, isFromTeamModal = false) {
    if (!playerDetailModal || !playerRow || !playerRow.dataset) return;

    if (isFromTeamModal) {
        playerDetailModal.style.zIndex = '1011';
        playerDetailBackdrop.style.zIndex = '1010';
    } else {
        playerDetailModal.style.zIndex = initialPlayerModalZIndex;
        playerDetailBackdrop.style.zIndex = initialPlayerBackdropZIndex;
    }

    const data = playerRow.dataset;
    const fullPlayerData = allPlayersMap.get(data.name);

    let playSlots = [];
    try {
        const slotsSource = fullPlayerData?.play_slots ? fullPlayerData.play_slots : JSON.parse(data.playSlots || '[]');
        playSlots = Array.isArray(slotsSource) ? slotsSource : [];
    } catch (e) { console.error("Error processing playSlots:", data.playSlots, e); playSlots = []; }

    const notes = fullPlayerData?.notes ?? (data.notes || '-');
    const combatPower = fullPlayerData?.combat_power ?? data.cp;
    const playerClass = fullPlayerData?.class ?? data.class;
    const guild = fullPlayerData?.guild ?? (data.guild || '-');
    const team = fullPlayerData?.team ?? (data.team || 'No Team');
    const updatedAt = fullPlayerData?.updated_at ?? data.updated;
    const rank = playerRankMap.get(data.name) || data.rank || 'N/A';

    let playHoursHtml = '-';
    if (playSlots.length > 0 && typeof playSlots[0]?.start_minutes === 'number' && typeof playSlots[0]?.end_minutes === 'number') {
        playHoursHtml = playSlots.map(slot =>
            `<div>${minutesToFormattedTime(slot.start_minutes)} - ${minutesToFormattedTime(slot.end_minutes)}</div>`
        ).join('');
    } else if (playSlots.length > 0) {
        playHoursHtml = '<div>Invalid time data</div>';
    }

    const classNameLower = String(playerClass || 'unknown').toLowerCase();
    if(playerDetailTitle) playerDetailTitle.innerHTML = `<span class="class-tag class-${classNameLower}">${data.name}</span>`;

    if(playerDetailBody) playerDetailBody.innerHTML = `
        <ul class="player-detail-list">
            <li><strong>Rank:</strong> <span>${rank}</span></li>
            <li><strong>CP:</strong> <span>${formatCP(combatPower)}</span></li>
            <li><strong>Class:</strong> <span><span class="class-tag class-${classNameLower}">${playerClass || 'Unknown'}</span></span></li>
            <li><strong>Guild:</strong> <span>${guild}</span></li>
            <li><strong>Team:</strong> <span>${team}</span></li>
            <li><strong>Play Hours:</strong> ${playHoursHtml}</li>
            <li><strong>Notes:</strong> <span style="white-space: pre-wrap;">${notes}</span></li>
            <li><strong>Updated:</strong> <span>${formatRelativeTimeShort(updatedAt)}</span></li>
        </ul>
    `;

    playerDetailModal.style.display = 'flex';
    if(playerDetailBackdrop) playerDetailBackdrop.style.display = 'block';
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
 </div>`;

function showTeamDetails(teamRow) {
    if (!teamDetailModal || !teamRow || !teamRow.dataset) return;

    const data = teamRow.dataset;
    let members = [];
    try {
        members = JSON.parse(data.members || '[]');
        if (!Array.isArray(members)) members = [];
    } catch(e) { console.error("Error parsing team members data:", data.members, e); members = []; }

    const guildName = data.guildName || 'N/A';
    const teamName = data.teamName || 'Unknown Team';

    if(teamDetailTitle) teamDetailTitle.innerHTML = `<span class="guild-prefix">[${guildName}]</span> <span class="team-name">${teamName}</span>`;

    let membersHtml = '<div class="team-detail-list">';
    if (members.length > 0) {
        members.sort((a, b) => b.combat_power - a.combat_power);
        members.forEach((player) => {
            const classNameLower = String(player.class || 'unknown').toLowerCase();
            membersHtml += `
                <div class="team-detail-player" data-player-name="${player.name}">
                    <span class="class-tag class-${classNameLower}">${player.name}</span>
                    <span class="team-detail-player-cp">${formatCP(player.combat_power)}</span>
                </div>`;
        });
    } else {
        membersHtml += '<div>No member data available.</div>';
    }
    membersHtml += '</div>';

    if(teamDetailBody) teamDetailBody.innerHTML = membersHtml + shortClassLegendHtml;

    teamDetailBody.querySelectorAll('.team-detail-player').forEach(playerEl => {
        playerEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const playerName = playerEl.dataset.playerName;
            const playerFullData = allPlayersMap.get(playerName);
            if (playerFullData) {
                const fakeRow = {
                    dataset: {
                        name: playerFullData.name,
                        class: playerFullData.class,
                        cp: playerFullData.combat_power,
                        guild: playerFullData.guild,
                        team: playerFullData.team,
                        notes: playerFullData.notes,
                        updated: playerFullData.updated_at,
                        playSlots: JSON.stringify(playerFullData.play_slots || '[]'),
                        rank: playerRankMap.get(playerName) || 'N/A'
                    }
                };
                showPlayerDetails(fakeRow, true);
            } else { console.warn(`Player data not found in map for team member: ${playerName}`); }
        });
    });

    teamDetailModal.style.display = 'flex';
    if(teamDetailBackdrop) teamDetailBackdrop.style.display = 'block';
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
    if (!guildDetailModal || !guildRow || !guildRow.dataset) return;
    const data = guildRow.dataset;
    let classDistrib = {};
    try { classDistrib = JSON.parse(data.classDistrib || '{}'); }
    catch (e) { console.error("Error parsing guild class distribution:", data.classDistrib, e); classDistrib = {}; }

    if(guildDetailTitle) guildDetailTitle.textContent = data.guildName || 'Unknown Guild';

    const classDistribHtml = `
        <div class="guild-class-distrib centered">
            <span class="class-tag class-swordbearer" title="Swordbearer">${classDistrib.Swordbearer || 0}</span>
            <span class="class-tag class-acolyte" title="Acolyte">${classDistrib.Acolyte || 0}</span>
            <span class="class-tag class-wayfarer" title="Wayfarer">${classDistrib.Wayfarer || 0}</span>
            <span class="class-tag class-scholar" title="Scholar">${classDistrib.Scholar || 0}</span>
            <span class="class-tag class-shadowlash" title="Shadowlash">${classDistrib.Shadowlash || 0}</span>
        </div>`;

    if(guildDetailBody) guildDetailBody.innerHTML = `
        <ul class="guild-detail-list">
            <li><strong>Rank:</strong> <span>${data.rank || 'N/A'}</span></li>
            <li><strong>Total CP:</strong> <span>${formatCP(data.totalCp)}</span></li>
            <li><strong>Members:</strong> <span>${data.memberCount || 0}</span></li>
            <li class="distrib-item">
                <strong class="centered-title">Class Distribution</strong>
                ${classDistribHtml}
                ${shortClassLegendHtml}
            </li>
        </ul>`;

    guildDetailModal.style.display = 'flex';
    if(guildDetailBackdrop) guildDetailBackdrop.style.display = 'block';
}

function closeGuildDetailModal() {
    if (guildDetailModal) guildDetailModal.style.display = 'none';
    if (guildDetailBackdrop) guildDetailBackdrop.style.display = 'none';
}

// --- MODALE DE FILTRES JOUEURS (MOBILE) ---
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

// --- MODALE D'AIDE DAILY QUESTS ---
const dqHelpModal = document.getElementById('dq-help-modal');
const dqHelpBackdrop = document.getElementById('dq-help-modal-backdrop');
const dqHelpBtn = document.getElementById('dq-help-btn');
const dqHelpCloseBtn = document.getElementById('dq-help-close-btn');

function openDqHelpModal() {
    if (dqHelpModal) dqHelpModal.style.display = 'flex';
    if (dqHelpBackdrop) dqHelpBackdrop.style.display = 'block';
}

function closeDqHelpModal() {
    if (dqHelpModal) dqHelpModal.style.display = 'none';
    if (dqHelpBackdrop) dqHelpBackdrop.style.display = 'none';
}

// --- DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', function() {

    // --- Initialisation des Données ---
    const playersDataEl = document.getElementById('players-data');
    const playersSelectorDataEl = document.getElementById('player-selector-data');
    const guildsDataEl = document.getElementById('guilds-data');

    let playersForModal = [];
    let guildsForModal = [];

    if (playersDataEl) {
        try {
            playersForModal = JSON.parse(playersDataEl.textContent || '[]');
        } catch (e) { console.error("Error parsing players-data JSON:", e); }
    } else if (playersSelectorDataEl) {
        try {
            playersForModal = JSON.parse(playersSelectorDataEl.textContent || '[]').map(p => ({...p, class: 'Unknown'}));
            console.warn("Using player-selector-data for modal; class info might be missing.");
        } catch (e) { console.error("Error parsing player-selector-data JSON:", e); }
    } else {
        console.error("Player data script tag not found!");
    }

    if (guildsDataEl) {
        try {
            guildsForModal = JSON.parse(guildsDataEl.textContent || '[]');
        } catch (e) { console.error("Error parsing guilds-data JSON:", e); }
    }

    document.querySelectorAll('#leaderboard-table tbody tr').forEach((row, index) => {
        const playerName = row.dataset.name;
        const rank = row.dataset.rank || (index + 1);
        if (playerName) {
            playerRankMap.set(playerName, rank);
            row.dataset.originalRank = rank;

            if (!allPlayersMap.has(playerName)) {
                try {
                    const playerData = {
                        id: row.dataset.id || playersForModal.find(p => p.name === playerName)?.id || null,
                        name: playerName,
                        class: row.dataset.class,
                        combat_power: row.dataset.cp,
                        cp_last_updated: row.dataset.cpUpdated,
                        team: row.dataset.team || 'No Team',
                        guild: row.dataset.guild || null,
                        notes: row.dataset.notes === '-' ? '' : row.dataset.notes,
                        updated_at: row.dataset.updated,
                        play_slots: JSON.parse(row.dataset.playSlots || '[]'),
                        pt_tags: JSON.parse(row.dataset.ptTags || '[]')
                    };
                    allPlayersMap.set(playerName, playerData);
                } catch(e){ console.error("Error reconstructing player data from row dataset:", e, row.dataset); }
            }
        }
    });
    playersForModal.forEach(p => {
        if (p && p.name && !allPlayersMap.has(p.name)) {
            allPlayersMap.set(p.name, { id: p.id, name: p.name, class: p.class || 'Unknown' });
        }
    });

    console.log(`Populated allPlayersMap with ${allPlayersMap.size} players.`);

    // --- Initialisation des Modules ---
    initNavigation();
    initPlayerSelectModal(playersForModal);
    initGuildSelectModal(guildsForModal);
    initPlayerForm();
    initLeaderboardFilters();
    initPerilousTrials(showPlayerDetails, allPlayersMap);
    initDailyQuests();
    initDiscordWidget('https://discord.com/api/guilds/1425816979641466912/widget.json');

    // --- Timers & Formatters Initiaux ---
    setInterval(updateTimers, 1000);
    updateTimers();

    document.querySelectorAll('.cp-display').forEach(el => {
        el.textContent = formatCP(el.dataset.cp);
    });
    document.querySelectorAll('[data-timestamp]').forEach(el => {
        el.textContent = formatRelativeTimeShort(el.dataset.timestamp);
    });
    document.querySelectorAll('.play-hours-cell').forEach(cell => {
        const start = parseInt(cell.dataset.startMinutes, 10);
        const end = parseInt(cell.dataset.endMinutes, 10);
        cell.textContent = (!isNaN(start) && !isNaN(end)) ? `${minutesToFormattedTime(start)} - ${minutesToFormattedTime(end)}` : '-';
    });

    // --- Gestion des tooltips des timers sur Mobile (clic pour toggle) ---
    if (window.innerWidth <= 768) {
        document.querySelectorAll('.timer-entry').forEach(entry => {
            entry.addEventListener('click', (e) => {
                // Si l'entrée a un tooltip, on bascule la classe active
                if (entry.querySelector('.timer-tooltip')) {
                    e.stopPropagation(); // Empêche la fermeture immédiate par le listener global
                    // Fermer les autres tooltips ouverts
                    document.querySelectorAll('.timer-entry.active').forEach(other => {
                        if (other !== entry) other.classList.remove('active');
                    });
                    entry.classList.toggle('active');
                }
            });
        });

        // Fermer les tooltips si on clique n'importe où ailleurs sur la page
        document.addEventListener('click', () => {
            document.querySelectorAll('.timer-entry.active').forEach(el => el.classList.remove('active'));
        });
    }

    // --- Listeners Modales et Mobile ---
    if (notesCloseBtn) notesCloseBtn.addEventListener('click', closeNotesModal);
    if (notesBackdrop) notesBackdrop.addEventListener('click', closeNotesModal);
    if (playerDetailCloseBtn) playerDetailCloseBtn.addEventListener('click', closePlayerDetailModal);
    if (playerDetailBackdrop) playerDetailBackdrop.addEventListener('click', closePlayerDetailModal);

    const playerTableBody = document.querySelector('#leaderboard-table tbody');
    if (playerTableBody) {
        playerTableBody.addEventListener('click', (e) => {
            if (window.innerWidth > 768) return;
            const playerRow = e.target.closest('tr');
            // Ignorer les clics sur les notes, les actions admin, ou tout bouton/lien
            if (!playerRow || e.target.closest('.notes-col') || e.target.closest('.admin-actions') || e.target.closest('a') || e.target.closest('button')) return;

            e.preventDefault();
            const playerName = playerRow.dataset.name;
            // Utiliser allPlayersMap pour avoir les données les plus complètes
            if (playerName && allPlayersMap.has(playerName)) {
                const fullData = allPlayersMap.get(playerName);
                // Fusionner les données du row et de la map pour être sûr d'avoir le rang et autres infos d'affichage
                const mergedDataRow = {
                    dataset: {
                        ...playerRow.dataset,
                        ...fullData,
                        // Assurer que playSlots est une chaîne JSON pour showPlayerDetails
                        playSlots: typeof fullData.play_slots === 'string' ? fullData.play_slots : JSON.stringify(fullData.play_slots || [])
                    }
                };
                showPlayerDetails(mergedDataRow);
            }
        });
    }

    if (openFiltersBtn) openFiltersBtn.addEventListener('click', openFiltersModal);
    if (closeFiltersBtn) closeFiltersBtn.addEventListener('click', closeFiltersModal);
    if (filtersBackdrop) filtersBackdrop.addEventListener('click', closeFiltersModal);

    if (teamDetailCloseBtn) teamDetailCloseBtn.addEventListener('click', closeTeamDetailModal);
    if (teamDetailBackdrop) teamDetailBackdrop.addEventListener('click', closeTeamDetailModal);
    const teamTableBody = document.getElementById('teams-tbody');
    if (teamTableBody) {
        teamTableBody.addEventListener('click', (e) => {
            if (window.innerWidth > 768) return;
            const teamRow = e.target.closest('.team-data-row');
            if (!teamRow) return;
            e.preventDefault();
            showTeamDetails(teamRow);
        });
    }

    if (guildDetailCloseBtn) guildDetailCloseBtn.addEventListener('click', closeGuildDetailModal);
    if (guildDetailBackdrop) guildDetailBackdrop.addEventListener('click', closeGuildDetailModal);
    const guildTableBody = document.getElementById('guilds-tbody');
    if (guildTableBody) {
        guildTableBody.addEventListener('click', (e) => {
            if (window.innerWidth > 768) return;
            const guildRow = e.target.closest('tr');
            if (!guildRow) return;
            e.preventDefault();
            showGuildDetails(guildRow);
        });
    }
    if (dqHelpBtn) dqHelpBtn.addEventListener('click', openDqHelpModal);
    if (dqHelpCloseBtn) dqHelpCloseBtn.addEventListener('click', closeDqHelpModal);
    if (dqHelpBackdrop) dqHelpBackdrop.addEventListener('click', closeDqHelpModal);

    // Filtre mobile équipes
    const teamMobileFilter = document.getElementById('team-guild-filter-mobile');
    const allTeamRows = document.querySelectorAll('#teams-leaderboard-table tbody tr.team-data-row');

    function applyTeamMobileFilter() {
        if (!teamMobileFilter || !allTeamRows || allTeamRows.length === 0) return;
        const selectedValue = teamMobileFilter.value;
        let visibleRank = 1;
        allTeamRows.forEach(row => {
            const memberCount = parseInt(row.dataset.memberCountVal || 0, 10);
            const guildName = row.dataset.guildName;
            const isVisible = (selectedValue === 'All') || (selectedValue === 'Incomplete' && memberCount < 4) || (guildName === selectedValue);
            row.style.display = isVisible ? '' : 'none';
            const membersRow = row.nextElementSibling;
            if (membersRow && membersRow.classList.contains('team-members-row')) membersRow.style.display = 'none';
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
        if (window.innerWidth <= 768) applyTeamMobileFilter();
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768 && teamMobileFilter) applyTeamMobileFilter();
        else if (window.innerWidth > 768) {
            allTeamRows.forEach(row => {
                row.style.display = '';
                const rankCell = row.querySelector('.rank-col');
                if (rankCell && row.dataset.originalRank) rankCell.textContent = row.dataset.originalRank;
                row.classList.remove('rank-1', 'rank-2', 'rank-3');
                const originalRank = parseInt(row.dataset.originalRank || '999', 10);
                if (originalRank <= 3) row.classList.add(`rank-${originalRank}`);
            });
            document.querySelectorAll('#teams-leaderboard-table tbody tr.team-members-row').forEach(row => row.style.display = 'none');
        }
    });

    const ptDataEl = document.getElementById('pt-data');
    const ccDataEl = document.getElementById('cc-data');
    let ptList = [];
    let currentCC = 0;
    try {
        ptList = ptDataEl ? JSON.parse(ptDataEl.textContent || '[]') : [];
        if (ccDataEl && ccDataEl.textContent) currentCC = parseInt(ccDataEl.textContent, 10) || 0;
    } catch (e) { console.error("Error parsing initial data:", e); }

    console.log("Initializing Team Planner with CC:", currentCC);
    initTeamPlanner(ptList, currentCC);
    console.log("Main.js initialization complete.");
});