import { parseCpFilter } from './utils.js';

export function initLeaderboardFilters() {

    // --- SÉLECTEURS DES FILTRES (Req 1) ---
    // Filtres de la modale
    const modalClassFilters = document.querySelectorAll('#filters-modal-class-panel input');
    const teamFilters = document.querySelectorAll('#filters-modal-team-panel input');
    const guildFilters = document.querySelectorAll('#filters-modal-guild-panel input');
    const cpMinFilter = document.getElementById('filters-modal-cp-min');
    const cpMaxFilter = document.getElementById('filters-modal-cp-max');
    const ptTagFilter = document.getElementById('filters-modal-pt-tag-filter');
    const ptTagMode = document.getElementById('filters-modal-pt-tag-mode');

    // Filtre de classe du 'th' (desktop)
    const desktopClassFilters = document.querySelectorAll('#class-filter-panel input');

    // Bouton de filtre principal (desktop 'th')
    const classFilterBtn = document.getElementById('class-filter-btn');
    // Bouton d'ouverture de la modale (mobile)
    const openFiltersBtn = document.getElementById('open-filters-btn');

    // Lignes du tableau
    const memberRows = document.querySelectorAll('#leaderboard-table tbody tr');

    function applyFilters() {
        // Fusionne les filtres de classe (desktop + mobile)
        const selectedClassesDesktop = Array.from(desktopClassFilters).filter(c => c.checked).map(c => c.dataset.class);
        const selectedClassesModal = Array.from(modalClassFilters).filter(c => c.checked).map(c => c.dataset.class);
        const selectedClasses = [...new Set([...selectedClassesDesktop, ...selectedClassesModal])];

        // Lit les autres filtres depuis la modale
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
                row.style.display = ''; // Sur mobile, le CSS gère le 'flex'
                row.querySelector('.rank-col').textContent = visibleRank;
                row.classList.remove('rank-1', 'rank-2', 'rank-3');
                if (visibleRank <= 3) row.classList.add(`rank-${visibleRank}`);
                visibleRank++;
            } else { row.style.display = 'none'; }
        });

        // Met à jour le texte du bouton de filtre de classe (desktop)
        if (classFilterBtn) {
            const span = classFilterBtn.querySelector('span');
            if (span) {
                span.textContent = selectedClasses.length > 0 ? `Player (${selectedClasses.length})` : 'Player';
                classFilterBtn.classList.toggle('active', selectedClasses.length > 0);
            }
        }

        // Met à jour le texte du bouton d'ouverture des filtres (mobile)
        let totalFilters = selectedClasses.length + selectedTeams.length + selectedGuilds.length + (cpMin > 0 ? 1 : 0) + (cpMax !== Infinity ? 1 : 0) + (selectedPtTag ? 1 : 0);
        if (openFiltersBtn) {
            openFiltersBtn.textContent = totalFilters > 0 ? `Filtres (${totalFilters})` : 'Filtres';
            openFiltersBtn.classList.toggle('active', totalFilters > 0);
        }
    }

    // Attache les écouteurs d'événements à TOUS les filtres (desktop + modale)
    document.querySelectorAll('#class-filter-panel input, #filters-modal input, #filters-modal select').forEach(el => {
        el.addEventListener('change', applyFilters);
        // 'keyup' pour les champs de texte CP
        if (el.type === 'text') {
            el.addEventListener('keyup', applyFilters);
        }
    });

    // --- LOGIQUE POUR LES AUTRES LEADERBOARDS (INCHANGÉE) ---

    // Gère les menus déroulants (pour le filtre de classe desktop)
    document.querySelectorAll('.dropdown-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            let panel;
            const parentContainer = button.closest('.dropdown-filter, .class-header-cell, .player-header-cell');
            if (parentContainer) {
                panel = parentContainer.querySelector('.dropdown-panel');
            }
            if (!panel) return;

            const isCurrentlyOpen = panel.classList.contains('show');
            document.querySelectorAll('.dropdown-panel').forEach(p => p.classList.remove('show'));
            if (!isCurrentlyOpen) panel.classList.add('show');
            e.stopPropagation();
        });
    });

    window.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-btn')) {
            document.querySelectorAll('.dropdown-panel.show').forEach(panel => panel.classList.remove('show'));
        }
    });

    // Filtre pour le classement des équipes (INCHANGÉ)
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