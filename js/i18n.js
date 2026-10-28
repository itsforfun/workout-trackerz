// ════════════════════════════════════════════
//  LANGUAGE: the app is written in English; other languages live in lang/<code>.js.
//  Every piece of text the app puts on screen is looked up as it appears (a MutationObserver),
//  so screens need no special markup. Keys are the English text; "{}" in a key matches a value, "{#}" a number.
//  Mark an element data-no-i18n to leave it untouched (user content, the opening quote).
// ════════════════════════════════════════════
const LANGUAGES = { en: 'English', fr: 'Français' };
// ?lang=fr in the address wins (handy for testing and for sharing a link in a given language)
function storedLang() {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (fromUrl) return fromUrl;
    try { return localStorage.getItem('odyr_lang') || ''; } catch (e) { return ''; }
}
function phoneLang() {
    const prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    for (const tag of prefs) {
        const code = String(tag).slice(0, 2).toLowerCase();
        if (LANGUAGES[code]) return code;
    }
    return 'en';
}
const LANG = LANGUAGES[storedLang()] ? storedLang() : phoneLang();
const PACK = LANG !== 'en' && window.I18N_PACKS ? window.I18N_PACKS[LANG] : null;
// Dates and numbers follow the chosen language; English keeps the phone's own regional format
const LOCALE = PACK ? PACK.locale : ((navigator.language || 'en').startsWith('en') ? undefined : 'en-GB');
document.documentElement.lang = PACK ? LANG : 'en';

const I18N = { exact: new Map(), patterns: [], cache: new Map(), outputs: new Set(), missing: new Set() };  // missing: text seen with no translation (for checking coverage)
if (PACK) {
    const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Collapse layout whitespace but keep non-breaking spaces (French puts them before : ? ! and %)
    const norm = s => s.replace(/[^\S\u00a0\u202f]+/g, ' ').trim();
    Object.entries(PACK.strings).forEach(([en, out]) => {
        const key = norm(en);
        I18N.outputs.add(norm(out));
        const slots = key.match(/\{#?\}/g);
        if (!slots) { I18N.exact.set(key, out); return; }
        // {} matches any value, {#} only a number
        const parts = key.split(/\{#?\}/);
        I18N.patterns.push({
            re: new RegExp('^' + parts.map((part, i) => escapeRe(part) + (i < slots.length ? (slots[i] === '{#}' ? '([\\d.,]+)' : '(.*?)') : '')).join('') + '$'),
            literal: parts.join('').length,
            out,
        });
    });
    // When two patterns fit, the one with more fixed text is the more specific
    I18N.patterns.sort((a, b) => b.literal - a.literal);
}

// Translate one piece of text (whitespace around it is kept). Unknown text comes back unchanged.
function tr(text, depth = 0) {
    if (!PACK || text == null) return text;
    text = String(text);
    if (!/[A-Za-z]/.test(text)) return text;
    const lead = text.match(/^[^\S\u00a0\u202f]*/)[0];
    const trail = text.slice(lead.length).match(/[^\S\u00a0\u202f]*$/)[0];
    const key = text.slice(lead.length, text.length - trail.length).replace(/[^\S\u00a0\u202f]+/g, ' ');
    // Text this function already produced is left alone, so translating twice never changes it again
    if (I18N.outputs.has(key)) return text;
    let out = I18N.cache.get(key);
    if (out === undefined) {
        out = I18N.exact.get(key);
        if (out === undefined && depth < 3) {
            for (const p of I18N.patterns) {
                const m = key.match(p.re);
                if (!m) continue;
                const values = m.slice(1).map(v => tr(v, depth + 1));
                let i = 0;
                out = p.out.replace(/\{(\d*)\}/g, (_, n) => values[n === '' ? i++ : Number(n)] ?? '');
                break;
            }
        }
        if (out === undefined) {
            out = key;
            if (depth === 0 && !I18N.outputs.has(key)) I18N.missing.add(key);
        }
        if (depth === 0) {
            I18N.cache.set(key, out);
            I18N.outputs.add(out);
        }
    }
    return out === key ? text : lead + out + trail;
}

// Number keypads in many regions (France included) type a decimal comma; the app stores numbers with a dot.
// Runs in the capture phase, before each field's own oninput handler.
document.addEventListener('input', e => {
    const field = e.target;
    if (field.inputMode === 'decimal' && field.value.includes(',')) field.value = field.value.replace(/,/g, '.');
}, true);

const I18N_ATTRS = ['placeholder', 'title', 'aria-label'];
const I18N_SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE']);
function i18nText(node) {
    const next = tr(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
}
function i18nAttrs(el) {
    for (const name of I18N_ATTRS) {
        const value = el.getAttribute(name);
        if (value) {
            const next = tr(value);
            if (next !== value) el.setAttribute(name, next);
        }
    }
}
function i18nTree(root) {
    if (root.nodeType === 3) return i18nText(root);
    if (root.nodeType !== 1 || I18N_SKIP.has(root.tagName) || root.hasAttribute('data-no-i18n')) return;
    i18nAttrs(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
            if (n.nodeType === 3) return NodeFilter.FILTER_ACCEPT;
            if (I18N_SKIP.has(n.tagName) || n.hasAttribute('data-no-i18n')) return NodeFilter.FILTER_REJECT;
            i18nAttrs(n);
            return NodeFilter.FILTER_SKIP;
        },
    });
    while (walker.nextNode()) i18nText(walker.currentNode);
}
function i18nSkipped(node) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    return !el || !!el.closest('[data-no-i18n], script, style, textarea, code');
}
if (PACK) {
    new MutationObserver(records => {
        for (const r of records) {
            if (i18nSkipped(r.target)) continue;
            if (r.type === 'childList') r.addedNodes.forEach(i18nTree);
            else if (r.type === 'characterData') i18nText(r.target);
            else i18nAttrs(r.target);
        }
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS });
    // Native dialogs are not part of the page, so their text is translated on the way in
    const nativeConfirm = window.confirm.bind(window);
    const nativeAlert = window.alert.bind(window);
    const nativePrompt = window.prompt.bind(window);
    window.confirm = message => nativeConfirm(tr(message));
    window.alert = message => nativeAlert(tr(message));
    window.prompt = (message, value) => nativePrompt(tr(message), value);
    // Charts draw on a canvas, so their labels are translated before each draw
    if (window.Chart) Chart.register({
        id: 'i18n',
        beforeUpdate(chart) {
            const data = chart.data;
            if (data.labels) data.labels = data.labels.map(l => (typeof l === 'string' ? tr(l) : l));
            data.datasets.forEach(ds => { if (typeof ds.label === 'string') ds.label = tr(ds.label); });
        },
    });
}
