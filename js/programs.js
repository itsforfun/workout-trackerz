// ════════════════════════════════════════════
//  PROGRAM DEFINITIONS
// ════════════════════════════════════════════

// Every exercise has a stable `id`. Workout data is stored under it, so reordering or
// renaming exercises never moves anyone's numbers. Ids only need to be unique per program.
// `meta` is parsed for sets × reps and rest (see getPrescription); `note` is the form cue.
const PROGRAMS = {
    male: {
        name: '9-5 Beast Mode',
        subtitle: 'Push/Pull/Legs for Men',
        gender: 'male',
        heroTitle: 'WORK HARD<br>STAY HARD',
        heroSubtitle: 'Track · Progress · Dominate',
        days: ['Push', 'Pull', 'Legs'],
        exercises: [
            // Push
            { id:'db-bench', day:0, name:'DB Bench Press', meta:'4×8-10, 2-3min', unit:'kg/DB', thresholds:[20,28,36,46,56,66], note:'Shoulder blades pinned, lower to mid-chest' },
            { id:'seated-db-shoulder-press', day:0, name:'Seated DB Shoulder Press', meta:'4×8-10, 2min (SS w/ #5)', unit:'kg/DB', thresholds:[18,26,34,44,54,66], note:'Superset with the tricep extension; stop just short of lockout' },
            { id:'db-incline-press', day:0, name:'DB Incline Press', meta:'3×10-12, 2min', unit:'kg/DB', thresholds:[18,26,34,44,54,64], note:'30° bench, deep stretch at the bottom' },
            { id:'lying-cable-lateral-raise', day:0, name:'Lying Cable Lateral Raise', meta:'3×12-15, 1.5min', unit:'kg/side', thresholds:[5,8,12,16,22,30], note:'Lead with the elbow, control the way down' },
            { id:'cable-overhead-tri-ext', day:0, name:'Cable Overhead Tri Ext', meta:'3×12, 1.5min (SS w/ #2)', unit:'kg', thresholds:[18,25,34,44,56,70], note:'Elbows high and tucked, full stretch behind the head' },
            // Pull
            { id:'pull-ups', day:1, name:'Pull-Ups', meta:'4×8-10, 2-3min', unit:'reps/+kg', thresholds:[5,8,12,20,30,45], note:'Dead hang to chin over bar; add weight once 10 reps is easy' },
            { id:'db-incline-row', day:1, name:'DB Incline Row', meta:'4×10-12, 2min (SS w/ #4)', unit:'kg/DB', thresholds:[20,28,36,44,54,64], note:'Chest on the pad, drive elbows back' },
            { id:'cable-straight-arm-pulldown', day:1, name:'Cable Straight-Arm Pulldown', meta:'3×12-15, 1.5min', unit:'kg', thresholds:[15,22,30,40,52,65], note:'Slight hinge, long arms, squeeze the lats' },
            { id:'seated-db-incline-curl', day:1, name:'Seated DB Incline Curl', meta:'3×10-12, 1.5min (SS w/ #2)', unit:'kg/DB', thresholds:[8,12,16,20,26,32], note:'Arms hang behind the body, no swinging' },
            { id:'leg-extension', day:1, name:'Leg Extension', meta:'3×10, 2min', unit:'kg', thresholds:[40,60,80,100,125,150], note:'Pause and squeeze at the top' },
            // Legs
            { id:'back-squat', bar:true, day:2, name:'Barbell Back Squat', meta:'4×8-10, 3min', unit:'kg', thresholds:[80,115,155,195,240,285], note:'Brace hard and hit depth; leg press is a fine swap' },
            { id:'barbell-rdl', bar:true, day:2, name:'Barbell RDL', meta:'4×8-12, 2-3min', unit:'kg', thresholds:[60,90,120,155,195,235], note:'Hips back, bar close to the legs, soft knees' },
            { id:'lying-leg-curl', day:2, name:'Lying Leg Curl', meta:'4×10-12, 2min', unit:'kg', thresholds:[30,45,60,78,96,115], note:'Hips down on the pad, slow on the way down' },
            { id:'hip-thrust', bar:true, day:2, name:'Barbell Hip Thrust', meta:'4×10, 2min', unit:'kg', thresholds:[60,100,140,180,220,260], note:'Chin tucked, full lockout, pause at the top' },
            { id:'single-leg-calf-raise', day:2, name:'Single-Leg Calf Raise', meta:'3×12-15, 1.5min', unit:'kg/DB', thresholds:[16,24,32,42,54,70], note:'Full stretch at the bottom, pause at the top' },
            { id:'cable-crunch', day:2, name:'Cable Crunch', meta:'3×12, 1min', unit:'kg', thresholds:[15,22,30,40,52,65], note:'Curl ribs to hips; don\'t pull with the arms' },
        ]
    },
    female: {
        name: 'Hourglass Goddess',
        subtitle: 'A/B/C Split for Women',
        gender: 'female',
        heroTitle: 'HOURGLASS<br>GODDESS',
        heroSubtitle: 'Sculpt · Shape · Slay',
        days: ['Workout A', 'Workout B', 'Workout C'],
        exercises: [
            // Workout A
            { id:'kas-glute-bridge', bar:true, day:0, name:'KAS Glute Bridge', meta:'3×8-12, 2-4min', unit:'kg', thresholds:[30,50,70,95,120,145], note:'Full hip extension, pause at the top' },
            { id:'rdl', bar:true, day:0, name:'RDLs', meta:'2×8-12, 3-4min', unit:'kg', thresholds:[35,55,75,100,130,160], note:'Push hips back, slight knee bend' },
            { id:'hack-squat', day:0, name:'Hack Squat', meta:'3×8-10, 3-4min', unit:'kg', thresholds:[50,75,105,140,180,220], note:'Feet low, shoulder width' },
            { id:'leg-extension', day:0, name:'Leg Extension', meta:'3×8-10, 2-4min', unit:'kg', thresholds:[25,40,55,72,90,110], note:'Pause at the top' },
            { id:'hyperextensions', day:0, name:'Hyperextensions', meta:'3×8-10, 2-3min', unit:'kg+', thresholds:[0,5,12,20,30,42], note:'Tuck chin, hips into the pad (log added kg)' },
            { id:'standing-calf-raise-a', day:0, name:'Standing Calf Raises', meta:'3×8-10, 2-3min', unit:'kg', thresholds:[40,60,85,115,145,180], note:'Pause at the top and bottom' },
            // Workout B
            { id:'lat-pulldown-wide', day:1, name:'Lat Pulldown - Wide', meta:'3×8-10, 2-3min', unit:'kg', thresholds:[25,38,52,68,86,105], note:'Full stretch, hands over the bar' },
            { id:'barbell-row', bar:true, day:1, name:'Barbell Row', meta:'3×8-10, 2-4min', unit:'kg', thresholds:[25,38,52,68,88,108], note:'Elbows flare, pull to lower chest' },
            { id:'cable-lateral-raise', day:1, name:'Cable Lateral Raise', meta:'3×8-12, 2-3min', unit:'kg/side', thresholds:[3,5,8,12,16,22], note:'Pause at the top' },
            { id:'seated-shoulder-press', day:1, name:'Seated Shoulder Press', meta:'2×8-12, 2-3min', unit:'kg/DB', thresholds:[8,12,18,24,32,40], note:'Slight elbow flare' },
            { id:'chest-press-machine', day:1, name:'Chest Press Machine', meta:'3×8-10, 2-3min', unit:'kg/side', thresholds:[15,22,32,42,54,68], note:'Stretch at the bottom' },
            { id:'arm-isolation', day:1, name:'Arm Isolation', meta:'3×10-12, 2-3min', unit:'kg', thresholds:[10,15,22,30,38,48], note:'Alternate weekly', alternates:['Cable Curls', 'Tricep Pressdown'] },
            // Workout C
            { id:'reverse-lunge', day:2, name:'Reverse Lunge', meta:'3×8-12, 2-3min', unit:'kg/DB', thresholds:[8,14,20,28,38,48], note:'Slight forward lean, slow' },
            { id:'quad-leg-press', day:2, name:'Quad Biased Leg Press', meta:'3×8-12, 2-3min', unit:'kg', thresholds:[60,95,135,180,230,285], note:'Feet low, shoulder width' },
            { id:'seated-leg-curl', day:2, name:'Seated Leg Curl', meta:'3×8-10, 2-3min', unit:'kg', thresholds:[20,32,45,60,76,94], note:'Pause at the bottom' },
            { id:'glute-med-kickback', day:2, name:'Glute Medius Kickback', meta:'3×10-12, 2-3min', unit:'kg', thresholds:[8,14,20,28,36,46], note:'Kick out at 45°' },
            { id:'seated-cable-high-row', day:2, name:'Seated Cable High Row', meta:'2×8-12, 2-3min', unit:'kg', thresholds:[25,38,52,68,86,105], note:'Straight bar, wide grip, elbows flare' },
            { id:'standing-calf-raise-c', day:2, name:'Standing Calf Raises', meta:'3×10-12, 2-3min', unit:'kg', thresholds:[40,60,85,115,145,180], note:'Pause at the top and bottom' },
        ]
    },
    maleTotalBody: {
        name: 'Beast Mode Total Body',
        subtitle: 'Full-Body for Men (1-2x/week)',
        gender: 'male',
        heroTitle: 'TOTAL BODY<br>BEAST',
        heroSubtitle: 'Complete · Efficient · Effective',
        days: ['Full Body'],
        exercises: [
            { id:'back-squat', bar:true, day:0, name:'Barbell Back Squat', meta:'3×6-8, 3min', unit:'kg', thresholds:[80,115,155,195,240,285], note:'Brace hard and hit depth' },
            { id:'bench-press', bar:true, day:0, name:'Barbell Bench Press', meta:'3×6-8, 3min', unit:'kg', thresholds:[60,85,110,140,170,200], note:'Shoulder blades pinned, touch mid-chest' },
            { id:'barbell-row', bar:true, day:0, name:'Barbell Row (Bent-Over)', meta:'3×8-10, 2-3min', unit:'kg', thresholds:[50,70,95,120,150,180], note:'Flat back, pull to lower chest' },
            { id:'barbell-rdl', bar:true, day:0, name:'Barbell RDL', meta:'3×8-10, 2-3min', unit:'kg', thresholds:[60,90,120,155,195,235], note:'Hips back, bar close to the legs' },
            { id:'overhead-press', bar:true, day:0, name:'Barbell Overhead Press', meta:'3×6-8, 2min', unit:'kg', thresholds:[40,55,72,92,112,132], note:'Squeeze glutes, bar path close to the face' },
            { id:'pull-ups', day:0, name:'Pull-Ups', meta:'3×AMRAP, 2min', unit:'reps/+kg', thresholds:[5,8,12,20,30,45], note:'As many clean reps as possible each set' },
        ]
    },
    femaleTotalBody: {
        name: 'Goddess Total Body',
        subtitle: 'Full-Body for Women (1-2x/week)',
        gender: 'female',
        heroTitle: 'TOTAL BODY<br>GODDESS',
        heroSubtitle: 'Complete · Sculpted · Strong',
        days: ['Full Body'],
        exercises: [
            { id:'hip-thrust', bar:true, day:0, name:'Barbell Hip Thrust', meta:'3×8-10, 3min', unit:'kg', thresholds:[60,100,140,180,220,260], note:'Chin tucked, full lockout, pause at the top' },
            { id:'barbell-rdl', bar:true, day:0, name:'Barbell RDL', meta:'3×10-12, 2-3min', unit:'kg', thresholds:[35,55,75,100,130,160], note:'Push hips back, slight knee bend' },
            { id:'goblet-squat', day:0, name:'Dumbbell Goblet Squat', meta:'3×10-12, 2min', unit:'kg', thresholds:[16,24,32,42,54,68], note:'Elbows inside the knees, chest up' },
            { id:'lat-pulldown-wide', day:0, name:'Lat Pulldown (Wide Grip)', meta:'3×10-12, 2min', unit:'kg', thresholds:[25,38,52,68,86,105], note:'Full stretch, pull to upper chest' },
            { id:'db-shoulder-press', day:0, name:'Dumbbell Shoulder Press', meta:'3×10-12, 2min', unit:'kg/DB', thresholds:[8,12,18,24,32,40], note:'Slight elbow flare' },
            { id:'barbell-row', bar:true, day:0, name:'Barbell Row', meta:'3×10-12, 2min', unit:'kg', thresholds:[25,38,52,68,88,108], note:'Elbows flare, pull to lower chest' },
        ]
    },
    // Joint-friendly full body for returning lifters, fat loss first; needs no trap bar or leg press.
    // Rest: 2-3 min after the first two lifts, 60-90 s after the rest.
    fullBody3: {
        name: '3-Day Full Body',
        subtitle: 'Fat-loss full body · Mon / Wed / Fri',
        gender: 'male',
        heroTitle: 'REBUILD<br>STRONGER',
        heroSubtitle: 'Lose fat · Build muscle · Move well',
        days: ['A · Squat', 'B · Hinge', 'C · Pull'],
        coachRules: true,              // stall, layoff and effort rules (see getProgression / workoutPrefill)
        powerUnlockKg: 108.862,        // 240 lb: add low box jumps or sled pushes
        // 0 = Sunday … 6 = Saturday; numbers are lifting days (index into `days`)
        weekPlan: { 1: 0, 2: 'cardio', 3: 1, 4: 'cardio', 5: 2, 6: 'rest', 0: 'rest' },
        // Joint-friendly fat loss: easy Zone 2 on cardio days, Zone 1 walks on rest days
        cardioZones: { cardio: [2], rest: [1] },
        warmup: {
            common: [['Bike or incline walk', '4 min'], ['Couch stretch', '30 s per side']],
            days: [
                [['Single-leg balance', '2 × 30 s per leg'], ['Dead bug', '2 × 8 per side']],
                [['Slow single-leg calf raise', '2 × 12 per leg'], ['Glute bridge', '2 × 10']],
                [['Ankle wall stretch', '10 per side'], ['Standing knee march', '2 × 10 per leg']],
            ],
            note: 'Balance progression: eyes open → eyes closed → standing on a cushion.',
        },
        habits: [
            '8,000–10,000 steps',
            'Stand or walk 1–2 min every 30–60 min at the desk',
            '180–200 g protein',
            '~500 kcal below maintenance',
            '7+ hours sleep',
            'Couch stretch once during the workday',
        ],
        exercises: [
            // Day A — squat day
            { id:'goblet-box-squat', day:0, name:'Goblet Box Squat', meta:'3×6-10, 2-3min', unit:'kg/DB', thresholds:[16,24,32,40,50,60], note:'Sit back, touch the box, stand', upgrade:{ week:6, to:'Goblet Squat' } },
            { id:'incline-db-press', day:0, name:'Incline DB Press', meta:'3×8-12, 2-3min', unit:'kg/DB', thresholds:[18,26,34,44,54,64], note:'Elbows about 45°, full stretch' },
            { id:'lat-pulldown', day:0, name:'Lat Pulldown', meta:'3×8-12, 1-1.5min', unit:'kg', thresholds:[40,55,70,85,100,120], note:'Pull elbows down to the ribs' },
            { id:'seated-leg-curl', day:0, name:'Seated Leg Curl', meta:'3×10-15, 1-1.5min', unit:'kg', thresholds:[30,45,60,78,96,115], note:'Lower over 3 seconds' },
            { id:'pallof-press', day:0, name:'Pallof Press', meta:'3×10/side, 1-1.5min', unit:'kg', per:'side', thresholds:[10,15,20,27,35,45], note:'Don\'t let the torso twist' },
            // Day B — hinge day
            { id:'db-rdl', day:1, name:'DB Romanian Deadlift', meta:'3×6-10, 2-3min', unit:'kg/DB', thresholds:[20,28,36,46,56,66], note:'Push the hips back, flat back' },
            { id:'seated-db-ohp', day:1, name:'Seated DB Overhead Press', meta:'3×8-12, 2-3min', unit:'kg/DB', thresholds:[14,20,26,34,42,50], note:'Ribs down, don\'t arch' },
            { id:'chest-supported-row', day:1, name:'Chest-Supported Row', meta:'3×8-12, 1-1.5min', unit:'kg', thresholds:[30,45,60,75,90,110], note:'Squeeze the shoulder blades' },
            { id:'static-split-squat', day:1, name:'Static Split Squat', meta:'3×8/leg, 1-1.5min', unit:'kg/DB', per:'leg', thresholds:[8,14,20,28,36,46], note:'Weight through the front heel', upgrade:{ week:6, to:'Bulgarian Split Squat' } },
            { id:'reverse-incline-crunch', day:1, name:'Reverse Incline Crunch', meta:'3×10-15, 1-1.5min', unit:'reps/+kg', thresholds:[8,12,15,20,25,30], note:'Curl the hips up, not the legs' },
            // Day C — heavy pull day
            { id:'rack-pull', bar:true, day:2, name:'Barbell Rack Pull', meta:'3×5-8, 2-3min', unit:'kg', thresholds:[80,110,145,185,225,265], note:'Bar just below the kneecap. Chest up, drag the bar up the thighs', depthRule:true },
            { id:'machine-chest-press', day:2, name:'Machine Chest Press', meta:'3×8-12, 2-3min', unit:'kg', thresholds:[40,60,80,100,125,150], note:'Control the lowering (push-ups via Swap)' },
            { id:'single-arm-row', day:2, name:'Single-Arm DB Row', meta:'3×8-12, 1-1.5min', unit:'kg/DB', thresholds:[20,28,36,44,54,64], note:'Lead with the elbow (assisted pull-up via Swap)' },
            { id:'slow-step-up', day:2, name:'Step-Up, 3-Second Lowering', meta:'3×8/leg, 1-1.5min', unit:'kg/DB', per:'leg', thresholds:[8,14,20,28,36,46], note:'Don\'t push off the back foot' },
            { id:'suitcase-carry', day:2, name:'Suitcase Carry', meta:'3×30m/side, 1-1.5min', unit:'kg/DB', per:'side', repLabel:'m', thresholds:[16,24,32,40,50,60], note:'Stay tall, don\'t lean' },
        ]
    }
};

