// public/js/modules/perilousTrials.js
import { formatCP } from './utils.js';
// IMPORTANT : On importe la modale partagée
import { openModal } from './playerSelectModal.js';

export function initPerilousTrials(showPlayerDetails, allPlayersMap) {
    let fullGlobalLeaderboard = [];

    // --- SÉLECTEURS DU DOM ---
    const helpBtns = document.querySelectorAll('#pt-help-btn-desktop, #pt-help-btn-mobile');
    const helpModal = document.getElementById('pt-help-modal');
    const helpBackdrop = document.getElementById('pt-help-modal-backdrop');
    const helpCloseBtn = document.getElementById('pt-help-close-btn');

    // Filtres Desktop
    const ptSelect = document.getElementById('pt-select');
    const ptGlobalModeSelector = document.getElementById('pt-global-mode-selector');
    const ptGlobalMode = document.getElementById('pt-global-mode');

    // Filtres Modale Mobile
    const openPtFiltersBtn = document.getElementById('open-pt-filters-btn');
    const ptFiltersModal = document.getElementById('pt-filters-modal');
    const ptFiltersBackdrop = document.getElementById('pt-filters-modal-backdrop');
    const ptFiltersCloseBtn = document.getElementById('pt-filters-modal-close-btn');
    const ptFiltersModalSelect = document.getElementById('pt-filters-modal-select');
    const ptFiltersModalMode = document.getElementById('pt-filters-modal-mode');
    const ptFiltersModalModeSelector = document.getElementById('pt-filters-modal-mode-selector');

    // Tableaux
    const ptTable = document.getElementById('pt-leaderboard-table');
    const ptTableBody = ptTable?.querySelector('tbody');
    const ptGlobalTable = document.getElementById('pt-global-leaderboard-table');
    const ptGlobalTableBody = ptGlobalTable?.querySelector('tbody');
    const ptClassFilters = document.querySelectorAll('#pt-class-filter-panel input');

    // Admin
    const ptAdminForm = document.getElementById('pt-admin-form');

    // Définition de la fonction pour qu'elle soit accessible dans tout le module
    let findNextAvailableRank = async (ptId) => {};

    // --- GESTION DE LA MODALE D'AIDE ---
    if (helpBtns.length > 0) {
        helpBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (helpModal) helpModal.style.display = 'flex';
                if (helpBackdrop) helpBackdrop.style.display = 'block';
            });
        });
    }
    const closeHelpModal = () => {
        if (helpModal) helpModal.style.display = 'none';
        if (helpBackdrop) helpBackdrop.style.display = 'none';
    };
    if (helpCloseBtn) helpCloseBtn.addEventListener('click', closeHelpModal);
    if (helpBackdrop) helpBackdrop.addEventListener('click', closeHelpModal);

    // --- GESTION DE LA MODALE DE FILTRES PT ---
    const openPtFiltersModal = () => {
        if (ptFiltersModal) ptFiltersModal.style.display = 'flex';
        if (ptFiltersBackdrop) ptFiltersBackdrop.style.display = 'block';
    };
    const closePtFiltersModal = () => {
        if (ptFiltersModal) ptFiltersModal.style.display = 'none';
        if (ptFiltersBackdrop) ptFiltersBackdrop.style.display = 'none';
    };

    if (openPtFiltersBtn) openPtFiltersBtn.addEventListener('click', openPtFiltersModal);
    if (ptFiltersCloseBtn) ptFiltersCloseBtn.addEventListener('click', closePtFiltersModal);
    if (ptFiltersBackdrop) ptFiltersBackdrop.addEventListener('click', closePtFiltersModal);

    // Synchronisation des filtres (Modale -> Desktop)
    if (ptFiltersModalSelect) {
        ptFiltersModalSelect.addEventListener('change', () => {
            const newPtId = ptFiltersModalSelect.value;
            if (ptSelect) ptSelect.value = newPtId; // Sync desktop
            loadPtLeaderboard(newPtId);
            if (ptAdminForm) {
                const ptIdInput = ptAdminForm.querySelector('#pt-id-input');
                if (ptIdInput) ptIdInput.value = newPtId;
                findNextAvailableRank(newPtId); // Mettre à jour le rang lors du changement
            }
            closePtFiltersModal();
        });
    }

    if (ptFiltersModalMode) {
        ptFiltersModalMode.addEventListener('change', () => {
            if (ptGlobalMode) ptGlobalMode.value = ptFiltersModalMode.value; // Sync desktop
            if (ptSelect.value === 'global') {
                loadPtLeaderboard('global');
            }
            closePtFiltersModal();
        });
    }

    // Synchronisation des filtres (Desktop -> Modale)
    const syncFiltersToModal = () => {
        if (ptSelect && ptFiltersModalSelect) {
            ptFiltersModalSelect.value = ptSelect.value;
        }
        if (ptGlobalMode && ptFiltersModalMode) {
            ptFiltersModalMode.value = ptGlobalMode.value;
        }
        if (ptFiltersModalModeSelector) {
            ptFiltersModalModeSelector.style.display = (ptSelect && ptSelect.value === 'global') ? 'block' : 'none';
        }
    };


    // --- GESTION DES CLASSEMENTS ET FILTRES ---
    function applyGlobalPtFilters() {
        if (!ptGlobalTableBody) return;

        const selectedClasses = Array.from(ptClassFilters)
            .filter(c => c.checked)
            .map(c => c.dataset.class);

        const filteredLeaderboard = fullGlobalLeaderboard.filter(player => {
            return selectedClasses.length === 0 || selectedClasses.includes(player.class);
        });

        ptGlobalTableBody.innerHTML = '';

        if (filteredLeaderboard.length === 0) {
            ptGlobalTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No data for the global ranking yet.</td></tr>';
        }

        filteredLeaderboard.forEach((player, index) => {
            const rank = index + 1;
            const row = document.createElement('tr');
            row.classList.add('podium');
            if (rank <= 3) {
                row.classList.add(`rank-${rank}`);
            }
            row.dataset.playerName = player.name;

            row.innerHTML = `
                <td class="rank-col">${rank}</td>
                <td class="player-name-cell pt-global-player-col"><span class="class-tag class-${String(player.class || 'unknown').toLowerCase()}">${player.name}</span></td>
                <td class="cp-display pt-global-cp-col" data-cp="${player.combat_power}">${formatCP(player.combat_power)}</td>
                <td>${player.points}</td>
            `;
            ptGlobalTableBody.appendChild(row);
        });

        const ptFilterBtn = document.getElementById('pt-class-filter-btn');
        if (ptFilterBtn) {
            const span = ptFilterBtn.querySelector('span');
            if (span) {
                span.textContent = selectedClasses.length > 0 ? `Player (${selectedClasses.length})` : 'Player';
            }
            ptFilterBtn.classList.toggle('active', selectedClasses.length > 0);
        }
    }

    async function loadPtLeaderboard(ptId) {
        if (!ptId || !ptTableBody || !ptGlobalTable) return;
        const isGlobal = ptId === 'global';

        ptTable.style.display = isGlobal ? 'none' : 'table';
        ptGlobalTable.style.display = isGlobal ? 'table' : 'none';
        if (ptGlobalModeSelector) {
            ptGlobalModeSelector.style.display = isGlobal ? 'flex' : 'none';
        }

        syncFiltersToModal();

        if (isGlobal) {
            const mode = ptGlobalMode ? ptGlobalMode.value : 'all';
            const response = await fetch(`/pt-leaderboard/global?mode=${mode}`);
            fullGlobalLeaderboard = await response.json();
            applyGlobalPtFilters();
        } else {
            const response = await fetch(`/pt-leaderboard/${ptId}`);
            const leaderboard = await response.json();
            ptTableBody.innerHTML = '';
            if (leaderboard.length === 0) {
                ptTableBody.innerHTML = '<tr><td colspan="2" style="text-align: center;">No data yet.</td></tr>';
                return;
            }
            leaderboard.forEach(entry => {
                let teamHtml = '<div class="pt-leaderboard-team">';
                for (let i = 1; i <= 4; i++) {
                    const name = entry[`player${i}_name`];
                    const pClass = entry[`player${i}_class`];
                    if (name) {
                        teamHtml += `<div class="pt-leaderboard-player"><span class="class-tag class-${(pClass || 'unknown').toLowerCase()}">${name}</span></div>`;
                    }
                }
                teamHtml += '</div>';
                const row = document.createElement('tr');
                row.classList.add('podium');
                if (entry.rank <= 3) row.classList.add(`rank-${entry.rank}`);
                row.innerHTML = `<td class="rank-col">${entry.rank}</td><td>${teamHtml}</td>`;
                ptTableBody.appendChild(row);
            });
        }
    }

    // --- GESTIONNAIRES D'ÉVÉNEMENTS (Classements) ---
    if (ptSelect) {
        ptSelect.addEventListener('change', () => {
            const newPtId = ptSelect.value;
            loadPtLeaderboard(newPtId);
            if (ptAdminForm) {
                const ptIdInput = ptAdminForm.querySelector('#pt-id-input');
                if (ptIdInput) ptIdInput.value = newPtId;
                findNextAvailableRank(newPtId);
            }
        });
    }

    if (ptGlobalMode) {
        ptGlobalMode.addEventListener('change', () => {
            if (ptSelect.value === 'global') {
                loadPtLeaderboard('global');
            }
            syncFiltersToModal();
        });
    }

    ptClassFilters.forEach(input => input.addEventListener('change', applyGlobalPtFilters));

    if (ptGlobalTableBody) {
        ptGlobalTableBody.addEventListener('click', (e) => {
            const playerRow = e.target.closest('tr');
            const clickedPlayerCell = e.target.closest('.pt-global-player-col');

            if (!playerRow || !playerRow.dataset.playerName || !clickedPlayerCell) return;

            if (!showPlayerDetails) {
                console.error("showPlayerDetails function is not available.");
                return;
            }

            e.preventDefault();
            const playerName = playerRow.dataset.playerName;
            const player = allPlayersMap.get(playerName);

            if (player) {
                const fakeRow = {
                    dataset: {
                        ...player,
                        rank: playerRow.querySelector('.rank-col')?.textContent || 'N/A',
                        cp: player.combat_power,
                        playSlots: JSON.stringify(player.play_slots || '[]'),
                        updated: player.updated_at,
                        notes: player.notes || '-',
                        ptTags: JSON.stringify(player.pt_tags || '[]')
                    }
                };
                showPlayerDetails(fakeRow);
            }
        });
    }


    // --- GESTION DU FORMULAIRE D'ADMINISTRATION ---
    if (ptAdminForm) {
        const submitBtn = ptAdminForm.querySelector('button[type="submit"]');
        const ptIdInput = document.getElementById('pt-id-input');
        const ptRankInput = document.getElementById('pt-team-rank');

        // Fonction de validation du formulaire
        const validatePtForm = () => {
            const ptId = ptIdInput.value;
            const rank = parseInt(ptRankInput.value, 10);
            let playersSelectedCount = 0;
            let formIsValid = true;

            for (let i = 0; i < 4; i++) {
                const nameInput = document.getElementById(`pt-player-name-hidden-${i}`);
                const name = nameInput ? nameInput.value : '';

                if (name) {
                    playersSelectedCount++;
                    // Utilisation de allPlayersMap pour vérifier si le joueur existe
                    if (!allPlayersMap.has(name)) {
                        // C'est un nouveau joueur, on doit vérifier que Classe et CP sont remplis
                        const classSelect = document.querySelector(`select[name="players[${i}][class]"]`);
                        const cpInput = document.querySelector(`input[name="players[${i}][cp]"]`);
                        // Correction : vérification plus stricte
                        if (!classSelect || classSelect.value === "" || !cpInput || cpInput.value.trim() === "") {
                            formIsValid = false;
                            break;
                        }
                    }
                }
            }
            submitBtn.disabled = !(ptId && rank > 0 && playersSelectedCount === 4 && formIsValid);
        };

        // Callback appelé quand un joueur est sélectionné (ou créé) via la modale
        const handlePtPlayerSelection = (playerId, playerName, triggerContext) => {
            const index = triggerContext.index;
            const player = allPlayersMap.get(playerName);

            const nameDisplay = document.getElementById(`pt-player-display-${index}`);
            const nameHidden = document.getElementById(`pt-player-name-hidden-${index}`);
            const newPlayerFieldsContainer = document.getElementById(`pt-new-player-fields-${index}`);
            const classSelect = newPlayerFieldsContainer.querySelector(`select[name="players[${index}][class]"]`);
            const guildInput = newPlayerFieldsContainer.querySelector(`input[name="players[${index}][guild]"]`);
            const cpInput = newPlayerFieldsContainer.querySelector(`input[name="players[${index}][cp]"]`);

            // Mise à jour de l'affichage
            nameDisplay.textContent = playerName;
            nameHidden.value = playerName;
            newPlayerFieldsContainer.style.display = 'grid';

            if (player) {
                // Joueur existant : on cache les champs inutiles, on laisse le CP optionnel pour mise à jour
                classSelect.style.display = 'none';
                classSelect.required = false;
                classSelect.value = ""; // Reset

                guildInput.style.display = 'none';
                guildInput.value = ""; // Reset

                cpInput.style.display = 'block';
                cpInput.placeholder = `Update CP (Optional)`;
                cpInput.required = false;
                cpInput.value = '';
            } else {
                // Nouveau joueur : on affiche et requiert les champs
                classSelect.style.display = 'block';
                classSelect.required = true;

                guildInput.style.display = 'block';

                cpInput.style.display = 'block';
                cpInput.placeholder = 'CP (e.g., 1.2M)';
                cpInput.required = true;
                cpInput.value = '';
            }

            validatePtForm();
        };

        // Attacher les écouteurs utilisant le module partagé 'openModal'
        ptAdminForm.querySelectorAll('.pt-open-modal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.playerIndex, 10);
                // On appelle la modale avec allowCreation: true
                openModal(
                    { type: 'ptAdmin', index: index, allowCreation: true },
                    handlePtPlayerSelection
                );
            });
        });

        // --- Custom Guild Select Logic ---
        document.querySelectorAll('.custom-guild-select').forEach(container => {
            const guildInput = container.querySelector('.guild-select-input');
            const guildPanel = container.querySelector('.guild-select-panel');
            // S'assurer que la validation est appelée lors de la saisie manuelle
            guildInput.addEventListener('input', validatePtForm);

            // ... (Le reste de la logique de peuplement du panel de guilde peut être ajoutée ici si nécessaire,
            // ou laissée telle quelle si elle fonctionnait déjà. L'important est l'appel à validatePtForm)
        });

        // Initialisation du rang et validation
        findNextAvailableRank = async (ptId) => {
            if (!ptRankInput) return;
            if (!ptId || ptId === 'global') {
                ptRankInput.value = 1;
                validatePtForm();
                return;
            }
            try {
                const response = await fetch(`/pt-leaderboard/${ptId}/next-rank`);
                const data = await response.json();
                ptRankInput.value = (data && data.nextRank) ? data.nextRank : 1;
            } catch (err) {
                console.error("Error fetching next rank:", err);
                ptRankInput.value = 1;
            } finally {
                validatePtForm();
            }
        };

        if (ptIdInput) ptIdInput.addEventListener('change', () => findNextAvailableRank(ptIdInput.value));
        if (ptRankInput) ptRankInput.addEventListener('input', validatePtForm);

        // Écouteurs pour les champs dynamiques (Classe, CP) pour valider le formulaire
        ptAdminForm.querySelectorAll('.pt-new-player-fields select, .pt-new-player-fields input').forEach(input => {
            input.addEventListener('change', validatePtForm);
            input.addEventListener('input', validatePtForm);
        });

        // Appel initial pour définir le rang
        findNextAvailableRank(ptIdInput.value);
    }

    // --- INITIALISATION FINALE ---
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section');
    let initialPtId = 'global';

    if (section === 'perilous-trials-section') {
        initialPtId = urlParams.get('pt_id') || 'global';
    }

    if (ptSelect) ptSelect.value = initialPtId;
    if (ptFiltersModalSelect) ptFiltersModalSelect.value = initialPtId;

    loadPtLeaderboard(initialPtId);

    if (ptAdminForm && document.getElementById('pt-id-input')) {
        document.getElementById('pt-id-input').value = initialPtId;
        findNextAvailableRank(initialPtId);
    }
}