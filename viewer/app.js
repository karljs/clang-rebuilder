// Rebuild Experiments Report Viewer

const DATA_BASE_URL = './data';
const SQL_JS_CDN = 'https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/';

let sqlDb = null;
let batches = [];
let currentBatch = null;
let currentBatchData = null;
let sortColumn = 'package';
let sortDirection = 'asc';

function el(id) { return document.getElementById(id); }

// ── SQL helper ──

function dbQuery(sql, params) {
    var stmt = sqlDb.prepare(sql);
    if (params) stmt.bind(params);
    var rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

// ── Custom dropdown helpers ──

function initDropdown(containerId, onChange) {
    var dd = el(containerId);
    if (!dd) return;
    var toggle = dd.querySelector('.dropdown-toggle');
    var menu = dd.querySelector('.dropdown-menu');

    toggle.addEventListener('click', function(e) {
        e.stopPropagation();
        document.querySelectorAll('.dropdown.open').forEach(function(d) {
            if (d !== dd) d.classList.remove('open');
        });
        dd.classList.toggle('open');
    });

    menu.addEventListener('click', function(e) {
        var li = e.target.closest('li');
        if (!li) return;
        e.stopPropagation();
        var val = li.getAttribute('data-value');
        toggle.textContent = li.textContent;
        dd.dataset.value = val;
        menu.querySelectorAll('li').forEach(function(item) {
            item.classList.toggle('selected', item === li);
        });
        dd.classList.remove('open');
        if (onChange) onChange(val);
    });
}

function setDropdownOptions(containerId, options) {
    var dd = el(containerId);
    if (!dd) return;
    var menu = dd.querySelector('.dropdown-menu');
    var toggle = dd.querySelector('.dropdown-toggle');
    menu.innerHTML = options.map(function(o, i) {
        return '<li data-value="' + escapeAttr(o.value) + '"' + (i === 0 ? ' class="selected"' : '') + '>' + escapeHtml(o.label) + '</li>';
    }).join('');
    if (options.length > 0) {
        toggle.textContent = options[0].label;
        dd.dataset.value = options[0].value;
    }
}

function getDropdownValue(containerId) {
    var dd = el(containerId);
    return dd ? (dd.dataset.value || '') : '';
}

document.addEventListener('click', function() {
    document.querySelectorAll('.dropdown.open').forEach(function(d) {
        d.classList.remove('open');
    });
});

// ── Init ──

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

async function init() {
    try {
        var SQL = await initSqlJs({ locateFile: function(f) { return SQL_JS_CDN + f; } });
        var buf = await fetch(DATA_BASE_URL + '/rebuild.db').then(function(r) {
            if (!r.ok) throw new Error('rebuild.db not found — run: rebuild-pipeline export');
            return r.arrayBuffer();
        });
        sqlDb = new SQL.Database(new Uint8Array(buf));

        var overlay = el('loading-overlay');
        if (overlay) overlay.classList.add('hidden');

        loadBatches();
        setupEventListeners();
        if (batches.length > 0) selectBatch(batches[0].id);
    } catch (err) {
        console.error('Init failed:', err);
        var overlay = el('loading-overlay');
        if (overlay) overlay.innerHTML = '<p class="load-error">Failed to load database: ' + escapeHtml(String(err.message || err)) + '</p>';
    }
}

// ── Data loading ──

function loadBatches() {
    var batchRows = dbQuery(
        "SELECT id, name, compiler_type, compiler_version, series, profile_name, started_at, finished_at " +
        "FROM batches ORDER BY started_at DESC"
    );

    // All batch stats in one query instead of one per batch.
    var statRows = dbQuery(
        "SELECT batch_id, status, COUNT(*) AS count FROM builds GROUP BY batch_id, status"
    );
    var statsMap = {};
    for (var i = 0; i < statRows.length; i++) {
        var r = statRows[i];
        if (!statsMap[r.batch_id]) {
            statsMap[r.batch_id] = { total: 0, succeeded: 0, failed: 0, dep_wait: 0, timeout: 0 };
        }
        var s = statsMap[r.batch_id];
        var count = Number(r.count);
        s.total += count;
        if (r.status === 'succeeded') s.succeeded = count;
        else if (r.status === 'failed') s.failed = count;
        else if (r.status === 'dep_wait') s.dep_wait = count;
        else if (r.status === 'timeout') s.timeout = count;
    }

    batches = batchRows.map(function(row) {
        return {
            id: row.id,
            name: row.name,
            compiler_type: row.compiler_type,
            compiler_version: row.compiler_version,
            series: row.series,
            profile_name: row.profile_name,
            started_at: row.started_at,
            finished_at: row.finished_at,
            stats: statsMap[row.id] || { total: 0, succeeded: 0, failed: 0, dep_wait: 0, timeout: 0 }
        };
    });

    setDropdownOptions('batch-select-dd', batches.map(function(b) {
        return { value: b.id, label: b.name + ' (' + b.stats.succeeded + '/' + b.stats.total + ')' };
    }));
    var compareOpts = batches.map(function(b) { return { value: b.id, label: b.name }; });
    setDropdownOptions('compare-batch-a-dd', compareOpts);
    setDropdownOptions('compare-batch-b-dd', compareOpts);
}

function loadBatchData(batchId) {
    var buildRows = dbQuery(
        "SELECT id, source_package AS package, version, status, " +
        "build_duration_seconds AS duration_seconds, peak_memory_mb " +
        "FROM builds WHERE batch_id = ? ORDER BY source_package",
        [batchId]
    );

    // Finding counts for all builds in this batch in one query.
    var countRows = dbQuery(
        "SELECT build_id, COUNT(*) AS count FROM build_findings " +
        "WHERE build_id IN (SELECT id FROM builds WHERE batch_id = ?) " +
        "GROUP BY build_id",
        [batchId]
    );
    var countMap = {};
    for (var i = 0; i < countRows.length; i++) {
        countMap[countRows[i].build_id] = Number(countRows[i].count);
    }

    var summaryRows = dbQuery(
        "SELECT bf.category, COUNT(*) AS count " +
        "FROM build_findings bf JOIN builds b ON bf.build_id = b.id " +
        "WHERE b.batch_id = ? GROUP BY bf.category ORDER BY count DESC",
        [batchId]
    );

    return {
        builds: buildRows.map(function(row) {
            return {
                id: row.id,
                package: row.package,
                version: row.version,
                status: row.status,
                duration_seconds: row.duration_seconds,
                peak_memory_mb: row.peak_memory_mb,
                finding_count: countMap[row.id] || 0
            };
        }),
        finding_summary: summaryRows.map(function(row) {
            return { category: row.category, count: Number(row.count) };
        })
    };
}

function selectBatch(batchId) {
    currentBatch = batches.find(function(b) { return b.id === batchId; });
    if (!currentBatch) return;
    currentBatchData = loadBatchData(batchId);
    renderStatusBar();
    renderFindings();
    renderBuildsTable();
}

// ── Event listeners ──

function setupEventListeners() {
    initDropdown('batch-select-dd', function(val) { selectBatch(val); });
    initDropdown('status-filter-dd', function() { renderBuildsTable(); });
    initDropdown('compare-batch-a-dd');
    initDropdown('compare-batch-b-dd');

    var cb = el('compare-btn');
    if (cb) cb.addEventListener('click', function() {
        el('single-view').classList.add('hidden');
        el('compare-view').classList.remove('hidden');
    });

    var ec = el('exit-compare');
    if (ec) ec.addEventListener('click', function() {
        el('compare-view').classList.add('hidden');
        el('single-view').classList.remove('hidden');
    });

    var rc = el('run-compare');
    if (rc) rc.addEventListener('click', runComparison);

    var fi = el('filter-input');
    if (fi) fi.addEventListener('input', renderBuildsTable);

    var mc = el('modal-close');
    if (mc) mc.addEventListener('click', closeModal);
    var lmc = el('log-modal-close');
    if (lmc) lmc.addEventListener('click', closeLogModal);

    var m = el('modal');
    if (m) m.addEventListener('click', function(e) { if (e.target === this) closeModal(); });
    var lm = el('log-modal');
    if (lm) lm.addEventListener('click', function(e) { if (e.target === this) closeLogModal(); });

    document.querySelectorAll('th[data-sort]').forEach(function(th) {
        th.addEventListener('click', function() { handleSort(this.dataset.sort); });
    });

    var ls = el('log-search');
    if (ls) ls.addEventListener('input', handleLogSearch);

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            var logModal = el('log-modal');
            var modal = el('modal');
            if (logModal && !logModal.classList.contains('hidden')) { closeLogModal(); return; }
            if (modal && !modal.classList.contains('hidden')) { closeModal(); return; }
            var cv = el('compare-view');
            if (cv && !cv.classList.contains('hidden')) {
                cv.classList.add('hidden');
                el('single-view').classList.remove('hidden');
            }
        }
    });
}

