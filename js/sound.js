// ════════════════════════════════════════════
//  SOUND: one small engine for every sound in the app
// ════════════════════════════════════════════

// iPhones only allow web audio after a touch, and pause it whenever the app goes to the background.
// So sound is (re)enabled on every touch; a sound asked for before that (a badge popping up as the app opens)
// plays on the first touch if it is still recent. Sounds mix with the music you're playing and follow the
// silent switch ('ambient' audio session, Safari 16.4+). Settings → Experience → Sounds turns them all off.

let audioCtx = null;
let pendingSound = null;   // { name, at }

if (navigator.audioSession) {
    try { navigator.audioSession.type = 'ambient'; } catch (e) { /* older Safari */ }
}

function soundsOn() {
    try { return localStorage.getItem('odyr_sound_off') !== '1'; } catch (e) { return true; }
}

function setSounds(on) {
    haptic();
    try { localStorage.setItem('odyr_sound_off', on ? '0' : '1'); } catch (e) { /* private mode */ }
    if (on) {
        unlockAudio();
        playSound('tick');
    }
}

function unlockAudio() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state !== 'running') audioCtx.resume().then(playPendingSound, () => {});
        else playPendingSound();
    } catch (e) { /* no audio available */ }
}

function playPendingSound() {
    if (!pendingSound) return;
    const { name, at } = pendingSound;
    pendingSound = null;
    if (Date.now() - at < 4000) playSound(name);
}

// Every touch (re)enables sound; capture phase, so it runs before anything else handles the tap
['pointerdown', 'touchend', 'keydown'].forEach(type =>
    document.addEventListener(type, unlockAudio, { capture: true, passive: true }));

// One note: a soft attack and a long natural decay; `type` and a quiet octave partial give each sound its colour
function soundNote(freq, start, { dur = 0.9, vol = 0.14, type = 'sine', partial = 0 } = {}) {
    const t = audioCtx.currentTime + start;
    const play = (f, v) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(v, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.05);
    };
    play(freq, vol);
    if (partial) play(freq * 2, vol * partial);
}

const SOUNDS = {
    // New personal record: two soft rising notes
    record: () => { soundNote(659.3, 0); soundNote(987.8, 0.14); },
    // Badge tier minted: a bright metallic ring, three notes up with a shimmer
    badge: () => {
        soundNote(783.99, 0, { dur: 1.1, vol: 0.12, type: 'triangle', partial: 0.25 });
        soundNote(1174.66, 0.09, { dur: 1.2, vol: 0.1, type: 'triangle', partial: 0.25 });
        soundNote(1567.98, 0.18, { dur: 1.5, vol: 0.09, type: 'triangle', partial: 0.3 });
    },
    // Level up: a rising arpeggio that settles on a long note
    level: () => {
        [523.25, 659.25, 783.99].forEach((f, i) => soundNote(f, i * 0.1, { dur: 0.7, vol: 0.12 }));
        soundNote(1046.5, 0.3, { dur: 1.6, vol: 0.13, partial: 0.2 });
    },
    // New strength tier: a two-chord fanfare
    tier: () => {
        [392, 587.33].forEach(f => soundNote(f, 0, { dur: 0.5, vol: 0.1, type: 'triangle' }));
        [523.25, 783.99, 1046.5].forEach(f => soundNote(f, 0.22, { dur: 1.4, vol: 0.1, type: 'triangle', partial: 0.15 }));
    },
    // Workout complete: a warm chord that blooms, with a light sparkle on top
    complete: () => {
        [261.63, 329.63, 392].forEach((f, i) => soundNote(f, i * 0.04, { dur: 1.8, vol: 0.09 }));
        soundNote(1046.5, 0.25, { dur: 1.2, vol: 0.06, type: 'triangle' });
    },
    // Rest over: three clear pips
    rest: () => [0, 0.25, 0.5].forEach(o => soundNote(880, o, { dur: 0.2, vol: 0.22, type: 'triangle' })),
    // Last seconds of rest: a quiet tick
    tick: () => soundNote(1320, 0, { dur: 0.08, vol: 0.05 }),
};

function playSound(name) {
    if (!soundsOn() || !SOUNDS[name]) return;
    if (!audioCtx || audioCtx.state !== 'running') {
        // Not allowed yet (no touch since the app opened or came back): play it on the first touch
        pendingSound = { name, at: Date.now() };
        return;
    }
    try { SOUNDS[name](); } catch (e) { /* audio unavailable */ }
}

// The names used before this engine existed
function chime() { playSound('record'); }
function beep() { playSound('rest'); }
