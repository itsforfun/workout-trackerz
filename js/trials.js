// ════════════════════════════════════════════
//  TRIALS, CROSSROADS, RELICS (saga batch 2, v2.7): you take part in the journey.
//  Each stretch of road has a Trial measured from your log. Finishing it earns that stretch's Relic. A missed
//  Trial never blocks the road: it stays open and can be finished later. At Mirror Fjord and Stormreach the road
//  splits into three paths, and the path you choose sets the next three Trials and their story.
//  Stored in workout_data._saga = { paths: { "saga-crossroad": id }, trials: { "saga-stop": {…} } }.
// ════════════════════════════════════════════

const SAGA_PATHS = {
    mountain: { name: 'The Mountain', focus: 'Strength', line: 'Over the peaks. Thin air, heavy steps. Trials of strength.' },
    coast: { name: 'The Coast', focus: 'Endurance', line: 'Along the shore. Wind and long miles. Trials of endurance.' },
    forest: { name: 'The Forest', focus: 'Habits', line: 'Through the old woods. Quiet, daily work. Trials of habit.' },
};

const CROSSROADS = [
    { title: 'The road splits at the fjord', line: 'Three trails leave the water. The footprints go up all three. You can only walk one.',
      story: { mountain: 'You take the high trail. Snow above, the fjord shrinking below.', coast: 'You follow the shore, salt on your lips and the tide at your heels.', forest: 'You step under the pines. The road noise dies, and the forest listens.' } },
    { title: 'The storm splits the road', line: 'The old road is gone. Three ways lead on, and something waits on the far side.',
      story: { mountain: 'You climb above the storm, lightning below your boots.', coast: 'You walk the breakers, counting waves between the thunder.', forest: 'You shelter among the oaks and keep moving, tree by tree.' } },
];

// Stretches 0–2 and 9 are the same for everyone; 3–5 and 6–8 follow the path chosen
const TRIALS = {
    0: { name: 'Cold Start', kind: 'workouts', target: 2 },
    1: { name: 'Hold the Ledge', kind: 'record', target: 1 },
    2: { name: 'Still Water', kind: 'habits', target: 2 },
    9: { name: 'The Last Echo', kind: 'workouts', target: 4 },
};
const PATH_TRIALS = {
    mountain: [
        { name: 'The Steep Climb', kind: 'sets', target: 30 }, { name: 'The Thousandth Blow', kind: 'record', target: 1 }, { name: 'Stone by Stone', kind: 'workouts', target: 3 },
        { name: 'The Summit Wind', kind: 'sets', target: 45 }, { name: 'Iron Grip', kind: 'record', target: 2 }, { name: 'The High Road', kind: 'workouts', target: 4 },
    ],
    coast: [
        { name: 'Salt Air', kind: 'cardio', target: 45 }, { name: 'Tide Walker', kind: 'steps', target: 3 }, { name: 'Against the Wind', kind: 'cardio', target: 60 },
        { name: 'Breakers', kind: 'cardio', target: 75 }, { name: 'The Long Shore', kind: 'steps', target: 4 }, { name: 'The Far Light', kind: 'cardio', target: 90 },
    ],
    forest: [
        { name: 'Deep Roots', kind: 'habits', target: 2 }, { name: 'Quiet Steps', kind: 'steps', target: 3 }, { name: 'Moss and Stone', kind: 'habits', target: 3 },
        { name: 'Old Growth', kind: 'habits', target: 3 }, { name: 'The Wild Trail', kind: 'steps', target: 4 }, { name: 'Green Silence', kind: 'habits', target: 4 },
    ],
};

