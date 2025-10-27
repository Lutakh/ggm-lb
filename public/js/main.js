// public/js/main.js
import { initNavigation } from './modules/navigation.js';
import { initPlayerForm } from './modules/playerForm.js';
import { initLeaderboardFilters } from './modules/leaderboardFilters.js';
import { initPerilousTrials } from './modules/perilousTrials.js';
import { initDailyQuests } from './modules/dailyQuests.js'; // <-- Import is correct
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
    notesBody.textContent = note; // Utiliser textContent pour éviter l'interprétation HTML
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
    if (!playerDetailModal || !playerRow || !playerRow.dataset) {
        console.error("Missing player detail modal or player row data.");
        return;
    }

    if (isFromTeamModal) {
        playerDetailModal.style.zIndex = '1011'; // Au dessus de la modale équipe
        playerDetailBackdrop.style.zIndex = '1010'; // Juste en dessous
    } else {
        playerDetailModal.style.zIndex = initialPlayerModalZIndex; // Valeur par défaut
        playerDetailBackdrop.style.zIndex = initialPlayerBackdropZIndex; // Valeur par défaut
    }


    const data = playerRow.dataset;
    // NOUVEAU: Essayer de récupérer l'objet joueur complet si possible pour des données plus fiables
    const fullPlayerData = allPlayersMap.get(data.name);

    // Utiliser les données complètes si disponibles, sinon fallback sur dataset
    let playSlots = [];
    try {
        playSlots = fullPlayerData?.play_slots ? fullPlayerData.play_slots : JSON.parse(data.playSlots || '[]');
        // Vérification supplémentaire que c'est bien un tableau
        if (!Array.isArray(playSlots)) playSlots = [];
    } catch (e) {
        console.error("Error parsing playSlots:", data.playSlots, e);
        playSlots = [];
    }

    const notes = fullPlayerData?.notes ? fullPlayerData.notes : (data.notes || '-'); // Fallback pour notes aussi
    const combatPower = fullPlayerData?.combat_power ? fullPlayerData.combat_power : data.cp;
    const playerClass = fullPlayerData?.class ? fullPlayerData.class : data.class;
    const guild = fullPlayerData?.guild ? fullPlayerData.guild : (data.guild || '-'); // Fallback
    const team = fullPlayerData?.team ? fullPlayerData.team : (data.team || '-'); // Fallback
    const updatedAt = fullPlayerData?.updated_at ? fullPlayerData.updated_at : data.updated;
    const rank = playerRankMap.get(data.name) || data.rank || 'N/A'; // Utiliser la map ou le dataset

    let playHoursHtml = '-';
    // Vérification plus robuste de playSlots avant le map
    if (playSlots.length > 0 && playSlots[0] && typeof playSlots[0].start_minutes === 'number' && typeof playSlots[0].end_minutes === 'number') {
        playHoursHtml = playSlots.map(slot =>
            `<div>${minutesToFormattedTime(slot.start_minutes)} - ${minutesToFormattedTime(slot.end_minutes)}</div>`
        ).join('');
    } else {
        playHoursHtml = '<div>-</div>'; // Afficher un tiret si pas de slots ou format invalide
    }

    // Assurer que playerClass est une string avant toLowerCase
    const classNameLower = String(playerClass || 'unknown').toLowerCase();
    playerDetailTitle.innerHTML = `<span class="class-tag class-${classNameLower}">${data.name}</span>`;

    playerDetailBody.innerHTML = `
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
    if (!teamDetailModal || !teamRow || !teamRow.dataset) return;

    const data = teamRow.dataset;
    let members = [];
    try {
        members = JSON.parse(data.members || '[]');
        if (!Array.isArray(members)) members = [];
    } catch(e) {
        console.error("Error parsing team members data:", data.members, e);
        members = [];
    }
    const guildName = data.guildName || 'N/A';
    const teamName = data.teamName || 'Unknown Team';

    teamDetailTitle.innerHTML = `<span class="guild-prefix">[${guildName}]</span> <span class="team-name">${teamName}</span>`;

    let membersHtml = '<div class="team-detail-list">';
    if (members.length > 0) {
        members.forEach((player) => {
            // Assurer que player.class est une string
            const classNameLower = String(player.class || 'unknown').toLowerCase();
            membersHtml += `
                <div class="team-detail-player" data-player-name="${player.name}">
                    <span class="class-tag class-${classNameLower}">${player.name}</span>
                    <span class="team-detail-player-cp">${formatCP(player.combat_power)}</span>
                </div>
            `;
        });
    } else {
        membersHtml += '<div>No member data available.</div>';
    }
    membersHtml += '</div>';

    teamDetailBody.innerHTML = membersHtml + shortClassLegendHtml;

    // Attach click listeners AFTER setting innerHTML
    teamDetailBody.querySelectorAll('.team-detail-player').forEach(playerEl => {
        playerEl.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent closing team modal if player modal opens over it
            const playerName = playerEl.dataset.playerName;
            const player = allPlayersMap.get(playerName);
            if (player) {
                // Construct a fake row object compatible with showPlayerDetails
                const fakeRow = {
                    dataset: {
                        name: player.name, // Essential
                        class: player.class,
                        cp: player.combat_power,
                        guild: player.guild,
                        team: player.team,
                        notes: player.notes,
                        updated: player.updated_at,
                        playSlots: JSON.stringify(player.play_slots || '[]'), // Pass as string
                        rank: playerRankMap.get(playerName) || 'N/A' // Get rank from map
                    }
                };
                showPlayerDetails(fakeRow, true); // Pass true to adjust z-index
            } else {
                console.warn(`Player data not found in map for team member: ${playerName}`);
                // Optionally show a message if player data isn't available
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
    if (!guildDetailModal || !guildRow || !guildRow.dataset) return;
    const data = guildRow.dataset;
    let classDistrib = {};
    try {
        classDistrib = JSON.parse(data.classDistrib || '{}');
    } catch (e) {
        console.error("Error parsing guild class distribution:", data.classDistrib, e);
        classDistrib = {}; // Default to empty object on error
    }


    guildDetailTitle.textContent = data.guildName || 'Unknown Guild';

    // Ensure default values are 0 if classDistrib is missing keys
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
            <li><strong>Rank:</strong> <span>${data.rank || 'N/A'}</span></li>
            <li><strong>Total CP:</strong> <span>${formatCP(data.totalCp)}</span></li>
            <li><strong>Members:</strong> <span>${data.memberCount || 0} / 120</span></li>
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
    console.log("DOM fully loaded and parsed"); // Add this log

    initNavigation();
    initPlayerForm();
    initLeaderboardFilters();

    // Peupler les maps AVANT d'initialiser PT et Daily Quests
    console.log("Populating player maps..."); // Add this log
    const playersDataEl = document.getElementById('players-data');
    if (playersDataEl) {
        try {
            const playersData = JSON.parse(playersDataEl.textContent || '[]');
            playersData.forEach(p => {
                if (p && p.name) { // Add check for valid player object and name
                    allPlayersMap.set(p.name, p);
                } else {
                    console.warn("Skipping invalid player data entry:", p);
                }
            });
            console.log(`Populated allPlayersMap with ${allPlayersMap.size} players from players-data.`); // Log count
        } catch (e) {
            console.error("Error parsing players-data JSON:", e);
        }
    } else {
        console.warn("Element with ID 'players-data' not found.");
    }

    // Populate rank map and potentially add players missing from the initial JSON
    document.querySelectorAll('#leaderboard-table tbody tr').forEach((row, index) => {
        const playerName = row.dataset.name;
        // Use the rank from the dataset if available, otherwise use the loop index + 1
        const rank = row.dataset.rank || (index + 1);
        if (playerName) {
            playerRankMap.set(playerName, rank);
            // Store original rank for potential desktop reset on resize
            row.dataset.originalRank = rank;

            // Add player to allPlayersMap if not already present
            if (!allPlayersMap.has(playerName)) {
                try {
                    const playerData = {
                        id: row.dataset.id || null, // Capture ID if present
                        name: playerName,
                        class: row.dataset.class,
                        combat_power: row.dataset.cp,
                        team: row.dataset.team,
                        guild: row.dataset.guild,
                        notes: row.dataset.notes,
                        updated_at: row.dataset.updated,
                        play_slots: JSON.parse(row.dataset.playSlots || '[]'),
                        pt_tags: JSON.parse(row.dataset.ptTags || '[]')
                        // We don't have stamina data here typically
                    };
                    allPlayersMap.set(playerData.name, playerData);
                    // console.log(`Added player ${playerData.name} to map from table row.`);
                } catch(e){
                    console.error("Error reconstructing player data from row dataset:", e, playerName);
                }
            }
        } else {
            console.warn("Skipping table row due to missing data-name attribute:", row);
        }
    });
    console.log(`Verified allPlayersMap size after table scan: ${allPlayersMap.size}`); // Log final count
    console.log(`Populated playerRankMap with ${playerRankMap.size} entries.`);


    // Initialize modules that depend on player data
    initPerilousTrials(showPlayerDetails, allPlayersMap);
    initDailyQuests(); // <-- Ensure this is called AFTER populating maps

    // Initialize other modules
    initDiscordWidget('https://discord.com/api/guilds/1425816979641466912/widget.json'); // Replace with your actual Guild ID if different

    // Timers and formatters
    setInterval(updateTimers, 1000);
    updateTimers(); // Initial call

    document.querySelectorAll('.cp-display').forEach(el => {
        el.textContent = formatCP(el.dataset.cp);
    });

    document.querySelectorAll('[data-timestamp]').forEach(el => {
        el.textContent = formatRelativeTimeShort(el.dataset.timestamp);
    });

    // Initialize play hours display in the main table
    document.querySelectorAll('.play-hours-cell').forEach(cell => {
        const start = parseInt(cell.dataset.startMinutes, 10);
        const end = parseInt(cell.dataset.endMinutes, 10);
        if (!isNaN(start) && !isNaN(end)) {
            cell.textContent = `${minutesToFormattedTime(start)} - ${minutesToFormattedTime(end)}`;
        } else {
            cell.textContent = '-'; // Display dash if no valid time
        }
    });

    // --- Attach Event Listeners for Modals and Mobile interactions ---
    console.log("Attaching modal and mobile event listeners..."); // Add this log

    // Notes Modal
    if (notesCloseBtn) notesCloseBtn.addEventListener('click', closeNotesModal);
    if (notesBackdrop) notesBackdrop.addEventListener('click', closeNotesModal);

    // Player Detail Modal (Mobile)
    if (playerDetailCloseBtn) playerDetailCloseBtn.addEventListener('click', closePlayerDetailModal);
    if (playerDetailBackdrop) playerDetailBackdrop.addEventListener('click', closePlayerDetailModal);

    const playerTableBody = document.querySelector('#leaderboard-table tbody');
    if (playerTableBody) {
        playerTableBody.addEventListener('click', (e) => {
            const playerRow = e.target.closest('tr');
            if (!playerRow) return;
            // Prevent modal if clicking notes or admin buttons
            if (e.target.closest('.notes-col') || e.target.closest('.admin-actions')) {
                return;
            }
            // Only show modal on mobile
            if (window.innerWidth <= 768) {
                e.preventDefault();
                showPlayerDetails(playerRow);
            }
        });
    }

    // Player Filters Modal
    if (openFiltersBtn) openFiltersBtn.addEventListener('click', openFiltersModal);
    if (closeFiltersBtn) closeFiltersBtn.addEventListener('click', closeFiltersModal);
    if (filtersBackdrop) filtersBackdrop.addEventListener('click', closeFiltersModal);

    // Team Detail Modal (Mobile)
    if (teamDetailCloseBtn) teamDetailCloseBtn.addEventListener('click', closeTeamDetailModal);
    if (teamDetailBackdrop) teamDetailBackdrop.addEventListener('click', closeTeamDetailModal);

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

    // Guild Detail Modal (Mobile)
    if (guildDetailCloseBtn) guildDetailCloseBtn.addEventListener('click', closeGuildDetailModal);
    if (guildDetailBackdrop) guildDetailBackdrop.addEventListener('click', closeGuildDetailModal);

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

    // Mobile filter logic for Teams
    const teamMobileFilter = document.getElementById('team-guild-filter-mobile');
    const allTeamRows = document.querySelectorAll('#teams-leaderboard-table tbody tr.team-data-row');

    function applyTeamMobileFilter() {
        if (!teamMobileFilter || !allTeamRows || allTeamRows.length === 0) return;
        const selectedValue = teamMobileFilter.value;
        let visibleRank = 1;
        allTeamRows.forEach(row => {
            const memberCount = parseInt(row.dataset.memberCountVal || 0, 10);
            const guildName = row.dataset.guildName; // Ensure this attribute exists on the TR

            const isVisible = (selectedValue === 'All') ||
                (selectedValue === 'Incomplete' && memberCount < 4) ||
                (guildName === selectedValue);

            row.style.display = isVisible ? '' : 'none';
            // Also hide the member details row
            const membersRow = row.nextElementSibling;
            if (membersRow && membersRow.classList.contains('team-members-row')) {
                membersRow.style.display = 'none'; // Always hide member details on mobile filter change
            }

            if (isVisible) {
                const rankCell = row.querySelector('.rank-col');
                if (rankCell) rankCell.textContent = visibleRank;
                // Re-apply podium classes based on new rank
                row.classList.remove('rank-1', 'rank-2', 'rank-3');
                if(visibleRank <= 3) row.classList.add(`rank-${visibleRank}`);
                visibleRank++;
            }
        });
    }

    if (teamMobileFilter) {
        teamMobileFilter.addEventListener('change', applyTeamMobileFilter);
        // Apply filter initially if on mobile
        if (window.innerWidth <= 768) {
            applyTeamMobileFilter();
        }
    }

    // Apply/Remove mobile team filter on resize
    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768 && teamMobileFilter) {
            // console.log("Applying mobile team filter on resize.");
            applyTeamMobileFilter();
        } else if (window.innerWidth > 768) {
            // console.log("Resetting team display for desktop on resize.");
            // Reset styles possibly applied by mobile filter
            allTeamRows.forEach(row => {
                row.style.display = ''; // Reset display
                const rankCell = row.querySelector('.rank-col');
                // Restore original rank stored earlier
                if (rankCell && row.dataset.originalRank) {
                    rankCell.textContent = row.dataset.originalRank;
                }

                // Reset podium classes based on original rank
                row.classList.remove('rank-1', 'rank-2', 'rank-3');
                const originalRank = parseInt(row.dataset.originalRank || '999', 10);
                if (originalRank <= 3) row.classList.add(`rank-${originalRank}`);

            });
            document.querySelectorAll('#teams-leaderboard-table tbody tr.team-members-row').forEach(row => {
                row.style.display = 'none'; // Ensure member rows are hidden on desktop resize
            });
        }
    });

    console.log("DOMContentLoaded handler finished."); // Add this log

}); // End of DOMContentLoaded