function closeModal() {
    var m = el('modal');
    if (m) m.classList.add('hidden');
}

function closeLogModal() {
    var lm = el('log-modal');
    if (lm) lm.classList.add('hidden');
}

// ── Render ──

function renderStatusBar() {
    var b = currentBatch;
    var s = b.stats;
    var rate = s.total > 0 ? ((s.succeeded / s.total) * 100).toFixed(0) : 0;
    var started = new Date(b.started_at).toLocaleString();

    var totalSecs = 0;
    if (currentBatchData && currentBatchData.builds) {
        for (var i = 0; i < currentBatchData.builds.length; i++) {
            totalSecs += currentBatchData.builds[i].duration_seconds || 0;
        }
    }

    var sb = el('status-bar');
    if (sb) sb.innerHTML =
        '<span class="s-pass">' + s.succeeded + ' passed</span>' +
        '<span class="s-fail">' + s.failed + ' failed</span>' +
        (s.timeout > 0 ? '<span class="s-timeout">' + s.timeout + ' timeout</span>' : '') +
        (s.dep_wait > 0 ? '<span class="s-depwait">' + s.dep_wait + ' dep-wait</span>' : '') +
        '<span>' + s.total + ' total</span>' +
        '<span><span class="rate-bar"><span class="rate-fill" style="width:' + rate + '%"></span></span> ' + rate + '%</span>' +
        '<span>' + fmtDuration(totalSecs) + ' total build time</span>';

    var bi = el('batch-info');
    if (bi) bi.textContent = b.compiler_type + ' ' + b.compiler_version + ' \u00b7 ' + b.series + ' \u00b7 ' + started;
}

