/* ============================================================
 * POKÉMON DETAIL
 *   - Form selector (Alolan, Mega, Rotom, etc. — anything in
 *     PokéAPI species.varieties)
 *   - Subtabs: Summary / Matchups / Stats / Evolution / Abilities / Moves / Locations
 *   - Moves & Locations filter by globally-selected version group
 *   - Status badges everywhere a data source isn't 100% certain
 * ============================================================ */

const DETAIL_RECENT_KEY = 'pkmn-detail-recent-v1';
const DETAIL_RECENT_MAX = 8;

let _detail = null;            // current state
let _detailSubtab = 'summary';
let _detailVersionUnsub = null;

function initDetail() {
    const input = document.getElementById('detail-search');
    const btn = document.getElementById('detail-search-btn');
    attachAutocomplete(input, name => loadDetailPokemon(name));
    btn.addEventListener('click', async () => {
        await ensureSpeciesList();
        const resolved = resolveSearchInput(input.value);
        if (resolved && resolved !== input.value) input.value = resolved;
        loadDetailPokemon(resolved);
    });

    renderDetailRecent();

    // React to global version change — re-render moves/locations if showing
    onVersionChange(() => {
        if (!_detail) return;
        if (['moves', 'locations', 'evolution'].includes(_detailSubtab)) {
            _renderSubtabContent();
        }
    });
}

function _getDetailRecent() {
    try { return JSON.parse(localStorage.getItem(DETAIL_RECENT_KEY) || '[]'); }
    catch { return []; }
}

function _pushDetailRecent(name) {
    let list = _getDetailRecent().filter(n => n !== name);
    list.unshift(name);
    list = list.slice(0, DETAIL_RECENT_MAX);
    localStorage.setItem(DETAIL_RECENT_KEY, JSON.stringify(list));
    renderDetailRecent();
}

function renderDetailRecent() {
    const c = document.getElementById('detail-recent');
    if (!c) return;
    const list = _getDetailRecent();
    if (list.length === 0) {
        c.innerHTML = '<span style="color:var(--text-faint);font-size:12px;">— ยังไม่มี —</span>';
        return;
    }
    c.innerHTML = list.map(n => `<span class="recent-chip" data-name="${n}">${capitalize(n)}</span>`).join('');
    c.querySelectorAll('.recent-chip').forEach(chip => {
        chip.addEventListener('click', () => loadDetailPokemon(chip.dataset.name));
    });
}

async function loadDetailPokemon(query) {
    query = (query || '').trim().toLowerCase();
    if (!query) return;

    const container = document.getElementById('detail-container');
    container.innerHTML = '<div class="loading-state"><div class="loader"></div><p>กำลังโหลดข้อมูล...</p></div>';

    try {
        const pokemon = await fetchPokemon(query);
        const pokemonCached = lastWasCached();
        const species = await fetchSpecies(pokemon.species.name);

        // Fetch evolution chain + encounters in parallel (best effort)
        const evoChainP = species.evolution_chain?.url
            ? fetchEvolutionChain(species.evolution_chain.url).catch(() => null)
            : Promise.resolve(null);
        const encountersP = fetchEncounters(pokemon.id).catch(() => []);
        const [evoChain, encounters] = await Promise.all([evoChainP, encountersP]);

        _detail = {
            pokemon,
            species,
            forms: species.varieties || [],
            evoChain,
            encounters,
            pokemonCached
        };

        _detailSubtab = 'summary';
        _pushDetailRecent(pokemon.name);
        _renderDetailCard();
    } catch (e) {
        console.error(e);
        if (!navigator.onLine) {
            container.innerHTML = `<div class="error-state">
                📵 <strong>Offline</strong> — โปเกม่อน "${query}" ยังไม่เคย cache ในเครื่องนี้<br>
                <small style="opacity:0.85">ลองค้นโปเกม่อนที่เคยดูแล้ว หรือต่อเน็ตกลับ</small>
            </div>`;
        } else {
            container.innerHTML = `<div class="error-state">
                ❌ ไม่พบโปเกม่อน "${query}"<br>
                <small style="opacity:0.7">${e.message || ''}</small>
            </div>`;
        }
    }
}

