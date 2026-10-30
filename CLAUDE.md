# CLAUDE.md — Odyr (formerly "Workout Tracker", briefly "Odyra") — handoff for Claude Code

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

- **App files (since v1.38):** `index.html` holds the markup only; styles are in `css/app.css` and code in `js/*.js` (see section 27). No build step: GitHub Pages serves the files as they are.
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
- **SYSTEM LAYER (v1.11, last CSS block, wins over everything above):** tokens `--s1..--s7` spacing, `--r-card` 20px / `--r-inner` 14px, `--raised` + `--lift` surfaces (depth, no outlines), `--ease` motion curve, one uppercase label style, big light Inter numbers (DM Mono retired via `--font-num`). Gold only for the main action, PRs, tiers, goals reached and unlocks. Main screens are number-first: explanations live in workout mode, log sheets and expandable cards. Add new styles there, using the tokens.

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
- **Cardio days** (programs with `weekPlan`): Today shows `CARDIO_ZONES` (5 zones, % of max HR via Tanaka 208 − 0.7×age, RPE + talk test, cited evidence in `CARDIO_EVIDENCE`) instead of the lifting days, limited to the program's `cardioZones` ({cardio:[2], rest:[1]} for fullBody3; other zones sit under a collapsed "Other zones"); "Lift today instead" sets `todayMode = 'lift'`. Cardio sessions: `_sessions[program]` entries `{type:'cardio', zone, name, minutes, avgHr?}`; weekly WHO moderate-equivalent shown (Z4–5 count double, Z1 not counted).
- **Steps tab**: web apps can't read Apple Health, so an iPhone Shortcut "Workout Steps" posts `{token, steps, date}` to Edge Function `steps-ingest` (JWT verification OFF). Tables `step_counts` (user/date) and `step_tokens` (per-user private key) from `supabase-steps-setup.sql`. Users install the shared shortcut from `STEPS_SHORTCUT_LINK` (iCloud link, owner's copy, v1.24 version sends steps + exercise; its first Text action holds the key and is an Import Question, so the shared file has no key — re-share and update the constant if the shortcut changes). The tab refreshes every 60 s while open; manual entry upserts `step_counts` directly. `userProfile.stepGoal` (default 10,000). The steps habit auto-ticks at 8,000.
- **Program builder**: `workout_data._customPrograms[id]` (ids `custom-…`) → `registerCustomPrograms()` adds them to `PROGRAMS` (called in `loadUserData` and `applyCache`). Exercises from the library keep `thresholds`, `standardGender` and `swapKey`; custom ones have `thresholds: null`, so tiers are optional everywhere (`getThresholds` returns null).

