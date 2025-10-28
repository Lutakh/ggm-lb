// public/js/modules/dailyQuests.js

const STAMINA_REGEN_RATE_MINUTES = 24;
const MAX_STAMINA = 60; // Limite mise à jour
const LOCAL_STORAGE_KEY = 'dailyQuestSelectedPlayers';

let questListDefinition = [];
let selectedPlayerIds = [null, null, null];
let selectedPlayerNames = [null, null, null];
let playerQuestData = [null, null, null];
let staminaIntervals = [null, null, null]; // Garder pour màj affichage

// --- Supprimer les variables liées aux notifications navigateur ---
// let notificationPermissionsGranted = false; // Supprimé
// let notifiedStaminaLevels = {}; // Supprimé

const container = document.getElementById('daily-quests-container');
const playerSelectorUIs = document.querySelectorAll('.dq-player-selection-ui');

// --- Récupérer les éléments de la modale partagée ---
const playerSelectModal = document.getElementById('player-select-modal');
const playerSelectBackdrop = document.getElementById('player-select-modal-backdrop');
const playerSelectFilterInput = document.getElementById('player-filter-input');
const playerSelectListContainer = document.getElementById('player-select-list');
const playerSelectCloseModalBtn = playerSelectModal?.querySelector('.player-select-close-btn');
const playerSelectCreatePlayerBtn = document.getElementById('create-new-player-btn');

let activePlayerSelectorIndex = null;
let activeModalSuggestionIndex = -1;

// --- Données joueurs pour la modale ---
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

// --- Supprimer les fonctions de notification navigateur ---
// async function requestNotificationPermission() { /* ... SUPPRIMÉ ... */ }
// function showStaminaNotification(playerName, currentStamina) { /* ... SUPPRIMÉ ... */ }

