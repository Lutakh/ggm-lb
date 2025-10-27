// public/js/modules/dailyQuests.js

const STAMINA_REGEN_RATE_MINUTES = 24;
const MAX_STAMINA = 99;
const LOCAL_STORAGE_KEY = 'dailyQuestSelectedPlayers'; // Clé pour localStorage

let questListDefinition = []; // Sera rempli par l'appel API
let selectedPlayerIds = [null, null, null]; // Contient les IDs
let selectedPlayerNames = [null, null, null]; // Contient les Noms pour l'affichage
let playerQuestData = [null, null, null]; // Pour stocker les données récupérées { playerId, name, stamina, completedQuests, staminaLastUpdated }
let staminaIntervals = [null, null, null]; // Pour gérer les timers d'incrémentation

const container = document.getElementById('daily-quests-container');
const playerSelectorUIs = document.querySelectorAll('.dq-player-selection-ui'); // Nouveau sélecteur

// --- Récupérer les éléments de la modale partagée ---
const playerSelectModal = document.getElementById('player-select-modal');
const playerSelectBackdrop = document.getElementById('player-select-modal-backdrop');
const playerSelectFilterInput = document.getElementById('player-filter-input');
const playerSelectListContainer = document.getElementById('player-select-list');
const playerSelectCloseModalBtn = playerSelectModal?.querySelector('.player-select-close-btn');
const playerSelectCreatePlayerBtn = document.getElementById('create-new-player-btn');

let activePlayerSelectorIndex = null; // Pour savoir quel slot (0, 1, 2) on modifie via la modale
let activeModalSuggestionIndex = -1; // Pour la navigation clavier dans la modale

// --- Données joueurs pour la modale (récupérées depuis le script JSON) ---
let allPlayersForModal = [];
const playersSelectorDataElement = document.getElementById('player-selector-data');
if (playersSelectorDataElement) {
    try {
        allPlayersForModal = JSON.parse(playersSelectorDataElement.textContent || '[]');
        // console.log(`Loaded ${allPlayersForModal.length} players for modal selector.`); // Debug Log
    } catch(e) {
        console.error("Error parsing player-selector-data JSON:", e);
    }
} else {
    console.error("Element #player-selector-data not found!");
}

// --- NOUVELLES FONCTIONS localStorage ---
function saveSelectedPlayersToLocalStorage() {
    try {
        // Sauvegarde un tableau d'IDs (ou null)
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(selectedPlayerIds));
        // console.log("Saved player IDs to localStorage:", selectedPlayerIds); // Debug Log
    } catch (e) {
        console.error("Error saving selected players to localStorage:", e);
    }
}

function loadSelectedPlayersFromLocalStorage() {
    try {
        const storedValue = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedValue) {
            const parsedIds = JSON.parse(storedValue);
            // Vérifier que c'est un tableau de la bonne taille avec des nombres ou null
            if (Array.isArray(parsedIds) && parsedIds.length === 3 && parsedIds.every(id => typeof id === 'number' || id === null)) {
                selectedPlayerIds = parsedIds;
                // console.log("Loaded player IDs from localStorage:", selectedPlayerIds); // Debug Log

                // --- NOUVEAU: Mettre à jour l'affichage initial des sélecteurs ---
                selectedPlayerIds.forEach((playerId, index) => {
                    if (playerId !== null) {
                        const player = allPlayersForModal.find(p => p.id === playerId);
                        if (player) {
                            selectedPlayerNames[index] = player.name; // Mettre à jour le nom aussi
                            const displayDiv = document.getElementById(`dq-player-display-${index}`);
                            const idInput = document.getElementById(`dq-player-id-hidden-${index}`);
                            const nameInput = document.getElementById(`dq-player-name-hidden-${index}`);
                            if (displayDiv && idInput && nameInput) {
                                displayDiv.textContent = player.name;
                                displayDiv.classList.add('player-selected');
                                idInput.value = playerId;
                                nameInput.value = player.name;
                            }
                        } else {
                            // Si le joueur stocké n'existe plus, réinitialiser
                            console.warn(`Player ID ${playerId} from localStorage not found in current player list.`);
                            selectedPlayerIds[index] = null;
                            selectedPlayerNames[index] = null;
                        }
                    } else {
                        // Assurer la réinitialisation si l'ID stocké est null
                        selectedPlayerNames[index] = null;
                        const displayDiv = document.getElementById(`dq-player-display-${index}`);
                        const idInput = document.getElementById(`dq-player-id-hidden-${index}`);
                        const nameInput = document.getElementById(`dq-player-name-hidden-${index}`);
                        if (displayDiv && idInput && nameInput) {
                            displayDiv.textContent = '-- Select Player --';
                            displayDiv.classList.remove('player-selected');
                            idInput.value = '';
                            nameInput.value = '';
                        }
                    }
                });

            } else {
                console.warn("Invalid data found in localStorage for daily quests players.");
                localStorage.removeItem(LOCAL_STORAGE_KEY); // Nettoyer les données invalides
            }
        } else {
            // console.log("No player IDs found in localStorage."); // Debug Log
        }
    } catch (e) {
        console.error("Error loading selected players from localStorage:", e);
        localStorage.removeItem(LOCAL_STORAGE_KEY); // Nettoyer en cas d'erreur de parsing
    }
}