/* Switch which form is being viewed (re-fetch variant) */
async function _switchDetailForm(variantName) {
    if (!_detail) return;
    const container = document.getElementById('detail-container');
    container.style.opacity = '0.55';
    try {
        const pokemon = await fetchPokemon(variantName);
        _detail.pokemon = pokemon;
        _detail.pokemonCached = lastWasCached();
        // re-fetch encounters for this variant
        _detail.encounters = await fetchEncounters(pokemon.id).catch(() => []);
        _renderDetailCard();
    } catch (e) {
        console.error(e);
    } finally {
        container.style.opacity = '1';
    }
}

/* ========== RENDERING ========== */

function _renderDetailCard() {
    const { pokemon, species, forms, pokemonCached } = _detail;
    const types = pokemon.types.map(t => t.type.name);
    const sprite = pokemon.sprites.other?.['official-artwork']?.front_default
        || pokemon.sprites.front_default || '';
    const genusEn = (species.genera || []).find(g => g.language.name === 'en')?.genus || '';

    const hasForms = forms.length > 1;
    const formSelect = hasForms ? `
        <div class="detail-form-row">
            <label>ฟอร์ม:</label>
            <select id="detail-form-select">
                ${forms.map(v => {
                    const sel = v.pokemon.name === pokemon.name ? 'selected' : '';
                    return `<option value="${v.pokemon.name}" ${sel}>${formatFormName(v.pokemon.name, species.name)}${v.is_default ? ' · ค่าเริ่มต้น' : ''}</option>`;
                }).join('')}
            </select>
            <span class="data-badge api">PokéAPI varieties</span>
        </div>
    ` : '';

    // TOC anchors — same IDs used in the section blocks below
    const sections = [
        { id: 'summary',   label: '📋 Summary' },
        { id: 'matchups',  label: '⚔️ Matchups' },
        { id: 'stats',     label: '📊 Stats' },
        { id: 'evolution', label: '🔄 Evolution' },
        { id: 'abilities', label: '✨ Abilities' },
        { id: 'moves',     label: '🎯 Moves' },
        { id: 'locations', label: '📍 Locations' }
    ];

    const cachedBadge = pokemonCached ? '<span class="data-badge cached">Cached</span>' : '';
    const displayName = prettyPokemonName(pokemon.name, species.name);

    const html = `
        <div class="detail-card">
            <div class="detail-header">
                <div class="detail-sprite"><img src="${sprite}" alt="${pokemon.name}"></div>
                <div class="detail-meta">
                    <div class="dex-num">#${String(species.id).padStart(4, '0')} ${cachedBadge}</div>
                    <h2>${displayName}</h2>
                    <div class="types">${renderTypeBadges(types)}</div>
                    <div class="genus">${genusEn}</div>
                    ${formSelect}
                </div>
            </div>
            <div class="detail-toc">
                ${sections.map(s => `<a class="detail-toc-link" href="#detail-sec-${s.id}" data-target="detail-sec-${s.id}">${s.label}</a>`).join('')}
            </div>
            <div class="detail-content detail-content-long">
                <section id="detail-sec-summary"   class="detail-long-section">${_renderSummarySubtab()}</section>
                <section id="detail-sec-matchups"  class="detail-long-section">${_renderMatchupsSubtab()}</section>
                <section id="detail-sec-stats"     class="detail-long-section">${_renderStatsSubtab()}</section>
                <section id="detail-sec-evolution" class="detail-long-section">${_renderEvolutionSubtab()}</section>
                <section id="detail-sec-abilities" class="detail-long-section">${_renderAbilitiesSubtab()}</section>
                <section id="detail-sec-moves"     class="detail-long-section"></section>
                <section id="detail-sec-locations" class="detail-long-section">${_renderLocationsSubtab()}</section>
            </div>
        </div>
    `;

    document.getElementById('detail-container').innerHTML = html;

    // Wire form selector
    const fs = document.getElementById('detail-form-select');
    if (fs) fs.addEventListener('change', e => _switchDetailForm(e.target.value));

    // TOC smooth-scroll
    document.querySelectorAll('.detail-toc-link').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.getElementById(a.dataset.target);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // Moves section uses a method-tab UI that mutates its container
    const movesEl = document.getElementById('detail-sec-moves');
    if (movesEl) _renderMovesSubtab(movesEl);

    // Wire interactive bits inside the sections
    _wireEvoClicks();
    _wireAbilityClicks();
}

