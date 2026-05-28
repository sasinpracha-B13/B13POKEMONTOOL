/* ============================================================
 * Pokémon Tool — Service Worker
 *
 * Two caches:
 *   1. App shell (HTML/CSS/JS/icons/manifest) — cache-first.
 *      Bump APP_SHELL_VERSION below when shipping new code; the
 *      old cache is deleted in the activate handler.
 *
 *   2. PokéAPI responses — network-first with cache fallback.
 *      Same-origin caching API endpoints from pokeapi.co AND the
 *      Pokémon sprites image URLs from raw.githubusercontent.com.
 *      We don't put a TTL on this cache (localStorage layer in
 *      api.js handles that for app logic); SW cache exists purely
 *      to enable offline reads of previously-fetched Pokémon.
 *
 * Message API (from main thread):
 *   { type: 'CLEAR_POKEAPI_CACHE' } — wipes pokeapi cache only
 *   { type: 'CLEAR_ALL_CACHES'   } — wipes both caches (used by
 *                                     "Update app" button before
 *                                     reload)
 * ============================================================ */

const APP_SHELL_VERSION = 'v11';
const APP_SHELL_CACHE = `poketool-shell-${APP_SHELL_VERSION}`;
const POKEAPI_CACHE   = 'poketool-pokeapi-v1';

const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './README.md',
    './css/styles.css',
    './js/data.js',
    './js/version.js',
    './js/api.js',
    './js/search-suggest.js',
    './js/chart.js',
    './js/matchup-ui.js',
    './js/quicklookup.js',
    './js/calc.js',
    './js/team.js',
    './js/detail.js',
    './js/natures.js',
    './js/abilities.js',
    './js/app.js',
    './icons/icon.svg',
    './icons/icon-maskable.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(APP_SHELL_CACHE);
        // Use addAll's individual-tolerant pattern: try one-by-one so a
        // single 404 doesn't poison the install.
        await Promise.all(APP_SHELL.map(async (url) => {
            try {
                const resp = await fetch(url, { cache: 'reload' });
                if (resp.ok) await cache.put(url, resp);
            } catch (e) {
                // Skip files that fail to fetch (e.g. README.md may not be present)
            }
        }));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(
            names
              .filter(n => n.startsWith('poketool-shell-') && n !== APP_SHELL_CACHE)
              .map(n => caches.delete(n))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Same-origin app shell: cache-first
    if (url.origin === self.location.origin) {
        event.respondWith((async () => {
            const cache = await caches.open(APP_SHELL_CACHE);
            const cached = await cache.match(req);
            if (cached) return cached;
            try {
                const resp = await fetch(req);
                if (resp.ok) cache.put(req, resp.clone());
                return resp;
            } catch (err) {
                // Navigation fallback to cached index
                if (req.mode === 'navigate') {
                    const idx = await cache.match('./index.html');
                    if (idx) return idx;
                }
                throw err;
            }
        })());
        return;
    }

    // PokéAPI: network-first, fall back to cache when offline
    if (url.origin === 'https://pokeapi.co' || url.origin === 'https://raw.githubusercontent.com') {
        event.respondWith((async () => {
            const cache = await caches.open(POKEAPI_CACHE);
            try {
                const resp = await fetch(req);
                if (resp.ok) cache.put(req, resp.clone());
                return resp;
            } catch (err) {
                const cached = await cache.match(req);
                if (cached) return cached;
                throw err;
            }
        })());
        return;
    }

    // Anything else: pass through
});

self.addEventListener('message', (event) => {
    const msg = event.data || {};
    if (msg.type === 'CLEAR_POKEAPI_CACHE') {
        event.waitUntil((async () => {
            await caches.delete(POKEAPI_CACHE);
            (await self.clients.matchAll()).forEach(c =>
                c.postMessage({ type: 'POKEAPI_CACHE_CLEARED' }));
        })());
        return;
    }
    if (msg.type === 'CLEAR_ALL_CACHES') {
        event.waitUntil((async () => {
            const names = await caches.keys();
            await Promise.all(names.map(n => caches.delete(n)));
            (await self.clients.matchAll()).forEach(c =>
                c.postMessage({ type: 'ALL_CACHES_CLEARED' }));
        })());
        return;
    }
    if (msg.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
