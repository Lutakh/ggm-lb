function calculateClassChangeTimers(serverOpenDateStr, classChangeTimers) {
    // Utiliser UTC pour éviter les problèmes de fuseau horaire
    const serverOpenDate = new Date(serverOpenDateStr + 'T00:00:00Z');
    const now = new Date();
    const twoHoursInMs = 2 * 60 * 60 * 1000;

    const calculateTargetDate = (startDate, weeks) => {
        const target = new Date(startDate.getTime());
        target.setUTCDate(target.getUTCDate() + weeks * 7);
        // Le reset est à 5h du matin heure du serveur, ce qui correspond à 15h UTC
        target.setUTCHours(15, 0, 0, 0);
        // Soustraire les 2 heures supplémentaires
        return new Date(target.getTime() - twoHoursInMs);
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