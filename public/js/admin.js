document.addEventListener('DOMContentLoaded', function() {
    function activateAdminMode(password) { 
        sessionStorage.setItem('adminPassword', password); 
        document.body.classList.add('admin-mode');
        document.querySelectorAll('.admin-pass-input').forEach(input => input.value = password);
    }

    function deactivateAdminMode() {
        sessionStorage.removeItem('adminPassword'); 
        document.body.classList.remove('admin-mode');
        alert('Admin mode deactivated.');
        adminModal.classList.remove('active');
        adminBackdrop.classList.remove('active');
    }

    const adminModal = document.getElementById('admin-modal');
    const adminBackdrop = document.getElementById('admin-modal-backdrop');
    const adminSettingsBtn = document.getElementById('admin-settings-btn');
    const deactivateAdminBtn = document.getElementById('deactivate-admin-btn');
    
    adminSettingsBtn.addEventListener('click', () => {
        if (document.body.classList.contains('admin-mode')) {
            adminModal.classList.add('active');
            adminBackdrop.classList.add('active');
        } else {
             const password = prompt("Enter Admin Password:");
             if (password) {
                fetch('/verify-admin', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ password }) 
                })
                .then(res => res.json()).then(data => { 
                    if (data.success) { 
                        activateAdminMode(password);
                        alert('Admin mode activated. Click the wrench to open settings.');
                    } 
                    else { alert('Incorrect Password'); } 
                });
             }
        }
    });
    
    adminBackdrop.addEventListener('click', () => {
        adminModal.classList.remove('active');
        adminBackdrop.classList.remove('active');
    });

    deactivateAdminBtn.addEventListener('click', deactivateAdminMode);
    
    document.getElementById('server-settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            server_name: formData.get('server_name'),
            server_open_date: formData.get('server_open_date'),
            admin_password: sessionStorage.getItem('adminPassword'),
            cc_timers: []
        };
        document.querySelectorAll('#cc-timers-form .timer-setting-row input').forEach(input => {
            const id = input.name.match(/\[(\d+)\]/)[1];
            data.cc_timers.push({ id: id, weeks: input.value });
        });
        
        const response = await fetch('/update-server-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (result.success) {
            window.location.href = '/?notification=' + encodeURIComponent(result.message);
        } else {
            alert('Error: ' + result.message);
        }
    });

    const ptAdminForm = document.getElementById('pt-admin-form');
    if (ptAdminForm) {
        ptAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const ptId = ptAdminForm.querySelector('#pt-id-input').value;
            const rank = ptAdminForm.querySelector('#pt-team-rank').value;

            if (!ptId || !rank) {
                alert("Please select a Perilous Trial and specify a Rank.");
                return;
            }

            const response = await fetch(`/pt-leaderboard/${ptId}/rank/${rank}`);
            const existingTeam = await response.json();

            let proceed = true;
            if (existingTeam) {
                const teamNames = [existingTeam.player1_name, existingTeam.player2_name, existingTeam.player3_name, existingTeam.player4_name].filter(Boolean).join(', ');
                proceed = confirm(`Rank ${rank} is already taken by the team: ${teamNames}.\nDo you want to overwrite it?`);
            }

            if (proceed) {
                ptAdminForm.submit();
            }
        });
    }
    
    if (sessionStorage.getItem('adminPassword')) {
        activateAdminMode(sessionStorage.getItem('adminPassword'));
    }
});


function deletePlayer(id) { const password = sessionStorage.getItem('adminPassword'); if (password) { document.getElementById(`delete-password-${id}`).value = password; document.getElementById(`delete-form-${id}`).submit(); } }
function updateTeam(id) { const password = sessionStorage.getItem('adminPassword'); if (!password) return;
const newTeam = prompt("Enter the new team name (e.g., Team A, No Team):"); if (newTeam === null) return;
const form = document.createElement('form'); form.method = 'POST'; form.action = `/update-team/${id}`; form.innerHTML = `<input type="hidden" name="admin_password" value="${password}"><input type="hidden" name="team" value="${newTeam}">`; document.body.appendChild(form); form.submit(); }
