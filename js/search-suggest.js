/* ============================================================
 * SEARCH AUTOCOMPLETE / FUZZY MATCH
 *
 * One source of truth for the species list shared across
 * Quick Lookup and Pokémon Detail search boxes.
 *
 * Match strategy (case + punctuation insensitive):
 *   1. Exact match on normalized name
 *   2. Prefix match
 *   3. Substring match
 *   4. Numeric Pokédex ID exact match
 * ============================================================ */

const SPECIES_LIST_CACHE_KEY = 'pkmn-species-list-v1';
const SPECIES_LIST_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days

let _speciesList = null;

async function ensureSpeciesList() {
    if (_speciesList) return _speciesList;

    // Try cache
    try {
        const raw = localStorage.getItem(SPECIES_LIST_CACHE_KEY);
        if (raw) {
            const obj = JSON.parse(raw);
            if (Date.now() - obj.t < SPECIES_LIST_TTL_MS && Array.isArray(obj.d)) {
                _speciesList = obj.d;
                return _speciesList;
            }
        }
    } catch (e) {}

    // Fetch
    try {
        const data = await apiGet('/pokemon-species?limit=1500');
        _speciesList = data.results.map(r => {
            const idStr = extractIdFromUrl(r.url);
            return { name: r.name, id: idStr ? parseInt(idStr, 10) : 0 };
        }).filter(p => p.id > 0);
        try {
            localStorage.setItem(SPECIES_LIST_CACHE_KEY, JSON.stringify({ t: Date.now(), d: _speciesList }));
        } catch (e) {}
        return _speciesList;
    } catch (e) {
        console.warn('Failed to fetch species list', e);
        _speciesList = [];
        return _speciesList;
    }
}

/* Strip everything except a-z0-9 — turns "Mr. Mime", "mr-mime",
 * "Type: Null", "type null" all into the same normalized form. */
function normalizeSearch(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/* Resolve a free-form user search to the best candidate name:
 *   - exact species match (case/punctuation-insensitive) → that species
 *   - matches form alias (e.g. "alolan vulpix")          → form's target
 *   - otherwise first findSuggestions() result           → that name
 *   - if nothing matches at all                          → input as-is
 *
 * Used by the search BUTTON handlers so users who type a prefix and
 * hit "ค้นหา" still land on the right Pokémon instead of getting a
 * 404 from the raw text. */
function resolveSearchInput(rawInput) {
    const raw = (rawInput || '').trim();
    if (!raw) return '';

    // Numeric → species ID exact match
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num > 0 && String(num) === raw) {
        if (_speciesList) {
            const hit = _speciesList.find(p => p.id === num);
            if (hit) return hit.name;
        }
        return raw;
    }

    const q = normalizeSearch(raw);
    if (!q) return raw;

    // Direct species name match (handles "Mr. Mime" → "mr-mime")
    if (_speciesList) {
        const exact = _speciesList.find(p => normalizeSearch(p.name) === q);
        if (exact) return exact.name;
    }

    // Form alias exact match
    if (typeof FORM_ALIASES !== 'undefined') {
        const aliasExact = FORM_ALIASES.find(f => normalizeSearch(f.alias) === q);
        if (aliasExact) return aliasExact.target;
    }

    // Fall back to top suggestion (prefix or substring)
    const top = findSuggestions(raw, 1);
    if (top.length > 0) return top[0].name;

    // Nothing — return raw so the caller's error path runs
    return raw;
}

