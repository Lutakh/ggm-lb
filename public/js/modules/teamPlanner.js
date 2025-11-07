// public/js/modules/teamPlanner.js
import { openModal as openPlayerSelectModal } from './playerSelectModal.js';
import { formatCP } from './utils.js';

let allActivities = [];
let currentUserPlayerId = null; // Pour savoir si on a déjà rejoint une activité

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

// --- Données statiques pour les sous-types ---
const ACTIVITY_OPTIONS = {
    'Perilous Trial': { label: 'Select PT', options: [] }, // Sera rempli dynamiquement avec les PTs disponibles
    'Wave of Horror': { label: 'Level & Difficulty', options: [
            'Lv.1 - Easy', 'Lv.1 - Normal', 'Lv.1 - Hard', 'Lv.1 - Torment',
            'Lv.2 - Easy', 'Lv.2 - Normal', 'Lv.2 - Hard', 'Lv.2 - Torment',
            'Lv.3 - Easy', 'Lv.3 - Normal', 'Lv.3 - Hard', 'Lv.3 - Torment'
        ] },
    'Echo of Battlefield': { label: 'Mode', options: ['Standard'] },
    'Echo of War': { label: 'Boss', options: ['Current Boss'] },
    'Dragon Hunt': { label: 'Difficulty', options: ['CC0 (Lv.65+)', 'CC1 (Lv.150+)', 'CC2 (Lv.250+)'] } // À affiner selon votre logique CC
};

// --- Initialisation ---
export function initTeamPlanner(perilousTrialsList, currentCC) {
    // Remplir les options PT si fournies
    if (perilousTrialsList && Array.isArray(perilousTrialsList)) {
        ACTIVITY_OPTIONS['Perilous Trial'].options = perilousTrialsList.map(pt => pt.name);
    }
    // Ajuster Dragon Hunt selon CC actuel (logique simplifiée ici, à adapter)
    if (currentCC < 1) ACTIVITY_OPTIONS['Dragon Hunt'].options = ACTIVITY_OPTIONS['Dragon Hunt'].options.slice(0, 1);
    else if (currentCC < 2) ACTIVITY_OPTIONS['Dragon Hunt'].options = ACTIVITY_OPTIONS['Dragon Hunt'].options.slice(0, 2);

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
            currentUserPlayerId = id; // On suppose que l'utilisateur est celui qu'il sélectionne
        });
    });
    if (createForm) createForm.addEventListener('submit', handleCreateSubmit);

    // Promo Banner sur la home
    initPromoBanner();

    // Chargement initial
    fetchActivities();

    // Rafraîchir toutes les minutes
    setInterval(fetchActivities, 60000);
}