// --- Fonctions Utilitaires : calculateCurrentStamina, stopStaminaTimer, startStaminaTimer ---
function calculateCurrentStamina(playerData) {
    // console.log("Calculating stamina for:", playerData); // Debug Log
    if (!playerData || !playerData.staminaLastUpdated) {
        // console.log("No player data or last updated timestamp."); // Debug Log
        return playerData ? (playerData.stamina || 0) : 0;
    }
    const lastUpdated = new Date(playerData.staminaLastUpdated);
    const now = new Date();
    // Vérifier si lastUpdated est une date valide
    if (isNaN(lastUpdated.getTime())) {
        console.error("Invalid staminaLastUpdated date:", playerData.staminaLastUpdated);
        return playerData.stamina || 0;
    }
    const minutesPassed = Math.floor((now - lastUpdated) / (1000 * 60));
    // console.log("Minutes passed since last update:", minutesPassed); // Debug Log
    if (minutesPassed < 0) { // Should not happen, but safety check
        console.warn("Negative minutes passed, possible clock issue?");
        return playerData.stamina || 0;
    }
    const regeneratedStamina = Math.floor(minutesPassed / STAMINA_REGEN_RATE_MINUTES);
    // console.log("Regenerated stamina:", regeneratedStamina); // Debug Log
    const calculatedStamina = (playerData.stamina || 0) + regeneratedStamina;
    // console.log("Calculated stamina before max:", calculatedStamina); // Debug Log
    return Math.min(MAX_STAMINA, calculatedStamina);
}

function stopStaminaTimer(index) {
    if (staminaIntervals[index]) {
        // console.log(`Stopping stamina timer for index ${index}`); // Debug Log
        clearInterval(staminaIntervals[index]);
        staminaIntervals[index] = null;
    }
}

function startStaminaTimer(index) {
    stopStaminaTimer(index); // Arrêter l'ancien timer s'il existe

    const playerData = playerQuestData[index];
    // Don't start if no data, no timestamp, or already maxed out
    if (!playerData || !playerData.staminaLastUpdated || calculateCurrentStamina(playerData) >= MAX_STAMINA) {
        // console.log(`Not starting timer for index ${index}. Reason: No data, no timestamp, or already at max stamina.`); // Debug Log
        // Ensure display is correct even if timer doesn't start
        const currentStaminaDisplay = document.getElementById(`dq-stamina-current-${index}`);
        if (currentStaminaDisplay && playerData) {
            currentStaminaDisplay.textContent = calculateCurrentStamina(playerData);
        }
        const currentStaminaInput = document.getElementById(`dq-stamina-input-${index}`);
        if (currentStaminaInput && playerData && document.activeElement !== currentStaminaInput) {
            currentStaminaInput.value = calculateCurrentStamina(playerData);
        }
        // Also update the timer input initially
        const minutesInputElement = document.getElementById(`dq-stamina-next-input-${index}`);
        updateMinutesRemainingInput(index, minutesInputElement);
        return;
    }
    // console.log(`Attempting to start stamina timer for index ${index}`); // Debug Log

    const lastUpdated = new Date(playerData.staminaLastUpdated);
    // Vérifier si lastUpdated est une date valide before proceeding
    if (isNaN(lastUpdated.getTime())) {
        console.error("Invalid staminaLastUpdated date, cannot start timer:", playerData.staminaLastUpdated);
        return;
    }

    const minutesSinceLastRegen = Math.floor((new Date() - lastUpdated) / (1000 * 60)) % STAMINA_REGEN_RATE_MINUTES;
    const msUntilNextRegen = Math.max(1000, (STAMINA_REGEN_RATE_MINUTES - minutesSinceLastRegen) * 60 * 1000); // Ensure minimum 1 sec delay prevents rapid loops if calculation is slightly off
    // console.log(`Timer for index ${index}: msUntilNextRegen = ${msUntilNextRegen}`); // Debug Log


    const updateDisplay = (isInitialCall = false) => {
        // console.log(`Updating stamina display for index ${index}`); // Debug Log
        const currentStaminaDisplay = document.getElementById(`dq-stamina-current-${index}`);
        const currentStaminaInput = document.getElementById(`dq-stamina-input-${index}`);
        const minutesInputElement = document.getElementById(`dq-stamina-next-input-${index}`);
        const currentStamina = calculateCurrentStamina(playerData); // Recalculate each time
        // console.log(`Index ${index} - Current Calculated Stamina: ${currentStamina}`); // Debug Log

        if (currentStaminaDisplay) {
            currentStaminaDisplay.textContent = currentStamina;
        }
        // Update input value only on initial call or if it wasn't manually focused/being edited
        if (currentStaminaInput && (isInitialCall || document.activeElement !== currentStaminaInput)) {
            currentStaminaInput.value = currentStamina;
        }
        // Update minutes remaining input
        updateMinutesRemainingInput(index, minutesInputElement);


        // Check if max stamina reached AFTER update
        if (currentStamina >= MAX_STAMINA) {
            // console.log(`Max stamina reached for index ${index}. Stopping timer.`); // Debug Log
            stopStaminaTimer(index);
            // Clear minutes input when max is reached
            if (minutesInputElement) minutesInputElement.value = '';
        }
    };

    // Use a variable to hold the timeout ID so we can potentially clear it if needed
    let initialTimeoutId = setTimeout(() => {
        initialTimeoutId = null; // Clear the ID once the timeout fires
        // console.log(`First timer tick for index ${index} after ${msUntilNextRegen}ms`); // Debug Log
        updateDisplay(); // Update display on the first tick

        if (calculateCurrentStamina(playerData) < MAX_STAMINA) { // Only set interval if not maxed out *after* the first tick
            // console.log(`Setting regular interval timer for index ${index}`); // Debug Log
            staminaIntervals[index] = setInterval(() => {
                // console.log(`Regular timer tick for index ${index}`); // Debug Log
                updateDisplay();
            }, STAMINA_REGEN_RATE_MINUTES * 60 * 1000);
        } else {
            // console.log(`Max stamina reached on first tick for index ${index}. Not setting interval.`); // Debug Log
        }
    }, msUntilNextRegen);

    // Initial immediate display update when timer starts
    // console.log(`Initial display update for index ${index} when timer starts`); // Debug Log
    updateDisplay(true); // Indicate it's the initial call to potentially update input
}

