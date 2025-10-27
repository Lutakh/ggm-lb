// public/js/modules/navigation.js
export function initNavigation() {
    // --- SÉLECTEURS ---
    const navModalBtn = document.getElementById('home-nav-btn'); // Mobile Nav Button (Hamburger)
    const navModal = document.getElementById('nav-modal');
    const navModalBackdrop = document.getElementById('nav-modal-backdrop');
    const navModalContent = document.getElementById('nav-modal-content');
    const navModalCloseBtn = document.getElementById('nav-modal-close-btn');

    const desktopSidebarBtns = document.querySelectorAll('#desktop-sidebar .sidebar-btn'); // Desktop Sidebar Buttons

    const mainSections = document.querySelectorAll('.main-section'); // All content sections
    const urlParams = new URLSearchParams(window.location.search);
    let currentSectionId = urlParams.get('section') || 'home'; // Track current section, default to 'home' state

    // --- Helper Functions ---
    function openNavModal() {
        if (navModal) navModal.style.display = 'flex';
        if (navModalBackdrop) navModalBackdrop.style.display = 'block';
    }

    function closeNavModal() {
        if (navModal) navModal.style.display = 'none';
        if (navModalBackdrop) navModalBackdrop.style.display = 'none';
    }

    // Updates the active state (visual highlight) for sidebar and potentially modal buttons
    function updateActiveButtonVisuals(targetId) {
        // Desktop Sidebar
        desktopSidebarBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.target === targetId);
        });
        // You could add similar logic for buttons inside the mobile modal if needed
        // For example, finding the button with the matching data-target and adding/removing an 'active' class.
    }

    // Shows the target section, hides others, updates URL and button states
    function showSection(targetId) {
        if (!targetId || targetId === 'home') {
            goToHomeState(); // Handle 'home' as a special case
            return;
        }

        let sectionFound = false;
        document.body.classList.add('section-active'); // Add class to body when a section is active
        mainSections.forEach(s => {
            const isActive = s.id === targetId;
            s.classList.toggle('active', isActive);
            s.style.display = isActive ? 'block' : 'none'; // Ensure visibility toggles correctly
            if (isActive) sectionFound = true;
        });

        if (sectionFound) {
            updateActiveButtonVisuals(targetId); // Update button highlight
            currentSectionId = targetId; // Store the currently active section ID

            // Update URL without reloading the page
            const url = new URL(window.location);
            url.searchParams.set('section', targetId);
            window.history.pushState({ section: targetId }, '', url);
        } else {
            console.warn(`Section with ID "${targetId}" not found. Going to home state.`);
            goToHomeState(); // Fallback to home if section doesn't exist
        }
    }

    // Handles returning to the initial state (no section selected)
    function goToHomeState() {
        document.body.classList.remove('section-active'); // Remove body class
        mainSections.forEach(s => {
            s.classList.remove('active');
            s.style.display = 'none'; // Hide all sections
        });
        updateActiveButtonVisuals('home'); // Highlight the 'Home' button in the sidebar
        currentSectionId = 'home'; // Set current state to 'home'

        // Update URL to remove the 'section' parameter
        const url = new URL(window.location);
        url.searchParams.delete('section');
        // Add a state for 'home' so back/forward works correctly
        window.history.pushState({ section: 'home' }, '', url);
    }

    // --- Populate Mobile Navigation Modal ---
    if (navModalBtn && navModal && navModalContent && navModalCloseBtn && navModalBackdrop) {
        // Define the data for navigation buttons (including the new Daily Quests)
        const homeBtnData = { target: 'home', href: '/', svg: '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>', label: 'Home' };
        const navButtonsData = [
            { target: 'add-update-section', svg: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>', label: 'Add / Update' },
            { target: 'players-leaderboard-section', svg: '<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>', label: 'Players' },
            { target: 'teams-leaderboard-section', svg: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-9h4v-2h-4v2zm0 4h4v-2h-4v2z"/></svg>', label: 'Teams' },
            { target: 'guilds-leaderboard-section', svg: '<svg viewBox="0 0 24 24"><path d="M12 3L4 9v12h16V9l-8-6zm0 2.62L17.19 9H6.81L12 5.62zM6 19v-8.45l6 4.5 6-4.5V19H6z"/></svg>', label: 'Guilds' },
            { target: 'perilous-trials-section', svg: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>', label: 'Perilous Trials' },
            // *** AJOUTÉ ICI ***
            { target: 'daily-quests-section', svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>', label: 'Daily Quests' },
        ];

        navModalContent.innerHTML = ''; // Clear previous content

        // Create Home Button for Mobile Modal
        const homeLink = document.createElement('a');
        homeLink.href = homeBtnData.href; // Use href for link semantics
        homeLink.className = 'nav-btn-modal';
        homeLink.dataset.target = homeBtnData.target; // Use data-target for consistency
        homeLink.innerHTML = `${homeBtnData.svg}<span>${homeBtnData.label}</span>`;
        homeLink.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior
            closeNavModal();
            goToHomeState(); // Go to home state
        });
        navModalContent.appendChild(homeLink);

        // Create other section buttons for Mobile Modal
        navButtonsData.forEach(b => {
            const btn = document.createElement('button'); // Use buttons for actions
            btn.className = 'nav-btn-modal';
            btn.dataset.target = b.target;
            btn.innerHTML = `${b.svg}<span>${b.label}</span>`;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                closeNavModal();
                showSection(b.target); // Show the target section
            });
            navModalContent.appendChild(btn);
        });

        // Attach event listeners for mobile modal controls
        navModalBtn.addEventListener('click', openNavModal);
        navModalCloseBtn.addEventListener('click', closeNavModal);
        navModalBackdrop.addEventListener('click', closeNavModal);

    } else {
        console.warn("Mobile navigation modal elements not found. Mobile navigation will be unavailable.");
    }


    // --- Attach Event Listeners for Desktop Sidebar ---
    if (desktopSidebarBtns.length > 0) {
        desktopSidebarBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const target = btn.dataset.target;
                showSection(target); // Handles both 'home' and other sections
            });
        });
    } else {
        console.warn("Desktop sidebar buttons not found. Desktop navigation might not work.");
    }

    // --- Initial State Setup ---
    // Show the section specified in the URL on load, or default to home state
    console.log("Initial section ID from URL:", currentSectionId);
    showSection(currentSectionId); // This will call goToHomeState if currentSectionId is 'home' or invalid

    // --- Handle Browser Back/Forward Buttons ---
    window.addEventListener('popstate', (event) => {
        // event.state might be null if the initial state wasn't pushed correctly or navigating outside history
        const stateSection = event.state ? event.state.section : 'home'; // Default to home if state is missing
        console.log("Popstate event, section:", stateSection);
        showSection(stateSection);
    });

    console.log("Navigation initialized.");
}