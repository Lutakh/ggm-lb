// public/js/modules/dailyQuests.js

const STAMINA_REGEN_RATE_MINUTES = 24;
const MAX_STAMINA = 99;
let questListDefinition = []; // Sera rempli par l'appel API
let selectedPlayerIds = [null, null, null];
let playerQuestData = [null, null, null]; // Pour stocker les données récupérées { playerId, name, stamina, completedQuests }
let staminaIntervals = [null, null, null]; // Pour gérer les timers d'incrémentation

const container = document.getElementById('daily-quests-container');
const playerSelectors = document.querySelectorAll('.dq-player-select');

// --- Fonctions Utilitaires ---
function calculateCurrentStamina(playerData) {
    if (!playerData || !playerData.staminaLastUpdated) {
        return playerData ? (playerData.stamina || 0) : 0;
    }
    const lastUpdated = new Date(playerData.staminaLastUpdated);
    const now = new Date();
    const minutesPassed = Math.floor((now - lastUpdated) / (1000 * 60));
    const regeneratedStamina = Math.floor(minutesPassed / STAMINA_REGEN_RATE_MINUTES);
    return Math.min(MAX_STAMINA, (playerData.stamina || 0) + regeneratedStamina);
}

function stopStaminaTimer(index) {
    if (staminaIntervals[index]) {
        clearInterval(staminaIntervals[index]);
        staminaIntervals[index] = null;
    }
}

function startStaminaTimer(index) {
    stopStaminaTimer(index); // Arrêter l'ancien timer s'il existe

    const playerData = playerQuestData[index];
    if (!playerData || !playerData.staminaLastUpdated) return;

    const lastUpdated = new Date(playerData.staminaLastUpdated);
    const minutesSinceLastRegen = Math.floor((new Date() - lastUpdated) / (1000 * 60)) % STAMINA_REGEN_RATE_MINUTES;
    const msUntilNextRegen = (STAMINA_REGEN_RATE_MINUTES - minutesSinceLastRegen) * 60 * 1000;

    const updateDisplay = () => {
        const currentStaminaDisplay = document.getElementById(`dq-stamina-current-${index}`);
        const currentStamina = calculateCurrentStamina(playerData); // Recalculer
        if (currentStaminaDisplay) {
            currentStaminaDisplay.textContent = currentStamina;
        }
        // Mise à jour de la valeur brute si nécessaire (mais préférer recalculer à l'affichage)
        // playerData.stamina = currentStamina; // Attention: peut désynchroniser avec la valeur BDD de base
    };

    // Premier délai pour attendre la prochaine minute de régénération
    setTimeout(() => {
        updateDisplay(); // Mise à jour immédiate au premier tick de regen
        // Ensuite, intervalle régulier toutes les X minutes
        staminaIntervals[index] = setInterval(() => {
            updateDisplay();
            const currentStamina = calculateCurrentStamina(playerData);
            if (currentStamina >= MAX_STAMINA) {
                stopStaminaTimer(index); // Arrêter si max atteint
            }
        }, STAMINA_REGEN_RATE_MINUTES * 60 * 1000);
    }, msUntilNextRegen);

    // Mise à jour initiale de l'affichage
    updateDisplay();
}


// --- Fonctions d'Affichage ---
function renderQuestColumns() {
    if (!container) return;

    const activePlayers = selectedPlayerIds.map((id, index) => id ? index : -1).filter(index => index !== -1);

    if (activePlayers.length === 0) {
        container.innerHTML = '<div class="dq-placeholder">Select up to 3 players to track their daily quests.</div>';
        return;
    }

    container.innerHTML = ''; // Vider le conteneur
    container.className = `daily-quests-container columns-${activePlayers.length}`; // Adapter le nombre de colonnes

    activePlayers.forEach(index => {
        const playerId = selectedPlayerIds[index];
        const data = playerQuestData[index];
        if (!playerId || !data) return; // Ne devrait pas arriver si activePlayers est correct

        const playerColumn = document.createElement('div');
        playerColumn.className = 'dq-player-column';
        playerColumn.dataset.playerId = playerId;
        playerColumn.dataset.index = index;

        const currentStamina = calculateCurrentStamina(data);

        playerColumn.innerHTML = `
            <h3>${data.name}</h3>
            <div class="dq-stamina-section">
                <label for="dq-stamina-input-${index}">Stamina:</label>
                <input type="number" id="dq-stamina-input-${index}" class="dq-stamina-input"
                       min="0" max="${MAX_STAMINA}" value="${currentStamina}" data-index="${index}">
                <span class="dq-stamina-current" id="dq-stamina-current-${index}">${currentStamina}</span> / ${MAX_STAMINA}
            </div>
            <ul class="dq-quest-list">
                ${questListDefinition.map(quest => `
                    <li>
                        <input type="checkbox" id="quest-${playerId}-${quest.key}"
                               data-player-id="${playerId}" data-quest-key="${quest.key}"
                               ${data.completedQuests.includes(quest.key) ? 'checked' : ''}>
                        <label for="quest-${playerId}-${quest.key}">${quest.label}</label>
                    </li>
                `).join('')}
            </ul>
        `;
        container.appendChild(playerColumn);
        startStaminaTimer(index); // Démarrer le timer pour ce joueur
    });

    attachEventListeners(); // Attacher les écouteurs aux nouveaux éléments
}

