/* ============================================================
 * NATURE GRID
 * ============================================================ */

function renderNatures() {
    const grid = document.getElementById('nature-grid');
    if (!grid) return;
    grid.innerHTML = NATURES.map(n => {
        const isNeutral = !n.up && !n.down;
        const cls = 'nature-card ' + (isNeutral ? 'neutral' : 'boost');
        const body = isNeutral
            ? '<div class="nature-neutral">ไม่มีผลต่อสเตตัส (Neutral)</div>'
            : `
                <div class="nature-effect">
                    <span class="nature-up">▲ +10% ${STAT_LABELS[n.up]}</span>
                    <span class="nature-down">▼ −10% ${STAT_LABELS[n.down]}</span>
                </div>
            `;
        return `
            <div class="${cls}">
                <div class="nature-name">${n.name}</div>
                ${body}
            </div>
        `;
    }).join('');
}
