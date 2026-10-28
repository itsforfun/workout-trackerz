// ════════════════════════════════════════════
//  EXERCISE GUIDE: a drawn demo, muscles, how-to cues and mistakes for every exercise
// ════════════════════════════════════════════

// Each exercise maps to a movement (first matching rule wins; order matters, e.g. leg curl before curl).
const GUIDE_RULES = [
    [/calf/, 'calf'],
    [/leg press/, 'legpress'],
    [/split squat|lunge|bulgarian/, 'lunge'],
    [/step-up/, 'stepup'],
    [/goblet/, 'squat'],
    [/squat/, 'squatBar'],
    [/hip thrust|glute bridge/, 'bridge'],
    [/kickback|abduction/, 'abduction'],
    [/rdl|romanian|deadlift|rack pull|pull-through/, 'hinge'],
    [/hyperextension|back extension/, 'backext'],
    [/single-leg extension|leg extension/, 'legext'],
    [/seated leg curl/, 'legcurlSeated'],
    [/leg curl/, 'legcurl'],
    [/lateral raise/, 'lateral'],
    [/face pull/, 'facepull'],
    [/fly/, 'fly'],
    [/pullover|straight-arm/, 'pullover'],
    [/pull-up|chin-up/, 'vpull'],
    [/pulldown/, 'pulldown'],
    [/row/, 'row'],
    [/overhead extension|overhead cable extension|overhead tri|skull/, 'overheadTri'],
    [/pressdown|tricep/, 'pressdown'],
    [/curl|arm isolation/, 'curl'],
    [/incline.*press|landmine/, 'incline'],
    [/overhead press|shoulder press|arnold/, 'vpress'],
    [/push-up/, 'pushup'],
    [/bench|chest press|db press/, 'press'],
    [/knee raise|reverse incline crunch/, 'kneeraise'],
    [/crunch/, 'crunch'],
    [/pallof|anti-rotation/, 'pallof'],
    [/dead bug/, 'deadbug'],
    [/carry|hold/, 'carry'],
];

function guideMove(name) {
    const n = String(name || '').toLowerCase();
    const rule = GUIDE_RULES.find(([re]) => re.test(n));
    return rule ? rule[1] : null;
}

