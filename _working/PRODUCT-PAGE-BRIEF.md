# Backstage Blueprint — Product Page Build Brief

A running reference for the interactive products page (`blueprint-page.html`). Captures the design system, technical patterns, and decisions so we can extend it to other pages or hand it off to a real web designer.

_Last updated: 2026-05-25_

---

## 1. Overview

Page concept: a top-down "blueprint desk" view. Six product items sit on a blueprint grid as physical objects (binders, document stacks, a keyboard, a magnifying glass with documents covering it). Users hover to preview, click to commit, click again to enter.

Six items:
1. **Templates** — individual templates, à la carte
2. **The Blueprint** — the complete template bundle
3. **The Course** — full live production training
4. **Checklist** — free production checklist
5. **The Toolkit** (keyboard) — tech rider & stage plot builder
6. **Audit & Consultation** (sliding documents) — services with our team

---

## 2. Asset Strategy — Same-Canvas PNGs

**The single most important decision in this build.** Every interactive element exports as a `4000 × 2250` PNG with the item in its exact final position and everything else transparent. The backdrop is also `4000 × 2250` with only the static elements (binder under the blueprint, monitor, drafting tools, the magnifying glass etched in the schematic).

### Why this works
- **Zero positioning math.** Every layer stacks at the same coordinates — no figuring out where things go.
- **Fidelity preserved.** No cropping or rescaling during asset prep.
- **Trivially extensible.** Adding a new item is a matter of dropping in a new PNG.
- **Re-exports are painless.** Swap a file, refresh, done.

### Resolution & format
- **4000 × 2250 (16:9 aspect)** for crisp display on retina monitors at common viewport widths.
- Item PNGs: PNG-24 with alpha. ~200–700 KB each because transparent pixels compress extremely well.
- Backdrop: currently PNG at ~14.7 MB. For production, convert to JPEG quality 85–90 for ~1–1.5 MB.
- Safe zone: keep critical content inside ~8–10% from each edge so nothing gets clipped on different viewports.

### Measuring hot zones
Don't eyeball positions. Use the actual bounding box of the visible pixels:

```python
from PIL import Image
bbox = Image.open("BP_PAGE_ITEM.png").getbbox()  # (left, top, right, bottom)
```

Convert to percentages of 4000 × 2250, then trim 10–15% inward on any edges that risk overlapping a neighboring item's zone.

---

## 3. Layer Architecture (z-index stack)

From bottom to top:

| z-index | Layer | Notes |
|---|---|---|
| 1 | `bg-layer` | Backdrop image |
| 4 | `gear-layer` | Special static layers (gear behind audit docs) |
| 5 | `item-layer` (rest) | All six items at rest |
| 10 | `item-layer.lifted` | Item on hover |
| 18 | `dim-overlay.active` | Dim screen when latched |
| 20 | `hot` | Invisible hover/click targets |
| 23 | gear when audit is latched | Sits between dim and latched docs |
| 25 | `item-layer.latched` | The clicked item |
| 26 | `hot.latched` | The clicked hot zone |
| 30 | `sticky-note` | Always on top |

The `.desk` container has `overflow: hidden`, so anything outside the 16:9 canvas is clipped — clean edges, no scrollbars from transforms.

---

## 4. Interaction Model — Three Stages

1. **Hover.** Item lifts ~2.1% of desk height, drifts slightly toward center (items left of center drift right, right drifts left, keyboard stays put). Soft shadow grows. Sticky note slides up from below the desk into ~57% vertical with `// REF` header + item label.

2. **Click → Latch.** Item locks lifted. Screen dims to 62% black. Warm cream glow appears around the item, breathing on a ~2.7s cycle. Note swaps text in place to `// CONFIRM` + CTA copy ("Enter the Toolkit?", "View the Checklist?", etc.) and picks up its own glow.

3. **Exit Latch.** Two ways: click anywhere on the dim overlay, or press Escape. Everything reverses — item drops, glow fades, screen un-dims, note slides back down.

**Click again while latched → navigate** to the destination page (`templates.html`, `blueprint.html`, etc.). Clicking the sticky note while latched also navigates.

