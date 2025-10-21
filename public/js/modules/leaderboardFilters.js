import { parseCpFilter } from './utils.js';

export function initLeaderboardFilters() {

    // --- SÉLECTEURS DES FILTRES ---
    // Filtres de la modale
    const classModalCheckboxes = document.querySelectorAll('#filters-modal .filter-modal-dropdown[data-filter-type="class"] input[type="checkbox"]');
    const teamModalCheckboxes = document.querySelectorAll('#filters-modal .filter-modal-dropdown[data-filter-type="team"] input[type="checkbox"]');
    const guildModalCheckboxes = document.querySelectorAll('#filters-modal .filter-modal-dropdown[data-filter-type="guild"] input[type="checkbox"]');
    const cpMinFilter = document.getElementById('filters-modal-cp-min');
    const cpMaxFilter = document.getElementById('filters-modal-cp-max');
    const ptTagFilter = document.getElementById('filters-modal-pt-tag-filter');
    const ptTagMode = document.getElementById('filters-modal-pt-tag-mode');

    // Filtre de classe du 'th' (desktop)
    const desktopClassCheckboxes = document.querySelectorAll('#class-filter-panel input[type="checkbox"]');

    // Boutons
    const classFilterBtnDesktop = document.getElementById('class-filter-btn');
    const openFiltersBtnMobile = document.getElementById('open-filters-btn');
    const openFiltersBtnTeams = document.getElementById('open-filters-btn-teams'); // Nouveau
    const openFiltersBtnGuilds = document.getElementById('open-filters-btn-guilds'); // Nouveau

    // Lignes du tableau
    const memberRows = document.querySelectorAll('#leaderboard-table tbody tr');
    const allTeamRows = document.querySelectorAll('#teams-leaderboard-table tbody tr.team-data-row'); // Nouveau
    const allGuildRows = document.querySelectorAll('.guild-leaderboard-table tbody tr'); // Nouveau

    function applyFilters() {
        // Lire les filtres
        const selectedClassesDesktop = Array.from(desktopClassCheckboxes).filter(c => c.checked).map(c => c.dataset.class);
        const selectedClassesModal = Array.from(classModalCheckboxes).filter(c => c.checked).map(c => c.dataset.class);
        const selectedClasses = [...new Set([...selectedClassesDesktop, ...selectedClassesModal])];
        const selectedTeams = Array.from(teamModalCheckboxes).filter(c => c.checked).map(c => c.dataset.team);
        const selectedGuilds = Array.from(guildModalCheckboxes).filter(c => c.checked).map(c => c.dataset.guild);
        const cpMin = parseCpFilter(cpMinFilter.value);
        const cpMax = parseCpFilter(cpMaxFilter.value) || Infinity;
        const selectedPtTag = ptTagFilter.value;
        const ptMode = ptTagMode.value;

        // --- 1. Appliquer aux lignes JOUEURS ---
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
                ptMatch = (ptMode === 'has' && hasTag) || (ptMode === 'missing' && !hasTag);
            }

            const isVisible = classMatch && teamMatch && guildMatch && cpMatch && ptMatch;
            row.style.display = isVisible ? '' : 'none';

            if (isVisible) {
                row.querySelector('.rank-col').textContent = visibleRank;
                row.classList.remove('rank-1', 'rank-2', 'rank-3');
                if (visibleRank <= 3) row.classList.add(`rank-${visibleRank}`);
                visibleRank++;
            }
        });

        // --- 2. Appliquer aux lignes ÉQUIPES ---
        let visibleTeamRank = 1;
        allTeamRows.forEach(row => {
            const teamMatch = selectedTeams.length === 0 || selectedTeams.includes(row.dataset.team);
            const guildMatch = selectedGuilds.length === 0 || selectedGuilds.includes(row.dataset.guild);

            const isVisible = teamMatch && guildMatch;
            row.style.display = isVisible ? '' : 'none';
            if (row.nextElementSibling) row.nextElementSibling.style.display = 'none'; // Cacher la ligne membres

            if (isVisible) {
                row.querySelector('.rank-col').textContent = visibleTeamRank;
                row.classList.remove('rank-1', 'rank-2', 'rank-3');
                if(visibleTeamRank <= 3) row.classList.add(`rank-${visibleTeamRank}`);
                visibleTeamRank++;
            }
        });

        // --- 3. Appliquer aux lignes GUILDES ---
        let visibleGuildRank = 1;
        allGuildRows.forEach(row => {
            const guildMatch = selectedGuilds.length === 0 || selectedGuilds.includes(row.dataset.guild);
            const isVisible = guildMatch;
            row.style.display = isVisible ? '' : 'none';

            if (isVisible) {
                row.querySelector('.rank-col').textContent = visibleGuildRank;
                row.classList.remove('rank-1', 'rank-2', 'rank-3');
                if(visibleGuildRank <= 3) row.classList.add(`rank-${visibleGuildRank}`);
                visibleGuildRank++;
            }
        });


        // Mettre à jour les indicateurs de filtre
        updateFilterIndicators(selectedClasses, selectedTeams, selectedGuilds, cpMin, cpMax, selectedPtTag);
    }

    function updateFilterIndicators(classes, teams, guilds, cpMin, cpMax, ptTag) {
        // Bouton desktop (classe uniquement)
        if (classFilterBtnDesktop) {
            const span = classFilterBtnDesktop.querySelector('span');
            if (span) {
                span.textContent = classes.length > 0 ? `Player (${classes.length})` : 'Player';
                classFilterBtnDesktop.classList.toggle('active', classes.length > 0);
            }
        }

        // Compte total des filtres
        let totalFilters = classes.length + teams.length + guilds.length
            + (cpMin > 0 ? 1 : 0) + (cpMax !== Infinity ? 1 : 0)
            + (ptTag ? 1 : 0);

        // Bouton mobile (JOUEURS)
        if (openFiltersBtnMobile) {
            openFiltersBtnMobile.textContent = totalFilters > 0 ? `Filtres (${totalFilters})` : 'Filtres';
            openFiltersBtnMobile.classList.toggle('active', totalFilters > 0);
        }

        // Bouton mobile (ÉQUIPES)
        if (openFiltersBtnTeams) {
            openFiltersBtnTeams.textContent = totalFilters > 0 ? `Filtres (${totalFilters})` : 'Filtres';
            openFiltersBtnTeams.classList.toggle('active', totalFilters > 0);
        }

        // Bouton mobile (GUILDES)
        if (openFiltersBtnGuilds) {
            openFiltersBtnGuilds.textContent = totalFilters > 0 ? `Filtres (${totalFilters})` : 'Filtres';
            openFiltersBtnGuilds.classList.toggle('active', totalFilters > 0);
        }

        // Mettre à jour le texte des boutons DANS la modale
        document.querySelectorAll('#filters-modal .filter-modal-dropdown').forEach(dropdown => {
            const btn = dropdown.querySelector('.filter-modal-dropdown-btn');
            const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
            const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
            const defaultText = btn.dataset.defaultText || 'Select';

            if (selectedCount > 0) {
                btn.textContent = `${defaultText} (${selectedCount})`;
            } else {
                btn.textContent = defaultText;
            }
        });
    }


    // --- GESTION DES DROPDOWNS ---

    // Dropdowns DANS la modale de filtre
    document.querySelectorAll('#filters-modal .filter-modal-dropdown-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const dropdown = button.closest('.filter-modal-dropdown');
            if (!dropdown) return;

            const panel = dropdown.querySelector('.filter-modal-dropdown-panel');
            if (!panel) return;

            // Ferme les autres dropdowns *dans la modale* avant d'ouvrir celui-ci
            const isCurrentlyOpen = dropdown.classList.contains('open');
            document.querySelectorAll('#filters-modal .filter-modal-dropdown').forEach(d => d.classList.remove('open'));

            if (!isCurrentlyOpen) {
                dropdown.classList.add('open');
            }
            e.stopPropagation();
        });
    });

    // Dropdown du filtre de classe DESKTOP (en-tête de tableau)
    document.querySelectorAll('.player-header-cell .dropdown-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            let panel;
            const parentContainer = button.closest('.player-header-cell');
            if (parentContainer) panel = parentContainer.querySelector('.dropdown-panel');
            if (!panel) return;

            const isCurrentlyOpen = panel.classList.contains('show');
            document.querySelectorAll('.dropdown-panel').forEach(p => p.classList.remove('show'));
            if (!isCurrentlyOpen) panel.classList.add('show');
            e.stopPropagation();
        });
    });

    // Fermeture globale des dropdowns au clic extérieur
    window.addEventListener('click', (e) => {
        // Ferme les dropdowns DESKTOP
        if (!e.target.closest('.player-header-cell .dropdown-btn')) {
            document.querySelectorAll('.player-header-cell .dropdown-panel.show').forEach(panel => panel.classList.remove('show'));
        }
        // Ferme les dropdowns DANS LA MODALE
        if (!e.target.closest('.filter-modal-dropdown-btn')) {
            document.querySelectorAll('#filters-modal .filter-modal-dropdown.open').forEach(dropdown => dropdown.classList.remove('open'));
        }
    });


    // Attache les écouteurs d'événements à TOUS les filtres
    document.querySelectorAll('#class-filter-panel input, #filters-modal input, #filters-modal select').forEach(el => {
        el.addEventListener('change', applyFilters);
        if (el.type === 'text') {
            el.addEventListener('keyup', applyFilters);
        }
        // Empêche la fermeture du dropdown quand on clique sur une checkbox/label dedans
        if (el.closest('.filter-modal-dropdown-panel') || el.closest('#class-filter-panel')) {
            el.addEventListener('click', e => e.stopPropagation());
            if (el.parentElement.tagName === 'LABEL') {
                el.parentElement.addEventListener('click', e => e.stopPropagation());
            }
        }
    });

    // Initialiser les indicateurs au chargement
    applyFilters();

    // --- LOGIQUE POUR LES AUTRES LEADERBOARDS (Ancienne logique de filtre de team supprimée) ---

    // L'ancienne logique 'teamGuildFilter' a été supprimée et intégrée dans 'applyFilters'

    document.querySelectorAll('.team-data-row').forEach(headerRow => {
        headerRow.addEventListener('click', () => {
            // Sur mobile, cette logique est gérée par la modale
            if (window.innerWidth > 768) {
                const membersRow = headerRow.nextElementSibling;
                if (membersRow) {
                    membersRow.style.display = membersRow.style.display === 'table-row' ? 'none' : 'table-row';
                }
            }
        });
    });
}