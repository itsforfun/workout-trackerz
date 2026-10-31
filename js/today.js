// ════════════════════════════════════════════
//  TODAY TAB
// ════════════════════════════════════════════

let todayDay = null;    // day index being viewed (null = next in the rotation)
let todayWeek = null;   // week override (null = current week)
const mobilityChecks = new Set();

function workoutSessions() {
    return programSessions().filter(s => s.type === 'workout');
}

// Rolling rotation: the day after the last one trained, regardless of weekday
function getNextDay() {
    const sessions = workoutSessions();
    if (!sessions.length) return 0;
    return (sessions[sessions.length - 1].day + 1) % PROGRAMS[currentProgram].days.length;
}

// Workouts across every program, for streaks
function allWorkoutDates() {
    const dates = [];
    Object.values(metaFor('_sessions')).forEach(list => {
        (list || []).forEach(s => { if (s.type === 'workout') dates.push(s.date); });
    });
    return dates;
}

function getStreakStats() {
    const dates = allWorkoutDates();
    const thisMonday = mondayOf(todayStr());
    const weeksWithWorkouts = new Set(dates.map(mondayOf));
    const thisWeek = dates.filter(d => mondayOf(d) === thisMonday).length;

    // Consecutive weeks with at least one workout; this week only counts once it has one
    let streak = 0;
    let week = weeksWithWorkouts.has(thisMonday) ? thisMonday : addDays(thisMonday, -7);
    while (weeksWithWorkouts.has(week)) {
        streak++;
        week = addDays(week, -7);
    }
    return { thisWeek, streak, total: dates.length };
}

// ── Today hero: this week's lifting and cardio, and today's steps, as three rings ──
// A ring turns gold once it closes; gold is kept for goals reached.
const HERO_RING_RADII = [84, 63, 42];
let heroStepsRequested = false;

// The week for any lifting program: its own plan, or a suggested one from its number of days. The rotation stays
// flexible (train on another day and the next session moves up); the plan only shapes the strip and rest days.
// 0 = Sunday … 6 = Saturday; numbers are lifting days, 'cardio' = an off day with optional cardio, 'rest' = Sunday.
const SUGGESTED_WEEKS = {
    1: { 2: 0, 5: 0 },                         // 1–2 days: Tue, Fri
    2: { 1: 0, 4: 1 },
    3: { 1: 0, 3: 1, 5: 2 },                   // Mon, Wed, Fri
    4: { 1: 0, 2: 1, 4: 2, 6: 3 },
    5: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 },
    6: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 },
};

function weekPlanOf(prog = PROGRAMS[currentProgram]) {
    if (!prog || isCardioProgram(prog)) return null;
    if (prog.weekPlan) return prog.weekPlan;
    const lifts = SUGGESTED_WEEKS[Math.min(6, prog.days.length)] || SUGGESTED_WEEKS[3];
    const plan = {};
    for (let d = 0; d < 7; d++) plan[d] = d in lifts ? lifts[d] : d === 0 ? 'rest' : 'cardio';
    return plan;
}

// "Push", "A", "Glutes": short enough for the week strip
function dayShortLabel(prog, index) {
    if (prog.days.length === 1) return 'Lift';
    const name = prog.days[index];
    const letter = name.match(/^(?:Workout|Day)\s+([A-Z])\b/);
    return letter ? letter[1] : name.split(/[\s·]+/)[0];
}

function weeklyLiftTarget(prog) {
    const plan = weekPlanOf(prog);
    if (plan) return Object.values(plan).filter(p => typeof p === 'number').length;
    return prog.days.length === 1 ? 2 : prog.days.length;
}

function compactNum(n) {
    return n >= 1000 ? `${(Math.round(n / 100) / 10).toLocaleString(LOCALE)}k` : String(n);
}