// --- Fonctions localStorage ---
function saveSelectedPlayersToLocalStorage() {
    try {
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
            if (Array.isArray(parsedIds) && parsedIds.length === 3 && parsedIds.every(id => typeof id === 'number' || id === null)) {
                selectedPlayerIds = parsedIds;
                // console.log("Loaded player IDs from localStorage:", selectedPlayerIds); // Debug Log

                // Mettre à jour l'affichage initial des sélecteurs
                selectedPlayerIds.forEach((playerId, index) => {
                    if (playerId !== null) {
                        const player = allPlayersForModal.find(p => p.id === playerId);
                        if (player) {
                            selectedPlayerNames[index] = player.name;
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
                            console.warn(`Player ID ${playerId} from localStorage not found in current player list.`);
                            selectedPlayerIds[index] = null;
                            selectedPlayerNames[index] = null;
                        }
                    } else {
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
                localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
        } else {
            // console.log("No player IDs found in localStorage."); // Debug Log
        }
    } catch (e) {
        console.error("Error loading selected players from localStorage:", e);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
}

// --- Fonctions Utilitaires Stamina ---
function calculateCurrentStamina(playerData) {
    if (!playerData || !playerData.staminaLastUpdated) {
        // console.log(`[FE Calc ${playerData?.name}] No player data or timestamp. Returning base stamina: ${playerData?.stamina || 0}`);
        return playerData ? (playerData.stamina || 0) : 0;
    }

    const lastUpdated = new Date(playerData.staminaLastUpdated);
    const now = new Date();

    if (isNaN(lastUpdated.getTime())) {
        console.error(`[FE Calc ${playerData.name}] Invalid lastUpdated date: ${playerData.staminaLastUpdated}`);
        return playerData.stamina || 0;
    }

    // console.log(`[FE Calc ${playerData.name}] Now(Locale)=${now.toLocaleString()}, LastUpdated(Locale)=${lastUpdated.toLocaleString()} (DB ISO: ${playerData.staminaLastUpdated})`);
    // console.log(`[FE Calc ${playerData.name}] Now(UTC ISO)=${now.toISOString()}, LastUpdated(UTC ISO)=${lastUpdated.toISOString()}`);

    const minutesPassed = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60));
    // console.log(`[FE Calc ${playerData.name}] Minutes Passed=${minutesPassed}`);

    if (minutesPassed < 0) {
        console.warn(`[FE Calc ${playerData.name}] Negative minutes passed (${minutesPassed}). Clock skew? Returning base stamina: ${playerData.stamina || 0}`);
        return Math.min(MAX_STAMINA, playerData.stamina || 0);
    }

    const regeneratedStamina = Math.floor(minutesPassed / STAMINA_REGEN_RATE_MINUTES);
    // console.log(`[FE Calc ${playerData.name}] Regenerated=${regeneratedStamina}`);
    const calculatedStamina = (playerData.stamina || 0) + regeneratedStamina;
    // console.log(`[FE Calc ${playerData.name}] BaseStamina=${playerData.stamina || 0}, Calculated Before Max=${calculatedStamina}`);
    const finalStamina = Math.min(MAX_STAMINA, calculatedStamina);
    // console.log(`[FE Calc ${playerData.name}] Final Calculated Stamina=${finalStamina}`);
    return finalStamina;
}

function stopStaminaTimer(index) {
    if (staminaIntervals[index]) {
        clearInterval(staminaIntervals[index]);
        staminaIntervals[index] = null;
    }
}

// --- startStaminaTimer (SIMPLIFIÉ pour affichage uniquement) ---
function startStaminaTimer(index) {
    stopStaminaTimer(index); // Arrêter l'ancien

    const playerData = playerQuestData[index];
    // Il faut recalculer ici car playerData peut avoir changé depuis le dernier appel
    const initialStamina = calculateCurrentStamina(playerData);

    // Ne pas démarrer si pas de données, pas de timestamp, ou déjà au max
    if (!playerData || !playerData.staminaLastUpdated || initialStamina >= MAX_STAMINA) {
        // Mettre à jour l'affichage une dernière fois
        const currentStaminaDisplay = document.getElementById(`dq-stamina-current-${index}`);
        if (currentStaminaDisplay && playerData) currentStaminaDisplay.textContent = initialStamina;
        const currentStaminaInput = document.getElementById(`dq-stamina-input-${index}`);
        if (currentStaminaInput && playerData && document.activeElement !== currentStaminaInput) currentStaminaInput.value = initialStamina;
        const minutesInputElement = document.getElementById(`dq-stamina-next-input-${index}`);
        const secondsInputElement = document.getElementById(`dq-stamina-next-seconds-input-${index}`);
        updateTimerInputs(index, minutesInputElement, secondsInputElement); // Met à jour min/sec (devrait être vide si max)
        return;
    }

    const lastUpdated = new Date(playerData.staminaLastUpdated);
    if (isNaN(lastUpdated.getTime())) { return; }

    const updateDisplay = (isInitialCall = false) => {
        const currentStamina = calculateCurrentStamina(playerData); // Recalculer à chaque appel

        // Mise à jour des éléments DOM
        const currentStaminaDisplay = document.getElementById(`dq-stamina-current-${index}`);
        const currentStaminaInput = document.getElementById(`dq-stamina-input-${index}`);
        const minutesInputElement = document.getElementById(`dq-stamina-next-input-${index}`);
        const secondsInputElement = document.getElementById(`dq-stamina-next-seconds-input-${index}`);

        if (currentStaminaDisplay) currentStaminaDisplay.textContent = currentStamina;
        if (currentStaminaInput && (isInitialCall || document.activeElement !== currentStaminaInput)) {
            currentStaminaInput.value = currentStamina;
        }
        updateTimerInputs(index, minutesInputElement, secondsInputElement); // Mettre à jour min/sec

        // --- Vérification pour Notification SUPPRIMÉE ---

        // Arrêter le timer si max atteint
        if (currentStamina >= MAX_STAMINA) {
            stopStaminaTimer(index);
            if (minutesInputElement) minutesInputElement.value = '';
            if (secondsInputElement) secondsInputElement.value = '';
        }
    };

    // Mettre à jour toutes les secondes pour le compte à rebours visuel
    staminaIntervals[index] = setInterval(() => {
        updateDisplay();
    }, 1000);

    // Mise à jour initiale
    updateDisplay(true);
}


// Helper to update BOTH the minutes and seconds remaining input fields
function updateTimerInputs(index, minutesInputElement, secondsInputElement) {
    if (!minutesInputElement || !secondsInputElement) return;

    const playerData = playerQuestData[index];
    const currentStamina = calculateCurrentStamina(playerData);
    let minutesRemainingValue = '';
    let secondsRemainingValue = '';

    if (playerData && playerData.staminaLastUpdated && currentStamina < MAX_STAMINA) {
        const lastUpdated = new Date(playerData.staminaLastUpdated);
        if (!isNaN(lastUpdated.getTime())) {
            const nowMs = Date.now();
            const lastUpdatedMs = lastUpdated.getTime();
            const cycleMs = STAMINA_REGEN_RATE_MINUTES * 60 * 1000;
            const msSinceLastUpdate = nowMs - lastUpdatedMs;

            if (msSinceLastUpdate >= 0) {
                const msIntoCurrentCycle = msSinceLastUpdate % cycleMs;
                const msRemaining = cycleMs - msIntoCurrentCycle;
                const totalSecondsRemaining = Math.max(0, Math.floor(msRemaining / 1000));
                minutesRemainingValue = Math.floor(totalSecondsRemaining / 60);
                secondsRemainingValue = totalSecondsRemaining % 60;
                // Add padding here for display consistency
                secondsRemainingValue = (secondsRemainingValue < 10) ? `0${secondsRemainingValue}` : secondsRemainingValue.toString(); // Ensure string

            } else { /* ... warning ... */ }
        }
    }
    // Only update inputs if they are not currently focused by the user
    if (document.activeElement !== minutesInputElement) {
        minutesInputElement.value = minutesRemainingValue;
    }
    if (document.activeElement !== secondsInputElement) {
        secondsInputElement.value = secondsRemainingValue;
    }
}


// --- MODAL LOGIC ---
function updateActiveModalSuggestion(items) {
    items.forEach((item, index) => {
        item.classList.toggle('active', index === activeModalSuggestionIndex);
        if (index === activeModalSuggestionIndex) {
            item.scrollIntoView({ block: 'nearest' });
        }
    });
}
function populatePlayerModalList(filter = '') {
    if (!playerSelectListContainer) return;
    playerSelectListContainer.innerHTML = '';
    const query = filter.toLowerCase();
    const currentlySelectedIdsInOtherSlots = selectedPlayerIds.filter((id, i) => id !== null && i !== activePlayerSelectorIndex);

    allPlayersForModal
        .filter(p =>
            p.name.toLowerCase().includes(query) &&
            !currentlySelectedIdsInOtherSlots.includes(p.id)
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(player => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.dataset.playerId = player.id;
            item.dataset.playerName = player.name;
            item.innerHTML = `<span>${player.name}</span>`;
            playerSelectListContainer.appendChild(item);
        });
    activeModalSuggestionIndex = -1;
}
function openPlayerSelectModal(index) {
    if (!playerSelectModal || !playerSelectBackdrop || !playerSelectFilterInput) {
        console.error("Player selection modal elements not found!");
        return;
    }
    activePlayerSelectorIndex = index;
    playerSelectFilterInput.value = '';
    populatePlayerModalList();
    playerSelectModal.style.display = 'flex';
    playerSelectBackdrop.style.display = 'block';
    playerSelectFilterInput.focus();
    activeModalSuggestionIndex = -1;
}
function closePlayerSelectModal() {
    if (playerSelectModal) playerSelectModal.style.display = 'none';
    if (playerSelectBackdrop) playerSelectBackdrop.style.display = 'none';
}
function setSelectedPlayer(index, playerId, playerName) {
    if (index === null || index < 0 || index > 2) {
        console.error("Invalid index provided to setSelectedPlayer:", index);
        closePlayerSelectModal();
        return;
    }

    const alreadySelectedElsewhere = selectedPlayerIds.some((id, i) => id !== null && id === playerId && i !== index);
    if (alreadySelectedElsewhere) {
        alert(`${playerName} is already selected in another slot.`);
        playerSelectFilterInput?.focus();
        return;
    }

    if (selectedPlayerIds[index] !== playerId) {
        stopStaminaTimer(index);
    }

    selectedPlayerIds[index] = playerId;
    selectedPlayerNames[index] = playerName;

    saveSelectedPlayersToLocalStorage(); // SAUVEGARDE

    const displayDiv = document.getElementById(`dq-player-display-${index}`);
    const idInput = document.getElementById(`dq-player-id-hidden-${index}`);
    const nameInput = document.getElementById(`dq-player-name-hidden-${index}`);

    if (displayDiv && idInput && nameInput) {
        if (playerId !== null && playerName !== null) {
            displayDiv.textContent = playerName;
            displayDiv.classList.add('player-selected');
            idInput.value = playerId;
            nameInput.value = playerName;
        } else {
            displayDiv.textContent = '-- Select Player --';
            displayDiv.classList.remove('player-selected');
            idInput.value = '';
            nameInput.value = '';
        }
    } else {
        console.error(`Could not find display/input elements for index ${index}`);
    }

    closePlayerSelectModal();
    fetchAndUpdatePlayerData();
    activePlayerSelectorIndex = null;
}

// --- Fonctions d'Affichage ---
function renderQuestColumns() {
    if (!container) return;
    const activePlayersIndices = selectedPlayerIds.map((id, index) => id ? index : -1).filter(index => index !== -1);
    const isMobile = window.innerWidth <= 768;
    const indicesToRender = isMobile ? activePlayersIndices.slice(0, 1) : activePlayersIndices;
    const columnsToShow = indicesToRender.length;

    if (columnsToShow === 0) {
        container.innerHTML = '<div class="dq-placeholder">Select up to 3 players (1 on mobile) to track their daily quests.</div>';
        container.className = 'daily-quests-container';
        return;
    }

    container.innerHTML = '';
    container.className = `daily-quests-container columns-${columnsToShow}`;

    indicesToRender.forEach(index => {
        const playerId = selectedPlayerIds[index];
        const data = playerQuestData[index];
        const playerColumn = document.createElement('div');
        playerColumn.className = 'dq-player-column';
        playerColumn.dataset.playerId = playerId;
        playerColumn.dataset.index = index;

        if (!playerId || !data) {
            playerColumn.classList.add('dq-error-column');
            playerColumn.innerHTML = `<h3>Error</h3><p>Could not load data for player in slot ${index + 1}.</p>`;
            container.appendChild(playerColumn);
            return;
        };

        const currentStamina = calculateCurrentStamina(data);
        let minutesRemainingValue = '';
        let secondsRemainingValue = '';
        if (data.staminaLastUpdated && currentStamina < MAX_STAMINA) {
            const lastUpdated = new Date(data.staminaLastUpdated);
            if (!isNaN(lastUpdated.getTime())) {
                const nowMs = Date.now();
                const lastUpdatedMs = lastUpdated.getTime();
                const cycleMs = STAMINA_REGEN_RATE_MINUTES * 60 * 1000;
                const msSinceLastUpdate = nowMs - lastUpdatedMs;
                if (msSinceLastUpdate >= 0) {
                    const msIntoCurrentCycle = msSinceLastUpdate % cycleMs;
                    const msRemaining = cycleMs - msIntoCurrentCycle;
                    const totalSecondsRemaining = Math.max(0, Math.floor(msRemaining / 1000));
                    minutesRemainingValue = Math.floor(totalSecondsRemaining / 60);
                    secondsRemainingValue = totalSecondsRemaining % 60;
                    secondsRemainingValue = (secondsRemainingValue < 10 && totalSecondsRemaining >= 0) ? `0${secondsRemainingValue}` : secondsRemainingValue.toString(); // Ensure string and pad
                    // Handle edge case where msRemaining is very small leading to 0s 0ms
                    if (minutesRemainingValue === 0 && secondsRemainingValue === '0' && msRemaining > 0) secondsRemainingValue = '00';
                }
            }
        }

        let questsHtml = '';
        if (questListDefinition && questListDefinition.length > 0) {
            questsHtml = questListDefinition.map(quest => {
                const isCompleted = Array.isArray(data.completedQuests) && data.completedQuests.includes(quest.key);
                return `<li><input type="checkbox" id="quest-${playerId}-${quest.key}" class="dq-quest-checkbox" data-player-id="${playerId}" data-quest-key="${quest.key}" ${isCompleted ? 'checked' : ''}><label for="quest-${playerId}-${quest.key}">${quest.label}</label></li>`;
            }).join('');
        } else { questsHtml = '<li>Quest list not available.</li>'; }

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
                     <span>min</span>
                     <input type="number" id="dq-stamina-next-seconds-input-${index}" class="dq-stamina-next-seconds-input"
                            min="0" max="59" placeholder="sec" data-index="${index}"
                            value="${secondsRemainingValue}" autocomplete="off">
                      <span>sec</span>
                </div>
                 </div>
            <ul class="dq-quest-list">
                ${questsHtml}
            </ul>
        `;

        container.appendChild(playerColumn);
        startStaminaTimer(index);
    });

    attachEventListeners();
}

// --- Logique de Récupération et Mise à jour ---
async function fetchAndUpdatePlayerData() { /* ... inchangé ... */ }
async function updateQuestStatus(playerId, questKey, completed) { /* ... inchangé ... */ }
async function updateStaminaValue(index, inputElement, minutesInputElement = null, secondsInputElement = null) { /* ... inchangé ... */ }


// --- Écouteurs d'Événements ---
function attachEventListeners() {
    // console.log("Attaching event listeners...");

    // Clone and replace checkboxes
    const questCheckboxes = container.querySelectorAll('.dq-quest-checkbox');
    questCheckboxes.forEach(checkbox => {
        const newCheckbox = checkbox.cloneNode(true);
        checkbox.parentNode.replaceChild(newCheckbox, checkbox);
        newCheckbox.addEventListener('change', handleQuestChange);
    });

    // Clone and replace stamina inputs
    const staminaInputs = container.querySelectorAll('.dq-stamina-input');
    staminaInputs.forEach(input => {
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        let debounceTimer;
        newInput.addEventListener('input', (event) => { debounceTimer = handleStaminaInput(event, debounceTimer); });
        newInput.addEventListener('change', (event) => { debounceTimer = handleStaminaChange(event, debounceTimer); });
        newInput.addEventListener('blur', (event) => { debounceTimer = handleStaminaBlur(event, debounceTimer); });
    });

    // Clone and replace stamina timer MINUTES inputs
    const staminaNextInputs = container.querySelectorAll('.dq-stamina-next-input');
    staminaNextInputs.forEach(input => {
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        let debounceTimer;
        newInput.addEventListener('input', (event) => { debounceTimer = handleStaminaNextInput(event, debounceTimer); });
        newInput.addEventListener('change', (event) => { debounceTimer = handleStaminaNextChangeOrBlur(event, debounceTimer); });
        newInput.addEventListener('blur', (event) => { debounceTimer = handleStaminaNextChangeOrBlur(event, debounceTimer); });
    });

    // Clone and replace stamina timer SECONDS inputs
    const staminaNextSecondsInputs = container.querySelectorAll('.dq-stamina-next-seconds-input');
    staminaNextSecondsInputs.forEach(input => {
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        let debounceTimer;
        newInput.addEventListener('input', (event) => { debounceTimer = handleStaminaNextSecondsInput(event, debounceTimer); });
        newInput.addEventListener('change', (event) => { debounceTimer = handleStaminaNextSecondsChangeOrBlur(event, debounceTimer); });
        newInput.addEventListener('blur', (event) => { debounceTimer = handleStaminaNextSecondsChangeOrBlur(event, debounceTimer); });
    });

    // console.log("Event listeners attached.");
}

// --- Event Handler Functions ---
function handleQuestChange(event) { /* ... inchangé ... */ }
function handleStaminaInput(event, debounceTimer) {
    const target = event.target;
    const index = parseInt(target.dataset.index, 10);
    /* ... validation visuelle ... */
    clearTimeout(debounceTimer);
    const newTimer = setTimeout(() => {
        const minutesInput = document.getElementById(`dq-stamina-next-input-${index}`);
        const secondsInput = document.getElementById(`dq-stamina-next-seconds-input-${index}`);
        updateStaminaValue(index, target, minutesInput, secondsInput);
    }, 1200);
    return newTimer;
}
function handleStaminaChange(event, debounceTimer) {
    clearTimeout(debounceTimer);
    const index = parseInt(event.target.dataset.index, 10);
    const minutesInput = document.getElementById(`dq-stamina-next-input-${index}`);
    const secondsInput = document.getElementById(`dq-stamina-next-seconds-input-${index}`);
    updateStaminaValue(index, event.target, minutesInput, secondsInput);
    return null;
}
function handleStaminaBlur(event, debounceTimer) {
    clearTimeout(debounceTimer);
    const index = parseInt(event.target.dataset.index, 10);
    const minutesInput = document.getElementById(`dq-stamina-next-input-${index}`);
    const secondsInput = document.getElementById(`dq-stamina-next-seconds-input-${index}`);
    updateStaminaValue(index, event.target, minutesInput, secondsInput);
    return null;
}
function handleStaminaNextInput(event, debounceTimer) {
    const target = event.target;
    const index = parseInt(target.dataset.index, 10);
    /* ... validation visuelle ... */
    clearTimeout(debounceTimer);
    const newTimer = setTimeout(() => {
        const staminaInput = document.getElementById(`dq-stamina-input-${index}`);
        const secondsInput = document.getElementById(`dq-stamina-next-seconds-input-${index}`);
        if (staminaInput && secondsInput) {
            updateStaminaValue(index, staminaInput, target, secondsInput);
        } else { /* ... error log ... */ }
    }, 1200);
    return newTimer;
}
function handleStaminaNextChangeOrBlur(event, debounceTimer) {
    clearTimeout(debounceTimer);
    const index = parseInt(event.target.dataset.index, 10);
    const staminaInput = document.getElementById(`dq-stamina-input-${index}`);
    const secondsInput = document.getElementById(`dq-stamina-next-seconds-input-${index}`);
    if (staminaInput && secondsInput) {
        updateStaminaValue(index, staminaInput, event.target, secondsInput);
    } else { /* ... error log ... */ }
    return null;
}
function handleStaminaNextSecondsInput(event, debounceTimer) {
    const target = event.target;
    const index = parseInt(target.dataset.index, 10);
    /* ... validation visuelle ... */
    clearTimeout(debounceTimer);
    const newTimer = setTimeout(() => {
        const staminaInput = document.getElementById(`dq-stamina-input-${index}`);
        const minutesInput = document.getElementById(`dq-stamina-next-input-${index}`);
        if (staminaInput && minutesInput) {
            updateStaminaValue(index, staminaInput, minutesInput, target);
        } else { /* ... error log ... */ }
    }, 1200);
    return newTimer;
}
function handleStaminaNextSecondsChangeOrBlur(event, debounceTimer) {
    clearTimeout(debounceTimer);
    const index = parseInt(event.target.dataset.index, 10);
    const staminaInput = document.getElementById(`dq-stamina-input-${index}`);
    const minutesInput = document.getElementById(`dq-stamina-next-input-${index}`);
    if (staminaInput && minutesInput) {
        updateStaminaValue(index, staminaInput, minutesInput, event.target);
    } else { /* ... error log ... */ }
    return null;
}


// --- Initialisation ---
export function initDailyQuests() {
    console.log("Initializing Daily Quests module...");
    if (!container) { /* ... error ... */ return; }
    if (!playerSelectorUIs || playerSelectorUIs.length === 0) { /* ... error ... */ return; }
    if (!playerSelectModal) { /* ... error ... */ }

    // --- Appel requestNotificationPermission SUPPRIMÉ ---

    loadSelectedPlayersFromLocalStorage();

    const handleResizeOrLoad = () => {
        const isMobile = window.innerWidth <= 768;
        // console.log(`handleResizeOrLoad - isMobile: ${isMobile}`);

        playerSelectorUIs.forEach((ui, index) => {
            const group = ui.closest('.player-selector-group');
            if (group) {
                group.style.display = (index > 0 && isMobile) ? 'none' : '';
            }
        });
        // Appeler renderQuestColumns pour redessiner le bon nombre de colonnes
        renderQuestColumns();
    };

    window.addEventListener('resize', handleResizeOrLoad);
    // L'appel initial est fait après le fetch initial

    // Écouteurs pour ouvrir la modale
    playerSelectorUIs.forEach(ui => {
        const button = ui.querySelector('.dq-open-modal-btn');
        if (button) { /* ... attacher listener ... */ }
        const display = ui.querySelector('.dq-player-name-display');
        if(display && button) { /* ... attacher listener ... */ }
    });

    // Écouteurs pour la modale partagée
    if(playerSelectModal) {
        if (playerSelectCloseModalBtn) playerSelectCloseModalBtn.addEventListener('click', closePlayerSelectModal);
        if (playerSelectBackdrop) playerSelectBackdrop.addEventListener('click', closePlayerSelectModal);

        if (playerSelectFilterInput) {
            playerSelectFilterInput.addEventListener('input', () => { /* ... populate ... */ });
            playerSelectFilterInput.addEventListener('keydown', (e) => { /* ... gestion clavier ... */ });
        }
        if (playerSelectListContainer) {
            playerSelectListContainer.addEventListener('click', (e) => { /* ... gestion clic ... */ });
        }
        if (playerSelectCreatePlayerBtn) {
            playerSelectCreatePlayerBtn.addEventListener('click', (e) => { /* ... gestion alerte création ... */ });
        }
    }

    // Fetch initial data & apply layout
    console.log("Performing initial data fetch (on init)...");
    fetchAndUpdatePlayerData().then(() => {
        handleResizeOrLoad(); // Appliquer layout après fetch
    });
} // Fin initDailyQuests