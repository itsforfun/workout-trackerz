// ════════════════════════════════════════════
//  ADAPTIVE COACH: effort, deloads, readiness, program generator
// ════════════════════════════════════════════

// Effort after each set, as reps left in the tank (RIR)
const EFFORTS = [
    { rir: 4, label: 'Easy' },
    { rir: 2, label: 'Good' },
    { rir: 1, label: 'Hard' },
    { rir: 0, label: 'Max' },
];

function effortLabel(rir) {
    const effort = EFFORTS.find(e => e.rir === Number(rir));
    return effort ? effort.label : '';
}

// Average reps in reserve over sets that were rated; null when none were
function averageRir(sets) {
    const rated = (sets || []).filter(s => s.rir !== undefined && s.rir !== null && s.rir !== '').map(s => Number(s.rir));
    return rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null;
}

function rateSet(exId, i, rir) {
    haptic();
    const rows = activeWorkout.rows[exId];
    const row = rows[i];
    row.rir = rir;
    // Adjust the next set straight away: easy at the top of the range → heavier, a missed max effort → lighter
    const ex = workoutExercise(exId);
    const next = rows[i + 1];
    const p = getPrescription(ex);
    const reps = parseInt(row.reps) || 0;
    const kg = parseFloat(row.kg);
    if (next && !next.done && !isRepsBased(ex) && !ex.assist && !isNaN(kg) && next.kg === row.kg) {
        const step = usesLb() ? LB_INCREMENT[ex.unit] : KG_INCREMENT[ex.unit];
        if (rir >= 4 && (!p.repMax || reps >= p.repMax)) {
            next.kg = formatNum(kg + step);
            showToast(`Felt easy: next set ${next.kg} ${setWeightUnit(ex)}`);
        } else if (rir === 0 && p.repMin && reps < p.repMin && kg > step) {
            next.kg = formatNum(kg - step);
            showToast(`Next set ${next.kg} ${setWeightUnit(ex)}, so you hit ${p.repMin}`);
        }
    }
    // Lifts marked noFailure (the main glute drivers in Skadi): flag an all-out set
    if (rir === 0 && ex.noFailure) showToast(`Keep 1–2 reps in reserve on ${ex.name}: failure here costs more recovery than it gives`);
    persistActiveWorkout();
    renderWorkoutCard(exId);
}

function clearSetEffort(exId, i) {
    delete activeWorkout.rows[exId][i].rir;
    persistActiveWorkout();
    renderWorkoutCard(exId);
}

// ── Deloads: a lighter week when lifts stall, sessions get grinding, or after ~7 hard weeks ──
const DELOAD_DAYS = 7;

function deloadPlan() {
    return metaFor('_deload')[currentProgram] || null;
}

// The deload in effect today (or starting tomorrow), unless it was skipped
function deloadInfo() {
    const d = deloadPlan();
    if (!d || d.skipped || todayStr() > d.until) return null;
    return { ...d, active: todayStr() >= d.start };
}

function checkDeload() {
    if (deloadInfo()) return;
    const prog = PROGRAMS[currentProgram];
    const stalled = prog.exercises.filter(ex => !ex.assist && isStalled(ex.id)).length;
    const recent = workoutSessions().slice(-2);
    const efforts = recent.length === 2 ? recent.flatMap(s => s.efforts || []) : [];
    const grinding = efforts.length >= 6 && efforts.reduce((a, b) => a + b, 0) / efforts.length <= 0.75;
    const last = deloadPlan();
    const since = last ? last.start : metaFor('_cycleStart')[currentProgram];
    const weeks = since ? Math.floor(daysBetween(since, todayStr()) / 7) : 0;
    const due = weeks >= 7 && getStreakStats().streak >= 6;
    const reason = stalled >= 2 ? `${stalled} lifts have stalled`
        : grinding ? 'your last two workouts were all-out efforts'
        : due ? `${weeks} weeks of hard training`
        : null;
    if (!reason) return;
    const start = addDays(todayStr(), 1);
    metaFor('_deload')[currentProgram] = { start, until: addDays(start, DELOAD_DAYS - 1), reason };
    scheduleSave();
}

function skipDeload() {
    haptic();
    const d = deloadPlan();
    if (d) d.skipped = true;
    scheduleSave();
    renderToday();
    showToast('Deload skipped');
}

function renderDeloadCard() {
    const el = document.getElementById('deloadCard');
    if (!el) return;
    const d = deloadInfo();
    if (!d) {
        el.innerHTML = '';
        return;
    }
    el.innerHTML = `
        <div class="coach-card">
            <div class="coach-kicker">${d.active ? 'Deload week' : 'Deload starts tomorrow'}</div>
            <h3>Lighter on purpose</h3>
            <p>Because ${escapeHtml(d.reason)}, the coach is planning a lighter week until ${escapeHtml(prettyDate(d.until))}: about 10% less weight and fewer sets. You come back stronger.</p>
            <button class="science-link" onclick="openScience()">Why deloads ›</button>
            <button class="back-link" onclick="skipDeload()">Skip the deload</button>
        </div>`;
}

// ── Readiness: three taps before a workout set today's dose ──
const READINESS_QUESTIONS = [
    { key: 'sleep', label: 'Sleep', options: ['Poor', 'OK', 'Great'] },
    { key: 'soreness', label: 'Soreness', options: ['Very', 'A bit', 'None'] },
    { key: 'energy', label: 'Energy', options: ['Low', 'OK', 'High'] },
];
let readinessDraft = null;

// Each answer scores 0–2 (higher = readier), so the total runs 0–6
function readinessLevel(answers) {
    const score = READINESS_QUESTIONS.reduce((sum, q) => sum + (answers[q.key] ?? 1), 0);
    return score <= 2 ? 'low' : score >= 5 ? 'high' : 'normal';
}

function startWorkout() {
    unlockAudio();
    if (activeWorkout) {
        resumeWorkout();
        return;
    }
    readinessDraft = { sleep: 1, soreness: 1, energy: 1 };
    renderReadiness();
    document.getElementById('readinessModal').classList.add('active');
}

function renderReadiness() {
    const level = readinessLevel(readinessDraft);
    const deload = deloadInfo();
    document.getElementById('readinessBody').innerHTML = `
        ${READINESS_QUESTIONS.map(q => `
            <div class="ready-q">
                <span>${q.label}</span>
                <div class="seg">${q.options.map((opt, v) => `<button class="${readinessDraft[q.key] === v ? 'on' : ''}" onclick="setReadiness('${q.key}', ${v})">${opt}</button>`).join('')}</div>
            </div>`).join('')}
        <p class="ready-note">${deload && deload.active ? 'Deload week: lighter weights and fewer sets today.'
            : level === 'low' ? 'Taking it easier today: about 10% lighter and one set fewer per exercise. Smart, not soft.'
            : level === 'high' ? 'You\'re ready. Chase an extra rep on your last sets.'
            : 'Normal session. Weights are set from last time.'}</p>
        <button class="science-link" onclick="closeReadiness(); openScience()">Why this works ›</button>
    `;
}

function setReadiness(key, value) {
    haptic();
    readinessDraft[key] = value;
    renderReadiness();
}

function closeReadiness() {
    document.getElementById('readinessModal').classList.remove('active');
}

function confirmReadiness(skip) {
    closeReadiness();
    beginWorkout(skip ? null : { ...readinessDraft, level: readinessLevel(readinessDraft) });
}

// Lighter version of a prefilled weight (display units), rounded to the plate step
function lighterKg(ex, kg, factor) {
    if (kg === '' || isRepsBased(ex) || ex.assist) return kg;
    const step = usesLb() ? LB_INCREMENT[ex.unit] : KG_INCREMENT[ex.unit];
    return formatNum(Math.max(step, Math.round((parseFloat(kg) * factor) / step) * step));
}

