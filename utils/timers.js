function calculateClassChangeTimers(serverOpenDateStr, classChangeTimers) {
    const serverOpenDate = new Date(serverOpenDateStr);
    const now = new Date();
    const parisOffset = 2 * 60 * 60 * 1000;

    const calculateTargetDate = (startDate, weeks) => {
        const target = new Date(startDate);
        target.setDate(target.getDate() + weeks * 7);
        target.setUTCHours(15, 0, 0, 0);
        return new Date(target.getTime() - parisOffset);
    };
    
    let activeTimer = null;
    for (const timer of classChangeTimers) {
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
