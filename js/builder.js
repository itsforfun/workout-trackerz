// ════════════════════════════════════════════
//  PROGRAM BUILDER (your own programs)
// ════════════════════════════════════════════

// Saved in workout_data._customPrograms[id] = { name, days: [names], exercises: [{ id, day, name,
// sets, repMin, repMax, rest, unit, thresholds?, standardGender?, bar?, swapKey?, note? }] }.
// registerCustomPrograms() turns them into normal PROGRAMS entries, so tracking, workout mode,
// progression, charts, swaps and plates all work the same as for the built-in programs.

const UNIT_CHOICES = [
    ['kg', 'Machine or barbell'],
    ['kg/DB', 'Dumbbells (per hand)'],
    ['kg/side', 'Per side / per arm'],
    ['reps/+kg', 'Bodyweight (reps)'],
    ['kg+', 'Added weight on bodyweight'],
];
const REP_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 25, 30];
const REST_CHOICES = [0.5, 1, 1.5, 2, 2.5, 3, 4];
const ARROW_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const CHEVRON_UP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
const CHEVRON_DOWN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

function randomId(length = 6) {
    return Array.from(crypto.getRandomValues(new Uint8Array(length)), b => (b % 36).toString(36)).join('');
}

function registerCustomPrograms(defs = allData._customPrograms) {
    Object.keys(PROGRAMS).forEach(id => { if (PROGRAMS[id].custom) delete PROGRAMS[id]; });
    Object.entries(defs || {}).forEach(([id, def]) => { PROGRAMS[id] = buildCustomProgram(def); });
}

function buildCustomProgram(def) {
    const days = def.days.length;
    return {
        name: def.name,
        subtitle: `Your program · ${days} day${days === 1 ? '' : 's'}`,
        gender: (userProfile && userProfile.gender) || 'male',
        heroTitle: escapeHtml(def.name.toUpperCase()),
        heroSubtitle: 'Built by you',
        days: def.days,
        custom: true,
        exercises: def.exercises.map(e => ({
            id: e.id,
            day: e.day,
            name: e.name,
            meta: `${e.sets}×${e.repMin}${e.repMax > e.repMin ? '-' + e.repMax : ''}${e.per ? '/' + e.per : ''}, ${e.rest}min`,
            unit: e.unit,
            thresholds: e.thresholds || null,
            standardGender: e.standardGender,
            bar: !!e.bar,
            swapKey: e.swapKey,
            note: e.note || '',
            per: e.per,
            repLabel: e.repLabel,
        })),
    };
}

