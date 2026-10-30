// ════════════════════════════════════════════
//  PROGRESS TAB
// ════════════════════════════════════════════

let progressChart = null;
let progressExerciseId = null;

// Logged weeks for an exercise, in week order: [{ week, value, sets }]
function getLoggedWeeks(exId, source = progData()) {
    const weeks = source[exId] || {};
    const logged = [];
    for (let w = 0; w < WEEKS; w++) {
        const v = parseFloat(entryKg(weeks[w]));
        if (!isNaN(v) && v > 0) logged.push({ week: w, value: v, sets: entrySets(weeks[w]) });
    }
    return logged;
}

// ── Strength over time: estimated one-rep max (weight and reps together, Epley) for every logged
// workout of a lift, by date, across all its 12-week cycles. Reps-based lifts (pull-ups) use max reps. ──
function strengthOf(ex, entry) {
    const sets = (entrySets(entry) || []).filter(set => parseFloat(set.reps) > 0);
    if (isRepsBased(ex)) {
        const reps = sets.length ? Math.max(...sets.map(set => parseFloat(set.reps))) : parseFloat(entryKg(entry));
        return reps > 0 ? reps : null;
    }
    const e1rm = (kg, reps) => kg * (1 + reps / 30);
    const weighted = sets.filter(set => parseFloat(set.kg) > 0);
    if (weighted.length) return Math.max(...weighted.map(set => e1rm(parseFloat(set.kg), parseFloat(set.reps))));
    // Typed in the log without sets: assume the bottom of the prescribed rep range
    const kg = parseFloat(entryKg(entry));
    return kg > 0 ? e1rm(kg, getPrescription(ex).repMin || 8) : null;
}

// [{ date, value, kg, reps }] oldest first, one point per workout
function strengthHistory(ex) {
    const cycles = (metaFor('_archive')[currentProgram] || []).map(c => ({ start: c.start, data: c.data || {} }));
    cycles.push({ start: metaFor('_cycleStart')[currentProgram], data: progData() });
    const points = [];
    cycles.forEach(({ start, data }) => {
        const weeks = data[ex.id] || {};
        for (let w = 0; w < WEEKS; w++) {
            const entry = weeks[w];
            if (!entry || entry.deload) continue;
            const value = strengthOf(ex, entry);
            if (!value) continue;
            const date = (typeof entry === 'object' && entry.date) || (start ? addDays(start, 7 * w) : null);
            if (!date) continue;
            const sets = entrySets(entry) || [];
            const top = sets.filter(set => parseFloat(set.reps) > 0).sort((a, b) => parseFloat(b.kg || 0) - parseFloat(a.kg || 0))[0];
            points.push({ date, value, kg: parseFloat(entryKg(entry)), reps: top ? parseFloat(top.reps) : null });
        }
    });
    return points.sort((a, b) => a.date.localeCompare(b.date));
}

// % change from the first workout to the latest (null with fewer than two)
function strengthChange(history) {
    if (history.length < 2) return null;
    return (history[history.length - 1].value / history[0].value - 1) * 100;
}

// The whole program's strength: on each workout date, the average change of every lift trained so far
function overallStrength() {
    const lifts = PROGRAMS[currentProgram].exercises.map(strengthHistory).filter(h => h.length);
    const dates = [...new Set(lifts.flatMap(h => h.map(p => p.date)))].sort();
    const points = dates.map(date => {
        const ratios = lifts.map(h => {
            const upTo = h.filter(p => p.date <= date);
            return upTo.length ? upTo[upTo.length - 1].value / h[0].value : null;
        }).filter(r => r !== null);
        return { date, value: (ratios.reduce((a, b) => a + b, 0) / ratios.length - 1) * 100 };
    });
    return { points, lifts: lifts.length };
}

