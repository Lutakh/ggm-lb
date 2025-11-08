// public/js/modules/guildSelectModal.js
import { formatCP } from './utils.js';

let modal = null;
let backdrop = null;
let filterInput = null;
let listContainer = null;
let closeBtn = null;
let createBtn = null; // NOUVEAU

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
        .sort((a, b) => b.total_cp - a.total_cp)
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
    if (currentCallback) currentCallback(guildName);
    closeModal();
}

// NOUVEAU : Fonction de création
function handleCreate() {
    const newName = filterInput.value.trim();
    if (!newName) { alert("Please enter a guild name."); return; }
    // Vérifier si elle existe déjà (insensible à la casse)
    if (allGuilds.some(g => g.name.toLowerCase() === newName.toLowerCase())) {
        alert("This guild already exists. Please select it from the list.");
        return;
    }
    selectGuild(newName); // On passe le nouveau nom, le backend gérera la création si nécessaire
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
    createBtn = document.getElementById('create-new-guild-btn'); // NOUVEAU

    if (!modal || !backdrop || !filterInput || !listContainer || !closeBtn || !createBtn) {
        console.error("[Guild Modal Init] Missing elements.");
        return;
    }

    allGuilds = guildsData || [];

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    createBtn.addEventListener('click', handleCreate); // NOUVEAU

    filterInput.addEventListener('input', () => populateList(filterInput.value));

    filterInput.addEventListener('keydown', (e) => {
        const items = listContainer.querySelectorAll('.suggestion-item');
        // Si la liste est vide et qu'on appuie sur Entrée, on essaie de créer
        if (items.length === 0 && e.key === 'Enter') {
            e.preventDefault();
            handleCreate();
            return;
        }

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
                } else if (filterInput.value.trim() !== '') {
                    // Si rien n'est sélectionné mais qu'il y a du texte, on tente la création
                    handleCreate();
                }
                break;
        }
    });

    listContainer.addEventListener('click', (e) => {
        const item = e.target.closest('.suggestion-item');
        if (item && item.dataset.guildName) selectGuild(item.dataset.guildName);
    });
}