// ════════════════════════════════════════════
//  WORKOUT MODE
// ════════════════════════════════════════════

// { program, day, week, startedAt, rows: { [exId]: [{ kg, reps, target, done }] } }
// Weights in rows are as typed (display units); they're converted to kg on finish.
// Kept in localStorage so a locked phone or closed tab doesn't lose the session.
let activeWorkout = null;

function activeWorkoutKey() {
    return currentUser ? `wt_active_workout_${currentUser.id}` : null;
}

function persistActiveWorkout() {
    try {
        if (activeWorkout) localStorage.setItem(activeWorkoutKey(), JSON.stringify(activeWorkout));
    } catch (e) { /* ignore */ }
}

function loadActiveWorkout() {
    try {
        const saved = JSON.parse(localStorage.getItem(activeWorkoutKey()));
        activeWorkout = saved && saved.program === currentProgram ? saved : null;
    } catch (e) {
        activeWorkout = null;
    }
    return activeWorkout;
}

function clearActiveWorkout() {
    activeWorkout = null;
    stopRest();
    try {
        if (activeWorkoutKey()) localStorage.removeItem(activeWorkoutKey());
    } catch (e) { /* ignore */ }
}

// Builds today's session; a deload week and a low readiness check-in make it lighter and shorter
function beginWorkout(readiness) {
    const prog = PROGRAMS[currentProgram];
    const week = todayWeek !== null ? todayWeek : getCurrentWeek();
    const deload = deloadInfo();
    const deloading = !!(deload && deload.active);
    const low = readiness && readiness.level === 'low';
    const factor = deloading && low ? 0.85 : deloading || low ? 0.9 : 1;
    const rows = {};
    prog.exercises.filter(ex => ex.day === todayDay).forEach(ex => {
        const prefill = workoutPrefill(ex);
        const kg = factor < 1 ? lighterKg(ex, prefill.kg, factor) : prefill.kg;
        const planned = getPrescription(ex).sets;
        const sets = deloading ? Math.max(2, Math.round(planned * 0.6)) : low ? Math.max(2, planned - 1) : planned;
        rows[ex.id] = Array.from({ length: sets }, () => ({ kg, reps: '', target: prefill.target, done: false }));
    });
    const daysOff = daysSinceLastWorkout();
    activeWorkout = { program: currentProgram, day: todayDay, week, startedAt: Date.now(), rows, swaps: {},
        layoffDays: daysOff >= 7 ? daysOff : 0, deload: deloading, readiness: readiness || null };
    persistActiveWorkout();
    haptic();
    resumeWorkout();
}

// Starting weight (display units) and target reps for an exercise's sets
function workoutPrefill(ex) {
    const p = getPrescription(ex);
    const progression = getProgression(ex);
    const lastKg = progression ? progression.kg : parseFloat(entryKg((progData()[ex.id] || {})[highestWeekFor(ex.id)]));
    // Pull-ups' tracked number is reps, so only prefill their added weight from logged sets
    let kg = progression ? kgToDisplay(progression.kg) : (!isRepsBased(ex) && !isNaN(lastKg) ? kgToDisplay(lastKg) : '');
    // Coach rule: back after a week or more off → start 10% lighter and rebuild over 2 sessions
    const daysOff = daysSinceLastWorkout();
    if (daysOff !== null && daysOff >= 7 && kg !== '' && !isRepsBased(ex) && !ex.assist) {
        const step = usesLb() ? LB_INCREMENT[ex.unit] : KG_INCREMENT[ex.unit];
        kg = formatNum(Math.max(step, Math.round((parseFloat(kg) * 0.9) / step) * step));
    }
    const target = progression ? progression.reps : (p.repMax || '');
    return { kg, target: String(target) };
}

// The exercise shown for a workout slot: the program's, or the one swapped in for today.
// A swap keeps its own history under "<exerciseId>~<slug>", so the original's log and tiers stay untouched.
function workoutExercise(exId) {
    const ex = getExercise(exId);
    const swap = activeWorkout && activeWorkout.swaps && activeWorkout.swaps[exId];
    if (!swap) return ex;
    return { ...ex, id: swap.id, name: swap.name, unit: swap.unit || ex.unit, bar: !!swap.bar, assist: !!swap.assist,
        note: '', alternates: null, upgrade: null, depthRule: false, repLabel: ex.repLabel, swappedFrom: ex.name };
}

function highestWeekFor(exId) {
    const weeks = progData()[exId] || {};
    let highest = -1;
    Object.keys(weeks).forEach(w => { if (isIndexKey(w) && +w > highest) highest = +w; });
    return highest;
}

function resumeWorkout() {
    renderWorkout();
    showScreen('workout');
    updateWorkoutClock();
}

// Banner above the exercises: layoff notice and the effort rule (coach-rules programs)
function workoutBannerHtml() {
    const lines = [];
    if (activeWorkout.layoffDays) {
        lines.push(`<strong>Welcome back after ${activeWorkout.layoffDays} days off.</strong> Weights are 10% lighter today; build back up over the next 2 sessions.`);
    }
    if (activeWorkout.deload) lines.push('<strong>Deload week.</strong> Lighter weights and fewer sets on purpose, so you come back stronger.');
    else if (activeWorkout.readiness && activeWorkout.readiness.level === 'low') lines.push('<strong>Easier day.</strong> About 10% lighter and one set fewer, from your check-in.');
    else if (activeWorkout.readiness && activeWorkout.readiness.level === 'high') lines.push('<strong>You\'re ready.</strong> Chase an extra rep on your last sets.');
    lines.push('Rate each set after you tick it. The coach uses it to set your next weights.');
    return lines.length ? `<div class="wo-banner">${lines.join('<br>')}</div>` : '';
}

