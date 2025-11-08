// public/js/modules/leaderboardFilters.js
import { parseCpFilter } from './utils.js';

export function initLeaderboardFilters() {

    // --- SÉLECTEURS DES FILTRES ---
    // DESKTOP Filters (Header dropdowns)
    const desktopClassCheckboxes = document.querySelectorAll('#class-filter-panel input[type="checkbox"]');
    const desktopGuildCheckboxes = document.querySelectorAll('#guild-filter-panel input[type="checkbox"]');

    // MOBILE / MODAL Filters
    const modalClassCheckboxes = document.querySelectorAll('#modal-class-filter-panel input[type="checkbox"]');
    const modalGuildCheckboxes = document.querySelectorAll('#modal-guild-filter-panel input[type="checkbox"]');
    const cpMinFilter = document.getElementById('filters-modal-cp-min');
    const cpMaxFilter = document.getElementById('filters-modal-cp-max');
    const ptTagFilter = document.getElementById('filters-modal-pt-tag-filter');
    const ptTagMode = document.getElementById('filters-modal-pt-tag-mode');

    // BOUTONS / UI
    const classFilterBtnDesktop = document.getElementById('class-filter-btn');
    const guildFilterBtnDesktop = document.getElementById('guild-filter-btn');
    const openFiltersBtnMobile = document.getElementById('open-filters-btn');
    const memberRows = document.querySelectorAll('#leaderboard-table tbody tr');

    function applyFilters() {
        const cpMin = cpMinFilter ? parseCpFilter(cpMinFilter.value) : 0;
        const cpMax = cpMaxFilter ? (parseCpFilter(cpMaxFilter.value) || Infinity) : Infinity;
        const selectedPtTag = ptTagFilter ? ptTagFilter.value : '';
        const ptMode = ptTagMode ? ptTagMode.value : 'has';

        // Fusion des sélections Desktop et Mobile
        const selectedClasses = [
            ...Array.from(desktopClassCheckboxes).filter(c => c.checked).map(c => c.dataset.class),
            ...Array.from(modalClassCheckboxes).filter(c => c.checked).map(c => c.dataset.class)
        ];
        const uniqueSelectedClasses = [...new Set(selectedClasses)];

        const selectedGuilds = [
            ...Array.from(desktopGuildCheckboxes).filter(c => c.checked).map(c => c.dataset.guild),
            ...Array.from(modalGuildCheckboxes).filter(c => c.checked).map(c => c.dataset.guild)
        ];
        const uniqueSelectedGuilds = [...new Set(selectedGuilds)];

        // Application aux lignes
        let visibleRank = 1;
        memberRows.forEach(row => {
            const rowCP = parseInt(row.dataset.cp || '0', 10);
            const rowClass = row.dataset.class || 'unknown';
            const rowGuild = row.dataset.guild || '';
            const rowPtTags = row.dataset.ptTags || '[]';

            const classMatch = uniqueSelectedClasses.length === 0 || uniqueSelectedClasses.includes(rowClass);
            const guildMatch = uniqueSelectedGuilds.length === 0 || uniqueSelectedGuilds.includes(rowGuild);
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

        // Synchronisation visuelle (optionnelle mais recommandée)
        syncCheckboxes(desktopClassCheckboxes, uniqueSelectedClasses, 'class');
        syncCheckboxes(modalClassCheckboxes, uniqueSelectedClasses, 'class');
        syncCheckboxes(desktopGuildCheckboxes, uniqueSelectedGuilds, 'guild');
        syncCheckboxes(modalGuildCheckboxes, uniqueSelectedGuilds, 'guild');

        updateFilterIndicators(uniqueSelectedClasses, uniqueSelectedGuilds, cpMin, cpMax, selectedPtTag);
    }

    function syncCheckboxes(checkboxList, selectedValues, dataAttr) {
        checkboxList.forEach(cb => {
            cb.checked = selectedValues.includes(cb.dataset[dataAttr]);
        });
    }

    function updateFilterIndicators(classes, guilds, cpMin, cpMax, ptTag) {
        if (classFilterBtnDesktop) {
            const span = classFilterBtnDesktop.querySelector('span');
            if (span) span.textContent = classes.length > 0 ? `Player (${classes.length})` : 'Player';
            classFilterBtnDesktop.classList.toggle('active', classes.length > 0);
        }
        if (guildFilterBtnDesktop) {
            const span = guildFilterBtnDesktop.querySelector('span');
            if (span) span.textContent = guilds.length > 0 ? `Guild (${guilds.length})` : 'Guild';
            guildFilterBtnDesktop.classList.toggle('active', guilds.length > 0);
        }

        let totalFilters = classes.length + guilds.length + (cpMin > 0 ? 1 : 0) + (cpMax !== Infinity ? 1 : 0) + (ptTag ? 1 : 0);
        if (openFiltersBtnMobile) {
            openFiltersBtnMobile.textContent = totalFilters > 0 ? `Filters (${totalFilters})` : 'Filters';
            openFiltersBtnMobile.classList.toggle('active', totalFilters > 0);
        }

        document.querySelectorAll('#filters-modal .filter-modal-dropdown').forEach(dropdown => {
            const btn = dropdown.querySelector('.filter-modal-dropdown-btn');
            const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
            const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
            const defaultText = btn.dataset.defaultText || 'Select';
            btn.textContent = selectedCount > 0 ? `${defaultText} (${selectedCount})` : defaultText;
        });
    }

    // Gestion des dropdowns (Desktop & Mobile Modal)
    document.querySelectorAll('#filters-modal .filter-modal-dropdown-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const dropdown = button.closest('.filter-modal-dropdown');
            if (!dropdown) return;
            document.querySelectorAll('#filters-modal .filter-modal-dropdown').forEach(d => {
                if (d !== dropdown) d.classList.remove('open');
            });
            dropdown.classList.toggle('open');
            e.stopPropagation();
        });
    });

    document.querySelectorAll('.player-header-cell .dropdown-btn, .guild-header-cell .dropdown-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const parentCell = button.closest('th');
            const panel = parentCell?.querySelector('.dropdown-panel');
            if (!panel) return;
            const isCurrentlyOpen = panel.classList.contains('show');
            document.querySelectorAll('.dropdown-panel.show').forEach(p => p.classList.remove('show'));
            if (!isCurrentlyOpen) panel.classList.add('show');
            e.stopPropagation();
        });
    });

    window.addEventListener('click', (e) => {
        if (!e.target.closest('.header-filter-btn') && !e.target.closest('.dropdown-panel')) {
            document.querySelectorAll('.dropdown-panel.show').forEach(p => p.classList.remove('show'));
        }
        if (!e.target.closest('.filter-modal-dropdown-btn') && !e.target.closest('.filter-modal-dropdown-panel')) {
            document.querySelectorAll('.filter-modal-dropdown.open').forEach(d => d.classList.remove('open'));
        }
    });

    // Attacher les listeners aux inputs
    const allInputs = [
        ...desktopClassCheckboxes, ...desktopGuildCheckboxes,
        ...modalClassCheckboxes, ...modalGuildCheckboxes,
        cpMinFilter, cpMaxFilter, ptTagFilter, ptTagMode
    ];

    allInputs.forEach(el => {
        if (!el) return;
        el.addEventListener('change', applyFilters);
        if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'number')) {
            el.addEventListener('input', applyFilters);
        }
        if (el.closest('.dropdown-panel') || el.closest('.filter-modal-dropdown-panel')) {
            el.addEventListener('click', e => e.stopPropagation());
            if (el.parentElement.tagName === 'LABEL') el.parentElement.addEventListener('click', e => e.stopPropagation());
        }
    });

    applyFilters(); // Initial application
}