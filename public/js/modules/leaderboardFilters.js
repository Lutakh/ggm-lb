import { parseCpFilter } from './utils.js';

export function initLeaderboardFilters() {
    // --- GESTION DES MENUS DÉROULANTS PERSONNALISÉS ---
    document.querySelectorAll('.dropdown-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            // Logique améliorée pour trouver le panneau de filtre associé
            let panel;
            const parentContainer = button.closest('.dropdown-filter, .class-header-cell');
            if (parentContainer) {
                panel = parentContainer.querySelector('.dropdown-panel');
            }

            if (!panel) {
                console.error('Dropdown panel not found for button', button);
                return;
            }

            // Ferme tous les autres panneaux avant de gérer celui-ci
            const isCurrentlyOpen = panel.classList.contains('show');
            document.querySelectorAll('.dropdown-panel').forEach(p => {
                p.classList.remove('show');
            });

            if (!isCurrentlyOpen) {
                panel.classList.add('show');
            }

            e.stopPropagation(); // Empêche la fermeture immédiate par le listener global
        });
    });

    // Ferme les menus si on clique n'importe où ailleurs sur la page
    window.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-btn')) {
            document.querySelectorAll('.dropdown-panel.show').forEach(panel => {
                panel.classList.remove('show');
            });
        }
    });

    // --- LOGIQUE D'APPLICATION DES FILTRES ---
    const classFilters = document.querySelectorAll('#class-filter-panel input, #pt-class-filter-panel input');
    const teamFilters = document.querySelectorAll('#team-filter-panel input');
    const guildFilters = document.querySelectorAll('#guild-filter-panel input');
    const cpMinFilter = document.getElementById('cp-min');
    const cpMaxFilter = document.getElementById('cp-max');
    const memberRows = document.querySelectorAll('#leaderboard-table tbody tr');
    const ptTagFilter = document.getElementById('pt-tag-filter');
    const ptTagMode = document.getElementById('pt-tag-mode');

    function applyFilters() {
        const selectedClasses = Array.from(classFilters).filter(c => c.checked).map(c => c.dataset.class);
        const selectedTeams = Array.from(teamFilters).filter(c => c.checked).map(c => c.dataset.team);
        const selectedGuilds = Array.from(guildFilters).filter(c => c.checked).map(c => c.dataset.guild);
        const cpMin = parseCpFilter(cpMinFilter.value);
        const cpMax = parseCpFilter(cpMaxFilter.value) || Infinity;
        const selectedPtTag = ptTagFilter.value;
        const ptMode = ptTagMode.value;

        let visibleRank = 1;
        memberRows.forEach(row => {
            const classMatch = selectedClasses.length === 0 || selectedClasses.includes(row.dataset.class);
            const teamMatch = selectedTeams.length === 0 || selectedTeams.includes(row.dataset.team);
            const guildMatch = selectedGuilds.length === 0 || selectedGuilds.includes(row.dataset.guild);
            const cpMatch = parseInt(row.dataset.cp, 10) >= cpMin && parseInt(row.dataset.cp, 10) <= cpMax;

            let ptMatch = true;
            if (selectedPtTag) {
                const playerTags = JSON.parse(row.dataset.ptTags || '[]');
                const hasTag = playerTags.includes(selectedPtTag);
                if ((ptMode === 'has' && !hasTag) || (ptMode === 'missing' && hasTag)) {
                    ptMatch = false;
                }
            }

            if (classMatch && teamMatch && guildMatch && cpMatch && ptMatch) {
                row.style.display = '';
                row.querySelector('.rank-col').textContent = visibleRank;
                row.classList.remove('rank-1', 'rank-2', 'rank-3');
                if (visibleRank <= 3) row.classList.add(`rank-${visibleRank}`);
                visibleRank++;
            } else { row.style.display = 'none'; }
        });

        // Met à jour le texte des boutons de filtre
        const classFilterBtn = document.getElementById('class-filter-btn');
        if (classFilterBtn) classFilterBtn.textContent = selectedClasses.length > 0 ? `${selectedClasses.length} class(es)` : 'All Classes';

        const teamFilterBtn = document.getElementById('team-filter-btn');
        if (teamFilterBtn) teamFilterBtn.textContent = selectedTeams.length > 0 ? `${selectedTeams.length} team(s)` : 'All Teams';

        const guildFilterBtn = document.getElementById('guild-filter-btn');
        if (guildFilterBtn) guildFilterBtn.textContent = selectedGuilds.length > 0 ? `${selectedGuilds.length} guild(s)` : 'All Guilds';
    }

    // Attache les écouteurs d'événements
    document.querySelectorAll('#filters input, #filters select, .dropdown-panel input').forEach(el => {
        el.addEventListener('change', applyFilters);
        el.addEventListener('keyup', applyFilters);
    });

    // --- FILTRE POUR LE CLASSEMENT DES ÉQUIPES (INCHANGÉ) ---
    const teamGuildFilter = document.getElementById('team-guild-filter');
    const allTeamRows = document.querySelectorAll('#teams-leaderboard-table tbody tr.team-data-row');
    if(teamGuildFilter) {
        teamGuildFilter.addEventListener('change', () => {
            const selectedGuild = teamGuildFilter.value;
            let visibleRank = 1;
            allTeamRows.forEach(row => {
                const isVisible = (selectedGuild === 'All') || (selectedGuild === 'Incomplete' && row.dataset.memberCount < 4) || (row.dataset.guild === selectedGuild);
                row.style.display = isVisible ? '' : 'none';
                if (row.nextElementSibling) row.nextElementSibling.style.display = 'none';
                if (isVisible) {
                    row.querySelector('.rank-col').textContent = visibleRank;
                    row.classList.remove('rank-1', 'rank-2', 'rank-3');
                    if(visibleRank <= 3) row.classList.add(`rank-${visibleRank}`);
                    visibleRank++;
                }
            });
        });
    }

    document.querySelectorAll('.team-data-row').forEach(headerRow => {
        headerRow.addEventListener('click', () => {
            const membersRow = headerRow.nextElementSibling;
            if (membersRow) {
                membersRow.style.display = membersRow.style.display === 'table-row' ? 'none' : 'table-row';
            }
        });
    });
}