// ════════════════════════════════════════════
//  SAGAS II AND III, FREYJA'S LETTERS, YOUR SAGA (saga batch 3, v2.8).
//  Saga I (The Road North) lives in odyssey.js, journal.js and trials.js; II and III are here. After III the
//  three worlds come round again. Journal pages have one id across worlds: world × 11 + page.
// ════════════════════════════════════════════

const SAGA_ONE_TITLE = 'The Road North';
const LATER_PATH_STORY = { mountain: "You take the high way, because it is there.", coast: "You take the long way, by the water, at your own steady pace.", forest: "You take the quiet way, under the trees, one good day after another." };
const LATER_SAGAS = [
    {
        title: "The Golden Trail",
        landmarks: [["Salt Harbour", "A new road, and this one floats."], ["The Whale Road", "The old poets’ name for the sea. It has no shortcuts."], ["Skerry Light", "One flame, kept alive by someone you will never meet."], ["Amber Shore", "The tide brings gold here, if you are patient."], ["The Drowned Market", "Everything has a price, even down here."], ["Raven Cliffs", "Halfway. Two ravens see everything and tell one person."], ["Ashfall", "The sky burned here once. People still planted."], ["The Glass Marsh", "Step lightly. Keep going."], ["The Hundred Steps", "Nobody climbs a hundred. You climb one, a hundred times."], ["The Goldsmith’s Vault", "All the tears end up somewhere."], ["The Golden Threshold", "You followed the gold. Now see who was leading you."]],
        pages: [
            "I keep the gold tear in my fist as the harbour wakes. It is Freyja’s, I am sure of it. So she was ahead of me all along, while I told myself she waited at home. I bought passage on the first boat north. The captain asked how far. As far as the tears go, I said.",
            "Nine days of grey water. I rowed when they asked and bailed when they didn’t. A sailor told me the sea cannot be beaten, only outlasted. He has all his fingers and most of his teeth, so I believe him. Each morning I did the same work again, and each morning it cost a little less.",
            "The keeper of the light has climbed these stairs twice a day for fifty years. I asked if anyone had ever thanked her. She shrugged. “Ships that make it home don’t know I exist. That’s how you know it’s working.” I carried her oil up that evening. My legs complained. She laughed at them.",
            "The beach glitters, and for one foolish hour I thought every grain was hers. It is only amber. But under the driftwood I found a real tear, then a second, a few steps apart, as if she had stopped here to rest and could not help it. I sat where she must have sat. Then I got up.",
            "At low tide the old town rises from the water and the traders come out. One offered me a fortune for my tears. Another whispered that a figure in grey buys every one she can find, and has been buying for years. Nobody has seen her face. I closed my hand and walked faster.",
            "Two ravens followed me up the cliffs, and they were not curious. They were counting. At the top I could see the whole road behind me: the harbour, the sea, the small bright shore. I had not known I had come so far. No one tells you. You have to stop and turn around.",
            "Grey snow that isn’t snow. A whole valley buried, and in the middle of it, an old man planting barley. I asked why he bothered. “Because it’s spring,” he said, as if I were simple. I helped him until dark. We did not talk about the ash. There was a row to finish.",
            "The marsh froze into something clear, and you can see the old drowned road beneath your feet. It holds only if you keep moving. Stand still to worry and it starts to crack. I crossed it in one long morning without once looking down. I am learning which fears deserve my attention.",
            "Someone cut these steps into the mountain and did not care how anyone would feel about it. By the fortieth I had stopped counting. By the seventieth I had stopped thinking. At the top my legs shook and my head was perfectly quiet. I have paid a lot of money for less peace than that.",
            "The vault is open, and the walls are gold from floor to ceiling. Not treasure. Tears. Every one she ever cried for me, gathered and set in rows, each with a date scratched beside it. Whoever did this has followed her for years. I read the last date. It was yesterday.",
            "She was waiting at the threshold in her grey cloak, and I knew her at last: the watcher from the tower. “I kept them so you could find your way,” she said. “Every road you took, she had walked it first, looking for you. You were never lost. You were only late.” She pointed south. Home."
        ],
        hooks: [
            "On the quay, someone had left a second tear, placed with care, where I would see it.",
            "Far behind our boat, a small grey sail has kept the same distance for nine days.",
            "As I left, the keeper said: “You’re the second one to ask about her this month.”",
            "In the wet sand beside hers, a second line of footprints. Smaller. Careful. Following.",
            "That night my purse was untouched, but one of my tears was gone.",
            "One raven dropped something at my feet: the tear I had lost. Someone was returning it.",
            "The old man’s last words to me: “The grey one said you’d come. She said to feed you.”",
            "Under the ice, walking the drowned road beneath me, I swear I saw a grey cloak keeping pace.",
            "At the last step, scratched in the rock: “Almost. Don’t stop now.”",
            "Behind me, the vault door closed softly, and someone said my name.",
            "“Go now,” she said. “She has stopped searching. I don’t know why. That frightens me.”"
        ],
        tales: [
            ["Every ship here carries one stone from home, so it always remembers which way to turn.", "Sailors never say the word “last” on a quay. Not last trip, not last rope.", "The harbour cat has boarded every ship and missed none. Nobody has ever fed it twice."],
            ["Whales sing for hours and wait days for an answer. Patience, the sailors call it.", "A rower’s first week is blisters. The second is calluses. The third, he stops looking.", "They steer by a star that moves. You correct a little every night, and you arrive."],
            ["The light has gone out only once, they say, and that winter nine ships came home anyway.", "Keepers write one line a day in the log. Most of them say: lit the lamp.", "Three hundred stairs, twice a day. The keeper calls it going to work."],
            ["Amber is only old resin that refused to wash away.", "Children here sort the beach after storms. The patient ones get rich.", "Some amber holds a tiny fly, still perfect, from before anyone had a name."],
            ["The market opens when the tide drops and closes when it returns. Nobody haggles slowly.", "One stall sells only keys. Nobody knows to what. It does very well.", "They say you can buy anything here but time, and they have tried."],
            ["Odin’s ravens, Thought and Memory, fly out each dawn. He fears most for Memory.", "Climbers leave a crust at the top. The ravens remember who did.", "From the highest ledge, they say, you can see every road you nearly took."],
            ["The ash makes the best soil in the north. It takes ten years to believe it.", "Families here plant one tree for each year the fire did not come back.", "Ask how they rebuilt and they’ll say: the same way as yesterday."],
            ["Marsh guides walk with a long pole and never trust the same path twice.", "On clear nights the stars show twice, above you and under your boots.", "Nobody crosses the marsh fast, and nobody who stops ever enjoys it."],
            ["Pilgrims say a word on each step. By the top they have forgotten what they wanted.", "Step sixty is worn deepest. It’s where almost everyone stops to breathe.", "An old woman climbs them every morning. She has never once said it gets easier."],
            ["The goldsmiths here take one oath: never melt what someone wept for.", "Gold doesn’t rust. That’s why people trust it with what they can’t say.", "The vault has no lock. In three hundred years, no one has dared."]
        ],
        relics: [["Harbour Stone", "So you always know which way to turn."], ["Whale’s Tooth", "Carved by someone with a long time to think."], ["Keeper’s Wick", "It has lit a thousand ordinary nights."], ["Amber Fly", "Older than every name you know."], ["Market Key", "Nobody knows what it opens."], ["Raven Quill", "Memory’s, they say."], ["Ash Seed", "Plant it anyway."], ["Glass Reed", "It holds, as long as you keep moving."], ["Worn Step", "A chip of the sixtieth stair."], ["Dated Tear", "Yesterday’s."]],
        crossroads: [{ title: "The sea road forks", line: "Three currents leave the shore, and the gold drifts down all of them." }, { title: "The ash road forks", line: "Beyond the burned valley the road breaks in three. Someone has marked one. You don’t trust it." }],
    },
    {
        title: "The Way Home",
        landmarks: [["The Turning Stone", "Every journey has a point where home is closer than the end."], ["Snowblind Plain", "No road. Only the direction you decided on."], ["The Giant’s Stride", "Some gaps you cross by believing your legs."], ["Moonwell", "Drink, and remember what you came for."], ["The Sleeping Army", "They were strong once and then they sat down."], ["The World-Tree’s Root", "Halfway home, and everything here holds up something else."], ["The Night Ferry", "The price of crossing is what you’re still carrying."], ["The Apple Orchard", "The goddess’s apples keep the gods young. They have to be picked by hand."], ["The Old Road", "You know this stretch. It knows you too."], ["The Familiar Hills", "You can smell the smoke from here."], ["The Hearth, Again", "The fire you left behind. It was never allowed to go out."]],
        pages: [
            "The grey woman walked with me as far as a tall stone, then stopped. “This is as far as I watch,” she said. “The rest you do yourself.” I turned south for the first time in years. It is strange how different the same legs feel when they are walking toward someone.",
            "White above, white below, no line between them. For three days I could not tell whether I was moving at all. So I stopped asking. I picked a direction each morning and gave it my whole day. On the fourth, a dark smudge of trees. I had been going straight the entire time.",
            "The ravine is older than the word for it. They say a giant crossed in one step and left these two ledges. The gap is wider than I can jump, or so I told myself for an hour. Then I remembered Iron Pass and the Hundred Steps, took ten paces back, and ran. These are not the legs I left home with.",
            "I drank from the well and saw the Hearth as clearly as my own hand: the bench, the crooked door, the way she ties her hair when she works. I had been telling myself I walked for the road. I sat there a long while. I walk for this. I always did.",
            "A whole valley of warriors, seated in rows, moss on their shoulders. Not dead. They stopped for one short rest after their greatest victory and never found a reason to stand. One opened his eyes as I passed. “Stay,” he said. “You’ve earned it.” It was the most dangerous thing anyone has said to me.",
            "A root as wide as a town, running under the mountains. Three old women tend it, pouring water on it every day, and it has not died in all the ages of the world. I asked if it ever ends, the watering. The eldest did not look up. “Fetch the other bucket,” she said. So I did.",
            "The ferryman takes no coin. He asked what I was carrying, and I showed him the tears, all of them, heavy as a child. “Leave what isn’t yours to carry,” he said. I kept one. The rest I let go into the black water, and they lit it all the way across.",
            "I slept in an orchard and woke with an apple by my hand. I am not old, but I had started to feel it, in the knees, in the mornings. I ate it and felt nothing at all. Then I noticed I had walked until noon without once thinking about my knees. Perhaps that is the magic.",
            "I know this road. There is the rock where I counted my first forty steps like a child. It seemed a long way then. I walked it this morning before I had properly woken up. Nothing about the road has changed. I stopped at the rock and put my hand on it, the way you greet someone.",
            "Smoke over the last hill. Thin and straight, the way it rises from a fire someone has tended well. My heart did something my legs have never done on any mountain. I wanted to run. I didn’t. I have learned how to finish things. One step, then one more, the same as the first day.",
            "She was sitting by the fire, adding a log, as if I had stepped out for water. So that was why she had stopped searching. “I got tired of chasing you,” Freyja said. “I came home to keep it lit.” I gave her the last tear. She laughed and closed my hand on it. In the morning I found her lacing her boots. “Well?” she said. “Which way?”"
        ],
        hooks: [
            "“One more thing,” she called. “The fire at the Hearth is still burning. Ask yourself who’s feeding it.”",
            "At the edge of the trees, a marker in a hand I know: a small circle, not quite closed.",
            "On the far ledge, the same mark, the same open circle. It is pointing the way I was already going.",
            "In the water, for a moment, she looked up from what she was doing, as if she had heard me.",
            "I walked on. Behind me, one by one, I heard the sound of old armour standing up.",
            "Cut into the root, in a hand I know: “Tell him the bench still needs fixing.”",
            "On the far bank, the ferryman said: “She crossed the other way, long ago. She paid the same.”",
            "The apple by my hand had been cut in half. Someone had already eaten the other side.",
            "Fresh on the rock, beside where I had counted: forty small scratches, and a forty-first.",
            "From over the hill, faintly, someone was singing the song I can never get right.",
            "The road goes on. It always did. Only now there are two sets of footprints on it."
        ],
        tales: [
            ["Travellers touch the stone on the way out and again on the way back.", "It has been worn smooth at exactly the height of a tired hand.", "Nobody knows who raised it. Everybody knows what it’s for."],
            ["Plains people tie a rope between them in the white. Nobody walks it alone twice.", "They say if you stop to check your progress, the snow erases it.", "The trick to crossing is boring, they tell you. Same direction, every day."],
            ["The giant’s footprint is now a lake. Children swim in the heel.", "Local boys prove themselves on the small gap. Nobody tells them the big one exists.", "Giants, the elders say, were only people who never asked if a thing was too far."],
            ["Odin gave an eye for one drink of wisdom at a well like this one.", "The moon sits in the water at noon here. Nobody can explain it. Nobody tries.", "Drink only once, the keepers warn. The second cup shows you what you gave up."],
            ["Crows nest in their helmets. In spring you can hear the army chirping.", "The story changes, but it always starts the same: just five more minutes.", "Once a year a soldier wakes. They always ask what day it is, and then they weep."],
            ["The Norns tend the root of the world and water it from their well each day.", "A squirrel runs the trunk carrying insults between the eagle and the serpent.", "Every branch holds a world, they say. Every world forgets who’s holding it."],
            ["The ferry leaves when it’s full, and it has never once been full.", "Passengers don’t talk. There’s something about black water that ends a conversation.", "Nobody has seen the ferryman sleep. Nobody has seen him hurry either."],
            ["Idunn keeps the apples that keep the gods young. Lose her, and even gods grow old.", "The trees only fruit for those who come back to prune them.", "Pickers eat the bruised ones and say those are the sweetest. They’re right."],
            ["Roads remember. Walk one for years and your feet will find it in the dark.", "The milestones here were set by people who never saw the end of it.", "Old travellers slow down here on purpose. They know what’s coming, and want it to last."],
            ["Sheep here know every stranger, and you are no longer one.", "Someone has mended the fence you broke as a child. Badly. On purpose, maybe.", "Every hill you thought was the last one has one more behind it. Then it doesn’t."]
        ],
        relics: [["Turning Pebble", "A chip of the stone, worn by many hands."], ["Plains Rope", "Someone was on the other end of it."], ["Giant’s Knuckle", "Probably a rock. Probably."], ["Moon Cup", "Drink only once."], ["Mossy Buckle", "From someone who sat down."], ["Norn’s Bucket Ring", "Fetch the other one."], ["Ferry Token", "It has never been spent."], ["Half an Apple", "Someone is sharing with you."], ["Forty-First Mark", "The step that wasn’t yours."], ["Last Gold Tear", "She closed your hand on it."]],
        crossroads: [{ title: "The way home forks", line: "Three ways lead south from the well. All of them end at the same fire." }, { title: "The last fork", line: "Past the ferry, one last choice. You already know how this ends. Choose how you get there." }],
    },
];

