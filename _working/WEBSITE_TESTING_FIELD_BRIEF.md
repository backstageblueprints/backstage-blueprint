# Backstage Blueprint — Website Testing Field Brief

**Scope of this brief:** the website experience build. Other BB workstreams (Rider Builder, marketing tools, email, fulfillment) are happening in parallel threads and are **not** captured here. Anywhere this brief says "outside my context" — go to Gibby.

**Audience:** strategist (human or AI) catching up to the website work.

---

## BB in 30 seconds

- **What:** Backstage Blueprint is a brand serving live production / touring professionals — tour managers, production managers, FOH engineers, and the people whose work makes shows happen.
- **What it sells:** templates, a Blueprint bundle, a toolkit (tech rider / stage plot builder), a course, a free checklist, audit / consultation. Pricing — **outside this context**.
- **Brand world:** engineering blueprint aesthetic. Navy + cream + orange. Teko (display) + Inter (body). "BB" / "BCKSTG BLPRNT" stamp.
- **Site:** `backstageblueprint.co`
- **Founder / driver:** Gibby. Background and origin — **outside this context**.

---

## Doc family (only what exists in my context)

| Doc | What's in it | When to open |
|---|---|---|
| `WEBSITE_TESTING_FIELD_BRIEF.md` | This file. Handoff overview, scope, navigation. | First thing. Read once, then route. |
| `PROJECT_STATUS.md` | Running status of the website build. Updated as work happens. | When you want to know what's done, in motion, or pending on the site. |
| `experience.html` | The website itself. The actual artifact. | When you want to see the work. |

**Outside this context (ask Gibby):**
- Brand brief / mission / positioning doc
- Voice & tone guide
- Decision log
- Tool-stack inventory (Klaviyo, HubSpot, SendOwl, etc. — status / keys / configs)
- API / key tracking
- Other website properties Gibby has had set up
- Rider Builder spec / progress (separate thread)

---

## How we work (website build conventions)

**File handling**
- All work happens in the workspace folder: `BB-WEBSITE TESTING/`
- One canonical HTML file (`experience.html`) holds the whole tour.
- Assets live in subfolders matched to scene/feature: `LIGHING_SCENE/`, `POWER_ON/V2/`, `HOME_PAGE/MOVING LIGHTS TRUSS/`, `BLUEPRINT_BG_ITEMS/`.
- **Same-canvas trick:** every layered visual is exported at 4000×2250 so positions map 1:1 between assets. Position measurements are taken directly from PNG pixels.

**Code conventions**
- Inline CSS + JS in one HTML file. Single-file deliverable.
- CSS variables drive theming and animation (e.g. `--glow-rgb`, `--intensity-*`).
- Scenes use `data-cue="N"` for ordering and the cue indicator.
- Hash routing for sub-page back-links (e.g. `experience.html#scene-production-office`).
- Mobile responsiveness — **untested / open**.

**Visual language (observed from the build, not from a written guide)**
- Colors: blueprint navy `#1B3D6E`-ish field, cream `#F2EBDD` ish, orange accent `#D85A1F` ish.
- Type: Teko 700 for display, Inter for body, SF Mono for technical / status labels.
- Voice in the UI: terse, engineering-spec, dry. `CUE 01 / EST.`, `// POWER DISTRIBUTION UNIT — INITIALIZE RIG`, `RACK 1A · 200A SERVICE`. Not playful. Not hard-sell.
- Affordances feel physical: things hover, tilt, latch, slam, glow, sway. Stage gear vocabulary throughout.

**Naming**
- Scenes are named after stage-production locations: EST., HERO, PRODUCTION OFFICE, PASS, CONSOLE.
- Items reference real-world stage gear (XLR cable, power distro, gobo, lanyard pass, Clear-Com intercom).
- Sub-pages use plain product names: templates, blueprint, toolkit, course, checklist, audit, members.

---

## The website at a glance

**Architecture:** single-page, 5-scene scroll-snap tour. Right-edge cue indicator + dots for jumping between scenes.

