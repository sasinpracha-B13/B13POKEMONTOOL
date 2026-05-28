/* ============================================================
 * MY TEAM — Team builder & coverage analyzer
 *
 *   - Up to 6 slots; persisted in localStorage as PokéAPI variant
 *     names (so cache/SW gives us free offline rehydration)
 *   - Coverage uses the active type chart era automatically
 *   - Insights are derived from per-type tallies using simple
 *     thresholds (see _buildInsights below)
 * ============================================================ */

const TEAM_STORAGE_KEY = 'pkmn-team-v1';
const TEAM_MAX = 6;
const PRESETS_STORAGE_KEY = 'pkmn-team-presets-v1';

let _team = (() => {
    try {
        const raw = localStorage.getItem(TEAM_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.slice(0, TEAM_MAX);
        }
    } catch (e) {}
    return [];
})();

let _presets = (() => {
    try {
        const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.filter(p =>
                    p && typeof p.id === 'string'
                    && typeof p.name === 'string'
                    && Array.isArray(p.members)
                );
            }
        }
    } catch (e) { console.warn('Presets storage corrupt — starting empty', e); }
    return [];
})();

let _currentPresetId = null;   // id of preset whose contents == _team

function _saveTeam() {
    try { localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(_team)); }
    catch (e) {}
}

function _savePresets() {
    try { localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(_presets)); }
    catch (e) {}
}

function initTeam() {
    const input = document.getElementById('team-search');
    const btn = document.getElementById('team-add-btn');
    const emptyBtn = document.getElementById('team-empty-all');
    if (input) attachAutocomplete(input, name => teamAddPokemon(name));
    if (btn) btn.addEventListener('click', () => teamAddPokemon(input.value));
    if (emptyBtn) emptyBtn.addEventListener('click', () => teamClear());

    // Preset / share buttons
    document.getElementById('save-team-btn')?.addEventListener('click', () => saveTeamSmart());
    document.getElementById('save-team-as-new-btn')?.addEventListener('click', () => saveAsNewPreset());
    document.getElementById('share-team-btn')?.addEventListener('click', () => shareCurrentTeam());
    // Backup / restore buttons
    document.getElementById('export-presets-btn')?.addEventListener('click', () => exportPresetsToJson());
    document.getElementById('restore-presets-btn')?.addEventListener('click', () => {
        document.getElementById('restore-file-input')?.click();
    });
    document.getElementById('restore-file-input')?.addEventListener('change', e => {
        const file = e.target.files?.[0];
        if (file) importPresetsFromFile(file);
        e.target.value = '';   // allow re-import same file later
    });

    // URL import detection — if ?team= present, show preview banner
    const params = new URLSearchParams(location.search);
    const teamParam = params.get('team');
    if (teamParam) {
        // Defer slightly to let initial render settle
        setTimeout(() => importTeamFromUrl(teamParam), 200);
    }

    // React to global version/chart era change — coverage may shift
    onVersionChange(() => {
        if (_team.length > 0) _renderCoverage();
    });

    renderTeam();
}

/* ============================================================
 * PRESETS (save / load / rename / delete)
 *
 * Storage: localStorage 'pkmn-team-presets-v1' as JSON array of:
 *   { id, name, createdAt, updatedAt, versionGroup, members: [...] }
 *
 * _currentPresetId tracks the preset whose contents match _team so
 * we know whether Save is "update preset" or "save new preset".
 * Adding/removing/clearing a team drops _currentPresetId since the
 * team has diverged.
 * ============================================================ */

function _generatePresetId() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function _defaultPresetName() {
    const vg = currentVersionGroup();
    const date = new Date().toISOString().slice(0, 10);
    const baseName = `${vg.label} · ${date}`;
    // De-duplicate if already exists
    let name = baseName;
    let i = 2;
    while (_presets.some(p => p.name === name)) {
        name = `${baseName} (${i})`;
        i++;
    }
    return name;
}

function getPresets() { return _presets.slice(); }
function getCurrentPresetId() { return _currentPresetId; }

function saveTeamAsPreset(customName) {
    if (_team.length === 0) {
        _setTeamStatus('⚠ ทีมว่าง — เพิ่มสมาชิกก่อนถึงบันทึกได้', 'warn');
        return null;
    }
    const now = Date.now();
    const preset = {
        id: _generatePresetId(),
        name: customName || _defaultPresetName(),
        createdAt: now,
        updatedAt: now,
        versionGroup: currentVersionGroup().id,
        members: _team.map(m => ({
            name: m.name, baseName: m.baseName, types: m.types.slice(),
            sprite: m.sprite, dexNum: m.dexNum
        }))
    };
    _presets.unshift(preset);
    _savePresets();
    _currentPresetId = preset.id;
    _renderPresetsSection();
    _setTeamStatus(`✅ บันทึก "${preset.name}"`, 'ok');
    return preset;
}

function updateExistingPreset() {
    if (!_currentPresetId) return saveTeamAsPreset();
    const idx = _presets.findIndex(p => p.id === _currentPresetId);
    if (idx < 0) return saveTeamAsPreset();
    if (_team.length === 0) {
        _setTeamStatus('⚠ ทีมว่าง — ลบ preset แทนถ้าต้องการ', 'warn');
        return null;
    }
    _presets[idx] = {
        ..._presets[idx],
        updatedAt: Date.now(),
        versionGroup: currentVersionGroup().id,
        members: _team.map(m => ({
            name: m.name, baseName: m.baseName, types: m.types.slice(),
            sprite: m.sprite, dexNum: m.dexNum
        }))
    };
    _savePresets();
    _renderPresetsSection();
    _setTeamStatus(`✅ อัพเดท "${_presets[idx].name}"`, 'ok');
    return _presets[idx];
}

/* "Save" button — if current team matches an existing preset, update it.
 * If unsaved/new, create. */
function saveTeamSmart() {
    if (_currentPresetId) return updateExistingPreset();
    return saveTeamAsPreset();
}

/* Always create a NEW preset, even if one is loaded */
function saveAsNewPreset() {
    if (_team.length === 0) {
        _setTeamStatus('⚠ ทีมว่าง', 'warn');
        return null;
    }
    return saveTeamAsPreset();   // generates new id
}

function loadPreset(id) {
    const preset = _presets.find(p => p.id === id);
    if (!preset) return false;

    // Confirm if current team has unsaved/different members
    if (_team.length > 0 && _currentPresetId !== preset.id) {
        if (!confirm(`โหลด "${preset.name}" จะแทนที่ทีมปัจจุบัน?`)) return false;
    }

    _team = preset.members.slice();
    _saveTeam();
    _currentPresetId = preset.id;
    if (preset.versionGroup) setVersionGroup(preset.versionGroup);
    renderTeam();
    _setTeamStatus(`📂 โหลด "${preset.name}"`, 'info');
    return true;
}

function renamePreset(id) {
    const idx = _presets.findIndex(p => p.id === id);
    if (idx < 0) return false;
    const current = _presets[idx].name;
    const newName = prompt('ตั้งชื่อใหม่:', current);
    if (newName === null) return false;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === current) return false;
    _presets[idx].name = trimmed;
    _presets[idx].updatedAt = Date.now();
    _savePresets();
    _renderPresetsSection();
    return true;
}

function deletePreset(id) {
    const idx = _presets.findIndex(p => p.id === id);
    if (idx < 0) return false;
    const preset = _presets[idx];
    if (!confirm(`ลบ "${preset.name}"?`)) return false;
    _presets.splice(idx, 1);
    _savePresets();
    if (_currentPresetId === id) _currentPresetId = null;
    _renderPresetsSection();
    _setTeamStatus(`🗑 ลบ "${preset.name}"`, 'info');
    return true;
}

function sharePresetById(id) {
    const preset = _presets.find(p => p.id === id);
    if (!preset) return;
    const url = _generateShareUrlFromMembers(preset.members, preset.versionGroup);
    _doShare(url, preset.name);
}

/* ============================================================
 * SHARE URL — encode/decode + share + import
 *
 * Payload schema (kept minimal so URL stays short):
 *   { v: 'scarlet-violet', t: ['charizard', 'gyarados', ...] }
 * Encoded as base64url in the ?team= query param.
 * ============================================================ */

