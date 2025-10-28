// public/js/modules/dailyQuests.js
import { openModal as openPlayerSelectModal } from './playerSelectModal.js'; // Importer la fonction renommée

const STAMINA_REGEN_RATE_MINUTES = 24;
const MAX_STAMINA = 60;
const LOCAL_STORAGE_KEY = 'dailyQuestSelectedPlayers';

let questListDefinition = [];
let selectedPlayerIds = [null, null, null];
let selectedPlayerNames = [null, null, null]; // Garder pour affichage rapide
let playerQuestData = [null, null, null]; // Stocke les données fetchées (stamina, quêtes complétées)
let staminaIntervals = [null, null, null]; // Pour les timers d'affichage stamina

const container = document.getElementById('daily-quests-container');
const playerSelectorUIs = document.querySelectorAll('.dq-player-selection-ui');

// Données joueurs globales (simplifiées) pour la modale - Récupérées une fois
let allPlayersForModal = [];
const playersSelectorDataElement = document.getElementById('player-selector-data'); // Assurez-vous que cet ID existe dans votre EJS
if (playersSelectorDataElement) {
    try {
        // Attend {id, name, class}
        allPlayersForModal = JSON.parse(playersSelectorDataElement.textContent || '[]');
    } catch(e) { console.error("Error parsing player-selector-data JSON:", e); }
} else { console.error("Element #player-selector-data not found!"); }


// --- Fonctions localStorage ---
function saveSelectedPlayersToLocalStorage() {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(selectedPlayerIds));
    } catch (e) { console.error("Error saving selected players to localStorage:", e); }
}