function renderTodayHero() {
    const el = document.getElementById('todayHero');
    const stats = getStreakStats();
    const liftTarget = weeklyLiftTarget(PROGRAMS[currentProgram]);
    const cardio = cardioWeek().moderate;
    const steps = stepsOn(todayStr());
    const goal = stepGoal();
    const consistency = consistencyScore();
    const xp = playerXp(playerStats());
    const rings = [
        { label: isCardioProgram() ? 'Sessions' : 'Lift', color: '#f3ece0', value: stats.thisWeek, target: liftTarget, text: `<span data-count="${stats.thisWeek}" data-key="hero-lift"></span><small>/${liftTarget}</small>` },
        { label: 'Cardio', color: '#c98f66', value: cardio, target: cardioTarget(), text: `<span data-count="${cardio}" data-key="hero-cardio"></span><small>/${cardioTarget()} min</small>` },
        { label: 'Steps', color: '#b0a491', value: steps, target: goal, text: `<span data-count="${steps}" data-key="hero-steps" data-format="compact"></span><small>/${compactNum(goal)}</small>` },
    ].filter(ring => ring.target > 0);   // cardio set to Off: two rings
    const circles = rings.map((ring, i) => {
        const r = HERO_RING_RADII[i];
        const c = 2 * Math.PI * r;
        const ratio = Math.min(1, ring.value / ring.target);
        return `
            <circle class="hr-bg" cx="100" cy="100" r="${r}" style="--c:${ring.color}"/>
            <circle class="hr-fg${ratio >= 1 ? ' closed' : ''}" cx="100" cy="100" r="${r}" style="--c:${ring.color}"
                stroke-dasharray="${c}" stroke-dashoffset="${c}" data-offset="${c * (1 - ratio)}"/>`;
    }).join('');
    el.innerHTML = `
        <button class="hero-level" onclick="openLevel()">
            <span class="hlv-num">Level <strong data-count="${xp.level}" data-key="hero-level"></strong></span>
            <span class="hlv-rank">${escapeHtml(xp.rank)}</span>
            <span class="hlv-xp">${xp.level < MAX_LEVEL ? `${xp.toNext.toLocaleString(LOCALE)} XP to go` : 'Max level'}</span>
            <span class="hlv-bar"><span style="width:${xp.span ? Math.round((xp.into / xp.span) * 100) : 100}%"></span></span>
        </button>
        <div class="hero-rings">
            <button class="hero-score" onclick="openScore()"><strong data-count="${consistency.score}" data-key="hero-score"></strong><span>score ›</span></button>
            <svg viewBox="0 0 200 200" aria-hidden="true">
                <defs><linearGradient id="heroGold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="#f2d891"/><stop offset="1" stop-color="#b38636"/>
                </linearGradient></defs>
                ${circles}
            </svg>
        </div>
        <div class="hero-legend">
            ${rings.map(ring => ring.label === 'Steps' ? `
                <button class="hl-row hl-open${ring.value >= ring.target ? ' closed' : ''}" style="--c:${ring.color}" onclick="switchTab('steps')">
                    <span class="hl-label">${ring.label} <span class="hl-chev" aria-hidden="true">›</span></span>
                    <span class="hl-value">${ring.text}</span>
                </button>` : `
                <div class="hl-row${ring.value >= ring.target ? ' closed' : ''}" style="--c:${ring.color}">
                    <span class="hl-label">${ring.label}</span>
                    <span class="hl-value">${ring.text}</span>
                </div>`).join('')}
        </div>
        <div class="hero-foot">
            <span><strong>${stats.streak}</strong> ${stats.streak === 1 ? 'week' : 'weeks'} in a row</span>
            <button class="hero-link" onclick="openAchievements()"><strong>${badgeCount()}</strong> badges →</button>
        </div>
    `;
    // Rings sweep in from empty
    rollNumbers(el);
    el.getBoundingClientRect();
    setTimeout(() => el.querySelectorAll('.hr-fg').forEach(circle => { circle.style.strokeDashoffset = circle.dataset.offset; }), 30);

    // Steps live in the Steps view (tap Steps under the rings); fetch today's count once so the ring is right on first open
    if (!heroStepsRequested && currentUser) {
        heroStepsRequested = true;
        loadSteps().then(ok => { if (ok) { checkAchievements(); renderTodayHero(); } });
    }
}

