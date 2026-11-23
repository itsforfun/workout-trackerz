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

// The thread that pulls you to the next landmark: the last line of each page (someone is walking ahead of Odyr)
const JOURNAL_HOOKS = [
    "At the edge of the firelight I found fresh footprints heading north. Someone left just before me.",
    "The prints go on through the snow. Whoever it is, they are not resting either.",
    "At the top, a cold campfire and a strip of grey cloth. I am only a day behind now.",
    "Beside my reflection, for one breath, I saw a second face. When I turned, nobody.",
    "The smith went quiet when I described the prints. “You are not the first to follow them,” she said.",
    "As I left, she called after me: “The one ahead of you stopped at Stormreach. Hurry.”",
    "At dawn, new prints circled my camp. Whoever I am following has started following me.",
    "The wolves were not hunting. They were running from something beyond the bridge.",
    "On the last plank someone had carved one word, the cuts still fresh: “Closer.”",
    "Among the echoes, one voice was not mine. It said my name and laughed.",
    "Beyond the gate, the prints end. In their place lies a single gold tear, still warm.",
];

// Rest-Fire Tales: fireside stories of the place you are in, one new line per workout, readable only while
// resting between sets. Four per stretch of road; `_tales` {"saga-stop": lines seen}.
const REST_TALES = [
    ["They say this fire was lit by the first traveller, who swore it would never go out.", "Every wanderer adds one log before leaving. Nobody remembers a day it burned low.", "An old woman here counts those who leave. None, she says, ever come back the same.", "Add your log, she tells you. The road is easier when something waits behind you."],
    ["In Frostwood, the trees keep the shape of the wind that bent them a hundred winters ago.", "Hunters here sleep with their boots on. Those who take them off don’t get up early.", "A stream runs under the ice. Put your ear to it and you can hear it still moving.", "Nothing stops in Frostwood. It only slows down and waits for spring."],
    ["Miners cut Iron Pass by hand, one hammer blow at a time, for forty years.", "Each one left a nail in the rock. Climbers still hold on to them today.", "A goat lives on the ledge. It has watched more people turn back than any innkeeper.", "At the summit stands a cairn. Everyone who makes it adds a stone, however small."],
    ["Fishers on Mirror Fjord row at dawn, before the wind can break the water.", "They say the fjord shows you as you will be, not as you are. Few look for long.", "A boy once threw his sword in to see how deep it went. It is still falling.", "The water here tastes of iron. The locals say that is why they live so long."],
    ["The forge has not gone cold in three hundred years. Four families share the bellows.", "Apprentices spend their first year only sweeping. The second, only carrying coal.", "The finest blade here took nine years. The smith says eight of them were patience.", "Nobody buys a sword at Ember Forge. You work for it, or you leave without one."],
    ["The tower has no door on the road side. Those inside choose whom they come down to meet.", "Soldiers pass below it with straighter backs, though no one has ever seen a face above.", "Legend says the Valkyries keep a list of those who kept walking when nobody could see.", "Nobody knows if their name is on it. Most walk as though it might be."],
    ["Sailors call it Stormreach because no ship has ever left on the day it planned to.", "The houses here are built low and roped to the rock, like boats that never sail.", "Locals never ask if a storm is coming. They ask how long you can keep going in it.", "After the worst gale they ring one bell. It means: all still here, back to work."],
    ["Shepherds leave Wolf Hollow at dusk. The wolves have the night, and everyone respects it.", "Here, they say, the oldest wolf walks last, so that no one in the pack is left behind.", "On still nights they howl one by one, each checking the others are still there.", "A pack, the shepherds say, is whoever notices when you stop."],
    ["No one knows who built the Long Bridge. Every village swears it was their grandfather.", "Each plank carries a name. Whoever replaces a rotten one carves their own.", "A ferryman once offered a way around it. He went broke. People prefer to cross.", "Halfway over, tradition says you stop, look back once, and never again."],
    ["The Hall of Echoes was once a king’s treasury. All it holds now is sound.", "Whisper a promise here and it comes back for days. Liars don’t stay the night.", "Old warriors visit to hear their own names. The echo remembers them younger.", "Sing here with a friend and the hall makes you a choir of hundreds."],
];

// The line for this workout: chosen at its first rest and kept for all of them (also after a resume)
function restTale() {
    if (!activeWorkout) return '';
    if (activeWorkout.tale === undefined) {
        const j = journey();
        const key = `${j.saga}-${j.stop}`;
        const seen = (allData._tales && allData._tales[key]) || 0;
        const tales = sagaWorld(j.saga).tales[j.stop];
        const text = tales && tales[seen];
        activeWorkout.tale = text || null;
        if (text) {
            allData._tales = { ...(allData._tales || {}), [key]: seen + 1 };
            scheduleSave();
        }
        persistActiveWorkout();
    }
    return activeWorkout.tale || '';
}

// Pages have one id across the three worlds: world × 11 + page
const PAGES_PER_SAGA = 11;
let journalView = null;   // the saga shown in the list (null: the one you're on)

