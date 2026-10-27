# CLAUDE.md — Workout Tracker App (handoff for Claude Code)

> Claude Code reads this file automatically. It is the single source of truth for this project.
> Read it fully before changing code. Older long-form docs live in `docs/` (some details there are outdated — this file wins).

---

## 1. The goal

Build a **real multi-user workout-tracking app** that:

1. Lets anyone **sign up / log in** (email + password).
2. Asks for **body metrics** (gender, age, weight kg, height cm) on first login.
3. Shows a **program selection menu** with 4 programs (2 male, 2 female).
4. Gives each user a **12-week tracker per program**, with data stored **per user AND per program** in the cloud.
   - Data from one program must **never** appear in another program, even if an exercise has the same name.
5. Ranks each lift into **strength tiers** personalized to the user's bodyweight (gamification).
6. Works on phone and desktop, from any device, via a public URL.
7. Long term: become an installable app (PWA first, maybe native later). Visual direction for that is in `reference/design-inspiration/` (clean dark iOS workout app: "Today's workout", exercise list with sets×reps, progression badges like "+2kg / reps / sets", big "Start workout" button).

**Owner constraints:** wants $0 hosting. Netlify was rejected (credits ran out). Target host is **GitHub Pages** (Vercel / Cloudflare Pages are acceptable alternatives). Owner works mostly from an iPhone, is not a professional developer — explain steps plainly.

---

## 2. Current state (Oct 2026)

- **Single file app:** `index.html` (HTML + CSS + vanilla JS, ~1,300 lines). Was `workout-tracker-app.html` in the chat; renamed for GitHub Pages.
- **Backend:** Supabase (auth + Postgres). Table created with `supabase-setup.sql`.
- **Deployed (2026-10-27):** https://itsforfun.github.io/workout-trackerz/ — GitHub Pages from `main` / root of the public repo `itsforfun/workout-trackerz`. Pushing to `main` redeploys in ~1 min. GitHub CLI is at `~/.local/bin/gh` (signed in as itsforfun). `reference/` is git-ignored (private screenshots / paid program photos).
- Previously (before Oct 27 2026): It was only ever tested inside the Claude mobile app's file preview, which showed `Uncaught Error: Script error.` (see `reference/debug-screenshots/`). It has never been confirmed working in a real browser.
- **Libraries via CDN:** `@supabase/supabase-js@2` (jsDelivr), Chart.js 4.4.1 (cdnjs), Google Fonts (Bebas Neue, DM Mono, Playfair Display).

### Supabase config
- Project URL: `https://hcwbcxhblfjpdlkwykez.supabase.co` (project "kevinwandji55@gmail.com's Project", org "kind", free plan)
- Publishable key (safe in frontend, already in `index.html`): `sb_publishable_mEe_5g2UITyp5O-F9YRhRg_wTQWuOtf`
- The original project (`nwmquradhhvfnanfmyjd`) no longer exists (DNS NXDOMAIN on 2026-10-27); the app was switched to the project above.
- Auth → URL Configuration: Site URL and Redirect URL set to `https://itsforfun.github.io/workout-trackerz/`. Email confirmation is ON.
- The secret key the owner pasted in the old chat belonged to the deleted project, so it is dead. Never put a secret key in this repo.
- `user_data` table + RLS created in the new project via `supabase-setup.sql` (verified 2026-10-27: anon read returns `[]`).
- Unknown: whether the owner re-ran the SQL after the `profile` column was added. If the table is missing the column run:
  `ALTER TABLE user_data ADD COLUMN IF NOT EXISTS profile JSONB DEFAULT '{}'::jsonb;`

---

## 3. KNOWN BUGS — fix these first (in this order)

> **Status (2026-10-27):** Bugs 1-5 and the cleanup items below are fixed in `index.html`, except the Progress tab (roadmap step 3).
> Verified locally against a stubbed Supabase client (no script errors, per-program data, legacy migration, debounced upsert with `onConflict`, Switch Program, escaping, phone-width layout). Not yet verified against the real Supabase project or on GitHub Pages.
> Decisions made: tier scaling uses the **program's** reference lifter (95 kg male programs / 65 kg female programs); units `reps/+kg` and `kg+` are not scaled. Legacy flat data with no selected program is kept under `workout_data._legacy`.

