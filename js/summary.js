// ════════════════════════════════════════════
//  POST-WORKOUT SUMMARY + SHARE CARDS
// ════════════════════════════════════════════

let lastSummary = null;
let summaryOpen = false;

function openSummary(summary) {
    lastSummary = summary;
    renderSummary(summary);
    showScreen('summary');
    document.querySelector('#summaryScreen .workout-body').scrollTop = 0;
}

function closeSummary() {
    haptic();
    summaryOpen = false;
    showScreen('app');
    setTimeout(nextMoment, 450);
}

function summaryDateLine(sm) {
    const day = parseDate(sm.date).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
    return `${day} · Week ${sm.week + 1}`;
}

function renderSummary(sm) {
    const stat = (label, value, unit = '') => `<div class="sum-stat"><span>${label}</span><strong>${value}</strong>${unit ? `<small>${unit}</small>` : ''}</div>`;
    const setsLine = e => {
        const same = e.reps.every(r => r === e.reps[0]);
        const reps = same ? `${e.sets} × ${e.reps[0]}` : e.reps.join(' · ');
        if (e.unit === 'reps') return `${reps} reps`;
        return e.assist ? `${reps} · ${formatNum(+e.top)} ${e.unit}` : `${reps} · top ${formatNum(+e.top)} ${e.unit}`;
    };
    document.getElementById('summaryBody').innerHTML = `
        <div class="sum-hero">
            <div class="th-ring">${levelRingSvg(sm.xp)}
                <div class="th-level"><span>XP</span><strong>+${sm.xpGained.toLocaleString(LOCALE)}</strong></div>
            </div>
            <div class="sum-kicker">Workout complete</div>
            <div class="sum-title">${escapeHtml(sm.day)}</div>
            <p class="th-line">${escapeHtml(summaryDateLine(sm))}</p>
            ${sm.levelUp ? `<div class="sum-level">Level ${sm.xp.level} · ${escapeHtml(sm.xp.rank)}</div>` : ''}
        </div>
        <div class="sum-stats">
            ${stat('Time', sm.minutes, 'min')}
            ${stat('Sets', sm.sets)}
            ${stat('Volume', sm.volume.toLocaleString(LOCALE), sm.units)}
            ${stat('Records', sm.records.length)}
        </div>
        ${sm.records.length ? `
            <div class="section-head"><h3>New records</h3></div>
            <div class="sum-list">
                ${sm.records.map(r => `<div class="sum-row gold"><span>${escapeHtml(r.name)}</span><strong>${formatNum(+r.value)} ${escapeHtml(r.unit)}<small>+${formatNum(Math.round(r.gain * 10) / 10)}</small></strong></div>`).join('')}
            </div>` : ''}
        ${sm.tierUps.length ? `
            <div class="section-head"><h3>New tiers</h3></div>
            <div class="sum-list">
                ${sm.tierUps.map(t => `<div class="sum-row"><span>${escapeHtml(t.name)}</span><strong class="tier-badge" style="color:${TIERS[t.tier].color}">${tierBadgeHtml(t.tier)}</strong></div>`).join('')}
            </div>` : ''}
        <div class="section-head"><h3>Exercises</h3></div>
        <div class="sum-list">
            ${sm.exercises.map(e => `<div class="sum-row"><span>${escapeHtml(e.name)}</span><em>${escapeHtml(setsLine(e))}</em></div>`).join('')}
        </div>
        <div class="sum-actions">
            <button class="btn btn-primary" onclick="shareSummary()">${SHARE_ICON} Share</button>
            <button class="btn" onclick="closeSummary()">Done</button>
        </div>
    `;
}

const SHARE_ICON = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';

function shareSummary() {
    const sm = lastSummary;
    if (!sm) return;
    openShareCard({
        kicker: tr('Workout complete'),
        title: tr(sm.day),
        line: tr(summaryDateLine(sm)),
        stats: [
            [tr('Time'), `${sm.minutes}`, 'min'],
            [tr('Sets'), `${sm.sets}`, ''],
            [tr('Volume'), sm.volume.toLocaleString(LOCALE), sm.units],
            [tr('XP'), `+${sm.xpGained.toLocaleString(LOCALE)}`, ''],
        ],
        rows: sm.records.slice(0, 3).map(r => [tr(r.name), `${formatNum(+r.value)} ${tr(r.unit)}`]),
        rowsTitle: sm.records.length ? tr('New records') : '',
        file: 'odyr-workout',
    });
}