function changeText(pct) {
    if (pct === null) return '';
    const rounded = Math.round(pct);
    return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded)}%`;
}

function changeClass(pct) {
    return pct === null || Math.round(pct) === 0 ? 'flat' : pct > 0 ? 'up' : 'down';
}

// A small line (no axes) for a list of values; one value is a single dot
function sparkSvg(values, { w = 64, h = 24, area = false } = {}) {
    if (!values.length) return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"></svg>`;
    const min = Math.min(...values), max = Math.max(...values);
    const pad = 3;
    const x = i => values.length === 1 ? w - pad : pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = v => max === min ? h / 2 : h - pad - ((v - min) / (max - min)) * (h - pad * 2);
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const last = pts[pts.length - 1].split(',');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
        ${area && values.length > 1 ? `<path class="spark-area" d="M${pts[0].split(',')[0]},${h} L${pts.join(' L')} L${last[0]},${h} Z"/>` : ''}
        ${values.length > 1 ? `<polyline class="spark-line" points="${pts.join(' ')}"/>` : ''}
        <circle class="spark-dot" cx="${last[0]}" cy="${last[1]}" r="2.6"/>
    </svg>`;
}

function statTile(label, value, sub = '', color = '') {
    return `
        <div class="stat">
            <div class="stat-label">${escapeHtml(label)}</div>
            <div class="stat-value"${color ? ` style="color:${color}"` : ''}>${escapeHtml(value)}</div>
            <div class="stat-sub">${escapeHtml(sub)}</div>
        </div>
    `;
}

// Each part draws on its own, so one failing part (odd saved data) can't leave the rest of the page blank
function renderPart(name, fn) {
    try {
        fn();
    } catch (error) {
        if (/[?&]test\b/.test(location.search)) throw error;   // the automated checks must still see it
        reportError(error.message, `progress: ${name}`, error.stack);
    }
}

// Progress: level and all-time tiles, then the lifts of one workout at a time (segments above the list,
// opening on the workout you did last). The open lift shows its chart, strength standards and weekly log
// right under its row; tapping it again folds it away.
let liftOpen = true;
let liftDay = null;

function renderProgress() {
    const prog = PROGRAMS[currentProgram];
    const hasData = prog.exercises.some(ex => getLoggedWeeks(ex.id).length);
    document.getElementById('page-progress').classList.toggle('is-empty', !hasData);
    renderPart('overview', renderOverview);
    renderPart('muscles', renderMuscleWeek);
    if (liftDay === null || liftDay >= prog.days.length) liftDay = lastLiftDay(prog);
    renderPart('lifts', renderLifts);
}

// The workout day of the most recent lifting session, else the first
function lastLiftDay(prog) {
    const last = programSessions().filter(s => s && s.type !== 'cardio' && s.type !== 'mobility' && typeof s.day === 'number').slice(-1)[0];
    return last && last.day < prog.days.length ? last.day : 0;
}

function dayLifts(prog = PROGRAMS[currentProgram]) {
    return prog.days.length > 1 ? prog.exercises.filter(ex => ex.day === liftDay) : prog.exercises;
}

function setLiftDay(day) {
    if (day === liftDay) return;
    haptic();
    liftDay = day;
    liftOpen = true;
    renderLifts();
}

function renderLifts() {
    const prog = PROGRAMS[currentProgram];
    const lifts = dayLifts(prog);
    if (!lifts.some(ex => ex.id === progressExerciseId)) {
        // Open the first lift of this workout with something logged, else its first lift
        progressExerciseId = (lifts.find(ex => strengthHistory(ex).length) || lifts[0]).id;
    }

    const days = document.getElementById('liftDays');
    days.hidden = prog.days.length < 2;
    days.innerHTML = prog.days.map((name, i) =>
        `<button class="ld-seg${i === liftDay ? ' active' : ''}" onclick="setLiftDay(${i})">${escapeHtml(name)}</button>`).join('');

    // One row per lift; the panel is parked outside the list while the rows are redrawn
    const panel = document.getElementById('liftPanel');
    const list = document.getElementById('progressList');
    list.after(panel);
    list.innerHTML = lifts.map(ex => {
        const best = getBestKg(ex.id);
        const tier = getTier(ex, best);
        const color = TIERS[tier].color;
        const history = strengthHistory(ex);
        const pct = strengthChange(history);
        return `
            <button class="progress-row" data-ex="${ex.id}" onclick="tapLift('${ex.id}')">
                <div class="row-main">
                    <div class="row-name">${escapeHtml(ex.name)}</div>
                    <div class="row-day">${best ? `${trackerToDisplay(ex, best)} ${escapeHtml(trackerUnit(ex))}` : 'Not logged yet'}${ex.thresholds && tier ? ` · <span style="color:${color}">${escapeHtml(tierName(tier))}</span>` : ''}</div>
                </div>
                ${history.length ? sparkSvg(history.map(p => p.value)) : '<span></span>'}
                <span class="row-change ${changeClass(pct)}">${pct !== null ? changeText(pct) : history.length ? 'New' : '—'}</span>
            </button>
        `;
    }).join('');
    placeLiftPanel();
    renderPart('lift', renderProgressDetail);
}

function placeLiftPanel() {
    const panel = document.getElementById('liftPanel');
    const row = document.querySelector(`.progress-row[data-ex="${progressExerciseId}"]`);
    document.querySelectorAll('.progress-row').forEach(r => r.classList.toggle('active', liftOpen && r === row));
    panel.hidden = !liftOpen || !row;
    if (row) row.after(panel);
}

// Tapping the open lift folds it away; any other lift opens in its place
function tapLift(exId) {
    haptic();
    if (exId === progressExerciseId && liftOpen) {
        liftOpen = false;
        placeLiftPanel();
    } else {
        selectProgressExercise(exId);
    }
}

function selectProgressExercise(exId) {
    liftOpen = true;
    progressExerciseId = exId;
    const ex = getExercise(exId);
    if (PROGRAMS[currentProgram].days.length > 1 && ex && ex.day !== liftDay) {
        // A lift from another workout: switch to that workout's segment
        liftDay = ex.day;
        renderLifts();
        return;
    }
    placeLiftPanel();
    renderProgressDetail();
    const row = document.querySelector(`.progress-row[data-ex="${exId}"]`);
    if (row && row.getBoundingClientRect().top < 80) row.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderProgressDetail(withLog = true) {
    const ex = getExercise(progressExerciseId);
    const logged = getLoggedWeeks(ex.id);
    const thresholds = getThresholds(ex);
    const best = logged.length ? Math.max(...logged.map(l => l.value)) : null;
    const tier = getTier(ex, best);
    const unit = trackerUnit(ex);
    const show = v => trackerToDisplay(ex, v);
    const history = strengthHistory(ex);
    const strengthPct = strengthChange(history);

    // Start / best / change / tier
    let statsHtml;
    if (logged.length) {
        const start = logged[0];
        const bestEntry = logged.find(l => l.value === best);
        statsHtml =
            statTile('Start', show(start.value), `${unit} · W${start.week + 1}`) +
            statTile('Best', show(best), `${unit} · W${bestEntry.week + 1}`) +
            statTile('Strength', strengthPct === null ? '—' : changeText(strengthPct), strengthPct === null ? 'after 2 workouts' : 'since the first workout', strengthPct > 0 ? 'var(--green)' : '') +
            (thresholds
                ? statTile('Tier', tierName(tier), TIERS[tier].pop === '—' ? '' : `top ${TIERS[tier].pop} of lifters`, TIERS[tier].color)
                : statTile('Sessions', String(logged.length), 'weeks logged'));
    } else {
        statsHtml = statTile('Start', '—') + statTile('Best', '—') + statTile('Strength', '—') +
            (thresholds ? statTile('Tier', tierName(0), '', TIERS[0].color) : statTile('Sessions', '0'));
    }
    document.getElementById('progressStats').innerHTML = statsHtml;
    document.getElementById('liftPanel').classList.toggle('empty', !history.length);

    renderProgressChart(ex, history);
    renderTierTrack(ex, best, thresholds, tier);
    if (withLog) renderLiftLog();
}

const CHART_TICKS = { color: '#7f725f', font: { family: 'Inter', size: 10 } };
const CHART_GRID = { color: 'rgba(61,52,44,0.6)' };

// The lift's strength over time: one point per workout, by date, across every cycle
function renderProgressChart(ex, history) {
    if (progressChart) {
        progressChart.destroy();
        progressChart = null;
    }
    const note = document.getElementById('chartNote');
    note.textContent = history.length === 1 ? 'Your line starts after your next workout of this lift.' : '';
    if (!history.length || typeof Chart === 'undefined') return;

    const repsBased = isRepsBased(ex);
    const show = v => repsBased ? Math.round(v) : parseFloat(kgToDisplay(Math.round(v * 10) / 10));
    const weightUnit = repsBased ? 'reps' : unitLabel(ex.unit);

    progressChart = new Chart(document.getElementById('progressChart'), {
        type: 'line',
        data: {
            labels: history.map(p => prettyDate(p.date)),
            datasets: [{
                label: repsBased ? 'Max reps' : 'Estimated 1-rep max',
                data: history.map(p => show(p.value)),
                borderColor: '#e6b84a',
                backgroundColor: 'rgba(230,184,74,0.12)',
                pointBackgroundColor: '#e6b84a',
                pointRadius: history.length > 24 ? 0 : 4,
                borderWidth: 2,
                tension: 0.3,
                fill: true,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: c => repsBased ? `${c.parsed.y} reps` : `${formatNum(c.parsed.y)} ${weightUnit} (estimated 1-rep max)`,
                        // What was actually lifted, e.g. "Lifted 28 kg/DB × 10"
                        afterLabel: c => {
                            const p = history[c.dataIndex];
                            return !repsBased && p.kg ? `Lifted ${kgToDisplay(p.kg)} ${weightUnit}${p.reps ? ` × ${p.reps}` : ''}` : '';
                        },
                    },
                },
            },
            scales: {
                x: { ticks: { ...CHART_TICKS, maxTicksLimit: 6, maxRotation: 0 }, grid: { display: false } },
                y: {
                    ticks: CHART_TICKS,
                    grid: CHART_GRID,
                    grace: '10%',
                    title: { display: true, text: repsBased ? 'Max reps' : `Est. 1-rep max (${weightUnit})`, color: '#6d5e4d', font: { family: 'Inter', size: 10 } },
                },
            },
        },
    });
}

// Horizontal bar from 0 to past the God/Goddess threshold, with a marker at each tier
function renderTierTrack(ex, best, thresholds, tier) {
    const track = document.getElementById('tierTrack');
    track.style.display = thresholds ? '' : 'none';
    if (!thresholds) {
        document.getElementById('tierTrackLabel').textContent = 'Custom exercises have no strength standard, so there are no tiers to chase. Your chart and best are above.';
        return;
    }
    const max = Math.max(thresholds[5] * 1.08, best || 0);
    const pct = v => Math.min(100, (v / max) * 100);
    const show = v => trackerToDisplay(ex, v);
    const unit = escapeHtml(trackerUnit(ex));

    const marks = thresholds.map((t, i) => {
        const color = TIERS[i + 1].color;
        return `
            <div class="tier-mark" style="left:${pct(t)}%; background:${color};">
                <span style="color:${color};">${ROMAN[i + 1]}<br>${show(t)}</span>
            </div>
        `;
    }).join('');
    document.getElementById('tierTrack').innerHTML =
        `<div class="tier-fill" style="width:${best ? pct(best) : 0}%"></div>` + marks;

    let label;
    if (!best) {
        label = `Log a week to get ranked. <strong>${tierName(1)}</strong> starts at ${show(thresholds[0])} ${unit}.`;
    } else if (tier === 6) {
        label = `<strong>${tierName(6)} tier reached.</strong> Nothing left to unlock on this lift.`;
    } else {
        const toGo = parseFloat(show(thresholds[tier])) - parseFloat(show(best));
        label = `<strong>${formatNum(Math.round(toGo * 10) / 10)} ${unit}</strong> to go until <strong style="color:${TIERS[tier + 1].color}">${tierName(tier + 1)}</strong> (${show(thresholds[tier])}).`;
    }
    if (UNSCALED_UNITS.includes(ex.unit)) label += ' <em>Not scaled by bodyweight.</em>';
    document.getElementById('tierTrackLabel').innerHTML = label;
}

// ════════════════════════════════════════════
//  BODYWEIGHT LOG
// ════════════════════════════════════════════

let bwChart = null;

function bodyweightLog() {
    if (!Array.isArray(allData._bodyweight)) allData._bodyweight = [];
    return allData._bodyweight;
}

// One entry per day; the latest one is the weight used for tier standards
function logBodyweight(kg, date = todayStr()) {
    const log = bodyweightLog().filter(e => e.date !== date);
    log.push({ date, kg: Math.round(kg * 10) / 10 });
    log.sort((a, b) => a.date.localeCompare(b.date));
    allData._bodyweight = log;
    return log;
}

async function handleBodyweightLog(event) {
    event.preventDefault();
    const kg = displayToKg(document.getElementById('bwInput').value);
    if (!kg || kg < 20) return;
    const log = logBodyweight(kg);
    userProfile.weight = log[log.length - 1].kg;
    document.getElementById('bwInput').value = '';
    loadSettingsForm();
    refreshAllViews();
    scheduleSave();
    showToast('Bodyweight logged — tiers updated');
}

function deleteBodyweight(date) {
    const log = bodyweightLog().filter(e => e.date !== date);
    allData._bodyweight = log;
    if (log.length) userProfile.weight = log[log.length - 1].kg;
    loadSettingsForm();
    refreshAllViews();
    scheduleSave();
}

function renderBodyweight() {
    const log = bodyweightLog();
    const unit = usesLb() ? 'lb' : 'kg';
    document.getElementById('bwInput').placeholder = `Today's weight (${unit})`;
    document.getElementById('bwList').innerHTML = log.length
        ? [...log].reverse().slice(0, 8).map(e => `
            <div class="bw-row">
                <span>${escapeHtml(prettyDate(e.date))}</span>
                <span>${escapeHtml(kgToDisplay(e.kg))} ${unit}</span>
                <button onclick="deleteBodyweight('${escapeHtml(e.date)}')" aria-label="Delete entry">${CLOSE_ICON}</button>
            </div>`).join('')
        : '<div class="bw-row">No weigh-ins yet. Log one to track bodyweight over time.</div>';

    if (bwChart) {
        bwChart.destroy();
        bwChart = null;
    }
    const wrap = document.querySelector('.bw-chart-wrap');
    wrap.style.display = log.length > 1 ? 'block' : 'none';
    if (log.length < 2 || typeof Chart === 'undefined') return;
    bwChart = new Chart(document.getElementById('bwChart'), {
        type: 'line',
        data: {
            labels: log.map(e => prettyDate(e.date)),
            datasets: [{
                label: `Bodyweight (${unit})`,
                data: log.map(e => parseFloat(kgToDisplay(e.kg))),
                borderColor: '#dcc89e',
                backgroundColor: 'rgba(220,200,158,0.1)',
                fill: true,
                tension: 0.25,
                pointRadius: 3,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: { legend: { display: false } },
            scales: { x: { ticks: CHART_TICKS, grid: CHART_GRID }, y: { ticks: CHART_TICKS, grid: CHART_GRID } },
        },
    });
}

// ════════════════════════════════════════════
//  12-WEEK CYCLES
// ════════════════════════════════════════════

function renderCycleInfo() {
    const el = document.getElementById('cycleInfo');
    if (!currentProgram) {
        el.textContent = '';
        return;
    }
    const start = metaFor('_cycleStart')[currentProgram];
    const archive = metaFor('_archive')[currentProgram] || [];
    el.innerHTML = `
        <strong>${escapeHtml(PROGRAMS[currentProgram].name)}:</strong> week ${getCurrentWeek() + 1} of ${WEEKS}${start ? ` · started ${escapeHtml(prettyDate(start))}` : ''}<br>
        Finished cycles: ${archive.length}${archive.length ? ` (last ended ${escapeHtml(prettyDate(archive[archive.length - 1].end))})` : ''}<br>
        <em style="font-size:0.65rem; color:var(--text-muted);">Starting a new cycle clears the tracker for week 1. The old numbers are kept and shown as "Last cycle" on the Progress charts.</em>
    `;
}

function startNewCycle() {
    if (!currentProgram) return;
    if (!confirm(`Start a new 12-week cycle of ${PROGRAMS[currentProgram].name}?\n\nThe current numbers are archived (still visible on Progress charts) and the tracker starts fresh at week 1.`)) return;
    const starts = metaFor('_cycleStart');
    const archive = metaFor('_archive');
    if (!archive[currentProgram]) archive[currentProgram] = [];
    const firstSession = workoutSessions()[0];
    archive[currentProgram].push({
        start: starts[currentProgram] || (firstSession ? firstSession.date : todayStr()),
        end: todayStr(),
        data: progData(),
    });
    allData[currentProgram] = {};
    delete starts[currentProgram];
    todayWeek = null;
    renderCycleInfo();
    scheduleSave();
    showToast('New cycle started — week 1, let\'s go!');
}

// ════════════════════════════════════════════
//  DATA HANDLING
// ════════════════════════════════════════════

function onInput(exId, w, el) {
    const ex = getExercise(exId);
    const data = progData();
    if (!data[exId]) data[exId] = {};
    const typed = el.value.trim();
    if (typed === '') {
        delete data[exId][w];
    } else {
        const kg = isRepsBased(ex) ? parseFloat(typed) : displayToKg(typed);
        const value = kg === null || isNaN(kg) ? typed : String(kg);
        const existing = data[exId][w];
        // Keep the sets logged in workout mode; only the tracked number changes
        if (existing && typeof existing === 'object') existing.kg = value;
        else data[exId][w] = value;
    }
    el.classList.toggle('filled', typed !== '');
    updateBadge(exId);
    scheduleSave();
}

// Fires when the box loses focus — celebrate here, not on every keystroke
function onInputDone(exId) {
    const ex = getExercise(exId);
    const tier = getTier(ex, getBestKg(exId));
    updateWeekHints(exId);
    if (tier > (knownTiers[exId] || 0)) celebrateTier(ex, tier);
    knownTiers[exId] = tier;
    // Redraw the chart and numbers above; the log itself stays as typed, so the next box keeps focus
    if (exId === progressExerciseId) renderProgressDetail(false);
}

async function saveData() {
    // Save to cloud
    await saveToCloud();

    // Also download a JSON backup of this program, named after it (e.g. odyr-freyja-data.json)
    const slug = PROGRAMS[currentProgram].name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const filename = `odyr-${slug || 'program'}-data.json`;
    const backup = { program: currentProgram, exercises: progData() };
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}

function openImport() { document.getElementById('importModal').classList.add('active'); }
function closeImport() { document.getElementById('importModal').classList.remove('active'); document.getElementById('importText').value = ''; }

// A week value from a backup: a plain number/string, or { kg, sets, date } from workout mode
function sanitizeEntry(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v !== 'object') return String(v);
    if (v.kg === undefined || v.kg === null || v.kg === '') return null;
    const entry = { kg: String(v.kg) };
    if (Array.isArray(v.sets)) {
        entry.sets = v.sets
            .filter(s => s && typeof s === 'object')
            .map(s => ({ kg: String(parseFloat(s.kg) || 0), reps: String(parseInt(s.reps) || 0) }));
    }
    if (typeof v.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.date)) entry.date = v.date;
    return entry;
}

