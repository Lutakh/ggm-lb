function calculateClassChangeTimers(serverOpenDateStr, classChangeTimers) {
    // Utiliser UTC pour éviter les problèmes de fuseau horaire
    const serverOpenDate = new Date(serverOpenDateStr + 'T00:00:00Z');
    const now = new Date();

    const calculateTargetDate = (startDate, weeks) => {
        const target = new Date(startDate.getTime());
        target.setUTCDate(target.getUTCDate() + weeks * 7);
        // L'heure cible réelle est 13h UTC pour les Class Changes
        target.setUTCHours(13, 0, 0, 0);
        return target;
    };

    return classChangeTimers
        .sort((a, b) => a.weeks_after_start - b.weeks_after_start)
        .filter(timer => timer.is_active)
        .map(timer => {
            const timerDate = calculateTargetDate(serverOpenDate, timer.weeks_after_start);
            return {
                label: timer.label,
                milliseconds: timerDate - now // Calcul du temps restant par rapport à maintenant
            };
        });
}

function calculateLevelCapTimers(serverOpenDateStr) {
    const serverOpenDate = new Date(serverOpenDateStr + 'T00:00:00Z'); // Assume server starts at UTC midnight
    const now = new Date();
    // Use the same 13:00 UTC time as Class Change for consistency
    const unlockHourUTC = 13;

    // Define the level cap schedule with cumulative days
    const levelCapSchedule = [
        { cc: 0, level: 65, durationDays: 4, cumulativeDays: 0 },
        { cc: 0, level: 80, durationDays: 3, cumulativeDays: 4 },
        { cc: 1, level: 30, durationDays: 6, cumulativeDays: 7 }, // Start of CC1 (Day 7)
        { cc: 1, level: 60, durationDays: 8, cumulativeDays: 13 },
        { cc: 1, level: 80, durationDays: 7, cumulativeDays: 21 },
        { cc: 2, level: 20, durationDays: 7, cumulativeDays: 28 }, // Start of CC2 (Day 28)
        { cc: 2, level: 36, durationDays: 9, cumulativeDays: 35 },
        { cc: 2, level: 52, durationDays: 9, cumulativeDays: 44 },
        { cc: 2, level: 60, durationDays: 5, cumulativeDays: 53 },
        { cc: 2, level: 87, durationDays: 10, cumulativeDays: 58 },
        { cc: 2, level: 104, durationDays: 7, cumulativeDays: 68 },
        { cc: 2, level: 140, durationDays: 16, cumulativeDays: 75 },
        { cc: 3, level: 66, durationDays: 16, cumulativeDays: 91 }, // Start of CC3 (Day 91)
        { cc: 3, level: 86, durationDays: 10, cumulativeDays: 107 },
        { cc: 3, level: 106, durationDays: 11, cumulativeDays: 117 },
        { cc: 3, level: 150, durationDays: 27, cumulativeDays: 128 },
        { cc: 4, level: 56, durationDays: 20, cumulativeDays: 155 }, // Start of CC4 (Day 155)
        { cc: 4, level: 110, durationDays: 20, cumulativeDays: 175 },
        { cc: 4, level: 150, durationDays: 23, cumulativeDays: 195 },
        { cc: 5, level: 56, durationDays: 21, cumulativeDays: 218 }, // Start of CC5 (Day 218)
        { cc: 5, level: 110, durationDays: 24, cumulativeDays: 239 },
        { cc: 5, level: 150, durationDays: 21, cumulativeDays: 263 },
        { cc: 5, level: 170, durationDays: 11, cumulativeDays: 284 },
        { cc: 6, level: 56, durationDays: 21, cumulativeDays: 295 }, // Start of CC6 (Day 295)
        { cc: 6, level: 110, durationDays: 24, cumulativeDays: 316 },
        // Add future caps here if known
    ];

    let currentCap = { level: 0, unlockDate: serverOpenDate }; // Initial state before first cap
    let nextCap = null;
    const futureCaps = [];

    for (let i = 0; i < levelCapSchedule.length; i++) {
        const entry = levelCapSchedule[i];
        const unlockDate = new Date(serverOpenDate.getTime());
        unlockDate.setUTCDate(unlockDate.getUTCDate() + entry.cumulativeDays);
        unlockDate.setUTCHours(unlockHourUTC, 0, 0, 0); // Set the unlock time

        if (now >= unlockDate) {
            // This cap is active or past
            currentCap = {
                cc: entry.cc,
                level: entry.level,
                unlockDate: unlockDate
            };
        } else {
            // This is the next upcoming cap
            if (!nextCap) {
                nextCap = {
                    cc: entry.cc,
                    level: entry.level,
                    unlockDate: unlockDate,
                    milliseconds: unlockDate - now
                };
            }
            // Add to future caps for tooltip (limit to next few)
            if (futureCaps.length < 5) { // Show next 5 in tooltip
                futureCaps.push({
                    cc: entry.cc,
                    level: entry.level,
                    milliseconds: unlockDate - now
                });
            }
        }
    }

    // Handle case where all scheduled caps are passed
    if (!nextCap && currentCap.level > 0) {
        // Optionally show the last known cap or a message
        console.log("All scheduled level caps reached.");
    }


    return {
        currentLevelCap: currentCap, // Contains {cc, level, unlockDate}
        nextLevelCap: nextCap, // Contains {cc, level, unlockDate, milliseconds} or null
        futureLevelCaps: futureCaps // Array of {cc, level, milliseconds}
    };
}

module.exports = {
    calculateClassChangeTimers,
    calculateLevelCapTimers
};