# Backstage Blueprint — Project Status

Living snapshot of the website build. Updated when meaningful work lands.

**Last refresh:** 2026-05-31 (post-Order 001 close + Designer Briefing absorbed + experience.html corruption incident + restore + backup-checkpoint protocol locked in)

---

## What this is

A cinematic, interactive website for Backstage Blueprint — built as a guided tour through a stage-production world. Members enter through the cinematic experience, end at a contact console, dive into a 3D "lexicon" tunnel, or click into the gated **Member Hub** (The Desk / Backstage) to access their owned templates, course, and tools. **Front of House** is the public products surface (Scene 3 of the experience tour). Account tiers: **Guest Pass** (free) → **All Access Pass** (paid Membership).

**Entry point:** `experience.html` (the 5-scene scroll-snap tour)
**Gated member surface:** `members.html` (The Desk — the Members Hub scene with clickable items)
**Internal design system:** navy + cream + orange. **Archivo** (display), **JetBrains Mono** (labels), **Inter** (body).
**Public design system:** (still being defined for the landing/marketing layer)

---

## The live site at a glance

### Public / external surface

| File | What it is |
|---|---|
| `experience.html` | The 5-scene cinematic tour (EST → Hero → Production Office → Pass → Console). Boot splash on first load. Post-console CTA dives into the lexicon. |
| `lexicon.html` | 3D tunnel of live-production gear — the post-contact send-off. Camera physics with gravity drift, scroll momentum, hover-creep, BB destination beacon in the distance. |
| `blueprint.html`, `templates.html`, `checklist.html`, `audit.html`, `toolkit.html` | Product landing placeholders (audit page has copy; others are stubs awaiting strategy + storefront builds) |

### Gated / internal surface (behind The Desk on Members Hub)

