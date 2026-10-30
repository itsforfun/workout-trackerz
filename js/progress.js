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

function statTile(label, value, sub = '', color = '') {
    return `
        <div class="stat">
            <div class="stat-label">${escapeHtml(label)}</div>
            <div class="stat-value"${color ? ` style="color:${color}"` : ''}>${escapeHtml(value)}</div>
            <div class="stat-sub">${escapeHtml(sub)}</div>
        </div>
    `;
}

function previousCycle() {
    const archive = metaFor('_archive')[currentProgram] || [];
    return archive.length ? archive[archive.length - 1] : null;
}

function renderProgress() {
    const prog = PROGRAMS[currentProgram];
    const hasData = prog.exercises.some(ex => getLoggedWeeks(ex.id).length);
    document.getElementById('page-progress').classList.toggle('is-empty', !hasData);
    renderOverview();
    renderLevel();
    renderConsistency();
    renderMuscleWeek();
    renderAchievements();
    if (!prog.exercises.some(ex => ex.id === progressExerciseId)) {
        // Default to the first exercise with data, else the first exercise
        const withData = prog.exercises.find(ex => getLoggedWeeks(ex.id).length);
        progressExerciseId = (withData || prog.exercises[0]).id;
    }

    // Program summary
    const ranked = prog.exercises.filter(ex => ex.thresholds);
    const tiers = ranked.map(ex => getTier(ex, getBestKg(ex.id)));
    const tested = prog.exercises.filter(ex => getLoggedWeeks(ex.id).length).length;
    const weeksLogged = new Set(prog.exercises.flatMap(ex => getLoggedWeeks(ex.id).map(l => l.week))).size;
    const topTier = tiers.length ? Math.max(...tiers) : 0;
    const rankedTiers = tiers.filter(t => t > 0);
    const avgTier = rankedTiers.length ? rankedTiers.reduce((a, b) => a + b, 0) / rankedTiers.length : 0;
    document.getElementById('progressSummary').innerHTML =
        statTile('Exercises tested', `${tested}/${prog.exercises.length}`) +
        statTile('Weeks logged', `${weeksLogged}/${WEEKS}`) +
        statTile('Top tier', tierName(topTier), topTier ? `Level ${ROMAN[topTier]} of VI` : '', TIERS[topTier].color) +
        statTile('Average tier', rankedTiers.length ? tierName(Math.round(avgTier)) : '—', rankedTiers.length ? `${avgTier.toFixed(1)} / 6` : (ranked.length ? '' : 'no tiers in this program'));

    // Exercise picker, grouped by day
    document.getElementById('progressExercise').innerHTML = prog.days.map((dayName, dayIdx) => `
        <optgroup label="${escapeHtml(dayName)}">
            ${prog.exercises.filter(ex => ex.day === dayIdx).map(ex =>
                `<option value="${ex.id}"${ex.id === progressExerciseId ? ' selected' : ''}>${escapeHtml(ex.name)}</option>`
            ).join('')}
        </optgroup>
    `).join('');

    // One row per exercise
    document.getElementById('progressList').innerHTML = prog.exercises.map(ex => {
        const best = getBestKg(ex.id);
        const tier = getTier(ex, best);
        const color = TIERS[tier].color;
        return `
            <button class="progress-row${ex.id === progressExerciseId ? ' active' : ''}" onclick="selectProgressExercise('${ex.id}', true)">
                <div>
                    <div class="row-name">${escapeHtml(ex.name)}</div>
                    <div class="row-day">${escapeHtml(prog.days[ex.day])}</div>
                </div>
                <div class="row-best">${best ? `${trackerToDisplay(ex, best)} ${escapeHtml(trackerUnit(ex))}` : '—'}</div>
                ${ex.thresholds ? `<span class="tier-badge" style="color:${color};border-color:${color};">${tierBadgeHtml(tier)}</span>` : '<span></span>'}
            </button>
        `;
    }).join('');

    renderProgressDetail();
}

