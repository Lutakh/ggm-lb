import { initNavigation } from './modules/navigation.js';
import { initPlayerForm } from './modules/playerForm.js';
import { initLeaderboardFilters } from './modules/leaderboardFilters.js';
import { initPerilousTrials } from './modules/perilousTrials.js';
import { updateTimers, formatCP, formatRelativeTime } from './modules/utils.js';

// Fonction globale pour afficher les notes complètes
window.showFullNote = function(playerName, note) {
    if (!note || note.trim() === '' || note.trim() === '-') {
        return;
    }
    alert(`Notes for ${playerName}:\n\n${note}`);
}

document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initPlayerForm();
    initLeaderboardFilters();
    initPerilousTrials();

    setInterval(updateTimers, 1000);
    updateTimers();

    document.querySelectorAll('.cp-display').forEach(el => {
        el.textContent = formatCP(el.dataset.cp);
    });

    document.querySelectorAll('[data-timestamp]').forEach(el => {
        el.textContent = formatRelativeTime(el.dataset.timestamp);
    });
});