// Helper to update the minutes remaining input field
function updateMinutesRemainingInput(index, minutesInputElement) {
    if (!minutesInputElement) return;
    const playerData = playerQuestData[index];
    const currentStamina = calculateCurrentStamina(playerData);
    let minutesRemainingValue = '';
    if (playerData && playerData.staminaLastUpdated && currentStamina < MAX_STAMINA) {
        const lastUpdated = new Date(playerData.staminaLastUpdated);
        if (!isNaN(lastUpdated.getTime())) {
            const now = new Date();
            const minutesPassed = Math.floor((now - lastUpdated) / (1000 * 60));
            const minutesIntoCycle = minutesPassed % STAMINA_REGEN_RATE_MINUTES;
            // Calculate remaining minutes IN THE CURRENT cycle
            const remaining = STAMINA_REGEN_RATE_MINUTES - 1 - minutesIntoCycle;
            minutesRemainingValue = Math.max(0, remaining); // Ensure non-negative
        }
    }
    // Only update if not focused
    if (document.activeElement !== minutesInputElement) {
        minutesInputElement.value = minutesRemainingValue;
    }
}


// --- MODAL LOGIC ---

// Met à jour la surbrillance dans la liste de la modale
function updateActiveModalSuggestion(items) {
    items.forEach((item, index) => {
        item.classList.toggle('active', index === activeModalSuggestionIndex);
        if (index === activeModalSuggestionIndex) {
            item.scrollIntoView({ block: 'nearest' });
        }
    });
}

// Peuple la liste de la modale en filtrant les joueurs déjà sélectionnés ailleurs
function populatePlayerModalList(filter = '') {
    if (!playerSelectListContainer) return;
    playerSelectListContainer.innerHTML = '';
    const query = filter.toLowerCase();
    // Get IDs selected in slots OTHER than the one currently being edited
    const currentlySelectedIdsInOtherSlots = selectedPlayerIds.filter((id, i) => id !== null && i !== activePlayerSelectorIndex);

    allPlayersForModal
        .filter(p =>
            // Filter by name AND exclude those already selected in *other* slots
            p.name.toLowerCase().includes(query) &&
            !currentlySelectedIdsInOtherSlots.includes(p.id)
        )
        .sort((a, b) => a.name.localeCompare(b.name)) // Sort alphabetically
        .forEach(player => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.dataset.playerId = player.id; // Store ID
            item.dataset.playerName = player.name; // Store name
            item.innerHTML = `<span>${player.name}</span>`; // Display just the name
            playerSelectListContainer.appendChild(item);
        });
    activeModalSuggestionIndex = -1; // Reset keyboard selection
}

function openPlayerSelectModal(index) {
    if (!playerSelectModal || !playerSelectBackdrop || !playerSelectFilterInput) {
        console.error("Player selection modal elements not found!");
        return;
    }
    activePlayerSelectorIndex = index; // Remember which slot (0, 1, 2) we are editing
    playerSelectFilterInput.value = ''; // Clear filter input
    populatePlayerModalList(); // Populate the list (filtered)
    playerSelectModal.style.display = 'flex';
    playerSelectBackdrop.style.display = 'block';
    playerSelectFilterInput.focus(); // Focus the input
    activeModalSuggestionIndex = -1;
    // Add a class to body maybe, to hide the "Create New" button via CSS if desired
    // document.body.classList.add('daily-quest-modal-open');
}

function closePlayerSelectModal() {
    if (playerSelectModal) playerSelectModal.style.display = 'none';
    if (playerSelectBackdrop) playerSelectBackdrop.style.display = 'none';
    // document.body.classList.remove('daily-quest-modal-open'); // Clean up class
    // Don't reset activePlayerSelectorIndex here, needed in setSelectedPlayer
}

// Function called when a player is chosen from the modal
function setSelectedPlayer(index, playerId, playerName) {
    if (index === null || index < 0 || index > 2) {
        console.error("Invalid index provided to setSelectedPlayer:", index);
        closePlayerSelectModal(); // Close modal to prevent being stuck
        return;
    }

    // Check if the player is already selected IN ANOTHER SLOT
    const alreadySelectedElsewhere = selectedPlayerIds.some((id, i) => id !== null && id === playerId && i !== index);
    if (alreadySelectedElsewhere) {
        alert(`${playerName} is already selected in another slot.`);
        // Don't close the modal, let the user choose someone else
        playerSelectFilterInput?.focus(); // Refocus input
        return;
    }

    // console.log(`Setting player for index ${index}: ID ${playerId}, Name ${playerName}`);

    // Stop the timer for the player previously in this slot *if* the player actually changed
    if (selectedPlayerIds[index] !== playerId) {
        stopStaminaTimer(index);
    }

    // Update the global arrays tracking selections
    selectedPlayerIds[index] = playerId;
    selectedPlayerNames[index] = playerName; // Also store the name

    // --- SAUVEGARDE localStorage ---
    saveSelectedPlayersToLocalStorage();
    // ----------------------------

    // Update the UI elements for the specific slot
    const displayDiv = document.getElementById(`dq-player-display-${index}`);
    const idInput = document.getElementById(`dq-player-id-hidden-${index}`);
    const nameInput = document.getElementById(`dq-player-name-hidden-${index}`); // Hidden input for name

    if (displayDiv && idInput && nameInput) {
        if (playerId !== null && playerName !== null) {
            // Update display for selected player
            displayDiv.textContent = playerName;
            displayDiv.classList.add('player-selected');
            idInput.value = playerId;
            nameInput.value = playerName; // Update hidden name input
        } else {
            // Update display for deselected player (e.g., if we add a "Clear" option later)
            displayDiv.textContent = '-- Select Player --';
            displayDiv.classList.remove('player-selected');
            idInput.value = '';
            nameInput.value = '';
        }
    } else {
        console.error(`Could not find display/input elements for index ${index}`);
    }

    closePlayerSelectModal(); // Close the modal after selection
    fetchAndUpdatePlayerData(); // Fetch data for the newly selected set of players
    activePlayerSelectorIndex = null; // Reset the active index now that selection is done
}


