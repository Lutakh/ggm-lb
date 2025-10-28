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
            // Fait défiler l'élément actif pour qu'il soit visible
            item.scrollIntoView({ block: 'nearest' });
        }
    });
}

// Remplit la liste des joueurs dans la modale en fonction du filtre
function populatePlayerList(filter = '') {
    if (!playerListContainer) return;
    playerListContainer.innerHTML = ''; // Vider la liste actuelle
    const query = filter.toLowerCase();

    // --- Logique d'exclusion pour Daily Quests ---
    let excludedPlayerIds = [];
    if (currentTriggerContext && currentTriggerContext.type === 'dailyQuest' && currentTriggerContext.allSelectedIds) {
        // Exclure les joueurs déjà sélectionnés dans les *autres* slots Daily Quests
        excludedPlayerIds = currentTriggerContext.allSelectedIds.filter((id, i) => id !== null && i !== currentTriggerContext.index);
    }
    // --- Fin Logique d'exclusion ---

    // Filtrer, trier et créer les éléments de la liste
    allPlayers
        .filter(p =>
            p.name.toLowerCase().includes(query) && // Filtrer par nom
            !excludedPlayerIds.includes(p.id) // Appliquer l'exclusion si nécessaire
        )
        .sort((a, b) => a.name.localeCompare(b.name)) // Trier par nom
        .forEach(player => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            // **Important**: Stocker l'ID et le nom dans les data attributes
            item.dataset.playerId = player.id;
            item.dataset.playerName = player.name;

            // Afficher le nom et optionnellement la classe
            const playerClass = player.class ? `<span class="class-tag class-${player.class.toLowerCase()}">${player.class.substring(0, 3)}</span>` : '';
            item.innerHTML = `<span>${player.name}</span> ${playerClass}`;
            playerListContainer.appendChild(item); // Ajouter l'élément à la liste
        });
    activeSuggestionIndex = -1; // Réinitialiser l'index actif après le filtrage
}

// Ferme la modale et réinitialise l'état
function closeModal() {
    if (modal) modal.style.display = 'none';
    if (backdrop) backdrop.style.display = 'none';
    currentTriggerContext = null; // Oublier qui a ouvert la modale
    currentSelectCallback = null; // Oublier quelle fonction appeler
    activeSuggestionIndex = -1;   // Réinitialiser la sélection clavier
    if (filterInput) filterInput.value = ''; // Vider le champ de filtre
}

// Appelle le callback lorsqu'un joueur existant est sélectionné
function selectExistingPlayer(playerId, playerName) {
    console.log("[Modal] selectExistingPlayer called with:", { playerId, playerName }); // DEBUG LOG
    // Vérification cruciale que les données sont valides
    if (playerId === undefined || playerId === null || !playerName) {
        console.error("[Modal] selectExistingPlayer: Invalid data received!");
        closeModal(); // Fermer pour éviter un état incohérent
        return;
    }
    if (currentSelectCallback) {
        console.log("[Modal] Calling registered callback function..."); // DEBUG LOG
        try {
            // Assurer que l'ID est bien un nombre avant de l'envoyer
            currentSelectCallback(Number(playerId), playerName, currentTriggerContext);
        } catch (e) {
            console.error("[Modal] Error executing selection callback:", e);
        }
    } else {
        console.warn("[Modal] selectExistingPlayer: No callback function was registered."); // DEBUG LOG
    }
    closeModal(); // Fermer la modale après la sélection
}

