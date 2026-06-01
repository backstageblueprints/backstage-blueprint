# Backstage Blueprint — Website

This folder IS the live website. Everything here is what runs at runtime.

## How to view the site

Double-click any `.html` file at the root of this folder — it opens in your browser.

The main entry point is **`experience.html`** (the cinematic tour). From there:
- **Front of House** (Scene 3) — the public products surface. 6 hotspots → Free Checklist, Templates, The Blueprint, The Toolkit, The Course, Audit & Consultation. (Code id `scene-production-office` still — rename due in Order 002.)
- the Pass scene → `members.html` (**Member Hub / The Desk**)
- the binder on the desk → `my-binder.html` (gated library of templates + guides)
- the course on the desk → `course.html` (course viewer)
- the keyboard on the desk → search overlay on the monitor
- the credential / mixer on the desk → in-place inspect HUDs (credential dynamically shows **Guest Pass** or **All Access Pass** in future builds)
- the toolkit on the desk → `toolkit.html` (Rider + Stage Plot builder — placeholder)
- the CONSOLE scene → `lexicon.html` (the tunnel send-off, after contact)

Other live pages (product / placeholder pages currently behind their respective desk objects or experience scenes):
- `audit.html`, `blueprint.html`, `checklist.html`, `templates.html`, `toolkit.html`

## What's in each folder

| Folder | Purpose |
|---|---|
| `BLUEPRINT_BG_ITEMS/` | Production Office scene assets (Scene 3 in experience.html) |
| `HOME_PAGE/` | EST / Power / Hero scene assets (Scenes 1+2 in experience.html) |
| `LIGHING_SCENE/` | Hero scene lighting + silhouette assets |
| `Members Room/` | Members Hub desk assets (used by `members.html`) |
| `POWER_ON/` | Power On scene v2 assets |
| `my-binder/` | Template previews + guide covers (used by `my-binder.html`) |
| `lexicon/` | Cropped gear PNGs used in the lexicon tunnel |
| `_working/` | Drafts, abandoned experiments, working docs — **NOT live** |

## What's in `_working/`

Anything inside `_working/` is **not** part of the live site. It's old drafts, abandoned experiments, internal status docs. Strategists / reviewers can safely ignore this folder. It's kept around for reference and history, but nothing here is referenced at runtime.

## For the product strategist

To preview the current state of any page, open the `.html` file directly. To spec a new feature against the current site, drop your order package into the parallel `Orders/` folder (see `BB_PRODUCT_STRATEGY/BB_Products_Start/Orders/README.html`). Reference live page filenames + line behaviors as you see them rendered.

## Asset / page naming convention

- One `.html` file per top-level surface (matches the URL it would have when deployed: `my-binder.html` → `/my-binder`).
- Asset folders are subject-named (capitalized for visual sources like `Members Room/` — note: the surface itself is canonically the **Member Hub** / **The Desk** now; the asset folder path is internal-only and unchanged; lowercase for build-specific subfolders like `my-binder/`).
- The internal/member brand logo lives at the root as `bb-logo-internal.png`.

## Brand systems — two parallel design languages

The site runs **two design systems** in parallel. Don't cross the streams.

**Internal / member system** — gated surfaces only. Used on: Member Hub monitor screen content, My Binder, Course Viewer, future Guide Reader, Guest Pass / All Access Pass account pages. Anything reached from The Desk or behind sign-in.

- Palette: `--black #0E0E0E` / `--blue #1B3A5C` / `--bone #F4F1EA` / `--orange #D4641E`
- Type: Archivo (display, 900 mostly) / JetBrains Mono (labels, mono) / Inter (body)
- Feels like: an engineering working document. Bone surfaces, blueprint grids, mono labels, structural typography.
- Reference: `Orders/001_My_Binder_Page/02_Assets/Brand_Tokens.html` from the strategist

**Public / main system** — everything pre-sign-in. Used on: `experience.html` (the 5-scene tour), `lexicon.html`, all product landing pages (`templates.html`, `blueprint.html`, `audit.html`, `checklist.html`, `toolkit.html` when built out), eventual marketing/landing surfaces.

- The cinematic stage-rig language we've been building throughout the experience tour
- Navy + cream + orange, scene-by-scene slam-bang-glow affordances
- Feels like: a show, not a document

**The rule of thumb:** does this surface require sign-in, or is it reached from The Desk on the Members Hub, or is it presenting owned/purchased work? → internal system. Otherwise → public system.

---

## Naming vocabulary (canonical, 2026-05-31)

| Use | Don't use |
|---|---|
| **Front of House** (the public products page) | "The Production Office" (retired — code id will be renamed in Order 002) |
| **Member Hub** / **The Desk** (the gated home) | "Members Room" (retired — asset folder path unchanged but no customer copy should reference it) |
| **Guest Pass** (free tier — Stripe Checkout auto-creates on purchase) | "free account", "member" (lowercase) |
| **All Access Pass** (paid Membership tier) | "Membership" (capitalized — internal only) |
| **Backstage** (poetic synonym for the gated area) | — |

Source of truth: `Orders/Designer_Briefing.md` in the strategist's folder.

---

## Version history + isolated backups

**Layer 1 — OneDrive Version History** (automatic, cloud)
Right-click any file → Version History to see prior versions. This saved us 2026-05-31 when `experience.html` got truncated mid-edit.

**Layer 2 — Isolated drive backups** (manual, prompted)
After any substantive save (Order close, multi-file change, feature merge, big rewrite), Claude prompts Gibby with:

```
⏸ BACKUP CHECKPOINT — [what was saved]
Copy BB-WEBSITE TESTING/ (and Orders/ if relevant) to your isolated drive now.
```

Gibby copies the live folder to a non-OneDrive drive (different physical disk or external). Claude waits for confirmation before continuing. This is plan A; OneDrive Version History is plan B.

The reason: OneDrive's sync layer combined with the sandbox's bash mount can occasionally truncate a large file on write. Two independent backup paths means one botched save can't lose us a day of work.
