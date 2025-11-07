// public/js/modules/playerSelectModal.js

let modal = null;
let backdrop = null;
let filterInput = null;
let playerListContainer = null;
let closeModalBtn = null;
let createPlayerBtn = null;

let allPlayers = [];
let activeSuggestionIndex = -1;
let currentTriggerContext = null;
let currentSelectCallback = null;

function updateActiveSuggestion(items) {
    items.forEach((item, index) => {
        item.classList.toggle('active', index === activeSuggestionIndex);
        if (index === activeSuggestionIndex) {
            item.scrollIntoView({ block: 'nearest' });
        }
    });
}

function populatePlayerList(filter = '') {
    if (!playerListContainer) return;
    requestAnimationFrame(() => {
        playerListContainer.innerHTML = '';
        const query = filter.toLowerCase();

        let excludedPlayerIds = [];
        if (currentTriggerContext && currentTriggerContext.type === 'dailyQuest' && currentTriggerContext.allSelectedIds) {
            excludedPlayerIds = currentTriggerContext.allSelectedIds.filter((id, i) => id !== null && i !== currentTriggerContext.index);
        }

        allPlayers
            .filter(p =>
                p.name.toLowerCase().includes(query) &&
                !excludedPlayerIds.includes(p.id)
            )
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(player => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.dataset.playerId = player.id;
                item.dataset.playerName = player.name;
                // MODIFICATION ICI : Utilisation du nom de classe complet (player.class) au lieu de substring
                const playerClass = player.class ? `<span class="class-tag class-${player.class.toLowerCase()}">${player.class}</span>` : '';                item.innerHTML = `<span>${player.name}</span> ${playerClass}`;
                playerListContainer.appendChild(item);
            });
        activeSuggestionIndex = -1;
    });
}

function closeModal() {
    if (modal) modal.style.display = 'none';
    if (backdrop) backdrop.style.display = 'none';
    currentTriggerContext = null;
    currentSelectCallback = null;
    activeSuggestionIndex = -1;
    if (filterInput) filterInput.value = '';
}

function selectExistingPlayer(playerId, playerName) {
    if (playerId === undefined || playerId === null || !playerName) {
        console.error("[Modal] selectExistingPlayer: Invalid data received!");
        closeModal();
        return;
    }
    if (currentSelectCallback) {
        try {
            currentSelectCallback(Number(playerId), playerName, currentTriggerContext);
        } catch (e) {
            console.error("[Modal] Error executing selection callback:", e);
        }
    }
    closeModal();
}

function handleCreatePlayer() {
    const newName = filterInput ? filterInput.value.trim() : '';

    if (!newName) {
        alert("Please type a name before creating a new player.");
        return;
    }

    const exists = allPlayers.some(p => p.name.toLowerCase() === newName.toLowerCase());
    if (exists) {
        alert(`Player "${newName}" already exists. Please select them from the list or choose a different name.`);
        if (filterInput) filterInput.focus();
        return;
    }

    if (currentTriggerContext && currentTriggerContext.allowCreation && currentSelectCallback) {
        currentSelectCallback(null, newName, currentTriggerContext);
        closeModal();
    } else if (!currentTriggerContext || !currentTriggerContext.allowCreation) {
        alert("Creating new players is not allowed from this selection context.");
    }
}

export function openModal(triggerContext, selectCallback) {
    if (!modal || !backdrop || !filterInput) return;
    currentTriggerContext = triggerContext;
    currentSelectCallback = selectCallback;

    if (createPlayerBtn) {
        createPlayerBtn.style.display = triggerContext.allowCreation ? '' : 'none';
    }

    filterInput.value = '';
    populatePlayerList();
    modal.style.display = 'flex';
    backdrop.style.display = 'block';
    filterInput.focus();
    activeSuggestionIndex = -1;
}

export function initPlayerSelectModal(playersData) {
    modal = document.getElementById('player-select-modal');
    backdrop = document.getElementById('player-select-modal-backdrop');
    filterInput = document.getElementById('player-filter-input');
    playerListContainer = document.getElementById('player-select-list');
    closeModalBtn = modal?.querySelector('.player-select-close-btn');
    createPlayerBtn = document.getElementById('create-new-player-btn');

    if (!modal || !backdrop || !filterInput || !playerListContainer || !closeModalBtn || !createPlayerBtn) {
        console.error("[Modal Init] Missing elements.");
        return;
    }

    allPlayers = playersData || [];

    closeModalBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    filterInput.addEventListener('input', () => {
        populatePlayerList(filterInput.value);
    });

    filterInput.addEventListener('keydown', (e) => {
        const items = playerListContainer.querySelectorAll('.suggestion-item');
        if (items.length === 0 && e.key !== 'Enter') return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
                updateActiveSuggestion(items);
                break;
            case 'ArrowUp':
                e.preventDefault();
                activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
                updateActiveSuggestion(items);
                break;
            case 'Enter':
                e.preventDefault();
                if (activeSuggestionIndex >= 0 && activeSuggestionIndex < items.length) {
                    const selectedItem = items[activeSuggestionIndex];
                    if (selectedItem && selectedItem.dataset.playerId && selectedItem.dataset.playerName) {
                        selectExistingPlayer(selectedItem.dataset.playerId, selectedItem.dataset.playerName);
                    }
                }
                else if (items.length > 0 && activeSuggestionIndex === -1) {
                    const firstItem = items[0];
                    if (firstItem && firstItem.dataset.playerId && firstItem.dataset.playerName) {
                        selectExistingPlayer(firstItem.dataset.playerId, firstItem.dataset.playerName);
                    }
                }
                else if (filterInput.value.trim() !== '' && currentTriggerContext && currentTriggerContext.allowCreation) {
                    handleCreatePlayer();
                }
                break;
        }
    });

    playerListContainer.addEventListener('click', (e) => {
        const selectedItem = e.target.closest('.suggestion-item');
        if (selectedItem && selectedItem.dataset.playerId && selectedItem.dataset.playerName) {
            selectExistingPlayer(selectedItem.dataset.playerId, selectedItem.dataset.playerName);
        }
    });

    createPlayerBtn.addEventListener('click', handleCreatePlayer);
}