/* ============================================================
 * QUICK LOOKUP
 * Search Pokémon → instant matchup card
 *   - Types
 *   - Form selector (varieties from species)
 *   - Defense + Offense matchups (static calc)
 *   - "Open Full Details" button → jumps to Pokémon Detail tab
 *
 * Goal: ultra fast, minimal scrolling, offline-safe (after first fetch).
 * ============================================================ */

const QUICK_RECENT_KEY = 'pkmn-quick-recent-v1';
const QUICK_RECENT_MAX = 8;

let _quickCurrentSpecies = null;   // species data of last loaded
let _quickCurrentPokemon = null;   // currently displayed variant pokemon data
let _quickForms = [];              // varieties

function initQuickLookup() {
    const input = document.getElementById('quick-search');
    const btn = document.getElementById('quick-search-btn');

    // Autocomplete handles Enter + click-suggestion. We pipe selections
    // through quickSearch() so behavior stays consistent.
    attachAutocomplete(input, name => quickSearch(name));
    btn.addEventListener('click', async () => {
        await ensureSpeciesList();
        const resolved = resolveSearchInput(input.value);
        if (resolved && resolved !== input.value) input.value = resolved;
        quickSearch(resolved);
    });

    renderQuickRecent();

    // Jump-to-calc link
    document.querySelectorAll('[data-jump-tab]').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            switchTab(el.dataset.jumpTab);
        });
    });
}

function _getQuickRecent() {
    try { return JSON.parse(localStorage.getItem(QUICK_RECENT_KEY) || '[]'); }
    catch { return []; }
}

function _pushQuickRecent(name) {
    let list = _getQuickRecent().filter(n => n !== name);
    list.unshift(name);
    list = list.slice(0, QUICK_RECENT_MAX);
    localStorage.setItem(QUICK_RECENT_KEY, JSON.stringify(list));
    renderQuickRecent();
}

function renderQuickRecent() {
    const c = document.getElementById('quick-recent');
    if (!c) return;
    const list = _getQuickRecent();
    if (list.length === 0) {
        c.innerHTML = '<span style="color:var(--text-faint);font-size:12px;">— ยังไม่มี —</span>';
        return;
    }
    c.innerHTML = list.map(n => `<span class="recent-chip" data-name="${n}">${capitalize(n)}</span>`).join('');
    c.querySelectorAll('.recent-chip').forEach(chip => {
        chip.addEventListener('click', () => quickSearch(chip.dataset.name));
    });
}

async function quickSearch(query) {
    query = (query || '').trim().toLowerCase();
    if (!query) return;

    const result = document.getElementById('quick-result');
    result.innerHTML = '<div class="loading-state"><div class="loader"></div><p>กำลังโหลด...</p></div>';

    try {
        // Step 1: fetch the requested pokemon (variant) and its species
        const pokemon = await fetchPokemon(query);
        const wasCached = lastWasCached();
        const species = await fetchSpecies(pokemon.species.name);

        _quickCurrentSpecies = species;
        _quickCurrentPokemon = pokemon;
        _quickForms = species.varieties || [];

        _pushQuickRecent(pokemon.name);
        renderQuickCard(pokemon, species, wasCached);
    } catch (e) {
        console.error(e);
        if (!navigator.onLine) {
            result.innerHTML = `<div class="error-state">
                📵 <strong>Offline</strong> — โปเกม่อน "${query}" ยังไม่เคย cache ในเครื่องนี้<br>
                <small style="opacity:0.85">ต่อเน็ตแล้วลองอีกครั้ง — Type Calc และ Type Chart ยังใช้ได้</small>
            </div>`;
        } else {
            result.innerHTML = `<div class="error-state">
                ❌ ไม่พบโปเกม่อน "${query}" — ตรวจสอบชื่อภาษาอังกฤษหรือเลข Pokédex<br>
                <small style="opacity:0.7">${e.message || ''}</small>
            </div>`;
        }
    }
}

function renderQuickCard(pokemon, species, wasCached) {
    const types = pokemon.types.map(t => t.type.name);
    const sprite = pokemon.sprites.other?.['official-artwork']?.front_default
        || pokemon.sprites.front_default
        || '';
    const dexNum = species.id;
    const speciesName = species.name;

    // Form selector
    const forms = _quickForms;
    const hasForms = forms.length > 1;
    const formOptions = hasForms ? forms.map(v => {
        const sel = v.pokemon.name === pokemon.name ? 'selected' : '';
        return `<option value="${v.pokemon.name}" ${sel}>${formatFormName(v.pokemon.name, speciesName)}${v.is_default ? ' · ค่าเริ่มต้น' : ''}</option>`;
    }).join('') : '';

    const formCell = hasForms ? `
        <div class="form-cell">
            <span class="quick-form-label">เลือกฟอร์ม</span>
            <select class="quick-form-select" id="quick-form-select">${formOptions}</select>
        </div>
    ` : '';

    const cachedBadge = wasCached ? '<span class="data-badge cached">Cached</span>' : '';
    const dataNote = `📦 PokéAPI ${wasCached ? '(cache)' : ''} · 🧮 Matchup คำนวณจาก static chart`;

    const displayName = prettyPokemonName(pokemon.name, speciesName);

    const html = `
        <div class="quick-card">
            <div class="quick-header">
                <div class="quick-sprite"><img src="${sprite}" alt="${pokemon.name}"></div>
                <div class="quick-meta">
                    <div class="dex-num">#${String(dexNum).padStart(4, '0')}</div>
                    <h3>${displayName}</h3>
                    <div class="types">${renderTypeBadges(types)}</div>
                </div>
                ${formCell}
            </div>
            ${renderMatchupBody(types)}
            <div class="quick-footer">
                <div class="meta-info">${dataNote} ${cachedBadge}</div>
                <div class="quick-footer-actions">
                    <button class="btn-team" id="add-to-team" data-name="${pokemon.name}">+ Add to Team</button>
                    <button class="btn-detail" id="open-full-detail" data-name="${pokemon.name}">ดูข้อมูลเต็ม →</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('quick-result').innerHTML = html;

    // Wire form selector
    const formSel = document.getElementById('quick-form-select');
    if (formSel) {
        formSel.addEventListener('change', async (e) => {
            await loadQuickVariant(e.target.value);
        });
    }

    // Wire detail button
    document.getElementById('open-full-detail').addEventListener('click', () => {
        switchTab('detail');
        if (typeof loadDetailPokemon === 'function') {
            loadDetailPokemon(pokemon.name);
        }
    });

    // Wire add-to-team
    document.getElementById('add-to-team')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const variant = btn.dataset.name;
        btn.disabled = true;
        btn.textContent = 'Adding...';
        const ok = await teamAddPokemon(variant);
        btn.disabled = false;
        btn.textContent = ok ? '✓ Added' : '+ Add to Team';
        if (ok) setTimeout(() => { btn.textContent = '+ Add to Team'; }, 2500);
    });
}

async function loadQuickVariant(variantName) {
    const result = document.getElementById('quick-result');
    const existing = result.querySelector('.quick-card');
    if (existing) existing.style.opacity = '0.5';
    try {
        const pokemon = await fetchPokemon(variantName);
        const wasCached = lastWasCached();
        _quickCurrentPokemon = pokemon;
        renderQuickCard(pokemon, _quickCurrentSpecies, wasCached);
    } catch (e) {
        console.error(e);
        if (existing) existing.style.opacity = '1';
    }
}
