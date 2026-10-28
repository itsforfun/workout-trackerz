// Fills the app with realistic sample data (no network). Called by tests/tests.js before each check.
function loadFixture() {
    const today = todayStr();
    const d = n => addDays(today, -n);
    currentUser = { id: 'test-user', email: 'test@example.com', created_at: '2026-09-01' };
    currentProgram = 'fullBody3';
    userProfile = { gender: 'male', age: 28, weight: 95, height: 180, units: 'kg', stepGoal: 10000 };
    const set = (kg, reps) => ({ kg, reps });
    const entry = (kg, reps, n) => ({ kg, sets: [set(kg, reps), set(kg, reps), set(kg, reps - 1)], date: d(n) });
    allData = {
        fullBody3: {
            'goblet-box-squat': { 0: entry(24, 12, 20), 1: entry(26, 12, 13), 2: entry(28, 11, 6) },
            'incline-db-press': { 0: entry(22, 10, 20), 1: entry(24, 10, 13), 2: entry(26, 9, 6) },
            'lat-pulldown': { 0: entry(55, 12, 20), 1: entry(60, 11, 13), 2: entry(62.5, 10, 6) },
            'db-rdl': { 0: entry(30, 12, 18), 1: entry(32, 12, 11) },
            'rack-pull': { 0: entry(100, 8, 16), 1: entry(110, 8, 9) },
        },
        _sessions: { fullBody3: [
            { date: d(20), day: 0, week: 0, type: 'workout', minutes: 52 },
            { date: d(18), day: 1, week: 0, type: 'workout', minutes: 48 },
            { date: d(16), day: 2, week: 0, type: 'workout', minutes: 55 },
            { date: d(13), day: 0, week: 1, type: 'workout', minutes: 50 },
            { date: d(11), day: 1, week: 1, type: 'workout', minutes: 47 },
            { date: d(9), day: 2, week: 1, type: 'workout', minutes: 53 },
            { date: d(6), day: 0, week: 2, type: 'workout', minutes: 51 },
            { date: d(1), type: 'cardio', zone: 2, name: 'Steady bike', minutes: 30 },
        ] },
        _cycleStart: { fullBody3: d(20) },
        _bodyweight: [{ date: d(20), kg: 97 }, { date: d(10), kg: 96 }, { date: d(1), kg: 95 }],
        _habits: { [today]: [1, 2] },
    };
    stepData = {};
    for (let i = 0; i < 14; i++) stepData[d(i)] = { steps: [6420, 9120, 11030, 7300, 8800, 12450, 5200, 10100, 9400, 7600, 10900, 8100, 6900, 9800][i], updated_at: new Date().toISOString(), source: 'shortcut' };
    stepToken = 'abc123testtoken';
    loadSteps = async () => false;
    getOrCreateStepToken = async () => stepToken;
    showScreen('app');
}
