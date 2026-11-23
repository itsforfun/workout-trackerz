// ════════════════════════════════════════════
//  ANATOMY MAP: front and back of the body with the trained muscles in gold
// ════════════════════════════════════════════

const BODY_GROUP = Object.fromEntries(MUSCLE_GROUPS.flatMap(g => g.body.map(slug => [slug, g.id])));
const BODY_QUIET = new Set(['head', 'neck', 'hands', 'feet', 'ankles', 'knees']);

function bodySex() {
    return userProfile && userProfile.gender === 'female' ? 'f' : 'm';
}

// main / extra: muscle group ids. weights: { group: 0–1 } for a heat map. tap: name of a function called with the group id.
function bodyMapSvg({ main = [], extra = [], weights = null, tap = '', selected = '', compact = false } = {}) {
    const shapes = ANATOMY_SHAPES[bodySex()];
    const fillFor = slug => {
        const group = BODY_GROUP[slug];
        if (!group) return BODY_QUIET.has(slug) ? 'var(--bm-quiet)' : 'var(--bm-rest)';
        if (selected) return group === selected ? 'url(#odyrGold)' : 'var(--bm-rest)';
        if (weights) {
            const w = weights[group] || 0;
            return w >= 0.999 ? 'url(#odyrGold)' : w > 0 ? `rgba(217,178,95,${(0.16 + w * 0.7).toFixed(2)})` : 'var(--bm-rest)';
        }
        if (main.includes(group)) return 'url(#odyrGold)';
        if (extra.includes(group)) return 'var(--bm-extra)';
        return 'var(--bm-rest)';
    };
    const side = (view, viewBox, outline) => `
        <svg class="bm-side" viewBox="${viewBox}" aria-hidden="true">
            ${shapes[view].map(([slug, paths]) => paths.map(d =>
                `<path d="${d}" fill="${fillFor(slug)}"${BODY_GROUP[slug] && tap ? ` data-group="${BODY_GROUP[slug]}"` : ''}/>`).join('')).join('')}
            <path class="bm-outline" d="${outline}"/>
        </svg>`;
    return `<div class="body-map${compact ? ' compact' : ''}${tap ? ' tappable' : ''}"${tap ? ` onclick="bodyMapTap(event, '${tap}')"` : ''}>
        ${side('front', '0 0 724 1448', shapes.outline[0])}${side('back', '724 0 724 1448', shapes.outline[1])}
    </div>`;
}

// ── Gold body scan (v1.92): HUD feel in Odyr's colours ──
// A dim body underneath, the lit body revealed by a sweeping gold line, corner brackets, and a readout of
// sets per muscle. The sweep plays once per session per scan key (re-renders show it settled).
const scansPlayed = new Set();

function bodyScanHtml({ main = [], extra = [], sets = {}, key = '', compact = false, kicker = 'Body scan' } = {}) {
    const fresh = key && !scansPlayed.has(key);
    if (key) scansPlayed.add(key);
    const rows = MUSCLE_GROUPS.filter(g => main.includes(g.id))
        .map(g => [g, Math.round((sets[g.id] || 0) * 2) / 2])
        .sort((a, b) => b[1] - a[1]);
    const shown = rows.slice(0, compact ? 4 : 6);
    return `
        <div class="body-scan${compact ? ' compact' : ''}${fresh ? ' play' : ''}">
            <div class="bs-figure">
                <div class="bs-base">${bodyMapSvg({ compact })}</div>
                <div class="bs-lit">${bodyMapSvg({ main, extra, compact })}</div>
                <span class="bs-line" aria-hidden="true"></span>
                <span class="bs-corner tl"></span><span class="bs-corner tr"></span><span class="bs-corner bl"></span><span class="bs-corner br"></span>
            </div>
            <div class="bs-read">
                <span class="bs-kicker">${escapeHtml(kicker)}</span>
                ${shown.map(([g, n], i) => `
                    <span class="bs-row" style="--i:${i}"><span class="bs-name">${escapeHtml(g.name)}</span><i></i><strong>${n ? formatNum(n) : '·'}</strong></span>`).join('')}
                ${rows.length > shown.length ? `<span class="bs-more">+${rows.length - shown.length} more</span>` : ''}
                <span class="bs-foot">Sets per muscle</span>
            </div>
        </div>`;
}