// Gère le clic sur le bouton "Create New"
function handleCreatePlayer() {
    if (!filterInput) return;
    const newName = filterInput.value.trim();
    if (!newName) {
        alert("Please type a name before creating a new player.");
        return;
    }
    // Vérifier si le nom existe déjà (insensible à la casse)
    const exists = allPlayers.some(p => p.name.toLowerCase() === newName.toLowerCase());
    if (exists) {
        alert(`Player "${newName}" already exists. Please select them from the list or choose a different name.`);
        filterInput.focus(); // Remettre le focus sur le filtre
        return;
    }

    // Vérifier si le contexte actuel autorise la création
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
// triggerContext: { type: string, index?: number, allowCreation?: boolean, allSelectedIds?: array }
// selectCallback: function(playerId, playerName, triggerContext)
export function openModal(triggerContext, selectCallback) {
    if (!modal || !backdrop || !filterInput) {
        console.error("[Modal] Cannot open player select modal, essential elements not initialized.");
        return;
    }
    // Enregistrer le contexte et la fonction de retour
    currentTriggerContext = triggerContext;
    currentSelectCallback = selectCallback;
    console.log("[Modal] Opening modal with context:", triggerContext); // DEBUG LOG

    // Activer/désactiver le bouton "Create New" selon le contexte
    if (createPlayerBtn) {
        createPlayerBtn.style.display = triggerContext.allowCreation ? '' : 'none';
    }

    // Préparer et afficher la modale
    filterInput.value = ''; // Vider le filtre
    populatePlayerList();   // Remplir la liste (peut utiliser le contexte pour exclure)
    modal.style.display = 'flex';
    backdrop.style.display = 'block';
    filterInput.focus();    // Mettre le focus sur le champ de filtre
    activeSuggestionIndex = -1; // Réinitialiser la sélection clavier
}

// Fonction d'initialisation appelée une fois depuis main.js
export function initPlayerSelectModal(playersData) {
    // Sélection des éléments du DOM pour la modale
    modal = document.getElementById('player-select-modal');
    backdrop = document.getElementById('player-select-modal-backdrop');
    filterInput = document.getElementById('player-filter-input');
    playerListContainer = document.getElementById('player-select-list');
    closeModalBtn = modal?.querySelector('.player-select-close-btn');
    createPlayerBtn = document.getElementById('create-new-player-btn');

    // Vérifier que tous les éléments essentiels sont présents
    if (!modal || !backdrop || !filterInput || !playerListContainer || !closeModalBtn || !createPlayerBtn) {
        console.error("[Modal Init] One or more player select modal elements are missing! Modal functionality will be limited.");
        return; // Ne pas continuer si des éléments manquent
    }

    allPlayers = playersData || []; // Stocker les données des joueurs fournies

    // --- Attacher les listeners internes à la modale ---

    // Bouton de fermeture et fond
    closeModalBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    // Champ de filtre (mise à jour de la liste en temps réel)
    filterInput.addEventListener('input', () => {
        populatePlayerList(filterInput.value);
    });

    // Gestion de la navigation clavier (Flèches et Entrée) dans le filtre
    filterInput.addEventListener('keydown', (e) => {
        // Ignorer si la liste est vide (sauf pour Entrée si création possible)
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
                e.preventDefault(); // Empêcher la soumission de formulaire si la modale est dans un <form>
                console.log("[Modal] Enter key pressed in filter."); // DEBUG LOG
                const activeItem = playerListContainer.querySelector('.suggestion-item.active');

                if (activeItem) {
                    // Sélection via Entrée sur un item en surbrillance
                    console.log("[Modal] Active item found via Enter:", activeItem.dataset); // DEBUG LOG
                    if (activeItem.dataset.playerId && activeItem.dataset.playerName) {
                        selectExistingPlayer(activeItem.dataset.playerId, activeItem.dataset.playerName);
                    } else {
                        console.error("[Modal] Active item selected via Enter is missing dataset!", activeItem);
                    }
                } else if (items.length > 0 && activeSuggestionIndex === -1) {
                    // Sélection via Entrée sans surbrillance (prend le premier item)
                    console.log("[Modal] No active item, selecting first item via Enter:", items[0].dataset); // DEBUG LOG
                    if (items[0].dataset.playerId && items[0].dataset.playerName) {
                        selectExistingPlayer(items[0].dataset.playerId, items[0].dataset.playerName);
                    } else {
                        console.error("[Modal] First item selected via Enter is missing dataset!", items[0]);
                    }
                } else if (filterInput.value.trim() !== '' && currentTriggerContext && currentTriggerContext.allowCreation) {
                    // Création via Entrée si autorisé et du texte est saisi
                    console.log("[Modal] No items match/selected, attempting to create new player via Enter."); // DEBUG LOG
                    handleCreatePlayer();
                } else {
                    console.log("[Modal] Enter pressed, but no item to select or create."); // DEBUG LOG
                }
                break;
            // Ne pas gérer d'autres touches ici pour l'instant
        }
    });

    // Gestion du clic sur un élément de la liste
    playerListContainer.addEventListener('click', (e) => {
        // Utiliser closest pour trouver l'élément .suggestion-item cliqué, même si on clique sur le span ou tag dedans
        const selectedItem = e.target.closest('.suggestion-item');
        console.log("[Modal] Click detected in list container. Target:", e.target, "Closest item:", selectedItem); // DEBUG LOG
        if (selectedItem) {
            console.log("[Modal] Clicked item dataset:", selectedItem.dataset); // DEBUG LOG
            // Vérifier que les données nécessaires sont présentes avant de sélectionner
            if (selectedItem.dataset.playerId && selectedItem.dataset.playerName) {
                selectExistingPlayer(selectedItem.dataset.playerId, selectedItem.dataset.playerName);
            } else {
                console.error("[Modal] Clicked item is missing player data!", selectedItem); // Log d'erreur si données manquantes
            }
        }
    });

    // Bouton de création
    createPlayerBtn.addEventListener('click', handleCreatePlayer);

    console.log("[Modal Init] Player select modal initialized successfully."); // Log de succès
}