// Optional 20-minute off-day mobility for 9-5 Beast Mode, matched to the last workout day.
// 2-3 rounds, 30-45 s each.
const MOBILITY = {
    male: [
        { title: 'Post-Push', items: [['Shoulder CARs', '3/arm'], ['Lying cable lateral raise hold', '30 s light'], ['Pec doorway stretch', '30 s/side'], ["Child's pose flow", '8 breaths']] },
        { title: 'Post-Pull', items: [['Thread-the-needle', '30 s/side'], ['90/90 hip switch', '5/side'], ['Seated spinal twist', '30 s/side'], ['Wall angels', '10']] },
        { title: 'Post-Legs', items: [['Cossack squats', '6/side'], ['Ankle dorsiflexion rocks', '10/side'], ['Pigeon pose', '30 s/side'], ['Hip flexor lunge stretch', '30 s/side']] },
    ],
};

const TIERS = [
    { id:0, name:'Untested', color:'#6d5e4d', pop:'—' },
    { id:1, name:'Beginner', color:'#b0a491', pop:'~50%' },
    { id:2, name:'Novice', color:'#c98f66', pop:'~30%' },
    { id:3, name:'Intermediate', color:'#c9ced6', pop:'~15%' },
    { id:4, name:'Advanced', color:'#d9b25f', pop:'~7%' },
    { id:5, name:'Elite', color:'#e6e0d4', pop:'~2%' },
    { id:6, name:'God/Goddess', color:'#f2d891', pop:'<0.5%' },
];
const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI'];
const HEX_PATH = 'M12 2.2l8.5 4.9v9.8L12 21.8l-8.5-4.9V7.1z';