// ── Catch-up: on a cardio or rest day, offer the lifting day missed earlier this week ──
function missedLiftDay() {
    const prog = PROGRAMS[currentProgram];
    const weekPlan = weekPlanOf(prog);
    if (!weekPlan) return null;
    const monday = mondayOf(todayStr());
    const done = allWorkoutDates().filter(d => d >= monday).length;
    const planned = [];
    for (let date = monday; date < todayStr(); date = addDays(date, 1)) {
        const plan = weekPlan[parseDate(date).getDay()];
        if (typeof plan === 'number') planned.push(plan);
    }
    return planned.length > done ? prog.days[getNextDay()] : null;
}

// ── Program generator: goal, days, equipment, session length and joints → a full program ──
// Each pattern lists exercises in order of preference: [name, equipment, stress on knees/shoulders/back (0–2)]
const GEN_PATTERNS = {
    squat: [['Barbell Back Squat', 'free', { knees: 2, back: 2 }], ['Hack Squat', 'gym', { knees: 2 }], ['Leg Press', 'gym', { knees: 1 }], ['Goblet Box Squat', 'db', {}], ['Dumbbell Goblet Squat', 'db', { knees: 1 }]],
    hinge: [['Barbell RDL', 'free', { back: 2 }], ['DB Romanian Deadlift', 'db', { back: 1 }], ['Barbell Rack Pull', 'free', { back: 1 }], ['Cable Pull-Through', 'gym', {}], ['Hyperextensions', 'gym', {}]],
    hpush: [['Barbell Bench Press', 'free', { shoulders: 2 }], ['DB Bench Press', 'db', { shoulders: 1 }], ['Machine Chest Press', 'gym', {}], ['Incline DB Press', 'db', { shoulders: 1 }], ['Push-Ups', 'none', { shoulders: 1 }]],
    vpush: [['Barbell Overhead Press', 'free', { shoulders: 2, back: 1 }], ['Seated DB Shoulder Press', 'db', { shoulders: 1 }], ['Machine Shoulder Press', 'gym', { shoulders: 1 }], ['Landmine Press', 'free', {}]],
    vpull: [['Pull-Ups', 'free', { shoulders: 1 }], ['Lat Pulldown', 'gym', {}], ['Single-Arm Cable Pulldown', 'gym', {}], ['DB Pullover', 'db', { shoulders: 1 }]],
    hpull: [['Barbell Row', 'free', { back: 2 }], ['Chest-Supported Row', 'db', {}], ['Seated Cable Row', 'gym', {}], ['Single-Arm DB Row', 'db', {}]],
    lunge: [['Bulgarian Split Squat', 'db', { knees: 2 }], ['Static Split Squat', 'db', { knees: 1 }], ['Reverse Lunge', 'db', { knees: 1 }], ['Step-Up, 3-Second Lowering', 'db', {}]],
    glutes: [['Barbell Hip Thrust', 'free', {}], ['Machine Hip Thrust', 'gym', {}], ['Barbell Glute Bridge', 'free', {}], ['Single-Leg Calf Raise', 'db', {}]],
    hams: [['Lying Leg Curl', 'gym', {}], ['Seated Leg Curl', 'gym', {}], ['Stability Ball Leg Curl', 'none', {}]],
    quads: [['Leg Extension', 'gym', { knees: 1 }], ['Step-Up, 3-Second Lowering', 'db', {}]],
    calves: [['Standing Calf Raises', 'gym', {}], ['Single-Leg Calf Raise', 'db', {}]],
    delts: [['Cable Lateral Raise', 'gym', {}], ['DB Lateral Raise', 'db', {}], ['Face Pull', 'gym', {}]],
    biceps: [['Cable Curl', 'gym', {}], ['DB Curl', 'db', {}], ['EZ-Bar Curl', 'free', {}]],
    triceps: [['Rope Pressdown', 'gym', {}], ['DB Overhead Extension', 'db', { shoulders: 1 }], ['EZ-Bar Skull Crusher', 'free', {}]],
    core: [['Pallof Press', 'gym', {}], ['Dead Bug', 'none', {}], ['Suitcase Carry', 'db', {}], ['Cable Crunch', 'gym', { back: 1 }]],
};
const GEN_COMPOUNDS = ['squat', 'hinge', 'hpush', 'vpush', 'vpull', 'hpull', 'lunge', 'glutes'];
const GEN_EQUIPMENT = { gym: ['gym', 'free', 'db', 'none'], free: ['free', 'db', 'none'], db: ['db', 'none'] };

// Day templates by days per week; patterns in order of priority (shorter sessions drop from the end)
const GEN_SPLITS = {
    2: [['Full Body A', ['squat', 'hpush', 'vpull', 'hams', 'delts', 'core']],
        ['Full Body B', ['hinge', 'vpush', 'hpull', 'lunge', 'biceps', 'triceps']]],
    3: [['Full Body A', ['squat', 'hpush', 'hpull', 'hams', 'delts', 'core']],
        ['Full Body B', ['hinge', 'vpush', 'vpull', 'lunge', 'triceps', 'calves']],
        ['Full Body C', ['squat', 'hpush', 'vpull', 'glutes', 'biceps', 'core']]],
    4: [['Upper A', ['hpush', 'hpull', 'vpush', 'vpull', 'triceps', 'biceps']],
        ['Lower A', ['squat', 'hinge', 'lunge', 'hams', 'calves', 'core']],
        ['Upper B', ['vpush', 'vpull', 'hpush', 'hpull', 'delts', 'biceps']],
        ['Lower B', ['hinge', 'squat', 'glutes', 'quads', 'calves', 'core']]],
    5: [['Upper', ['hpush', 'hpull', 'vpush', 'vpull', 'triceps', 'biceps']],
        ['Lower', ['squat', 'hinge', 'lunge', 'hams', 'calves', 'core']],
        ['Push', ['vpush', 'hpush', 'delts', 'triceps', 'core']],
        ['Pull', ['vpull', 'hpull', 'delts', 'biceps', 'core']],
        ['Legs', ['hinge', 'squat', 'glutes', 'quads', 'calves']]],
};

const GEN_GOALS = {
    // [sets, rep min, rep max, rest minutes] for the day's first two lifts, other compound lifts, and accessories
    muscle: { name: 'Build Muscle', main: [3, 6, 10, 2.5], compound: [3, 8, 12, 2], accessory: [3, 10, 15, 1.5] },
    strength: { name: 'Get Stronger', main: [4, 4, 6, 3], compound: [3, 6, 10, 2], accessory: [3, 8, 12, 1.5] },
    fatloss: { name: 'Lean & Strong', main: [3, 8, 12, 2], compound: [3, 10, 12, 1.5], accessory: [3, 12, 15, 1] },
    recomp: { name: 'Recomposition', main: [3, 6, 10, 2.5], compound: [3, 8, 12, 2], accessory: [3, 10, 15, 1.5] },
    general: { name: 'All-Round Fit', main: [3, 8, 12, 2], compound: [3, 8, 12, 2], accessory: [2, 10, 15, 1.5] },
};

let genDraft = null;
const GEN_QUESTIONS = [
    { key: 'goal', label: 'Goal', options: [['muscle', 'Build muscle'], ['strength', 'Get stronger'], ['fatloss', 'Lose fat'], ['recomp', 'Recomposition'], ['general', 'Maintain']] },
    { key: 'days', label: 'Days a week', options: [[2, '2'], [3, '3'], [4, '4'], [5, '5']] },
    { key: 'equipment', label: 'Equipment', options: [['gym', 'Full gym'], ['free', 'Barbell + dumbbells'], ['db', 'Dumbbells only']] },
    { key: 'minutes', label: 'Session length', options: [[45, '45 min'], [60, '60 min'], [75, '75 min']] },
];
const GEN_JOINTS = [['knees', 'Knees'], ['shoulders', 'Shoulders'], ['back', 'Lower back']];

