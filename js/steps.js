// ════════════════════════════════════════════
//  STEPS TAB
// ════════════════════════════════════════════

// Web apps can't read Apple Health, so an iPhone Shortcut ("Workout Steps") reads today's steps
// and posts them with the user's private step token to the steps-ingest Edge Function, which
// writes public.step_counts. The tab reads that table and refreshes every minute while open.
const STEPS_SHORTCUT_NAME = 'Workout Steps';
// Shared copy of the shortcut; it asks for the user's step key when it is added
const STEPS_SHORTCUT_LINK = 'https://www.icloud.com/shortcuts/2293fbc5e53f4d4985e66957a4342cc8';
const STEPS_INGEST_URL = `${SUPABASE_URL}/functions/v1/steps-ingest`;
const STEP_GOALS = [6000, 7000, 8000, 10000, 12000, 15000];

let stepData = {};      // date → { steps, updated_at, source }
let stepToken = null;
let stepsChart = null;

function stepGoal() {
    return (userProfile && userProfile.stepGoal) || 10000;
}

// False until the first load finishes (shows placeholders instead of a misleading 0)
let stepsLoaded = false;

async function loadSteps() {
    if (!currentUser || !sb) return false;
    try {
        let { data, error } = await sb.from('step_counts')
            .select('date, steps, updated_at, source, exercise_minutes')
            .gte('date', addDays(todayStr(), -730));
        // Before supabase-v2-setup.sql adds exercise_minutes, load steps only
        if (error) {
            ({ data, error } = await sb.from('step_counts')
                .select('date, steps, updated_at, source')
                .gte('date', addDays(todayStr(), -730)));
        }
        if (error) throw error;
        stepData = Object.fromEntries(data.map(row => [row.date, row]));
        return true;
    } catch (error) {
        console.warn('Steps not loaded:', error.message || error);
        return false;
    } finally {
        stepsLoaded = true;
    }
}

function stepsOn(date) {
    return stepData[date] ? stepData[date].steps : 0;
}

async function renderSteps() {
    drawSteps();            // draw what we have straight away
    if (await loadSteps()) {
        checkAchievements();
        drawSteps();
        renderHabits();     // the steps habit ticks itself
    }
}

function drawSteps() {
    const today = todayStr();
    const goal = stepGoal();
    const steps = stepsOn(today);
    const ratio = Math.min(1, steps / goal);
    const circumference = 2 * Math.PI * 88;
    const entry = stepData[today];
    const synced = entry
        ? `Updated ${new Date(entry.updated_at).toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' })}${entry.source === 'manual' ? ' · typed in' : ''}`
        : 'No steps synced today';

    document.getElementById('stepsRing').innerHTML = `
        <div class="steps-ring${steps >= goal ? ' reached' : ''}">
            <svg viewBox="0 0 200 200" aria-hidden="true">
                <defs><linearGradient id="ringGold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="#f2d891"/><stop offset="1" stop-color="#b38636"/>
                </linearGradient><linearGradient id="ringCream" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="#f3ece0"/><stop offset="1" stop-color="#a99a83"/>
                </linearGradient></defs>
                <circle class="ring-bg" cx="100" cy="100" r="88"/>
                <circle class="ring-fg" cx="100" cy="100" r="88" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - ratio)}"/>
            </svg>
            <div class="ring-center">
                ${stepsLoaded
                    ? `<div class="ring-steps" data-count="${steps}" data-key="steps-today" data-format="locale"></div>`
                    : '<div class="sk sk-num"></div>'}
                <div class="ring-goal">of ${goal.toLocaleString(LOCALE)} steps</div>
                <div class="ring-sync">${stepsLoaded ? escapeHtml(synced) : 'Loading…'}</div>
            </div>
        </div>
    `;
    rollNumbers(document.getElementById('stepsRing'));

    // Last 7 days average, goal streak, best of the last 30 days
    const last7 = Array.from({ length: 7 }, (_, i) => stepsOn(addDays(today, -i)));
    const average = Math.round(last7.reduce((a, b) => a + b, 0) / 7);
    let streak = 0;
    let day = steps >= goal ? today : addDays(today, -1);
    while (stepsOn(day) >= goal) {
        streak++;
        day = addDays(day, -1);
    }
    const monthAgo = addDays(today, -29);
    const best = Math.max(0, ...Object.entries(stepData).filter(([d]) => d >= monthAgo).map(([, r]) => r.steps));
    document.getElementById('stepsStats').innerHTML =
        statTile('Average', average.toLocaleString(LOCALE), 'per day, 7 days') +
        statTile('Streak', String(streak), streak === 1 ? 'day at goal' : 'days at goal') +
        statTile('Best', best.toLocaleString(LOCALE), 'last 30 days');

    drawStepsChart(goal);

    const goalOptions = STEP_GOALS.map(g => `<option value="${g}"${g === goal ? ' selected' : ''}>${g.toLocaleString(LOCALE)} steps</option>`).join('');
    document.getElementById('stepsActions').innerHTML = `
        <button class="start-btn" onclick="runStepsShortcut()">Sync from Apple Health</button>
        <div class="steps-row">
            <label class="steps-goal">Daily goal <select class="week-select" onchange="setStepGoal(this.value)">${goalOptions}</select></label>
            <form class="steps-manual" onsubmit="saveManualSteps(event)">
                <input class="form-input" id="manualSteps" type="number" inputmode="numeric" min="0" max="200000" placeholder="Type today's steps">
                <button class="btn" type="submit">Save</button>
            </form>
        </div>
    `;

    const everSynced = Object.values(stepData).some(r => r.source === 'shortcut');
    renderStepsSetup(!everSynced);
}