function loadSelectedPlayersFromLocalStorage() {
    try {
        const storedValue = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedValue) {
            const parsedIds = JSON.parse(storedValue);
            if (Array.isArray(parsedIds) && parsedIds.length === 3 && parsedIds.every(id => typeof id === 'number' || id === null)) {
                selectedPlayerIds = parsedIds;
                // Mettre à jour l'affichage initial des sélecteurs
                selectedPlayerIds.forEach((playerId, index) => {
                    const displayDiv = document.getElementById(`dq-player-display-${index}`);
                    const idInput = document.getElementById(`dq-player-id-hidden-${index}`);
                    const nameInput = document.getElementById(`dq-player-name-hidden-${index}`); // Hidden name input
                    if (playerId !== null) {
                        const player = allPlayersForModal.find(p => p.id === playerId);
                        if (player) {
                            selectedPlayerNames[index] = player.name; // Store name
                            if (displayDiv && idInput && nameInput) {
                                displayDiv.textContent = player.name;
                                displayDiv.classList.add('player-selected');
                                idInput.value = playerId;
                                nameInput.value = player.name; // Set hidden name
                            }
                        } else {
                            // Player ID from storage not found, reset this slot
                            console.warn(`Player ID ${playerId} from localStorage not found in current player list for slot ${index}. Resetting.`);
                            selectedPlayerIds[index] = null;
                            selectedPlayerNames[index] = null;
                            if (displayDiv && idInput && nameInput) {
                                displayDiv.textContent = '-- Select Player --';
                                displayDiv.classList.remove('player-selected');
                                idInput.value = '';
                                nameInput.value = '';
                            }
                        }
                    } else {
                        // Slot was null in storage
                        selectedPlayerNames[index] = null;
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
        }
    } catch (e) {
        console.error("Error loading selected players from localStorage:", e);
        localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear potentially corrupted data
    }
}


// --- Fonctions Stamina (calcul, timers) ---
// Calcule la stamina actuelle côté client (similaire au backend)
function calculateCurrentStamina(playerData) {
    if (!playerData || typeof playerData.stamina !== 'number') return 0; // Guard clause
    if (!playerData.staminaLastUpdated) return playerData.stamina; // Si pas de date, retourne la valeur brute

    const lastUpdated = new Date(playerData.staminaLastUpdated);
    const now = new Date();
    if (isNaN(lastUpdated.getTime())) return playerData.stamina; // Date invalide

    const minutesPassed = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60));
    if (minutesPassed < 0) return Math.min(MAX_STAMINA, playerData.stamina); // Horloge désynchronisée

    const regeneratedStamina = Math.floor(minutesPassed / STAMINA_REGEN_RATE_MINUTES);
    return Math.min(MAX_STAMINA, playerData.stamina + regeneratedStamina);
}

// Arrête le timer d'un slot
function stopStaminaTimer(index) {
    if (staminaIntervals[index]) {
        clearInterval(staminaIntervals[index]);
        staminaIntervals[index] = null;
    }
}

// Démarre/Met à jour le timer d'affichage pour un slot
function startStaminaTimer(index) {
    stopStaminaTimer(index); // Arrêter l'ancien timer s'il existe

    const playerData = playerQuestData[index];
    // Ne pas démarrer si pas de données valides ou si stamina max
    if (!playerData || !playerData.staminaLastUpdated || calculateCurrentStamina(playerData) >= MAX_STAMINA) {
        updateStaminaDisplay(index); // Mettre à jour une dernière fois (pour afficher max ou 0 si pas de data)
        return;
    }

    const updateDisplay = () => {
        const currentStamina = calculateCurrentStamina(playerData);
        updateStaminaDisplay(index, currentStamina);

        if (currentStamina >= MAX_STAMINA) {
            stopStaminaTimer(index); // Arrêter quand max atteint
        }
    };

    staminaIntervals[index] = setInterval(updateDisplay, 1000); // Met à jour toutes les secondes
    updateDisplay(); // Appel initial
}

// Met à jour les éléments d'affichage de la stamina et du timer
function updateStaminaDisplay(index, currentStaminaOverride = null) {
    const playerData = playerQuestData[index];
    const currentStamina = currentStaminaOverride !== null ? currentStaminaOverride : calculateCurrentStamina(playerData);

    const currentStaminaDisplay = document.getElementById(`dq-stamina-current-${index}`);
    const currentStaminaInput = document.getElementById(`dq-stamina-input-${index}`);
    const minutesInputElement = document.getElementById(`dq-stamina-next-input-${index}`);
    const secondsInputElement = document.getElementById(`dq-stamina-next-seconds-input-${index}`);

    if (currentStaminaDisplay) currentStaminaDisplay.textContent = currentStamina;

    // Mettre à jour l'input QUE s'il n'a pas le focus
    if (currentStaminaInput && document.activeElement !== currentStaminaInput) {
        currentStaminaInput.value = currentStamina;
    }

    // Calculer et mettre à jour le temps restant
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
                secondsRemainingValue = (secondsRemainingValue < 10) ? `0${secondsRemainingValue}` : secondsRemainingValue.toString();
                if (minutesRemainingValue === 0 && secondsRemainingValue === '00' && msRemaining > 0 && totalSecondsRemaining === 0) {
                    secondsRemainingValue = '00'; // Keep 00 if exactly at the turn
                } else if (minutesRemainingValue === 0 && secondsRemainingValue === '0' && msRemaining <= 0) {
                    secondsRemainingValue = ''; // Clear if time passed
                    minutesRemainingValue = '';
                }

            }
        }
    }

    // Mettre à jour les inputs de temps QUE s'ils n'ont pas le focus
    if (minutesInputElement && document.activeElement !== minutesInputElement) {
        minutesInputElement.value = minutesRemainingValue;
    }
    if (secondsInputElement && document.activeElement !== secondsInputElement) {
        secondsInputElement.value = secondsRemainingValue;
    }
}