### The audit/consultation exception
Instead of lifting, the documents pile slides aside (`translateX +13%, rotate +11°`) revealing a gear etched in the blueprint behind. When latched:
- Gear gets its own subtler breathing glow synced to the docs' breath
- Gear starts rotating clockwise — 50ms delay, then ramps up over 400ms (ease-out) to full speed (6s/rotation)
- Pauses immediately on un-hover, holding its current angle

---

## 5. Animation Patterns

- **Establishing zoom on load** — desk fades in from `opacity 0, scale 1.0` to `opacity 1, scale 1.10` over 1.4s with ease-out. The resting view is 10% zoomed in (crops a thin margin from the canvas edges but gives items more visual presence).
- **Hover lift** — `translateY -2.1%` + `scale 1.035` + horizontal drift toward center (±0.8%), 0.5s with spring easing (`cubic-bezier(0.22, 1.2, 0.36, 1)`).
- **Slide-aside (audit only)** — `translate(+13%, +1.5%) rotate(+11°)`, 0.7s with spring easing.
- **Sticky note** — slides from `translateY(500%)` to centered at ~57% vertical, ~0.55s up, ~0.40s down. On item-switch: down → 280ms gap → up with new text.
- **Breathing glow** — 2.7s cycle, ease-in-out. Warm cream (RGB 255, 245, 215) alpha cycles between 0.50/0.18 (low) and 1.00/0.60 (high) on inner/outer halos.
- **Gear rotation** — JavaScript-driven with `requestAnimationFrame` for ramp-up control. Linear at full speed.

---

## 6. The Filter Trick (critical gotcha)

The breathing animation uses a 3-drop-shadow filter (inner glow, outer glow, dark cast-shadow). **Every other filter state in the codebase must also have 3 drop-shadows** — even the rest and lifted states — with the warm-glow shadows at `alpha 0` when no glow is wanted.

Browsers can smoothly interpolate between filters with matching structure. Mismatched structure (e.g., 1 drop-shadow → 3 drop-shadows) causes a one-frame "flash" when the animation starts. Alpha-0 drop-shadows render nothing visually, so the cost of keeping the structure consistent is essentially zero.

---

## 7. Brand Palette & Typography

| Token | Value | Use |
|---|---|---|
| `--bp-blue` | `#1d3963` | Background |
| `--paper` | `#ece8db` | Cream paper color (used in feel demo placeholders) |
| `--note-paper` | `#f4ecd5` | Sticky note (slightly warmer than paper) |
| `--ink` | `#1d3963` | Text on light surfaces |
| `--accent` | `#d97a3a` | Orange — `// REF`, `// CONFIRM` headers, note border |
| `--glow-color` | `255, 245, 215` | RGB triplet for the warm cream glow |

**Type stack:** `'SF Mono', 'Menlo', 'Consolas', 'Courier New', monospace` everywhere — leans into the drafting / engineering aesthetic. Uppercase for labels, letter-spacing 0.12em–0.3em depending on context.

---

## 8. File / Folder Structure

```
BB-WEBSITE TESTING/
├── blueprint-page.html       # The interactive products page
├── feel-demo.html            # Early prototype with placeholder cards
├── PRODUCT-PAGE-BRIEF.md     # ← this document
├── templates.html
├── blueprint.html
├── toolkit.html              # The 6 destination placeholder pages
├── course.html
├── checklist.html
├── audit.html
└── BLUEPRINT_BG_ITEMS/
    ├── BP_PAGE_BG.png                # Backdrop
    ├── BP_PAGE_BLUEPRINT_DOCS.png    # 6 same-canvas item PNGs
    ├── BP_PAGE_KEYBOARD.png
    ├── BP_PAGE_TEMPLATES.png
    ├── BP_PAGE_THE_COURSE.png
    ├── BP_PAGE_THE_FREE_CHECKLIST.png
    ├── BP_PAGE_SLIDING_DOCS.png
    ├── BP_PAGE_GEAR.png              # Animated gear behind sliding docs
    └── BP_PAGE_REFERENCE.png         # Master reference (all items in place)
```

---

## 9. How to Add a New Interactive Item