// One Relic per stretch, each stamped with a rune (lines in a 24 × 24 box)
const RELICS = [
    { name: 'Frost Thorn', line: 'It never melts, even in your hand.', rune: 'M8 4V20M8 7L16 4M8 12L16 9' },
    { name: 'Miner’s Nail', line: 'Forty years of hammering, in one bent nail.', rune: 'M8 4V20M8 5L16 12L16 20' },
    { name: 'Fjord Stone', line: 'Skipped once. It came back.', rune: 'M12 4V20M12 6L17 10L12 14M12 10L7 14' },
    { name: 'Ember Shard', line: 'Still warm, miles from any fire.', rune: 'M16 4L8 12L16 20' },
    { name: 'Grey Feather', line: 'Dropped from the tower, or left for you.', rune: 'M12 4V20M6 5L12 11L18 5' },
    { name: 'Storm Bell', line: 'It rings when everyone is still standing.', rune: 'M8 4V20M16 4V20M8 8L16 13M16 8L8 13' },
    { name: 'Wolf Fang', line: 'Given, not taken.', rune: 'M12 4V20M12 4L18 10M12 10L18 16' },
    { name: 'Carved Plank', line: 'There is room on it for your name.', rune: 'M7 5L17 19M17 5L7 19' },
    { name: 'Echo Shell', line: 'Hold it to your ear. It knows your name.', rune: 'M6 18V6L12 12L18 6V18' },
    { name: 'Gate Key', line: 'It opens something further on.', rune: 'M12 3L19 12L12 21L5 12ZM5 12H19' },
];

function sagaState() {
    if (!allData._saga) allData._saga = {};
    if (!allData._saga.paths) allData._saga.paths = {};
    if (!allData._saga.trials) allData._saga.trials = {};
    return allData._saga;
}

function crossroadOf(stop) {
    return stop >= 3 && stop < 6 ? 0 : stop >= 6 && stop < 9 ? 1 : null;
}

function chosenPath(saga, cross) {
    return (((allData._saga || {}).paths) || {})[`${saga}-${cross}`] || null;
}

// A fork waiting for a choice on the stretch you are on
function pendingCrossroad() {
    if (!allWorkoutDates().length) return null;
    const j = journey();
    const cross = crossroadOf(j.stop);
    return cross === null || chosenPath(j.saga, cross) ? null : cross;
}

function trialDefinition(stop, path) {
    const cross = crossroadOf(stop);
    const def = cross === null ? TRIALS[stop] : PATH_TRIALS[path][(stop - 3) % 3 + cross * 3];
    // Always winnable with how this person trains
    const hasLifts = !isCardioProgram() && PROGRAMS[currentProgram].exercises.some(ex => strengthHistory(ex).length);
    if (def.kind === 'cardio' && !cardioTarget()) return { ...def, kind: 'workouts', target: Math.max(2, Math.round(def.target / 30)) };
    if (def.kind === 'steps' && !Object.keys(stepData).length) return { ...def, kind: 'habits', target: Math.min(3, def.target) };
    if (def.kind === 'record' && !hasLifts) return { ...def, kind: 'workouts', target: 3 };
    if (def.kind === 'sets' && isCardioProgram()) return { ...def, kind: 'workouts', target: Math.ceil(def.target / 12) };
    return { ...def };
}

// How much of a kind has been done from a date on (recomputed from the log, like leagues)
function trialCount(kind, start) {
    const from = d => d >= start;
    if (kind === 'workouts') return allWorkoutDates().filter(from).length;
    if (kind === 'sets') {
        return Object.values(metaFor('_sessions')).flat().filter(s => s && s.type === 'workout' && from(s.date)).reduce((sum, s) => sum + (s.sets || 0), 0);
    }
    if (kind === 'cardio') return cardioMinutes(from);
    if (kind === 'steps') return Object.keys(stepData).filter(d => from(d) && stepsOn(d) >= stepGoal()).length;
    if (kind === 'habits') {
        const days = new Set([...Object.keys(metaFor('_habits')), ...Object.keys(stepData)]);
        return [...days].filter(d => from(d) && habitsDone(d) >= dailyHabits().length).length;
    }
    // Lifts that beat their earlier best since the Trial began
    return PROGRAMS[currentProgram].exercises.filter(ex => {
        if (ex.assist) return false;
        const h = strengthHistory(ex);
        const before = h.filter(p => p.date < start).map(p => p.value);
        return before.length && h.some(p => from(p.date) && p.value > Math.max(...before));
    }).length;
}

