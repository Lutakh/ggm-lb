// public/js/modules/teamPlanner.js
import { openModal as openPlayerSelectModal } from './playerSelectModal.js';
import { formatCP } from './utils.js';

let allActivities = [];
let currentUserPlayerId = null;

// --- Éléments du DOM ---
const activitiesListEl = document.getElementById('tp-activities-list');
const filterOpenEl = document.getElementById('tp-filter-open');
const createBtn = document.getElementById('tp-create-btn');
const createModal = document.getElementById('tp-create-modal');
const createBackdrop = document.getElementById('tp-create-modal-backdrop');
const createCloseBtn = document.getElementById('tp-create-close-btn');
const createForm = document.getElementById('tp-create-form');
const typeSelect = document.getElementById('tp-type-select');
const subtypeContainer = document.getElementById('tp-subtype-container');
const subtypeSelect = document.getElementById('tp-subtype-select');
const subtypeLabel = document.getElementById('tp-subtype-label');
const organizerDisplay = document.getElementById('tp-organizer-display');
const organizerIdInput = document.getElementById('tp-organizer-id');
const selectOrganizerBtn = document.getElementById('tp-select-organizer-btn');

// --- Configuration des Activités ---
const ACTIVITY_OPTIONS = {
    'Perilous Trial': { label: 'Select PT', options: [] },
    'Wave of Horror': { label: 'Level & Difficulty', options: [
            'Lv.1 - Easy', 'Lv.1 - Normal', 'Lv.1 - Hard', 'Lv.1 - Torment',
            'Lv.2 - Easy', 'Lv.2 - Normal', 'Lv.2 - Hard', 'Lv.2 - Torment',
            'Lv.3 - Easy', 'Lv.3 - Normal', 'Lv.3 - Hard', 'Lv.3 - Torment'
        ] },
    'Echo of Battlefield': { label: 'Mode', options: ['Standard'] },
    'Echo of War': { label: 'Boss', options: ['Current Boss'] },
    'Dragon Hunt': { label: 'Difficulty', options: ['CC0 (Lv.65+)', 'CC1 (Lv.150+)', 'CC2 (Lv.250+)', 'CC3 (Lv.350+)', 'CC4 (Lv.450+)'] }
};

// --- Initialisation ---
export function initTeamPlanner(perilousTrialsList, currentCC) {
    // Remplir les PTs
    if (perilousTrialsList && Array.isArray(perilousTrialsList)) {
        ACTIVITY_OPTIONS['Perilous Trial'].options = perilousTrialsList.map(pt => pt.name);
    }
    // Ajuster Dragon Hunt selon CC actuel
    const maxDragonOptionIndex = Math.min(currentCC + 1, ACTIVITY_OPTIONS['Dragon Hunt'].options.length);
    ACTIVITY_OPTIONS['Dragon Hunt'].options = ACTIVITY_OPTIONS['Dragon Hunt'].options.slice(0, maxDragonOptionIndex);

    // Listeners
    if (filterOpenEl) filterOpenEl.addEventListener('change', renderActivities);
    if (createBtn) createBtn.addEventListener('click', openCreateModal);
    if (createCloseBtn) createCloseBtn.addEventListener('click', closeCreateModal);
    if (createBackdrop) createBackdrop.addEventListener('click', closeCreateModal);
    if (typeSelect) typeSelect.addEventListener('change', updateSubtypeOptions);
    if (selectOrganizerBtn) selectOrganizerBtn.addEventListener('click', () => {
        openPlayerSelectModal({ type: 'teamPlannerCreator' }, (id, name) => {
            organizerIdInput.value = id;
            organizerDisplay.textContent = name;
            currentUserPlayerId = id;
        });
    });
    if (createForm) createForm.addEventListener('submit', handleCreateSubmit);

    // Chargement initial et boucle de rafraîchissement
    fetchActivities();
    setInterval(fetchActivities, 60000);
}

// --- Fetch & Render ---
async function fetchActivities() {
    try {
        const res = await fetch('/team-planner/activities');
        allActivities = await res.json();
        renderActivities();
    } catch (err) {
        console.error("Error loading activities:", err);
        if (activitiesListEl) activitiesListEl.innerHTML = '<div class="dq-error">Failed to load activities.</div>';
    }
}

