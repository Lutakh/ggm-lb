export function initNavigation() {
    // --- SÉLECTEURS ---
    const navModalBtn = document.getElementById('home-nav-btn'); // Mobile
    const navModal = document.getElementById('nav-modal');
    const navModalBackdrop = document.getElementById('nav-modal-backdrop');
    const navModalContent = document.getElementById('nav-modal-content');
    const navModalCloseBtn = document.getElementById('nav-modal-close-btn');

    const desktopSidebarBtns = document.querySelectorAll('#desktop-sidebar .sidebar-btn'); // Desktop

    const mainSections = document.querySelectorAll('.main-section');
    const urlParams = new URLSearchParams(window.location.search);
    let currentSection = urlParams.get('section'); // Garder une trace

    // --- FONCTIONS ---
    function openNavModal() {
        navModal.style.display = 'flex';
        navModalBackdrop.style.display = 'block';
    }

    function closeNavModal() {
        navModal.style.display = 'none';
        navModalBackdrop.style.display = 'none';
    }

    // Met à jour l'état actif (visuel) des boutons (sidebar et potentiellement modal)
    function updateActiveButton(targetId) {
        // Barre latérale Desktop
        desktopSidebarBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.target === targetId);
        });
        // Pourrait aussi mettre à jour l'état dans la modale si nécessaire
    }

    function showSection(targetId) {
        if (!targetId) return; // Ne rien faire si targetId est null/undefined
        document.body.classList.add('section-active');
        mainSections.forEach(s => {
            s.classList.toggle('active', s.id === targetId); // Utiliser classList pour gérer .active
            s.style.display = s.id === targetId ? 'block' : 'none'; // Garder display pour compatibilité
        });
        updateActiveButton(targetId); // Mettre à jour le bouton actif
        currentSection = targetId; // Mémoriser la section

        // Met à jour l'URL
        const url = new URL(window.location);
        url.searchParams.set('section', targetId);
        window.history.pushState({ section: targetId }, '', url);
    }

    function goToHome() {
        document.body.classList.remove('section-active');
        mainSections.forEach(s => {
            s.classList.remove('active');
            s.style.display = 'none';
        });
        updateActiveButton('home'); // Activer le bouton Home
        currentSection = null; // Aucune section active

        // Met à jour l'URL
        const url = new URL(window.location);
        url.searchParams.delete('section');
        window.history.pushState({ section: null }, '', url);
    }

    // --- REMPLISSAGE MODALE MOBILE (INCHANGÉ) ---
    if (navModalBtn && navModal && navModalContent) {
        const homeBtnData = { href: '/', svg: '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>', label: 'Home' };
        const navButtonsData = [
            { target: 'add-update-section', svg: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>', label: 'Add / Update' },
            { target: 'players-leaderboard-section', svg: '<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>', label: 'Players' },
            { target: 'teams-leaderboard-section', svg: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-9h4v-2h-4v2zm0 4h4v-2h-4v2z"/></svg>', label: 'Teams' },
            { target: 'guilds-leaderboard-section', svg: '<svg viewBox="0 0 24 24"><path d="M12 3L4 9v12h16V9l-8-6zm0 2.62L17.19 9H6.81L12 5.62zM6 19v-8.45l6 4.5 6-4.5V19H6z"/></svg>', label: 'Guilds' },
            { target: 'perilous-trials-section', svg: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>', label: 'Perilous Trials' },
        ];

        navModalContent.innerHTML = ''; // Vider au cas où

        // Bouton Home (Modale)
        const homeLink = document.createElement('a');
        homeLink.href = homeBtnData.href;
        homeLink.className = 'nav-btn-modal';
        homeLink.innerHTML = `${homeBtnData.svg}<span>${homeBtnData.label}</span>`;
        homeLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeNavModal();
            goToHome();
        });
        navModalContent.appendChild(homeLink);

        // Autres boutons de section (Modale)
        navButtonsData.forEach(b => {
            const btn = document.createElement('button');
            btn.className = 'nav-btn-modal';
            btn.dataset.target = b.target;
            btn.innerHTML = `${b.svg}<span>${b.label}</span>`;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                closeNavModal();
                showSection(b.target);
            });
            navModalContent.appendChild(btn);
        });

        // Événements Modale Mobile
        navModalBtn.addEventListener('click', openNavModal);
        navModalCloseBtn.addEventListener('click', closeNavModal);
        navModalBackdrop.addEventListener('click', closeNavModal);
    }

    // --- NOUVEAU: ÉVÉNEMENTS SIDEBAR DESKTOP ---
    desktopSidebarBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const target = btn.dataset.target;
            if (target === 'home') {
                goToHome();
            } else {
                showSection(target);
            }
        });
    });

    // --- INITIALISATION ---
    // Afficher la section initiale ou l'état Home
    if (currentSection) {
        showSection(currentSection);
    } else {
        goToHome(); // Assure que le bouton Home est actif si aucune section n'est spécifiée
    }

    // Gérer l'historique de navigation (boutons précédent/suivant du navigateur)
    window.addEventListener('popstate', (event) => {
        const stateSection = event.state ? event.state.section : null;
        if (stateSection) {
            showSection(stateSection);
        } else {
            goToHome();
        }
    });
}