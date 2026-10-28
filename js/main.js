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
checkAuth();
scheduleSplashHide();

// Offline support + "Add to Home Screen" (see sw.js)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(error => console.warn('Service worker not registered:', error));
}