// Sets per muscle group for a list of [exercise name, sets]; supporting muscles count half
function scanSets(list) {
    const sets = {};
    list.forEach(([name, n]) => {
        const m = exerciseMuscles(name);
        m.main.forEach(g => { sets[g] = (sets[g] || 0) + n; });
        m.extra.forEach(g => { sets[g] = (sets[g] || 0) + n / 2; });
    });
    return sets;
}

function bodyMapTap(event, fn) {
    const part = event.target.closest('[data-group]');
    if (part && typeof window[fn] === 'function') window[fn](part.dataset.group);
}

// Groups trained by a list of exercise names: main counts over supporting
function musclesOf(names) {
    const main = new Set();
    const extra = new Set();
    names.forEach(name => {
        const m = exerciseMuscles(name);
        m.main.forEach(g => main.add(g));
        m.extra.forEach(g => extra.add(g));
    });
    main.forEach(g => extra.delete(g));
    return { main: [...main], extra: [...extra] };
}

// "Chest, Shoulders and Triceps" as HTML; each name is its own word so it translates on its own
function muscleList(groups) {
    const names = MUSCLE_GROUPS.filter(g => groups.includes(g.id)).map(g => `<span>${escapeHtml(g.name)}</span>`);
    if (names.length < 2) return names.join('');
    return `${names.slice(0, -1).join(', ')} <span>and</span> ${names[names.length - 1]}`;
}

// Hard sets per muscle group over the last 7 days, from every program's log (supporting muscles count half)
function weeklyMuscleSets(end = todayStr()) {
    const start = addDays(end, -6);
    const sets = {};
    Object.entries(PROGRAMS).forEach(([progId, prog]) => {
        const data = allData[progId];
        if (!data) return;
        const names = new Map(prog.exercises.map(ex => [ex.id, ex.name]));
        Object.entries(data).forEach(([exId, weeks]) => {
            if (!weeks || typeof weeks !== 'object') return;
            Object.values(weeks).forEach(entry => {
                if (!entry || typeof entry !== 'object' || !entry.date || entry.date < start || entry.date > end) return;
                const count = (entry.sets || []).length || 1;
                const m = exerciseMuscles(names.get(exId) || exId);
                m.main.forEach(g => { sets[g] = (sets[g] || 0) + count; });
                m.extra.forEach(g => { sets[g] = (sets[g] || 0) + count / 2; });
            });
        });
    });
    return sets;
}

const MAJOR_GROUPS = ['ch', 'sh', 'ub', 'gl', 'qd', 'hm', 'ab'];

// ── One body on Today (v2.4): the turning 3D figure shows today's session or the last 7 days, with the sets
// beside it. Rest days show it under the rest card, on This week. The flat map stays as the fallback. ──
let bodyMode = null;       // 'session' | 'week'; null = follow the day
let bodySession = null;
let bodyRestDay = false;
let bodyMountTimer = null;

function bodyWeights(sets, mode) {
    return Object.fromEntries(Object.entries(sets).filter(([, n]) => n > 0)
        .map(([g, n]) => [g, mode === 'session' ? Math.min(1, 0.3 + n / 8) : Math.min(1, n / 10)]));
}

