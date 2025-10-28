// public/js/main.js
import { initNavigation } from './modules/navigation.js';
import { initPlayerForm } from './modules/playerForm.js';
import { initLeaderboardFilters } from './modules/leaderboardFilters.js';
import { initPerilousTrials } from './modules/perilousTrials.js';
import { initDailyQuests } from './modules/dailyQuests.js';
import { initPlayerSelectModal } from './modules/playerSelectModal.js'; // <-- Importer l'initialiseur de la modale
import { updateTimers, formatCP, formatRelativeTimeShort, minutesToFormattedTime } from './modules/utils.js'; // formatRelativeTime enlevé car non utilisé ici
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

// Fonction globale pour afficher les notes complètes
window.showFullNote = function(playerName, note) {
    if (!note || note.trim() === '' || note.trim() === '-') return;
    if (notesTitle) notesTitle.textContent = `Notes for ${playerName}`;
    if (notesBody) notesBody.textContent = note; // textContent est plus sûr
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

// Map pour stocker les rangs des joueurs (mis à jour par les filtres)
const playerRankMap = new Map();
// Map pour stocker les données complètes des joueurs par leur nom (pour modales et PT)
const allPlayersMap = new Map();

// Fonction pour afficher les détails d'un joueur dans la modale mobile
// Utilisée aussi par perilousTrials.js
function showPlayerDetails(playerRow, isFromTeamModal = false) {
    if (!playerDetailModal || !playerRow || !playerRow.dataset) {
        console.error("Missing player detail modal or player row data.");
        return;
    }

    // Gérer le z-index si ouvert depuis la modale équipe
    if (isFromTeamModal) {
        playerDetailModal.style.zIndex = '1011';
        playerDetailBackdrop.style.zIndex = '1010';
    } else {
        playerDetailModal.style.zIndex = initialPlayerModalZIndex;
        playerDetailBackdrop.style.zIndex = initialPlayerBackdropZIndex;
    }

    const data = playerRow.dataset;
    // Essayer de récupérer l'objet joueur complet depuis la map pour des données plus fiables
    const fullPlayerData = allPlayersMap.get(data.name);

    // Utiliser les données complètes si disponibles, sinon fallback sur dataset
    let playSlots = [];
    try {
        // Priorité aux données complètes, sinon parser le dataset
        const slotsSource = fullPlayerData?.play_slots ? fullPlayerData.play_slots : JSON.parse(data.playSlots || '[]');
        playSlots = Array.isArray(slotsSource) ? slotsSource : []; // Assurer que c'est un tableau
    } catch (e) { console.error("Error processing playSlots:", data.playSlots, e); playSlots = []; }

    const notes = fullPlayerData?.notes ?? (data.notes || '-');
    const combatPower = fullPlayerData?.combat_power ?? data.cp;
    const playerClass = fullPlayerData?.class ?? data.class;
    const guild = fullPlayerData?.guild ?? (data.guild || '-');
    const team = fullPlayerData?.team ?? (data.team || 'No Team'); // 'No Team' comme fallback
    const updatedAt = fullPlayerData?.updated_at ?? data.updated;
    // Le rang vient de la map (mise à jour par les filtres) ou du dataset initial
    const rank = playerRankMap.get(data.name) || data.rank || 'N/A';

    // Formatter les heures de jeu
    let playHoursHtml = '-';
    if (playSlots.length > 0 && typeof playSlots[0]?.start_minutes === 'number' && typeof playSlots[0]?.end_minutes === 'number') {
        playHoursHtml = playSlots.map(slot =>
            `<div>${minutesToFormattedTime(slot.start_minutes)} - ${minutesToFormattedTime(slot.end_minutes)}</div>`
        ).join('');
    } else if (playSlots.length > 0) { // Si le format est inattendu
        console.warn("Invalid play_slots format for player:", data.name, playSlots);
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

// Légende courte réutilisable pour les classes
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
        members = JSON.parse(data.members || '[]'); // membres simplifiés: {name, class, combat_power}
        if (!Array.isArray(members)) members = [];
    } catch(e) { console.error("Error parsing team members data:", data.members, e); members = []; }

    const guildName = data.guildName || 'N/A'; // Doit venir de data-guild-name
    const teamName = data.teamName || 'Unknown Team';

    if(teamDetailTitle) teamDetailTitle.innerHTML = `<span class="guild-prefix">[${guildName}]</span> <span class="team-name">${teamName}</span>`;

    let membersHtml = '<div class="team-detail-list">';
    if (members.length > 0) {
        // Trier les membres par CP décroissant pour l'affichage modal
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

    // Attacher les listeners pour ouvrir les détails du joueur DEPUIS la modale équipe
    teamDetailBody.querySelectorAll('.team-detail-player').forEach(playerEl => {
        playerEl.addEventListener('click', (e) => {
            e.stopPropagation(); // Empêche la fermeture de la modale équipe
            const playerName = playerEl.dataset.playerName;
            const playerFullData = allPlayersMap.get(playerName); // Récupérer les données complètes
            if (playerFullData) {
                // Construire un objet "row" simulé pour showPlayerDetails
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
                        rank: playerRankMap.get(playerName) || 'N/A' // Rang actuel selon les filtres
                    }
                };
                showPlayerDetails(fakeRow, true); // true indique que c'est ouvert depuis la modale équipe
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
const openFiltersBtn = document.getElementById('open-filters-btn'); // Pour leaderboard joueurs
const closeFiltersBtn = document.getElementById('filters-modal-close-btn');

function openFiltersModal() {
    if (filtersModal) filtersModal.style.display = 'flex';
    if (filtersBackdrop) filtersBackdrop.style.display = 'block';
}
function closeFiltersModal() {
    if (filtersModal) filtersModal.style.display = 'none';
    if (filtersBackdrop) filtersBackdrop.style.display = 'none';
}


// --- DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', function() {

    // --- Initialisation des Données Joueur ---
    const playersDataEl = document.getElementById('players-data'); // Contient {id, name, class}
    const playersSelectorDataEl = document.getElementById('player-selector-data'); // Contient {id, name}
    let playersForModal = []; // Données pour la modale de sélection {id, name, class?}

    // Prioriser playersDataEl s'il existe (contient la classe), sinon utiliser playersSelectorDataEl
    if (playersDataEl) {
        try {
            playersForModal = JSON.parse(playersDataEl.textContent || '[]');
        } catch (e) { console.error("Error parsing players-data JSON:", e); }
    } else if (playersSelectorDataEl) {
        try {
            // Si playersDataEl manque, on utilise playersSelectorDataEl mais la classe manquera
            playersForModal = JSON.parse(playersSelectorDataEl.textContent || '[]').map(p => ({...p, class: 'Unknown'})); // Ajouter une classe par défaut
            console.warn("Using player-selector-data for modal; class info might be missing.");
        } catch (e) { console.error("Error parsing player-selector-data JSON:", e); }
    } else {
        console.error("Player data script tag not found! Player selection and other features may fail.");
    }

    // Peupler la map globale utilisée par les modales, PT, etc.
    document.querySelectorAll('#leaderboard-table tbody tr').forEach((row, index) => {
        const playerName = row.dataset.name;
        const rank = row.dataset.rank || (index + 1); // Utiliser rang initial du dataset ou index
        if (playerName) {
            playerRankMap.set(playerName, rank); // Stocker le rang initial
            row.dataset.originalRank = rank; // Garder une trace du rang de base

            // Essayer de construire l'objet joueur complet depuis la ligne du tableau
            // Cela sert de fallback si les données JSON initiales étaient incomplètes
            if (!allPlayersMap.has(playerName)) {
                try {
                    const playerData = {
                        id: row.dataset.id || playersForModal.find(p => p.name === playerName)?.id || null, // Essayer de trouver l'ID
                        name: playerName,
                        class: row.dataset.class,
                        combat_power: row.dataset.cp,
                        team: row.dataset.team || 'No Team',
                        guild: row.dataset.guild || null,
                        notes: row.dataset.notes === '-' ? '' : row.dataset.notes, // Gérer le tiret
                        updated_at: row.dataset.updated,
                        play_slots: JSON.parse(row.dataset.playSlots || '[]'),
                        pt_tags: JSON.parse(row.dataset.ptTags || '[]')
                        // Stamina/Quests ne sont pas dans le tableau principal
                    };
                    allPlayersMap.set(playerName, playerData);
                } catch(e){ console.error("Error reconstructing player data from row dataset:", e, row.dataset); }
            }
        } else { console.warn("Skipping table row due to missing data-name attribute:", row); }
    });
    // S'assurer que les joueurs du JSON initial sont aussi dans la map (au cas où ils ne seraient pas dans le tableau affiché)
    playersForModal.forEach(p => {
        if (p && p.name && !allPlayersMap.has(p.name)) {
            // On n'a que des données partielles ici
            allPlayersMap.set(p.name, {
                id: p.id,
                name: p.name,
                class: p.class || 'Unknown', // Classe peut manquer
                // Le reste des données manque, sera peut-être complété par fetch si nécessaire
            });
        }
    });
    console.log(`Populated allPlayersMap with ${allPlayersMap.size} players.`);
    console.log(`Populated playerRankMap with ${playerRankMap.size} initial ranks.`);


    // --- Initialisation des Modules ---
    initNavigation();
    initPlayerSelectModal(playersForModal); // <-- Initialiser la modale partagée AVEC les données joueur
    initPlayerForm(); // Utilise la modale partagée
    initLeaderboardFilters(); // Gère les filtres du leaderboard joueur
    initPerilousTrials(showPlayerDetails, allPlayersMap); // Passe la fonction showPlayerDetails et la map
    initDailyQuests(); // Utilise la modale partagée
    initDiscordWidget('https://discord.com/api/guilds/1425816979641466912/widget.json'); // ID de Guilde à adapter si besoin

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


    // --- Attacher les Listeners pour les Modales et Interactions Mobiles ---

    // Notes Modal
    if (notesCloseBtn) notesCloseBtn.addEventListener('click', closeNotesModal);
    if (notesBackdrop) notesBackdrop.addEventListener('click', closeNotesModal);

    // Player Detail Modal (ouverture depuis tableau mobile)
    if (playerDetailCloseBtn) playerDetailCloseBtn.addEventListener('click', closePlayerDetailModal);
    if (playerDetailBackdrop) playerDetailBackdrop.addEventListener('click', closePlayerDetailModal);
    const playerTableBody = document.querySelector('#leaderboard-table tbody');
    if (playerTableBody) {
        playerTableBody.addEventListener('click', (e) => {
            if (window.innerWidth > 768) return; // Seulement sur mobile
            const playerRow = e.target.closest('tr');
            // Ne pas ouvrir si on clique sur notes ou actions admin (si jamais visibles)
            if (!playerRow || e.target.closest('.notes-col') || e.target.closest('.admin-actions')) return;
            e.preventDefault();
            showPlayerDetails(playerRow);
        });
    }

    // Player Filters Modal (ouverture mobile)
    if (openFiltersBtn) openFiltersBtn.addEventListener('click', openFiltersModal);
    if (closeFiltersBtn) closeFiltersBtn.addEventListener('click', closeFiltersModal);
    if (filtersBackdrop) filtersBackdrop.addEventListener('click', closeFiltersModal);

    // Team Detail Modal (ouverture depuis tableau mobile)
    if (teamDetailCloseBtn) teamDetailCloseBtn.addEventListener('click', closeTeamDetailModal);
    if (teamDetailBackdrop) teamDetailBackdrop.addEventListener('click', closeTeamDetailModal);
    const teamTableBody = document.getElementById('teams-tbody');
    if (teamTableBody) {
        teamTableBody.addEventListener('click', (e) => {
            if (window.innerWidth > 768) return; // Seulement sur mobile
            const teamRow = e.target.closest('.team-data-row');
            if (!teamRow) return;
            e.preventDefault();
            showTeamDetails(teamRow);
        });
    }

    // Guild Detail Modal (ouverture depuis tableau mobile)
    if (guildDetailCloseBtn) guildDetailCloseBtn.addEventListener('click', closeGuildDetailModal);
    if (guildDetailBackdrop) guildDetailBackdrop.addEventListener('click', closeGuildDetailModal);
    const guildTableBody = document.getElementById('guilds-tbody');
    if (guildTableBody) {
        guildTableBody.addEventListener('click', (e) => {
            if (window.innerWidth > 768) return; // Seulement sur mobile
            const guildRow = e.target.closest('tr');
            if (!guildRow) return;
            e.preventDefault();
            showGuildDetails(guildRow);
        });
    }

    // Filtre mobile pour les équipes (ne change pas)
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
            applyTeamMobileFilter();
        } else if (window.innerWidth > 768) {
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


    console.log("Main.js initialization complete.");
}); // Fin DOMContentLoaded