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
    const timerElements = document.querySelectorAll('.timer-value');
    timerElements.forEach(el => {
        let ms = parseInt(el.dataset.milliseconds, 10); if (isNaN(ms)) return;
        ms -= 1000; if (ms < 0) ms = 0;
        el.dataset.milliseconds = ms;
        const totalSeconds = Math.floor(ms / 1000); const days = Math.floor(totalSeconds / 86400); const hours = Math.floor((totalSeconds % 86400) / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60;
        let text = ''; if (days > 0) text += `${days}d `; text += `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
        let urgencyClass = '';
        if (el.dataset.type === 'daily' && totalSeconds < 3600) {
            urgencyClass = 'urgent';
        } else if (el.dataset.type === 'weekly' && totalSeconds < 86400) {
            urgencyClass = 'urgent';
        }
        el.textContent = text;
        el.className = `timer-value ${urgencyClass}`;
    });
}