// --- Fonctions d'Affichage ---
function renderQuestColumns() {
    // console.log("renderQuestColumns called. Selected IDs:", selectedPlayerIds); // Debug Log
    if (!container) {
        console.error("Daily quests container not found!");
        return;
    }

    // Determine active players based on current state
    const activePlayersIndices = selectedPlayerIds.map((id, index) => id ? index : -1).filter(index => index !== -1);
    const isMobile = window.innerWidth <= 768;
    // On mobile, only consider the first selected player (if any)
    const indicesToRender = isMobile ? activePlayersIndices.slice(0, 1) : activePlayersIndices;
    const columnsToShow = indicesToRender.length;

    // console.log("Indices to render:", indicesToRender, "Is Mobile:", isMobile); // Debug Log


    if (columnsToShow === 0) {
        container.innerHTML = '<div class="dq-placeholder">Select up to 3 players (1 on mobile) to track their daily quests.</div>';
        container.className = 'daily-quests-container'; // Reset class
        return;
    }

    container.innerHTML = ''; // Clear container before rendering
    container.className = `daily-quests-container columns-${columnsToShow}`; // Adjust column layout class

    indicesToRender.forEach(index => { // Use the filtered indices
        const playerId = selectedPlayerIds[index];
        const data = playerQuestData[index];
        // console.log(`Rendering column for index ${index}, playerId ${playerId}, data:`, data); // Debug Log

        const playerColumn = document.createElement('div');
        playerColumn.className = 'dq-player-column';
        playerColumn.dataset.playerId = playerId;
        playerColumn.dataset.index = index; // Store original index (0, 1, or 2)

        if (!playerId || !data) {
            console.warn(`Skipping render for index ${index} due to missing data.`);
            // Render an error column or placeholder for this slot
            playerColumn.classList.add('dq-error-column');
            playerColumn.innerHTML = `<h3>Error</h3><p>Could not load data for player in slot ${index + 1}.</p>`;
            container.appendChild(playerColumn);
            return; // Skip the rest for this column
        };

        // If data is present, proceed with normal rendering
        const currentStamina = calculateCurrentStamina(data); // Calculate for initial display
        // console.log(`Initial stamina calculated for ${data.name}: ${currentStamina}`); // Debug Log

        // --- Calculate minutes remaining for initial display ---
        let minutesRemainingValue = '';
        if (data && data.staminaLastUpdated && currentStamina < MAX_STAMINA) {
            const lastUpdated = new Date(data.staminaLastUpdated);
            if (!isNaN(lastUpdated.getTime())) {
                const now = new Date();
                const minutesPassed = Math.floor((now - lastUpdated) / (1000 * 60));
                const minutesIntoCycle = minutesPassed % STAMINA_REGEN_RATE_MINUTES;
                const remaining = STAMINA_REGEN_RATE_MINUTES - 1 - minutesIntoCycle;
                minutesRemainingValue = Math.max(0, remaining);
            }
        }
        // --- End Calculate ---

        // Build quest list HTML
        let questsHtml = '';
        if (questListDefinition && questListDefinition.length > 0) {
            questsHtml = questListDefinition.map(quest => {
                // Ensure completedQuests is an array before checking includes
                const isCompleted = Array.isArray(data.completedQuests) && data.completedQuests.includes(quest.key);
                return `
                    <li>
                        <input type="checkbox" id="quest-${playerId}-${quest.key}"
                               class="dq-quest-checkbox"
                               data-player-id="${playerId}" data-quest-key="${quest.key}"
                               ${isCompleted ? 'checked' : ''}>
                        <label for="quest-${playerId}-${quest.key}">${quest.label}</label>
                    </li>
                `;
            }).join('');
        } else {
            questsHtml = '<li>Quest list not available.</li>';
            console.warn("questListDefinition is empty or undefined during render.");
        }

        // --- CORRECTED HTML STRING (Removed EJS comments) ---
        playerColumn.innerHTML = `
            <h3>${data.name}</h3>
            <div class="dq-stamina-section">
                <label for="dq-stamina-input-${index}">Stamina:</label>
                <input type="number" id="dq-stamina-input-${index}" class="dq-stamina-input"
                       min="0" max="${MAX_STAMINA}" value="${currentStamina}" data-index="${index}" autocomplete="off">
                <div class="dq-stamina-display-group">
                     <span class="dq-stamina-current" id="dq-stamina-current-${index}">${currentStamina}</span>
                     <span class="dq-stamina-separator">/</span>
                     <span class="dq-stamina-max">${MAX_STAMINA}</span>
                </div>
                <div class="dq-stamina-timer-group">
                     <label for="dq-stamina-next-input-${index}">Next in:</label>
                     <input type="number" id="dq-stamina-next-input-${index}" class="dq-stamina-next-input"
                            min="0" max="${STAMINA_REGEN_RATE_MINUTES - 1}" placeholder="min" data-index="${index}"
                            value="${minutesRemainingValue}" autocomplete="off">
                     <span>min</span> </div>
                 </div>
            <ul class="dq-quest-list">
                ${questsHtml}
            </ul>
        `;
        // --- END CORRECTION ---

        container.appendChild(playerColumn);
        // console.log(`Starting stamina timer for index ${index} after rendering column.`); // Debug Log
        startStaminaTimer(index); // Start timer after element is in DOM, using original index
    });

    attachEventListeners(); // Attach listeners after all columns are rendered
}

