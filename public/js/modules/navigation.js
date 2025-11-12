// public/js/modules/navigation.js

// NOUVEAU : Fonction pour envoyer une "page vue" à Google Analytics
function trackGAPageView(pageId) {
    if (typeof gtag === 'function') {
        const pageTitle = pageId || 'home';
        const pageLocation = window.location.href; // GA4 utilise 'page_location'

        // Envoie l'événement de vue de page à GA4
        gtag('event', 'page_view', {
            'page_title': pageTitle,
            'page_location': pageLocation
        });

        // Log pour déboguer (optionnel)
        // console.log(`GA Page View Tracked: ${pageTitle}`);
    }
}

export function initNavigation() {
    const navModalBtn = document.getElementById('home-nav-btn');
    const navModal = document.getElementById('nav-modal');
    const navModalBackdrop = document.getElementById('nav-modal-backdrop');
    const navModalContent = document.getElementById('nav-modal-content');
    const navModalCloseBtn = document.getElementById('nav-modal-close-btn');
    const desktopSidebarBtns = document.querySelectorAll('#desktop-sidebar .sidebar-btn');
    const mainSections = document.querySelectorAll('.main-section');
    const urlParams = new URLSearchParams(window.location.search);
    let currentSectionId = urlParams.get('section') || 'home';

    function openNavModal() {
        if (navModal) navModal.style.display = 'flex';
        if (navModalBackdrop) navModalBackdrop.style.display = 'block';
    }

    function closeNavModal() {
        if (navModal) navModal.style.display = 'none';
        if (navModalBackdrop) navModalBackdrop.style.display = 'none';
    }

    function updateActiveButtonVisuals(targetId) {
        desktopSidebarBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.target === targetId);
        });
    }

    function showSection(targetId) {
        if (!targetId || targetId === 'home') {
            goToHomeState();
            return;
        }
        let sectionFound = false;
        document.body.classList.add('section-active');
        mainSections.forEach(s => {
            const isActive = s.id === targetId;
            s.classList.toggle('active', isActive);
            s.style.display = isActive ? 'block' : 'none';
            if (isActive) sectionFound = true;
        });
        if (sectionFound) {
            updateActiveButtonVisuals(targetId);
            currentSectionId = targetId;
            const url = new URL(window.location);
            url.searchParams.set('section', targetId);
            window.history.pushState({ section: targetId }, '', url);

            trackGAPageView(targetId); // <<< MODIFICATION AJOUTÉE
        } else {
            goToHomeState();
        }
    }

    function goToHomeState() {
        document.body.classList.remove('section-active');
        mainSections.forEach(s => {
            s.classList.remove('active');
            s.style.display = 'none';
        });
        updateActiveButtonVisuals('home');
        currentSectionId = 'home';
        const url = new URL(window.location);
        url.searchParams.delete('section');
        window.history.pushState({ section: 'home' }, '', url);

        trackGAPageView('home'); // <<< MODIFICATION AJOUTÉE
    }

    if (navModalBtn && navModal && navModalContent && navModalCloseBtn && navModalBackdrop) {
        const homeBtnData = { target: 'home', href: '/', svg: '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>', label: 'Home' };
        const navButtonsData = [
            // AJOUT DU LIEN TEAM PLANNER ICI
            { target: 'team-planner-section', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>', label: 'Team Planner' },            { target: 'add-update-section', svg: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>', label: 'Add / Update' },
            { target: 'players-leaderboard-section', svg: '<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>', label: 'Players' },
            { target: 'teams-leaderboard-section', svg: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-9h4v-2h-4v2zm0 4h4v-2h-4v2z"/></svg>', label: 'Teams' },
            { target: 'guilds-leaderboard-section', svg: '<svg viewBox="0 0 24 24"><path d="M12 3L4 9v12h16V9l-8-6zm0 2.62L17.19 9H6.81L12 5.62zM6 19v-8.45l6 4.5 6-4.5V19H6z"/></svg>', label: 'Guilds' },
            { target: 'perilous-trials-section', svg: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>', label: 'Perilous Trials' },
            { target: 'daily-quests-section', svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>', label: 'Daily Quests' },
        ];

        navModalContent.innerHTML = '';
        const homeLink = document.createElement('a');
        homeLink.href = homeBtnData.href;
        homeLink.className = 'nav-btn-modal';
        homeLink.dataset.target = homeBtnData.target;
        homeLink.innerHTML = `${homeBtnData.svg}<span>${homeBtnData.label}</span>`;
        homeLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeNavModal();
            goToHomeState();
        });
        navModalContent.appendChild(homeLink);

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

        navModalBtn.addEventListener('click', openNavModal);
        navModalCloseBtn.addEventListener('click', closeNavModal);
        navModalBackdrop.addEventListener('click', closeNavModal);
    }

    if (desktopSidebarBtns.length > 0) {
        desktopSidebarBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                showSection(btn.dataset.target);
            });
        });
    }

    // Cet appel initial va déclencher soit showSection(id) soit goToHomeState(),
    // qui traceront tous les deux la première vue de page.
    showSection(currentSectionId);

    window.addEventListener('popstate', (event) => {
        const stateSection = event.state ? event.state.section : 'home';
        showSection(stateSection); // showSection tracera automatiquement la vue
    });
}