// ════════════════════════════════════════════
//  CELEBRATIONS
// ════════════════════════════════════════════

function celebrateTier(ex, tier, prs = []) {
    celebrate({
        icon: tierMedal(TIERS[tier].color, ROMAN[tier]),
        color: TIERS[tier].color,
        kicker: 'New tier unlocked',
        title: tierName(tier).toUpperCase(),
        text: `${escapeHtml(ex.name)} · ${tier === 6 ? 'the top tier' : `top ${TIERS[tier].pop} of lifters`}` +
            (prs.length ? `<br>New PRs: ${prs.map(escapeHtml).join(', ')}` : ''),
    });
}

// `text` may contain <br>; callers escape anything user-entered
function celebrate({ icon, color, kicker, title, text }) {
    document.getElementById('celebrateIcon').innerHTML = icon;
    document.getElementById('celebrateKicker').textContent = kicker;
    const titleEl = document.getElementById('celebrateTitle');
    titleEl.textContent = title;
    titleEl.style.color = color;
    document.getElementById('celebrateText').innerHTML = text;

    const colors = [color, '#e6b84a', '#f0e8d8', '#dcc89e', '#c98f66'];
    document.getElementById('celebrateConfetti').innerHTML = Array.from({ length: 60 }, (_, i) => `
        <span class="confetti-piece" style="left:${Math.random() * 100}%; background:${colors[i % colors.length]};
            animation-duration:${2 + Math.random() * 2}s; animation-delay:${Math.random() * 0.6}s;
            transform:rotate(${Math.random() * 360}deg);"></span>
    `).join('');
    document.getElementById('celebrate').classList.add('show');
    if (navigator.vibrate) navigator.vibrate(80);
    playSound('tier');
}

function closeCelebration() {
    document.getElementById('celebrate').classList.remove('show');
    document.getElementById('celebrateConfetti').innerHTML = '';
    setTimeout(nextMoment, 450);
}

// ════════════════════════════════════════════
//  CONSISTENCY SCORE + ACHIEVEMENTS
// ════════════════════════════════════════════

// Consistency score (0–100) over the last 7 days: lifting vs the plan (40), cardio vs the WHO 150 min (20),
// steps vs the daily goal (20) and daily habits (20). Parts with nothing to measure (no steps ever synced,
// a program without habits) drop out and the rest are re-weighted.
function consistencyScore(end = todayStr()) {
    const today = end;
    const from = addDays(today, -6);
    const inWindow = d => d >= from && d <= today;
    const prog = PROGRAMS[currentProgram];
    const parts = [];

    const workouts = allWorkoutDates().filter(inWindow).length;
    parts.push({ key: 'lift', label: 'Lift', weight: 40, ratio: Math.min(1, workouts / weeklyLiftTarget(prog)), text: `${workouts} of ${weeklyLiftTarget(prog)} workouts` });

    const cardio = cardioMinutes(inWindow);
    parts.push({ key: 'cardio', label: 'Cardio', weight: 20, ratio: Math.min(1, cardio / 150), text: `${cardio} of 150 min` });

    if (Object.keys(stepData).length) {
        const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
        const avg = days.reduce((sum, d) => sum + stepsOn(d), 0) / 7;
        parts.push({ key: 'steps', label: 'Steps', weight: 20, ratio: Math.min(1, avg / stepGoal()), text: `${Math.round(avg).toLocaleString(LOCALE)} a day` });
    }

    // Habits count once you've ticked one at least once (like steps once they've synced)
    if (Object.keys(metaFor('_habits')).length) {
        const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
        const share = days.reduce((sum, d) => sum + habitsDone(d) / dailyHabits().length, 0) / 7;
        parts.push({ key: 'habits', label: 'Habits', weight: 20, ratio: share, text: `${Math.round(share * 100)}% ticked` });
    }

    const total = parts.reduce((sum, p) => sum + p.weight, 0);
    const score = Math.round((100 * parts.reduce((sum, p) => sum + p.weight * p.ratio, 0)) / total);
    return { score, parts };
}

// WHO moderate-equivalent minutes (Zone 4–5 count double, Zone 1 not at all) for sessions on matching dates
function cardioMinutes(matchDate) {
    const byDay = {};
    Object.values(metaFor('_sessions')).forEach(list => (list || []).forEach(s => {
        if (s.type !== 'cardio' || !matchDate(s.date)) return;
        const minutes = s.zone >= 4 ? 2 * (s.minutes || 0) : s.zone >= 2 || !s.zone ? s.minutes || 0 : 0;
        byDay[s.date] = (byDay[s.date] || 0) + minutes;
    }));
    // Days with Apple Health exercise minutes count whichever is larger, so nothing is counted twice
    Object.keys(stepData).forEach(date => {
        if (!matchDate(date)) return;
        byDay[date] = Math.max(byDay[date] || 0, healthCardio(date));
    });
    return Object.values(byDay).reduce((a, b) => a + b, 0);
}

// Apple Health exercise minutes for a day (synced by the Shortcut), minus time spent in logged workouts
function healthCardio(date) {
    const exercise = (stepData[date] || {}).exercise_minutes || 0;
    if (!exercise) return 0;
    const lifting = Object.values(metaFor('_sessions')).flat()
        .filter(s => s && s.type === 'workout' && s.date === date)
        .reduce((sum, s) => sum + (s.minutes || 0), 0);
    return Math.max(0, exercise - lifting);
}

// Minutes of cardio logged by hand on a day (any zone)
function loggedCardio(date) {
    return Object.values(metaFor('_sessions')).flat()
        .filter(s => s && s.type === 'cardio' && s.date === date)
        .reduce((sum, s) => sum + (s.minutes || 0), 0);
}

// Ticked habits on a date; the steps habit counts once the step goal is synced
function habitsDone(date) {
    const done = new Set((metaFor('_habits')[date]) || []);
    if (stepsOn(date) >= stepGoal()) done.add(0);
    return done.size;
}

