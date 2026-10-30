// ════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════

// This script sits at the end of <body> and the CDN scripts load before it in order,
// so the library and the DOM are both ready — no delay needed.
if (sb) {
    sb.auth.onAuthStateChange(event => {
        if (event === 'PASSWORD_RECOVERY') {
            recoveryMode = true;
            showNewPasswordForm();
        }
    });
}
// A crew invite link (?crew=CODE): keep the code through sign-up, and tidy the address
(() => {
    const code = new URLSearchParams(location.search).get('crew');
    if (!code) return;
    try { localStorage.setItem('odyr_crew_invite', code.toUpperCase().slice(0, 6)); } catch (e) { /* private mode */ }
    history.replaceState(null, '', location.pathname);
})();
checkAuth();
scheduleSplashHide();

// Offline support + "Add to Home Screen" (see sw.js)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(error => console.warn('Service worker not registered:', error));
}
