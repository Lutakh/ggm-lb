import { formatCP, minutesToTimeValue, minutesToFormattedTime } from './utils.js';

export function initPlayerForm() {
    const form = document.getElementById('player-form'); 
    if (!form) return;

    const formDetails = document.getElementById('form-details'); 
    const imageContainer = document.getElementById('player-image-container'); 
    const submitBtn = document.getElementById('submit-btn');
    const nameInput = document.getElementById('name-input'); 
    const classSelect = document.getElementById('class-select'); 
    const cpInput = document.getElementById('cp-input'); 
    const teamSelect = document.getElementById('team-select'); 
    const guildSelect = document.getElementById('guild-select');
    const notesInput = document.getElementById('notes-input'); 
    const slotsContainer = document.getElementById('time-slots-container'); 
    const addSlotBtn = document.getElementById('add-slot-btn'); 
    const findPlayerBtn = document.getElementById('find-player-btn');
    const classImages = { new: `<img src="/images/new-player.png" alt="New Player">`, Tank: `<img src="/images/Tank.png" alt="Tank Class">`, Heal: `<img src="/images/Heal.png" alt="Heal Class">`, DPS: `<img src="/images/DPS.png" alt="DPS Class">`};
    
    function validateForm() { 
        const isValid = nameInput.value.trim() !== '' && classSelect.value.trim() !== '' && cpInput.value.trim() !== ''; 
        submitBtn.disabled = !isValid;
    }
    [nameInput, classSelect, cpInput].forEach(field => field.addEventListener('input', validateForm));
    
    function createTimeSlot(startMinutes = null, endMinutes = null) {
        const entry = document.createElement('div');
        entry.className = 'time-slot-entry';
        entry.innerHTML = `<div class="hours-inputs"><input type="time" name="play_start[]" value="${minutesToTimeValue(startMinutes)}"><span class="separator">-</span><input type="time" name="play_end[]" value="${minutesToTimeValue(endMinutes)}"></div><button type="button" class="remove-slot-btn">🗑️</button>`;
        slotsContainer.appendChild(entry);
        entry.querySelector('.remove-slot-btn').addEventListener('click', () => entry.remove());
    }
    addSlotBtn.addEventListener('click', () => createTimeSlot());
    
    function updatePlayerImage(className) { imageContainer.innerHTML = classImages[className] || classImages.new; }

    async function findPlayer() {
        const name = nameInput.value.trim();
        if (!name) { alert("Please enter a player name."); return; }
        const notification = document.querySelector('.notification');
        if (notification) notification.style.display = 'none';
        const response = await fetch(`/player-details/${encodeURIComponent(name)}`);
        const data = await response.json();
        document.querySelectorAll('.time-slot-entry').forEach(e => e.remove());
        imageContainer.classList.add('visible');
        if (data) {
            updatePlayerImage(data.class);
            classSelect.value = data.class; 
            cpInput.value = formatCP(data.combat_power); 
            teamSelect.value = data.team || 'No Team';
            guildSelect.value = data.guild || '';
            notesInput.value = data.notes || '';
            if (data.play_slots && data.play_slots.length > 0) { 
                data.play_slots.forEach(slot => createTimeSlot(slot.start_minutes, slot.end_minutes)); 
            } else { 
                createTimeSlot();
            }
            classSelect.required = false;
        } else {
            updatePlayerImage('new');
            classSelect.value = ''; cpInput.value = ''; teamSelect.value = ''; guildSelect.value = ''; notesInput.value = '';
            createTimeSlot();
            classSelect.required = true;
        }
        formDetails.classList.add('visible');
        validateForm();
    }
    findPlayerBtn.addEventListener('click', findPlayer);
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); findPlayerBtn.click(); } });
    classSelect.addEventListener('input', () => updatePlayerImage(classSelect.value));
    [cpInput, notesInput].forEach(input => { input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!submitBtn.disabled) { submitBtn.click(); } } }); });
    
    document.querySelectorAll('.play-hours-cell').forEach(cell => { 
        const start = parseInt(cell.dataset.startMinutes, 10); 
        const end = parseInt(cell.dataset.endMinutes, 10); 
        if (!isNaN(start)) { 
            cell.innerHTML = `${minutesToFormattedTime(start)} - ${minutesToFormattedTime(end)}`; 
        } 
    });
    
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replace('_', ' ');
    document.getElementById('local-timezone-note').textContent = `(${userTimezone})`;
    document.getElementById('table-timezone-note').textContent = `(${userTimezone})`;
}
