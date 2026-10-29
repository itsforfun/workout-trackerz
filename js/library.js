// ════════════════════════════════════════════
//  EXERCISE LIBRARY: every exercise the app knows, with the muscles it trains and the equipment it needs
// ════════════════════════════════════════════

// Muscle groups, as shown on the anatomy map (`body`: shape names in js/anatomy-data.js)
const MUSCLE_GROUPS = [
    { id: 'ch', name: 'Chest', body: ['chest'] },
    { id: 'sh', name: 'Shoulders', body: ['deltoids'] },
    { id: 'bi', name: 'Biceps', body: ['biceps'] },
    { id: 'tr', name: 'Triceps', body: ['triceps'] },
    { id: 'fa', name: 'Forearms', body: ['forearm'] },
    { id: 'ab', name: 'Abs', body: ['abs'] },
    { id: 'ob', name: 'Obliques', body: ['obliques'] },
    { id: 'tp', name: 'Traps', body: ['trapezius'] },
    { id: 'ub', name: 'Upper back', body: ['upper-back'] },
    { id: 'lb', name: 'Lower back', body: ['lower-back'] },
    { id: 'gl', name: 'Glutes', body: ['gluteal'] },
    { id: 'qd', name: 'Quads', body: ['quadriceps'] },
    { id: 'hm', name: 'Hamstrings', body: ['hamstring'] },
    { id: 'ad', name: 'Adductors', body: ['adductors'] },
    { id: 'cf', name: 'Calves', body: ['calves', 'tibialis'] },
];

const EQUIPMENT = { bb: 'Barbell', db: 'Dumbbells', cb: 'Cable', mc: 'Machine', sm: 'Smith machine', bw: 'Bodyweight' };

