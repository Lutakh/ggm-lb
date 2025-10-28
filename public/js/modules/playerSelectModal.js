// public/js/modules/playerSelectModal.js

let modal = null;
let backdrop = null;
let filterInput = null;
let playerListContainer = null;
let closeModalBtn = null;
let createPlayerBtn = null;

let allPlayers = []; // Stocker la liste des joueurs pour la modale
let activeSuggestionIndex = -1;
let currentTriggerContext = null; // Pour savoir qui a ouvert la modale (formulaire, daily quests, etc.)
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

    // --- Logique d'exclusion pour Daily Quests ---
    let excludedPlayerIds = [];
    if (currentTriggerContext && currentTriggerContext.type === 'dailyQuest' && currentTriggerContext.allSelectedIds) {
        // Exclure les joueurs déjà sélectionnés dans les *autres* slots Daily Quests
        excludedPlayerIds = currentTriggerContext.allSelectedIds.filter((id, i) => id !== null && i !== currentTriggerContext.index);
    }
    // --- Fin Logique d'exclusion ---

    allPlayers
        .filter(p =>
            p.name.toLowerCase().includes(query) &&
            !excludedPlayerIds.includes(p.id) // Appliquer l'exclusion
        )
        .sort((a, b) => a.name.localeCompare(b.name)) // Trier par nom
        .forEach(player => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            // **Important**: Stocker l'ID et le nom dans les data attributes
            item.dataset.playerId = player.id;
            item.dataset.playerName = player.name;
            // Afficher la classe si disponible (peut être utile)
            const playerClass = player.class ? `<span class="class-tag class-${player.class.toLowerCase()}">${player.class.substring(0, 3)}</span>` : '';
            item.innerHTML = `<span>${player.name}</span> ${playerClass}`;
            playerListContainer.appendChild(item);
        });
    activeSuggestionIndex = -1; // Réinitialiser l'index actif
}

// Ferme la modale
function closeModal() {
    if (modal) modal.style.display = 'none';
    if (backdrop) backdrop.style.display = 'none';
    currentTriggerContext = null; // Réinitialiser le contexte
    currentSelectCallback = null; // Réinitialiser le callback
}

// Appelle le callback lorsqu'un joueur existant est sélectionné
function selectExistingPlayer(playerId, playerName) {
    // Vérification ajoutée
    if (playerId === undefined || playerId === null || !playerName) {
        console.error("selectExistingPlayer called with invalid data:", { playerId, playerName });
        closeModal(); // Fermer la modale pour éviter un état incohérent
        return;
    }
    if (currentSelectCallback) {
        // Assurer que l'ID est bien un nombre
        currentSelectCallback(Number(playerId), playerName, currentTriggerContext);
    }
    closeModal();
}

// Gère le clic sur le bouton "Create New"
function handleCreatePlayer() {
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
        currentSelectCallback(null, newName, currentTriggerContext);
        closeModal();
    } else if (!currentTriggerContext || !currentTriggerContext.allowCreation) {
        alert("Creating new players is not allowed from this selection.");
    }
}

// Fonction exportée pour ouvrir la modale depuis d'autres modules
export function openModal(triggerContext, selectCallback) {
    if (!modal || !backdrop || !filterInput) {
        console.error("Cannot open player select modal, elements not initialized.");
        return;
    }
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

// Fonction d'initialisation appelée une fois depuis main.js
export function initPlayerSelectModal(playersData) {
    modal = document.getElementById('player-select-modal');
    backdrop = document.getElementById('player-select-modal-backdrop');
    filterInput = document.getElementById('player-filter-input');
    playerListContainer = document.getElementById('player-select-list');
    closeModalBtn = modal?.querySelector('.player-select-close-btn');
    createPlayerBtn = document.getElementById('create-new-player-btn');

    allPlayers = playersData || []; // Stocker les données des joueurs

    if (!modal || !backdrop || !filterInput || !playerListContainer || !closeModalBtn || !createPlayerBtn) {
        console.error("One or more player select modal elements are missing! Modal functionality will be limited.");
        return;
    }

    // Attacher les listeners internes à la modale
    closeModalBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    filterInput.addEventListener('input', () => {
        populatePlayerList(filterInput.value);
    });

    filterInput.addEventListener('keydown', (e) => {
        const items = playerListContainer.querySelectorAll('.suggestion-item');
        if (items.length === 0 && e.key !== 'Enter') return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
            updateActiveSuggestion(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
            updateActiveSuggestion(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const activeItem = playerListContainer.querySelector('.suggestion-item.active');
            if (activeItem && activeItem.dataset.playerId && activeItem.dataset.playerName) {
                selectExistingPlayer(activeItem.dataset.playerId, activeItem.dataset.playerName);
            } else if (items.length > 0 && activeSuggestionIndex === -1 && items[0].dataset.playerId && items[0].dataset.playerName) {
                selectExistingPlayer(items[0].dataset.playerId, items[0].dataset.playerName);
            } else if (filterInput.value.trim() !== '' && currentTriggerContext && currentTriggerContext.allowCreation) {
                handleCreatePlayer();
            }
        }
    });

    playerListContainer.addEventListener('click', (e) => {
        const selectedItem = e.target.closest('.suggestion-item');
        // **Vérification ajoutée**
        if (selectedItem && selectedItem.dataset.playerId && selectedItem.dataset.playerName) {
            selectExistingPlayer(selectedItem.dataset.playerId, selectedItem.dataset.playerName);
        } else if (selectedItem) {
            console.error("Clicked item is missing player data:", selectedItem);
        }
    });

    createPlayerBtn.addEventListener('click', handleCreatePlayer);
}