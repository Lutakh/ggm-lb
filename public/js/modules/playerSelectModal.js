// public/js/modules/playerSelectModal.js

let modal = null;
let backdrop = null;
let filterInput = null;
let playerListContainer = null;
let closeModalBtn = null;
let createPlayerBtn = null;

let allPlayers = []; // Stocker la liste des joueurs pour la modale
let activeSuggestionIndex = -1;
let currentTriggerContext = null; // Pour savoir qui a ouvert la modale
let currentSelectCallback = null; // La fonction à appeler lors de la sélection

// Met à jour la suggestion active dans la liste (navigation clavier)
function updateActiveSuggestion(items) {
    items.forEach((item, index) => {
        item.classList.toggle('active', index === activeSuggestionIndex);
        if (index === activeSuggestionIndex) {
            item.scrollIntoView({ block: 'nearest' });
        }
    });
}

// Remplit la liste des joueurs dans la modale en fonction du filtre
function populatePlayerList(filter = '') {
    if (!playerListContainer) return;
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
            const playerClass = player.class ? `<span class="class-tag class-${player.class.toLowerCase()}">${player.class.substring(0, 3)}</span>` : '';
            item.innerHTML = `<span>${player.name}</span> ${playerClass}`;
            playerListContainer.appendChild(item);
        });
    activeSuggestionIndex = -1; // Réinitialiser l'index actif APRES avoir repeuplé la liste
}

// Ferme la modale
function closeModal() {
    if (modal) modal.style.display = 'none';
    if (backdrop) backdrop.style.display = 'block'; // CORRECTION: Devrait être 'none'
    if (backdrop) backdrop.style.display = 'none';   // Assurer la fermeture
    currentTriggerContext = null;
    currentSelectCallback = null;
    activeSuggestionIndex = -1;
    if (filterInput) filterInput.value = '';
}

// Appelle le callback lorsqu'un joueur existant est sélectionné
function selectExistingPlayer(playerId, playerName) {
    console.log("[Modal] selectExistingPlayer attempting with:", { playerId, playerName }); // DEBUG LOG
    if (playerId === undefined || playerId === null || !playerName) {
        console.error("[Modal] selectExistingPlayer: Invalid data received!");
        closeModal();
        return;
    }
    if (currentSelectCallback) {
        console.log("[Modal] Calling registered callback function..."); // DEBUG LOG
        try {
            currentSelectCallback(Number(playerId), playerName, currentTriggerContext);
        } catch (e) {
            console.error("[Modal] Error executing selection callback:", e);
        }
    } else {
        console.warn("[Modal] selectExistingPlayer: No callback function was registered."); // DEBUG LOG
    }
    closeModal();
}

// Gère le clic sur le bouton "Create New"
function handleCreatePlayer() {
    if (!filterInput) return;
    const newName = filterInput.value.trim();
    if (!newName) {
        alert("Please type a name before creating a new player.");
        return;
    }
    const exists = allPlayers.some(p => p.name.toLowerCase() === newName.toLowerCase());
    if (exists) {
        alert(`Player "${newName}" already exists. Please select them from the list or choose a different name.`);
        filterInput.focus();
        return;
    }

    if (currentTriggerContext && currentTriggerContext.allowCreation && currentSelectCallback) {
        console.log(`[Modal] Creating new player: ${newName}`); // DEBUG LOG
        currentSelectCallback(null, newName, currentTriggerContext); // ID est null pour nouveau joueur
        closeModal();
    } else if (!currentTriggerContext || !currentTriggerContext.allowCreation) {
        alert("Creating new players is not allowed from this selection context.");
    } else {
        console.warn("[Modal] handleCreatePlayer: allowCreation is true but no callback is registered."); // DEBUG LOG
    }
}

