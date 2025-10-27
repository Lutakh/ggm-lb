// public/js/modules/dailyQuests.js

const STAMINA_REGEN_RATE_MINUTES = 24;
const MAX_STAMINA = 99;
let questListDefinition = []; // Sera rempli par l'appel API
let selectedPlayerIds = [null, null, null];
let playerQuestData = [null, null, null]; // Pour stocker les données récupérées { playerId, name, stamina, completedQuests, staminaLastUpdated }
let staminaIntervals = [null, null, null]; // Pour gérer les timers d'incrémentation

const container = document.getElementById('daily-quests-container');
const playerSelectors = document.querySelectorAll('.dq-player-select');

// --- Fonctions Utilitaires ---
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
    if (!playerData || !playerData.staminaLastUpdated || (playerData.stamina >= MAX_STAMINA && calculateCurrentStamina(playerData) >= MAX_STAMINA)) {
        // console.log(`Not starting timer for index ${index}. Reason: No data, no timestamp, or already at max stamina.`); // Debug Log
        // Ensure display is correct even if timer doesn't start
        const currentStaminaDisplay = document.getElementById(`dq-stamina-current-${index}`);
        if (currentStaminaDisplay && playerData) {
            currentStaminaDisplay.textContent = calculateCurrentStamina(playerData);
        }
        return;
    }
    // console.log(`Attempting to start stamina timer for index ${index}`); // Debug Log

    const lastUpdated = new Date(playerData.staminaLastUpdated);
    // Vérifier si lastUpdated est une date valide
    if (isNaN(lastUpdated.getTime())) {
        console.error("Invalid staminaLastUpdated date, cannot start timer:", playerData.staminaLastUpdated);
        return;
    }

    const minutesSinceLastRegen = Math.floor((new Date() - lastUpdated) / (1000 * 60)) % STAMINA_REGEN_RATE_MINUTES;
    const msUntilNextRegen = Math.max(1000, (STAMINA_REGEN_RATE_MINUTES - minutesSinceLastRegen) * 60 * 1000); // Ensure minimum 1 sec delay
    // console.log(`Timer for index ${index}: msUntilNextRegen = ${msUntilNextRegen}`); // Debug Log


    const updateDisplay = (isInitialCall = false) => {
        // console.log(`Updating stamina display for index ${index}`); // Debug Log
        const currentStaminaDisplay = document.getElementById(`dq-stamina-current-${index}`);
        const currentStaminaInput = document.getElementById(`dq-stamina-input-${index}`);
        const currentStamina = calculateCurrentStamina(playerData); // Recalculer
        // console.log(`Index ${index} - Current Calculated Stamina: ${currentStamina}`); // Debug Log

        if (currentStaminaDisplay) {
            currentStaminaDisplay.textContent = currentStamina;
        }
        // Update input value only on initial call or if it wasn't manually focused
        if (currentStaminaInput && (isInitialCall || document.activeElement !== currentStaminaInput)) {
            currentStaminaInput.value = currentStamina;
        }

        // Check if max stamina reached after update
        if (currentStamina >= MAX_STAMINA) {
            // console.log(`Max stamina reached for index ${index}. Stopping timer.`); // Debug Log
            stopStaminaTimer(index);
        }
    };

    // Premier délai pour attendre la prochaine minute de régénération
    const initialTimeoutId = setTimeout(() => {
        // console.log(`First timer tick for index ${index} after ${msUntilNextRegen}ms`); // Debug Log
        updateDisplay(); // Mise à jour immédiate au premier tick de regen
        if (calculateCurrentStamina(playerData) < MAX_STAMINA) { // Only set interval if not maxed out
            // Ensuite, intervalle régulier toutes les X minutes
            staminaIntervals[index] = setInterval(() => {
                // console.log(`Regular timer tick for index ${index}`); // Debug Log
                updateDisplay();
            }, STAMINA_REGEN_RATE_MINUTES * 60 * 1000);
        } else {
            // console.log(`Max stamina reached on first tick for index ${index}. Not setting interval.`); // Debug Log
        }
    }, msUntilNextRegen);

    // Stocker l'ID du timeout initial pour pouvoir l'annuler si besoin
    // (Pas strictement nécessaire ici car stopStaminaTimer ne clear que les intervals,
    // mais bonne pratique si on voulait pouvoir annuler avant le premier tick)

    // Mise à jour initiale immédiate de l'affichage
    // console.log(`Initial display update for index ${index}`); // Debug Log
    updateDisplay(true); // Indicate it's the initial call
}


