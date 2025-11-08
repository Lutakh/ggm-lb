// public/js/modules/guildSelectModal.js
import { formatCP } from './utils.js';

let modal = null;
let backdrop = null;
let filterInput = null;
let listContainer = null;
let closeBtn = null;

let allGuilds = [];
let activeIndex = -1;
let currentCallback = null;

function updateActiveItem(items) {
    items.forEach((item, index) => {
        item.classList.toggle('active', index === activeIndex);
        if (index === activeIndex) {
            item.scrollIntoView({ block: 'nearest' });
        }
    });
}

function populateList(filter = '') {
    if (!listContainer) return;
    listContainer.innerHTML = '';
    const query = filter.toLowerCase();

    allGuilds
        .filter(g => g.name.toLowerCase().includes(query))
        .sort((a, b) => b.total_cp - a.total_cp) // Tri par CP décroissant par défaut
        .forEach(guild => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.dataset.guildName = guild.name;

            item.innerHTML = `
                <span class="guild-item-name">${guild.name}</span>
                <span class="guild-item-info">${guild.member_count}/120 - ${formatCP(guild.total_cp)} CP</span>
            `;
            listContainer.appendChild(item);
        });
    activeIndex = -1;
}

function closeModal() {
    if (modal) modal.style.display = 'none';
    if (backdrop) backdrop.style.display = 'none';
    currentCallback = null;
    activeIndex = -1;
    if (filterInput) filterInput.value = '';
}

function selectGuild(guildName) {
    if (currentCallback) {
        currentCallback(guildName);
    }
    closeModal();
}

export function openGuildModal(callback) {
    if (!modal || !backdrop || !filterInput) return;
    currentCallback = callback;
    filterInput.value = '';
    populateList();
    modal.style.display = 'flex';
    backdrop.style.display = 'block';
    filterInput.focus();
}

export function initGuildSelectModal(guildsData) {
    modal = document.getElementById('guild-select-modal');
    backdrop = document.getElementById('guild-select-modal-backdrop');
    filterInput = document.getElementById('guild-filter-input');
    listContainer = document.getElementById('guild-select-list');
    closeBtn = document.getElementById('guild-select-close-btn');

    if (!modal || !backdrop || !filterInput || !listContainer || !closeBtn) {
        console.error("[Guild Modal Init] Missing elements.");
        return;
    }

    allGuilds = guildsData || [];

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    filterInput.addEventListener('input', () => populateList(filterInput.value));

    filterInput.addEventListener('keydown', (e) => {
        const items = listContainer.querySelectorAll('.suggestion-item');
        if (items.length === 0 && e.key !== 'Enter') return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                activeIndex = (activeIndex + 1) % items.length;
                updateActiveItem(items);
                break;
            case 'ArrowUp':
                e.preventDefault();
                activeIndex = (activeIndex - 1 + items.length) % items.length;
                updateActiveItem(items);
                break;
            case 'Enter':
                e.preventDefault();
                if (activeIndex >= 0 && activeIndex < items.length) {
                    selectGuild(items[activeIndex].dataset.guildName);
                } else if (items.length > 0 && activeIndex === -1) {
                    // Si rien n'est sélectionné mais qu'on fait Entrée, on prend le premier si filtre actif,
                    // ou on valide ce qu'on a tapé si c'est une nouvelle guilde potentielle (optionnel, ici on force la liste)
                    // Pour l'instant, forçons la sélection dans la liste.
                    selectGuild(items[0].dataset.guildName);
                }
                break;
        }
    });

    listContainer.addEventListener('click', (e) => {
        const item = e.target.closest('.suggestion-item');
        if (item && item.dataset.guildName) {
            selectGuild(item.dataset.guildName);
        }
    });
}