### Bug 1 — Probable real cause of "Script error": global name collision
The CDN build of supabase-js defines a global `supabase`. `index.html` then declares `let supabase;` at the top level of a classic script (line ~588). A top-level `let` that collides with an existing global binding throws `SyntaxError: Identifier 'supabase' has already been declared`, which kills the whole script. Cross-origin previews report it only as "Script error."
**Fix:** rename the client variable everywhere, e.g. `let sb = window.supabase.createClient(URL, KEY);` and replace all `supabase.auth…` / `supabase.from…` calls with `sb.…`. Remove the 100 ms `setTimeout` hack — scripts load in order, so the library is ready.

### Bug 2 — Workout data is NOT separated per program (violates the core requirement)
`loadUserData()` loads one `workout_data` object, and exercises are keyed by **array index** (`data[ei][week]`). Switching from Beast Mode to Hourglass Goddess shows Beast Mode numbers under Goddess exercises.
**Fix:** store `workout_data` as `{ [programId]: { [exerciseId]: { [week]: value } } }`. Give every exercise a stable string `id` (e.g. `"db-bench"`) instead of using array indices. Migrate any existing flat data into the user's current program.

### Bug 3 — "Switch Program" sends you straight back to the same program
`switchProgram()` reloads the page, then `loadUserData()` sees `selected_program` and auto-calls `selectProgram()` again. This was reported as broken 4+ times in the chat.
**Fix:** no reload. Set `currentProgram = null`, save `selected_program: null`, hide main app, show selector. Navigation should be driven by one `showScreen(name)` function instead of the mix of classes and inline styles now in the file.

### Bug 4 — Upsert may create duplicate-key errors
`id` is the primary key; `user_id` is UNIQUE. `.upsert({...})` must pass `{ onConflict: 'user_id' }`.

### Bug 5 — Saves on every keystroke + toast spam
`onInput` calls `saveToCloud()` on every key and shows "Saved to cloud!" each time. **Fix:** debounce (~800 ms), show a quiet status indicator, toast only on error.

### Other cleanup
- First-login flow: after signup, if `user_data` row doesn't exist, `loadUserData` errors silently (`.single()` on 0 rows). Use `.maybeSingle()`.
- Profile is saved before program choice, so `saveToCloud` writes `selected_program: null` — fine, but make it explicit.
- `handleDeleteAccount` only deletes the row; real auth-user deletion needs a Supabase Edge Function. Keep the message honest.
- "Progress" tab is a placeholder. Chart.js is loaded but unused in this file (an earlier standalone version had full per-exercise charts with start/best/progress stats and tier bars — rebuild that here).
- Password reset `redirectTo: window.location.origin` drops the GitHub Pages sub-path; use `location.origin + location.pathname`. Also add the deployed URL to Supabase → Auth → URL Configuration.
- Add a visible "Forgot password?" link on the login form.
- Escape any user-entered text inserted with `innerHTML`.

---

## 4. The four programs (source of truth)

Sets×reps, rest. Base tier thresholds (kg) are listed as `[Beginner, Novice, Intermediate, Advanced, Elite, God/Goddess]` for the reference bodyweight (95 kg male, 65 kg female).

