/* ============================================================
 * PokéAPI wrapper with localStorage caching
 * https://pokeapi.co/
 *
 * Cache returns { data, cached: true } so UI can show "Cached" badge.
 * ============================================================ */

const API_BASE = 'https://pokeapi.co/api/v2';
const CACHE_PREFIX = 'pkmn-cache-v1:';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function _cacheGet(key) {
    try {
        const raw = localStorage.getItem(CACHE_PREFIX + key);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (Date.now() - obj.t > CACHE_TTL_MS) {
            localStorage.removeItem(CACHE_PREFIX + key);
            return null;
        }
        return obj.d;
    } catch (e) { return null; }
}

function _cacheSet(key, data) {
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), d: data }));
    } catch (e) { /* quota exceeded — silently ignore */ }
}

/* Track whether the LAST apiGet was a cache hit. Reset per top-level fetch. */
let _lastCacheHit = false;
function lastWasCached() { return _lastCacheHit; }

async function apiGet(path) {
    const cached = _cacheGet(path);
    if (cached) {
        _lastCacheHit = true;
        return cached;
    }
    _lastCacheHit = false;
    const res = await fetch(API_BASE + path);
    if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
    const data = await res.json();
    _cacheSet(path, data);
    return data;
}

/* Pokémon endpoints — these accept name or id */
async function fetchPokemon(nameOrId) {
    const id = String(nameOrId).toLowerCase().trim();
    return apiGet(`/pokemon/${id}`);
}

async function fetchSpecies(nameOrId) {
    const id = String(nameOrId).toLowerCase().trim();
    return apiGet(`/pokemon-species/${id}`);
}

async function fetchEvolutionChain(url) {
    const path = url.replace(API_BASE, '');
    return apiGet(path);
}

async function fetchAbility(nameOrId) {
    const id = String(nameOrId).toLowerCase().trim();
    return apiGet(`/ability/${id}`);
}

async function fetchAbilityList() {
    return apiGet('/ability?limit=400');
}

/* Locations — uses fresh fetch (not cached via apiGet because of long URLs);
   we still cache it. */
async function fetchEncounters(pokemonId) {
    const path = `/pokemon/${pokemonId}/encounters`;
    return apiGet(path);
}

/* Fetch all forms (varieties) of a species */
async function fetchVarieties(speciesData) {
    // speciesData.varieties is [{ is_default, pokemon: { name, url } }]
    return speciesData.varieties || [];
}