function worldIndex(saga) {
    return (saga - 1) % 3;
}

function sagaWorld(saga) {
    const w = worldIndex(saga);
    if (w === 0) return { title: SAGA_ONE_TITLE, landmarks: LANDMARKS, pages: JOURNAL, hooks: JOURNAL_HOOKS, tales: REST_TALES, relics: RELICS, crossroads: CROSSROADS };
    const later = LATER_SAGAS[w - 1];
    return {
        ...later,
        relics: later.relics.map(([name, line], i) => ({ name, line, rune: RELICS[i].rune })),
        crossroads: later.crossroads.map(x => ({ ...x, story: LATER_PATH_STORY })),
    };
}

function landmarksOf(saga) {
    return sagaWorld(saga).landmarks;
}

// ── Freyja's letters: one when you come back after a week or more away. Never a guilt trip. ──
const FREYJA_LETTERS = [
    "Traveller, the road didn’t go anywhere while you were away. Neither did I. Add a log when you’re ready.",
    "You stopped for a while. So did Odyr, more often than he writes down. What counts is the morning you get up.",
    "Nobody here is counting the days you missed. I only count the fires still lit, and yours is. Start small today.",
    "Your strength hasn’t gone far. It’s waiting a little way up the road. Go lighter today and it will fall back into step.",
    "Life gets in the way of every road. I’ve walked enough of them to know. Come back without apologising.",
    "The hardest step on any journey is the first one after a rest. You only have to take that one.",
    "I kept your place on the road. It’s exactly where you left it, not one league lost.",
    "Even the sea goes out before it comes back in. Welcome back, traveller.",
];