1. **Export** the item as a 4000 × 2250 PNG with the item in its final position, everything else transparent. Drop it in `BLUEPRINT_BG_ITEMS/`.
2. **Update the backdrop** if needed — remove anything that's now part of the new item.
3. **Measure** the visible bounding box (Python + PIL: `Image.open('file.png').getbbox()`). Convert to percentages of 4000 × 2250.
4. **Add the layer** in HTML — `<img class="item-layer" id="layer-newitem" style="--drift-dir: 1;" src="...">` after `bg-layer`.
5. **Add the hot zone** — `<div class="hot" data-target="layer-newitem" data-label="..." data-cta="..." data-url="newitem.html" style="left: X%; top: Y%; width: W%; height: H%;">`.
6. **Set drift direction** based on item position: `--drift-dir: 1` (drift right) for items left of center, `-1` for right side, `0` for centered.
7. **Trim 10–15%** on any edges that risk overlapping a neighboring item's zone.
8. **Create the destination page** (`newitem.html`) — clone any of the existing placeholders.
9. **Test** hover, click-latch, second-click navigation.

---

## 10. Tunable Variables — One-Stop Control Panel

All in the `:root` block at the top of `blueprint-page.html`. Change a number, refresh, done.

**Lift behavior**
- `--lift-height` — how high items pop (% of desk height)
- `--lift-drift` — horizontal nudge toward center
- `--lift-scale` — slight grow on hover
- `--lift-duration`, `--lift-easing`

**Audit slide-aside**
- `--slide-distance-x`, `--slide-distance-y`
- `--slide-rotation`, `--slide-duration`

**Shadows**
- `--shadow-rest`, `--shadow-lift` (each is a 3-drop-shadow filter — see §6)

**Sticky note**
- `--note-width`, `--note-height`
- `--note-vertical-center` — where it settles vertically
- `--note-up-duration`, `--note-down-duration`, `--note-swap-gap`
- `--note-tilt`

**Establishing zoom**
- `--establish-zoom`, `--establish-duration`, `--establish-ease`

**Breathing glow**
- `--breathe-duration`

**Audit gear**
- `--gear-spin-duration`, `--gear-ramp-delay`, `--gear-ramp-up-time`
- `--gear-origin-x`, `--gear-origin-y` (rotation pivot, in % of canvas)

**Latch state**
- `--glow-color` (RGB triplet)
- `--dim-strength` (0–1)

---

## 11. Decisions Worth Remembering

- **Same-canvas PNG approach** was Gibby's idea. It's the single biggest workflow win — eliminates pixel math, makes the system trivially extensible. Always use this pattern for layered visual pages.
- **Hot zones at the exact bounding box** of visible pixels, trimmed 10–15% on edges that risk cross-triggering with neighbors.
- **Items drift toward center on lift** — small touch (~0.8%) that makes the page feel more "alive" and presentational rather than mechanical.
- **Establishing zoom** lands the resting view at 110% of canvas scale, cropping a small safe-zone margin but giving items more presence.
- **Filter structure consistency** across all states (3 drop-shadows everywhere) is non-negotiable — mismatched filters cause one-frame "snap" artifacts. See §6.
- **Gear rotation is JS-driven** because CSS animations don't have clean primitives for ramping speed mid-cycle. The transform-origin is set in CSS using the gear's pixel center as a percentage of the canvas.
- **One shared sticky note** in center beats per-item labels. Gives a focal point and reads more like a real "production note" left on the desk.
- **Three-stage interaction** (hover preview → click commit → click navigate) prevents accidental navigation. The dim overlay + glow makes the committed state unambiguous.
- **Exit-latch via Esc or click-outside.** Always provide a clear escape from a modal-like state.

---

## 12. Open / Future Work

- **Loading screen** for production — blueprint-themed fade-out once all images load (task #5)
- **Monitor screen-lit state** on keyboard hover (task #6) — Gibby has the image, just needs wiring
- **Mobile / narrow-viewport layout** — the desk view doesn't translate well to portrait. Probably a stacked alternative.
- **Backdrop JPEG conversion** for production deployment (~1 MB vs 14.7 MB)
- **Possible refinements** — sync gear's breath phase to docs', or intentionally offset it for organic feel
- **Brand voice / CTA copy** refinement once a writer is involved
- **Accessibility pass** — keyboard navigation, focus states, reduced-motion media query, alt text on item layers
