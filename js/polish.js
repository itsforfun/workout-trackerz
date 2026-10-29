// ════════════════════════════════════════════
//  POLISH: bottom sheets, rolling numbers, pull to refresh
// ════════════════════════════════════════════

const SHEET_CLOSE = { pickerModal: closePicker, cardioModal: closeCardioLog, swapModal: closeSwap, importModal: closeImport, recapModal: closeRecap, readinessModal: closeReadiness, genModal: closeGenerator, scienceModal: closeScience, badgeModal: closeBadge, shareModal: closeShareCard, guideModal: closeGuide, diagModal: closeDiagnostics };

function closeSheet(overlay) {
    const close = SHEET_CLOSE[overlay.id];
    if (close) close();
    else overlay.classList.remove('active');
    setTimeout(nextMoment, 450);
}

// On phones every modal is a bottom sheet: drag it down (or tap outside it) to close
function initSheets() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        const sheet = overlay.querySelector('.modal');
        sheet.insertAdjacentHTML('afterbegin', '<div class="sheet-grabber" aria-hidden="true"></div>');
        overlay.addEventListener('click', e => { if (e.target === overlay) closeSheet(overlay); });
        let startY = null;
        let dy = 0;
        let startAt = 0;
        sheet.addEventListener('touchstart', e => {
            // Lists and fields inside the sheet keep their own scrolling and text selection
            if (sheet.scrollTop > 0 || e.target.closest('input, textarea, select, .swap-list')) {
                startY = null;
                return;
            }
            startY = e.touches[0].clientY;
            dy = 0;
            startAt = Date.now();
            sheet.style.transition = 'none';
        }, { passive: true });
        sheet.addEventListener('touchmove', e => {
            if (startY === null) return;
            dy = Math.max(0, e.touches[0].clientY - startY);
            sheet.style.transform = `translateY(${dy}px)`;
        }, { passive: true });
        sheet.addEventListener('touchend', () => {
            if (startY === null) return;
            startY = null;
            sheet.style.transition = '';
            const flick = dy / Math.max(1, Date.now() - startAt) > 0.6 && dy > 30;
            if (dy > 110 || flick) {
                sheet.style.transform = 'translateY(100%)';
                setTimeout(() => {
                    closeSheet(overlay);
                    sheet.style.transform = '';
                }, 220);
            } else {
                sheet.style.transform = '';
            }
        });
    });
}

// Numbers marked data-count="…" data-key="…" roll from the value last shown under that key
const shownCounts = {};

function formatCount(value, format) {
    const n = Math.round(value);
    if (format === 'compact') return compactNum(n);
    if (format === 'locale') return n.toLocaleString(LOCALE);
    return String(n);
}