function _encodeTeamPayload(members, versionGroupId) {
    const payload = { v: versionGroupId, t: members.map(m => m.name) };
    const json = JSON.stringify(payload);
    try {
        const b64 = btoa(unescape(encodeURIComponent(json)));
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (e) {
        return null;
    }
}

function _decodeTeamPayload(encoded) {
    try {
        const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
        const json = decodeURIComponent(escape(atob(padded)));
        const data = JSON.parse(json);
        if (!data || typeof data !== 'object') return null;
        if (typeof data.v !== 'string' || !Array.isArray(data.t)) return null;
        if (data.t.length === 0 || data.t.length > TEAM_MAX) return null;
        if (!data.t.every(n => typeof n === 'string' && n.length > 0 && n.length < 80)) return null;
        return data;
    } catch (e) {
        return null;
    }
}

function _generateShareUrl() {
    if (_team.length === 0) return null;
    return _generateShareUrlFromMembers(_team, currentVersionGroup().id);
}

function _generateShareUrlFromMembers(members, vgId) {
    const encoded = _encodeTeamPayload(members, vgId);
    if (!encoded) return null;
    return location.origin + location.pathname + '?team=' + encoded;
}

async function shareCurrentTeam() {
    const url = _generateShareUrl();
    if (!url) {
        _setTeamStatus('⚠ ทีมว่าง — เพิ่มสมาชิกก่อนถึงแชร์ได้', 'warn');
        return;
    }
    const name = _currentPresetId
        ? _presets.find(p => p.id === _currentPresetId)?.name || 'My Team'
        : 'My Team';
    _doShare(url, name);
}

async function _doShare(url, name) {
    // 1. navigator.share (mobile native sheet)
    try {
        if (navigator.share) {
            await navigator.share({
                title: `Pokémon Team: ${name}`,
                text: `ทีมโปเกม่อน: ${name}`,
                url
            });
            return;
        }
    } catch (e) { /* user cancelled, fall through */ }
    // 2. Clipboard
    try {
        await navigator.clipboard.writeText(url);
        _setTeamStatus('📋 คัดลอก URL ลง clipboard แล้ว', 'ok');
        return;
    } catch (e) { /* fallthrough */ }
    // 3. prompt fallback
    prompt('คัดลอก URL นี้:', url);
}

function importTeamFromUrl(encoded) {
    const data = _decodeTeamPayload(encoded);
    if (!data) {
        _showImportError('❌ URL ที่แชร์ไม่ถูกต้องหรือ corrupt');
        return false;
    }
    _showImportPreview(data);
    return true;
}

function _showImportError(msg) {
    const banner = document.getElementById('import-preview-banner');
    if (!banner) return;
    banner.className = 'import-preview-banner err';
    banner.style.display = 'block';
    banner.innerHTML = `${msg} <button class="link-btn import-dismiss">Dismiss</button>`;
    banner.querySelector('.import-dismiss').addEventListener('click', () => {
        banner.style.display = 'none';
        history.replaceState({}, '', location.pathname);
    });
}

function _showImportPreview(data) {
    const banner = document.getElementById('import-preview-banner');
    if (!banner) return;
    const vg = getVersionGroup(data.v);
    const previewList = data.t.map(name => {
        const base = name.split(/-(?=mega|gmax|alola|galar|hisui|paldea)/)[0] || name;
        return `<span class="import-preview-pill">${prettyPokemonName(name, base)}</span>`;
    }).join('');

    banner.className = 'import-preview-banner';
    banner.style.display = 'block';
    banner.innerHTML = `
        <div class="import-preview-head">
            📥 <strong>Team shared via URL</strong>
            <span class="import-preview-vg">Gen ${vg.gen} · ${vg.label}</span>
        </div>
        <div class="import-preview-list">${previewList}</div>
        <div class="import-preview-actions">
            <button class="link-btn import-confirm">Import</button>
            <button class="link-btn import-save">Import & Save as preset</button>
            <button class="link-btn import-dismiss dismiss">Dismiss</button>
        </div>
    `;

    banner.querySelector('.import-confirm').addEventListener('click', () => _performImport(data, false));
    banner.querySelector('.import-save').addEventListener('click', () => _performImport(data, true));
    banner.querySelector('.import-dismiss').addEventListener('click', () => {
        banner.style.display = 'none';
        history.replaceState({}, '', location.pathname);
    });
}

async function _performImport(data, saveAsPreset) {
    const banner = document.getElementById('import-preview-banner');
    if (banner) {
        banner.innerHTML = `<span class="patch-suggested-loading">⏳ Importing ${data.t.length} ตัว…</span>`;
    }

    // Replace current team
    _team = [];
    _currentPresetId = null;
    _saveTeam();
    if (data.v) setVersionGroup(data.v);

    const failures = [];
    for (const name of data.t) {
        const ok = await teamAddPokemon(name);
        if (!ok) failures.push(name);
    }

    if (banner) {
        banner.style.display = 'none';
        history.replaceState({}, '', location.pathname);
    }

    if (failures.length > 0) {
        const offlineMsg = !navigator.onLine ? ' (offline; cache ไม่มี)' : '';
        _setTeamStatus(`⚠ Import บางส่วน: ${failures.length} ตัวที่ load ไม่ได้${offlineMsg}`, 'warn');
    } else {
        _setTeamStatus(`✅ Import ${data.t.length} ตัวสำเร็จ`, 'ok');
    }

    if (saveAsPreset && _team.length > 0) {
        const name = `Imported · ${new Date().toISOString().slice(0, 10)}`;
        saveTeamAsPreset(name);
    }
}

/* ============================================================
 * BACKUP / RESTORE — JSON file export/import
 *
 * Schema:
 *   {
 *     "schema":      "pokemon-tool-presets-v1",
 *     "exportedAt":  <unix-ms>,
 *     "appVersion":  "1.7.0",
 *     "versionGroup":"scarlet-violet",
 *     "currentTeam": [members],      // optional
 *     "presets":     [presets]       // optional but typical
 *   }
 *
 * - Validation rejects per-preset issues (oversized, missing types, etc.)
 *   rather than the whole file.
 * - Merge keeps existing presets; collisions get new id + renamed.
 * - Replace clears all presets after explicit confirmation.
 * ============================================================ */

const BACKUP_SCHEMA = 'pokemon-tool-presets-v1';

function exportPresetsToJson() {
    if (_presets.length === 0 && _team.length === 0) {
        _setTeamStatus('⚠ ไม่มี presets หรือ team ปัจจุบันที่จะ export', 'warn');
        return;
    }
    const payload = {
        schema: BACKUP_SCHEMA,
        exportedAt: Date.now(),
        appVersion: typeof APP_VERSION === 'string' ? APP_VERSION : 'unknown',
        versionGroup: currentVersionGroup().id,
        currentTeam: _team.map(m => ({
            name: m.name, baseName: m.baseName, types: m.types.slice(),
            sprite: m.sprite, dexNum: m.dexNum
        })),
        presets: _presets.map(p => ({
            id: p.id, name: p.name,
            createdAt: p.createdAt, updatedAt: p.updatedAt,
            versionGroup: p.versionGroup,
            members: p.members.map(m => ({
                name: m.name, baseName: m.baseName, types: m.types.slice(),
                sprite: m.sprite, dexNum: m.dexNum
            }))
        }))
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pokemon-tool-presets-${date}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 200);
    _setTeamStatus(`📥 Export ${_presets.length} presets + ${_team.length} ทีม → ${a.download}`, 'ok');
}

function _validateBackupMember(m) {
    if (!m || typeof m !== 'object') return null;
    if (typeof m.name !== 'string' || !m.name || m.name.length > 80) return null;
    if (!Array.isArray(m.types) || m.types.length === 0 || m.types.length > 2) return null;
    const allTypes = (typeof activeTypes === 'function') ? TYPES_MODERN : TYPES;
    if (!m.types.every(t => typeof t === 'string' && allTypes.includes(t))) return null;
    return {
        name: m.name,
        baseName: typeof m.baseName === 'string' && m.baseName ? m.baseName : m.name.split('-')[0],
        types: m.types.slice(),
        sprite: typeof m.sprite === 'string' ? m.sprite : '',
        dexNum: Number.isFinite(m.dexNum) && m.dexNum > 0 ? m.dexNum : 0
    };
}

function _validateBackupPreset(p) {
    if (!p || typeof p !== 'object') return null;
    if (typeof p.name !== 'string' || !p.name || p.name.length > 200) return null;
    if (!Array.isArray(p.members)) return null;
    if (p.members.length === 0 || p.members.length > TEAM_MAX) return null;
    const members = p.members.map(_validateBackupMember).filter(Boolean);
    if (members.length !== p.members.length) return null;
    return {
        id: typeof p.id === 'string' && p.id ? p.id : _generatePresetId(),
        name: p.name,
        createdAt: Number.isFinite(p.createdAt) ? p.createdAt : Date.now(),
        updatedAt: Number.isFinite(p.updatedAt) ? p.updatedAt : Date.now(),
        versionGroup: typeof p.versionGroup === 'string' && p.versionGroup
            ? p.versionGroup : currentVersionGroup().id,
        members
    };
}

function _validateBackup(data) {
    if (!data || typeof data !== 'object') {
        return { error: 'รูปแบบไฟล์ไม่ถูกต้อง — ไม่ใช่ JSON object' };
    }
    const result = {
        schemaMismatch: data.schema && data.schema !== BACKUP_SCHEMA,
        appVersion: typeof data.appVersion === 'string' ? data.appVersion : null,
        versionGroup: typeof data.versionGroup === 'string' ? data.versionGroup : null,
        presets: [],
        currentTeam: null,
        skipped: 0
    };
    if (Array.isArray(data.presets)) {
        for (const p of data.presets) {
            const validated = _validateBackupPreset(p);
            if (validated) result.presets.push(validated);
            else result.skipped++;
        }
    }
    if (Array.isArray(data.currentTeam)
        && data.currentTeam.length > 0
        && data.currentTeam.length <= TEAM_MAX) {
        const members = data.currentTeam.map(_validateBackupMember).filter(Boolean);
        if (members.length === data.currentTeam.length) {
            result.currentTeam = members;
        }
    }
    return result;
}

async function importPresetsFromFile(file) {
    if (!file) return;
    try {
        const text = await file.text();
        let data;
        try { data = JSON.parse(text); }
        catch (e) {
            _setTeamStatus('❌ JSON ไม่ถูกต้อง', 'error');
            return;
        }
        const validated = _validateBackup(data);
        if (validated.error) {
            _setTeamStatus(`❌ ${validated.error}`, 'error');
            return;
        }
        if (validated.presets.length === 0 && !validated.currentTeam) {
            _setTeamStatus('⚠ ไฟล์ไม่มี presets หรือ team ที่ valid', 'warn');
            return;
        }
        _showImportDialog(validated);
    } catch (e) {
        console.error(e);
        _setTeamStatus(`❌ อ่านไฟล์ไม่สำเร็จ: ${e.message || 'unknown'}`, 'error');
    }
}

function _showImportDialog(validated) {
    const dialog = document.getElementById('import-dialog');
    if (!dialog) return;

    const hasPresets = validated.presets.length > 0;
    const hasCurrentTeam = !!validated.currentTeam;
    const skippedNote = validated.skipped > 0
        ? `<p class="import-skipped">⚠ Skipped ${validated.skipped} invalid preset(s) — members > 6 หรือ types ผิด</p>`
        : '';
    const schemaWarn = validated.schemaMismatch
        ? '<p class="import-skipped">⚠ Schema ในไฟล์ไม่ตรงกับเวอร์ชันปัจจุบัน — จะพยายาม import ตามสคีมาทั่วไป</p>'
        : '';

    dialog.innerHTML = `
        <div class="import-dialog-card">
            <h3>📤 Import Backup</h3>
            <div class="import-summary">
                <p>📋 พบ valid presets <strong>${validated.presets.length}</strong></p>
                ${hasCurrentTeam ? `<p>👥 Current team ในไฟล์: <strong>${validated.currentTeam.length}</strong> ตัว${validated.versionGroup ? ` <span class="dim">(${validated.versionGroup})</span>` : ''}</p>` : ''}
                ${validated.appVersion ? `<p class="dim">App version ตอน export: ${validated.appVersion}</p>` : ''}
                ${skippedNote}
                ${schemaWarn}
            </div>

            ${hasPresets ? `
                <div class="import-mode-row">
                    <label><input type="radio" name="import-mode" value="merge" checked>
                        <span><strong>Merge</strong> — รวมกับ presets เดิม (id/name ซ้ำ → rename อัตโนมัติ)</span></label>
                    <label><input type="radio" name="import-mode" value="replace">
                        <span><strong>Replace</strong> — ลบ presets เดิมทั้งหมด แล้วใส่ของใหม่</span></label>
                </div>
            ` : ''}

            ${hasCurrentTeam ? `
                <div class="import-team-row">
                    <label><input type="checkbox" id="import-current-team" ${_team.length === 0 ? 'checked' : ''}>
                        <span>โหลด current team จากไฟล์ด้วย${_team.length > 0 ? ' (จะถามยืนยันอีกครั้ง)' : ''}</span></label>
                </div>
            ` : ''}

            <div class="import-dialog-actions">
                <button class="link-btn dismiss import-cancel">Cancel</button>
                <button class="link-btn import-do" ${!hasPresets && !hasCurrentTeam ? 'disabled' : ''}>Import</button>
            </div>
        </div>
    `;

    dialog.style.display = 'flex';

    dialog.querySelector('.import-do').addEventListener('click', () => {
        const mode = dialog.querySelector('input[name="import-mode"]:checked')?.value || 'merge';
        const includeCurrent = dialog.querySelector('#import-current-team')?.checked || false;
        const result = _applyImport(validated, mode, includeCurrent);
        dialog.style.display = 'none';
        if (result) _showImportResultStatus(result);
    });
    dialog.querySelector('.import-cancel').addEventListener('click', () => {
        dialog.style.display = 'none';
    });
}

function _applyImport(validated, mode, includeCurrentTeam) {
    if (mode === 'replace') {
        if (!confirm(`Replace presets ทั้งหมด? presets เดิม ${_presets.length} อันจะหายไป`)) {
            return null;
        }
        _presets = [];
        _currentPresetId = null;
    }

    const existingIds = new Set(_presets.map(p => p.id));
    const existingNames = new Set(_presets.map(p => p.name));
    const renamed = [];
    let imported = 0;

    for (const p of validated.presets) {
        let id = p.id;
        if (existingIds.has(id)) {
            id = _generatePresetId();
        }
        existingIds.add(id);

        let name = p.name;
        if (existingNames.has(name)) {
            const orig = name;
            let candidate = `${orig} (imported)`;
            let i = 2;
            while (existingNames.has(candidate)) {
                candidate = `${orig} (imported ${i++})`;
            }
            renamed.push({ from: orig, to: candidate });
            name = candidate;
        }
        existingNames.add(name);

        _presets.push({ ...p, id, name });
        imported++;
    }
    _savePresets();

    let currentTeamLoaded = false;
    if (includeCurrentTeam && validated.currentTeam) {
        const ok = _team.length === 0
            || confirm(`โหลด current team จากไฟล์ (${validated.currentTeam.length} ตัว)? ทีมปัจจุบันจะถูกแทนที่`);
        if (ok) {
            _team = validated.currentTeam.slice();
            _saveTeam();
            _currentPresetId = null;
            if (validated.versionGroup) setVersionGroup(validated.versionGroup);
            currentTeamLoaded = true;
        }
    }

    renderTeam();

    return {
        imported,
        skipped: validated.skipped,
        renamed,
        currentTeamLoaded,
        mode
    };
}

function _showImportResultStatus(result) {
    const parts = [`✅ Imported ${result.imported} presets`];
    if (result.skipped) parts.push(`skipped ${result.skipped}`);
    if (result.renamed.length) parts.push(`renamed ${result.renamed.length}`);
    if (result.currentTeamLoaded) parts.push('current team loaded');
    _setTeamStatus(parts.join(' · '), 'ok');
    if (result.renamed.length) {
        console.log('Renamed presets:',
            result.renamed.map(r => `"${r.from}" → "${r.to}"`).join(', '));
    }
}

/* ============================================================
 * Render Presets section
 * ============================================================ */

function _formatRelative(ts) {
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return new Date(ts).toISOString().slice(0, 10);
}

function _renderPresetsSection() {
    const list = document.getElementById('presets-list');
    const countEl = document.getElementById('presets-count');
    const saveAsNewBtn = document.getElementById('save-team-as-new-btn');
    if (!list) return;

    if (countEl) countEl.textContent = _presets.length ? `(${_presets.length})` : '';

    // Save as new visible only when a preset is currently loaded
    if (saveAsNewBtn) {
        saveAsNewBtn.style.display = _currentPresetId ? '' : 'none';
    }

    if (_presets.length === 0) {
        list.innerHTML = `<div class="presets-empty">ยังไม่มี preset — กด 💾 Save เพื่อบันทึกทีมปัจจุบัน</div>`;
        return;
    }

    list.innerHTML = _presets.map(p => {
        const vg = getVersionGroup(p.versionGroup);
        const isCurrent = p.id === _currentPresetId;
        const sprites = p.members.slice(0, 6).map(m => {
            const fallback = m.sprite || '';
            return `<img src="${fallback}" alt="${m.name}" onerror="this.style.opacity=0.2">`;
        }).join('');
        return `
            <div class="preset-card ${isCurrent ? 'current' : ''}" data-id="${p.id}">
                <div class="preset-info">
                    <div class="preset-name">${isCurrent ? '<span class="preset-current-dot" title="currently loaded">●</span> ' : ''}${p.name}</div>
                    <div class="preset-meta">
                        <span>${p.members.length} ตัว</span>
                        <span>•</span>
                        <span>Gen ${vg.gen} ${vg.label}</span>
                        <span>•</span>
                        <span>${_formatRelative(p.updatedAt)}</span>
                    </div>
                    <div class="preset-sprites">${sprites}</div>
                </div>
                <div class="preset-actions">
                    <button class="preset-action-btn" data-act="load" data-id="${p.id}">Load</button>
                    <button class="preset-action-btn" data-act="share" data-id="${p.id}">Share</button>
                    <button class="preset-action-btn" data-act="rename" data-id="${p.id}">Rename</button>
                    <button class="preset-action-btn danger" data-act="delete" data-id="${p.id}">Delete</button>
                </div>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.preset-action-btn').forEach(btn => {
        const id = btn.dataset.id;
        const act = btn.dataset.act;
        btn.addEventListener('click', () => {
            if (act === 'load') loadPreset(id);
            else if (act === 'share') sharePresetById(id);
            else if (act === 'rename') renamePreset(id);
            else if (act === 'delete') deletePreset(id);
        });
    });
}

/* ========== STATE ========== */

async function teamAddPokemon(variantName) {
    variantName = (variantName || '').trim().toLowerCase();
    if (!variantName) return false;

    if (_team.length >= TEAM_MAX) {
        _setTeamStatus(`⚠ ทีมเต็มแล้ว (สูงสุด ${TEAM_MAX} ตัว) — ลบสมาชิกก่อนถึงเพิ่มใหม่`, 'warn');
        return false;
    }
    if (_team.some(m => m.name === variantName)) {
        _setTeamStatus(`ℹ ${prettyPokemonName(variantName, variantName)} มีอยู่ในทีมแล้ว`, 'info');
        return false;
    }

    _setTeamStatus('กำลังเพิ่ม...', 'load');
    try {
        const pokemon = await fetchPokemon(variantName);
        const species = await fetchSpecies(pokemon.species.name);
        const member = {
            name: pokemon.name,
            baseName: species.name,
            types: pokemon.types.map(t => t.type.name),
            sprite: pokemon.sprites.other?.['official-artwork']?.front_default
                || pokemon.sprites.front_default || '',
            dexNum: species.id
        };
        _team.push(member);
        _saveTeam();
        _currentPresetId = null;   // team diverged from any loaded preset
        _setTeamStatus(`✅ เพิ่ม ${prettyPokemonName(member.name, member.baseName)}`, 'ok');
        const input = document.getElementById('team-search');
        if (input) input.value = '';
        renderTeam();
        return true;
    } catch (e) {
        console.error(e);
        if (!navigator.onLine) {
            _setTeamStatus(`📵 Offline — โปเกม่อน "${variantName}" ยังไม่เคย cache ในเครื่อง`, 'error');
        } else {
            _setTeamStatus(`❌ เพิ่ม "${variantName}" ไม่สำเร็จ — ตรวจชื่อ`, 'error');
        }
        return false;
    }
}

function teamRemovePokemon(idx) {
    if (idx < 0 || idx >= _team.length) return;
    const removed = _team.splice(idx, 1)[0];
    _saveTeam();
    _currentPresetId = null;
    _setTeamStatus(`ลบ ${prettyPokemonName(removed.name, removed.baseName)} แล้ว`, 'info');
    renderTeam();
}

function teamClear() {
    if (_team.length === 0) return;
    if (!confirm('ลบทีมทั้งหมด?')) return;
    _team = [];
    _saveTeam();
    _currentPresetId = null;
    renderTeam();
}

function getTeam() { return _team.slice(); }

function _setTeamStatus(msg, kind) {
    const el = document.getElementById('team-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'team-status ' + (kind || '');
    if (kind === 'ok' || kind === 'info' || kind === 'load') {
        setTimeout(() => {
            if (el.textContent === msg) { el.textContent = ''; el.className = 'team-status'; }
        }, 4000);
    }
}

/* ========== ANALYSIS ========== */

/* For every attacking type in the active era, tally how many team
 * members fall into each multiplier bucket. Returns:
 *   { [attackerType]: { x4, x2, x1, half, quarter, zero } } */
function teamCoverage(team) {
    team = team || _team;
    const out = {};
    for (const atk of activeTypes()) {
        const c = { x4: 0, x2: 0, x1: 0, half: 0, quarter: 0, zero: 0 };
        for (const m of team) {
            const eff = getEffectMulti(atk, m.types);
            if (eff === 4) c.x4++;
            else if (eff === 2) c.x2++;
            else if (eff === 1) c.x1++;
            else if (eff === 0.5) c.half++;
            else if (eff === 0.25) c.quarter++;
            else if (eff === 0) c.zero++;
        }
        out[atk] = c;
    }
    return out;
}

/* Turn coverage into a sorted list of insight cards.
 * Thresholds chosen for "useful at a glance" without spamming:
 *   - x4 ≥ 1                                   → critical
 *   - shared weakness (x4+x2 ≥ 3)              → pressure
 *   - has weak member(s) but zero resist/immune → no-safe-switch
 *   - zero immunity                            → covered (low priority)
 *   - ≥ 2 resists or ≥ 1 immune                → covered (low priority) */
function teamInsights(coverage, teamSize) {
    const insights = [];
    for (const type of Object.keys(coverage)) {
        const c = coverage[type];
        const weakTotal = c.x4 + c.x2;
        const resistTotal = c.half + c.quarter + c.zero;
        const noOneSafe = weakTotal > 0 && resistTotal === 0;

        if (c.x4 >= 1) {
            insights.push({
                kind: 'critical',
                type,
                priority: 100 + c.x4 * 10 + c.x2,
                msg: `${capitalize(type)}: <strong>${c.x4} ตัวรับ 4×</strong>${c.x2 ? `, ${c.x2} ตัวรับ 2×` : ''}`
            });
        } else if (weakTotal >= Math.max(3, Math.ceil(teamSize * 0.5))) {
            insights.push({
                kind: 'pressure',
                type,
                priority: 50 + weakTotal * 5,
                msg: `${capitalize(type)} pressure: <strong>${weakTotal}/${teamSize}</strong> ตัวอ่อนแอ`
            });
        }
        if (noOneSafe) {
            insights.push({
                kind: 'noresist',
                type,
                priority: 40 + weakTotal,
                msg: `${capitalize(type)}: ไม่มีตัวต้านหรือ immune (${weakTotal} ตัวอ่อนแอ)`
            });
        }
        if (c.zero > 0) {
            insights.push({
                kind: 'immune',
                type,
                priority: 10 + c.zero,
                msg: `${capitalize(type)}: <strong>${c.zero} ตัว immune</strong>${resistTotal - c.zero ? ` + ${resistTotal - c.zero} ต้าน` : ''}`
            });
        } else if (resistTotal >= 2) {
            insights.push({
                kind: 'covered',
                type,
                priority: 5 + resistTotal,
                msg: `${capitalize(type)}: ${resistTotal} ตัวต้าน${c.quarter ? ` (${c.quarter} ¼×)` : ''}`
            });
        }
    }
    insights.sort((a, b) => b.priority - a.priority);
    return insights;
}

/* ========== RENDERING ========== */

function renderTeam() {
    _renderSlots();
    _renderCoverage();
    _renderPresetsSection();
    const emptyBtn = document.getElementById('team-empty-all');
    if (emptyBtn) emptyBtn.style.display = _team.length > 0 ? '' : 'none';
}

function _renderSlots() {
    const container = document.getElementById('team-slots');
    if (!container) return;
    const cells = [];
    for (let i = 0; i < TEAM_MAX; i++) {
        const m = _team[i];
        if (m) {
            const pretty = prettyPokemonName(m.name, m.baseName);
            const isVariant = m.name !== m.baseName;
            cells.push(`
                <div class="team-slot filled" data-idx="${i}">
                    <button class="slot-remove" data-idx="${i}" title="Remove">×</button>
                    <div class="slot-sprite-wrap">
                        <img class="slot-sprite" src="${m.sprite}" alt="${m.name}" onerror="this.style.opacity=0.2">
                    </div>
                    <div class="slot-name" title="${pretty}">${pretty}</div>
                    <div class="slot-dex">#${String(m.dexNum).padStart(4, '0')}${isVariant ? ' · variant' : ''}</div>
                    <div class="slot-types">
                        ${m.types.map(t => `<span class="type-badge ${t} muted">${capitalize(t)}</span>`).join('')}
                    </div>
                </div>
            `);
        } else {
            cells.push(`
                <div class="team-slot empty">
                    <span class="slot-add-icon">+</span>
                    <span class="slot-add-text">Empty</span>
                </div>
            `);
        }
    }
    container.innerHTML = cells.join('');

    container.querySelectorAll('.slot-remove').forEach(b => {
        b.addEventListener('click', e => {
            e.stopPropagation();
            teamRemovePokemon(parseInt(b.dataset.idx, 10));
        });
    });
}

function _renderCoverage() {
    const container = document.getElementById('team-analysis');
    if (!container) return;
    if (_team.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <p>🛡️ เพิ่มโปเกม่อนในทีมเพื่อดูจุดอ่อนรวม</p>
            <p class="empty-hint">วิเคราะห์ matchup โดยอัตโนมัติด้วย ${CHART_ERA_LABEL[activeChartEra()]}</p>
        </div>`;
        return;
    }

    const coverage = teamCoverage(_team);
    const insights = teamInsights(coverage, _team.length);

    const fixes = findCoverageFixes(_team, coverage);
    const patches = findBestPatchTypes(_team, fixes, coverage);
    const topPatchTypes = new Set(patches.slice(0, 3).map(p => p.type));

    const patchHtml = _renderPatchTypesHtml(_team, fixes, coverage);
    const fixesHtml = _renderFixesHtml(_team, fixes, topPatchTypes);

    const insightsHtml = insights.length === 0
        ? `<div class="no-data-state">⚖ ทีมสมดุล — ไม่มี shared weakness หรือ coverage gap ที่ชัดเจน</div>`
        : insights.map(ins => `
            <div class="insight insight-${ins.kind}">
                <span class="insight-icon">${_insightIcon(ins.kind)}</span>
                <span class="insight-msg">${ins.msg}</span>
            </div>
        `).join('');

    const sortedTypes = _sortedActiveTypes(coverage, _covSortMode);
    const tableRows = sortedTypes.map(t => {
        const c = coverage[t];
        const has = (n, cls) => `<td class="cov-cell ${n > 0 ? 'cov-' + cls : 'cov-zero'}">${n || ''}</td>`;
        return `<tr>
            <td><span class="type-badge ${t} muted">${capitalize(t)}</span></td>
            ${has(c.x4, 'x4')}${has(c.x2, 'x2')}${has(c.x1, 'x1')}${has(c.half, 'half')}${has(c.quarter, 'quarter')}${has(c.zero, 'zero')}
        </tr>`;
    }).join('');

    container.innerHTML = `
        ${patchHtml}
        ${fixesHtml}
        <div class="section-block">
            <div class="section-title">💡 Insights
                <span class="data-badge verified">${CHART_ERA_LABEL[activeChartEra()]}</span>
                <span style="font-size:11px;color:var(--text-faint);font-weight:400;">(${_team.length}/${TEAM_MAX} ตัวในทีม)</span>
            </div>
            <div class="insights-list">${insightsHtml}</div>
        </div>
        <div class="section-block">
            <div class="section-title">📊 Coverage table — โจมตีโดย…
                <span class="cov-sort-toggle">
                    <button class="link-btn ${_covSortMode === 'severity' ? 'active' : ''}" data-mode="severity">Sort: severity</button>
                    <button class="link-btn ${_covSortMode === 'type' ? 'active' : ''}" data-mode="type">Sort: type</button>
                </span>
                <button class="link-btn" id="cov-table-toggle">show/hide</button>
            </div>
            <div class="cov-table-wrap" id="cov-table-wrap">
                <table class="cov-table">
                    <thead>
                        <tr>
                            <th>ธาตุโจมตี</th>
                            <th class="cov-x4">4×</th>
                            <th class="cov-x2">2×</th>
                            <th class="cov-x1">1×</th>
                            <th class="cov-half">½×</th>
                            <th class="cov-quarter">¼×</th>
                            <th class="cov-zero">0×</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </div>
    `;

    const toggle = document.getElementById('cov-table-toggle');
    const wrap = document.getElementById('cov-table-wrap');
    toggle?.addEventListener('click', () => {
        wrap.style.display = wrap.style.display === 'none' ? '' : 'none';
    });

    document.querySelectorAll('.cov-sort-toggle button').forEach(btn => {
        btn.addEventListener('click', () => {
            _covSortMode = btn.dataset.mode;
            _renderCoverage();
        });
    });

    // Async: load suggested Pokémon for each patch type
    _renderGen++;
    const gen = _renderGen;
    const dexCap = _currentDexCap();
    const patchTypes = patches.map(p => p.type);
    _suggestionsByPatch = {};   // reset for fresh render
    patches.forEach(async patch => {
        try {
            const result = await findSuggestedPokemon(patch.type, _team, fixes, dexCap);
            if (gen !== _renderGen) return;     // stale; user re-rendered
            const body = document.querySelector(`.patch-suggested[data-patch-type="${patch.type}"] .patch-suggested-body`);
            if (!body) return;
            body.innerHTML = _renderSuggestedHtml(result, patch.type);
            _wireSuggestedItem(body);
            _suggestionsByPatch[patch.type] = result.candidates || [];
            _maybeUpdateMultiFit(patchTypes);
        } catch (e) {
            console.warn('Failed to load suggestions for', patch.type, e);
            _suggestionsByPatch[patch.type] = [];
            _maybeUpdateMultiFit(patchTypes);
        }
    });
}

function _wireSuggestedItem(scope) {
    scope.querySelectorAll('.sug-add-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const variant = btn.dataset.name;
            if (!variant || btn.disabled) return;
            btn.disabled = true;
            btn.textContent = '...';
            const ok = await teamAddPokemon(variant);
            // teamAddPokemon triggers renderTeam → re-renders this whole section,
            // so we don't need to update btn state on success.
            if (!ok) {
                btn.disabled = false;
                btn.textContent = '+ Add';
            }
        });
    });
    scope.querySelectorAll('.sug-detail-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const variant = btn.dataset.name;
            if (!variant) return;
            switchTab('detail');
            if (typeof loadDetailPokemon === 'function') loadDetailPokemon(variant);
        });
    });
}