/* Re-render moves + locations sections when the global version group changes.
 * (Used to be _renderSubtabContent — now we just hot-swap individual sections.) */
function _renderSubtabContent() {
    if (!_detail) return;
    const movesEl = document.getElementById('detail-sec-moves');
    const locEl = document.getElementById('detail-sec-locations');
    const evoEl = document.getElementById('detail-sec-evolution');
    if (movesEl) { _renderMovesSubtab(movesEl); }
    if (locEl)   { locEl.innerHTML = _renderLocationsSubtab(); }
    if (evoEl)   { evoEl.innerHTML = _renderEvolutionSubtab(); _wireEvoClicks(); }
}

/* ========== SUBTAB: SUMMARY ========== */
function _renderSummarySubtab() {
    const { pokemon, species } = _detail;
    const growthRate = species.growth_rate?.name || '?';
    const eggGroups = (species.egg_groups || []).map(e => capitalize(e.name)).join(', ') || '-';
    const baseExp = pokemon.base_experience || '?';
    const captureRate = species.capture_rate ?? '?';
    const hatchSteps = species.hatch_counter ? (species.hatch_counter + 1) * 255 : '?';

    return `
        <div class="section-block">
            <div class="section-title">📋 ข้อมูลทั่วไป</div>
            <div class="info-block">
                <div class="meta-grid">
                    <span class="k">Pokédex Number:</span><span class="v">#${String(species.id).padStart(4, '0')}</span>
                    <span class="k">Species:</span><span class="v">${capitalize(species.name)}</span>
                    <span class="k">Height:</span><span class="v">${(pokemon.height / 10).toFixed(1)} m</span>
                    <span class="k">Weight:</span><span class="v">${(pokemon.weight / 10).toFixed(1)} kg</span>
                    <span class="k">Egg Groups:</span><span class="v">${eggGroups}</span>
                    <span class="k">Growth Rate:</span><span class="v">${capitalize(growthRate)}</span>
                    <span class="k">Base Exp:</span><span class="v">${baseExp}</span>
                    <span class="k">Capture Rate:</span><span class="v">${captureRate} / 255</span>
                    <span class="k">Hatch Steps:</span><span class="v">~${hatchSteps}</span>
                </div>
            </div>
        </div>
    `;
}

/* ========== SUBTAB: MATCHUPS ========== */
function _renderMatchupsSubtab() {
    const { pokemon } = _detail;
    const types = pokemon.types.map(t => t.type.name);
    const warn = chartEraBanner();
    return `
        ${warn ? `<div class="warn-banner" style="margin-bottom:14px;display:block;">${warn}</div>` : ''}
        <div class="section-block">
            <div class="section-title">⚔️ Matchups
                <span class="data-badge verified">Static · ${CHART_ERA_LABEL[activeChartEra()]}</span>
            </div>
            ${renderMatchupBody(types)}
        </div>
    `;
}

