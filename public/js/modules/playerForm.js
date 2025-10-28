// public/js/modules/playerForm.js
import { formatCP, minutesToTimeValue, minutesToFormattedTime } from './utils.js';

export function initPlayerForm() {
    const form = document.getElementById('player-form');
    if (!form) return;

    // --- ÉLÉMENTS DU DOM ---
    const hiddenNameInput = document.getElementById('name-input-hidden');
    const playerNameDisplay = document.getElementById('player-name-display');
    const openModalBtn = document.getElementById('open-player-select-btn');

    const playersDataElement = document.getElementById('players-data'); // Pour la modale de sélection
    const allPlayers = playersDataElement ? JSON.parse(playersDataElement.textContent || '[]') : [];

    // Éléments de la modale partagée
    const modal = document.getElementById('player-select-modal');
    const backdrop = document.getElementById('player-select-modal-backdrop');
    const filterInput = document.getElementById('player-filter-input');
    const playerListContainer = document.getElementById('player-select-list');
    const closeModalBtn = modal?.querySelector('.player-select-close-btn'); // Safe navigation
    const createPlayerBtn = document.getElementById('create-new-player-btn');

    let activeSuggestionIndex = -1; // Pour navigation clavier modale

    // --- Éléments du formulaire ---
    const formDetails = document.getElementById('form-details');
    const imageContainer = document.getElementById('player-image-container');
    const submitBtn = document.getElementById('submit-btn');
    const classSelect = document.getElementById('class-select');
    const cpInput = document.getElementById('cp-input');
    const teamSelect = document.getElementById('team-select'); // Peut être admin-only
    const guildSelect = document.getElementById('guild-select');
    const notesInput = document.getElementById('notes-input');
    const discordIdInput = document.getElementById('discord-user-id-input'); // NOUVEAU
    const slotsContainer = document.getElementById('time-slots-container');
    const addSlotBtn = document.getElementById('add-slot-btn');
    const classImages = { /* ... vos images ... */ };


    // --- GESTION DE LA MODALE DE SÉLECTION ---
    const populatePlayerList = (filter = '') => { /* ... inchangé ... */ };
    const openModal = () => { /* ... inchangé ... */ };
    const closeModal = () => { /* ... inchangé ... */ };
    const updateActiveSuggestion = (items) => { /* ... inchangé ... */ };

    // Modifié pour appeler findPlayer après sélection
    const selectPlayer = (name) => {
        if (!hiddenNameInput || !playerNameDisplay) return;
        hiddenNameInput.value = name;
        playerNameDisplay.textContent = name;
        closeModal();
        findPlayer(); // Charger les données après sélection
    };

    // Écouteurs pour la modale
    if (openModalBtn) openModalBtn.addEventListener('click', openModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);
    if (filterInput) {
        filterInput.addEventListener('input', () => { /* ... populate ... */ });
        filterInput.addEventListener('keydown', (e) => { /* ... gestion clavier ... */ });
    }
    if (playerListContainer) playerListContainer.addEventListener('click', (e) => { /* ... gestion clic ... */ });
    if (createPlayerBtn) createPlayerBtn.addEventListener('click', () => { /* ... gestion création ... */ });


    // --- LOGIQUE DU FORMULAIRE ---

    // Valide si un nom est sélectionné et les champs requis (CP, Classe pour nouveau) sont remplis
    function validateForm() {
        if (!submitBtn || !hiddenNameInput || !cpInput || !classSelect) return;
        const isPlayerSelected = hiddenNameInput.value.trim() !== '';
        const isCpValid = cpInput.value.trim() !== '';
        // Classe requise seulement si l'option "disabled selected" est choisie (indique nouveau joueur ou reset)
        const isClassRequired = classSelect.selectedIndex === 0 || classSelect.value === '';
        const isClassValid = !isClassRequired || (classSelect.value.trim() !== '');

        submitBtn.disabled = !(isPlayerSelected && isCpValid && isClassValid);
    }

    function createTimeSlot(startMinutes = null, endMinutes = null) {
        if (!slotsContainer) return;
        const entry = document.createElement('div');
        entry.className = 'time-slot-entry';
        entry.innerHTML = `<div class="hours-inputs"><input type="time" name="play_start[]" value="${minutesToTimeValue(startMinutes)}"><span class="separator">-</span><input type="time" name="play_end[]" value="${minutesToTimeValue(endMinutes)}"></div><button type="button" class="remove-slot-btn">🗑️</button>`;
        slotsContainer.appendChild(entry);
        entry.querySelector('.remove-slot-btn')?.addEventListener('click', () => entry.remove()); // Safe navigation
    }

    function updatePlayerImage(className) {
        if (!imageContainer) return;
        const safeClassName = className && classImages[className] ? className : 'new';
        imageContainer.innerHTML = classImages[safeClassName] || ''; // Fournir chaîne vide si 'new' n'existe pas
    }


    async function findPlayer() {
        if (!hiddenNameInput || !formDetails || !imageContainer || !classSelect || !cpInput || !guildSelect || !notesInput || !discordIdInput || !slotsContainer) {
            console.error("One or more form elements are missing.");
            return;
        }

        const name = hiddenNameInput.value.trim();
        if (!name) {
            // Réinitialiser si aucun nom n'est sélectionné (ex: après avoir vidé la sélection)
            imageContainer.classList.remove('visible');
            updatePlayerImage('new'); // Afficher image par défaut
            classSelect.selectedIndex = 0; // Remettre sur "Class"
            cpInput.value = '';
            if (teamSelect) teamSelect.value = 'No Team'; // Vérifier existence si admin-only
            guildSelect.value = '';
            notesInput.value = '';
            discordIdInput.value = ''; // Vider ID Discord
            slotsContainer.innerHTML = '<label>Play Hours <span id="local-timezone-note"></span></label>'; // Vider slots sauf label
            createTimeSlot(); // Ajouter un slot vide
            classSelect.required = true; // Rendre requis à nouveau
            formDetails.classList.add('visible'); // Garder visible pour création potentielle
            validateForm();
            return;
        }

        // Afficher indicateur de chargement ? (Optionnel)

        try {
            const response = await fetch(`/player-details/${encodeURIComponent(name)}`);

            // Gérer les erreurs de fetch
            if (!response.ok) {
                console.error(`Error fetching player details: ${response.status} ${response.statusText}`);
                alert(`Could not fetch details for "${name}". Assuming new player.`);
                // Configurer pour nouveau joueur
                imageContainer.classList.add('visible');
                updatePlayerImage('new');
                classSelect.selectedIndex = 0;
                cpInput.value = '';
                if (teamSelect) teamSelect.value = 'No Team';
                guildSelect.value = '';
                notesInput.value = '';
                discordIdInput.value = ''; // Vider ID
                slotsContainer.innerHTML = '<label>Play Hours <span id="local-timezone-note"></span></label>';
                createTimeSlot();
                classSelect.required = true;
                formDetails.classList.add('visible');
                validateForm();
                return;
            }

            const data = await response.json();
            imageContainer.classList.add('visible'); // Afficher conteneur image

            // Vider les slots existants avant d'ajouter les nouveaux (ou le slot vide)
            slotsContainer.innerHTML = '<label>Play Hours <span id="local-timezone-note"></span></label>'; // Garder le label

            if (data) { // Joueur trouvé
                updatePlayerImage(data.class);
                classSelect.value = data.class || ''; // Utiliser '' si null
                cpInput.value = formatCP(data.combat_power);
                if (teamSelect) teamSelect.value = data.team || 'No Team'; // Vérifier existence teamSelect
                guildSelect.value = data.guild || '';
                notesInput.value = data.notes || '';
                discordIdInput.value = data.discord_user_id || ''; // Charger l'ID Discord
                // Traiter les play_slots
                if (data.play_slots && data.play_slots.length > 0) {
                    data.play_slots.forEach(slot => createTimeSlot(slot.start_minutes, slot.end_minutes));
                } else {
                    createTimeSlot(); // Ajouter un slot vide si aucun n'est retourné
                }
                classSelect.required = false; // Non requis si joueur existe
            } else { // Nouveau joueur (nom saisi mais non trouvé via API)
                updatePlayerImage('new');
                // Les champs devraient déjà être vides/défaut suite à la réinitialisation avant fetch
                cpInput.value = ''; // Assurer vide
                if (teamSelect) teamSelect.value = 'No Team';
                guildSelect.value = '';
                notesInput.value = '';
                discordIdInput.value = '';
                createTimeSlot(); // Ajouter un slot vide
                classSelect.required = true; // Requis pour nouveau joueur
            }
            formDetails.classList.add('visible'); // Afficher les détails
            validateForm(); // Valider l'état après chargement

        } catch (error) {
            console.error("JavaScript error during findPlayer:", error);
            alert("An error occurred while loading player data.");
            // État de repli : considérer comme nouveau joueur
            imageContainer.classList.add('visible');
            updatePlayerImage('new');
            classSelect.selectedIndex = 0;
            cpInput.value = '';
            if (teamSelect) teamSelect.value = 'No Team';
            guildSelect.value = '';
            notesInput.value = '';
            discordIdInput.value = '';
            slotsContainer.innerHTML = '<label>Play Hours <span id="local-timezone-note"></span></label>';
            createTimeSlot();
            classSelect.required = true;
            formDetails.classList.add('visible');
            validateForm();
        }
    }


    // --- Écouteurs d'événements ---
    if (classSelect) {
        classSelect.addEventListener('input', () => {
            updatePlayerImage(classSelect.value);
            validateForm();
        });
    }
    if (cpInput) cpInput.addEventListener('input', validateForm);
    if (addSlotBtn) addSlotBtn.addEventListener('click', () => createTimeSlot());

    // Initialiser affichage fuseau horaire
    try {
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop()?.replace('_', ' ') || 'Local Time';
        const tzNote = document.getElementById('local-timezone-note');
        if (tzNote) tzNote.textContent = `(${userTimezone})`;
        const tableTzNote = document.getElementById('table-timezone-note');
        if (tableTzNote) tableTzNote.textContent = `(${userTimezone})`;
    } catch(e) { console.warn("Could not determine local timezone."); }

    // Gérer état initial (si un nom est déjà dans l'input caché au chargement?) - Optionnel
    if (hiddenNameInput && hiddenNameInput.value) {
        playerNameDisplay.textContent = hiddenNameInput.value;
        findPlayer(); // Charger données si nom pré-rempli
    } else {
        // Afficher le formulaire vide pour nouveau joueur par défaut ? Ou cacher formDetails ?
        // Cachons-le par défaut, l'utilisateur doit sélectionner d'abord.
        if (formDetails) formDetails.classList.remove('visible');
        if (imageContainer) imageContainer.classList.remove('visible');
    }

} // Fin initPlayerForm