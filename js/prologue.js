// ── Prologue: the story of Odyr (v1.95, refined v1.96) ──
// Four short panels shown once, right after a new account is created (before "About you"), and on demand
// from the sign-in screen ("The story of Odyr") and Settings → Help. Tap anywhere to continue, Skip any time.
// Listen reads each panel aloud with the phone's own voice (the journal's narrator) and turns the page itself.
// Panels 1–2 follow the Norse sources (Óðr, Freyja's far-travelling husband who could not stay still; Freyja
// weeps tears of red gold for him). Panels 3–4 are Odyr's own framing, not a claim about the myths.

const PROLOGUE = [
    { art: 'mark', text: 'Before there were roads, there were wanderers. The old Norse sang of one: Óðr, who could never stay still.' },
    { art: 'tears', text: 'He left the hearth and the woman he loved, and walked where no map reached. Freyja wept, and every tear fell to earth as gold.' },
    { art: 'road', text: 'He never found the end of the road. He found something better: who he became by walking it.' },
    { art: 'dawn', text: 'This is Odyr. Your road begins here, and every step you take is yours to keep.' },
];
let prologueStep = 0;
let prologueDone = null;
let prologueListening = false;
let prologueTurn = null;

function prologueKey() {
    return `odyr_prologue_${currentUser ? currentUser.id : ''}`;
}

function prologueSeen() {
    try { return !!localStorage.getItem(prologueKey()); } catch (e) { return true; }
}

function markPrologueSeen() {
    try { localStorage.setItem(prologueKey(), '1'); } catch (e) { /* private mode */ }
}

const PL_ROAD = 'M8 112 C46 108 44 80 78 74 S112 50 132 40 S160 22 176 14';

function prologueArt(kind) {
    if (kind === 'tears') {
        // A hearth's ember breathing, three tears of gold falling and rippling where they land
        return `<svg class="pl-art pl-tears" viewBox="0 0 140 140" aria-hidden="true">
            <ellipse class="pl-glow" cx="70" cy="112" rx="46" ry="14"/>
            <path class="pl-flame" d="M70 84 C58 98 60 112 70 114 C80 112 82 98 70 84 Z"/>
            <path class="pl-flame inner" d="M70 96 C64 104 65 112 70 113 C75 112 76 104 70 96 Z"/>
            ${[44, 70, 96].map((x, i) => `
                <path class="pl-tear" style="--i:${i}" d="M${x} 14 q-5.5 11 0 15 q5.5 -4 0 -15z"/>
                <ellipse class="pl-ripple" style="--i:${i}" cx="${x}" cy="112" rx="9" ry="2.2"/>`).join('')}
        </svg>`;
    }
    if (kind === 'road') {
        // A far horizon of mountains, the road winding into it and the traveller walking with a gold trail
        return `<svg class="pl-art pl-road" viewBox="0 0 184 124" aria-hidden="true">
            <path class="pl-ridge far" d="M0 52 L22 38 L38 46 L60 26 L82 44 L104 30 L126 42 L150 22 L184 40"/>
            <path class="pl-ridge" d="M0 70 L30 56 L52 64 L78 50 L104 62 L132 48 L160 60 L184 52"/>
            <path class="pl-path" d="${PL_ROAD}"/>
            <path class="pl-trail" d="${PL_ROAD}" pathLength="100"/>
            <circle class="pl-traveller-glow" r="9"><animateMotion dur="4.2s" begin="0.5s" fill="freeze" keyPoints="0;0.66" keyTimes="0;1" calcMode="spline" keySplines=".4 0 .2 1" path="${PL_ROAD}"/></circle>
            <circle class="pl-traveller" r="4.2"><animateMotion dur="4.2s" begin="0.5s" fill="freeze" keyPoints="0;0.66" keyTimes="0;1" calcMode="spline" keySplines=".4 0 .2 1" path="${PL_ROAD}"/></circle>
        </svg>`;
    }
    if (kind === 'dawn') {
        // The mark over a rising sun: the traveller at the ring's opening, ready to leave
        return `<svg class="pl-art pl-dawn" viewBox="0 0 140 140" aria-hidden="true">
            <circle class="pl-sun" cx="70" cy="74" r="44"/>
            <line class="pl-horizon" x1="6" y1="104" x2="134" y2="104"/>
            <g transform="translate(20 20)">
                <path class="pl-ring" d="M68.6 21.6 A34 34 0 1 0 78.6 32.8" pathLength="100"/>
                <circle class="pl-dot" cx="75.5" cy="25.8" r="4.2"/>
            </g>
        </svg>`;
    }
    // The mark draws itself inside a slowly turning gold reticle
    return `<svg class="pl-art pl-mark" viewBox="0 0 140 140" aria-hidden="true">
        <g class="pl-reticle"><circle cx="70" cy="70" r="62"/><circle class="fine" cx="70" cy="70" r="54"/></g>
        <g transform="translate(20 20)">
            <path class="pl-ring" d="M68.6 21.6 A34 34 0 1 0 78.6 32.8" pathLength="100"/>
            <circle class="pl-dot" cx="75.5" cy="25.8" r="4.2"/>
        </g>
    </svg>`;
}