/* Multi-fit badge: after all patches finish loading, identify Pokémon
 * that appear in suggestions for > 1 patch types and annotate the DOM. */
let _suggestionsByPatch = {};
function _maybeUpdateMultiFit(patchTypes) {
    // All loaded?
    for (const t of patchTypes) {
        if (!(t in _suggestionsByPatch)) return;
    }
    const counts = {};
    for (const t of patchTypes) {
        const list = _suggestionsByPatch[t] || [];
        for (const c of list) {
            counts[c.name] = (counts[c.name] || 0) + 1;
        }
    }
    // Apply badge to all matching DOM items
    document.querySelectorAll('.suggested-item').forEach(item => {
        const name = item.dataset.name;
        if (counts[name] > 1 && !item.querySelector('.multifit-badge')) {
            const badge = document.createElement('span');
            badge.className = 'multifit-badge';
            badge.textContent = '🌟 Multi-fit';
            badge.title = `แนะนำใน ${counts[name]} patches`;
            const nameEl = item.querySelector('.sug-name');
            if (nameEl) nameEl.appendChild(badge);
        }
    });
}

function _insightIcon(kind) {
    return ({
        critical: '🔥',
        pressure: '⚠️',
        noresist: '❌',
        immune:   '🚫',
        covered:  '✅'
    })[kind] || '•';
}