function renderWorkout() {
    const prog = PROGRAMS[currentProgram];
    const w = activeWorkout;
    document.getElementById('workoutTitle').textContent = prog.days[w.day];
    const body = document.getElementById('workoutBody');

    body.innerHTML = workoutBannerHtml() + Object.entries(w.rows).map(([exId, rows]) => {
        const ex = workoutExercise(exId);
        const p = getPrescription(ex);
        const progression = getProgression(ex);
        const complete = rows.length && rows.every(r => r.done);
        return `
            <div class="wo-card${complete ? ' complete' : ''}" id="wo_${exId}">
                <div class="wo-head" onclick="toggleDoneCard('${exId}', event)">
                    <div class="wo-name">
                        <span>${escapeHtml(exerciseDisplayName(ex, w.week))}</span>
                        <span class="wo-name-side">${progressionBadge(progression)}<button class="swap-btn" onclick="event.stopPropagation(); openGuide('${exId}', true)">Form</button><button class="swap-btn" onclick="openSwap('${exId}')">Swap</button></span>
                    </div>
                    ${ex.swappedFrom ? `<div class="wo-sub swapped">Swapped in for ${escapeHtml(ex.swappedFrom)} today</div>` : ''}
                    <div class="wo-sub">${escapeHtml(prescriptionText(ex))}${p.restText ? ` · ${escapeHtml(p.restText)} rest` : ''}</div>
                    ${ex.note && !ex.alternates ? `<div class="wo-sub" style="font-style:italic;">${escapeHtml(ex.note)}</div>` : ''}
                    ${progression ? `<div class="wo-tip prog-badge ${progression.type}" style="white-space:normal;"><span>${escapeHtml(progression.text)}</span></div>` : ''}
                    ${!ex.swappedFrom && upgradeText(ex, w.week) ? `<div class="wo-sub swapped">${escapeHtml(upgradeText(ex, w.week))}</div>` : ''}
                    <div class="wo-summary" id="wosum_${exId}"></div>
                </div>
                <div class="plates" id="plates_${exId}">${platesHtml(exId)}</div>
                ${rows.map((row, i) => setRowHtml(ex, i, row, exId)).join('')}
                <button class="wo-add" onclick="addSet('${exId}')">+ Add set</button>
            </div>
        `;
    }).join('');
    updateWorkoutFocus();
}

// One exercise at a time: the first unfinished one is in focus, finished ones fold to a summary line,
// later ones wait dimmed. A finished card opens again on tap.
function updateWorkoutFocus() {
    if (!activeWorkout) return;
    let current = null;
    Object.entries(activeWorkout.rows).forEach(([exId, rows]) => {
        const card = document.getElementById(`wo_${exId}`);
        if (!card) return;
        const complete = rows.length > 0 && rows.every(r => r.done);
        const isCurrent = !complete && current === null;
        if (isCurrent) current = exId;
        card.classList.toggle('complete', complete);
        card.classList.toggle('current', isCurrent);
        card.classList.toggle('upcoming', !complete && !isCurrent);
        if (!complete) card.classList.remove('expanded');
        const ex = workoutExercise(exId);
        const done = rows.filter(r => r.done);
        const top = Math.max(0, ...done.map(r => parseFloat(isRepsBased(ex) ? r.reps : r.kg) || 0));
        document.getElementById(`wosum_${exId}`).textContent = complete
            ? `${done.length} sets · ${isRepsBased(ex) ? `best ${top} reps` : `top ${formatNum(top)} ${setWeightUnit(ex)}`}`
            : '';
    });
    return current;
}

function toggleDoneCard(exId, event) {
    const card = document.getElementById(`wo_${exId}`);
    if (!card.classList.contains('complete') || event.target.closest('button')) return;
    card.classList.toggle('expanded');
}

// `key` is the workout slot (the program's exercise id), which stays the same when an exercise is swapped
function setRowHtml(ex, i, row, key = ex.id) {
    return `
        <div class="set-row${row.done ? ' done' : ''}" id="set_${key}_${i}">
            <div class="set-num">${i + 1}</div>
            <div class="set-field">
                <input type="text" inputmode="decimal" value="${escapeHtml(row.kg)}" placeholder="${isRepsBased(ex) ? '0' : '—'}"
                    oninput="updateSet('${key}',${i},'kg',this.value)">
                <span>${escapeHtml(setWeightUnit(ex))}</span>
            </div>
            <div class="set-field">
                <input type="text" inputmode="numeric" value="${escapeHtml(row.reps)}" placeholder="${escapeHtml(row.target || 'reps')}"
                    oninput="updateSet('${key}',${i},'reps',this.value)">
                <span>${escapeHtml(ex.repLabel || 'reps')}</span>
            </div>
            <button class="set-check" onclick="toggleSetDone('${key}',${i})" aria-label="Mark set ${i + 1} done">${CHECK_ICON}</button>
            ${row.done ? (row.rir === undefined
                ? `<div class="set-effort"><span>How did it feel?</span>${EFFORTS.map(e => `<button onclick="rateSet('${key}',${i},${e.rir})">${e.label}</button>`).join('')}</div>`
                : `<button class="set-effort-tag" onclick="clearSetEffort('${key}',${i})">${effortLabel(row.rir)}</button>`) : ''}
        </div>
    `;
}

