// ════════════════════════════════════════════
//  WEEKLY QUESTS: three goals each Monday, chosen from your own log and your goal, always winnable.
//  Stored per week in workout_data._quests[monday] = { list: [...], done: { id: date } } so they stay put.
// ════════════════════════════════════════════

const QUEST_XP = 75;

function weekIndex(monday) {
    return Math.floor(parseDate(monday).getTime() / (7 * 86400000));
}

function weekDays(monday) {
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// The goal-led quest rotates weekly between the kinds that fit your goal
const GOAL_QUESTS = { fatloss: ['cardio', 'steps'], muscle: ['habits', 'steps'], strength: ['habits', 'cardio'], general: ['cardio', 'steps', 'habits'] };

function makeQuests(monday) {
    const prog = PROGRAMS[currentProgram];
    const lastMonday = addDays(monday, -7);
    const lastWeek = weekDays(lastMonday);
    // Cardio quests only when cardio is on
    const kinds = GOAL_QUESTS[userGoal()].filter(k => k !== 'cardio' || cardioTarget());
    const goalQuest = kind => {
        if (kind === 'cardio') {
            const last = cardioMinutes(d => d >= lastMonday && d < monday);
            return { id: 'cardio', kind, target: Math.min(cardioTarget(), Math.max(Math.min(60, cardioTarget()), Math.round((last + 30) / 10) * 10)) };
        }
        if (kind === 'steps') {
            const last = lastWeek.filter(d => stepsOn(d) >= stepGoal()).length;
            return { id: 'steps', kind, target: Math.min(7, Math.max(3, last + 1)) };
        }
        const last = lastWeek.filter(d => habitsDone(d) >= dailyHabits().length).length;
        return { id: 'habits', kind: 'habits', target: Math.min(7, Math.max(2, last + 1)) };
    };
    const list = [];
    // A lift you've trained lately, a different one most weeks: beat its best (estimated 1-rep max)
    const lifts = prog.exercises.map(ex => ({ ex, h: strengthHistory(ex) })).filter(x => x.h.length && !x.ex.assist)
        .sort((a, b) => b.h[b.h.length - 1].date.localeCompare(a.h[a.h.length - 1].date));
    if (lifts.length) {
        const pick = lifts[weekIndex(monday) % Math.min(3, lifts.length)];
        list.push({ id: 'lift', kind: 'lift', program: currentProgram, exId: pick.ex.id, best: Math.max(...pick.h.map(p => p.value)), target: 1 });
    }
    // A brand-new account starts with one winnable quest: the first workout
    list.push(allWorkoutDates().length ? { id: 'train', kind: 'train', target: weeklyLiftTarget(prog) } : { id: 'first', kind: 'first', target: 1 });
    const first = kinds[weekIndex(monday) % kinds.length];
    list.push(goalQuest(first));
    // Nothing lifted yet: a second goal quest instead of the lift one
    if (!lifts.length) list.push(goalQuest(kinds.find(k => k !== first) || 'habits'));
    return list;
}

function questWeek(monday = mondayOf(todayStr())) {
    const all = metaFor('_quests');
    if (!all[monday]) {
        all[monday] = { list: makeQuests(monday), done: {} };
        scheduleSave();
    }
    return all[monday];
}

function questProgress(q, monday) {
    const days = weekDays(monday);
    const inWeek = d => d >= monday && d <= days[6];
    if (q.kind === 'lift') {
        if (q.program !== currentProgram) return 0;
        const ex = getExercise(q.exId);
        return ex && strengthHistory(ex).some(p => inWeek(p.date) && p.value > q.best) ? 1 : 0;
    }
    if (q.kind === 'train' || q.kind === 'first') return allWorkoutDates().filter(inWeek).length;
    if (q.kind === 'cardio') return cardioMinutes(inWeek);
    if (q.kind === 'steps') return days.filter(d => stepsOn(d) >= stepGoal()).length;
    return days.filter(d => habitsDone(d) >= dailyHabits().length).length;
}

function questLabel(q) {
    if (q.kind === 'lift') {
        const ex = (PROGRAMS[q.program] || {}).exercises && PROGRAMS[q.program].exercises.find(e => e.id === q.exId);
        return `Beat your best on ${ex ? ex.name : 'a lift'}`;
    }
    if (q.kind === 'first') return isCardioProgram() ? 'Finish your first session' : 'Log your first workout';
    if (q.kind === 'train') return q.target === 1 ? 'Train once this week' : `Train ${q.target} times this week`;
    if (q.kind === 'cardio') return `${q.target} cardio minutes`;
    if (q.kind === 'steps') return `Hit your step goal on ${q.target} days`;
    return `Tick every habit on ${q.target} days`;
}

// Completed quests ever, for XP (recomputed from the log like the rest of XP)
function questXp() {
    return Object.values(metaFor('_quests')).reduce((sum, w) => sum + Object.keys((w && w.done) || {}).length, 0) * QUEST_XP;
}

// Mark finished quests and give each its moment
function checkQuests() {
    if (!currentProgram) return;
    const monday = mondayOf(todayStr());
    const week = questWeek(monday);
    week.list.forEach(q => {
        if (week.done[q.id] || questProgress(q, monday) < q.target) return;
        week.done[q.id] = todayStr();
        scheduleSave();
        queueMoment(() => showMoment({ kicker: 'Quest complete', valueHtml: `+${QUEST_XP}`, unit: 'XP', name: questLabel(q), sub: 'Three new quests every Monday.', sound: 'badge' }));
    });
}

// Today: one line (quests done, days left, a dot per quest); opens into the list
let questsOpen = false;

function renderQuests() {
    const el = document.getElementById('questsCard');
    if (!el || !currentProgram) return;
    const monday = mondayOf(todayStr());
    const week = questWeek(monday);
    const daysLeft = Math.round((parseDate(addDays(monday, 6)) - parseDate(todayStr())) / 86400000) + 1;
    const doneCount = week.list.filter(q => week.done[q.id]).length;
    const dots = week.list.map(q => `<i class="${week.done[q.id] ? 'done' : questProgress(q, monday) > 0 ? 'started' : ''}"></i>`).join('');
    el.innerHTML = `
        <details class="quests-card" ${questsOpen ? 'open' : ''} ontoggle="questsOpen = this.open">
            <summary class="quests-head">
                <span class="quests-kicker">This week’s quests</span>
                <span class="quests-dots">${dots}</span>
                <span class="quests-left">${doneCount === week.list.length ? 'All done' : `${doneCount} of ${week.list.length} · ${daysLeft === 1 ? 'Last day' : `${daysLeft} days left`}`}</span>
            </summary>
            ${week.list.map(q => {
                const done = !!week.done[q.id];
                const progress = Math.min(q.target, questProgress(q, monday));
                return `
                <div class="quest-row${done ? ' done' : ''}">
                    <span class="quest-check">${done ? CHECK_ICON : ''}</span>
                    <span class="quest-text">${escapeHtml(questLabel(q))}
                        ${q.target > 1 ? `<span class="quest-bar"><span style="width:${Math.round(progress / q.target * 100)}%"></span></span>` : ''}
                    </span>
                    <span class="quest-xp">${done ? 'Done' : q.target > 1 ? `${progress}/${q.target}` : `+${QUEST_XP} XP`}</span>
                </div>`;
            }).join('')}
        </details>`;
}