// --- Sélection de Joueur (Callback pour la modale) ---
// Fonction appelée par le module de modale lorsqu'un joueur est sélectionné
function setSelectedPlayer(playerId, playerName, triggerContext) {
    const index = triggerContext?.index; // Récupérer l'index depuis le contexte

    if (typeof index !== 'number' || index < 0 || index > 2) {
        console.error("Invalid index received from player select modal:", index);
        return; // Ne rien faire si l'index est invalide
    }

    // Vérifier si le joueur sélectionné est différent de celui actuel
    if (selectedPlayerIds[index] !== playerId) {
        stopStaminaTimer(index); // Arrêter l'ancien timer si le joueur change
        playerQuestData[index] = null; // Réinitialiser les données locales immédiatement

        // **MISE A JOUR IMPORTANTE**: Mettre à jour selectedPlayerIds et selectedPlayerNames AVANT fetch/render
        selectedPlayerIds[index] = playerId;
        selectedPlayerNames[index] = playerName;

        // Mettre à jour l'affichage immédiatement pour montrer la sélection
        const displayDiv = document.getElementById(`dq-player-display-${index}`);
        const idInput = document.getElementById(`dq-player-id-hidden-${index}`);
        const nameInput = document.getElementById(`dq-player-name-hidden-${index}`);
        if (displayDiv && idInput && nameInput) {
            if (playerId !== null && playerName !== null) {
                displayDiv.textContent = playerName;
                displayDiv.classList.add('player-selected');
                idInput.value = playerId;
                nameInput.value = playerName;
            } else { // Cas où on désélectionne
                displayDiv.textContent = '-- Select Player --';
                displayDiv.classList.remove('player-selected');
                idInput.value = '';
                nameInput.value = '';
            }
        }

        saveSelectedPlayersToLocalStorage(); // Sauvegarder la nouvelle sélection

        // Redessiner immédiatement pour afficher "Loading..." ou le slot vide
        renderQuestColumns();

        // Lancer le fetch des données pour tous les joueurs sélectionnés (mettra à jour la colonne une fois terminé)
        fetchAndUpdatePlayerData();
    }
}


// --- Fonctions d'Affichage ---
// Redessine les colonnes de quêtes en fonction des joueurs sélectionnés
function renderQuestColumns() {
    if (!container) return;
    const isMobile = window.innerWidth <= 768;

    // **MODIFICATION**: Toujours considérer les 3 slots potentiels pour le rendu
    // C'est le CSS et la logique ci-dessous qui cachent/affichent
    const indicesToConsider = [0, 1, 2];

    // Déterminer quels indices sont *actifs* (ont un joueur sélectionné)
    const activePlayerIndices = selectedPlayerIds
        .map((id, index) => (id !== null ? index : -1))
        .filter(index => index !== -1);

    // Déterminer quels indices afficher réellement (1 sur mobile, tous les actifs sur desktop)
    const indicesToRender = isMobile ? activePlayerIndices.slice(0, 1) : activePlayerIndices;

    const columnsToShowCount = indicesToRender.length; // Combien de colonnes auront du contenu

    // S'il n'y a AUCUN joueur sélectionné (même sur desktop), afficher le placeholder
    if (activePlayerIndices.length === 0) {
        container.innerHTML = `<div class="dq-placeholder">Select ${isMobile ? 'a player' : 'up to 3 players'} to track daily quests.</div>`;
        container.className = 'daily-quests-container';
        return;
    }

    container.innerHTML = ''; // Vider le conteneur

    // Appliquer la classe CSS pour le nombre de colonnes *visibles*
    container.className = `daily-quests-container columns-${columnsToShowCount}`;

    // Itérer sur les 3 slots potentiels
    indicesToConsider.forEach(index => {
        // Ne rendre la colonne que si elle fait partie des indices à afficher
        if (!indicesToRender.includes(index)) {
            // On pourrait ajouter un élément vide pour garder la structure grid, mais c'est géré par le CSS columns-X
            return;
        }

        const playerId = selectedPlayerIds[index]; // Peut être null si on arrive ici d'une manière détournée
        const data = playerQuestData[index];
        const playerColumn = document.createElement('div');
        playerColumn.className = 'dq-player-column';
        // Garder playerId et index même si null/undefined pour référence
        playerColumn.dataset.playerId = playerId ?? '';
        playerColumn.dataset.index = index;

        const playerName = selectedPlayerNames[index] || `Player ${index + 1}`; // Utiliser le nom stocké

        // Si playerId existe (donc joueur sélectionné) mais data est null (chargement ou erreur)
        if (playerId !== null && !data) {
            playerColumn.innerHTML = `<h3>${playerName}</h3><p style="text-align: center; font-style: italic;">Loading data...</p>`;
        }
        // Si playerId est null (ne devrait pas arriver ici, mais sécurité)
        else if (playerId === null) {
            playerColumn.innerHTML = `<h3>Player ${index + 1}</h3><p style="text-align: center;">Select a player.</p>`;
        }
        // Si data existe
        else if (data) {
            const currentStamina = calculateCurrentStamina(data);
            let questsHtml = questListDefinition.map(quest => {
                const isCompleted = Array.isArray(data.completedQuests) && data.completedQuests.includes(quest.key);
                return `<li><input type="checkbox" id="quest-${playerId}-${quest.key}" class="dq-quest-checkbox" data-player-id="${playerId}" data-quest-key="${quest.key}" ${isCompleted ? 'checked' : ''}><label for="quest-${playerId}-${quest.key}">${quest.label}</label></li>`;
            }).join('');
            if (!questsHtml) questsHtml = '<li>Quest list unavailable.</li>';

            playerColumn.innerHTML = `
                <h3>${data.name}</h3>
                <div class="dq-stamina-section">
                    <label for="dq-stamina-input-${index}">Stamina:</label>
                    <input type="number" id="dq-stamina-input-${index}" class="dq-stamina-input" min="0" max="${MAX_STAMINA}" value="${currentStamina}" data-index="${index}" autocomplete="off">
                    <div class="dq-stamina-display-group">
                        <span class="dq-stamina-current" id="dq-stamina-current-${index}">${currentStamina}</span><span class="dq-stamina-separator">/</span><span class="dq-stamina-max">${MAX_STAMINA}</span>
                    </div>
                    <div class="dq-stamina-timer-group">
                        <label for="dq-stamina-next-input-${index}">Next in:</label>
                        <input type="number" id="dq-stamina-next-input-${index}" class="dq-stamina-next-input" min="0" max="${STAMINA_REGEN_RATE_MINUTES - 1}" placeholder="min" data-index="${index}" value="" autocomplete="off"><span>min</span>
                        <input type="number" id="dq-stamina-next-seconds-input-${index}" class="dq-stamina-next-seconds-input" min="0" max="59" placeholder="sec" data-index="${index}" value="" autocomplete="off"><span>sec</span>
                    </div>
                </div>
                <ul class="dq-quest-list">${questsHtml}</ul>`;

            // Démarrer le timer SEULEMENT si la colonne est entièrement rendue avec succès
            setTimeout(() => startStaminaTimer(index), 0); // léger délai pour s'assurer que le DOM est prêt
        }

        container.appendChild(playerColumn); // Ajouter la colonne (même si c'est "Loading...")
    });

    attachEventListeners(); // (Ré)attacher les listeners
}