function updateSet(exId, i, field, value) {
    activeWorkout.rows[exId][i][field] = value.trim();
    persistActiveWorkout();
    if (field === 'kg') updatePlates(exId);
}

function toggleSetDone(exId, i) {
    unlockAudio();
    const row = activeWorkout.rows[exId][i];
    row.done = !row.done;
    // Tapping ✓ without typing reps means "hit the target"
    if (row.done && !row.reps && row.target) row.reps = row.target;
    // Carry the weight down to the next empty set
    const next = activeWorkout.rows[exId][i + 1];
    if (row.done && next && !next.kg) next.kg = row.kg;
    persistActiveWorkout();
    renderWorkoutCard(exId);
    updateWorkoutClock();
    haptic();
    if (row.done) {
        const rowEl = document.getElementById(`set_${exId}_${i}`);
        if (rowEl) rowEl.classList.add('pop');
        floatXp(rowEl && rowEl.querySelector('.set-check'), SET_XP);
        startRest(getPrescription(workoutExercise(exId)).restSec, nextUpLabel(exId));
        checkRecord(exId, i);
        setBadgeNudge();
    }
}

// A soft "+5 XP" rises from the tick, so XP builds visibly set by set
const SET_XP = 5;

function floatXp(anchor, amount) {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'xp-float';
    el.textContent = `+${amount} XP`;
    el.style.left = `${r.left + r.width / 2}px`;
    el.style.top = `${r.top}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
}

// ── New record: a set beyond the best ever logged for this exercise ──
// Shown once per exercise per workout (again only if a later set goes even higher).
function checkRecord(slot, i) {
    const ex = workoutExercise(slot);
    if (ex.assist) return;
    const row = activeWorkout.rows[slot][i];
    if (!(parseInt(row.reps) > 0)) return;
    const value = isRepsBased(ex) ? parseInt(row.reps) : displayToKg(row.kg);
    const prev = getBestKg(ex.id);
    if (!(value > 0) || prev === null) return;   // nothing logged before: nothing to beat yet
    const records = activeWorkout.records || (activeWorkout.records = {});
    if (value <= Math.max(prev, records[slot] || 0)) return;
    records[slot] = value;
    persistActiveWorkout();
    showRecord(ex, value, prev);
}

let recordTimer = null;

function showRecord(ex, value, prev) {
    const repsBased = isRepsBased(ex);
    const gain = repsBased ? `+${value - prev} reps` : `+${kgToDisplay(value - prev)} ${unitLabel('kg')}`;
    queueMoment(() => showMoment({
        kicker: 'New record',
        valueHtml: escapeHtml(repsBased ? String(value) : kgToDisplay(value)),
        unit: repsBased ? 'reps' : setWeightUnit(ex),
        name: exerciseDisplayName(ex, activeWorkout ? activeWorkout.week : 0),
        sub: `Previous best ${repsBased ? `${prev} reps` : `${kgToDisplay(prev)} ${setWeightUnit(ex)}`} · ${gain}`,
    }));
}

// Full-screen gold moment (new record, achievement); closes itself after a few seconds
function showMoment({ kicker, valueHtml, unit, name, sub, color = '', sound = 'record' }) {
    // A badge moment takes its metal's colour; everything else is gold
    document.querySelector('#recordMoment .rr-fg').style.stroke = color;
    document.querySelector('#recordMoment .record-kicker').style.color = color;
    document.querySelector('#recordMoment .record-kicker').textContent = kicker;
    document.getElementById('recordValue').innerHTML = valueHtml;
    document.getElementById('recordUnit').textContent = unit;
    document.getElementById('recordName').textContent = name;
    document.getElementById('recordPrev').textContent = sub;
    const el = document.getElementById('recordMoment');
    el.classList.remove('show');
    void el.offsetWidth;   // restart the animation
    el.classList.add('show');
    playSound(sound);
    haptic();
    if (navigator.vibrate) navigator.vibrate([18, 90, 30]);
    clearTimeout(recordTimer);
    recordTimer = setTimeout(closeRecord, 3400);
}

function closeRecord() {
    clearTimeout(recordTimer);
    document.getElementById('recordMoment').classList.remove('show');
    setTimeout(nextMoment, 450);
}


// What the rest alert says is coming next: another set of this exercise, or the next exercise
function nextUpLabel(exId) {
    const ids = Object.keys(activeWorkout.rows);
    const left = activeWorkout.rows[exId].filter(r => !r.done).length;
    if (left) return `${workoutExercise(exId).name} · ${left} set${left === 1 ? '' : 's'} left`;
    const nextId = ids.slice(ids.indexOf(exId) + 1).concat(ids).find(id => activeWorkout.rows[id].some(r => !r.done));
    return nextId ? `Next up: ${workoutExercise(nextId).name}` : 'Last set done — finish your workout';
}

function addSet(exId) {
    const rows = activeWorkout.rows[exId];
    const last = rows[rows.length - 1];
    rows.push({ kg: last ? last.kg : '', reps: '', target: last ? last.target : '', done: false });
    persistActiveWorkout();
    renderWorkoutCard(exId);
}

function renderWorkoutCard(exId) {
    // Re-render one card in place (keeps scroll position)
    const scroll = window.scrollY;
    const temp = document.createElement('div');
    const ex = workoutExercise(exId);
    const rows = activeWorkout.rows[exId];
    const card = document.getElementById(`wo_${exId}`);
    temp.innerHTML = rows.map((row, i) => setRowHtml(ex, i, row, exId)).join('');
    updatePlates(exId);
    card.querySelectorAll('.set-row').forEach(el => el.remove());
    const addBtn = card.querySelector('.wo-add');
    [...temp.children].forEach(el => card.insertBefore(el, addBtn));
    window.scrollTo(0, scroll);
    const before = document.querySelector('.wo-card.current');
    const current = updateWorkoutFocus();
    // Finished an exercise: glide to the next one
    if (current && before && before.id !== `wo_${current}`) {
        const next = document.getElementById(`wo_${current}`);
        const top = next.getBoundingClientRect().top + window.scrollY - 96;
        window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
}

function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function updateWorkoutClock() {
    if (!activeWorkout) return;
    const secs = Math.floor((Date.now() - activeWorkout.startedAt) / 1000);
    const clock = secs >= 3600
        ? `${Math.floor(secs / 3600)}:${String(Math.floor(secs / 60) % 60).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
        : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const done = Object.values(activeWorkout.rows).flat().filter(r => r.done).length;
    const total = Object.values(activeWorkout.rows).flat().length;
    document.getElementById('workoutSub').textContent = `${clock} · ${done}/${total} sets`;
    document.getElementById('workoutProgress').style.width = `${total ? (done / total) * 100 : 0}%`;
}
setInterval(updateWorkoutClock, 1000);

function cancelWorkout() {
    if (!confirm('Discard this workout? Sets you checked off will not be saved.')) return;
    clearActiveWorkout();
    showScreen('app');
    renderToday();
}

function finishWorkout() {
    const w = activeWorkout;
    const doneSets = Object.values(w.rows).flat().filter(r => r.done && parseInt(r.reps) > 0).length;
    if (!doneSets) {
        if (confirm('No sets are checked off yet. Discard this workout?')) cancelWorkout();
        return;
    }

    const data = progData();
    const date = todayStr();
    const tierUps = [];
    const prs = [];
    // What the summary screen shows (display units)
    const xpBefore = playerXp(playerStats());
    const records = [];
    const exercises = [];
    let volume = 0;

    Object.entries(w.rows).forEach(([slot, rows]) => {
        // A swapped-in exercise logs under its own id and doesn't count toward the original's tiers
        const ex = workoutExercise(slot);
        const exId = ex.id;
        const swapped = exId !== slot;
        const done = rows.filter(r => r.done && parseInt(r.reps) > 0);
        if (!done.length) return;

        const sets = done.map(r => ({ kg: String(displayToKg(r.kg) || 0), reps: String(parseInt(r.reps)), ...(r.rir !== undefined ? { rir: String(r.rir) } : {}) }));
        // The tracked number: heaviest set, most reps for pull-ups, or least assistance on assisted machines
        const value = isRepsBased(ex) ? Math.max(...sets.map(s => +s.reps))
            : ex.assist ? Math.min(...sets.map(s => +s.kg))
            : Math.max(...sets.map(s => +s.kg));
        if (!(value > 0) && !ex.assist) return;

        const prevBest = getBestKg(exId);
        const prevTier = getTier(ex, prevBest);
        const repsBased = isRepsBased(ex);
        const unit = repsBased ? 'reps' : setWeightUnit(ex);
        if (!repsBased && !ex.assist) volume += sets.reduce((sum, s) => sum + kgToDisplay(+s.kg) * +s.reps, 0);
        exercises.push({ name: exerciseDisplayName(ex, w.week), sets: sets.length, reps: sets.map(s => +s.reps),
            top: repsBased ? value : kgToDisplay(value), unit, assist: !!ex.assist });
        if (!data[exId]) data[exId] = {};
        const existing = parseFloat(entryKg(data[exId][w.week]));
        const kept = ex.assist ? value : Math.max(value, isNaN(existing) ? 0 : existing);
        data[exId][w.week] = { kg: String(kept), sets, date, ...(w.deload && isNaN(existing) ? { deload: true } : {}) };

        if (!ex.assist && prevBest !== null && value > prevBest) {
            prs.push(exerciseDisplayName(ex, w.week));
            records.push({ name: exerciseDisplayName(ex, w.week), value: repsBased ? value : kgToDisplay(value), unit,
                gain: repsBased ? value - prevBest : kgToDisplay(value) - kgToDisplay(prevBest) });
        }
        if (swapped) return;
        const newTier = getTier(ex, getBestKg(exId));
        if (newTier > prevTier) tierUps.push({ ex, tier: newTier });
    });

    ensureCycleStart(w.week);
    const minutes = Math.max(1, Math.round((Date.now() - w.startedAt) / 60000));
    const swaps = Object.entries(w.swaps || {}).map(([slot, swap]) => ({ from: slot, to: swap.name }));
    const efforts = Object.values(w.rows).flat().filter(r => r.done && r.rir !== undefined).map(r => Number(r.rir));
    programSessions().push({ date, day: w.day, week: w.week, type: 'workout', minutes, sets: doneSets, startHour: new Date(w.startedAt).getHours(),
        ...(swaps.length ? { swaps } : {}), ...(efforts.length ? { efforts } : {}),
        ...(w.deload ? { deload: true } : {}), ...(w.readiness ? { readiness: w.readiness.level } : {}) });
    checkDeload();

    clearActiveWorkout();
    haptic();
    todayDay = null;
    todayWeek = null;
    scheduleSave();
    flushSave();

    summaryOpen = true;   // set before Today renders, so badge moments it queues wait for the summary
    showScreen('app');
    switchTab('today');

    const xpAfter = playerXp(playerStats());
    openSummary({
        program: w.program, day: PROGRAMS[w.program].days[w.day], week: w.week, date, minutes, sets: doneSets,
        volume: Math.round(volume), units: usesLb() ? 'lb' : 'kg', records, exercises,
        tierUps: tierUps.map(t => ({ name: exerciseDisplayName(t.ex, w.week), tier: t.tier })),
        xpGained: Math.max(0, xpAfter.total - xpBefore.total), xp: xpAfter, levelUp: xpAfter.level > xpBefore.level,
        deload: !!w.deload,
    });
}

// ── Rest timer (time-based, so it stays right if the phone sleeps) ──
let rest = { endAt: 0, total: 0, interval: null, beeped: false };

function startRest(seconds, label = '') {
    rest.total = seconds;
    rest.endAt = Date.now() + seconds * 1000;
    rest.beeped = false;
    rest.label = label;
    document.getElementById('restNext').textContent = label;
    scheduleRestPush();
    clearInterval(rest.interval);
    rest.interval = setInterval(tickRest, 250);
    const bar = document.getElementById('restBar');
    bar.classList.remove('done');
    bar.classList.add('show');
    tickRest();
}

function adjustRest(delta) {
    if (!rest.interval) return;
    rest.endAt += delta * 1000;
    rest.total = Math.max(1, rest.total + delta);
    haptic();
    scheduleRestPush();
    if (rest.endAt > Date.now()) {
        rest.beeped = false;
        document.getElementById('restBar').classList.remove('done');
    }
    tickRest();
}

function stopRest() {
    if (rest.interval) {
        cancelRestPush();
        clearRestFromLockScreen();
    }
    clearInterval(rest.interval);
    rest.interval = null;
    const bar = document.getElementById('restBar');
    if (bar) bar.classList.remove('show', 'done');
}

function tickRest() {
    const remaining = Math.max(0, Math.ceil((rest.endAt - Date.now()) / 1000));
    document.getElementById('restTime').textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
    document.getElementById('restFill').style.width = `${(remaining / rest.total) * 100}%`;
    if (remaining > 0 && remaining <= 3 && rest.lastTick !== remaining && document.visibilityState === 'visible') {
        rest.lastTick = remaining;
        playSound('tick');
    }
    if (remaining === 0 && !rest.beeped) {
        rest.beeped = true;
        document.getElementById('restBar').classList.add('done');
        document.getElementById('restTime').textContent = 'GO!';
        beep();
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        // Seen on screen already, so skip the lock-screen alert
        if (document.visibilityState === 'visible') cancelRestPush();
        setTimeout(() => { if (rest.beeped) stopRest(); }, 5000);
    }
}

// ── Swap an exercise for today (machine taken, sore joint…) ──

// Alternatives per exercise: [name, unit, barbell?]
const SWAPS = {
    'db-bench': [['Barbell Bench Press', 'kg', true], ['Machine Chest Press', 'kg'], ['Smith Machine Bench', 'kg']],
    'bench-press': [['DB Bench Press', 'kg/DB'], ['Machine Chest Press', 'kg'], ['Smith Machine Bench', 'kg']],
    'chest-press-machine': [['DB Bench Press', 'kg/DB'], ['Smith Machine Bench', 'kg']],
    'seated-db-shoulder-press': [['Machine Shoulder Press', 'kg'], ['Barbell Overhead Press', 'kg', true], ['Arnold Press', 'kg/DB']],
    'seated-shoulder-press': [['Machine Shoulder Press', 'kg'], ['Arnold Press', 'kg/DB']],
    'db-shoulder-press': [['Machine Shoulder Press', 'kg'], ['Arnold Press', 'kg/DB']],
    'overhead-press': [['Seated DB Shoulder Press', 'kg/DB'], ['Machine Shoulder Press', 'kg']],
    'db-incline-press': [['Incline Barbell Press', 'kg', true], ['Incline Machine Press', 'kg'], ['Low-to-High Cable Fly', 'kg']],
    'lying-cable-lateral-raise': [['Cable Lateral Raise', 'kg/side'], ['DB Lateral Raise', 'kg/DB'], ['Machine Lateral Raise', 'kg']],
    'cable-lateral-raise': [['DB Lateral Raise', 'kg/DB'], ['Machine Lateral Raise', 'kg']],
    'cable-overhead-tri-ext': [['Rope Pressdown', 'kg'], ['DB Overhead Extension', 'kg/DB'], ['EZ-Bar Skull Crusher', 'kg']],
    'pull-ups': [['Lat Pulldown', 'kg'], ['Assisted Pull-Up Machine', 'kg assist', false, true], ['Chin-Ups', 'reps/+kg']],
    'lat-pulldown-wide': [['Assisted Pull-Up Machine', 'kg assist', false, true], ['Single-Arm Cable Pulldown', 'kg'], ['Pull-Ups', 'reps/+kg']],
    'db-incline-row': [['Chest-Supported Machine Row', 'kg'], ['Seated Cable Row', 'kg'], ['One-Arm DB Row', 'kg/DB']],
    'barbell-row': [['Chest-Supported Machine Row', 'kg'], ['Seated Cable Row', 'kg'], ['DB Incline Row', 'kg/DB']],
    'seated-cable-high-row': [['Face Pull', 'kg'], ['Machine High Row', 'kg']],
    'cable-straight-arm-pulldown': [['DB Pullover', 'kg/DB'], ['Lat Pulldown', 'kg']],
    'seated-db-incline-curl': [['Cable Curl', 'kg'], ['EZ-Bar Curl', 'kg'], ['Preacher Curl Machine', 'kg']],
    'arm-isolation': [['DB Curl', 'kg/DB'], ['Overhead Cable Extension', 'kg']],
    'leg-extension': [['Single-Leg Extension', 'kg'], ['Goblet Squat', 'kg/DB']],
    'back-squat': [['Leg Press', 'kg'], ['Hack Squat', 'kg'], ['Smith Machine Squat', 'kg']],
    'hack-squat': [['Leg Press (feet low)', 'kg'], ['Smith Machine Squat', 'kg'], ['Barbell Back Squat', 'kg', true]],
    'quad-leg-press': [['Hack Squat', 'kg'], ['Smith Machine Squat', 'kg']],
    'goblet-squat': [['Leg Press', 'kg'], ['Smith Machine Squat', 'kg']],
    'barbell-rdl': [['DB Romanian Deadlift', 'kg/DB'], ['Smith Machine RDL', 'kg'], ['45° Back Extension', 'kg+']],
    'rdl': [['DB Romanian Deadlift', 'kg/DB'], ['Smith Machine RDL', 'kg'], ['45° Back Extension', 'kg+']],
    'lying-leg-curl': [['Seated Leg Curl', 'kg'], ['Stability Ball Leg Curl', 'kg+']],
    'seated-leg-curl': [['Lying Leg Curl', 'kg'], ['Stability Ball Leg Curl', 'kg+']],
    'hip-thrust': [['Machine Hip Thrust', 'kg'], ['Smith Machine Hip Thrust', 'kg'], ['Barbell Glute Bridge', 'kg', true]],
    'kas-glute-bridge': [['Barbell Hip Thrust', 'kg', true], ['Machine Hip Thrust', 'kg'], ['Smith Machine Glute Bridge', 'kg']],
    'hyperextensions': [['Reverse Hyperextension', 'kg+'], ['Cable Pull-Through', 'kg']],
    'reverse-lunge': [['Bulgarian Split Squat', 'kg/DB'], ['Walking Lunge', 'kg/DB'], ['Smith Machine Reverse Lunge', 'kg']],
    'glute-med-kickback': [['Cable Hip Abduction', 'kg'], ['Machine Hip Abduction', 'kg']],
    'single-leg-calf-raise': [['Standing Calf Raise Machine', 'kg'], ['Leg Press Calf Raise', 'kg']],
    'standing-calf-raise-a': [['Seated Calf Raise', 'kg'], ['Leg Press Calf Raise', 'kg'], ['Single-Leg Calf Raise', 'kg/DB']],
    'standing-calf-raise-c': [['Seated Calf Raise', 'kg'], ['Leg Press Calf Raise', 'kg'], ['Single-Leg Calf Raise', 'kg/DB']],
    'cable-crunch': [['Machine Crunch', 'kg'], ['Hanging Knee Raise', 'kg+']],
    // Wayfarer (3-Day Full Body): alternatives keep the same movement pattern (spec section 5)
    'goblet-box-squat': [['Goblet Squat', 'kg/DB'], ['Smith Machine Box Squat', 'kg'], ['Barbell Box Squat', 'kg', true]],
    'incline-db-press': [['Incline Machine Press', 'kg'], ['Flat DB Press', 'kg/DB'], ['Push-Ups', 'reps/+kg']],
    'lat-pulldown': [['Assisted Pull-Up Machine', 'kg assist', false, true], ['Single-Arm Cable Pulldown', 'kg']],
    'pallof-press': [['Cable Anti-Rotation Hold', 'kg'], ['Dead Bug', 'reps/+kg']],
    'db-rdl': [['Barbell RDL', 'kg', true], ['Cable Pull-Through', 'kg'], ['45° Back Extension', 'kg+']],
    'seated-db-ohp': [['Machine Shoulder Press', 'kg'], ['Landmine Press', 'kg']],
    'chest-supported-row': [['Seated Cable Row', 'kg'], ['One-Arm DB Row', 'kg/DB']],
    'static-split-squat': [['Bulgarian Split Squat', 'kg/DB'], ['Reverse Lunge', 'kg/DB']],
    'reverse-incline-crunch': [['Hanging Knee Raise', 'reps/+kg'], ['Cable Crunch', 'kg']],
    'rack-pull': [['DB Deadlift', 'kg/DB'], ['Barbell RDL', 'kg', true]],
    'machine-chest-press': [['Push-Ups', 'reps/+kg'], ['DB Bench Press', 'kg/DB']],
    'single-arm-row': [['Assisted Pull-Up Machine', 'kg assist', false, true], ['Chest-Supported Row', 'kg']],
    'slow-step-up': [['Static Split Squat', 'kg/DB'], ['Reverse Lunge', 'kg/DB']],
    'suitcase-carry': [['Farmer Carry', 'kg/DB'], ['Single-Arm DB Hold', 'kg/DB']],
};

let swapSlot = null;

function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'custom';
}