// Small hexagon in the tier colour (dashed outline when untested)
function tierIcon(tier, size = 12) {
    const color = TIERS[tier].color;
    return `<svg class="tier-hex" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
        <path d="${HEX_PATH}" fill="${color}" fill-opacity="${tier ? 0.25 : 0}" stroke="${color}" stroke-width="2"${tier ? '' : ' stroke-dasharray="3 3"'}/></svg>`;
}

// Large medal for celebrations: hexagon with a roman numeral (or short text)
function tierMedal(color, label) {
    return `<svg width="120" height="120" viewBox="0 0 24 24" aria-hidden="true">
        <defs><linearGradient id="medalFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${color}" stop-opacity="0.45"/><stop offset="1" stop-color="${color}" stop-opacity="0.08"/>
        </linearGradient></defs>
        <path d="${HEX_PATH}" fill="url(#medalFill)" stroke="${color}" stroke-width="0.9"/>
        <path d="M12 4.4l6.6 3.8v7.6L12 19.6l-6.6-3.8V8.2z" fill="none" stroke="${color}" stroke-opacity="0.35" stroke-width="0.4"/>
        <text x="12" y="13.6" text-anchor="middle" font-family="Bebas Neue, sans-serif" font-size="${label.length > 2 ? 4.4 : 5.6}" fill="${color}" letter-spacing="0.3">${escapeHtml(label)}</text>
    </svg>`;
}