function openGenerator() {
    haptic();
    genDraft = { goal: 'muscle', days: 3, equipment: 'gym', minutes: 60, protect: [] };
    renderGenerator();
    document.getElementById('genModal').classList.add('active');
}

function closeGenerator() {
    document.getElementById('genModal').classList.remove('active');
}

function renderGenerator() {
    document.getElementById('genBody').innerHTML = `
        ${GEN_QUESTIONS.map(q => `
            <div class="ready-q">
                <span>${q.label}</span>
                <div class="seg">${q.options.map(([value, label]) => `<button class="${genDraft[q.key] === value ? 'on' : ''}" onclick="setGen('${q.key}', ${JSON.stringify(value).replace(/"/g, '&quot;')})">${label}</button>`).join('')}</div>
            </div>`).join('')}
        <div class="ready-q">
            <span>Go easy on</span>
            <div class="seg">${GEN_JOINTS.map(([key, label]) => `<button class="${genDraft.protect.includes(key) ? 'on' : ''}" onclick="toggleGenJoint('${key}')">${label}</button>`).join('')}</div>
        </div>
        <p class="ready-note">The coach picks exercises for your equipment, avoids hard-on-the-joint moves you flag, and sets reps and rest for your goal. You can change anything before saving.</p>
        <button class="science-link" onclick="closeGenerator(); openScience()">How programs are built ›</button>
    `;
}

function setGen(key, value) {
    haptic();
    genDraft[key] = value;
    renderGenerator();
}

function toggleGenJoint(key) {
    haptic();
    genDraft.protect = genDraft.protect.includes(key) ? genDraft.protect.filter(k => k !== key) : [...genDraft.protect, key];
    renderGenerator();
}

// Best exercise for a pattern: available with the equipment, no heavy stress on protected joints,
// least joint stress first, and a different pick each time the pattern repeats in the week
function pickExercise(pattern, draft, used) {
    const allowed = GEN_EQUIPMENT[draft.equipment];
    const stress = item => draft.protect.reduce((sum, joint) => sum + (item[2][joint] || 0), 0);
    let options = GEN_PATTERNS[pattern].filter(item => allowed.includes(item[1]));
    const gentle = options.filter(item => draft.protect.every(joint => (item[2][joint] || 0) < 2));
    if (gentle.length) options = gentle;
    options = options.map((item, order) => ({ item, order })).sort((a, b) => stress(a.item) - stress(b.item) || a.order - b.order).map(o => o.item);
    const fresh = options.find(item => !used.has(item[0]));
    return fresh || options[0] || null;
}

function generateProgram(draft) {
    const goal = GEN_GOALS[draft.goal];
    const perDay = draft.minutes <= 45 ? 4 : draft.minutes <= 60 ? 5 : 6;
    const library = new Map(exerciseLibrary().map(e => [e.name, e]));
    const used = new Set();
    const days = GEN_SPLITS[draft.days].map(([name, patterns]) => {
        const exercises = [];
        patterns.slice(0, perDay).forEach(pattern => {
            const pick = pickExercise(pattern, draft, used);
            if (!pick || exercises.some(e => e.name === pick[0])) return;
            used.add(pick[0]);
            const scheme = !GEN_COMPOUNDS.includes(pattern) ? goal.accessory : exercises.length < 2 ? goal.main : goal.compound;
            const [sets, repMin, repMax, rest] = scheme;
            const lib = library.get(pick[0]) || {};
            exercises.push({
                id: `${slugify(pick[0])}-${randomId(4)}`,
                name: pick[0], unit: lib.unit || 'kg', sets, repMin, repMax, rest,
                thresholds: lib.thresholds || null, standardGender: lib.standardGender, bar: !!lib.bar,
                swapKey: lib.swapKey, note: lib.note || '', per: lib.per, repLabel: lib.repLabel,
            });
        });
        return { name, exercises };
    });
    return { id: `custom-${randomId()}`, isNew: true, name: `${goal.name} · ${draft.days} days`, days };
}

function createGeneratedProgram() {
    closeGenerator();
    builder = generateProgram(genDraft);
    renderBuilder();
    showScreen('builder');
    showToast('Your program is ready. Review it, then Save');
}

// ════════════════════════════════════════════
//  THE SCIENCE: what each coach rule is based on
// ════════════════════════════════════════════

