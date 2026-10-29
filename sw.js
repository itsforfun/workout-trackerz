// Service worker: lets the app open without signal and installs it to the home screen.
// - The app page itself: network first (so updates show up), cached copy when offline.
// - Libraries and fonts from CDNs: cached copy first, refreshed in the background.
// - Supabase (login + data) is never cached; the page keeps its own offline copy of your data.
// - Push: shows the "rest over" notification sent by the rest-push Supabase function.
// Bump CACHE when changing this file's caching rules.
const CACHE = 'odyr-v17';
const APP_SHELL = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css', 'fonts/instrument-serif-latin.woff2', 'fonts/instrument-serif-latin-ext.woff2', 'lang/fr.js', 'js/i18n.js', 'js/splash.js', 'js/core.js', 'js/auth.js', 'js/sync.js', 'js/programs.js', 'js/today.js', 'js/steps.js', 'js/builder.js', 'js/workout.js', 'js/guide.js', 'js/summary.js', 'js/rewards.js', 'js/progress.js', 'js/coach.js', 'js/pro.js', 'js/diagnostics.js', 'js/tabbar.js', 'js/polish.js', 'js/main.js', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    if (url.origin === self.location.origin) {
        event.respondWith(networkFirst(request));
    } else if (CDN_HOSTS.includes(url.hostname)) {
        event.respondWith(staleWhileRevalidate(request));
    }
    // Everything else (Supabase) goes straight to the network
});

async function networkFirst(request) {
    const cache = await caches.open(CACHE);
    try {
        // no-cache: always ask GitHub Pages for the newest page instead of the browser's 10-minute copy
        const response = await fetch(request.mode === 'navigate' ? request.url : request, { cache: 'no-cache' });
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch (error) {
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === 'navigate') return cache.match('index.html');
        throw error;
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    const refresh = fetch(request)
        .then(response => {
            if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
            return response;
        })
        .catch(() => cached);
    return cached || refresh;
}

// Lock-screen rest alert from the rest-push function (see supabase/functions/rest-push)
self.addEventListener('push', event => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (error) {
        data = { body: event.data && event.data.text() };
    }
    event.waitUntil(self.registration.showNotification(data.title || 'Rest over', {
        body: data.body || 'Time for your next set',
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: data.tag || 'rest-timer',   // reminders use their own tag so they don't replace a rest alert
        renotify: true,
        vibrate: [200, 100, 200],
    }));
});

// Tapping the notification brings the app back to the front
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows =>
            windows.length ? windows[0].focus() : self.clients.openWindow('./'))
    );
});
