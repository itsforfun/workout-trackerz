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

// Progress tab: the muscles trained over the last 7 days (10+ sets = full gold); tap a muscle to see its exercises
const MAJOR_GROUPS = ['ch', 'sh', 'ub', 'gl', 'qd', 'hm', 'ab'];

function renderMuscleWeek() {
    const el = document.getElementById('muscleWeekCard');
    if (!el) return;
    const sets = weeklyMuscleSets();
    const weights = Object.fromEntries(Object.entries(sets).map(([g, n]) => [g, Math.min(1, n / 10)]));
    const missing = MAJOR_GROUPS.filter(g => !sets[g]);
    el.innerHTML = `
        <div class="mw-head"><span class="mw-kicker">This week's muscles</span><button class="mw-link" onclick="openExerciseLibrary()">Exercise library ›</button></div>
        ${bodyMapSvg({ weights, tap: 'openExerciseLibrary' })}
        <p class="mw-note">Brighter gold means more sets. Tap a muscle to see its exercises.</p>
        ${missing.length && Object.keys(sets).length ? `<p class="mw-missing"><span>Not trained this week:</span> ${muscleList(missing)}</p>` : ''}
    `;
}