/* ============================================================
 * COVERAGE GAP SUGGESTER
 *
 * For every attacking type that's a problem, produces:
 *   - severity: 3 critical (x4) / 2 high (no-safe + pressure) / 1 medium
 *   - affected members (with their multiplier)
 *   - helper defensive types: single types that immune / resist that attack
 *   - sim hint: "adding {type} gives you 1 more resist / immunity"
 * ============================================================ */

function findCoverageFixes(team, coverage) {
    team = team || _team;
    coverage = coverage || teamCoverage(team);
    if (team.length < 2) return [];

    const half = Math.max(3, Math.ceil(team.length * 0.5));

    const problems = [];
    for (const atk of activeTypes()) {
        const c = coverage[atk];
        const weak = c.x4 + c.x2;
        const resist = c.half + c.quarter + c.zero;
        if (weak === 0) continue;

        let severity = 0;
        const reasons = [];
        if (c.x4 >= 1) {
            severity = Math.max(severity, 3);
            reasons.push(`${c.x4} ตัวรับ 4×`);
            if (c.x2) reasons.push(`${c.x2} ตัวรับ 2×`);
        }
        if (weak > 0 && resist === 0) {
            severity = Math.max(severity, 2);
            reasons.push(`ไม่มีตัวต้าน (no safe switch-in)`);
        }
        if (weak >= half) {
            severity = Math.max(severity, 2);
            if (severity < 3) reasons.push(`${weak}/${team.length} ตัวอ่อนแอ`);
        }
        if (severity === 0 && weak > resist + 1) {
            severity = 1;
            reasons.push(`weak (${weak}) > resist (${resist})`);
        }
        if (severity === 0) continue;

        problems.push({ type: atk, severity, reasons, coverage: c, weak, resist });
    }

    // Sort: critical first, then by x4 count, then weak count
    problems.sort((a, b) =>
        b.severity - a.severity
        || b.coverage.x4 - a.coverage.x4
        || b.weak - a.weak
    );

    return problems.slice(0, 5).map(p => {
        // Helper single types (immune > resist)
        const helpers = [];
        for (const def of activeTypes()) {
            const eff = getEffect(p.type, def);
            if (eff === 0) helpers.push({ type: def, eff, role: 'immune' });
            else if (eff === 0.5) helpers.push({ type: def, eff, role: 'resist' });
        }
        helpers.sort((a, b) => a.eff - b.eff || a.type.localeCompare(b.type));

        // Affected team members (those who take 2× or 4×)
        const affected = team
            .map(m => ({ member: m, eff: getEffectMulti(p.type, m.types) }))
            .filter(a => a.eff >= 2)
            .sort((a, b) => b.eff - a.eff);

        const hasImmuneHelper = helpers.some(h => h.role === 'immune');
        const sim = hasImmuneHelper
            ? `เพิ่มธาตุที่ immune จะปิดจุดอ่อนนี้ได้เลย`
            : `เพิ่ม 1 ตัวธาตุพวกนี้ — resist เพิ่มขึ้น 1 ตัว (จาก ${p.resist} → ${p.resist + 1})`;

        return { ...p, helpers, affected, sim };
    });
}