// ── Player stats: everything levels and badges measure, from the saved log (all programs) ──
function playerStats() {
    const st = { workouts: 0, sets: 0, bestStreak: 0, comebacks: 0, records: 0, bestPrDay: 0, topTier: 0, liftsRanked: 0,
        tierPoints: 0, volume: 0, cycles: 0, cardioTotal: 0, cardioXp: 0, intervals: 0, whoWeeks: 0, doubleDays: 0,
        fullHouseWeeks: 0, stepGoalDays: 0, bestStepStreak: 0, marathonDays: 0, stepXp: 0, habitTicks: 0, perfectDays: 0,
        bestScore: 0, weighIns: 0, swaps: 0, weeksLogged: 0, maxWeeksLogged: 0, perfectWeeks: 0, lowReadinessWorkouts: 0,
        deloadWorkouts: 0, honestWorkouts: 0, dawnWorkouts: 0, nightWorkouts: 0, allInDays: 0 };
    const sessions = Object.values(metaFor('_sessions')).flat().filter(Boolean);

    // Workouts, sets, week streaks, comebacks (back after 14+ days off), swaps
    const workoutDates = [];
    sessions.forEach(s => {
        if (s.type !== 'workout') return;
        st.workouts++;
        st.sets += s.sets || 0;
        st.swaps += (s.swaps || []).length;
        if (s.readiness === 'low') st.lowReadinessWorkouts++;
        if (s.deload) st.deloadWorkouts++;
        if (s.sets && (s.efforts || []).length >= s.sets) st.honestWorkouts++;
        if (s.startHour !== undefined && s.startHour < 7) st.dawnWorkouts++;
        if (s.startHour !== undefined && s.startHour >= 21) st.nightWorkouts++;
        workoutDates.push(s.date);
    });
    workoutDates.sort();
    workoutDates.forEach((d, i) => { if (i && daysBetween(workoutDates[i - 1], d) >= 14) st.comebacks++; });
    const weeks = [...new Set(workoutDates.map(mondayOf))].sort();
    let run = 0;
    weeks.forEach((week, i) => {
        run = i && addDays(weeks[i - 1], 7) === week ? run + 1 : 1;
        st.bestStreak = Math.max(st.bestStreak, run);
    });

    // Lifts: records (a week beating every earlier week), records per day, tiers, volume, cycles
    const prsByDate = {};
    Object.keys(PROGRAMS).forEach(pid => {
        const data = allData[pid];
        if (!data) return;
        const loggedWeeks = new Set();
        PROGRAMS[pid].exercises.forEach(ex => {
            const logged = getLoggedWeeks(ex.id, data);
            let best = null;
            logged.forEach(l => {
                loggedWeeks.add(l.week);
                if (best !== null && l.value > best && !ex.assist) {
                    st.records++;
                    const date = (data[ex.id][l.week] || {}).date;
                    if (date) prsByDate[date] = (prsByDate[date] || 0) + 1;
                }
                best = best === null ? l.value : Math.max(best, l.value);
                (l.sets || []).forEach(set => { st.volume += (parseFloat(set.kg) || 0) * (parseInt(set.reps) || 0); });
            });
            if (best !== null && ex.thresholds) {
                const tier = getTier({ ...ex, standardGender: ex.standardGender || PROGRAMS[pid].gender }, best);
                st.topTier = Math.max(st.topTier, tier);
                st.tierPoints += tier;
                if (tier >= 2) st.liftsRanked++;
            }
        });
        if (loggedWeeks.size >= WEEKS) st.cycles++;
        st.weeksLogged += loggedWeeks.size;
        st.maxWeeksLogged = Math.max(st.maxWeeksLogged, loggedWeeks.size);
    });
    Object.values(metaFor('_archive')).forEach(list => {
        st.cycles += (list || []).length;
        st.weeksLogged += (list || []).length * WEEKS;
    });
    st.bestPrDay = Math.max(0, ...Object.values(prsByDate));
    st.volume = Math.round(st.volume);

    // Cardio: minutes, XP (Zone 4–5 count double, Zone 1 half), intervals, WHO weeks, double days, full-house weeks
    const cardioWeeks = {};
    const cardioDates = new Set();
    sessions.forEach(s => {
        if (s.type !== 'cardio') return;
        const minutes = s.minutes || 0;
        st.cardioTotal += minutes;
        st.cardioXp += minutes * (s.zone >= 4 ? 2 : s.zone === 1 ? 0.5 : 1);
        if (s.zone >= 4) st.intervals++;
        cardioDates.add(s.date);
        cardioWeeks[mondayOf(s.date)] = true;
    });
    Object.keys(stepData).forEach(date => {
        const extra = healthCardio(date) - loggedCardio(date);
        if (extra <= 0) return;
        st.cardioTotal += extra;
        st.cardioXp += extra;
        cardioDates.add(date);
        cardioWeeks[mondayOf(date)] = true;
    });
    st.doubleDays = new Set(workoutDates.filter(d => cardioDates.has(d))).size;
    const liftTarget = weeklyLiftTarget(PROGRAMS[currentProgram]);
    Object.keys(cardioWeeks).forEach(monday => {
        const sunday = addDays(monday, 6);
        const moderate = cardioMinutes(d => d >= monday && d <= sunday);
        if (moderate >= 150) {
            st.whoWeeks++;
            if (workoutDates.filter(d => d >= monday && d <= sunday).length >= liftTarget) st.fullHouseWeeks++;
        }
    });

    // Steps: goal days, best run of goal days, 20k days, XP (1 per 100 steps, up to 150 a day)
    const goal = stepGoal();
    const stepDays = Object.keys(stepData).sort();
    let stepRun = 0;
    stepDays.forEach((day, i) => {
        const steps = stepData[day].steps;
        st.stepXp += Math.min(150, Math.floor(steps / 100));
        if (steps >= 20000) st.marathonDays++;
        if (steps >= goal) {
            st.stepGoalDays++;
            stepRun = i && addDays(stepDays[i - 1], 1) === day && stepData[stepDays[i - 1]].steps >= goal ? stepRun + 1 : 1;
            st.bestStepStreak = Math.max(st.bestStepStreak, stepRun);
        }
    });

    // Habits, weigh-ins, consistency
    Object.keys(metaFor('_habits')).forEach(date => {
        const done = habitsDone(date);
        st.habitTicks += done;
        if (done >= dailyHabits().length) st.perfectDays++;
    });
    st.weighIns = Array.isArray(allData._bodyweight) ? allData._bodyweight.length : 0;

    // Perfect week: lifting plan, 150 cardio minutes and the step goal on average, all in one Monday–Sunday
    const allWeeks = new Set(workoutDates.map(mondayOf));
    allWeeks.forEach(monday => {
        const sunday = addDays(monday, 6);
        const lifts = workoutDates.filter(d => d >= monday && d <= sunday).length;
        const cardio = cardioMinutes(d => d >= monday && d <= sunday);
        const stepAvg = Array.from({ length: 7 }, (_, i) => stepsOn(addDays(monday, i))).reduce((a, b) => a + b, 0) / 7;
        if (lifts >= liftTarget && cardio >= 150 && stepAvg >= goal) st.perfectWeeks++;
    });
    // All in: lifted, hit the step goal and ticked every habit on the same day
    st.allInDays = new Set(workoutDates.filter(d => stepsOn(d) >= goal && habitsDone(d) >= dailyHabits().length)).size;
    st.bestScore = Math.max(allData._bestScore || 0, consistencyScore().score);
    return st;
}

