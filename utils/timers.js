function calculateClassChangeTimers(serverOpenDateStr, classChangeTimers) {
    // Utiliser UTC pour éviter les problèmes de fuseau horaire
    const serverOpenDate = new Date(serverOpenDateStr + 'T00:00:00Z');
    const now = new Date();

    const calculateTargetDate = (startDate, weeks) => {
        const target = new Date(startDate.getTime());
        target.setUTCDate(target.getUTCDate() + weeks * 7);
        // CORRECTION: L'heure cible réelle est 13h UTC
        target.setUTCHours(13, 0, 0, 0);
        return target; // Suppression de la soustraction manuelle
    };

    return classChangeTimers
        .sort((a, b) => a.weeks_after_start - b.weeks_after_start)
        .filter(timer => timer.is_active)
        .map(timer => {
            const timerDate = calculateTargetDate(serverOpenDate, timer.weeks_after_start);
            return {
                label: timer.label,
                milliseconds: timerDate - now
            };
        });
}

module.exports = { calculateClassChangeTimers };