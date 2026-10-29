// ════════════════════════════════════════════
//  TAB BAR LENS: a glass pill that lifts, glides on a spring, stretches with its speed,
//  magnifies the icons it passes over, and settles under the chosen tab. You can also drag it.
// ════════════════════════════════════════════

const tabLens = { x: 0, w: 0, target: 0, v: 0, lift: 0, liftTarget: 0, raf: null, ready: false, drag: null };

function tabBar() {
    return document.querySelector('.bottom-nav');
}

function tabButtons() {
    return [...document.querySelectorAll('.bottom-nav > .tab-btn')];
}

// Builds the lens once: a pill holding a copy of the tab row, which is what appears magnified inside it
function initTabLens() {
    const nav = tabBar();
    if (!nav || nav.querySelector('.tab-lens')) return;
    const lens = document.createElement('div');
    lens.className = 'tab-lens';
    lens.setAttribute('aria-hidden', 'true');
    const row = document.createElement('div');
    row.className = 'tab-lens-row';
    tabButtons().forEach(btn => {
        const copy = btn.cloneNode(true);
        copy.removeAttribute('onclick');
        copy.tabIndex = -1;
        row.appendChild(copy);
    });
    lens.appendChild(row);
    nav.prepend(lens);

    nav.addEventListener('pointerdown', lensPointerDown);
    nav.addEventListener('pointermove', lensPointerMove);
    nav.addEventListener('pointerup', lensPointerUp);
    nav.addEventListener('pointercancel', lensPointerUp);
    // Re-aim whenever the bar changes size (rotation, scrollbars appearing, font loading)
    if (window.ResizeObserver) new ResizeObserver(retargetTabLens).observe(nav);
    else window.addEventListener('resize', retargetTabLens);
    placeTabLens(true);
}

// Where the lens sits under a tab (nav coordinates)
function tabSlot(index) {
    const nav = tabBar();
    const btn = tabButtons()[index];
    if (!nav || !btn) return null;
    const inset = 2;
    // Layout positions, which the bar's squeeze (a transform) doesn't change; a hidden bar has no size
    if (btn.offsetWidth <= inset * 2) return null;
    return { x: btn.offsetLeft + inset, w: btn.offsetWidth - inset * 2 };
}

function activeTabIndex() {
    return Math.max(0, tabButtons().findIndex(b => b.classList.contains('active')));
}

// Called by switchTab/showTab: glide to the tab (or jump there when the bar isn't visible)
function tabLensTo(tab) {
    const index = tabButtons().findIndex(b => b.getAttribute('onclick') === `switchTab('${tab}')`);
    if (index < 0) return;
    document.querySelectorAll('.tab-lens-row .tab-btn').forEach((b, i) => b.classList.toggle('active', i === index));
    const slot = tabSlot(index);
    if (!slot || !slot.w) return;
    // (a fixed bar has no offsetParent, so visibility is checked by its width)
    if (!tabLens.ready || prefersReducedMotion() || !tabBar().offsetWidth) {
        placeTabLens(true, index);
        return;
    }
    tabLens.target = slot.x;
    tabLens.w = slot.w;
    tabLens.liftTarget = 1;
    runTabLens();
}

function retargetTabLens() {
    if (tabLens.drag) return;
    const slot = tabSlot(activeTabIndex());
    if (!slot || !slot.w) return;
    tabLens.target = slot.x;
    tabLens.w = slot.w;
    if (!tabLens.raf) {
        tabLens.x = slot.x;
        tabLens.ready = true;
        renderTabLens(0);
    }
}

function placeTabLens(instant, index = activeTabIndex()) {
    const slot = tabSlot(index);
    if (!slot || !slot.w) return;
    tabLens.x = tabLens.target = slot.x;
    tabLens.w = slot.w;
    tabLens.v = 0;
    tabLens.ready = true;
    if (instant) {
        tabLens.lift = tabLens.liftTarget = 0;
        renderTabLens(0);
    }
}

