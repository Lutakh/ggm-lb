// public/js/modules/playerForm.js
import { formatCP, minutesToTimeValue } from './utils.js';
import { openModal as openPlayerSelectModal } from './playerSelectModal.js'; // Importer la fonction

export function initPlayerForm() {
    const form = document.getElementById('player-form');
    if (!form) return;

    // --- ÉLÉMENTS DU DOM (Formulaire principal) ---
    const hiddenNameInput = document.getElementById('name-input-hidden');
    const playerNameDisplay = document.getElementById('player-name-display');
    const openFormModalBtn = document.getElementById('open-player-select-btn'); // Renommé pour clarté

    // --- Éléments du formulaire (détails) ---
    const formDetails = document.getElementById('form-details');
    const imageContainer = document.getElementById('player-image-container');
    const submitBtn = document.getElementById('submit-btn');
    const classSelect = document.getElementById('class-select');
    const cpInput = document.getElementById('cp-input');
    const teamSelect = document.getElementById('team-select'); // Peut être admin-only
    const guildSelect = document.getElementById('guild-select');
    const notesInput = document.getElementById('notes-input');
    const discordIdInput = document.getElementById('discord-user-id-input');
    const timezoneSelect = document.getElementById('timezone-select'); // NOUVEAU
    const slotsContainer = document.getElementById('time-slots-container');
    const addSlotBtn = document.getElementById('add-slot-btn');

    // Mappage simplifié des images de classe (ajuster les chemins si nécessaire)
    const classImagesHtml = {
        Swordbearer: '<img src="/images/Swordbearer.png" alt="Swordbearer">',
        Acolyte: '<img src="/images/Acolyte.png" alt="Acolyte">',
        Wayfarer: '<img src="/images/Wayfarer.png" alt="Wayfarer">',
        Scholar: '<img src="/images/Scholar.png" alt="Scholar">',
        Shadowlash: '<img src="/images/Shadowlash.png" alt="Shadowlash">',
        'new': '<img src="/images/new-player.png" alt="New Player">' // Image par défaut
    };

    // --- GESTION DE LA MODALE VIA LE MODULE IMPORTÉ ---

    // Callback pour la modale: Met à jour le formulaire quand un joueur est sélectionné ou créé
    function handlePlayerSelection(playerId, playerName, triggerContext) {
        // Vérifier si le callback vient bien de ce formulaire (même si ici il n'y a qu'un contexte)
        if (triggerContext?.type === 'playerForm') {
            if (!hiddenNameInput || !playerNameDisplay) return;
            hiddenNameInput.value = playerName; // Mettre à jour l'input caché
            playerNameDisplay.textContent = playerName; // Mettre à jour l'affichage
            // playerId sera null si c'est un nouveau joueur créé via la modale
            findPlayer(playerName, playerId === null); // Charger les données (ou préparer pour nouveau)
        }
    }

    // Listener pour le bouton "Select Player" du formulaire
    if (openFormModalBtn) {
        openFormModalBtn.addEventListener('click', () => {
            openPlayerSelectModal(
                { type: 'playerForm', allowCreation: true }, // Contexte pour le formulaire
                handlePlayerSelection // Callback
            );
        });
    }

    // --- LOGIQUE DU FORMULAIRE ---

    // Valide le formulaire avant soumission
    function validateForm() {
        if (!submitBtn || !hiddenNameInput || !cpInput || !classSelect) return;
        const isPlayerSelected = hiddenNameInput.value.trim() !== '';
        const isCpValid = cpInput.value.trim() !== '';
        // Classe requise seulement si nouveau joueur (pas d'ID ou option "Class" sélectionnée)
        const isNewPlayer = !form.dataset.currentPlayerId || classSelect.value === '';
        const isClassValid = !isNewPlayer || (classSelect.value.trim() !== '');

        submitBtn.disabled = !(isPlayerSelected && isCpValid && isClassValid);
        // Stocker l'ID actuel pour référence (utile pour savoir si nouveau ou existant)
        form.dataset.currentPlayerId = isNewPlayer ? '' : form.dataset.currentPlayerId; // Garde l'ID si existant
    }

    // Crée un champ pour une tranche horaire
    function createTimeSlot(startMinutes = null, endMinutes = null) {
        if (!slotsContainer) return;
        const entry = document.createElement('div');
        entry.className = 'time-slot-entry';
        entry.innerHTML = `
            <div class="hours-inputs">
                <input type="time" name="play_start[]" value="${minutesToTimeValue(startMinutes)}">
                <span class="separator">-</span>
                <input type="time" name="play_end[]" value="${minutesToTimeValue(endMinutes)}">
            </div>
            <button type="button" class="remove-slot-btn" title="Remove slot">🗑️</button>
        `;
        slotsContainer.appendChild(entry);
        entry.querySelector('.remove-slot-btn')?.addEventListener('click', () => entry.remove());
    }

    // Met à jour l'image du joueur affichée
    function updatePlayerImage(className) {
        if (!imageContainer) return;
        const safeClassName = className && classImagesHtml[className] ? className : 'new';
        imageContainer.innerHTML = classImagesHtml[safeClassName] || classImagesHtml['new']; // Fallback sur 'new'
        imageContainer.classList.add('visible'); // S'assurer qu'elle est visible
    }

    // Réinitialise les champs du formulaire (pour nouveau joueur ou sélection vide)
    function resetFormFields() {
        form.dataset.currentPlayerId = ''; // Effacer l'ID stocké
        updatePlayerImage('new');
        if(classSelect) classSelect.value = ''; // Remettre sur "Class"
        if(cpInput) cpInput.value = '';
        if(teamSelect) teamSelect.value = 'No Team'; // Valeur par défaut
        if(guildSelect) guildSelect.value = ''; // Vide par défaut
        if(notesInput) notesInput.value = '';
        if(discordIdInput) discordIdInput.value = '';
        if(timezoneSelect) timezoneSelect.value = ''; // NOUVEAU
        if(slotsContainer) {
            // Vider slots sauf le label
            const label = slotsContainer.querySelector('label');
            slotsContainer.innerHTML = '';
            if (label) slotsContainer.appendChild(label);
        }
        createTimeSlot(); // Ajouter un slot vide par défaut
        if(classSelect) classSelect.required = true; // Rendre requis pour nouveau
        if(formDetails) formDetails.classList.add('visible'); // Assurer la visibilité
        validateForm();
    }


    // Fonction principale pour charger les données d'un joueur existant ou préparer pour un nouveau
    async function findPlayer(name, isNewPlayer = false) {
        if (!name) {
            resetFormFields(); // Réinitialiser si pas de nom
            return;
        }

        if (isNewPlayer) {
            // C'est un nouveau joueur créé via la modale
            resetFormFields(); // Réinitialiser pour être sûr (garde le nom déjà mis)
            updatePlayerImage('new'); // Mettre l'image par défaut
            if(classSelect) classSelect.focus(); // Mettre le focus sur la classe
            return; // Pas besoin de fetch
        }

        // --- Fetch les détails pour un joueur existant ---
        // AJOUT de timezoneSelect
        if (!formDetails || !imageContainer || !classSelect || !cpInput || !guildSelect || !notesInput || !discordIdInput || !timezoneSelect || !slotsContainer) {
            console.error("One or more form detail elements are missing.");
            return;
        }

        // Afficher indicateur de chargement ? (Optionnel)
        formDetails.classList.remove('visible'); // Cacher pendant le chargement

        try {
            const response = await fetch(`/player-details/${encodeURIComponent(name)}`);
            if (!response.ok) {
                // Si non trouvé (404 ou autre), considérer comme nouveau joueur (même s'il n'a pas été marqué comme nouveau)
                console.warn(`Player "${name}" not found via API. Treating as new player.`);
                resetFormFields(); // Prépare pour un nouveau joueur
                updatePlayerImage('new');
                return;
            }

            const data = await response.json();

            // Vider les slots existants avant d'ajouter les nouveaux
            const label = slotsContainer.querySelector('label');
            slotsContainer.innerHTML = '';
            if (label) slotsContainer.appendChild(label); // Remettre le label

            if (data) { // Joueur trouvé et données reçues
                form.dataset.currentPlayerId = data.id; // Stocker l'ID du joueur chargé
                updatePlayerImage(data.class);
                classSelect.value = data.class || '';
                cpInput.value = formatCP(data.combat_power); // Afficher formaté
                if (teamSelect) teamSelect.value = data.team || 'No Team';
                guildSelect.value = data.guild || '';
                notesInput.value = data.notes || '';
                discordIdInput.value = data.discord_user_id || '';
                timezoneSelect.value = data.timezone || ''; // NOUVEAU

                // Traiter les play_slots
                if (data.play_slots && data.play_slots.length > 0) {
                    data.play_slots.forEach(slot => createTimeSlot(slot.start_minutes, slot.end_minutes));
                } else {
                    createTimeSlot(); // Ajouter un slot vide si aucun n'est retourné
                }
                classSelect.required = false; // Non requis si joueur existe
            } else {
                // Si l'API renvoie null explicitement (ne devrait pas arriver avec la gestion du 404)
                console.warn(`API returned null for player "${name}". Treating as new player.`);
                resetFormFields();
                updatePlayerImage('new');
            }

        } catch (error) {
            console.error("Error during findPlayer fetch:", error);
            alert("An error occurred while loading player data. Please try selecting again.");
            resetFormFields(); // Revenir à un état propre en cas d'erreur JS
            updatePlayerImage('new');
        } finally {
            formDetails.classList.add('visible'); // Réafficher les détails après chargement/erreur
            validateForm(); // Valider l'état après chargement
        }
    }


    // --- Écouteurs d'événements pour les champs du formulaire ---
    if (classSelect) {
        classSelect.addEventListener('change', () => { // 'change' est mieux que 'input' pour select
            updatePlayerImage(classSelect.value);
            validateForm();
        });
    }
    if (cpInput) cpInput.addEventListener('input', validateForm); // 'input' pour réactivité
    if (addSlotBtn) addSlotBtn.addEventListener('click', () => createTimeSlot());

    // Initialiser affichage fuseau horaire (ne change pas)
    try {
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop()?.replace('_', ' ') || 'Local Time';
        const tzNoteForm = document.getElementById('local-timezone-note');
        if (tzNoteForm) tzNoteForm.textContent = `(${userTimezone})`;
        const tzNoteTable = document.getElementById('table-timezone-note');
        if (tzNoteTable) tzNoteTable.textContent = `(${userTimezone})`;
    } catch(e) { console.warn("Could not determine local timezone."); }

    // Gérer état initial
    if (hiddenNameInput && hiddenNameInput.value) {
        playerNameDisplay.textContent = hiddenNameInput.value;
        findPlayer(hiddenNameInput.value); // Charger données si nom pré-rempli
    } else {
        // Cacher les détails par défaut, l'utilisateur doit sélectionner d'abord.
        if (formDetails) formDetails.classList.remove('visible');
        if (imageContainer) imageContainer.classList.remove('visible');
        // Assurer que le bouton submit est désactivé initialement
        if (submitBtn) submitBtn.disabled = true;
    }

} // Fin initPlayerForm