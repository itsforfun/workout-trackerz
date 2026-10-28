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

// The phone keeps its own copy so the app opens and saves at the gym without signal.
// `dirty` means it holds changes the cloud hasn't received yet.
const CACHE_PREFIX = 'wt_cache_';

function writeLocalCache(dirty) {
    if (!currentUser) return;
    try {
        const { id, email, created_at } = currentUser;
        localStorage.setItem(CACHE_PREFIX + id, JSON.stringify({
            user: { id, email, created_at }, allData, userProfile, currentProgram, dirty, savedAt: Date.now()
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

    // Changes made offline on this phone that never reached the cloud win over the cloud copy
    if (cache && cache.dirty && (!row || cache.savedAt > Date.parse(row.updated_at))) {
        applyCache(cache);
        scheduleSave();
        return true;
    }

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

    let error;
    try {
        ({ error } = await sb
            .from('user_data')
            .upsert({
                user_id: currentUser.id,
                selected_program: currentProgram,
                workout_data: allData,
                profile: userProfile,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' }));
    } catch (e) {
        error = e; // network failure
    }

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