function renderToday() {
    const prog = PROGRAMS[currentProgram];
    checkAchievements();
    const nextDay = getNextDay();
    if (todayDay === null || todayDay >= prog.days.length) todayDay = nextDay;
    const week = todayWeek !== null ? todayWeek : getCurrentWeek();

    renderTodayHero();
    renderInstallCard();
    renderSagaCard();
    checkLandmarks();
    // Crew: load once (then the saga card shows the ship), afterwards keep my numbers this week current
    if (crewState === 'idle') loadCrew().then(c => { if (c) renderSagaCard(); openCrewInvite(); });
    else { syncCrewStats(); openCrewInvite(); }
    checkQuests();
    renderQuests();
    renderInsight();
    renderDeloadCard();
    renderWeekPlan();
    maybeStartTour();
    maybeShowRecap();
    scheduleNudges();
    document.getElementById('powerUnlock').innerHTML = powerUnlockHtml();

    // Cardio and rest days of a week plan show cardio zones instead of the lifting days; on any other day
    // (and in every program) the Cardio card opens the same zones and science (todayMode 'cardio')
    // Lifting programs: an off day opens on a short rest-day card (optional cardio, or lift anyway)
    const plan = (weekPlanOf(prog) || {})[new Date().getDay()];
    const offDay = plan === 'cardio' || plan === 'rest' ? plan : null;
    const cardioOpen = todayMode === 'cardio';
    const restDay = offDay && !todayMode;
    renderCardioView(cardioOpen ? 'cardio' : null, false, cardioOpen);
    renderRestDay(offDay, todayMode === 'lift');
    document.getElementById('liftView').style.display = cardioOpen || restDay ? 'none' : '';
    renderCardioEntry(!cardioOpen && !restDay);

    document.getElementById('dayStrip').innerHTML = prog.days.map((name, i) => `
        <button class="day-tab${i === todayDay ? ' active' : ''}" onclick="selectTodayDay(${i})">
            ${escapeHtml(name)}${i === nextDay && prog.days.length > 1 ? '<span class="up-next">UP NEXT</span>' : ''}
        </button>
    `).join('');
    const activeTab = document.querySelector('.day-tab.active');
    if (activeTab) activeTab.scrollIntoView({ block: 'nearest', inline: 'start' });

    // Cardio programs: the day's timed session instead of an exercise list
    if (isCardioProgram(prog)) {
        renderCardioDay(prog, week, nextDay);
        renderMobility();
        renderHabits();
        return;
    }
    document.getElementById('startWorkoutBtn').setAttribute('onclick', 'startWorkout()');

    const exercises = prog.exercises.filter(ex => ex.day === todayDay);
    const minutes = Math.round(exercises.reduce((sum, ex) => {
        const p = getPrescription(ex);
        return sum + p.sets * (p.restSec + 40);
    }, 0) / 60) + 5;
    const weekOptions = Array.from({ length: WEEKS }, (_, w) =>
        `<option value="${w}"${w === week ? ' selected' : ''}>Week ${w + 1}</option>`).join('');
    document.getElementById('todayMeta').innerHTML = `
        ${exercises.length} exercises · ${minutes} min · <select class="week-select" onchange="selectTodayWeek(this.value)">${weekOptions}</select>
    `;

    renderWarmup(exercises);
    const hits = musclesOf(exercises.map(ex => exerciseDisplayName(ex, week)));
    document.getElementById('todayMuscles').innerHTML = hits.main.length ? `
        <button class="today-muscles" onclick="openExerciseLibrary('${hits.main[0]}')">
            ${bodyMapSvg({ main: hits.main, extra: hits.extra, compact: true })}
            <span class="tm-text">
                <span class="tm-kicker">This workout hits</span>
                <span class="tm-main">${muscleList(hits.main)}</span>
            </span>
        </button>` : '';

    let readyToProgress = 0;
    document.getElementById('todayList').innerHTML = exercises.map((ex, idx) => {
        // Rest, form notes and progression tips appear in workout mode; this list stays a glance
        const progression = getProgression(ex);
        if (progression && progression.type === 'kg') readyToProgress++;
        const target = progression ? ` · ${formatSetWeight(ex, progression.kg)}` : '';
        return `
            <div class="today-item" style="--i:${idx}" role="button" tabindex="0" onclick="openGuide('${ex.id}')">
                <div class="today-item-main">
                    <div class="today-item-name">${escapeHtml(exerciseDisplayName(ex, week))}</div>
                    <div class="today-item-sub">${escapeHtml(prescriptionText(ex))}${escapeHtml(target)}</div>
                    ${upgradeText(ex, week) ? `<div class="today-item-note upgrade">${escapeHtml(upgradeText(ex, week))}</div>` : ''}
                </div>
                ${progressionBadge(progression)}
                <svg class="today-item-more" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
            </div>
        `;
    }).join('');

    const daysOff = prog.coachRules ? daysSinceLastWorkout() : null;
    const hints = [];
    if (daysOff !== null && daysOff >= 7) hints.push(`${daysOff} days since your last session, so the workout starts 10% lighter`);
    if (readyToProgress) hints.push(`${readyToProgress} exercise${readyToProgress === 1 ? '' : 's'} ready to go up in weight`);
    document.getElementById('todayHint').textContent = hints.join(' · ');

    const btn = document.getElementById('startWorkoutBtn');
    if (activeWorkout) {
        btn.innerHTML = `${PLAY_ICON} Resume ${escapeHtml(prog.days[activeWorkout.day])} workout`;
        btn.classList.remove('secondary');
    } else {
        btn.innerHTML = `${PLAY_ICON} ${todayDay === nextDay ? 'Start workout' : `Start ${escapeHtml(prog.days[todayDay])} instead`}`;
        btn.classList.toggle('secondary', todayDay !== nextDay);
    }

    renderMobility();
    renderHabits();
}