function initPromoBanner() {
    const promoBanner = document.getElementById('home-promo-banner');
    const closePromoBtn = document.getElementById('close-promo-btn');
    const promoPlannerBtn = document.getElementById('promo-planner-btn');

    // Afficher seulement si sur 'home' et pas déjà fermé
    const urlParams = new URLSearchParams(window.location.search);
    const currentSection = urlParams.get('section') || 'home';

    if (promoBanner && currentSection === 'home' && !localStorage.getItem('tp_promo_closed')) {
        promoBanner.style.display = 'block';
    }

    if (closePromoBtn) {
        closePromoBtn.addEventListener('click', () => {
            promoBanner.style.display = 'none';
            localStorage.setItem('tp_promo_closed', 'true');
        });
    }
    if (promoPlannerBtn) {
        promoPlannerBtn.addEventListener('click', () => {
            // Simuler un clic sur le lien de navigation
            document.querySelector('.sidebar-btn[data-target="team-planner-section"]')?.click();
        });
    }
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

    const showOnlyOpen = filterOpenEl ? filterOpenEl.checked : false;
    const now = new Date();

    let filtered = allActivities.filter(act => new Date(act.scheduled_time) > now); // Seulement futures

    if (showOnlyOpen) {
        filtered = filtered.filter(act => {
            const max = (act.activity_type === 'Echo of War' || act.activity_type === 'Dragon Hunt') ? 6 : 4;
            return (act.participants?.length || 0) < max;
        });
    }

    if (filtered.length === 0) {
        activitiesListEl.innerHTML = '<div class="tp-loading-placeholder">No upcoming activities found based on filters.</div>';
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

        // Participants
        card.querySelector('.tp-participant-count').textContent = `(${currentPlayers}/${maxPlayers})`;
        const participantsList = card.querySelector('.tp-participants-list');
        let hasTank = false;
        let hasHeal = false;
        const guilds = new Set();

        // Lister les participants existants
        if (act.participants) {
            act.participants.forEach(p => {
                const pEl = document.createElement('div');
                pEl.className = 'tp-participant';
                pEl.innerHTML = `
                    <span>
                        <span class="class-tag class-${p.class.toLowerCase()}">${p.class.substring(0,3)}</span>
                        ${p.name}
                    </span>
                    <span style="font-size:0.8em; opacity:0.7;">${formatCP(p.combat_power)}</span>
                `;
                participantsList.appendChild(pEl);

                if (p.class === 'Swordbearer') hasTank = true;
                if (p.class === 'Acolyte') hasHeal = true;
                if (p.guild) guilds.add(p.guild);
            });
        }

        // Remplir les slots vides
        for (let i = currentPlayers; i < maxPlayers; i++) {
            const empty = document.createElement('div');
            empty.className = 'tp-participant empty-slot';
            empty.textContent = 'Empty Slot';
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

        // Footer & Actions
        card.querySelector('.tp-creator-name').textContent = act.creator_name || 'Unknown';
        const actionsEl = card.querySelector('.tp-card-actions');
        const joinBtn = actionsEl.querySelector('.tp-join-btn');

        // Déterminer si l'utilisateur actuel est déjà inscrit (si on a un ID)
        const isJoined = currentUserPlayerId && act.participants?.some(p => p.id === currentUserPlayerId);

        if (isJoined) {
            joinBtn.textContent = 'Leave';
            joinBtn.style.backgroundColor = 'var(--accent-color)'; // Rouge pour Leave
            joinBtn.onclick = () => handleLeave(act.id);
        } else if (currentPlayers >= maxPlayers) {
            joinBtn.textContent = 'Full';
            joinBtn.disabled = true;
            joinBtn.style.opacity = '0.5';
            joinBtn.style.cursor = 'not-allowed';
        } else {
            joinBtn.onclick = () => handleJoin(act.id);
        }

        // Bouton Admin Delete (pourrait être protégé par mot de passe comme ailleurs)
        // Pour simplifier l'UI, on peut ajouter un petit icône corbeille discret
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete (Admin)';
        deleteBtn.onclick = () => handleDelete(act.id);
        actionsEl.appendChild(deleteBtn);

        activitiesListEl.appendChild(card);
    });
}

// --- Actions (Create, Join, Leave, Delete) ---
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
    // Pré-remplir la date/heure avec maintenant + 1h
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
    // Combiner date et heure en ISO string UTC pour le serveur
    const dateStr = formData.get('tp-date-input') || document.getElementById('tp-date-input').value;
    const timeStr = formData.get('tp-time-input') || document.getElementById('tp-time-input').value;
    const localDateTime = new Date(`${dateStr}T${timeStr}`);
    const utcIsoTime = localDateTime.toISOString();

    const payload = {
        activity_type: formData.get('activity_type'),
        activity_subtype: document.getElementById('tp-subtype-select').value, // Lire directement car parfois masqué
        scheduled_time: utcIsoTime,
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
            fetchActivities(); // Rafraîchir la liste
            // alert('Activity created!');
        } else {
            alert('Failed to create activity.');
        }
    } catch (err) { console.error(err); alert('Error creating activity.'); }
}

function handleJoin(activityId) {
    // Ouvrir la modale de sélection de joueur pour savoir QUI rejoint
    openPlayerSelectModal({ type: 'teamPlannerJoin' }, async (playerId, playerName) => {
        if (!playerId) return;
        currentUserPlayerId = playerId; // Mémoriser qui utilise l'app
        try {
            const res = await fetch('/team-planner/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activity_id: activityId, player_id: playerId })
            });
            if (res.ok) fetchActivities();
            else {
                const data = await res.json();
                alert(data.error || 'Failed to join.');
            }
        } catch (err) { console.error(err); }
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