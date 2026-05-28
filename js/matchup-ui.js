/* ============================================================
 * SHARED MATCHUP UI — Battle-first card
 *
 * Layout priority (top to bottom):
 *   1. TL;DR strip          — fastest read during battle
 *   2. ⚔️ USE these attacks  — 4× and 2× ranked
 *   3. ⛔ AVOID these         — 0× (immune), ¼×, ½×
 *   4. 🛡️ Defensive summary  — full picture (compact)
 *
 * 4× weakness and 0× immunity get critical visual emphasis.
 * ============================================================ */

function _badge(t)        { return `<span class="type-badge ${t} muted">${capitalize(t)}</span>`; }
function _badgeList(arr)  {
    if (!arr || arr.length === 0) return '<span class="none-text">— ไม่มี —</span>';
    return arr.map(_badge).join('');
}

/* TL;DR — single-line summary of the most useful info */
function _renderTldr(m) {
    const tipsUse = [];
    if (m.x4.length) tipsUse.push(`ใช้ <strong class="acc-good">${m.x4.map(capitalize).join(', ')} (4×)</strong>`);
    else if (m.x2.length) tipsUse.push(`ใช้ <strong class="acc-good">${m.x2.slice(0, 3).map(capitalize).join(', ')} (2×)</strong>`);

    const tipsAvoid = [];
    if (m.zero.length) tipsAvoid.push(`<strong class="acc-bad">อิมูน ${m.zero.map(capitalize).join(', ')}</strong>`);
    if (m.quarter.length && tipsAvoid.length === 0) tipsAvoid.push(`ทนมาก ¼×: ${m.quarter.map(capitalize).join(', ')}`);

    const parts = [...tipsUse, ...tipsAvoid].filter(Boolean);
    if (parts.length === 0) return `<span class="tldr-empty">ไม่มีจุดเด่น matchup — ใช้ STAB ปกติได้</span>`;
    return `<span class="tldr-icon">💡</span> ${parts.join(' • ')}`;
}

/* ⚔️ USE — best attacks (4× and 2×) */
function _renderUseSection(m) {
    return `
        <div class="bcard-section section-use">
            <div class="bcard-header">
                <span class="bcard-title">⚔️ Attack with — ใช้ธาตุพวกนี้ตี</span>
                <span class="bcard-sub">เรียงจากดีที่สุด</span>
            </div>
            <div class="bcard-row tier-4x ${m.x4.length ? 'has-data' : 'empty'}">
                <span class="tier-chip atk4">4×</span>
                <span class="tier-label">Super-effective×2</span>
                <div class="tier-badges">${_badgeList(m.x4)}</div>
            </div>
            <div class="bcard-row tier-2x">
                <span class="tier-chip atk2">2×</span>
                <span class="tier-label">Super effective</span>
                <div class="tier-badges">${_badgeList(m.x2)}</div>
            </div>
        </div>
    `;
}

/* ⛔ AVOID — resisted and immune */
function _renderAvoidSection(m) {
    return `
        <div class="bcard-section section-avoid">
            <div class="bcard-header">
                <span class="bcard-title">⛔ Avoid — เลี่ยงใช้ธาตุพวกนี้ตี</span>
                <span class="bcard-sub">โดนทน หรือ ไม่เข้า</span>
            </div>
            <div class="bcard-row tier-0 ${m.zero.length ? 'has-data' : 'empty'}">
                <span class="tier-chip zero">0×</span>
                <span class="tier-label">อิมูน — ไม่เข้าเลย</span>
                <div class="tier-badges">${_badgeList(m.zero)}</div>
            </div>
            <div class="bcard-row tier-025">
                <span class="tier-chip quarter">¼×</span>
                <span class="tier-label">ทนมาก</span>
                <div class="tier-badges">${_badgeList(m.quarter)}</div>
            </div>
            <div class="bcard-row tier-05">
                <span class="tier-chip half">½×</span>
                <span class="tier-label">ทน</span>
                <div class="tier-badges">${_badgeList(m.half)}</div>
            </div>
        </div>
    `;
}

/* 🛡️ Defensive summary — compact line-format */
function _renderDefenseSummary(m) {
    const fmt = (label, arr) => arr.length ? `<div class="def-line"><span class="def-label">${label}</span><div class="def-badges">${_badgeList(arr)}</div></div>` : '';
    return `
        <div class="bcard-section section-defense">
            <div class="bcard-header">
                <span class="bcard-title">🛡️ Defensive — เมื่อตัวนี้โดนตี</span>
            </div>
            ${fmt('<span class="mult-chip x4">4×</span> โดนหนักมาก', m.x4)}
            ${fmt('<span class="mult-chip x2">2×</span> โดนหนัก', m.x2)}
            ${fmt('<span class="mult-chip half">½×</span> ทน', m.half)}
            ${fmt('<span class="mult-chip quarter">¼×</span> ทนมาก', m.quarter)}
            ${fmt('<span class="mult-chip zero">0×</span> ไม่เข้า', m.zero)}
        </div>
    `;
}

/* Full matchup body — used by Quick Lookup, Type Calc, and Detail */
function renderMatchupBody(types) {
    const m = analyzeMatchups(types);
    const outsideEra = defenderHasTypeOutsideEra(types);
    const eraWarn = outsideEra
        ? `<div class="warn-banner" style="margin:0 22px 12px;">⚠ Pokémon นี้มีธาตุที่ไม่มีในยุค ${CHART_ERA_LABEL[activeChartEra()]} — ผลคำนวณอาจไม่สมเหตุสมผล</div>`
        : '';
    return `
        ${eraWarn}
        <div class="battle-card">
            <div class="tldr">${_renderTldr(m)}</div>
            ${_renderUseSection(m)}
            ${_renderAvoidSection(m)}
            ${_renderDefenseSummary(m)}
        </div>
    `;
}

/* Type badges (un-muted) for the header row */
function renderTypeBadges(types) {
    return types.map(t => `<span class="type-badge ${t}">${capitalize(t)}</span>`).join('');
}