// --- Fonctions d'Affichage ---
function renderQuestColumns() {
    // console.log("renderQuestColumns called. Selected IDs:", selectedPlayerIds); // Debug Log
    if (!container) {
        console.error("Daily quests container not found!");
        return;
    }

    const activePlayersIndices = selectedPlayerIds.map((id, index) => id ? index : -1).filter(index => index !== -1);
    // console.log("Active player indices:", activePlayersIndices); // Debug Log

    if (activePlayersIndices.length === 0) {
        container.innerHTML = '<div class="dq-placeholder">Select up to 3 players to track their daily quests.</div>';
        container.className = 'daily-quests-container'; // Reset class
        return;
    }

    container.innerHTML = ''; // Vider le conteneur
    container.className = `daily-quests-container columns-${activePlayersIndices.length}`; // Adapter le nombre de colonnes

    activePlayersIndices.forEach(index => {
        const playerId = selectedPlayerIds[index];
        const data = playerQuestData[index];
        // console.log(`Rendering column for index ${index}, playerId ${playerId}, data:`, data); // Debug Log

        if (!playerId || !data) {
            console.warn(`Skipping render for index ${index} due to missing data.`);
            // Optionally render an error column
            const errorColumn = document.createElement('div');
            errorColumn.className = 'dq-player-column dq-error-column';
            errorColumn.innerHTML = `<h3>Error</h3><p>Could not load data for selected player.</p>`;
            container.appendChild(errorColumn);
            return;
        };

        const playerColumn = document.createElement('div');
        playerColumn.className = 'dq-player-column';
        playerColumn.dataset.playerId = playerId;
        playerColumn.dataset.index = index; // Store index for event listeners

        const currentStamina = calculateCurrentStamina(data); // Calculate for initial display
        // console.log(`Initial stamina calculated for ${data.name}: ${currentStamina}`); // Debug Log

        // Build quest list HTML
        let questsHtml = '';
        if (questListDefinition && questListDefinition.length > 0) {
            questsHtml = questListDefinition.map(quest => `
                <li>
                    <input type="checkbox" id="quest-${playerId}-${quest.key}"
                           class="dq-quest-checkbox"
                           data-player-id="${playerId}" data-quest-key="${quest.key}"
                           ${data.completedQuests?.includes(quest.key) ? 'checked' : ''}>
                    <label for="quest-${playerId}-${quest.key}">${quest.label}</label>
                </li>
            `).join('');
        } else {
            questsHtml = '<li>Quest list not available.</li>';
            console.warn("questListDefinition is empty or undefined during render.");
        }


        playerColumn.innerHTML = `
            <h3>${data.name}</h3>
            <div class="dq-stamina-section">
                <label for="dq-stamina-input-${index}">Stamina:</label>
                <input type="number" id="dq-stamina-input-${index}" class="dq-stamina-input"
                       min="0" max="${MAX_STAMINA}" value="${currentStamina}" data-index="${index}" autocomplete="off">
                <span class="dq-stamina-current" id="dq-stamina-current-${index}">${currentStamina}</span> / ${MAX_STAMINA}
            </div>
            <ul class="dq-quest-list">
                ${questsHtml}
            </ul>
        `;
        container.appendChild(playerColumn);
        // console.log(`Starting stamina timer for index ${index} after rendering column.`); // Debug Log
        startStaminaTimer(index); // Démarrer le timer pour ce joueur après avoir ajouté la colonne au DOM
    });

    attachEventListeners(); // Attacher les écouteurs aux nouveaux éléments
}

