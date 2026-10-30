// ════════════════════════════════════════════
//  CARDIO PROGRAMS + guided cardio sessions (v1.68)
//  Programs whose days are timed sessions instead of lifts. A finished session is logged twice: as a
//  workout (streaks, XP, leagues, quests, rotation) and as cardio minutes (the Cardio ring, zones).
// ════════════════════════════════════════════

const toSec = m => Math.round(m * 60);

// A block: { label, sec, zone }. `rows` is the short plan shown on Today.
function block(label, minutes, zone) {
    return { label, sec: toSec(minutes), zone };
}

function repeatBlocks(times, pair) {
    return Array.from({ length: times }, () => pair).flat();
}

// Run / walk progression for First Stride: [repeats, run minutes, walk minutes] by week
const STRIDE_WEEKS = [
    [8, 1, 1.5], [6, 1.5, 1.5], [6, 2, 1.5], [5, 3, 1.5], [4, 4, 1.5], [3, 6, 1.5],
    [3, 8, 1.5], [2, 12, 2], [2, 15, 1.5], null, null, null,
];

Object.assign(PROGRAMS, {
    horizon: {
        name: 'Horizon',
        level: 1, perWeek: '3 days a week', equipment: 'Outdoors or machine',   // shown the same way on every program card
        subtitle: 'Zone 2 base · 3 days',
        type: 'cardio',
        days: ['Easy', 'Steady', 'Long'],
        exercises: [],
        session(day, week) {
            const grow = Math.min(week, 11);
            if (day === 0) {
                const main = Math.min(50, 25 + grow * 2.5);
                return { blocks: [block('Warm-up', 5, 1), block('Zone 2', main, 2), block('Cool-down', 5, 1)], rows: [['Warm-up', '5 min · Zone 1'], ['Zone 2', `${main} min`], ['Cool-down', '5 min · Zone 1']] };
            }
            if (day === 1) {
                const main = Math.min(40, 20 + grow * 2);
                return { blocks: [block('Warm-up', 5, 1), block('Zone 2', main, 2), ...repeatBlocks(4, [block('Stride', 0.33, 4), block('Easy', 1.67, 1)]), block('Cool-down', 5, 1)],
                    rows: [['Warm-up', '5 min · Zone 1'], ['Zone 2', `${main} min`], ['4 strides', '20 s quick, 100 s easy'], ['Cool-down', '5 min · Zone 1']] };
            }
            const main = Math.min(90, 40 + grow * 5);
            return { blocks: [block('Warm-up', 5, 1), block('Zone 2', main, 2), block('Cool-down', 5, 1)], rows: [['Warm-up', '5 min · Zone 1'], ['Long Zone 2', `${main} min`], ['Cool-down', '5 min · Zone 1']] };
        },
    },
    tempest: {
        name: 'Tempest',
        level: 2, perWeek: '3 days a week', equipment: 'Outdoors or machine',   // shown the same way on every program card
        subtitle: 'Intervals · tempo · easy · 3 days',
        type: 'cardio',
        days: ['Intervals', 'Tempo', 'Easy'],
        exercises: [],
        session(day, week) {
            if (day === 0) {
                const reps = week < 4 ? 3 : 4;
                const hard = week < 8 ? 4 : 4.5;
                return { blocks: [block('Warm-up', 10, 2), ...repeatBlocks(reps, [block('Hard', hard, 4), block('Recover', 3, 1)]), block('Cool-down', 5, 1)],
                    rows: [['Warm-up', '10 min · Zone 2'], [`${reps} × ${hard} min hard`, 'Zone 4, 3 min easy between'], ['Cool-down', '5 min · Zone 1']] };
            }
            if (day === 1) {
                const tempo = Math.min(32, 15 + Math.round(week * 1.5));
                return { blocks: [block('Warm-up', 10, 2), block('Tempo', tempo, 3), block('Cool-down', 5, 1)], rows: [['Warm-up', '10 min · Zone 2'], ['Tempo', `${tempo} min · Zone 3`], ['Cool-down', '5 min · Zone 1']] };
            }
            const main = Math.min(50, 30 + week * 2);
            return { blocks: [block('Zone 2', main, 2)], rows: [['Easy Zone 2', `${main} min`]] };
        },
    },
    firstStride: {
        name: 'First Stride',
        level: 1, perWeek: '3 days a week', equipment: 'Running shoes',   // shown the same way on every program card
        subtitle: 'Walk to a 30-minute run · 3 days',
        type: 'cardio',
        days: ['Day A', 'Day B', 'Day C'],
        exercises: [],
        session(day, week) {
            const w = Math.min(week, 11);
            const warm = [block('Brisk walk', 5, 1)];
            const cool = [block('Walk', 5, 1)];
            const plan = STRIDE_WEEKS[w];
            if (plan) {
                const [times, run, walk] = plan;
                return { blocks: [...warm, ...repeatBlocks(times, [block('Run', run, 3), block('Walk', walk, 1)]), ...cool],
                    rows: [['Brisk walk', '5 min'], [`${times} × run ${run} min`, `walk ${walk} min between`], ['Walk', '5 min']] };
            }
            const runs = w === 9 ? [20, 5] : w === 10 ? [25] : [30];
            const blocks = runs.length === 2 ? [block('Run', 20, 3), block('Walk', 2, 1), block('Run', 5, 3)] : [block('Run', runs[0], 3)];
            return { blocks: [...warm, ...blocks, ...cool],
                rows: [['Brisk walk', '5 min'], [runs.length === 2 ? 'Run 20 min, walk 2, run 5' : `Run ${runs[0]} min`, 'Easy pace, you can talk'], ['Walk', '5 min']] };
        },
    },
});