function shareRecap(monday) {
    const d = recapData(monday);
    openShareCard({
        kicker: tr('My week'),
        title: `${d.score}`,
        titleSub: tr('Consistency score'),
        line: d.range,
        stats: [
            [tr('Workouts'), `${d.workouts}/${d.target}`, ''],
            [tr('Cardio'), `${d.cardio}`, 'min'],
            [tr('Steps'), compactNum(d.stepAvg), tr('a day')],
            [tr('XP'), `+${d.xp.toLocaleString(LOCALE)}`, ''],
        ],
        rows: d.records.slice(0, 3).map(r => [tr(r), '']),
        rowsTitle: d.records.length ? tr('New records') : '',
        file: 'odyr-week',
    });
}

// ── Share card: a 1080 × 1920 story image drawn on a canvas, in the app's own type ──
let shareBlob = null;

async function openShareCard(card) {
    haptic();
    const modal = document.getElementById('shareModal');
    const img = document.getElementById('shareImage');
    img.removeAttribute('src');
    modal.classList.add('active');
    try {
        await Promise.all(['400 150px "Bebas Neue"', '200 100px Inter', '600 30px Inter', '400 60px "Instrument Serif"']
            .map(f => document.fonts.load(f).catch(() => null)));
        const canvas = drawShareCard(card);
        shareBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        shareBlob.fileName = `${card.file}.png`;
        img.src = URL.createObjectURL(shareBlob);
    } catch (error) {
        console.warn('Share card failed:', error);
        closeShareCard();
        showToast('Could not create the image');
    }
}

function closeShareCard() {
    document.getElementById('shareModal').classList.remove('active');
}

async function sendShareCard() {
    if (!shareBlob) return;
    haptic();
    const file = new File([shareBlob], shareBlob.fileName || 'odyr.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file] });
        } catch (error) {
            if (error.name !== 'AbortError') showToast('Could not share');
        }
        return;
    }
    // No share sheet (desktop browsers): download the image instead
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = file.name;
    link.click();
}

// Text with letter spacing, drawn one character at a time (canvas letterSpacing isn't everywhere yet)
function spacedText(ctx, text, x, y, spacing, align = 'center') {
    const chars = [...text];
    const width = chars.reduce((w, c) => w + ctx.measureText(c).width, 0) + spacing * (chars.length - 1);
    let cx = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
    ctx.textAlign = 'left';
    chars.forEach(c => {
        ctx.fillText(c, cx, y);
        cx += ctx.measureText(c).width + spacing;
    });
    return width;
}

function fitFont(ctx, text, weightFamily, size, maxWidth, spacing = 0) {
    let s = size;
    do {
        ctx.font = `${weightFamily.replace('{s}', s)}`;
        const w = [...text].reduce((sum, c) => sum + ctx.measureText(c).width, 0) + spacing * s * ([...text].length - 1);
        if (w <= maxWidth) break;
        s -= 4;
    } while (s > 40);
    return s;
}

