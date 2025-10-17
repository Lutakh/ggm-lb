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
        let ms = parseInt(el.dataset.milliseconds, 10); if (isNaN(ms)) return;
        ms -= 1000; if (ms < 0) ms = 0;
        el.dataset.milliseconds = ms;
        const s = Math.floor(ms / 1000);
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        let text = '';
        if (d > 0) text += `${d}d `;
        text += `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
        el.textContent = text;
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
