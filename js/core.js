// ════════════════════════════════════════════
//  SUPABASE INITIALIZATION
// ════════════════════════════════════════════

// Shown at the bottom of Settings so you can tell which version a phone is running.
// Bump it with every deploy.
const APP_VERSION = '1.74 · 30 Oct';

const SUPABASE_URL = 'https://hcwbcxhblfjpdlkwykez.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mEe_5g2UITyp5O-F9YRhRg_wTQWuOtf';

// The CDN library already owns the global name `supabase`. Declaring `let supabase`
// here throws "Identifier 'supabase' has already been declared" and kills the whole
// script (shown as "Script error." in sandboxed previews), so our client is `sb`.
let sb = null;
try {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (error) {
    console.error('Supabase init error:', error);
}

// Charts draw on a canvas, so their labels are translated before each draw (the language engine is in js/i18n.js)
if (PACK && window.Chart) Chart.register({
    id: 'i18n',
    beforeUpdate(chart) {
        const data = chart.data;
        if (data.labels) data.labels = data.labels.map(l => (typeof l === 'string' ? tr(l) : l));
        data.datasets.forEach(ds => { if (typeof ds.label === 'string') ds.label = tr(ds.label); });
    },
});

// ── Error reports: anything that breaks on a phone lands in the private error_log table
// (supabase-errors-setup.sql; only readable in the Supabase dashboard). At most 5 per page load, no repeats.
const reportedErrors = new Set();
function reportError(message, source = '', stack = '') {
    if (!sb || reportedErrors.size >= 5 || /[?&]test\b/.test(location.search)) return;
    const key = `${message}|${source}`;
    if (reportedErrors.has(key)) return;
    reportedErrors.add(key);
    sb.from('error_log').insert({
        user_id: typeof currentUser !== 'undefined' && currentUser ? currentUser.id : null,
        version: APP_VERSION,
        message: String(message).slice(0, 500),
        source: String(source).slice(0, 300),
        stack: String(stack || '').slice(0, 2000),
        screen: (document.querySelector('.screen.active') || {}).id || '',
        agent: navigator.userAgent.slice(0, 300),
    }).then(() => {}, () => {});
}
window.addEventListener('error', e => {
    // "Script error." with no details comes from other sites' scripts (browser extensions, CDNs): nothing to fix here
    if (e.message === 'Script error.' && !e.filename) return;
    reportError(e.message, `${e.filename || ''}:${e.lineno || 0}:${e.colno || 0}`, e.error && e.error.stack);
});
window.addEventListener('unhandledrejection', e => {
    const reason = e.reason || {};
    // Lost connections are normal at the gym; the app already keeps changes on the phone and retries
    if (/fetch|network|load failed/i.test(String(reason.message || reason))) return;
    reportError(reason.message || String(reason), 'promise', reason.stack);
});

// ════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════

let currentUser = null;
let userProfile = null;     // { gender, age, weight (kg), height (cm), units: 'kg' | 'lb' }
let currentProgram = null;  // key of PROGRAMS, or null when no program is chosen
// Everything in user_data.workout_data:
// {
//   [programId]: { [exerciseId]: { [week 0-11]: entry } },
//   _sessions:   { [programId]: [{ date, day, week, type: 'workout'|'mobility', minutes, sets }] },
//   _cycleStart: { [programId]: 'YYYY-MM-DD' },
//   _archive:    { [programId]: [{ start, end, data }] },   // finished 12-week cycles
//   _bodyweight: [{ date, kg }],
// }
// An entry is either a plain string (weight only, older data) or
// { kg: "60", sets: [{ kg: "60", reps: "8" }], date: "YYYY-MM-DD" } from workout mode.
// For pull-ups ('reps/+kg') the tracked value is reps and set.kg is the added weight.
let allData = {};
const WEEKS = 12;
let offlineMode = false;    // running from the phone's cached copy, cloud unreachable

// The page was opened from a "reset password" email link
let recoveryMode = location.hash.includes('type=recovery');

function progData() {
    if (!allData[currentProgram]) allData[currentProgram] = {};
    return allData[currentProgram];
}

function metaFor(key) {
    if (!allData[key]) allData[key] = {};
    return allData[key];
}

function programSessions() {
    const sessions = metaFor('_sessions');
    if (!sessions[currentProgram]) sessions[currentProgram] = [];
    return sessions[currentProgram];
}

const PLAY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
const CHECK_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const CLOSE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function appUrl() {
    // Keeps the GitHub Pages sub-path (e.g. /workout-trackerz/)
    return location.origin + location.pathname;
}

function formatNum(n) {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// ── Dates (local time, stored as YYYY-MM-DD) ──
function todayStr(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseDate(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
}
function daysBetween(a, b) {
    return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}
function addDays(s, n) {
    const d = parseDate(s);
    d.setDate(d.getDate() + n);
    return todayStr(d);
}
function mondayOf(s) {
    const d = parseDate(s);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return todayStr(d);
}
function prettyDate(s) {
    return parseDate(s).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
}

// ── Units: everything is stored in kg; lb is display only ──
const LB_PER_KG = 2.20462;

function usesLb() {
    return !!(userProfile && userProfile.units === 'lb');
}
function unitLabel(unit) {
    return usesLb() ? unit.replace('kg', 'lb') : unit;
}
function kgToDisplay(kg) {
    const n = parseFloat(kg);
    if (isNaN(n)) return '';
    return formatNum(usesLb() ? Math.round(n * LB_PER_KG * 10) / 10 : n);
}
function displayToKg(value) {
    const n = parseFloat(value);
    if (isNaN(n)) return null;
    return usesLb() ? Math.round((n / LB_PER_KG) * 1000) / 1000 : n;
}

// Pull-ups are tracked in reps; their set weight is "+kg" added on top of bodyweight
function isRepsBased(ex) {
    return ex.unit === 'reps/+kg';
}
function trackerUnit(ex) {
    return isRepsBased(ex) ? 'reps' : unitLabel(ex.unit);
}
function trackerToDisplay(ex, value) {
    if (isRepsBased(ex)) {
        const n = parseFloat(value);
        return isNaN(n) ? (value || '') : formatNum(n);
    }
    return kgToDisplay(value);
}
function setWeightUnit(ex) {
    return isRepsBased(ex) ? unitLabel('+kg') : unitLabel(ex.unit);
}

// ════════════════════════════════════════════
//  STRENGTH STANDARDS CALCULATOR
// ════════════════════════════════════════════

// Pull-ups (reps / added kg) and hyperextensions (added kg) are measured on top of
// bodyweight, so heavier lifters are already doing more work — don't scale them.
const UNSCALED_UNITS = ['reps/+kg', 'kg+'];

function getBaseWeight(gender) {
    // Reference bodyweights the base thresholds were written for
    return gender === 'male' ? 95 : 65;
}

function getStrengthMultiplier(gender) {
    // Allometric scaling (Wilks-like): diminishing returns at higher bodyweights
    return Math.pow(userProfile.weight / getBaseWeight(gender), 0.67);
}

// The user's sex from the profile ('male' | 'female'), or null when not set
function userGender() {
    const g = userProfile && userProfile.gender;
    return g === 'female' || g === 'male' ? g : null;
}

// The goal from the profile: 'fatloss' | 'muscle' | 'strength' | 'general' (the default)
function userGoal() {
    const g = userProfile && userProfile.goal;
    return ['fatloss', 'muscle', 'strength'].includes(g) ? g : 'general';
}

// Weekly cardio target, chosen in Settings; until then it follows the goal (light for muscle and strength,
// the WHO 150 minutes otherwise). Off removes the Cardio ring, its part of the score and cardio quests.
const CARDIO_LEVELS = { off: 0, light: 60, standard: 150, high: 300 };
function userCardio() {
    const c = userProfile && userProfile.cardio;
    if (c in CARDIO_LEVELS) return c;
    return ['muscle', 'strength'].includes(userGoal()) ? 'light' : 'standard';
}
function cardioTarget() {
    return CARDIO_LEVELS[userCardio()];
}

// Daily habits come from your goal, not your program: fat loss or muscle depends on eating, sleep and
// movement, and every program works with every goal. The first habit is always steps (ticked by itself
// once the step goal is synced). Protein is personalised to bodyweight (1.6–2.2 g/kg, Morton 2018).
// Kept to six, in a fixed order, because ticks are stored by position (_habits[date] = [indexes]).
function dailyHabits() {
    const kg = userProfile && userProfile.weight;
    const round5 = n => Math.round(n / 5) * 5;
    const protein = kg ? `${round5(kg * 1.6)}–${round5(kg * 2.2)} g protein` : 'Protein at every meal';
    const steps = `Hit your step goal (${stepGoal().toLocaleString(LOCALE)})`;
    const desk = 'Stand or walk 1–2 min every hour at the desk';
    return {
        fatloss: [steps, protein, 'Eat a little under maintenance (lose ~0.5% of bodyweight a week)', 'Vegetables or fruit at two meals', '7+ hours sleep', 'Water or zero-calorie drinks, not sugary ones'],
        muscle: [steps, protein, 'Eat a little over maintenance (gain ~0.25–0.5% of bodyweight a week)', 'Protein and carbs within a few hours of training', '7+ hours sleep', desk],
        strength: [steps, protein, 'Eat enough to recover (around maintenance)', '7+ hours sleep', desk, '5 minutes of mobility for your tightest spot'],
        general: [steps, protein, 'Vegetables or fruit at two meals', '7+ hours sleep', desk, '5 minutes of stretching'],
    }[userGoal()];
}

// Standards are written for one reference lifter (95 kg man or 65 kg woman). When the user's sex differs
// (a woman on a men's program, or the other way round), they are converted at equal bodyweight: women lift
// about 70% of men's numbers on upper-body lifts, about 80% on lower-body lifts and about 40% of the reps on
// pull-ups. Approximations from strength-standard tables, like the thresholds themselves.
const SEX_FACTOR = { upper: 0.7, lower: 0.8, reps: 0.4 };
const LOWER_BODY = ['gl', 'qd', 'hm', 'ad', 'cf'];

function sexFactor(exercise, standardGender) {
    const user = userGender();
    if (!user || user === standardGender) return 1;
    const kind = isRepsBased(exercise) ? 'reps'
        : exerciseMuscles(exercise.name).main.some(g => LOWER_BODY.includes(g)) ? 'lower' : 'upper';
    return user === 'female' ? SEX_FACTOR[kind] : 1 / SEX_FACTOR[kind];
}

function getThresholds(exercise) {
    if (!exercise.thresholds) return null;
    // The reference lifter the thresholds were written for (custom programs keep the source program's)
    const standardGender = exercise.standardGender || PROGRAMS[currentProgram].gender;
    const factor = sexFactor(exercise, standardGender);
    if (isRepsBased(exercise)) return exercise.thresholds.map(t => Math.max(1, Math.round(t * factor)));
    // Bodyweight scaling, except for lifts measured on top of bodyweight
    const multiplier = !userProfile || !userProfile.weight || UNSCALED_UNITS.includes(exercise.unit)
        ? 1 : getStrengthMultiplier(standardGender);
    return exercise.thresholds.map(t => Math.round(t * multiplier * factor * 10) / 10);
}

// ════════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════════

const SCREENS = {
    loading: 'loadingScreen',
    auth: 'authScreen',
    profile: 'profileScreen',
    selector: 'programSelector',
    app: 'mainApp',
    workout: 'workoutScreen',
    builder: 'builderScreen',
    trophy: 'trophyScreen',
    odyssey: 'odysseyScreen',
    cardio: 'cardioScreen',
    summary: 'summaryScreen',
};

// Marks the page as scrolled, which turns on the fade under the status bar (see body::before)
window.addEventListener('scroll', () => document.body.classList.toggle('scrolled', window.scrollY > 8), { passive: true });

// Kept on the phone so the opening quote, shown before sign-in finishes, can follow it too
function rememberGender() {
    try { localStorage.setItem('odyr_gender', userGender() || ''); } catch (e) { /* private mode */ }
}

// Every program card shows the same key facts in the same place: difficulty (bars + name) and days a week
// in the tag; split, session length and equipment underneath. Filled from the program's own fields.
const PROGRAM_LEVELS = ['', 'Beginner', 'Intermediate', 'Advanced'];

function programTagHtml(p) {
    const bars = [1, 2, 3].map(n => `<i${n <= p.level ? ' class="on"' : ''}></i>`).join('');
    return `<span class="lvl" aria-hidden="true">${bars}</span><span>${PROGRAM_LEVELS[p.level]}</span> · <span>${p.perWeek}</span>`;
}

function fillProgramCard(card, p) {
    if (!p.level) return;
    const tag = card.querySelector('.program-tag');
    if (tag) tag.innerHTML = programTagHtml(p);
    const kit = card.querySelector('.program-specs > div:nth-child(3)');
    if (kit) kit.innerHTML = `<span>Equipment</span>${escapeHtml(p.equipment)}`;
}

// Program menu: the programs written for your sex under "For you"; the others folded under "More programs"
// (one tap away, never hidden: every program converts its standards to whoever trains). Without a sex
// in the profile, every program is listed.
function orderProgramCards() {
    const programIdOf = card => (card.getAttribute('onclick').match(/'([^']+)'/) || [])[1];
    const programOf = card => PROGRAMS[programIdOf(card)];
    const cards = [...document.querySelectorAll('#forYouGrid .program-card, #moreProgramGrid .program-card, #cardioProgramGrid .program-card')].filter(programOf);
    const gender = userGender();
    const forYou = document.getElementById('forYouGrid');
    const more = document.getElementById('moreProgramGrid');
    // Programs written for your sex first, then the ones for everyone (cardio), in the order they're defined
    const order = Object.keys(PROGRAMS);
    const rank = p => !gender ? 0 : p.gender === gender ? 0 : !p.gender ? 1 : 2;
    const cardio = document.getElementById('cardioProgramGrid');
    const counts = { lifting: 0, cardio: 0 };
    cards.map(card => ({ card, i: order.indexOf(programIdOf(card)), rank: rank(programOf(card)), mine: rank(programOf(card)) < 2 }))
        .sort((a, b) => (a.rank - b.rank) || a.i - b.i)
        .forEach(({ card, mine }) => {
            const p = programOf(card);
            fillProgramCard(card, p);
            // Cardio programs have their own tab; lifting ones split into For you / More programs
            const kind = p.type === 'cardio' ? 'cardio' : 'lifting';
            (kind === 'cardio' ? cardio : mine ? forYou : more).appendChild(card);
            const index = card.querySelector('.program-index');
            if (index) index.textContent = String(++counts[kind]).padStart(2, '0');
        });
    document.getElementById('morePrograms').hidden = !more.children.length;
    document.getElementById('forYouKicker').hidden = !gender;
    if (!programKind) programKind = isCardioProgram() ? 'cardio' : 'lifting';
    showProgramKind();
}

// Program menu: Lifting | Cardio (opens on the kind of program you're on)
let programKind = null;

function setProgramKind(kind) {
    if (kind === programKind) return;
    haptic();
    programKind = kind;
    showProgramKind();
}

function showProgramKind() {
    document.querySelectorAll('#programKinds .ld-seg').forEach(b => b.classList.toggle('active', b.dataset.kind === programKind));
    document.getElementById('liftingPrograms').hidden = programKind !== 'lifting';
    document.getElementById('cardioPrograms').hidden = programKind !== 'cardio';
}

function showScreen(name) {
    if (name === 'selector') {
        renderCustomProgramCards();
        orderProgramCards();
    }
    Object.entries(SCREENS).forEach(([key, id]) => {
        document.getElementById(id).classList.toggle('active', key === name);
    });
    window.scrollTo(0, 0);
    if (typeof setTabBarCollapsed === 'function') setTabBarCollapsed(false);
}

// Decide where a logged-in user lands once their data is loaded
function routeAfterLogin() {
    rememberGender();
    if (!userProfile || !userProfile.age || !userProfile.weight) {
        showScreen('profile');
    } else if (currentProgram) {
        openProgram();
        if (loadActiveWorkout()) resumeWorkout();
    } else {
        showScreen('selector');
    }
}
