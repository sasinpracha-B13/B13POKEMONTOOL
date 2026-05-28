/* ============================================================
 * ABILITIES — search, category filter, detail, back nav
 *
 * Categories come from a hand-curated ABILITY_TAGS dictionary in
 * data.js (PokéAPI does not expose tags). Abilities without tags
 * fall into "Other".
 *
 * When entered from a Pokémon's ability pill, a "← Back" button
 * returns the user to that Pokémon's Detail Abilities subtab.
 * ============================================================ */

let _allAbilities = null;
let _activeAbilityCategory = 'all';
let _lastAbilityFrom = null;        // pokemon name we came from (for back nav)

async function initAbilities() {
    const input = document.getElementById('ability-search');
    const btn = document.getElementById('ability-search-btn');

    btn.addEventListener('click', () => doAbilitySearch(input.value));
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') doAbilitySearch(input.value);
    });
    input.addEventListener('input', () => renderAbilityList(input.value));

    await ensureAbilityList();
    _renderCategoryChips();
    renderAbilityList('');
}

async function ensureAbilityList() {
    if (_allAbilities) return _allAbilities;
    const listContainer = document.getElementById('ability-list');
    listContainer.innerHTML = '<div class="loading-state"><div class="loader"></div></div>';
    try {
        const data = await fetchAbilityList();
        _allAbilities = data.results
            .map(a => a.name)
            .filter(n => !n.includes('-past') && !n.includes('--'));
        return _allAbilities;
    } catch (e) {
        listContainer.innerHTML = '<div class="error-state">โหลดรายการความสามารถไม่สำเร็จ</div>';
        return [];
    }
}

function _renderCategoryChips() {
    let chipBar = document.getElementById('ability-categories');
    if (!chipBar) {
        chipBar = document.createElement('div');
        chipBar.id = 'ability-categories';
        chipBar.className = 'ability-categories';
        const list = document.getElementById('ability-list');
        list.parentElement.insertBefore(chipBar, list);
    }

    // Coverage stats
    const taggedCount = _allAbilities ? _allAbilities.filter(n => ABILITY_TAGS[n]).length : 0;
    const total = _allAbilities ? _allAbilities.length : 0;
    const untaggedCount = total - taggedCount;

    const cats = [
        { id: 'all', label: `🌐 All (${total})` },
        ...Object.entries(ABILITY_CATEGORY_LABELS).map(([id, label]) => ({ id, label })),
        { id: 'untagged', label: `❓ Untagged (${untaggedCount})` }
    ];
    chipBar.innerHTML = `
        ${cats.map(c => `
            <button class="ability-cat-chip ${c.id === _activeAbilityCategory ? 'active' : ''}" data-cat="${c.id}">${c.label}</button>
        `).join('')}
        <span class="ability-coverage-note">${taggedCount}/${total} tagged — ใช้ Search หาตัวที่ไม่อยู่ในหมวด</span>
    `;
    chipBar.querySelectorAll('.ability-cat-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            _activeAbilityCategory = btn.dataset.cat;
            chipBar.querySelectorAll('.ability-cat-chip').forEach(b =>
                b.classList.toggle('active', b.dataset.cat === _activeAbilityCategory));
            const filter = document.getElementById('ability-search').value;
            renderAbilityList(filter);
        });
    });
}

function _abilityMatchesCategory(name, cat) {
    if (cat === 'all') return true;
    if (cat === 'untagged') return !ABILITY_TAGS[name];
    const tags = ABILITY_TAGS[name];
    if (!tags) return false;
    return tags.includes(cat);
}