// What to feel and how to move. `content` lets a movement reuse another's text.
const GUIDE_TEXT = {
    squat: {
        muscles: [['Quads', 'Glutes'], ['Adductors', 'Core']],
        cues: ['Brace your core before you go down', 'Sit down between your heels, knees over your toes', 'Drive the floor away and stand tall'],
        avoid: ['Knees caving inward', 'Heels lifting or the back rounding at the bottom'],
    },
    hinge: {
        muscles: [['Hamstrings', 'Glutes'], ['Lower back', 'Upper back', 'Forearms']],
        cues: ['Push your hips back as if closing a door behind you', 'Keep the weight close to your legs', 'Stand up by squeezing your glutes, not by leaning back'],
        avoid: ['Rounding your back to reach lower', 'Bending the knees into a squat'],
    },
    bridge: {
        muscles: [['Glutes'], ['Hamstrings', 'Core']],
        cues: ['Chin tucked, ribs down', 'Drive through your heels', 'Squeeze your glutes and pause at the top'],
        avoid: ['Arching your lower back at the top', 'Feet too far from your hips'],
    },
    press: {
        muscles: [['Chest', 'Triceps'], ['Front delts']],
        cues: ['Shoulder blades squeezed together and down', 'Lower with control to the middle of your chest', 'Press up with wrists over elbows'],
        avoid: ['Elbows flared straight out to the sides', 'Bouncing the weight off your chest'],
    },
    pushup: {
        muscles: [['Chest', 'Triceps'], ['Front delts', 'Core']],
        cues: ['One straight line from head to heels', 'Hands just under your shoulders', 'Lower until your chest nearly touches the floor'],
        avoid: ['Hips sagging', 'Elbows flared wide'],
    },
    incline: {
        muscles: [['Upper chest', 'Front delts'], ['Triceps']],
        cues: ['Bench at about 30 degrees', 'Lower to your upper chest', 'Press up in line with your shoulders'],
        avoid: ['Bench so steep it becomes a shoulder press', 'Losing the shoulder-blade squeeze'],
    },
    vpress: {
        muscles: [['Front delts', 'Triceps'], ['Side delts', 'Upper chest']],
        cues: ['Squeeze your glutes and keep your ribs down', 'Press straight up, close to your face', 'Finish with your arms by your ears'],
        avoid: ['Leaning back and arching', 'Pressing forward instead of up'],
    },
    lateral: {
        muscles: [['Side delts'], ['Traps']],
        cues: ['Slight bend in the elbows', 'Lead with the elbows up to shoulder height', 'Lower slowly'],
        avoid: ['Swinging the weight up', 'Shrugging your shoulders to your ears'],
    },
    vpull: {
        muscles: [['Lats', 'Biceps'], ['Upper back', 'Forearms']],
        cues: ['Start from a full hang with active shoulders', 'Pull your elbows down to your ribs', 'Chin over the bar, then lower with control'],
        avoid: ['Kicking or swinging', 'Half reps that never straighten the arms'],
    },
    pulldown: {
        muscles: [['Lats', 'Biceps'], ['Upper back', 'Forearms']],
        cues: ['Thighs locked under the pad', 'Pull the bar to your upper chest, chest up', 'Let it rise slowly to a full stretch'],
        avoid: ['Leaning far back to move the weight', 'Pulling the bar behind your neck'],
    },
    row: {
        muscles: [['Upper back', 'Lats'], ['Biceps', 'Rear delts']],
        cues: ['Flat back, chest proud', 'Drive your elbows back and squeeze your shoulder blades', 'Lower until your arms are straight'],
        avoid: ['Jerking the weight with your lower back', 'Shrugging instead of pulling with the elbows'],
    },
    curl: {
        muscles: [['Biceps'], ['Forearms']],
        cues: ['Elbows pinned to your sides', 'Curl up without swinging', 'Lower all the way down slowly'],
        avoid: ['Swinging with your back', 'Elbows drifting forward'],
    },
    pressdown: {
        muscles: [['Triceps'], []],
        cues: ['Elbows fixed at your sides', 'Push down until your arms are straight', 'Control the way back up'],
        avoid: ['Elbows moving forward and back', 'Leaning over the weight'],
    },
    overheadTri: {
        muscles: [['Triceps'], []],
        cues: ['Elbows pointing up, close to your head', 'Lower behind your head for a deep stretch', 'Straighten your arms fully'],
        avoid: ['Elbows flaring wide', 'Arching your lower back'],
    },
    legext: {
        muscles: [['Quads'], []],
        cues: ['Back against the pad, knee in line with the machine pivot', 'Straighten fully and squeeze for a second', 'Lower slowly'],
        avoid: ['Kicking the weight up', 'Hips lifting off the seat'],
    },
    legcurl: {
        muscles: [['Hamstrings'], ['Calves']],
        cues: ['Hips pressed into the pad', 'Curl your heels toward your glutes', 'Lower slowly to a full stretch'],
        avoid: ['Hips rising off the pad', 'Dropping the weight on the way down'],
    },
    calf: {
        muscles: [['Calves'], []],
        cues: ['Full stretch at the bottom', 'Rise onto the balls of your feet', 'Pause at the top'],
        avoid: ['Bouncing through short reps', 'Bending the knees to help'],
    },
    lunge: {
        muscles: [['Quads', 'Glutes'], ['Adductors', 'Core']],
        cues: ['A stance long enough to keep the front shin fairly upright', 'Lower straight down until the back knee nearly touches the floor', 'Push through the front heel'],
        avoid: ['Front knee caving inward', 'Pushing off the back foot'],
    },
    stepup: {
        muscles: [['Quads', 'Glutes'], ['Calves']],
        cues: ['Whole foot on the box', 'Step up by pushing through the front heel', 'Lower over three seconds'],
        avoid: ['Pushing off the back foot', 'A box so high your hip drops below your knee'],
    },
    crunch: {
        muscles: [['Abs'], ['Obliques']],
        cues: ['Keep your hips still', 'Curl your ribs toward your hips', 'Breathe out as you crunch'],
        avoid: ['Pulling with your arms', 'Sitting back on your heels'],
    },
    kneeraise: {
        muscles: [['Abs', 'Hip flexors'], ['Forearms']],
        cues: ['Start still, with no swing', 'Curl your hips up, not just your knees', 'Lower slowly'],
        avoid: ['Swinging for momentum', 'Lifting the knees without curling the pelvis'],
    },
    pallof: {
        muscles: [['Core', 'Obliques'], ['Glutes']],
        cues: ['Stand side-on to the cable, feet hip-width', 'Press the handle straight out from your chest', 'Hold and resist the twist'],
        avoid: ['Letting your torso rotate', 'Standing so close there is no tension'],
    },
    deadbug: {
        muscles: [['Core'], ['Hip flexors']],
        cues: ['Lower back pressed into the floor', 'Extend the opposite arm and leg slowly', 'Breathe out as you reach'],
        avoid: ['Lower back lifting off the floor', 'Rushing the reps'],
    },
    carry: {
        muscles: [['Core', 'Obliques', 'Forearms'], ['Traps', 'Glutes']],
        cues: ['Stand tall, shoulders level', 'Grip hard and walk with short, steady steps', 'Don\'t let the weight pull you sideways'],
        avoid: ['Leaning toward or away from the weight', 'Shrugging the loaded shoulder'],
    },
    backext: {
        muscles: [['Lower back', 'Glutes'], ['Hamstrings']],
        cues: ['Pad just below your hip bones', 'Lower with a long spine', 'Rise until your body is in a straight line'],
        avoid: ['Arching past straight at the top', 'Jerking up fast'],
    },
    abduction: {
        muscles: [['Glute medius'], ['Glutes']],
        cues: ['Stand tall, hips square', 'Move the leg out at about 45 degrees', 'Pause, then return slowly'],
        avoid: ['Leaning your torso to fake the range', 'Turning your toes up'],
    },
    fly: {
        muscles: [['Chest'], ['Front delts']],
        cues: ['Soft, fixed bend in the elbows', 'Sweep your hands up and together, like a hug', 'Return slowly to a stretch'],
        avoid: ['Bending the elbows into a press', 'Shoulders rolling forward'],
    },
    pullover: {
        muscles: [['Lats'], ['Triceps', 'Core']],
        cues: ['Arms long, elbows slightly bent', 'Sweep your hands down to your thighs', 'Squeeze your lats at the bottom'],
        avoid: ['Bending the elbows into a pushdown', 'Rounding your back'],
    },
    facepull: {
        muscles: [['Rear delts', 'Upper back'], ['Rotator cuff']],
        cues: ['Rope at face height', 'Pull toward your forehead, elbows high', 'Pull the rope apart at the end'],
        avoid: ['Elbows dropping into a row', 'Leaning back to move the weight'],
    },
    legpress: {
        muscles: [['Quads', 'Glutes'], ['Adductors']],
        cues: ['Lower back flat against the pad', 'Lower until your knees come toward your chest', 'Push through your whole foot without locking your knees'],
        avoid: ['Hips curling off the seat at the bottom', 'Snapping the knees straight at the top'],
    },
};
GUIDE_TEXT.squatBar = GUIDE_TEXT.squat;
GUIDE_TEXT.legcurlSeated = GUIDE_TEXT.legcurl;

