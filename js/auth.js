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
        showAuthError(error.message);
    } else {
        currentUser = data.user;
        await enterApp();
    }
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
        showAuthError(error.message);
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
        showAuthError(error.message);
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
        showAuthError(error.message);
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

async function handleProfileSave(event) {
    event.preventDefault();

    const gender = document.getElementById('profileGender').value;
    const age = parseInt(document.getElementById('profileAge').value);
    const weight = parseFloat(document.getElementById('profileWeight').value);
    const height = parseInt(document.getElementById('profileHeight').value);

    const goal = document.getElementById('profileGoal').value || 'general';
    userProfile = { gender, age, weight, height, goal, units: 'kg', lang: LANG };
    rememberGender();
    logBodyweight(weight);
    // First login: no program chosen yet, so this saves selected_program: null

    if (await saveToCloud()) {
        showScreen('selector');
    } else {
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
            showSettingsError(error.message);
        } else {
            showToast('Password reset email sent!');
        }
    }
}

async function handleDeleteAccount() {
    const confirmation = prompt('WARNING: This will permanently delete your body metrics and workout data for every program.\n\nType "DELETE" to confirm:');
    if (confirmation !== 'DELETE') return;

    // Stop pending saves so they can't re-create the row after it's deleted
    clearTimeout(saveTimer);
    savePending = false;
    await saveChain;

    const { error } = await sb
        .from('user_data')
        .delete()
        .eq('user_id', currentUser.id);

    if (error) {
        showSettingsError('Failed to delete data: ' + error.message);
        return;
    }

    // Deleting the login itself needs a server-side admin key, which can't live in this page
    alert('Your workout data and profile have been deleted.\n\nYour login (email) still exists. Ask the app owner if you want it removed as well.');
    await signOutAndReset();
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
    const height = parseInt(document.getElementById('settingsHeight').value);

    const weightChanged = !userProfile || Math.abs((userProfile.weight || 0) - weight) >= 0.05;
    const goal = document.getElementById('settingsGoal').value || 'general';
    // Keep following the goal unless a different level was picked
    const picked = document.getElementById('settingsCardio').value;
    const goalDefault = ['muscle', 'strength'].includes(goal) ? 'light' : 'standard';
    const cardio = !userProfile.cardio && picked === goalDefault ? undefined : picked;
    userProfile = { ...userProfile, gender, age, weight, height, goal, cardio, units };
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
    document.getElementById('settingsAge').value = userProfile.age || '';
    document.getElementById('settingsWeightLabel').textContent = `Weight (${usesLb() ? 'lb' : 'kg'})`;
    document.getElementById('settingsWeight').value = userProfile.weight ? kgToDisplay(userProfile.weight) : '';
    document.getElementById('settingsHeight').value = userProfile.height || '';
    document.getElementById('userEmail').textContent = currentUser.email;
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
    const bmi = (userProfile.weight / Math.pow(userProfile.height / 100, 2)).toFixed(1);
    const strengthMultiplier = getStrengthMultiplier(programGender).toFixed(2);

    document.getElementById('standardsCalculation').innerHTML = `
        <strong>BMI:</strong> ${escapeHtml(bmi)}<br>
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
