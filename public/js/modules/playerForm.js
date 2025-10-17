import { formatCP, minutesToTimeValue, minutesToFormattedTime } from './utils.js';

export function initPlayerForm() {
    const form = document.getElementById('player-form');
    if (!form) return;

    // --- ÉLÉMENTS DU DOM ---
    const hiddenNameInput = document.getElementById('name-input-hidden');
    const playerNameDisplay = document.getElementById('player-name-display');
    const openModalBtn = document.getElementById('open-player-select-btn');

    const playersDataElement = document.getElementById('players-data');
    const allPlayers = playersDataElement ? JSON.parse(playersDataElement.textContent) : [];

    // Éléments de la modale
    const modal = document.getElementById('player-select-modal');
    const backdrop = document.getElementById('player-select-modal-backdrop');
    const filterInput = document.getElementById('player-filter-input');
    const playerListContainer = document.getElementById('player-select-list');
    const closeModalBtn = modal.querySelector('.player-select-close-btn');
    const createPlayerBtn = document.getElementById('create-new-player-btn');

    let activeSuggestionIndex = -1;

    // --- GESTION DE LA FENÊTRE (MODALE) ---
    const populatePlayerList = (filter = '') => {
        playerListContainer.innerHTML = '';
        const query = filter.toLowerCase();
        allPlayers
            .filter(p => p.name.toLowerCase().includes(query))
            .forEach(player => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.dataset.playerName = player.name;
                item.innerHTML = `
                    <span>${player.name}</span>
                    <span class="class-tag class-${player.class.toLowerCase()}">${player.class}</span>
                `;
                playerListContainer.appendChild(item);
            });
    };

    const openModal = () => {
        filterInput.value = '';
        populatePlayerList();
        modal.style.display = 'flex';
        backdrop.style.display = 'block';
        filterInput.focus();
        activeSuggestionIndex = -1;
    };

    const closeModal = () => {
        modal.style.display = 'none';
        backdrop.style.display = 'none';
    };

    const selectPlayer = (name) => {
        hiddenNameInput.value = name;
        playerNameDisplay.textContent = name;
        closeModal();
        findPlayer();
    };

    // --- ÉVÉNEMENTS ---
    if (openModalBtn) openModalBtn.addEventListener('click', openModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);
    if (filterInput) filterInput.addEventListener('input', () => {
        populatePlayerList(filterInput.value);
        activeSuggestionIndex = -1;
    });

    if (playerListContainer) playerListContainer.addEventListener('click', (e) => {
        const selectedItem = e.target.closest('.suggestion-item');
        if (selectedItem) {
            selectPlayer(selectedItem.dataset.playerName);
        }
    });
    
    if (createPlayerBtn) createPlayerBtn.addEventListener('click', () => {
        const newName = filterInput.value.trim();
        if (newName) {
            selectPlayer(newName);
        }
    });

    const updateActiveSuggestion = (items) => {
        items.forEach((item, index) => {
            if (index === activeSuggestionIndex) {
                item.classList.add('active');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
    };

    if (filterInput) filterInput.addEventListener('keydown', (e) => {
        const items = playerListContainer.querySelectorAll('.suggestion-item');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (items.length > 0) {
                activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
                updateActiveSuggestion(items);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (items.length > 0) {
                activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
                updateActiveSuggestion(items);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const activeItem = playerListContainer.querySelector('.suggestion-item.active');
            if (activeItem) {
                selectPlayer(activeItem.dataset.playerName);
            } else if (items.length > 0) {
                selectPlayer(items[0].dataset.playerName);
            } else if (filterInput.value.trim() !== '') {
                createPlayerBtn.click();
            }
        }
    });

    // --- LOGIQUE DU FORMULAIRE ---
    const formDetails = document.getElementById('form-details');
    const imageContainer = document.getElementById('player-image-container');
    const submitBtn = document.getElementById('submit-btn');
    const classSelect = document.getElementById('class-select');
    const cpInput = document.getElementById('cp-input');
    const teamSelect = document.getElementById('team-select');
    const guildSelect = document.getElementById('guild-select');
    const notesInput = document.getElementById('notes-input');
    const slotsContainer = document.getElementById('time-slots-container');
    const addSlotBtn = document.getElementById('add-slot-btn');
    const classImages = {
        new: `<img src="/images/new-player.png" alt="New Player">`,
        Swordbearer: `<img src="/images/Swordbearer.png" alt="Swordbearer Class">`,
        Acolyte: `<img src="/images/Acolyte.png" alt="Acolyte Class">`,
        Wayfarer: `<img src="/images/Wayfarer.png" alt="Wayfarer Class">`,
        Scholar: `<img src="/images/Scholar.png" alt="Scholar Class">`,
        Shadowlash: `<img src="/images/Shadowlash.png" alt="Shadowlash Class">`
    };
    function validateForm() {
        const isPlayerSelected = hiddenNameInput.value.trim() !== '';
        const isClassValid = classSelect.required ? classSelect.value.trim() !== '' : true;
        const areDetailsFilled = cpInput.value.trim() !== '' && isClassValid;
        submitBtn.disabled = !(isPlayerSelected && areDetailsFilled);
    }

    function createTimeSlot(startMinutes = null, endMinutes = null) {
        const entry = document.createElement('div');
        entry.className = 'time-slot-entry';
        entry.innerHTML = `<div class="hours-inputs"><input type="time" name="play_start[]" value="${minutesToTimeValue(startMinutes)}"><span class="separator">-</span><input type="time" name="play_end[]" value="${minutesToTimeValue(endMinutes)}"></div><button type="button" class="remove-slot-btn">🗑️</button>`;
        slotsContainer.appendChild(entry);
        entry.querySelector('.remove-slot-btn').addEventListener('click', () => entry.remove());
    }
    if (addSlotBtn) addSlotBtn.addEventListener('click', () => createTimeSlot());

    function updatePlayerImage(className) { if(imageContainer) imageContainer.innerHTML = classImages[className] || classImages.new; }

    async function findPlayer() {
        const name = hiddenNameInput.value.trim();
        if (!name) return;

        const response = await fetch(`/player-details/${encodeURIComponent(name)}`);
        const data = await response.json();
        if (slotsContainer) slotsContainer.querySelectorAll('.time-slot-entry').forEach(e => e.remove());
        if (imageContainer) imageContainer.classList.add('visible');

        if (data) {
            updatePlayerImage(data.class);
            classSelect.value = data.class;
            cpInput.value = formatCP(data.combat_power);
            teamSelect.value = data.team || 'No Team';
            guildSelect.value = data.guild || '';
            notesInput.value = data.notes || '';
            if (data.play_slots && data.play_slots.length > 0) {
                data.play_slots.forEach(slot => createTimeSlot(slot.start_minutes, slot.end_minutes));
            } else { createTimeSlot(); }
            classSelect.required = false;
        } else {
            updatePlayerImage('new');
            classSelect.value = ''; cpInput.value = ''; teamSelect.value = 'No Team'; guildSelect.value = ''; notesInput.value = '';
            createTimeSlot();
            classSelect.required = true;
        }
        if (formDetails) formDetails.classList.add('visible');
        validateForm();
    }
    
    if (classSelect) classSelect.addEventListener('input', () => {
        updatePlayerImage(classSelect.value);
        validateForm();
    });
    if (cpInput) cpInput.addEventListener('input', validateForm);

    document.querySelectorAll('.play-hours-cell').forEach(cell => { 
        const start = parseInt(cell.dataset.startMinutes, 10); 
        const end = parseInt(cell.dataset.endMinutes, 10); 
        if (!isNaN(start)) { 
            cell.innerHTML = `${minutesToFormattedTime(start)} - ${minutesToFormattedTime(end)}`; 
        } 
    });
    
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replace('_', ' ');
    const tzNote = document.getElementById('local-timezone-note');
    if (tzNote) tzNote.textContent = `(${userTimezone})`;
    const tableTzNote = document.getElementById('table-timezone-note');
    if (tableTzNote) tableTzNote.textContent = `(${userTimezone})`;
}