// ── Programs with a weekly plan, warm-up, daily habits and a power milestone (Wayfarer) ──

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Mon–Sun strip: what each day is for, with a tick once it's done this week
function renderWeekPlan() {
    const el = document.getElementById('weekPlan');
    const prog = PROGRAMS[currentProgram];
    const weekPlan = weekPlanOf(prog);
    if (!weekPlan) {
        el.innerHTML = '';
        return;
    }
    const monday = mondayOf(todayStr());
    const today = todayStr();
    const sessions = programSessions();
    const days = [1, 2, 3, 4, 5, 6, 0].map((weekday, i) => {
        const date = addDays(monday, i);
        const plan = weekPlan[weekday];
        // Off days: optional cardio when cardio is on (dashed), otherwise rest; steps are a daily habit, not a day
        const cardio = plan === 'cardio' && cardioTarget() > 0;
        const label = typeof plan === 'number' ? dayShortLabel(prog, plan) : cardio ? 'Cardio' : 'Rest';
        const done = sessions.some(s => s.date === date && (s.type === 'workout' || s.type === 'cardio'));
        return `
            <div class="wp-day${date === today ? ' today' : ''}${done ? ' done' : ''}${typeof plan === 'number' ? ' lift' : cardio ? ' optional' : ' rest'}">
                <span class="wp-name">${WEEKDAYS[weekday]}</span>
                <span class="wp-label">${escapeHtml(label)}</span>
            </div>`;
    }).join('');

    // Dashed days are explained once, under the strip
    const optional = cardioTarget() > 0 && Object.values(weekPlan).includes('cardio');
    el.innerHTML = `<div class="week-plan">${days}</div>${optional ? '<p class="wp-legend"><span></span>Cardio days are optional</p>' : ''}`;
}

// Warm-up for the selected day, plus the effort and pain rules
function renderWarmup(exercises) {
    const el = document.getElementById('warmupCard');
    const prog = PROGRAMS[currentProgram];
    if (!prog.warmup) {
        el.innerHTML = '';
        return;
    }
    // Two light build-up sets of the first lift, at about 50% and 75% of today's weight
    const first = exercises[0];
    const working = first ? parseFloat(workoutPrefill(first).kg) : NaN;
    const unit = first ? setWeightUnit(first) : '';
    const rampText = working > 0
        ? `${formatNum(Math.round(working * 0.5))} ${unit} × 8, then ${formatNum(Math.round(working * 0.75))} ${unit} × 4`
        : 'building to your working weight';
    const items = [...prog.warmup.common, ...prog.warmup.days[todayDay],
        [`2 light sets of ${first ? first.name : 'the first lift'}`, rampText]];
    el.innerHTML = `
        <details class="mobility-card warmup-card">
            <summary><h3>Warm-up · ~6 min</h3><span class="warmup-hint">Tap to open</span></summary>
            ${items.map(([name, dose]) => `
                <label class="mobility-item"><input type="checkbox"> ${escapeHtml(name)} <small>${escapeHtml(dose)}</small></label>
            `).join('')}
            <p class="warmup-note">${escapeHtml(prog.warmup.note)}</p>
            <p class="warmup-note"><strong>Effort:</strong> stop every set with 1–3 reps in reserve.
                <strong>Pain:</strong> up to ~3/10 that settles by the next day is fine. Sharp pain, or pain that gets worse session to session, means back off that exercise.</p>
            <p class="warmup-note">See a physio for back pain running down a leg, numbness or tingling, or an ankle that keeps giving way.</p>
        </details>
    `;
}

// Power work unlocks at the bodyweight milestone
function powerUnlockHtml() {
    const prog = PROGRAMS[currentProgram];
    if (!prog.powerUnlockKg || !userProfile || !userProfile.weight) return '';
    const unit = usesLb() ? 'lb' : 'kg';
    if (userProfile.weight <= prog.powerUnlockKg) {
        return `<div class="power-unlock unlocked"><strong>Power work unlocked.</strong> Add low box jumps or sled pushes after the warm-up.</div>`;
    }
    const toGo = kgToDisplay(userProfile.weight - prog.powerUnlockKg);
    return `<div class="power-unlock"><span>Power unlock at ${kgToDisplay(prog.powerUnlockKg)} ${unit}</span><strong>${toGo} ${unit} to go</strong></div>`;
}

// Daily habit checklist, saved per date; collapsed to a progress row until opened
let habitsOpen = false;

function renderHabits() {
    const el = document.getElementById('habitsCard');
    const habits = dailyHabits();
    const checked = new Set((metaFor('_habits')[todayStr()]) || []);
    // The steps habit (first in the list) counts as done once the step goal is synced today
    if (stepsOn(todayStr()) >= stepGoal()) checked.add(0);
    const done = checked.size;
    const total = habits.length;
    el.innerHTML = `
        <details class="mobility-card habits-card" ${habitsOpen ? 'open' : ''} ontoggle="habitsOpen = this.open">
            <summary>
                <div class="habits-row"><h3>Daily habits</h3><span class="habits-count${done === total ? ' all' : ''}">${done}/${total}</span></div>
                <div class="habits-bar"><span style="width:${Math.round((done / total) * 100)}%"></span></div>
            </summary>
            <p class="habits-goal">For your goal: <strong>${escapeHtml(GOAL_NAMES[userGoal()])}</strong> · <button class="link-btn" onclick="switchTab('settings')">Change</button></p>
            ${habits.map((habit, i) => `
                <label class="mobility-item">
                    <input type="checkbox" ${checked.has(i) ? 'checked' : ''} onchange="toggleHabit(${i}, this.checked)">
                    ${escapeHtml(habit)}
                </label>
            `).join('')}
        </details>
    `;
}