function tierBadgeHtml(tier) {
    return `${tierIcon(tier)}<span>${escapeHtml(tierName(tier))}</span>`;
}

function tierName(tier) {
    if (tier === 6) return PROGRAMS[currentProgram].gender === 'male' ? 'God' : 'Goddess';
    return TIERS[tier].name;
}

// ════════════════════════════════════════════
//  PROGRAM SELECTION
// ════════════════════════════════════════════

function selectProgram(programId) {
    haptic();
    currentProgram = programId;
    openProgram();
    scheduleSave(); // remember the choice
}

function openProgram() {
    const prog = PROGRAMS[currentProgram];
    document.getElementById('programTitle').textContent = prog.name;
    document.getElementById('programSubtitle').textContent = prog.subtitle;

    todayDay = null;
    todayWeek = null;
    todayMode = null;
    switchTab('today');
    setSaveStatus(offlineMode ? 'offline' : savePending ? 'pending' : 'saved');
    showScreen('app');
}

async function switchProgram() {
    if (activeWorkout && !confirm('You have a workout in progress. Switching programs discards it. Continue?')) return;
    clearActiveWorkout();
    // No reload: just forget the current program and go back to the menu.
    // Every program's numbers stay stored under its own key.
    currentProgram = null;
    showScreen('selector');
    await saveToCloud();
}

