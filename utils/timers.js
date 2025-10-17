function calculateClassChangeTimers(serverOpenDateStr, classChangeTimers) {
    // Utiliser UTC pour éviter les problèmes de fuseau horaire
    const serverOpenDate = new Date(serverOpenDateStr + 'T00:00:00Z');
    const now = new Date();

    const calculateTargetDate = (startDate, weeks) => {
        const target = new Date(startDate.getTime());
        target.setUTCDate(target.getUTCDate() + weeks * 7);
        // Le reset est à 5h du matin heure du serveur, ce qui correspond à 15h UTC (Paris est UTC+2 en été, UTC+1 en hiver, mais le jeu se base souvent sur un fuseau fixe)
        // Pour simplifier et fiabiliser, on se base sur UTC
        target.setUTCHours(15, 0, 0, 0); 
        return target;
    };
    
    let activeTimer = null;
    for (const timer of classChangeTimers.sort((a, b) => a.weeks_after_start - b.weeks_after_start)) {
        if (timer.is_active) {
            const timerDate = calculateTargetDate(serverOpenDate, timer.weeks_after_start);
            if (now < timerDate) {
                activeTimer = { label: timer.label, milliseconds: timerDate - now };
                break; 
            }
        }
    }
    return activeTimer;
}

module.exports = { calculateClassChangeTimers };