function rollNumbers(root) {
    root.querySelectorAll('[data-count]').forEach(el => {
        const to = parseFloat(el.dataset.count);
        const key = el.dataset.key;
        const from = key in shownCounts ? shownCounts[key] : 0;
        shownCounts[key] = to;
        const format = el.dataset.format;
        if (from === to || prefersReducedMotion()) {
            el.textContent = formatCount(to, format);
            return;
        }
        const duration = 900;
        const start = performance.now();
        el.textContent = formatCount(from, format);
        const step = now => {
            const t = Math.min(1, (now - start) / duration);
            el.textContent = formatCount(from + (to - from) * (1 - Math.pow(1 - t, 3)), format);
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        // Animation frames pause in background tabs; land on the right number regardless
        setTimeout(() => { el.textContent = formatCount(to, format); }, duration + 150);
    });
}

// Pull down at the top of the Steps tab to fetch the latest synced count
function initPullToRefresh() {
    const page = document.getElementById('page-steps');
    const spinner = document.createElement('div');
    spinner.className = 'ptr';
    spinner.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4.5h-4.5"/></svg>';
    document.body.appendChild(spinner);
    const threshold = 80;
    let startY = null;
    let dy = 0;
    page.addEventListener('touchstart', e => {
        startY = window.scrollY <= 0 && page.classList.contains('active') ? e.touches[0].clientY : null;
        dy = 0;
    }, { passive: true });
    page.addEventListener('touchmove', e => {
        if (startY === null) return;
        dy = Math.max(0, e.touches[0].clientY - startY);
        const pull = Math.min(1, dy / threshold);
        spinner.style.opacity = pull;
        spinner.style.transform = `translate(-50%, ${pull * 24}px) rotate(${pull * 270}deg)`;
        spinner.classList.toggle('ready', dy >= threshold);
    }, { passive: true });
    page.addEventListener('touchend', async () => {
        if (startY === null) return;
        startY = null;
        if (dy >= threshold) {
            haptic();
            spinner.classList.add('spinning');
            await Promise.all([renderSteps(), new Promise(r => setTimeout(r, 600))]);
        }
        spinner.classList.remove('spinning', 'ready');
        spinner.style.opacity = 0;
        spinner.style.transform = '';
    });
}

initSheets();
initPullToRefresh();
initTabLens();

// ── Opening quote (see the #splash block at the top of <body>) ──
const SPLASH_MIN_MS = 4000;
const SPLASH_MAX_MS = 7000;
let hiddenAt = null;

function hideSplash() {
    const splash = document.getElementById('splash');
    if (!splash || splash.classList.contains('hide')) return;
    splash.classList.add('hide');
    document.body.classList.add('app-enter');
    setTimeout(() => document.body.classList.remove('app-enter'), 1600);
}

// Leave once the app has finished loading, but keep the quote up long enough to read
function scheduleSplashHide() {
    const splash = document.getElementById('splash');
    if (!splash) return;
    const shownAt = window.__splashAt || Date.now();
    const check = () => {
        const elapsed = Date.now() - shownAt;
        const ready = !document.getElementById('loadingScreen').classList.contains('active');
        const minimum = window.__splashMin || SPLASH_MIN_MS;
        if ((ready && elapsed >= minimum) || elapsed >= Math.max(SPLASH_MAX_MS, minimum)) hideSplash();
        else setTimeout(check, 150);
    };
    check();
}

// Home-screen apps often resume instead of relaunching: after 15+ minutes away, open with a new quote
function showSplashAgain() {
    const splash = document.getElementById('splash');
    if (!splash || splashOff()) return;
    let deck = [];
    try { deck = JSON.parse(localStorage.getItem('wt_quote_deck') || '[]'); } catch (e) { /* private mode */ }
    if (!deck.length) deck = QUOTES.map((_, i) => i).sort(() => Math.random() - 0.5);
    const index = deck.shift();
    try { localStorage.setItem('wt_quote_deck', JSON.stringify(deck)); } catch (e) { /* private mode */ }
    renderSplash(quoteAt(index));
    // Replay the entrance animation
    splash.classList.remove('hide');
    splash.querySelectorAll('.splash-kicker, .splash-line, .splash-by').forEach(el => {
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = '';
    });
    window.__splashAt = Date.now();
    setTimeout(hideSplash, window.__splashMin || SPLASH_MIN_MS);
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt >= 15 * 60000 && !activeWorkout) showSplashAgain();
});

// Language: '' follows the phone. The page reloads so every screen is rebuilt in the new language.
// profile.lang tells the server which language to write reminders in.
async function setLanguage(code) {
    haptic();
    try {
        if (code) localStorage.setItem('odyr_lang', code);
        else localStorage.removeItem('odyr_lang');
    } catch (e) { /* private mode */ }
    if (userProfile && currentUser) {
        userProfile = { ...userProfile, lang: code || phoneLang() };
        await saveToCloud();
    }
    location.reload();
}

function splashOff() {
    try { return localStorage.getItem('wt_splash_off') === '1'; } catch (e) { return false; }
}

function setSplash(on) {
    haptic();
    try { localStorage.setItem('wt_splash_off', on ? '0' : '1'); } catch (e) { /* private mode */ }
}