### 4.1 "9-5 Beast Mode" — Male, Push/Pull/Legs, 3 days (from `reference/program-photos/IMG_1803-1804`)
| Day | Exercise | Prescription | Unit | Thresholds |
|---|---|---|---|---|
| Push (~60 min) | DB Bench Press | 4×8-10, 2-3 min | kg/DB | 20,28,36,46,56,66 |
| | Seated DB Shoulder Press (superset w/ #5) | 4×8-10, 2 min | kg/DB | 18,26,34,44,54,66 |
| | DB Incline Press | 3×10-12, 2 min | kg/DB | 18,26,34,44,54,64 |
| | Lying Cable Lateral Raise | 3×12-15, 1.5 min | kg/side | 5,8,12,16,22,30 |
| | Cable Overhead Tri Ext | 3×12, 1.5 min | kg | 18,25,34,44,56,70 |
| Pull (~55 min) | Pull-Ups | 4×8-10, 2-3 min | reps/+kg | 5,8,12,20,30,45 |
| | DB Incline Row (superset w/ #4) | 4×10-12, 2 min | kg/DB | 20,28,36,44,54,64 |
| | Cable Straight-Arm Pulldown | 3×12-15, 1.5 min | kg | 15,22,30,40,52,65 |
| | Seated DB Incline Curl | 3×10-12, 1.5 min | kg/DB | 8,12,16,20,26,32 |
| | Leg Extension | 3×10, 2 min | kg | 40,60,80,100,125,150 |
| Legs (~65 min) | Barbell Back Squat / Leg Press | 4×8-10, 3 min | kg | 80,115,155,195,240,285 |
| | Barbell RDL | 4×8-12, 2-3 min | kg | 60,90,120,155,195,235 |
| | Lying Leg Curl | 4×10-12, 2 min | kg | 30,45,60,78,96,115 |
| | Barbell Hip Thrust | 4×10, 2 min | kg | 60,100,140,180,220,260 |
| | Single-Leg Calf Raise | 3×12-15, 1.5 min | kg/DB | 16,24,32,42,54,70 |
| | Cable Crunch | 3×12, 1 min | kg | 15,22,30,40,52,65 |

Optional mobility (IMG_1801-1802), 20 min on off-days, 2-3 rounds, 30-45 s each:
- Post-Push: Shoulder CARs (3/arm), Lying Cable Lateral Raise hold (30 s light), Pec doorway stretch (30 s/side), Child's pose flow (8 breaths)
- Post-Pull: Thread-the-needle (30 s/side), 90/90 hip switch (5/side), Seated spinal twist (30 s/side), Wall angels (10)
- Post-Legs: Cossack squats (6/side), Ankle dorsiflexion rocks (10/side), Pigeon pose (30 s/side), Hip flexor lunge stretch (30 s/side)

### 4.2 "Hourglass Goddess" — Female, A/B/C rolling split (from "The Hourglass Aspect 3.0: 12-Week…", IMG_1511-1516)
Rolling schedule: do A → B → C → A… in order, regardless of weekday.

| Workout | Exercise | Prescription | Form note | Thresholds |
|---|---|---|---|---|
| A — Glute Max & Quads | KAS Glute Bridge | 3×8-12, 2-4 min | Full hip extension, pause at top | 30,50,70,95,120,145 |
| | RDLs | 2×8-12, 3-4 min | Push hips back, slight knee bend | 35,55,75,100,130,160 |
| | Hack Squat | 3×8-10, 3-4 min | Feet low, shoulder width | 50,75,105,140,180,220 |
| | Leg Extension | 3×8-10, 2-4 min | Pause at top | 25,40,55,72,90,110 |
| | Hyperextensions | 3×8-10, 2-3 min | Tuck chin, hips into pad (added kg) | 0,5,12,20,30,42 |
| | Standing Calf Raises | 3×8-10, 2-3 min | Pause top & bottom | 40,60,85,115,145,180 |
| B — Upper (Width & Shape) | Lat Pulldown – wide | 3×8-10, 2-3 min | Full stretch, hands over bar | 25,38,52,68,86,105 |
| | Barbell Row | 3×8-10, 2-4 min | Elbows flare, pull to lower chest | 25,38,52,68,88,108 |
| | Cable Lateral Raise | 3×8-12, 2-3 min | Pause at top (kg/side) | 3,5,8,12,16,22 |
| | Seated Shoulder Press | 2×8-12, 2-3 min | Slight elbow flare (kg/DB) | 8,12,18,24,32,40 |
| | Chest Press Machine | 3×8-10, 2-3 min | Stretch at bottom (kg/side) | 15,22,32,42,54,68 |
| | Arm Isolation* | 3×10-12, 2-3 min | *Alternate weekly: Cable Curls / Tricep Pressdown | 10,15,22,30,38,48 |
| C — Glute Med, Hams & Stability | Reverse Lunge | 3×8-12, 2-3 min | Slight forward lean, slow (kg/DB) | 8,14,20,28,38,48 |
| | Quad Biased Leg Press | 3×8-12, 2-3 min | Feet low, shoulder width | 60,95,135,180,230,285 |
| | Seated Leg Curl | 3×8-10, 2-3 min | Pause at bottom | 20,32,45,60,76,94 |
| | Glute Medius Kickback | 3×10-12, 2-3 min | Kick out at 45° | 8,14,20,28,36,46 |
| | Seated Cable High Row | 2×8-12, 2-3 min | Straight bar, wide grip, elbows flare | 25,38,52,68,86,105 |
| | Standing Calf Raises | 3×10-12, 2-3 min | Pause top & bottom | 40,60,85,115,145,180 |

### 4.3 "Beast Mode Total Body" — Male, 1 full-body day, for 1-2×/week
Built from 4.1 for a basic gym (barbell, dumbbells, cable/pulley, lat pulldown, leg extension, bench). 6 exercises, ~50-55 min.
Barbell Back Squat 3×6-8 3 min [80,115,155,195,240,285] · Barbell Bench Press 3×6-8 3 min [60,85,110,140,170,200] · Barbell Row (bent-over) 3×8-10 2-3 min [50,70,95,120,150,180] · Barbell RDL 3×8-10 2-3 min [60,90,120,155,195,235] · Barbell Overhead Press 3×6-8 2 min [40,55,72,92,112,132] · Pull-Ups 3×AMRAP 2 min [5,8,12,20,30,45]

### 4.4 "Goddess Total Body" — Female, 1 full-body day, for 1-2×/week
Built from 4.2, same basic-gym constraint. 6 exercises, ~50-55 min.
Barbell Hip Thrust 3×8-10 3 min [60,100,140,180,220,260] · Barbell RDL 3×10-12 2-3 min [35,55,75,100,130,160] · DB Goblet Squat 3×10-12 2 min [16,24,32,42,54,68] · Lat Pulldown (wide) 3×10-12 2 min [25,38,52,68,86,105] · DB Shoulder Press 3×10-12 2 min [8,12,18,24,32,40] · Barbell Row 3×10-12 2 min [25,38,52,68,88,108]

### 4.5 "3-Day Full Body" — id `fullBody3` (added 2026-10-27)
Source spec: `reference/3-day-full-body-spec.md` — **local only, git-ignored** (it holds personal health details; never commit it). Joint-friendly fat-loss full body: Mon A / Wed B / Fri C lifting, Tue/Thu easy cardio, weekend walks. Male thresholds (approximate, chosen to match the other programs).
Program-level fields only this program uses: `coachRules` (stall → hold weight +1 rep; ≥7 days off → prefill 10% lighter; effort banner), `weekPlan`, `warmup`, `habits` (saved in `workout_data._habits[date]`), `powerUnlockKg` (240 lb). Exercise fields: `per` ('side'/'leg'), `repLabel` ('m' for the carry), `upgrade` ({week, to}), `depthRule` (rack pull). Swaps marked `assist` (assisted pull-up) treat less weight as progress. The spec's supplement/medication notes are deliberately not in the app.

Design principles agreed in the chat: compounds first, 6-12 reps, 2-4 min rest on compounds, ~4-6 exercises per full-body session (the owner rejected a 9-exercise version as too long).

---

## 5. Tier system

| Tier | Name | Color | Icon | ~% of lifters |
|---|---|---|---|---|
| 0 | Untested | #6d5e4d | ◌ | — |
| 1 | Beginner | #7ab3d4 | ◎ | ~50% |
| 2 | Novice | #5fbc7a | ● | ~30% |
| 3 | Intermediate | #d4a843 | ◈ | ~15% |
| 4 | Advanced | #e8734a | ★ | ~7% |
| 5 | Elite | #c45fc4 | ⬡ | ~2% |
| 6 | God (male) / Goddess (female) | #e8d44a | 👑 | <0.5% |

A user's tier for an exercise = highest threshold met by their **best** logged value across the 12 weeks.

**Personalization (allometric scaling):** `threshold_user = threshold_base × (bodyweight / baseWeight)^0.67`, baseWeight 95 kg male / 65 kg female, rounded to 0.1 kg. Thresholds and baselines are approximations from Symmetric Strength / ExRx / NSCA-style data — not scientifically validated per exercise; keep them in one config object so they're easy to tune. Don't scale "reps" units (pull-ups) or "added kg" units the same way — decide a rule.

---

## 6. Data model

```sql
user_data (
  id uuid pk default gen_random_uuid(),
  user_id uuid unique not null references auth.users on delete cascade,
  selected_program text,            -- 'male' | 'female' | 'maleTotalBody' | 'femaleTotalBody' | null
  workout_data jsonb default '{}',  -- TARGET: { programId: { exerciseId: { "0".."11": "52.5" } } }
  profile jsonb default '{}',       -- { gender, age, weight, height }
  created_at, updated_at timestamptz
)
-- RLS on; select/insert/update/delete policies: auth.uid() = user_id
```
Future: if the JSON blob gets large, move to normalized tables (`workout_logs`, `bodyweight_logs`).

**Current `workout_data` shape (Oct 27 2026, documented at the top of the `<script>` in `index.html`):**
- `[programId][exerciseId][week]` = a string (weight only, older data) **or** `{ kg, sets:[{kg,reps}], date }` from workout mode. Pull-ups (`reps/+kg`) track **reps** as the value; `set.kg` is added weight.
- `_sessions[programId]` = `[{ date, day, week, type:'workout'|'mobility', minutes, sets }]` (rotation, streaks)
- `_cycleStart[programId]` = date week 1 began; `_archive[programId]` = finished cycles `[{start,end,data}]`
- `_bodyweight` = `[{date, kg}]`; latest entry becomes `profile.weight`. `profile.units` = `'kg'|'lb'` (display only; storage is always kg).
- The phone keeps an offline copy in `localStorage` (`wt_cache_<userId>`, plus `wt_active_workout_<userId>` for an in-progress workout). `sw.js` caches the app shell + CDN libs.

## 7b. Design system (Oct 27 2026 — owner asked for a "premium" feel, no emoji)
- Inter for UI text, DM Mono only for numbers, Bebas Neue for display headings. **No emoji anywhere**; icons are inline SVG.
- Tiers are shown as coloured hexagons (`tierIcon`) and roman-numeral medals (`tierMedal`); the old glyph icons are gone.
- Rounded layered surfaces, gold gradient for primary actions, bottom tab bar under 900px. All of this lives in the "PREMIUM DESIGN LAYER" CSS block, which overrides the older base rules above it.

---

## 7. UX / style decisions already made

- Dark warm palette: bg `#1a1612`, surface `#25201c` / `#302a24`, border `#3d342c`, text `#f0e8d8`, dim `#a89578`, accent gold `#e6b84a`, success `#7fd9a8`, error `#e8734a`. (Female standalone version used `#1a1414` base with Playfair Display.)
- Fonts: Bebas Neue (headings), DM Mono (body), Playfair Display (Goddess hero).
- Hero slogans: "WORK HARD / STAY HARD" — "Track · Progress · Dominate" (male); "HOURGLASS GODDESS" — "Sculpt · Shape · Slay" (female).
- Screens: Auth → Profile setup (first login only) → Program selector → App with tabs **Tracker / Progress / Settings**, top-bar buttons Switch Program, Logout, Save (also downloads JSON backup), Load (paste JSON).
- 12 week columns per exercise (collapse to 6 / 4 columns on narrow screens).
- Settings: edit metrics (re-ranks tiers live), BMI + multiplier display, email & signup date, reset password, delete data (type "DELETE").

---

## 8. Roadmap (do in order)

1. **Fix bugs 1-5** above. Test locally: `python3 -m http.server 8000` → open `http://localhost:8000`. Use `tools/supabase-test.html` to confirm the connection.
2. **Deploy to GitHub Pages:** create repo, push `index.html` at repo root, Settings → Pages → Deploy from branch `main` / root. Add the Pages URL to Supabase Auth → URL Configuration (Site URL + redirect URLs). Test on iPhone Safari (not inside the Claude app).
3. **Progress tab:** Chart.js line chart per exercise, start / best / change stats, tier progress bar with milestones.
4. **"Today's workout" flow** like `reference/design-inspiration/`: show next workout in the rotation, sets×reps list, "Start workout" mode with rest timer, progression hints (+2 kg / +reps / +sets) when the top of the rep range is hit.
5. **PWA:** manifest + service worker so it installs to the iPhone home screen and works offline (queue saves, sync later).
6. Bodyweight log over time; mobility sessions for Beast Mode; per-set logging & RPE; form notes per exercise.
7. Later: consider splitting the single file into a small Vite project once it passes ~2,000 lines; native app via Capacitor if needed.

---

## 9. History of the build (short)

1. Converted owner's 4-day routine → 3-day PPL; built a 12-week strength tracker (`strength-tracker.html`) with charts, tiers, JSON save/load, brown/khaki theme.
2. Added a female program from the "Hourglass Aspect 3.0" doc; briefly made a separate `hourglass-goddess-tracker.html`, then the owner asked for **one app with a program menu**, and said it will become a real app with per-user data.
3. Unified tracker with selector (localStorage). "Switch Program" never worked reliably (Bug 3).
4. Added two total-body programs for 1-2×/week training, rewritten for a basic gym and trimmed to 6 exercises.
5. Chose Supabase (free tier) over Firebase; added auth, cloud sync, RLS SQL.
6. Added profile/body metrics, personalized thresholds, Settings tab.
7. Hit "Script error" in the Claude app preview; tried init delays; discovered the first key given was wrong and swapped to the anon JWT. Error remained (Bug 1 is the likely reason, plus the preview sandbox).
8. Netlify rejected (paid after credits) → GitHub Pages chosen; owner had just created repo `workout-trackerz` when the chat ended.

Other leftovers in the old outputs folder (not included, superseded): `strength-tracker.html`, `workout-tracker.jsx`, `workout_tracker.xlsx`.

---

## 10. Folder map

```
CLAUDE.md                     ← this file
index.html                    ← the app (needs Bugs 1-5 fixed)
supabase-setup.sql            ← DB schema + RLS
tools/supabase-test.html      ← connection smoke test
docs/PROJECT-DOCUMENTATION.md ← older long-form docs
docs/DEPLOYMENT-GUIDE.md      ← step-by-step GitHub Pages guide for the owner
reference/program-photos/     ← owner's original program screenshots (source of 4.1, 4.2)
reference/design-inspiration/ ← target look for a future "Today's workout" UI
reference/debug-screenshots/  ← Supabase key page, "Script error" console, GitHub setup page
```

## 11. How to work with the owner

- Explain in plain language; give exact click-paths for Supabase/GitHub.
- After each fix, tell them exactly how to test it on their phone.
- Never ask them to paste secret keys. The anon key is fine.
- Keep everything free-tier.

## 12. Lock-screen rest alerts (Web Push) — added 2026-10-27
- App writes `rest_timers` (one row per user: `fire_at`, title, body) when rest starts; deletes it on skip / when seen on screen.
- `pg_cron` job `rest-push` runs every 5 s and calls the Edge Function `supabase/functions/rest-push` (deployed via the dashboard editor, **JWT verification off**, authenticated by `x-cron-secret`) only when a timer is due. The function deletes due timers and sends Web Push with `npm:web-push` to `push_subscriptions`.
- Keys: VAPID public key is in `index.html` (`VAPID_PUBLIC_KEY`); the VAPID private key and cron secret live only in the DB table `push_config` (RLS, no policies). `supabase-push-setup.sql` in the repo has placeholders; the filled-in copy was given to the owner via clipboard and is not in git.
- `push_log` (anon-readable status codes + push host) is for troubleshooting: `GET /rest/v1/push_log?order=at.desc`.
- iPhone: only works when the app is installed to the Home Screen (iOS 16.4+), then Settings → Rest Alerts → Turn on.

- `APP_VERSION` (top of the script in index.html) is shown at the bottom of Settings; bump it on every deploy so the owner can confirm their phone updated.

## 13. Cardio zones, Steps tab, program builder (added 2026-10-27, v1.7)
- **Cardio days** (programs with `weekPlan`): Today shows `CARDIO_ZONES` (5 zones, % of max HR via Tanaka 208 − 0.7×age, RPE + talk test, cited evidence in `CARDIO_EVIDENCE`) instead of the lifting days; "Lift today instead" sets `todayMode = 'lift'`. Cardio sessions: `_sessions[program]` entries `{type:'cardio', zone, name, minutes, avgHr?}`; weekly WHO moderate-equivalent shown (Z4–5 count double, Z1 not counted).
- **Steps tab**: web apps can't read Apple Health, so an iPhone Shortcut "Workout Steps" posts `{token, steps, date}` to Edge Function `steps-ingest` (JWT verification OFF). Tables `step_counts` (user/date) and `step_tokens` (per-user private key) from `supabase-steps-setup.sql`. Users install the shared shortcut from `STEPS_SHORTCUT_LINK` (iCloud link, owner's copy; its first Text action holds the key and is an Import Question, so the shared file has no key — re-share and update the constant if the shortcut changes). The tab refreshes every 60 s while open; manual entry upserts `step_counts` directly. `userProfile.stepGoal` (default 10,000). The steps habit auto-ticks at 8,000.
- **Program builder**: `workout_data._customPrograms[id]` (ids `custom-…`) → `registerCustomPrograms()` adds them to `PROGRAMS` (called in `loadUserData` and `applyCache`). Exercises from the library keep `thresholds`, `standardGender` and `swapKey`; custom ones have `thresholds: null`, so tiers are optional everywhere (`getThresholds` returns null).