function trialProgress(t) {
    return Math.min(t.target, Math.max(0, trialCount(t.kind, t.start) - (t.base || 0)));
}

function trialGoal(t) {
    if (t.kind === 'workouts') return `Train ${t.target} times`;
    if (t.kind === 'sets') return `Log ${t.target} sets`;
    if (t.kind === 'record') return t.target === 1 ? 'Beat a personal best' : `Beat ${t.target} personal bests`;
    if (t.kind === 'cardio') return `${t.target} cardio minutes`;
    if (t.kind === 'steps') return `Hit your step goal on ${t.target} days`;
    return `Tick every habit on ${t.target} days`;
}

// The Trial of the stretch you are on. It opens after the first workout, once steps are in, and after any choice
function currentTrial() {
    if (!currentProgram || !stepsLoaded || !allWorkoutDates().length) return null;
    const j = journey();
    const key = `${j.saga}-${j.stop}`;
    const state = sagaState();
    if (state.trials[key]) return { key, ...state.trials[key] };
    const cross = crossroadOf(j.stop);
    const path = cross === null ? null : chosenPath(j.saga, cross);
    if (cross !== null && !path) return null;
    const def = trialDefinition(j.stop, path);
    const start = todayStr();
    // What was already done today doesn't count toward a Trial that starts now
    state.trials[key] = { name: def.name, kind: def.kind, target: def.target, start, base: trialCount(def.kind, start), stop: j.stop, saga: j.saga, ...(path ? { path } : {}) };
    scheduleSave();
    todayTip('trials');
    return { key, ...state.trials[key] };
}

// Finished Trials earn their Relic; called with the quests (Today, habit ticks)
function checkTrials() {
    if (!currentProgram || !stepsLoaded) return;
    currentTrial();
    const trials = sagaState().trials;
    let changed = false;
    Object.values(trials).forEach(t => {
        if (t.done || trialProgress(t) < t.target) return;
        t.done = todayStr();
        changed = true;
        const relic = RELICS[t.stop];
        queueMoment(() => showMoment({ kicker: 'Trial complete', valueHtml: relicSvg(t.stop, 92), unit: '', name: relic.name, sub: `${tr(t.name)} · ${tr(relic.line)}`, sound: 'badge' }));
    });
    if (changed) {
        scheduleSave();
        const line = document.querySelector('#sagaCard .saga-trial');
        if (line) line.outerHTML = sagaTrialHtml();
    }
}

function relicSvg(i, size = 44, earned = true) {
    return `<svg class="relic${earned ? ' earned' : ''}" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">
        <circle cx="24" cy="24" r="21"/><circle class="inner" cx="24" cy="24" r="17"/>
        <path transform="translate(12 12)" d="${RELICS[i].rune}"/>
    </svg>`;
}

// One line on the saga card
function sagaTrialHtml() {
    const t = currentTrial();
    if (!t) return '';
    if (t.done) return `<div class="saga-trial done"><span>Trial complete</span><strong>${escapeHtml(RELICS[t.stop].name)}</strong></div>`;
    const n = trialProgress(t);
    return `
        <div class="saga-trial">
            <span>Trial · ${escapeHtml(t.name)}</span>
            <strong>${n.toLocaleString(LOCALE)}/${t.target.toLocaleString(LOCALE)}</strong>
            <i><b style="width:${Math.round(n / t.target * 100)}%"></b></i>
            <small>${escapeHtml(trialGoal(t))}</small>
        </div>`;
}

function sagaForkHtml() {
    const cross = pendingCrossroad();
    return cross === null ? '' : `
        <button class="saga-fork" onclick="openCrossroads()">
            <span>Crossroads</span><strong>${escapeHtml(CROSSROADS[cross].title)}</strong><em>Choose your path ›</em>
        </button>`;
}