function renderActivities() {
    if (!activitiesListEl) return;
    activitiesListEl.innerHTML = '';

    // Vérification simple du mode admin pour afficher le bouton Kick
    const isAdmin = document.body.classList.contains('admin-mode') || sessionStorage.getItem('adminPassword');

    const showOnlyOpen = filterOpenEl ? filterOpenEl.checked : false;
    const now = new Date();

    let filtered = allActivities.filter(act => new Date(act.scheduled_time) > now);

    if (showOnlyOpen) {
        filtered = filtered.filter(act => {
            const max = (act.activity_type === 'Echo of War' || act.activity_type === 'Dragon Hunt') ? 6 : 4;
            return (act.participants?.length || 0) < max;
        });
    }

    if (filtered.length === 0) {
        activitiesListEl.innerHTML = '<div class="tp-loading-placeholder">No upcoming activities found.</div>';
        return;
    }

    const template = document.getElementById('tp-activity-card-template');

    filtered.forEach(act => {
        const card = template.content.cloneNode(true).querySelector('.tp-activity-card');
        const maxPlayers = (act.activity_type === 'Echo of War' || act.activity_type === 'Dragon Hunt') ? 6 : 4;
        const currentPlayers = act.participants?.length || 0;
        const actDate = new Date(act.scheduled_time);

        // Header
        card.querySelector('.tp-activity-title').textContent = act.activity_type;
        card.querySelector('.tp-activity-subtype').textContent = act.activity_subtype || '';
        card.querySelector('.tp-time-date').textContent = actDate.toLocaleDateString();
        card.querySelector('.tp-time-hour').textContent = actDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Participants Header & Count
        card.querySelector('.tp-participant-count').textContent = `(${currentPlayers}/${maxPlayers})`;

        // Bouton [+] discret dans le header si places dispos
        if (currentPlayers < maxPlayers) {
            const addOtherBtn = document.createElement('button');
            addOtherBtn.className = 'tp-add-other-btn';
            addOtherBtn.textContent = '+';
            addOtherBtn.title = 'Add another player manually';
            addOtherBtn.onclick = (e) => { e.stopPropagation(); handleAddOther(act.id); };
            card.querySelector('.tp-participants-header').appendChild(addOtherBtn);
        }

        const participantsList = card.querySelector('.tp-participants-list');
        let hasTank = false;
        let hasHeal = false;
        const guilds = new Set();

        // Liste des participants
        if (act.participants) {
            act.participants.forEach(p => {
                const pEl = document.createElement('div');
                pEl.className = 'tp-participant';
                pEl.innerHTML = `
                    <div class="tp-participant-info">
                        <span class="class-tag class-${p.class.toLowerCase()}">
                            <span class="short-name">${p.class.substring(0,3)}</span>
                            <span class="full-name">${p.class}</span>
                        </span>
                        <span class="tp-player-name">${p.guild ? `[${p.guild}] ` : ''}${p.name}</span>
                    </div>
                    <div style="display: flex; align-items: center;">
                        <span class="tp-player-cp">${formatCP(p.combat_power)}</span>
                        ${isAdmin ? `<button class="tp-kick-btn" title="Kick player (Admin)">❌</button>` : ''}
                    </div>
                `;

                // Listener pour le kick admin
                if (isAdmin) {
                    const kickBtn = pEl.querySelector('.tp-kick-btn');
                    if (kickBtn) kickBtn.onclick = (e) => { e.stopPropagation(); handleKick(act.id, p.id, p.name); };
                }

                participantsList.appendChild(pEl);

                if (p.class === 'Swordbearer') hasTank = true;
                if (p.class === 'Acolyte') hasHeal = true;
                if (p.guild) guilds.add(p.guild);
            });
        }

        // Slots vides (FIX 2 : Cliquables maintenant)
        for (let i = currentPlayers; i < maxPlayers; i++) {
            const empty = document.createElement('div');
            empty.className = 'tp-participant empty-slot';
            empty.textContent = 'Empty Slot';
            empty.title = 'Click to add a player to this slot';
            // Render le slot cliquable pour ajouter quelqu'un
            empty.onclick = (e) => { e.stopPropagation(); handleAddOther(act.id); };
            participantsList.appendChild(empty);
        }

        // Notes
        if (act.notes) {
            card.querySelector('.tp-notes-section').style.display = 'block';
            card.querySelector('.tp-notes-text').textContent = act.notes;
        }

        // Warnings
        const warningsEl = card.querySelector('.tp-warnings-section');
        if (currentPlayers === maxPlayers) {
            if (!hasTank) warningsEl.innerHTML += '<div class="tp-warning">Missing Tank (Swordbearer)</div>';
            if (!hasHeal) warningsEl.innerHTML += '<div class="tp-warning">Missing Healer (Acolyte)</div>';
        }
        if (act.activity_type === 'Echo of Battlefield' && guilds.size > 1) {
            warningsEl.innerHTML += '<div class="tp-warning">Warning: Mixed Guilds for EoB</div>';
        }

        // Footer
        card.querySelector('.tp-creator-name').textContent = act.creator_name || 'Unknown';
        const actionsEl = card.querySelector('.tp-card-actions');
        const joinBtn = actionsEl.querySelector('.tp-join-btn');

        const isJoined = currentUserPlayerId && act.participants?.some(p => p.id === currentUserPlayerId);

        if (isJoined) {
            joinBtn.textContent = 'Leave';
            joinBtn.style.backgroundColor = 'var(--accent-color)';
            joinBtn.onclick = () => handleLeave(act.id);
        } else if (currentPlayers >= maxPlayers) {
            joinBtn.textContent = 'Full';
            joinBtn.disabled = true;
            joinBtn.style.opacity = '0.5';
            joinBtn.style.cursor = 'not-allowed';
        } else {
            joinBtn.onclick = () => handleJoinAsSelf(act.id);
        }

        // Bouton Delete (Admin)
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete Activity (Admin)';
        deleteBtn.onclick = (e) => { e.stopPropagation(); handleDelete(act.id); };
        actionsEl.appendChild(deleteBtn);

        activitiesListEl.appendChild(card);
    });
}