// --- Logique de Récupération et Mise à jour ---
async function fetchAndUpdatePlayerData() {
    const idsToFetch = selectedPlayerIds.filter(id => id !== null);
    // console.log("fetchAndUpdatePlayerData called. IDs to fetch:", idsToFetch); // Debug Log

    // Arrêter tous les timers avant de recharger
    staminaIntervals.forEach((_, index) => stopStaminaTimer(index));

    if (idsToFetch.length === 0) {
        playerQuestData = [null, null, null]; // Réinitialiser les données
        renderQuestColumns();
        return;
    }

    try {
        const apiUrl = `/daily-quests/status?playerIds=${idsToFetch.join(',')}`;
        // console.log("Fetching data from:", apiUrl); // Debug Log
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // console.log("Data received from API:", data); // Debug Log

        // Mise à jour de la définition de la liste de quêtes (devrait être stable mais bon à rafraîchir)
        if(data.questsList && data.questsList.length > 0) {
            questListDefinition = data.questsList;
        } else {
            console.warn("Received empty or missing questsList from API");
            questListDefinition = questListDefinition || []; // Keep old list if new one is invalid
        }


        // Mettre à jour playerQuestData en respectant les indices des slots de sélection
        playerQuestData = selectedPlayerIds.map(selectedId => {
            if (!selectedId) return null;
            // Trouver les données correspondantes dans la réponse de l'API
            const foundPlayerData = data.players?.find(p => p.playerId === selectedId);
            if (!foundPlayerData) {
                console.warn(`Data for selected player ID ${selectedId} not found in API response.`);
            }
            // Assurer que completedQuests est toujours un tableau
            if (foundPlayerData && !Array.isArray(foundPlayerData.completedQuests)) {
                foundPlayerData.completedQuests = [];
            }
            return foundPlayerData || null; // Retourner null si pas trouvé
        });
        // console.log("Updated playerQuestData:", playerQuestData); // Debug Log

        renderQuestColumns(); // Re-render l'interface avec les nouvelles données

    } catch (error) {
        console.error("Failed to fetch daily quest status:", error);
        container.innerHTML = '<div class="dq-error">Could not load quest data. Please try again later.</div>';
    }
}

async function updateQuestStatus(playerId, questKey, completed) {
    // console.log(`Updating quest status: Player ${playerId}, Quest ${questKey}, Completed: ${completed}`); // Debug Log
    // Optimistic UI update (optional but improves perceived performance)
    const playerIndex = selectedPlayerIds.findIndex(id => id === playerId);
    if (playerIndex !== -1 && playerQuestData[playerIndex]) {
        const currentQuests = playerQuestData[playerIndex].completedQuests;
        if (completed && !currentQuests.includes(questKey)) {
            currentQuests.push(questKey);
        } else if (!completed) {
            playerQuestData[playerIndex].completedQuests = currentQuests.filter(key => key !== questKey);
        }
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
                if (completed) { // If it failed while trying to complete
                    playerQuestData[playerIndex].completedQuests = playerQuestData[playerIndex].completedQuests.filter(key => key !== questKey);
                } else { // If it failed while trying to un-complete
                    if (!playerQuestData[playerIndex].completedQuests.includes(questKey)) {
                        playerQuestData[playerIndex].completedQuests.push(questKey);
                    }
                }
            }
            // Re-render or just update the checkbox
            const checkbox = document.getElementById(`quest-${playerId}-${questKey}`);
            if (checkbox) checkbox.checked = !completed;
            alert("Failed to save quest status. Please try again.");
        }
        // No need to do anything on success if optimistic update was done
    } catch (error) {
        console.error("Error updating quest status:", error);
        // Revert optimistic update
        if (playerIndex !== -1 && playerQuestData[playerIndex]) {
            if (completed) {
                playerQuestData[playerIndex].completedQuests = playerQuestData[playerIndex].completedQuests.filter(key => key !== questKey);
            } else {
                if (!playerQuestData[playerIndex].completedQuests.includes(questKey)) {
                    playerQuestData[playerIndex].completedQuests.push(questKey);
                }
            }
        }
        const checkbox = document.getElementById(`quest-${playerId}-${questKey}`);
        if (checkbox) checkbox.checked = !completed;
        alert("An error occurred while saving quest status.");
    }
}