// Fonction exportée pour ouvrir la modale depuis d'autres modules
export function openModal(triggerContext, selectCallback) {
    if (!modal || !backdrop || !filterInput) {
        console.error("[Modal] Cannot open player select modal, essential elements not initialized.");
        return;
    }
    currentTriggerContext = triggerContext;
    currentSelectCallback = selectCallback;
    console.log("[Modal] Opening modal with context:", triggerContext); // DEBUG LOG

    if (createPlayerBtn) {
        createPlayerBtn.style.display = triggerContext.allowCreation ? '' : 'none';
    }

    filterInput.value = '';
    populatePlayerList();
    modal.style.display = 'flex';
    backdrop.style.display = 'block'; // CORRECTION: Afficher le fond
    filterInput.focus();
    activeSuggestionIndex = -1;
}

// Fonction d'initialisation appelée une fois depuis main.js
export function initPlayerSelectModal(playersData) {
    modal = document.getElementById('player-select-modal');
    backdrop = document.getElementById('player-select-modal-backdrop');
    filterInput = document.getElementById('player-filter-input');
    playerListContainer = document.getElementById('player-select-list');
    closeModalBtn = modal?.querySelector('.player-select-close-btn');
    createPlayerBtn = document.getElementById('create-new-player-btn');

    if (!modal || !backdrop || !filterInput || !playerListContainer || !closeModalBtn || !createPlayerBtn) {
        console.error("[Modal Init] One or more player select modal elements are missing! Modal functionality will be limited.");
        return;
    }

    allPlayers = playersData || [];

    // --- Attacher les listeners internes à la modale ---
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
                console.log("[Modal] Enter key pressed. Active index:", activeSuggestionIndex); // DEBUG LOG
                // **CORRECTION**: Utiliser l'index pour trouver l'élément dans la liste ACTUELLE
                if (activeSuggestionIndex >= 0 && activeSuggestionIndex < items.length) {
                    const selectedItem = items[activeSuggestionIndex];
                    console.log("[Modal] Item found via Enter index:", selectedItem, selectedItem.dataset); // DEBUG LOG
                    if (selectedItem && selectedItem.dataset.playerId && selectedItem.dataset.playerName) {
                        selectExistingPlayer(selectedItem.dataset.playerId, selectedItem.dataset.playerName);
                    } else {
                        console.error("[Modal] Item selected via Enter index is missing dataset!", selectedItem);
                    }
                }
                // Si pas d'index actif (-1) mais la liste n'est pas vide, on prend le premier
                else if (items.length > 0 && activeSuggestionIndex === -1) {
                    const firstItem = items[0];
                    console.log("[Modal] No active index, selecting first item via Enter:", firstItem, firstItem.dataset); // DEBUG LOG
                    if (firstItem && firstItem.dataset.playerId && firstItem.dataset.playerName) {
                        selectExistingPlayer(firstItem.dataset.playerId, firstItem.dataset.playerName);
                    } else {
                        console.error("[Modal] First item selected via Enter is missing dataset!", firstItem);
                    }
                }
                // Gestion de la création si autorisée
                else if (filterInput.value.trim() !== '' && currentTriggerContext && currentTriggerContext.allowCreation) {
                    console.log("[Modal] No items match/selected, attempting to create new player via Enter."); // DEBUG LOG
                    handleCreatePlayer();
                } else {
                    console.log("[Modal] Enter pressed, but no item to select or create."); // DEBUG LOG
                }
                break;
        }
    });

    // **CORRECTION**: Utilisation de la délégation d'événements pour le clic
    playerListContainer.addEventListener('click', (e) => {
        const selectedItem = e.target.closest('.suggestion-item');
        console.log("[Modal] Click detected in list container. Target:", e.target, "Closest item:", selectedItem); // DEBUG LOG
        if (selectedItem) {
            console.log("[Modal] Clicked item dataset:", selectedItem.dataset); // DEBUG LOG
            if (selectedItem.dataset.playerId && selectedItem.dataset.playerName) {
                selectExistingPlayer(selectedItem.dataset.playerId, selectedItem.dataset.playerName);
            } else {
                console.error("[Modal] Clicked item is missing player data!", selectedItem);
            }
        }
    });

    createPlayerBtn.addEventListener('click', handleCreatePlayer);

    console.log("[Modal Init] Player select modal initialized successfully.");
}