// Rebuild whatever depends on units, bodyweight or data
function refreshAllViews() {
    if (!currentProgram) return;
    const activePage = document.querySelector('.page.active');
    if (activePage && activePage.id === 'page-today') renderToday();
    if (activePage && activePage.id === 'page-progress') renderProgress();
}

// ════════════════════════════════════════════
//  ENTRIES, PRESCRIPTIONS & PROGRESSION
// ════════════════════════════════════════════

function entryKg(entry) {
    return entry && typeof entry === 'object' ? entry.kg : entry;
}

function entrySets(entry) {
    return entry && typeof entry === 'object' && Array.isArray(entry.sets) ? entry.sets : null;
}

function getExercise(exId) {
    return PROGRAMS[currentProgram].exercises.find(ex => ex.id === exId);
}

// Parse "4×8-10, 2-3min" → { sets: 4, repMin: 8, repMax: 10, restSec: 120, restText: '2-3 min' }
function getPrescription(ex) {
    const m = ex.meta.match(/(\d+)×(?:(\d+)(?:-(\d+))?|AMRAP)/);
    const r = ex.meta.match(/([\d.]+)(?:-([\d.]+))?min/);
    const repMin = m && m[2] ? +m[2] : null;
    return {
        sets: m ? +m[1] : 3,
        repMin,
        repMax: m && m[3] ? +m[3] : repMin,
        restSec: r ? Math.round(parseFloat(r[1]) * 60) : 120,
        restText: r ? `${r[1]}${r[2] ? '–' + r[2] : ''} min` : '',
    };
}

