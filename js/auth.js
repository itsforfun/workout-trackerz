// ════════════════════════════════════════════
//  AUTHENTICATION
// ════════════════════════════════════════════

async function checkAuth() {
    if (!sb) {
        // No login library (e.g. offline on first load) — fall back to the phone's copy if we have one
        if (enterOfflineFromCache()) return;
        showScreen('auth');
        showAuthError('Could not load the login service. Check your connection and refresh.');
        return;
    }
    try {
        const { data: { session }, error } = await sb.auth.getSession();
        if (!session) {
            // An expired login can't be refreshed without signal; keep training from the cached copy
            if ((error || !navigator.onLine) && enterOfflineFromCache()) return;
            showScreen('auth');
            return;
        }
        currentUser = session.user;
        if (recoveryMode) {
            showNewPasswordForm();
            return;
        }
        await enterApp();
    } catch (error) {
        console.error('Auth check error:', error);
        if (enterOfflineFromCache()) return;
        showScreen('auth');
    }
}

async function enterApp() {
    showScreen('loading');
    if (await loadUserData()) {
        routeAfterLogin();
    } else {
        // Never continue with empty data: the next save would overwrite the cloud copy
        await sb.auth.signOut();
        currentUser = null;
        showScreen('auth');
        showAuthError('Could not load your data. Please try again in a moment.');
    }
}

function showAuthForm(name) {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(name + 'Form').classList.add('active');
    document.querySelector('.auth-tabs').style.display = name === 'newPassword' ? 'none' : 'flex';
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    if (name === 'login') document.querySelector('.auth-tab:first-child').classList.add('active');
    if (name === 'signup') document.querySelector('.auth-tab:last-child').classList.add('active');
}

function switchAuthTab(tab) {
    showAuthForm(tab);
    hideAuthError();
}

function showNewPasswordForm() {
    showScreen('auth');
    showAuthForm('newPassword');
    showAuthError('Choose a new password for your account.', true);
}

// Supabase's own error texts are technical and English only ("email rate limit exceeded"), so each known
// case gets a plain message instead (translated like any other text). Matched on the error code, with the
// message text as a fallback for older error shapes.
const AUTH_MESSAGES = [
    [/over_email_send_rate_limit|email rate limit/i, 'Too many sign-up or reset emails right now. Please try again in an hour.'],
    [/over_request_rate_limit|rate limit|too many requests/i, 'Too many attempts. Wait a minute, then try again.'],
    [/invalid_credentials|invalid login credentials/i, 'Wrong email or password.'],
    [/email_not_confirmed|email not confirmed/i, 'Confirm your email first: open the link we sent you, then log in.'],
    [/user_already_exists|email_exists|already registered/i, 'An account already exists for this email. Log in instead, or tap "Forgot password?".'],
    [/weak_password|password should/i, 'Choose a stronger password: at least 6 characters.'],
    [/same_password|different from the old/i, 'Choose a password different from your current one.'],
    [/email_address_invalid|invalid.*email|email.*invalid/i, 'That email address doesn’t look right.'],
    [/anonymous_provider_disabled|anonymous sign-ins are disabled/i, 'Trying Odyr without an account isn’t available right now. Create an account to start.'],
    [/email_conflict_identity_not_deletable|identity_already_exists/i, 'An account already exists for this email. Log in instead, or tap "Forgot password?".'],
    [/AuthRetryableFetchError|failed to fetch|network/i, 'No connection. Check your internet and try again.'],
];

function authMessage(error) {
    const text = [error && error.code, error && error.name, error && error.message].filter(Boolean).join(' ');
    const match = AUTH_MESSAGES.find(([pattern]) => pattern.test(text));
    if (!match) console.warn('Auth error:', error);
    return match ? match[1] : 'Something went wrong. Please try again in a moment.';
}

function showAuthError(message, isInfo = false) {
    const errorEl = document.getElementById('authError');
    errorEl.textContent = message;
    errorEl.classList.toggle('info', isInfo);
    errorEl.classList.add('show');
}

function hideAuthError() {
    document.getElementById('authError').classList.remove('show');
}

async function handleLogin(event) {
    event.preventDefault();
    hideAuthError();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
        showAuthError(authMessage(error));
    } else {
        currentUser = data.user;
        await enterApp();
    }
}

// ── Try first, sign up later: a guest is a Supabase anonymous user (same row, same RLS). Saving progress
// adds an email and password to that same user, so nothing moves. Needs Authentication → Sign In / Providers →
// "Allow anonymous sign-ins" in the dashboard; until then the button stays hidden. ──
function isGuest() {
    return !!(currentUser && currentUser.is_anonymous && !currentUser.email);
}

