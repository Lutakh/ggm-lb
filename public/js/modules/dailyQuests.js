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
        playerQuestData[index] = null; // Réinitialiser les données pour forcer le re-fetch
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
            } else { // Cas où on désélectionne (même si la modale ne le permet pas vraiment)
                displayDiv.textContent = '-- Select Player --';
                displayDiv.classList.remove('player-selected');
                idInput.value = '';
                nameInput.value = '';
            }
        }
        selectedPlayerIds[index] = playerId;
        selectedPlayerNames[index] = playerName; // Mettre à jour le nom aussi
        saveSelectedPlayersToLocalStorage(); // Sauvegarder la nouvelle sélection
        fetchAndUpdatePlayerData(); // Lancer le fetch des données pour tous les joueurs sélectionnés
    }
}


// --- Fonctions d'Affichage ---
// Redessine les colonnes de quêtes en fonction des joueurs sélectionnés
function renderQuestColumns() {
    if (!container) return;
    const activePlayersIndices = selectedPlayerIds.map((id, index) => id ? index : -1).filter(index => index !== -1);
    const isMobile = window.innerWidth <= 768;
    // Sur mobile, on affiche seulement le premier joueur sélectionné, sinon tous les joueurs sélectionnés
    const indicesToRender = isMobile ? activePlayersIndices.slice(0, 1) : activePlayersIndices;
    const columnsToShow = indicesToRender.length;

    // Afficher un placeholder si aucun joueur n'est sélectionné (ou visible sur mobile)
    if (columnsToShow === 0) {
        container.innerHTML = `<div class="dq-placeholder">Select ${isMobile ? 'a player' : 'up to 3 players'} to track daily quests.</div>`;
        container.className = 'daily-quests-container'; // Classe par défaut
        return;
    }

    container.innerHTML = ''; // Vider le conteneur
    // Appliquer la classe CSS pour le nombre de colonnes
    container.className = `daily-quests-container columns-${columnsToShow}`;

    // Créer une colonne pour chaque joueur à afficher
    indicesToRender.forEach(index => {
        const playerId = selectedPlayerIds[index];
        const data = playerQuestData[index]; // Données fetchées pour ce joueur
        const playerColumn = document.createElement('div');
        playerColumn.className = 'dq-player-column';
        playerColumn.dataset.playerId = playerId;
        playerColumn.dataset.index = index;

        // Si pas de données pour ce joueur (fetch échoué ou en cours), afficher un message d'erreur/chargement
        // CORRECTION: Utiliser selectedPlayerNames pour afficher le nom même si les données ne sont pas encore chargées
        const playerName = selectedPlayerNames[index] || `Player ${index + 1}`;
        if (!data) {
            playerColumn.classList.add('dq-error-column'); // Style d'erreur
            playerColumn.innerHTML = `<h3>${playerName}</h3><p>Could not load data for player.</p>`; // Message d'erreur
            container.appendChild(playerColumn);
            return; // Passer au joueur suivant
        }

        // Si les données sont là, construire la colonne
        const currentStamina = calculateCurrentStamina(data); // Recalculer ici pour être sûr

        // Construire la liste des quêtes HTML
        let questsHtml = questListDefinition.map(quest => {
            const isCompleted = Array.isArray(data.completedQuests) && data.completedQuests.includes(quest.key);
            return `
                <li>
                    <input type="checkbox" id="quest-${playerId}-${quest.key}" class="dq-quest-checkbox" data-player-id="${playerId}" data-quest-key="${quest.key}" ${isCompleted ? 'checked' : ''}>
                    <label for="quest-${playerId}-${quest.key}">${quest.label}</label>
                </li>`;
        }).join('');
        if (!questsHtml) questsHtml = '<li>Quest list unavailable.</li>';


        // Remplir le HTML de la colonne
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
                            min="0" max="${STAMINA_REGEN_RATE_MINUTES - 1}" placeholder="min" data-index="${index}" value="" autocomplete="off">
                     <span>min</span>
                     <input type="number" id="dq-stamina-next-seconds-input-${index}" class="dq-stamina-next-seconds-input"
                            min="0" max="59" placeholder="sec" data-index="${index}" value="" autocomplete="off">
                      <span>sec</span>
                </div>
            </div>
            <ul class="dq-quest-list">
                ${questsHtml}
            </ul>
        `;

        container.appendChild(playerColumn); // Ajouter la colonne au conteneur
        startStaminaTimer(index); // Démarrer le timer d'affichage pour cette colonne
    });

    attachEventListeners(); // (Ré)attacher les listeners après avoir modifié le DOM
}


// --- Logique de Récupération et Mise à jour des Données ---
// Fonction pour fetch les données de tous les joueurs sélectionnés
async function fetchAndUpdatePlayerData() {
    const idsToFetch = selectedPlayerIds.filter(id => id !== null);
    if (idsToFetch.length === 0) {
        renderQuestColumns(); // Afficher le placeholder s'il n'y a personne à fetch
        return;
    }

    // console.log(`[DQ Fetch] Fetching data for IDs: ${idsToFetch.join(',')}`);
    try {
        const response = await fetch(`/daily-quests/status?playerIds=${idsToFetch.join(',')}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        // console.log("[DQ Fetch] Received data:", data); // Debug Log

        questListDefinition = data.questsList || []; // Mettre à jour la définition des quêtes

        // Mettre à jour les données locales pour chaque joueur
        selectedPlayerIds.forEach((playerId, index) => {
            if (playerId !== null) {
                const playerResult = data.players.find(p => p.playerId === playerId);
                // CORRECTION: S'assurer que playerResult existe avant de l'assigner
                playerQuestData[index] = playerResult ? { ...playerResult } : null; // Stocker null si non trouvé
                if (!playerResult) {
                    console.warn(`[DQ Fetch] Data for player ID ${playerId} not found in API response.`);
                }
            } else {
                playerQuestData[index] = null; // Réinitialiser si l'ID est null
            }
        });

    } catch (error) {
        console.error('Error fetching daily quest status:', error);
        // En cas d'erreur, on pourrait réinitialiser toutes les données ?
        // playerQuestData = [null, null, null];
        container.innerHTML = '<div class="dq-error">Failed to load quest data. Please try refreshing.</div>';
    } finally {
        renderQuestColumns(); // Redessiner avec les nouvelles données (ou l'erreur)
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
        // Optionnel: Mettre à jour localement ou refetch pour confirmer
        // console.log(`Quest ${questKey} for player ${playerId} updated to ${completed}`);
    } catch (error) {
        console.error('Error updating quest status:', error);
        alert('Failed to update quest. Please try again.');
        // Revert checkbox state visually on error?
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

    // --- Validation (plus stricte) ---
    if (isNaN(staminaValue) || staminaValue < 0 || staminaValue > MAX_STAMINA) {
        alert(`Invalid stamina value (${staminaValue}). Must be between 0 and ${MAX_STAMINA}.`);
        // Revert input visuel ? Ou appeler fetchAndUpdatePlayerData() pour resynchroniser ?
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
    // Si seule la seconde est entrée, elle doit être 0 si minutes est null
    if (minutesValue === null && secondsValue !== null && secondsValue !== 0) {
        alert(`Cannot set only seconds remaining (unless it's 0). Please also specify minutes or clear seconds.`);
        fetchAndUpdatePlayerData(); return;
    }
    // --- Fin Validation ---

    stopStaminaTimer(index); // Arrêter le timer local pendant la mise à jour serveur

    try {
        // console.log(`[DQ Update Stamina] Sending update for player ${playerId}: Stamina=${staminaValue}, Min=${minutesValue}, Sec=${secondsValue}`);
        const response = await fetch('/daily-quests/update-stamina', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerId,
                stamina: staminaValue,
                minutesUntilNext: minutesValue, // Envoyer null si non défini
                secondsUntilNext: secondsValue  // Envoyer null si non défini
            }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update stamina on server');
        }
        const updatedData = await response.json();
        // console.log("[DQ Update Stamina] Received confirmation:", updatedData);

        // Mettre à jour les données locales avec la réponse du serveur
        if (playerQuestData[index]) {
            playerQuestData[index].stamina = updatedData.stamina; // Utiliser la stamina confirmée
            playerQuestData[index].staminaLastUpdated = updatedData.staminaLastUpdated; // Utiliser le timestamp recalculé par le serveur
        } else {
            // Si les données locales n'existaient pas, on doit refetch pour avoir le nom etc.
            fetchAndUpdatePlayerData(); // Moins idéal mais assure la cohérence
            return; // Sortir car fetchAndUpdatePlayerData redessinera et relancera le timer
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
    const questCheckboxes = container.querySelectorAll('.dq-quest-checkbox');
    questCheckboxes.forEach(checkbox => {
        // Simple écouteur de 'change'
        checkbox.addEventListener('change', handleQuestChange);
    });

    const staminaInputs = container.querySelectorAll('.dq-stamina-input');
    staminaInputs.forEach(input => {
        let debounceTimer; // Timer spécifique à cet input
        // 'input' pour une validation visuelle rapide + debounce léger
        input.addEventListener('input', (event) => { debounceTimer = handleStaminaInput(event, debounceTimer); });
        // 'change' et 'blur' pour déclencher la sauvegarde serveur
        input.addEventListener('change', (event) => { debounceTimer = handleStaminaChangeOrBlur(event, debounceTimer); });
        input.addEventListener('blur', (event) => { debounceTimer = handleStaminaChangeOrBlur(event, debounceTimer); });
    });

    const staminaNextInputs = container.querySelectorAll('.dq-stamina-next-input'); // Minutes
    staminaNextInputs.forEach(input => {
        let debounceTimer;
        input.addEventListener('input', (event) => { debounceTimer = handleStaminaNextInput(event, debounceTimer); });
        input.addEventListener('change', (event) => { debounceTimer = handleStaminaNextChangeOrBlur(event, debounceTimer); });
        input.addEventListener('blur', (event) => { debounceTimer = handleStaminaNextChangeOrBlur(event, debounceTimer); });
    });

    const staminaNextSecondsInputs = container.querySelectorAll('.dq-stamina-next-seconds-input'); // Seconds
    staminaNextSecondsInputs.forEach(input => {
        let debounceTimer;
        input.addEventListener('input', (event) => { debounceTimer = handleStaminaNextSecondsInput(event, debounceTimer); });
        input.addEventListener('change', (event) => { debounceTimer = handleStaminaNextSecondsChangeOrBlur(event, debounceTimer); });
        input.addEventListener('blur', (event) => { debounceTimer = handleStaminaNextSecondsChangeOrBlur(event, debounceTimer); });
    });
}

// --- Gestionnaires d'Événements ---
// Gère le changement d'état d'une checkbox de quête
function handleQuestChange(event) {
    const checkbox = event.target;
    const playerId = parseInt(checkbox.dataset.playerId, 10);
    const questKey = checkbox.dataset.questKey;
    const completed = checkbox.checked;
    updateQuestStatus(playerId, questKey, completed);
}

// Gère la saisie dans l'input de stamina (validation visuelle + debounce)
function handleStaminaInput(event, debounceTimer) {
    clearTimeout(debounceTimer);
    const target = event.target;
    const value = parseInt(target.value, 10);
    // Validation visuelle simple (ex: bordure rouge si invalide)
    if (isNaN(value) || value < 0 || value > MAX_STAMINA) {
        target.style.borderColor = 'red';
    } else {
        target.style.borderColor = ''; // Réinitialiser
    }
    // Redémarrer le timer debounce
    const newTimer = setTimeout(() => {
        // Appeler la mise à jour serveur SEULEMENT si la valeur est valide
        if (!isNaN(value) && value >= 0 && value <= MAX_STAMINA) {
            const index = parseInt(target.dataset.index, 10);
            const minutesInput = document.getElementById(`dq-stamina-next-input-${index}`);
            const secondsInput = document.getElementById(`dq-stamina-next-seconds-input-${index}`);
            updateStaminaValue(index, target, minutesInput, secondsInput);
        } else {
            console.warn("Debounced stamina update skipped due to invalid value:", target.value);
            // Optionnel : Forcer une resynchronisation si l'utilisateur laisse une valeur invalide ?
            // const index = parseInt(target.dataset.index, 10);
            // startStaminaTimer(index); // Pour remettre la valeur correcte calculée
        }
    }, 1200); // Délai avant sauvegarde auto
    return newTimer; // Renvoyer le nouvel ID du timer
}

// Gère 'change' ou 'blur' sur l'input de stamina (sauvegarde immédiate)
function handleStaminaChangeOrBlur(event, debounceTimer) {
    clearTimeout(debounceTimer); // Annuler le debounce s'il était en cours
    const target = event.target;
    target.style.borderColor = ''; // Enlever la bordure rouge potentielle
    const index = parseInt(target.dataset.index, 10);
    const minutesInput = document.getElementById(`dq-stamina-next-input-${index}`);
    const secondsInput = document.getElementById(`dq-stamina-next-seconds-input-${index}`);
    updateStaminaValue(index, target, minutesInput, secondsInput); // Appeler la sauvegarde serveur
    return null; // Indiquer qu'il n'y a plus de timer debounce actif
}

// Gère la saisie dans l'input des minutes restantes
function handleStaminaNextInput(event, debounceTimer) {
    clearTimeout(debounceTimer);
    const target = event.target;
    const value = parseInt(target.value, 10);
    const index = parseInt(target.dataset.index, 10);
    // Validation visuelle
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

// Gère 'change' ou 'blur' sur l'input des minutes restantes
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

// Gère la saisie dans l'input des secondes restantes
function handleStaminaNextSecondsInput(event, debounceTimer) {
    clearTimeout(debounceTimer);
    const target = event.target;
    const value = parseInt(target.value, 10);
    const index = parseInt(target.dataset.index, 10);
    // Validation visuelle
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

// Gère 'change' ou 'blur' sur l'input des secondes restantes
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
                // Cacher les sélecteurs 2 et 3 sur mobile
                group.style.display = (index > 0 && isMobile) ? 'none' : '';
            }
        });
        // Important: renderQuestColumns décide maintenant quels slots afficher
        renderQuestColumns();
    };

    window.addEventListener('resize', handleResizeOrLoad);

    // Attacher les listeners pour ouvrir la modale
    playerSelectorUIs.forEach((ui, index) => {
        const button = ui.querySelector('.dq-open-modal-btn');
        const display = ui.querySelector('.dq-player-name-display');
        const triggerFn = () => {
            // Passer le contexte nécessaire à la modale
            openPlayerSelectModal(
                {
                    type: 'dailyQuest',
                    index: index,
                    allowCreation: false, // Ne pas autoriser la création depuis Daily Quests
                    allSelectedIds: [...selectedPlayerIds] // Passer une copie des ID déjà sélectionnés
                },
                setSelectedPlayer // Passer la fonction callback
            );
        };
        if (button) button.addEventListener('click', triggerFn);
        if (display) display.addEventListener('click', triggerFn); // Permettre clic sur nom aussi
    });

    // Fetch initial des données et premier rendu
    fetchAndUpdatePlayerData().then(() => {
        handleResizeOrLoad(); // Appliquer le layout après le fetch initial
        console.log("Daily Quests initialized.");
    });

    // Optionnel: Mettre à jour périodiquement (ex: toutes les 5 minutes)
    // setInterval(fetchAndUpdatePlayerData, 5 * 60 * 1000);
}