// A spring with a little overshoot; the stretch comes from the lens's speed
function runTabLens() {
    if (tabLens.raf) return;
    // Only one loop ever runs: an older loop stops as soon as a newer one starts
    const loop = tabLens.loop = (tabLens.loop || 0) + 1;
    let last = performance.now();
    const step = now => {
        if (loop !== tabLens.loop) return;
        const dt = Math.min(0.034, (now - last) / 1000);
        last = now;
        if (!tabLens.drag) {
            const force = 640 * (tabLens.target - tabLens.x) - 40 * tabLens.v;
            tabLens.v += force * dt;
            tabLens.x += tabLens.v * dt;
        }
        const resting = !tabLens.drag && Math.abs(tabLens.target - tabLens.x) < 0.3 && Math.abs(tabLens.v) < 8;
        if (resting) tabLens.liftTarget = 0;
        tabLens.lift += (tabLens.liftTarget - tabLens.lift) * Math.min(1, dt * (tabLens.liftTarget ? 22 : 14));
        renderTabLens(tabLens.drag ? tabLens.drag.v : tabLens.v);
        if (resting && tabLens.lift < 0.01) {
            tabLens.x = tabLens.target;
            tabLens.lift = 0;
            renderTabLens(0);
            tabLens.raf = null;
            return;
        }
        tabLens.raf = requestAnimationFrame(step);
    };
    tabLens.raf = requestAnimationFrame(step);
}

function renderTabLens(velocity) {
    const nav = tabBar();
    const lens = nav && nav.querySelector('.tab-lens');
    if (!lens) return;
    const lift = tabLens.lift;
    const stretch = Math.min(0.22, Math.abs(velocity) / 3200);
    const sx = 1 + lift * 0.1 + stretch;
    const sy = 1 + lift * 0.1 - stretch * 0.45;
    lens.style.width = `${tabLens.w}px`;
    lens.style.transform = `translateX(${tabLens.x}px) scale(${sx}, ${sy})`;
    lens.style.setProperty('--lift', lift.toFixed(3));
    lens.classList.toggle('lifted', lift > 0.02);
    // The copied row stays aligned with the real one, magnified around the lens centre while lifted
    const row = lens.firstChild;
    const cx = tabLens.x + tabLens.w / 2;
    const zoom = 1 + lift * 0.16;
    row.style.width = `${nav.clientWidth}px`;
    row.style.transformOrigin = `${cx}px 50%`;
    row.style.transform = `translateX(${-tabLens.x}px) scale(${1 / sx}, ${1 / sy}) scale(${zoom})`;
    nav.style.transform = lift > 0.02 ? `scale(${1 - lift * 0.012})` : '';
}

// ── Dragging the lens along the bar, like iOS 26 ──
function lensPointerDown(e) {
    if (prefersReducedMotion() || !tabLens.ready) return;
    const n = tabBar().getBoundingClientRect();
    tabLens.drag = { startX: e.clientX, origin: tabLens.x, moved: false, v: 0, lastX: e.clientX, lastT: performance.now(), left: n.left };
    tabLens.liftTarget = 1;
    runTabLens();
}

function lensPointerMove(e) {
    const d = tabLens.drag;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < 8) return;
    if (!d.moved) {
        d.moved = true;
        // Start from the pressed tab when the finger isn't on the lens
        const under = tabButtons().findIndex(b => { const r = b.getBoundingClientRect(); return d.startX >= r.left && d.startX <= r.right; });
        if (under !== activeTabIndex()) d.origin = tabLens.x;
        tabBar().setPointerCapture(e.pointerId);
    }
    const now = performance.now();
    d.v = (e.clientX - d.lastX) / Math.max(0.008, (now - d.lastT) / 1000);
    d.lastX = e.clientX;
    d.lastT = now;
    const first = tabSlot(0);
    const last = tabSlot(tabButtons().length - 1);
    tabLens.x = Math.max(first.x - 6, Math.min(last.x + 6, e.clientX - d.left - tabLens.w / 2));
}

function lensPointerUp(e) {
    const d = tabLens.drag;
    tabLens.drag = null;
    if (!d) return;
    if (!d.moved) {
        // A plain tap: the button's own onclick switches the tab and moves the lens
        if (!e.target.closest('.tab-btn')) tabLens.liftTarget = 0;
        runTabLens();
        return;
    }
    // Released after a drag: land on the nearest tab
    const centre = tabLens.x + tabLens.w / 2;
    let best = 0;
    tabButtons().forEach((b, i) => {
        const s = tabSlot(i);
        if (Math.abs(s.x + s.w / 2 - centre) < Math.abs(tabSlot(best).x + tabSlot(best).w / 2 - centre)) best = i;
    });
    tabLens.v = d.v * 0.35;
    const tab = (tabButtons()[best].getAttribute('onclick').match(/switchTab\('(\w+)'\)/) || [])[1];
    if (tab && best !== activeTabIndex()) switchTab(tab);
    else tabLensTo(tab);
}