| # | Scene | What it does |
|---|---|---|
| 1 | **EST.** | XLR cable slam → continues in place into Power On (PD wall + XLR-circle frame + lanyard-style switch box rise) → click switch → scroll to lights. |
| 2 | **HERO** | Truss with 3 moving fixtures tracking cursor. Brand wordmark. Haze button + 3 lighting cues (WASH / CHASE / PULSE) in brand colors only. Band silhouettes revealed inside beam cones. |
| 3 | **PRODUCTION OFFICE** | Top-down desk view. Six product items: hover lifts + sticky note "REF", click latches with breathing glow + sticky becomes "CONFIRM", second click navigates. |
| 4 | **PASS** | Backstage pass on lanyard, wide magnetic-zone 3D parallax tilt on cursor. Click → members page. |
| 5 | **CONSOLE** | Clear-Com intercom panel. PTT button = `mailto:` contact. |

Sub-pages (`templates.html`, `blueprint.html`, `toolkit.html`, `course.html`, `checklist.html`, `audit.html`, `members.html`) currently exist as placeholders with back-links to the relevant scene.

---

## Where things stand

**Solid / shipped**
- All 5 scenes working end-to-end.
- Power scene (XLR-circle window into PD + switchbox lanyard rise) fully tuned across multiple revisions.
- Lighting cues rewritten as pure CSS animations (after rAF approach failed — see `PROJECT_STATUS.md` for the journey).
- Lights scene warm-up (beams ramp up on entry, not on at full).
- Silhouette band reveal via masked cones.

**In motion**
- User has notes on the lights scene (not yet captured here).
- Cue rhythm / hold times may still be tuned.

**Pending / known to-do (low priority)**
- Page loading state.
- BB monitor screen-lit-up state.
- Sub-page real content (currently all placeholders).
- Mobile responsiveness review.

**Set aside (may return)**
- `04_SOLO_XLR.png` (Power scene extra-depth layer).
- `05_ENGAGE_POWER.png` (Power scene button asset — currently clicking switchbox directly).
- Haze texture variant for the lights scene.

---

## Open questions (honest list)

These are unknown to this brief's context. Anything here is "ask Gibby" or "track in decision log."

- **Pricing** for any product.
- **ICP precision** — confirmed live-production roles (TM, PM, FOH), but specifics (tier, market size, geography) not captured.
- **Brand voice in long form** — only inferred from UI copy; no written guide referenced.
- **Mission / positioning statement** — not captured here.
- **Revenue / reach targets** — what success looks like for the strategist to optimize toward.
- **Launch timing** — when does the site go live, what's the gate?
- **Tool stack status** — Klaviyo, HubSpot, SendOwl, others. What's live, what's evaluating, what's being deprecated. Gibby flagged SendOwl may be replaced by site-native interaction.
- **Competitive landscape** — who else is in the live-production-knowledge space.
- **Existing audience** — social / email / traffic numbers.
- **Decision log** — does one exist? Not visible to this context. If not, may be worth starting one.
- **Other parallel work** — Rider Builder thread + other website properties exist elsewhere; status unknown here.

---

## If you need X, open Y

| If you need to know... | Open... |
|---|---|
| What's done / in motion on the website | `PROJECT_STATUS.md` |
| What the site actually looks/works like | `experience.html` (load in a browser) |
| Where a specific asset lives | Walk the folder tree from `BB-WEBSITE TESTING/` |
| Brand colors / type / voice | Observed conventions in this brief; no formal guide in context |
| Pricing / mission / decision log | **Ask Gibby** |
| Tool stack (Klaviyo / HubSpot / SendOwl / etc.) | **Ask Gibby** |
| Rider Builder progress | **Separate workstream — ask Gibby** |
| What was tried and abandoned | Look at git history if available; the cue system went through 6 rounds before the CSS-animation rewrite, captured in `PROJECT_STATUS.md` |

---

## Working principles (observed)

- Iterate in short visual passes, get feedback fast.
- When a patch isn't fixing it, step back and rewrite the architecture. (The cues taught us this.)
- Anchor positioning in measured pixel data, not visual estimation.
- Prefer CSS animations to JS rAF for visual effects.
- Keep affordances physical — things should feel like real stage gear.
- Honest about gaps. If we don't know, say so and route it.

---

*Field brief written from website-build context only. For anything outside that scope, this brief deliberately points elsewhere rather than guessing.*
