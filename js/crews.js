// ════════════════════════════════════════════
//  CREWS: up to 8 friends travelling together (supabase-crews-setup.sql). Everyone's leagues this week
//  move one shared ship toward a landmark per member. Ranked by effort (leagues), never by weights,
//  so a beginner and a heavy lifter count the same. Crewmates see display names and this week's numbers only.
// ════════════════════════════════════════════

const CREW_MAX = 8;
let crew = null;          // { id, name, code, members: [{ user_id, display_name, week_start, week_leagues, week_workouts }] }
let crewState = 'idle';   // idle | loading | ready | unavailable (tables not set up yet)
let crewForm = null;      // 'create' | 'join' while the form is open

async function loadCrew() {
    if (!currentUser || crewState === 'loading') return crew;
    crewState = 'loading';
    try {
        const { data: mine, error } = await sb.from('crew_members').select('crew_id').eq('user_id', currentUser.id).maybeSingle();
        if (error) throw error;
        if (!mine) {
            crew = null;
        } else {
            const [info, members] = await Promise.all([
                sb.from('crews').select('id,name,code').eq('id', mine.crew_id).maybeSingle(),
                sb.from('crew_members').select('user_id,display_name,week_start,week_leagues,week_workouts').eq('crew_id', mine.crew_id),
            ]);
            crew = info.data ? { ...info.data, members: members.data || [] } : null;
        }
        crewState = 'ready';
        await syncCrewStats();
        await checkHorns();
    } catch (e) {
        crew = null;
        crewState = 'unavailable';
    }
    return crew;
}

// My numbers this week on my membership row (only when they changed)
async function syncCrewStats() {
    if (!crew || !currentUser) return;
    const monday = mondayOf(todayStr());
    const leagues = leaguesBetween(monday, addDays(monday, 6));
    const workouts = allWorkoutDates().filter(d => d >= monday && d <= addDays(monday, 6)).length;
    const me = crew.members.find(m => m.user_id === currentUser.id);
    if (me && me.week_start === monday && me.week_leagues === leagues && me.week_workouts === workouts) return;
    if (me) Object.assign(me, { week_start: monday, week_leagues: leagues, week_workouts: workouts });
    await sb.from('crew_members').update({ week_start: monday, week_leagues: leagues, week_workouts: workouts, updated_at: new Date().toISOString() })
        .eq('crew_id', crew.id).eq('user_id', currentUser.id);
}

// This week's numbers for a member (last week's row counts as zero)
function memberWeek(m) {
    const current = m.week_start === mondayOf(todayStr());
    return { leagues: current ? m.week_leagues || 0 : 0, workouts: current ? m.week_workouts || 0 : 0 };
}

function crewShip() {
    const sailed = crew.members.reduce((sum, m) => sum + memberWeek(m).leagues, 0);
    const goal = crew.members.length * 100;   // one landmark per member, every week
    return { sailed, goal, ratio: Math.min(1, sailed / goal) };
}

// ── Joining and leaving ──
function crewDisplayName() {
    return (userProfile && userProfile.displayName) || '';
}

async function submitCrew(kind) {
    haptic();
    const name = (document.getElementById('crewName') || {}).value || '';
    const display = (document.getElementById('crewDisplay').value || '').trim().slice(0, 24);
    const code = (document.getElementById('crewCode') || {}).value || '';
    if (!display) return showToast('Add the name your crew will see');
    if (kind === 'create' && !name.trim()) return showToast('Give your crew a name');
    if (kind === 'join' && code.trim().length < 6) return showToast('Enter the 6-character code');
    const { error } = kind === 'create'
        ? await sb.rpc('create_crew', { crew_name: name.trim().slice(0, 40), display })
        : await sb.rpc('join_crew', { invite: code.trim(), display });
    if (error) {
        const msg = /already/.test(error.message) ? 'You’re already in a crew'
            : /no crew/.test(error.message) ? 'No crew with that code'
            : /full/.test(error.message) ? 'That crew is full (8 people)'
            : 'Crews aren’t available right now';
        return showToast(msg);
    }
    userProfile = { ...userProfile, displayName: display };
    scheduleSave();
    crewForm = null;
    crewState = 'idle';
    await loadCrew();
    renderCrew();
    renderSagaCard();
    playSound('badge');
}

