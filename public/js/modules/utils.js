export function formatCP(numStr) {
    const num = parseInt(numStr, 10);
    if (!num || isNaN(num)) return 'N/A';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
    return num.toString();
}

export function parseCpFilter(text) {
    if (!text) return 0;
    text = text.trim().toUpperCase();
    let value = parseFloat(text.replace(/[^0-9.]/g, '')) || 0;
    if (text.endsWith('M')) value *= 1000000;
    if (text.endsWith('K')) value *= 1000;
    return isNaN(value) ? 0 : value;
}

export function minutesToTimeValue(minutes) {
    if (minutes === null || isNaN(minutes)) return '';
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}

export function minutesToFormattedTime(minutes) {
    if (isNaN(minutes)) return '';
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setMinutes(minutes);
    return new Intl.DateTimeFormat(navigator.language, { hour: 'numeric', minute: 'numeric' }).format(date);
}

export function updateTimers() {
    document.querySelectorAll('.timer-value').forEach(el => {
        let ms = parseInt(el.dataset.milliseconds, 10);
        if (isNaN(ms)) return;

        ms -= 1000;
        if (ms < 0) ms = 0;
        el.dataset.milliseconds = ms; // Update the data attribute

        const s = Math.floor(ms / 1000);
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;

        // *** MODIFICATION: Format WITH spaces ***
        let text = '';
        if (d > 0) text += `${d}d `; // Space added
        // Always show hours, minutes, seconds, padded with zero
        text += `${String(h).padStart(2, '0')}h `; // Space added
        text += `${String(m).padStart(2, '0')}m `; // Space added
        text += `${String(sec).padStart(2, '0')}s`; // No space at the end
        // *** END MODIFICATION ***

        el.textContent = text.trim(); // Use trim just in case

        // Keep urgency logic
        const type = el.dataset.type;
        const oneHour = 3600000;
        const oneDay = 86400000;

        // Add 'urgent' class based on type and remaining time
        // *** MODIFICATION ICI ***
        if ((type === 'daily' && ms < oneHour) || // Daily reset within 1 hour
            (type === 'levelCap' && ms < oneDay) || // Level cap within 24 hours
            (['weekly', 'event', 'classChange'].includes(type) && ms < oneDay)) // Others within 24 hours
        {
            el.classList.add('urgent');
        } else {
            el.classList.remove('urgent');
        }
        // *** FIN MODIFICATION ***
    });
}


export function formatRelativeTime(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    const now = new Date();
    const seconds = Math.round((now - date) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
}

/**
 * NOUVELLE FONCTION (Req 3)
 * Formate le temps relatif de manière concise (sans "ago")
 */
export function formatRelativeTimeShort(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    const now = new Date();
    const seconds = Math.round((now - date) / 1000);

    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    return `${days}d`;
}