function renderAbilityList(filter) {
    const container = document.getElementById('ability-list');
    if (!_allAbilities) return;
    const f = (filter || '').toLowerCase().trim();

    const matched = _allAbilities.filter(n =>
        (!f || n.includes(f)) && _abilityMatchesCategory(n, _activeAbilityCategory)
    );
    const filtered = matched.slice(0, 240);

    if (matched.length === 0) {
        container.innerHTML = `<p style="color:var(--text-faint);grid-column:1/-1;text-align:center;padding:20px;">
            ไม่พบในหมวด <strong>${_activeAbilityCategory}</strong>${f ? ` ที่ตรงกับ "${f}"` : ''}
        </p>`;
        return;
    }
    container.innerHTML = filtered.map(n => {
        const tags = ABILITY_TAGS[n] || [];
        const tagDots = tags.slice(0, 3).map(t =>
            `<span class="ability-tag-dot" title="${ABILITY_CATEGORY_LABELS[t] || t}">${(ABILITY_CATEGORY_LABELS[t] || t).slice(0,2)}</span>`
        ).join('');
        return `<div class="ability-list-item" data-ability="${n}">
            <span>${capitalize(n)}</span>
            <span class="ability-tag-row">${tagDots}</span>
        </div>`;
    }).join('');

    container.querySelectorAll('.ability-list-item').forEach(item => {
        item.addEventListener('click', () => {
            container.querySelectorAll('.ability-list-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            loadAbility(item.dataset.ability);
        });
    });
}

async function doAbilitySearch(query) {
    query = (query || '').trim().toLowerCase().replace(/\s+/g, '-');
    if (!query) return;
    loadAbility(query);
}

/* Public: load an ability by name. If `fromPokemon` is provided,
 * a back button is rendered that returns to that Pokémon's Detail
 * Abilities subtab. */
async function loadAbility(name, fromPokemon) {
    if (typeof fromPokemon !== 'undefined') _lastAbilityFrom = fromPokemon || null;
    const detail = document.getElementById('ability-detail');
    detail.innerHTML = '<div class="loading-state"><div class="loader"></div></div>';

    try {
        const a = await fetchAbility(name);
        const wasCached = lastWasCached();

        const effect = (a.effect_entries || []).find(e => e.language.name === 'en');
        const shortEffect = effect?.short_effect;
        const flavor = (a.flavor_text_entries || []).slice().reverse().find(e => e.language.name === 'en');
        const description = effect?.effect || flavor?.flavor_text || 'ไม่มีคำอธิบาย';

        const tags = ABILITY_TAGS[a.name] || [];
        const tagPills = tags.length
            ? `<div class="ability-tag-pills">${tags.map(t =>
                `<span class="ability-tag-pill">${ABILITY_CATEGORY_LABELS[t] || t}</span>`
              ).join('')}</div>`
            : '<div class="ability-tag-pills"><span style="color:var(--text-faint);font-size:11px;">ไม่มี category</span></div>';

        const pokeList = (a.pokemon || []).slice(0, 30);
        const totalCount = (a.pokemon || []).length;
        const pokeTags = pokeList.map(p =>
            `<span class="pokemon-tag" data-name="${p.pokemon.name}">${capitalize(p.pokemon.name)}${p.is_hidden ? ' ★' : ''}</span>`
        ).join('');
        const moreText = totalCount > 30 ? `<span style="color:var(--text-faint);font-size:12px;">+ อีก ${totalCount - 30} ตัว</span>` : '';

        const backBtn = _lastAbilityFrom
            ? `<button class="link-btn back-btn" id="ability-back-btn">← กลับไป ${capitalize(_lastAbilityFrom)}</button>`
            : '';

        const cachedBadge = wasCached ? '<span class="data-badge cached" style="margin-left:8px;">Cached</span>' : '';

        detail.innerHTML = `
            ${backBtn}
            <h3>${capitalize(a.name)} ${cachedBadge}</h3>
            ${shortEffect ? `<p style="color:var(--accent);font-size:13px;margin-bottom:10px;font-weight:500;">${shortEffect}</p>` : ''}
            ${tagPills}
            <p class="effect-text">${description.replace(/\n/g, ' ')}</p>
            <div class="pokemon-with">
                <h4>โปเกม่อนที่มีความสามารถนี้ (★ = ซ่อน)</h4>
                <div class="pokemon-tag-list">${pokeTags} ${moreText}</div>
            </div>
        `;

        if (_lastAbilityFrom) {
            document.getElementById('ability-back-btn').addEventListener('click', () => {
                const target = _lastAbilityFrom;
                _lastAbilityFrom = null;
                switchTab('detail');
                if (typeof loadDetailPokemon === 'function') {
                    // If already loaded, just switch subtab; otherwise reload
                    if (!_detail || _detail.pokemon?.name !== target) {
                        loadDetailPokemon(target).then(() => _switchToSubtab('abilities'));
                    } else {
                        _switchToSubtab('abilities');
                    }
                }
            });
        }

        detail.querySelectorAll('.pokemon-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                switchTab('detail');
                if (typeof loadDetailPokemon === 'function') loadDetailPokemon(tag.dataset.name);
            });
        });
    } catch (e) {
        console.error(e);
        detail.innerHTML = `<div class="error-state">ไม่พบความสามารถ "${name}"</div>`;
    }
}

/* Switch to a Detail subtab — used by back navigation */
function _switchToSubtab(subtab) {
    if (typeof _detail === 'undefined' || !_detail) return;
    const btn = document.querySelector(`.detail-subtab[data-subtab="${subtab}"]`);
    if (btn) btn.click();
}
