/* ============================================================
 * TYPE CALCULATOR (manual)
 * User picks 1-2 types → see same matchup card as Quick Lookup.
 * 100% static — works offline.
 * ============================================================ */

let _calcType1 = null;
let _calcType2 = null;

function initCalc() {
    _renderCalcPickers();
    _updateCalcResult();

    document.getElementById('clear-type-2').addEventListener('click', () => {
        _calcType2 = null;
        _refreshCalcSelection();
        _updateCalcResult();
    });
}

function _renderCalcPickers() {
    _renderTypePicker('type-picker-1', t => {
        _calcType1 = (_calcType1 === t) ? null : t;
        // If type 2 same as new type 1, clear it
        if (_calcType2 === _calcType1) _calcType2 = null;
        _refreshCalcSelection();
        _updateCalcResult();
    });
    _renderTypePicker('type-picker-2', t => {
        if (t === _calcType1) return; // can't pick same as type 1
        _calcType2 = (_calcType2 === t) ? null : t;
        _refreshCalcSelection();
        _updateCalcResult();
    });
}

function _renderTypePicker(containerId, onClick) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = '';
    TYPES.forEach(t => {
        const b = document.createElement('span');
        b.className = 'type-badge ' + t;
        b.dataset.type = t;
        b.textContent = capitalize(t);
        b.addEventListener('click', () => onClick(t));
        c.appendChild(b);
    });
}

function _refreshCalcSelection() {
    document.querySelectorAll('#type-picker-1 .type-badge').forEach(b => {
        b.classList.toggle('selected', b.dataset.type === _calcType1);
    });
    document.querySelectorAll('#type-picker-2 .type-badge').forEach(b => {
        b.classList.toggle('selected', b.dataset.type === _calcType2);
        // Hide the badge from picker-2 if it matches picker-1
        b.style.display = (b.dataset.type === _calcType1) ? 'none' : '';
    });
}

function _updateCalcResult() {
    const result = document.getElementById('calc-result');
    if (!_calcType1) {
        result.innerHTML = `<div class="empty-state">
            <p>🎯 เลือก Type 1 ด้านบนเพื่อดูผล matchup</p>
            <p class="empty-hint">เลือก Type 2 เพิ่ม ถ้าโปเกม่อนเป็นธาตุคู่</p>
        </div>`;
        return;
    }

    const types = _calcType2 ? [_calcType1, _calcType2] : [_calcType1];

    result.innerHTML = `
        <div class="quick-card">
            <div class="quick-header">
                <div class="quick-meta" style="grid-column: 1 / -1;">
                    <div class="dex-num">ธาตุที่เลือก</div>
                    <h3 style="margin-top:6px;">${types.map(capitalize).join(' / ')}</h3>
                    <div class="types" style="margin-top:8px;">${renderTypeBadges(types)}</div>
                </div>
            </div>
            ${renderMatchupBody(types)}
            <div class="quick-footer">
                <div class="meta-info">🧮 คำนวณจาก static type chart · ${CHART_ERA_LABEL[activeChartEra()]}</div>
            </div>
        </div>
    `;
}