/* ========== SUBTAB: STATS ========== */
function _renderStatsSubtab() {
    const { pokemon } = _detail;
    const total = pokemon.stats.reduce((s, x) => s + x.base_stat, 0);
    const rows = pokemon.stats.map(s => {
        const key = STAT_KEY_MAP[s.stat.name] || s.stat.name;
        const label = STAT_LABELS[key] || capitalize(s.stat.name);
        const val = s.base_stat;
        const pct = Math.min(100, (val / 200) * 100);
        return `
            <div class="stat-row">
                <span class="stat-name">${label}</span>
                <span class="stat-val">${val}</span>
                <div class="stat-bar"><div class="fill ${statColorClass(val)}" style="width:${pct}%"></div></div>
            </div>
        `;
    }).join('');

    return `
        <div class="section-block">
            <div class="section-title">📊 Base Stats <span class="data-badge api">PokéAPI</span></div>
            <div class="info-block">
                ${rows}
                <div class="stat-row" style="border-top:1px solid var(--border-soft);margin-top:8px;padding-top:10px;">
                    <span class="stat-name" style="font-weight:600;color:var(--text);">Total</span>
                    <span class="stat-val">${total}</span>
                    <div></div>
                </div>
            </div>
        </div>
    `;
}

/* ========== SUBTAB: ABILITIES ========== */
function _renderAbilitiesSubtab() {
    const { pokemon } = _detail;
    const pills = pokemon.abilities.map(a => `
        <span class="ability-pill ${a.is_hidden ? 'hidden' : ''}" data-ability="${a.ability.name}">
            ${capitalize(a.ability.name)}${a.is_hidden ? '<span class="tag">(ซ่อน)</span>' : ''}
        </span>
    `).join('');

    return `
        <div class="section-block">
            <div class="section-title">✨ Abilities
                <span class="data-badge api">PokéAPI</span>
                <span style="font-size:11px;color:var(--text-faint);font-weight:400;">คลิกที่ pill เพื่อดูรายละเอียดเต็มในแท็บ Abilities</span>
            </div>
            <div class="info-block">
                <div class="ability-pill-list">${pills}</div>
            </div>
        </div>
    `;
}

function _wireAbilityClicks() {
    const fromName = _detail?.pokemon?.name;
    document.querySelectorAll('#detail-content .ability-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            switchTab('abilities');
            if (typeof loadAbility === 'function') loadAbility(pill.dataset.ability, fromName);
        });
    });
}

