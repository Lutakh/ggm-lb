// public/js/modules/perilousTrials.js
import { formatCP } from './utils.js';
import { openModal } from './playerSelectModal.js';
import { openGuildModal } from './guildSelectModal.js';

export function initPerilousTrials(showPlayerDetails, allPlayersMap) {
    let fullGlobalLeaderboard = [];

    // --- SÉLECTEURS DU DOM ---
    const helpBtns = document.querySelectorAll('#pt-help-btn-desktop, #pt-help-btn-mobile');
    const addTeamBtns = document.querySelectorAll('#pt-add-team-btn-desktop, #pt-add-team-btn-mobile');
    const adminFormContainer = document.getElementById('pt-admin-form-container');

    const helpModal = document.getElementById('pt-help-modal');
    const helpBackdrop = document.getElementById('pt-help-modal-backdrop');
    const helpCloseBtn = document.getElementById('pt-help-close-btn');

    // Filtres Desktop
    const ptSelect = document.getElementById('pt-select');
    const ptGlobalModeSelector = document.getElementById('pt-global-mode-selector');
    const ptGlobalMode = document.getElementById('pt-global-mode');
    // NOUVEAU : Bouton filtre Desktop
    const openPtFiltersBtnDesktop = document.getElementById('open-pt-filters-btn-desktop');

    // Filtres Modale Mobile & PC (unifiés)
    const openPtFiltersBtn = document.getElementById('open-pt-filters-btn'); // Mobile button
    const ptFiltersModal = document.getElementById('pt-filters-modal');
    const ptFiltersBackdrop = document.getElementById('pt-filters-modal-backdrop');
    const ptFiltersCloseBtn = document.getElementById('pt-filters-modal-close-btn');

    // Tableaux
    const ptTable = document.getElementById('pt-leaderboard-table');
    const ptTableBody = ptTable?.querySelector('tbody');
    const ptGlobalTable = document.getElementById('pt-global-leaderboard-table');
    const ptGlobalTableBody = ptGlobalTable?.querySelector('tbody');
    // MODIFICATION : Cible désormais les inputs DANS la modale
    const ptClassFilters = document.querySelectorAll('#pt-modal-class-filter-panel input');

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

    // --- GESTION DU BOUTON ADD TEAM ---
    if (addTeamBtns.length > 0 && adminFormContainer) {
        addTeamBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const isHidden = adminFormContainer.style.display === 'none';
                adminFormContainer.style.display = isHidden ? 'block' : 'none';
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
    // NOUVEAU : Listener pour le bouton desktop
    if (openPtFiltersBtnDesktop) openPtFiltersBtnDesktop.addEventListener('click', openPtFiltersModal);

    if (ptFiltersCloseBtn) ptFiltersCloseBtn.addEventListener('click', closePtFiltersModal);
    if (ptFiltersBackdrop) ptFiltersBackdrop.addEventListener('click', closePtFiltersModal);


    // --- GESTION DES CLASSEMENTS ---
    function applyGlobalPtFilters() {
        if (!ptGlobalTableBody) return;
        // Utilise maintenant les filtres de la modale
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
            // Permet le clic pour voir les détails
            row.dataset.playerName = player.name;
            row.innerHTML = `<td class="rank-col">${rank}</td><td class="pt-global-player-col"><span class="class-tag class-${String(player.class || 'unknown').toLowerCase()}">${player.name}</span></td><td class="cp-display pt-global-cp-col" data-cp="${player.combat_power}">${formatCP(player.combat_power)}</td><td>${player.points}</td>`;
            ptGlobalTableBody.appendChild(row);
        });

        // Mise à jour visuelle des boutons Filtres (optionnel, indique qu'un filtre est actif)
        const active = selectedClasses.length > 0;
        if (openPtFiltersBtn) {
            openPtFiltersBtn.classList.toggle('active', active);
            openPtFiltersBtn.textContent = active ? `PT Filters (${selectedClasses.length})` : 'PT Filters';
        }
        if (openPtFiltersBtnDesktop) {
            openPtFiltersBtnDesktop.classList.toggle('active', active);
            openPtFiltersBtnDesktop.textContent = active ? `Filters (${selectedClasses.length})` : 'Filters';
        }
    }

    async function loadPtLeaderboard(ptId) {
        if (!ptId || !ptTableBody || !ptGlobalTable) return;
        const isGlobal = ptId === 'global';
        ptTable.style.display = isGlobal ? 'none' : 'table';
        ptGlobalTable.style.display = isGlobal ? 'table' : 'none';
        if (ptGlobalModeSelector) ptGlobalModeSelector.style.display = isGlobal ? 'flex' : 'none';
        // Afficher le bouton de filtre desktop seulement si on est en mode Global
        if (openPtFiltersBtnDesktop) openPtFiltersBtnDesktop.style.display = isGlobal ? 'block' : 'none';


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
        });
    }
    // Attache les listeners aux nouveaux inputs de la modale
    ptClassFilters.forEach(input => input.addEventListener('change', applyGlobalPtFilters));

    // Clic sur le tableau global pour voir les détails du joueur
    if (ptGlobalTableBody) {
        ptGlobalTableBody.addEventListener('click', (e) => {
            const playerRow = e.target.closest('tr');
            // Modifié pour permettre le clic sur toute la ligne si désiré, ou garder restriction
            if (!playerRow || !playerRow.dataset.playerName) return;
            // Optionnel : restreindre au clic sur le nom seulement si préféré
            // if (!e.target.closest('.pt-global-player-col')) return;

            e.preventDefault();
            const player = allPlayersMap.get(playerRow.dataset.playerName);
            if (player && showPlayerDetails) {
                showPlayerDetails({ dataset: { ...player, rank: playerRow.querySelector('.rank-col')?.textContent || 'N/A', cp: player.combat_power, playSlots: JSON.stringify(player.play_slots || '[]'), updated: player.updated_at, notes: player.notes || '-', ptTags: JSON.stringify(player.pt_tags || '[]') } });
            }
        });
    }

    // --- FORMULAIRE ADMIN (inchangé) ---
    if (ptAdminForm) {
        // ... (reste du code admin inchangé pour garder la réponse concise) ...
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
    loadPtLeaderboard(initialPtId);
    if (ptAdminForm && document.getElementById('pt-id-input')) {
        document.getElementById('pt-id-input').value = initialPtId;
        findNextAvailableRank(initialPtId);
    }
}