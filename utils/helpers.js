const capitalize = (s) => (s && typeof s === 'string' ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');

const parseCombatPower = (cpString) => {
    if (!cpString) return 0;
    const text = String(cpString).trim().toUpperCase();
    const value = parseFloat(text.replace(/[^0-9.]/g, ''));
    if (isNaN(value)) return 0;
    if (text.endsWith('M')) return value * 1000000;
    if (text.endsWith('K')) return value * 1000;
    return value;
};

const timeToMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return isNaN(hours) || isNaN(minutes) ? null : hours * 60 + minutes;
};

module.exports = {
    capitalize,
    parseCombatPower,
    timeToMinutes
};