const GOAL_NAMES = { fatloss: 'Lose fat', muscle: 'Build muscle', recomp: 'Lose fat and build muscle', strength: 'Get stronger', general: 'Maintain and stay fit' };

function toggleHabit(i, on) {
    haptic();
    const habits = metaFor('_habits');
    const today = new Set(habits[todayStr()] || []);
    if (on) today.add(i);
    else today.delete(i);
    habits[todayStr()] = [...today].sort((a, b) => a - b);
    scheduleSave();
    renderHabits();
    checkAchievements();
    checkQuests();
    renderQuests();
    renderTodayHero();
}

// Week 6+: suggest the harder version of an exercise once knees and balance are solid
function upgradeText(ex, week) {
    return ex.upgrade && week + 1 >= ex.upgrade.week
        ? `Week ${ex.upgrade.week}+: if knees and balance feel solid, upgrade to ${ex.upgrade.to} (tap Swap during the workout).`
        : '';
}

// Days since this program's last lifting session (null when there is none)
function daysSinceLastWorkout() {
    const sessions = workoutSessions();
    return sessions.length ? daysBetween(sessions[sessions.length - 1].date, todayStr()) : null;
}

function selectTodayDay(day) {
    haptic();
    todayDay = day;
    renderToday();
}

function selectTodayWeek(week) {
    todayWeek = Number(week);
    renderToday();
}

function renderMobility() {
    const card = document.getElementById('mobilityCard');
    const routines = MOBILITY[currentProgram];
    const sessions = workoutSessions();
    if (!routines || !sessions.length) {
        card.innerHTML = '';
        return;
    }
    const lastDay = sessions[sessions.length - 1].day;
    const routine = routines[lastDay];
    const doneToday = programSessions().some(s => s.type === 'mobility' && s.date === todayStr());
    card.innerHTML = `
        <div class="mobility-card">
            <h3>Off-day mobility · ${escapeHtml(routine.title)}</h3>
            <p>Optional · ~20 min · 2-3 rounds, 30-45 s each${doneToday ? ' · Done today' : ''}</p>
            ${routine.items.map(([name, dose], i) => `
                <label class="mobility-item">
                    <input type="checkbox" ${mobilityChecks.has(i) ? 'checked' : ''} onchange="toggleMobility(${i}, this.checked)">
                    ${escapeHtml(name)} <small>${escapeHtml(dose)}</small>
                </label>
            `).join('')}
            <button class="start-btn secondary" style="margin-top:12px;" onclick="logMobility(${lastDay})">Log mobility session</button>
        </div>
    `;
}

function toggleMobility(i, checked) {
    if (checked) mobilityChecks.add(i);
    else mobilityChecks.delete(i);
}

function logMobility(day) {
    programSessions().push({ date: todayStr(), day, week: getCurrentWeek(), type: 'mobility', minutes: 20 });
    mobilityChecks.clear();
    scheduleSave();
    renderToday();
    showToast('Mobility session logged');
}

// ════════════════════════════════════════════
//  CARDIO ZONES (cardio and rest days of programs with a week plan)
// ════════════════════════════════════════════