async function refreshGuestStart() {
    const el = document.getElementById('guestStart');
    if (!el) return;
    let known = null;
    try { known = localStorage.getItem('odyr_guest_ok'); } catch (e) { /* private mode */ }
    el.hidden = known !== '1';
    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } });
        const ok = !!(await res.json()).external?.anonymous_users;
        el.hidden = !ok;
        try { localStorage.setItem('odyr_guest_ok', ok ? '1' : '0'); } catch (e) { /* private mode */ }
    } catch (e) { /* offline: keep what we knew */ }
}

async function startAsGuest() {
    hideAuthError();
    haptic();
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) {
        showAuthError(authMessage(error));
        if (/anonymous/i.test(error.code || error.message || '')) document.getElementById('guestStart').hidden = true;
        return;
    }
    currentUser = data.user;
    await enterApp();
}

function openGuestSave() {
    haptic();
    document.getElementById('guestError').classList.remove('show');
    document.getElementById('guestModal').classList.add('active');
}

function closeGuestSave() {
    document.getElementById('guestModal').classList.remove('active');
}

async function saveGuestAccount(event) {
    event.preventDefault();
    const email = document.getElementById('guestEmail').value.trim();
    const password = document.getElementById('guestPassword').value;
    const errorEl = document.getElementById('guestError');
    const button = document.getElementById('guestSubmit');
    errorEl.classList.remove('show', 'info');
    button.disabled = true;
    await flushSave();
    // Email first (links it to this user), then the password: Supabase needs the email before a password
    let { data, error } = await sb.auth.updateUser({ email }, { emailRedirectTo: appUrl() });
    if (!error && data.user && data.user.email) ({ data, error } = await sb.auth.updateUser({ password }));
    button.disabled = false;
    if (error) {
        errorEl.textContent = authMessage(error);
        errorEl.classList.add('show');
        return;
    }
    currentUser = data.user;
    if (!currentUser.email) {
        // The project asks to confirm email changes: the link finishes it, then the password can be set
        errorEl.textContent = `Almost there: open the link we sent to ${email}, then save your password here.`;
        errorEl.classList.add('show', 'info');
        return;
    }
    closeGuestSave();
    renderGuestCard();
    loadSettingsForm();
    showToast('Progress saved. Log in with this email on any device.');
}

// On Today once a guest has trained: one quiet card to save it
function renderGuestCard() {
    const el = document.getElementById('guestCard');
    if (!el) return;
    if (!isGuest() || !allWorkoutDates().length) {
        el.innerHTML = '';
        return;
    }
    el.innerHTML = `
        <div class="install-card guest-card">
            <svg class="install-mark" aria-hidden="true"><use href="#odyrMark"/></svg>
            <div class="install-text">
                <strong>Save your progress</strong>
                <span>Add an email so your workouts are safe and you can log in from any device.</span>
                <button class="btn btn-primary install-btn" onclick="openGuestSave()">Save it</button>
            </div>
        </div>`;
}

async function handleSignup(event) {
    event.preventDefault();
    hideAuthError();

    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const passwordConfirm = document.getElementById('signupPasswordConfirm').value;

    if (password !== passwordConfirm) {
        showAuthError('Passwords do not match');
        return;
    }

    const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: appUrl() }
    });

    if (error) {
        showAuthError(authMessage(error));
    } else if (data.session) {
        // Email confirmation is turned off in Supabase: we're already logged in
        currentUser = data.user;
        await enterApp();
    } else {
        showAuthError('Account created! Check your email to verify your account, then log in.', true);
        showAuthForm('login');
        document.getElementById('loginEmail').value = email;
    }
}

async function handleForgotPassword() {
    hideAuthError();
    const email = document.getElementById('loginEmail').value.trim();
    if (!email) {
        showAuthError('Type your email in the Email box first, then tap "Forgot password?" again.');
        return;
    }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
    if (error) {
        showAuthError(authMessage(error));
    } else {
        showAuthError(`If an account exists for ${email}, a reset link is on its way. Open it on this device.`, true);
    }
}

async function handleNewPassword(event) {
    event.preventDefault();
    const password = document.getElementById('newPassword').value;
    if (password !== document.getElementById('newPasswordConfirm').value) {
        showAuthError('Passwords do not match');
        return;
    }
    const { data, error } = await sb.auth.updateUser({ password });
    if (error) {
        showAuthError(authMessage(error));
        return;
    }
    recoveryMode = false;
    history.replaceState(null, '', appUrl());
    currentUser = data.user;
    hideAuthError();
    showToast('Password updated!');
    await enterApp();
}

async function handleLogout() {
    if (isGuest()) {
        if (!confirm('You haven’t saved your progress with an email yet. Logging out loses it for good. Log out anyway?')) return;
        await signOutAndReset();
        return;
    }
    if (!confirm('Logout? Your progress is saved in the cloud.')) return;
    if (!(await flushSave()) && !confirm('Your latest changes could not be saved to the cloud and will be lost if you log out. Logout anyway?')) return;
    await signOutAndReset();
}

