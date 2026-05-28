/* ============================================================
 * APP MAIN: tab routing + init + PWA registration
 * ============================================================ */

let _abilitiesInited = false;

function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabId);
    });
    document.querySelectorAll('.panel').forEach(p => {
        p.classList.toggle('active', p.id === 'panel-' + tabId);
    });

    if (tabId === 'abilities' && !_abilitiesInited) {
        _abilitiesInited = true;
        initAbilities();
    }
}

function _updateChartBanner() {
    const banner = document.getElementById('chart-era-banner');
    if (!banner) return;
    const msg = chartEraBanner();
    if (msg) {
        banner.textContent = msg;
        banner.style.display = 'block';
    } else {
        banner.style.display = 'none';
    }
    _updateEraBadges();
}

/* Refresh every static "Static Verified · Modern Gen 6+" badge to reflect
 * whichever era is currently active. Elements opt in by adding `.era-badge`
 * and an optional `data-prefix` attribute. */
function _updateEraBadges() {
    const label = CHART_ERA_LABEL[activeChartEra()];
    document.querySelectorAll('.era-badge').forEach(el => {
        const prefix = el.dataset.prefix || '';
        el.textContent = prefix + label;
    });
}

/* ========== ONLINE / OFFLINE BANNER ========== */
function _updateOnlineBanner() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;
    if (navigator.onLine) {
        banner.style.display = 'none';
        return;
    }
    banner.style.display = 'flex';
    banner.innerHTML = `📵 Offline — Type Chart / Calc / Natures ใช้ได้ปกติ • Pokémon ที่เคยค้นยังใช้ได้`;
}

/* ========== SERVICE WORKER ========== */
function _registerSW() {
    const status = document.getElementById('sw-status');
    if (!('serviceWorker' in navigator)) {
        if (status) { status.textContent = 'SW: not supported'; status.classList.add('error'); }
        return;
    }
    navigator.serviceWorker.register('./sw.js').then(reg => {
        if (status) {
            status.textContent = 'SW: active';
            status.classList.add('active');
        }
        // Detect new version available
        reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    _showUpdateBanner(newWorker);
                }
            });
        });
    }).catch(err => {
        console.warn('SW register failed', err);
        if (status) { status.textContent = 'SW: error'; status.classList.add('error'); }
    });

    // Listen for messages from SW
    navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'POKEAPI_CACHE_CLEARED') {
            console.log('PokéAPI SW cache cleared');
        } else if (e.data?.type === 'ALL_CACHES_CLEARED') {
            console.log('All SW caches cleared');
        }
    });
}

function _showUpdateBanner(newWorker) {
    const banner = document.getElementById('sw-update-banner');
    if (!banner) return;
    banner.style.display = 'flex';
    banner.innerHTML = `✨ มี version ใหม่ <button class="link-btn" id="sw-update-btn">โหลดเลย</button>`;
    document.getElementById('sw-update-btn').addEventListener('click', () => {
        newWorker.postMessage({ type: 'SKIP_WAITING' });
        // SW will activate; reload to use new files
        setTimeout(() => location.reload(), 300);
    });
}

/* ========== CACHE CONTROLS ========== */
function _wireCacheControls() {
    document.getElementById('clear-api-cache')?.addEventListener('click', async () => {
        if (!confirm('ลบ Pokémon data cache ทั้งหมด? Recent list และ version setting จะคงอยู่')) return;
        // Clear localStorage cache (keys starting with pkmn-cache-v1: or species list)
        let n = 0;
        for (const key of Object.keys(localStorage)) {
            if (key.startsWith('pkmn-cache-v1:') || key === 'pkmn-species-list-v1') {
                localStorage.removeItem(key);
                n++;
            }
        }
        // Clear SW PokéAPI cache
        if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_POKEAPI_CACHE' });
        }
        alert(`ลบ Pokémon cache ${n} entries แล้ว`);
    });

    document.getElementById('reload-app')?.addEventListener('click', async () => {
        if (!confirm('โหลด version ใหม่จาก server? (clear app shell cache + reload)')) return;
        if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_ALL_CACHES' });
        }
        if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.map(n => caches.delete(n)));
        }
        location.reload();
    });
}

/* ========== PRE-FETCH ========== */
function _prefetchSpeciesList() {
    if (typeof ensureSpeciesList !== 'function') return;
    Promise.resolve().then(() => ensureSpeciesList());
}

/* Light pre-cache for the most commonly-looked-up starters / icons.
 * Best-effort, ignores failures, only runs online. */
const TOP_PREFETCH = ['pikachu', 'charizard', 'bulbasaur', 'squirtle', 'eevee', 'gyarados'];
function _prefetchTopPokemon() {
    if (!navigator.onLine) return;
    setTimeout(() => {
        for (const name of TOP_PREFETCH) {
            try { fetchPokemon(name).catch(() => {}); } catch (e) {}
        }
    }, 2500);
}

function _renderAppVersion() {
    const el = document.getElementById('app-version');
    if (el && typeof APP_VERSION !== 'undefined') {
        el.textContent = `v${APP_VERSION} · ${APP_BUILD_DATE}`;
    }
}

/* ========== INIT ========== */
function init() {
    renderVersionSelector('global-controls');
    _updateChartBanner();
    onVersionChange(_updateChartBanner);

    document.querySelectorAll('.tab').forEach(t => {
        t.addEventListener('click', () => switchTab(t.dataset.tab));
    });

    renderTypeChart();
    initCalc();
    initQuickLookup();
    initTeam();
    initDetail();
    renderNatures();

    _updateOnlineBanner();
    window.addEventListener('online', _updateOnlineBanner);
    window.addEventListener('offline', _updateOnlineBanner);

    _wireCacheControls();
    _registerSW();
    _prefetchSpeciesList();
    _prefetchTopPokemon();
    _renderAppVersion();

    // URL params (?tab=, ?q=)
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) switchTab(tab);
    const q = params.get('q');
    if (q) {
        switchTab('quick');
        document.getElementById('quick-search').value = q;
        quickSearch(q);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