async function updateStaminaValue(index, inputElement) {
    const playerId = selectedPlayerIds[index];
    if (!playerId) return; // Should not happen if called correctly

    let staminaValue = parseInt(inputElement.value, 10);
    // console.log(`updateStaminaValue called for index ${index}, playerId ${playerId}, value entered: ${inputElement.value}`); // Debug Log


    // Validation - ensure value is within bounds
    let needsCorrection = false;
    if (isNaN(staminaValue) || staminaValue < 0) {
        staminaValue = 0;
        needsCorrection = true;
    }
    if (staminaValue > MAX_STAMINA) {
        staminaValue = MAX_STAMINA;
        needsCorrection = true;
    }
    // Update input visually immediately if corrected
    if (needsCorrection) {
        inputElement.value = staminaValue;
    }

    stopStaminaTimer(index); // Arrêter le timer pendant la mise à jour manuelle
    // console.log(`Timer stopped for index ${index} during manual update.`); // Debug Log


    try {
        // console.log(`Sending update stamina request: Player ${playerId}, Stamina ${staminaValue}`); // Debug Log
        const response = await fetch('/daily-quests/update-stamina', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, stamina: staminaValue })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        // console.log("Stamina update response:", result); // Debug Log


        if (result.success && playerQuestData[index]) {
            // Mettre à jour les données locales et redémarrer le timer
            playerQuestData[index].stamina = result.stamina; // Use value confirmed by server
            playerQuestData[index].staminaLastUpdated = result.staminaLastUpdated;
            // Update display and restart timer
            const currentStaminaDisplay = document.getElementById(`dq-stamina-current-${index}`);
            if (currentStaminaDisplay) currentStaminaDisplay.textContent = result.stamina;
            inputElement.value = result.stamina; // Ensure input matches server
            // console.log(`Stamina updated successfully for index ${index}. Restarting timer.`); // Debug Log
            startStaminaTimer(index);
        } else {
            console.error('Failed to update stamina on server:', result.error || 'Unknown error');
            // Revert input to last known calculated value and restart timer
            const lastCalculatedStamina = calculateCurrentStamina(playerQuestData[index]);
            inputElement.value = lastCalculatedStamina;
            const currentStaminaDisplay = document.getElementById(`dq-stamina-current-${index}`);
            if (currentStaminaDisplay) currentStaminaDisplay.textContent = lastCalculatedStamina;
            startStaminaTimer(index);
            alert("Failed to save stamina value.");
        }
    } catch (error) {
        console.error("Error updating stamina:", error);
        // Revert input to last known calculated value and restart timer
        const lastCalculatedStamina = calculateCurrentStamina(playerQuestData[index]);
        inputElement.value = lastCalculatedStamina;
        const currentStaminaDisplay = document.getElementById(`dq-stamina-current-${index}`);
        if (currentStaminaDisplay) currentStaminaDisplay.textContent = lastCalculatedStamina;
        startStaminaTimer(index);
        alert("An error occurred while saving stamina value.");
    }
}