function findSuggestions(query, max = 8) {
    if (!_speciesList) return [];
    const raw = (query || '').trim();
    if (!raw) return [];

    // Numeric query → Pokédex ID match
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num > 0 && String(num) === raw) {
        const matches = _speciesList.filter(p => p.id === num);
        if (matches.length > 0) {
            return matches.map(m => ({ name: m.name, id: m.id, display: capitalize(m.name), kind: 'species' })).slice(0, max);
        }
    }

    const q = normalizeSearch(raw);
    if (!q) return [];

    // Match species (returns { name, id, display, kind: 'species' })
    const exactS = [], prefixS = [], substrS = [];
    for (const p of _speciesList) {
        const n = normalizeSearch(p.name);
        const entry = { name: p.name, id: p.id, display: capitalize(p.name), kind: 'species' };
        if (n === q) exactS.push(entry);
        else if (n.startsWith(q)) prefixS.push(entry);
        else if (n.includes(q)) substrS.push(entry);
    }

    // Match form aliases (returns { name: target, id: baseId, display, kind: 'form' })
    const exactF = [], prefixF = [], substrF = [];
    if (typeof FORM_ALIASES !== 'undefined') {
        for (const f of FORM_ALIASES) {
            const n = normalizeSearch(f.alias);
            const entry = { name: f.target, id: f.baseId, display: f.display, kind: 'form' };
            if (n === q) exactF.push(entry);
            else if (n.startsWith(q)) prefixF.push(entry);
            else if (n.includes(q)) substrF.push(entry);
        }
    }

    const byShortThenId = (a, b) => a.display.length - b.display.length || a.id - b.id;
    prefixS.sort(byShortThenId);
    prefixF.sort(byShortThenId);
    substrS.sort(byShortThenId);
    substrF.sort(byShortThenId);

    // Interleave: exact matches first, then prefix (species before forms), then substring
    return [...exactS, ...exactF, ...prefixS, ...prefixF, ...substrS, ...substrF].slice(0, max);
}

/* Attach autocomplete to an input. The input must be inside a
 * positioned parent (`.search-input-wrap` or similar).
 * onSelect receives the PokéAPI species name (lowercase dash form). */
function attachAutocomplete(inputEl, onSelect) {
    const wrap = inputEl.closest('.search-input-wrap') || inputEl.parentElement;

    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-list';
    dropdown.style.display = 'none';
    wrap.appendChild(dropdown);

    let activeIdx = -1;
    let suggestions = [];

    async function update() {
        await ensureSpeciesList();
        suggestions = findSuggestions(inputEl.value, 8);
        activeIdx = -1;
        render();
    }

    function render() {
        if (suggestions.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        dropdown.style.display = 'block';
        dropdown.innerHTML = suggestions.map((s, i) => {
            const formTag = s.kind === 'form' ? '<span class="ac-form-tag">Form</span>' : '';
            return `
                <div class="autocomplete-item ${i === activeIdx ? 'active' : ''}" data-idx="${i}">
                    <span class="ac-name">${s.display}${formTag}</span>
                    <span class="ac-id">#${String(s.id).padStart(4, '0')}</span>
                </div>
            `;
        }).join('');
        const usePointer = ('PointerEvent' in window);
        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            // pointerdown fires reliably on BOTH mouse + touch (iOS Safari
            // doesn't always synthesize mousedown on div taps, which made
            // suggestions un-tappable on phones). preventDefault stops the
            // input's blur from hiding the dropdown before we read .dataset.
            const pick$ = (e) => {
                e.preventDefault();
                pick(parseInt(item.dataset.idx, 10));
            };
            if (usePointer) {
                item.addEventListener('pointerdown', pick$);
            } else {
                // Legacy fallback for browsers without Pointer Events.
                item.addEventListener('mousedown', pick$);
                item.addEventListener('touchstart', pick$, { passive: false });
            }
        });
    }

    function pick(idx) {
        const s = suggestions[idx];
        if (!s) return;
        inputEl.value = s.name;
        hide();
        onSelect(s.name);
    }

    function hide() {
        dropdown.style.display = 'none';
        activeIdx = -1;
    }

    inputEl.addEventListener('input', update);
    inputEl.addEventListener('focus', () => {
        if (inputEl.value.trim()) update();
    });
    inputEl.addEventListener('blur', () => setTimeout(hide, 150));
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (suggestions.length > 0) {
                e.preventDefault();
                pick(activeIdx >= 0 ? activeIdx : 0);
            } else {
                // No suggestions — fall through to caller's Enter handler (search button)
                e.preventDefault();
                onSelect(inputEl.value.trim());
                hide();
            }
            return;
        }
        if (e.key === 'ArrowDown' && suggestions.length > 0) {
            e.preventDefault();
            activeIdx = activeIdx < 0 ? 0 : (activeIdx + 1) % suggestions.length;
            render();
        } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
            e.preventDefault();
            activeIdx = activeIdx <= 0 ? suggestions.length - 1 : activeIdx - 1;
            render();
        } else if (e.key === 'Escape') {
            hide();
        }
    });
}