// Each section: the rule in one line, why, the evidence, and an honest note on what is a judgement call.
// References link to the paper's DOI when known, otherwise to a PubMed search for the exact title.
const COACH_SCIENCE = [
    {
        title: 'Weights go up step by step',
        rule: 'Hit the top of the rep range on every set, then add the smallest step (2–2.5 kg).',
        why: 'Muscles and strength keep adapting only while the challenge keeps rising. Working in a rep range and adding load once the top is reached is the progression model recommended for healthy adults.',
        note: 'The step sizes match standard plates and dumbbells; they are practical choices, not values from a study.',
        refs: [
            ['American College of Sports Medicine. Med Sci Sports Exerc. 2009;41(3):687–708.', 'American College of Sports Medicine position stand. Progression models in resistance training for healthy adults'],
            ['Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW. J Strength Cond Res. 2017;31(12):3508–3523.', 'Strength and Hypertrophy Adaptations Between Low- vs. High-Load Resistance Training: A Systematic Review and Meta-analysis'],
        ],
    },
    {
        title: 'Sets per muscle',
        rule: 'Progress counts hard sets per muscle over the last 7 days and shows them against about 10–20 a week. A supporting muscle counts half a set.',
        why: 'A 2025 meta-regression of 67 studies (over 2,000 people) found muscle growth keeps rising as weekly sets go up, with smaller gains for each extra set; counting a set for a supporting muscle as half a set fitted the data best. An earlier meta-analysis put 10 or more sets per muscle in the top group.',
        note: 'About 20 as the upper end is a coaching convention for recovery, not a tested limit. If your goal isn’t muscle, fewer sets are fine.',
        refs: [
            ['Pelland JC, Remmert JF, Robinson ZP, et al. Sports Med. 2026;56(2):481–505.', 'The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains', '10.1007/s40279-025-02344-w'],
            ['Schoenfeld BJ, Ogborn D, Krieger JW. J Sports Sci. 2017;35(11):1073–1082. doi:10.1080/02640414.2016.1210197', 'Dose-response relationship between weekly resistance training volume and increases in muscle mass: A systematic review and meta-analysis'],
        ],
    },
    {
        title: 'When a lift stalls',
        rule: 'A stall is the same weight and the same best set two sessions running. Each time it repeats, the coach climbs one step: +1 rep, then +1 set, then a slower tempo, then (isolation and machine lifts only) a drop set on the last set, and only then a reset about 10% lighter.',
        why: 'Progression can come from load, reps, sets or time under tension. Trying the cheapest change first keeps recovery intact; drop sets go last and only on small lifts, because taken to failure the big lifts cost more recovery than they return.',
        note: 'The order is a coaching convention (it follows the partner program spec), not something a single study ranks. A session without a weight jump is not a stall: at an intermediate stage, load goes up about weekly.',
        refs: [
            ['American College of Sports Medicine. Med Sci Sports Exerc. 2009;41(3):687–708.', 'American College of Sports Medicine position stand. Progression models in resistance training for healthy adults'],
        ],
    },
    {
        title: 'Rating each set: Easy, Good, Hard, Max',
        rule: 'Each rating is "reps left in the tank": Easy ≈ 4+, Good ≈ 2–3, Hard ≈ 1, Max = 0.',
        why: 'The reps-in-reserve scale is a practical, studied way to rate effort in strength training. Going all the way to failure is not needed: a meta-analysis found no clear advantage for training to failure over stopping a little short, so the coach aims for sets that are hard but not all-out, and adjusts when they are clearly too easy or too hard.',
        note: 'Ratings are subjective and get more accurate with practice, especially near failure.',
        refs: [
            ['Zourdos MC, Klemp A, Dolan C, et al. J Strength Cond Res. 2016;30(1):267–275.', 'Novel Resistance Training-Specific Rating of Perceived Exertion Scale Measuring Repetitions in Reserve', '10.1519/JSC.0000000000001049'],
            ['Refalo MC, Helms ER, Trexler ET, Hamilton DL, Fyfe JJ. Sports Med. 2023;53(3):649–665.', 'Influence of Resistance Training Proximity-to-Failure on Skeletal Muscle Hypertrophy: A Systematic Review with Meta-analysis', '10.1007/s40279-022-01784-y'],
        ],
    },
    {
        title: 'Adjusting to the day',
        rule: 'Easy sets → heavier next time; missed reps at max effort → one step lighter. A rough night or low energy → a lighter, shorter session.',
        why: 'Adjusting load to how you perform on the day (autoregulation) gives results at least as good as fixed percentages. Poor sleep measurably lowers performance, so trimming the session protects quality.',
        note: 'The 10% reduction and "one set fewer" are sensible coaching defaults rather than exact study values.',
        refs: [
            ['Helms ER, Byrnes RK, Cooke DM, et al. Front Physiol. 2018;9:247.', 'RPE vs. Percentage 1RM Loading in Periodized Programs Matched for Sets and Repetitions', '10.3389/fphys.2018.00247'],
            ['Greig L, Stephens Hemingway BH, Aspe RR, et al. Sports Med. 2020;50(11):1873–1887.', 'Autoregulation in Resistance Training: Addressing the Inconsistencies', '10.1007/s40279-020-01330-8'],
            ['Fullagar HH, Skorski S, Duffield R, et al. Sports Med. 2015;45(2):161–186.', 'Sleep and athletic performance: the effects of sleep loss on exercise performance, and physiological and cognitive responses to exercise'],
        ],
    },
    {
        title: 'Deload weeks',
        rule: 'When 2+ lifts stall, after two all-out sessions in a row, or after about 7 hard weeks: one week ~10% lighter with fewer sets.',
        why: 'Experienced strength and physique coaches use deloads to manage fatigue, usually 5–7 days every 4–6 weeks, mostly by cutting sets and effort. In a randomised trial, a week of no training mid-block left muscle growth unchanged but gave smaller strength gains, so the coach deloads by training lighter rather than stopping, and only when fatigue shows.',
        note: 'Research on deloads is still young. The triggers here are coaching rules, and you can always skip one.',
        refs: [
            ['Bell L, Nolan D, Immonen V, et al. Front Sports Act Living. 2022;4:1073223.', 'You can\'t shoot another bullet until you\'ve reloaded the gun: Coaches\' perceptions, practices and experiences of deloading in strength and physique sports', '10.3389/fspor.2022.1073223'],
            ['Coleman M, Burke R, Augustin F, et al. PeerJ. 2024;12:e16777.', 'Gaining more from doing less? The effects of a one-week deload period during supervised resistance training on muscular adaptations', '10.7717/peerj.16777'],
        ],
    },
    {
        title: 'Coming back after time off',
        rule: 'After 7 or more days off, the first session is 10% lighter and you build back over two sessions.',
        why: 'Strength drops when training stops, and the drop grows with the length of the break; it is larger in people over 65. Starting a little lighter and building back over two sessions matches what you can actually lift and keeps soreness down.',
        note: 'The 7-day trigger and the 10% reduction are coaching choices; after a short break most people rebuild quickly.',
        refs: [
            ['Bosquet L, Berryman N, Dupuy O, et al. Scand J Med Sci Sports. 2013;23(3):e140–e149.', 'Effect of training cessation on muscular performance: a meta-analysis', '10.1111/sms.12047'],
        ],
    },
    {
        title: 'How generated programs are built',
        rule: 'Each muscle trained about twice a week, roughly 10+ hard sets per muscle weekly, heavier sets for the main lifts and lighter, higher-rep accessories.',
        why: 'With the same weekly sets, training a muscle more often adds strength but changes muscle size little, so twice a week mainly keeps each session manageable. More weekly sets give more growth, with smaller gains for each extra set, and a wide range of loads builds muscle when sets are hard enough.',
        note: 'Exercise picks and joint-friendly swaps are coaching choices. If something hurts, swap it out.',
        refs: [
            ['Pelland JC, Remmert JF, Robinson ZP, et al. Sports Med. 2026;56(2):481–505.', 'The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains', '10.1007/s40279-025-02344-w'],
            ['Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW. J Strength Cond Res. 2017;31(12):3508–3523.', 'Strength and Hypertrophy Adaptations Between Low- vs. High-Load Resistance Training: A Systematic Review and Meta-analysis', '10.1519/JSC.0000000000002200'],
        ],
    },
    {
        title: 'Cardio zones',
        rule: 'Max heart rate ≈ 208 − 0.7 × age (women: 206 − 0.88 × age); most cardio in Zone 2; 150 minutes of moderate activity a week.',
        why: 'The Tanaka formula fits adults better than 220 − age; for women the Gulati formula fits better, as the male-based formulas overestimate their max. The talk test tracks the top of Zone 2. WHO recommends 150–300 moderate minutes a week. Intervals raise fitness fast; for fat loss they give a modest edge over steady cardio in short studies, so steady cardio remains a fine choice.',
        note: 'Formulas can be 10+ beats off for an individual; the talk test is a good check.',
        refs: [
            ['Tanaka H, Monahan KD, Seals DR. J Am Coll Cardiol. 2001;37(1):153–156.', 'Age-predicted maximal heart rate revisited'],
            ['Gulati M, Shaw LJ, Thisted RA, et al. Circulation. 2010;122(2):130–137. doi:10.1161/CIRCULATIONAHA.110.939249', 'Heart rate response to exercise stress testing in asymptomatic women: the St. James Women Take Heart Project'],
            ['Persinger R, Foster C, Gibson M, et al. Med Sci Sports Exerc. 2004;36(9):1632–1636.', 'Consistency of the talk test for exercise prescription'],
            ['Bull FC, Al-Ansari SS, Biddle S, et al. Br J Sports Med. 2020;54(24):1451–1462.', 'World Health Organization 2020 guidelines on physical activity and sedentary behaviour'],
            ['Helgerud J, Høydal K, Wang E, et al. Med Sci Sports Exerc. 2007;39(4):665–671.', 'Aerobic high-intensity intervals improve VO2max more than moderate training'],
            ['Deng Z, Li Q, Ma M, et al. BMC Sports Sci Med Rehabil. 2026;18(1).', 'Efficacy of different high-intensity interval training versus moderate-intensity continuous training for body composition and cardiorespiratory fitness in obese/overweight patients: a systematic review and network meta-analysis', '10.1186/s13102-026-01686-w'],
        ],
    },
    {
        title: 'Cardio alongside lifting',
        rule: 'Cardio at normal amounts doesn’t cost you muscle or strength. On days with both, lift first.',
        why: 'An umbrella review of 17 meta-analyses found that adding cardio to lifting improved aerobic fitness while strength, power and muscle growth matched lifting alone; lifting before cardio trended slightly better. Sprint intervals added fitness without hurting strength. At the level of single muscle fibres there may be a small cost, larger with running than with cycling.',
        note: 'Data on highly trained athletes are scarce, and “lift first” is a trend rather than a firm result. If your legs are the priority, cycling is the gentler choice.',
        refs: [
            ['Held S, Wolf L, Rappelt L, et al. Sports Med. 2026;56(6):1489–1512.', 'Maximizing Adaptations in Concurrent Training: An Umbrella Review of Meta-analyses', '10.1007/s40279-026-02401-y'],
            ['Lundberg TR, Feuerbacher JF, Sünkeler M, Schumann M. Sports Med. 2022;52(10):2391–2403.', 'The Effects of Concurrent Aerobic and Strength Training on Muscle Fiber Hypertrophy: A Systematic Review and Meta-Analysis', '10.1007/s40279-022-01688-x'],
            ['Ferraro-Farro D, Bandeira-Guimarães M, Blanco-Rambo E, et al. Int J Sports Med. 2026;47(10):747–759.', 'Does Sprint Interval Training Cause Interference in Concurrent Training? A Meta-Analysis Study', '10.1055/a-2820-4527'],
        ],
    },
    {
        title: 'Steps',
        rule: 'A daily step goal, 10,000 by default; reaching it ticks the steps habit.',
        why: 'Across 15 large studies, more daily steps were linked with lower risk of death, with benefits levelling off around 6,000–8,000 steps for older adults and 8,000–10,000 for younger adults.',
        note: 'These are observational links, not proof that steps alone cause the benefit.',
        refs: [
            ['Paluch AE, Bajpai S, Bassett DR, et al. Lancet Public Health. 2022;7(3):e219–e228.', 'Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts'],
        ],
    },
    {
        title: 'Daily habits',
        rule: 'Six daily habits chosen by your goal, not your program: steps, protein for your goal and bodyweight, sleep (7+ hours) and a direction for eating. Each goal has its own section below.',
        why: 'Training builds the stimulus; whether you lose fat or gain muscle depends mostly on what you eat, how you sleep and how much you move. The 2026 position stand of the International Society of Sports Nutrition puts protein at 1.2–1.6 g per kg a day for general health and 1.6–2.2 g with resistance training, higher while dieting.',
        note: 'Ranges, not exact targets: needs differ between people. The calorie habits are a direction to follow, not a count the app checks.',
        refs: [
            ['Morton RW, Murphy KT, McKellar SR, et al. Br J Sports Med. 2018;52(6):376–384. doi:10.1136/bjsports-2017-097608', 'A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults'],
            ['Watson NF, Badr MS, Belenky G, et al. J Clin Sleep Med. 2015;11(8):931–952. doi:10.5664/jcsm.4950', 'Joint Consensus Statement of the American Academy of Sleep Medicine and Sleep Research Society on the Recommended Amount of Sleep for a Healthy Adult: Methodology and Discussion'],
            ['Aragon AA, Campbell BI, Schoenfeld BJ, et al. J Int Soc Sports Nutr. 2026;23(1):2740266.', 'International Society of Sports Nutrition position stand: diets for body weight reduction', '10.1080/15502783.2026.2740266'],
        ],
    },
    {
        goal: 'fatloss',
        title: 'Goal: lose fat',
        rule: 'Eat up to about 500 kcal a day under maintenance, lose about 0.5% of bodyweight a week, keep lifting hard, and eat 1.8–2.4 g of protein per kg.',
        why: 'Fat loss needs an energy deficit; the type of diet matters far less. The 2026 ISSN position stand finds low-carb and low-fat diets perform about the same, as do intermittent fasting and daily restriction, while very aggressive diets lose more muscle. Lifting and enough protein are what protect muscle in a deficit. In a meta-analysis, a deficit of about 500 kcal a day was enough to stop lean-mass gains, though strength still rose, so the deficit stays moderate.',
        note: 'Maintenance calories are an estimate: let your weekly weight trend guide you. Plateaus are normal, partly because the body moves less while dieting, which is why steps stay a daily habit. 1.8–2.4 g is our pick within the published ranges.',
        refs: [
            ['Aragon AA, Campbell BI, Schoenfeld BJ, et al. J Int Soc Sports Nutr. 2026;23(1):2740266.', 'International Society of Sports Nutrition position stand: diets for body weight reduction', '10.1080/15502783.2026.2740266'],
            ['Murphy C, Koehler K. Scand J Med Sci Sports. 2022;32(1):125–137.', 'Energy deficiency impairs resistance training gains in lean mass but not strength: A meta-analysis and meta-regression', '10.1111/sms.14075'],
            ['Ashtary-Larky D, Mohammadi S. Health Sci Rep. 2026;9(7):e72803.', 'Weight Loss Plateau: Reasons, Challenges, and Solutions: A Narrative Review', '10.1002/hsr2.72803'],
        ],
    },
    {
        goal: 'muscle',
        title: 'Goal: build muscle',
        rule: 'Eat a little over maintenance (gain about 0.25–0.5% of bodyweight a week), eat 1.6–2.2 g of protein per kg, and do 10+ hard sets per muscle a week.',
        why: 'In trained lifters, a larger calorie surplus mostly added fat rather than extra muscle or strength compared with a small one. More weekly sets keep adding muscle, with smaller gains for each extra set. Across 105 trials, lean mass kept rising with protein above 1.3 g per kg a day, but more slowly.',
        note: 'Beginners can grow at maintenance; the surplus matters more as you get experienced. The surplus trial was small (17 lifters, 8 weeks).',
        refs: [
            ['Helms ER, Spence AJ, Sousa C, et al. Sports Med Open. 2023;9(1):102.', 'Effect of Small and Large Energy Surpluses on Strength, Muscle, and Skinfold Thickness in Resistance-Trained Individuals: A Parallel Groups Design', '10.1186/s40798-023-00651-y'],
            ['Pelland JC, Remmert JF, Robinson ZP, et al. Sports Med. 2026;56(2):481–505.', 'The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains', '10.1007/s40279-025-02344-w'],
            ['Tagawa R, Watanabe D, Ito K, et al. Nutr Rev. 2021;79(1):66–75.', 'Dose-response relationship between protein intake and muscle mass increase: a systematic review and meta-analysis of randomized controlled trials', '10.1093/nutrit/nuaa104'],
        ],
    },
    {
        goal: 'recomp',
        title: 'Goal: lose fat and build muscle',
        rule: 'Eat around maintenance or slightly under, keep protein high (1.8–2.4 g per kg), and keep adding reps or weight.',
        why: 'Building muscle while losing fat is most realistic for beginners, people coming back after a break and people with more fat to lose. It allows a small calorie gap at most: in a meta-analysis, a deficit near 500 kcal a day stopped lean-mass gains. Lifting and enough protein are what let muscle grow while body fat falls.',
        note: 'Progress is slow and the scale barely moves, so judge by your lifts, your waist and photos. Lean, experienced lifters usually do better alternating a gaining phase and a losing phase. Trials on recomposition itself are few; this section is a coaching summary of the studies above.',
        refs: [
            ['Murphy C, Koehler K. Scand J Med Sci Sports. 2022;32(1):125–137.', 'Energy deficiency impairs resistance training gains in lean mass but not strength: A meta-analysis and meta-regression', '10.1111/sms.14075'],
            ['Aragon AA, Campbell BI, Schoenfeld BJ, et al. J Int Soc Sports Nutr. 2026;23(1):2740266.', 'International Society of Sports Nutrition position stand: diets for body weight reduction', '10.1080/15502783.2026.2740266'],
            ['Tagawa R, Watanabe D, Ito K, et al. Nutr Rev. 2021;79(1):66–75.', 'Dose-response relationship between protein intake and muscle mass increase: a systematic review and meta-analysis of randomized controlled trials', '10.1093/nutrit/nuaa104'],
        ],
    },
    {
        goal: 'strength',
        title: 'Goal: get stronger',
        rule: 'Heavier main lifts (4–6 reps), eat around maintenance, 1.6–2.2 g of protein per kg.',
        why: 'Heavy loads give the biggest gains in one-rep max, while muscle size grows across a wide range of loads. Strength kept rising even in a calorie deficit, unlike lean mass. Training a lift more often each week adds strength, with smaller gains each time, and periodised training gave more strength than unchanging training at the same volume.',
        note: 'Strength is partly a skill: practice with good form counts. Eating around maintenance is a choice for recovery, not a tested number.',
        refs: [
            ['Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW. J Strength Cond Res. 2017;31(12):3508–3523.', 'Strength and Hypertrophy Adaptations Between Low- vs. High-Load Resistance Training: A Systematic Review and Meta-analysis', '10.1519/JSC.0000000000002200'],
            ['Pelland JC, Remmert JF, Robinson ZP, et al. Sports Med. 2026;56(2):481–505.', 'The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains', '10.1007/s40279-025-02344-w'],
            ['Murphy C, Koehler K. Scand J Med Sci Sports. 2022;32(1):125–137.', 'Energy deficiency impairs resistance training gains in lean mass but not strength: A meta-analysis and meta-regression', '10.1111/sms.14075'],
            ['Moesgaard L, Beck MM, Christiansen L, et al. Sports Med. 2022;52(7):1647–1666.', 'Effects of Periodization on Strength and Muscle Hypertrophy in Volume-Equated Resistance Training Programs: A Systematic Review and Meta-analysis', '10.1007/s40279-021-01636-1'],
        ],
    },
    {
        goal: 'general',
        title: 'Goal: maintain and stay fit',
        rule: 'Eat around maintenance (weight steady within about 1 kg), 1.2–1.6 g of protein per kg, strength training at least twice a week, and move every day.',
        why: 'For general health, the 2026 ISSN position stand puts protein at 1.2–1.6 g per kg a day. WHO recommends muscle-strengthening work on 2 or more days a week plus 150–300 minutes of moderate activity. More daily steps are linked with a lower risk of death, levelling off around 8,000–10,000 for younger adults.',
        note: 'Holding a weight you reached is a real goal, and the part most diets miss. If you aren’t trying to grow, fewer sets than the 10–20 range are fine.',
        refs: [
            ['Aragon AA, Campbell BI, Schoenfeld BJ, et al. J Int Soc Sports Nutr. 2026;23(1):2740266.', 'International Society of Sports Nutrition position stand: diets for body weight reduction', '10.1080/15502783.2026.2740266'],
            ['Bull FC, Al-Ansari SS, Biddle S, et al. Br J Sports Med. 2020;54(24):1451–1462.', 'World Health Organization 2020 guidelines on physical activity and sedentary behaviour'],
            ['Paluch AE, Bajpai S, Bassett DR, et al. Lancet Public Health. 2022;7(3):e219–e228.', 'Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts'],
        ],
    },
    {
        title: 'Strength tiers',
        rule: 'Tier thresholds are scaled to your bodyweight (allometric scaling, exponent 0.67).',
        why: 'Strength does not rise in a straight line with bodyweight, so scaling by bodyweight to the power of about two-thirds compares people of different sizes more fairly.',
        note: 'The tier thresholds themselves are approximations from strength-standard tables, not research values. Treat them as motivation, not a test.',
        refs: [
            ['Jaric S. Sports Med. 2002;32(10):615–631.', 'Muscle strength testing: use of normalisation for body size'],
        ],
    },
];