function renderFindings() {
    var fc = el('findings-content');
    if (!fc) return;

    var findings = (currentBatchData && currentBatchData.finding_summary) || [];

    var unanalyzed = 0;
    if (currentBatchData && currentBatchData.builds) {
        for (var i = 0; i < currentBatchData.builds.length; i++) {
            var build = currentBatchData.builds[i];
            if (build.status !== 'succeeded' && !build.finding_count) unanalyzed++;
        }
    }

    if (findings.length === 0 && unanalyzed === 0) {
        fc.innerHTML = '<p class="muted">No issues in this batch.</p>';
        return;
    }

    var total = 0;
    for (var i = 0; i < findings.length; i++) total += findings[i].count;

    var html = '';
    for (var i = 0; i < findings.length; i++) {
        var f = findings[i];
        html += '<div class="findings-bar-item">' +
            '<span class="findings-bar-count">' + f.count + '</span>' +
            '<span class="findings-bar-label" title="' + escapeHtml(f.category) + '">' + escapeHtml(f.category) + '</span>' +
            '</div>';
    }
    if (unanalyzed > 0) {
        html += '<div class="findings-bar-item findings-bar-unanalyzed">' +
            '<span class="findings-bar-count">' + unanalyzed + '</span>' +
            '<span class="findings-bar-label">Unanalyzed (build failed before analysis)</span>' +
            '</div>';
        total += unanalyzed;
    }
    html = '<p class="muted" style="margin-bottom:6px">' + total + ' issues across ' + (findings.length + (unanalyzed > 0 ? 1 : 0)) + ' categories</p>' + html;
    fc.innerHTML = html;
}

function diffsCell(b) {
    if (b.finding_count > 0) return String(b.finding_count);
    if (b.status === 'succeeded') return '<span class="cell-hint" data-hint="Build succeeded with no issues detected">0</span>';
    if (b.status === 'failed' || b.status === 'timeout' || b.status === 'dep_wait')
        return '<span class="cell-hint" data-hint="Build did not complete; no analysis was performed">n/a</span>';
    return '-';
}