// --- Logique de Récupération et Mise à jour ---
async function fetchAndUpdatePlayerData() {
    const idsToFetch = selectedPlayerIds.filter(id => id !== null);
    // Arrêter tous les timers avant de recharger
    staminaIntervals.forEach((_, index) => stopStaminaTimer(index));

    if (idsToFetch.length === 0) {
        playerQuestData = [null, null, null]; // Réinitialiser les données
        renderQuestColumns();
        return;
    }

    try {
        const response = await fetch(`/daily-quests/status?playerIds=${idsToFetch.join(',')}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        questListDefinition = data.questsList || []; // Mettre à jour la liste de quêtes globale

        // Mettre à jour playerQuestData en respectant les indices
        playerQuestData = selectedPlayerIds.map(selectedId => {
            if (!selectedId) return null;
            return data.players.find(p => p.playerId === selectedId) || null;
        });

        renderQuestColumns();

    } catch (error) {
        console.error("Failed to fetch daily quest status:", error);
        container.innerHTML = '<div class="dq-error">Could not load quest data. Please try again later.</div>';
    }
}

async function updateQuestStatus(playerId, questKey, completed) {
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
            // Optionnel: Revenir à l'état précédent de la checkbox
            const checkbox = document.getElementById(`quest-${playerId}-${questKey}`);
            if (checkbox) checkbox.checked = !completed;
        } else {
            // Mettre à jour l'état local pour éviter un rechargement complet juste pour une checkbox
            const playerIndex = selectedPlayerIds.findIndex(id => id === playerId);
            if (playerIndex !== -1 && playerQuestData[playerIndex]) {
                if (completed) {
                    if (!playerQuestData[playerIndex].completedQuests.includes(questKey)) {
                        playerQuestData[playerIndex].completedQuests.push(questKey);
                    }
                } else {
                    playerQuestData[playerIndex].completedQuests = playerQuestData[playerIndex].completedQuests.filter(key => key !== questKey);
                }
            }
        }
    } catch (error) {
        console.error("Error updating quest status:", error);
        const checkbox = document.getElementById(`quest-${playerId}-${questKey}`);
        if (checkbox) checkbox.checked = !completed;
    }
}

async function updateStaminaValue(index, inputElement) {
    const playerId = selectedPlayerIds[index];
    let staminaValue = parseInt(inputElement.value, 10);

    // Validation
    if (isNaN(staminaValue) || staminaValue < 0) staminaValue = 0;
    if (staminaValue > MAX_STAMINA) staminaValue = MAX_STAMINA;
    inputElement.value = staminaValue; // Corriger la valeur dans l'input si hors limites

    stopStaminaTimer(index); // Arrêter le timer pendant la mise à jour manuelle

    try {
        const response = await fetch('/daily-quests/update-stamina', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, stamina: staminaValue })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();

        if (result.success && playerQuestData[index]) {
            // Mettre à jour les données locales et redémarrer le timer
            playerQuestData[index].stamina = result.stamina;
            playerQuestData[index].staminaLastUpdated = result.staminaLastUpdated;
            renderQuestColumns(); // Re-render pour s'assurer que tout est synchro et relancer le timer
        } else {
            console.error('Failed to update stamina on server');
            // Optionnel: remettre l'ancienne valeur ?
            inputElement.value = calculateCurrentStamina(playerQuestData[index]);
            startStaminaTimer(index); // Redémarrer le timer même si échec
        }
    } catch (error) {
        console.error("Error updating stamina:", error);
        inputElement.value = calculateCurrentStamina(playerQuestData[index]);
        startStaminaTimer(index); // Redémarrer le timer même si échec
    }
}


// --- Écouteurs d'Événements ---
function attachEventListeners() {
    // Checkboxes de quêtes
    container.querySelectorAll('.dq-quest-list input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', (event) => {
            const playerId = parseInt(event.target.dataset.playerId, 10);
            const questKey = event.target.dataset.questKey;
            const completed = event.target.checked;
            updateQuestStatus(playerId, questKey, completed);
        });
    });

    // Inputs de stamina (utilisation de 'change' pour éviter trop d'appels pendant la saisie)
    container.querySelectorAll('.dq-stamina-input').forEach(input => {
        // Retirer les anciens écouteurs pour éviter les doublons lors du re-render
        input.replaceWith(input.cloneNode(true));
    });
    // Récupérer les nouveaux inputs clonés et ajouter les écouteurs
    container.querySelectorAll('.dq-stamina-input').forEach(input => {
        input.addEventListener('change', (event) => {
            const index = parseInt(event.target.dataset.index, 10);
            updateStaminaValue(index, event.target);
        });
        input.addEventListener('blur', (event) => { // Aussi sur blur pour valider si on quitte le champ
            const index = parseInt(event.target.dataset.index, 10);
            updateStaminaValue(index, event.target);
        });
    });
}

// --- Initialisation ---
export function initDailyQuests() {
    playerSelectors.forEach(select => {
        select.addEventListener('change', (event) => {
            const index = parseInt(event.target.dataset.index, 10);
            const selectedId = event.target.value ? parseInt(event.target.value, 10) : null;

            // Vérifier si l'ID est déjà sélectionné dans un autre selecteur
            const alreadySelected = selectedPlayerIds.some((id, i) => id === selectedId && i !== index);
            if (alreadySelected) {
                alert("This player is already selected in another slot.");
                event.target.value = selectedPlayerIds[index] || ""; // Revenir à la valeur précédente
                return;
            }

            // Arrêter le timer de l'ancien joueur de ce slot
            stopStaminaTimer(index);

            selectedPlayerIds[index] = selectedId;
            fetchAndUpdatePlayerData();
        });
    });

    // Charger les données initiales si des joueurs sont présélectionnés (par exemple via URL)
    fetchAndUpdatePlayerData();
}