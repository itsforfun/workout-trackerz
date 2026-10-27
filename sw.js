// Service worker: lets the app open without signal and installs it to the home screen.
// - The app page itself: network first (so updates show up), cached copy when offline.
// - Libraries and fonts from CDNs: cached copy first, refreshed in the background.
// - Supabase (login + data) is never cached; the page keeps its own offline copy of your data.
// Bump CACHE when changing this file's caching rules.
const CACHE = 'workout-tracker-v1';
const APP_SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
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
        const response = await fetch(request);
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
