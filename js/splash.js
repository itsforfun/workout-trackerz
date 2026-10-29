// Runs before anything else so the quote is on screen at first paint.
// Entries are a line written for the app, or [quote, author] from public-domain writers and classic translations.
// Lines written for this app around Odyr's themes: the endless journey, the path to greatness, constant change, listening to the body, never yielding. Shuffled like a deck (kept on this device) so none repeats until all are seen.
const QUOTES = [
    'The road does not end. That is the gift.',
    'You are not finishing a journey. You are becoming the one who walks it.',
    'Every body you’ve had was a draft. Keep writing.',
    'Nothing stays still. Move with it.',
    'The body remembers every promise you keep.',
    'Strength is what remains when quitting was an option.',
    'You don’t arrive. You deepen.',
    'Diamonds are only pressure that refused to give way.',
    'Listen to your body. It has been speaking all along.',
    'Each rep is a step on a path only you can walk.',
    'Life keeps changing. Train to change with it.',
    'You were never meant to be finished.',
    'Yield to rest, never to doubt.',
    'The path grows steeper because you are growing stronger.',
    'Endure today. Tomorrow repays you in strength.',
    'Discipline is a quiet form of self-respect.',
    'Some days you train the body. Most days, the will.',
    'The journey outward is also the journey inward.',
    'Bend like water. Return like the tide.',
    'Hold firm when it’s hard. That’s where you are made.',
    'Your breath is the oldest training partner you have.',
    'Every season of life asks for a new kind of strength.',
    'The mountain does not move. You learn to climb.',
    'Rest is not the end of the road. It is part of it.',
    'Unbreakable is built, never born.',
    'Move with intention, and the body follows the mind.',
    'A setback is only a longer chapter.',
    'You are the traveller and the road.',
    'Strength is patience you can see.',
    'Show up, especially when no one is watching.',
    'Each morning, the path begins again.',
    'Be gentle with the body and relentless with the work.',
    'You have outlasted every hard day so far. Keep the record.',
    'Stillness and motion are both forms of training.',
    'Your limits move every time you meet them.',
    'Deep roots grow in silence.',
    'Fall, rest, rise. Repeat for a lifetime.',
    'Goals change. The path continues.',
    'Tune in. Your body knows the way.',
    'Every scar on the journey is proof you kept walking.',
    'Courage is one more step when every reason says stop.',
    'You are not behind. You are on your path.',
    'Greatness is a path, not a place.',
    'Let today be a quiet act of devotion to yourself.',
    'The practice is the pilgrimage.',
    'Never yield the ground you’ve earned.',
    'A great journey is measured in returns, not arrivals.',
    'The strongest version of you is still on the way.',
    'The path to greatness is paved with ordinary days.',
    'Begin again. That is the whole secret.',
    ['To strive, to seek, to find, and not to yield.', 'Alfred, Lord Tennyson'],
    ['Though much is taken, much abides.', 'Alfred, Lord Tennyson'],
    ['I am a part of all that I have met.', 'Alfred, Lord Tennyson'],
    ['Heart, be still, you had worse than this to bear.', 'Homer, The Odyssey'],
    ['Fire is the test of gold; adversity, of strong men.', 'Seneca'],
    ['Life is long if you know how to use it.', 'Seneca'],
    ['The art of life is more like the wrestler’s art than the dancer’s.', 'Marcus Aurelius'],
    ['No great thing is created suddenly.', 'Epictetus'],
    ['A journey of a thousand miles begins with a single step.', 'Lao Tzu'],
    ['He who overcomes himself is mighty.', 'Lao Tzu'],
    ['Everything flows.', 'Heraclitus'],
    ['Character is destiny.', 'Heraclitus'],
    ['We become brave by doing brave acts.', 'Aristotle'],
    ['Dripping water hollows a stone.', 'Ovid'],
    ['They can because they think they can.', 'Virgil'],
    ['He who has a why to live for can bear almost any how.', 'Friedrich Nietzsche'],
    ['What does not kill me makes me stronger.', 'Friedrich Nietzsche'],
    ['All truly great thoughts are conceived while walking.', 'Friedrich Nietzsche'],
    ['Trust thyself: every heart vibrates to that iron string.', 'Ralph Waldo Emerson'],
    ['Every artist was first an amateur.', 'Ralph Waldo Emerson'],
    ['The moment my legs begin to move, my thoughts begin to flow.', 'Henry David Thoreau'],
    ['Afoot and light-hearted I take to the open road.', 'Walt Whitman'],
];
// The quote in the app's language (lang/<code>.js keeps the same order as QUOTES)
function quoteAt(index) {
    return (PACK && PACK.quotes && PACK.quotes[index]) || QUOTES[index];
}

// Keeps the reveal paused until the quote's font is ready (at most ~1 s), so words never change shape mid-animation.
// The time spent waiting is added to how long the quote stays up.
function holdSplashForFont(splash) {
    if (!document.fonts || !document.fonts.load) return;
    const text = document.getElementById('splashQuote').textContent;
    if (document.fonts.check('400 32px "Instrument Serif"', text)) return;
    splash.classList.add('waiting');
    const started = Date.now();
    let released = false;
    const go = () => {
        if (released) return;
        released = true;
        splash.classList.remove('waiting');
        window.__splashMin = (window.__splashMin || 0) + (Date.now() - started);
    };
    document.fonts.load('400 32px "Instrument Serif"', text).then(go, go);
    setTimeout(go, 1000);
}

// Writes the weekday and the quote, one span per word so each word can rise in turn
function renderSplash(entry) {
    const [text, by] = Array.isArray(entry) ? entry : [entry, ''];
    document.getElementById('splashKicker').textContent = new Date().toLocaleDateString(LOCALE, { weekday: 'long' });
    const quote = document.getElementById('splashQuote');
    quote.setAttribute('aria-label', by ? `${text} (${by})` : text);
    const words = text.split(' ');
    quote.classList.toggle('long', words.length > 14);
    const byEl = document.getElementById('splashBy');
    byEl.textContent = by;
    byEl.style.setProperty('--d', `${0.7 + words.length * 0.14 + 0.6}s`);
    window.__splashMin = 700 + 1500 + words.length * 140 + 1600 + (by ? 700 : 0);
    quote.innerHTML = words.map((word, i) =>
        `<span class="w" style="--i:${i}" aria-hidden="true">${word.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`).join(' ');
}
(function () {
    const splash = document.getElementById('splash');
    let off = false;
    let deck = [];
    try {
        off = localStorage.getItem('wt_splash_off') === '1';
        deck = JSON.parse(localStorage.getItem('wt_quote_deck') || '[]').filter(i => i < QUOTES.length);
        if (localStorage.getItem('wt_quote_count') !== String(QUOTES.length)) deck = [];
        localStorage.setItem('wt_quote_count', String(QUOTES.length));
    } catch (e) { /* private mode: still show a random quote */ }
    if (off) {
        splash.remove();
        return;
    }
    if (!deck.length) {
        deck = QUOTES.map((_, i) => i);
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }
    const index = deck.shift();
    try { localStorage.setItem('wt_quote_deck', JSON.stringify(deck)); } catch (e) { /* private mode */ }
    renderSplash(quoteAt(index));
    window.__splashAt = Date.now();
    holdSplashForFont(splash);
})();
