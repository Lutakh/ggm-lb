// lutakh/ggm-lb/ggm-lb-pt/public/js/modules/perilousTrials.js
import { formatCP } from './utils.js'; //

// Accepte showPlayerDetails et allPlayersMap en arguments
export function initPerilousTrials(showPlayerDetails, allPlayersMap) { //
    let fullGlobalLeaderboard = []; //

    // --- SÉLECTEURS DU DOM ---
    const helpBtns = document.querySelectorAll('#pt-help-btn-desktop, #pt-help-btn-mobile'); //
    const helpModal = document.getElementById('pt-help-modal'); //
    const helpBackdrop = document.getElementById('pt-help-modal-backdrop'); //
    const helpCloseBtn = document.getElementById('pt-help-close-btn'); //

    // Filtres Desktop
    const ptSelect = document.getElementById('pt-select'); //
    const ptGlobalModeSelector = document.getElementById('pt-global-mode-selector'); //
    const ptGlobalMode = document.getElementById('pt-global-mode'); //

    // Filtres Modale Mobile
    const openPtFiltersBtn = document.getElementById('open-pt-filters-btn'); //
    const ptFiltersModal = document.getElementById('pt-filters-modal'); //
    const ptFiltersBackdrop = document.getElementById('pt-filters-modal-backdrop'); //
    const ptFiltersCloseBtn = document.getElementById('pt-filters-modal-close-btn'); //
    const ptFiltersModalSelect = document.getElementById('pt-filters-modal-select'); //
    const ptFiltersModalMode = document.getElementById('pt-filters-modal-mode'); //
    const ptFiltersModalModeSelector = document.getElementById('pt-filters-modal-mode-selector'); //

    // Tableaux
    const ptTable = document.getElementById('pt-leaderboard-table'); //
    const ptTableBody = ptTable?.querySelector('tbody'); //
    const ptGlobalTable = document.getElementById('pt-global-leaderboard-table'); //
    const ptGlobalTableBody = ptGlobalTable?.querySelector('tbody'); //
    const ptClassFilters = document.querySelectorAll('#pt-class-filter-panel input'); //

    // Admin
    const ptAdminForm = document.getElementById('pt-admin-form'); //

    // *** CORRECTION ***
    // Déclarer la variable de fonction ici, dans la portée de initPerilousTrials
    let findNextAvailableRank = async (ptId) => {}; // Fonction vide par défaut //

    // --- GESTION DE LA MODALE D'AIDE ---
    if (helpBtns.length > 0) { //
        helpBtns.forEach(btn => { //
            btn.addEventListener('click', () => { //
                if (helpModal) helpModal.style.display = 'flex'; //
                if (helpBackdrop) helpBackdrop.style.display = 'block'; //
            });
        });
    }
    const closeHelpModal = () => { //
        if (helpModal) helpModal.style.display = 'none'; //
        if (helpBackdrop) helpBackdrop.style.display = 'none'; //
    };
    if (helpCloseBtn) helpCloseBtn.addEventListener('click', closeHelpModal); //
    if (helpBackdrop) helpBackdrop.addEventListener('click', closeHelpModal); //

    // --- GESTION DE LA MODALE DE FILTRES PT ---
    const openPtFiltersModal = () => { //
        if (ptFiltersModal) ptFiltersModal.style.display = 'flex'; //
        if (ptFiltersBackdrop) ptFiltersBackdrop.style.display = 'block'; //
    };
    const closePtFiltersModal = () => { //
        if (ptFiltersModal) ptFiltersModal.style.display = 'none'; //
        if (ptFiltersBackdrop) ptFiltersBackdrop.style.display = 'none'; //
    };

    if (openPtFiltersBtn) openPtFiltersBtn.addEventListener('click', openPtFiltersModal); //
    if (ptFiltersCloseBtn) ptFiltersCloseBtn.addEventListener('click', closePtFiltersModal); //
    if (ptFiltersBackdrop) ptFiltersBackdrop.addEventListener('click', closePtFiltersModal); //

    // Synchronisation des filtres (Modale -> Desktop)
    if (ptFiltersModalSelect) { //
        ptFiltersModalSelect.addEventListener('change', () => { //
            const newPtId = ptFiltersModalSelect.value; //
            if (ptSelect) ptSelect.value = newPtId; // Sync desktop //
            loadPtLeaderboard(newPtId); //
            if (ptAdminForm) { //
                const ptIdInput = ptAdminForm.querySelector('#pt-id-input'); //
                if (ptIdInput) ptIdInput.value = newPtId; //
                findNextAvailableRank(newPtId); // Mettre à jour le rang lors du changement //
            }
            closePtFiltersModal(); //
        });
    }

    if (ptFiltersModalMode) { //
        ptFiltersModalMode.addEventListener('change', () => { //
            if (ptGlobalMode) ptGlobalMode.value = ptFiltersModalMode.value; // Sync desktop //
            if (ptSelect.value === 'global') { //
                loadPtLeaderboard('global'); //
            }
            closePtFiltersModal(); //
        });
    }

    // Synchronisation des filtres (Desktop -> Modale)
    const syncFiltersToModal = () => { //
        if (ptSelect && ptFiltersModalSelect) { //
            ptFiltersModalSelect.value = ptSelect.value; //
        }
        if (ptGlobalMode && ptFiltersModalMode) { //
            ptFiltersModalMode.value = ptGlobalMode.value; //
        }
        if (ptFiltersModalModeSelector) { //
            ptFiltersModalModeSelector.style.display = (ptSelect && ptSelect.value === 'global') ? 'block' : 'none'; //
        }
    };


    // --- GESTION DES CLASSEMENTS ET FILTRES ---
    function applyGlobalPtFilters() { //
        if (!ptGlobalTableBody) return; //

        const selectedClasses = Array.from(ptClassFilters) //
            .filter(c => c.checked) //
            .map(c => c.dataset.class); //

        const filteredLeaderboard = fullGlobalLeaderboard.filter(player => { //
            return selectedClasses.length === 0 || selectedClasses.includes(player.class); //
        });

        ptGlobalTableBody.innerHTML = ''; //

        if (filteredLeaderboard.length === 0) { //
            ptGlobalTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No data for the global ranking yet.</td></tr>'; //
        }

        filteredLeaderboard.forEach((player, index) => { //
            const rank = index + 1; //
            const row = document.createElement('tr'); //
            row.classList.add('podium'); //
            if (rank <= 3) { //
                row.classList.add(`rank-${rank}`); //
            }
            // Ajout de data-player-name à la ligne
            row.dataset.playerName = player.name; //

            row.innerHTML = `
                <td class="rank-col">${rank}</td>
                <td class="player-name-cell pt-global-player-col"><span class="class-tag class-${String(player.class || 'unknown').toLowerCase()}">${player.name}</span></td>
                <td class="cp-display pt-global-cp-col" data-cp="${player.combat_power}">${formatCP(player.combat_power)}</td>
                <td>${player.points}</td>
            `; //
            ptGlobalTableBody.appendChild(row); //
        });

        const ptFilterBtn = document.getElementById('pt-class-filter-btn'); //
        if (ptFilterBtn) { //
            const span = ptFilterBtn.querySelector('span'); //
            if (span) { //
                span.textContent = selectedClasses.length > 0 ? `Player (${selectedClasses.length})` : 'Player'; //
            }
            ptFilterBtn.classList.toggle('active', selectedClasses.length > 0); //
        }
    }

    async function loadPtLeaderboard(ptId) { //
        if (!ptId || !ptTableBody || !ptGlobalTable) return; //
        const isGlobal = ptId === 'global'; //

        ptTable.style.display = isGlobal ? 'none' : 'table'; //
        ptGlobalTable.style.display = isGlobal ? 'table' : 'none'; //
        if (ptGlobalModeSelector) { //
            ptGlobalModeSelector.style.display = isGlobal ? 'flex' : 'none'; //
        }

        syncFiltersToModal(); // Mettre à jour la modale à chaque changement //


        if (isGlobal) { //
            const mode = ptGlobalMode ? ptGlobalMode.value : 'all'; //
            const response = await fetch(`/pt-leaderboard/global?mode=${mode}`); //
            fullGlobalLeaderboard = await response.json(); //
            applyGlobalPtFilters(); //
        } else { //
            const response = await fetch(`/pt-leaderboard/${ptId}`); //
            const leaderboard = await response.json(); //
            ptTableBody.innerHTML = ''; //
            if (leaderboard.length === 0) { //
                ptTableBody.innerHTML = '<tr><td colspan="2" style="text-align: center;">No data yet.</td></tr>'; //
                return; //
            }
            leaderboard.forEach(entry => { //
                let teamHtml = '<div class="pt-leaderboard-team">'; //
                for (let i = 1; i <= 4; i++) { //
                    const name = entry[`player${i}_name`]; //
                    const pClass = entry[`player${i}_class`]; //
                    if (name) { //
                        teamHtml += `<div class="pt-leaderboard-player"><span class="class-tag class-${(pClass || 'unknown').toLowerCase()}">${name}</span></div>`; //
                    }
                }
                teamHtml += '</div>'; //
                const row = document.createElement('tr'); //
                row.classList.add('podium'); //
                if (entry.rank <= 3) row.classList.add(`rank-${entry.rank}`); //
                row.innerHTML = `<td class="rank-col">${entry.rank}</td><td>${teamHtml}</td>`; //
                ptTableBody.appendChild(row); //
            });
        }
    }

    // --- GESTIONNAIRES D'ÉVÉNEMENTS ---

    // Changement du select Desktop PT
    if (ptSelect) { //
        ptSelect.addEventListener('change', () => { //
            const newPtId = ptSelect.value; //
            loadPtLeaderboard(newPtId); //
            if (ptAdminForm) { //
                const ptIdInput = ptAdminForm.querySelector('#pt-id-input'); //
                if (ptIdInput) ptIdInput.value = newPtId; //
                findNextAvailableRank(newPtId); // Mettre à jour le rang //
            }
        });
    }

    // Changement du select Desktop Mode
    if (ptGlobalMode) { //
        ptGlobalMode.addEventListener('change', () => { //
            if (ptSelect.value === 'global') { //
                loadPtLeaderboard('global'); //
            }
            syncFiltersToModal(); //
        });
    }

    // Changement des filtres de classe (Global PT)
    ptClassFilters.forEach(input => input.addEventListener('change', applyGlobalPtFilters)); //

    // Clics sur les joueurs dans le tableau Global PT
    if (ptGlobalTableBody) { //
        ptGlobalTableBody.addEventListener('click', (e) => { //
            const playerRow = e.target.closest('tr'); //
            // Cibler spécifiquement la cellule du joueur ou le span dedans
            const clickedPlayerCell = e.target.closest('.pt-global-player-col'); //

            if (!playerRow || !playerRow.dataset.playerName || !clickedPlayerCell) return; //

            if (!showPlayerDetails) { //
                console.error("showPlayerDetails function is not available."); //
                return; //
            }

            e.preventDefault(); //
            const playerName = playerRow.dataset.playerName; //
            const player = allPlayersMap.get(playerName); //

            if (player) { //
                const fakeRow = { //
                    dataset: { //
                        ...player, //
                        rank: playerRow.querySelector('.rank-col')?.textContent || 'N/A', //
                        cp: player.combat_power, //
                        playSlots: JSON.stringify(player.play_slots || '[]'), //
                        updated: player.updated_at, //
                        notes: player.notes || '-', //
                        ptTags: JSON.stringify(player.pt_tags || '[]') //
                    }
                };
                showPlayerDetails(fakeRow); // Appelle la fonction importée/définie dans main.js //
            } else { //
                console.warn(`Player data not found in map for: ${playerName}`); //
                alert(`Details for ${playerName} not fully loaded.`); //
            }
        });
    }


    // --- GESTION DU FORMULAIRE D'ADMINISTRATION (si présent) ---
// --- GESTION DU FORMULAIRE D'ADMINISTRATION (si présent) ---
    if (ptAdminForm) {
        // --- MODAL AND DOM ELEMENTS (Corrected IDs) ---
        const modal = document.getElementById('player-select-modal');
        const backdrop = document.getElementById('player-select-modal-backdrop');
        const filterInput = document.getElementById('player-filter-input');
        const playerListContainer = document.getElementById('player-select-list');
        const closeModalBtn = modal.querySelector('.player-select-close-btn');
        const createPlayerBtn = document.getElementById('create-new-player-btn');

        const submitBtn = ptAdminForm.querySelector('button[type="submit"]');
        const ptIdInput = document.getElementById('pt-id-input');
        const ptRankInput = document.getElementById('pt-team-rank');

        // --- PLAYER DATA (Corrected ID) ---
        const playersDataElement = document.getElementById('players-data');
        const allPlayers = playersDataElement ? JSON.parse(playersDataElement.textContent || '[]') : [];

        const guildDatalist = document.getElementById('guild-datalist-pt'); // Peut être utile pour le custom select
        let availableGuilds = guildDatalist ? Array.from(guildDatalist.options).map(opt => opt.value) : [];

        // --- STATE ---
        let activePlayerIndex = null;
        let activeSuggestionIndex = -1;

        // --- UTILITY FUNCTIONS ---
        // Définition de findNextAvailableRank (doit être définie avant d'être utilisée)
        findNextAvailableRank = async (ptId) => {
            if (!ptRankInput) return;
            if (!ptId || ptId === 'global') {
                ptRankInput.value = 1;
                validatePtForm(); // Valider après mise à jour
                return;
            }
            try {
                const response = await fetch(`/pt-leaderboard/${ptId}/next-rank`);
                const data = await response.json();
                if (data && data.nextRank) {
                    ptRankInput.value = data.nextRank;
                } else {
                    ptRankInput.value = 1; // Fallback si pas de données
                }
            } catch (err) {
                console.error("Error fetching next rank:", err);
                ptRankInput.value = 1; // Fallback en cas d'erreur
            } finally {
                validatePtForm(); // Valider après mise à jour
            }
        };


        const updateActiveSuggestion = (items) => {
            items.forEach((item, index) => {
                item.classList.toggle('active', index === activeSuggestionIndex);
                if (index === activeSuggestionIndex) {
                    item.scrollIntoView({ block: 'nearest' });
                }
            });
        };

        const getCurrentlySelectedNames = () => {
            const selectedNames = [];
            for (let i = 0; i < 4; i++) {
                // Vérifie si l'index actuel est différent de celui qu'on modifie
                if (i !== activePlayerIndex) {
                    const input = document.getElementById(`pt-player-name-hidden-${i}`);
                    if (input && input.value) {
                        selectedNames.push(input.value.toLowerCase());
                    }
                }
            }
            return selectedNames;
        };


        const populatePlayerList = (filter = '') => {
            playerListContainer.innerHTML = '';
            const query = filter.toLowerCase();
            const selectedNames = getCurrentlySelectedNames(); // Exclut les joueurs déjà sélectionnés (sauf celui qu'on édite)

            allPlayers
                .filter(p =>
                    p.name.toLowerCase().includes(query) &&
                    !selectedNames.includes(p.name.toLowerCase())
                )
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
            activeSuggestionIndex = -1; // Réinitialiser l'index actif lors du filtrage
        };

        const openModal = (playerIndex) => {
            activePlayerIndex = playerIndex;
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
            // Ne pas réinitialiser activePlayerIndex ici pour la fonction selectPlayer
        };

        // --- CORE LOGIC ---
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
                    const playerExists = allPlayers.some(p => p.name.toLowerCase() === name.toLowerCase());
                    if (!playerExists) {
                        // C'est un nouveau joueur, vérifier Classe et CP
                        const classSelect = document.querySelector(`select[name="players[${i}][class]"]`);
                        const cpInput = document.querySelector(`input[name="players[${i}][cp]"]`);
                        if (!classSelect || !classSelect.value || !cpInput || !cpInput.value.trim()) {
                            formIsValid = false; // Manque classe ou CP pour un nouveau joueur
                            break; // Pas besoin de vérifier les autres si un est invalide
                        }
                    }
                    // Si le joueur existe, on n'impose pas de remplir les champs cachés
                }
            }

            // Le formulaire est valide si PT, Rank sont valides, au moins un joueur est sélectionné
            // ET les nouveaux joueurs ont leur classe et CP renseignés.
            submitBtn.disabled = !(ptId && rank > 0 && playersSelectedCount > 0 && formIsValid);
        };

        const selectPlayer = (name) => {
            if (activePlayerIndex === null) return;

            const player = allPlayers.find(p => p.name.toLowerCase() === name.toLowerCase());

            const nameDisplay = document.getElementById(`pt-player-display-${activePlayerIndex}`);
            const nameHidden = document.getElementById(`pt-player-name-hidden-${activePlayerIndex}`);
            const newPlayerFieldsContainer = document.getElementById(`pt-new-player-fields-${activePlayerIndex}`);
            const classSelect = newPlayerFieldsContainer.querySelector(`select[name="players[${activePlayerIndex}][class]"]`);
            const guildInput = newPlayerFieldsContainer.querySelector(`input[name="players[${activePlayerIndex}][guild]"]`);
            const cpInput = newPlayerFieldsContainer.querySelector(`input[name="players[${activePlayerIndex}][cp]"]`);

            nameDisplay.textContent = name;
            nameHidden.value = name;

            if (player) {
                // Joueur existant
                newPlayerFieldsContainer.style.display = 'grid'; // Afficher le conteneur
                classSelect.style.display = 'none'; // Cacher le select de classe
                classSelect.value = ''; // Réinitialiser au cas où
                classSelect.required = false; // Non requis pour joueur existant

                guildInput.style.display = 'none'; // Cacher le select de guilde
                guildInput.value = ''; // Réinitialiser au cas où

                cpInput.style.display = 'block'; // Afficher le champ CP
                cpInput.placeholder = `Update CP (Optional)`; // Modifier le placeholder
                cpInput.required = false; // CP n'est pas requis pour la mise à jour
                cpInput.value = ''; // Vider pour que l'utilisateur entre la nouvelle valeur s'il le souhaite

            } else {
                // Nouveau joueur
                newPlayerFieldsContainer.style.display = 'grid'; // Afficher le conteneur
                classSelect.style.display = 'block'; // Afficher le select de classe
                classSelect.required = true; // Requis pour nouveau joueur

                guildInput.style.display = 'block'; // Afficher le select de guilde

                cpInput.style.display = 'block'; // Afficher le champ CP
                cpInput.placeholder = 'CP (e.g., 1.2M)'; // Placeholder standard
                cpInput.required = true; // Requis pour nouveau joueur
                cpInput.value = ''; // Vider le champ
            }

            closeModal();
            validatePtForm(); // Valider après la sélection
            activePlayerIndex = null; // Réinitialiser l'index après l'opération
        };

        // --- EVENT LISTENERS (Attaching logic) ---
        ptAdminForm.querySelectorAll('.pt-open-modal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const playerIndex = e.currentTarget.dataset.playerIndex;
                openModal(parseInt(playerIndex, 10)); // Convertir en nombre
            });
        });

        if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
        if (backdrop) backdrop.addEventListener('click', closeModal);

        if (filterInput) {
            filterInput.addEventListener('input', () => {
                populatePlayerList(filterInput.value);
            });

            filterInput.addEventListener('keydown', (e) => {
                const items = playerListContainer.querySelectorAll('.suggestion-item');
                if (items.length === 0 && e.key !== 'Enter') return;

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
                    updateActiveSuggestion(items);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
                    updateActiveSuggestion(items);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const activeItem = playerListContainer.querySelector('.suggestion-item.active');
                    if (activeItem) {
                        selectPlayer(activeItem.dataset.playerName);
                    } else if (items.length > 0 && activeSuggestionIndex === -1) { // Si aucune sélection mais des suggestions existent
                        selectPlayer(items[0].dataset.playerName); // Sélectionne le premier
                    } else if (filterInput.value.trim() !== '') {
                        // Permet de créer un nouveau joueur avec Entrée
                        createPlayerBtn.click();
                    }
                }
            });
        }

        if (playerListContainer) playerListContainer.addEventListener('click', (e) => {
            const selectedItem = e.target.closest('.suggestion-item');
            if (selectedItem) {
                selectPlayer(selectedItem.dataset.playerName);
            }
        });

        if (createPlayerBtn) createPlayerBtn.addEventListener('click', () => {
            const newName = filterInput.value.trim();
            if (newName) {
                // Vérifier si le joueur existe déjà (insensible à la casse)
                const exists = allPlayers.some(p => p.name.toLowerCase() === newName.toLowerCase());
                if(exists) {
                    alert(`Player "${newName}" already exists. Please select them from the list.`);
                    filterInput.focus(); // Remettre le focus pour sélectionner
                } else {
                    selectPlayer(newName); // Procéder à la création
                }
            } else {
                alert("Please type a name before creating a new player.");
            }
        });

        // --- Custom Guild Select Logic (Si nécessaire, à décommenter/adapter) ---
        document.querySelectorAll('.custom-guild-select').forEach(container => {
            const guildInput = container.querySelector('.guild-select-input');
            const guildPanel = container.querySelector('.guild-select-panel');
            const playerIndex = container.dataset.guildSelectIndex; // Récupérer l'index

            function populateGuildPanel(filter = '') {
                guildPanel.innerHTML = '';
                const query = filter.toLowerCase();
                availableGuilds
                    .filter(g => g.toLowerCase().includes(query))
                    .forEach(guildName => {
                        const option = document.createElement('div');
                        option.className = 'guild-option';
                        option.textContent = guildName;
                        option.addEventListener('click', () => {
                            guildInput.value = guildName;
                            container.classList.remove('open');
                            validatePtForm(); // Valider après sélection
                        });
                        guildPanel.appendChild(option);
                    });

                // Option "Créer" si le nom tapé n'existe pas exactement
                if (filter && !availableGuilds.some(g => g.toLowerCase() === query)) {
                    const createOption = document.createElement('div');
                    createOption.className = 'guild-option create-new';
                    createOption.textContent = `Create guild "${filter}"`;
                    createOption.addEventListener('click', () => {
                        guildInput.value = filter; // Garde le nom tapé
                        container.classList.remove('open');
                        validatePtForm(); // Valider après "création"
                    });
                    guildPanel.appendChild(createOption);
                }
            }

            guildInput.addEventListener('focus', () => {
                populateGuildPanel(guildInput.value);
                container.classList.add('open');
            });

            guildInput.addEventListener('input', () => {
                populateGuildPanel(guildInput.value);
                if (!container.classList.contains('open')) {
                    container.classList.add('open');
                }
                validatePtForm(); // Valider pendant la saisie
            });

            // Fermer si on clique ailleurs
            document.addEventListener('click', (e) => {
                if (!container.contains(e.target)) {
                    container.classList.remove('open');
                }
            });
        });


        // --- Initial Validation & Rank Fetching ---
        if (ptIdInput) {
            ptIdInput.addEventListener('change', () => {
                findNextAvailableRank(ptIdInput.value); // Appelle findNextAvailableRank qui appelle validatePtForm
            });
        }
        if (ptRankInput) {
            ptRankInput.addEventListener('input', validatePtForm); // Valider si le rang est modifié manuellement
        }

        // Écouteurs pour les champs de nouveau joueur (Classe, CP)
        ptAdminForm.querySelectorAll('.pt-new-player-fields select, .pt-new-player-fields input').forEach(input => {
            input.addEventListener('change', validatePtForm);
            input.addEventListener('input', validatePtForm);
        });


        // Appel initial pour définir le rang et valider
        findNextAvailableRank(ptIdInput.value); // Ceci va aussi appeler validatePtForm() à la fin

    } // Fin de if(ptAdminForm)


    // --- INITIALISATION FINALE ---
    const urlParams = new URLSearchParams(window.location.search); //
    const section = urlParams.get('section'); //
    let initialPtId = 'global'; // Défaut à 'global' //

    // Gère le cas où l'URL spécifie la section ET un pt_id
    if (section === 'perilous-trials-section') { //
        initialPtId = urlParams.get('pt_id') || 'global'; //
    }

    // Met à jour les selects (desktop et mobile) avec la valeur initiale
    if (ptSelect) ptSelect.value = initialPtId; //
    if (ptFiltersModalSelect) ptFiltersModalSelect.value = initialPtId; //

    // Charge le classement initial (sera 'global' sauf si spécifié dans l'URL)
    loadPtLeaderboard(initialPtId); //

    // Initialise le rang suggéré pour admin SEULEMENT si ptAdminForm existe
    if (ptAdminForm && document.getElementById('pt-id-input')) { //
        document.getElementById('pt-id-input').value = initialPtId; // Assure que l'input caché est correct //

        // *** CORRECTION ***
        // C'est le seul appel d'initialisation nécessaire pour le rang
        findNextAvailableRank(initialPtId); //
    }
}