function prescriptionText(ex) {
    const p = getPrescription(ex);
    if (!p.repMin) return `${p.sets} sets to failure (AMRAP)`;
    const reps = p.repMin === p.repMax ? p.repMin : `${p.repMin}–${p.repMax}`;
    return `${p.sets} sets of ${reps}${ex.repLabel === 'm' ? 'm' : ' reps'}${ex.per ? ` per ${ex.per}` : ''}`;
}

// "Cable Curls" in odd weeks, "Tricep Pressdown" in even weeks
function exerciseDisplayName(ex, week) {
    return ex.alternates ? `${ex.name} — ${ex.alternates[week % 2]}` : ex.name;
}

// The most recent week this exercise was logged with sets × reps
function getLastSetsEntry(exId) {
    const weeks = progData()[exId] || {};
    for (let w = WEEKS - 1; w >= 0; w--) {
        const sets = entrySets(weeks[w]);
        if (sets && sets.length && !weeks[w].deload) return { week: w, entry: weeks[w] };
    }
    return null;
}

// Weight jumps when the top of the rep range is hit on every set
const KG_INCREMENT = { 'kg': 2.5, 'kg/DB': 2, 'kg/side': 1, 'kg+': 2.5, 'reps/+kg': 2.5, 'kg assist': 2.5 };
const LB_INCREMENT = { 'kg': 5, 'kg/DB': 5, 'kg/side': 2.5, 'kg+': 5, 'reps/+kg': 5, 'kg assist': 5 };

function incrementKg(ex) {
    return usesLb() ? LB_INCREMENT[ex.unit] / LB_PER_KG : KG_INCREMENT[ex.unit];
}

function formatSetWeight(ex, kg) {
    return `${kgToDisplay(kg)} ${setWeightUnit(ex)}`;
}

