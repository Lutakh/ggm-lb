const parseCombatPower = (cpString) => {
    if (!cpString) return 0;
    const text = String(cpString).trim().toUpperCase();
    const value = parseFloat(text.replace(/[^0-9.]/g, ''));
    if (isNaN(value)) return 0;

    let multiplier = 1;
    if (text.endsWith('M')) multiplier = 1000000;
    else if (text.endsWith('K')) multiplier = 1000;

    // Utilisation de Math.round() pour garantir un entier compatible avec BIGINT
    return Math.round(value * multiplier);
};

const timeToMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return isNaN(hours) || isNaN(minutes) ? null : hours * 60 + minutes;
};

module.exports = {
    parseCombatPower,
    timeToMinutes
};