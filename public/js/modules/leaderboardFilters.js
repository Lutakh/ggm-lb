// public/js/modules/leaderboardFilters.js
import { parseCpFilter } from './utils.js';

export function initLeaderboardFilters() {

    // --- SÉLECTEURS DES FILTRES (UNIQUEMENT MODALE MAINTENANT) ---
    const modalClassCheckboxes = document.querySelectorAll('#modal-class-filter-panel input[type="checkbox"]');
    const modalGuildCheckboxes = document.querySelectorAll('#modal-guild-filter-panel input[type="checkbox"]');
    const cpMinFilter = document.getElementById('filters-modal-cp-min');
    const cpMaxFilter = document.getElementById('filters-modal-cp-max');
    const ptTagFilter = document.getElementById('filters-modal-pt-tag-filter');
    const ptTagMode = document.getElementById('filters-modal-pt-tag-mode');

    // BOUTON UI
    const openFiltersBtn = document.getElementById('open-filters-btn');
    const memberRows = document.querySelectorAll('#leaderboard-table tbody tr');

    function applyFilters() {
        const cpMin = cpMinFilter ? parseCpFilter(cpMinFilter.value) : 0;
        const cpMax = cpMaxFilter ? (parseCpFilter(cpMaxFilter.value) || Infinity) : Infinity;
        const selectedPtTag = ptTagFilter ? ptTagFilter.value : '';
        const ptMode = ptTagMode ? ptTagMode.value : 'has';

        // Récupération des sélections depuis la modale uniquement
        const selectedClasses = Array.from(modalClassCheckboxes).filter(c => c.checked).map(c => c.dataset.class);
        const selectedGuilds = Array.from(modalGuildCheckboxes).filter(c => c.checked).map(c => c.dataset.guild);

        // Application aux lignes
        let visibleRank = 1;
        memberRows.forEach(row => {
            const rowCP = parseInt(row.dataset.cp || '0', 10);
            const rowClass = row.dataset.class || 'unknown';
            const rowGuild = row.dataset.guild || '';
            const rowPtTags = row.dataset.ptTags || '[]';

            // Si aucune classe sélectionnée, tout afficher (comportement par défaut)
            const classMatch = selectedClasses.length === 0 || selectedClasses.includes(rowClass);
            // Idem pour les guildes
            const guildMatch = selectedGuilds.length === 0 || selectedGuilds.includes(rowGuild);
            const cpMatch = rowCP >= cpMin && rowCP <= cpMax;

            let ptMatch = true;
            if (selectedPtTag) {
                try {
                    const playerTags = JSON.parse(rowPtTags);
                    ptMatch = (ptMode === 'has' && playerTags.includes(selectedPtTag)) ||
                        (ptMode === 'missing' && !playerTags.includes(selectedPtTag));
                } catch(e) { ptMatch = (ptMode === 'missing'); }
            }

            const isVisible = classMatch && guildMatch && cpMatch && ptMatch;
            row.style.display = isVisible ? '' : 'none';

            if (isVisible) {
                const rankCol = row.querySelector('.rank-col');
                if(rankCol) rankCol.textContent = visibleRank;
                row.classList.remove('rank-1', 'rank-2', 'rank-3');
                if (visibleRank <= 3) row.classList.add(`rank-${visibleRank}`);
                visibleRank++;
            }
        });

        updateFilterIndicators(selectedClasses, selectedGuilds, cpMin, cpMax, selectedPtTag);
    }

    function updateFilterIndicators(classes, guilds, cpMin, cpMax, ptTag) {
        // Mise à jour du texte du bouton principal "Filters"
        let totalFilters = classes.length + guilds.length + (cpMin > 0 ? 1 : 0) + (cpMax !== Infinity ? 1 : 0) + (ptTag ? 1 : 0);
        if (openFiltersBtn) {
            openFiltersBtn.textContent = totalFilters > 0 ? `Filters (${totalFilters})` : 'Filters';
            openFiltersBtn.classList.toggle('active', totalFilters > 0);
        }

        // Mise à jour des textes des dropdowns DANS la modale
        document.querySelectorAll('#filters-modal .filter-modal-dropdown').forEach(dropdown => {
            const btn = dropdown.querySelector('.filter-modal-dropdown-btn');
            const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
            const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
            const defaultText = btn.dataset.defaultText || 'Select';
            btn.textContent = selectedCount > 0 ? `${defaultText} (${selectedCount})` : defaultText;
        });
    }

    // Gestion des dropdowns DANS LA MODALE
    document.querySelectorAll('#filters-modal .filter-modal-dropdown-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const dropdown = button.closest('.filter-modal-dropdown');
            if (!dropdown) return;
            // Fermer les autres dropdowns de la modale si ouverts
            document.querySelectorAll('#filters-modal .filter-modal-dropdown').forEach(d => {
                if (d !== dropdown) d.classList.remove('open');
            });
            dropdown.classList.toggle('open');
            e.stopPropagation();
        });
    });

    // Fermer les dropdowns si on clique ailleurs
    window.addEventListener('click', (e) => {
        if (!e.target.closest('.filter-modal-dropdown-btn') && !e.target.closest('.filter-modal-dropdown-panel')) {
            document.querySelectorAll('.filter-modal-dropdown.open').forEach(d => d.classList.remove('open'));
        }
    });

    // Attacher les listeners aux inputs de la modale
    const allInputs = [
        ...modalClassCheckboxes, ...modalGuildCheckboxes,
        cpMinFilter, cpMaxFilter, ptTagFilter, ptTagMode
    ];

    allInputs.forEach(el => {
        if (!el) return;
        el.addEventListener('change', applyFilters);
        if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'number')) {
            el.addEventListener('input', applyFilters);
        }
        // Empêcher la fermeture du dropdown lors du clic sur un élément à l'intérieur
        if (el.closest('.filter-modal-dropdown-panel')) {
            el.addEventListener('click', e => e.stopPropagation());
            if (el.parentElement.tagName === 'LABEL') el.parentElement.addEventListener('click', e => e.stopPropagation());
        }
    });

    applyFilters(); // Application initiale
}