async function leaveCrew() {
    if (!crew || !confirm(`Leave ${crew.name}? You can join again with its code.`)) return;
    await sb.from('crew_members').delete().eq('crew_id', crew.id).eq('user_id', currentUser.id);
    crew = null;
    renderCrew();
    renderSagaCard();
}

async function shareCrewCode() {
    haptic();
    const text = `Join my crew "${crew.name}" on Odyr. Code: ${crew.code}`;
    try {
        if (navigator.share) await navigator.share({ text: tr(text) });
        else { await navigator.clipboard.writeText(crew.code); showToast('Code copied'); }
    } catch (e) { /* share sheet closed */ }
}

// ── Horns: a nudge of encouragement to a crewmate, once a day each ──
function hornKey(userId) {
    return `odyr_horn_${userId}_${todayStr()}`;
}

async function soundHorn(userId) {
    haptic();
    try { if (localStorage.getItem(hornKey(userId))) return showToast('Horn already sounded today'); } catch (e) { /* private mode */ }
    const { error } = await sb.from('crew_horns').insert({ crew_id: crew.id, from_user: currentUser.id, to_user: userId });
    if (error) return showToast('Couldn’t sound the horn');
    try { localStorage.setItem(hornKey(userId), '1'); } catch (e) { /* private mode */ }
    playSound('tick');
    const m = crew.members.find(x => x.user_id === userId);
    showToast(`Horn sounded for ${m ? m.display_name : 'your crewmate'}`);
    renderCrew();
}

// Horns received since the last look, shown once
async function checkHorns() {
    if (!crew) return;
    const key = `odyr_horns_seen_${currentUser.id}`;
    let since = null;
    try { since = localStorage.getItem(key); } catch (e) { /* private mode */ }
    const { data } = await sb.from('crew_horns').select('from_user,at').eq('to_user', currentUser.id).gt('at', since || '1970-01-01').order('at', { ascending: false }).limit(10);
    try { localStorage.setItem(key, new Date().toISOString()); } catch (e) { /* private mode */ }
    if (!since || !data || !data.length) return;
    const names = [...new Set(data.map(h => (crew.members.find(m => m.user_id === h.from_user) || {}).display_name).filter(Boolean))];
    if (names.length) {
        queueMoment(() => showMoment({ kicker: 'Your crew', valueHtml: '<svg class="moment-mark" aria-hidden="true"><use href="#odyrMark"/></svg>', unit: '',
            name: names.length === 1 ? `${names[0]} sounded the horn for you` : `${names.length} crewmates sounded the horn for you`, sub: 'Keep the ship moving.', sound: 'record' }));
    }
}