| File | What it is |
|---|---|
| `members.html` | The Members Hub desk scene — clickable items: Course, Toolkit, My Binder, Keyboard (search), Credential (inspect), Mixer (dashboard inspect). Monitor screen acts as the persistent header (BB logo center, MEMBER HUB/GIBBY left, STATUS/ALL ACCESS right). |
| `my-binder.html` | Gated library of templates + guides. 14 subject cards in 4 phase clusters (Planning / Team & Advance / Show Day / The Close). Two-up cards: CSS-built template cover + per-template preview image. Three ownership states (URL param `?state=A|B|C` while Supabase isn't wired). |
| `course.html` | Course viewer / "the binder" — page-turn module reader. Login gate (any creds open in prototype). 2 modules live, 6 marked "coming soon." |

---

## The 5 scenes (experience.html)

1. **EST. → Power On.** XLR slam → PD wall fades in → XLR-circle frame snaps → switchbox rises lanyard-style → status text plate → click switch → status sequence (INITIALIZING → RIG READY) → auto-scroll to lights.
2. **HERO (Lights).** Truss with 3 moving fixtures tracking cursor. Haze button + 3 lighting cues (WASH / CHASE / PULSE). Silhouette band reveal masked into beam cones.
3. **FRONT OF HOUSE** (renamed from Production Office, 2026-05-31 — code id pending Order 002). Top-down desk view with 6 product hotspots: Free Checklist, Templates, The Blueprint, The Toolkit, The Course, Audit & Consultation. Hover lifts, click latches with breathing glow + sticky-note confirm, second click navigates.
4. **PASS.** Backstage credential floating on a lanyard. Wide magnetic-zone 3D parallax tilt. Click → Members Hub with cinematic laminate-drop transition.
5. **CONSOLE.** Clear-Com style intercom panel. PTT triggers `mailto:` for contact. Below: persistent "AFTER THE SHOW → ENTER THE LEXICON" CTA into the tunnel.

---

## What we built recently

### Lexicon (new in May)
3D camera tunnel through live-production gear (XLR, gobo wheel, moving heads, beltpacks, road cases, gaff, walkie, headlamp, gel frames, mic, truss, DI box). Pure CSS 3D + a single rAF loop. Gravity drift + scroll momentum + hover-creep + idle gravity-accel. BB destination beacon deep in the tunnel as a north star. Orange backdrop with navy blueprint vignette + perspective lines.

### Monitor screen rework (Members Hub)
The desk monitor now displays a **persistent welcome header** (BB internal logo center, `// MEMBER HUB / GIBBY` upper-left, `// STATUS / ALL ACCESS` upper-right). Subtle 3D tilt (`rotateX(-4deg)`, perspective 1100px). Boot-splash blueprint-grid backdrop. CRT scanline overlay. Hover info populates in the lower area beneath the header. Search overlay takes over the screen surface when the keyboard is clicked.

### NEW DESK_5-31 assets (Members Hub)
New background + repositioned items. Course (left, on binder stack), My Binder (bottom-left, big), Credential (center-bottom), Keyboard (center under monitor), Mixer (right of monitor, moved up), Toolkit (NEW, bottom-right — drafting paper + tools).

### Internal logo (bb-logo-internal.png)
Real BB badge in use on: Members Hub monitor welcome, Course Viewer topbar, Course Viewer login gate. Cream-on-transparent PNG (~2500px wide).

### Boot splash on experience.html
Status cycles: `PLOTTING ROUTE` → `LOADING IN` → `DOORS // SHOW READY`. Real asset preload with min-duration capping.

### Mixer Dashboard (Members Hub inspect)
Click mixer → console UI opens: central LCD + activity feed + 4 channel strips (Course / Toolkit / Binder / Membership) with scribble strips, LEDs, faders, runtime ticker. Channels navigate to product pages.

---

## Orders system (NEW workflow — May 31)

Strategist drops orders in `BB_PRODUCT_STRATEGY/BB_Products_Start/Orders/`. Each order has README.html (system) + per-order folder with ORDER.html, 01_Spec/, 02_Assets/, 03_Wiring/, 04_Returned/.

**Conventions in play:**
- **Pointer pattern** (Orders/README §06B) — for web builds, the deliverable lives in the live site, not in `04_Returned/`. A `LOCATION.md` in `04_Returned/` names every path created or touched.
- **OneDrive file-handling protocol** — for any file in OneDrive (which is everything here), use **Python single-write via bash**. The Edit tool corrupts/truncates these files. Strict rule going forward.
- **Change requests (Orders/README §06C)** — when QA wants tweaks, a `CR-NNN_Short_Title.md` lands in `04_Returned/`. Worker addresses, flips status to ADDRESSED, appends a "What I did" note.

### Order 001 · My Binder Page · **CLOSED**
- Initial build delivered (14 cards / 4 phase clusters / 3 ownership states / filter / hover REF // overlay / mobile responsive). All acceptance criteria passed.
- CR-001 (cover redesign — two-up CSS cover + preview): ACCEPTED.
- CR-002 (2-col desktop grid + equalize halves + title 14→20px): ACCEPTED.
- Order folder moved to `Orders/_Closed/001_My_Binder_Page/`.

---

## Pending / open

- **Orders 002–008 sweep coming** — Front of House rename + each destination page (Free Checklist, Templates, The Blueprint, The Toolkit, The Course sales, Audit & Consultation). Sequential, one open at a time.
- **#78 External / public wordmark** — boot splash, lexicon corner + destination beacon, experience corner mark still use CSS-drawn placeholders. Gibby has the file when he's ready; not blocking.
- **Account tiers locked (vocab)** — Guest Pass (free, Stripe Checkout auto-creates) + All Access Pass (paid subscription). Pass object on The Desk will dynamically show holder's tier + upgrade CTA. Real entitlements wiring still pending Supabase + Clerk.
- **Real Supabase + Clerk wiring** — replaces the my-binder URL-param state stub. Future order.
- **In-site Guide Reader** — currently a placeholder modal on my-binder READ GUIDE buttons. Will be its own future order.
- **The Table (per-template storefront)** — currently my-binder unowned cards link to `blueprint.html#doc-NNN` anchors. Templates page (Order in the upcoming sweep) replaces this.
- **Order 003 dependency** — email service decision needed (ConvertKit / Mailchimp / Buttondown / etc.) before the Free Checklist build can complete.

## Set aside (won't act on unless we return)

- Monitor screen lit-up state on the Power scene's PD wall (#6 — killed earlier).
- Solo XLR layer (04_SOLO_XLR.png) — Power scene depth add, dropped.
- ENGAGE POWER button (05_ENGAGE_POWER.png) — replaced by clicking the switchbox directly.

---

## Project architecture

- **One HTML file per surface**, scroll-snap layout where applicable, all CSS + JS inline.
- **CSS variables** drive theming and animation (`--orange`, `--cream`, `--navy`, `--glow-rgb`, etc.).
- **Same-canvas PNG architecture** for scene layers — every layered visual exported at 4000×2250 so positions map 1:1 between assets.
- **Hash routing** for sub-page back-links (e.g. `experience.html#scene-console`).
- **Asset folders:** subject-named (Members Room/, HOME_PAGE/, LIGHING_SCENE/, POWER_ON/, BLUEPRINT_BG_ITEMS/, my-binder/, lexicon/).
- **OneDrive-synced workspace:** root holds live files; `_working/` holds drafts + stale docs; orders folder is the strategist's parallel workspace.

---

## How we work

- Iterate in short visual passes, ship-and-tune.
- Architectural rewrites when patches stop helping (the cue system taught us this — 6 rounds before a clean CSS-animation rewrite).
- Asset positioning measured from PNG alpha bboxes, not eyeballed.
- Prefer CSS animations over JS rAF for visual effects.
- Keep affordances physical — things lift, latch, slam, glow, sway.
- Single-source-of-truth on assets and URLs. Don't duplicate.
- **OneDrive files:** Python single-write *or* Edit tool — whichever path is reading fresh content. Verify file integrity (closing tags, line count) after every write. Bash mount can lag behind the live OneDrive file; the Read/Edit/Write file-tool path stays fresh more reliably.
- **Backup checkpoint protocol (NEW 2026-05-31):** after any substantive save (Order close, multi-file change, feature merge, big rewrite), worker prompts Gibby to copy `BB-WEBSITE TESTING/` (and `Orders/` if relevant) to his isolated drive. Format: `⏸ BACKUP CHECKPOINT — [what's saved] — copy to isolated drive now`. Worker waits for confirmation before proceeding into the next thing. OneDrive version history is plan B; isolated-drive backup is plan A.

---

## Incident log

### 2026-05-31 — experience.html truncation + restore
- During the Production Office → Front of House rename, `experience.html` ended up truncated on disk (96 KB / 2822 lines, no closing tags) — boot splash hung on next load.
- Recovery: Gibby restored the file from OneDrive Version History (105 KB version, intact). Sandbox bash mount took 5–10+ minutes to invalidate its stale cache after the restore (mount served pre-restore bytes even with O_DIRECT + sync). Edit tool went through a separate file-tool path that did see fresh content; Edit was used to re-apply the 4 string swaps cleanly. Closing tags verified intact post-edit.
- Lesson: **bash-mount writes on this OneDrive folder are not bulletproof.** A bash-mediated write can fail silently mid-flush and truncate a large file. Going forward, prefer file-tool path (Read/Edit/Write) for OneDrive files, and ALWAYS verify closing tags + line count after a write to a large file.
- Backup checkpoint protocol added to "How we work" the same day, with the first checkpoint successfully completed post-incident.

---

*This doc updates as we work. If it gets out of date, ask for a refresh.*
