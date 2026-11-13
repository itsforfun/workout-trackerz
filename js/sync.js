// ════════════════════════════════════════════
//  CLOUD DATA SYNC (+ offline copy on the phone)
// ════════════════════════════════════════════

const isIndexKey = key => /^\d+$/.test(key);

// Old format kept one flat object keyed by exercise *index*: { "0": { "0": "52.5" } }.
// Move it under the program it was entered in, keyed by exercise id.
function migrateWorkoutData(raw, programId) {
    const keys = Object.keys(raw);
    if (!keys.some(isIndexKey)) return { data: raw, migrated: false };

    const result = {};
    keys.filter(k => !isIndexKey(k)).forEach(k => { result[k] = raw[k]; });

    const legacy = {};
    keys.filter(isIndexKey).forEach(k => { legacy[k] = raw[k]; });
    if (programId) {
        result[programId] = Object.assign(indexDataToIds(legacy, programId), result[programId]);
    } else {
        // Can't tell which program it came from; keep it rather than lose it
        result._legacy = legacy;
    }
    return { data: result, migrated: true };
}

function indexDataToIds(indexData, programId) {
    const byId = {};
    PROGRAMS[programId].exercises.forEach((ex, i) => {
        if (indexData[i]) byId[ex.id] = indexData[i];
    });
    return byId;
}

// ── Two devices, one log: if the cloud changed since this device last saw it (another phone, a tablet,
// a second tab), the two copies are merged before saving instead of one overwriting the other.
// Lists of things that happened are combined (workouts, weigh-ins, finished cycles, badge history, habit
// ticks); a logged lift for a week is kept whole, the more recent one winning; anything else: this device wins.
// cloudAt = the cloud's updated_at this device last read or wrote; equal means nobody else saved in between.
let cloudAt = null;
const UNION_LISTS = new Set(['_sessions', '_bodyweight', '_archive', '_badgeLog', '_habits']);
const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

function mergeWorkoutData(local, remote, path = []) {
    if (local === undefined) return remote;
    if (remote === undefined) return local;
    if (Array.isArray(local) && Array.isArray(remote)) {
        if (!UNION_LISTS.has(path[0])) return local;
        // Weigh-ins: one per day (this device's wins); everything else: same content = same entry
        const id = path[0] === '_bodyweight' ? (e => e && e.date) : (e => JSON.stringify(e));
        const seen = new Set(local.map(id));
        const extra = remote.filter(e => !seen.has(id(e)));
        if (!extra.length) return local;
        const all = local.concat(extra);
        if (all.every(e => isPlainObject(e) && typeof e.date === 'string')) all.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
        else if (all.every(e => typeof e === 'number')) all.sort((a, b) => a - b);
        return all;
    }
    if (isPlainObject(local) && isPlainObject(remote)) {
        // One week's entry of a lift ({ kg, sets, date }) is one thing: never mix the sets of two devices
        if ('sets' in local || 'kg' in local || 'sets' in remote || 'kg' in remote) {
            return remote.date && local.date && remote.date > local.date ? remote : local;
        }
        const out = { ...remote };
        Object.keys(local).forEach(key => { out[key] = mergeWorkoutData(local[key], remote[key], path.concat(key)); });
        return out;
    }
    return local;
}

// The phone keeps its own copy so the app opens and saves at the gym without signal.
// `dirty` means it holds changes the cloud hasn't received yet.
const CACHE_PREFIX = 'wt_cache_';

function writeLocalCache(dirty) {
    if (!currentUser) return;
    try {
        const { id, email, created_at } = currentUser;
        localStorage.setItem(CACHE_PREFIX + id, JSON.stringify({
            user: { id, email, created_at }, allData, userProfile, currentProgram, dirty, savedAt: Date.now(), cloudAt
        }));
        localStorage.setItem('wt_last_user', id);
    } catch (e) { /* storage full or blocked: the cloud copy still works */ }
}

function readLocalCache(userId) {
    try {
        return JSON.parse(localStorage.getItem(CACHE_PREFIX + userId));
    } catch (e) {
        return null;
    }
}

function clearLocalCache(userId) {
    try {
        localStorage.removeItem(CACHE_PREFIX + userId);
        localStorage.removeItem('wt_last_user');
    } catch (e) { /* ignore */ }
}

function applyCache(cache) {
    allData = cache.allData || {};
    userProfile = cache.userProfile || null;
    registerCustomPrograms();
    currentProgram = PROGRAMS[cache.currentProgram] ? cache.currentProgram : null;
}

function enterOfflineFromCache() {
    let cache = null;
    try { cache = readLocalCache(localStorage.getItem('wt_last_user')); } catch (e) { /* ignore */ }
    if (!cache || !cache.user) return false;
    currentUser = cache.user;
    applyCache(cache);
    savePending = !!cache.dirty;
    offlineMode = true;
    routeAfterLogin();
    setSaveStatus('offline');
    return true;
}