// [name, equipment, unit, main muscles, supporting muscles]
// Units: kg (bar/stack), kg/DB (per dumbbell), kg/side (per side or arm), reps/+kg (bodyweight; reps tracked, extra weight optional)
const LIBRARY = [
    // Chest
    ['Barbell Bench Press', 'bb', 'kg', 'ch tr', 'sh'],
    ['DB Bench Press', 'db', 'kg/DB', 'ch', 'tr sh'],
    ['Incline Barbell Press', 'bb', 'kg', 'ch sh', 'tr'],
    ['Incline DB Press', 'db', 'kg/DB', 'ch sh', 'tr'],
    ['Decline Bench Press', 'bb', 'kg', 'ch', 'tr'],
    ['Close-Grip Bench Press', 'bb', 'kg', 'tr ch', 'sh'],
    ['Machine Chest Press', 'mc', 'kg', 'ch', 'tr sh'],
    ['Incline Machine Press', 'mc', 'kg', 'ch sh', 'tr'],
    ['Smith Machine Bench', 'sm', 'kg', 'ch', 'tr sh'],
    ['Flat DB Press', 'db', 'kg/DB', 'ch', 'tr sh'],
    ['Push-Ups', 'bw', 'reps/+kg', 'ch tr', 'sh ab'],
    ['Incline Push-Ups', 'bw', 'reps/+kg', 'ch tr', 'sh'],
    ['Diamond Push-Ups', 'bw', 'reps/+kg', 'tr ch', 'sh'],
    ['Weighted Dips', 'bw', 'reps/+kg', 'ch tr', 'sh'],
    ['Cable Fly', 'cb', 'kg/side', 'ch', 'sh'],
    ['Low-to-High Cable Fly', 'cb', 'kg/side', 'ch', 'sh'],
    ['High-to-Low Cable Fly', 'cb', 'kg/side', 'ch', 'sh'],
    ['Pec Deck Fly', 'mc', 'kg', 'ch', 'sh'],
    ['DB Fly', 'db', 'kg/DB', 'ch', 'sh'],
    ['Incline DB Fly', 'db', 'kg/DB', 'ch', 'sh'],
    ['Landmine Press', 'bb', 'kg', 'sh ch', 'tr'],
    // Shoulders
    ['Barbell Overhead Press', 'bb', 'kg', 'sh tr', 'ch ab'],
    ['Seated DB Shoulder Press', 'db', 'kg/DB', 'sh tr', ''],
    ['Arnold Press', 'db', 'kg/DB', 'sh', 'tr'],
    ['Machine Shoulder Press', 'mc', 'kg', 'sh tr', ''],
    ['Push Press', 'bb', 'kg', 'sh tr', 'qd gl'],
    ['DB Lateral Raise', 'db', 'kg/DB', 'sh', 'tp'],
    ['Cable Lateral Raise', 'cb', 'kg/side', 'sh', 'tp'],
    ['Machine Lateral Raise', 'mc', 'kg', 'sh', 'tp'],
    ['Lying Cable Lateral Raise', 'cb', 'kg/side', 'sh', ''],
    ['DB Front Raise', 'db', 'kg/DB', 'sh', 'ch'],
    ['Cable Front Raise', 'cb', 'kg', 'sh', 'ch'],
    ['Rear Delt DB Fly', 'db', 'kg/DB', 'sh', 'ub tp'],
    ['Reverse Pec Deck', 'mc', 'kg', 'sh', 'ub tp'],
    ['Cable Rear Delt Fly', 'cb', 'kg/side', 'sh', 'ub'],
    ['Face Pull', 'cb', 'kg', 'sh ub', 'tp'],
    // Triceps
    ['Rope Pressdown', 'cb', 'kg', 'tr', ''],
    ['Straight-Bar Pressdown', 'cb', 'kg', 'tr', ''],
    ['Single-Arm Cable Pressdown', 'cb', 'kg/side', 'tr', ''],
    ['Overhead Cable Extension', 'cb', 'kg', 'tr', ''],
    ['DB Overhead Extension', 'db', 'kg/DB', 'tr', ''],
    ['EZ-Bar Skull Crusher', 'bb', 'kg', 'tr', ''],
    ['DB Skull Crusher', 'db', 'kg/DB', 'tr', ''],
    ['Triceps Kickback', 'db', 'kg/DB', 'tr', ''],
    ['Bench Dips', 'bw', 'reps/+kg', 'tr', 'ch sh'],
    // Biceps and forearms
    ['Barbell Curl', 'bb', 'kg', 'bi', 'fa'],
    ['EZ-Bar Curl', 'bb', 'kg', 'bi', 'fa'],
    ['DB Curl', 'db', 'kg/DB', 'bi', 'fa'],
    ['Hammer Curl', 'db', 'kg/DB', 'bi fa', ''],
    ['Seated DB Incline Curl', 'db', 'kg/DB', 'bi', ''],
    ['Preacher Curl Machine', 'mc', 'kg', 'bi', ''],
    ['EZ-Bar Preacher Curl', 'bb', 'kg', 'bi', ''],
    ['Cable Curl', 'cb', 'kg', 'bi', 'fa'],
    ['Bayesian Cable Curl', 'cb', 'kg/side', 'bi', ''],
    ['Concentration Curl', 'db', 'kg/DB', 'bi', ''],
    ['Spider Curl', 'db', 'kg/DB', 'bi', ''],
    ['Reverse Curl', 'bb', 'kg', 'fa bi', ''],
    ['Wrist Curl', 'db', 'kg/DB', 'fa', ''],
    // Upper back and lats
    ['Pull-Ups', 'bw', 'reps/+kg', 'ub bi', 'fa ab'],
    ['Chin-Ups', 'bw', 'reps/+kg', 'ub bi', 'fa'],
    ['Neutral-Grip Pull-Ups', 'bw', 'reps/+kg', 'ub bi', 'fa'],
    ['Assisted Pull-Up Machine', 'mc', 'kg assist', 'ub bi', ''],
    ['Lat Pulldown', 'cb', 'kg', 'ub bi', 'fa'],
    ['Lat Pulldown (Wide Grip)', 'cb', 'kg', 'ub', 'bi'],
    ['Close-Grip Lat Pulldown', 'cb', 'kg', 'ub bi', ''],
    ['Single-Arm Cable Pulldown', 'cb', 'kg/side', 'ub', 'bi'],
    ['Barbell Row', 'bb', 'kg', 'ub', 'bi lb sh'],
    ['Pendlay Row', 'bb', 'kg', 'ub', 'bi lb'],
    ['T-Bar Row', 'bb', 'kg', 'ub', 'bi sh'],
    ['One-Arm DB Row', 'db', 'kg/DB', 'ub', 'bi sh'],
    ['Chest-Supported Row', 'db', 'kg/DB', 'ub', 'bi sh'],
    ['Seal Row', 'bb', 'kg', 'ub', 'bi sh'],
    ['Seated Cable Row', 'cb', 'kg', 'ub', 'bi'],
    ['Chest-Supported Machine Row', 'mc', 'kg', 'ub', 'bi sh'],
    ['Machine High Row', 'mc', 'kg', 'ub', 'bi sh'],
    ['Inverted Row', 'bw', 'reps/+kg', 'ub', 'bi ab'],
    ['Cable Straight-Arm Pulldown', 'cb', 'kg', 'ub', 'tr ab'],
    ['DB Pullover', 'db', 'kg/DB', 'ub ch', 'tr'],
    // Traps
    ['Barbell Shrug', 'bb', 'kg', 'tp', 'fa'],
    ['DB Shrug', 'db', 'kg/DB', 'tp', 'fa'],
    ['Farmer Carry', 'db', 'kg/DB', 'fa tp', 'ab gl'],
    // Lower back and hinges
    ['Barbell Deadlift', 'bb', 'kg', 'hm gl lb', 'ub tp fa'],
    ['Sumo Deadlift', 'bb', 'kg', 'gl ad hm', 'lb qd'],
    ['Barbell RDL', 'bb', 'kg', 'hm gl', 'lb'],
    ['DB Romanian Deadlift', 'db', 'kg/DB', 'hm gl', 'lb'],
    ['Single-Leg RDL', 'db', 'kg/DB', 'hm gl', 'lb'],
    ['Stiff-Leg Deadlift', 'bb', 'kg', 'hm', 'gl lb'],
    ['Good Morning', 'bb', 'kg', 'hm lb', 'gl'],
    ['Barbell Rack Pull', 'bb', 'kg', 'lb gl', 'hm tp'],
    ['Smith Machine RDL', 'sm', 'kg', 'hm gl', 'lb'],
    ['Cable Pull-Through', 'cb', 'kg', 'gl hm', ''],
    ['Hyperextensions', 'bw', 'kg+', 'lb gl', 'hm'],
    ['45° Back Extension', 'bw', 'kg+', 'lb gl', 'hm'],
    ['Reverse Hyperextension', 'mc', 'kg', 'gl lb', 'hm'],
    // Glutes
    ['Barbell Hip Thrust', 'bb', 'kg', 'gl', 'hm'],
    ['DB Hip Thrust', 'db', 'kg/DB', 'gl', 'hm'],
    ['Machine Hip Thrust', 'mc', 'kg', 'gl', 'hm'],
    ['Smith Machine Hip Thrust', 'sm', 'kg', 'gl', 'hm'],
    ['Single-Leg Hip Thrust', 'bw', 'reps/+kg', 'gl', 'hm'],
    ['Barbell Glute Bridge', 'bb', 'kg', 'gl', 'hm'],
    ['Glute Bridge', 'bw', 'reps/+kg', 'gl', 'hm'],
    ['Cable Glute Kickback', 'cb', 'kg/side', 'gl', 'hm'],
    ['Glute Medius Kickback', 'cb', 'kg/side', 'gl', ''],
    ['Cable Hip Abduction', 'cb', 'kg/side', 'gl', ''],
    ['Machine Hip Abduction', 'mc', 'kg', 'gl', ''],
    ['Machine Hip Adduction', 'mc', 'kg', 'ad', ''],
    // Quads and squats
    ['Barbell Back Squat', 'bb', 'kg', 'qd gl', 'ad lb ab'],
    ['Barbell Front Squat', 'bb', 'kg', 'qd', 'gl ab ub'],
    ['Barbell Box Squat', 'bb', 'kg', 'qd gl', 'ad'],
    ['Goblet Squat', 'db', 'kg/DB', 'qd gl', 'ad ab'],
    ['Goblet Box Squat', 'db', 'kg/DB', 'qd gl', 'ad'],
    ['Heel-Elevated Goblet Squat', 'db', 'kg/DB', 'qd', 'gl'],
    ['Sumo Squat', 'db', 'kg/DB', 'ad gl qd', ''],
    ['Hack Squat', 'mc', 'kg', 'qd', 'gl ad'],
    ['Pendulum Squat', 'mc', 'kg', 'qd', 'gl'],
    ['Smith Machine Squat', 'sm', 'kg', 'qd gl', 'ad'],
    ['Leg Press', 'mc', 'kg', 'qd gl', 'ad'],
    ['Single-Leg Press', 'mc', 'kg', 'qd gl', ''],
    ['Leg Extension', 'mc', 'kg', 'qd', ''],
    ['Single-Leg Extension', 'mc', 'kg', 'qd', ''],
    ['Bulgarian Split Squat', 'db', 'kg/DB', 'qd gl', 'ad'],
    ['Static Split Squat', 'db', 'kg/DB', 'qd gl', 'ad'],
    ['Reverse Lunge', 'db', 'kg/DB', 'gl qd', 'ad hm'],
    ['Walking Lunge', 'db', 'kg/DB', 'qd gl', 'ad hm'],
    ['Forward Lunge', 'db', 'kg/DB', 'qd gl', 'ad'],
    ['Cossack Squat', 'bw', 'reps/+kg', 'ad qd', 'gl'],
    ['Step-Up, 3-Second Lowering', 'db', 'kg/DB', 'qd gl', 'cf'],
    // Hamstrings
    ['Lying Leg Curl', 'mc', 'kg', 'hm', 'cf'],
    ['Seated Leg Curl', 'mc', 'kg', 'hm', ''],
    ['Standing Single-Leg Curl', 'mc', 'kg', 'hm', ''],
    ['Nordic Curl', 'bw', 'reps/+kg', 'hm', 'gl'],
    ['Stability Ball Leg Curl', 'bw', 'reps/+kg', 'hm', 'gl'],
    ['Glute-Ham Raise', 'bw', 'reps/+kg', 'hm', 'gl lb'],
    // Calves
    ['Standing Calf Raise Machine', 'mc', 'kg', 'cf', ''],
    ['Seated Calf Raise', 'mc', 'kg', 'cf', ''],
    ['Leg Press Calf Raise', 'mc', 'kg', 'cf', ''],
    ['Single-Leg Calf Raise', 'db', 'kg/DB', 'cf', ''],
    ['Smith Machine Calf Raise', 'sm', 'kg', 'cf', ''],
    // Abs and core
    ['Cable Crunch', 'cb', 'kg', 'ab', 'ob'],
    ['Machine Crunch', 'mc', 'kg', 'ab', 'ob'],
    ['Decline Crunch', 'bw', 'reps/+kg', 'ab', 'ob'],
    ['Hanging Knee Raise', 'bw', 'reps/+kg', 'ab', 'fa'],
    ['Hanging Leg Raise', 'bw', 'reps/+kg', 'ab', 'fa ob'],
    ['Reverse Incline Crunch', 'bw', 'reps/+kg', 'ab', ''],
    ['Ab Wheel Rollout', 'bw', 'reps/+kg', 'ab', 'ob ub'],
    ['Dead Bug', 'bw', 'reps/+kg', 'ab', ''],
    ['Pallof Press', 'cb', 'kg', 'ob ab', ''],
    ['Cable Woodchop', 'cb', 'kg/side', 'ob', 'ab sh'],
    ['Suitcase Carry', 'db', 'kg/side', 'ob ab', 'fa tp'],
];

