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
- "Pro coming soon" waitlist button, to measure interest before building Pro
- Selling it: Stripe payments, terms of service, privacy policy, health disclaimer review

**Content**
- Exercise guide: short demo, 3 form cues and common mistakes per exercise
- Copy pass so every label and message speaks in one voice

**Feel and polish**
- Light theme, and a choice of accent colour (gold, silver, rose)
- Large titles that shrink into the top bar on scroll
- Connected transitions (a lift expands smoothly into workout mode)
- A subtle sound set for key moments, to match the haptics
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
- Home-screen widgets (rings, streak), Live Activity for the rest timer, Apple Watch app

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
| 1.38 | Post-workout summary, share cards (workout, weekly recap), code split into organised files, automated checks run by GitHub on every push (first run green), error reports (table set up and tested) |
| 1.37 | Trophy room and Progress level ring in the Odyr-mark style, gold-dot section labels everywhere, quotes capped at ~14 words |