// ── Demos: a line figure moving between two poses (side view facing right, or front view) ──
const SIDE_BASE = { h: [100, 40], s: [100, 58], e: [100, 84], w: [100, 108], p: [100, 110], k: [100, 146], a: [100, 182], t: [114, 184] };
const FRONT_BASE = {
    h: [100, 38], s1: [84, 58], s2: [116, 58], e1: [82, 84], e2: [118, 84], w1: [80, 108], w2: [120, 108],
    p1: [92, 110], p2: [108, 110], k1: [92, 146], k2: [108, 146], a1: [92, 182], a2: [108, 182],
};
const SIDE_LIMBS = [['s', 'p'], ['s', 'e'], ['e', 'w'], ['p', 'k'], ['k', 'a'], ['a', 't']];
const BACK_LEG = [['p', 'k2'], ['k2', 'a2'], ['a2', 't2']];
const FRONT_LIMBS = [['s1', 's2'], ['n', 'pm'], ['p1', 'p2'], ['s1', 'e1'], ['e1', 'w1'], ['s2', 'e2'], ['e2', 'w2'], ['p1', 'k1'], ['k1', 'a1'], ['p2', 'k2'], ['k2', 'a2']];

// a / b: the two poses (joints that move); props: equipment drawn in gold or as faint scenery.
// A point is a joint name, a fixed [x, y], or { j, d: [dx, dy] } (offset from a joint).
const GUIDE_DEMOS = {
    squat: { a: { e: [108, 82], w: [112, 62] },
        b: { p: [72, 140], k: [106, 148], s: [98, 95], h: [104, 78], e: [106, 120], w: [112, 100] },
        props: [{ type: 'db', at: 'w' }] },
    squatBar: { a: { e: [86, 72], w: [96, 56] },
        b: { p: [72, 140], k: [106, 148], s: [98, 95], h: [104, 78], e: [84, 109], w: [94, 93] },
        props: [{ type: 'plate', at: 'w' }] },
    hinge: { a: {},
        b: { p: [76, 112], k: [94, 146], s: [124, 88], h: [140, 82], e: [124, 114], w: [124, 138] },
        props: [{ type: 'plate', at: 'w' }] },
    bridge: { base: { h: [34, 140], s: [50, 146], a: [138, 182], t: [152, 184] },
        a: { p: [94, 174], k: [124, 152], e: [72, 160], w: [94, 170] },
        b: { p: [102, 146], k: [138, 146], e: [74, 150], w: [98, 146] },
        props: [{ type: 'line', from: [14, 154], to: [62, 154], faint: true }, { type: 'plate', at: 'w' }] },
    press: { base: { h: [50, 138], s: [68, 140], p: [120, 140], k: [152, 148], a: [150, 184], t: [164, 184] },
        a: { e: [68, 114], w: [68, 90] },
        b: { e: [88, 154], w: [86, 130] },
        props: [{ type: 'line', from: [30, 150], to: [150, 150], faint: true }, { type: 'db', at: 'w' }] },
    pushup: { base: { a: [40, 180], t: [30, 184], w: [156, 182] },
        a: { k: [74, 166], p: [108, 152], s: [156, 130], h: [172, 124], e: [156, 156] },
        b: { k: [74, 177], p: [108, 172], s: [158, 166], h: [176, 160], e: [134, 176] } },
    incline: { base: { p: [70, 150], s: [100, 108], h: [108, 92], k: [104, 156], a: [104, 184], t: [118, 184] },
        a: { e: [104, 82], w: [108, 58] },
        b: { e: [80, 122], w: [92, 102] },
        props: [{ type: 'line', from: [58, 162], to: [96, 100], faint: true }, { type: 'db', at: 'w' }] },
    vpress: { a: { e: [108, 82], w: [112, 58] },
        b: { e: [106, 34], w: [108, 10] },
        props: [{ type: 'db', at: 'w' }] },
    lateral: { view: 'front',
        a: {},
        b: { e1: [60, 62], w1: [38, 64], e2: [140, 62], w2: [162, 64] },
        props: [{ type: 'db', at: 'w1' }, { type: 'db', at: 'w2' }] },
    vpull: { view: 'front',
        a: { h: [100, 52], s1: [84, 66], s2: [116, 66], e1: [74, 42], e2: [126, 42], w1: [66, 18], w2: [134, 18],
            p1: [92, 116], p2: [108, 116], k1: [92, 150], k2: [108, 150], a1: [94, 182], a2: [106, 182] },
        b: { h: [100, 18], s1: [84, 34], s2: [116, 34], e1: [62, 40], e2: [138, 40], w1: [66, 18], w2: [134, 18],
            p1: [92, 84], p2: [108, 84], k1: [92, 118], k2: [108, 118], a1: [94, 150], a2: [106, 150] },
        props: [{ type: 'line', from: [44, 16], to: [156, 16], gold: true }] },
    pulldown: { view: 'front',
        base: { k1: [88, 140], k2: [112, 140], a1: [88, 176], a2: [112, 176] },
        a: { e1: [74, 42], e2: [126, 42], w1: [66, 18], w2: [134, 18] },
        b: { e1: [64, 84], e2: [136, 84], w1: [70, 58], w2: [130, 58] },
        props: [{ type: 'line', from: { j: 'w1', d: [-12, 0] }, to: { j: 'w2', d: [12, 0] }, gold: true },
            { type: 'line', from: [100, 0], to: { j: 'w1', d: [34, 0] }, faint: true }] },
    row: { base: { p: [80, 112], k: [92, 146], a: [98, 182], t: [112, 184], s: [126, 86], h: [142, 80] },
        a: { e: [126, 112], w: [126, 136] },
        b: { e: [102, 96], w: [118, 114] },
        props: [{ type: 'plate', at: 'w' }] },
    curl: { a: {}, b: { w: [114, 64] }, props: [{ type: 'db', at: 'w' }] },
    pressdown: { a: { w: [118, 70] }, b: { w: [104, 108] },
        props: [{ type: 'line', from: 'w', to: [124, 0], faint: true }, { type: 'db', at: 'w', small: true }] },
    overheadTri: { a: { e: [108, 32], w: [94, 52] }, b: { e: [108, 32], w: [112, 8] }, props: [{ type: 'db', at: 'w' }] },
    legext: { base: { p: [90, 130], s: [84, 78], h: [84, 60], k: [126, 130], e: [86, 104], w: [98, 124] },
        a: { a: [128, 166], t: [142, 168] },
        b: { a: [162, 124], t: [170, 112] },
        props: [{ type: 'line', from: [66, 140], to: [128, 140], faint: true }, { type: 'line', from: { j: 'a', d: [-2, -8] }, to: { j: 'a', d: [6, 8] }, gold: true }] },
    legcurl: { base: { h: [30, 124], s: [46, 130], p: [98, 130], k: [134, 130], e: [40, 152], w: [60, 156] },
        a: { a: [170, 130], t: [176, 142] },
        b: { a: [150, 96], t: [162, 92] },
        props: [{ type: 'line', from: [20, 140], to: [146, 140], faint: true }, { type: 'line', from: { j: 'a', d: [-6, -6] }, to: { j: 'a', d: [6, 6] }, gold: true }] },
    calf: { a: {},
        b: { a: [100, 172], k: [100, 136], p: [100, 100], s: [100, 48], h: [100, 30], e: [100, 74], w: [100, 98] },
        props: [{ type: 'db', at: 'w' }, { type: 'line', from: [90, 186], to: [132, 186], faint: true }] },
    lunge: { legs: 2,
        a: { p: [100, 108], k: [114, 144], a: [118, 182], t: [132, 184], k2: [88, 144], a2: [74, 174], t2: [66, 184], s: [102, 56], h: [102, 38], e: [102, 82], w: [102, 106] },
        b: { p: [100, 136], k: [134, 146], a: [122, 182], t: [136, 184], k2: [92, 174], a2: [62, 176], t2: [54, 184], s: [102, 84], h: [102, 66], e: [102, 110], w: [102, 134] },
        props: [{ type: 'db', at: 'w' }] },
    stepup: { legs: 2,
        a: { p: [96, 114], k: [130, 122], a: [130, 158], t: [144, 158], k2: [94, 148], a2: [92, 182], t2: [106, 184], s: [100, 62], h: [102, 44], e: [100, 88], w: [100, 112] },
        b: { p: [128, 84], k: [132, 120], a: [130, 158], t: [144, 158], k2: [124, 120], a2: [118, 152], t2: [130, 156], s: [130, 32], h: [132, 14], e: [130, 58], w: [130, 82] },
        props: [{ type: 'rect', x: 112, y: 160, w: 52, h: 24 }, { type: 'db', at: 'w' }] },
    crunch: { base: { k: [110, 182], a: [70, 182], t: [60, 184], p: [110, 146] },
        a: { s: [106, 94], h: [104, 76], e: [118, 104], w: [110, 80] },
        b: { s: [140, 124], h: [150, 138], e: [128, 148], w: [146, 134] },
        props: [{ type: 'line', from: 'w', to: [100, 0], faint: true }] },
    kneeraise: { base: { w: [102, 14], e: [102, 38], s: [100, 62], h: [108, 48], p: [100, 114] },
        a: { k: [100, 150], a: [100, 186], t: [110, 190] },
        b: { k: [130, 96], a: [128, 132], t: [140, 134] },
        props: [{ type: 'line', from: [60, 12], to: [140, 12], gold: true }] },
    pallof: { a: { e: [108, 82], w: [124, 64] }, b: { e: [124, 60], w: [148, 60] },
        props: [{ type: 'line', from: 'w', to: [198, 62], faint: true }, { type: 'db', at: 'w', small: true }] },
    deadbug: { base: { h: [50, 146], s: [66, 150], p: [118, 150] },
        a: { e: [68, 124], w: [70, 100], k: [124, 114], a: [160, 114], t: [166, 104] },
        b: { e: [42, 144], w: [18, 140], k: [152, 144], a: [188, 146], t: [196, 138] },
        props: [{ type: 'line', from: [10, 160], to: [196, 160], faint: true }] },
    carry: { legs: 2,
        a: { k: [104, 146], a: [108, 182], t: [122, 184], k2: [96, 146], a2: [92, 182], t2: [106, 184], w: [104, 108] },
        b: { k: [96, 146], a: [92, 182], t: [106, 184], k2: [104, 146], a2: [108, 182], t2: [122, 184], w: [104, 108] },
        props: [{ type: 'db', at: 'w' }] },
    backext: { base: { p: [100, 120], k: [125, 145], a: [150, 170], t: [160, 162] },
        a: { s: [110, 170], h: [116, 186], e: [106, 150], w: [112, 160] },
        b: { s: [63, 83], h: [51, 71], e: [70, 104], w: [82, 92] },
        props: [{ type: 'line', from: [88, 134], to: [110, 112], gold: true }, { type: 'line', from: [146, 178], to: [164, 160], faint: true }] },
    abduction: { view: 'front', base: { e1: [78, 84], e2: [122, 84], w1: [90, 106], w2: [110, 106] },
        a: {}, b: { k2: [118, 144], a2: [134, 178] } },
    fly: { view: 'front',
        a: { e1: [72, 92], w1: [62, 112], e2: [128, 92], w2: [138, 112] },
        b: { e1: [76, 80], w1: [96, 74], e2: [124, 80], w2: [104, 74] },
        props: [{ type: 'line', from: 'w1', to: [8, 184], faint: true }, { type: 'line', from: 'w2', to: [192, 184], faint: true }] },
    pullover: { a: { e: [122, 46], w: [144, 34] }, b: { e: [108, 83], w: [114, 106] },
        props: [{ type: 'line', from: 'w', to: [196, 10], faint: true }, { type: 'db', at: 'w', small: true }] },
    facepull: { a: { e: [124, 56], w: [148, 54] }, b: { e: [80, 46], w: [112, 36] },
        props: [{ type: 'line', from: 'w', to: [198, 50], faint: true }] },
    legpress: { base: { s: [48, 116], h: [36, 106], p: [80, 156], e: [60, 140], w: [76, 150] },
        a: { k: [104, 130], a: [134, 118], t: [140, 104] },
        b: { k: [111, 137], a: [142, 118], t: [150, 104] },
        props: [{ type: 'line', from: { j: 't', d: [-6, -14] }, to: { j: 't', d: [12, 16] }, gold: true }, { type: 'line', from: [30, 120], to: [78, 166], faint: true }] },
};
GUIDE_DEMOS.legcurlSeated = { ...GUIDE_DEMOS.legext, a: GUIDE_DEMOS.legext.b, b: { a: [118, 162], t: [124, 176] } };

