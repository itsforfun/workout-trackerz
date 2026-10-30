// ════════════════════════════════════════════
//  ODYSSEY: the journey made visible. Everything you do moves your traveller along an endless road of
//  sagas (1,000 leagues each, a landmark every 100). Missed days never send you back; you travel slower.
// ════════════════════════════════════════════

const SAGA_LENGTH = 1000;
const LEAGUES = { workout: 20, cardioMinutes: 10, steps: 2000, stepsDayMax: 5, habit: 1 };

// Eleven stops per saga: the Hearth at 0 … Odyr's Gate at 1,000 (which is the next saga's Hearth)
const LANDMARKS = [
    ['The Hearth', 'Every saga begins by the fire you leave behind.'],
    ['Frostwood', 'Cold mornings. You went anyway.'],
    ['Iron Pass', 'The road narrows. Your grip does not.'],
    ['Mirror Fjord', 'Still water shows how far you have come.'],
    ['Ember Forge', 'Heat, pressure, repetition. This is how iron learns.'],
    ['Valkyrie’s Watch', 'Halfway. Someone is watching how you carry yourself.'],
    ['Stormreach', 'The weather turns. You keep the pace.'],
    ['Wolf Hollow', 'The pack runs together. You run your own pace.'],
    ['The Long Bridge', 'Nothing to do but cross it, one step at a time.'],
    ['Hall of Echoes', 'Every rep you ever did answers back.'],
    ['Odyr’s Gate', 'The gate opens. Another road waits beyond it.'],
];
const ROMAN_SAGA = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

// Leagues travelled on the dates that match (all programs), by source
function leagueSources(match = () => true) {
    return {
        workouts: allWorkoutDates().filter(match).length * LEAGUES.workout,
        cardio: Math.floor(cardioMinutes(match) / LEAGUES.cardioMinutes),
        steps: Object.keys(stepData).filter(match).reduce((sum, d) => sum + Math.min(LEAGUES.stepsDayMax, Math.floor(stepsOn(d) / LEAGUES.steps)), 0),
        habits: Object.keys(metaFor('_habits')).filter(match).reduce((sum, d) => sum + habitsDone(d) * LEAGUES.habit, 0),
    };
}

function leaguesBetween(from, to) {
    const s = leagueSources(d => d >= from && d <= to);
    return s.workouts + s.cardio + s.steps + s.habits;
}

// All leagues ever travelled, with where they came from
function journey() {
    const sources = leagueSources();
    const total = sources.workouts + sources.cardio + sources.steps + sources.habits;
    const saga = Math.floor(total / SAGA_LENGTH) + 1;
    const into = total % SAGA_LENGTH;
    const stop = Math.floor(into / 100);   // the last landmark passed in this saga
    return { total, saga, into, stop, next: stop + 1, toNext: (stop + 1) * 100 - into, sources };
}

function sagaName(saga) {
    return `Saga ${ROMAN_SAGA[saga] || saga}`;
}

// A landmark's position along a gentle horizontal road (the Today card), in a 340 × 64 box
function roadPoint(t) {
    const x = 14 + t * 312;
    return [x, 36 + Math.sin(t * Math.PI * 3) * 14];
}

function roadSvg(into, fromInto = into) {
    const pts = Array.from({ length: 61 }, (_, i) => roadPoint(i / 60).map(n => n.toFixed(1)).join(','));
    const stops = LANDMARKS.map((_, i) => {
        const [x, y] = roadPoint(i / 10);
        return `<circle class="road-stop${i * 100 <= into ? ' passed' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i === 0 || i === 10 ? 4 : 3}"/>`;
    }).join('');
    const [fx, fy] = roadPoint(fromInto / SAGA_LENGTH);
    return `
        <svg class="saga-road" viewBox="0 0 340 64" aria-hidden="true">
            <polyline class="road-line" points="${pts.join(' ')}"/>
            <polyline class="road-done" points="${pts.join(' ')}" pathLength="1000" stroke-dasharray="${fromInto} 1000"/>
            ${stops}
            <circle class="road-traveller" cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="5.5"/>
        </svg>`;
}