function renderBuildsTable() {
    if (!currentBatchData) return;
    var tbody = el('builds-tbody');
    if (!tbody) return;

    var builds = currentBatchData.builds.slice();
    var fi = el('filter-input');
    var filt = fi ? fi.value.toLowerCase() : '';
    var statFilt = getDropdownValue('status-filter-dd');

    builds = builds.filter(function(b) {
        if (filt && b.package.toLowerCase().indexOf(filt) === -1) return false;
        if (statFilt && b.status !== statFilt) return false;
        return true;
    });

    builds.sort(function(a, b) {
        var av, bv;
        switch (sortColumn) {
            case 'package':  av = a.package;           bv = b.package;           break;
            case 'status':   av = a.status;            bv = b.status;            break;
            case 'duration': av = a.duration_seconds || 0; bv = b.duration_seconds || 0; break;
            case 'memory':   av = a.peak_memory_mb || 0;   bv = b.peak_memory_mb || 0;   break;
            case 'findings': av = a.finding_count || 0;    bv = b.finding_count || 0;    break;
            default:         av = a.package;           bv = b.package;
        }
        if (typeof av === 'string') {
            return sortDirection === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        return sortDirection === 'asc' ? av - bv : bv - av;
    });

    document.querySelectorAll('th[data-sort]').forEach(function(th) {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === sortColumn) {
            th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    });

    var html = '';
    for (var i = 0; i < builds.length; i++) {
        var b = builds[i];
        html += '<tr>' +
            '<td><span class="pkg-name">' + escapeHtml(b.package) + '</span></td>' +
            '<td><span class="st st-' + b.status + '">' + b.status + '</span></td>' +
            '<td class="num mono">' + (b.duration_seconds ? fmtDuration(b.duration_seconds) : '-') + '</td>' +
            '<td class="num mono">' + (b.peak_memory_mb ? b.peak_memory_mb + ' MB' : '-') + '</td>' +
            '<td class="num">' + diffsCell(b) + '</td>' +
            '<td>' +
                (b.finding_count > 0 ? '<button class="btn-link" data-action="details" data-id="' + b.id + '">details</button> ' : '') +
                '<button class="btn-link" data-action="log" data-id="' + b.id + '" data-pkg="' + escapeAttr(b.package) + '">log</button>' +
            '</td>' +
            '</tr>';
    }
    tbody.innerHTML = html;
}

document.addEventListener('click', function(e) {
    if (e.target.closest('.dropdown')) return;
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    var id = btn.getAttribute('data-id');
    if (action === 'details') showBuildDetails(id);
    if (action === 'log') showBuildLog(id, btn.getAttribute('data-pkg'));
});

function handleSort(col) {
    if (sortColumn === col) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = col;
        sortDirection = 'asc';
    }
    renderBuildsTable();
}

function fmtDuration(s) {
    if (s < 60) return Math.round(s) + 's';
    var m = Math.floor(s / 60);
    var sec = Math.round(s % 60);
    if (m < 60) return m + 'm' + (sec > 0 ? sec + 's' : '');
    var h = Math.floor(m / 60);
    var rm = m % 60;
    return h + 'h' + (rm > 0 ? rm + 'm' : '');
}

function escapeHtml(text) {
    var d = document.createElement('div');
    d.textContent = String(text);
    return d.innerHTML;
}

function escapeAttr(text) {
    return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
}

// ── Build details modal ──

function showBuildDetails(buildId) {
    var findings = dbQuery(
        "SELECT category, description, excerpt, line_number " +
        "FROM build_findings WHERE build_id = ? ORDER BY line_number",
        [buildId]
    );

    var packageName = '';
    if (currentBatchData) {
        var build = currentBatchData.builds.find(function(b) { return b.id === buildId; });
        if (build) packageName = build.package;
    }

    var mt = el('modal-title');
    var mb = el('modal-body');
    if (mt) mt.textContent = packageName + ' \u2014 Findings';

    if (findings.length === 0) {
        if (mb) mb.innerHTML = '<p class="muted">No findings.</p>';
    } else {
        var html = '';
        for (var i = 0; i < findings.length; i++) {
            var f = findings[i];
            html += '<div class="finding-detail">' +
                '<h4>' + escapeHtml(f.category) + '</h4>' +
                '<p>' + escapeHtml(f.description) + '</p>' +
                (f.line_number ? '<p class="muted">Line ' + f.line_number + '</p>' : '') +
                '<pre>' + escapeHtml(f.excerpt) + '</pre>' +
                '</div>';
        }
        if (mb) mb.innerHTML = html;
    }
    var m = el('modal');
    if (m) m.classList.remove('hidden');
}

// ── Log viewer ──

var currentLogText = '';

async function showBuildLog(buildId, packageName) {
    try {
        var r = await fetch(DATA_BASE_URL + '/logs/' + buildId + '.log');
        if (!r.ok) throw new Error('Log not found');
        currentLogText = await r.text();

        var lt = el('log-modal-title');
        if (lt) lt.textContent = packageName + ' \u2014 Build Log';
        var ls = el('log-search');
        if (ls) ls.value = '';
        var lsc = el('log-search-count');
        if (lsc) lsc.textContent = '';
        renderLog(currentLogText);
        var lm = el('log-modal');
        if (lm) lm.classList.remove('hidden');
        setTimeout(function() { if (ls) ls.focus(); }, 100);
    } catch (err) {
        console.error('Log load failed:', err);
    }
}

