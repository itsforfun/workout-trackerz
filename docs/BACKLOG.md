# Odyr — ideas backlog

Every idea raised while building Odyr, and where it stands. Rebuilt on 2026-10-28 from the full conversation history.
**Update this file whenever something is built, dropped or newly suggested.** The version number is the one shown at the bottom of Settings.

Status: **Done** · **Check** (built, still needs a look on the iPhone or a small follow-up) · **Next** (not started) · **Dropped** (decided against, with the reason)

---

## Check — built or decided, not fully closed

| Item | What's left |
|---|---|
| Trophy room, design carried across the app, shorter quotes (v1.29–1.37) | See it on the iPhone |
| French version (v1.35–1.36) | A native French speaker using it for a few days |
| Decimals in French text | Show "62,5 kg" instead of "62.5 kg" (typing a comma already works) |
| Badge rarity ("Top 25%") | Estimated for now; switch to real numbers once there are enough users |
| "Delete my data" | Deletes the data but not the login; a real account deletion needs a small server function |
| Backup download | Exports one program's log; a full "Export all my data" is still missing |
| Name "Odyr" | Formal trademark search before charging money |
| Summary and share cards (v1.38) | Try them after a real workout on the iPhone |
| Pro waitlist (v1.39) | Table is live; check Supabase → Table Editor → pro_waitlist after people have used the app for a few weeks |
| Tab bar lens (v1.43–1.44) | Try the glide and the drag on the iPhone; tune speed or stretch if needed |
| Exercise guide (v1.39) | The owner finds the stick-figure demos inaccurate; still deciding on licensed demos (exercise.com, ExRx.net, MuscleWiki, WorkoutLabs). Body map and muscle library done in v1.47 |
| New accounts feel empty | A better first day: welcome, first goal, walkthrough straight away; "Install Odyr" prompt when opened in Safari |

## Next — not started

**Sharing and motivation**
- Share cards for a single new record and for level-ups (the summary and weekly recap can be shared already)
- Share button on the badge sheet (for the share cards)
- Friends and weekly challenges (steps or workouts), small private groups
- Read-only progress sharing with a coach or training partner
- Personal greeting with your name, and "What's new" notes after updates

