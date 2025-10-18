import { formatCP } from './utils.js';

export function initPerilousTrials() {
    let fullGlobalLeaderboard = []; // Stocke les données complètes du classement global

    // --- Logique de la modale d'aide ---
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

    // --- Logique d'affichage et de filtrage du classement ---
    const ptSelect = document.getElementById('pt-select');
    const ptTable = document.getElementById('pt-leaderboard-table');
    const ptTableBody = ptTable?.querySelector('tbody');
    const ptGlobalTable = document.getElementById('pt-global-leaderboard-table');
    const ptGlobalTableBody = ptGlobalTable?.querySelector('tbody');
    const ptIdInputAdmin = document.getElementById('pt-id-input');
    const urlParams = new URLSearchParams(window.location.search);
    const ptIdFromUrl = urlParams.get('pt_id');
    const ptGlobalFilters = document.getElementById('pt-global-filters');
    const ptClassFilters = document.querySelectorAll('#pt-class-filter-panel input');

    // NOUVELLE FONCTION : Applique les filtres et redessine le tableau global
    function applyGlobalPtFilters() {
        const selectedClasses = Array.from(ptClassFilters).filter(c => c.checked).map(c => c.dataset.class);

        const filteredData = fullGlobalLeaderboard.filter(player => {
            return selectedClasses.length === 0 || selectedClasses.includes(player.class);
        });

        ptGlobalTableBody.innerHTML = '';
        if (filteredData.length === 0) {
            ptGlobalTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No players match the current filters.</td></tr>';
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

        // Mettre à jour le bouton de filtre
        const classFilterBtn = document.getElementById('pt-class-filter-btn');
        if (classFilterBtn) classFilterBtn.textContent = selectedClasses.length > 0 ? `${selectedClasses.length} class(es)` : 'All Classes';
    }

    async function loadPtLeaderboard(ptId) {
        if (!ptId || !ptTableBody || !ptGlobalTable) return;

        const isGlobal = ptId === 'global';
        ptTable.style.display = isGlobal ? 'none' : 'table';
        ptGlobalTable.style.display = isGlobal ? 'table' : 'none';
        ptGlobalFilters.style.display = isGlobal ? 'flex' : 'none'; // Affiche/masque les filtres

        if (isGlobal) {
            const response = await fetch(`/pt-leaderboard/global`);
            fullGlobalLeaderboard = await response.json(); // Stocke les données
            applyGlobalPtFilters(); // Appelle la fonction de filtrage
        } else {
            // ... (logique inchangée pour les PT individuels)
        }
    }

    if (ptSelect) {
        ptSelect.addEventListener('change', () => loadPtLeaderboard(ptSelect.value));
        const initialPtId = ptIdFromUrl || 'global';
        ptSelect.value = initialPtId;
        loadPtLeaderboard(initialPtId);
    }

    // Ajoute les écouteurs pour les filtres de classe
    ptClassFilters.forEach(input => input.addEventListener('change', applyGlobalPtFilters));


    // --- Logique du formulaire PT (inchangée) ---
    // ... (le reste du code est identique)
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