/* Severity label + class for UI */
function _severityLabel(s) {
    return { 3: 'CRITICAL', 2: 'HIGH', 1: 'MEDIUM' }[s] || '';
}
function _severityClass(s) {
    return { 3: 'sev-critical', 2: 'sev-high', 1: 'sev-medium' }[s] || '';
}

/* ============================================================
 * SUGGESTED POKÉMON (per patch type)
 *
 * For a given patch defensive type T, fetch PokéAPI /type/{T},
 * filter to default forms within current gen cap and not already
 * in the team, fetch top-N candidates' types, score against the
 * current fixes, return top 3.
 *
 * Score = sum over fixes:
 *    +6  if double-resist (¼×)
 *    +4  if immune (0×)
 *    +2  if resist (½×)
 *     0  neutral
 *    -2  weak 2×
 *    -4  weak 4× (exposes new problem)
 *  + bonus +2 if helps >1 problem
 * ============================================================ */

const SUGGEST_POOL_SIZE = 30;
const SUGGEST_RESULT_LIMIT = 3;

function _currentDexCap() {
    const vg = currentVersionGroup();
    return GEN_DEX_CAP[vg.gen] || 1025;
}

/* Walk an evolution chain tree and return whether the target species
 * is a final form (no further evolutions) and the chain ID it belongs
 * to. Returns null if not found. */
