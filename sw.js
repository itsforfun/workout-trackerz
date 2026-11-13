// Service worker: lets the app open without signal and installs it to the home screen.
// - The app page itself: network first (so updates show up), cached copy when offline.
// - Libraries and fonts from CDNs: cached copy first, refreshed in the background.
// - Supabase (login + data) is never cached; the page keeps its own offline copy of your data.
// - Push: shows the "rest over" notification sent by the rest-push Supabase function.
// Bump CACHE when changing this file's caching rules.
const CACHE = 'odyr-v74';
const APP_SHELL = ['./', 'index.html', 'privacy.html', 'manifest.webmanifest', 'css/app.css', 'fonts/instrument-serif-latin.woff2', 'fonts/instrument-serif-latin-ext.woff2', 'lang/fr.js', 'js/i18n.js', 'js/splash.js', 'js/core.js', 'js/sound.js', 'js/auth.js', 'js/sync.js', 'js/programs.js', 'js/today.js', 'js/steps.js', 'js/builder.js', 'js/workout.js', 'js/cardio.js', 'js/guide.js', 'js/library.js', 'js/anatomy-data.js', 'js/anatomy.js', 'js/body3d.js', 'js/summary.js', 'js/rewards.js', 'js/odyssey.js', 'js/journal.js', 'js/prologue.js', 'js/quests.js', 'js/crews.js', 'js/progress.js', 'js/coach.js', 'js/pro.js', 'js/diagnostics.js', 'js/tabbar.js', 'js/polish.js', 'js/main.js', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
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

// Network first, but never wait long on weak signal (gyms!): after 3 s the saved copy opens the app
// while the download carries on and refreshes the cache for next time.
const NETWORK_WAIT_MS = 3000;
async function networkFirst(request) {
    const cache = await caches.open(CACHE);
    const cachedCopy = () => cache.match(request, { ignoreSearch: true })
        .then(hit => hit || (request.mode === 'navigate' ? cache.match('index.html') : undefined));
    // no-cache: always ask GitHub Pages for the newest file instead of the browser's 10-minute copy
    const network = fetch(request.mode === 'navigate' ? request.url : request, { cache: 'no-cache' })
        .then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
        });
    network.catch(() => { /* handled below; this keeps a late failure from being reported */ });
    const slow = new Promise(resolve => setTimeout(resolve, NETWORK_WAIT_MS)).then(cachedCopy);
    try {
        const first = await Promise.race([network, slow]);
        if (first) return first;
        return await network;   // nothing saved yet: keep waiting for the network
    } catch (error) {
        const cached = await cachedCopy();
        if (cached) return cached;
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