// ── Badges: 17 tracks with eight tiers each (Iron → Obsidian), plus signature and secret badges ──
// Tier pacing for every track: Iron on the first try, Bronze in the first week or two, Silver ~1 month,
// Gold ~3 months, Platinum ~6 months, Ruby ~1 year, Diamond ~2 years, Obsidian for the few who stay.
const BADGE_TIERS = [
    { name: 'Iron', color: '#b5b1ab', xp: 25, rarity: 95 },
    { name: 'Bronze', color: '#c48b57', xp: 50, rarity: 75 },
    { name: 'Silver', color: '#c9ced6', xp: 100, rarity: 50 },
    { name: 'Gold', color: '#d9b25f', xp: 200, rarity: 25 },
    { name: 'Platinum', color: '#dcd8d0', xp: 400, rarity: 12 },
    { name: 'Ruby', color: '#c4554e', xp: 800, rarity: 5 },
    { name: 'Diamond', color: '#f3eee4', xp: 1500, rarity: 2 },
    { name: 'Obsidian', color: '#f2d891', xp: 3000, rarity: 0.5 },
];
const ROMAN8 = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
// The old five tiers (Bronze, Silver, Gold, Platinum, Diamond) map onto the new eight
const OLD_TIER_MAP = [0, 2, 3, 4, 5, 7];

const BADGE_GROUPS = [
    { name: 'Strength', tracks: ['records', 'strength', 'allround', 'volume', 'sets'] },
    { name: 'Consistency', tracks: ['workouts', 'streak', 'weeks', 'comeback', 'score'] },
    { name: 'Cardio', tracks: ['cardio', 'who', 'intervals'] },
    { name: 'Steps', tracks: ['stepdays', 'stepstreak'] },
    { name: 'Habits', tracks: ['habits', 'weighins'] },
];

function badgeTracks() {
    return [
        { id: 'workouts', icon: 'lift', name: 'Iron Regular', unit: 'workouts', stat: 'workouts', goals: [3, 12, 40, 80, 156, 312, 624, 1000], tip: 'Finish workouts. Every session counts, however short.' },
        { id: 'streak', icon: 'streak', name: 'Unbroken', unit: 'weeks in a row', stat: 'bestStreak', goals: [2, 4, 12, 26, 52, 104, 156, 260], tip: 'Train at least once every week. One session keeps the streak alive.' },
        { id: 'records', icon: 'record', name: 'Record Breaker', unit: 'personal records', stat: 'records', goals: [3, 10, 30, 60, 120, 240, 400, 700], tip: 'Beat your best on any lift. Follow the +kg suggestions on Today.' },
        { id: 'strength', icon: 'tier', name: 'Strength Standard', unit: '', stat: 'topTier', goals: [2, 3, 3, 4, 4, 5, 5, 6], label: v => tierName(v), tip: 'Raise your best lift to the next strength standard for your bodyweight.' },
        { id: 'allround', icon: 'tier', name: 'All-Rounder', unit: 'lifts at Novice or above', stat: 'liftsRanked', goals: [2, 4, 6, 9, 12, 16, 20, 25], tip: 'Bring more of your lifts up to Novice, not just your favourites.' },
        { id: 'volume', icon: 'lift', name: 'Heavy Lifter', unit: 'kg lifted in total', stat: 'volume', goals: [5000, 50000, 200000, 500000, 1200000, 2500000, 5000000, 8000000], tip: 'Total weight × reps across every set you log.' },
        { id: 'sets', icon: 'lift', name: 'Set Machine', unit: 'sets', stat: 'sets', goals: [20, 100, 300, 800, 2500, 5000, 10000, 18000], tip: 'Tick off sets in workout mode.' },
        { id: 'weeks', icon: 'lift', name: 'Long Game', unit: 'program weeks logged', stat: 'weeksLogged', goals: [2, 4, 12, 24, 52, 104, 156, 260], tip: 'Log at least one lift in each week of your program.' },
        { id: 'comeback', icon: 'streak', name: 'Comeback', unit: 'returns after 2+ weeks off', stat: 'comebacks', goals: [1, 2, 3, 5, 8, 12, 16, 20], tip: 'Life happens. Coming back is what counts.' },
        { id: 'score', icon: 'score', name: 'Consistency', unit: 'best consistency score', stat: 'bestScore', goals: [40, 55, 65, 75, 85, 92, 97, 100], tip: 'Lift, cardio, steps and habits over 7 days, all in balance.' },
        { id: 'cardio', icon: 'cardio', name: 'Cardio Engine', unit: 'cardio minutes', stat: 'cardioTotal', goals: [30, 150, 600, 1800, 4000, 8000, 16000, 30000], tip: 'Log cardio sessions, or let Apple Health exercise minutes count.' },
        { id: 'who', icon: 'cardio', name: 'Heart Healthy', unit: 'weeks with 150 cardio min', stat: 'whoWeeks', goals: [1, 4, 12, 26, 52, 104, 156, 260], tip: 'Reach 150 moderate minutes in a week (Zone 4–5 count double).' },
        { id: 'intervals', icon: 'cardio', name: 'Interval Hunter', unit: 'Zone 4–5 sessions', stat: 'intervals', goals: [1, 5, 15, 30, 60, 100, 160, 250], tip: 'Log a threshold or max-effort cardio session.' },
        { id: 'stepdays', icon: 'steps', name: 'Step Counter', unit: 'days at step goal', stat: 'stepGoalDays', goals: [3, 14, 45, 90, 180, 365, 730, 1460], tip: 'Hit your daily step goal.' },
        { id: 'stepstreak', icon: 'steps', name: 'Stride Streak', unit: 'goal days in a row', stat: 'bestStepStreak', goals: [3, 7, 21, 45, 90, 180, 365, 730], tip: 'Hit your step goal day after day.' },
        { id: 'habits', icon: 'habit', name: 'Daily Discipline', unit: 'perfect habit days', stat: 'perfectDays', goals: [3, 7, 21, 45, 90, 180, 365, 730], tip: 'Tick every daily habit in one day.' },
        { id: 'weighins', icon: 'scale', name: 'Check-In', unit: 'weigh-ins', stat: 'weighIns', goals: [2, 8, 20, 40, 75, 150, 300, 520], tip: 'Log your bodyweight in Settings.' },
    ];
}

