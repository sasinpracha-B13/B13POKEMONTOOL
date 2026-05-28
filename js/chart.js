/* ============================================================
 * TYPE CHART: full matrix table
 * ============================================================ */

function renderTypeChart() {
    const table = document.getElementById('type-chart');
    if (!table) return;

    let html = '<thead><tr>';
    html += `<th class="corner">
        <div class="corner-grid">
            <span class="def-label">▶ Defender (ตัวรับ)</span>
            <span class="atk-label">▼ Attacker (ตัวโจมตี)</span>
        </div>
    </th>`;

    // Top header: defender types
    for (const t of TYPES) {
        html += `<th class="type-cell" style="background:var(--t-${t})" data-type="${t}" data-axis="def" title="${TYPE_NAMES_TH[t]}">${capitalize(t)}</th>`;
    }
    html += '</tr></thead><tbody>';

    // Rows: attacker types
    for (const atk of TYPES) {
        html += '<tr data-row="' + atk + '">';
        html += `<th class="type-cell" style="background:var(--t-${atk})" data-type="${atk}" data-axis="atk" title="${TYPE_NAMES_TH[atk]}">${capitalize(atk)}</th>`;
        for (const def of TYPES) {
            const eff = getEffect(atk, def);
            let cls = 'eff', txt = '';
            if (eff === 2)        { cls += ' x2';   txt = '2×'; }
            else if (eff === 0.5) { cls += ' half'; txt = '½×'; }
            else if (eff === 0)   { cls += ' zero'; txt = '0×'; }
            html += `<td class="${cls}" data-col="${def}">${txt}</td>`;
        }
        html += '</tr>';
    }
    html += '</tbody>';
    table.innerHTML = html;

    // Click to highlight row/column
    table.querySelectorAll('.type-cell[data-axis]').forEach(cell => {
        cell.addEventListener('click', () => toggleChartHighlight(cell));
    });
}

let _chartHighlight = null;

function toggleChartHighlight(cell) {
    const table = document.getElementById('type-chart');
    const type = cell.dataset.type;
    const axis = cell.dataset.axis;
    const key = axis + ':' + type;

    // Remove all highlights
    table.querySelectorAll('.type-cell.highlight').forEach(c => c.classList.remove('highlight'));
    table.querySelectorAll('.row-dim').forEach(r => r.classList.remove('row-dim'));
    table.querySelectorAll('.col-dim').forEach(r => r.classList.remove('col-dim'));

    if (_chartHighlight === key) {
        _chartHighlight = null;
        return;
    }
    _chartHighlight = key;

    cell.classList.add('highlight');

    if (axis === 'atk') {
        // Dim rows other than this attacker
        table.querySelectorAll('tbody tr').forEach(tr => {
            if (tr.dataset.row !== type) tr.classList.add('row-dim');
        });
    } else {
        // Dim cells/headers in columns other than this defender
        // Top-row defender headers
        table.querySelectorAll('thead .type-cell[data-axis="def"]').forEach(th => {
            if (th.dataset.type !== type) th.classList.add('col-dim');
        });
        // Effect cells
        table.querySelectorAll('tbody td[data-col]').forEach(td => {
            if (td.dataset.col !== type) td.classList.add('col-dim');
        });
    }
}