function renderLog(text, searchTerm) {
    var lc = el('log-content');
    if (!lc) return;

    var lines = text.split('\n');
    var numWidth = String(lines.length).length;
    var hitCount = 0;

    var html = '';
    for (var i = 0; i < lines.length; i++) {
        var num = String(i + 1);
        while (num.length < numWidth) num = ' ' + num;
        var content = escapeHtml(lines[i]);

        if (searchTerm) {
            var escaped = escapeHtml(searchTerm);
            var re = new RegExp(escapeRegex(escaped), 'gi');
            content = content.replace(re, function(m) {
                hitCount++;
                return '<span class="search-hit">' + m + '</span>';
            });
        }

        html += '<div class="log-line"><span class="line-num">' + num + '</span><span class="line-text">' + content + '</span></div>';
    }

    lc.innerHTML = html;

    var lsc = el('log-search-count');
    if (searchTerm) {
        if (lsc) lsc.textContent = hitCount + ' match' + (hitCount !== 1 ? 'es' : '');
        var first = lc.querySelector('.search-hit');
        if (first) first.scrollIntoView({ block: 'center' });
    } else {
        if (lsc) lsc.textContent = '';
    }
}

function handleLogSearch() {
    var ls = el('log-search');
    var term = ls ? ls.value.trim() : '';
    renderLog(currentLogText, term || null);
}

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Compare ──

function runComparison() {
    var aId = getDropdownValue('compare-batch-a-dd');
    var bId = getDropdownValue('compare-batch-b-dd');
    if (aId === bId) { alert('Select two different batches.'); return; }

    var batchA = batches.find(function(b) { return b.id === aId; });
    var batchB = batches.find(function(b) { return b.id === bId; });
    if (!batchA || !batchB) return;

    var dataA = loadBatchData(aId);
    var dataB = loadBatchData(bId);

    renderComparison(
        Object.assign({}, batchA, dataA),
        Object.assign({}, batchB, dataB)
    );
}

function renderComparison(a, b) {
    var content = el('compare-content');
    if (!content) return;

    var mA = {};
    for (var i = 0; i < a.builds.length; i++) mA[a.builds[i].package] = a.builds[i];
    var mB = {};
    for (var i = 0; i < b.builds.length; i++) mB[b.builds[i].package] = b.builds[i];

    var allPkgs = {};
    for (var k in mA) allPkgs[k] = true;
    for (var k in mB) allPkgs[k] = true;

    var changed = [], added = [], removed = [], same = [];
    for (var pkg in allPkgs) {
        var ba = mA[pkg], bb = mB[pkg];
        if (!ba) added.push({ package: pkg, b: bb });
        else if (!bb) removed.push({ package: pkg, a: ba });
        else if (ba.status !== bb.status) changed.push({ package: pkg, a: ba, b: bb });
        else same.push({ package: pkg, a: ba, b: bb });
    }

    var sortPkg = function(x, y) { return x.package.localeCompare(y.package); };
    changed.sort(sortPkg); added.sort(sortPkg); removed.sort(sortPkg); same.sort(sortPkg);

    var html = '<div class="card">' +
        '<h2>' + escapeHtml(a.name) + ' vs ' + escapeHtml(b.name) + '</h2>' +
        '<div class="stats-grid" style="margin-bottom:8px">' +
            '<div class="stat-item"><div class="stat-value">' + changed.length + '</div><div class="stat-label">Changed</div></div>' +
            '<div class="stat-item"><div class="stat-value">' + added.length + '</div><div class="stat-label">New in B</div></div>' +
            '<div class="stat-item"><div class="stat-value">' + removed.length + '</div><div class="stat-label">Removed</div></div>' +
            '<div class="stat-item"><div class="stat-value">' + same.length + '</div><div class="stat-label">Same</div></div>' +
        '</div>';

    if (changed.length > 0) {
        html += '<h3>Status Changes</h3><table><thead><tr><th>Package</th><th>' + escapeHtml(a.name) + '</th><th>' + escapeHtml(b.name) + '</th></tr></thead><tbody>';
        for (var i = 0; i < changed.length; i++) {
            var c = changed[i];
            html += '<tr class="compare-changed">' +
                '<td><span class="pkg-name">' + escapeHtml(c.package) + '</span></td>' +
                '<td><span class="st st-' + c.a.status + '">' + c.a.status + '</span></td>' +
                '<td><span class="st st-' + c.b.status + '">' + c.b.status + '</span></td>' +
                '</tr>';
        }
        html += '</tbody></table>';
    }

    html += '</div>';
    content.innerHTML = html;
}