// Five heart-rate zones as % of estimated max heart rate, with RPE (effort 0–10) and the talk
// test for training without a heart-rate monitor. Sessions favour low-impact machines.
const CARDIO_ZONES = [
    { zone: 1, name: 'Recovery', pct: [50, 60], rpe: '2–3', color: '#b0a491', talk: 'You could sing',
        why: 'Active recovery: gets blood moving without adding fatigue. Ideal on walk days and after hard lifting.',
        sessions: [['Easy walk', 30, '30–45 min', 'Flat or a slight incline, relaxed pace'], ['Easy bike spin', 20, '20–30 min', 'Light resistance, smooth pedalling']] },
    { zone: 2, name: 'Aerobic base', pct: [60, 70], rpe: '3–4', color: '#dcc89e', talk: 'You can talk in full sentences',
        why: 'Builds the aerobic base (heart, mitochondria, fat use) with little stress on joints or recovery. Most weekly cardio should be here.',
        sessions: [['Incline treadmill walk', 30, '30–45 min', '8–12% incline, 4.5–5.5 km/h, hands off the rails'], ['Steady bike', 30, '30–45 min', 'A resistance you could hold for an hour'], ['Elliptical', 30, '30 min', 'Low impact, easy on knees and ankles'], ['Easy rowing', 20, '20–30 min', 'Smooth strokes, about 20 per minute']] },
    { zone: 3, name: 'Tempo', pct: [70, 80], rpe: '5–6', color: '#d9b25f', talk: 'Short sentences only',
        why: 'Comfortably hard. Useful in small doses once the base is built; lots of it adds fatigue without the benefits of easy or hard work.',
        sessions: [['Bike tempo', 33, '3 × 8 min, 3 min easy between', 'Steady, controlled effort']] },
    { zone: 4, name: 'Threshold', pct: [80, 90], rpe: '7–8', color: '#c98f66', talk: 'A few words at a time',
        why: 'Raises the pace you can sustain. One session a week at most, and only after a few weeks of base work.',
        sessions: [['4 × 4 min intervals', 28, '4 × 4 min hard, 3 min easy', 'The "Norwegian 4×4": build to 85–95% of max by the end of each rep. Bike or incline walk']] },
    { zone: 5, name: 'Max effort', pct: [90, 100], rpe: '9–10', color: '#e07a5f', talk: 'You can\'t talk',
        why: 'Short sprints raise fitness (VO₂max) quickly in little time but are hard to recover from. Once a week at most, on a bike.',
        sessions: [['Bike sprints', 20, '6–8 × 30 s all-out, 2 min easy', 'Seated, high resistance; stop if form or joints suffer']] },
];

const CARDIO_EVIDENCE = [
    'Max heart rate is estimated as 208 − 0.7 × age (Tanaka et al., 2001), which fits adults better than 220 − age. For women it is 206 − 0.88 × age (Gulati et al., 2010): the older formulas overestimate it for women. Any formula can be 10+ beats off for one person, so check it against the talk test.',
    'The talk test (the point where talking gets hard) closely tracks the first ventilatory threshold, the top of Zone 2 (Persinger et al., 2004).',
    'WHO guidelines (2020): 150–300 minutes a week of moderate activity, or 75–150 of vigorous activity. A minute in Zone 4–5 counts as two.',
    'For fat loss, a 2026 network meta-analysis ranked intervals (75+ minutes a week) slightly ahead of steady cardio over 8–16 weeks. The difference is modest, and steady Zone 2 is easier to recover from alongside lifting (Deng et al., 2026).',
    'Cardio alongside lifting did not reduce strength or muscle gains for recreational lifters in an umbrella review of 17 meta-analyses; on days with both, lifting first may help a little (Held et al., 2026).',
    'The 4 × 4 interval protocol improved VO₂max more than steady training in a controlled trial (Helgerud et al., 2007).',
];

// null = follow the week plan; 'lift' = show the lifting days on a cardio/rest day
let todayMode = null;

// Tanaka (208 − 0.7 × age) for men; Gulati (206 − 0.88 × age), measured in 5,437 women, for women
function estimatedMaxHr() {
    const age = userProfile && userProfile.age ? userProfile.age : 30;
    return Math.round(userGender() === 'female' ? 206 - 0.88 * age : 208 - 0.7 * age);
}

// Cardio minutes this week, as WHO "moderate-equivalent" (Zone 2–3 count once, Zone 4–5 twice)
function cardioWeek() {
    const monday = mondayOf(todayStr());
    let total = 0;
    Object.values(metaFor('_sessions')).forEach(list => (list || []).forEach(s => {
        if (s.type === 'cardio' && mondayOf(s.date) === monday) total += s.minutes || 0;
    }));
    return { total, moderate: cardioMinutes(d => mondayOf(d) === monday) };
}

function setTodayMode(mode) {
    haptic();
    todayMode = mode;
    renderToday();
    window.scrollTo(0, 0);
}

// ── "Add Odyr to your Home Screen": shown in a phone browser, until installed or dismissed ──
// On iPhone, lock-screen rest alerts and reminders only work from the Home Screen app.
let installEvent = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; renderInstallCard(); });

function isInstalled() {
    return navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
}

function renderInstallCard() {
    const el = document.getElementById('installCard');
    if (!el) return;
    let dismissed = false;
    try { dismissed = localStorage.getItem('odyr_install_dismissed') === '1'; } catch (e) { /* private mode */ }
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (isInstalled() || dismissed || (!ios && !installEvent)) {
        el.innerHTML = '';
        return;
    }
    el.innerHTML = `
        <div class="install-card">
            <svg class="install-mark" aria-hidden="true"><use href="#odyrMark"/></svg>
            <div class="install-text">
                <strong>Add Odyr to your Home Screen</strong>
                <span>${ios
                    ? 'Tap Share, then Add to Home Screen. Rest alerts, reminders and full screen work from there.'
                    : 'Install it for full screen, rest alerts and reminders.'}</span>
                ${!ios ? '<button class="btn btn-primary install-btn" onclick="installOdyr()">Install</button>' : ''}
            </div>
            <button class="install-close" onclick="dismissInstall()" aria-label="Dismiss">${CLOSE_ICON}</button>
        </div>`;
}