function pendingLetter() {
    const dates = allWorkoutDates().sort();
    if (!dates.length) return null;
    const last = dates[dates.length - 1];
    if (daysBetween(last, todayStr()) < 7) return null;
    const read = allData._letters || {};
    if (read[last]) return null;
    return { id: last, text: FREYJA_LETTERS[Object.keys(read).length % FREYJA_LETTERS.length] };
}

function sagaLetterHtml() {
    return pendingLetter() ? `
        <button class="saga-letter" onclick="openLetter()">
            <span class="sl-seal" aria-hidden="true"></span>
            <span><strong>A letter from Freyja</strong><small>Waiting for you at the Hearth</small></span>
            <em>Open ›</em>
        </button>` : '';
}

function openLetter() {
    const letter = pendingLetter();
    if (!letter) return;
    haptic();
    playSound('badge');
    document.getElementById('letterBody').innerHTML = `
        <div class="kicker">A letter from Freyja</div>
        <p class="letter-text">${escapeHtml(letter.text)}</p>
        <p class="letter-sign">Freyja</p>`;
    document.getElementById('letterModal').classList.add('active');
    allData._letters = { ...(allData._letters || {}), [letter.id]: todayStr() };
    scheduleSave();
}

function closeLetter() {
    document.getElementById('letterModal').classList.remove('active');
    renderSagaCard();
}