// --- Logique de Récupération et Mise à jour ---
async function fetchAndUpdatePlayerData() {
    const idsToFetch = selectedPlayerIds.filter(id => id !== null);
    // console.log("fetchAndUpdatePlayerData called. IDs to fetch:", idsToFetch); // Debug Log

    // Stop all timers before fetching new data
    staminaIntervals.forEach((_, index) => stopStaminaTimer(index));

    if (idsToFetch.length === 0) {
        // console.log("No players selected, rendering placeholder."); // Debug Log
        playerQuestData = [null, null, null]; // Reset local data
        renderQuestColumns(); // Render the placeholder message
        return; // Exit if no players are selected
    }

    try {
        const apiUrl = `/daily-quests/status?playerIds=${idsToFetch.join(',')}`;
        // console.log("Attempting to fetch data from:", apiUrl); // Log before fetch
        const response = await fetch(apiUrl);

        if (!response.ok) {
            let errorBody = 'Could not read error response body.';
            try { errorBody = await response.text(); } catch (e) { /* ignore */ }
            console.error(`API Error Response: ${response.status} ${response.statusText}`, errorBody);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        // console.log("Data received from API:", data); // Log received data

        // Update quest list definition
        if(data.questsList && Array.isArray(data.questsList) && data.questsList.length > 0) {
            questListDefinition = data.questsList;
        } else {
            console.warn("Received empty or invalid questsList from API. Using previous definition if available.");
            questListDefinition = questListDefinition || [];
        }

        // Update playerQuestData based on the response, maintaining the order of selectedPlayerIds
        playerQuestData = selectedPlayerIds.map(selectedId => {
            if (!selectedId) return null;
            const foundPlayerData = data.players?.find(p => p.playerId === selectedId);
            if (!foundPlayerData) {
                console.warn(`Data for selected player ID ${selectedId} not found in API response.`);
                return null;
            }
            foundPlayerData.completedQuests = Array.isArray(foundPlayerData.completedQuests) ? foundPlayerData.completedQuests : [];
            return foundPlayerData;
        });
        // console.log("Updated playerQuestData:", playerQuestData); // Debug Log

        renderQuestColumns(); // Re-render the UI with the fetched data

    } catch (error) {
        console.error("Failed to fetch daily quest status:", error);
        container.innerHTML = '<div class="dq-error">Could not load quest data. Please check the console and try again later.</div>';
    }
}


async function updateQuestStatus(playerId, questKey, completed) {
    // console.log(`Updating quest status: Player ${playerId}, Quest ${questKey}, Completed: ${completed}`); // Debug Log
    // Optimistic UI update
    const playerIndex = selectedPlayerIds.findIndex(id => id === playerId);
    if (playerIndex !== -1 && playerQuestData[playerIndex]) {
        const currentQuests = playerQuestData[playerIndex].completedQuests; // Should be an array
        if (completed) {
            if (!currentQuests.includes(questKey)) {
                currentQuests.push(questKey);
            }
        } else {
            playerQuestData[playerIndex].completedQuests = currentQuests.filter(key => key !== questKey);
        }
    } else {
        console.warn(`Could not find local data for player ${playerId} during optimistic update.`);
    }

    try {
        const response = await fetch('/daily-quests/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, questKey, completed })
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        if (!result.success) {
            console.error('Failed to update quest status on server');
            // Revert optimistic update
            if (playerIndex !== -1 && playerQuestData[playerIndex]) {
                const currentQuests = playerQuestData[playerIndex].completedQuests;
                if (completed) { // If it failed while trying to complete
                    playerQuestData[playerIndex].completedQuests = currentQuests.filter(key => key !== questKey);
                } else { // If it failed while trying to un-complete
                    if (!currentQuests.includes(questKey)) { // Add it back only if it's not there
                        currentQuests.push(questKey);
                    }
                }
            }
            // Revert the checkbox state
            const checkbox = document.getElementById(`quest-${playerId}-${questKey}`);
            if (checkbox) checkbox.checked = !completed;
            alert("Failed to save quest status. Please try again.");
        }
        // On success, the optimistic update is now confirmed by the server. No action needed.
    } catch (error) {
        console.error("Error updating quest status:", error);
        // Revert optimistic update on network/fetch error
        if (playerIndex !== -1 && playerQuestData[playerIndex]) {
            const currentQuests = playerQuestData[playerIndex].completedQuests;
            if (completed) {
                playerQuestData[playerIndex].completedQuests = currentQuests.filter(key => key !== questKey);
            } else {
                if (!currentQuests.includes(questKey)) {
                    currentQuests.push(questKey);
                }
            }
        }
        // Revert checkbox state
        const checkbox = document.getElementById(`quest-${playerId}-${questKey}`);
        if (checkbox) checkbox.checked = !completed;
        alert("An error occurred while saving quest status.");
    }
}

async function updateStaminaValue(index, inputElement, minutesInputElement = null) {
    const playerId = selectedPlayerIds[index];
    if (!playerId || !inputElement) return; // Basic guard

    let staminaValue = parseInt(inputElement.value, 10);
    let minutesValue = minutesInputElement ? parseInt(minutesInputElement.value, 10) : null; // Lire la valeur du nouvel input
    // console.log(`updateStaminaValue called for index ${index}, playerId ${playerId}, stamina: ${staminaValue}, minutes: ${minutesValue}`); // Debug

    // --- Validation Stamina ---
    let needsStaminaCorrection = false;
    if (isNaN(staminaValue) || staminaValue < 0) { staminaValue = 0; needsStaminaCorrection = true; }
    if (staminaValue > MAX_STAMINA) { staminaValue = MAX_STAMINA; needsStaminaCorrection = true; }
    if (needsStaminaCorrection) inputElement.value = staminaValue;

    // --- Validation Minutes ---
    let needsMinutesCorrection = false;
    const maxMinutes = STAMINA_REGEN_RATE_MINUTES - 1;
    if (minutesValue !== null) { // Seulement si une valeur a été entrée ou existe
        if (isNaN(minutesValue) || minutesValue < 0) { minutesValue = 0; needsMinutesCorrection = true; }
        if (minutesValue > maxMinutes) { minutesValue = maxMinutes; needsMinutesCorrection = true; }
        // Si stamina est (ou vient d'être mis à) max, les minutes restantes n'ont pas de sens
        if (staminaValue >= MAX_STAMINA) {
            minutesValue = null; // Ne pas envoyer la valeur
            if (minutesInputElement) minutesInputElement.value = ''; // Vider le champ minutes
        } else if (needsMinutesCorrection && minutesInputElement) {
            minutesInputElement.value = minutesValue; // Corriger l'affichage
        }
    }


    stopStaminaTimer(index); // Arrêter pendant la mise à jour
    // console.log(`Timer stopped for index ${index} during manual update.`); // Debug Log

    // Comparer SEULEMENT la valeur stamina pour éviter appel inutile si juste le timer change? Non, envoyer quand même si timer change.
    const currentCalculatedStamina = playerQuestData[index] ? calculateCurrentStamina(playerQuestData[index]) : staminaValue; // Fallback needed?


    // --- API Call ---
    try {
        // console.log(`Sending update stamina request: Player ${playerId}, Stamina ${staminaValue}, Minutes ${minutesValue}`); // Debug
        const response = await fetch('/daily-quests/update-stamina', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Envoyer les deux valeurs (minutesValue sera null s'il n'est pas applicable)
            body: JSON.stringify({ playerId, stamina: staminaValue, minutesUntilNext: minutesValue })
        });
        if (!response.ok) {
            let errorBody = await response.text();
            console.error(`Stamina update API Error: ${response.status}`, errorBody);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        // console.log("Stamina update response:", result); // Debug

        if (result.success && playerQuestData[index]) {
            // --- Success: Update local data and restart timer ---
            playerQuestData[index].stamina = result.stamina; // Use value confirmed by server
            playerQuestData[index].staminaLastUpdated = result.staminaLastUpdated;

            // Update display elements immediately
            const currentStaminaDisplay = document.getElementById(`dq-stamina-current-${index}`);
            if (currentStaminaDisplay) currentStaminaDisplay.textContent = result.stamina;
            inputElement.value = result.stamina; // Ensure input matches server response

            // Mettre à jour l'input des minutes aussi, basé sur le nouveau timestamp
            updateMinutesRemainingInput(index, minutesInputElement); // Appeler helper pour recalculer

            // console.log(`Stamina updated successfully for index ${index}. Restarting timer.`); // Debug
            startStaminaTimer(index); // Restart timer with new base value and timestamp
        } else {
            // --- API Failure (but request succeeded) ---
            console.error('Failed to update stamina on server (API reported failure):', result.error || 'Unknown API error');
            throw new Error(result.error || 'API reported failure'); // Treat as error
        }
    } catch (error) {
        // --- Network/Fetch Error or API Failure ---
        console.error("Error updating stamina:", error);
        alert(`Failed to save stamina value: ${error.message || 'Check console for details.'}`);

        // --- Revert UI and Restart Timer ---
        // Recalculate based on *previous* state before the failed attempt
        const lastKnownStamina = playerQuestData[index] ? calculateCurrentStamina(playerQuestData[index]) : 0; // Fallback to 0 if no data
        inputElement.value = lastKnownStamina; // Revert input field
        const currentStaminaDisplay = document.getElementById(`dq-stamina-current-${index}`);
        if (currentStaminaDisplay) currentStaminaDisplay.textContent = lastKnownStamina; // Revert display span
        // Revert minutes input too
        updateMinutesRemainingInput(index, minutesInputElement); // Recalculer basé sur l'ancien état

        startStaminaTimer(index); // Restart timer based on last known *good* state
    }
}


// --- Écouteurs d'Événements ---
function attachEventListeners() {
    // console.log("Attaching event listeners..."); // Debug Log

    // Remove potentially duplicated listeners before attaching new ones by cloning and replacing
    const questCheckboxes = container.querySelectorAll('.dq-quest-checkbox');
    questCheckboxes.forEach(checkbox => {
        const newCheckbox = checkbox.cloneNode(true);
        checkbox.parentNode.replaceChild(newCheckbox, checkbox);
        newCheckbox.addEventListener('change', handleQuestChange);
    });

    const staminaInputs = container.querySelectorAll('.dq-stamina-input');
    staminaInputs.forEach(input => {
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        // Add event listeners to the new input element
        let debounceTimer; // Scope timer to this input's listeners
        newInput.addEventListener('input', (event) => { debounceTimer = handleStaminaInput(event, debounceTimer); }); // Pass timer back
        newInput.addEventListener('change', (event) => { debounceTimer = handleStaminaChange(event, debounceTimer); }); // Pass timer back
        newInput.addEventListener('blur', (event) => { debounceTimer = handleStaminaBlur(event, debounceTimer); }); // Pass timer back
    });

    // --- NOUVEAU: Clone and replace stamina timer inputs ---
    const staminaNextInputs = container.querySelectorAll('.dq-stamina-next-input');
    staminaNextInputs.forEach(input => {
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        let debounceTimer; // Separate timer for this input type
        // Use 'input' for quick feedback, debounce the actual save
        newInput.addEventListener('input', (event) => { debounceTimer = handleStaminaNextInput(event, debounceTimer); });
        // Use 'change' and 'blur' to ensure the final value is saved
        newInput.addEventListener('change', (event) => { debounceTimer = handleStaminaNextChangeOrBlur(event, debounceTimer); });
        newInput.addEventListener('blur', (event) => { debounceTimer = handleStaminaNextChangeOrBlur(event, debounceTimer); });
    });


    // console.log("Event listeners attached."); // Debug Log
}

// --- Event Handler Functions ---
function handleQuestChange(event) {
    const playerId = parseInt(event.target.dataset.playerId, 10);
    const questKey = event.target.dataset.questKey;
    const completed = event.target.checked;
    updateQuestStatus(playerId, questKey, completed);
}

// Handler pour l'input de la valeur stamina
function handleStaminaInput(event, debounceTimer) {
    const target = event.target;
    const index = parseInt(target.dataset.index, 10);
    const value = target.value;
    // Basic visual validation during typing
    if (value !== "" && (!/^\d+$/.test(value) || parseInt(value, 10) < 0 || parseInt(value, 10) > MAX_STAMINA)) {
        target.style.borderColor = 'red';
    } else {
        target.style.borderColor = ''; // Reset border
    }

    clearTimeout(debounceTimer); // Clear previous timer on new input
    const newTimer = setTimeout(() => {
        const minutesInput = document.getElementById(`dq-stamina-next-input-${index}`); // Get the corresponding minutes input
        updateStaminaValue(index, target, minutesInput); // Pass both input elements
    }, 1200); // Debounce API call
    return newTimer; // Return the new timer ID
}

// Handler pour change/blur de la valeur stamina
function handleStaminaChange(event, debounceTimer) {
    clearTimeout(debounceTimer); // Clear pending debounce timer
    const index = parseInt(event.target.dataset.index, 10);
    const minutesInput = document.getElementById(`dq-stamina-next-input-${index}`);
    updateStaminaValue(index, event.target, minutesInput); // Force update/validation
    return null; // No new timer needed
}

function handleStaminaBlur(event, debounceTimer) {
    clearTimeout(debounceTimer); // Clear pending debounce timer
    const index = parseInt(event.target.dataset.index, 10);
    const minutesInput = document.getElementById(`dq-stamina-next-input-${index}`);
    updateStaminaValue(index, event.target, minutesInput); // Force update/validation
    return null; // No new timer needed
}

// --- NOUVEAU: Handlers pour l'input des minutes restantes ---
function handleStaminaNextInput(event, debounceTimer) {
    const target = event.target;
    const index = parseInt(target.dataset.index, 10);
    const value = target.value;
    const maxMinutes = STAMINA_REGEN_RATE_MINUTES - 1;

    // Validation visuelle
    if (value !== "" && (!/^\d+$/.test(value) || parseInt(value, 10) < 0 || parseInt(value, 10) > maxMinutes)) {
        target.style.borderColor = 'red';
    } else {
        target.style.borderColor = '';
    }

    clearTimeout(debounceTimer);
    const newTimer = setTimeout(() => {
        const staminaInput = document.getElementById(`dq-stamina-input-${index}`); // Get the corresponding stamina input
        if (staminaInput) {
            updateStaminaValue(index, staminaInput, target); // Pass both input elements
        } else {
            console.error(`Stamina input not found for index ${index} when updating timer.`);
        }
    }, 1200);
    return newTimer;
}

function handleStaminaNextChangeOrBlur(event, debounceTimer) {
    clearTimeout(debounceTimer);
    const index = parseInt(event.target.dataset.index, 10);
    const staminaInput = document.getElementById(`dq-stamina-input-${index}`);
    if (staminaInput) {
        updateStaminaValue(index, staminaInput, event.target); // Force update/validation
    } else {
        console.error(`Stamina input not found for index ${index} on timer change/blur.`);
    }
    return null;
}


// --- Initialisation ---
export function initDailyQuests() {
    console.log("Initializing Daily Quests module...");
    if (!container) {
        console.error("Daily Quests container (#daily-quests-container) not found on init!");
        return;
    }
    if (!playerSelectorUIs || playerSelectorUIs.length === 0) {
        console.error("Player selector UIs (.dq-player-selection-ui) not found on init!");
        return;
    }
    if (!playerSelectModal) {
        console.error("Player selection modal (#player-select-modal) not found on init! Player selection will not work.");
    }

    // --- CHARGEMENT localStorage ---
    loadSelectedPlayersFromLocalStorage();
    // -----------------------------

    // --- Logique d'affichage mobile/desktop ---
    const handleResizeOrLoad = () => {
        const isMobile = window.innerWidth <= 768;
        // console.log(`handleResizeOrLoad - isMobile: ${isMobile}`);

        playerSelectorUIs.forEach((ui, index) => {
            // Afficher le premier sélecteur toujours, cacher les autres sur mobile
            const group = ui.closest('.player-selector-group');
            if (group) {
                group.style.display = (index > 0 && isMobile) ? 'none' : '';
            }
        });
        // Appeler renderQuestColumns pour redessiner le bon nombre de colonnes
        renderQuestColumns(); // << Appel ICI pour redessiner
    };

    window.addEventListener('resize', handleResizeOrLoad);
    // L'appel initial est fait après le fetch initial

    // --- Écouteurs pour ouvrir la modale ---
    playerSelectorUIs.forEach(ui => {
        const button = ui.querySelector('.dq-open-modal-btn');
        if (button) {
            button.addEventListener('click', (event) => {
                const index = parseInt(event.currentTarget.dataset.index, 10);
                if (!isNaN(index)) {
                    openPlayerSelectModal(index);
                } else {
                    console.error("Invalid or missing data-index on modal button.");
                }
            });
        }
        const display = ui.querySelector('.dq-player-name-display');
        if(display && button) { // Ensure button exists too
            display.style.cursor = 'pointer'; // Indicate clickable
            display.addEventListener('click', () => button.click()); // Simulate button click
        }
    });

    // --- Écouteurs pour la modale partagée (seulement si elle existe) ---
    if(playerSelectModal) {
        if (playerSelectCloseModalBtn) playerSelectCloseModalBtn.addEventListener('click', closePlayerSelectModal);
        if (playerSelectBackdrop) playerSelectBackdrop.addEventListener('click', closePlayerSelectModal);

        if (playerSelectFilterInput) {
            playerSelectFilterInput.addEventListener('input', () => {
                populatePlayerModalList(playerSelectFilterInput.value);
                activeModalSuggestionIndex = -1;
            });

            playerSelectFilterInput.addEventListener('keydown', (e) => {
                const items = playerSelectListContainer?.querySelectorAll('.suggestion-item');
                if (!items || (items.length === 0 && e.key !== 'Enter')) return;

                if (e.key === 'ArrowDown') { /* ... gestion flèches ... */
                    e.preventDefault();
                    activeModalSuggestionIndex = (activeModalSuggestionIndex + 1) % items.length;
                    updateActiveModalSuggestion(items);
                } else if (e.key === 'ArrowUp') { /* ... gestion flèches ... */
                    e.preventDefault();
                    activeModalSuggestionIndex = (activeModalSuggestionIndex - 1 + items.length) % items.length;
                    updateActiveModalSuggestion(items);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const activeItem = playerSelectListContainer.querySelector('.suggestion-item.active');
                    if (activeItem && activePlayerSelectorIndex !== null) {
                        const playerId = parseInt(activeItem.dataset.playerId, 10);
                        const playerName = activeItem.dataset.playerName;
                        setSelectedPlayer(activePlayerSelectorIndex, playerId, playerName);
                    } else if (items.length > 0 && activeModalSuggestionIndex === -1 && activePlayerSelectorIndex !== null) {
                        const firstItem = items[0];
                        const playerId = parseInt(firstItem.dataset.playerId, 10);
                        const playerName = firstItem.dataset.playerName;
                        setSelectedPlayer(activePlayerSelectorIndex, playerId, playerName);
                    } else if (playerSelectFilterInput.value.trim() !== '' && activePlayerSelectorIndex !== null) {
                        // --- MODIFIÉ: Alerte au lieu de simulation clic ---
                        alert("Player creation is not available here. Please use the 'Add / Update' section.");
                    }
                }
            });
        } // end if playerSelectFilterInput

        if (playerSelectListContainer) {
            playerSelectListContainer.addEventListener('click', (e) => {
                const selectedItem = e.target.closest('.suggestion-item');
                if (selectedItem && activePlayerSelectorIndex !== null) {
                    const playerId = parseInt(selectedItem.dataset.playerId, 10);
                    const playerName = selectedItem.dataset.playerName;
                    setSelectedPlayer(activePlayerSelectorIndex, playerId, playerName);
                }
            });
        } // end if playerSelectListContainer

        // --- MODIFIÉ: Gestion clic sur "Create New" ---
        if (playerSelectCreatePlayerBtn) {
            playerSelectCreatePlayerBtn.addEventListener('click', (e) => {
                // Vérifier si la modale a été ouverte depuis Daily Quests
                if (activePlayerSelectorIndex !== null && activePlayerSelectorIndex >= 0 && activePlayerSelectorIndex <= 2) {
                    e.preventDefault();
                    e.stopPropagation();
                    alert("Player creation is not available here. Please use the 'Add / Update' section.");
                    closePlayerSelectModal();
                }
            });
        }
        // ---------------------------------------------

    } // end if playerSelectModal

    // Fetch initial data & apply layout
    console.log("Performing initial data fetch (on init)...");
    fetchAndUpdatePlayerData().then(() => {
        // Appeler handleResizeOrLoad ici pour s'assurer que l'état initial
        // (nombre de colonnes, sélecteurs visibles) est correct après le chargement des données.
        handleResizeOrLoad();
    });
} // Fin initDailyQuests