import { formatCP } from './utils.js';

export function initPerilousTrials() {
    let fullGlobalLeaderboard = [];

    const helpBtn = document.getElementById('pt-help-btn');
    const helpModal = document.getElementById('pt-help-modal');
    const helpBackdrop = document.getElementById('pt-help-modal-backdrop');
    const helpCloseBtn = document.getElementById('pt-help-close-btn');

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

    const ptSelect = document.getElementById('pt-select');
    const ptTable = document.getElementById('pt-leaderboard-table');
    const ptTableBody = ptTable?.querySelector('tbody');
    const ptGlobalTable = document.getElementById('pt-global-leaderboard-table');
    const ptGlobalTableBody = ptGlobalTable?.querySelector('tbody');
    const ptIdInputAdmin = document.getElementById('pt-id-input');
    const urlParams = new URLSearchParams(window.location.search);
    const ptIdFromUrl = urlParams.get('pt_id');
    const ptClassFilterBtn = document.getElementById('pt-class-filter-btn');
    const ptClassFilterPanel = document.getElementById('pt-class-filter-panel');
    const ptClassFilters = document.querySelectorAll('#pt-class-filter-panel input');

    if (ptClassFilterBtn) {
        ptClassFilterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            ptClassFilterPanel.classList.toggle('show');
        });
    }
    window.addEventListener('click', (e) => {
        if (ptClassFilterPanel && !ptClassFilterPanel.contains(e.target) && !ptClassFilterBtn.contains(e.target)) {
            ptClassFilterPanel.classList.remove('show');
        }
    });

    function applyGlobalPtFilters() {
        const selectedClasses = Array.from(ptClassFilters).filter(c => c.checked).map(c => c.dataset.class);
        const filteredData = fullGlobalLeaderboard.filter(player => selectedClasses.length === 0 || selectedClasses.includes(player.class));

        if (!ptGlobalTableBody) return;
        ptGlobalTableBody.innerHTML = '';
        if (filteredData.length === 0) {
            ptGlobalTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No players match filters.</td></tr>';
            return;
        }

        filteredData.forEach((player, index) => {
            const row = document.createElement('tr');
            row.classList.add('podium');
            if (index < 3) row.classList.add(`rank-${index + 1}`);
            row.innerHTML = `
                <td class="rank-col">${index + 1}</td>
                <td>${player.name}</td>
                <td><span class="class-tag class-${player.class.toLowerCase()}">${player.class}</span></td>
                <td class="cp-display">${formatCP(player.combat_power)}</td>
                <td><strong>${player.points}</strong></td>
            `;
            ptGlobalTableBody.appendChild(row);
        });
        if (ptClassFilterBtn) ptClassFilterBtn.classList.toggle('active', selectedClasses.length > 0);
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
            if (ptIdInputAdmin) ptIdInputAdmin.value = ptId;
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
                if(entry.rank <= 3) row.classList.add(`rank-${entry.rank}`);
                row.innerHTML = `<td class="rank-col">${entry.rank}</td><td>${teamHtml}</td>`;
                ptTableBody.appendChild(row);
            });
        }
    }

    if (ptSelect) {
        ptSelect.addEventListener('change', () => loadPtLeaderboard(ptSelect.value));
        const initialPtId = ptIdFromUrl || 'global';
        ptSelect.value = initialPtId;
        loadPtLeaderboard(initialPtId);
    }

    ptClassFilters.forEach(input => input.addEventListener('change', applyGlobalPtFilters));

    const ptAdminForm = document.getElementById('pt-admin-form');
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
        if (!ptId) {
            ptRankInput.value = '';
            validatePtForm();
            return;
        }
        try {
            const response = await fetch(`/pt-leaderboard/${ptId}/next-rank`);
            const data = await response.json();
            ptRankInput.value = data.nextRank || 1;
            validatePtForm();
        } catch (error) {
            console.error('Failed to fetch next rank:', error);
            ptRankInput.value = 1;
            validatePtForm();
        }
    }

    const populatePlayerList = (filter = '') => {
        playerListContainer.innerHTML = '';
        const query = filter.toLowerCase();
        const selectedNames = [];
        for (let i = 0; i < 4; i++) {
            if (i !== activePlayerIndex) {
                const name = ptAdminForm.querySelector(`#pt-player-name-hidden-${i}`).value;
                if (name) selectedNames.push(name.toLowerCase());
            }
        }
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
        filterInput.value = '';
        populatePlayerList();
        modal.style.display = 'flex';
        backdrop.style.display = 'block';
        filterInput.focus();
        activeSuggestionIndex = -1;
    };

    const closeModal = () => {
        modal.style.display = 'none';
        backdrop.style.display = 'none';
        activePlayerIndex = null;
    };

    const selectPlayer = (name) => {
        if (activePlayerIndex === null) return;
        const isExistingPlayer = allPlayers.some(p => p.name.toLowerCase() === name.toLowerCase());
        document.getElementById(`pt-player-display-${activePlayerIndex}`).textContent = name;
        document.getElementById(`pt-player-name-hidden-${activePlayerIndex}`).value = name;
        const newPlayerFields = document.getElementById(`pt-new-player-fields-${activePlayerIndex}`);
        const classInput = newPlayerFields.querySelector('select[name*="[class]"]');
        const guildContainer = newPlayerFields.querySelector('.custom-guild-select');
        const cpInput = newPlayerFields.querySelector('input[name*="[cp]"]');

        newPlayerFields.style.display = 'grid';

        if (isExistingPlayer) {
            classInput.style.display = 'none';
            guildContainer.style.display = 'none';
            classInput.required = false;
            cpInput.placeholder = "Update CP (Optional)";
            cpInput.required = false;
        } else {
            classInput.style.display = 'block';
            guildContainer.style.display = 'block';
            classInput.required = true;
            cpInput.placeholder = "CP (e.g., 1.2M)";
            cpInput.required = true;
        }
        closeModal();
        validatePtForm();
    };

    ptAdminForm.querySelectorAll('.pt-open-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => openModal(parseInt(btn.dataset.playerIndex, 10)));
    });

    closeModalBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    filterInput.addEventListener('input', () => {
        populatePlayerList(filterInput.value);
        activeSuggestionIndex = -1;
    });

    playerListContainer.addEventListener('click', (e) => {
        const selectedItem = e.target.closest('.suggestion-item');
        if (selectedItem) selectPlayer(selectedItem.dataset.playerName);
    });

    createPlayerBtn.addEventListener('click', () => {
        const newName = filterInput.value.trim();
        if (newName) selectPlayer(newName);
    });

    filterInput.addEventListener('keydown', (e) => {
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
            } else if (items.length > 0) {
                selectPlayer(items[0].dataset.playerName);
            } else if (filterInput.value.trim() !== '') {
                selectPlayer(filterInput.value.trim());
            }
        }
    });

    document.querySelectorAll('.custom-guild-select').forEach(container => {
        const input = container.querySelector('.guild-select-input');
        const panel = container.querySelector('.guild-select-panel');

        const populateGuildOptions = (filter = '') => {
            panel.innerHTML = '';
            const lowerFilter = filter.toLowerCase();

            availableGuilds
                .filter(g => g.toLowerCase().includes(lowerFilter))
                .forEach(guild => {
                    const option = document.createElement('div');
                    option.className = 'guild-option';
                    option.textContent = guild;
                    option.addEventListener('mousedown', (e) => {
                        e.preventDefault();
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
                createOption.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    const newGuildName = filter.trim();
                    input.value = newGuildName;
                    if (!availableGuilds.some(g => g.toLowerCase() === newGuildName.toLowerCase())) {
                        availableGuilds.push(newGuildName);
                    }
                    container.classList.remove('open');
                    validatePtForm();
                });
                panel.appendChild(createOption);
            }
        };

        input.addEventListener('focus', () => {
            populateGuildOptions(input.value);
            container.classList.add('open');
        });

        input.addEventListener('blur', () => {
            // Petit délai pour permettre au clic sur une option de se déclencher
            setTimeout(() => container.classList.remove('open'), 150);
        });

        input.addEventListener('input', () => {
            if (!container.classList.contains('open')) {
                container.classList.add('open');
            }
            populateGuildOptions(input.value);
            validatePtForm();
        });
    });

    const validatePtForm = () => {
        const ptId = ptIdInput.value;
        const rank = ptRankInput.value;
        let isFormValid = true;
        let playerCount = 0;
        const names = new Set();

        for (let i = 0; i < 4; i++) {
            const name = ptAdminForm.querySelector(`#pt-player-name-hidden-${i}`).value.trim();
            if (name) {
                playerCount++;
                names.add(name.toLowerCase());
                const isExistingPlayer = allPlayers.some(p => p.name.toLowerCase() === name.toLowerCase());
                if (!isExistingPlayer) {
                    const classInput = ptAdminForm.querySelector(`select[name="players[${i}][class]"]`);
                    const cpInput = ptAdminForm.querySelector(`input[name="players[${i}][cp]"]`);
                    if (!classInput.value || !cpInput.value.trim()) {
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

        if (!ptId || !rank || playerCount !== 4) {
            isFormValid = false;
        }

        submitBtn.disabled = !isFormValid;
    };

    ptIdInput.addEventListener('change', () => findNextAvailableRank(ptIdInput.value));
    ptRankInput.addEventListener('input', validatePtForm);
    ptAdminForm.querySelectorAll('select, input').forEach(input => {
        const eventType = ['SELECT', 'INPUT'].includes(input.tagName) ? (input.type === 'text' ? 'input' : 'change') : 'change';
        input.addEventListener(eventType, validatePtForm);
    });

    validatePtForm();
}