// The section for your goal comes first (and open); the other goals follow the general sections
function scienceSections() {
    const yours = COACH_SCIENCE.filter(section => section.goal === userGoal());
    return [...yours, ...COACH_SCIENCE.filter(section => !yours.includes(section))];
}

function referenceLink(title, doi) {
    return doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(title)}`;
}

function openScience() {
    haptic();
    document.getElementById('scienceBody').innerHTML = `
        <p class="science-intro">Every rule the coach follows, why, and the research behind it. Where a number is a coaching judgement rather than a study result, it says so.</p>
        ${scienceSections().map(section => `
            <details class="science-item${section.goal === userGoal() ? ' yours' : ''}"${section.goal === userGoal() ? ' open' : ''}>
                <summary>${section.goal === userGoal() ? '<em class="science-yours">Your goal</em>' : ''}<span>${escapeHtml(section.title)}</span><small>${escapeHtml(section.rule)}</small></summary>
                <p>${escapeHtml(section.why)}</p>
                <p class="science-note">${escapeHtml(section.note)}</p>
                <ol class="science-refs">
                    ${section.refs.map(([cite, title, doi]) => `<li><a href="${referenceLink(title, doi)}" target="_blank" rel="noopener">${escapeHtml(title)}</a><span>${escapeHtml(cite)}</span></li>`).join('')}
                </ol>
            </details>`).join('')}
        <p class="science-disclaimer">General fitness guidance, not medical advice. If you have a health condition, an injury or pain, check with a doctor or physiotherapist before training.</p>
    `;
    document.getElementById('scienceModal').classList.add('active');
}

function closeScience() {
    document.getElementById('scienceModal').classList.remove('active');
}

// ════════════════════════════════════════════
//  COACHING: insights, walkthrough, weekly recap, reminders
// ════════════════════════════════════════════

// ── Insight: one line on Today when something stands out (dismissable for the day) ──
function coachInsight() {
    const prog = PROGRAMS[currentProgram];
    const weekday = new Date().getDay();
    const stats = getStreakStats();
    const name = ex => exerciseDisplayName(ex, getCurrentWeek());

    // A lift stuck for 3+ sessions: say the ladder's next step for it
    const stalled = prog.exercises.find(ex => !ex.assist && stallLength(ex.id) >= 3);
    if (stalled) {
        const step = getProgression(stalled);
        return { key: `stall-${stalled.id}-${stallLength(stalled.id)}`, icon: 'record', text: `${name(stalled)} is stuck. ${step ? step.text : ''}`.trim() };
    }
    const daysOff = daysSinceLastWorkout();
    if (daysOff !== null && daysOff >= 5) {
        return { key: 'layoff', icon: 'lift', text: `${daysOff} days since your last workout. ${prog.days[getNextDay()]} is ready when you are.` };
    }
    if (stats.streak >= 2 && stats.thisWeek === 0 && (weekday === 5 || weekday === 6 || weekday === 0)) {
        return { key: 'streak', icon: 'streak', text: `Your ${stats.streak}-week streak ends Sunday. One workout this weekend keeps it alive.` };
    }
    // Only what matters today: cardio and steps are covered by the weekly quests, gains by the Progress strength card
    const near = nearestBadgeText();
    if (near) return { key: near.key, icon: near.track.icon, text: near.text };
    return null;
}

function insightDismissKey() {
    return currentUser ? `wt_insight_${currentUser.id}` : null;
}

function renderInsight() {
    const el = document.getElementById('insightCard');
    if (!el) return;
    const insight = coachInsight();
    let dismissed = '';
    try { dismissed = localStorage.getItem(insightDismissKey()) || ''; } catch (e) { /* private mode */ }
    if (!insight || dismissed === `${todayStr()}|${insight.key}`) {
        el.innerHTML = '';
        return;
    }
    el.innerHTML = `
        <div class="insight">
            <span class="insight-icon">${achievementIcon(insight.icon, 18)}</span>
            <p>${escapeHtml(insight.text)}</p>
            <button class="insight-close" onclick="dismissInsight('${insight.key}')" aria-label="Dismiss">×</button>
        </div>`;
}

function dismissInsight(key) {
    haptic();
    try { localStorage.setItem(insightDismissKey(), `${todayStr()}|${key}`); } catch (e) { /* private mode */ }
    renderInsight();
}

// ── First-time walkthrough: a spotlight over each part of Today ──
let tourStep = -1;

function tourSteps() {
    const lifting = document.getElementById('liftView').style.display !== 'none';
    return [
        { target: '.hero-level', title: 'Your level', text: 'Everything you do earns XP: workouts, sets, records, cardio, steps and habits. Climb from Rookie to Mythic.' },
        { target: '.hero-rings', title: 'Three rings', text: 'Lifting this week, cardio toward your weekly target, and today\'s steps. A ring turns gold when it closes.' },
        { target: '.hero-score', title: 'Consistency score', text: 'Your last 7 days in one number, from 0 to 100. Steady beats perfect.' },
        lifting
            ? { target: '#startWorkoutBtn', title: 'Start here', text: 'Today\'s session. Weights are filled in for you, and records and badges unlock as you go.' }
            : { target: '#restDay', title: 'Rest day', text: 'Recovery comes first. Cardio is optional, and lifting is one tap away.' },
        { target: '#todayHero .hl-open', title: 'Steps', text: 'Tap Steps for your daily steps from Apple Health, with a one-time setup.' },
        { target: '#habitsCard', title: 'Daily habits', text: 'Set by your goal in Settings. Fat loss or muscle comes from these, whatever program you follow.' },
        { target: '.bottom-nav > .tab-btn[onclick="switchTab(\'progress\')"]', title: 'Progress', text: 'Your level, badges, strength over time and a chart for every lift.' },
    ];
}

function startTour() {
    if (!document.getElementById('mainApp').classList.contains('active')) return;
    showTab('today');
    tourStep = 0;
    document.getElementById('tour').classList.add('show');
    showTourStep();
}

function showTourStep() {
    const steps = tourSteps();
    const step = steps[tourStep];
    const target = document.querySelector(step.target);
    if (!target || !target.getBoundingClientRect().width) {
        nextTourStep();
        return;
    }
    const fixed = getComputedStyle(target.closest('.bottom-nav') || target).position === 'fixed';
    if (!fixed) target.scrollIntoView({ block: 'center' });
    setTimeout(() => {
        const r = target.getBoundingClientRect();
        const pad = 8;
        const spot = document.getElementById('tourSpot');
        spot.style.left = `${r.left - pad}px`;
        spot.style.top = `${r.top - pad}px`;
        spot.style.width = `${r.width + pad * 2}px`;
        spot.style.height = `${r.height + pad * 2}px`;
        const card = document.getElementById('tourCard');
        card.querySelector('h3').textContent = step.title;
        card.querySelector('p').textContent = step.text;
        card.querySelector('.tour-dots').innerHTML = steps.map((_, i) => `<i class="${i === tourStep ? 'on' : ''}"></i>`).join('');
        card.querySelector('.tour-next').textContent = tourStep === steps.length - 1 ? 'Done' : 'Next';
        // Card goes below the spotlight, or above it when there isn't room
        const below = r.bottom + 16 + 190 < window.innerHeight;
        card.style.top = below ? `${r.bottom + pad + 12}px` : '';
        card.style.bottom = below ? '' : `${window.innerHeight - r.top + pad + 12}px`;
    }, fixed ? 0 : 280);
}

function nextTourStep() {
    haptic();
    tourStep++;
    if (tourStep >= tourSteps().length) endTour();
    else showTourStep();
}

function endTour() {
    tourStep = -1;
    document.getElementById('tour').classList.remove('show');
    window.scrollTo(0, 0);
    if (!allData._tourDone) {
        allData._tourDone = todayStr();
        scheduleSave();
    }
}

// Shown once per account, the first time Today opens with nothing else on screen
function maybeStartTour() {
    if (allData._tourDone || tourStep >= 0) return;
    setTimeout(() => {
        const busy = document.getElementById('recordMoment').classList.contains('show')
            || document.getElementById('celebrate').classList.contains('show')
            || document.querySelector('.modal-overlay.active');
        if (!allData._tourDone && !busy && document.getElementById('page-today').classList.contains('active')) startTour();
    }, 900);
}

// ── Weekly recap: last Monday–Sunday as a short story, shown once each week ──
function weekXp(monday) {
    const sunday = addDays(monday, 6);
    const inWeek = d => d >= monday && d <= sunday;
    const sessions = Object.values(metaFor('_sessions')).flat().filter(s => s && inWeek(s.date));
    let xp = 0;
    sessions.forEach(s => {
        if (s.type === 'workout') xp += 100 + 5 * (s.sets || 0);
        if (s.type === 'cardio') xp += (s.minutes || 0) * (s.zone >= 4 ? 2 : s.zone === 1 ? 0.5 : 1);
    });
    for (let i = 0; i < 7; i++) {
        const d = addDays(monday, i);
        xp += Math.max(0, healthCardio(d) - loggedCardio(d));
        xp += Math.min(150, Math.floor(stepsOn(d) / 100));
        const done = habitsDone(d);
        xp += done * 10 + (done >= dailyHabits().length ? 30 : 0);
    }
    xp += weekRecords(monday).length * 50;
    xp += Object.keys((metaFor('_quests')[monday] || {}).done || {}).length * QUEST_XP;
    xp += (allData._badgeLog || []).filter(b => inWeek(b.date)).reduce((sum, b) => sum + BADGE_TIERS[b.tier - 1].xp, 0);
    xp += Object.values(allData._specials || {}).filter(inWeek).length * SPECIAL_XP;
    return Math.round(xp);
}

// Personal records set in a week, from the current program's log
function weekRecords(monday) {
    const sunday = addDays(monday, 6);
    const data = progData();
    const records = [];
    PROGRAMS[currentProgram].exercises.forEach(ex => {
        let best = null;
        getLoggedWeeks(ex.id).forEach(l => {
            const date = (data[ex.id][l.week] || {}).date;
            if (best !== null && l.value > best && !ex.assist && date && date >= monday && date <= sunday) records.push(ex.name);
            best = best === null ? l.value : Math.max(best, l.value);
        });
    });
    return records;
}

const RECAP_FOCUS = {
    lift: 'Lifting held your score back. Book your sessions in the calendar like meetings.',
    cardio: 'Cardio is the gap. Two 30-minute Zone 2 sessions close most of it.',
    steps: 'Steps are the gap. A 20-minute walk after a meal adds about 2,000 a day.',
    habits: 'Habits are the gap. Pick one to tick every day this week.',
};

function recapData(monday) {
    const sunday = addDays(monday, 6);
    const { score, parts } = consistencyScore(sunday);
    const before = consistencyScore(addDays(monday, -1)).score;
    const delta = score - before;
    const workouts = allWorkoutDates().filter(d => d >= monday && d <= sunday).length;
    const target = weeklyLiftTarget(PROGRAMS[currentProgram]);
    const cardio = cardioMinutes(d => d >= monday && d <= sunday);
    const stepAvg = Math.round(Array.from({ length: 7 }, (_, i) => stepsOn(addDays(monday, i))).reduce((a, b) => a + b, 0) / 7);
    const records = weekRecords(monday);
    const badges = (allData._badgeLog || []).filter(b => b.date >= monday && b.date <= sunday)
        .map(b => `${BADGE_TIERS[b.tier - 1].name} ${(badgeTracks().find(t => t.id === b.track) || {}).name || ''}`)
        .concat(specialBadges().filter(sp => (allData._specials || {})[sp.id] >= monday && (allData._specials || {})[sp.id] <= sunday).map(sp => sp.name));
    const weakest = parts.reduce((a, b) => (b.ratio < a.ratio ? b : a));
    const focus = weakest.ratio >= 0.9 ? 'Every part of your week was strong. Repeat it.' : RECAP_FOCUS[weakest.key];
    const range = `${parseDate(monday).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' })} – ${parseDate(sunday).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' })}`;
    return { score, delta, workouts, target, cardio, stepAvg, records, badges, focus, range, xp: weekXp(monday) };
}

function recapHtml(monday) {
    const { score, delta, workouts, target, cardio, stepAvg, records, badges, focus, range, xp } = recapData(monday);
    const tile = (label, value, sub) => `<div class="rc-tile"><span>${label}</span><strong>${value}</strong>${sub ? `<small>${sub}</small>` : ''}</div>`;
    return `
        <div class="recap-kicker">Your week · ${escapeHtml(range)}</div>
        <div class="recap-score"><strong>${score}</strong><span class="recap-delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : '−'}${Math.abs(delta)} vs week before</span></div>
        <div class="recap-grid">
            ${tile('Workouts', `${workouts}<small>/${target}</small>`)}
            ${tile('Cardio', cardio, 'minutes')}
            ${tile('Steps', compactNum(stepAvg), 'a day')}
            ${tile('Records', records.length)}
            ${tile('XP', `+${xp.toLocaleString(LOCALE)}`)}
            ${tile('Badges', badges.length)}
        </div>
        ${records.length || badges.length ? `<div class="recap-list">
            ${records.map(r => `<div><span class="rl-dot gold"></span>New record: ${escapeHtml(r)}</div>`).join('')}
            ${badges.map(b => `<div><span class="rl-dot"></span>${escapeHtml(b)}</div>`).join('')}
        </div>` : ''}
        <div class="recap-focus"><span>This week's focus</span><p>${escapeHtml(focus)}</p></div>
    `;
}

let recapMonday = null;

function openRecap(monday = addDays(mondayOf(todayStr()), -7)) {
    recapMonday = monday;
    document.getElementById('recapBody').innerHTML = recapHtml(monday);
    document.getElementById('recapModal').classList.add('active');
}

function closeRecap() {
    document.getElementById('recapModal').classList.remove('active');
    setTimeout(nextMoment, 450);
}

// Once a week, the first time Today opens: last week's recap (if anything happened that week)
function maybeShowRecap() {
    if (!allData._tourDone) return;
    const lastMonday = addDays(mondayOf(todayStr()), -7);
    if (allData._recapSeen === lastMonday) return;
    const lastSunday = addDays(lastMonday, 6);
    const active = Object.values(metaFor('_sessions')).flat().some(s => s && s.date >= lastMonday && s.date <= lastSunday);
    if (!active) return;
    allData._recapSeen = lastMonday;
    scheduleSave();
    queueMoment(() => openRecap(lastMonday));
}

// ── Reminders: workout days, streaks at risk, steps (sent by the rest-push function) ──
const NUDGE_TYPES = [
    { id: 'workout', label: 'Workout days', note: 'A morning reminder on lifting days' },
    { id: 'streak', label: 'Streak at risk', note: 'Saturday morning, if the week has no workout yet' },
    { id: 'steps', label: 'Steps', note: 'Early evening, only if you\'re short of your goal' },
];

function nudgePrefs() {
    return { workout: true, streak: true, steps: true, ...((userProfile && userProfile.nudges) || {}) };
}

function renderNudgeSettings() {
    const el = document.getElementById('nudgeSettings');
    if (!el) return;
    const prefs = nudgePrefs();
    el.innerHTML = `
        <p class="settings-note">${restAlertsOn() ? 'Gentle reminders on your lock screen. Turn off any you don\'t want.' : 'Turn on Rest Alerts above first; reminders use the same notifications.'}</p>
        ${NUDGE_TYPES.map(t => `
            <label class="toggle-row">
                <span><strong>${t.label}</strong><small>${t.note}</small></span>
                <input type="checkbox" class="toggle" ${prefs[t.id] ? 'checked' : ''} ${restAlertsOn() ? '' : 'disabled'} onchange="setNudge('${t.id}', this.checked)">
            </label>`).join('')}
    `;
}

function setNudge(id, on) {
    haptic();
    userProfile = { ...userProfile, nudges: { ...nudgePrefs(), [id]: on } };
    scheduleSave();
    lastNudgePlan = '';
    scheduleNudges();
}

function localTime(date, hour, minute) {
    const d = parseDate(date);
    d.setHours(hour, minute, 0, 0);
    return d;
}

// " One more workout earns Gold Iron Regular." when the next session reaches a tier
function workoutBadgeTease() {
    const track = badgeTracks().find(t => t.id === 'workouts');
    const p = badgeProgress(track, playerStats());
    return p.next !== null && p.remaining === 1 ? ` One more workout earns ${BADGE_TIERS[p.tier].name} ${track.name}.` : '';
}

// The next 7 days of reminders, replanned whenever Today renders (only rows that changed are rewritten)
let lastNudgePlan = '';
let nudgeTimer = null;

function scheduleNudges() {
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(planNudges, 2000);
}

async function planNudges() {
    if (!currentUser || !sb || offlineMode || !restAlertsOn()) return;
    const prefs = nudgePrefs();
    const prog = PROGRAMS[currentProgram];
    const now = new Date();
    const today = todayStr();
    const rows = [];
    const add = (kind, at, title, body = '', day = null) => {
        if (at > now) rows.push({ user_id: currentUser.id, kind, fire_at: at.toISOString(), title: tr(title), body: tr(body), day });
    };

    if (prefs.workout) {
        if (prog.weekPlan) {
            for (let i = 0; i < 7; i++) {
                const date = addDays(today, i);
                const plan = prog.weekPlan[parseDate(date).getDay()];
                if (typeof plan !== 'number' || allWorkoutDates().includes(date)) continue;
                const count = prog.exercises.filter(ex => ex.day === plan).length;
                add('workout', localTime(date, 8, 0), `${prog.days[plan]} today`, `${count} exercises are ready for you.${workoutBadgeTease()}`);
            }
        } else {
            // Rolling programs: a nudge after two days off
            const last = workoutSessions().slice(-1)[0];
            const date = last ? addDays(last.date, 3) : addDays(today, 1);
            add('workout', localTime(date < today ? today : date, 8, 0), `${prog.days[getNextDay()]} is up next`, 'Two rest days done. Ready when you are.');
        }
    }
    if (prefs.streak) {
        const stats = getStreakStats();
        const saturday = addDays(mondayOf(today), 5);
        if (stats.streak >= 2 && stats.thisWeek === 0) {
            add('streak', localTime(saturday, 10, 0), `Your ${stats.streak}-week streak ends Sunday`, 'One workout this weekend keeps it going.');
        }
    }
    if (prefs.steps) {
        for (let i = 0; i < 7; i++) {
            const date = addDays(today, i);
            add('steps', localTime(date, 18, 30), 'Steps', '', date);
        }
    }

    const plan = JSON.stringify(rows.map(r => [r.kind, r.fire_at, r.title]));
    if (plan === lastNudgePlan) return;
    try {
        const { error: delError } = await sb.from('scheduled_pushes').delete().eq('user_id', currentUser.id).gt('fire_at', now.toISOString());
        if (delError) throw delError;
        if (rows.length) {
            const { error } = await sb.from('scheduled_pushes').insert(rows);
            if (error) throw error;
        }
        lastNudgePlan = plan;
    } catch (error) {
        console.warn('Reminders not scheduled:', error.message || error);
    }
}