function latestWorld() {
    return Math.min(2, journey().saga - 1);
}

// Pages unlocked in a world: one per landmark reached, all of them once that saga is complete
function journalUnlocked(world = latestWorld()) {
    const j = journey();
    if (j.saga > world + 1) return PAGES_PER_SAGA;
    return j.saga === world + 1 ? Math.min(PAGES_PER_SAGA, j.stop + 1) : 0;
}

function journalRead() {
    return new Set(allData._journalRead || []);
}

function journalUnreadCount() {
    const read = journalRead();
    let n = 0;
    for (let w = 0; w <= latestWorld(); w++) {
        for (let i = 0; i < journalUnlocked(w); i++) if (!read.has(w * PAGES_PER_SAGA + i)) n++;
    }
    return n;
}

function setJournalView(world) {
    haptic();
    journalView = world;
    const el = document.getElementById('journalList');
    if (el) el.outerHTML = journalListHtml();
}

// The journal on the journey screen: every page, unlocked or sealed, one saga at a time
function journalListHtml() {
    const latest = latestWorld();
    const w = journalView === null ? latest : Math.min(journalView, latest);
    const world = sagaWorld(w + 1);
    const unlocked = journalUnlocked(w);
    const read = journalRead();
    return `
        <div id="journalList">
        <div class="section-head"><h3>Odyr’s journal</h3><span>${unlocked} of ${world.pages.length} pages</span></div>
        ${latest ? `<div class="journal-sagas">${Array.from({ length: latest + 1 }, (_, n) => `<button class="${n === w ? 'on' : ''}" onclick="setJournalView(${n})">${escapeHtml(sagaName(n + 1))}</button>`).join('')}</div>` : ''}
        <div class="journal-list">
            ${world.pages.map((text, i) => {
                const id = w * PAGES_PER_SAGA + i;
                return i < unlocked ? `
                <button class="journal-page${read.has(id) ? '' : ' new'}" onclick="openJournal(${id})">
                    <span class="jp-num">${ROMAN_SAGA[i + 1] || i + 1}</span>
                    <span class="jp-text"><strong>${escapeHtml(world.landmarks[i][0])}</strong><small data-no-i18n>${escapeHtml(tr(text).split(/(?<=[.!?”»])\s+/)[0])}</small></span>
                    ${read.has(id) ? '' : '<span class="jp-dot" aria-label="New"></span>'}
                </button>` : `
                <div class="journal-page sealed">
                    <span class="jp-num">${ROMAN_SAGA[i + 1] || i + 1}</span>
                    <span class="jp-text"><strong>Sealed</strong><small>Reach ${escapeHtml(world.landmarks[i][0])} to read this page</small></span>
                </div>`;
            }).join('')}
        </div>
        </div>`;
}

// ── Reading a page: the text appears sentence by sentence, like ink drying ──
let journalPage = null;

function pageParts(id) {
    const w = Math.floor(id / PAGES_PER_SAGA);
    const i = id % PAGES_PER_SAGA;
    const world = sagaWorld(w + 1);
    return { w, i, world, text: world.pages[i], hook: world.hooks[i] };
}

function openJournal(id) {
    haptic();
    journalPage = id;
    const { w, i, world, text: page, hook } = pageParts(id);
    const text = tr(page);
    const sentences = text.split(/(?<=[.!?”»])\s+/);
    document.getElementById('journalBody').innerHTML = `
        <div class="journal-kicker">Odyr’s journal · ${escapeHtml(sagaName(w + 1))}</div>
        <h2 class="journal-title">${escapeHtml(world.landmarks[i][0])}</h2>
        <p class="journal-text" data-no-i18n>${sentences.map((s, n) => `<span style="--n:${n}">${escapeHtml(s)}</span>`).join(' ')}</p>
        <p class="journal-hook" style="--n:${sentences.length}" data-no-i18n>${escapeHtml(tr(hook))}</p>
        ${journalNextHtml(w, i)}`;
    document.getElementById('journalListen').textContent = tr('Listen');
    document.getElementById('journalModal').classList.add('active');
    const read = journalRead();
    if (!read.has(id)) {
        read.add(id);
        allData._journalRead = [...read].sort((a, b) => a - b);
        scheduleSave();
    }
}

// Under the newest page: how far the next one is
function journalNextHtml(w, i) {
    const j = journey();
    return j.saga === w + 1 && i === j.stop ? `<p class="journal-next">${j.toNext.toLocaleString(LOCALE)} ${j.toNext === 1 ? 'league' : 'leagues'} to ${escapeHtml(tr(sagaWorld(j.saga).landmarks[j.next][0]))}</p>` : '';
}

function closeJournal() {
    stopNarration();
    document.getElementById('journalModal').classList.remove('active');
    journalPage = null;
    if (document.getElementById('odysseyScreen').classList.contains('active')) renderOdyssey();
    if (document.getElementById('sagaCard')) renderSagaCard();
}

