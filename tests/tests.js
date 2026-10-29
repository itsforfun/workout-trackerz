// Automated checks for Odyr. Open index.html?test (or ?test&lang=fr) and the results appear at the bottom of the page.
// They run inside the real app with sample data (tests/fixture.js) and a pretend database (tests/setup.js).
// GitHub runs the same page on every push (.github/workflows/tests.yml → tests/ci.mjs).

(async () => {
    const results = [];
    const check = async (name, fn) => {
        try {
            loadFixture();
            await fn();
            results.push({ name, ok: true });
        } catch (error) {
            results.push({ name, ok: false, error: String(error && error.stack || error).split('\n').slice(0, 3).join(' | ') });
        }
    };
    const assert = (cond, message) => { if (!cond) throw new Error(message); };
    const equal = (a, b, message) => { if (a !== b) throw new Error(`${message}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
    const ex = id => PROGRAMS.fullBody3.exercises.find(e => e.id === id);
    const logSets = (id, kg, reps, rir) => {
        allData.fullBody3[id] = { 0: { kg: String(kg), date: todayStr(), sets: reps.map(r => ({ kg: String(kg), reps: String(r), ...(rir !== undefined ? { rir: String(rir) } : {}) })) } };
    };

    // ── Units and standards ──
    await check('kg ↔ lb conversion round-trips', () => {
        userProfile.units = 'lb';
        equal(kgToDisplay(100), '220.5', '100 kg shown in lb');
        assert(Math.abs(displayToKg('220.5') - 100) < 0.05, 'lb back to kg');
        userProfile.units = 'kg';
        equal(kgToDisplay(62.5), '62.5', 'kg shown as kg');
    });

    await check('Tier thresholds scale with bodyweight (exponent 0.67)', () => {
        const e = ex('incline-db-press');
        userProfile.weight = 95;
        equal(getThresholds(e)[2], e.thresholds[2], 'reference lifter keeps the base thresholds');
        userProfile.weight = 76;
        const expected = Math.round(e.thresholds[2] * Math.pow(76 / 95, 0.67) * 10) / 10;
        equal(getThresholds(e)[2], expected, 'lighter lifter gets scaled thresholds');
    });

    // ── Coach: progression rules ──
    await check('Top of the range with normal effort → add one step', () => {
        const e = ex('incline-db-press');
        const p = getPrescription(e);
        logSets(e.id, 26, Array(p.sets).fill(p.repMax), 2);
        const prog = getProgression(e);
        equal(prog.type, 'kg', 'progression type');
        equal(prog.kg, Math.round((26 + incrementKg(e)) * 1000) / 1000, 'next weight');
    });

    await check('Top of the range, every set easy → double jump', () => {
        const e = ex('incline-db-press');
        const p = getPrescription(e);
        logSets(e.id, 26, Array(p.sets).fill(p.repMax), 4);
        equal(getProgression(e).kg, Math.round((26 + 2 * incrementKg(e)) * 1000) / 1000, 'next weight');
    });

    await check('Missed reps at max effort → one step lighter', () => {
        const e = ex('incline-db-press');
        const p = getPrescription(e);
        logSets(e.id, 26, Array(p.sets).fill(p.repMin - 2), 0);
        const prog = getProgression(e);
        equal(prog.type, 'retry', 'progression type');
        assert(prog.kg < 26, 'weight goes down');
    });

    await check('Same weight three sessions running → stall rule', () => {
        const e = ex('incline-db-press');
        const p = getPrescription(e);
        const mid = Math.max(p.repMin, p.repMax - 2);
        allData.fullBody3[e.id] = Object.fromEntries([0, 1, 2].map(w => [w, { kg: '26', date: todayStr(), sets: Array(p.sets).fill(0).map(() => ({ kg: '26', reps: String(mid) })) }]));
        equal(getProgression(e).label, 'stall', 'progression label');
    });

    // ── Data ──
    await check('Programs never share data, even for the same exercise name', () => {
        currentProgram = 'fullBody3';
        logSets('incline-db-press', 30, [10, 10, 10]);
        currentProgram = 'male';
        assert(!progData()['incline-db-press'], 'other program sees no data');
        currentProgram = 'fullBody3';
    });

    await check('Old flat data moves into the selected program', () => {
        const { data, migrated } = migrateWorkoutData({ 0: { 0: '52.5' }, _sessions: {} }, 'male');
        assert(migrated, 'migration ran');
        equal(data.male[PROGRAMS.male.exercises[0].id][0], '52.5', 'value moved to the first exercise id');
        assert(data._sessions, 'meta keys kept');
    });

    await check('Saving upserts one row per user (onConflict user_id)', async () => {
        window.__sbCalls.length = 0;
        await saveToCloud();
        const call = window.__sbCalls.find(c => c.table === 'user_data');
        assert(call, 'user_data was written');
        equal(call.options && call.options.onConflict, 'user_id', 'conflict column');
        equal(call.row.user_id, currentUser.id, 'row belongs to the user');
        assert(call.row.workout_data.fullBody3, 'workout data included');
    });

    await check('A decimal comma typed in a weight field becomes a dot', () => {
        const input = document.createElement('input');
        input.inputMode = 'decimal';
        document.body.appendChild(input);
        input.value = '62,5';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.remove();
        equal(input.value, '62.5', 'normalised value');
    });

    // ── Workout flow ──
    await check('Finishing a workout saves sets, logs the session and opens the summary', () => {
        activeWorkout = null;
        showScreen('app');
        renderToday();
        beginWorkout(null);
        const [first] = Object.keys(activeWorkout.rows);
        activeWorkout.rows[first].forEach(r => { r.done = true; r.reps = 10; r.kg = 60; });
        const sessionsBefore = programSessions().length;
        const week = activeWorkout.week;
        finishWorkout();
        equal(programSessions().length, sessionsBefore + 1, 'session count');
        const saved = progData()[first][week];
        assert(saved && saved.sets && saved.sets.length, 'sets saved under the week');
        assert(document.getElementById('summaryScreen').classList.contains('active'), 'summary is showing');
        assert(lastSummary.records.length === 1, 'a heavier set counts as a record');
        assert(lastSummary.xpGained > 0, 'XP was earned');
        closeSummary();
    });

    // ── Scores and levels ──
    await check('Levels: XP thresholds rise and ranks match', () => {
        for (let l = 2; l <= 100; l++) assert(xpForLevel(l) > xpForLevel(l - 1), `level ${l} needs more XP than ${l - 1}`);
        equal(levelFromXp(xpForLevel(10)), 10, 'level from XP');
        equal(rankFor(10), 'Contender', 'rank at level 10');
    });

    await check('Consistency score stays between 0 and 100', () => {
        const { score } = consistencyScore();
        assert(score >= 0 && score <= 100, `score ${score}`);
    });

    // ── Every screen renders ──
    await check('Every screen and sheet renders without an error', () => {
        const steps = [
            () => switchTab('today'), () => switchTab('tracker'), () => switchTab('steps'), () => renderStepsSetup(true),
            () => switchTab('progress'), () => switchTab('settings'), () => openTrophyRoom(), () => openBadge(badgeTracks()[0].id),
            () => closeBadge(), () => closeTrophyRoom(), () => openRecap(), () => closeRecap(), () => openScience(), () => closeScience(),
            () => openGenerator(), () => closeGenerator(), () => openBuilder(), () => showScreen('selector'), () => showScreen('app'),
            () => openGuide(PROGRAMS.fullBody3.exercises[0].id), () => closeGuide(), () => startPro(), () => cancelPro(),
        ];
        steps.forEach((step, i) => {
            try { step(); } catch (error) { throw new Error(`step ${i + 1}: ${error.message}`); }
        });
    });

    // ── Every program, for a brand-new account and with data ──
    await check('Every program works for a new account and with data (all screens + a workout)', () => {
        Object.keys(PROGRAMS).filter(id => !id.startsWith('custom-')).forEach(prog => [true, false].forEach(fresh => {
            loadFixture();
            if (fresh) {
                allData = {};
                userProfile = { gender: 'female', age: 30, weight: 62, height: 168, units: 'kg' };
            }
            const tag = `${prog}${fresh ? ' (new account)' : ''}`;
            const step = (name, fn) => { try { fn(); } catch (error) { throw new Error(`${tag}, ${name}: ${error.message}`); } };
            currentProgram = prog;
            step('open program', () => selectProgram(prog));
            ['today', 'tracker', 'steps', 'progress', 'settings'].forEach(t => step(`${t} tab`, () => showTab(t)));
            step('trophy room', () => { openTrophyRoom(); closeTrophyRoom(); });
            step('walkthrough', () => { showTab('today'); startTour(); endTour(); });
            step('workout', () => {
                activeWorkout = null;
                showTab('today');
                beginWorkout(null);
                Object.values(activeWorkout.rows)[0].forEach(r => { r.done = true; r.reps = 8; r.kg = r.kg || 20; });
                finishWorkout();
                closeSummary();
            });
        }));
        currentProgram = 'fullBody3';
    });

    await check('Reduce Motion keeps fades (no rule cuts every animation)', () => {
        const css = [...document.styleSheets].find(sheet => (sheet.href || '').includes('app.css'));
        const reduce = [...css.cssRules].filter(r => r.media && r.media.mediaText.includes('reduce'));
        assert(!reduce.some(r => /animation-duration:\s*0\.01ms/.test(r.cssText)), 'a blanket rule switches every animation off');
        assert(reduce.some(r => [...r.cssRules].some(k => k.name === 'sheetUp')), 'fade-only versions of the entrances are missing');
    });

    await check('The tab bar lens settles under the chosen tab', async () => {
        showScreen('app');
        const realFrame = window.requestAnimationFrame;
        // The hidden test window pauses real frames, so frames are simulated
        window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
        tabLens.raf = null;
        try {
            for (const tab of ['progress', 'today', 'settings']) {
                switchTab(tab);
                await new Promise(resolve => setTimeout(resolve, 1400));
                const lens = document.querySelector('.tab-lens').getBoundingClientRect();
                const btn = document.querySelector(`.bottom-nav > .tab-btn[onclick="switchTab('${tab}')"]`).getBoundingClientRect();
                const off = (lens.left + lens.width / 2) - (btn.left + btn.width / 2);
                assert(Math.abs(off) < 2, `lens not centred under ${tab}: ${off.toFixed(1)}px off (lens ${lens.left.toFixed(1)}+${lens.width.toFixed(1)}, tab ${btn.left.toFixed(1)}+${btn.width.toFixed(1)}, x ${tabLens.x.toFixed(1)} → ${tabLens.target.toFixed(1)}, lift ${tabLens.lift.toFixed(2)})`);
            }
        } finally {
            window.requestAnimationFrame = realFrame;
            tabLens.raf = null;
        }
    });

    // ── Exercise guide ──
    await check('Every exercise in the app has a guide with a demo', () => {
        const names = new Set();
        Object.values(PROGRAMS).forEach(p => p.exercises.forEach(e => { names.add(e.name); (e.alternates || []).forEach(a => names.add(a)); }));
        Object.values(SWAPS).forEach(list => list.forEach(([name]) => names.add(name)));
        Object.values(GEN_PATTERNS).forEach(list => list.forEach(([name]) => names.add(name)));
        names.forEach(name => {
            const move = guideMove(name);
            assert(move, `no movement for "${name}"`);
            assert(GUIDE_TEXT[move] && GUIDE_DEMOS[move], `"${move}" is missing its text or demo`);
        });
    });

    await check('The guide opens for every exercise of every program', () => {
        Object.keys(PROGRAMS).filter(id => !id.startsWith('custom-')).forEach(id => {
            currentProgram = id;
            PROGRAMS[id].exercises.forEach(e => {
                openGuide(e.id);
                assert(document.querySelector('#guideBody .guide-demo line'), `no demo drawn for ${e.name}`);
                assert(document.querySelectorAll('#guideBody .guide-cues li').length === 3, `cues missing for ${e.name}`);
            });
        });
        currentProgram = 'fullBody3';
        closeGuide();
    });

    // ── Pro waitlist ──
    await check('Joining the Pro waitlist saves one row per user', async () => {
        window.__sbCalls.length = 0;
        userProfile.pro = undefined;
        startPro();
        toggleProInterest('coach');
        setProPrice('8');
        await joinPro();
        const call = window.__sbCalls.find(c => c.table === 'pro_waitlist');
        assert(call, 'pro_waitlist was written');
        equal(call.options && call.options.onConflict, 'user_id', 'conflict column');
        equal(call.row.price, '8', 'price answer');
        assert(call.row.interests.includes('coach'), 'interest answer');
        assert(userProfile.pro && userProfile.pro.joined, 'joined date kept in the profile');
    });

    // ── Opening quotes ──
    await check('Opening quotes: every language has all of them, none too long', () => {
        Object.entries(window.I18N_PACKS || {}).forEach(([code, pack]) => equal(pack.quotes.length, QUOTES.length, `${code} quote count`));
        const words = q => (Array.isArray(q) ? q[0] : q).split(/\s+/).length;
        QUOTES.forEach((q, i) => assert(words(q) <= 15, `English quote ${i} has ${words(q)} words`));
        Object.entries(window.I18N_PACKS || {}).forEach(([code, pack]) =>
            pack.quotes.forEach((q, i) => assert(words(q) <= 15, `${code} quote ${i} has ${words(q)} words`)));
    });

    // ── Language (only when opened with &lang=fr) ──
    if (PACK) {
        await check('Translation: plain text, patterns and values', () => {
            equal(tr('Settings'), 'Réglages', 'exact text');
            equal(tr('3 sets · 47 min'), '3 séries · 47 min', 'pattern with numbers');
            equal(tr('Top 50%'), 'Top 50 %', 'French spacing before %');
        });

        await check('Translation never changes its own output (no loops)', () => {
            Object.keys(PACK.strings).forEach(key => {
                const sample = key.replace(/\{#?\}/g, '7');
                const once = tr(sample);
                equal(tr(once), once, `"${sample}"`);
            });
        });

        await check('Every screen is fully translated', () => {
            I18N.missing.clear();
            ['today', 'tracker', 'steps', 'progress', 'settings'].forEach(t => switchTab(t));
            renderStepsSetup(true);
            openTrophyRoom(); openBadge(badgeTracks()[0].id); closeBadge(); closeTrophyRoom();
            openRecap(); closeRecap(); openScience(); closeScience(); openGenerator(); closeGenerator();
            PROGRAMS.fullBody3.exercises.forEach(e => openGuide(e.id)); closeGuide();
            switchTab('settings'); startPro(); cancelPro();
            return new Promise(resolve => setTimeout(resolve, 50)).then(() => {
                const keep = new Set(['Workout Steps', 'XP', 'bpm', 'Odyr', 'ODYR', 'test@example.com']);
                Object.values(PROGRAMS).forEach(p => keep.add(p.name));
                COACH_SCIENCE.forEach(s => s.refs.forEach(([cite, title]) => { keep.add(cite); keep.add(title); }));
                const left = [...I18N.missing].filter(t => !keep.has(t) && !/\d/.test(t) && !/^([A-Z]|[IVX]+|kg\+?|\+kg|.+:)$/.test(t));
                assert(!left.length, `untranslated: ${left.slice(0, 8).join(' | ')}`);
            });
        });
    }

    // ── Report ──
    const failed = results.filter(r => !r.ok);
    window.__testResults = { passed: results.length - failed.length, failed: failed.length, results };
    document.title = failed.length ? `TESTS FAILED (${failed.length})` : `TESTS PASSED (${results.length})`;
    const panel = document.createElement('div');
    panel.setAttribute('data-no-i18n', '');
    panel.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:9999;max-height:45vh;overflow:auto;padding:12px 14px;border-radius:12px;background:#000;color:#f0e8d8;font:12px/1.5 ui-monospace,monospace;box-shadow:0 10px 40px rgba(0,0,0,.6)';
    panel.innerHTML = `<strong style="color:${failed.length ? '#e8734a' : '#7fd9a8'}">${document.title}</strong>` +
        results.map(r => `<div>${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `<br><span style="color:#e8734a">${r.error.replace(/</g, '&lt;')}</span>`}</div>`).join('');
    document.body.appendChild(panel);
    console.log(document.title, JSON.stringify(failed));
})();
