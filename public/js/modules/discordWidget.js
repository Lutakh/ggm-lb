// public/js/modules/discordWidget.js
export function initDiscordWidget(widgetUrl) {
    const onlineCountEl = document.getElementById('discord-online-count');

    if (!onlineCountEl) return;

    fetch(widgetUrl)
        .then(response => response.json())
        .then(data => {
            if (data && data.presence_count) {
                onlineCountEl.innerHTML = `<span class="status-dot online"></span>${data.presence_count} Online`;
            } else {
                onlineCountEl.innerHTML = `<span class="status-dot offline"></span>Offline`;
            }
        })
        .catch(error => {
            console.error('Error fetching Discord widget data:', error);
            onlineCountEl.textContent = 'Error';
        });
}