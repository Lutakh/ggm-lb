import { initNavigation } from './modules/navigation.js';
import { initPlayerForm } from './modules/playerForm.js';
import { initLeaderboardFilters } from './modules/leaderboardFilters.js';
import { initPerilousTrials } from './modules/perilousTrials.js';
import { updateTimers, formatCP } from './modules/utils.js';

document.addEventListener('DOMContentLoaded', function() {
    // Initialisations
    initNavigation();
    initPlayerForm();
    initLeaderboardFilters();
    initPerilousTrials();

    // Lancement du timer
    setInterval(updateTimers, 1000);
    updateTimers();

    // Formatage initial des CP
    document.querySelectorAll('.cp-display').forEach(el => {
        el.textContent = formatCP(el.dataset.cp);
    });
});
