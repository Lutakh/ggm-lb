export function initNavigation() {
    const mainNav = document.getElementById('main-nav');
    const topNav = document.getElementById('top-nav');
    const mainSections = document.querySelectorAll('.main-section');
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section');

    if (!mainNav || !topNav) return;

    const homeBtn = document.createElement('a');
    homeBtn.href = '/';
    homeBtn.className = 'nav-btn';
    homeBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg><span>Home</span>`;

    const navButtons = [
        { target: 'add-update-section', svg: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>', label: 'Add / Update' },
        { target: 'players-leaderboard-section', svg: '<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>', label: 'Players' },
        { target: 'teams-leaderboard-section', svg: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-9h4v-2h-4v2zm0 4h4v-2h-4v2z"/></svg>', label: 'Teams' },
        { target: 'guilds-leaderboard-section', svg: '<svg viewBox="0 0 24 24"><path d="M12 3L4 9v12h16V9l-8-6zm0 2.62L17.19 9H6.81L12 5.62zM6 19v-8.45l6 4.5 6-4.5V19H6z"/></svg>', label: 'Guilds' },
        { target: 'perilous-trials-section', svg: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>', label: 'Perilous Trials' },
    ];
    
    // Vider les conteneurs pour éviter les doublons au rechargement à chaud
    mainNav.innerHTML = '';
    topNav.innerHTML = '';

    navButtons.forEach(b => {
        const btn = document.createElement('button');
        btn.className = 'nav-btn';
        btn.dataset.target = b.target;
        btn.innerHTML = `${b.svg}<span>${b.label}</span>`;
        mainNav.appendChild(btn.cloneNode(true));
        topNav.appendChild(btn);
    });
    topNav.prepend(homeBtn);

    function showSection(targetId) {
        document.body.classList.add('section-active');
        mainSections.forEach(s => { s.style.display = s.id === targetId ? 'block' : 'none'; });
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.target === targetId);
        });
    }

    if (section) {
        showSection(section);
    } else {
        document.body.classList.remove('section-active');
    }

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (btn.dataset.target) showSection(btn.dataset.target);
            else window.location.href = '/';
        });
    });
}