function isCardioProgram(prog = PROGRAMS[currentProgram]) {
    return !!(prog && prog.type === 'cardio');
}

function cardioSessionFor(prog, day, week) {
    const s = prog.session(day, week);
    const sec = s.blocks.reduce((sum, b) => sum + b.sec, 0);
    // The session's headline zone: where the work happens (most time at Zone 2 or above), not the walking
    const byZone = {};
    s.blocks.forEach(b => { if (b.zone >= 2) byZone[b.zone] = (byZone[b.zone] || 0) + b.sec; });
    const work = Object.entries(byZone).sort((a, b) => b[1] - a[1])[0];
    return { ...s, minutes: Math.round(sec / 60), zone: work ? +work[0] : 1 };
}

function zoneBpm(zone) {
    const z = CARDIO_ZONES.find(c => c.zone === zone);
    const hr = estimatedMaxHr();
    return z ? `${Math.round(hr * z.pct[0] / 100)}–${Math.round(hr * z.pct[1] / 100)} bpm` : '';
}

// ── Today: the day's session instead of an exercise list ──
function renderCardioDay(prog, week, nextDay) {
    const s = cardioSessionFor(prog, todayDay, week);
    const weekOptions = Array.from({ length: WEEKS }, (_, w) =>
        `<option value="${w}"${w === week ? ' selected' : ''}>Week ${w + 1}</option>`).join('');
    document.getElementById('todayMeta').innerHTML = `${s.minutes} min · Zone ${s.zone} · <select class="week-select" onchange="selectTodayWeek(this.value)">${weekOptions}</select>`;
    document.getElementById('todayMuscles').innerHTML = '';
    document.getElementById('warmupCard').innerHTML = '';
    document.getElementById('todayHint').textContent = `Zone ${s.zone} for you: ${zoneBpm(s.zone)}`;
    document.getElementById('todayList').innerHTML = s.rows.map(([title, detail], idx) => `
        <div class="today-item" style="--i:${idx}">
            <div class="today-item-main">
                <div class="today-item-name">${escapeHtml(title)}</div>
                <div class="today-item-sub">${escapeHtml(detail)}</div>
            </div>
        </div>`).join('');
    const btn = document.getElementById('startWorkoutBtn');
    btn.setAttribute('onclick', 'startCardioSession()');
    const active = loadCardioRun();
    btn.innerHTML = active
        ? `${PLAY_ICON} Resume ${escapeHtml(prog.days[active.day])} session`
        : `${PLAY_ICON} ${todayDay === nextDay ? 'Start session' : `Start ${escapeHtml(prog.days[todayDay])} instead`}`;
    btn.classList.toggle('secondary', !active && todayDay !== nextDay);
}