// --- Écouteurs d'Événements ---
function attachEventListeners() {
    // console.log("Attaching event listeners..."); // Debug Log
    // Checkboxes de quêtes
    container.querySelectorAll('.dq-quest-checkbox').forEach(checkbox => {
        // Remove previous listener if any (important for re-renders)
        checkbox.replaceWith(checkbox.cloneNode(true));
    });
    // Attach listener to the new nodes
    container.querySelectorAll('.dq-quest-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (event) => {
            const playerId = parseInt(event.target.dataset.playerId, 10);
            const questKey = event.target.dataset.questKey;
            const completed = event.target.checked;
            updateQuestStatus(playerId, questKey, completed);
        });
    });

    // Inputs de stamina
    container.querySelectorAll('.dq-stamina-input').forEach(input => {
        // Remove previous listeners
        input.replaceWith(input.cloneNode(true));
    });
    // Attach listeners to new nodes
    container.querySelectorAll('.dq-stamina-input').forEach(input => {
        let debounceTimer;
        // Use 'input' for quicker validation feedback, but debounce the actual API call
        input.addEventListener('input', (event) => {
            const index = parseInt(event.target.dataset.index, 10);
            const value = event.target.value;
            // Basic validation during typing (optional)
            if (value !== "" && (!/^\d+$/.test(value) || parseInt(value, 10) < 0 || parseInt(value, 10) > MAX_STAMINA)) {
                // Maybe add a visual indicator of invalid input
            }

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                updateStaminaValue(index, event.target);
            }, 1000); // Debounce API call by 1 second after last input
        });

        // Also trigger on 'change' or 'blur' to ensure final value is saved
        input.addEventListener('change', (event) => {
            clearTimeout(debounceTimer); // Clear debounce if change fires
            const index = parseInt(event.target.dataset.index, 10);
            updateStaminaValue(index, event.target);
        });
        input.addEventListener('blur', (event) => {
            clearTimeout(debounceTimer); // Clear debounce if blur fires
            const index = parseInt(event.target.dataset.index, 10);
            // Only call update if value might need correction or wasn't sent by debouncer
            const currentValue = parseInt(event.target.value, 10);
            const needsValidation = isNaN(currentValue) || currentValue < 0 || currentValue > MAX_STAMINA;
            if (needsValidation) {
                updateStaminaValue(index, event.target); // Force validation/save on blur
            } else if (playerQuestData[index] && currentValue !== calculateCurrentStamina(playerQuestData[index])) {
                // If value is valid but potentially different from last *calculated* value (e.g., regen happened),
                // consider if an update is needed. Usually handled by change or debounce.
                // Maybe force update here too for safety?
                // updateStaminaValue(index, event.target);
            } else {
                // Value is likely valid and already sent or matches calculated, potentially restart timer
                startStaminaTimer(index);
            }
        });
    });
    // console.log("Event listeners attached."); // Debug Log
}

// --- Initialisation ---
export function initDailyQuests() {
    // console.log("Initializing Daily Quests module..."); // Debug Log
    if (!container) {
        console.error("Daily Quests container not found on init!");
        return;
    }

    playerSelectors.forEach(select => {
        select.addEventListener('change', (event) => {
            const index = parseInt(event.target.dataset.index, 10);
            const selectedId = event.target.value ? parseInt(event.target.value, 10) : null;
            // console.log(`Player selected at index ${index}: ID ${selectedId}`); // Debug Log

            // Vérifier si l'ID est déjà sélectionné dans un autre selecteur
            const alreadySelected = selectedPlayerIds.some((id, i) => id !== null && id === selectedId && i !== index);
            if (alreadySelected) {
                alert("This player is already selected in another slot.");
                event.target.value = selectedPlayerIds[index] || ""; // Revenir à la valeur précédente
                return;
            }

            // Arrêter le timer de l'ancien joueur de ce slot SI l'ID change
            if (selectedPlayerIds[index] !== selectedId) {
                stopStaminaTimer(index);
            }

            selectedPlayerIds[index] = selectedId;
            fetchAndUpdatePlayerData(); // Fetch data for the new set of selected players
        });
    });

    // Charger les données initiales (pour le cas où aucun joueur n'est sélectionné au début)
    // console.log("Performing initial data fetch..."); // Debug Log
    fetchAndUpdatePlayerData();
}