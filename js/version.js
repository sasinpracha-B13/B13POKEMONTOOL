/* ============================================================
 * GLOBAL STATE: selected version group + type chart era
 *
 * Selecting a version group also activates the matching type
 * chart era (modern / gen2-5 / gen1). The banner reflects which
 * era is in use — Modern chart is never used "silently" for an
 * older-gen selection.
 * ============================================================ */

const VERSION_STORAGE_KEY = 'pkmn-version-v1';

let _currentVersionGroupId = (() => {
    try {
        const saved = localStorage.getItem(VERSION_STORAGE_KEY);
        if (saved && VERSION_GROUPS.some(v => v.id === saved)) return saved;
    } catch (e) {}
    return DEFAULT_VERSION_GROUP;
})();

/* Set the active era immediately so initial render is correct */
setActiveChartEra(getVersionGroup(_currentVersionGroupId).chartEra);

const _versionSubscribers = [];

function currentVersionGroup() {
    return getVersionGroup(_currentVersionGroupId);
}

function setVersionGroup(id) {
    if (!VERSION_GROUPS.some(v => v.id === id)) return;
    _currentVersionGroupId = id;
    try { localStorage.setItem(VERSION_STORAGE_KEY, id); } catch (e) {}
    const vg = currentVersionGroup();
    setActiveChartEra(vg.chartEra);
    _versionSubscribers.forEach(fn => {
        try { fn(vg); } catch (e) { console.warn(e); }
    });
}

function onVersionChange(fn) {
    _versionSubscribers.push(fn);
}

/* Banner text: always say which chart era is in use.
 * Gen 1 is marked "(approximated)" since not every cell is verified. */
function chartEraBanner() {
    const vg = currentVersionGroup();
    const era = vg.chartEra;
    if (era === 'modern') return null; // no banner — modern is the assumed baseline
    if (era === 'gen2-5') {
        return `📜 ใช้ Type Chart Gen 2–5 (ตรงกับเกม ${vg.label}): ไม่มี Fairy, Steel ทน Ghost/Dark`;
    }
    if (era === 'gen1') {
        return `📜 ใช้ Type Chart Gen 1 (ตรงกับเกม ${vg.label}): ไม่มี Steel/Dark/Fairy, Ghost→Psychic = 0 (bug), Bug↔Poison super effective, Ice→Fire = 1× ⚠ best-effort approximation`;
    }
    return null;
}

/* Render the global version selector into a container */
function renderVersionSelector(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const cur = _currentVersionGroupId;
    el.innerHTML = `
        <label for="version-select">เกมที่เล่น</label>
        <select id="version-select">
            ${VERSION_GROUPS.map(v =>
                `<option value="${v.id}" ${v.id === cur ? 'selected' : ''}>Gen ${v.gen} — ${v.label}</option>`
            ).join('')}
        </select>
    `;
    el.querySelector('#version-select').addEventListener('change', e => {
        setVersionGroup(e.target.value);
    });
}