async function loadUserData() {
    if (!currentUser) return false;
    const cache = readLocalCache(currentUser.id);

    let row, error;
    try {
        ({ data: row, error } = await sb
            .from('user_data')
            .select('*')
            .eq('user_id', currentUser.id)
            .maybeSingle());
    } catch (e) {
        error = e;
    }

    if (error) {
        console.error('Load error:', error);
        if (!cache) return false;
        // No signal: carry on with the copy on this phone, sync later
        applyCache(cache);
        savePending = !!cache.dirty;
        offlineMode = true;
        return true;
    }
    offlineMode = false;

    // Changes made offline on this phone that never reached the cloud: keep them. If the cloud also moved on
    // meanwhile (trained on another device), merge both rather than dropping either side's workouts.
    if (cache && cache.dirty) {
        applyCache(cache);
        if (row && row.updated_at !== cache.cloudAt) {
            registerCustomPrograms(row.workout_data && row.workout_data._customPrograms);
            allData = mergeWorkoutData(allData, migrateWorkoutData(row.workout_data || {}, currentProgram).data);
            registerCustomPrograms();
        }
        cloudAt = row ? row.updated_at : null;
        scheduleSave();
        return true;
    }
    cloudAt = row ? row.updated_at : null;

    // First login: no row yet
    if (!row) {
        currentProgram = null;
        userProfile = null;
        allData = {};
        return true;
    }

    registerCustomPrograms(row.workout_data && row.workout_data._customPrograms);
    currentProgram = PROGRAMS[row.selected_program] ? row.selected_program : null;
    userProfile = row.profile && Object.keys(row.profile).length ? row.profile : null;
    if (userProfile && userProfile.lang !== LANG) {
        userProfile = { ...userProfile, lang: LANG };
        scheduleSave();
    }

    const { data, migrated } = migrateWorkoutData(row.workout_data || {}, currentProgram);
    allData = data;
    if (migrated) scheduleSave();
    else writeLocalCache(false);
    return true;
}

// Saves are debounced while typing and run one at a time, so the newest data always lands last
const SAVE_DELAY_MS = 800;
let saveTimer = null;
let savePending = false;
let saveChain = Promise.resolve(true);

function scheduleSave() {
    savePending = true;
    writeLocalCache(true);
    setSaveStatus('pending');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveToCloud, SAVE_DELAY_MS);
}

// Save now if anything is waiting; resolves to false if the save failed
async function flushSave() {
    if (!savePending) return saveChain;
    return saveToCloud();
}

function saveToCloud() {
    clearTimeout(saveTimer);
    savePending = false;
    writeLocalCache(true);
    saveChain = saveChain.then(writeToCloud, writeToCloud);
    return saveChain;
}

function isNetworkError(error) {
    return !navigator.onLine || /fetch|network|load failed/i.test(String(error && (error.message || error)));
}

async function writeToCloud() {
    if (!currentUser) return false;
    setSaveStatus('saving');

    let error, saved;
    try {
        // Did another device save since we last synced? Then fold its changes in first (a tiny read when not)
        const { data: head, error: headError } = await sb.from('user_data').select('updated_at').eq('user_id', currentUser.id).maybeSingle();
        if (headError) throw headError;
        if (head && head.updated_at && head.updated_at !== cloudAt) {
            const { data: remote, error: remoteError } = await sb.from('user_data').select('workout_data, updated_at').eq('user_id', currentUser.id).maybeSingle();
            if (remoteError) throw remoteError;
            if (remote && remote.workout_data) {
                allData = mergeWorkoutData(allData, remote.workout_data);
                registerCustomPrograms();
                if (!activeWorkout && !(document.activeElement && document.activeElement.matches('input, textarea, select'))) refreshAllViews();
            }
        }
        ({ data: saved, error } = await sb
            .from('user_data')
            .upsert({
                user_id: currentUser.id,
                selected_program: currentProgram,
                workout_data: allData,
                profile: userProfile,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })
            .select('updated_at')
            .maybeSingle());
    } catch (e) {
        error = e; // network failure
    }
    if (!error && saved && saved.updated_at) cloudAt = saved.updated_at;

    if (error) {
        console.error('Save error:', error);
        savePending = true;
        if (isNetworkError(error)) {
            // Safe on the phone; retried when the connection comes back
            setSaveStatus('offline');
        } else {
            setSaveStatus('error');
            showToast('Cloud save failed — tap Save to retry');
        }
        return false;
    }
    offlineMode = false;
    writeLocalCache(savePending);
    setSaveStatus(savePending ? 'pending' : 'saved');
    return true;
}

function setSaveStatus(state) {
    const s = document.getElementById('saveStatus');
    const labels = { pending: 'Editing', saving: 'Saving', saved: 'Saved', error: 'Not saved', offline: 'Offline · on phone' };
    s.textContent = labels[state];
    s.className = `save-status ${state}`;
}

// Back online: refresh the login if it expired while offline, then push what was saved on the phone
window.addEventListener('online', async () => {
    if (!sb || !currentUser) return;
    if (offlineMode) {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) {
            showToast('Back online — log in again to sync your workouts');
            return;
        }
    }
    flushSave();
});