// ── Guided session: blocks, countdown, beeps between blocks, screen kept awake ──
let cardioRun = null;   // { program, day, week, blocks, startedAt, pausedMs, pausedAt }
let cardioTimer = null;
let cardioWake = null;

function cardioRunKey() {
    return `wt_active_cardio_${currentUser ? currentUser.id : ''}`;
}

function loadCardioRun() {
    try {
        const run = JSON.parse(localStorage.getItem(cardioRunKey()) || 'null');
        return run && run.program === currentProgram ? run : null;
    } catch (e) { return null; }
}

function saveCardioRun() {
    try {
        if (cardioRun) localStorage.setItem(cardioRunKey(), JSON.stringify(cardioRun));
        else localStorage.removeItem(cardioRunKey());
    } catch (e) { /* private mode */ }
}

function startCardioSession() {
    haptic();
    unlockAudio();
    cardioRun = loadCardioRun();
    if (!cardioRun) {
        const prog = PROGRAMS[currentProgram];
        const week = todayWeek !== null ? todayWeek : getCurrentWeek();
        const s = cardioSessionFor(prog, todayDay, week);
        cardioRun = { program: currentProgram, day: todayDay, week, blocks: s.blocks, zone: s.zone, startedAt: Date.now(), pausedMs: 0, pausedAt: null, lastBlock: 0 };
        saveCardioRun();
    }
    showScreen('cardio');
    keepAwake(true);
    clearInterval(cardioTimer);
    cardioTimer = setInterval(tickCardio, 250);
    tickCardio();
}

async function keepAwake(on) {
    try {
        if (on && navigator.wakeLock && !cardioWake) cardioWake = await navigator.wakeLock.request('screen');
        if (!on && cardioWake) { await cardioWake.release(); cardioWake = null; }
    } catch (e) { cardioWake = null; }
}

function cardioElapsed(run = cardioRun, now = Date.now()) {
    return Math.max(0, (now - run.startedAt - run.pausedMs - (run.pausedAt ? now - run.pausedAt : 0)) / 1000);
}

// Where the session is: { index, block, left (s), total (s) }
function cardioPosition(run = cardioRun) {
    const elapsed = cardioElapsed(run);
    const total = run.blocks.reduce((sum, b) => sum + b.sec, 0);
    let t = 0;
    for (let i = 0; i < run.blocks.length; i++) {
        t += run.blocks[i].sec;
        if (elapsed < t) return { index: i, block: run.blocks[i], left: t - elapsed, elapsed, total };
    }
    return { index: run.blocks.length, block: null, left: 0, elapsed, total };
}