function _findInChain(node, target) {
    if (!node) return null;
    if (node.species.name === target) {
        return { isFinal: node.evolves_to.length === 0, evolvesFrom: null };
    }
    for (const child of node.evolves_to) {
        const found = _findInChain(child, target);
        if (found) {
            // If the found node is a child of the current node, the parent is `node`
            if (!found.evolvesFrom && child.species.name === target) {
                return { isFinal: child.evolves_to.length === 0, evolvesFrom: node.species.name };
            }
            return found;
        }
    }
    return null;
}

/* Build a hybrid candidate pool from PokéAPI /type/{type}.pokemon[]:
 *   - all defaults within gen cap, not in team (the "raw" pool)
 *   - then up to 30 picks combining curated + latest + classic */
function _buildCandidatePool(typeData, patchType, dexCap, inTeam) {
    const raw = (typeData.pokemon || [])
        .map(entry => {
            const id = parseInt(extractIdFromUrl(entry.pokemon.url), 10);
            return { name: entry.pokemon.name, id };
        })
        .filter(c => Number.isFinite(c.id) && c.id > 0 && c.id < 10000)
        .filter(c => c.id <= dexCap)
        .filter(c => !inTeam.has(c.name));

    if (raw.length === 0) return [];

    const byName = new Map(raw.map(c => [c.name, c]));
    const curated = (CURATED_PATCH_CANDIDATES[patchType] || [])
        .map(name => byName.get(name))
        .filter(Boolean);
    const latest = raw.slice().sort((a, b) => b.id - a.id).slice(0, 10);
    const classic = raw.slice().sort((a, b) => a.id - b.id).slice(0, 10);

    const pool = new Map();
    for (const c of curated)  if (!pool.has(c.name)) pool.set(c.name, { ...c, source: 'curated' });
    for (const c of latest)   if (!pool.has(c.name)) pool.set(c.name, { ...c, source: 'latest' });
    for (const c of classic)  if (!pool.has(c.name)) pool.set(c.name, { ...c, source: 'classic' });

    return Array.from(pool.values()).slice(0, SUGGEST_POOL_SIZE);
}

/* Fetch /pokemon + /pokemon-species + /evolution-chain for one
 * candidate in parallel; return enriched candidate or null. */
async function _enrichCandidate(c) {
    try {
        const [pokemon, species] = await Promise.all([
            fetchPokemon(c.name),
            fetchSpecies(c.name).catch(() => null)
        ]);
        let isFinal = null;
        let chainId = null;
        if (species && species.evolution_chain?.url) {
            chainId = extractIdFromUrl(species.evolution_chain.url);
            try {
                const chain = await fetchEvolutionChain(species.evolution_chain.url);
                const info = _findInChain(chain.chain, c.name);
                if (info) isFinal = info.isFinal;
            } catch (e) { /* keep null */ }
        }
        return {
            name: pokemon.name,
            baseName: species?.name || pokemon.species.name,
            id: c.id,
            types: pokemon.types.map(t => t.type.name),
            sprite: pokemon.sprites.other?.['official-artwork']?.front_default
                || pokemon.sprites.front_default || '',
            isFinal,
            chainId,
            source: c.source
        };
    } catch (e) { return null; }
}