## 14. Signature moments (v1.12, 2026-10-28)
- **Today hero** (`renderTodayHero`): three rings — lift workouts this week vs `weeklyLiftTarget` (week-plan lift days, else days per rotation, 2 for one-day programs), WHO-moderate cardio minutes vs 150, today's steps vs goal. A closed ring turns gold. Streak and total sit in the footer. Planned: the future consistency score lives here.
- **Workout focus** (`updateWorkoutFocus`): first unfinished exercise is `.current`, finished ones fold to a summary line (tap to reopen), later ones are dimmed; the view glides to the next exercise. Header shows a live clock and a thin progress line; the rest bar shows what is next.
- **New record** (`checkRecord` → `showRecord`): when a checked set beats the best ever logged (not assisted; needs earlier history), a gold ring draws around the number with a soft two-note `chime()` and haptic; auto-closes after 3.4 s. Shown again in the same workout only if a later set goes higher.
- **iOS top-of-screen blur (fixed v1.16, confirmed on the owner's iPhone):** the home-screen app uses `black-translucent`, and iOS blurs the status bar plus a ~44px band below it. Nothing may rest there: pinned bars must not use `backdrop-filter` (sticky + blur renders blurred on iOS), and `.topbar`, `.workout-top` (also the builder) and the selector/auth/profile screens add `--ios-blur-band` (44px in `display-mode: standalone`) to their top padding. Scrolled content fades out via `body.scrolled::before` on every screen except workout/builder. New screens and pinned headers need the same top padding.

## 15. Consistency score + achievements (v1.18, 2026-10-28)
- `consistencyScore()`: last 7 days, lift vs `weeklyLiftTarget` (40), WHO-moderate cardio vs 150 (20), average steps vs goal (20, only once steps were ever synced), share of daily habits ticked (20, programs with habits). Missing parts drop out and the rest re-weight. Shown in the centre of the Today rings and as a breakdown card at the top of Progress; best ever kept in `workout_data._bestScore`.
- Achievements (`achievementList()`, 24): workouts, full 12-week cycle, week streaks, personal records, tiers (Novice→God/Goddess), cardio, steps, perfect habit days, score 80/100. Earned ones are stored in `workout_data._achievements` ({id: date}) so they stay earned. The first run stores the existing ones silently; later ones get the gold moment (`showMoment`, shared with new records, queued via `queueMoment` so only one shows at a time). `checkAchievements()` runs in `renderToday`, `toggleHabit` and after steps load.
- Grid lives at the bottom of Progress; the Today hero footer links to it (`openAchievements`).

## 16. Polish (v1.19, 2026-10-28)
- **Bottom sheets:** under 600px every `.modal-overlay` is a bottom sheet (grabber, slide-up). `initSheets()` adds drag-to-close and tap-outside; `SHEET_CLOSE` maps each overlay id to its close function, so a new modal must be added there.
- **Rolling numbers:** mark a number `data-count="…" data-key="…"` (optional `data-format="compact|locale"`) and call `rollNumbers(container)` after rendering; it counts from the last value shown under that key.
- **Placeholders:** `.sk` shimmer blocks (loading screen, steps ring until `stepsLoaded`). **Empty states:** `.empty-state` (Progress with nothing logged, steps chart with no steps).
- **Pull to refresh** on Steps (`initPullToRefresh`, reloads synced steps). **Tab icons:** shapes with class `f` fill and `cut` knock out when the tab is active; Progress uses an `area` path.

## 17. Levels + tiered badges (v1.20, 2026-10-28) — replaces the flat achievements of v1.18
- `playerStats()` measures everything from the saved log (all programs); steps history now loads 730 days.
- **XP / levels** (`playerXp`): workout 100, set 5, record 50, strength tier 40 per lift, cardio 1/min (Zone 4–5 ×2, Zone 1 ×0.5), steps 1 per 100 (max 150/day), habit 10 (+30 perfect day), weigh-in 10, badge tiers 50/100/200/400/800, specials 250. Level n needs `180·(n−1)^1.875` XP, max 150 (since v1.53, see section 38); ranks Rookie → Apprentice (5) → Contender (10) → Athlete (20) → Competitor (30) → Veteran (45) → Elite (60) → Master (75) → Grandmaster (90) → Legend (110) → Titan (130) → Mythic (150). XP is recomputed from data (retroactive), not a ledger.
- **Badges:** 17 tracks (`badgeTracks()`), five tiers each (Bronze, Silver, Gold, Platinum, Diamond), plus 7 specials (`specialBadges()`). Stored in `workout_data._badges` ({track: tier}), `_specials` ({id: date}) and `_level`, so they never go down. The first run stores the existing ones quietly (and drops the old `_achievements`); later tier-ups, specials and level-ups each get a moment (badge moments are tinted in the tier colour).
- UI: level strip at the top of the Today hero (gold bar), level card at the top of Progress (ring, rank, XP breakdown), badge grid + specials at the bottom of Progress.

## 18. Coaching (v1.21, 2026-10-28)
- **Insight** (`coachInsight`, card under the Today hero): first match of stalled lift → 5+ days off → streak at risk (Fri–Sun) → cardio behind (Thu+) → steps under 70% of goal → biggest gain ≥10%. Dismiss hides it for the day (localStorage).
- **Walkthrough** (`startTour`): spotlight tour of Today, once per account (`workout_data._tourDone`); Settings → Help → Replay.
- **Weekly recap** (`openRecap`, `recapModal` sheet): last Monday–Sunday — score vs week before, workouts, cardio, steps, records, XP (`weekXp`), badges (`_badgeLog` [{track, tier, date}] from v1.21 on), and a focus line from the weakest score part. Shown once a week (`_recapSeen`) when Today opens and last week had activity; also Progress → "Last week's recap" and Settings → Help.
- **Reminders** (`planNudges`, Settings → Reminders, `profile.nudges`): app rewrites the next 7 days of rows in `scheduled_pushes` (workout days 08:00, streak at risk Sat 10:00, steps 18:30). `rest-push` sends them; the steps text is written at send time and skipped once the goal is met. Needs `supabase-v2-setup.sql` + redeploying `rest-push`.
- **Cardio from Apple Health:** the Shortcut may send `exercise` (Apple exercise minutes) → `step_counts.exercise_minutes` via `steps-ingest`. Per day, cardio counts the larger of logged cardio and `healthCardio(date)` (exercise minutes minus logged workout minutes), at moderate (Zone 2–3) intensity. Needs the SQL, redeploying `steps-ingest`, and the Shortcut field.

## 19. Adaptive coach (v1.22, 2026-10-28)
- **Effort per set** (`EFFORTS`: Easy 4 / Good 2 / Hard 1 / Max 0 reps in reserve): chips appear under each ticked set; saved as `set.rir`. `rateSet` adjusts the next set live (easy at top of range → +1 step; max effort and short of the range → −1 step). Sessions keep `efforts` [rir…].
- **Progression** (`getProgression`, uses `averageRir`): top of range + easy → double jump; top of range + all max → "own it" (repeat); in range + easy → +1 step; missed reps at max → −1 step; stall rule now applies to every program. Deload entries (`entry.deload`) are ignored by progression and stall checks.
- **Deloads** (`checkDeload` after each workout; `workout_data._deload[program]` = {start, until, reason, skipped?}): triggered by ≥2 stalled lifts, two all-out sessions in a row, or ~7 weeks of training with a 6-week streak. Next 7 days: ~10% lighter, ~60% of sets. Card on Today with "Skip".
- **Readiness** (`startWorkout` → `readinessModal` → `beginWorkout(readiness)`): sleep/soreness/energy 0–2 each; low (≤2) → ~10% lighter and one set fewer; high (≥5) → push note. Layoff rule (7+ days off → 10% lighter) now applies to every program.
- **Catch-up:** on a week-plan cardio/rest day, a missed lifting day this week is offered (`missedLiftDay`).
- **Program generator** ("Build it for me" on the program menu, `generateProgram`): goal × days (2–5 split templates `GEN_SPLITS`) × equipment × session length × joints to protect, picking from `GEN_PATTERNS` (library names, so standards carry over). Opens in the builder for review before saving.
- **How the coach works** (v1.23, `COACH_SCIENCE`, `scienceModal`): one section per coach rule (rule, why, honest note on what is a judgement call, references). Opened from Settings → Help, the readiness sheet, the deload card and the generator. References were checked against PubMed on 2026-10-28 (Coleman 2024, Bell 2022, Helms 2018, Bosquet 2013, Refalo 2023, Zourdos 2016, Greig 2020, Paluch 2022 confirmed, with DOIs where known; others link to a PubMed title search). When a coach rule changes, update its section here too.

## 20. Opening quote (v1.25, 2026-10-28)
- `#splash` at the very top of `<body>` with a small inline script: picks the next line from `QUOTES` (50 lines written for the app, no attributed quotes) from a shuffled deck in `localStorage` (`wt_quote_deck`), so nothing repeats until all are seen; the weekday above it. Dissolves into the app once loading finishes (min 2.4 s, max 5 s; tap skips). After 15+ min in the background it plays again with a new line (not during a workout). Settings → Experience → Opening quote (per device, `wt_splash_off`). Quote font: Instrument Serif (tall and narrow like the Bebas headings); no wordmark. v1.27: words rise one by one out of a blur (`renderSplash` wraps each word in `.w` with `--i`), a gold hairline draws under the weekday, and on exit the quote drifts up and blurs while the page underneath rises into place (`body.app-enter`, pages only so fixed bars stay put). v1.28: slowed down (words 1.5 s each, 140 ms apart; hairline 1.7 s; exit 1.3 s); display time = 700 + 1500 + 140 × words + 1600 ms (`window.__splashMin`), max 7 s or that, tap skips.

## 21. Eight-tier badges + trophy room (v1.29, 2026-10-28) — supersedes the badge part of section 17
- `BADGE_TIERS`: Iron, Bronze, Silver, Gold, Platinum, Ruby (was Sapphire until v1.42), Diamond, Obsidian (XP 25 → 3,000; estimated rarity per tier). Each tier has its own medal silhouette (`medalSvg(tier, icon, size)`; tier 0 = locked outline). 17 tracks (`badgeTracks()`, groups in `BADGE_GROUPS`), all paced the same way (Iron first try → Obsidian 3+ years); Strength Standard maps Beginner→Iron … God/Goddess→Obsidian.
- Old five-tier saves convert once via `OLD_TIER_MAP` (`_badgeVersion` 2), quietly. `_badgeDates[track][tier]` records when each tier was earned (from v1.29 on).
- 15 one-off badges in `specialBadges()`: signature (Perfect Week, Listened to Your Body, Deload Done Right, Honest Effort, Dawn Patrol, plus the earlier seven) at 250 XP, and 3 `secret` ones (Night Owl, The Full Cycle, All In) shown as "?" until earned, 500 XP. Workout sessions now store `startHour`.
- **Trophy room** (`trophyScreen`, `openTrophyRoom`; from the Today level strip, the badges link and Progress): level hero, 3-slot showcase (`_showcase`), badges grouped, closest-to-next first. **Badge sheet** (`badgeModal`): tiltable medal, progress to next tier with a tip, tier ladder with dates/rarity, pin to showcase.
- **Minting moment** (`showBadgeMoment`): blank coin stamped into the new medal, light sweep, ring tinted in the tier colour. Diamond/Obsidian medals gleam now and then.
- **Nudges:** Today insight when a tier is within ~10% (`nearestBadgeText`), a toast one set before a Set Machine tier, and the 8 AM workout reminder mentions a tier the next workout earns.

## 22. Brand: Odyra (v1.30, 2026-10-28)
- Name **Odyra** (oh-DEER-ah), coined from the Greek *odysseia*: the endless journey. Tagline "Your odyssey, every day." Chosen after checking App Store / fitness-brand / trademark clashes (Aurum, Kintsu, Kalon, Elyra, Viora, Iduna were taken or crowded). Do a formal trademark search before charging money.
- Icon: an open gold ring (the path never closes) with a small gold point at the opening (the traveller), on the app's dark warm background — generated to `icons/icon-{180,192,512}.png` with Pillow. Service-worker cache renamed `odyra-v5`.
- Name appears in `<title>`, `apple-mobile-web-app-title`, the manifest, the sign-in card, the program picker kicker and the default top-bar title. The Apple Health shortcut keeps its name "Workout Steps".
- Opening quotes (`QUOTES`, 50 lines written for the app) follow the brand themes: the endless journey, constant change, listening to the body, endurance, never yielding.
- Sign-in screen (v1.31): no card; the Odyra mark as inline SVG (`.auth-mark`, ring draws itself, the traveller point pops in), wide-spaced ODYRA wordmark, Instrument Serif tagline, text tabs with a gold dot, line-style fields. Copy in sentence case ("Log in", "Create account").

## 23. Final name: Odyr (v1.32, 2026-10-28) — supersedes "Odyra" in section 22
- **Odyr** (OH-deer), two syllables, from the Norse Óðr: the far-travelling husband of Freyja, whose name means "mind, soul, inspiration". Tagline **"The path to greatness."** The owner wanted a two-syllable, unique name around the journey, attunement, endurance and the path to greatness. "Odyssey"-named fitness apps exist, so the tagline avoids the word "odyssey". Same icon/mark; cache `odyr-v6`. Still do a formal trademark search before charging money.
- v1.33: the sign-in look carried across the app. Shared mark symbol `#odyrMark` (use with `<svg><use href="#odyrMark"/></svg>`; `.screen-mark`, `.topbar-mark`). Profile setup has no card, the "ABOUT YOU" airy title and a serif line. `.line-fields` gives forms underline-style fields (profile, settings). The program menu has the mark, a serif line and cards rising in turn. Settings section names are small uppercase labels with a gold dot. The tab bar has a gold dot under the active tab; the top bar shows the mark and a quieter "Programs ›" button.
- v1.34: `QUOTES` now holds 81 entries: 50 lines written for the app, plus 31 `[quote, author]` pairs from public-domain writers and classic translations (Tennyson, Homer/Butler, Hesiod, Seneca, Marcus Aurelius/Long, Epictetus, Lao Tzu, Heraclitus, Aristotle, Ovid, Virgil, Nietzsche, Emerson, Thoreau, Whitman, Gibran 1923, T. Roosevelt 1903, Kipling). Only use documented, correctly attributed lines; avoid common misattributions ("We are what we repeatedly do" is Will Durant, not Aristotle) and modern authors/translations under copyright. The author shows under the quote (`#splashBy`); quotes over 14 words get the smaller `.long` size; the deck reshuffles when the collection size changes (`wt_quote_count`).


## 24. Languages (v1.35, 2026-10-28)
- The app is written in English. Other languages live in `lang/<code>.js` (`I18N_PACKS[code] = { name, locale, quotes, strings }`); French (`lang/fr.js`) is the first, using "vous" and gender-neutral wording where it can.
- `LANG` = Settings → Experience → Language (`localStorage.odyr_lang`), else the phone's language (`navigator.languages`), else English. `LOCALE` drives dates and numbers. Changing language reloads the page. `profile.lang` tells the server which language to write reminders in (`rest-push` → `STEPS_TEXT`).
- How it works (top of `<body>`): a MutationObserver translates every text node and `placeholder` / `title` / `aria-label` as it appears, via `tr(text)`. Keys are the exact English text with whitespace collapsed; `{}` in a key matches any value (values are translated too), `{#}` only a number, and `{0}` `{1}` in the French reorder values. When several patterns fit, the one with more fixed text wins. Text `tr` produced is never translated again (no loops). `confirm`/`alert`/`prompt`, Chart.js labels and push titles go through `tr` too. Elements with `data-no-i18n` are skipped (the opening quote, language names).
- Opening quotes: `PACK.quotes` has the same order as `QUOTES` (`quoteAt(index)`). Thinker quotes in French are faithful renderings of the public-domain originals; scientific reference titles stay in English.
- **When adding or changing English text:** add the matching entry to every `lang/*.js` pack (same key text). To check coverage, open the app in that language, visit the screens and run `I18N.missing` in the console: it lists text seen without a translation (program names, "Workout Steps", units and citations are meant to stay as they are).
- Adding a language: copy `lang/fr.js`, translate, add it to `LANGUAGES`, a `<script src>` and `sw.js` `APP_SHELL`, and add its reminder text to `STEPS_TEXT` in `rest-push`.
- v1.36 French review pass: typographic apostrophes (’), gender-neutral slogans and goal names, clearer terms ("Données corporelles", "Retour en force", "Couche-tard"), iPhone wording in the steps setup. Decimal commas typed on European number keypads are turned into dots as you type (capture-phase `input` listener for `inputmode="decimal"` fields), so "62,5" saves as 62.5. Compact numbers use the locale (8,7k). Still shown with a dot: decimals like "62.5 kg" in text (formatNum also feeds inputs).

## 25. Design carry-over II + shorter quotes (v1.37, 2026-10-28)
- **Trophy room** without boxes: soft gold glow behind, the level shown in an **open ring that echoes the Odyr mark** (`levelRingSvg(xp)`: track is the mark's 334° arc with the gap at the top right, gold fill = progress to the next level, the traveller dot sits at the tip), wide-spaced rank, Instrument Serif "XP to level" line, uppercase stats line. Pinned medals stand on a gold hairline (no slot boxes). Hero and showcase rise in on open. The Progress level card uses the same ring.
- Every `.section-head` (trophy room groups, Signature, Progress) and the danger zone title are now quiet uppercase labels with a gold dot, like Settings. Screen titles (`.workout-title`) and sheet/card display headings are a touch airier.
- Opening quotes: max ~14 words in either language. Dropped the 9 longest attributed lines (Hesiod, Seneca "not because things are difficult", Marcus Aurelius "good man", Epictetus, Nietzsche "dancing star", Thoreau, Gibran, T. Roosevelt, Kipling); 72 entries now (50 written for the app, 22 attributed). Never shorten a real quote into a misquote; drop it instead. `QUOTES` and `lang/*.js` `quotes` must stay the same length and order.

## 26. Ideas backlog
- `docs/BACKLOG.md` lists every idea raised so far: Check (built, needs a look or a follow-up), Next, Dropped (with the reason) and Done by version. Update it in the same commit whenever something is built, dropped or newly suggested.

## 27. Summary, share cards, file layout, checks, error reports (v1.38, 2026-10-28)
- **Post-workout summary** (`summaryScreen`, `openSummary(summary)`, built in `finishWorkout`): XP gained inside the open level ring, day name, date + week (serif), Time / Sets / Volume (display units, weight × reps of weighted sets) / Records, new records with the gain, new tiers, and each exercise's sets. Replaces the old PR/tier pop-ups at the end of a workout. Badge, level-up and recap moments wait until it is closed (`summaryOpen`, checked in `nextMoment`).
- **Share cards** (`openShareCard(card)` → `drawShareCard` on a 1080×1920 canvas → `shareModal` preview → `navigator.share` with the PNG, or a download on desktop): Odyr mark, kicker, airy title, serif line, 2×2 stats, gold records, "ODYR · The path to greatness." From the summary (`shareSummary`) and the weekly recap (`shareRecap`, data from `recapData(monday)`). Text goes through `tr()`.
- **File layout** (classic scripts, one shared global scope, loaded in this order by `index.html`): `js/i18n.js` (language engine, top of body) and `js/splash.js` (opening quote), then `core` (Supabase, state, standards, navigation, error reports) → `sound` → `auth` → `sync` → `programs` (definitions, progression, tracker, tiers) → `today` (Today, cardio) → `steps` → `builder` → `workout` (workout mode, rest timer, swaps, plates, rest alerts) → `guide` → `library` → `anatomy-data` → `anatomy` → `summary` → `rewards` (celebrations, score, XP, badges, trophy room) → `progress` (Progress, bodyweight, cycles, data, UI helpers) → `coach` (adaptive coach, science, insights, tour, recap, reminders) → `pro` → `diagnostics` → `tabbar` → `polish` → `main` (start-up). Top-level code may only call functions from its own file or earlier files. New files must also go in `sw.js` `APP_SHELL`.
- **Automated checks:** open `index.html?test` (and `?test&lang=fr`) and the results show at the bottom of the page. `tests/setup.js` replaces Supabase with a pretend client (records upserts in `window.__sbCalls`), `tests/fixture.js` (`loadFixture()`) loads sample data before each check, `tests/tests.js` holds the checks: units, standards scaling, progression rules, stall, per-program data, migration, upsert with `onConflict`, decimal comma, finishing a workout (save + session + summary + record + XP), levels, score, every screen renders, quote counts/lengths, and in French: translations, no translation loops, every screen fully translated. GitHub runs both pages in headless Chrome on every push (`.github/workflows/tests.yml` → `tests/ci.mjs`). Add a check whenever you add a rule the coach, scoring or saving depends on.
- **Error reports:** `reportError` (in `core.js`) sends uncaught errors and unhandled promise rejections (not network drops, not cross-site "Script error.") to the `error_log` table: message, file:line, stack, version, screen, user id, browser. Max 5 per page load, no repeats, never in test mode. Table + insert-only RLS + 90-day cleanup in `supabase-errors-setup.sql`; read it in Supabase → Table Editor → error_log.
- `?lang=fr` in the address overrides the language setting (`storedLang`).

## 28. Exercise guide + Odyr Pro waitlist (v1.39, 2026-10-28)
- **Guide** (`js/guide.js`, `guideModal`): opened from the **Form** button next to Swap in workout mode (`openGuide(slot, true)`, follows swaps) and by tapping an exercise on Today (`openGuide(id)`). Shows an animated line-figure demo, the name, sets × reps, muscles (primary in gold), the exercise's own `note` as "Coach's note", 3 "How to" cues and 2 "Avoid" points.
- Each exercise maps to one of 31 movements via `GUIDE_RULES` (regex on the displayed name, first match wins: e.g. leg curl before curl, goblet before squat). Movement text lives in `GUIDE_TEXT`, demos in `GUIDE_DEMOS`: two poses of a side-view (or `view: 'front'`) figure on a 200×200 canvas; joints `h s e w p k a t` (+ `k2 a2 t2` back leg with `legs: 2`; front view `s1/s2 e1/e2 w1/w2 p1/p2 k1/k2 a1/a2`), merged over `SIDE_BASE` / `FRONT_BASE`; props: `plate`, `db`, `line` (gold, or `faint` for cables/benches), `rect`. SVG `<animate>` glides A → B → A every 3.4 s; Reduce Motion shows pose A. A new exercise name needs a rule (the automated check fails otherwise); custom exercises show "no guide yet".
- **Odyr Pro waitlist** (`js/pro.js`, cards with `data-pro-card` at the top of Settings and the bottom of Progress): "Notify me" → what matters most (AI coach chat, adaptive nutrition, readiness from sleep, programs built for me) + fair monthly price ($/€ 5, 8, 12, or wouldn't pay) → "Join the waitlist". Saved in `profile.pro` {joined, interests, price} and upserted into `pro_waitlist` (one row per user, own-row RLS; `supabase-pro-waitlist-setup.sql`). No payment, no feature change. Count interest in Supabase → Table Editor → pro_waitlist.

## 29. Smooth first launch (v1.40, 2026-10-28)
- A phone opening Odyr for the first time saw a jumpy opening quote: the fonts came through a slow chain (page → css/app.css → @import Google CSS → font files), so the quote appeared in a fallback font and jumped when Instrument Serif arrived; the Chart.js and Supabase libraries in `<head>` also delayed the first paint.
- Now: Instrument Serif ships with the app (`fonts/*.woff2`, SIL OFL in `fonts/OFL.txt`, `@font-face` at the top of css/app.css, preloaded in `<head>`, cached by sw.js); the other Google fonts load with a `<link>` (preconnected), not `@import`; the two CDN libraries load at the end of `<body>` just before `js/core.js`. The splash waits up to 1 s for the font (`holdSplashForFont`, `.splash.waiting` pauses the animations; the wait is added to `__splashMin`).
- Words now rise with opacity + transform only; the blur is one `quoteFocus` animation on the whole quote (per-word blur was heavy on 60 Hz / older phones, worse in French where quotes have more words). Chart label translation moved to `js/core.js` (Chart.js now loads after `js/i18n.js`). Pattern lookups in `tr` check the fixed start/end before running the regex.
- Rule: never put blocking `<script>` tags or CSS `@import` in front of the opening quote.

## 30. Reduce Motion done right + diagnostics (v1.41, 2026-10-29)
- Found while comparing the owner's iPhone 16 Pro with an iPhone 17 Pro that felt flat: a blanket CSS rule cut **every** animation and transition to 0.01 ms whenever the iPhone's Reduce Motion setting was on (fades included), and several entrances were set to `animation:none`. Removed. Now, under `prefers-reduced-motion: reduce`, the same keyframe names are redefined as opacity-only fades at the end of css/app.css (rise, sheetUp, sheetRise, popIn, splashIn, wordIn, appRise, authRise, recordRise, …), tab changes cross-fade without moving (`switchTab`, `still`), and only constant motion (confetti, shimmer, medal glints) stays off. Rule: never switch animations off for Reduce Motion; remove movement, keep fades.
- **Check this phone** (Settings, under the version; `js/diagnostics.js`, `diagModal`): app version, iOS, Home Screen or Safari, Reduce Motion, Reduce Transparency, measured animation frame rate, screen, language, quote font, offline copy, program, workouts, errors this session. Open it on two phones and compare.
- Automated checks now run every program for a brand-new account and with data (all tabs, trophy room, walkthrough, a full workout + summary) and fail if a rule ever cuts all animations again.

## 31. One warm palette, no blue or green (v1.42, 2026-10-29)
- The owner disliked the mint greens and sky blues left from early versions (rings, cardio, done states, pop-ups). Everything is now warm metals: **ivory** `#efe6d6` (Lift ring), **copper** `#c98f66` (`--copper`: Cardio ring, cardio bar), **warm stone** `#b0a491` (`--stone`, `--blue`: Steps ring, info, offline status), **champagne** `#dcc89e` (`--success`, `--green`: ticked sets, saved, gains, joined), **gold** for closed rings, records and main actions, **terracotta** `#e07a5f` for danger only.
- Strength tiers (`TIERS`): stone → copper → silver → gold → platinum → radiant gold (the tier table in section 5 lists the old colours). Cardio zones: stone, champagne, gold, copper, terracotta. Badge tiers: Platinum is warm platinum, **Sapphire is now Ruby** (garnet shield), Diamond is a brilliant colourless gem; stored tiers are indexes, so saved badges are unaffected. Barbell plates are garnet, gunmetal, bronze-gold, bronze, ivory and iron.
- Rule: no blues, greens or purples. New colours come from this palette.

## 32. Tab bar lens (v1.43, 2026-10-29), inspired by iOS 26's Liquid Glass tab bar (owner's screen recording of Hinge)
- Under 900px the tab bar is a floating dark glass capsule (12px from the sides, near-opaque `rgba(28,24,21,0.97)` + blur; pages pad 104px + safe area at the bottom). The gold dot under the active tab is gone; a pill (`.tab-lens`, `js/tabbar.js`) marks it instead.
- Changing tab (`switchTab`/`showTab` call `tabLensTo(tab)`): the pill lifts into clear glass with a champagne rim and a specular sweep (`.lifted`, `--lift`), glides on a spring (stiffness 420, damping 32, slight overshoot), stretches with its speed (up to +22% wide, a little flatter), magnifies the icons it passes over (`.tab-lens-row`: a copy of the tab row kept aligned inside the lens and scaled 1.16 around its centre), the bar squeezes ~1%, then it settles into a quiet raised pill. Pressing a tab lifts the lens; you can also drag it along the bar and let go on a tab.
- v1.46: tab positions come from `offsetLeft`/`offsetWidth` (layout), not `getBoundingClientRect`, because the bar's squeeze is a transform and skewed the target by ~3px; only one animation loop can run (`tabLens.loop`).
- v1.44: the lens re-aims whenever the bar changes size (`ResizeObserver` → `retargetTabLens`), and `tabSlot` returns null while the bar is hidden (another screen open), which used to leave it with a negative width.
- Reduce Motion: the lens jumps to the tab (no glide). A fixed bar has no `offsetParent`, so visibility is checked with `offsetWidth`. The automated check simulates frames because the hidden test window pauses them.

## 33. Anatomy map + full exercise library (v1.47, 2026-10-29)
- **Body map** (`js/anatomy.js`, shapes in `js/anatomy-data.js` from react-native-body-highlighter, MIT, licence in `licenses/`): front and back side by side, male or female from `profile.gender`. `bodyMapSvg({ main, extra, weights, tap, selected, compact })`: main muscles in the Odyr gold gradient (`url(#odyrGold)`), supporting in soft gold (`--bm-extra`), the rest dark (`--bm-rest`, `--bm-quiet`); `weights` makes a heat map; `tap` names a function called with the muscle group. Shown on the exercise sheet (beside the muscle chips), on Today ("This workout hits", tap opens the library), on the post-workout summary ("Muscles trained") and on Progress ("This week's muscles": sets per muscle over 7 days, 10+ sets = full gold, supporting muscles count half; lists major muscles not trained; tap a muscle → library).
- **Library** (`js/library.js`): 15 muscle groups (`MUSCLE_GROUPS`, each mapped to body-map shapes), equipment (`EQUIPMENT`), 149 entries in `LIBRARY` as [name, equipment, unit, main, supporting]; `exerciseMuscles(name)` falls back to the guide text's muscles. `exerciseLibrary()` (builder) merges program exercises (keep tiers), swaps and the library: 172 exercises. The builder's "Add exercise" sheet is now the library browser (`openLibrarySheet('pick'|'browse')`, `openExerciseLibrary(group)`): tappable body map, muscle chips, equipment chips, search (English or French), main-muscle exercises first, info button opens the guide (`openLibraryGuide`). Every library name has a guide movement (7 new: dip, frontRaise, reverseFly, shrug, adduction, rollout, woodchop) and a French name; the automated checks enforce both.
- **Tab bar** (same version): tapping a tab shows the new page at once with a 260 ms fade-in (it used to wait 140 ms for the old page to fade out first); the lens spring is stiffer (640/40). `.tab-scrim` fades the page into the background under the floating bar, so nothing shows through the gap below it.
- The stick-figure demos stay until the owner decides on licensed demos (exercise.com, ExRx.net, MuscleWiki, WorkoutLabs).

## 34. Tab bar placement (v1.48, 2026-10-29)
- What felt off: the bar was 12px from the edges while the cards sit 16px in (so it was wider than the content), it hugged the bottom, it was as dark as the cards (read as another card), and it was a bit tall.
- Now (last tab bar block in css/app.css): 22px from the sides (narrower than the content, so it clearly floats), `bottom: max(14px, safe-area − 10px)` (about 24px above the edge on a modern iPhone), 55px tall, lighter dark glass `rgba(40,35,30,0.84)` + blur with a 0.5px champagne edge, a fine top highlight and a two-layer shadow; 21px icons, 0.63rem labels; the scrim under it is shorter. Keep the bar narrower than the content column and lighter than the cards.
- v1.49 (taps that sometimes did nothing): the bar allowed vertical pans (`touch-action:pan-y`), so iPhone treated a tap with a slight finger move as the start of a scroll and cancelled it. Now `touch-action:none` on the bar, and the tab switches on finger-up in `lensPointerUp` (the button under the finger at pointer-down; a drag needs 12px sideways), with the browser's following click swallowed by a capture listener (`swallowHandledClick`, 700 ms) so it never switches twice; keyboard clicks still go through `onclick`. Automated check simulates plain, wobbly and double (pointer + click) taps.

## 35. Tab bar that steps aside (v1.50, 2026-10-29)
- **Collapses while scrolling down** (iOS 26 style, `tabBarOnScroll`): after ~28px of downward scrolling the bar becomes a 60×46 glass pill centred at the bottom showing only the current tab's icon (`.tab-mini`, `.bottom-nav.collapsed`; left/right/height animate on a slight spring, the tabs and lens fade and blur out). It comes back after ~14px of upward scrolling, within 40px of the top, on any tab or screen change (`tabLensTo`, `showScreen`), or when the pill is tapped (that tap only opens the bar; it never switches tab). The bounce at the very bottom of a page is ignored. It never collapses while the lens is lifted or being dragged.
- **Gold glint**: the chosen tab's icon pops and catches a gold light (`.glint`, `tabGlint`). **Under sheets** the bar and its scrim slide away (`body:has(.modal-overlay.active)`, using the `translate` property because the lens squeeze uses `transform`). **Glass thickens** slightly while content scrolls behind it (`.scrolling`).
- Reduce Motion: collapse and expand as fades, no glint, no slide under sheets. Automated check covers collapse, expand, the pill tap and sheets.

## 36. Rest on the lock screen (v1.51, 2026-10-29)
- A ticking countdown on the lock screen is a Live Activity, which only native App Store apps can show (needs the native app, backlog). Instead, when the phone locks mid-rest (`visibilitychange` → `showRestOnLockScreen` in js/workout.js), a silent notification shows "Rest · next set at 14:32" with what's next (`rest.label`). It uses the `rest-timer` tag, the same as the "Rest over" push from `rest-push`, so that push replaces it when the time is up. Coming back to the app, skipping or stopping the rest clears it (`clearRestFromLockScreen`). Needs Rest Alerts on (notification permission, Home Screen app). Automated check fakes the notification API.

## 37. Sound (v1.52, 2026-10-29)
- Achievement pop-ups were silent: audio was only enabled by Start workout and ticking a set, and iPhone suspends web audio whenever the app goes to the background (never resumed). Now `js/sound.js` is the one sound engine: every touch (capture-phase pointerdown/touchend/keydown) creates or resumes the AudioContext; a sound requested before that is kept (`pendingSound`) and plays on the first touch if under 4 s old. `navigator.audioSession.type = 'ambient'`, so sounds mix with the user's music instead of pausing it and follow the silent switch.
- `playSound(name)` with distinct sounds in `SOUNDS`: `record` (two soft notes), `badge` (metallic three-note ring: badge tiers and signature/secret badges), `level` (rising arpeggio), `tier` (two-chord fanfare: new strength tier, which had no sound), `complete` (warm chord: post-workout summary, which had no sound), `rest` (three pips), `tick` (quiet tick in the last 3 seconds of rest). `showMoment` takes `sound`. `chime()`/`beep()` remain as aliases. Settings → Experience → Sounds (`odyr_sound_off`, per device). Never call AudioContext directly elsewhere; add a sound to `SOUNDS`.
- The French table now lives only in `lang/fr.js` (the working copy used to build it is gone): add new French lines directly there, same key text as the English.

## 38. Progress overview + harder levels (v1.53, 2026-10-29)
- **Overview at the top of Progress** (`renderOverview()` in js/progress.js, `#progressOverview`): the owner felt the level and score were buried. A hero (open level ring, rank, "XP to level", "Trophy room ›") and six tiles: Consistency (score, change vs last week, 7 bars → scrolls to the score card), This week (workouts vs target → Today), Streak, Records (+ this week → lifts), Strength (average tier in its colour), Badges (earned / total, showcase medals → trophy room). Page order: overview → this week's muscles → Lifts → "Score and level in detail" (consistency, level, badges cards) → Pro card. `scrollToCard(id)` scrolls to a card.
- **Levels are harder and go to 150** (owner: "more levels and going up a level should be harder"): `xpForLevel(n) = 180·(n−1)^1.875`. At ~2,000 XP a week (3 workouts, steps, cardio): level 10 in ~6 weeks, 30 in ~1 year, 60 in ~4 years, 100 in ~10 years, 150 a lifetime. New rank Titan (130); Mythic moved to 150. XP sources are unchanged; existing users show a lower level after the update. `LEVEL_CURVE` (stored as `_levelCurve`) resets the stored `_level` to the new level quietly, so level-ups celebrate again from there; bump it whenever the curve changes.

## 39. Three tabs: Today, Progress, Settings (v1.54, 2026-10-29)
- The owner asked for the least overlap possible. Rule: **Today is this week, Progress is all time, Settings is you**; each number has one home and other places only link to it. The level is the one deliberate exception: a glance on Today (the level line at the top of the hero, opens the trophy room), the full picture on Progress.
- **Tracker tab removed.** Its 12-week grid is now the **Weekly log** under each lift's chart on Progress (`<details id="liftLogWrap">`, `renderLiftLog()` in js/programs.js, replaces `buildTracker`; same `inp_<id>_<week>` boxes, `onInput` / `onInputDone`). Finishing a box redraws the chart and numbers above (`renderProgressDetail(false)`, the log keeps focus) and still celebrates a new tier. Program slogans (`heroTitle`/`heroSubtitle`) are no longer shown.
- **Steps tab removed from the bar.** `#page-steps` still exists and opens from the Steps row under the Today rings (`.hl-open` → `switchTab('steps')`), with a "‹ Today" back link (`.sub-back`); Today stays lit in the tab bar while it is open (`showTab` maps steps → today).
- Progress overview lost the "This week" and current-score tiles (Today has them): hero + Streak, Records, Strength, Badges. The score's history stays in "Score and level in detail".
- **+5 XP** rises from each ticked set in workout mode (`floatXp`, `SET_XP`, also used by `playerXp`).
- Tab bar and lens row are 3 columns (`repeat(3,1fr)`). Adding a tab means changing those three CSS rules too.

## 40. Progress without repeats (v1.55, 2026-10-30)
- The owner couldn't find the strength standards chart (it sat ~1,200px down, under the overview, muscle map and four summary tiles) and found Progress repetitive. Removed the repeats:
  - Level: only in the overview hero. The old level card is gone; its "Where your XP comes from" moved to the trophy room (`xpSourcesHtml`, with the next rank).
  - Badges: only the overview tile; the "Trophy room" card is gone.
  - Average/top tier: only the Strength tile; the four summary tiles (`progressSummary`) are gone.
  - Lift picking: only the list; the dropdown (`progressExercise`) is gone.
  - Consistency breakdown: now a sheet (`scoreModal`, `openScore`/`closeScore`) opened by tapping the score in the middle of the Today rings, since the score is a this-week number.
- **Order:** overview (level hero + Streak, Records, Strength, Badges) → Lifts (one list) → this week's muscles → Pro card.
- **The open lift:** `#liftPanel` (numbers, chart with the next standard as a dashed line, the I–VI strength standards bar, Weekly log) is moved right under its row (`placeLiftPanel`). Tapping a row opens it (`tapLift`); tapping the open row folds it. `selectProgressExercise(id)` always opens.
- Each Progress part renders through `renderPart(name, fn)`: one part failing on odd saved data is reported to `error_log` instead of leaving the rest blank (still throws under `?test`).

## 41. Strength over time, always in view (v1.56, 2026-10-30)
- The owner couldn't find the per-exercise strength chart (it only showed after tapping a lift, and with one workout per lift it was a single dot). Now the trend is visible without tapping:
  - **Strength card** at the top of Progress, under the level (`strengthCardHtml`, `overallStrength()`): % change since the first workout and a gold line; on each workout date, the average change of every lift trained so far. With one workout: "Your strength line starts after your next workout."
  - **Every lift row** shows its own small line (`sparkSvg`) and its change (`strengthChange`), plus best weight and tier under the name.
  - **The opened lift's chart** plots one point per workout by date across all cycles (`strengthHistory`: archived cycles + current), tooltip shows what was lifted. The "Change" tile became "Strength" (% since the first workout).
- **Strength = estimated one-rep max** (`strengthOf`, Epley: kg × (1 + reps/30), best set of the workout), so more reps at the same weight counts as progress. Entries typed in the log without sets assume the bottom of the prescribed rep range. Reps-based lifts (pull-ups) use max reps. Deload entries are skipped. Tiers still use the best weight lifted, not this estimate.
- The overview tile for tiers is now "Strength tier" ("Palier de force"), so it isn't confused with the Strength card or with Level in French.

## 42. Harder badges (v1.57, 2026-10-30)
- Owner: badges came too easily. Every track (`badgeTracks()`) is re-paced for someone training ~3 times a week: Iron after a few sessions (never the first try), Bronze ~1 month, Silver ~3 months, Gold ~6 months, Platinum ~1 year, Ruby ~2 years, Diamond ~4 years, Obsidian 6+ years (e.g. workouts 3 → 1,000, sets 20 → 18,000, streak 2 → 260 weeks). Comeback is unchanged (it shouldn't reward time off). Signature badges: Honest Effort 25 workouts, Dawn Patrol 10, Adaptable 10 swaps, Night Owl 5.
- `_badgeVersion` 3: saved badges are re-measured once against the new targets, quietly (no pop-ups). Tiers above what the new targets give are taken back with their dates and `_badgeLog` entries; the stored `_level` is cleared so a lower level (less badge XP) settles without a pop-up. Specials already earned stay earned.
- **Lifts one workout at a time** (same version): a segmented control above the list (`#liftDays`, `.ld-seg`, `setLiftDay`), one segment per program day, opening on the day of the last lifting session (`lastLiftDay`). Only that day's lifts are listed (`dayLifts`, `renderLifts`); one-day programs show no segments. `selectProgressExercise` jumps to the lift's own segment.
