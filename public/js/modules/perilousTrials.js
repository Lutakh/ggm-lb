export function initPerilousTrials() {
    const ptSelect = document.getElementById('pt-select');
    const ptTableBody = document.getElementById('pt-leaderboard-table')?.querySelector('tbody');
    const ptIdInputAdmin = document.getElementById('pt-id-input');
    const urlParams = new URLSearchParams(window.location.search);
    const ptIdFromUrl = urlParams.get('pt_id');

    async function loadPtLeaderboard(ptId) {
        if (!ptId) return;

        if (ptIdInputAdmin) ptIdInputAdmin.value = ptId;
        const response = await fetch(`/pt-leaderboard/${ptId}`);
        const leaderboard = await response.json();

        ptTableBody.innerHTML = '';
        if(leaderboard.length === 0) {
            ptTableBody.innerHTML = '<tr><td colspan="2" style="text-align: center;">No data for this trial yet.</td></tr>';
            return;
        }
        
        leaderboard.forEach(entry => {
            let teamHtml = '<div class="pt-leaderboard-team">';
            for (let i = 1; i <= 4; i++) {
                const name = entry[`player${i}_name`];
                const pClass = entry[`player${i}_class`];
                if (name) {
                    teamHtml += `<div class="pt-leaderboard-player">
                        <span class="class-tag class-${(pClass || 'unknown').toLowerCase()}"></span>
                        <span>${name}</span>
                    </div>`;
                }
            }
            teamHtml += '</div>';

            const row = document.createElement('tr');
            row.classList.add('podium');
            if (entry.rank <= 3) {
                row.classList.add(`rank-${entry.rank}`);
            }

            row.innerHTML = `
                <td class="rank-col">${entry.rank}</td>
                <td>${teamHtml}</td>
            `;
            ptTableBody.appendChild(row);
        });
    }
    
    if (ptSelect) {
        ptSelect.addEventListener('change', () => loadPtLeaderboard(ptSelect.value));
    }
    
    if (ptIdFromUrl && ptSelect) {
        ptSelect.value = ptIdFromUrl;
        loadPtLeaderboard(ptIdFromUrl);
    }

    const ptAdminForm = document.getElementById('pt-admin-form');
    if (!ptAdminForm) return;

    const ptPlayerInputs = ptAdminForm.querySelectorAll('.pt-player-inputs input[list]');
    const submitBtn = ptAdminForm.querySelector('button[type="submit"]');
    const mainDatalist = document.getElementById('player-datalist-main');
    
    if (mainDatalist && ptPlayerInputs.length > 0) {
        const allPlayerOptions = Array.from(mainDatalist.options);

        function validateTeamSubmission() {
            const selectedNames = Array.from(ptPlayerInputs)
                .map(input => input.value.trim().toLowerCase())
                .filter(Boolean);
            
            const uniqueNames = new Set(selectedNames);

            if (selectedNames.length > uniqueNames.size) {
                submitBtn.disabled = true;
                submitBtn.style.backgroundColor = 'var(--accent-color)';
                submitBtn.textContent = 'Duplicate Player';
            } else {
                submitBtn.disabled = false;
                submitBtn.style.backgroundColor = ''; // Revert to CSS default
                submitBtn.textContent = 'Submit Team';
            }
        }

        function updateDatalists() {
            const selectedNames = Array.from(ptPlayerInputs)
                .map(input => input.value.trim().toLowerCase())
                .filter(Boolean);
            
// ... (début du fichier inchangé)

            ptPlayerInputs.forEach(input => {
                const currentVal = input.value.trim().toLowerCase();
                const otherSelectedNames = selectedNames.filter(name => name !== currentVal);
                
                const datalistId = input.getAttribute('list');
                // On récupère la datalist qui existe déjà, on ne la crée plus
                const datalist = document.getElementById(datalistId);
                
                if (datalist) {
                    datalist.innerHTML = '';
                    allPlayerOptions.forEach(option => {
                        if (!otherSelectedNames.includes(option.value.toLowerCase())) {
                            datalist.appendChild(option.cloneNode(true));
                        }
                    });
                }
            });
        }
// ... (fin du fichier inchangée)
        ptPlayerInputs.forEach(input => {
            const checkNewPlayer = () => {
                const playerName = input.value.trim().toLowerCase();
                const playerIndex = input.dataset.playerIndex;
                const extraFields = document.getElementById(`new-player-fields-${playerIndex}`);
                const isExisting = allPlayerOptions.some(opt => opt.value.toLowerCase() === playerName);

                if (playerName && !isExisting) {
                    extraFields.classList.add('visible');
                    extraFields.querySelectorAll('select, input').forEach(field => {
                        if (field.name.includes('classes') || field.name.includes('cps')) {
                            field.required = true;
                        }
                    });
                } else {
                    extraFields.classList.remove('visible');
                    extraFields.querySelectorAll('select, input').forEach(field => {
                        field.required = false;
                    });
                }
            };

            input.addEventListener('input', () => {
                updateDatalists();
                checkNewPlayer();
                validateTeamSubmission();
            });

            input.addEventListener('focus', updateDatalists);
        });
        
        validateTeamSubmission(); // Initial check
    }
}