function drawShareCard(card) {
    const W = 1080, H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const cream = '#f0e8d8', dim = 'rgba(240,232,216,0.62)', muted = 'rgba(240,232,216,0.4)', gold = '#e6b84a';

    ctx.fillStyle = '#13100e';
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, 380, 0, W / 2, 380, 900);
    glow.addColorStop(0, 'rgba(217,178,95,0.20)');
    glow.addColorStop(1, 'rgba(217,178,95,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // The Odyr mark: open gold ring with the traveller point
    const goldGrad = ctx.createLinearGradient(W / 2 - 70, 170, W / 2 + 70, 310);
    goldGrad.addColorStop(0, '#f2d891');
    goldGrad.addColorStop(1, '#b38636');
    ctx.strokeStyle = goldGrad;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(W / 2, 240, 62, -31 * Math.PI / 180, (-31 + 334) * Math.PI / 180);
    ctx.stroke();
    ctx.fillStyle = '#f2d891';
    ctx.beginPath();
    ctx.arc(W / 2 + 62 * Math.cos(-44 * Math.PI / 180), 240 + 62 * Math.sin(-44 * Math.PI / 180), 8, 0, Math.PI * 2);
    ctx.fill();

    // Kicker
    ctx.fillStyle = gold;
    ctx.font = '600 30px Inter, sans-serif';
    spacedText(ctx, card.kicker.toUpperCase(), W / 2, 420, 9);

    // Title: airy display type, shrunk to fit
    ctx.fillStyle = cream;
    const titleSize = fitFont(ctx, card.title.toUpperCase(), '400 {s}px "Bebas Neue", sans-serif', card.titleSub ? 300 : 150, W - 160, 0.16);
    ctx.font = `400 ${titleSize}px "Bebas Neue", sans-serif`;
    let y = card.titleSub ? 760 : 590;
    spacedText(ctx, card.title.toUpperCase(), W / 2, y, titleSize * 0.16);
    if (card.titleSub) {
        ctx.fillStyle = muted;
        ctx.font = '600 28px Inter, sans-serif';
        spacedText(ctx, card.titleSub.toUpperCase(), W / 2, y + 70, 7);
        y += 70;
    }

    // Serif line
    ctx.fillStyle = dim;
    ctx.font = '400 54px "Instrument Serif", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.line, W / 2, y + 100);

    // Stats: two by two, big light numbers
    const top = y + 230;
    card.stats.forEach(([label, value, unit], i) => {
        const cx = i % 2 ? W * 0.72 : W * 0.28;
        const cy = top + Math.floor(i / 2) * 270;
        ctx.fillStyle = muted;
        ctx.font = '600 26px Inter, sans-serif';
        spacedText(ctx, label.toUpperCase(), cx, cy, 6);
        ctx.fillStyle = cream;
        ctx.font = '200 112px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(value, cx, cy + 120);
        if (unit) {
            ctx.fillStyle = dim;
            ctx.font = '400 30px Inter, sans-serif';
            ctx.fillText(unit, cx, cy + 172);
        }
    });

    // Gold hairline, then records
    let ry = top + 590;
    if (card.rows.length) {
        const line = ctx.createLinearGradient(140, 0, W - 140, 0);
        line.addColorStop(0, 'rgba(217,178,95,0)');
        line.addColorStop(0.5, 'rgba(217,178,95,0.6)');
        line.addColorStop(1, 'rgba(217,178,95,0)');
        ctx.fillStyle = line;
        ctx.fillRect(140, ry, W - 280, 2);
        ry += 80;
        ctx.fillStyle = gold;
        ctx.font = '600 26px Inter, sans-serif';
        spacedText(ctx, card.rowsTitle.toUpperCase(), W / 2, ry, 6);
        ry += 30;
        card.rows.forEach(([name, value]) => {
            ry += 72;
            ctx.font = '400 40px Inter, sans-serif';
            ctx.fillStyle = cream;
            ctx.textAlign = value ? 'left' : 'center';
            let label = name;
            while (ctx.measureText(label).width > (value ? 560 : 800) && label.length > 4) label = label.slice(0, -2);
            if (label !== name) label = label.trimEnd() + '…';
            ctx.fillText(label, value ? 160 : W / 2, ry);
            if (value) {
                ctx.textAlign = 'right';
                ctx.fillStyle = gold;
                ctx.fillText(value, W - 160, ry);
            }
        });
    }

    // Signature
    ctx.fillStyle = cream;
    ctx.font = '400 64px "Bebas Neue", sans-serif';
    spacedText(ctx, 'ODYR', W / 2, H - 170, 26);
    ctx.fillStyle = dim;
    ctx.font = '400 40px "Instrument Serif", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(tr('The path to greatness.'), W / 2, H - 105);
    return canvas;
}