// Progression badge for an exercise, based on the last logged sets:
//   kg    → every set hit the top of the range: add weight
//   reps  → in the range: same weight, more reps
//   sets  → fewer sets than prescribed last time
//   retry → a set fell below the range: repeat the weight
// Returns null when there are no sets logged yet.
function getProgression(ex) {
    const p = getPrescription(ex);
    const last = getLastSetsEntry(ex.id);
    if (!last) return null;
    const sets = entrySets(last.entry).filter(s => parseInt(s.reps) > 0);
    if (!sets.length) return null;

    // Assisted machines: less assistance is progress
    const weights = sets.map(s => parseFloat(s.kg) || 0);
    const topKg = ex.assist ? Math.min(...weights) : Math.max(...weights);
    const reps = sets.map(s => parseInt(s.reps));
    // Effort ratings (reps in reserve) refine every rule below when the sets were rated
    const rir = averageRir(sets);
    const step = usesLb() ? LB_INCREMENT[ex.unit] : KG_INCREMENT[ex.unit];
    const unitShort = usesLb() ? 'lb' : 'kg';
    const weighted = !ex.assist && !isRepsBased(ex);

    if (p.repMin && reps.some(r => r < p.repMin)) {
        if (weighted && rir !== null && rir <= 0.5 && topKg > incrementKg(ex)) {
            const lower = Math.round((topKg - incrementKg(ex)) * 1000) / 1000;
            return { type: 'retry', label: `−${formatNum(step)}${unitShort}`, kg: lower, reps: p.repMin,
                text: `Missed ${p.repMin} reps at max effort: drop to ${formatSetWeight(ex, lower)} and rebuild` };
        }
        return { type: 'retry', label: 'retry', kg: topKg, reps: p.repMin,
            text: `A set fell short of ${p.repMin} reps — repeat ${formatSetWeight(ex, topKg)}` };
    }
    if (sets.length < p.sets) {
        return { type: 'sets', label: 'sets', kg: topKg, reps: p.repMax,
            text: `Complete all ${p.sets} sets at ${formatSetWeight(ex, topKg)}` };
    }
    if (p.repMax && reps.every(r => r >= p.repMax)) {
        if (weighted && rir !== null && rir <= 0.25) {
            return { type: 'reps', label: 'own it', kg: topKg, reps: p.repMax,
                text: `${p.repMax} reps on every set, but all at max effort: repeat ${formatSetWeight(ex, topKg)} until it moves smoother` };
        }
        if (weighted && rir !== null && rir >= 3) {
            const jump = Math.round((topKg + 2 * incrementKg(ex)) * 1000) / 1000;
            return { type: 'kg', label: `+${formatNum(2 * step)}${unitShort}`, kg: jump, reps: p.repMin,
                text: `${p.repMax} reps on every set with reps to spare: jump to ${formatSetWeight(ex, jump)}` };
        }
        if (ex.assist) {
            const less = Math.max(0, Math.round((topKg - incrementKg(ex)) * 1000) / 1000);
            return { type: 'kg', label: `−${formatNum(step)}${unitShort}`, kg: less, reps: p.repMin,
                text: `Hit ${p.repMax} reps on every set — drop the assistance to ${formatSetWeight(ex, less)}` };
        }
        const next = Math.round((topKg + incrementKg(ex)) * 1000) / 1000;
        return { type: 'kg', label: `+${formatNum(step)}${unitShort}`, kg: next, reps: p.repMin,
            text: ex.depthRule
                ? `${p.sets} × ${p.repMax} clean — lower the bar one notch next time, or go up to ${formatSetWeight(ex, next)}`
                : `Hit ${p.repMax} reps on every set — go up to ${formatSetWeight(ex, next)}` };
    }
    // Every set in range and it felt easy: add weight now rather than waiting for the top of the range
    if (weighted && rir !== null && rir >= 3 && p.repMin && reps.every(r => r >= p.repMin)) {
        const next = Math.round((topKg + incrementKg(ex)) * 1000) / 1000;
        return { type: 'kg', label: `+${formatNum(step)}${unitShort}`, kg: next, reps: p.repMin,
            text: `Every set felt easy: go up to ${formatSetWeight(ex, next)}` };
    }
    // Same weight three sessions running → hold it and chase one more rep
    if (isStalled(ex.id)) {
        return { type: 'reps', label: 'stall', kg: topKg, reps: Math.min(Math.max(...reps) + 1, p.repMax || 99),
            text: `Same weight 3 sessions running — hold ${formatSetWeight(ex, topKg)} and chase +1 rep` };
    }
    const best = Math.max(...reps);
    return { type: 'reps', label: 'reps', kg: topKg, reps: p.repMax || best + 1,
        text: p.repMax ? `Same weight, push for ${p.repMax} reps` : `Beat last time: ${best} reps` };
}

// True when the last three logged sessions all used the same top weight
function isStalled(exId) {
    const weeks = progData()[exId] || {};
    const tops = [];
    for (let w = WEEKS - 1; w >= 0 && tops.length < 3; w--) {
        const sets = entrySets(weeks[w]);
        if (sets && sets.length && !weeks[w].deload) tops.push(Math.max(...sets.map(s => parseFloat(s.kg) || 0)));
    }
    return tops.length === 3 && tops.every(t => t === tops[0]);
}

function progressionBadge(prog) {
    if (!prog) return '';
    return `<span class="prog-badge ${prog.type}" title="${escapeHtml(prog.text)}"><span>${escapeHtml(prog.label)}</span></span>`;
}