// Words rise one by one, like the opening quote; translated first so the split words never get re-translated
function prologueWords(text) {
    return escapeHtml(tr(text)).split(/\s+/).map((w, i) => `<span class="w" style="--i:${i}">${w}</span>`).join(' ');
}

function renderPrologue() {
    const panel = PROLOGUE[prologueStep];
    const last = prologueStep === PROLOGUE.length - 1;
    const body = document.getElementById('prologueBody');
    body.querySelectorAll('.pl-panel.leaving').forEach(el => el.remove());   // quick taps: drop panels still fading
    const old = body.querySelector('.pl-panel');
    const html = `
        <div class="pl-panel" data-no-i18n>
            ${prologueArt(panel.art)}
            <p class="pl-text">${prologueWords(panel.text)}</p>
        </div>`;
    if (old) {
        // Cross-fade: the old panel drifts away while the new one arrives
        old.classList.add('leaving');
        old.addEventListener('animationend', e => { if (e.target === old) old.remove(); });
        setTimeout(() => old.remove(), 700);
        body.insertAdjacentHTML('beforeend', html);
    } else {
        body.innerHTML = html;
    }
    document.getElementById('prologueDots').innerHTML = PROLOGUE.map((_, i) => `<i class="${i === prologueStep ? 'on' : ''}"></i>`).join('');
    document.getElementById('prologueBegin').hidden = !last;
    document.getElementById('prologueHint').hidden = last || prologueListening;
    document.getElementById('prologueSkip').hidden = last;
    document.getElementById('prologueListen').textContent = tr(prologueListening ? 'Stop' : 'Listen');
    if (prologueListening) speakPrologue();
}

function showPrologue(onDone) {
    prologueStep = 0;
    prologueDone = onDone;
    prologueListening = false;
    document.getElementById('prologueBody').innerHTML = '';
    renderPrologue();
    showScreen('prologue');
}

function prologueNext(event) {
    if (event && event.target.closest('button')) return;
    if (prologueStep >= PROLOGUE.length - 1) return;
    haptic();
    clearTimeout(prologueTurn);
    prologueStep++;
    renderPrologue();
}

// ── Listen: the journal's narrator reads each panel, then turns the page ──
function togglePrologueVoice() {
    haptic();
    if (!window.speechSynthesis) return showToast('Your phone can’t read aloud here');
    prologueListening = !prologueListening;
    if (!prologueListening) stopPrologueVoice();
    renderPrologueControls();
    if (prologueListening) speakPrologue();
}

function renderPrologueControls() {
    document.getElementById('prologueListen').textContent = tr(prologueListening ? 'Stop' : 'Listen');
    document.getElementById('prologueListen').classList.toggle('on', prologueListening);
    document.getElementById('prologueHint').hidden = prologueStep === PROLOGUE.length - 1 || prologueListening;
}

function speakPrologue() {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    clearTimeout(prologueTurn);
    const step = prologueStep;
    const utterance = new SpeechSynthesisUtterance(tr(PROLOGUE[step].text));
    utterance.lang = speechLocale();
    const voice = narrationVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 0.88;
    utterance.pitch = narrationPitch();
    utterance.onend = () => {
        if (!prologueListening || prologueStep !== step) return;
        if (step < PROLOGUE.length - 1) {
            prologueTurn = setTimeout(() => {
                if (!prologueListening || prologueStep !== step) return;
                prologueStep++;
                renderPrologue();
            }, 1100);
        } else {
            prologueListening = false;
            renderPrologueControls();
        }
    };
    // Let the words start rising before the voice begins
    prologueTurn = setTimeout(() => speechSynthesis.speak(utterance), 500);
}

function stopPrologueVoice() {
    clearTimeout(prologueTurn);
    if (window.speechSynthesis) speechSynthesis.cancel();
}

function finishPrologue() {
    prologueListening = false;
    stopPrologueVoice();
    markPrologueSeen();
    const done = prologueDone;
    prologueDone = null;
    if (done) done();
}