async function installOdyr() {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice.catch(() => {});
    installEvent = null;
    renderInstallCard();
}

function dismissInstall() {
    haptic();
    try { localStorage.setItem('odyr_install_dismissed', '1'); } catch (e) { /* private mode */ }
    renderInstallCard();
}

// An off day in a lifting program: recovery first, cardio optional, lifting one tap away
function renderRestDay(offDay, showingLift) {
    const el = document.getElementById('restDay');
    if (!offDay) {
        el.innerHTML = '';
        return;
    }
    if (showingLift) {
        el.innerHTML = '<button class="back-link" onclick="setTodayMode(null)">← Back to rest day</button>';
        return;
    }
    const cardio = offDay === 'cardio' && cardioTarget() > 0;
    const z = CARDIO_ZONES.find(c => c.zone === 2);
    const hr = estimatedMaxHr();
    const missed = missedLiftDay();
    el.innerHTML = `
        <div class="rest-day">
            <div class="kicker">${cardio ? 'Rest day · cardio optional' : 'Rest day'}</div>
            <h2>Recover</h2>
            <p>Recovery is where the training takes hold. Your steps and habits still count today.</p>
            ${cardio ? `<p class="rest-cardio">Feel like moving? Easy Zone 2 cardio helps recovery: <strong>${Math.round(hr * z.pct[0] / 100)}–${Math.round(hr * z.pct[1] / 100)} bpm</strong>, 20–40 min.</p>` : ''}
            ${missed ? `<div class="coach-card compact"><div class="coach-kicker">Catch up</div><p>You missed a lifting day this week. ${escapeHtml(missed)} fits in today.</p></div>` : ''}
            <div class="rest-actions">
                ${cardio ? '<button class="btn" onclick="setTodayMode(\'cardio\')">Optional cardio</button>' : ''}
                <button class="btn${missed ? ' btn-primary' : ''}" onclick="setTodayMode('lift')">${missed ? 'Lift today' : 'Lift anyway'}</button>
            </div>
        </div>`;
}

// Every program: this week's cardio and a way into the zones, below the habits
function renderCardioEntry(show) {
    const el = document.getElementById('cardioEntry');
    if (!show) {
        el.innerHTML = '';
        return;
    }
    const week = cardioWeek();
    el.innerHTML = `
        <button class="cardio-entry" onclick="setTodayMode('cardio')">
            <span class="ce-text"><span class="ce-kicker">Cardio</span><strong>${week.moderate}<small>${cardioTarget() ? ` / ${cardioTarget()} min this week` : ' min this week'}</small></strong></span>
            <span class="ce-link">Zones and science ›</span>
            ${cardioTarget() ? `<span class="ce-bar"><span style="width:${Math.min(100, Math.round(week.moderate / cardioTarget() * 100))}%"></span></span>` : ''}
        </button>`;
}