function drawStepsChart(goal) {
    if (stepsChart) {
        stepsChart.destroy();
        stepsChart = null;
    }
    if (typeof Chart === 'undefined') return;
    const days = Array.from({ length: 14 }, (_, i) => addDays(todayStr(), i - 13));
    const values = days.map(stepsOn);
    const empty = stepsLoaded && values.every(v => !v);
    document.querySelector('.steps-panel').classList.toggle('is-empty', empty);
    if (empty) return;
    stepsChart = new Chart(document.getElementById('stepsChart'), {
        type: 'bar',
        data: {
            labels: days.map(d => parseDate(d).toLocaleDateString(LOCALE, { weekday: 'narrow' })),
            datasets: [
                { label: 'Steps', data: values, backgroundColor: values.map(v => (v >= goal ? '#d9b25f' : 'rgba(240,232,216,0.16)')), borderRadius: 6, maxBarThickness: 22 },
                { type: 'line', label: 'Goal', data: days.map(() => goal), borderColor: 'rgba(220,200,158,0.8)', borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0 },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { title: items => prettyDate(days[items[0].dataIndex]), label: c => `${c.dataset.label}: ${c.parsed.y.toLocaleString(LOCALE)}` } },
            },
            scales: {
                x: { ticks: CHART_TICKS, grid: { display: false } },
                y: { ticks: { ...CHART_TICKS, callback: v => (v >= 1000 ? `${v / 1000}k` : v) }, grid: CHART_GRID, beginAtZero: true },
            },
        },
    });
}

async function renderStepsSetup(open) {
    const el = document.getElementById('stepsSetup');
    if (!stepToken) {
        try {
            stepToken = await getOrCreateStepToken();
        } catch (error) {
            el.innerHTML = `<p class="settings-note">Step syncing isn't set up on the server yet (${escapeHtml(error.message || String(error))}).</p>`;
            return;
        }
    }
    el.innerHTML = `
        <details class="mobility-card setup-card" ${open ? 'open' : ''}>
            <summary><h3>Set up Apple Health sync</h3><span class="warmup-hint">One time · 2 min</span></summary>
            <ol class="setup-steps">
                <li>Copy your private step key:
                    <span class="copy-row"><code>${escapeHtml(stepToken)}</code><button class="swap-btn" onclick="copyText('${escapeHtml(stepToken)}')">Copy</button></span></li>
                <li><a class="btn shortcut-link" href="${STEPS_SHORTCUT_LINK}" target="_blank" rel="noopener">Get the ${STEPS_SHORTCUT_NAME} shortcut</a>
                    Tap <strong>Add Shortcut</strong>, and paste your key when it asks for it. Keep the name <strong>${STEPS_SHORTCUT_NAME}</strong>.</li>
                <li>Run it once from the Shortcuts app and tap <strong>Always Allow</strong> for Health and for sending, so it can run on its own later.</li>
                <li>Make it run by itself: open the shortcut, add a few times of day (e.g. every few hours, plus 23:30 for the day's final total), or use <strong>Automation</strong> → <strong>+</strong> → <strong>Time of Day</strong> → <strong>Run Immediately</strong>.</li>
                <li>Wear an Apple Watch? If your steps look about double what the Health app shows, edit the shortcut's <strong>Find Health Samples</strong> and set <strong>Source is</strong> your Watch.</li>
                <li>The shortcut also sends your Apple Health exercise minutes (recorded mostly by an Apple Watch), so brisk walks and rides fill your cardio ring by themselves.</li>
            </ol>
            <p class="warmup-note">Keep your key private: anyone with it can send step counts to your account. The <strong>Sync from Apple Health</strong> button above runs the shortcut on demand.</p>
        </details>
    `;
}

// Each user gets a random key that only the Shortcut uses; it can only write step counts
async function getOrCreateStepToken() {
    const { data, error } = await sb.from('step_tokens').select('token').eq('user_id', currentUser.id).maybeSingle();
    if (error) throw error;
    if (data) return data.token;
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    const token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    const { error: insertError } = await sb.from('step_tokens').insert({ user_id: currentUser.id, token });
    if (insertError) throw insertError;
    return token;
}

function runStepsShortcut() {
    haptic();
    window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(STEPS_SHORTCUT_NAME)}`;
}

async function saveManualSteps(event) {
    event.preventDefault();
    const steps = parseInt(document.getElementById('manualSteps').value);
    if (!(steps >= 0)) return;
    const { error } = await sb.from('step_counts').upsert({
        user_id: currentUser.id, date: todayStr(), steps, source: 'manual', updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' });
    if (error) {
        showToast('Could not save: ' + error.message);
        return;
    }
    haptic();
    showToast('Steps saved');
    renderSteps();
}

function setStepGoal(value) {
    userProfile = { ...userProfile, stepGoal: Number(value) };
    scheduleSave();
    drawSteps();
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        haptic();
        showToast('Copied');
    } catch (error) {
        prompt('Copy this:', text);
    }
}

// "Live": refresh every minute while the Steps tab is on screen
setInterval(() => {
    const page = document.getElementById('page-steps');
    if (currentUser && document.visibilityState === 'visible' && page && page.classList.contains('active')) renderSteps();
}, 60000);
