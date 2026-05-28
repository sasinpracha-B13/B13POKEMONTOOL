/* ============================================================
 * POKEMON SEARCH & DETAIL VIEW
 * ============================================================ */

const RECENT_KEY = 'pkmn-recent-v1';
const RECENT_MAX = 8;

function initPokemonSearch() {
    const input = document.getElementById('pokemon-search');
    const btn = document.getElementById('pokemon-search-btn');

    btn.addEventListener('click', () => doPokemonSearch(input.value));
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') doPokemonSearch(input.value);
    });

    renderRecent();
}

function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
    catch { return []; }
}

function pushRecent(name) {
    let list = getRecent().filter(n => n !== name);
    list.unshift(name);
    list = list.slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    renderRecent();
}

function renderRecent() {
    const c = document.getElementById('recent-list');
    if (!c) return;
    const list = getRecent();
    if (list.length === 0) {
        c.innerHTML = '<span style="color:var(--text-faint);font-size:12px;">ยังไม่มี</span>';
        return;
    }
    c.innerHTML = list.map(n => `<span class="recent-chip" data-name="${n}">${capitalize(n)}</span>`).join('');
    c.querySelectorAll('.recent-chip').forEach(chip => {
        chip.addEventListener('click', () => doPokemonSearch(chip.dataset.name));
    });
}

async function doPokemonSearch(query) {
    query = (query || '').trim().toLowerCase();
    if (!query) return;
    const result = document.getElementById('pokemon-result');
    result.innerHTML = '<div class="loading-state"><div class="loader"></div><p>กำลังโหลดข้อมูล...</p></div>';

    try {
        // Fetch in parallel
        const pokemon = await fetchPokemon(query);
        const [species, encounters] = await Promise.all([
            fetchSpecies(pokemon.species.name),
            fetchEncounters(pokemon.id)
        ]);
        let evoChain = null;
        if (species.evolution_chain && species.evolution_chain.url) {
            try { evoChain = await fetchEvolutionChain(species.evolution_chain.url); }
            catch (e) { /* skip if fails */ }
        }
        pushRecent(pokemon.name);
        result.innerHTML = renderPokemonCard(pokemon, species, evoChain, encounters);
        attachPokemonHandlers(pokemon, encounters);
    } catch (e) {
        console.error(e);
        result.innerHTML = `<div class="error-state">❌ ไม่พบโปเกม่อน "${query}" — ตรวจชื่อภาษาอังกฤษหรือหมายเลข<br><small style="opacity:0.7">${e.message || ''}</small></div>`;
    }
}