async function signOutAndReset() {
    if (currentUser) {
        clearLocalCache(currentUser.id);
        clearActiveWorkout();
    }
    if (sb) await sb.auth.signOut();
    currentUser = null;
    currentProgram = null;
    userProfile = null;
    allData = {};
    offlineMode = false;
    showScreen('auth');
    showAuthForm('login');
}

// ════════════════════════════════════════════
//  PROFILE MANAGEMENT
// ════════════════════════════════════════════

// Days a week, asked in profile setup (1–2 / 3 / 4+), picks the first program
let profileDays = null;

function setProfileDays(days) {
    haptic();
    profileDays = days;
    document.querySelectorAll('#profileDays .pp-day').forEach(b => b.classList.toggle('active', b.dataset.days === days));
    document.getElementById('profileError').classList.remove('show');
}

async function handleProfileSave(event) {
    event.preventDefault();

    const gender = document.getElementById('profileGender').value;
    const age = parseInt(document.getElementById('profileAge').value);
    const weight = parseFloat(document.getElementById('profileWeight').value);
    const height = parseInt(document.getElementById('profileHeight').value) || null;
    const daysPerWeek = profileDays || (userProfile && userProfile.daysPerWeek);
    if (!daysPerWeek) {
        const errorEl = document.getElementById('profileError');
        errorEl.textContent = 'Choose how many days a week you can train.';
        errorEl.classList.add('show');
        return;
    }

    const goal = document.getElementById('profileGoal').value || 'general';
    userProfile = { ...(userProfile || {}), gender, age, weight, height, goal, daysPerWeek, units: (userProfile && userProfile.units) || 'kg', lang: LANG };
    rememberGender();
    logBodyweight(weight);

    // A brand-new account goes straight to the program picked from days, sex and goal (one less screen);
    // anyone who already chose or trained lands on the menu as before. "Programs" in the top bar changes it.
    const firstTime = !currentProgram && !allWorkoutDates().length;
    if (firstTime) currentProgram = recommendedProgram(daysPerWeek, gender, goal);
    if (await saveToCloud()) {
        if (firstTime) openProgram();
        else showScreen('selector');
    } else {
        if (firstTime) currentProgram = null;
        const errorEl = document.getElementById('profileError');
        errorEl.textContent = 'Could not save your profile. Check your connection and try again.';
        errorEl.classList.add('show');
    }
}

async function handlePasswordReset() {
    const email = currentUser.email;

    if (confirm(`Send password reset link to ${email}?`)) {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });

        if (error) {
            showSettingsError(authMessage(error));
        } else {
            showToast('Password reset email sent!');
        }
    }
}

// Delete the whole account: the server function (supabase/functions/delete-account) removes the login, and every
// table follows it. Until that function is deployed, fall back to deleting the saved data only, and say so.
async function handleDeleteAccount() {
    const confirmation = prompt('This permanently deletes your account and everything in it.\n\nType "DELETE" to confirm:');
    if (confirmation !== 'DELETE') return;

    // Stop pending saves so they can't re-create the row after it's deleted
    clearTimeout(saveTimer);
    savePending = false;
    await saveChain;

    const { data, error } = await sb.functions.invoke('delete-account', { body: {} });
    if (!error && data && data.deleted) {
        alert('Your account and all your data have been deleted.');
        await signOutAndReset();
        return;
    }

    if (!confirm('Deleting the account isn\'t available right now. Delete your workout data and profile instead? Your login would stay.')) return;
    const { error: rowError } = await sb.from('user_data').delete().eq('user_id', currentUser.id);
    if (rowError) {
        showSettingsError('Failed to delete data: ' + rowError.message);
        return;
    }
    alert('Your workout data and profile have been deleted. Your login (email) still exists.');
    await signOutAndReset();
}