// ── The crew section on the journey screen ──
function renderCrew() {
    const el = document.getElementById('crewCard');
    if (!el) return;
    if (crewState === 'idle' || crewState === 'loading') {
        el.innerHTML = '<div class="crew-card"><div class="sk" style="height:84px"></div></div>';
        if (crewState === 'idle') loadCrew().then(renderCrew);
        return;
    }
    if (crewState === 'unavailable') {
        el.innerHTML = '';
        return;
    }
    if (!crew) {
        el.innerHTML = `
            <div class="crew-card">
                <div class="crew-kicker">Travel with a crew</div>
                <p class="crew-pitch">Up to ${CREW_MAX} friends on one ship. Everyone’s training moves it, ranked by effort, never by the weights you lift.</p>
                ${crewForm ? `
                    <div class="crew-form line-fields">
                        ${crewForm === 'create'
                            ? '<label class="form-label">Crew name</label><input class="form-input" id="crewName" maxlength="40" placeholder="Morning Wolves">'
                            : '<label class="form-label">Invite code</label><input class="form-input" id="crewCode" maxlength="6" autocapitalize="characters" placeholder="A7F3K9">'}
                        <label class="form-label">Your name in the crew</label>
                        <input class="form-input" id="crewDisplay" maxlength="24" value="${escapeHtml(crewDisplayName())}" placeholder="Alex">
                        <div class="crew-actions">
                            <button class="btn" onclick="crewForm = null; renderCrew()">Cancel</button>
                            <button class="btn btn-primary" onclick="submitCrew('${crewForm}')">${crewForm === 'create' ? 'Start the crew' : 'Join'}</button>
                        </div>
                    </div>` : `
                    <div class="crew-actions">
                        <button class="btn" onclick="crewForm = 'join'; renderCrew()">Join with a code</button>
                        <button class="btn btn-primary" onclick="crewForm = 'create'; renderCrew()">Start a crew</button>
                    </div>`}
            </div>`;
        return;
    }
    const ship = crewShip();
    const members = crew.members.map(m => ({ ...m, ...memberWeek(m) })).sort((a, b) => b.leagues - a.leagues);
    let hornedToday = new Set();
    try { hornedToday = new Set(members.filter(m => localStorage.getItem(hornKey(m.user_id))).map(m => m.user_id)); } catch (e) { /* private mode */ }
    el.innerHTML = `
        <div class="crew-card">
            <div class="crew-head">
                <div><div class="crew-kicker">Your crew</div><div class="crew-name">${escapeHtml(crew.name)}</div></div>
                <button class="crew-code" onclick="shareCrewCode()"><span>${escapeHtml(crew.code)}</span>Share</button>
            </div>
            <div class="crew-ship">
                <div class="crew-ship-top"><span>The ship this week</span><strong>${ship.sailed.toLocaleString(LOCALE)}<small> / ${ship.goal.toLocaleString(LOCALE)} leagues</small></strong></div>
                <div class="crew-ship-bar"><span style="width:${Math.round(ship.ratio * 100)}%"></span><i style="left:${Math.round(ship.ratio * 100)}%"></i></div>
            </div>
            ${members.map(m => {
                const me = m.user_id === currentUser.id;
                return `
                <div class="crew-member${me ? ' me' : ''}">
                    <span class="crew-avatar">${escapeHtml((m.display_name || '?').charAt(0).toUpperCase())}</span>
                    <span class="crew-who"><strong>${escapeHtml(m.display_name)}${me ? ' <small>(you)</small>' : ''}</strong><small>${m.workouts === 1 ? '1 workout' : `${m.workouts} workouts`} this week</small></span>
                    <span class="crew-leagues">${m.leagues.toLocaleString(LOCALE)}</span>
                    ${me ? '<span></span>' : `<button class="crew-horn${hornedToday.has(m.user_id) ? ' sent' : ''}" onclick="soundHorn('${m.user_id}')" aria-label="Sound the horn for ${escapeHtml(m.display_name)}">${HORN_ICON}</button>`}
                </div>`;
            }).join('')}
            <button class="link-btn crew-leave" onclick="leaveCrew()">Leave crew</button>
        </div>`;
}

const HORN_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14c4-1 9-4 13-9l1 1c1 4 1 9-1 13l-1 1c-4-3-8-5-12-5z"/><path d="M5 14l1 5h3l-1-4.5"/></svg>';

// One line on Today's saga card when you have a crew
function crewLineHtml() {
    if (!crew) return '';
    const ship = crewShip();
    return `<div class="saga-crew"><span>${escapeHtml(crew.name)}</span> ${ship.sailed.toLocaleString(LOCALE)} / ${ship.goal.toLocaleString(LOCALE)} leagues this week</div>`;
}