/* ========== RENDER ========== */
function renderPokemonCard(p, sp, evo, enc) {
    const sprite = p.sprites.other?.['official-artwork']?.front_default
        || p.sprites.front_default
        || '';

    const types = p.types.map(t => `<span class="type-badge ${t.type.name}">${capitalize(t.type.name)}</span>`).join('');
    const genusEn = (sp.genera || []).find(g => g.language.name === 'en')?.genus || '';

    // Abilities
    const abilities = p.abilities.map(a => `
        <span class="ability-pill ${a.is_hidden ? 'hidden' : ''}"
              data-ability="${a.ability.name}">
            ${capitalize(a.ability.name)}${a.is_hidden ? '<span class="tag">(ซ่อน)</span>' : ''}
        </span>
    `).join('');

    // Stats
    const stats = p.stats.map(s => {
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

    const totalStats = p.stats.reduce((s, x) => s + x.base_stat, 0);

    // Growth & misc
    const growthRate = sp.growth_rate?.name || '?';
    const eggGroups = (sp.egg_groups || []).map(e => capitalize(e.name)).join(', ') || '-';
    const baseExp = p.base_experience || '?';
    const captureRate = sp.capture_rate;
    const hatchSteps = sp.hatch_counter ? (sp.hatch_counter + 1) * 255 : '?';

    // Evolution
    const evoHtml = renderEvolutionChain(evo);

    // Moves – list versions
    const versionsWithMoves = collectMoveVersions(p);
    const defaultVer = versionsWithMoves[0] || null;

    // Default moves view: level-up moves for default version
    const levelMovesHtml = renderMovesByMethod(p, defaultVer, 'level-up');

    const versionChips = versionsWithMoves.map((v, i) =>
        `<span class="game-chip ${i === 0 ? 'active' : ''}" data-version="${v}" data-target="moves">${formatVersionName(v)}</span>`
    ).join('') || '<span style="color:var(--text-faint);font-size:12px;">ไม่มีข้อมูล</span>';

    // Locations grouped by version
    const locByVer = groupEncountersByVersion(enc);
    const locVersions = Object.keys(locByVer);
    const locVerChips = locVersions.length
        ? locVersions.map((v, i) => `<span class="game-chip ${i === 0 ? 'active' : ''}" data-version="${v}" data-target="locations">${formatVersionName(v)}</span>`).join('')
        : '<span style="color:var(--text-faint);font-size:12px;">ไม่มีข้อมูลสถานที่</span>';
    const firstLocVer = locVersions[0];
    const locationsHtml = firstLocVer ? renderLocations(locByVer[firstLocVer]) : '<p style="color:var(--text-faint);font-size:13px;">ไม่มีข้อมูล</p>';

    return `
        <div class="pokemon-card">
            <div class="pokemon-header">
                <div class="pokemon-sprite"><img src="${sprite}" alt="${p.name}"></div>
                <div class="pokemon-meta">
                    <div class="dex-num">#${String(p.id).padStart(4, '0')}</div>
                    <h2>${capitalize(p.name)}</h2>
                    <div class="types">${types}</div>
                    <div class="genus">${genusEn}</div>
                    <div class="pokemon-stats-mini">
                        <span>📏 <b>${(p.height / 10).toFixed(1)} m</b></span>
                        <span>⚖️ <b>${(p.weight / 10).toFixed(1)} kg</b></span>
                        <span>🥚 <b>${eggGroups}</b></span>
                        <span>⭐ Total Stats: <b>${totalStats}</b></span>
                    </div>
                </div>
            </div>

            <div class="pokemon-body">
                <!-- STATS -->
                <div class="info-block">
                    <h3>📊 ค่าสเตตัสพื้นฐาน (Base Stats)</h3>
                    ${stats}
                </div>

                <!-- ABILITIES + INFO -->
                <div class="info-block">
                    <h3>✨ ความสามารถ (Abilities)</h3>
                    <div class="ability-pill-list">${abilities}</div>
                    <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);">
                        <h3 style="margin-bottom:8px;">🌱 การเติบโต</h3>
                        <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font-size:13px;">
                            <span style="color:var(--text-dim);">Growth Rate:</span><span>${capitalize(growthRate)}</span>
                            <span style="color:var(--text-dim);">Base Exp:</span><span>${baseExp}</span>
                            <span style="color:var(--text-dim);">Capture Rate:</span><span>${captureRate} / 255</span>
                            <span style="color:var(--text-dim);">Hatch Steps:</span><span>~${hatchSteps}</span>
                        </div>
                    </div>
                </div>

                <!-- EVOLUTION -->
                <div class="info-block full">
                    <h3>🔄 การพัฒนาร่าง (Evolution)</h3>
                    ${evoHtml}
                </div>

                <!-- MOVES -->
                <div class="info-block full">
                    <h3>⚔️ ท่าที่เรียนรู้ (Moves)</h3>
                    <div class="game-selector" id="moves-versions">${versionChips}</div>
                    <div class="subtab" id="moves-subtab">
                        <button class="active" data-method="level-up">เลเวลอัพ (Level)</button>
                        <button data-method="machine">TM/HM</button>
                        <button data-method="egg">ไข่ (Egg)</button>
                        <button data-method="tutor">Tutor</button>
                    </div>
                    <div id="moves-content">${levelMovesHtml}</div>
                </div>

                <!-- LOCATIONS -->
                <div class="info-block full">
                    <h3>📍 สถานที่พบเจอ (Location)</h3>
                    <div class="game-selector" id="loc-versions">${locVerChips}</div>
                    <div id="loc-content">${locationsHtml}</div>
                </div>
            </div>
        </div>
    `;
}

/* ========== EVOLUTION CHAIN ========== */
function renderEvolutionChain(evo) {
    if (!evo || !evo.chain) return '<p style="color:var(--text-faint);font-size:13px;">ไม่มีข้อมูล</p>';

    // Flatten chain into stages
    const stages = [[]];
    const walk = (node, stageIdx) => {
        if (!stages[stageIdx]) stages[stageIdx] = [];
        stages[stageIdx].push({
            name: node.species.name,
            id: extractIdFromSpeciesUrl(node.species.url),
            details: node.evolution_details
        });
        for (const child of node.evolves_to) walk(child, stageIdx + 1);
    };
    walk(evo.chain, 0);

    let html = '<div class="evo-chain">';
    stages.forEach((stage, idx) => {
        if (idx > 0) {
            const conds = stage.map(s => formatEvoCondition(s.details)).filter(Boolean);
            const cond = conds.length ? conds[0] : '→';
            html += `<div class="evo-arrow">→<span class="req">${cond}</span></div>`;
        }
        stage.forEach(s => {
            const spriteUrl = s.id
                ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${s.id}.png`
                : '';
            html += `<div class="evo-step" data-name="${s.name}" style="cursor:pointer;">
                <img src="${spriteUrl}" alt="${s.name}" onerror="this.style.display='none'">
                <span class="name">${capitalize(s.name)}</span>
            </div>`;
        });
    });
    html += '</div>';
    return html;
}

function extractIdFromSpeciesUrl(url) {
    if (!url) return null;
    const m = url.match(/\/pokemon-species\/(\d+)\/?$/);
    return m ? m[1] : null;
}

function formatEvoCondition(detailsArr) {
    if (!detailsArr || detailsArr.length === 0) return '';
    const d = detailsArr[0];
    const parts = [];
    if (d.min_level) parts.push(`Lv. ${d.min_level}`);
    if (d.item) parts.push(`ใช้ ${capitalize(d.item.name)}`);
    if (d.held_item) parts.push(`ถือ ${capitalize(d.held_item.name)}`);
    if (d.min_happiness) parts.push(`Happiness ≥ ${d.min_happiness}`);
    if (d.min_affection) parts.push(`Affection ≥ ${d.min_affection}`);
    if (d.min_beauty) parts.push(`Beauty ≥ ${d.min_beauty}`);
    if (d.time_of_day) parts.push(`${d.time_of_day === 'day' ? 'กลางวัน' : 'กลางคืน'}`);
    if (d.known_move) parts.push(`รู้ท่า ${capitalize(d.known_move.name)}`);
    if (d.known_move_type) parts.push(`รู้ท่าธาตุ ${capitalize(d.known_move_type.name)}`);
    if (d.location) parts.push(`ที่ ${capitalize(d.location.name)}`);
    if (d.trade_species) parts.push(`Trade กับ ${capitalize(d.trade_species.name)}`);
    else if (d.trigger?.name === 'trade') parts.push('แลกเปลี่ยน (Trade)');
    if (d.party_species) parts.push(`มี ${capitalize(d.party_species.name)} ในทีม`);
    if (d.relative_physical_stats === 1) parts.push('Atk > Def');
    if (d.relative_physical_stats === -1) parts.push('Atk < Def');
    if (d.relative_physical_stats === 0) parts.push('Atk = Def');
    if (d.gender === 1) parts.push('ตัวเมีย');
    if (d.gender === 2) parts.push('ตัวผู้');
    if (d.needs_overworld_rain) parts.push('ขณะฝนตก');
    if (d.turn_upside_down) parts.push('คว่ำเครื่อง');
    return parts.join(' + ') || capitalize(d.trigger?.name || '');
}

/* ========== MOVES ========== */
function collectMoveVersions(p) {
    const set = new Set();
    p.moves.forEach(m => {
        m.version_group_details.forEach(d => set.add(d.version_group.name));
    });
    // Sort by some sensible order (rough chronology)
    const order = [
        'red-blue', 'yellow', 'gold-silver', 'crystal',
        'ruby-sapphire', 'emerald', 'firered-leafgreen',
        'diamond-pearl', 'platinum', 'heartgold-soulsilver',
        'black-white', 'black-2-white-2',
        'x-y', 'omega-ruby-alpha-sapphire',
        'sun-moon', 'ultra-sun-ultra-moon', 'lets-go-pikachu-lets-go-eevee',
        'sword-shield', 'brilliant-diamond-and-shining-pearl', 'legends-arceus',
        'scarlet-violet'
    ];
    const arr = Array.from(set);
    arr.sort((a, b) => {
        const ia = order.indexOf(a); const ib = order.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ib - ia; // newest first
    });
    return arr;
}

function formatVersionName(v) {
    const labels = {
        'red-blue': 'Red/Blue',
        'yellow': 'Yellow',
        'gold-silver': 'Gold/Silver',
        'crystal': 'Crystal',
        'ruby-sapphire': 'Ruby/Sapphire',
        'emerald': 'Emerald',
        'firered-leafgreen': 'FireRed/LeafGreen',
        'diamond-pearl': 'Diamond/Pearl',
        'platinum': 'Platinum',
        'heartgold-soulsilver': 'HeartGold/SoulSilver',
        'black-white': 'Black/White',
        'black-2-white-2': 'Black2/White2',
        'x-y': 'X/Y',
        'omega-ruby-alpha-sapphire': 'OR/AS',
        'sun-moon': 'Sun/Moon',
        'ultra-sun-ultra-moon': 'USUM',
        'lets-go-pikachu-lets-go-eevee': "Let's Go P/E",
        'sword-shield': 'Sword/Shield',
        'brilliant-diamond-and-shining-pearl': 'BD/SP',
        'legends-arceus': 'Legends: Arceus',
        'scarlet-violet': 'Scarlet/Violet'
    };
    return labels[v] || capitalize(v);
}

function renderMovesByMethod(p, version, method) {
    if (!version) return '<p style="color:var(--text-faint);font-size:13px;">ไม่มีข้อมูล</p>';
    const rows = [];
    p.moves.forEach(m => {
        const det = m.version_group_details.find(d => d.version_group.name === version && d.move_learn_method.name === method);
        if (det) rows.push({ name: m.move.name, level: det.level_learned_at });
    });

    if (rows.length === 0) {
        return '<p style="color:var(--text-faint);font-size:13px;padding:8px 0;">ไม่มีท่าจากวิธีนี้ในเวอร์ชันนี้</p>';
    }

    rows.sort((a, b) => {
        if (method === 'level-up') return a.level - b.level;
        return a.name.localeCompare(b.name);
    });

    let html = '<table class="move-table"><thead><tr>';
    if (method === 'level-up') html += '<th>Lv.</th>';
    html += '<th>ท่า</th></tr></thead><tbody>';
    rows.forEach(r => {
        html += '<tr>';
        if (method === 'level-up') html += `<td class="lvl">${r.level || '—'}</td>`;
        html += `<td class="move-name">${capitalize(r.name)}</td>`;
        html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
}

/* ========== LOCATIONS ========== */
function groupEncountersByVersion(encounters) {
    // encounters: array of { location_area, version_details: [{ version }] }
    const map = {};
    encounters.forEach(e => {
        e.version_details.forEach(vd => {
            const v = vd.version.name;
            if (!map[v]) map[v] = new Set();
            map[v].add(e.location_area.name);
        });
    });
    const result = {};
    // Sort by version chronology if possible
    const order = [
        'red', 'blue', 'yellow',
        'gold', 'silver', 'crystal',
        'ruby', 'sapphire', 'emerald', 'firered', 'leafgreen',
        'diamond', 'pearl', 'platinum', 'heartgold', 'soulsilver',
        'black', 'white', 'black-2', 'white-2',
        'x', 'y', 'omega-ruby', 'alpha-sapphire',
        'sun', 'moon', 'ultra-sun', 'ultra-moon',
        'lets-go-pikachu', 'lets-go-eevee',
        'sword', 'shield',
        'brilliant-diamond', 'shining-pearl', 'legends-arceus',
        'scarlet', 'violet'
    ];
    const keys = Object.keys(map).sort((a, b) => {
        const ia = order.indexOf(a); const ib = order.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ib - ia;
    });
    keys.forEach(k => { result[k] = Array.from(map[k]).sort(); });
    return result;
}

function renderLocations(locs) {
    if (!locs || locs.length === 0) return '<p style="color:var(--text-faint);font-size:13px;">ไม่พบในธรรมชาติ — ได้จากวิวัฒนาการ, แลกเปลี่ยน, หรือไข่</p>';
    return '<div class="location-list">' + locs.map(l =>
        `<div class="location-item">${l.replace(/-/g, ' ')}</div>`
    ).join('') + '</div>';
}

/* ========== HANDLERS ========== */
function attachPokemonHandlers(pokemon, encounters) {
    let currentMethod = 'level-up';
    let currentMovesVersion = collectMoveVersions(pokemon)[0];

    const refreshMoves = () => {
        document.getElementById('moves-content').innerHTML =
            renderMovesByMethod(pokemon, currentMovesVersion, currentMethod);
    };

    // Moves: version chip switch
    document.querySelectorAll('#moves-versions .game-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#moves-versions .game-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentMovesVersion = chip.dataset.version;
            refreshMoves();
        });
    });

    // Moves: method subtab
    document.querySelectorAll('#moves-subtab button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#moves-subtab button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMethod = btn.dataset.method;
            refreshMoves();
        });
    });

    // Locations: version chip switch
    const locByVer = groupEncountersByVersion(encounters);
    document.querySelectorAll('#loc-versions .game-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#loc-versions .game-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const v = chip.dataset.version;
            document.getElementById('loc-content').innerHTML = renderLocations(locByVer[v]);
        });
    });

    // Click on ability pill → jump to abilities tab and load it
    document.querySelectorAll('.ability-pill').forEach(pill => {
        pill.style.cursor = 'pointer';
        pill.addEventListener('click', () => {
            const name = pill.dataset.ability;
            switchTab('abilities');
            loadAbility(name);
        });
    });

    // Click on evolution step → search that Pokemon
    document.querySelectorAll('.evo-step').forEach(step => {
        step.addEventListener('click', () => {
            doPokemonSearch(step.dataset.name);
        });
    });
}