// ── Cycle weeks ──

// Week 1 starts the day the cycle starts. Older data without a start date
// continues after the last week that has numbers in it.
function getCurrentWeek() {
    const start = metaFor('_cycleStart')[currentProgram];
    if (start) return Math.max(0, Math.min(WEEKS - 1, Math.floor(daysBetween(start, todayStr()) / 7)));
    return Math.min(WEEKS - 1, highestLoggedWeek() + 1);
}

function highestLoggedWeek() {
    let highest = -1;
    Object.values(progData()).forEach(weeks => {
        Object.keys(weeks || {}).forEach(w => {
            if (isIndexKey(w) && entryKg(weeks[w]) !== '' && +w > highest) highest = +w;
        });
    });
    return highest;
}

function ensureCycleStart(week) {
    const starts = metaFor('_cycleStart');
    if (!starts[currentProgram]) starts[currentProgram] = addDays(todayStr(), -7 * week);
}

// ════════════════════════════════════════════
//  LIFT LOG (Progress → a lift → Log): the 12 weeks of one lift, typed or fixed by hand
// ════════════════════════════════════════════

// Tier per exercise as last shown, so we only celebrate real tier-ups
let knownTiers = {};

function renderLiftLog() {
    const grid = document.getElementById('liftLog');
    const ex = PROGRAMS[currentProgram] && PROGRAMS[currentProgram].exercises.find(e => e.id === progressExerciseId);
    if (!grid || !ex) return;
    const weeks = progData()[ex.id] || {};
    let html = '';
    for (let w = 0; w < WEEKS; w++) {
        const raw = entryKg(weeks[w]);
        const val = raw !== undefined && raw !== '' ? trackerToDisplay(ex, raw) : '';
        html += `
            <div class="week-col">
                <div class="week-label">W${w + 1}</div>
                <div class="week-input-wrap">
                    <input type="text" inputmode="decimal" placeholder="—" value="${escapeHtml(val)}"
                        id="inp_${ex.id}_${w}" oninput="onInput('${ex.id}',${w},this)" onchange="onInputDone('${ex.id}')"
                        class="${val ? 'filled' : ''}">
                    <div class="input-hint" id="hint_${ex.id}_${w}"></div>
                </div>
            </div>`;
    }
    grid.innerHTML = html;
    updateWeekHints(ex.id);
    knownTiers[ex.id] = getTier(ex, getBestKg(ex.id));
}

// Under each week: the reps logged in workout mode (e.g. "10·10·9"), "PR" on the best week, else the unit
function updateWeekHints(exId) {
    const ex = getExercise(exId);
    const weeks = progData()[exId] || {};
    const logged = getLoggedWeeks(exId);
    const best = logged.length > 1 ? Math.max(...logged.map(l => l.value)) : null;
    const prWeek = best === null ? -1 : logged.find(l => l.value === best).week;

    for (let w = 0; w < WEEKS; w++) {
        const hint = document.getElementById(`hint_${exId}_${w}`);
        const input = document.getElementById(`inp_${exId}_${w}`);
        if (!hint) continue;
        const sets = entrySets(weeks[w]);
        let text = trackerUnit(ex);
        if (sets && sets.length) text = sets.map(s => s.reps).join('·');
        if (w === prWeek) text = 'PR';
        hint.textContent = text;
        hint.classList.toggle('pr', w === prWeek);
        input.classList.toggle('pr', w === prWeek);
    }
}

// ════════════════════════════════════════════
//  TIER SYSTEM
// ════════════════════════════════════════════

function getTier(exercise, kg) {
    if (!kg || isNaN(kg) || kg <= 0) return 0;
    const thresholds = getThresholds(exercise);
    if (!thresholds) return 0;
    for (let i = thresholds.length - 1; i >= 0; i--) {
        if (kg >= thresholds[i]) return i + 1;
    }
    return 0;
}

function getBestKg(exId) {
    const logged = getLoggedWeeks(exId);
    return logged.length ? Math.max(...logged.map(l => l.value)) : null;
}

function updateBadge(exId) {
    const tier = getTier(getExercise(exId), getBestKg(exId));
    const color = TIERS[tier].color;
    const badge = document.getElementById(`badge_${exId}`);
    if (badge) {
        badge.style.display = getExercise(exId).thresholds ? '' : 'none';
        badge.innerHTML = tierBadgeHtml(tier);
        badge.style.color = color;
        badge.style.borderColor = color;
    }
}