// Every exercise the app knows: built-in program exercises (with strength standards, preferring
// the user's gender) plus the swap alternatives (no standards)
function exerciseLibrary() {
    const gender = (userProfile && userProfile.gender) || 'male';
    const byName = new Map();
    Object.values(PROGRAMS)
        .filter(prog => !prog.custom)
        .sort((a, b) => (a.gender === gender ? 0 : 1) - (b.gender === gender ? 0 : 1))
        .forEach(prog => prog.exercises.forEach(ex => {
            if (byName.has(ex.name)) return;
            const p = getPrescription(ex);
            byName.set(ex.name, {
                name: ex.name, unit: ex.unit, thresholds: ex.thresholds, standardGender: prog.gender,
                bar: !!ex.bar, swapKey: ex.id, note: ex.alternates ? '' : (ex.note || ''), per: ex.per, repLabel: ex.repLabel,
                sets: p.sets, repMin: p.repMin || 8, repMax: p.repMax || 12, rest: Math.max(0.5, Math.round(p.restSec / 30) / 2),
            });
        }));
    Object.values(SWAPS).flat().forEach(([name, unit, bar, assist]) => {
        if (!byName.has(name) && !assist) byName.set(name, { name, unit, bar: !!bar, sets: 3, repMin: 8, repMax: 12, rest: 2 });
    });
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ── Program menu: your programs + "build your own" ──
function renderCustomProgramCards() {
    const defs = allData._customPrograms || {};
    const cards = Object.entries(defs).map(([id, def]) => `
        <button class="program-card custom-card" onclick="selectProgram('${id}')">
            <div class="program-top"><span class="program-index">Yours</span><span class="program-tag">${def.days.length} day${def.days.length === 1 ? '' : 's'} · ${def.exercises.length} exercises</span></div>
            <div class="program-title">${escapeHtml(def.name)}</div>
            <div class="program-desc">${def.days.map(escapeHtml).join(' · ')}</div>
            <div class="program-cta">Open program ${ARROW_ICON}<span class="program-edit" onclick="event.stopPropagation(); openBuilder('${id}')">Edit</span></div>
        </button>`).join('');
    document.getElementById('customProgramGrid').innerHTML = cards + `
        <button class="program-card build-card coach-gen" onclick="openGenerator()">
            <div class="build-plus">${achievementIcon('score', 22)}</div>
            <div class="program-title">Build it for me</div>
            <div class="program-desc">Answer five quick questions about your goal, days, equipment and joints. The coach designs the program; you review it before saving.</div>
        </button>
        <button class="program-card build-card" onclick="openBuilder()">
            <div class="build-plus">+</div>
            <div class="program-title">Build your own</div>
            <div class="program-desc">Pick days and exercises from the library or add your own. Tracking, rest timer, progression hints and charts all work the same.</div>
        </button>`;
}

// ── Builder screen ──
let builder = null;   // { id, isNew, name, days: [{ name, exercises: [...] }] }
let pickerDay = 0;
let pickerResults = [];

function openBuilder(id) {
    haptic();
    const def = id && allData._customPrograms && allData._customPrograms[id];
    builder = def
        ? { id, isNew: false, name: def.name, days: def.days.map((name, d) => ({ name, exercises: def.exercises.filter(e => e.day === d).map(e => ({ ...e })) })) }
        : { id: `custom-${randomId()}`, isNew: true, name: '', days: [{ name: 'Day A', exercises: [] }] };
    renderBuilder();
    showScreen('builder');
}

function renderBuilder() {
    const b = builder;
    const scroll = window.scrollY;
    document.getElementById('builderTitle').textContent = b.isNew ? 'New program' : 'Edit program';
    document.getElementById('builderBody').innerHTML = `
        <label class="form-label" for="builderName">Program name</label>
        <input class="form-input" id="builderName" maxlength="40" value="${escapeHtml(b.name)}" placeholder="e.g. Summer Shred" oninput="builder.name = this.value">
        ${b.days.map((day, d) => `
            <div class="bd-day">
                <div class="bd-day-head">
                    <input class="form-input bd-day-name" maxlength="24" value="${escapeHtml(day.name)}" aria-label="Day name" oninput="builder.days[${d}].name = this.value">
                    ${b.days.length > 1 ? `<button class="swap-btn" onclick="removeBuilderDay(${d})">Remove day</button>` : ''}
                </div>
                ${day.exercises.length
                    ? day.exercises.map((ex, i) => builderExerciseHtml(d, i, ex)).join('')
                    : '<p class="bd-empty">No exercises yet.</p>'}
                <button class="wo-add" onclick="openExercisePicker(${d})">+ Add exercise</button>
            </div>`).join('')}
        ${b.days.length < 7 ? '<button class="btn bd-add-day" onclick="addBuilderDay()">+ Add day</button>' : ''}
        ${!b.isNew ? '<button class="btn btn-danger bd-delete" onclick="deleteCustomProgram()">Delete program</button>' : ''}
    `;
    window.scrollTo(0, scroll);
}

function builderExerciseHtml(d, i, ex) {
    const count = builder.days[d].exercises.length;
    const options = (values, current, label = v => v) =>
        values.map(v => `<option value="${v}"${String(v) === String(current) ? ' selected' : ''}>${label(v)}</option>`).join('');
    const field = name => `onchange="setBuilderField(${d}, ${i}, '${name}', this.value)"`;
    return `
        <div class="bd-ex">
            <div class="bd-ex-head">
                <div>
                    <div class="bd-ex-name">${escapeHtml(ex.name)}</div>
                    <div class="bd-ex-sub">${ex.thresholds ? 'Strength tiers included' : 'No strength tiers'}</div>
                </div>
                <div class="bd-ex-tools">
                    <button class="icon-btn" ${i === 0 ? 'disabled' : ''} onclick="moveBuilderExercise(${d}, ${i}, -1)" aria-label="Move up">${CHEVRON_UP}</button>
                    <button class="icon-btn" ${i === count - 1 ? 'disabled' : ''} onclick="moveBuilderExercise(${d}, ${i}, 1)" aria-label="Move down">${CHEVRON_DOWN}</button>
                    <button class="icon-btn" onclick="removeBuilderExercise(${d}, ${i})" aria-label="Remove">${CLOSE_ICON}</button>
                </div>
            </div>
            <div class="bd-fields">
                <label>Sets<select ${field('sets')}>${options([1, 2, 3, 4, 5, 6], ex.sets)}</select></label>
                <label>Reps<span class="bd-range"><select ${field('repMin')}>${options(REP_CHOICES, ex.repMin)}</select>–<select ${field('repMax')}>${options(REP_CHOICES, ex.repMax)}</select></span></label>
                <label>Rest<select ${field('rest')}>${options(REST_CHOICES, ex.rest, v => `${v} min`)}</select></label>
                <label>Weight<select ${field('unit')}>${UNIT_CHOICES.map(([v, l]) => `<option value="${v}"${v === ex.unit ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
            </div>
        </div>
    `;
}

function setBuilderField(d, i, name, value) {
    const ex = builder.days[d].exercises[i];
    ex[name] = name === 'unit' ? value : Number(value);
    if (name === 'repMin' && ex.repMax < ex.repMin) ex.repMax = ex.repMin;
    if (name === 'repMax' && ex.repMin > ex.repMax) ex.repMin = ex.repMax;
    // Strength standards only make sense in the unit they were written for
    if (name === 'unit') ex.thresholds = null;
    renderBuilder();
}

function moveBuilderExercise(d, i, delta) {
    haptic();
    const list = builder.days[d].exercises;
    [list[i], list[i + delta]] = [list[i + delta], list[i]];
    renderBuilder();
}

function removeBuilderExercise(d, i) {
    haptic();
    builder.days[d].exercises.splice(i, 1);
    renderBuilder();
}

function addBuilderDay() {
    haptic();
    builder.days.push({ name: `Day ${String.fromCharCode(65 + builder.days.length)}`, exercises: [] });
    renderBuilder();
}

function removeBuilderDay(d) {
    if (builder.days[d].exercises.length && !confirm(`Remove ${builder.days[d].name || 'this day'} and its exercises?`)) return;
    builder.days.splice(d, 1);
    renderBuilder();
}

function cancelBuilder() {
    if (!confirm('Leave without saving?')) return;
    builder = null;
    renderCustomProgramCards();
    showScreen('selector');
}

function saveBuilder() {
    const b = builder;
    const name = b.name.trim();
    if (!name) {
        showToast('Give your program a name');
        document.getElementById('builderName').focus();
        return;
    }
    if (b.days.some(day => !day.exercises.length)) {
        showToast('Every day needs at least one exercise');
        return;
    }
    metaFor('_customPrograms')[b.id] = {
        name,
        days: b.days.map((day, i) => day.name.trim() || `Day ${i + 1}`),
        exercises: b.days.flatMap((day, d) => day.exercises.map(e => ({ ...e, day: d }))),
    };
    registerCustomPrograms();
    builder = null;
    haptic();
    scheduleSave();
    if (b.isNew || currentProgram !== b.id) {
        selectProgram(b.id);
    } else {
        openProgram();
    }
    showToast(b.isNew ? 'Program created' : 'Program saved');
}

function deleteCustomProgram() {
    const b = builder;
    if (!confirm(`Delete "${b.name}" and all the numbers logged in it? This can't be undone.`)) return;
    delete metaFor('_customPrograms')[b.id];
    delete allData[b.id];
    registerCustomPrograms();
    if (currentProgram === b.id) currentProgram = null;
    builder = null;
    scheduleSave();
    renderCustomProgramCards();
    showScreen('selector');
    showToast('Program deleted');
}

// ── Exercise picker ──
function openExercisePicker(d) {
    haptic();
    pickerDay = d;
    document.getElementById('pickerSearch').value = '';
    document.getElementById('pickerCustom').value = '';
    renderPickerList();
    document.getElementById('pickerModal').classList.add('active');
}

function closePicker() {
    document.getElementById('pickerModal').classList.remove('active');
}

function renderPickerList() {
    const query = document.getElementById('pickerSearch').value.trim().toLowerCase();
    pickerResults = exerciseLibrary().filter(e => !query || e.name.toLowerCase().includes(query)).slice(0, 60);
    document.getElementById('pickerList').innerHTML = pickerResults.length
        ? pickerResults.map((e, i) => `
            <button class="swap-option" onclick="addLibraryExercise(${i})">
                <span>${escapeHtml(e.name)}</span><small>${escapeHtml(unitLabel(e.unit))}${e.thresholds ? ' · tiers' : ''}</small>
            </button>`).join('')
        : '<p class="bd-empty">Nothing found. Type it below to add your own.</p>';
}

function addToBuilderDay(entry) {
    const list = builder.days[pickerDay].exercises;
    const taken = new Set(builder.days.flatMap(day => day.exercises.map(e => e.id)));
    let id;
    do { id = `${slugify(entry.name)}-${randomId(4)}`; } while (taken.has(id));
    list.push({
        id, name: entry.name, unit: entry.unit || 'kg', sets: entry.sets || 3, repMin: entry.repMin || 8, repMax: entry.repMax || 12,
        rest: entry.rest || 2, thresholds: entry.thresholds || null, standardGender: entry.standardGender,
        bar: !!entry.bar, swapKey: entry.swapKey, note: entry.note || '', per: entry.per, repLabel: entry.repLabel,
    });
    haptic();
    renderBuilder();
    showToast(`Added ${entry.name}`);
}

function addLibraryExercise(i) {
    addToBuilderDay(pickerResults[i]);
}

function addCustomExercise(event) {
    event.preventDefault();
    const name = document.getElementById('pickerCustom').value.trim();
    if (!name) return;
    addToBuilderDay({ name });
    document.getElementById('pickerCustom').value = '';
}