// ── The narrator: the phone's own voice (free, offline), in the app's language ──
// A deeper male voice for men, a female voice for women (from the profile, or the sex remembered on this phone
// before sign-in); the phone's default voice when the sex isn't known yet. Enhanced/Premium voices come first.
const MALE_VOICES = /\b(Daniel|Aaron|Arthur|Oliver|Gordon|Rishi|Fred|Alex|Tom|Lee|Thomas|Nicolas|Jacques|Henri|Paul)\b/i;
const FEMALE_VOICES = /\b(Samantha|Ava|Allison|Susan|Victoria|Karen|Moira|Tessa|Serena|Martha|Catherine|Kate|Nicky|Zoe|Amélie|Amelie|Audrey|Aurélie|Aurelie|Marie|Chantal|Julie)\b/i;
const NOVELTY_VOICES = /Grandpa|Grandma|Rocko|Eddy|Flo|Reed|Sandy|Shelley|Bad News|Bells|Boing|Bubbles|Cellos|Wobble|Whisper|Zarvox|Trinoids|Organ|Jester|Junior|Ralph|Superstar|Albert|Bahh|Hysterical|Good News/i;

// Settings → Experience → Narrator voice (per phone): 'male' | 'female' | '' (automatic, follows the profile)
function narratorChoice() {
    try { return localStorage.getItem('odyr_voice') || ''; } catch (e) { return ''; }
}

function setNarratorVoice(value) {
    try { localStorage.setItem('odyr_voice', value || ''); } catch (e) { /* private mode */ }
    previewNarrator();
}

function previewNarrator() {
    if (!window.speechSynthesis) return showToast('Your phone can’t read aloud here');
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(tr('Before there were roads, there were wanderers.'));
    utterance.lang = speechLocale();
    const voice = narrationVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 0.9;
    utterance.pitch = narrationPitch();
    speechSynthesis.speak(utterance);
}

function narratorSex() {
    const chosen = narratorChoice();
    if (chosen === 'male' || chosen === 'female') return chosen;
    const sex = typeof userGender === 'function' ? userGender() : null;
    if (sex) return sex;
    try { return localStorage.getItem('odyr_gender') || null; } catch (e) { return null; }
}

// The voice language: the app's locale, or the phone's own (English has no LOCALE set)
function speechLocale() {
    return LOCALE || navigator.language || 'en-US';
}

function narrationVoice(sex = narratorSex()) {
    const all = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    const locale = speechLocale();
    const lang = locale.slice(0, 2);
    const voices = all.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(lang) && !NOVELTY_VOICES.test(v.name));
    // Best first: Premium/Enhanced voices, then the most natural names, then the exact locale
    const order = ['Daniel', 'Arthur', 'Aaron', 'Oliver', 'Gordon', 'Tom', 'Alex', 'Rishi', 'Thomas', 'Nicolas', 'Jacques', 'Henri', 'Paul', 'Lee', 'Fred',
        'Ava', 'Samantha', 'Allison', 'Serena', 'Karen', 'Moira', 'Tessa', 'Kate', 'Martha', 'Catherine', 'Susan', 'Victoria', 'Nicky', 'Zoe',
        'Audrey', 'Amélie', 'Amelie', 'Aurélie', 'Aurelie', 'Marie', 'Julie', 'Chantal'];
    const rank = v => (/Premium|Enhanced|Neural/i.test(v.name) ? 0 : 1000)
        + (order.findIndex(n => v.name.includes(n)) + 1 || 500)
        + (v.lang.replace('_', '-') === locale ? 0 : 0.5);
    const best = list => list.length ? [...list].sort((a, b) => rank(a) - rank(b))[0] : null;
    if (sex === 'male') {
        const male = voices.filter(v => MALE_VOICES.test(v.name) || /\bmale\b/i.test(v.name) && !/female/i.test(v.name));
        if (male.length) return best(male);
    }
    if (sex === 'female') {
        const female = voices.filter(v => FEMALE_VOICES.test(v.name) || /female/i.test(v.name));
        if (female.length) return best(female);
    }
    return best(voices);
}

// A touch deeper for men, natural for women
function narrationPitch(sex = narratorSex()) {
    return sex === 'male' ? 0.82 : sex === 'female' ? 1.0 : 0.92;
}

function toggleNarration() {
    haptic();
    if (!window.speechSynthesis) return showToast('Your phone can’t read aloud here');
    if (speechSynthesis.speaking) return stopNarration();
    const utterance = new SpeechSynthesisUtterance(`${tr(pageParts(journalPage).text)} ${tr(pageParts(journalPage).hook)}`);
    utterance.lang = speechLocale();
    const voice = narrationVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 0.9;
    utterance.pitch = narrationPitch();
    utterance.onend = () => { document.getElementById('journalListen').textContent = tr('Listen'); };
    speechSynthesis.speak(utterance);
    document.getElementById('journalListen').textContent = tr('Stop');
}

function stopNarration() {
    if (window.speechSynthesis) speechSynthesis.cancel();
    const btn = document.getElementById('journalListen');
    if (btn) btn.textContent = tr('Listen');
}