// --- Logique de Récupération et Mise à jour des Données ---
// Fonction pour fetch les données de tous les joueurs sélectionnés
async function fetchAndUpdatePlayerData() {
    const idsToFetch = selectedPlayerIds.filter(id => id !== null);
    if (idsToFetch.length === 0) {
        // Pas besoin de fetch, juste s'assurer que l'affichage est propre
        playerQuestData = [null, null, null]; // Réinitialiser les données
        renderQuestColumns();
        return;
    }

    try {
        const response = await fetch(`/daily-quests/status?playerIds=${idsToFetch.join(',')}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        questListDefinition = data.questsList || [];

        // Mettre à jour les données locales pour chaque joueur
        selectedPlayerIds.forEach((playerId, index) => {
            if (playerId !== null) {
                const playerResult = data.players.find(p => p.playerId === playerId);
                playerQuestData[index] = playerResult ? { ...playerResult } : null; // Garder null si non trouvé
                if (!playerResult) {
                    console.warn(`[DQ Fetch] Data for player ID ${playerId} not found in API response.`);
                    // Mettre à jour le nom si jamais il avait changé entretemps (peu probable mais possible)
                    const updatedPlayerInfo = allPlayersForModal.find(p => p.id === playerId);
                    if (updatedPlayerInfo) selectedPlayerNames[index] = updatedPlayerInfo.name;
                } else {
                    // Assurer la cohérence du nom affiché avec les données reçues
                    selectedPlayerNames[index] = playerResult.name;
                }
            } else {
                playerQuestData[index] = null; // Réinitialiser si l'ID est null
            }
        });

    } catch (error) {
        console.error('Error fetching daily quest status:', error);
        selectedPlayerIds.forEach((playerId, index) => {
            if (playerId !== null && idsToFetch.includes(playerId)) {
                playerQuestData[index] = null; // Marquer comme échec
            }
        });
    } finally {
        renderQuestColumns(); // Redessiner avec les nouvelles données ou l'état d'erreur/chargement
    }
}

// Met à jour le statut d'une quête côté serveur
async function updateQuestStatus(playerId, questKey, completed) {
    try {
        const response = await fetch('/daily-quests/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, questKey, completed }),
        });
        if (!response.ok) throw new Error('Failed to update quest status');
        // Optionnel: Mettre à jour localement pour réactivité ?
        const playerIndex = selectedPlayerIds.indexOf(playerId);
        if (playerIndex !== -1 && playerQuestData[playerIndex]) {
            if (completed) {
                if (!playerQuestData[playerIndex].completedQuests.includes(questKey)) {
                    playerQuestData[playerIndex].completedQuests.push(questKey);
                }
            } else {
                playerQuestData[playerIndex].completedQuests = playerQuestData[playerIndex].completedQuests.filter(q => q !== questKey);
            }
            // Pas besoin de re-render juste pour ça, le checkbox est déjà visuellement à jour.
        }

    } catch (error) {
        console.error('Error updating quest status:', error);
        alert('Failed to update quest. Please try again.');
        const checkbox = document.getElementById(`quest-${playerId}-${questKey}`);
        if (checkbox) checkbox.checked = !completed;
    }
}

// Met à jour la stamina/timer côté serveur
async function updateStaminaValue(index, staminaInputElement, minutesInputElement = null, secondsInputElement = null) {
    const playerId = selectedPlayerIds[index];
    if (!playerId || !staminaInputElement) return;

    const staminaValue = parseInt(staminaInputElement.value, 10);
    const minutesValue = (minutesInputElement && minutesInputElement.value !== '') ? parseInt(minutesInputElement.value, 10) : null;
    const secondsValue = (secondsInputElement && secondsInputElement.value !== '') ? parseInt(secondsInputElement.value, 10) : null;

    // --- Validation ---
    if (isNaN(staminaValue) || staminaValue < 0 || staminaValue > MAX_STAMINA) {
        alert(`Invalid stamina value (${staminaValue}). Must be between 0 and ${MAX_STAMINA}.`);
        fetchAndUpdatePlayerData();
        return;
    }
    if (minutesValue !== null && (isNaN(minutesValue) || minutesValue < 0 || minutesValue >= STAMINA_REGEN_RATE_MINUTES)) {
        alert(`Invalid minutes value (${minutesValue}). Must be between 0 and ${STAMINA_REGEN_RATE_MINUTES - 1}.`);
        fetchAndUpdatePlayerData(); return;
    }
    if (secondsValue !== null && (isNaN(secondsValue) || secondsValue < 0 || secondsValue > 59)) {
        alert(`Invalid seconds value (${secondsValue}). Must be between 0 and 59.`);
        fetchAndUpdatePlayerData(); return;
    }
    if (minutesValue === null && secondsValue !== null && secondsValue !== 0) {
        alert(`Cannot set only seconds remaining (unless it's 0). Please also specify minutes or clear seconds.`);
        fetchAndUpdatePlayerData(); return;
    }
    // --- Fin Validation ---

    stopStaminaTimer(index); // Arrêter le timer local pendant la mise à jour serveur

    try {
        const response = await fetch('/daily-quests/update-stamina', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerId,
                stamina: staminaValue,
                minutesUntilNext: minutesValue,
                secondsUntilNext: secondsValue
            }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update stamina on server');
        }
        const updatedData = await response.json();

        // Mettre à jour les données locales avec la réponse du serveur
        if (playerQuestData[index]) {
            playerQuestData[index].stamina = updatedData.stamina;
            playerQuestData[index].staminaLastUpdated = updatedData.staminaLastUpdated;
        } else {
            // Si les données locales n'existaient pas, on doit refetch
            fetchAndUpdatePlayerData();
            return;
        }

        // Redémarrer le timer local avec les nouvelles données confirmées
        startStaminaTimer(index);

    } catch (error) {
        console.error('Error updating stamina:', error);
        alert(`Failed to update stamina: ${error.message}. Reloading data from server.`);
        fetchAndUpdatePlayerData(); // Re-fetch pour resynchroniser en cas d'échec
    }
}


// --- Écouteurs d'Événements ---
// Attache les listeners aux checkboxes et inputs après chaque rendu
function attachEventListeners() {
    const activeColumns = container.querySelectorAll('.dq-player-column');

    activeColumns.forEach(column => {
        const index = parseInt(column.dataset.index, 10);
        if (isNaN(index)) return; // Skip if index is invalid

        // Checkboxes
        column.querySelectorAll('.dq-quest-checkbox').forEach(checkbox => {
            const clone = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(clone, checkbox);
            clone.addEventListener('change', handleQuestChange);
        });

        // Stamina Input
        const staminaInput = column.querySelector(`#dq-stamina-input-${index}`);
        if (staminaInput) {
            let debounceTimer;
            const clone = staminaInput.cloneNode(true);
            staminaInput.parentNode.replaceChild(clone, staminaInput);
            clone.addEventListener('input', (event) => { debounceTimer = handleStaminaInput(event, debounceTimer); });
            clone.addEventListener('change', (event) => { debounceTimer = handleStaminaChangeOrBlur(event, debounceTimer); });
            clone.addEventListener('blur', (event) => { debounceTimer = handleStaminaChangeOrBlur(event, debounceTimer); });
        }

        // Minutes Input
        const minutesInput = column.querySelector(`#dq-stamina-next-input-${index}`);
        if (minutesInput) {
            let debounceTimer;
            const clone = minutesInput.cloneNode(true);
            minutesInput.parentNode.replaceChild(clone, minutesInput);
            clone.addEventListener('input', (event) => { debounceTimer = handleStaminaNextInput(event, debounceTimer); });
            clone.addEventListener('change', (event) => { debounceTimer = handleStaminaNextChangeOrBlur(event, debounceTimer); });
            clone.addEventListener('blur', (event) => { debounceTimer = handleStaminaNextChangeOrBlur(event, debounceTimer); });
        }

        // Seconds Input
        const secondsInput = column.querySelector(`#dq-stamina-next-seconds-input-${index}`);
        if (secondsInput) {
            let debounceTimer;
            const clone = secondsInput.cloneNode(true);
            secondsInput.parentNode.replaceChild(clone, secondsInput);
            clone.addEventListener('input', (event) => { debounceTimer = handleStaminaNextSecondsInput(event, debounceTimer); });
            clone.addEventListener('change', (event) => { debounceTimer = handleStaminaNextSecondsChangeOrBlur(event, debounceTimer); });
            clone.addEventListener('blur', (event) => { debounceTimer = handleStaminaNextSecondsChangeOrBlur(event, debounceTimer); });
        }
    });
}


// --- Gestionnaires d'Événements ---
function handleQuestChange(event) {
    const checkbox = event.target;
    const playerId = parseInt(checkbox.dataset.playerId, 10);
    const questKey = checkbox.dataset.questKey;
    const completed = checkbox.checked;
    updateQuestStatus(playerId, questKey, completed);
}
function handleStaminaInput(event, debounceTimer) {
    clearTimeout(debounceTimer);
    const target = event.target;
    const value = parseInt(target.value, 10);
    if (isNaN(value) || value < 0 || value > MAX_STAMINA) {
        target.style.borderColor = 'red';
    } else {
        target.style.borderColor = '';
    }
    const newTimer = setTimeout(() => {
        if (!isNaN(value) && value >= 0 && value <= MAX_STAMINA) {
            const index = parseInt(target.dataset.index, 10);
            const minutesInput = document.getElementById(`dq-stamina-next-input-${index}`);
            const secondsInput = document.getElementById(`dq-stamina-next-seconds-input-${index}`);
            updateStaminaValue(index, target, minutesInput, secondsInput);
        } else {
            console.warn("Debounced stamina update skipped due to invalid value:", target.value);
        }
    }, 1200);
    return newTimer;
}
function handleStaminaChangeOrBlur(event, debounceTimer) {
    clearTimeout(debounceTimer);
    const target = event.target;
    target.style.borderColor = '';
    const index = parseInt(target.dataset.index, 10);
    const minutesInput = document.getElementById(`dq-stamina-next-input-${index}`);
    const secondsInput = document.getElementById(`dq-stamina-next-seconds-input-${index}`);
    updateStaminaValue(index, target, minutesInput, secondsInput);
    return null;
}
function handleStaminaNextInput(event, debounceTimer) {
    clearTimeout(debounceTimer);
    const target = event.target;
    const value = parseInt(target.value, 10);
    const index = parseInt(target.dataset.index, 10);
    if (target.value !== '' && (isNaN(value) || value < 0 || value >= STAMINA_REGEN_RATE_MINUTES)) {
        target.style.borderColor = 'red';
    } else {
        target.style.borderColor = '';
    }
    const newTimer = setTimeout(() => {
        if (target.value === '' || (!isNaN(value) && value >= 0 && value < STAMINA_REGEN_RATE_MINUTES)) {
            const staminaInput = document.getElementById(`dq-stamina-input-${index}`);
            const secondsInput = document.getElementById(`dq-stamina-next-seconds-input-${index}`);
            updateStaminaValue(index, staminaInput, target, secondsInput);
        } else { console.warn("Debounced timer update skipped due to invalid minutes:", target.value); }
    }, 1200);
    return newTimer;
}
function handleStaminaNextChangeOrBlur(event, debounceTimer) {
    clearTimeout(debounceTimer);
    const target = event.target;
    target.style.borderColor = '';
    const index = parseInt(target.dataset.index, 10);
    const staminaInput = document.getElementById(`dq-stamina-input-${index}`);
    const secondsInput = document.getElementById(`dq-stamina-next-seconds-input-${index}`);
    updateStaminaValue(index, staminaInput, target, secondsInput);
    return null;
}
function handleStaminaNextSecondsInput(event, debounceTimer) {
    clearTimeout(debounceTimer);
    const target = event.target;
    const value = parseInt(target.value, 10);
    const index = parseInt(target.dataset.index, 10);
    if (target.value !== '' && (isNaN(value) || value < 0 || value > 59)) {
        target.style.borderColor = 'red';
    } else {
        target.style.borderColor = '';
    }
    const newTimer = setTimeout(() => {
        if (target.value === '' || (!isNaN(value) && value >= 0 && value <= 59)) {
            const staminaInput = document.getElementById(`dq-stamina-input-${index}`);
            const minutesInput = document.getElementById(`dq-stamina-next-input-${index}`);
            updateStaminaValue(index, staminaInput, minutesInput, target);
        } else { console.warn("Debounced timer update skipped due to invalid seconds:", target.value); }
    }, 1200);
    return newTimer;
}
function handleStaminaNextSecondsChangeOrBlur(event, debounceTimer) {
    clearTimeout(debounceTimer);
    const target = event.target;
    target.style.borderColor = '';
    const index = parseInt(target.dataset.index, 10);
    const staminaInput = document.getElementById(`dq-stamina-input-${index}`);
    const minutesInput = document.getElementById(`dq-stamina-next-input-${index}`);
    updateStaminaValue(index, staminaInput, minutesInput, target);
    return null;
}


// --- Initialisation du module ---
export function initDailyQuests() {
    if (!container || !playerSelectorUIs || playerSelectorUIs.length !== 3) {
        console.error('Daily Quests container or player selectors not found/incomplete.');
        return;
    }

    loadSelectedPlayersFromLocalStorage(); // Charger les joueurs sauvegardés

    // Fonction pour gérer l'affichage responsive et le rendu initial/maj
    const handleResizeOrLoad = () => {
        const isMobile = window.innerWidth <= 768;
        playerSelectorUIs.forEach((ui, index) => {
            const group = ui.closest('.player-selector-group');
            if (group) {
                group.style.display = (index > 0 && isMobile) ? 'none' : '';
            }
        });
        renderQuestColumns(); // Redessiner pour appliquer la logique mobile/desktop
    };

    window.addEventListener('resize', handleResizeOrLoad);

    // Attacher les listeners pour ouvrir la modale
    playerSelectorUIs.forEach((ui, index) => {
        const button = ui.querySelector('.dq-open-modal-btn');
        const display = ui.querySelector('.dq-player-name-display');
        const triggerFn = () => {
            openPlayerSelectModal(
                {
                    type: 'dailyQuest',
                    index: index,
                    allowCreation: false,
                    allSelectedIds: [...selectedPlayerIds]
                },
                setSelectedPlayer
            );
        };
        if (button) button.addEventListener('click', triggerFn);
        if (display) display.addEventListener('click', triggerFn);
    });

    // Fetch initial des données et premier rendu
    fetchAndUpdatePlayerData().then(() => {
        // handleResizeOrLoad est appelé dans le finally de fetchAndUpdatePlayerData via renderQuestColumns
        console.log("Daily Quests initialized.");
    });
}