/* ========== SUBTAB: EVOLUTION ========== */
function _renderEvolutionSubtab() {
    const { evoChain, species } = _detail;
    if (!evoChain || !evoChain.chain) {
        return `<div class="section-block">
            <div class="section-title">🔄 Evolution <span class="data-badge nodata">No data</span></div>
            <div class="no-data-state">ไม่พบข้อมูลสาย evolution</div>
        </div>`;
    }

    // Flatten into stages, collect species names for the chain
    const stages = [[]];
    const speciesInChain = new Set();
    const walk = (node, idx) => {
        if (!stages[idx]) stages[idx] = [];
        const sp = node.species.name;
        stages[idx].push({
            name: sp,
            id: extractIdFromUrl(node.species.url),
            details: node.evolution_details
        });
        speciesInChain.add(sp);
        for (const child of node.evolves_to) walk(child, idx + 1);
    };
    walk(evoChain.chain, 0);

    const isLinear = stages.every(s => s.length === 1);

    let chainHtml = '<div class="evo-chain">';
    stages.forEach((stage, idx) => {
        if (idx > 0 && isLinear) {
            const conditions = stage.map(s => _formatEvolutionDetails(s.details));
            chainHtml += `<div class="evo-arrow">→<span class="req">${conditions[0].text}</span>${conditions[0].warn ? `<span class="warn">⚠ ${conditions[0].warn}</span>` : ''}</div>`;
        }
        stage.forEach((s) => {
            const spriteUrl = s.id ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${s.id}.png` : '';
            let condHtml = '';
            if (idx > 0 && !isLinear) {
                const c = _formatEvolutionDetails(s.details);
                condHtml = `<span class="req" style="margin-top:4px;color:var(--text-dim);font-size:11px;">${c.text}</span>${c.warn ? `<br><span style="color:var(--neutral);font-size:10.5px;">⚠ ${c.warn}</span>` : ''}`;
            }
            chainHtml += `<div class="evo-step" data-name="${s.name}">
                <img src="${spriteUrl}" alt="${s.name}" onerror="this.style.display='none'">
                <span class="name">${capitalize(s.name)}</span>
                ${condHtml}
            </div>`;
        });
    });
    chainHtml += '</div>';

    // Hard-case warnings: any species in the chain that's listed in SPECIAL_EVO_NOTES
    const specialNotes = [];
    for (const sp of speciesInChain) {
        if (SPECIAL_EVO_NOTES[sp]) {
            specialNotes.push({ species: sp, note: SPECIAL_EVO_NOTES[sp].note });
        }
        // also check pokemon-name based variants
    }
    // Also check current pokemon name (e.g., farfetchd-galar)
    const curName = _detail.pokemon.name;
    if (SPECIAL_EVO_NOTES[curName] && !specialNotes.find(n => n.species === curName)) {
        specialNotes.push({ species: curName, note: SPECIAL_EVO_NOTES[curName].note });
    }

    const notesHtml = specialNotes.length ? `
        <div class="info-banner" style="display:block;margin-top:14px;">
            <strong>⚠ Special evolution condition may be incomplete in PokéAPI</strong>
            <ul style="margin:6px 0 0 18px;padding:0;">
                ${specialNotes.map(n => `<li><strong>${capitalize(n.species)}:</strong> ${n.note}</li>`).join('')}
            </ul>
        </div>
    ` : '';

    const isLA = currentVersionGroup().id === 'legends-arceus';
    const laNote = isLA ? `<div class="warn-banner" style="display:block;margin-top:12px;">⚠ Legends: Arceus มีเงื่อนไข evolution หลายอย่างต่างจากภาคอื่น (Hisuian forms, Strange Souvenir item, etc.) — PokéAPI อาจไม่ครบทุก condition</div>` : '';

    return `
        <div class="section-block">
            <div class="section-title">🔄 Evolution <span class="data-badge api">PokéAPI</span></div>
            ${chainHtml}
            ${notesHtml}
            ${laNote}
        </div>
    `;
}

/* Returns { text, warn } where warn is non-empty if data is suspicious */
function _formatEvolutionDetails(detailsArr) {
    if (!detailsArr || detailsArr.length === 0) return { text: '→', warn: '' };
    const d = detailsArr[0];
    const parts = [];
    let warn = '';

    if (d.min_level) parts.push(`Lv. ${d.min_level}`);
    if (d.trigger?.name === 'trade') {
        if (d.trade_species) parts.push(`Trade กับ ${capitalize(d.trade_species.name)}`);
        else parts.push('Trade');
    }
    if (d.item) parts.push(`ใช้ ${capitalize(d.item.name)}`);
    if (d.held_item) parts.push(`ถือ ${capitalize(d.held_item.name)}`);
    if (d.min_happiness) parts.push(`Friendship ≥ ${d.min_happiness}`);
    if (d.min_affection) parts.push(`Affection ≥ ${d.min_affection}`);
    if (d.min_beauty) parts.push(`Beauty ≥ ${d.min_beauty}`);
    if (d.time_of_day) parts.push(d.time_of_day === 'day' ? 'กลางวัน' : (d.time_of_day === 'night' ? 'กลางคืน' : d.time_of_day));
    if (d.known_move) parts.push(`รู้ท่า ${capitalize(d.known_move.name)}`);
    if (d.known_move_type) parts.push(`รู้ท่าธาตุ ${capitalize(d.known_move_type.name)}`);
    if (d.location) parts.push(`ที่ ${capitalize(d.location.name)}`);
    if (d.party_species) parts.push(`มี ${capitalize(d.party_species.name)} ในทีม`);
    if (d.party_type) parts.push(`มีโปเกม่อนธาตุ ${capitalize(d.party_type.name)} ในทีม`);
    if (d.relative_physical_stats === 1) parts.push('Attack > Defense');
    if (d.relative_physical_stats === -1) parts.push('Attack < Defense');
    if (d.relative_physical_stats === 0) parts.push('Attack = Defense');
    if (d.gender === 1) parts.push('ตัวเมีย');
    if (d.gender === 2) parts.push('ตัวผู้');
    if (d.needs_overworld_rain) parts.push('ขณะฝนตก');
    if (d.turn_upside_down) parts.push('คว่ำเครื่อง');
    if (d.trigger?.name === 'shed') parts.push('Level up พร้อมตำแหน่งว่างในทีม + Poké Ball');
    if (d.trigger && !['level-up','trade','use-item','shed'].includes(d.trigger.name) && parts.length === 0) {
        warn = `Trigger: ${d.trigger.name} — เงื่อนไขซับซ้อน อาจไม่ครบ`;
    }

    if (parts.length === 0) {
        warn = warn || 'ไม่มีรายละเอียดจาก PokéAPI — อาจมีเงื่อนไขเฉพาะภาค';
        return { text: capitalize(d.trigger?.name || '→'), warn };
    }
    return { text: parts.join(' + '), warn };
}

function _wireEvoClicks() {
    document.querySelectorAll('#detail-content .evo-step').forEach(step => {
        step.addEventListener('click', () => loadDetailPokemon(step.dataset.name));
    });
}

/* ========== SUBTAB: MOVES ========== */

/* Count moves per method for a given version group.
 * Returns { 'level-up': N, machine: M, egg: K, tutor: L }.
 * Source: PokéAPI pokemon.moves[].version_group_details, filtered by
 * version_group.name === vgId. */
function _countMovesByMethod(pokemon, vgId) {
    const counts = { 'level-up': 0, machine: 0, egg: 0, tutor: 0 };
    const seen = { 'level-up': new Set(), machine: new Set(), egg: new Set(), tutor: new Set() };
    pokemon.moves.forEach(m => {
        m.version_group_details.forEach(d => {
            if (d.version_group.name !== vgId) return;
            const method = d.move_learn_method.name;
            if (method in counts && !seen[method].has(m.move.name)) {
                seen[method].add(m.move.name);
                counts[method]++;
            }
        });
    });
    return counts;
}

function _renderMovesSubtab(el) {
    const { pokemon } = _detail;
    const vg = currentVersionGroup();

    // Subtab state inside moves
    if (!_detail._currentMoveMethod) _detail._currentMoveMethod = 'level-up';

    // Audit counts per method
    const counts = _countMovesByMethod(pokemon, vg.id);
    const totalForVG = counts['level-up'] + counts.machine + counts.egg + counts.tutor;

    if (totalForVG === 0) {
        el.innerHTML = `
            <div class="section-block">
                <div class="section-title">⚔️ Moves
                    <span class="data-badge nodata">No data for ${vg.label}</span>
                </div>
                <div class="no-data-state">
                    PokéAPI ไม่มีข้อมูลท่าของ ${capitalize(pokemon.name)} ใน ${vg.label}<br>
                    <small>โปเกม่อนนี้อาจไม่มีในเวอร์ชันนี้ ลองเปลี่ยน "เกมที่เล่น" ด้านบน</small>
                </div>
            </div>
        `;
        return;
    }

    const methods = [
        { id: 'level-up', label: 'Level-up' },
        { id: 'machine',  label: 'TM/TR/HM' },
        { id: 'egg',      label: 'Egg' },
        { id: 'tutor',    label: 'Tutor' }
    ];

    const auditHtml = `
        <div class="move-audit">
            <div class="move-audit-counts">
                ${methods.map(m => `
                    <div class="audit-cell" data-method="${m.id}">
                        <div class="audit-label">${m.label}</div>
                        <div class="audit-num ${counts[m.id] === 0 ? 'zero' : ''}">${counts[m.id]}</div>
                    </div>
                `).join('')}
            </div>
            <div class="move-audit-source">
                <span>📡 Source: <code>PokéAPI .moves[].version_group_details</code> filtered by
                <code>version_group.name = "${vg.id}"</code> + <code>move_learn_method.name</code></span>
            </div>
        </div>
    `;

    el.innerHTML = `
        <div class="section-block">
            <div class="section-title">⚔️ Moves — ${vg.label}
                <span class="data-badge api">PokéAPI</span>
                ${vg.gen < 6 ? '<span class="data-badge partial">Older gen — may be incomplete</span>' : ''}
            </div>
            ${auditHtml}
            <div class="method-subtab" id="move-method-subtab">
                ${methods.map(m => `
                    <button class="${m.id === _detail._currentMoveMethod ? 'active' : ''}" data-method="${m.id}">
                        ${m.label} <span class="method-count">(${counts[m.id]})</span>
                    </button>
                `).join('')}
            </div>
            <div id="move-content">${_renderMovesByMethod(pokemon, vg.id, _detail._currentMoveMethod)}</div>
        </div>
    `;

    document.querySelectorAll('#move-method-subtab button').forEach(btn => {
        btn.addEventListener('click', () => {
            _detail._currentMoveMethod = btn.dataset.method;
            document.querySelectorAll('#move-method-subtab button').forEach(b =>
                b.classList.toggle('active', b.dataset.method === _detail._currentMoveMethod));
            document.getElementById('move-content').innerHTML =
                _renderMovesByMethod(pokemon, vg.id, _detail._currentMoveMethod);
        });
    });
}

function _renderMovesByMethod(pokemon, versionGroupId, method) {
    const seen = new Set();
    const rows = [];
    pokemon.moves.forEach(m => {
        const matches = m.version_group_details.filter(d =>
            d.version_group.name === versionGroupId &&
            d.move_learn_method.name === method
        );
        if (matches.length > 0 && !seen.has(m.move.name)) {
            seen.add(m.move.name);
            const det = method === 'level-up'
                ? matches.reduce((a, b) => (a.level_learned_at < b.level_learned_at ? a : b))
                : matches[0];
            rows.push({ name: m.move.name, level: det.level_learned_at });
        }
    });

    if (rows.length === 0) {
        return `<div class="no-data-state">ไม่มีท่าจากวิธี "${method}" ในเวอร์ชันนี้</div>`;
    }

    if (method === 'level-up') {
        rows.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    } else {
        rows.sort((a, b) => a.name.localeCompare(b.name));
    }

    let html = `<table class="move-table"><thead><tr>`;
    if (method === 'level-up') html += '<th>Lv.</th>';
    html += '<th>ท่า</th></tr></thead><tbody>';
    rows.forEach(r => {
        html += '<tr>';
        if (method === 'level-up') html += `<td class="lvl">${r.level || '—'}</td>`;
        html += `<td class="move-name">${capitalize(r.name)}</td>`;
        html += '</tr>';
    });
    html += `</tbody></table>
        <div style="margin-top:10px;color:var(--text-faint);font-size:11.5px;">รวม ${rows.length} ท่า</div>
    `;
    return html;
}

/* Debug audit helper — call from console:
 *   moveAuditReport()
 * Prints counts for a small set of test cases. */
async function moveAuditReport() {
    const cases = [
        { name: 'pikachu', vg: 'red-blue' },
        { name: 'pikachu', vg: 'scarlet-violet' },
        { name: 'charizard', vg: 'red-blue' },
        { name: 'charizard', vg: 'sword-shield' },
        { name: 'charizard', vg: 'scarlet-violet' }
    ];
    console.group('🧪 Move Audit Report');
    for (const c of cases) {
        try {
            const p = await fetchPokemon(c.name);
            const counts = _countMovesByMethod(p, c.vg);
            console.log(`${c.name} @ ${c.vg}:`, counts);
        } catch (e) {
            console.warn(`${c.name} @ ${c.vg}: ERROR`, e.message);
        }
    }
    console.groupEnd();
}

/* ========== SUBTAB: LOCATIONS ========== */
/*
 * Source priority:
 *   1. Manual verified override (data.js LOCATION_OVERRIDES)
 *   2. PokéAPI encounters filtered by current version group's versions[]
 *   3. No data (do not guess)
 *
 * The badge in the section title reflects which source was used.
 */
function _renderLocationsSubtab() {
    const { encounters, pokemon } = _detail;
    const vg = currentVersionGroup();

    // 1. Manual override
    const override = getLocationOverride(pokemon.name, vg.id);
    if (override) {
        const items = override.locations.map(loc =>
            `<div class="location-item"><span class="location-version">manual</span>${loc}</div>`
        ).join('');
        return `
            <div class="section-block">
                <div class="section-title">📍 Locations — ${vg.label}
                    <span class="data-badge verified">Manual verified</span>
                    ${override.verifiedBy ? `<span style="font-size:11px;color:var(--text-faint);">(${override.verifiedBy})</span>` : ''}
                </div>
                <div class="location-list">${items}</div>
            </div>
        `;
    }

    // 2. PokéAPI filtered
    const versionNames = new Set(vg.versions);
    const matching = [];
    encounters.forEach(e => {
        const versions = e.version_details
            .filter(vd => versionNames.has(vd.version.name))
            .map(vd => vd.version.name);
        if (versions.length > 0) {
            matching.push({ area: e.location_area.name, versions });
        }
    });

    if (matching.length === 0) {
        // 3. No data
        const hasAnyEncounters = encounters.length > 0;
        return `
            <div class="section-block">
                <div class="section-title">📍 Locations — ${vg.label}
                    <span class="data-badge nodata">No data for ${vg.label}</span>
                </div>
                <div class="no-data-state">
                    ${hasAnyEncounters
                        ? `${capitalize(pokemon.name)} ไม่พบในธรรมชาติใน ${vg.label}<br><small>อาจได้จากวิวัฒนาการ, แลกเปลี่ยน, ไข่ หรือเหตุการณ์พิเศษ</small>`
                        : `PokéAPI ไม่มีข้อมูลสถานที่พบเจอของ ${capitalize(pokemon.name)} (ทุกเวอร์ชัน)<br><small>อาจเป็น Legendary, Mythical, หรือได้จาก evolution เท่านั้น</small>`
                    }
                </div>
                ${vg.gen <= 2 || vg.id === 'legends-arceus' ? `<div class="warn-banner" style="display:block;margin-top:12px;">⚠ PokéAPI มักไม่มีข้อมูล location ที่ครบสำหรับ ${vg.label}</div>` : ''}
            </div>
        `;
    }

    // Group by area
    const byArea = {};
    matching.forEach(({ area, versions }) => {
        if (!byArea[area]) byArea[area] = new Set();
        versions.forEach(v => byArea[area].add(v));
    });

    const items = Object.entries(byArea)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([area, vset]) => {
            const versions = Array.from(vset).map(v => `<span class="location-version">${capitalize(v)}</span>`).join('');
            return `<div class="location-item">${versions}${area.replace(/-/g, ' ')}</div>`;
        }).join('');

    return `
        <div class="section-block">
            <div class="section-title">📍 Locations — ${vg.label}
                <span class="data-badge api">PokéAPI</span>
                ${vg.gen < 6 ? '<span class="data-badge partial">Older gen — may be incomplete</span>' : ''}
            </div>
            <div class="location-list">${items}</div>
            <div style="margin-top:10px;color:var(--text-faint);font-size:11.5px;">${Object.keys(byArea).length} สถานที่ · source: PokéAPI encounters → filtered by version_details.version.name ∈ {${vg.versions.join(', ')}}</div>
        </div>
    `;
}