// Glide the traveller (and the gold trail) from where it was last time to where it is now
function travelTo(svg, fromInto, into) {
    const traveller = svg.querySelector('.road-traveller');
    const trail = svg.querySelector('.road-done');
    if (!traveller || fromInto === into) return;
    if (prefersReducedMotion()) {
        const [x, y] = roadPoint(into / SAGA_LENGTH);
        traveller.setAttribute('cx', x); traveller.setAttribute('cy', y);
        trail.setAttribute('stroke-dasharray', `${into} 1000`);
        return;
    }
    const start = performance.now();
    const duration = 1600;
    const step = now => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const at = fromInto + (into - fromInto) * eased;
        const [x, y] = roadPoint(at / SAGA_LENGTH);
        traveller.setAttribute('cx', x.toFixed(1)); traveller.setAttribute('cy', y.toFixed(1));
        trail.setAttribute('stroke-dasharray', `${at.toFixed(1)} 1000`);
        if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    // Animation frames pause in background tabs; land in the right place regardless
    setTimeout(() => step(start + duration), duration + 120);
}

// The leagues shown on this phone last time (so every visit can show how far you travelled since)
function lastSeenLeagues() {
    try { const v = parseInt(localStorage.getItem(`odyr_leagues_${currentUser ? currentUser.id : ''}`), 10); return isNaN(v) ? null : v; } catch (e) { return null; }
}
function rememberLeagues(total) {
    try { localStorage.setItem(`odyr_leagues_${currentUser ? currentUser.id : ''}`, String(total)); } catch (e) { /* private mode */ }
}

// Today: the saga card under the rings. On each visit the traveller glides from where you last saw it.
function renderSagaCard() {
    const el = document.getElementById('sagaCard');
    if (!el) return;
    const j = journey();
    const seen = lastSeenLeagues();
    const gained = seen === null ? 0 : Math.max(0, j.total - seen);
    // Starting point of the glide: last visit's spot in this saga (the Hearth if a saga was completed since)
    const fromTotal = seen === null ? j.total : Math.min(j.total, seen);
    const fromInto = Math.floor(fromTotal / SAGA_LENGTH) === j.saga - 1 ? fromTotal % SAGA_LENGTH : 0;
    const next = LANDMARKS[j.next];
    el.innerHTML = `
        <button class="saga-card" onclick="openOdyssey()">
            <div class="saga-top">
                <span class="saga-kicker">${escapeHtml(sagaName(j.saga))} · <span>${escapeHtml(LANDMARKS[j.stop][0])}</span></span>
                ${gained ? `<span class="saga-gain">+${gained.toLocaleString(LOCALE)} ${gained === 1 ? 'league' : 'leagues'} since your last visit</span>` : ''}
            </div>
            ${roadSvg(j.into, fromInto)}
            <div class="saga-next"><strong>${j.toNext.toLocaleString(LOCALE)}</strong> ${j.toNext === 1 ? 'league to' : 'leagues to'} <span>${escapeHtml(next[0])}</span> <span class="saga-open">›</span></div>
            ${crewLineHtml()}
        </button>`;
    travelTo(el.querySelector('svg'), fromInto, j.into);
    rememberLeagues(j.total);
}

// A landmark reached (or a saga completed) gets its moment; the first run stores where you are quietly
function checkLandmarks() {
    const j = journey();
    const reached = Math.floor(j.total / 100);
    const had = allData._landmark;
    if (had === undefined || had === null) {
        allData._landmark = reached;
        scheduleSave();
        return;
    }
    if (reached <= had) return;
    allData._landmark = reached;
    scheduleSave();
    const saga = Math.floor(reached / 10) + 1;
    const stop = reached % 10;
    queueMoment(() => showMoment(stop === 0
        ? { kicker: 'Saga complete', valueHtml: '<svg class="moment-mark" aria-hidden="true"><use href="#odyrMark"/></svg>', unit: '', name: LANDMARKS[10][0], sub: `${sagaName(saga)} begins. ${LANDMARKS[10][1]}`, sound: 'level' }
        : { kicker: 'Landmark reached', valueHtml: '<svg class="moment-mark" aria-hidden="true"><use href="#odyrMark"/></svg>', unit: '', name: LANDMARKS[stop][0], sub: LANDMARKS[stop][1], sound: 'badge' }));
}