function openSwap(slot) {
    swapSlot = slot;
    const original = getExercise(slot);
    const current = workoutExercise(slot);
    document.getElementById('swapIntro').textContent = `Today only. ${original.name}'s own history and tier stay untouched.`;
    const options = (SWAPS[original.swapKey || slot] || []).map(([name, unit], i) => `
        <button class="swap-option${current.name === name ? ' active' : ''}" onclick="chooseSwap(${i})">
            <span>${escapeHtml(name)}</span><small>${escapeHtml(unitLabel(unit))}</small>
        </button>`).join('');
    const back = current.swappedFrom
        ? `<button class="swap-option" onclick="applySwap(null)"><span>Back to ${escapeHtml(original.name)}</span><small>original</small></button>`
        : '';
    document.getElementById('swapList').innerHTML = back + options;
    document.getElementById('swapCustomName').value = '';
    document.getElementById('swapModal').classList.add('active');
}

function closeSwap() {
    document.getElementById('swapModal').classList.remove('active');
    swapSlot = null;
}

function chooseSwap(i) {
    const [name, unit, bar, assist] = SWAPS[getExercise(swapSlot).swapKey || swapSlot][i];
    applySwap({ name, unit, bar: !!bar, assist: !!assist });
}

function swapCustom(event) {
    event.preventDefault();
    const name = document.getElementById('swapCustomName').value.trim();
    if (name) applySwap({ name, unit: getExercise(swapSlot).unit, bar: false });
}

