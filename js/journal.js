// ════════════════════════════════════════════
//  ODYR'S JOURNAL: a short entry in Odyr's own voice for every landmark on the journey (written for the app).
//  Reaching a landmark unlocks its page; pages appear line by line and can be read aloud by the phone's own voice.
//  Pages read are kept in workout_data._journalRead ([landmark indexes]).
// ════════════════════════════════════════════

const JOURNAL = [
    'Day one. I leave the fire burning so I have something to walk back to. Freyja says I was born with the road in my legs. Maybe. All I know is that standing still had started to feel like sinking. I counted my first steps out loud like a child, and somewhere around forty I stopped counting and started walking. That is how every journey begins, I think. You stop counting.',
    'The trees here wear ice like armour, and my breath freezes before it leaves me. This morning the cold had a voice, and it was very reasonable. I got up anyway. By noon my hands remembered how to work. Nobody will ever know about this morning but me. I think those are the mornings that count the most.',
    'The road narrows to a ledge: rock on one side, nothing on the other. A merchant coming down told me to turn back, that the pass breaks people. I asked him what it breaks. He didn’t answer. Halfway up, my legs burned and my grip shook, and I understood. It breaks the idea that you will be comfortable. Everything else holds.',
    'The water is so still that I saw myself for the first time in weeks. A leaner face. Steadier eyes. For a moment I didn’t recognise the man looking back, and then I did, completely, as if he had been waiting under the surface all along. I skipped a stone and broke him into rings. He came back together. So do I.',
    'A smith let me sleep by her forge in exchange for working the bellows. I watched her heat the same bar and strike it, heat it and strike it, for hours. I asked if it ever bored her. She laughed. “Iron doesn’t learn from the big blow,” she said. “It learns from the thousandth.” I worked the bellows until dawn.',
    'Halfway. On the ridge stands a tower, and in it a woman in grey who watches the road. She asked me nothing, only watched me walk. When I asked what she was looking for, she said: “Not strength. Everyone arrives here strong or not at all. I watch how they carry what they have.” I walked the next ten miles with my back straight.',
    'The storm hit at midday: rain sideways, a wind that wanted me off the road. I wanted to stop. I slowed down instead. Smaller steps, head down, one stone and then the next. A steady pace is a promise you make to yourself when you can’t see the end. By nightfall the sky had cleared, and I was further than I had planned.',
    'Wolves in the hollow last night, a whole pack running the ridge under the moon. They never came close. I watched them go, together and effortless, and for a moment I wished I had a pack of my own. Then I thought of the fire at the Hearth, of Freyja, of everyone who ever told me to go on. I do. I just run at my own pace.',
    'The bridge is longer than it looks and older than anyone remembers. From the middle you can see neither end, only fog, and planks, and your own feet. There is nothing to do on a bridge like this but cross it. I stopped trying to see the far side. One plank, then one more. That is all a long bridge ever asks of you.',
    'Every sound in this hall comes back to you. I said my name and heard it a hundred times, each from a different day: the cold morning in Frostwood, the burning ledge, the storm. Every step I have taken was still here, answering me. Nothing you do on the road is wasted. It waits for you, further on.',
    'The gate is open. I thought I would feel finished. I don’t. Beyond it the road goes on, brighter and steeper, and I find that I am glad. Somewhere behind me Freyja is searching, and they say her tears turn to gold. I will leave a mark at every gate, so she knows I passed this way stronger than I left. Then I walk on.',
];

// Pages unlocked so far: one per landmark reached (all of them once a saga is complete)
function journalUnlocked() {
    const j = journey();
    return j.saga > 1 ? JOURNAL.length : Math.min(JOURNAL.length, j.stop + 1);
}

function journalRead() {
    return new Set(allData._journalRead || []);
}

function journalUnreadCount() {
    const read = journalRead();
    let n = 0;
    for (let i = 0; i < journalUnlocked(); i++) if (!read.has(i)) n++;
    return n;
}

// The journal on the journey screen: every page, unlocked or sealed
function journalListHtml() {
    const unlocked = journalUnlocked();
    const read = journalRead();
    return `
        <div class="section-head"><h3>Odyr’s journal</h3><span>${unlocked} of ${JOURNAL.length} pages</span></div>
        <div class="journal-list">
            ${JOURNAL.map((text, i) => i < unlocked ? `
                <button class="journal-page${read.has(i) ? '' : ' new'}" onclick="openJournal(${i})">
                    <span class="jp-num">${ROMAN_SAGA[i + 1] || i + 1}</span>
                    <span class="jp-text"><strong>${escapeHtml(LANDMARKS[i][0])}</strong><small data-no-i18n>${escapeHtml(tr(text).split(/(?<=[.!?”»])\s+/)[0])}</small></span>
                    ${read.has(i) ? '' : '<span class="jp-dot" aria-label="New"></span>'}
                </button>` : `
                <div class="journal-page sealed">
                    <span class="jp-num">${ROMAN_SAGA[i + 1] || i + 1}</span>
                    <span class="jp-text"><strong>Sealed</strong><small>Reach ${escapeHtml(LANDMARKS[i][0])} to read this page</small></span>
                </div>`).join('')}
        </div>`;
}

// ── Reading a page: the text appears sentence by sentence, like ink drying ──
let journalPage = null;

function openJournal(i) {
    haptic();
    journalPage = i;
    const text = tr(JOURNAL[i]);
    const sentences = text.split(/(?<=[.!?”»])\s+/);
    document.getElementById('journalBody').innerHTML = `
        <div class="journal-kicker">Odyr’s journal · ${escapeHtml(sagaName(1))}</div>
        <h2 class="journal-title">${escapeHtml(LANDMARKS[i][0])}</h2>
        <p class="journal-text" data-no-i18n>${sentences.map((s, n) => `<span style="--n:${n}">${escapeHtml(s)}</span>`).join(' ')}</p>`;
    document.getElementById('journalListen').textContent = tr('Listen');
    document.getElementById('journalModal').classList.add('active');
    const read = journalRead();
    if (!read.has(i)) {
        read.add(i);
        allData._journalRead = [...read].sort((a, b) => a - b);
        scheduleSave();
    }
}

function closeJournal() {
    stopNarration();
    document.getElementById('journalModal').classList.remove('active');
    journalPage = null;
    if (document.getElementById('odysseyScreen').classList.contains('active')) renderOdyssey();
    if (document.getElementById('sagaCard')) renderSagaCard();
}

// ── The narrator: the phone's own voice (free, offline), in the app's language ──
function narrationVoice() {
    const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    const lang = LOCALE.slice(0, 2);
    return voices.find(v => v.lang.startsWith(lang) && /Daniel|Thomas|Arthur|male/i.test(v.name))
        || voices.find(v => v.lang.replace('_', '-').startsWith(LOCALE))
        || voices.find(v => v.lang.startsWith(lang)) || null;
}

function toggleNarration() {
    haptic();
    if (!window.speechSynthesis) return showToast('Your phone can’t read aloud here');
    if (speechSynthesis.speaking) return stopNarration();
    const utterance = new SpeechSynthesisUtterance(tr(JOURNAL[journalPage]));
    utterance.lang = LOCALE;
    const voice = narrationVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 0.9;
    utterance.pitch = 0.9;
    utterance.onend = () => { document.getElementById('journalListen').textContent = tr('Listen'); };
    speechSynthesis.speak(utterance);
    document.getElementById('journalListen').textContent = tr('Stop');
}

function stopNarration() {
    if (window.speechSynthesis) speechSynthesis.cancel();
    const btn = document.getElementById('journalListen');
    if (btn) btn.textContent = tr('Listen');
}
