// ════════════════════════════════════════════
//  DIAGNOSTICS: what this phone actually gives the app (Settings → "Check this phone")
// ════════════════════════════════════════════

// Compare two phones side by side: motion settings, frame rate, install mode, fonts, language, data, errors.
const sessionErrors = [];
window.addEventListener('error', e => sessionErrors.push(e.message));
window.addEventListener('unhandledrejection', e => sessionErrors.push(String((e.reason && e.reason.message) || e.reason)));

// Frames per second over one second of animation frames
function measureFps() {
    return new Promise(resolve => {
        let frames = 0;
        const start = performance.now();
        const tick = now => {
            frames++;
            if (now - start < 1000) requestAnimationFrame(tick);
            else resolve(Math.round(frames * 1000 / (now - start)));
        };
        requestAnimationFrame(tick);
    });
}

function iosVersion() {
    const m = navigator.userAgent.match(/OS (\d+)[_.](\d+)/);
    return m ? `${m[1]}.${m[2]}` : '—';
}

async function openDiagnostics() {
    haptic();
    const body = document.getElementById('diagBody');
    body.innerHTML = '<p class="diag-wait">Measuring…</p>';
    document.getElementById('diagModal').classList.add('active');
    const fps = await measureFps();
    const media = q => window.matchMedia(q).matches;
    const yes = v => (v ? 'Yes' : 'No');
    const stats = playerStats();
    const rows = [
        ['App version', APP_VERSION],
        ['iOS', iosVersion()],
        ['Opened from the Home Screen', yes(isStandalone())],
        ['Reduce Motion', media('(prefers-reduced-motion: reduce)') ? 'On (fades instead of motion)' : 'Off'],
        ['Reduce Transparency', media('(prefers-reduced-transparency: reduce)') ? 'On' : 'Off'],
        ['Animation frame rate', `${fps} fps${fps < 50 ? ' (Low Power Mode or a busy phone)' : ''}`],
        ['Screen', `${screen.width} × ${screen.height} @${window.devicePixelRatio}x`],
        ['Language', `${LANGUAGES[LANG]}${storedLang() ? '' : ' (phone)'}`],
        ['Quote font ready', yes(document.fonts && document.fonts.check('400 32px "Instrument Serif"'))],
        ['Offline copy', yes(navigator.serviceWorker && navigator.serviceWorker.controller)],
        ['Program', currentProgram && PROGRAMS[currentProgram] ? PROGRAMS[currentProgram].name : '—'],
        ['Workouts logged', stats.workouts],
        ['Errors this session', sessionErrors.length ? sessionErrors.slice(-3).join(' · ') : 'None'],
    ];
    body.innerHTML = `
        <p class="diag-intro">Open this on both phones and compare. Lines that differ explain why the app feels different.</p>
        <div class="diag-list">${rows.map(([k, v]) => `<div class="diag-row"><span>${k}</span><strong>${escapeHtml(String(v))}</strong></div>`).join('')}</div>`;
}

function closeDiagnostics() {
    document.getElementById('diagModal').classList.remove('active');
}
