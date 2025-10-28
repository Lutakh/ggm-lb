// public/js/modules/leaderboardFilters.js
import { parseCpFilter } from './utils.js';

export function initLeaderboardFilters() {

    // --- SÉLECTEURS DES FILTRES ---
    // Filtres de la modale (utilisés UNIQUEMENT pour les joueurs maintenant)
    const classModalCheckboxes = document.querySelectorAll('#filters-modal .filter-modal-dropdown[data-filter-type="class"] input[type="checkbox"]');
    const teamModalCheckboxes = document.querySelectorAll('#filters-modal .filter-modal-dropdown[data-filter-type="team"] input[type="checkbox"]');
    const guildModalCheckboxes = document.querySelectorAll('#filters-modal .filter-modal-dropdown[data-filter-type="guild"] input[type="checkbox"]');
    const cpMinFilter = document.getElementById('filters-modal-cp-min'); // Input Min CP (in modal)
    const cpMaxFilter = document.getElementById('filters-modal-cp-max'); // Input Max CP (in modal)
    const ptTagFilter = document.getElementById('filters-modal-pt-tag-filter'); // Select PT Tag (in modal)
    const ptTagMode = document.getElementById('filters-modal-pt-tag-mode'); // Select PT Mode (in modal)

    // Filtre de classe du 'th' (desktop - joueurs uniquement)
    const desktopClassCheckboxes = document.querySelectorAll('#class-filter-panel input[type="checkbox"]');

    // Boutons
    const classFilterBtnDesktop = document.getElementById('class-filter-btn');
    const openFiltersBtnMobile = document.getElementById('open-filters-btn'); // Joueurs uniquement

    // Lignes du tableau (Joueurs uniquement)
    const memberRows = document.querySelectorAll('#leaderboard-table tbody tr');
    // const allTeamRows = document.querySelectorAll('#teams-leaderboard-table tbody tr.team-data-row'); // Plus géré ici
    // const allGuildRows = document.querySelectorAll('.guild-leaderboard-table tbody tr'); // Plus géré ici

    function applyFilters() {
        // --- ADD NULL CHECKS HERE ---
        const cpMin = cpMinFilter ? parseCpFilter(cpMinFilter.value) : 0;
        const cpMax = cpMaxFilter ? (parseCpFilter(cpMaxFilter.value) || Infinity) : Infinity;
        const selectedPtTag = ptTagFilter ? ptTagFilter.value : '';
        const ptMode = ptTagMode ? ptTagMode.value : 'has';
        // --- END NULL CHECKS ---

        // Lire les filtres (pour les joueurs)
        const selectedClassesDesktop = Array.from(desktopClassCheckboxes).filter(c => c.checked).map(c => c.dataset.class);
        const selectedClassesModal = Array.from(classModalCheckboxes).filter(c => c.checked).map(c => c.dataset.class);
        const selectedClasses = [...new Set([...selectedClassesDesktop, ...selectedClassesModal])];
        const selectedTeams = Array.from(teamModalCheckboxes).filter(c => c.checked).map(c => c.dataset.team);
        const selectedGuilds = Array.from(guildModalCheckboxes).filter(c => c.checked).map(c => c.dataset.guild);

        // --- Appliquer aux lignes JOUEURS ---
        let visibleRank = 1;
        memberRows.forEach(row => {
            // Ensure dataset properties exist before parsing/comparing
            const rowCP = parseInt(row.dataset.cp || '0', 10);
            const rowClass = row.dataset.class || 'unknown';
            const rowTeam = row.dataset.team || 'No Team';
            const rowGuild = row.dataset.guild || '';
            const rowPtTags = row.dataset.ptTags || '[]'; // Default to empty array string

            const classMatch = selectedClasses.length === 0 || selectedClasses.includes(rowClass);
            const teamMatch = selectedTeams.length === 0 || selectedTeams.includes(rowTeam);
            const guildMatch = selectedGuilds.length === 0 || selectedGuilds.includes(rowGuild);
            const cpMatch = rowCP >= cpMin && rowCP <= cpMax;

            let ptMatch = true;
            if (selectedPtTag) {
                try {
                    const playerTags = JSON.parse(rowPtTags);
                    if (Array.isArray(playerTags)) {
                        const hasTag = playerTags.includes(selectedPtTag);
                        ptMatch = (ptMode === 'has' && hasTag) || (ptMode === 'missing' && !hasTag);
                    } else {
                        ptMatch = (ptMode === 'missing'); // Treat invalid tags as missing
                    }
                } catch(e) {
                    console.warn(`Could not parse pt-tags for row ${row.dataset.name}:`, rowPtTags);
                    ptMatch = (ptMode === 'missing'); // Treat parse error as missing
                }
            }

            const isVisible = classMatch && teamMatch && guildMatch && cpMatch && ptMatch;
            row.style.display = isVisible ? '' : 'none'; // Use CSS display property

            if (isVisible) {
                const rankCol = row.querySelector('.rank-col');
                if(rankCol) rankCol.textContent = visibleRank; // Update rank column if found
                row.classList.remove('rank-1', 'rank-2', 'rank-3');
                if (visibleRank <= 3) row.classList.add(`rank-${visibleRank}`);
                visibleRank++;
            }
        });

        // Mettre à jour les indicateurs de filtre (pour les joueurs)
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
            openFiltersBtnMobile.textContent = totalFilters > 0 ? `Filters (${totalFilters})` : 'Filters';
            openFiltersBtnMobile.classList.toggle('active', totalFilters > 0);
        }

        // Mettre à jour le texte des boutons DANS la modale
        document.querySelectorAll('#filters-modal .filter-modal-dropdown').forEach(dropdown => {
            const btn = dropdown.querySelector('.filter-modal-dropdown-btn');
            if (!btn) return; // Safety check
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


    // --- GESTION DES DROPDOWNS (Modale + Header Joueur) ---

    // Dropdowns DANS la modale de filtre
    document.querySelectorAll('#filters-modal .filter-modal-dropdown-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const dropdown = button.closest('.filter-modal-dropdown');
            if (!dropdown) return;
            const panel = dropdown.querySelector('.filter-modal-dropdown-panel');
            if (!panel) return;
            const isCurrentlyOpen = dropdown.classList.contains('open');
            // Fermer TOUS les dropdowns de la modale d'abord
            document.querySelectorAll('#filters-modal .filter-modal-dropdown').forEach(d => d.classList.remove('open'));
            // Ouvrir celui-ci s'il était fermé
            if (!isCurrentlyOpen) dropdown.classList.add('open');
            e.stopPropagation(); // Empêcher la fermeture immédiate par le listener window
        });
    });

    // Dropdown du filtre de classe DESKTOP (en-tête de tableau joueur)
    document.querySelectorAll('.player-header-cell .dropdown-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            let panel;
            const parentContainer = button.closest('.player-header-cell'); // Cibler le TH parent
            if (parentContainer) panel = parentContainer.querySelector('.dropdown-panel');
            if (!panel) return;
            const isCurrentlyOpen = panel.classList.contains('show');
            // Fermer TOUS les dropdowns du header joueur d'abord
            document.querySelectorAll('.player-header-cell .dropdown-panel').forEach(p => p.classList.remove('show'));
            // Ouvrir celui-ci s'il était fermé
            if (!isCurrentlyOpen) panel.classList.add('show');
            e.stopPropagation(); // Empêcher la fermeture immédiate par le listener window
        });
    });

    // Fermeture globale des dropdowns au clic extérieur
    window.addEventListener('click', (e) => {
        // Ferme les dropdowns DESKTOP (header joueur) si clic en dehors
        if (!e.target.closest('.player-header-cell .dropdown-btn') && !e.target.closest('.player-header-cell .dropdown-panel')) {
            document.querySelectorAll('.player-header-cell .dropdown-panel.show').forEach(panel => panel.classList.remove('show'));
        }
        // Ferme les dropdowns DANS LA MODALE si clic en dehors
        if (!e.target.closest('.filter-modal-dropdown-btn') && !e.target.closest('.filter-modal-dropdown-panel')) {
            document.querySelectorAll('#filters-modal .filter-modal-dropdown.open').forEach(dropdown => dropdown.classList.remove('open'));
        }
    });


    // Attache les écouteurs d'événements à TOUS les filtres (modale + header joueur)
    document.querySelectorAll('#class-filter-panel input, #filters-modal input, #filters-modal select').forEach(el => {
        el.addEventListener('change', applyFilters);
        if (el.type === 'text') {
            // Use 'input' for text fields to update more dynamically
            el.addEventListener('input', applyFilters); // Changed from keyup
        }
        // Prevent dropdown closure when interacting with controls inside
        if (el.closest('.filter-modal-dropdown-panel') || el.closest('#class-filter-panel')) {
            el.addEventListener('click', e => e.stopPropagation());
            const label = el.closest('label'); // Check parent label too
            if (label) {
                label.addEventListener('click', e => e.stopPropagation());
            }
        }
    });

    // --- Initialisation ---
    try {
        applyFilters(); // Initialiser les indicateurs et appliquer filtres par défaut au chargement
    } catch (e) {
        console.error("Error during initial filter application:", e);
    }


    // --- Logique d'expansion des membres d'équipe (Desktop uniquement) ---
    document.querySelectorAll('.team-data-row').forEach(headerRow => {
        headerRow.addEventListener('click', () => {
            // Sur mobile, cette logique est gérée par la modale
            if (window.innerWidth > 768) {
                const membersRow = headerRow.nextElementSibling;
                if (membersRow && membersRow.classList.contains('team-members-row')) {
                    // Toggle display using style.display
                    membersRow.style.display = (membersRow.style.display === 'table-row' || membersRow.style.display === '') ? 'none' : 'table-row';
                }
            }
        });
    });
}