// One-off badges. Signature ones reward training smart; secret ones stay hidden until earned.
function specialBadges() {
    return [
        { id: 'perfect-week', icon: 'score', name: 'Perfect Week', desc: 'Close all three rings in one week: lifting plan, 150 cardio minutes and your step goal', stat: 'perfectWeeks' },
        { id: 'listened', icon: 'habit', name: 'Listened to Your Body', desc: 'Train on a low-readiness day, at the lighter weights the coach set', stat: 'lowReadinessWorkouts' },
        { id: 'deload', icon: 'streak', name: 'Deload Done Right', desc: 'Finish two workouts during a deload week instead of skipping it', stat: 'deloadWorkouts', goal: 2 },
        { id: 'honest', icon: 'record', name: 'Honest Effort', desc: 'Rate every set in 25 workouts', stat: 'honestWorkouts', goal: 25 },
        { id: 'dawn', icon: 'streak', name: 'Dawn Patrol', desc: 'Start 10 workouts before 7 AM', stat: 'dawnWorkouts', goal: 10 },
        { id: 'full-house', icon: 'score', name: 'Full House', desc: 'Hit your lifting plan and 150 cardio minutes in the same week', stat: 'fullHouseWeeks' },
        { id: 'double-day', icon: 'cardio', name: 'Double Day', desc: 'Lift and do cardio on the same day', stat: 'doubleDays' },
        { id: 'record-day', icon: 'record', name: 'Record Day', desc: 'Set 3 personal records in one workout', stat: 'bestPrDay', goal: 3 },
        { id: 'marathon', icon: 'steps', name: 'Marathon Day', desc: 'Walk 20,000 steps in one day', stat: 'marathonDays' },
        { id: 'adaptable', icon: 'lift', name: 'Adaptable', desc: 'Swap an exercise 10 times', stat: 'swaps', goal: 10 },
        { id: 'flawless', icon: 'score', name: 'Flawless', desc: 'Reach a consistency score of 100', stat: 'bestScore', goal: 100 },
        { id: 'summit', icon: 'tier', name: 'Summit', desc: `Reach ${tierName(6)} on any lift`, stat: 'topTier', goal: 6 },
        { id: 'night-owl', icon: 'streak', name: 'Night Owl', desc: 'Start 5 workouts after 9 PM', stat: 'nightWorkouts', goal: 5, secret: true },
        { id: 'full-cycle', icon: 'lift', name: 'The Full Cycle', desc: 'Log all 12 weeks of a program', stat: 'maxWeeksLogged', goal: 12, secret: true },
        { id: 'all-in', icon: 'score', name: 'All In', desc: 'Lift, hit your step goal and tick every habit on the same day', stat: 'allInDays', secret: true },
    ];
}

const SPECIAL_XP = 250;
const SECRET_XP = 500;

// Highest tier reached on a track (0–8); stored tiers never go back down
function badgeTier(track, stats) {
    const reached = track.goals.filter(g => (stats[track.stat] || 0) >= g).length;
    return Math.max(reached, (allData._badges || {})[track.id] || 0);
}

function badgeGoalText(track, value) {
    if (track.label) return track.label(value);
    // "1 workout", "1 personal record", "1 weigh-in": singular for one
    const unit = value === 1 ? track.unit.replace(/(\w+?)s\b/, '$1') : track.unit;
    return `${value.toLocaleString(LOCALE)} ${unit}`;
}

// Progress toward the next tier: { tier, next, ratio, remaining }
function badgeProgress(track, stats) {
    const tier = badgeTier(track, stats);
    const value = stats[track.stat] || 0;
    const next = track.goals[tier];
    if (next === undefined) return { tier, next: null, ratio: 1, remaining: 0, value };
    const prev = tier && !track.label ? track.goals[tier - 1] : 0;
    return { tier, next, value, ratio: Math.max(0, Math.min(1, (value - prev) / Math.max(1, next - prev))), remaining: Math.max(0, next - value) };
}

// ── Levels: XP from everything you do, levels 1–150 on a steep curve, rank titles by level ──
// Paced for someone training ~3 times a week with steps and cardio (~2,000 XP a week): level 10 in about
// six weeks, 30 in a year, 60 in about four years, 100 in ten, 150 a lifetime. (v1.53; was 1–100 at 100·(n−1)^1.7)
const RANKS = [[1, 'Rookie'], [5, 'Apprentice'], [10, 'Contender'], [20, 'Athlete'], [30, 'Competitor'], [45, 'Veteran'],
    [60, 'Elite'], [75, 'Master'], [90, 'Grandmaster'], [110, 'Legend'], [130, 'Titan'], [150, 'Mythic']];
const MAX_LEVEL = 150;
const LEVEL_CURVE = 2;   // bump when the curve changes, so the stored level resets quietly

function xpForLevel(level) {
    return Math.round(180 * Math.pow(level - 1, 1.875));
}

function levelFromXp(xp) {
    let level = 1;
    while (level < MAX_LEVEL && xpForLevel(level + 1) <= xp) level++;
    return level;
}

function rankFor(level) {
    return RANKS.filter(([min]) => level >= min).pop()[1];
}

function playerXp(stats) {
    const specials = allData._specials || {};
    const badgeXp = badgeTracks().reduce((sum, t) => sum + BADGE_TIERS.slice(0, badgeTier(t, stats)).reduce((a, b) => a + b.xp, 0), 0)
        + specialBadges().filter(sp => specials[sp.id]).reduce((sum, sp) => sum + (sp.secret ? SECRET_XP : SPECIAL_XP), 0);
    const sources = [
        ['Workouts', stats.workouts * 100],
        ['Sets', stats.sets * SET_XP],
        ['Records', stats.records * 50],
        ['Strength tiers', stats.tierPoints * 40],
        ['Cardio', Math.round(stats.cardioXp)],
        ['Steps', stats.stepXp],
        ['Habits', stats.habitTicks * 10 + stats.perfectDays * 30],
        ['Weigh-ins', stats.weighIns * 10],
        ['Badges', badgeXp],
    ];
    const total = sources.reduce((sum, [, xp]) => sum + xp, 0);
    const level = levelFromXp(total);
    const floor = xpForLevel(level);
    const next = level < MAX_LEVEL ? xpForLevel(level + 1) : floor;
    return { total, sources, level, rank: rankFor(level), into: total - floor, span: next - floor, toNext: next - total };
}

const ACHIEVEMENT_ICONS = {
    lift: '<path d="M6 8v8M3.5 10v4M18 8v8M20.5 10v4M6 12h12"/>',
    streak: '<path d="M12 3c.8 3 4.5 4.6 4.5 9a4.5 4.5 0 0 1-9 0c0-2 .9-3.3 2-4.3.2 1.8 1.1 2.8 2.2 2.8 0-2.6-.9-4.6.3-7.5z"/>',
    record: '<path d="M8 4h8v4.5a4 4 0 0 1-8 0V4zM8 6H5.5a2.5 2.5 0 0 0 2.6 3.2M16 6h2.5a2.5 2.5 0 0 1-2.6 3.2M12 12.5V16M9 20h6M10 16h4v4h-4z"/>',
    tier: '<path d="M12 3.5l7.4 4.25v8.5L12 20.5l-7.4-4.25v-8.5z"/>',
    cardio: '<path d="M3 12h4l2-4.5 3.5 9 2.2-4.5H21"/>',
    steps: '<path d="M8.5 4c1.9 0 2.8 2 2.8 4.6S10.4 12.5 8.5 12.5 5.7 11 5.7 8.6 6.6 4 8.5 4zM15.5 11.5c1.9 0 2.8 2 2.8 4.6s-.9 3.9-2.8 3.9-2.8-1.5-2.8-3.9.9-4.6 2.8-4.6z"/>',
    habit: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    score: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    scale: '<path d="M5 20h14l-1.6-11.5H6.6z"/><path d="M9 8.5a3 3 0 0 1 6 0"/><path d="M12 12v3"/>',
};