function selectProgressExercise(exId, scrollUp = false) {
    progressExerciseId = exId;
    document.getElementById('progressExercise').value = exId;
    document.querySelectorAll('.progress-row').forEach(row => {
        row.classList.toggle('active', row.getAttribute('onclick').includes(`'${exId}'`));
    });
    renderProgressDetail();
    if (scrollUp) document.querySelector('.progress-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderProgressDetail() {
    const ex = getExercise(progressExerciseId);
    const logged = getLoggedWeeks(ex.id);
    const thresholds = getThresholds(ex);
    const best = logged.length ? Math.max(...logged.map(l => l.value)) : null;
    const tier = getTier(ex, best);
    const unit = trackerUnit(ex);
    const show = v => trackerToDisplay(ex, v);

    // Start / best / change / tier
    let statsHtml;
    if (logged.length) {
        const start = logged[0];
        const bestEntry = logged.find(l => l.value === best);
        const change = best - start.value;
        const pct = start.value ? (change / start.value) * 100 : 0;
        const changeShown = parseFloat(show(best)) - parseFloat(show(start.value));
        statsHtml =
            statTile('Start', show(start.value), `${unit} · W${start.week + 1}`) +
            statTile('Best', show(best), `${unit} · W${bestEntry.week + 1}`) +
            statTile('Change', `${change >= 0 ? '+' : ''}${formatNum(Math.round(changeShown * 10) / 10)}`, `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`, change > 0 ? 'var(--green)' : '') +
            (thresholds
                ? statTile('Tier', tierName(tier), TIERS[tier].pop === '—' ? '' : `top ${TIERS[tier].pop} of lifters`, TIERS[tier].color)
                : statTile('Sessions', String(logged.length), 'weeks logged'));
    } else {
        statsHtml = statTile('Start', '—') + statTile('Best', '—') + statTile('Change', '—') +
            (thresholds ? statTile('Tier', tierName(0), '', TIERS[0].color) : statTile('Sessions', '0'));
    }
    document.getElementById('progressStats').innerHTML = statsHtml;
    document.querySelector('.progress-panel').classList.toggle('empty', !logged.length);

    renderProgressChart(ex, logged, thresholds, tier);
    renderTierTrack(ex, best, thresholds, tier);
}

const CHART_TICKS = { color: '#7f725f', font: { family: 'Inter', size: 10 } };
const CHART_GRID = { color: 'rgba(61,52,44,0.6)' };

function renderProgressChart(ex, logged, thresholds, tier) {
    if (progressChart) {
        progressChart.destroy();
        progressChart = null;
    }
    if (!logged.length || typeof Chart === 'undefined') return;

    const show = v => parseFloat(trackerToDisplay(ex, v));
    const values = Array(WEEKS).fill(null);
    const setsByWeek = {};
    logged.forEach(l => {
        values[l.week] = show(l.value);
        setsByWeek[l.week] = l.sets;
    });

    const datasets = [{
        label: ex.name,
        data: values,
        borderColor: '#e6b84a',
        backgroundColor: 'rgba(230,184,74,0.12)',
        pointBackgroundColor: '#e6b84a',
        pointRadius: 4,
        borderWidth: 2,
        tension: 0.25,
        fill: true,
        spanGaps: true,
    }];
    // Faint line for the same exercise in the previous 12-week cycle
    const prev = previousCycle();
    const prevLogged = prev ? getLoggedWeeks(ex.id, prev.data || {}) : [];
    if (prevLogged.length) {
        const prevValues = Array(WEEKS).fill(null);
        prevLogged.forEach(l => { prevValues[l.week] = show(l.value); });
        datasets.push({
            label: 'Last cycle',
            data: prevValues,
            borderColor: 'rgba(168,149,120,0.55)',
            pointRadius: 2,
            borderWidth: 1.5,
            tension: 0.25,
            fill: false,
            spanGaps: true,
        });
    }
    // Dashed line at the next tier to aim for
    if (thresholds && tier < 6) {
        datasets.push({
            label: `${tierName(tier + 1)} (${trackerToDisplay(ex, thresholds[tier])} ${trackerUnit(ex)})`,
            data: Array(WEEKS).fill(show(thresholds[tier])),
            borderColor: TIERS[tier + 1].color,
            borderDash: [6, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
        });
    }

    progressChart = new Chart(document.getElementById('progressChart'), {
        type: 'line',
        data: { labels: Array.from({ length: WEEKS }, (_, w) => `W${w + 1}`), datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { ...CHART_TICKS, boxWidth: 14 } },
                tooltip: {
                    callbacks: {
                        label: c => c.parsed.y === null ? null : `${c.dataset.label}: ${formatNum(c.parsed.y)} ${trackerUnit(ex)}`,
                        // Reps per set from workout mode, e.g. "Sets: 10·10·9"
                        afterBody: items => {
                            const sets = setsByWeek[items[0].dataIndex];
                            return sets && sets.length ? `Sets: ${sets.map(s => s.reps).join('·')} reps` : '';
                        },
                    },
                },
            },
            scales: {
                x: { ticks: CHART_TICKS, grid: CHART_GRID },
                y: {
                    ticks: CHART_TICKS,
                    grid: CHART_GRID,
                    title: { display: true, text: trackerUnit(ex), color: '#6d5e4d', font: { family: 'DM Mono', size: 10 } },
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
    buildTracker();
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
}

async function saveData() {
    // Save to cloud
    await saveToCloud();

    // Also download a JSON backup of this program
    const filename = currentProgram === 'male' ? '9-5-beast-mode-data.json' :
                     currentProgram === 'female' ? 'hourglass-goddess-data.json' :
                     currentProgram === 'maleTotalBody' ? 'beast-total-body-data.json' :
                     'goddess-total-body-data.json';
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
    tabLensTo(tab);
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
    document.querySelectorAll(`.tab-btn[onclick="switchTab('${tab}')"]`).forEach(b => b.classList.add('active'));
    tabLensTo(tab);

    if (tab === 'today') {
        renderToday();
    } else if (tab === 'tracker') {
        buildTracker();
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

// ── Overview: the first screen of Progress answers "how am I doing?" at a glance; each tile opens its detail ──
function renderOverview() {
    const el = document.getElementById('progressOverview');
    if (!el) return;
    const stats = playerStats();
    const xp = playerXp(stats);
    const today = todayStr();
    const { score } = consistencyScore(today);
    const lastWeek = consistencyScore(addDays(today, -7)).score;
    const delta = score - lastWeek;
    const days = Array.from({ length: 7 }, (_, i) => consistencyScore(addDays(today, i - 6)).score);
    const streak = getStreakStats();
    const target = weeklyLiftTarget(PROGRAMS[currentProgram]);
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
        <div class="ov-grid">
            ${tile('score', "scrollToCard('consistencyCard')", 'Consistency', `<strong data-count="${score}" data-key="ov-score"></strong>`,
                `<span class="ov-delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : '−'}${Math.abs(delta)}</span> <span>vs last week</span>
                 <span class="ov-bars">${days.map(d => `<i style="height:${Math.max(8, d)}%"></i>`).join('')}</span>`)}
            ${tile('', "switchTab('today')", 'This week', `<strong>${streak.thisWeek}</strong><small>/${target}</small>`,
                `<span class="ov-meter"><i style="width:${Math.min(100, Math.round(streak.thisWeek / Math.max(1, target) * 100))}%"></i></span><span>workouts</span>`)}
            ${tile('', "openTrophyRoom()", 'Streak', `<strong>${streak.streak}</strong><small>${streak.streak === 1 ? 'week' : 'weeks'}</small>`,
                `<span>Best ${Math.max(stats.bestStreak, streak.streak)}</span>`)}
            ${tile('', "scrollToCard('progressList')", 'Records', `<strong>${stats.records}</strong>`,
                weekRecs ? `<span class="ov-gold">+${weekRecs} this week</span>` : '<span>all time</span>')}
            ${tile('', "scrollToCard('progressList')", 'Strength', `<span class="ov-tier" style="color:${TIERS[avgTier].color}">${escapeHtml(tierName(avgTier))}</span>`,
                topTier ? `<span>Best: ${escapeHtml(tierName(topTier))}</span>` : '<span>Log a lift to get ranked</span>')}
            ${tile('', "openTrophyRoom()", 'Badges', `<strong>${earned}</strong><small>/${tracks.length * BADGE_TIERS.length}</small>`,
                showcase.length ? `<span class="ov-medals">${showcase.map(t => medalSvg(badgeTier(t, stats), t.icon, 26)).join('')}</span>` : '<span>tiers earned</span>')}
        </div>
    `;
    rollNumbers(el);
}

function scrollToCard(id) {
    haptic();
    const card = document.getElementById(id);
    if (card) window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 90, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}