async function findSuggestedPokemon(patchType, team, fixes, dexCap) {
    team = team || _team;
    fixes = fixes || findCoverageFixes(team);
    dexCap = dexCap || _currentDexCap();

    let typeData;
    try {
        typeData = await apiGet(`/type/${patchType}`);
    } catch (e) {
        if (!navigator.onLine) return { error: 'offline', candidates: [] };
        return { error: 'fetch-failed', candidates: [] };
    }

    const inTeam = new Set();
    team.forEach(m => { inTeam.add(m.name); inTeam.add(m.baseName); });

    const pool = _buildCandidatePool(typeData, patchType, dexCap, inTeam);
    if (pool.length === 0) return { error: 'none', candidates: [] };

    // Fetch pokemon + species + chain for each candidate in parallel
    const enriched = (await Promise.all(pool.map(_enrichCandidate))).filter(Boolean);
    if (enriched.length === 0) return { error: 'fetch-failed', candidates: [] };

    // Filter to final evolutions (or unknown — keep). Fallback to all if
    // nothing remains.
    let workingSet = enriched.filter(c => c.isFinal !== false);
    let fellBackToBasics = false;
    if (workingSet.length === 0) {
        workingSet = enriched;
        fellBackToBasics = true;
    }

    // Score each candidate against current team fixes
    const scored = workingSet.map(c => {
        let score = 0;
        const helps = [];
        const exposes = [];
        for (const p of fixes) {
            const eff = getEffectMulti(p.type, c.types);
            if (eff === 0)         { score += 4; helps.push(p.type); }
            else if (eff === 0.25) { score += 6; helps.push(p.type); }
            else if (eff === 0.5)  { score += 2; helps.push(p.type); }
            else if (eff === 2)    { score -= 2; exposes.push({ type: p.type, eff: 2 }); }
            else if (eff === 4)    { score -= 4; exposes.push({ type: p.type, eff: 4 }); }
        }
        if (helps.length > 1) score += 2;
        // Curated picks get a tiny tiebreaker bump so well-known fits
        // win over equally-scored newcomers without dominating.
        if (c.source === 'curated') score += 0.5;
        return { ...c, score: Math.round(score * 10) / 10, helps, exposes };
    });

    scored.sort((a, b) =>
        b.score - a.score
        || (b.isFinal === true ? 1 : 0) - (a.isFinal === true ? 1 : 0)
        || b.id - a.id
    );

    return {
        error: null,
        fellBackToBasics,
        candidates: scored.slice(0, SUGGEST_RESULT_LIMIT)
    };
}

/* HTML for one suggested-pokemon block (with skeleton/loading state) */
function _renderSuggestedHtml(result, patchType) {
    if (!result) {
        return `<span class="patch-suggested-loading">⏳ กำลังโหลด suggestions...</span>`;
    }
    if (result.error === 'offline') {
        return `<span class="patch-suggested-none">📵 Offline — suggestions for ${capitalize(patchType)} not cached yet</span>`;
    }
    if (result.error === 'fetch-failed') {
        return `<span class="patch-suggested-none">❌ ดึงข้อมูลไม่สำเร็จ</span>`;
    }
    if (result.error === 'none' || result.candidates.length === 0) {
        return `<span class="patch-suggested-none">— ไม่พบโปเกม่อนธาตุ ${capitalize(patchType)} ใน gen นี้</span>`;
    }
    const teamFull = _team.length >= TEAM_MAX;
    const items = result.candidates.map(c => {
        const displayName = prettyPokemonName(c.name, c.baseName);
        const helpsTxt = c.helps.length
            ? `helps <strong>${c.helps.map(capitalize).join(', ')}</strong>`
            : 'no direct help';
        const exposesTxt = c.exposes.length
            ? ` · exposes ${c.exposes.map(x => `${capitalize(x.type)} ${x.eff}×`).join(', ')}`
            : '';
        const addDisabled = teamFull ? 'disabled' : '';
        const addTitle = teamFull ? 'ทีมเต็ม (6 ตัว)' : 'เพิ่มเข้าทีม';
        const curatedMark = c.source === 'curated'
            ? '<span class="sug-curated" title="Common pick">★</span>' : '';
        return `
            <div class="suggested-item" data-name="${c.name}">
                <div class="sug-sprite-wrap">
                    <img class="sug-sprite" src="${c.sprite}" alt="${c.name}" onerror="this.style.opacity=0.2">
                </div>
                <div class="sug-meta">
                    <div class="sug-name">${curatedMark}${displayName}
                        <span class="sug-dex">#${String(c.id).padStart(4, '0')}</span>
                        <span class="sug-score">+${c.score}</span>
                    </div>
                    <div class="sug-types">
                        ${c.types.map(t => `<span class="type-badge ${t} muted">${capitalize(t)}</span>`).join('')}
                    </div>
                    <div class="sug-reason">${helpsTxt}${exposesTxt}</div>
                </div>
                <div class="sug-actions">
                    <button class="sug-add-btn" data-name="${c.name}" ${addDisabled} title="${addTitle}">+ Add</button>
                    <button class="sug-detail-btn" data-name="${c.name}" title="Open Pokémon Detail">Detail</button>
                </div>
            </div>
        `;
    }).join('');

    const fallbackNote = result.fellBackToBasics
        ? '<div class="patch-suggested-fallback">⚠ No final-evolution suggestions found; showing basic type matches</div>'
        : '';

    return `
        <div class="suggested-list">${items}</div>
        ${fallbackNote}
        <div class="patch-suggested-foot">📌 Generation-filtered (≤ #${_currentDexCap()}), prefers final evolutions + curated/common picks. ไม่ได้ verify location/version</div>
    `;
}

/* ============================================================
 * UI render for Best Patch Types section
 * ============================================================ */