function applySwap(alt) {
    const slot = swapSlot;
    if (!activeWorkout.swaps) activeWorkout.swaps = {};
    if (alt) activeWorkout.swaps[slot] = { id: `${slot}~${slugify(alt.name)}`, ...alt };
    else delete activeWorkout.swaps[slot];
    // Sets not done yet start from the new exercise's own last weight
    const { kg, target } = workoutPrefill(workoutExercise(slot));
    activeWorkout.rows[slot].forEach(row => {
        if (!row.done) {
            row.kg = kg;
            row.target = target;
        }
    });
    persistActiveWorkout();
    closeSwap();
    haptic();
    const scroll = window.scrollY;
    renderWorkout();
    window.scrollTo(0, scroll);
}

// ── Plate calculator for barbell lifts ──
const PLATES = { kg: [25, 20, 15, 10, 5, 2.5, 1.25], lb: [45, 35, 25, 10, 5, 2.5] };
const PLATE_STYLE = {
    kg: { 25: ['#8f3a33', 46], 20: ['#5a554d', 42], 15: ['#b38636', 36], 10: ['#8a6a45', 30], 5: ['#e6e0d4', 24], 2.5: ['#3a342e', 19], 1.25: ['#9a9184', 15] },
    lb: { 45: ['#5a554d', 46], 35: ['#b38636', 40], 25: ['#8a6a45', 34], 10: ['#e6e0d4', 27], 5: ['#3a342e', 21], 2.5: ['#9a9184', 16] },
};