function renderTodayBody(session = bodySession, restDay = bodyRestDay) {
    const el = document.getElementById('todayMuscles');
    if (!el) return;
    bodySession = session;
    bodyRestDay = restDay;
    const week = weeklyMuscleSets();
    const hasWeek = Object.values(week).some(n => n > 0);
    // Keep the element (and its live canvas) and move it to whichever card is on screen
    const home = restDay ? document.getElementById('restBody') : document.getElementById('liftView');
    if (el.parentElement !== home) {
        if (restDay) home.appendChild(el);
        else home.insertBefore(el, document.getElementById('todayHint'));
    }
    if (!session && !hasWeek) {
        if (typeof unmountBody3d === 'function') unmountBody3d();
        el.innerHTML = '';
        return;
    }
    const mode = !session ? 'week' : bodyMode || (restDay ? 'week' : 'session');
    const sets = mode === 'session' ? session.sets : week;
    if (!el.querySelector('.body-hero')) {
        el.innerHTML = `
            <div class="body-hero">
                <div class="bh-main">
                    <div class="body3d">
                        <div class="b3-stage"><span class="b3-corner tl"></span><span class="b3-corner tr"></span><span class="b3-corner bl"></span><span class="b3-corner br"></span></div>
                        <div class="b3-flat"></div>
                    </div>
                    <div class="bh-read"></div>
                </div>
                <div class="bh-sets"></div>
                <p class="mw-credit">3D anatomy: BodyParts3D, © DBCLS, CC BY 4.0</p>
            </div>`;
    }
    const weights = bodyWeights(sets, mode);
    const rows = MUSCLE_GROUPS.filter(g => (mode === 'session' ? session.main.includes(g.id) : sets[g.id] > 0))
        .map(g => [g, Math.round((sets[g.id] || 0) * 2) / 2])
        .sort((a, b) => b[1] - a[1]);
    const shown = rows.slice(0, 4);
    const missing = mode === 'week' && hasWeek ? MAJOR_GROUPS.filter(g => !week[g]) : [];
    el.querySelector('.b3-flat').innerHTML = bodyMapSvg({ weights, tap: 'openExerciseLibrary', compact: true });
    el.querySelector('.bh-read').innerHTML = `
        ${session ? `<div class="bh-seg" role="group">
            <button class="${mode === 'session' ? 'on' : ''}" onclick="setBodyMode('session')">Session</button>
            <button class="${mode === 'week' ? 'on' : ''}" onclick="setBodyMode('week')">This week</button>
        </div>` : '<span class="bs-kicker">This week</span>'}
        <span class="bs-foot">Sets per muscle</span>
        ${shown.map(([g, n]) => `<span class="bs-row"><span class="bs-name">${escapeHtml(g.name)}</span><i></i><strong>${n ? formatNum(n) : '·'}</strong></span>`).join('')}
        ${rows.length > shown.length ? `<span class="bs-more">+${rows.length - shown.length} more</span>` : ''}
        ${!rows.length ? '<span class="bh-empty">Nothing trained yet this week</span>' : ''}
        ${missing.length ? `<p class="bh-missing"><span>Not trained this week:</span> ${muscleList(missing)}</p>` : ''}
        <button class="mw-link" onclick="openExerciseLibrary()">Exercise library ›</button>`;
    el.querySelector('.bh-sets').innerHTML = hasWeek ? muscleSetsHtml(week) : '';
    const box = el.querySelector('.body3d');
    if (typeof mountBody3d !== 'function' || (navigator.connection && navigator.connection.saveData)) return;
    // The first load waits a moment, so the page and the Start button are there first
    if (window.THREE) mountBody3d(box, weights);
    else {
        clearTimeout(bodyMountTimer);
        bodyMountTimer = setTimeout(() => mountBody3d(box, weights), 900);
    }
}

function setBodyMode(mode) {
    haptic();
    bodyMode = mode;
    renderTodayBody();
}

// Sets per muscle over the last 7 days against about 10–20 hard sets (10+ was the top group for growth in
// Schoenfeld 2017; ~20 as the upper end is a coaching convention for recovery). Supporting work counts half.
let muscleSetsOpen = false;

function muscleSetsHtml(sets) {
    const groups = MUSCLE_GROUPS.filter(g => sets[g.id] || MAJOR_GROUPS.includes(g.id))
        .map(g => ({ ...g, n: Math.round((sets[g.id] || 0) * 2) / 2 }))
        .sort((a, b) => b.n - a.n);
    if (!groups.some(g => g.n)) return '';
    const status = n => n >= 20 ? ['high', 'A lot'] : n >= 10 ? ['in', 'In range'] : n > 0 ? ['low', 'Room to add'] : ['none', 'None yet'];
    return `
        <details class="mw-sets" ${muscleSetsOpen ? 'open' : ''} ontoggle="muscleSetsOpen = this.open">
            <summary><span>Sets per muscle</span><small>10–20 a week</small></summary>
            ${groups.map(g => {
                const [cls, label] = status(g.n);
                return `
                <div class="ms-row ${cls}">
                    <span class="ms-name">${escapeHtml(g.name)}</span>
                    <span class="ms-bar"><i style="width:${Math.min(100, g.n / 20 * 100)}%"></i><b></b></span>
                    <span class="ms-n">${formatNum(g.n)}</span>
                    <span class="ms-status">${label}</span>
                </div>`;
            }).join('')}
            <p class="ms-note">Hard sets in the last 7 days; supporting muscles count half. More sets bring more growth, with 10 or more a week in the top group.</p>
        </details>`;
}