// The Odyssey screen: the whole saga as a winding road, every landmark with its line, and how leagues are earned
function openOdyssey() {
    haptic();
    renderOdyssey();
    showScreen('odyssey');
}

function closeOdyssey() {
    haptic();
    showScreen('app');
}

function renderOdyssey() {
    const j = journey();
    const H = 1100;
    // A vertical road winding left and right, Hearth at the bottom, Gate at the top
    const point = t => [180 + Math.sin(t * Math.PI * 4.5) * 92, H - 60 - t * (H - 120)];
    const pts = Array.from({ length: 121 }, (_, i) => point(i / 120).map(n => n.toFixed(1)).join(','));
    const [tx, ty] = point(j.into / SAGA_LENGTH);
    const stops = LANDMARKS.map(([name], i) => {
        const [x, y] = point(i / 10);
        const passed = i * 100 <= j.into;
        const left = x > 180;
        return `
            <circle class="road-stop${passed ? ' passed' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i === 0 || i === 10 ? 7 : 5}"/>
            <text class="road-label${passed ? ' passed' : ''}" x="${(left ? x - 14 : x + 14).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${left ? 'end' : 'start'}">${escapeHtml(name)}</text>`;
    }).join('');
    const s = j.sources;
    document.getElementById('odysseyBody').innerHTML = `
        <div class="odyssey-hero">
            <div class="kicker">${escapeHtml(sagaName(j.saga))}</div>
            <h2>${escapeHtml(LANDMARKS[j.stop][0])}</h2>
            <p class="odyssey-line">${escapeHtml(LANDMARKS[j.stop][1])}</p>
            <div class="odyssey-stats"><span><strong>${j.into.toLocaleString(LOCALE)}</strong> of ${SAGA_LENGTH.toLocaleString(LOCALE)} leagues</span><span><strong>${j.toNext.toLocaleString(LOCALE)}</strong> ${j.toNext === 1 ? 'league to' : 'leagues to'} <span>${escapeHtml(LANDMARKS[j.next][0])}</span></span></div>
        </div>
        <div id="crewCard"></div>
        <svg class="odyssey-map" viewBox="0 0 360 ${H}" aria-hidden="true">
            <polyline class="road-line" points="${pts.join(' ')}"/>
            <polyline class="road-done" points="${pts.join(' ')}" pathLength="1000" stroke-dasharray="${j.into} 1000"/>
            ${stops}
            <circle class="road-traveller" cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="8"/>
        </svg>
        <div class="section-head"><h3>How you travel</h3><span>${j.total.toLocaleString(LOCALE)} leagues in all</span></div>
        <div class="odyssey-sources">
            <div><span>Workouts</span><strong>${s.workouts.toLocaleString(LOCALE)}</strong><small>${LEAGUES.workout} per workout</small></div>
            <div><span>Cardio</span><strong>${s.cardio.toLocaleString(LOCALE)}</strong><small>1 per ${LEAGUES.cardioMinutes} min</small></div>
            <div><span>Steps</span><strong>${s.steps.toLocaleString(LOCALE)}</strong><small>1 per ${LEAGUES.steps.toLocaleString(LOCALE)}, ${LEAGUES.stepsDayMax} a day max</small></div>
            <div><span>Habits</span><strong>${s.habits.toLocaleString(LOCALE)}</strong><small>1 per habit ticked</small></div>
        </div>
        <p class="odyssey-note">Missed days never send you back. The road just waits for you.</p>
    `;
    renderCrew();
    // Open with the traveller in view
    requestAnimationFrame(() => {
        const map = document.querySelector('.odyssey-map');
        if (map) window.scrollTo(0, Math.max(0, map.getBoundingClientRect().top + window.scrollY + (ty / H) * map.getBoundingClientRect().height - window.innerHeight / 2));
    });
}
