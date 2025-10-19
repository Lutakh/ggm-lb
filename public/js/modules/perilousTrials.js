import { formatCP } from './utils.js';

export function initPerilousTrials() {
    let fullGlobalLeaderboard = [];

    // --- SÉLECTEURS DU DOM ---
    const helpBtn = document.getElementById('pt-help-btn');
    const helpModal = document.getElementById('pt-help-modal');
    const helpBackdrop = document.getElementById('pt-help-modal-backdrop');
    const helpCloseBtn = document.getElementById('pt-help-close-btn');
    const ptSelect = document.getElementById('pt-select');
    const ptTable = document.getElementById('pt-leaderboard-table');
    const ptTableBody = ptTable?.querySelector('tbody');
    const ptGlobalTable = document.getElementById('pt-global-leaderboard-table');
    const ptGlobalTableBody = ptGlobalTable?.querySelector('tbody');
    const ptClassFilterBtn = document.getElementById('pt-class-filter-btn');
    const ptClassFilterPanel = document.getElementById('pt-class-filter-panel');
    const ptClassFilters = document.querySelectorAll('#pt-class-filter-panel input');
    const ptAdminForm = document.getElementById('pt-admin-form');

    // --- GESTION DE LA MODALE D'AIDE ---
    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            if (helpModal) helpModal.style.display = 'flex';
            if (helpBackdrop) helpBackdrop.style.display = 'block';
        });
    }
    const closeHelpModal = () => {
        if (helpModal) helpModal.style.display = 'none';
        if (helpBackdrop) helpBackdrop.style.display = 'none';
    };
    if (helpCloseBtn) helpCloseBtn.addEventListener('click', closeHelpModal);
    if (helpBackdrop) helpBackdrop.addEventListener('click', closeHelpModal);

    // --- GESTION DES CLASSEMENTS ET FILTRES ---
    function applyGlobalPtFilters() {
        // ... (Code inchangé)
    }

    async function loadPtLeaderboard(ptId) {
        // ... (Code inchangé)
    }

    if (ptSelect) {
        ptSelect.addEventListener('change', () => {
            loadPtLeaderboard(ptSelect.value);
            // CORRECTION : Mettre à jour le rang quand on change manuellement
            if (ptAdminForm) findNextAvailableRank(ptSelect.value);
        });
    }

    ptClassFilters.forEach(input => input.addEventListener('change', applyGlobalPtFilters));


    // --- GESTION DU FORMULAIRE D'ADMINISTRATION ---
    if (!ptAdminForm) return;

    const modal = document.getElementById('pt-player-select-modal');
    const backdrop = document.getElementById('pt-player-select-modal-backdrop');
    const filterInput = document.getElementById('pt-player-filter-input');
    const playerListContainer = document.getElementById('pt-player-select-list');
    const closeModalBtn = document.getElementById('pt-player-select-close-btn');
    const createPlayerBtn = document.getElementById('pt-create-new-player-btn');
    const submitBtn = ptAdminForm.querySelector('button[type="submit"]');
    const ptIdInput = document.getElementById('pt-id-input');
    const ptRankInput = document.getElementById('pt-team-rank');
    const playersDataElement = document.getElementById('pt-players-data-source');
    const allPlayers = playersDataElement ? JSON.parse(playersDataElement.textContent) : [];
    const guildDatalist = document.getElementById('guild-datalist-pt');
    let availableGuilds = guildDatalist ? Array.from(guildDatalist.options).map(opt => opt.value) : [];
    let activePlayerIndex = null;
    let activeSuggestionIndex = -1;

    async function findNextAvailableRank(ptId) {
        if (!ptId || ptId === 'global') {
            ptRankInput.value = '';
            validatePtForm();
            return;
        }
        try {
            const response = await fetch(`/pt-leaderboard/${ptId}/next-rank`);
            const data = await response.json();
            ptRankInput.value = data.nextRank || 1;
        } catch (error) {
            console.error('Failed to fetch next rank:', error);
            ptRankInput.value = 1;
        } finally {
            validatePtForm();
        }
    }

    // --- GESTION DE LA MODALE DE SÉLECTION DE JOUEUR ---
    // ... (Code inchangé pour openModal, closeModal, populatePlayerList, selectPlayer)

    // --- GESTION DU SÉLECTEUR DE GUILDE PERSONNALISÉ ---
    document.querySelectorAll('.custom-guild-select').forEach(container => {
        const input = container.querySelector('.guild-select-input');
        const panel = container.querySelector('.guild-select-panel');
        let guildSuggestionIndex = -1;

        const updateActiveGuildSuggestion = () => {
            panel.querySelectorAll('.guild-option').forEach((opt, index) => {
                opt.classList.toggle('active', index === guildSuggestionIndex);
            });
        };

        const populateGuildOptions = (filter = '') => {
            panel.innerHTML = '';
            guildSuggestionIndex = -1;
            const lowerFilter = filter.toLowerCase();

            const filteredGuilds = availableGuilds.filter(g => g.toLowerCase().includes(lowerFilter));
            filteredGuilds.forEach(guild => {
                const option = document.createElement('div');
                option.className = 'guild-option';
                option.textContent = guild;
                option.addEventListener('mousedown', () => { // mousedown pour se déclencher avant le 'blur' de l'input
                    input.value = guild;
                    validatePtForm();
                });
                panel.appendChild(option);
            });

            if (filter && !availableGuilds.some(g => g.toLowerCase() === lowerFilter)) {
                const createOption = document.createElement('div');
                createOption.className = 'guild-option create-new';
                createOption.textContent = `Create "${filter}"`;
                createOption.addEventListener('mousedown', () => {
                    const newGuildName = filter.trim();
                    input.value = newGuildName;
                    if (!availableGuilds.some(g => g.toLowerCase() === newGuildName.toLowerCase())) {
                        availableGuilds.push(newGuildName);
                    }
                    validatePtForm();
                });
                panel.appendChild(createOption);
            }
        };

        input.addEventListener('focus', () => {
            populateGuildOptions(input.value);
            container.classList.add('open');
        });
        input.addEventListener('blur', () => setTimeout(() => container.classList.remove('open'), 150));
        input.addEventListener('input', () => {
            if (!container.classList.contains('open')) container.classList.add('open');
            populateGuildOptions(input.value);
            validatePtForm();
        });
        input.addEventListener('keydown', (e) => {
            const options = panel.querySelectorAll('.guild-option');
            if (!options.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                guildSuggestionIndex = (guildSuggestionIndex + 1) % options.length;
                updateActiveGuildSuggestion();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                guildSuggestionIndex = (guildSuggestionIndex - 1 + options.length) % options.length;
                updateActiveGuildSuggestion();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (guildSuggestionIndex > -1 && options[guildSuggestionIndex]) {
                    options[guildSuggestionIndex].dispatchEvent(new MouseEvent('mousedown'));
                } else if (options.length > 0) {
                    options[0].dispatchEvent(new MouseEvent('mousedown'));
                }
                container.classList.remove('open');
            }
        });
    });

    // --- VALIDATION DU FORMULAIRE ---
    const validatePtForm = () => {
        const ptId = ptIdInput.value;
        const rank = ptRankInput.value;
        let playerCount = 0;
        const names = new Set();
        let isFormValid = true;

        for (let i = 0; i < 4; i++) {
            const name = ptAdminForm.querySelector(`#pt-player-name-hidden-${i}`).value.trim();
            if (name) {
                playerCount++;
                names.add(name.toLowerCase());
                const isExistingPlayer = allPlayers.some(p => p.name.toLowerCase() === name.toLowerCase());
                if (!isExistingPlayer) {
                    const classInput = ptAdminForm.querySelector(`select[name="players[${i}][class]"]`);
                    const cpInput = ptAdminForm.querySelector(`input[name="players[${i}][cp]"]`);
                    if (!classInput.value || !cpInput.value.trim()) {
                        isFormValid = false;
                    }
                }
            }
        }

        if (playerCount > 0 && playerCount !== names.size) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Duplicate Players';
            submitBtn.style.backgroundColor = 'var(--accent-color)';
            return;
        } else {
            submitBtn.textContent = 'Submit Team';
            submitBtn.style.backgroundColor = '';
        }

        if (!ptId || !rank || playerCount !== 4 || !isFormValid) {
            submitBtn.disabled = true;
        } else {
            submitBtn.disabled = false;
        }
    };

    // --- INITIALISATION ---
    const urlParams = new URLSearchParams(window.location.search);
    const sectionFromUrl = urlParams.get('section');
    const ptIdFromUrl = urlParams.get('pt_id');

    if (sectionFromUrl === 'perilous-trials-section' && ptIdFromUrl) {
        ptSelect.value = ptIdFromUrl;
        loadPtLeaderboard(ptIdFromUrl);
        // CORRECTION : Mettre à jour le rang au chargement de la page après redirection
        findNextAvailableRank(ptIdFromUrl);
    } else {
        loadPtLeaderboard(ptSelect.value);
        findNextAvailableRank(ptSelect.value);
    }

    // Attacher les écouteurs d'événements
    ptIdInput.addEventListener('change', () => findNextAvailableRank(ptIdInput.value));
    ptRankInput.addEventListener('input', validatePtForm);
    ptAdminForm.querySelectorAll('select, input').forEach(input => {
        const eventType = ['SELECT', 'INPUT'].includes(input.tagName) ? (input.type === 'text' || input.type === 'number' ? 'input' : 'change') : 'change';
        input.addEventListener(eventType, validatePtForm);
    });
}