// ── The fork ──
function openCrossroads() {
    const cross = pendingCrossroad();
    if (cross === null) return;
    haptic();
    const c = CROSSROADS[cross];
    document.getElementById('crossroadsBody').innerHTML = `
        <div class="kicker">Crossroads</div>
        <h3 class="cross-title">${escapeHtml(c.title)}</h3>
        <p class="cross-line">${escapeHtml(c.line)}</p>
        ${Object.entries(SAGA_PATHS).map(([id, p]) => `
            <button class="cross-path" onclick="choosePath('${id}')">
                <span class="cross-focus">${escapeHtml(p.focus)}</span>
                <strong>${escapeHtml(p.name)}</strong>
                <small>${escapeHtml(p.line)}</small>
            </button>`).join('')}
        <p class="cross-note">Your choice sets the next three Trials.</p>`;
    document.getElementById('crossroadsModal').classList.add('active');
}

function closeCrossroads() {
    document.getElementById('crossroadsModal').classList.remove('active');
}

function choosePath(id) {
    const cross = pendingCrossroad();
    if (cross === null || !SAGA_PATHS[id]) return;
    haptic();
    const j = journey();
    sagaState().paths[`${j.saga}-${cross}`] = id;
    scheduleSave();
    closeCrossroads();
    showToast(tr(CROSSROADS[cross].story[id]));
    if (document.getElementById('odysseyScreen').classList.contains('active')) renderOdyssey();
    renderSagaCard();
}

// ── On the journey screen ──
function trialsSectionHtml() {
    const current = currentTrial();
    const open = Object.entries(sagaState().trials).map(([key, t]) => ({ key, ...t }))
        .filter(t => !t.done && (!current || t.key !== current.key));
    const row = t => {
        const n = trialProgress(t);
        return `
            <div class="trial-row${t.done ? ' done' : ''}">
                ${relicSvg(t.stop, 42, !!t.done)}
                <div class="trial-text">
                    <strong>${escapeHtml(t.name)}</strong>
                    <small>${escapeHtml(t.done ? RELICS[t.stop].name : trialGoal(t))}</small>
                    ${t.path ? `<em>${escapeHtml(CROSSROADS[crossroadOf(t.stop)].story[t.path])}</em>` : ''}
                </div>
                <span class="trial-n">${t.done ? 'Done' : `${n.toLocaleString(LOCALE)}/${t.target.toLocaleString(LOCALE)}`}</span>
            </div>`;
    };
    if (!current && !open.length && pendingCrossroad() === null) return '';
    return `
        <div class="section-head"><h3>Trials</h3></div>
        ${sagaForkHtml()}
        <div class="trial-list">
            ${current ? row(current) : ''}
            ${open.length ? `<p class="trial-open">Still open. Finish them any time.</p>${open.map(row).join('')}` : ''}
        </div>`;
}

function relicsSectionHtml() {
    const done = Object.values(sagaState().trials).filter(t => t.done);
    const count = i => done.filter(t => t.stop === i).length;
    const earned = RELICS.filter((_, i) => count(i)).length;
    return `
        <div class="section-head"><h3>Relics</h3><span>${earned} of ${RELICS.length}</span></div>
        <div class="relic-grid">
            ${RELICS.map((r, i) => {
                const n = count(i);
                return `
                <button class="relic-cell${n ? '' : ' locked'}" onclick="showToast('${escapeHtml(tr(n ? r.line : 'Finish this stretch’s Trial to earn it.')).replace(/'/g, '&#39;')}')">
                    ${relicSvg(i, 46, !!n)}
                    <span>${n ? escapeHtml(r.name) : '?'}</span>
                    ${n > 1 ? `<small>×${n}</small>` : ''}
                </button>`;
            }).join('')}
        </div>`;
}

// Gold ring on the map around landmarks whose Relic is earned in this saga
function relicEarnedAt(landmark, saga) {
    return Object.values((allData._saga || {}).trials || {}).some(t => t.done && t.saga === saga && t.stop + 1 === landmark);
}