const LIBRARY_BY_NAME = new Map(LIBRARY.map(([name, equipment, unit, main, extra]) => [name, {
    name, equipment, unit,
    main: main.split(' ').filter(Boolean),
    extra: extra.split(' ').filter(Boolean),
}]));

// Muscle names used in the exercise guide's text, mapped to groups (for exercises not in the library)
const GUIDE_MUSCLE_GROUPS = {
    Quads: ['qd'], Glutes: ['gl'], Adductors: ['ad'], Core: ['ab', 'ob'], Hamstrings: ['hm'], 'Lower back': ['lb'], 'Upper back': ['ub'],
    Forearms: ['fa'], Chest: ['ch'], Triceps: ['tr'], 'Front delts': ['sh'], 'Upper chest': ['ch'], 'Side delts': ['sh'], Traps: ['tp'],
    Lats: ['ub'], Biceps: ['bi'], 'Rear delts': ['sh'], Calves: ['cf'], Abs: ['ab'], Obliques: ['ob'], 'Glute medius': ['gl'], 'Rotator cuff': ['sh'],
};

// The muscles an exercise trains: { main: [group ids], extra: [group ids] }
function exerciseMuscles(name) {
    const entry = LIBRARY_BY_NAME.get(name);
    if (entry) return { main: entry.main, extra: entry.extra.filter(g => !entry.main.includes(g)) };
    const text = GUIDE_TEXT[guideMove(name)];
    if (!text) return { main: [], extra: [] };
    const groups = list => [...new Set(list.flatMap(m => GUIDE_MUSCLE_GROUPS[m] || []))];
    const main = groups(text.muscles[0]);
    return { main, extra: groups(text.muscles[1]).filter(g => !main.includes(g)) };
}

function muscleGroupName(id) {
    return (MUSCLE_GROUPS.find(g => g.id === id) || {}).name || id;
}