// Accepts a backup from the Save button ({ program, exercises }) or an old flat
// backup keyed by exercise index (always loaded into the current program).
function confirmImport() {
    const text = document.getElementById('importText').value.trim();
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        showToast('Invalid data format');
        return;
    }
    if (!parsed || typeof parsed !== 'object') {
        showToast('Invalid data format');
        return;
    }

    const programId = PROGRAMS[parsed.program] ? parsed.program : currentProgram;
    let imported = parsed.exercises || parsed;
    if (Object.keys(imported).some(isIndexKey)) imported = indexDataToIds(imported, programId);

    // Keep only known exercises and week numbers
    const knownIds = new Set(PROGRAMS[programId].exercises.map(ex => ex.id));
    const clean = {};
    Object.entries(imported).forEach(([exId, weeks]) => {
        if (!knownIds.has(exId) || !weeks || typeof weeks !== 'object') return;
        clean[exId] = {};
        Object.entries(weeks).forEach(([w, v]) => {
            const entry = sanitizeEntry(v);
            if (isIndexKey(w) && Number(w) < WEEKS && entry !== null) clean[exId][w] = entry;
        });
    });

    allData[programId] = clean;
    if (programId === currentProgram) refreshAllViews();
    scheduleSave();
    closeImport();
    showToast(`Progress loaded into ${PROGRAMS[programId].name}!`);
}