function renderCardioView(plan, showingLift, chosen = false) {
    const el = document.getElementById('cardioView');
    if (!plan) {
        el.innerHTML = '';
        return;
    }
    if (showingLift) {
        el.innerHTML = `<button class="back-link" onclick="setTodayMode(null)">← Back to today's ${plan === 'cardio' ? 'cardio' : 'walk'} plan</button>`;
        return;
    }
    const hrMax = estimatedMaxHr();
    const recommended = ((PROGRAMS[currentProgram].cardioZones || {})[plan] || [plan === 'cardio' ? 2 : 1])[0];
    const week = cardioWeek();
    const todayMinutes = programSessions()
        .filter(s => s.type === 'cardio' && s.date === todayStr())
        .reduce((sum, s) => sum + (s.minutes || 0), 0);
    const target = cardioTarget() || 150;
    const pct = Math.min(100, Math.round((week.moderate / target) * 100));
    const bpm = z => `${Math.round(hrMax * z.pct[0] / 100)}–${Math.round(hrMax * z.pct[1] / 100)}`;
    const rec = CARDIO_ZONES.find(z => z.zone === recommended);

    // Details (why, technique, evidence) live in the log sheet and "The science"; the page stays scannable
    // solo: the only zone shown, so its title row would repeat the headline
    const zoneCard = (z, solo) => {
        const isRec = z.zone === recommended;
        return `
            <details class="zone-card${isRec ? ' recommended' : ''}${solo ? ' solo' : ''}" style="--zone:${z.color}" ${isRec || solo ? 'open' : ''}>
                <summary>
                    <span class="zone-num">Z${z.zone}</span>
                    <span class="zone-name">${escapeHtml(z.name)}</span>
                    <span class="zone-bpm">${bpm(z)}</span>
                </summary>
                <div class="zone-meta">Effort ${z.rpe} · ${escapeHtml(z.talk)}</div>
                ${z.sessions.map(([name, , dose], i) => `
                    <button class="zone-session" onclick="openCardioLog(${z.zone}, ${i})">
                        <span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(dose)}</small></span>
                        <span class="zone-log" aria-label="Log">+</span>
                    </button>`).join('')}
            </details>`;
    };
    // Programs list the zones that fit their goal; the rest stay out of the way under "Other zones"
    const fits = (PROGRAMS[currentProgram].cardioZones || {})[plan] || CARDIO_ZONES.map(z => z.zone);
    const shown = CARDIO_ZONES.filter(z => fits.includes(z.zone));
    const others = CARDIO_ZONES.filter(z => !fits.includes(z.zone));

    el.innerHTML = `
        <div class="cardio-head">
            ${chosen ? '<button class="back-link top" onclick="setTodayMode(null)">← Back</button>' : ''}
            <div class="kicker">${chosen ? 'Cardio' : plan === 'cardio' ? 'Cardio day' : 'Recovery day'}</div>
            <h2>Zone ${rec.zone} <span>${escapeHtml(rec.name)}</span></h2>
            <div class="cardio-target"><strong>${bpm(rec)}</strong> bpm · ${escapeHtml(rec.sessions[0][2])}</div>
        </div>
        ${!chosen && missedLiftDay() ? `<div class="coach-card compact"><div class="coach-kicker">Catch up</div><p>You missed a lifting day this week. ${escapeHtml(missedLiftDay())} fits in today instead of cardio.</p><button class="btn btn-primary" onclick="setTodayMode('lift')">Lift today</button></div>` : ''}
        <div class="cardio-week">
            <div class="cardio-week-top">
                <span>This week</span>
                <strong>${week.moderate}<small> / ${target} min</small></strong>
            </div>
            <div class="cardio-week-bar"><span style="width:${pct}%"></span></div>
            ${todayMinutes ? `<div class="cardio-today">${todayMinutes} min logged today</div>` : ''}
        </div>
        <div class="zone-list-head"><span>${shown.length > 1 ? 'Your zones' : 'Pick a session'}</span><span>${shown.length > 1 ? 'bpm' : ''}</span></div>
        ${shown.map(z => zoneCard(z, shown.length === 1)).join('')}
        ${others.length ? `
            <details class="other-zones">
                <summary>Other zones</summary>
                ${others.map(z => zoneCard(z, false)).join('')}
            </details>` : ''}
        <details class="mobility-card evidence-card">
            <summary><h3>The science</h3><span class="warmup-hint">Tap to open</span></summary>
            <ul>
                <li>Your estimated max heart rate is ${hrMax} bpm (age ${userProfile && userProfile.age ? userProfile.age : '—'}).</li>
                ${CARDIO_ZONES.map(z => `<li><strong>Zone ${z.zone}, ${escapeHtml(z.name)}</strong> (${z.pct[0]}–${z.pct[1]}% of max): ${escapeHtml(z.why)}</li>`).join('')}
                ${CARDIO_EVIDENCE.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
                <li>The weekly bar counts toward the WHO minimum of 150 min: Zone 4–5 minutes count double and Zone 1 doesn't count.</li>
            </ul>
        </details>
        ${chosen ? '' : `<button class="back-link" onclick="setTodayMode('lift')">Lift today instead →</button>`}
    `;
}

let cardioDraft = null;

function openCardioLog(zone, i) {
    haptic();
    const z = CARDIO_ZONES.find(c => c.zone === zone);
    const [name, minutes, dose, how] = z.sessions[i];
    cardioDraft = { zone, name };
    document.getElementById('cardioModalTitle').textContent = name;
    document.getElementById('cardioModalSub').textContent = `Zone ${zone} · ${dose}. ${how}.`;
    document.getElementById('cardioMinutes').value = minutes;
    document.getElementById('cardioHr').value = '';
    document.getElementById('cardioModal').classList.add('active');
}

function closeCardioLog() {
    document.getElementById('cardioModal').classList.remove('active');
    cardioDraft = null;
}

function saveCardioLog() {
    const minutes = parseInt(document.getElementById('cardioMinutes').value);
    if (!(minutes > 0)) {
        showToast('Enter how many minutes');
        return;
    }
    const hr = parseInt(document.getElementById('cardioHr').value);
    programSessions().push({
        date: todayStr(), day: null, week: getCurrentWeek(), type: 'cardio',
        zone: cardioDraft.zone, name: cardioDraft.name, minutes, ...(hr > 0 ? { avgHr: hr } : {}),
    });
    closeCardioLog();
    haptic();
    scheduleSave();
    renderToday();
    showToast(`${minutes} min logged`);
}
