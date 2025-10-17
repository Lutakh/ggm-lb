export function initPerilousTrials() {
    // --- Logique d'affichage du classement (inchangée) ---
    const ptSelect = document.getElementById('pt-select');
    const ptTableBody = document.getElementById('pt-leaderboard-table')?.querySelector('tbody');
    const ptIdInputAdmin = document.getElementById('pt-id-input');
    const urlParams = new URLSearchParams(window.location.search);
    const ptIdFromUrl = urlParams.get('pt_id');

    async function loadPtLeaderboard(ptId) {
        if (!ptId || !ptTableBody) return;
        if (ptIdInputAdmin) ptIdInputAdmin.value = ptId;
        const response = await fetch(`/pt-leaderboard/${ptId}`);
        const leaderboard = await response.json();
        ptTableBody.innerHTML = '';
        if (leaderboard.length === 0) {
            ptTableBody.innerHTML = '<tr><td colspan="2" style="text-align: center;">No data for this trial yet.</td></tr>';
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

    if (ptSelect) {
        ptSelect.addEventListener('change', () => loadPtLeaderboard(ptSelect.value));
    }
    if (ptIdFromUrl && ptSelect) {
        ptSelect.value = ptIdFromUrl;
        loadPtLeaderboard(ptIdFromUrl);
    }

    // --- NOUVELLE LOGIQUE DU FORMULAIRE PT ---
    const ptAdminForm = document.getElementById('pt-admin-form');
    if (!ptAdminForm) return;

    const modal = document.getElementById('pt-player-select-modal');
    const backdrop = document.getElementById('pt-player-select-modal-backdrop');
    const filterInput = document.getElementById('pt-player-filter-input');
    const playerListContainer = document.getElementById('pt-player-select-list');
    const closeModalBtn = document.getElementById('pt-player-select-close-btn');
    const createPlayerBtn = document.getElementById('pt-create-new-player-btn');
    const submitBtn = ptAdminForm.querySelector('button[type="submit"]');

    const playersDataElement = document.getElementById('pt-players-data-source');
    const allPlayers = playersDataElement ? JSON.parse(playersDataElement.textContent) : [];

    let activePlayerIndex = null;
    let activeSuggestionIndex = -1;

    const getCurrentlySelectedNames = () => {
        const names = [];
        for (let i = 0; i < 4; i++) {
            if (i !== activePlayerIndex) {
                const name = ptAdminForm.querySelector(`#pt-player-name-hidden-${i}`).value;
                if (name) names.push(name.toLowerCase());
            }
        }
        return names;
    };

    const populatePlayerList = (filter = '') => {
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
        const fields = newPlayerFields.querySelectorAll('select, input');
        
        if (!isExistingPlayer && name) {
            newPlayerFields.style.display = 'grid';
            fields.forEach(field => {
                if (field.name.includes('[class]') || field.name.includes('[cp]')) field.required = true;
            });
        } else {
            newPlayerFields.style.display = 'none';
            fields.forEach(field => {
                field.required = false;
                field.value = '';
            });
        }
        closeModal();
        validateTeamSubmission();
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

    // NOUVELLE LOGIQUE DE NAVIGATION CLAVIER
    const updateActiveSuggestion = (items) => {
        items.forEach((item, index) => {
            if (index === activeSuggestionIndex) {
                item.classList.add('active');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
    };

    filterInput.addEventListener('keydown', (e) => {
        const items = playerListContainer.querySelectorAll('.suggestion-item');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (items.length > 0) {
                activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
                updateActiveSuggestion(items);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (items.length > 0) {
                activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
                updateActiveSuggestion(items);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const activeItem = playerListContainer.querySelector('.suggestion-item.active');
            if (activeItem) {
                selectPlayer(activeItem.dataset.playerName);
            } else if (items.length > 0) {
                selectPlayer(items[0].dataset.playerName);
            } else if (filterInput.value.trim() !== '') {
                createPlayerBtn.click();
            }
        }
    });
    
    const validateTeamSubmission = () => {
        const names = [];
        for (let i = 0; i < 4; i++) {
            const name = ptAdminForm.querySelector(`#pt-player-name-hidden-${i}`).value;
            if (name) names.push(name.toLowerCase());
        }
        
        const uniqueNames = new Set(names);
        
        if (names.length > 0 && names.length > uniqueNames.size) {
            submitBtn.disabled = true;
            submitBtn.style.backgroundColor = 'var(--accent-color)';
            submitBtn.textContent = 'Duplicate Player';
        } else {
            submitBtn.disabled = false;
            submitBtn.style.backgroundColor = '';
            submitBtn.textContent = 'Submit Team';
        }
    };
    
    validateTeamSubmission();
}