function achievementIcon(icon, size = 22) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ACHIEVEMENT_ICONS[icon]}</svg>`;
}

// ── Medal art: each tier has its own silhouette (tier 0 = locked outline) ──
function medalGlyph(icon, color, y = 0, size = 30) {
    return `<svg x="${-size / 2}" y="${y - size / 2}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ACHIEVEMENT_ICONS[icon]}</svg>`;
}

function medalSvg(tier, icon, size = 64, extraClass = '') {
    const beads = Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return `<circle cx="${(Math.sin(a) * 40).toFixed(1)}" cy="${(-Math.cos(a) * 40).toFixed(1)}" r="2"/>`;
    }).join('');
    const leaves = [[-44, 8, -30], [-48, -8, -10], [-44, -24, 15], [-36, 22, -55]]
        .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="10" transform="rotate(${r} ${x} ${y})"/><ellipse cx="${-x}" cy="${y}" rx="5" ry="10" transform="rotate(${-r} ${-x} ${y})"/>`).join('');
    const art = [
        // 0 · locked
        `<circle r="42" fill="rgba(255,255,255,0.02)" stroke="rgba(240,232,216,0.18)" stroke-width="1.5" stroke-dasharray="3 5"/>${medalGlyph(icon, 'rgba(240,232,216,0.28)')}`,
        // I · Iron: plain coin
        `<circle r="42" fill="#2a2928" stroke="#8a8784" stroke-width="2"/>${medalGlyph(icon, '#b5b1ab')}`,
        // II · Bronze: coin with an inner ring
        `<circle r="44" fill="#3a2a1c" stroke="#c48b57" stroke-width="2.5"/><circle r="34" fill="none" stroke="#c48b57" stroke-opacity="0.5" stroke-width="1"/>${medalGlyph(icon, '#e0aa78')}`,
        // III · Silver: beaded rim
        `<circle r="46" fill="#2a2c30" stroke="#c9ced6" stroke-width="2"/><g fill="#c9ced6">${beads}</g><circle r="31" fill="#34373c" stroke="#c9ced6" stroke-opacity="0.6" stroke-width="1"/>${medalGlyph(icon, '#eef1f5')}`,
        // IV · Gold: laurel crest around a hexagon
        `<g fill="#d9b25f">${leaves}</g><polygon points="0,-40 34.6,-20 34.6,20 0,40 -34.6,20 -34.6,-20" fill="#3d3015" stroke="#f2d891" stroke-width="2.5"/><polygon points="0,-31 26.8,-15.5 26.8,15.5 0,31 -26.8,15.5 -26.8,-15.5" fill="none" stroke="#d9b25f" stroke-opacity="0.6" stroke-width="1"/>${medalGlyph(icon, '#f2d891')}`,
        // V · Platinum: star rosette with ribbons
        `<path d="M-16 34 L-24 68 L-12 60 L-4 70 L0 38 Z" fill="#8d867b"/><path d="M16 34 L24 68 L12 60 L4 70 L0 38 Z" fill="#b5b1ab"/><polygon points="0,-50 11,-27 35,-35 27,-11 50,0 27,11 35,35 11,27 0,50 -11,27 -35,35 -27,11 -50,0 -27,-11 -35,-35 -11,-27" fill="#2e2b27" stroke="#dcd8d0" stroke-width="2"/><circle r="28" fill="#3a3732" stroke="#dcd8d0" stroke-width="1.5"/>${medalGlyph(icon, '#f6f2ea')}`,
        // VI · Ruby: shield set with a gem
        `<path d="M0 -50 L40 -36 L40 6 C40 30 22 44 0 54 C-22 44 -40 30 -40 6 L-40 -36 Z" fill="#2a1312" stroke="#c4554e" stroke-width="2.2"/><path d="M0 -42 L32 -30 L32 5 C32 25 18 37 0 45 C-18 37 -32 25 -32 5 L-32 -30 Z" fill="none" stroke="#c4554e" stroke-opacity="0.5" stroke-width="1"/><polygon points="0,-60 9,-50 0,-38 -9,-50" fill="#c4554e" stroke="#f0b0a6" stroke-width="1"/>${medalGlyph(icon, '#f0b0a6', 6)}`,
        // VII · Diamond: cut gem with rays
        `<g stroke="#f3eee4" stroke-width="1.5" stroke-linecap="round" opacity="0.8"><path d="M0 -60v-10"/><path d="M42 -42l7 -7"/><path d="M-42 -42l-7 -7"/><path d="M56 4h10"/><path d="M-56 4h-10"/></g><polygon points="-44,-16 -25,-42 25,-42 44,-16 0,50" fill="#26231f" stroke="#f6f2ea" stroke-width="2.2"/><path d="M-44 -16H44M-25 -42L-13 -16L0 -42L13 -16L25 -42M-13 -16L0 50M13 -16L0 50" fill="none" stroke="#e8e1d4" stroke-opacity="0.55" stroke-width="1"/>${medalGlyph(icon, '#fffaf0', 2, 26)}<path d="M30 -56l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fffaf0"/>`,
        // VIII · Obsidian: black crowned gem with a gold halo
        `<circle r="58" fill="none" stroke="#d9b25f" stroke-opacity="0.35" stroke-width="1"/><circle r="64" fill="none" stroke="#d9b25f" stroke-opacity="0.18" stroke-width="1" stroke-dasharray="2 5"/><path d="M-30 -30 L-18 -50 L-6 -34 L0 -54 L6 -34 L18 -50 L30 -30 Z" fill="#0b0a0a" stroke="#f2d891" stroke-width="1.6" stroke-linejoin="round"/><polygon points="-42,-26 42,-26 30,26 0,50 -30,26" fill="#0b0a0a" stroke="#f2d891" stroke-width="2.2" stroke-linejoin="round"/><path d="M-42 -26L0 50L42 -26M-30 26L0 -26L30 26" fill="none" stroke="#d9b25f" stroke-opacity="0.4" stroke-width="1"/>${medalGlyph(icon, '#f2d891', 2, 26)}`,
    ][tier];
    return `<svg class="medal t${tier} ${extraClass}" viewBox="-70 -75 140 150" width="${size}" height="${size}" aria-hidden="true">${art}</svg>`;
}

function badgeCount() {
    return Object.values(allData._badges || {}).reduce((a, b) => a + b, 0) + Object.keys(allData._specials || {}).length;
}

// Badge tiers (_badges { track: tier }), the day each tier was earned (_badgeDates { track: { tier: date } }),
// specials (_specials { id: date }) and the level (_level) are stored so they never go backwards.
// The first run stores what was already earned quietly; after that each new tier, special or level gets a moment.
function checkAchievements() {
    if (!currentUser || !currentProgram) return [];
    const stats = playerStats();
    let changed = false;
    if (stats.bestScore > (allData._bestScore || 0)) {
        allData._bestScore = stats.bestScore;
        changed = true;
    }
    // The first run, the switch to eight tiers and the harder targets (v1.57) all settle quietly
    let quiet = !allData._badges;
    if (!allData._badges) {
        allData._badges = {};
        delete allData._achievements;   // replaced by badges (v1.20)
        changed = true;
    } else if ((allData._badgeVersion || 1) < 2) {
        quiet = true;
        // v1.29: five tiers became eight; keep what was earned at the matching new tier
        Object.keys(allData._badges).forEach(id => { allData._badges[id] = OLD_TIER_MAP[allData._badges[id]] || 0; });
        (allData._badgeLog || []).forEach(entry => { entry.tier = OLD_TIER_MAP[entry.tier] || entry.tier; });
        changed = true;
    }
    if ((allData._badgeVersion || 2) < 3 && allData._badges) {
        // v1.57: harder targets. Badges are re-measured once against them, quietly; tiers above what the
        // new targets give are taken back (and their dates), so every tier from here on is earned the hard way.
        quiet = true;
        badgeTracks().forEach(track => {
            const tier = track.goals.filter(g => (stats[track.stat] || 0) >= g).length;
            if ((allData._badges[track.id] || 0) > tier) allData._badges[track.id] = tier;
            const trackDates = (allData._badgeDates || {})[track.id];
            if (trackDates) Object.keys(trackDates).forEach(t => { if (+t > tier) delete trackDates[t]; });
        });
        delete allData._level;   // less badge XP can mean a lower level; it is stored again below without a pop-up
        allData._badgeLog = (allData._badgeLog || []).filter(entry => {
            const track = badgeTracks().find(t => t.id === entry.track);
            return track && entry.tier <= (allData._badges[track.id] || 0);
        });
    }
    if (allData._badgeVersion !== 3) {
        allData._badgeVersion = 3;
        changed = true;
    }
    const badges = allData._badges;
    const dates = allData._badgeDates || (allData._badgeDates = {});
    const specials = allData._specials || (allData._specials = {});
    const moments = [];

    badgeTracks().forEach(track => {
        const tier = track.goals.filter(g => (stats[track.stat] || 0) >= g).length;
        const had = badges[track.id] || 0;
        if (tier > had) {
            badges[track.id] = tier;
            const trackDates = dates[track.id] || (dates[track.id] = {});
            for (let t = had + 1; t <= tier; t++) if (!trackDates[t] && !quiet) trackDates[t] = todayStr();
            if (!quiet) (allData._badgeLog || (allData._badgeLog = [])).push({ track: track.id, tier, date: todayStr() });
            moments.push(() => showBadgeMoment(track, tier));
            changed = true;
        }
    });
    specialBadges().forEach(sp => {
        if (!specials[sp.id] && (stats[sp.stat] || 0) >= (sp.goal || 1)) {
            specials[sp.id] = todayStr();
            moments.push(() => showSpecialMoment(sp));
            changed = true;
        }
    });
    const xp = playerXp(stats);
    if (allData._levelCurve !== LEVEL_CURVE) {
        // A new level curve: start from the level the new curve gives, without a level-up moment
        allData._levelCurve = LEVEL_CURVE;
        if (allData._level) allData._level = xp.level;
        changed = true;
    }
    if (xp.level > (allData._level || 0)) {
        const hadLevel = !!allData._level;
        allData._level = xp.level;
        if (hadLevel && !quiet) moments.push(() => showLevelMoment(xp));
        changed = true;
    }
    if (changed) scheduleSave();
    if (!quiet) moments.slice(0, 5).forEach(m => queueMoment(m));
    return moments;
}

// New tier: a blank coin is "minted" into the new medal, then a light sweep passes over it
function showBadgeMoment(track, tier) {
    const t = BADGE_TIERS[tier - 1];
    showMoment({
        kicker: `${t.name} · ${ROMAN8[tier]}`,
        valueHtml: `<span class="mint">${medalSvg(1, track.icon, 150, 'mint-blank')}${medalSvg(tier, track.icon, 150, 'mint-medal')}<i class="mint-shine"></i></span>`,
        unit: '',
        name: track.name,
        sub: `${badgeGoalText(track, track.goals[tier - 1])} · +${t.xp} XP`,
        color: t.color,
        sound: 'badge',
    });
}

function showSpecialMoment(sp) {
    showMoment({
        kicker: sp.secret ? 'Secret badge' : 'Signature badge',
        valueHtml: `<span class="moment-medal">${achievementIcon(sp.icon, 40)}</span>`,
        unit: '',
        name: sp.name,
        sub: `${sp.desc} · +${sp.secret ? SECRET_XP : SPECIAL_XP} XP`,
        sound: 'badge',
    });
}

function showLevelMoment(xp) {
    showMoment({
        kicker: 'Level up',
        valueHtml: escapeHtml(String(xp.level)),
        unit: xp.rank,
        name: `Level ${xp.level}`,
        sub: xp.level < MAX_LEVEL ? `${xp.toNext.toLocaleString(LOCALE)} XP to level ${xp.level + 1}` : 'Maximum level',
        sound: 'level',
    });
}

function openLevel() {
    openTrophyRoom();
}

function openAchievements() {
    openTrophyRoom();
}

// Where XP came from (trophy room, under the level)
function xpSourcesHtml(xp) {
    return `
        <details class="level-sources">
            <summary>Where your ${xp.total.toLocaleString(LOCALE)} XP comes from</summary>
            ${xp.sources.filter(([, v]) => v > 0).map(([name, v]) => `<div class="ls-row"><span>${name}</span><span>${v.toLocaleString(LOCALE)} XP</span></div>`).join('') || '<div class="ls-row"><span>Finish a workout to earn your first XP</span></div>'}
            <p>Workout 100 · set 5 · record 50 · strength tier 40 per lift · cardio 1 per minute (Zone 4–5 double) · steps 1 per 100 (150 a day max) · habit 10, perfect day +30 · weigh-in 10 · badge tiers 25 to 3,000 · signature badges 250 · secret badges 500.</p>
        </details>`;
}

// ════════════════════════════════════════════
//  TROPHY ROOM: showcase, badge groups, badge detail, nudges
// ════════════════════════════════════════════

// The three pinned badges (workout_data._showcase); empty slots fall back to your highest tiers
function showcaseTracks(stats = playerStats()) {
    const tracks = badgeTracks();
    const pinned = (allData._showcase || []).map(id => tracks.find(t => t.id === id)).filter(Boolean);
    const best = tracks.filter(t => !pinned.includes(t)).sort((a, b) => badgeTier(b, stats) - badgeTier(a, stats));
    return pinned.concat(best).slice(0, 3);
}

function openTrophyRoom() {
    haptic();
    renderTrophyRoom();
    showScreen('trophy');
}

function closeTrophyRoom() {
    haptic();
    showScreen('app');
}

// The level ring echoes the Odyr mark: an open ring whose gold part grows toward the next level,
// with the traveller point at its tip; the gap at the top right is where a level is completed.
function levelRingSvg(xp) {
    const r = 54, c = 2 * Math.PI * r, arc = c * 334 / 360;
    const ratio = xp.level >= MAX_LEVEL ? 1 : Math.max(0, Math.min(1, xp.into / xp.span));
    const angle = (-31 + ratio * 334) * Math.PI / 180;
    return `
        <svg class="odyr-ring" viewBox="0 0 120 120" aria-hidden="true">
            <circle class="track" cx="60" cy="60" r="${r}" stroke-dasharray="${arc} ${c}" transform="rotate(-31 60 60)"/>
            <circle class="fill" cx="60" cy="60" r="${r}" stroke-dasharray="${Math.max(0.01, ratio * arc)} ${c}" transform="rotate(-31 60 60)"/>
            <circle class="dot" cx="${60 + r * Math.cos(angle)}" cy="${60 + r * Math.sin(angle)}" r="4.2"/>
        </svg>`;
}

function levelRing(xp) {
    return `<div class="th-ring">${levelRingSvg(xp)}<div class="th-level"><span>Level</span><strong>${xp.level}</strong></div></div>`;
}

function renderTrophyRoom() {
    const stats = playerStats();
    const xp = playerXp(stats);
    const nextRank = RANKS.find(([min]) => min > xp.level);
    const tracks = badgeTracks();
    const specials = allData._specials || {};
    const pinned = allData._showcase || [];
    const earnedTiers = tracks.reduce((sum, t) => sum + badgeTier(t, stats), 0);
    const card = track => {
        const p = badgeProgress(track, stats);
        const pips = BADGE_TIERS.map((t, i) => `<i style="${i < p.tier ? `background:${t.color}` : ''}"></i>`).join('');
        return `
            <button class="badge-card${p.tier ? '' : ' locked'}${p.tier >= 7 ? ' gleam' : ''}" onclick="openBadge('${track.id}')">
                ${medalSvg(p.tier, track.icon, 92)}
                <span class="badge-name">${escapeHtml(track.name)}</span>
                <span class="badge-tier" style="${p.tier ? `color:${BADGE_TIERS[p.tier - 1].color}` : ''}">${p.tier ? `${BADGE_TIERS[p.tier - 1].name} · ${ROMAN8[p.tier]}` : 'Locked'}</span>
                <span class="badge-pips">${pips}</span>
                ${p.next !== null
                    ? `<span class="badge-bar"><span style="width:${Math.round(p.ratio * 100)}%"></span></span>
                       <span class="badge-next">${track.label ? `Next: ${escapeHtml(track.label(p.next))}` : `${Math.min(p.value, p.next).toLocaleString(LOCALE)} / ${p.next.toLocaleString(LOCALE)}`}</span>`
                    : '<span class="badge-next max">Every tier earned</span>'}
            </button>`;
    };
    // Within each group, the badges you're closest to levelling up come first; maxed-out ones last
    const sortKey = track => {
        const p = badgeProgress(track, stats);
        return p.next === null ? -1 : p.ratio;
    };
    document.getElementById('trophyBody').innerHTML = `
        <div class="trophy-hero">
            ${levelRing(xp)}
            <div class="th-rank">${escapeHtml(xp.rank)}</div>
            <p class="th-line">${xp.level < MAX_LEVEL ? `${xp.toNext.toLocaleString(LOCALE)} XP to level ${xp.level + 1}` : 'Maximum level'}</p>
            <div class="th-sub">${earnedTiers} of ${tracks.length * BADGE_TIERS.length} tiers · ${Object.keys(specials).length} of ${specialBadges().length} special</div>
            ${nextRank ? `<div class="th-sub">${escapeHtml(nextRank[1])} at level ${nextRank[0]}</div>` : ''}
            ${xpSourcesHtml(xp)}
        </div>
        <div class="showcase">
            ${[0, 1, 2].map(i => {
                const id = pinned[i];
                const track = id && tracks.find(t => t.id === id);
                return track
                    ? `<button class="sc-slot" onclick="openBadge('${track.id}')">${medalSvg(badgeTier(track, stats), track.icon, 100)}<span>${escapeHtml(track.name)}</span></button>`
                    : `<div class="sc-slot empty"><div class="sc-plus">+</div><span>Pin a badge</span></div>`;
            }).join('')}
        </div>
        <p class="sc-hint">Open any badge and pin it to your showcase.</p>
        ${BADGE_GROUPS.map(group => `
            <div class="section-head"><h3>${group.name}</h3></div>
            <div class="badge-grid">
                ${group.tracks.map(id => tracks.find(t => t.id === id)).filter(Boolean).sort((a, b) => sortKey(b) - sortKey(a)).map(card).join('')}
            </div>`).join('')}
        <div class="section-head"><h3>Signature</h3><span>${Object.keys(specials).length} / ${specialBadges().length}</span></div>
        <div class="achievement-grid">
            ${specialBadges().map(sp => {
                const got = specials[sp.id];
                const hidden = sp.secret && !got;
                return `
                    <button class="achievement${got ? ' earned' : ''}${hidden ? ' secret' : ''}" onclick="showToast('${escapeHtml(hidden ? 'A secret badge. Keep training to discover it.' : sp.desc).replace(/'/g, '&#39;')}')">
                        <span class="achievement-icon">${hidden ? '<span class="secret-q">?</span>' : achievementIcon(sp.icon)}</span>
                        <span class="achievement-name">${hidden ? 'Secret' : escapeHtml(sp.name)}</span>
                        <span class="achievement-sub">${got ? escapeHtml(prettyDate(got)) : 'Locked'}</span>
                    </button>`;
            }).join('')}
        </div>
    `;
}

// ── Badge detail sheet: big medal you can tilt, tier ladder with dates, rarity, pin ──
let openBadgeId = null;

function openBadge(id) {
    haptic();
    openBadgeId = id;
    renderBadgeDetail();
    document.getElementById('badgeModal').classList.add('active');
}

function closeBadge() {
    document.getElementById('badgeModal').classList.remove('active');
    openBadgeId = null;
}

function renderBadgeDetail() {
    const stats = playerStats();
    const track = badgeTracks().find(t => t.id === openBadgeId);
    if (!track) return;
    const p = badgeProgress(track, stats);
    const dates = (allData._badgeDates || {})[track.id] || {};
    const pinned = (allData._showcase || []).includes(track.id);
    const current = p.tier ? BADGE_TIERS[p.tier - 1] : null;
    const nextTier = p.next !== null ? BADGE_TIERS[p.tier] : null;
    document.getElementById('badgeBody').innerHTML = `
        <div class="bd-stage" id="badgeStage">
            <div class="bd-tilt" id="badgeTilt">${medalSvg(p.tier, track.icon, 210, p.tier >= 7 ? 'gleam' : '')}<i class="bd-shine" id="badgeShine"></i></div>
        </div>
        <div class="bd-title">${escapeHtml(track.name)}</div>
        <div class="bd-tier" style="${current ? `color:${current.color}` : ''}">${current ? `${current.name} · ${ROMAN8[p.tier]}` : 'Not earned yet'}</div>
        ${nextTier ? `
            <div class="bd-progress">
                <div class="bd-progress-top"><span>Next: ${nextTier.name}</span><strong>${track.label ? escapeHtml(track.label(p.next)) : `${Math.min(p.value, p.next).toLocaleString(LOCALE)} / ${p.next.toLocaleString(LOCALE)}`}</strong></div>
                <div class="badge-bar wide"><span style="width:${Math.round(p.ratio * 100)}%; background:${nextTier.color}"></span></div>
                <p>${escapeHtml(track.tip)}</p>
            </div>` : '<p class="bd-done">Every tier earned. Few people ever get here.</p>'}
        <div class="bd-ladder">
            ${BADGE_TIERS.map((t, i) => {
                const tier = i + 1;
                const got = p.tier >= tier;
                return `
                    <div class="bd-step${got ? ' got' : ''}">
                        ${medalSvg(got ? tier : 0, track.icon, 34)}
                        <div class="bd-step-text">
                            <strong style="${got ? `color:${t.color}` : ''}">${t.name} · ${ROMAN8[tier]}</strong>
                            <span>${escapeHtml(badgeGoalText(track, track.goals[i]))}</span>
                        </div>
                        <div class="bd-step-meta">${got ? (dates[tier] ? escapeHtml(prettyDate(dates[tier])) : 'Earned') : `Top ${t.rarity}%`}</div>
                    </div>`;
            }).join('')}
        </div>
        <p class="bd-rarity">Rarity is estimated for now: the share of people expected to reach each tier.</p>
        <button class="btn ${pinned ? '' : 'btn-primary'} bd-pin" onclick="togglePin('${track.id}')">${pinned ? 'Remove from showcase' : 'Pin to showcase'}</button>
    `;
    initBadgeTilt();
}

function togglePin(id) {
    haptic();
    const pinned = allData._showcase || (allData._showcase = []);
    const i = pinned.indexOf(id);
    if (i >= 0) pinned.splice(i, 1);
    else {
        pinned.push(id);
        if (pinned.length > 3) pinned.shift();
    }
    scheduleSave();
    renderBadgeDetail();
    if (document.getElementById('trophyScreen').classList.contains('active')) renderTrophyRoom();
    showToast(i >= 0 ? 'Removed from showcase' : 'Pinned to showcase');
}

// Drag across the medal to tilt it; a highlight follows your finger so the metal catches the light
function initBadgeTilt() {
    const stage = document.getElementById('badgeStage');
    const tilt = document.getElementById('badgeTilt');
    const shine = document.getElementById('badgeShine');
    if (!stage || prefersReducedMotion()) return;
    const move = (x, y) => {
        const r = stage.getBoundingClientRect();
        const dx = Math.max(-1, Math.min(1, (x - r.left) / r.width * 2 - 1));
        const dy = Math.max(-1, Math.min(1, (y - r.top) / r.height * 2 - 1));
        tilt.style.transform = `rotateY(${dx * 22}deg) rotateX(${-dy * 22}deg)`;
        shine.style.background = `radial-gradient(circle at ${50 + dx * 40}% ${50 + dy * 40}%, rgba(255,255,255,0.32), transparent 55%)`;
    };
    const reset = () => {
        tilt.style.transform = '';
        shine.style.background = '';
    };
    stage.addEventListener('pointermove', e => move(e.clientX, e.clientY));
    stage.addEventListener('touchmove', e => move(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    stage.addEventListener('pointerleave', reset);
    stage.addEventListener('touchend', reset);
}

// ── Nudges: the badge tier you're closest to (within ~10%, or one step away) ──
function nearestBadge(stats = playerStats()) {
    let best = null;
    badgeTracks().forEach(track => {
        const p = badgeProgress(track, stats);
        if (p.next === null || track.label || !p.remaining) return;
        const close = p.ratio >= 0.9 || p.remaining <= 1;
        if (close && (!best || p.ratio > best.p.ratio)) best = { track, p };
    });
    return best;
}

function nearestBadgeText(stats) {
    const near = nearestBadge(stats);
    if (!near) return null;
    const { track, p } = near;
    const tier = BADGE_TIERS[p.tier];
    const togo = p.remaining === 1 ? 'one more to go' : `${p.remaining.toLocaleString(LOCALE)} ${track.unit} to go`;
    return { key: `near-${track.id}-${p.tier + 1}`, track, text: `${tier.name} ${track.name} is close: ${togo}.` };
}

// During a workout: a quiet note when one more set earns a Set Machine tier
function setBadgeNudge() {
    if (!activeWorkout) return;
    const stats = playerStats();
    const done = Object.values(activeWorkout.rows).flat().filter(r => r.done).length;
    const track = badgeTracks().find(t => t.id === 'sets');
    const tier = badgeTier(track, stats);
    const next = track.goals[tier];
    if (next !== undefined && next - (stats.sets + done) === 1) {
        showToast(`1 set to ${BADGE_TIERS[tier].name} ${track.name}`);
    }
}

// Consistency breakdown on the Progress tab
// The score's breakdown: a sheet opened by tapping the score in the middle of the Today rings
function openScore() {
    haptic();
    renderConsistency();
    document.getElementById('scoreModal').classList.add('active');
}

function closeScore() {
    document.getElementById('scoreModal').classList.remove('active');
    setTimeout(nextMoment, 400);
}

function renderConsistency() {
    const el = document.getElementById('consistencyCard');
    if (!el) return;
    const { score, parts } = consistencyScore();
    el.innerHTML = `
        <div class="consistency-top">
            <div>
                <div class="consistency-label">Consistency</div>
                <div class="consistency-score" data-count="${score}" data-key="consistency"></div>
                <div class="consistency-sub">Last 7 days · best ${Math.max(allData._bestScore || 0, score)}</div>
                <button class="recap-link" onclick="closeScore(); openRecap()">Last week's recap ›</button>
            </div>
        </div>
        <div class="consistency-parts">
            ${parts.map(p => `
                <div class="cp-row">
                    <span class="cp-label">${p.label}</span>
                    <span class="cp-bar"><span style="width:${Math.round(p.ratio * 100)}%"></span></span>
                    <span class="cp-text">${escapeHtml(p.text)}</span>
                </div>`).join('')}
        </div>
    `;
    rollNumbers(el);
}

// One full-screen moment at a time (records, achievements); the rest wait their turn
const momentQueue = [];

function queueMoment(show) {
    momentQueue.push(show);
    nextMoment();
}

function nextMoment() {
    const busy = document.getElementById('recordMoment').classList.contains('show')
        || document.getElementById('celebrate').classList.contains('show')
        || document.querySelector('.modal-overlay.active')
        || summaryOpen;   // badges and level-ups wait until the summary is closed
    if (busy || !momentQueue.length) return;
    momentQueue.shift()();
}
