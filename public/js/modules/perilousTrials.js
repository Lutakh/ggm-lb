import { formatCP } from './utils.js';

export function initPerilousTrials() {
    let fullGlobalLeaderboard = [];

    // --- SÉLECTEURS DU DOM ---
    const helpBtn = document.getElementById('pt-help-btn');
    const helpModal = document.getElementById('pt-help-modal');
    const helpBackdrop = document.getElementById('pt-help-modal-backdrop');
    const helpCloseBtn = document.getElementById('pt-help-close-btn');
    const ptSelect = document.getElementById('pt-select');
    const ptTable = document.getElementById('pt-leaderboard-table');
    const ptTableBody = ptTable?.querySelector('tbody');
    const ptGlobalTable = document.getElementById('pt-global-leaderboard-table');
    const ptGlobalTableBody = ptGlobalTable?.querySelector('tbody');
    const ptClassFilters = document.querySelectorAll('#pt-class-filter-panel input');
    const ptAdminForm = document.getElementById('pt-admin-form');

    // --- GESTION DE LA MODALE D'AIDE ---
    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            if (helpModal) helpModal.style.display = 'flex';
            if (helpBackdrop) helpBackdrop.style.display = 'block';
        });
    }
    const closeHelpModal = () => {
        if (helpModal) helpModal.style.display = 'none';
        if (helpBackdrop) helpBackdrop.style.display = 'none';
    };
    if (helpCloseBtn) helpCloseBtn.addEventListener('click', closeHelpModal);
    if (helpBackdrop) helpBackdrop.addEventListener('click', closeHelpModal);

    // --- GESTION DES CLASSEMENTS ET FILTRES ---
    function applyGlobalPtFilters() {
        if (!ptGlobalTableBody) return;

        const selectedClasses = Array.from(ptClassFilters)
            .filter(c => c.checked)
            .map(c => c.dataset.class);

        const filteredLeaderboard = fullGlobalLeaderboard.filter(player => {
            return selectedClasses.length === 0 || selectedClasses.includes(player.class);
        });

        ptGlobalTableBody.innerHTML = '';

        if (filteredLeaderboard.length === 0) {
            ptGlobalTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No data for the global ranking yet.</td></tr>';
            return;
        }

        filteredLeaderboard.forEach((player, index) => {
            const rank = index + 1;
            const row = document.createElement('tr');
            row.classList.add('podium');
            if (rank <= 3) {
                row.classList.add(`rank-${rank}`);
            }

            row.innerHTML = `
                <td class="rank-col">${rank}</td>
                <td>${player.name}</td>
                <td><span class="class-tag class-${String(player.class || 'unknown').toLowerCase()}">${player.class || 'N/A'}</span></td>
                <td class="cp-display" data-cp="${player.combat_power}">${formatCP(player.combat_power)}</td>
                <td>${player.points}</td>
            `;
            ptGlobalTableBody.appendChild(row);
        });
    }

    async function loadPtLeaderboard(ptId) {
        if (!ptId || !ptTableBody || !ptGlobalTable) return;
        const isGlobal = ptId === 'global';
        ptTable.style.display = isGlobal ? 'none' : 'table';
        ptGlobalTable.style.display = isGlobal ? 'table' : 'none';

        if (isGlobal) {
            const response = await fetch(`/pt-leaderboard/global`);
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
                    if (name) {
                        teamHtml += `<div class="pt-leaderboard-player"><span class="class-tag class-${(pClass || 'unknown').toLowerCase()}"></span><span>${name}</span></div>`;
                    }
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
                const ptIdInput = ptAdminForm.querySelector('#pt-id-input');
                if (ptIdInput) ptIdInput.value = newPtId;
                findNextAvailableRank(newPtId);
            }
        });
    }

    ptClassFilters.forEach(input => input.addEventListener('change', applyGlobalPtFilters));

    // --- GESTION DU FORMULAIRE D'ADMINISTRATION ---
    if (!ptAdminForm) return;

    const modal = document.getElementById('pt-player-select-modal');
    const backdrop = document.getElementById('pt-player-select-modal-backdrop');
    const filterInput = document.getElementById('pt-player-filter-input');
    const playerListContainer = document.getElementById('pt-player-select-list');
    const closeModalBtn = document.getElementById('pt-player-select-close-btn');
    const createPlayerBtn = document.getElementById('pt-create-new-player-btn');
    const submitBtn = ptAdminForm.querySelector('button[type="submit"]');
    const ptIdInput = document.getElementById('pt-id-input');
    const ptRankInput = document.getElementById('pt-team-rank');
    const playersDataElement = document.getElementById('pt-players-data-source');
    const allPlayers = playersDataElement ? JSON.parse(playersDataElement.textContent) : [];
    const guildDatalist = document.getElementById('guild-datalist-pt');
    let availableGuilds = guildDatalist ? Array.from(guildDatalist.options).map(opt => opt.value) : [];
    let activePlayerIndex = null;
    let activeSuggestionIndex = -1;

    async function findNextAvailableRank(ptId) {
        if (!ptId || ptId === 'global' || !ptRankInput) {
            if (ptRankInput) ptRankInput.value = '';
            validatePtForm();
            return;
        }
        try {
            const response = await fetch(`/pt-leaderboard/${ptId}/next-rank`);
            const data = await response.json();
            ptRankInput.value = data.nextRank || 1;
        } catch (error) {
            console.error('Failed to fetch next rank:', error);
            ptRankInput.value = 1;
        } finally {
            validatePtForm();
        }
    }

    // ... (Le reste du code reste identique)

    const getCurrentlySelectedNames = () => {
        const names = [];
        for (let i = 0; i < 4; i++) {
            if (i !== activePlayerIndex) {
                const nameInput = ptAdminForm.querySelector(`#pt-player-name-hidden-${i}`);
                if (nameInput && nameInput.value) names.push(nameInput.value.toLowerCase());
            }
        }
        return names;
    };

    const populatePlayerList = (filter = '') => {
        if(!playerListContainer) return;
        playerListContainer.innerHTML = '';
        const query = filter.toLowerCase();
        const selectedNames = getCurrentlySelectedNames();

        allPlayers
            .filter(p => p.name.toLowerCase().includes(query) && !selectedNames.includes(p.name.toLowerCase()))
            .forEach(player => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.dataset.playerName = player.name;
                item.innerHTML = `<span>${player.name}</span><span class="class-tag class-${player.class.toLowerCase()}">${player.class}</span>`;
                playerListContainer.appendChild(item);
            });
    };

    const openModal = (playerIndex) => {
        activePlayerIndex = playerIndex;
        if(filterInput) filterInput.value = '';
        populatePlayerList();
        if(modal) modal.style.display = 'flex';
        if(backdrop) backdrop.style.display = 'block';
        if(filterInput) filterInput.focus();
        activeSuggestionIndex = -1;
    };

    const closeModal = () => {
        if(modal) modal.style.display = 'none';
        if(backdrop) backdrop.style.display = 'none';
        activePlayerIndex = null;
    };

    const selectPlayer = (name) => {
        if (activePlayerIndex === null) return;
        const isExistingPlayer = allPlayers.some(p => p.name.toLowerCase() === name.toLowerCase());

        document.getElementById(`pt-player-display-${activePlayerIndex}`).textContent = name;
        document.getElementById(`pt-player-name-hidden-${activePlayerIndex}`).value = name;

        const newPlayerFields = document.getElementById(`pt-new-player-fields-${activePlayerIndex}`);
        if(newPlayerFields) {
            const classInput = newPlayerFields.querySelector('select[name*="[class]"]');
            const guildContainer = newPlayerFields.querySelector('.custom-guild-select');
            const cpInput = newPlayerFields.querySelector('input[name*="[cp]"]');

            newPlayerFields.style.display = 'grid';

            if (isExistingPlayer) {
                if(classInput) classInput.style.display = 'none';
                if(guildContainer) guildContainer.style.display = 'none';
                if(classInput) classInput.required = false;
                if(cpInput) cpInput.placeholder = "Update CP (Optional)";
                if(cpInput) cpInput.required = false;
            } else {
                if(classInput) classInput.style.display = 'block';
                if(guildContainer) guildContainer.style.display = 'block';
                if(classInput) classInput.required = true;
                if(cpInput) cpInput.placeholder = "CP (e.g., 1.2M)";
                if(cpInput) cpInput.required = true;
            }
        }
        closeModal();
        validatePtForm();
    };

    ptAdminForm.querySelectorAll('.pt-open-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => openModal(parseInt(btn.dataset.playerIndex, 10)));
    });

    if(closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if(backdrop) backdrop.addEventListener('click', closeModal);
    if(filterInput) filterInput.addEventListener('input', () => {
        populatePlayerList(filterInput.value);
        activeSuggestionIndex = -1;
    });
    if(playerListContainer) playerListContainer.addEventListener('click', (e) => {
        const selectedItem = e.target.closest('.suggestion-item');
        if (selectedItem) selectPlayer(selectedItem.dataset.playerName);
    });
    if(createPlayerBtn) createPlayerBtn.addEventListener('click', () => {
        const newName = filterInput.value.trim();
        if (newName) selectPlayer(newName);
    });
    if(filterInput) filterInput.addEventListener('keydown', (e) => {
        const items = playerListContainer.querySelectorAll('.suggestion-item');
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (items.length > 0) {
                if (e.key === 'ArrowDown') activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
                else activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
                items.forEach((item, index) => {
                    item.classList.toggle('active', index === activeSuggestionIndex);
                    if(index === activeSuggestionIndex) item.scrollIntoView({ block: 'nearest' });
                });
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const activeItem = playerListContainer.querySelector('.suggestion-item.active');
            if (activeItem) {
                selectPlayer(activeItem.dataset.playerName);
            } else if (filterInput.value.trim() !== '') {
                selectPlayer(filterInput.value.trim());
            }
        }
    });

    document.querySelectorAll('.custom-guild-select').forEach(container => {
        const input = container.querySelector('.guild-select-input');
        const panel = container.querySelector('.guild-select-panel');
        let guildSuggestionIndex = -1;

        const updateActiveGuildSuggestion = () => {
            if(!panel) return;
            panel.querySelectorAll('.guild-option').forEach((opt, index) => {
                opt.classList.toggle('active', index === guildSuggestionIndex);
            });
        };

        const populateGuildOptions = (filter = '') => {
            if(!panel) return;
            panel.innerHTML = '';
            guildSuggestionIndex = -1;
            const lowerFilter = filter.toLowerCase();

            const filteredGuilds = availableGuilds.filter(g => g.toLowerCase().includes(lowerFilter));
            filteredGuilds.forEach(guild => {
                const option = document.createElement('div');
                option.className = 'guild-option';
                option.textContent = guild;
                option.addEventListener('mousedown', () => {
                    input.value = guild;
                    container.classList.remove('open');
                    validatePtForm();
                });
                panel.appendChild(option);
            });

            if (filter && !availableGuilds.some(g => g.toLowerCase() === lowerFilter)) {
                const createOption = document.createElement('div');
                createOption.className = 'guild-option create-new';
                createOption.textContent = `Create "${filter}"`;
                createOption.addEventListener('mousedown', () => {
                    const newGuildName = filter.trim();
                    input.value = newGuildName;
                    if (!availableGuilds.some(g => g.toLowerCase() === newGuildName.toLowerCase())) {
                        availableGuilds.push(newGuildName);
                    }
                    validatePtForm();
                });
                panel.appendChild(createOption);
            }
        };

        if(input) {
            input.addEventListener('focus', () => {
                populateGuildOptions(input.value);
                container.classList.add('open');
            });
            input.addEventListener('blur', () => setTimeout(() => container.classList.remove('open'), 150));
            input.addEventListener('input', () => {
                if (!container.classList.contains('open')) container.classList.add('open');
                populateGuildOptions(input.value);
            });
            input.addEventListener('keydown', (e) => {
                if(!panel) return;
                const options = panel.querySelectorAll('.guild-option');
                if (!options.length) return;

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    guildSuggestionIndex = (guildSuggestionIndex + 1) % options.length;
                    updateActiveGuildSuggestion();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    guildSuggestionIndex = (guildSuggestionIndex - 1 + options.length) % options.length;
                    updateActiveGuildSuggestion();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (guildSuggestionIndex > -1 && options[guildSuggestionIndex]) {
                        options[guildSuggestionIndex].dispatchEvent(new MouseEvent('mousedown'));
                    } else if (options.length > 0) {
                        options[0].dispatchEvent(new MouseEvent('mousedown'));
                    }
                    container.classList.remove('open');
                }
            });
        }
    });

    const validatePtForm = () => {
        if(!submitBtn || !ptIdInput || !ptRankInput) return;

        const ptId = ptIdInput.value;
        const rank = ptRankInput.value;
        let playerCount = 0;
        const names = new Set();
        let isFormValid = true;

        for (let i = 0; i < 4; i++) {
            const nameInput = ptAdminForm.querySelector(`#pt-player-name-hidden-${i}`);
            if(!nameInput) continue;

            const name = nameInput.value.trim();
            if (name) {
                playerCount++;
                names.add(name.toLowerCase());
                const isExistingPlayer = allPlayers.some(p => p.name.toLowerCase() === name.toLowerCase());
                if (!isExistingPlayer) {
                    const classInput = ptAdminForm.querySelector(`select[name="players[${i}][class]"]`);
                    const cpInput = ptAdminForm.querySelector(`input[name="players[${i}][cp]"]`);
                    if (!classInput || !cpInput || !classInput.value || !cpInput.value.trim()) {
                        isFormValid = false;
                    }
                }
            }
        }

        if (playerCount > 0 && playerCount !== names.size) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Duplicate Players';
            submitBtn.style.backgroundColor = 'var(--accent-color)';
            return;
        } else {
            submitBtn.textContent = 'Submit Team';
            submitBtn.style.backgroundColor = '';
        }

        if (!ptId || !rank || playerCount < 1 || !isFormValid) {
            submitBtn.disabled = true;
        } else {
            submitBtn.disabled = false;
        }
    };

    const urlParams = new URLSearchParams(window.location.search);
    const ptIdFromUrl = urlParams.get('pt_id');

    const initialPtId = ptIdFromUrl || (ptSelect ? ptSelect.value : 'global');
    if (ptSelect) ptSelect.value = initialPtId;
    if (ptIdInput) ptIdInput.value = initialPtId;
    loadPtLeaderboard(initialPtId);
    findNextAvailableRank(initialPtId);

    // ✅ CORRECTION : Ajout de l'écouteur d'événement manquant
    if (ptIdInput) {
        ptIdInput.addEventListener('change', () => findNextAvailableRank(ptIdInput.value));
    }

    ptAdminForm.querySelectorAll('select, input').forEach(input => {
        input.addEventListener('input', validatePtForm);
        input.addEventListener('change', validatePtForm);
    });
}