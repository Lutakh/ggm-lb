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
        const adminModal = document.getElementById('admin-modal');
        const adminBackdrop = document.getElementById('admin-modal-backdrop');
        if (adminModal) adminModal.classList.remove('active');
        if (adminBackdrop) adminBackdrop.classList.remove('active');
    }

    const adminModal = document.getElementById('admin-modal');
    const adminBackdrop = document.getElementById('admin-modal-backdrop');
    const adminSettingsBtn = document.getElementById('admin-settings-btn');
    const deactivateAdminBtn = document.getElementById('deactivate-admin-btn');

    if (adminSettingsBtn) {
        adminSettingsBtn.addEventListener('click', () => {
            if (document.body.classList.contains('admin-mode')) {
                if (adminModal) adminModal.classList.add('active');
                if (adminBackdrop) adminBackdrop.classList.add('active');
            } else {
                const password = prompt("Enter Admin Password:");
                if (password) {
                    fetch('/verify-admin', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password })
                    })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success) {
                                activateAdminMode(password);
                            } else {
                                alert('Incorrect Password');
                            }
                        })
                        .catch(err => console.error('Error verifying admin password:', err));
                }
            }
        });
    }

    if (adminBackdrop) {
        adminBackdrop.addEventListener('click', () => {
            if (adminModal) adminModal.classList.remove('active');
            adminBackdrop.classList.remove('active');
        });
    }

    if (deactivateAdminBtn) {
        deactivateAdminBtn.addEventListener('click', deactivateAdminMode);
    }

    const serverSettingsForm = document.getElementById('server-settings-form');
    if (serverSettingsForm) {
        serverSettingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
                server_name: formData.get('server_name'),
                server_open_date: formData.get('server_open_date'),
                admin_password: sessionStorage.getItem('adminPassword'),
            };

            try {
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
            } catch (err) {
                alert('An error occurred while saving settings.');
                console.error(err);
            }
        });
    }

    const ptAdminForm = document.getElementById('pt-admin-form');
    if (ptAdminForm) {
        ptAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // On intercepte la soumission

            const ptId = ptAdminForm.querySelector('#pt-id-input').value;
            const rank = ptAdminForm.querySelector('#pt-team-rank').value;

            if (!ptId || !rank) {
                alert("Please select a Perilous Trial and specify a Rank.");
                return;
            }

            try {
                const response = await fetch(`/pt-leaderboard/${ptId}/rank/${rank}`);
                if (!response.ok) {
                    throw new Error(`Server responded with ${response.status}`);
                }
                const existingTeam = await response.json();

                let proceed = true;
                if (existingTeam) {
                    const teamNames = [existingTeam.player1_name, existingTeam.player2_name, existingTeam.player3_name, existingTeam.player4_name].filter(Boolean).join(', ');
                    proceed = confirm(`Rank ${rank} is already taken by the team: ${teamNames}.\nDo you want to overwrite it?`);
                }

                if (proceed) {
                    // Cette méthode soumet le formulaire sans redéclencher cet écouteur d'événement.
                    ptAdminForm.submit();
                }
            } catch (err) {
                console.error("Error checking rank:", err);
                if (confirm("Could not verify if rank is already taken. Submit anyway?")) {
                    ptAdminForm.submit();
                }
            }
        });
    }

    const deleteGuildForm = document.getElementById('delete-guild-form');
    if (deleteGuildForm) {
        deleteGuildForm.addEventListener('submit', function(e) {
            const guildName = this.elements.guild_name.value;
            if (!guildName || !confirm(`Are you sure you want to delete the guild "${guildName}"? This will remove the guild from all associated players.`)) {
                e.preventDefault();
            }
        });
    }

    if (sessionStorage.getItem('adminPassword')) {
        activateAdminMode(sessionStorage.getItem('adminPassword'));
    }
});


// Fonctions globales pour les rendre accessibles depuis les attributs onclick
window.deletePlayer = function(id) {
    const password = sessionStorage.getItem('adminPassword');
    if (password && confirm("Are you sure you want to delete this player? This action cannot be undone.")) {
        const form = document.getElementById(`delete-form-${id}`);
        document.getElementById(`delete-password-${id}`).value = password;
        form.submit();
    }
}

window.updateTeam = function(id) {
    const password = sessionStorage.getItem('adminPassword');
    if (!password) return;
    const newTeam = prompt("Enter the new team name (e.g., Team A, or 'No Team' to remove from team):");
    if (newTeam === null) return;

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `/update-team/${id}`;
    form.innerHTML = `<input type="hidden" name="admin_password" value="${password}"><input type="hidden" name="team" value="${newTeam}">`;
    document.body.appendChild(form);
    form.submit();
}