// ── Your Saga: the road you actually walked, chapter by chapter, written from your own log ──
function sagaChapters() {
    const j = journey();
    const cardioDays = Object.values(metaFor('_sessions')).flat().filter(s => s && s.type === 'cardio').map(s => s.date);
    const days = [...new Set([...allWorkoutDates(), ...cardioDays, ...Object.keys(metaFor('_habits')), ...Object.keys(stepData)])].sort();
    const reached = Math.floor(j.total / 100);
    const chapters = [];
    let total = 0, start = days[0], next = 1;
    for (const day of days) {
        total += leaguesBetween(day, day);
        while (next <= reached && total >= next * 100) {
            chapters.push({ n: next, saga: Math.floor((next - 1) / 10) + 1, stop: (next - 1) % 10, start, end: day });
            start = day;
            next++;
        }
    }
    return chapters;
}

function chapterLines(ch) {
    const inRange = d => d >= ch.start && d <= ch.end;
    const sessions = Object.values(metaFor('_sessions')).flat().filter(s => s && s.type === 'workout' && inRange(s.date));
    const workouts = sessions.length;
    const sets = sessions.reduce((sum, s) => sum + (s.sets || 0), 0);
    const dawn = sessions.filter(s => typeof s.startHour === 'number' && s.startHour < 8).length;
    const dates = sessions.map(s => s.date).sort();
    let gap = 0;
    for (let i = 1; i < dates.length; i++) gap = Math.max(gap, daysBetween(dates[i - 1], dates[i]));
    // The lift that improved most on this stretch
    let lift = null, liftGain = 0;
    (PROGRAMS[currentProgram].exercises || []).forEach(ex => {
        if (ex.assist) return;
        const h = strengthHistory(ex);
        const before = h.filter(p => p.date < ch.start).map(p => p.value);
        const during = h.filter(p => inRange(p.date)).map(p => p.value);
        if (!before.length || !during.length) return;
        const gain = Math.max(...during) / Math.max(...before) - 1;
        if (gain > liftGain) { liftGain = gain; lift = ex.name; }
    });
    const trial = ((allData._saga || {}).trials || {})[`${ch.saga}-${ch.stop}`];
    const span = Math.max(1, daysBetween(ch.start, ch.end) + 1);
    const lines = [span === 1 ? 'You reached it in a single day.'
        : workouts > 1 ? `You reached it in ${span} days and ${workouts} workouts.` : `You reached it in ${span} days.`];
    if (gap >= 7) lines.push(`You stopped for ${gap} days, then you came back.`);
    if (lift) lines.push(`${lift} climbed to a new best.`);
    if (dawn >= 2) lines.push(`You rose before the sun ${dawn} times.`);
    if (trial && trial.done) lines.push(`You earned the ${sagaWorld(ch.saga).relics[ch.stop].name}.`);
    if (lines.length < 3 && sets) lines.push(`You logged ${sets} sets along the way.`);
    if (lines.length < 2) lines.push('You kept your pace and told nobody.');
    return lines.slice(0, 4);
}

function yourSagaHtml() {
    const chapters = sagaChapters().reverse();
    if (!chapters.length) return '';
    const card = ch => `
        <div class="chapter">
            <div class="chapter-top"><strong>${escapeHtml(landmarksOf(ch.saga)[ch.stop + 1][0])}</strong><span>${escapeHtml(sagaName(ch.saga))}</span></div>
            <small>${escapeHtml(prettyDate(ch.end))}</small>
            ${chapterLines(ch).map(l => `<p>${escapeHtml(l)}</p>`).join('')}
        </div>`;
    return `
        <div class="section-head"><h3>Your saga</h3><span>${chapters.length} ${chapters.length === 1 ? 'chapter' : 'chapters'}</span></div>
        <div class="chapter-list">
            ${chapters.slice(0, 2).map(card).join('')}
            ${chapters.length > 2 ? `<details class="chapter-more"><summary>Earlier chapters</summary>${chapters.slice(2).map(card).join('')}</details>` : ''}
        </div>`;
}