function demoPose(demo, which) {
    const base = demo.view === 'front' ? FRONT_BASE : SIDE_BASE;
    const pose = { ...base, ...(demo.base || {}), ...(which === 'a' ? demo.a : { ...demo.a, ...demo.b }) };
    if (demo.view === 'front') {
        pose.n = [(pose.s1[0] + pose.s2[0]) / 2, (pose.s1[1] + pose.s2[1]) / 2];
        pose.pm = [(pose.p1[0] + pose.p2[0]) / 2, (pose.p1[1] + pose.p2[1]) / 2];
    }
    return pose;
}

function demoPoint(ref, pose) {
    if (typeof ref === 'string') return pose[ref];
    if (Array.isArray(ref)) return ref;
    const j = pose[ref.j];
    return [j[0] + ref.d[0], j[1] + ref.d[1]];
}

// One SVG element whose numeric attributes glide between the two poses (and back)
function demoEl(tag, attrsA, attrsB, extra, still) {
    const anim = still ? '' : Object.keys(attrsA)
        .filter(k => attrsA[k] !== attrsB[k])
        .map(k => `<animate attributeName="${k}" values="${attrsA[k]};${attrsB[k]};${attrsB[k]};${attrsA[k]}" keyTimes="0;0.42;0.58;1" dur="3.4s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .35 1;0 0 1 1;.45 0 .35 1"/>`)
        .join('');
    const attrs = Object.entries(attrsA).map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<${tag} ${attrs} ${extra}>${anim}</${tag}>`;
}

function guideDemoSvg(move) {
    const demo = GUIDE_DEMOS[move];
    if (!demo) return '';
    const still = prefersReducedMotion();
    const A = demoPose(demo, 'a');
    const B = demoPose(demo, 'b');
    const r = n => Math.round(n * 10) / 10;
    const line = (pa1, pa2, pb1, pb2, cls) => demoEl('line',
        { x1: r(pa1[0]), y1: r(pa1[1]), x2: r(pa2[0]), y2: r(pa2[1]) },
        { x1: r(pb1[0]), y1: r(pb1[1]), x2: r(pb2[0]), y2: r(pb2[1]) }, `class="${cls}"`, still);
    const parts = [];
    // Scenery and cables behind the figure
    (demo.props || []).filter(p => p.type === 'rect').forEach(p => parts.push(`<rect class="gd-faint-fill" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="3"/>`));
    (demo.props || []).filter(p => p.type === 'line' && p.faint).forEach(p =>
        parts.push(line(demoPoint(p.from, A), demoPoint(p.to, A), demoPoint(p.from, B), demoPoint(p.to, B), 'gd-faint')));
    parts.push('<line class="gd-floor" x1="6" y1="186" x2="194" y2="186"/>');
    if (demo.legs === 2) BACK_LEG.forEach(([m, n]) => parts.push(line(A[m], A[n], B[m], B[n], 'gd-limb back')));
    (demo.view === 'front' ? FRONT_LIMBS : SIDE_LIMBS).forEach(([m, n]) => parts.push(line(A[m], A[n], B[m], B[n], 'gd-limb')));
    parts.push(demoEl('circle', { cx: r(A.h[0]), cy: r(A.h[1]) }, { cx: r(B.h[0]), cy: r(B.h[1]) }, 'r="9" class="gd-head"', still));
    // Equipment in front, in gold
    (demo.props || []).forEach(p => {
        if (p.type === 'line' && !p.faint) parts.push(line(demoPoint(p.from, A), demoPoint(p.to, A), demoPoint(p.from, B), demoPoint(p.to, B), 'gd-gear'));
        if (p.type === 'plate') parts.push(demoEl('circle', { cx: r(A[p.at][0]), cy: r(A[p.at][1]) }, { cx: r(B[p.at][0]), cy: r(B[p.at][1]) }, 'r="12" class="gd-plate"', still));
        if (p.type === 'db') {
            const w = p.small ? 8 : 16;
            parts.push(demoEl('rect', { x: r(A[p.at][0] - w / 2), y: r(A[p.at][1] - 4) }, { x: r(B[p.at][0] - w / 2), y: r(B[p.at][1] - 4) },
                `width="${w}" height="8" rx="3" class="gd-db"`, still));
        }
    });
    return `<svg class="guide-demo" viewBox="0 0 200 200" aria-hidden="true">${parts.join('')}</svg>`;
}

// ── The sheet ──
function openGuide(id, inWorkout = false) {
    haptic();
    const ex = inWorkout ? workoutExercise(id) : PROGRAMS[currentProgram].exercises.find(e => e.id === id);
    if (!ex) return;
    const week = inWorkout && activeWorkout ? activeWorkout.week : (todayWeek !== null ? todayWeek : getCurrentWeek());
    const name = exerciseDisplayName(ex, week);
    const move = guideMove(name) || guideMove(ex.name);
    const text = GUIDE_TEXT[move];
    const [primary, secondary] = text ? text.muscles : [[], []];
    document.getElementById('guideBody').innerHTML = `
        ${move ? `<div class="guide-stage">${guideDemoSvg(move)}</div>` : ''}
        <h2 class="guide-title">${escapeHtml(name)}</h2>
        <div class="guide-meta">${escapeHtml(prescriptionText(ex))}</div>
        ${text ? `<div class="guide-muscles">
            ${primary.map(m => `<span class="gm primary">${escapeHtml(m)}</span>`).join('')}
            ${secondary.map(m => `<span class="gm">${escapeHtml(m)}</span>`).join('')}
        </div>` : ''}
        ${ex.note && !ex.alternates ? `<div class="guide-note"><span>Coach's note</span><p>${escapeHtml(ex.note)}</p></div>` : ''}
        ${text ? `
            <div class="section-head"><h3>How to</h3></div>
            <ol class="guide-cues">${text.cues.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ol>
            <div class="section-head"><h3>Avoid</h3></div>
            <ul class="guide-avoid">${text.avoid.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>`
            : '<p class="guide-empty">No guide for your own exercises yet. Your notes and history work as usual.</p>'}
        <p class="guide-foot">If something hurts, stop and swap it out.</p>
    `;
    document.getElementById('guideModal').classList.add('active');
}

function closeGuide() {
    document.getElementById('guideModal').classList.remove('active');
}