// ════════════════════════════════════════════
//  UI HELPERS
// ════════════════════════════════════════════

// Tab change: the old page fades out quickly, then the new one rises in. Done with the Web
// Animations API so it behaves the same on every iPhone. The tab bar highlights immediately.
let tabSwitchId = 0;

function switchTab(tab) {
    haptic();
    const current = document.querySelector('.main-app .page.active');
    const target = document.getElementById('page-' + tab);
    document.querySelectorAll('.main-app .page').forEach(p => p.getAnimations().forEach(a => a.cancel()));
    tabLensTo(tab === 'steps' ? 'today' : tab);
    const animate = current && current !== target && target.animate
        && document.getElementById('mainApp').classList.contains('active');
    // With Reduce Motion the tabs cross-fade without moving (see css/app.css, end)
    const still = prefersReducedMotion();
    if (!animate) {
        showTab(tab);
        return;
    }
    // The new page appears on the tap itself and fades in; nothing waits for the old page to leave
    ++tabSwitchId;
    showTab(tab);
    window.scrollTo(0, 0);
    target.animate(
        [{ opacity: 0, transform: still ? 'none' : 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
        { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' }
    );
}

function showTab(tab) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('page-'+tab).classList.add('active');
    // Steps opens from the Steps ring on Today, so Today stays lit in the tab bar
    const barTab = tab === 'steps' ? 'today' : tab;
    document.querySelectorAll(`.tab-btn[onclick="switchTab('${barTab}')"]`).forEach(b => b.classList.add('active'));
    tabLensTo(barTab);

    if (tab === 'today') {
        renderToday();
    } else if (tab === 'steps') {
        renderSteps();
    } else if (tab === 'progress') {
        renderProgress();
        renderProCards();
    } else if (tab === 'settings') {
        loadSettingsForm();
        renderProCards();
    }
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// Don't lose the last few keystrokes when the phone locks or the tab closes
document.addEventListener('visibilitychange', () => {
    // Resting when the phone locks: put the rest's end time on the lock screen; clear it when the app is back
    if (activeWorkout && rest.interval) {
        if (document.visibilityState === 'hidden') showRestOnLockScreen();
        else clearRestFromLockScreen();
    }
    if (document.visibilityState === 'hidden') flushSave();
    else if (currentUser && document.getElementById('page-steps').classList.contains('active')) renderSteps();
    else if (activeWorkout && rest.interval) tickRest();
});

// ── Overview: the first screen of Progress answers "how far have I come?" at a glance; each tile opens its detail.
// This week (rings, score) belongs to Today, so it isn't repeated here. ──
function renderOverview() {
    const el = document.getElementById('progressOverview');
    if (!el) return;
    const stats = playerStats();
    const xp = playerXp(stats);
    const today = todayStr();
    const streak = getStreakStats();
    const prog = PROGRAMS[currentProgram];
    const tiers = prog.exercises.filter(ex => ex.thresholds).map(ex => getTier(ex, getBestKg(ex.id))).filter(t => t > 0);
    const topTier = tiers.length ? Math.max(...tiers) : 0;
    const avgTier = tiers.length ? Math.round(tiers.reduce((a, b) => a + b, 0) / tiers.length) : 0;
    const weekRecs = weekRecords(mondayOf(today)).length;
    const tracks = badgeTracks();
    const earned = tracks.reduce((sum, t) => sum + badgeTier(t, stats), 0);
    const showcase = showcaseTracks(stats).filter(t => badgeTier(t, stats) > 0).slice(0, 3);
    const tile = (cls, onclick, kicker, value, sub) => `
        <button class="ov-tile ${cls}" onclick="${onclick}">
            <span class="ov-kicker">${kicker}</span>
            <span class="ov-value">${value}</span>
            <span class="ov-sub">${sub}</span>
        </button>`;
    el.innerHTML = `
        <button class="ov-hero" onclick="openTrophyRoom()">
            <div class="th-ring">${levelRingSvg(xp)}<div class="th-level"><span>Level</span><strong>${xp.level}</strong></div></div>
            <div class="ov-hero-text">
                <div class="ov-rank">${escapeHtml(xp.rank)}</div>
                <p class="ov-line">${xp.level < MAX_LEVEL ? `${xp.toNext.toLocaleString(LOCALE)} XP to level ${xp.level + 1}` : 'Maximum level'}</p>
                <span class="ov-link">Trophy room ›</span>
            </div>
        </button>
        ${strengthCardHtml()}
        <div class="ov-grid">
            ${tile('', "openTrophyRoom()", 'Streak', `<strong>${streak.streak}</strong><small>${streak.streak === 1 ? 'week' : 'weeks'}</small>`,
                `<span>Best ${Math.max(stats.bestStreak, streak.streak)}</span>`)}
            ${tile('', "scrollToCard('liftsHead')", 'Records', `<strong>${stats.records}</strong>`,
                weekRecs ? `<span class="ov-gold">+${weekRecs} this week</span>` : '<span>all time</span>')}
            ${tile('', "scrollToCard('liftsHead')", 'Strength tier', `<span class="ov-tier" style="color:${TIERS[avgTier].color}">${escapeHtml(tierName(avgTier))}</span>`,
                topTier ? `<span>Best: ${escapeHtml(tierName(topTier))}</span>` : '<span>Log a lift to get ranked</span>')}
            ${tile('', "openTrophyRoom()", 'Badges', `<strong>${earned}</strong><small>/${tracks.length * BADGE_TIERS.length}</small>`,
                showcase.length ? `<span class="ov-medals">${showcase.map(t => medalSvg(badgeTier(t, stats), t.icon, 26)).join('')}</span>` : '<span>tiers earned</span>')}
        </div>
    `;
    rollNumbers(el);
}

// Strength card: the whole program's trend since the first workout, always in view
function strengthCardHtml() {
    const { points, lifts } = overallStrength();
    if (!points.length) return '';
    const pct = points.length > 1 ? points[points.length - 1].value : null;
    return `
        <button class="strength-card" onclick="scrollToCard('liftsHead')">
            <div class="sc-head">
                <span class="ov-kicker">Strength</span>
                <span class="sc-since">since ${escapeHtml(prettyDate(points[0].date))}</span>
            </div>
            <div class="sc-value ${changeClass(pct)}">${pct === null ? '—' : changeText(pct)}</div>
            ${sparkSvg(points.map(p => p.value), { w: 320, h: 72, area: true })}
            <p class="sc-note">${pct === null
                ? 'Your strength line starts after your next workout.'
                : `Estimated from the weight and reps of ${lifts} ${lifts === 1 ? 'lift' : 'lifts'}. Tap a lift below for its own chart.`}</p>
        </button>`;
}

function scrollToCard(id) {
    haptic();
    const card = document.getElementById(id);
    if (card) window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 90, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}