// Everything Odyr holds about you, in one readable file
function exportAllData() {
    haptic();
    const file = {
        exported: new Date().toISOString(),
        app: `Odyr ${APP_VERSION}`,
        account: { email: currentUser ? currentUser.email : null, created: currentUser ? currentUser.created_at : null },
        profile: userProfile,
        programs: Object.fromEntries(Object.entries(allData).filter(([key]) => !key.startsWith('_'))),
        activity: Object.fromEntries(Object.entries(allData).filter(([key]) => key.startsWith("_"))),
        steps: stepData,
    };
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `odyr-my-data-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Period check-in is offered only when the form says female
function showCycleSetting() {
    document.getElementById('settingsCycleGroup').hidden = document.getElementById('settingsGender').value !== 'female';
}

// Until a cardio level was picked by hand, it follows the goal chosen in the form
function cardioFollowsGoal(goal) {
    if (userProfile && userProfile.cardio) return;
    document.getElementById('settingsCardio').value = ['muscle', 'strength'].includes(goal) ? 'light' : 'standard';
}

async function handleSettingsUpdate(event) {
    event.preventDefault();

    const units = document.getElementById('settingsUnits').value;
    const gender = document.getElementById('settingsGender').value;
    const age = parseInt(document.getElementById('settingsAge').value);
    // The weight box is shown in the units that were active when the form was filled
    const weightShown = parseFloat(document.getElementById('settingsWeight').value);
    const weight = Math.round(displayToKg(weightShown) * 10) / 10;
    const height = parseInt(document.getElementById('settingsHeight').value) || null;

    const weightChanged = !userProfile || Math.abs((userProfile.weight || 0) - weight) >= 0.05;
    const goal = document.getElementById('settingsGoal').value || 'general';
    // Keep following the goal unless a different level was picked
    const picked = document.getElementById('settingsCardio').value;
    const goalDefault = ['muscle', 'strength'].includes(goal) ? 'light' : 'standard';
    const cardio = !userProfile.cardio && picked === goalDefault ? undefined : picked;
    const cycleCheck = gender === 'female' && document.getElementById('settingsCycle').value === 'on';
    userProfile = { ...userProfile, gender, age, weight, height, goal, cardio, units, cycleCheck };
    rememberGender();
    if (weightChanged) logBodyweight(weight);

    // Re-rank tiers with the new personalized standards and units
    refreshAllViews();
    loadSettingsForm();

    if (await saveToCloud()) showToast('Profile updated!');
}

function loadSettingsForm() {
    if (!userProfile) return;

    document.getElementById('settingsUnits').value = usesLb() ? 'lb' : 'kg';
    document.getElementById('settingsGender').value = userProfile.gender || 'male';
    document.getElementById('settingsGoal').value = userGoal();
    document.getElementById('settingsCardio').value = userCardio();
    document.getElementById('settingsCycle').value = userProfile.cycleCheck ? 'on' : 'off';
    showCycleSetting();
    document.getElementById('settingsAge').value = userProfile.age || '';
    document.getElementById('settingsWeightLabel').textContent = `Weight (${usesLb() ? 'lb' : 'kg'})`;
    document.getElementById('settingsWeight').value = userProfile.weight ? kgToDisplay(userProfile.weight) : '';
    document.getElementById('settingsHeight').value = userProfile.height || '';
    document.getElementById('userEmail').textContent = isGuest() ? tr('Guest, no email yet') : currentUser.email;
    document.getElementById('guestSaveBtn').hidden = !isGuest();
    document.getElementById('resetPasswordBtn').hidden = isGuest();
    document.getElementById('userCreated').textContent = currentUser.created_at ? new Date(currentUser.created_at).toLocaleDateString(LOCALE) : '—';

    updateStandardsDisplay();
    renderBodyweight();
    renderCycleInfo();
    renderPushStatus();
    document.getElementById('appVersion').textContent = `Version ${APP_VERSION}`;
}

function updateStandardsDisplay() {
    if (!userProfile || !userProfile.weight || !currentProgram) {
        document.getElementById('standardsCalculation').textContent = 'Enter your metrics to see personalized standards';
        return;
    }

    const programGender = PROGRAMS[currentProgram].gender;
    const baseWeight = getBaseWeight(programGender);
    const converted = userGender() && userGender() !== programGender;
    const bmi = userProfile.height ? (userProfile.weight / Math.pow(userProfile.height / 100, 2)).toFixed(1) : null;
    const strengthMultiplier = getStrengthMultiplier(programGender).toFixed(2);

    document.getElementById('standardsCalculation').innerHTML = `
        ${bmi ? `<strong>BMI:</strong> ${escapeHtml(bmi)}<br>` : ''}
        <strong>Bodyweight:</strong> ${escapeHtml(kgToDisplay(userProfile.weight))}${usesLb() ? 'lb' : 'kg'}<br>
        <strong>Standards adjusted by:</strong> ${escapeHtml(strengthMultiplier)}x from the ${kgToDisplay(baseWeight)}${usesLb() ? 'lb' : 'kg'} reference lifter<br>
        ${converted ? `<strong>Standards:</strong> ${userGender() === 'female' ? "converted to women's standards" : "converted to men's standards"}<br>` : ''}
        <em style="font-size:0.65rem; color:var(--text-muted);">Your tier thresholds are personalized to your bodyweight (pull-ups and other bodyweight-plus lifts are not scaled)</em>
    `;
}

function showSettingsError(message) {
    const errorEl = document.getElementById('settingsError');
    errorEl.textContent = message;
    errorEl.classList.add('show');
    setTimeout(() => errorEl.classList.remove('show'), 5000);
}