// --- Actions & Handlers ---

function updateSubtypeOptions() {
    const type = typeSelect.value;
    const config = ACTIVITY_OPTIONS[type];
    if (config && config.options.length > 0) {
        subtypeContainer.style.display = 'block';
        subtypeLabel.textContent = config.label + ':';
        subtypeSelect.innerHTML = config.options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
    } else {
        subtypeContainer.style.display = 'none';
        subtypeSelect.innerHTML = '';
    }
}

function openCreateModal() {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
    document.getElementById('tp-date-input').valueAsDate = now;
    document.getElementById('tp-time-input').value = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});

    createModal.style.display = 'flex';
    createBackdrop.style.display = 'block';
}

function closeCreateModal() {
    createModal.style.display = 'none';
    createBackdrop.style.display = 'none';
}

async function handleCreateSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    // Combine date/heure locale pour envoyer en UTC ISO au serveur
    const localDateTime = new Date(`${formData.get('tp-date-input') || document.getElementById('tp-date-input').value}T${formData.get('tp-time-input') || document.getElementById('tp-time-input').value}`);

    const payload = {
        activity_type: formData.get('activity_type'),
        activity_subtype: document.getElementById('tp-subtype-select').value,
        scheduled_time: localDateTime.toISOString(),
        creator_id: formData.get('creator_id'),
        notes: formData.get('notes')
    };

    try {
        const res = await fetch('/team-planner/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            closeCreateModal();
            fetchActivities();
        } else {
            alert('Failed to create activity.');
        }
    } catch (err) {
        console.error(err);
        alert('Error creating activity.');
    }
}

// Fonction générique pour rejoindre
async function joinActivity(activityId, playerId) {
    try {
        const res = await fetch('/team-planner/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activity_id: activityId, player_id: playerId })
        });
        if (res.ok) {
            fetchActivities();
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to join.');
        }
    } catch (err) { console.error(err); }
}

// Rejoindre en tant que soi-même
function handleJoinAsSelf(activityId) {
    openPlayerSelectModal({ type: 'teamPlannerJoin' }, (playerId, playerName) => {
        if (playerId) {
            currentUserPlayerId = playerId; // On mémorise qui est l'utilisateur courant
            joinActivity(activityId, playerId);
        }
    });
}

// Ajouter un autre joueur (via Empty Slot ou bouton +)
function handleAddOther(activityId) {
    openPlayerSelectModal({ type: 'teamPlannerAddOther' }, (playerId, playerName) => {
        if (playerId) {
            joinActivity(activityId, playerId);
        }
    });
}

async function handleLeave(activityId) {
    if (!currentUserPlayerId) return;
    if (!confirm('Are you sure you want to leave this activity?')) return;
    try {
        const res = await fetch('/team-planner/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activity_id: activityId, player_id: currentUserPlayerId })
        });
        if (res.ok) fetchActivities();
    } catch (err) { console.error(err); }
}

async function handleDelete(activityId) {
    const password = prompt("Enter Admin Password to delete this activity:");
    if (!password) return;
    try {
        const res = await fetch('/team-planner/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activity_id: activityId, admin_password: password })
        });
        if (res.ok) fetchActivities();
        else alert('Incorrect password or failed to delete.');
    } catch (err) { console.error(err); }
}

async function handleKick(activityId, playerId, playerName) {
    let password = sessionStorage.getItem('adminPassword');
    if (!password) {
        password = prompt(`Enter Admin Password to kick ${playerName}:`);
    }
    if (!password) return;

    try {
        const res = await fetch('/team-planner/kick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activity_id: activityId, target_player_id: playerId, admin_password: password })
        });
        if (res.ok) {
            fetchActivities();
        } else {
            alert('Failed to kick player (Incorrect password?).');
        }
    } catch (err) { console.error(err); }
}