function clock(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function tickCardio() {
    if (!cardioRun) return;
    const pos = cardioPosition();
    // A new block: a clear signal, even with the phone in a pocket
    if (pos.index !== cardioRun.lastBlock) {
        cardioRun.lastBlock = pos.index;
        saveCardioRun();
        playSound('rest');
        haptic();
        if (navigator.vibrate) navigator.vibrate([60, 80, 60]);
    } else if (pos.block && !cardioRun.pausedAt && pos.left <= 3 && pos.left > 0 && document.visibilityState === 'visible') {
        const second = Math.ceil(pos.left);
        if (second !== cardioRun.lastTick) { cardioRun.lastTick = second; playSound('tick'); }
    }
    if (!pos.block) return finishCardioSession(true);
    renderCardioRun(pos);
}

function renderCardioRun(pos) {
    const prog = PROGRAMS[cardioRun.program];
    const next = cardioRun.blocks[pos.index + 1];
    const b = pos.block;
    document.getElementById('cardioTitle').textContent = prog.days[cardioRun.day];
    document.getElementById('cardioSub').textContent = `${clock(pos.elapsed)} · ${clock(pos.total)}`;
    document.getElementById('cardioProgress').style.width = `${Math.min(100, (pos.elapsed / pos.total) * 100)}%`;
    const zone = CARDIO_ZONES.find(z => z.zone === b.zone);
    const body = document.getElementById('cardioBody');
    const html = `
        <div class="cr-stage" style="--zone:${zone ? zone.color : 'var(--accent)'}">
            <div class="cr-kicker">Block ${pos.index + 1} of ${cardioRun.blocks.length}</div>
            <div class="cr-label">${escapeHtml(b.label)}</div>
            <div class="cr-zone">Zone ${b.zone} · ${escapeHtml(zoneBpm(b.zone))}</div>
            <div class="cr-clock">${clock(pos.left)}</div>
            <div class="cr-talk">${zone ? escapeHtml(zone.talk) : ''}</div>
        </div>
        ${next ? `<div class="cr-next">Next: <strong>${escapeHtml(next.label)}</strong> · ${clock(next.sec)} · Zone ${next.zone}</div>` : '<div class="cr-next">Last block</div>'}
        <div class="cr-controls">
            <button class="btn" onclick="skipCardioBlock()">Skip block</button>
            <button class="btn btn-primary" onclick="toggleCardioPause()">${cardioRun.pausedAt ? 'Resume' : 'Pause'}</button>
        </div>
        <button class="back-link" onclick="finishCardioSession(false)">Finish now</button>`;
    // Only touch the page when something visible changed (the clock), so taps aren't lost
    if (body.dataset.html !== html) {
        body.innerHTML = html;
        body.dataset.html = html;
    }
}

function toggleCardioPause() {
    haptic();
    if (cardioRun.pausedAt) {
        cardioRun.pausedMs += Date.now() - cardioRun.pausedAt;
        cardioRun.pausedAt = null;
    } else {
        cardioRun.pausedAt = Date.now();
    }
    saveCardioRun();
    tickCardio();
}

function skipCardioBlock() {
    haptic();
    const pos = cardioPosition();
    cardioRun.startedAt -= pos.left * 1000;   // jump to the start of the next block
    saveCardioRun();
    tickCardio();
}

function closeCardioSession() {
    if (!confirm('Stop this session without saving it?')) return;
    clearInterval(cardioTimer);
    keepAwake(false);
    cardioRun = null;
    saveCardioRun();
    showScreen('app');
    renderToday();
}

// Log the session: a workout (streaks, XP, leagues, rotation) and cardio minutes (the Cardio ring)
function finishCardioSession(completed) {
    if (!cardioRun) return;
    if (!completed && !confirm('Finish now and save what you did?')) return;
    clearInterval(cardioTimer);
    keepAwake(false);
    const run = cardioRun;
    const pos = cardioPosition(run);
    const minutes = Math.max(1, Math.round(pos.elapsed / 60));
    const prog = PROGRAMS[run.program];
    const date = todayStr();
    const leaguesBefore = journey().total;
    ensureCycleStart(run.week);
    const sessions = programSessions();
    sessions.push({ date, day: run.day, week: run.week, type: 'workout', cardio: true, minutes, sets: 0, startHour: new Date(run.startedAt).getHours() });
    // Cardio minutes per zone actually done, so 12 hard minutes in an interval session count as hard and the rest as easy
    const byZone = {};
    let t = 0;
    run.blocks.forEach(b => {
        const done = Math.max(0, Math.min(b.sec, pos.elapsed - t));
        t += b.sec;
        if (done) byZone[b.zone] = (byZone[b.zone] || 0) + done;
    });
    Object.entries(byZone).forEach(([zone, sec]) => {
        const m = Math.round(sec / 60);
        if (m) sessions.push({ date, type: 'cardio', zone: +zone, name: `${prog.name} · ${prog.days[run.day]}`, minutes: m, planned: true });
    });
    cardioRun = null;
    saveCardioRun();
    todayDay = null;
    todayWeek = null;
    scheduleSave();
    flushSave();
    showScreen('app');
    switchTab('today');
    const gained = journey().total - leaguesBefore;
    playSound('complete');
    queueMoment(() => showMoment({ kicker: 'Session complete', valueHtml: String(minutes), unit: 'min', name: `${prog.name} · ${prog.days[run.day]}`,
        sub: `+${gained} leagues on your journey`, sound: 'complete' }));
    checkAchievements();
}