function _renderPatchTypesHtml(team, fixes, coverage) {
    if (team.length < 2) {
        return `
            <div class="section-block">
                <div class="section-title">🛡 Best Patch Types</div>
                <div class="no-data-state">เพิ่มสมาชิกอย่างน้อย 2 ตัว เพื่อแนะนำธาตุที่ควรเติม</div>
            </div>
        `;
    }
    if (!fixes || fixes.length === 0) {
        return `
            <div class="section-block">
                <div class="section-title">🛡 Best Patch Types
                    <span class="data-badge verified">${CHART_ERA_LABEL[activeChartEra()]}</span>
                </div>
                <div class="no-data-state">✅ No major patch type needed — ทีมไม่มี shared weakness ที่ต้องเติม</div>
            </div>
        `;
    }
    const patches = findBestPatchTypes(team, fixes, coverage);
    if (patches.length === 0) {
        return `
            <div class="section-block">
                <div class="section-title">🛡 Best Patch Types
                    <span class="data-badge verified">${CHART_ERA_LABEL[activeChartEra()]}</span>
                </div>
                <div class="no-data-state">ไม่พบธาตุเดี่ยวที่ patch ทีมได้ดีในยุคนี้ — ลอง dual-type combos</div>
            </div>
        `;
    }

    const cards = patches.map(p => {
        const dangerWatch = p.watchOut.filter(w => w.severity === 'danger');
        const normalWatch = p.watchOut.filter(w => w.severity === 'normal');
        const helpsHtml = p.helps.map(h =>
            `<span class="patch-help-pill ${h.eff}">
                <span class="type-badge ${h.type} muted">${capitalize(h.type)}</span>
                <span class="eff">${h.eff === 'immune' ? '0×' : '½×'}</span>
            </span>`
        ).join('');
        const dangerHtml = dangerWatch.length
            ? `<div class="patch-watch-line danger">
                <span class="patch-watch-label">⚠ Compound danger:</span>
                ${dangerWatch.map(w => `<span class="type-badge ${w.type} muted">${capitalize(w.type)}</span>`).join('')}
                <span class="patch-watch-note">(ทีมยังไม่มี resist ต่อธาตุนี้)</span>
              </div>`
            : '';
        const normalHtml = normalWatch.length
            ? `<div class="patch-watch-line">
                <span class="patch-watch-label">Watch out 2×:</span>
                ${normalWatch.slice(0, 6).map(w => `<span class="type-badge ${w.type} muted">${capitalize(w.type)}</span>`).join('')}
                ${normalWatch.length > 6 ? `<span class="patch-watch-note">+${normalWatch.length - 6}</span>` : ''}
              </div>`
            : '';

        return `
            <div class="patch-card ${_patchRoleClass(p.score, p.problemsHelped)}">
                <div class="patch-header">
                    <span class="type-badge ${p.type}">${capitalize(p.type)}</span>
                    <span class="patch-role">${_patchRoleLabel(p.score, p.problemsHelped)}</span>
                    <span class="patch-score">${p.score >= 0 ? '+' : ''}${p.score}</span>
                </div>
                <div class="patch-helps-row">
                    <span class="patch-helps-label">✓ Helps ${p.problemsHelped}/${fixes.length} problems:</span>
                    <div class="patch-helps-list">${helpsHtml}</div>
                </div>
                ${dangerHtml}
                ${normalHtml}
                <div class="patch-suggested" data-patch-type="${p.type}">
                    <div class="patch-suggested-title">🎯 Suggested Pokémon</div>
                    <div class="patch-suggested-body">${_renderSuggestedHtml(null, p.type)}</div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="section-block">
            <div class="section-title">🛡 Best Patch Types
                <span class="data-badge verified">${CHART_ERA_LABEL[activeChartEra()]}</span>
                <span style="font-size:11px;color:var(--text-faint);font-weight:400;">(top ${patches.length} จาก ${activeTypes().length} ธาตุ)</span>
            </div>
            <div class="patch-list">${cards}</div>
        </div>
    `;
}

/* ============================================================
 * UI render for fixes section — called inside _renderCoverage
 *
 * topPatchTypes (Set) is used to flag any helper that overlaps
 * with the top-3 Best Patch Types so the user can spot
 * all-round options inline.
 * ============================================================ */
function _renderFixesHtml(team, fixes, topPatchTypes) {
    if (team.length < 2) {
        return `
            <div class="section-block">
                <div class="section-title">🔧 Recommended Fixes</div>
                <div class="no-data-state">เพิ่มสมาชิกอย่างน้อย 2 ตัว เพื่อวิเคราะห์ team gaps</div>
            </div>
        `;
    }
    fixes = fixes || findCoverageFixes(team);
    topPatchTypes = topPatchTypes || new Set();
    if (fixes.length === 0) {
        return `
            <div class="section-block">
                <div class="section-title">🔧 Recommended Fixes
                    <span class="data-badge verified">${CHART_ERA_LABEL[activeChartEra()]}</span>
                </div>
                <div class="no-data-state">⚖ ไม่พบ shared weakness หรือ coverage gap ที่ต้องแก้ — ทีมสมดุลดี</div>
            </div>
        `;
    }
    const cards = fixes.map(f => `
        <div class="fix-card ${_severityClass(f.severity)}">
            <div class="fix-header">
                <span class="severity-badge ${_severityClass(f.severity)}">${_severityLabel(f.severity)}</span>
                <div class="fix-title">
                    <span class="type-badge ${f.type}">${capitalize(f.type)}</span>
                    <span class="fix-reasons">${f.reasons.join(' · ')}</span>
                </div>
            </div>
            <div class="fix-affected">
                <span class="fix-label">Affected:</span>
                ${f.affected.map(a => `
                    <span class="affected-member ${a.eff === 4 ? 'crit' : ''}">
                        ${prettyPokemonName(a.member.name, a.member.baseName)} <strong>${a.eff}×</strong>
                    </span>
                `).join('')}
            </div>
            <div class="fix-helpers">
                <span class="fix-label">เพิ่มธาตุพวกนี้:</span>
                <div class="helper-list">
                    ${f.helpers.length === 0
                        ? '<span class="none-text">— ไม่มีธาตุเดี่ยวที่ช่วยได้ในยุคนี้ —</span>'
                        : f.helpers.map(h => {
                            const isTopPatch = topPatchTypes.has(h.type);
                            return `
                                <span class="helper-tag ${h.role} ${isTopPatch ? 'top-patch' : ''}">
                                    <span class="type-badge ${h.type} muted">${capitalize(h.type)}</span>
                                    <span class="helper-role">${h.role === 'immune' ? 'immune' : '½×'}</span>
                                    ${isTopPatch ? '<span class="top-patch-badge" title="Top patch type — ช่วยหลายปัญหาพร้อมกัน">★ Top</span>' : ''}
                                </span>
                            `;
                          }).join('')
                    }
                </div>
            </div>
            <div class="fix-sim">💡 ${f.sim}</div>
        </div>
    `).join('');

    return `
        <div class="section-block">
            <div class="section-title">🔧 Recommended Fixes
                <span class="data-badge verified">${CHART_ERA_LABEL[activeChartEra()]}</span>
                <span style="font-size:11px;color:var(--text-faint);font-weight:400;">(${fixes.length} gap${fixes.length > 1 ? 's' : ''})</span>
            </div>
            <div class="fixes-list">${cards}</div>
        </div>
    `;
}

/* ============================================================
 * BEST PATCH TYPES
 *
 * Score every defensive single-type by how much it helps the
 * current team's problems vs how much new exposure it introduces.
 *
 *   helps      = list of {attackerType, eff: 'immune'|'resist'}
 *   watchOut   = list of {attackerType, severity: 'danger'|'normal'}
 *                'danger' = an attacker the team has no resist for already,
 *                so the patch type's new weakness would compound.
 *
 * Score components:
 *   +4 × sevMul  per immune match against a problem
 *   +2 × sevMul  per resist match
 *   -2 × sevMul  per 2× weakness against a problem (rare for single types)
 *   -4 × sevMul  per 4× weakness against a problem (impossible for single)
 *   +1           bonus per additional problem helped (>1)
 *   -1.5         per "danger" new weakness (attacker the team can't resist)
 *
 *   sevMul = 1.5 critical / 1.25 high / 1.0 medium
 * ============================================================ */

const _PATCH_SEV_MUL = { 3: 1.5, 2: 1.25, 1: 1.0 };

function findBestPatchTypes(team, fixes, coverage) {
    team = team || _team;
    if (team.length < 2) return [];
    coverage = coverage || teamCoverage(team);
    fixes = fixes || findCoverageFixes(team, coverage);
    if (fixes.length === 0) return [];

    // Which attacker types does the team already lack coverage for?
    // Used to penalize patch types that expose new vulnerabilities to those.
    const dangerAtkTypes = new Set();
    for (const t of activeTypes()) {
        const c = coverage[t];
        const weak = c.x4 + c.x2;
        const resist = c.half + c.quarter + c.zero;
        if (weak > 0 && resist === 0) dangerAtkTypes.add(t);
    }

    const scored = activeTypes().map(T => {
        let score = 0;
        const helps = [];
        const watchOut = [];
        let problemsHelped = 0;

        for (const p of fixes) {
            const eff = getEffect(p.type, T);
            const mul = _PATCH_SEV_MUL[p.severity] || 1;
            if (eff === 0)        { score += 4 * mul; helps.push({ type: p.type, eff: 'immune', sev: p.severity }); problemsHelped++; }
            else if (eff === 0.5) { score += 2 * mul; helps.push({ type: p.type, eff: 'resist', sev: p.severity }); problemsHelped++; }
            else if (eff === 2)   { score -= 2 * mul; }
            else if (eff === 4)   { score -= 4 * mul; }
        }

        if (problemsHelped > 1) score += (problemsHelped - 1);

        // Defensive weaknesses introduced by this type
        for (const T2 of activeTypes()) {
            const eff = getEffect(T2, T);
            if (eff >= 2) {
                const isDanger = dangerAtkTypes.has(T2);
                if (isDanger) score -= 1.5;
                watchOut.push({ type: T2, severity: isDanger ? 'danger' : 'normal' });
            }
        }

        return { type: T, score: Math.round(score * 10) / 10, helps, watchOut, problemsHelped };
    });

    scored.sort((a, b) => b.score - a.score || b.problemsHelped - a.problemsHelped || a.type.localeCompare(b.type));

    return scored.filter(s => s.problemsHelped > 0 && s.score > 0).slice(0, 5);
}

function _patchRoleLabel(score, problemsHelped) {
    if (score >= 7 && problemsHelped >= 3) return 'Best all-round patch';
    if (score >= 4) return 'Strong defensive patch';
    return 'Niche fix';
}

function _patchRoleClass(score, problemsHelped) {
    if (score >= 7 && problemsHelped >= 3) return 'role-best';
    if (score >= 4) return 'role-strong';
    return 'role-niche';
}

/* Sort attacker types by severity (descending) for the coverage table */
function _sortedActiveTypes(coverage, mode) {
    const types = activeTypes().slice();
    if (mode === 'severity') {
        types.sort((a, b) => {
            const ca = coverage[a], cb = coverage[b];
            const sevA = ca.x4 * 10 + ca.x2;
            const sevB = cb.x4 * 10 + cb.x2;
            return sevB - sevA || a.localeCompare(b);
        });
    }
    return types;
}

let _covSortMode = 'severity';   // 'severity' | 'type'
let _renderGen = 0;              // bumped on every coverage render; used to
                                 // ignore stale suggestion fetches after
                                 // team/era changes.
