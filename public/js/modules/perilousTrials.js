// public/js/modules/perilousTrials.js
import { formatCP } from './utils.js';
import { openModal } from './playerSelectModal.js';
import { openGuildModal } from './guildSelectModal.js';

export function initPerilousTrials(showPlayerDetails, allPlayersMap) {
    let fullGlobalLeaderboard = [];

    // --- SÉLECTEURS DU DOM ---
    const helpBtns = document.querySelectorAll('#pt-help-btn-desktop, #pt-help-btn-mobile');
    // NOUVEAU : Boutons Add Team
    const addTeamBtns = document.querySelectorAll('#pt-add-team-btn-desktop, #pt-add-team-btn-mobile');
    const adminFormContainer = document.getElementById('pt-admin-form-container');

    const helpModal = document.getElementById('pt-help-modal');
    const helpBackdrop = document.getElementById('pt-help-modal-backdrop');
    const helpCloseBtn = document.getElementById('pt-help-close-btn');

    // Filtres Desktop
    const ptSelect = document.getElementById('pt-select');
    const ptGlobalModeSelector = document.getElementById('pt-global-mode-selector');
    const ptGlobalMode = document.getElementById('pt-global-mode');

    // Filtres Modale Mobile
    const openPtFiltersBtn = document.getElementById('open-pt-filters-btn');
    const ptFiltersModal = document.getElementById('pt-filters-modal');
    const ptFiltersBackdrop = document.getElementById('pt-filters-modal-backdrop');
    const ptFiltersCloseBtn = document.getElementById('pt-filters-modal-close-btn');
    const ptFiltersModalSelect = document.getElementById('pt-filters-modal-select');
    const ptFiltersModalMode = document.getElementById('pt-filters-modal-mode');
    const ptFiltersModalModeSelector = document.getElementById('pt-filters-modal-mode-selector');

    // Tableaux
    const ptTable = document.getElementById('pt-leaderboard-table');
    const ptTableBody = ptTable?.querySelector('tbody');
    const ptGlobalTable = document.getElementById('pt-global-leaderboard-table');
    const ptGlobalTableBody = ptGlobalTable?.querySelector('tbody');
    const ptClassFilters = document.querySelectorAll('#pt-class-filter-panel input');

    // Admin
    const ptAdminForm = document.getElementById('pt-admin-form');

    let findNextAvailableRank = async (ptId) => {};

    // --- GESTION DE LA MODALE D'AIDE ---
    if (helpBtns.length > 0) {
        helpBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (helpModal) helpModal.style.display = 'flex';
                if (helpBackdrop) helpBackdrop.style.display = 'block';
            });
        });
    }
    const closeHelpModal = () => {
        if (helpModal) helpModal.style.display = 'none';
        if (helpBackdrop) helpBackdrop.style.display = 'none';
    };
    if (helpCloseBtn) helpCloseBtn.addEventListener('click', closeHelpModal);
    if (helpBackdrop) helpBackdrop.addEventListener('click', closeHelpModal);

    // --- NOUVEAU : GESTION DU BOUTON ADD TEAM ---
    if (addTeamBtns.length > 0 && adminFormContainer) {
        addTeamBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Toggle visibility
                const isHidden = adminFormContainer.style.display === 'none';
                adminFormContainer.style.display = isHidden ? 'block' : 'none';
                // Scroll to form if showing it
                if (isHidden) adminFormContainer.scrollIntoView({ behavior: 'smooth' });
            });
        });
    }

    // --- GESTION DE LA MODALE DE FILTRES PT ---
    const openPtFiltersModal = () => {
        if (ptFiltersModal) ptFiltersModal.style.display = 'flex';
        if (ptFiltersBackdrop) ptFiltersBackdrop.style.display = 'block';
    };
    const closePtFiltersModal = () => {
        if (ptFiltersModal) ptFiltersModal.style.display = 'none';
        if (ptFiltersBackdrop) ptFiltersBackdrop.style.display = 'none';
    };

    if (openPtFiltersBtn) openPtFiltersBtn.addEventListener('click', openPtFiltersModal);
    if (ptFiltersCloseBtn) ptFiltersCloseBtn.addEventListener('click', closePtFiltersModal);
    if (ptFiltersBackdrop) ptFiltersBackdrop.addEventListener('click', closePtFiltersModal);

    // Synchronisation des filtres
    if (ptFiltersModalSelect) {
        ptFiltersModalSelect.addEventListener('change', () => {
            const newPtId = ptFiltersModalSelect.value;
            if (ptSelect) ptSelect.value = newPtId;
            loadPtLeaderboard(newPtId);
            if (ptAdminForm) {
                document.getElementById('pt-id-input').value = newPtId;
                findNextAvailableRank(newPtId);
            }
            closePtFiltersModal();
        });
    }

    if (ptFiltersModalMode) {
        ptFiltersModalMode.addEventListener('change', () => {
            if (ptGlobalMode) ptGlobalMode.value = ptFiltersModalMode.value;
            if (ptSelect.value === 'global') loadPtLeaderboard('global');
            closePtFiltersModal();
        });
    }

    const syncFiltersToModal = () => {
        if (ptSelect && ptFiltersModalSelect) ptFiltersModalSelect.value = ptSelect.value;
        if (ptGlobalMode && ptFiltersModalMode) ptFiltersModalMode.value = ptGlobalMode.value;
        if (ptFiltersModalModeSelector) ptFiltersModalModeSelector.style.display = (ptSelect && ptSelect.value === 'global') ? 'block' : 'none';
    };

    // --- GESTION DES CLASSEMENTS ---
    function applyGlobalPtFilters() {
        if (!ptGlobalTableBody) return;
        const selectedClasses = Array.from(ptClassFilters).filter(c => c.checked).map(c => c.dataset.class);
        const filteredLeaderboard = fullGlobalLeaderboard.filter(player => selectedClasses.length === 0 || selectedClasses.includes(player.class));
        ptGlobalTableBody.innerHTML = '';
        if (filteredLeaderboard.length === 0) {
            ptGlobalTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No data for the global ranking yet.</td></tr>';
        }
        filteredLeaderboard.forEach((player, index) => {
            const rank = index + 1;
            const row = document.createElement('tr');
            row.classList.add('podium');
            if (rank <= 3) row.classList.add(`rank-${rank}`);
            row.dataset.playerName = player.name;
            row.innerHTML = `<td class="rank-col">${rank}</td><td class="player-name-cell pt-global-player-col"><span class="class-tag class-${String(player.class || 'unknown').toLowerCase()}">${player.name}</span></td><td class="cp-display pt-global-cp-col" data-cp="${player.combat_power}">${formatCP(player.combat_power)}</td><td>${player.points}</td>`;
            ptGlobalTableBody.appendChild(row);
        });
        const ptFilterBtn = document.getElementById('pt-class-filter-btn');
        if (ptFilterBtn) {
            const span = ptFilterBtn.querySelector('span');
            if (span) span.textContent = selectedClasses.length > 0 ? `Player (${selectedClasses.length})` : 'Player';
            ptFilterBtn.classList.toggle('active', selectedClasses.length > 0);
        }
    }

    async function loadPtLeaderboard(ptId) {
        if (!ptId || !ptTableBody || !ptGlobalTable) return;
        const isGlobal = ptId === 'global';
        ptTable.style.display = isGlobal ? 'none' : 'table';
        ptGlobalTable.style.display = isGlobal ? 'table' : 'none';
        if (ptGlobalModeSelector) ptGlobalModeSelector.style.display = isGlobal ? 'flex' : 'none';
        syncFiltersToModal();

        if (isGlobal) {
            const mode = ptGlobalMode ? ptGlobalMode.value : 'all';
            const response = await fetch(`/pt-leaderboard/global?mode=${mode}`);
            fullGlobalLeaderboard = await response.json();
            applyGlobalPtFilters();
        } else {
            const response = await fetch(`/pt-leaderboard/${ptId}`);
            const leaderboard = await response.json();
            ptTableBody.innerHTML = '';
            if (leaderboard.length === 0) {
                ptTableBody.innerHTML = '<tr><td colspan="2" style="text-align: center;">No data yet.</td></tr>';
                return;
            }
            leaderboard.forEach(entry => {
                let teamHtml = '<div class="pt-leaderboard-team">';
                for (let i = 1; i <= 4; i++) {
                    const name = entry[`player${i}_name`];
                    const pClass = entry[`player${i}_class`];
                    if (name) teamHtml += `<div class="pt-leaderboard-player"><span class="class-tag class-${(pClass || 'unknown').toLowerCase()}">${name}</span></div>`;
                }
                teamHtml += '</div>';
                const row = document.createElement('tr');
                row.classList.add('podium');
                if (entry.rank <= 3) row.classList.add(`rank-${entry.rank}`);
                row.innerHTML = `<td class="rank-col">${entry.rank}</td><td>${teamHtml}</td>`;
                ptTableBody.appendChild(row);
            });
        }
    }

    if (ptSelect) {
        ptSelect.addEventListener('change', () => {
            const newPtId = ptSelect.value;
            loadPtLeaderboard(newPtId);
            if (ptAdminForm) {
                document.getElementById('pt-id-input').value = newPtId;
                findNextAvailableRank(newPtId);
            }
        });
    }
    if (ptGlobalMode) {
        ptGlobalMode.addEventListener('change', () => {
            if (ptSelect.value === 'global') loadPtLeaderboard('global');
            syncFiltersToModal();
        });
    }
    ptClassFilters.forEach(input => input.addEventListener('change', applyGlobalPtFilters));
    if (ptGlobalTableBody) {
        ptGlobalTableBody.addEventListener('click', (e) => {
            const playerRow = e.target.closest('tr');
            if (!playerRow || !playerRow.dataset.playerName || !e.target.closest('.pt-global-player-col')) return;
            e.preventDefault();
            const player = allPlayersMap.get(playerRow.dataset.playerName);
            if (player && showPlayerDetails) {
                showPlayerDetails({ dataset: { ...player, rank: playerRow.querySelector('.rank-col')?.textContent || 'N/A', cp: player.combat_power, playSlots: JSON.stringify(player.play_slots || '[]'), updated: player.updated_at, notes: player.notes || '-', ptTags: JSON.stringify(player.pt_tags || '[]') } });
            }
        });
    }

    // --- FORMULAIRE ADMIN ---
    if (ptAdminForm) {
        const submitBtn = ptAdminForm.querySelector('button[type="submit"]');
        const ptIdInput = document.getElementById('pt-id-input');
        const ptRankInput = document.getElementById('pt-team-rank');

        const validatePtForm = () => {
            const ptId = ptIdInput.value;
            const rank = parseInt(ptRankInput.value, 10);
            let playersSelectedCount = 0;
            let formIsValid = true;
            for (let i = 0; i < 4; i++) {
                const name = document.getElementById(`pt-player-name-hidden-${i}`)?.value;
                if (name) {
                    playersSelectedCount++;
                    if (!allPlayersMap.has(name)) {
                        const classVal = document.querySelector(`select[name="players[${i}][class]"]`)?.value;
                        const cpVal = document.querySelector(`input[name="players[${i}][cp]"]`)?.value.trim();
                        if (!classVal || !cpVal) { formIsValid = false; break; }
                    }
                }
            }
            submitBtn.disabled = !(ptId && rank > 0 && playersSelectedCount === 4 && formIsValid);
        };

        const handlePtPlayerSelection = (playerId, playerName, triggerContext) => {
            const index = triggerContext.index;
            const player = allPlayersMap.get(playerName);
            const nameDisplay = document.getElementById(`pt-player-display-${index}`);
            const nameHidden = document.getElementById(`pt-player-name-hidden-${index}`);
            const container = document.getElementById(`pt-new-player-fields-${index}`);
            const classSelect = container.querySelector(`select[name="players[${index}][class]"]`);
            const guildDisplay = document.getElementById(`pt-guild-display-${index}`);
            const guildHidden = document.getElementById(`pt-guild-hidden-${index}`);
            const cpInput = container.querySelector(`input[name="players[${index}][cp]"]`);

            nameDisplay.textContent = playerName;
            nameHidden.value = playerName;
            container.style.display = 'grid';

            let cpDateEl = container.querySelector('.cp-date-info');
            if (!cpDateEl) {
                cpDateEl = document.createElement('div');
                cpDateEl.className = 'cp-date-info';
                cpDateEl.style.cssText = 'font-size:0.85em; color:#8c5a3a; opacity:0.8; margin-top:-8px; margin-bottom:8px; font-style:italic; grid-column:1/-1;';
                cpInput.parentNode.insertBefore(cpDateEl, cpInput.nextSibling);
            }

            if (player) {
                classSelect.style.display = 'none'; classSelect.required = false; classSelect.value = "";
                cpInput.required = false; cpInput.value = formatCP(player.combat_power); cpInput.placeholder = 'CP (e.g., 1.2M)';

                if (player.guild) {
                    guildDisplay.textContent = player.guild;
                    guildDisplay.style.fontStyle = 'normal';
                    guildHidden.value = player.guild;
                } else {
                    guildDisplay.textContent = "Guild (Optional)";
                    guildDisplay.style.fontStyle = 'italic';
                    guildHidden.value = "";
                }

                // NOUVEAU : Format de date avec heure
                if (player.cp_last_updated) {
                    const d = new Date(player.cp_last_updated);
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const hour = String(d.getHours()).padStart(2, '0');
                    const min = String(d.getMinutes()).padStart(2, '0');
                    cpDateEl.textContent = `Last CP update: ${day}/${month} at ${hour}:${min}`;
                } else {
                    cpDateEl.textContent = 'Last CP update: Never';
                }
                cpDateEl.style.display = 'block';
            } else {
                classSelect.style.display = 'block'; classSelect.required = true;
                cpInput.required = true; cpInput.value = ''; cpInput.placeholder = 'CP (e.g., 1.2M)';
                guildDisplay.textContent = "Guild (Optional)"; guildDisplay.style.fontStyle = 'italic'; guildHidden.value = "";
                cpDateEl.style.display = 'none';
            }
            validatePtForm();
        };

        ptAdminForm.querySelectorAll('.pt-open-modal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => openModal({ type: 'ptAdmin', index: parseInt(e.currentTarget.dataset.playerIndex, 10), allowCreation: true }, handlePtPlayerSelection));
        });

        ptAdminForm.querySelectorAll('.pt-select-guild-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.currentTarget.dataset.playerIndex;
                openGuildModal((selectedGuildName) => {
                    const display = document.getElementById(`pt-guild-display-${index}`);
                    const hidden = document.getElementById(`pt-guild-hidden-${index}`);
                    if (display && hidden) {
                        display.textContent = selectedGuildName;
                        display.style.fontStyle = 'normal';
                        hidden.value = selectedGuildName;
                    }
                });
            });
        });

        findNextAvailableRank = async (ptId) => {
            if (!ptId || ptId === 'global') { ptRankInput.value = 1; validatePtForm(); return; }
            try {
                const res = await fetch(`/pt-leaderboard/${ptId}/next-rank`);
                const data = await res.json();
                ptRankInput.value = data.nextRank || 1;
            } catch (e) { ptRankInput.value = 1; }
            validatePtForm();
        };

        if (ptIdInput) ptIdInput.addEventListener('change', () => findNextAvailableRank(ptIdInput.value));
        if (ptRankInput) ptRankInput.addEventListener('input', validatePtForm);
        ptAdminForm.querySelectorAll('.pt-new-player-fields select, .pt-new-player-fields input').forEach(i => i.addEventListener('change', validatePtForm));
        ptAdminForm.querySelectorAll('.pt-new-player-fields input').forEach(i => i.addEventListener('input', validatePtForm));

        findNextAvailableRank(ptIdInput.value);
    }

    const initialPtId = new URLSearchParams(window.location.search).get('pt_id') || 'global';
    if (ptSelect) ptSelect.value = initialPtId;
    if (ptFiltersModalSelect) ptFiltersModalSelect.value = initialPtId;
    loadPtLeaderboard(initialPtId);
    if (ptAdminForm && document.getElementById('pt-id-input')) {
        document.getElementById('pt-id-input').value = initialPtId;
        findNextAvailableRank(initialPtId);
    }
}