// Plates per side for a total bar weight (display units): { bar, unit, plates, left }, { under } or null
function platesFor(total) {
    const unit = usesLb() ? 'lb' : 'kg';
    const bar = unit === 'lb' ? 45 : 20;
    if (!(total > 0)) return null;
    if (total < bar) return { under: true, bar, unit };
    let side = (total - bar) / 2;
    const plates = [];
    PLATES[unit].forEach(p => {
        while (side >= p - 1e-9) {
            plates.push(p);
            side -= p;
        }
    });
    return { bar, unit, plates, left: Math.round(side * 2 * 100) / 100 };
}

function platesHtml(slot) {
    const ex = workoutExercise(slot);
    if (!ex.bar) return '';
    const rows = activeWorkout.rows[slot];
    const row = rows.find(r => !r.done) || rows[rows.length - 1];
    const result = platesFor(parseFloat(row && row.kg));
    if (!result) return '<div class="plates-text">Enter a weight to see the plates</div>';
    if (result.under) return `<div class="plates-text">Lighter than the ${result.bar} ${result.unit} bar</div>`;
    const visual = result.plates.map(p => {
        const [color, height] = PLATE_STYLE[result.unit][p];
        return `<span class="plate" style="background:${color}; height:${height}px;" title="${p} ${result.unit}"></span>`;
    }).join('');
    const text = result.plates.length
        ? `Each side: <strong>${result.plates.map(String).join(' + ')}</strong> ${result.unit}`
        : 'Empty bar';
    return `
        <div class="plates-visual"><span class="bar-sleeve"></span>${visual}<span class="bar-collar"></span></div>
        <div class="plates-text">${text}<br><small>on a ${result.bar} ${result.unit} bar${result.left ? ` · ${result.left} ${result.unit} can't be loaded` : ''}</small></div>
    `;
}

function updatePlates(slot) {
    const el = document.getElementById(`plates_${slot}`);
    if (el) el.innerHTML = platesHtml(slot);
}

// ── Haptics ──
// Android: vibrate. iPhone has no vibrate API, but toggling a hidden switch-style checkbox
// gives a light haptic tick (iOS 18+). Only works inside a tap, which is when we call it.
let hapticSwitch = null;

function haptic() {
    try {
        if (navigator.vibrate) {
            navigator.vibrate(12);
            return;
        }
        if (!hapticSwitch) {
            hapticSwitch = document.createElement('label');
            hapticSwitch.style.display = 'none';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.setAttribute('switch', '');
            hapticSwitch.appendChild(input);
            document.body.appendChild(hapticSwitch);
        }
        hapticSwitch.click();
    } catch (e) { /* haptics are a nice-to-have */ }
}

// ── Lock-screen rest alerts (Web Push) ──
// While resting, the app stores "alert me at <time>" in Supabase (rest_timers). A Supabase
// scheduler checks every 5 seconds and the rest-push function sends the notification, so it
// arrives even with the phone locked. On iPhone this needs the app added to the Home Screen.
const VAPID_PUBLIC_KEY = 'BNHDAXYVLgIfxo_MejG0KQR_osA7hCFEgpRu8K4YZjYSPy0bKu4fZFGQmEHfZ6_Ot6IWQSPsZ3hOChnG3K015g4';

function pushKey() {
    return currentUser ? `wt_push_${currentUser.id}` : null;
}

function pushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function isIOS() {
    return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function restAlertsOn() {
    try {
        return pushSupported() && Notification.permission === 'granted' && localStorage.getItem(pushKey()) === '1';
    } catch (e) {
        return false;
    }
}

function base64UrlToBytes(value) {
    const padded = (value + '='.repeat((4 - value.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

function renderPushStatus() {
    const status = document.getElementById('pushStatus');
    const actions = document.getElementById('pushActions');
    let text;
    let buttons = '';
    if (!pushSupported()) {
        text = isIOS() && !isStandalone()
            ? 'Get a notification when rest is over, even with your phone locked. On iPhone this needs the app on your Home Screen: tap Share → Add to Home Screen, then open it from the new icon and come back here.'
            : 'This browser can\'t show rest alerts.';
    } else if (Notification.permission === 'denied') {
        text = 'Notifications are blocked for this app. Allow them in your phone\'s Settings → Notifications, then come back here.';
    } else if (restAlertsOn()) {
        text = 'On. You\'ll get a notification when rest is over, even with your phone locked.';
        buttons = '<button class="btn" onclick="testRestAlert()">Send a test alert</button><button class="btn" onclick="disableRestAlerts()">Turn off</button>';
    } else {
        text = 'Get a notification when rest is over, even with your phone locked.';
        buttons = '<button class="btn btn-primary" onclick="enableRestAlerts()">Turn on rest alerts</button>';
    }
    status.textContent = text;
    actions.innerHTML = buttons;
    renderNudgeSettings();
    const splashToggle = document.getElementById('splashToggle');
    if (splashToggle) splashToggle.checked = !splashOff();
    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) soundToggle.checked = soundsOn();
    const langSelect = document.getElementById('settingsLang');
    if (langSelect) langSelect.value = LANGUAGES[storedLang()] ? storedLang() : '';
}

async function enableRestAlerts() {
    haptic();
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            renderPushStatus();
            return;
        }
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
        });
        const { endpoint, keys } = subscription.toJSON();
        const { error } = await sb.from('push_subscriptions').upsert(
            { endpoint, user_id: currentUser.id, p256dh: keys.p256dh, auth: keys.auth },
            { onConflict: 'endpoint' }
        );
        if (error) throw error;
        localStorage.setItem(pushKey(), '1');
        showToast('Rest alerts on');
    } catch (error) {
        console.error('Rest alerts:', error);
        showSettingsError('Could not turn on rest alerts: ' + (error.message || error));
    }
    renderPushStatus();
}

async function disableRestAlerts() {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await sb.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
            await subscription.unsubscribe();
        }
    } catch (error) {
        console.warn('Rest alerts off:', error);
    }
    localStorage.removeItem(pushKey());
    renderPushStatus();
}

async function testRestAlert() {
    haptic();
    const { error } = await sb.from('rest_timers').upsert({
        user_id: currentUser.id,
        fire_at: new Date(Date.now() + 10000).toISOString(),
        title: tr('Test alert'),
        body: tr('Rest alerts work. Lock your phone during rest and this is what you\'ll see.'),
    }, { onConflict: 'user_id' });
    showToast(error ? 'Could not schedule the test: ' + error.message : 'Test alert in about 10 seconds. Lock your phone to try it.');
}

// Fire-and-forget: a missed alert must never block the workout
function scheduleRestPush() {
    if (!restAlertsOn() || !currentUser) return;
    sb.from('rest_timers').upsert({
        user_id: currentUser.id,
        fire_at: new Date(rest.endAt).toISOString(),
        title: tr('Rest over'),
        body: tr(rest.label || 'Time for your next set'),
    }, { onConflict: 'user_id' }).then(({ error }) => { if (error) console.warn('Rest alert not scheduled:', error.message); });
}

// Lock screen during rest: web apps can't show a live countdown there (that is a native Live Activity),
// so when the phone locks mid-rest a quiet notification shows when the rest ends and what's next.
// It shares the tag of the "Rest over" push, which replaces it when the time is up.
async function showRestOnLockScreen() {
    if (!restAlertsOn() || !rest.interval || rest.endAt - Date.now() < 3000) return;
    if (!('serviceWorker' in navigator) || !('Notification' in window) || Notification.permission !== 'granted') return;
    try {
        const reg = await navigator.serviceWorker.ready;
        const at = new Date(rest.endAt).toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' });
        await reg.showNotification(tr(`Rest · next set at ${at}`), {
            body: tr(rest.label || 'Time for your next set'),
            tag: 'rest-timer',
            silent: true,
            icon: 'icons/icon-192.png',
            badge: 'icons/icon-192.png',
            data: { restEndsAt: rest.endAt },
        });
    } catch (error) {
        console.warn('Rest not shown on the lock screen:', error.message || error);
    }
}

async function clearRestFromLockScreen() {
    if (!('serviceWorker' in navigator)) return;
    try {
        const reg = await navigator.serviceWorker.ready;
        (await reg.getNotifications({ tag: 'rest-timer' })).forEach(n => n.close());
    } catch (error) { /* nothing to clear */ }
}

function cancelRestPush() {
    if (!restAlertsOn() || !currentUser) return;
    sb.from('rest_timers').delete().eq('user_id', currentUser.id)
        .then(({ error }) => { if (error) console.warn('Rest alert not cancelled:', error.message); });
}