**Coach (the paid "Pro" tier idea)**
- AI coach chat that answers from your own log ("why has my bench stalled?")
- Adaptive nutrition: protein and calorie targets that follow your weight trend
- Readiness from Apple Health sleep and resting heart rate (today it's a manual check-in)
- Volume tuning: add or remove sets per muscle based on how you respond
- Full week replanning when a day is missed (today: a catch-up offer on cardio days)
- Selling it: Stripe payments, terms of service, privacy policy, health disclaimer review

**Content**
- Filmed or 3D exercise videos (today: drawn line-figure demos)
- Copy pass so every label and message speaks in one voice

**Feel and polish**
- Light theme, and a choice of accent colour (gold, silver, rose)
- Large titles that shrink into the top bar on scroll
- Connected transitions (a lift expands smoothly into workout mode)
- Larger-text support
- Sign in with Apple

**Languages**
- Spanish, German, Portuguese (one language file each; see CLAUDE.md section 24)

**Reliability and trust**
- More automated checks as features are added (badges, steps sync, reminders)
- Privacy policy
- Move the data into proper tables if the saved log grows large

**Native iPhone app (costs $99/year for an Apple Developer account)**
- App Store app via Capacitor
- Truly live steps and workouts from Apple Health (no Shortcut)
- Home-screen widgets (rings, streak), Live Activity for a ticking rest countdown on the lock screen (owner asked for it, 2026-10-29), Apple Watch app

**Other**
- Progress photos and body measurements, kept private
- Own web address (for example odyr.app)
- Program suggestion during sign-up (3 questions); the "Build it for me" generator exists but isn't part of onboarding

## Dropped

| Idea | Why |
|---|---|
| Netlify hosting | Became paid; moved to GitHub Pages (free) |
| Separate Hourglass Goddess app | One app with a program menu instead |
| 9-exercise full-body session | Too long; 4–6 exercises per session |
| Supplement and medication notes in the 3-Day program | Personal health details; kept out of the app |
| iPhone system font (SF Pro) and copying Apple's look | Went for Odyr's own identity (Bebas, Inter, Instrument Serif) |
| Frosted-glass top bars | Caused the blurry/stuck top of screen on iPhone; replaced by solid bars |
| One overall "strength score" | Replaced by levels/XP and the consistency score |
| 5 badge tiers, or 10 | Settled on 8 (Iron → Obsidian) |
| Names "Workout Tracker", "Aurum", "Odyra" | Aurum was crowded in fitness; Odyra had 3 syllables; chose Odyr |
| 9 of the longest opening quotes | Too long to read comfortably; never shortened into misquotes |

## Done (by version)

| Version | What |
|---|---|
| 1.0–1.4 | Bug fixes (script error, separate data per program, Switch Program, saving), Progress tab with charts and tier bars, deployed to GitHub Pages, Today's workout with workout mode and rest timer, progression hints, sets and reps logging, installable offline app, bodyweight log, form notes, mobility sessions, streaks, tier celebration, kg/lb, new 12-week cycle |
| 1.5 | Lock-screen rest alerts, plate calculator, swap exercise, haptics and motion |
| 1.6 | 3-Day Full Body program (warm-up, habits, coach rules, power unlock) |
| 1.7–1.9 | Cardio zones, Steps tab with the Apple Health shortcut, program builder, calmer cardio day, folded habits |
| 1.11–1.16 | Design system, Today rings, focused workout mode, new-record moment, iPhone top-of-screen fix |
| 1.18–1.20 | Consistency score, bottom sheets, rolling numbers, placeholders, empty states, pull to refresh, filled tab icons, levels and XP, tiered badges |
| 1.21 | Weekly recap, lock-screen reminders, coaching tips, walkthrough, cardio from Apple Health |
| 1.22–1.24 | Adaptive coach (effort per set, deloads, readiness check, catch-up, program generator), "How the coach works" with PubMed-checked sources, shared shortcut with exercise minutes |
| 1.25–1.28 | Opening quote screen |
| 1.29 | 8-tier medals, trophy room, badge sheet, minting moment, signature and secret badges, "almost there" nudges |
| 1.30–1.34 | Brand: Odyra, then Odyr; new icon; sign-in redesign; design carried across the app; thinker quotes |
| 1.35–1.36 | French (whole app, reminders, quotes), Language setting, French review pass, decimal comma typing |
| 1.52 | Sound fixed and extended: achievement pop-ups play reliably (sound re-enabled on every touch and after the phone locks), distinct sounds for records, badges, level-ups, new tiers and finishing a workout, 3-2-1 ticks at the end of rest, sounds mix with your music, Sounds setting |
| 1.51 | Rest on the lock screen: when the phone locks mid-rest, a notification shows when the rest ends and what's next, replaced by "Rest over" |
| 1.50 | Tab bar collapses into a pill while scrolling down (back on scroll up, at the top or on a tap); gold glint on the chosen tab; bar steps aside under sheets |
| 1.49 | Tab taps always register (no more taps lost to a tiny finger move) |
| 1.48 | Tab bar redesigned: narrower than the content, lifted off the bottom, slimmer, lighter glass with a top highlight |
| 1.47 | Anatomy body map (exercise sheet, Today, summary, weekly map on Progress); exercise library grows to 172 exercises with muscle and equipment filters; tab changes are instant; fade under the floating tab bar |
| 1.46 | Tab bar lens lands exactly centred (measured without the squeeze); one animation loop at a time |
| 1.44 | Tab bar lens re-aims when the bar resizes; no stuck lens after returning from another screen |
| 1.43 | Floating glass tab bar with a lens that lifts, glides, stretches and magnifies (iOS 26 style), draggable |
| 1.42 | One warm palette: no blue or green anywhere (rings, cardio, done states, tiers, medals, plates); Sapphire tier becomes Ruby |
| 1.41 | Reduce Motion now gives soft fades instead of no animation (cause of the flat feel on another phone); "Check this phone" diagnostics; checks for every program and new accounts. Confirmed fixed on an iPhone 17 Pro |
| 1.40 | Smoother first launch: opening-quote font shipped with the app (no jump), lighter word animation, libraries no longer delay the first screen |
| 1.39 | Exercise guide (animated demo, muscles, how-to, mistakes) for all 75 exercises; Odyr Pro waitlist with interests and fair price |
| 1.38 | Post-workout summary, share cards (workout, weekly recap), code split into organised files, automated checks run by GitHub on every push (first run green), error reports (table set up and tested) |
| 1.37 | Trophy room and Progress level ring in the Odyr-mark style, gold-dot section labels everywhere, quotes capped at ~14 words |
