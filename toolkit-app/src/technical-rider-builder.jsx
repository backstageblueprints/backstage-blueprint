import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useContext, createContext, useCallback } from "react";
import {
  FileText, Music2, Sliders, ListChecks, Headphones, Mic2, Guitar,
  Boxes, StickyNote, Plus, Trash2, ChevronDown, ChevronRight, Upload,
  LayoutGrid, Printer, Save, RotateCw, X, Search, Star,
  Move, Square
} from "lucide-react";

// Order 009 · BB integration adapter (Clerk + Supabase + Stripe).
// Graceful fallback: if env vars aren't set, the app keeps its
// current URL-param/localStorage dev behavior unchanged.
import { verifyTierFromBackend, startBBCheckout, bbAuthReady, bbCheckoutReady } from "./bb-integration.js";

/* =========================================================================
   TECHNICAL RIDER BUILDER — Prototype v1.1
   Brand: Stage Black / Bone / Blueprint Blue / Burnt Orange
   Type: Archivo (display) · Inter (body) · JetBrains Mono (technical labels)
   ========================================================================= */

// -------------------- BRAND TOKENS --------------------
const BRAND = {
  black:  "#0E0E0E",   // Stage Black
  blue:   "#1B3A5C",   // Blueprint Blue
  bone:   "#F4F1EA",   // Bone
  orange: "#D4641E",   // Burnt Orange
};

// Reusable tailwind-style class strings via inline styles where needed.
// Tailwind core utilities still drive layout; brand colors come from inline style.

// -------------------- TIER (FREE / PAID) --------------------
// Free vs. paid feature gating. Single source of truth: a TierContext that reads
// initial tier from a `?tier=free|paid` URL param (great for testing two states
// side-by-side in two tabs) and persists to localStorage. When a real auth /
// billing layer comes online later, swap the initial-state computation to read
// from the logged-in user's subscription — every gate downstream stays the same.
//
// Default tier is "free" so a brand-new visitor sees the free experience first
// (which is intentionally a great-quality product on its own, per Gibby).

const TIER_STORAGE_KEY = "trb-tier";

const readInitialTier = () => {
  try {
    // URL param wins so you can demo "/?tier=paid" without flipping anything.
    const urlTier = new URLSearchParams(window.location.search).get("tier");
    if (urlTier === "paid" || urlTier === "free") {
      localStorage.setItem(TIER_STORAGE_KEY, urlTier);
      return urlTier;
    }
    const stored = localStorage.getItem(TIER_STORAGE_KEY);
    if (stored === "paid" || stored === "free") return stored;
  } catch (_) { /* SSR / locked storage / etc. */ }
  return "free";
};

const TierContext = createContext({
  tier: "free",
  isPaid: false,
  isFree: true,
  setTier: () => {},
});

const useTier = () => useContext(TierContext);

// Helper hook for any spot that just wants the boolean.
const useIsPaid = () => useContext(TierContext).isPaid;

function TierProvider({ children }) {
  const [tier, setTierState] = useState(readInitialTier);
  const setTier = useCallback((next) => {
    if (next !== "paid" && next !== "free") return;
    try { localStorage.setItem(TIER_STORAGE_KEY, next); } catch (_) {}
    setTierState(next);
  }, []);
  // Cross-tab sync — if you flip the tier in one tab, others stay in step.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === TIER_STORAGE_KEY && (e.newValue === "paid" || e.newValue === "free")) {
        setTierState(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Order 009 · Backend tier verification.
  // On mount (and on tab focus), if BB auth integration is configured,
  // verify the user's tier from Clerk + Supabase. Falls back to the
  // sync-read tier silently if not configured. The setter persists to
  // localStorage so the next mount picks up the verified tier instantly.
  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      const backendTier = await verifyTierFromBackend();
      if (cancelled) return;
      if (backendTier === "paid" || backendTier === "free") {
        setTierState((current) => (current === backendTier ? current : backendTier));
        try { localStorage.setItem(TIER_STORAGE_KEY, backendTier); } catch (_) {}
      }
    };
    verify();
    const onFocus = () => verify();
    window.addEventListener("focus", onFocus);
    return () => { cancelled = true; window.removeEventListener("focus", onFocus); };
  }, []);
  const value = useMemo(() => ({
    tier, isPaid: tier === "paid", isFree: tier === "free", setTier,
  }), [tier, setTier]);
  return <TierContext.Provider value={value}>{children}</TierContext.Provider>;
}

// -------------------- UPGRADE PROMPT --------------------
// Any free-tier feature gate (project limit, locked PDF options, share/team/
// version/sync buttons) calls useUpgrade().show(reason) to surface a single,
// consistent modal. Reason is a short string that customizes the headline so
// the user understands what they hit (e.g. "More than 1 saved rider needs
// Backstage Blueprint Pro").

const UpgradeContext = createContext({ show: () => {}, hide: () => {} });
const useUpgrade = () => useContext(UpgradeContext);

function UpgradeProvider({ children }) {
  const [openReason, setOpenReason] = useState(null);
  const show = useCallback((reason) => setOpenReason(reason || "Backstage Blueprint Pro"), []);
  const hide = useCallback(() => setOpenReason(null), []);
  const value = useMemo(() => ({ show, hide }), [show, hide]);
  const { setTier } = useTier();
  // Order 009 · auto-open the modal when /toolkit/?upgrade=prompt is hit
  // (the Paid CTA on the toolkit.html sales page lands here).
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("upgrade") === "prompt") {
        setOpenReason("Upgrade to Backstage Blueprint Pro");
      }
    } catch (_) { /* SSR / locked storage */ }
  }, []);
  return (
    <UpgradeContext.Provider value={value}>
      {children}
      {openReason !== null && (
        <div role="dialog" aria-modal="true"
          onClick={hide}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(14,14,14,0.78)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 460, width: "100%",
              background: BRAND.black,
              border: `1px solid ${BRAND.orange}`,
              borderRadius: 3,
              padding: 26,
              color: BRAND.bone,
              fontFamily: "'Inter', system-ui, sans-serif",
              boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
            }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Mono style={{ fontSize: 9, color: BRAND.orange, letterSpacing: "0.22em", fontWeight: 700 }}>
                BACKSTAGE BLUEPRINT · PRO
              </Mono>
              <button onClick={hide} aria-label="Close"
                style={{
                  background: "transparent", border: "none", color: "rgba(244,241,234,0.55)",
                  cursor: "pointer", padding: 4, lineHeight: 1, fontSize: 18,
                }}>×</button>
            </div>
            <h2 style={{
              fontFamily: "'Archivo', system-ui, sans-serif",
              fontWeight: 800, fontSize: 22, letterSpacing: "0.02em",
              margin: "12px 0 6px",
            }}>
              {openReason}
            </h2>
            <p style={{ fontSize: 12, color: "rgba(244,241,234,0.72)", lineHeight: 1.55, marginBottom: 16 }}>
              Pro unlocks the full toolkit — unlimited tour projects, a clean
              PDF with your own branding, multiple stage plots, PNG export,
              cloud sync across devices, shareable links, team access, and
              version history.
            </p>
            <div style={{
              border: "1px solid rgba(244,241,234,0.12)",
              borderRadius: 2,
              padding: "10px 14px",
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 11, color: BRAND.bone,
              display: "flex", alignItems: "baseline", justifyContent: "space-between",
              marginBottom: 18,
            }}>
              <span style={{ letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 9, color: "rgba(244,241,234,0.55)" }}>Pro</span>
              <span><span style={{ fontSize: 16, color: BRAND.orange, fontWeight: 700 }}>$5</span> <span style={{ color: "rgba(244,241,234,0.55)" }}>/ month</span></span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Order 009: real Stripe Checkout if configured, else falls
                  back to the dev-toggle behavior. The async startBBCheckout()
                  returns false when env vars are missing — we then flip the
                  local tier flag so unwired-dev work keeps moving. */}
              <button
                onClick={async () => {
                  const redirected = await startBBCheckout();
                  if (!redirected) {
                    // Backend not configured — preserve dev-toggle behavior.
                    setTier("paid");
                    hide();
                  }
                  // If redirected, Stripe takes over; success path returns
                  // to /toolkit/?upgrade=success and TierProvider's verify
                  // useEffect picks up the new paid entitlement on mount.
                }}
                style={{
                  padding: "11px 16px",
                  background: BRAND.orange,
                  color: BRAND.black,
                  border: `1px solid ${BRAND.orange}`,
                  borderRadius: 2,
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
                  fontWeight: 800, cursor: "pointer",
                }}>
                {bbCheckoutReady() ? "Upgrade to Pro" : "Try Pro Now (Dev Toggle)"}
              </button>
              <button onClick={hide}
                style={{
                  padding: "9px 16px",
                  background: "transparent",
                  color: "rgba(244,241,234,0.65)",
                  border: "1px solid rgba(244,241,234,0.18)",
                  borderRadius: 2,
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
                  cursor: "pointer",
                }}>
                Not now
              </button>
            </div>
            <Mono style={{ fontSize: 8, color: "rgba(244,241,234,0.40)", letterSpacing: "0.16em", marginTop: 14, display: "block", textAlign: "center" }}>
              Real checkout connects when the website launches
            </Mono>
          </div>
        </div>
      )}
    </UpgradeContext.Provider>
  );
}

// -------------------- SEED LIBRARIES --------------------
// Default intro shown on page 2 of the rider — pre-populates the 01-C Intro card
// and auto-substitutes (ARTIST NAME) tokens with general.artist when present.
const INTRO_TEMPLATE =
`Greetings and welcome to the Technical Rider for (ARTIST NAME).

This confidential technical and production rider has been prepared to detail requirements that we feel are necessary to enable (ARTIST NAME) to present the best possible show. Any adjustments to this rider can be authorized by artist management or tour manager only. No omissions or strike-throughs are allowed unless written confirmation of changes are provided by artist management. If there are any immediate questions or comments please contact the following:`;

// Intro continued — sits AFTER the Team table on page 2 of the printed rider.
// Shared boilerplate covering rider-amendment etiquette and billback responsibility.
const INTRO_CONTINUED_TEMPLATE =
`To save time, please don't amend or change this rider. It will be far easier to read through this carefully and in a response email, note any objections, questions, or impossibilities as they relate to each section of the rider. Requests made in this rider are only there because they are necessary for our production / show / travel / etc and for no other reason. Not asking just for the sake of asking.

If there is a question of who is financially responsible for any part of these requirements, please refer to deal sheet and discuss potential billbacks with TM ASAP.`;

// Hard cap on team table size. Starts with 3 default roles; user can grow to 8.
const MAX_CREW = 8;

// Resolve (ARTIST NAME) placeholders in a string using the current artist value
const resolveIntro = (text, artist) => {
  if (!text) return "";
  const name = (artist && artist.trim()) || "(ARTIST NAME)";
  return text.replace(/\(ARTIST NAME\)/g, name);
};

const SEED = {
  consoles: [
    // DiGiCo SD family
    "DiGiCo SD7", "DiGiCo SD10", "DiGiCo SD12", "DiGiCo SD9",
    // DiGiCo Quantum family
    "DiGiCo Quantum 7", "DiGiCo Quantum 338", "DiGiCo Quantum 225",
    // Avid Venue family
    "Avid S6L-32D", "Avid S6L-24D", "Avid Venue Profile",
    // Yamaha CL/QL family
    "Yamaha CL5", "Yamaha CL3", "Yamaha QL5",
    // Yamaha Rivage family
    "Yamaha PM7", "Yamaha Rivage PM10",
    // Allen & Heath dLive family
    "Allen & Heath dLive S7000", "Allen & Heath dLive S5000", "Allen & Heath SQ-7",
    // Midas family
    "Midas Pro X", "Midas HD96-24", "Midas M32",
    // X32 / lower tier
    "Behringer X32",
    // Soundcraft Vi family
    "Soundcraft Vi7000",
  ],
  pa: [
    "L-Acoustics K1", "L-Acoustics K2", "L-Acoustics Kara II", "L-Acoustics KS28",
    "d&b audiotechnik J-Series", "d&b audiotechnik V-Series", "d&b KSL", "d&b GSL",
    "Meyer Sound Leopard", "Meyer Sound Lyon", "Meyer Sound LEO",
    "JBL VTX A12", "JBL VTX V25-II", "Adamson E15", "Adamson S10", "EAW Anya",
  ],
  mics: [
    "Shure SM58", "Shure SM57", "Shure Beta 58A", "Shure Beta 57A", "Shure Beta 91A",
    "Shure Beta 52A", "Shure SM81", "Shure KSM9",
    "Sennheiser e604", "Sennheiser e904", "Sennheiser e906", "Sennheiser e609",
    "Sennheiser MD421", "Sennheiser MD441",
    "Neumann U87", "Neumann KM184", "AKG C414", "AKG D112", "Audix D6", "Audix i5",
    "DI - Radial J48", "DI - Radial JDI", "DI - Countryman Type85", "DI - BSS AR133",
  ],
  // Pre-populated Input List source labels grouped by family. Flat array (the
  // LibrarySelect renders one searchable list); users can type "kick" to find
  // all kick options together. The "+ Add other" affordance handles uncommon
  // sources via the customLibs.sources bucket.
  sources: [
    // Drums
    "Kick In", "Kick Out", "Snare Top", "Snare Bottom", "Hi-Hat",
    "Rack Tom 1", "Rack Tom 2", "Floor Tom", "Floor Tom 2",
    "Ride", "Crash L", "Crash R", "Overhead L", "Overhead R",
    // Bass / Strings
    "Bass DI", "Bass Mic", "Guitar 1", "Guitar 2",
    "Acoustic DI", "Banjo", "Mandolin", "Cello", "Violin",
    // Keys / Synth
    "Keys L", "Keys R", "Synth L", "Synth R",
    "Piano L", "Piano R", "Organ L", "Organ R",
    // Vox
    "Lead Vox", "BGV 1", "BGV 2", "BGV 3", "Talkback",
    // Playback / FX
    "Click", "Tracks L", "Tracks R", "FX Return L", "FX Return R", "Ambient",
    // Wireless / Spares
    "Wireless 1", "Wireless 2", "Wireless 3", "Spare DI 1", "Spare DI 2",
    // Horns / Brass
    "Trumpet", "Trombone", "Sax", "Horn Section",
  ],
  iems: [
    "Shure PSM1000", "Shure PSM900", "Sennheiser EW IEM G4", "Sennheiser 2000 IEM",
    "Lectrosonics Duet", "Wisycom MTP60",
  ],
  wedges: [
    "L-Acoustics X15 HiQ", "L-Acoustics X12", "d&b M4", "d&b M2", "Meyer MJF-212A",
    "Clair 12AM", "Adamson M15", "EAW SM200",
  ],
  drumKits: [
    "DW Collector's 4-piece (22/12/16)", "DW Performance 5-piece", "Yamaha Recording Custom",
    "Pearl Reference 4-piece", "Gretsch USA Custom 4-piece", "Ludwig Classic Maple",
  ],
  // Backline brand catalogs (used by the add-as-needed item cards in section 7).
  // Each brand maps to its top 6 preset kits + "Other" for custom.
  drumBrands: ["Pearl", "Yamaha", "DW", "Ludwig", "Tama", "Gretsch", "Mapex"],
  drumPresetsByBrand: {
    Pearl:    ["Reference Pure", "Masterworks", "Masters Maple", "Session Studio Select", "Decade Maple", "Export"],
    Yamaha:   ["Recording Custom", "Absolute Hybrid Maple", "PHX (Phoenix)", "Live Custom Hybrid Oak", "Tour Custom", "Stage Custom Birch"],
    DW:       ["Collector's Maple (22/12/16)", "Collector's Pure Maple", "Performance Series", "Design Series", "Jazz Series", "Classics Series"],
    Ludwig:   ["Classic Maple", "Legacy Maple", "Neusonic", "Classic Oak", "Black Magic", "Element Evolution"],
    Tama:     ["Starclassic Maple", "Starclassic Walnut/Birch", "Star Walnut", "Superstar Classic", "Imperialstar", "Silverstar"],
    Gretsch:  ["USA Custom", "Brooklyn", "Renown", "Catalina Maple", "Catalina Club", "Energy"],
    Mapex:    ["Saturn Evolution", "Black Panther Design Lab", "Mars Maple", "Armory", "Storm", "Tornado"],
  },
  guitarAmpBrands: ["Fender", "Marshall", "Vox", "Mesa Boogie", "Orange", "Hiwatt", "Friedman"],
  guitarAmpPresetsByBrand: {
    Fender:        ["Twin Reverb", "Deluxe Reverb", "Hot Rod Deluxe", "Princeton Reverb", "Bassman", "Super Reverb"],
    Marshall:      ["JCM800", "JCM900", "Plexi 1959", "JTM45", "DSL40CR", "Silver Jubilee"],
    Vox:           ["AC30", "AC15", "AC10", "AC4", "Night Train", "MV50"],
    "Mesa Boogie": ["Mark V", "Rectifier", "Lone Star", "Fillmore", "California Tweed", "Mark VII"],
    Orange:        ["Rockerverb 50", "OR15", "Rocker 32", "Tiny Terror", "Crush Pro", "TremLord"],
    Hiwatt:        ["DR103", "Custom 100", "Lead 30", "Hi-Gain 50", "T20HD", "Bulldog"],
    Friedman:      ["BE-100", "Smallbox", "PT-20", "Runt", "ASM-12", "Twin Sister"],
  },
  bassAmpBrands: ["Ampeg", "Aguilar", "Mesa Boogie", "Markbass", "Gallien-Krueger", "Trace Elliot", "Eden"],
  bassAmpPresetsByBrand: {
    Ampeg:            ["SVT-VR", "SVT-CL", "B-15", "SVT-7 Pro", "PF-500", "PF-800"],
    Aguilar:          ["DB751", "Tone Hammer 500", "Tone Hammer 700", "AG700", "DB900", "AG500"],
    "Mesa Boogie":    ["Subway D-800", "Subway D-800+", "WD-800", "Walkabout", "TT-800", "Carbine M9"],
    Markbass:         ["Little Mark III", "Little Mark IV", "Little Mark 250 Black", "TTE 800", "Big Bang", "CMD 121P"],
    "Gallien-Krueger":["800RB", "MB500", "Fusion 800", "Legacy 800", "MB200", "Plex Preamp"],
    "Trace Elliot":   ["ELF", "Transit B", "GP12 SMX", "AH600", "AH1000", "AH3500"],
    Eden:             ["WT800", "WT550", "Terra Nova", "Nemesis NC410", "World Tour 800", "Metro D"],
  },
  keysBrands: ["Yamaha", "Nord", "Roland", "Korg", "Hammond", "Sequential"],
  keysPresetsByBrand: {
    Yamaha:    ["CP88", "CP73", "Motif XF8", "MODX8", "YC88", "Montage 8"],
    Nord:      ["Stage 3 88", "Stage 3 Compact", "Electro 6D 73", "Piano 5", "Lead A1", "Wave 2"],
    Roland:    ["RD-2000", "RD-88", "Fantom 8", "Jupiter-X", "Juno-DS88", "FA-08"],
    Korg:      ["Kronos 88", "Nautilus 88", "Grandstage 88", "SV-2 88", "Kross 2-88", "Wavestate"],
    Hammond:   ["B3 + Leslie 122", "SK Pro 88", "SKX Pro", "XK-5", "M-Solo", "XK-1c"],
    Sequential:["Prophet-10", "Prophet 5", "Prophet X", "OB-6", "Take 5", "Pro 3"],
  },
  backlineCategories: [
    { key: "drums",  label: "Drum Kit",   brandKey: "drumBrands",      presetsKey: "drumPresetsByBrand",      hasCab: false, hasStand: false },
    { key: "gtr",    label: "Guitar Amp", brandKey: "guitarAmpBrands", presetsKey: "guitarAmpPresetsByBrand", hasCab: true,  hasStand: false },
    { key: "bass",   label: "Bass Amp",   brandKey: "bassAmpBrands",   presetsKey: "bassAmpPresetsByBrand",   hasCab: true,  hasStand: false },
    { key: "keys",   label: "Keyboards",  brandKey: "keysBrands",      presetsKey: "keysPresetsByBrand",      hasCab: false, hasStand: true  },
    { key: "other",  label: "Other",      brandKey: null,              presetsKey: null,                      hasCab: false, hasStand: false },
  ],
  guitarAmps: [
    "Fender Twin Reverb", "Fender Deluxe Reverb", "Fender Hot Rod Deluxe",
    "Marshall JCM800", "Marshall JCM900", "Marshall Plexi 1959",
    "Vox AC30", "Vox AC15", "Mesa Boogie Mark V", "Mesa Boogie Rectifier",
    "Orange OR15", "Orange Rockerverb 50",
  ],
  bassAmps: [
    "Ampeg SVT-VR", "Ampeg SVT-CL", "Ampeg B-15", "Aguilar DB751", "Aguilar Tone Hammer 500",
    "Mesa Subway D-800", "Markbass Little Mark III", "Gallien-Krueger 800RB",
  ],
  keyboards: [
    "Yamaha CP88", "Yamaha Motif XF8", "Nord Stage 3", "Nord Electro 6",
    "Roland RD-2000", "Hammond SK Pro", "Korg Kronos", "Hammond B3 + Leslie 122",
  ],
  suppliers: ["Promoter / Venue", "Artist", "Backline Provider", "Rental Company", "TBD"],
  monStandTypes: ["Tall boom", "Short boom", "Straight", "Clip", "None", "Wireless"],
  paConfigs: ["Line array", "Point source", "Suspended", "Ground-stacked", "Hybrid"],
  spaWeighting: ["dBA", "dBC", "dBZ"],
};

const SECTIONS = [
  { id: "general",   label: "General Info",         num: "01", icon: FileText },
  { id: "pa",        label: "PA",                   num: "02", icon: Music2 },
  { id: "consoles",  label: "Consoles",             num: "03", icon: Sliders },
  { id: "monsys",    label: "Monitor Systems",      num: "04", icon: Headphones },
  { id: "monmix",    label: "Monitor Mixes",        num: "05", icon: Mic2 },
  { id: "inputs",    label: "Input List",           num: "06", icon: ListChecks },
  { id: "backline",  label: "Backline",             num: "07", icon: Guitar },
  { id: "aux",       label: "Auxiliary Equipment",  num: "08", icon: Boxes },
  { id: "notes",     label: "Final Notes",          num: "09", icon: StickyNote },
];

// -------------------- HELPERS --------------------
const uid = () => Math.random().toString(36).slice(2, 10);

// Snap an item's edge coordinate (top-left x or y) so its CENTER lands on the
// half-foot grid. Snapping the center rather than the corner means an item
// centers cleanly on the stage centerline and aligns with other items
// regardless of whether its width/height is a whole number of feet (e.g. a
// 7.5-ft drum kit). dim = the item's width (for x) or height (for y).
const snapCenter = (edge, dim) => Math.round((edge + dim / 2) * 2) / 2 - dim / 2;
const cls = (...xs) => xs.filter(Boolean).join(" ");

// Compute live channel numbers for the Input List. Mono rows claim one channel,
// stereo rows claim two consecutive channels — the next row falls to the slot
// after the pair. Returns one descriptor per input row in original order:
//   { id, start, end, isStereo, label }    label = "1" or "5-6"
// Used by the Input List Ch column, the Stage Plot Library channel pills, and
// the channel-pin items rendered on the stage (which look up by id so renames
// in the Input List propagate live).
const computeChannelMap = (inputs) => {
  let next = 1;
  return inputs.map(i => {
    const start = next;
    const end = i.stereo ? next + 1 : next;
    next = end + 1;
    return {
      id: i.id,
      start, end,
      isStereo: !!i.stereo,
      label: i.stereo ? `${start}-${end}` : `${start}`,
    };
  });
};

// Brand-styled primitives -----------------------------------------------
const Mono = ({ children, className = "", style = {} }) => (
  <span
    className={cls("uppercase", className)}
    style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: "0.12em", ...style }}>
    {children}
  </span>
);
const Display = ({ children, className = "", weight = 800, style = {} }) => (
  <span className={className}
    style={{ fontFamily: "'Archivo', system-ui, sans-serif", fontWeight: weight, letterSpacing: "0.01em", ...style }}>
    {children}
  </span>
);

// Field-tested stamp — per brand spec, orange hairline + -3deg rotation.
// Three sizes: xs (7px) for inline use, sm (9px, default) for component headers,
// lg (13px) for hero placement.
const Stamp = ({ children = "FIELD-TESTED", size = "sm", style = {} }) => {
  const sizes = {
    xs: { fontSize: 7,  padding: "3px 8px",  letterSpacing: "0.18em" },
    sm: { fontSize: 9,  padding: "5px 11px", letterSpacing: "0.22em" },
    lg: { fontSize: 13, padding: "8px 16px", letterSpacing: "0.26em" },
  };
  const s = sizes[size] || sizes.sm;
  return (
    <span style={{
      display: "inline-block",
      border: `1px solid ${BRAND.orange}`,
      color: BRAND.orange,
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontWeight: 700,
      textTransform: "uppercase",
      transform: "rotate(-3deg)",
      whiteSpace: "nowrap",
      lineHeight: 1,
      ...s,
      ...style,
    }}>{children}</span>
  );
};

// Field label (mono, mini, wide-tracked) -------------------------------
const FieldLabel = ({ children }) => (
  <Mono className="block mb-1.5" style={{ fontSize: 9, opacity: 0.55 }}>{children}</Mono>
);

// Hairline input
const Input = React.forwardRef(({ className = "", style = {}, ...props }, ref) => (
  <input ref={ref}
    className={cls("w-full px-2.5 py-2 text-sm outline-none transition-colors", className)}
    style={{
      fontFamily: "'Inter', system-ui, sans-serif",
      backgroundColor: "rgba(244,241,234,0.04)",
      color: BRAND.bone,
      border: `1px solid rgba(244,241,234,0.14)`,
      borderRadius: 2,
      ...style,
    }}
    onFocus={(e) => { e.target.style.borderColor = BRAND.orange; props.onFocus?.(e); }}
    onBlur={(e) => { e.target.style.borderColor = "rgba(244,241,234,0.14)"; props.onBlur?.(e); }}
    {...props}
  />
));

const Select = ({ className = "", style = {}, children, ...props }) => (
  <select
    className={cls("w-full px-2.5 py-2 text-sm outline-none transition-colors appearance-none", className)}
    style={{
      fontFamily: "'Inter', system-ui, sans-serif",
      backgroundColor: "rgba(244,241,234,0.04)",
      color: BRAND.bone,
      border: `1px solid rgba(244,241,234,0.14)`,
      borderRadius: 2,
      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath fill='%23D4641E' d='M3 5l3 3 3-3z'/%3E%3C/svg%3E")`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 8px center",
      paddingRight: 24,
      ...style,
    }}
    {...props}>
    {children}
  </select>
);

const Textarea = ({ className = "", style = {}, ...props }) => (
  <textarea
    className={cls("w-full px-2.5 py-2 text-sm outline-none transition-colors resize-y", className)}
    style={{
      fontFamily: "'Inter', system-ui, sans-serif",
      backgroundColor: "rgba(244,241,234,0.04)",
      color: BRAND.bone,
      border: `1px solid rgba(244,241,234,0.14)`,
      borderRadius: 2,
      ...style,
    }}
    {...props}
  />
);

const Checkbox = ({ checked, onChange, label, sub }) => (
  <label className="flex items-start gap-2.5 cursor-pointer group">
    <span
      className="mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors"
      style={{
        width: 16, height: 16,
        border: `1px solid ${checked ? BRAND.orange : "rgba(244,241,234,0.35)"}`,
        backgroundColor: checked ? BRAND.orange : "transparent",
        borderRadius: 1,
      }}>
      {checked && <span style={{ color: BRAND.black, fontSize: 11, lineHeight: 1 }}>✓</span>}
    </span>
    <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
    <span style={{ color: BRAND.bone }}>
      <span className="text-sm" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>{label}</span>
      {sub && <span className="block mt-0.5" style={{ fontSize: 11, opacity: 0.55 }}>{sub}</span>}
    </span>
  </label>
);

// Brand button
const Btn = ({ children, variant = "default", className = "", style = {}, ...props }) => {
  const base = {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontSize: 10,
    padding: "8px 14px",
    border: `1px solid transparent`,
    borderRadius: 2,
    cursor: "pointer",
    transition: "all 0.12s",
  };
  const variants = {
    default: { backgroundColor: "rgba(244,241,234,0.06)", color: BRAND.bone, borderColor: "rgba(244,241,234,0.18)" },
    primary: { backgroundColor: BRAND.orange, color: BRAND.black, fontWeight: 700 },
    ghost:   { backgroundColor: "transparent", color: BRAND.bone, borderColor: "rgba(244,241,234,0.18)" },
    blue:    { backgroundColor: BRAND.blue, color: BRAND.bone },
  };
  return (
    <button
      className={cls("inline-flex items-center gap-1.5 hover:opacity-90", className)}
      style={{ ...base, ...variants[variant], ...style }}
      {...props}>
      {children}
    </button>
  );
};

// Stage Plot Source toggle — three-way segmented control. Used in two places:
// (1) the action slot of the General Info Images Card, (2) a dedicated row beneath
// the Stage Plot Builder entry in the left sidebar nav. Both points read/write the
// same general.stagePlotSource state so flipping one updates the other.
// Variants: "row" = full-width emphasized row for sidebar use (vertical or horizontal);
// "compact" = inline mini-segmented control for use inside a card header action slot.
const StagePlotSourceToggle = ({ value = "live", onChange, variant = "compact" }) => {
  const opts = [
    { v: "live", label: "Live Builder" },
    { v: "upload", label: "Uploaded" },
    { v: "both", label: "Both" },
  ];
  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2">
        <span style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 8.5, letterSpacing: "0.16em", color: "rgba(244,241,234,0.55)",
          textTransform: "uppercase",
        }}>Stage Plot Source</span>
        <div className="flex" style={{ border: "1px solid rgba(244,241,234,0.18)", borderRadius: 2 }}>
          {opts.map((o, i) => {
            const sel = value === o.v;
            return (
              <button key={o.v} type="button" onClick={() => onChange(o.v)}
                style={{
                  padding: "3px 8px",
                  background: sel ? "rgba(212,100,30,0.16)" : "transparent",
                  color: sel ? BRAND.orange : "rgba(244,241,234,0.65)",
                  borderLeft: i > 0 ? "1px solid rgba(244,241,234,0.12)" : "none",
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                  cursor: "pointer", whiteSpace: "nowrap",
                }}>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  // "row" variant — used in the sidebar. Slightly emphasized panel under a parent row.
  return (
    <div className="px-4 py-2"
      style={{
        backgroundColor: "rgba(244,241,234,0.03)",
        borderLeft: `2px solid rgba(212,100,30,0.40)`,
      }}>
      <div style={{
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 8.5, letterSpacing: "0.18em", color: "rgba(244,241,234,0.55)",
        textTransform: "uppercase", marginBottom: 4,
      }}>Stage Plot Source</div>
      <div className="flex" style={{ border: "1px solid rgba(244,241,234,0.18)", borderRadius: 2, overflow: "hidden" }}>
        {opts.map((o, i) => {
          const sel = value === o.v;
          return (
            <button key={o.v} type="button" onClick={() => onChange(o.v)}
              style={{
                flex: 1,
                padding: "4px 4px",
                background: sel ? "rgba(212,100,30,0.16)" : "transparent",
                color: sel ? BRAND.orange : "rgba(244,241,234,0.65)",
                borderLeft: i > 0 ? "1px solid rgba(244,241,234,0.12)" : "none",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 9, letterSpacing: "0.10em", textTransform: "uppercase",
                cursor: "pointer", whiteSpace: "nowrap",
              }}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Card (panel container in the dark workspace)
// `defined` = true gives the section the orange field-stamp header + outline,
// used to make tables/subgroups visually pop within a section.
const Card = ({
  children, title, subtitle, action,
  dense = false, defined = false, complete = false,
  collapsible = false, defaultOpen = true,
  className = "",
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = collapsible ? open : true;
  const accent = complete ? BRAND.orange : (defined ? BRAND.orange : "rgba(244,241,234,0.10)");
  return (
    <div className={cls("relative", className)}
      style={{
        backgroundColor: defined ? "rgba(212,100,30,0.025)" : "rgba(244,241,234,0.025)",
        border: `1px solid ${defined ? "rgba(212,100,30,0.55)" : "rgba(244,241,234,0.10)"}`,
        borderRadius: 2,
      }}>
      {title && (
        <div
          onClick={collapsible ? () => setOpen(o => !o) : undefined}
          className="flex items-center justify-between px-4 py-2.5"
          style={{
            borderBottom: isOpen
              ? `1px solid ${defined ? "rgba(212,100,30,0.55)" : "rgba(244,241,234,0.10)"}`
              : "1px solid transparent",
            backgroundColor: defined ? "rgba(212,100,30,0.10)" : "transparent",
            cursor: collapsible ? "pointer" : "default",
            userSelect: collapsible ? "none" : "auto",
          }}>
          <div className="flex items-center gap-2.5">
            {defined && (
              <span style={{
                width: 6, height: 6,
                backgroundColor: complete ? BRAND.orange : "rgba(212,100,30,0.45)",
                border: `1px solid ${BRAND.orange}`,
                borderRadius: 1,
              }}/>
            )}
            <Mono style={{
              fontSize: 10,
              color: defined ? BRAND.orange : BRAND.bone,
              fontWeight: defined ? 700 : 500,
              opacity: defined ? 1 : 0.85,
            }}>{title}</Mono>
            {subtitle && (
              <>
                <span style={{ width: 16, height: 1, backgroundColor: "rgba(212,100,30,0.45)" }}/>
                <Mono style={{ fontSize: 9, color: "rgba(244,241,234,0.45)" }}>{subtitle}</Mono>
              </>
            )}
            {complete && (
              <Mono style={{
                fontSize: 8, color: BRAND.black, backgroundColor: BRAND.orange,
                padding: "2px 5px", letterSpacing: "0.16em", fontWeight: 700,
              }}>✓ COMPLETE</Mono>
            )}
          </div>
          <div className="flex items-center gap-2.5"
            onClick={(e) => { if (collapsible) e.stopPropagation(); }}>
            {action}
            {collapsible && (
              <button
                onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
                className="flex items-center gap-1.5 px-2 py-1 transition-colors"
                style={{
                  border: `1px solid ${BRAND.orange}`,
                  backgroundColor: "transparent",
                  color: BRAND.orange,
                  borderRadius: 2,
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 8.5,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(212,100,30,0.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
                title={isOpen ? "Collapse" : "Expand"}>
                {isOpen
                  ? <><ChevronDown className="w-3 h-3"/> Collapse</>
                  : <><ChevronRight className="w-3 h-3"/> Expand</>}
              </button>
            )}
          </div>
        </div>
      )}
      {isOpen && (
        <div className={dense ? "p-3" : "p-4"}>{children}</div>
      )}
    </div>
  );
};

// -------------------- TIPS WINDOW (reusable advisory) --------------------
// Visually distinct from the orange "you fill this in" data cards.
// Bone-on-dark, hairline ghost border, no orange accent — reads as advisory
// margin text in an engineering document, not as a content control.
function Tips({ title = "Tips", tips = [], defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-5"
      style={{
        backgroundColor: "rgba(244,241,234,0.03)",
        border: "1px solid rgba(244,241,234,0.18)",
        borderLeft: `3px solid rgba(244,241,234,0.55)`,
        borderRadius: 2,
      }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
        style={{ backgroundColor: "transparent", cursor: "pointer" }}>
        <div className="flex items-center gap-2.5">
          <span style={{
            width: 18, height: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `1px solid rgba(244,241,234,0.55)`,
            borderRadius: 1,
            fontFamily: "'Archivo', system-ui, sans-serif",
            fontWeight: 800, fontSize: 11,
            color: BRAND.bone,
          }}>i</span>
          <Mono style={{ fontSize: 10, color: BRAND.bone, opacity: 0.85, fontWeight: 700 }}>
            {title.toUpperCase()}
          </Mono>
          <Stamp size="xs" style={{ marginLeft: 6 }}>FIELD-TESTED</Stamp>
        </div>
        {open ? <ChevronDown className="w-3.5 h-3.5" style={{ color: BRAND.bone, opacity: 0.55 }}/>
              : <ChevronRight className="w-3.5 h-3.5" style={{ color: BRAND.bone, opacity: 0.55 }}/>}
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1" style={{ borderTop: "1px solid rgba(244,241,234,0.08)" }}>
          <ul className="space-y-1.5 mt-2">
            {tips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-2.5"
                style={{ color: "rgba(244,241,234,0.78)", fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12.5, lineHeight: 1.55 }}>
                <span style={{
                  flexShrink: 0,
                  width: 4, height: 4, marginTop: 8,
                  backgroundColor: "rgba(244,241,234,0.55)",
                  borderRadius: "50%",
                }}/>
                <span>
                  {tip.label && (
                    <span style={{
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase",
                      color: BRAND.bone, fontWeight: 700, marginRight: 6,
                    }}>{tip.label}</span>
                  )}
                  <span>{tip.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// -------------------- CHARACTER COUNTER (reusable) --------------------
// Mono "current / max" counter. Color flips to Burnt Orange at 80% (soft warn).
// Pair with a maxLength on the textarea + paste-truncation in onChange for the
// hard cap.
function CharCounter({ count, max }) {
  const warn = max > 0 && count >= max * 0.8;
  const maxed = count >= max;
  return (
    <div className="mt-1.5 flex items-center justify-between">
      <Mono style={{ fontSize: 8.5, opacity: 0.45 }}>
        {maxed ? "Limit reached" : warn ? "Approaching limit" : "Keep it concise"}
      </Mono>
      <Mono style={{
        fontSize: 8.5,
        color: warn ? BRAND.orange : "rgba(244,241,234,0.55)",
        fontWeight: warn ? 700 : 400,
      }}>
        {count.toLocaleString()} / {max.toLocaleString()}
      </Mono>
    </div>
  );
}

// -------------------- SECTION NOTES (reusable) --------------------
// A wide notes block, full width of the section, used at the bottom of
// any section for free-form context that doesn't fit a structured table.
function SectionNotes({ value, onChange, subtitle = "", placeholder = "General notes for this section…", max = 800 }) {
  const v = value || "";
  return (
    <div className="mt-4">
      <Card defined complete={!!v.trim()} title="Section Notes" subtitle={subtitle}>
        <Textarea rows={4} value={v} placeholder={placeholder}
          maxLength={max}
          onChange={e => onChange(e.target.value.slice(0, max))}
          style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, lineHeight: 1.65 }}/>
        <CharCounter count={v.length} max={max} />
      </Card>
    </div>
  );
}

// -------------------- SECTION PROGRESS METER --------------------
// Rendered on a schematic-tile surface (Blueprint Blue + 22px Bone grid)
// per brand spec — reads as a "meter on a blueprint". Bar stays Burnt Orange.
function SectionProgress({ items }) {
  const total = items.length;
  const done = items.filter(i => i.complete).length;
  const pct = total === 0 ? 0 : (done / total) * 100;

  return (
    <div className="relative mb-5"
      style={{
        backgroundColor: BRAND.blue,
        backgroundImage:
          "linear-gradient(rgba(244,241,234,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(244,241,234,0.08) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
        border: "1px solid rgba(244,241,234,0.12)",
        borderRadius: 2,
        padding: "16px 18px 14px",
        color: BRAND.bone,
      }}>
      {/* Header row: schematic tag + count */}
      <div className="flex items-center justify-between mb-3">
        <span style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 9,
          letterSpacing: "0.20em",
          textTransform: "uppercase",
          color: BRAND.bone,
          border: `1px solid ${BRAND.bone}`,
          padding: "3px 9px",
          backgroundColor: "rgba(14,14,14,0.45)",
          fontWeight: 600,
        }}>SCHEMATIC · SECTION PROGRESS</span>
        <div className="flex items-center gap-3">
          <Mono style={{ fontSize: 10, color: BRAND.orange, fontWeight: 700 }}>
            {done} / {total}
          </Mono>
          <span style={{ width: 1, height: 12, backgroundColor: "rgba(244,241,234,0.30)" }}/>
          <Mono style={{ fontSize: 10, color: BRAND.orange, fontWeight: 700 }}>
            {Math.round(pct)}%
          </Mono>
        </div>
      </div>

      {/* Bar */}
      <div style={{
        position: "relative",
        height: 11,
        backgroundColor: "rgba(14,14,14,0.55)",
        border: "1px solid rgba(244,241,234,0.22)",
        borderRadius: 1,
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute",
          left: 0, top: 0, bottom: 0,
          width: `${pct}%`,
          backgroundColor: BRAND.orange,
          transition: "width 0.25s ease-out",
        }}/>
        {/* Tick marks for each subsection */}
        {items.map((_, idx) => (
          idx > 0 && (
            <div key={idx} style={{
              position: "absolute",
              left: `${(idx / total) * 100}%`,
              top: 0, bottom: 0,
              width: 1,
              backgroundColor: BRAND.black,
              opacity: 0.7,
            }}/>
          )
        ))}
      </div>

      {/* Item legend */}
      <div className="grid gap-2 mt-3" style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}>
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <span style={{
              width: 9, height: 9, flexShrink: 0,
              backgroundColor: item.complete ? BRAND.orange : "transparent",
              border: `1px solid ${item.complete ? BRAND.orange : "rgba(244,241,234,0.45)"}`,
              borderRadius: 1,
            }}/>
            <Mono style={{
              fontSize: 9,
              color: item.complete ? BRAND.bone : "rgba(244,241,234,0.65)",
              fontWeight: item.complete ? 700 : 400,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>{item.label}</Mono>
          </div>
        ))}
      </div>

      {/* Field-tested stamp — only appears when section is fully complete */}
      {pct === 100 && (
        <div style={{ position: "absolute", right: 14, bottom: 10 }}>
          <Stamp size="xs">FIELD-TESTED</Stamp>
        </div>
      )}
    </div>
  );
}

// -------------------- SEARCHABLE LIBRARY DROPDOWN --------------------
function LibrarySelect({ value, onChange, options, customLibrary, onAddCustom, placeholder = "Select…" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const all = useMemo(() => [...new Set([...(options || []), ...(customLibrary || [])])], [options, customLibrary]);
  const filtered = useMemo(() => {
    if (!query.trim()) return all;
    return all.filter(o => o.toLowerCase().includes(query.toLowerCase()));
  }, [all, query]);
  const exactMatch = filtered.some(f => f.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full text-left px-2.5 py-2 text-sm flex items-center justify-between transition-colors"
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          backgroundColor: "rgba(244,241,234,0.04)",
          color: value ? BRAND.bone : "rgba(244,241,234,0.4)",
          border: `1px solid ${open ? BRAND.orange : "rgba(244,241,234,0.14)"}`,
          borderRadius: 2,
        }}>
        <span>{value || placeholder}</span>
        <ChevronDown className="w-3.5 h-3.5" style={{ color: BRAND.orange }}/>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 mt-1 w-full overflow-hidden"
            style={{
              backgroundColor: BRAND.black,
              border: `1px solid ${BRAND.orange}`,
              borderRadius: 2,
              maxHeight: 320,
            }}>
            <div className="p-2 flex items-center gap-2"
              style={{ borderBottom: `1px solid rgba(244,241,234,0.12)` }}>
              <Search className="w-3.5 h-3.5" style={{ color: BRAND.orange }}/>
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Type to search · or add custom…"
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: BRAND.bone, fontFamily: "'Inter', system-ui, sans-serif" }}/>
            </div>
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {filtered.map(opt => (
                <div key={opt} onClick={() => { onChange(opt); setOpen(false); setQuery(""); }}
                  className="px-3 py-2 text-sm cursor-pointer flex items-center justify-between hover:opacity-100"
                  style={{ color: BRAND.bone, opacity: 0.85, fontFamily: "'Inter', system-ui, sans-serif" }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(212,100,30,0.12)"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                  <span>{opt}</span>
                  {value === opt && <span style={{ color: BRAND.orange }}>✓</span>}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-3 text-sm" style={{ color: "rgba(244,241,234,0.4)" }}>No matches</div>
              )}
              {query.trim() && !exactMatch && (
                <div onClick={() => { onAddCustom?.(query.trim()); onChange(query.trim()); setOpen(false); setQuery(""); }}
                  className="px-3 py-2.5 text-sm cursor-pointer flex items-center gap-2"
                  style={{
                    backgroundColor: "rgba(212,100,30,0.14)",
                    color: BRAND.orange,
                    borderTop: "1px solid rgba(244,241,234,0.10)",
                    fontFamily: "'Inter', system-ui, sans-serif",
                  }}>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add custom: <span style={{ fontWeight: 700 }}>"{query.trim()}"</span></span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// -------------------- EQUIPMENT TABLE (Preferred + Accepted) --------------------
// columnOrder: array of slot keys controlling left-to-right column order.
// Built-in slots: "item", "supplier", "notes". Any other string is matched
// against an extraColumns[].key entry. Default order = item · supplier · ...extras · notes.
function EquipmentTable({ title, library, customKey, customLibs, addCustom, rows, setRows, extraColumns = [], columnOrder }) {
  const [acceptedOpen, setAcceptedOpen] = useState(true);

  const updateRow = (id, patch) => setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  const removeRow = (id) => setRows(rs => rs.filter(r => r.id !== id));
  const addAccepted = () => setRows(rs => [...rs, { id: uid(), kind: "accepted", item: "", supplier: "", notes: "", extras: {} }]);

  const preferred = rows.find(r => r.kind === "preferred");
  const accepted = rows.filter(r => r.kind === "accepted");

  // Build column descriptors based on columnOrder, with sensible defaults
  const order = columnOrder || ["item", "supplier", ...extraColumns.map(c => c.key), "notes"];
  const colWidths = order.map(slot => {
    if (slot === "item") return "1.4fr";
    if (slot === "notes") return "1.4fr";
    if (slot === "supplier") return "1fr";
    return "0.9fr"; // extras
  });

  const renderCell = (slot, row, isPreferred) => {
    if (slot === "item") return (
      <div key="item">
        <FieldLabel>
          <span className="inline-flex items-center gap-1">
            {isPreferred && <Star className="w-2.5 h-2.5" style={{ color: BRAND.orange, fill: BRAND.orange }}/>}
            {isPreferred ? "Preferred Model" : "Accepted alt"}
          </span>
        </FieldLabel>
        <LibrarySelect value={row.item}
          onChange={v => updateRow(row.id, { item: v })}
          options={library}
          customLibrary={customLibs[customKey] || []}
          onAddCustom={v => addCustom(customKey, v)} />
      </div>
    );
    if (slot === "supplier") return (
      <div key="supplier">
        <FieldLabel>Supplier</FieldLabel>
        <Select value={row.supplier} onChange={e => updateRow(row.id, { supplier: e.target.value })}>
          <option value="">—</option>
          {SEED.suppliers.map(s => <option key={s} style={{backgroundColor: BRAND.black}}>{s}</option>)}
        </Select>
      </div>
    );
    if (slot === "notes") return (
      <div key="notes">
        <FieldLabel>Notes</FieldLabel>
        <Input value={row.notes} placeholder="e.g. software v5+, 32 ch min"
          onChange={e => updateRow(row.id, { notes: e.target.value })}/>
      </div>
    );
    // extras column
    const col = extraColumns.find(c => c.key === slot);
    if (!col) return null;
    return (
      <div key={col.key}>
        <FieldLabel>{col.label}</FieldLabel>
        <Input value={row.extras?.[col.key] || ""} placeholder={col.placeholder || ""}
          onChange={e => updateRow(row.id, { extras: { ...(row.extras || {}), [col.key]: e.target.value } })}/>
      </div>
    );
  };

  const renderRow = (row, isPreferred) => (
    <div key={row.id} className="grid gap-2 p-3"
      style={{
        gridTemplateColumns: `${colWidths.join(" ")} 28px`,
        backgroundColor: isPreferred ? "rgba(212,100,30,0.06)" : "transparent",
        border: `1px solid ${isPreferred ? "rgba(212,100,30,0.35)" : "rgba(244,241,234,0.10)"}`,
        borderRadius: 2,
      }}>
      {order.map(slot => renderCell(slot, row, isPreferred))}
      <div className="flex items-end justify-end">
        {!isPreferred && (
          <button onClick={() => removeRow(row.id)} className="p-1.5 transition-colors"
            style={{ color: "rgba(244,241,234,0.45)", borderRadius: 2 }}
            onMouseEnter={e => { e.currentTarget.style.color = BRAND.orange; e.currentTarget.style.backgroundColor = "rgba(212,100,30,0.10)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(244,241,234,0.45)"; e.currentTarget.style.backgroundColor = "transparent"; }}
            title="Remove">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Card title={title}>
      <div className="space-y-2">
        {preferred && renderRow(preferred, true)}
        <button onClick={() => setAcceptedOpen(o => !o)}
          className="w-full mt-1 px-3 py-2 text-left flex items-center justify-between transition-colors"
          style={{
            backgroundColor: "rgba(244,241,234,0.03)",
            border: "1px solid rgba(244,241,234,0.10)",
            borderRadius: 2,
          }}>
          <span className="flex items-center gap-2" style={{ color: BRAND.bone }}>
            {acceptedOpen ? <ChevronDown className="w-3.5 h-3.5" style={{color:BRAND.orange}}/> : <ChevronRight className="w-3.5 h-3.5" style={{color:BRAND.orange}}/>}
            <Mono style={{ fontSize: 10, opacity: 0.85 }}>Other accepted ({accepted.length})</Mono>
          </span>
          <Mono style={{ fontSize: 9, opacity: 0.45 }}>{acceptedOpen ? "Collapse" : "Expand"}</Mono>
        </button>
        {acceptedOpen && (
          <div className="space-y-2">
            {accepted.map(r => renderRow(r, false))}
            <button onClick={addAccepted}
              className="w-full py-2.5 text-sm flex items-center justify-center gap-2 transition-colors"
              style={{
                border: "1px dashed rgba(244,241,234,0.25)",
                color: "rgba(244,241,234,0.55)",
                borderRadius: 2,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND.orange; e.currentTarget.style.color = BRAND.orange; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(244,241,234,0.25)"; e.currentTarget.style.color = "rgba(244,241,234,0.55)"; }}>
              <Plus className="w-3.5 h-3.5" /> Add accepted alternate
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

const makeDefaultRows = () => [{ id: uid(), kind: "preferred", item: "", supplier: "", notes: "", extras: {} }];

// -------------------- MAIN APP --------------------
// Top-level export wraps the app in TierProvider so any component can call
// useTier() / useIsPaid() to gate features. Keeps the gating logic out of
// global module state and inside React, where it can re-render cleanly on
// flip and survive HMR.
export default function TechnicalRiderBuilderApp(props) {
  return (
    <TierProvider>
      <UpgradeProvider>
        <MobileBanner />
        <TechnicalRiderBuilder {...props} />
      </UpgradeProvider>
    </TierProvider>
  );
}

function TechnicalRiderBuilder() {
  // Tier + upgrade-modal hooks — used throughout to gate features. Single
  // source of truth so flipping the tier (URL param, localStorage, or future
  // real billing) re-renders every gated component atomically.
  const { isPaid, isFree } = useTier();
  const { show: showUpgrade } = useUpgrade();

  // Feature 1: Projects Shell routing
  const [view, setView] = useState("projects");
  // Projects are lazy-initialized straight from localStorage on the first
  // render. This MUST stay a lazy initializer — do NOT switch back to
  // useState([]) + a load effect. With that older pattern the "save" effect
  // below fired on mount while `projects` was still the empty initial value
  // and overwrote trb-projects with [], wiping every saved rider on each
  // page load.
  const [projects, setProjects] = useState(() => {
    try {
      const stored = localStorage.getItem("trb-projects");
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });
  const [currentProjectId, setCurrentProjectId] = useState(null);

  // Save projects list to localStorage whenever it changes. Safe now that
  // `projects` is seeded from storage on the first render — the mount-time
  // run of this effect just re-writes the same data back.
  useEffect(() => {
    localStorage.setItem("trb-projects", JSON.stringify(projects));
  }, [projects]);

  // Load current project from localStorage on mount and whenever it changes
  useEffect(() => {
    if (!currentProjectId) return;
    const project = projects.find(p => p.id === currentProjectId);
    if (project && project.state) {
      // Load project state into builder state
      // This is handled below via conditional useEffect
    }
  }, [currentProjectId, projects]);

  const [activeSection, setActiveSection] = useState("general");
  const [showPlot, setShowPlot] = useState(false);

  const [customLibs, setCustomLibs] = useState({
    consoles: [], pa: [], mics: [], iems: [], wedges: [], drumKits: [], guitarAmps: [], bassAmps: [], keyboards: [],
    sources: [],
  });
  const addCustom = (key, value) => setCustomLibs(c => ({ ...c, [key]: [...new Set([...(c[key] || []), value])] }));

  // -------- General Data --------
  const [general, setGeneral] = useState({
    artist: "", tour: "", version: "1.0", date: new Date().toISOString().slice(0, 10),
    coverImage: null, stagePlotUpload: null, brandLogo: null, stagePlotSource: "live", notes: "",
    intro: "",            // 01-C — sits ABOVE Team on the printed rider
    introContinued: "",   // 01-E — sits BELOW Team on the printed rider
  });
  const [crew, setCrew] = useState([
    { id: uid(), role: "Tour Manager",         name: "", phone: "", email: "" },
    { id: uid(), role: "Production Manager",   name: "", phone: "", email: "" },
    { id: uid(), role: "FOH Engineer",         name: "", phone: "", email: "" },
  ]);

  // -------- PA section state --------
  const [paMain,    setPaMain]    = useState(makeDefaultRows());
  const [paSubs,    setPaSubs]    = useState(makeDefaultRows());
  const [paSpecs, setPaSpecs] = useState({
    splTarget: "", splWeighting: "dBA", uniformity: "",
    freqLow: "20 Hz", freqHigh: "20 kHz",
    phaseAligned: false, noiseFree: false,
    notes: "",
  });
  const [paCoverage, setPaCoverage] = useState({
    depth: "", width: "", delayZones: "", frontFills: "",
  });
  const [paConfig, setPaConfig] = useState({
    type: "", rigging: "", notes: "",
  });

  // -------- Other equipment tables --------
  const [foh,       setFoh]       = useState(makeDefaultRows());
  const [mon,       setMon]       = useState(makeDefaultRows());
  const [iemRows,      setIemRows]      = useState(makeDefaultRows());
  const [wedgeRows,    setWedgeRows]    = useState(makeDefaultRows());
  const [sideFillRows, setSideFillRows] = useState(makeDefaultRows());
  const [subFillRows,  setSubFillRows]  = useState(makeDefaultRows());
  // Backline is a flat list of "items"; user adds, picks a category, then fills in.
  // Default seed: one drum kit and a guitar amp so the section isn't empty on first load.
  const [backlineItems, setBacklineItems] = useState([
    { id: uid(), category: "drums", brand: "", model: "", supplier: "", cab: "", stand: "", specs: "" },
    { id: uid(), category: "gtr",   brand: "", model: "", supplier: "", cab: "", stand: "", specs: "" },
  ]);
  const [auxRows,   setAuxRows]   = useState(makeDefaultRows());

  // Per-section notes block ("X-Notes" subsection at the bottom of each section)
  const [sectionNotes, setSectionNotes] = useState({});
  const setSectionNote = (key, val) => setSectionNotes(n => ({ ...n, [key]: val }));

  // -------- Input List --------
  const [inputs, setInputs] = useState([
    { id: uid(), ch: 1, source: "Kick In",   mic: "Shure Beta 91A", stand: "None", phantom: false, notes: "" },
    { id: uid(), ch: 2, source: "Kick Out",  mic: "Audix D6",       stand: "Short boom",      phantom: false, notes: "" },
    { id: uid(), ch: 3, source: "Snare Top", mic: "Shure SM57",     stand: "Clip",            phantom: false, notes: "" },
  ]);
  // addInput can accept optional initial fields so the Stage Plot Library's
  // "+" quick-add (which lets the user type a source name without leaving
  // the stage plot view) can seed the new row's source and stereo flag.
  // Defensive: if a caller passes a React SyntheticEvent by accident (e.g.
  // an `onClick={addInput}` shorthand), treat init as empty. Otherwise the
  // event's circular refs get spread into the new row and crash on the next
  // JSON.stringify (auto-save), turning the screen white.
  const addInput = (init) => {
    const seed = (init && typeof init === "object" && !init.nativeEvent && !init._reactName) ? init : {};
    setInputs(is => is.length >= 48 ? is : [...is, { id: uid(), ch: (is.at(-1)?.ch || 0) + 1, source: "", mic: "", stand: "", phantom: false, notes: "", stereo: false, ...seed }]);
  };

  // CSV import bridge — InputListSection dispatches a custom event with the parsed rows
  useEffect(() => {
    const handler = (e) => setInputs(e.detail.slice(0, 48));
    window.addEventListener("rider-replace-inputs", handler);
    return () => window.removeEventListener("rider-replace-inputs", handler);
  }, []);
  const updateInput = (id, patch) => setInputs(is => is.map(i => i.id === id ? { ...i, ...patch } : i));
  const removeInput = (id) => setInputs(is => is.filter(i => i.id !== id));
  // Reorder via drag-and-drop on the channel number cell. fromIdx is the row's
  // original index; toIdx is the insertion point (0 = before first row, N = after
  // last row). Channel numbers are display-only (idx + 1) so we don't need to
  // touch any `ch` field — just rearrange the array.
  const reorderInputs = (fromIdx, toIdx) => setInputs(is => {
    if (fromIdx === toIdx || fromIdx === toIdx - 1) return is;
    const next = is.slice();
    const [moved] = next.splice(fromIdx, 1);
    const adjustedTo = toIdx > fromIdx ? toIdx - 1 : toIdx;
    next.splice(adjustedTo, 0, moved);
    return next;
  });
  // Replace the input list with a canonical N-channel band template. Wired
  // to the "Load Template" button in the Channels card. The function itself
  // doesn't prompt for confirmation; the caller decides based on whether the
  // existing rows have any user data.
  const loadInputTemplate = () => {
    const tpl = [
      { source: "Kick In",      mic: "Shure Beta 91A",     stand: "Clip",       phantom: false, notes: "" },
      { source: "Kick Out",     mic: "Audix D6",           stand: "Short boom", phantom: false, notes: "" },
      { source: "Snare Top",    mic: "Shure SM57",         stand: "Clip",       phantom: false, notes: "" },
      { source: "Snare Bottom", mic: "Sennheiser e604",    stand: "Clip",       phantom: false, notes: "" },
      { source: "Hi-Hat",       mic: "Shure SM81",         stand: "Tall boom",  phantom: true,  notes: "" },
      { source: "Rack Tom 1",   mic: "Sennheiser e904",    stand: "Clip",       phantom: false, notes: "" },
      { source: "Floor Tom",    mic: "Sennheiser e604",    stand: "Clip",       phantom: false, notes: "" },
      { source: "Overhead L",   mic: "AKG C414",           stand: "Tall boom",  phantom: true,  notes: "" },
      { source: "Overhead R",   mic: "AKG C414",           stand: "Tall boom",  phantom: true,  notes: "" },
      { source: "Bass DI",      mic: "DI - Radial J48",    stand: "None",       phantom: true,  notes: "" },
      { source: "Guitar 1",     mic: "Sennheiser e906",    stand: "Short boom", phantom: false, notes: "" },
      { source: "Keys L",       mic: "DI - Radial J48",    stand: "None",       phantom: true,  notes: "" },
      { source: "Keys R",       mic: "DI - Radial J48",    stand: "None",       phantom: true,  notes: "" },
      { source: "Lead Vox",     mic: "Shure SM58",         stand: "Tall boom",  phantom: false, notes: "" },
      { source: "BGV 1",        mic: "Shure SM58",         stand: "Tall boom",  phantom: false, notes: "" },
      { source: "BGV 2",        mic: "Shure SM58",         stand: "Tall boom",  phantom: false, notes: "" },
    ];
    setInputs(tpl.map((r, idx) => ({ id: uid(), ch: idx + 1, ...r })));
  };

  // -------- Monitor Mixes --------
  // Mixes use a `format` of "Mono" or "Stereo". A "Stereo" entry consumes
  // two consecutive mix numbers — the row immediately after gets `linkedTo`
  // pointing at the parent's id and `side: "R"` (locked, mirrors recipient/type).
  const [mixes, setMixes] = useState([
    { id: uid(), recipient: "Drums",    type: "IEM",   format: "Stereo", notes: "Click + drums + bass" },
    // Auto-paired R side for the stereo Drums mix above:
    // (We don't seed it here — addMix/setFormat will create it dynamically. Keep mono examples below.)
    { id: uid(), recipient: "Bass",     type: "Wedge", format: "Mono",   notes: "Mostly me, kick, vox" },
    { id: uid(), recipient: "Lead Vox", type: "IEM",   format: "Stereo", notes: "Vox + acoustic + light click" },
  ]);
  const addMix = () => setMixes(m => [...m, { id: uid(), recipient: "", type: "Wedge", format: "Mono", notes: "" }]);

  // -------- Stage Plot --------
  const [plotItems, setPlotItems] = useState([]);
  const [plotDragLib, setPlotDragLib] = useState(null);
  const [plotSize, setPlotSize] = useState({ w: 40, d: 25, color: "blue" });
  // Saved custom groups (per-rider). Each entry: { id, label, pieces: [...] }.
  // The pieces array mirrors the kit-drop schema (offsets relative to drop center).
  // Populated by "Save as Group" in the multi-select inspector; rendered in the
  // library under a "Saved Groups" category; drops as a kit (shared groupId).
  const [customGroups, setCustomGroups] = useState([]);
  // Selection state: an array so we can support multi-select via marquee.
  // Single-click sets it to a single-item array. Empty array = nothing selected.
  // Convenience: selectedPlotId mirrors the first item of the array (legacy single-id
  // shape) so any single-select callers (keyboard nudge, scroll, etc.) keep working.
  const [selectedPlotIds, setSelectedPlotIds] = useState([]);
  const selectedPlotId = selectedPlotIds[0] || null;
  // Setter shim for legacy callers expecting a single-id setter (passes through to array).
  const setSelectedPlotId = (id) => setSelectedPlotIds(id ? [id] : []);
  const previewPaneRef = useRef(null);

  // -------- Stage Plot undo/redo --------
  // Snapshot-based history of plotItems. We don't track every keystroke; instead a
  // 500ms debounce coalesces rapid edits (typing in Notes/Label/Channel) into one
  // history entry. Drags use a separate commit on mouse-up so the move records as
  // one entry rather than dozens of intermediate positions.
  // - past: stack of older plotItems states (most recent at end)
  // - future: stack of states ahead of "now" (pushed when undoing)
  const HISTORY_LIMIT = 50;
  const HISTORY_DEBOUNCE_MS = 500;
  const [plotPast, setPlotPast] = useState([]);
  const [plotFuture, setPlotFuture] = useState([]);
  // Ref for the debounced "commit before next change" pattern. We hold the pre-edit
  // snapshot here while edits are coming in; once HISTORY_DEBOUNCE_MS of quiet
  // passes, we push the snapshot to past and clear it.
  const plotHistoryRef = useRef({ pendingSnapshot: null, debounceTimer: null, suspended: 0 });

  // Imperative API the Stage Plot components call when they want to commit a
  // history entry NOW (e.g. mouse-up after a drag, or a discrete action like
  // delete/layer-change). For continuous edits (typing) we don't call this — the
  // useEffect below catches drift and debounces.
  const commitPlotHistory = (prevSnapshot) => {
    if (plotHistoryRef.current.suspended > 0) return;
    setPlotPast(p => {
      const next = [...p, prevSnapshot];
      return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
    });
    setPlotFuture([]);
  };

  // Track plotItems drift and push debounced snapshots for "soft" mutations
  // (anything that didn't call commitPlotHistory directly — typically inspector
  // text edits). The ref's pendingSnapshot is set the first time a change is
  // observed during a debounce window; on quiet, it commits.
  const lastPlotItemsRef = useRef(plotItems);
  useEffect(() => {
    if (plotHistoryRef.current.suspended > 0) {
      // Suspended during undo/redo — refresh the "previous" baseline silently.
      lastPlotItemsRef.current = plotItems;
      return;
    }
    if (lastPlotItemsRef.current === plotItems) return;
    if (plotHistoryRef.current.pendingSnapshot == null) {
      plotHistoryRef.current.pendingSnapshot = lastPlotItemsRef.current;
    }
    lastPlotItemsRef.current = plotItems;
    if (plotHistoryRef.current.debounceTimer) clearTimeout(plotHistoryRef.current.debounceTimer);
    plotHistoryRef.current.debounceTimer = setTimeout(() => {
      const snap = plotHistoryRef.current.pendingSnapshot;
      plotHistoryRef.current.pendingSnapshot = null;
      plotHistoryRef.current.debounceTimer = null;
      if (snap != null) commitPlotHistory(snap);
    }, HISTORY_DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotItems]);

  const undoPlot = () => {
    setPlotPast(p => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      const current = lastPlotItemsRef.current;
      plotHistoryRef.current.suspended += 1;
      setPlotFuture(f => [...f, current]);
      setPlotItems(prev);
      // Drop the suspension flag in the next tick so the change-tracking effect
      // doesn't push the undo itself onto history.
      setTimeout(() => { plotHistoryRef.current.suspended = Math.max(0, plotHistoryRef.current.suspended - 1); }, 0);
      return p.slice(0, -1);
    });
  };
  const redoPlot = () => {
    setPlotFuture(f => {
      if (f.length === 0) return f;
      const next = f[f.length - 1];
      const current = lastPlotItemsRef.current;
      plotHistoryRef.current.suspended += 1;
      setPlotPast(p => [...p, current]);
      setPlotItems(next);
      setTimeout(() => { plotHistoryRef.current.suspended = Math.max(0, plotHistoryRef.current.suspended - 1); }, 0);
      return f.slice(0, -1);
    });
  };
  // Keyboard shortcuts — Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo, Cmd/Ctrl+Y redo.
  // Active only on the Stage Plot Builder; skipped when typing in editable elements.
  useEffect(() => {
    if (!showPlot) return;
    const isEditable = (el) => {
      if (!el) return false;
      const tag = (el.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    };
    const onKey = (e) => {
      if (isEditable(document.activeElement)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) { e.preventDefault(); undoPlot(); }
      else if ((key === "z" && e.shiftKey) || key === "y") { e.preventDefault(); redoPlot(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPlot]);

  // Save status: "idle" | "dirty" | "saving" | "saved"
  // - dirty: user has made changes that haven't been persisted yet
  // - saving: a save is in flight
  // - saved: just persisted; reverts to idle after a short delay
  const [saveStatus, setSaveStatus] = useState("idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // Feature 1: Save current project state to localStorage (via setProjects).
  // This is the imperative form — call it from the Save button or before navigation.
  const saveCurrentProject = useMemo(() => {
    return () => {
      if (!currentProjectId) return;
      setSaveStatus("saving");
      setProjects(ps => ps.map(p => {
        if (p.id !== currentProjectId) return p;
        return {
          ...p,
          state: {
            general, crew, paMain, paSubs, paSpecs, paCoverage, paConfig,
            foh, mon, iemRows, wedgeRows, sideFillRows, subFillRows,
            backlineItems, auxRows, inputs, mixes, sectionNotes,
            plotItems, plotSize, customLibs, customGroups,
          },
          updatedAt: new Date().toISOString(),
        };
      }));
      setLastSavedAt(new Date());
      // Brief "saved" pulse, then back to idle
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(prev => prev === "saved" ? "idle" : prev), 1500);
    };
  }, [currentProjectId, general, crew, paMain, paSubs, paSpecs, paCoverage, paConfig, foh, mon, iemRows, wedgeRows, sideFillRows, subFillRows, backlineItems, auxRows, inputs, mixes, sectionNotes, plotItems, plotSize, customLibs, customGroups]);

  // Paid feature: export the stage plot as a high-res PNG. Finds the live
  // StagePlotPreview SVG that's already rendered in the rider preview pane,
  // clones it, swaps every icon <image href="/icons/foo.png"> for an inline
  // data URL (so the cloned SVG is fully self-contained and survives being
  // loaded into an <img> without canvas-tainting issues), serializes, draws
  // to a 4x-resolution canvas, and triggers a PNG download. The whole flow
  // is async because each icon fetch is one network round trip.
  const exportStagePlotPNG = async () => {
    if (isFree) { showUpgrade("Stage Plot PNG Export"); return; }
    const svg = document.querySelector(".rider-preview-doc svg.stage-plot-preview");
    if (!svg) { window.alert("Couldn't find the stage plot to export. Make sure it has at least one item."); return; }
    try {
      const clone = svg.cloneNode(true);
      // Inline every icon image as a data URL — keeps the cloned SVG fully
      // self-contained when loaded into an HTMLImageElement via blob URL,
      // and avoids canvas tainting on export.
      const imageEls = [...clone.querySelectorAll("image")];
      await Promise.all(imageEls.map(async (img) => {
        let href = img.getAttribute("href") || img.getAttribute("xlink:href");
        if (!href) return;
        // Resolve relative URLs against the current origin so fetch() can hit them.
        if (href.startsWith("/")) href = window.location.origin + href;
        try {
          const res = await fetch(href);
          const blob = await res.blob();
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          img.setAttribute("href", dataUrl);
          img.removeAttribute("xlink:href");
        } catch (_) { /* leave the href; export may still complete with missing icons */ }
      }));
      // Bone background to match the rider doc surface.
      const svgString = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);
      const vb = (clone.getAttribute("viewBox") || "0 0 1200 800").split(/\s+/).map(parseFloat);
      const vbW = vb[2] || 1200, vbH = vb[3] || 800;
      const SCALE = 4;
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(vbW * SCALE);
            canvas.height = Math.round(vbH * SCALE);
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#F4F1EA"; // Bone
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(svgUrl);
            canvas.toBlob(b => {
              if (!b) { reject(new Error("toBlob failed")); return; }
              const url = URL.createObjectURL(b);
              const a = document.createElement("a");
              const safe = (general.artist || "stage-plot").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "stage-plot";
              a.href = url;
              a.download = `${safe}-stage-plot.png`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(url), 1500);
              resolve();
            }, "image/png");
          } catch (e) { reject(e); }
        };
        img.onerror = () => { URL.revokeObjectURL(svgUrl); reject(new Error("SVG image load failed")); };
        img.src = svgUrl;
      });
    } catch (e) {
      window.alert("PNG export failed. See console for details.");
      console.error(e);
    }
  };

  // Mark the project as "dirty" whenever any tracked state changes
  useEffect(() => {
    if (!currentProjectId) return;
    setSaveStatus(prev => prev === "saved" ? "dirty" : "dirty");
  }, [general, crew, paMain, paSubs, paSpecs, paCoverage, paConfig, foh, mon, iemRows, wedgeRows, sideFillRows, subFillRows, backlineItems, auxRows, inputs, mixes, sectionNotes, plotItems, plotSize, customLibs, customGroups, currentProjectId]);

  // Auto-save on state changes (debounced)
  useEffect(() => {
    const timer = setTimeout(saveCurrentProject, 500);
    return () => clearTimeout(timer);
  }, [saveCurrentProject]);

  // Flush save on window unload (tab close, navigation away)
  useEffect(() => {
    const handler = () => saveCurrentProject();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveCurrentProject]);

  // Feature 3: Auto-scroll preview pane to active section.
  // Adds 30px of breathing room above the section header so it doesn't sit
  // flush against the top of the preview pane viewport.
  useEffect(() => {
    if (!previewPaneRef.current) return;
    const targetId = showPlot ? "stage-plot-section" : activeSection;
    // Find the visible target — exclude the hidden sizer copies.
    const all = previewPaneRef.current.querySelectorAll(`[data-section-id="${targetId}"]`);
    const targetEl = Array.from(all).find(el => !el.closest("[aria-hidden='true']")) || all[0];
    if (targetEl) {
      setTimeout(() => {
        const SCROLL_OFFSET = 30;
        const pane = previewPaneRef.current;
        const targetTop = targetEl.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
        pane.scrollTo({ top: Math.max(0, targetTop - SCROLL_OFFSET), behavior: "smooth" });
      }, 50);
    }
  }, [activeSection, showPlot]);

  // Keyboard arrow nudge for the selected stage plot item.
  // - Active only in the Stage Plot Builder (showPlot true)
  // - Skipped when focus is in an editable element (input/textarea/select/contentEditable)
  // - Step: 1ft default, 0.5ft with Shift held
  // - Snap respected: if the selected item has snap !== false, the post-nudge
  //   position is rounded to whole feet (so even a 0.5ft Shift press lands cleanly
  //   against the grid when snap is on)
  // - Bounded by stage size
  useEffect(() => {
    if (!showPlot || !selectedPlotId) return;
    const isEditable = (el) => {
      if (!el) return false;
      const tag = (el.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    };
    const onKey = (e) => {
      if (isEditable(document.activeElement)) return;
      const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
      const dy = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
      if (dx === 0 && dy === 0) return;
      e.preventDefault();
      // Shift = fine nudge (0.5 ft = one snap step). Plain arrow = 1 ft.
      const step = e.shiftKey ? 0.5 : 1;
      setPlotItems(prev => prev.map(it => {
        if (it.id !== selectedPlotId) return it;
        const snap = it.snap !== false;
        let nx = it.x + dx * step;
        let ny = it.y + dy * step;
        // Half-foot snap, centered: the item's center lands on the grid.
        if (snap) { nx = snapCenter(nx, it.w); ny = snapCenter(ny, it.h); }
        nx = Math.max(0, Math.min(plotSize.w - it.w, nx));
        ny = Math.max(0, Math.min(plotSize.d - it.h, ny));
        return { ...it, x: nx, y: ny };
      }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPlot, selectedPlotId, plotSize.w, plotSize.d]);

  // Backspace / Delete — removes the currently selected stage plot item(s)
  // without needing to hit the Inspector's Delete button. Same guard rules
  // as the arrow nudge: only active in the Stage Plot Builder, skipped when
  // focus is in a text input / textarea / select / contentEditable element
  // (so backspacing inside the Channel # or Notes field doesn't nuke the
  // item underneath).
  useEffect(() => {
    if (!showPlot) return;
    const hasSelection = !!selectedPlotId || (selectedPlotIds && selectedPlotIds.length > 0);
    if (!hasSelection) return;
    const isEditable = (el) => {
      if (!el) return false;
      const tag = (el.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    };
    const onKey = (e) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      if (isEditable(document.activeElement)) return;
      e.preventDefault();
      const ids = (selectedPlotIds && selectedPlotIds.length > 0)
        ? new Set(selectedPlotIds)
        : new Set([selectedPlotId]);
      setPlotItems(prev => prev.filter(it => !ids.has(it.id)));
      setSelectedPlotId(null);
      setSelectedPlotIds([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPlot, selectedPlotId, selectedPlotIds]);

  // Feature 1: Create new rider — gated to 1 project on the free tier. The
  // moment a free user already has a saved rider and tries to make a second,
  // the upgrade modal pops instead of creating it. Unlimited on Pro.
  const createNewRider = () => {
    if (isFree && projects.length >= 1) {
      showUpgrade("More than one rider needs Pro");
      return;
    }
    const newProject = {
      id: uid(),
      name: "Untitled Rider",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      state: {
        general: { artist: "", tour: "", version: "1", date: new Date().toISOString().slice(0,10), notes: "", coverImage: null, stagePlotUpload: null, brandLogo: null, stagePlotSource: "live" },
        crew: [{ id: uid(), role: "", name: "", phone: "", email: "" }],
        paMain: makeDefaultRows(),
        paSubs: makeDefaultRows(),
        paSpecs: { splTarget: "", splWeighting: "dBA", uniformity: "", freqLow: "", freqHigh: "", phaseAligned: false, noiseFree: false, notes: "" },
        paCoverage: { depth: "", width: "", delayZones: "", frontFills: "" },
        paConfig: { type: "", rigging: "", notes: "" },
        foh: makeDefaultRows(),
        mon: makeDefaultRows(),
        iemRows: makeDefaultRows(),
        wedgeRows: makeDefaultRows(),
        sideFillRows: makeDefaultRows(),
        subFillRows: makeDefaultRows(),
        backlineItems: [],
        auxRows: makeDefaultRows(),
        inputs: [],
        mixes: [],
        sectionNotes: {},
        plotItems: [],
        plotSize: { w: 40, d: 25, color: "blue" },
        customLibs: {},
        customGroups: [],
      }
    };
    setProjects(ps => [...ps, newProject]);
    setCurrentProjectId(newProject.id);
    setView("builder");
  };

  // Feature 1: Load existing rider
  const loadProject = (projectId) => {
    setCurrentProjectId(projectId);
    const project = projects.find(p => p.id === projectId);
    if (project && project.state) {
      // Load state
      const s = project.state;
      setGeneral(s.general || general);
      setCrew(s.crew || crew);
      setPaMain(s.paMain || paMain);
      setPaSubs(s.paSubs || paSubs);
      setPaSpecs(s.paSpecs || paSpecs);
      setPaCoverage(s.paCoverage || paCoverage);
      setPaConfig(s.paConfig || paConfig);
      setFoh(s.foh || foh);
      setMon(s.mon || mon);
      setIemRows(s.iemRows || iemRows);
      setWedgeRows(s.wedgeRows || wedgeRows);
      setSideFillRows(s.sideFillRows || sideFillRows);
      setSubFillRows(s.subFillRows || subFillRows);
      setBacklineItems(s.backlineItems || backlineItems);
      setAuxRows(s.auxRows || auxRows);
      setInputs(s.inputs || inputs);
      setMixes(s.mixes || mixes);
      setSectionNotes(s.sectionNotes || sectionNotes);
      // Loading a project resets undo/redo history — undoing into another rider's
      // state would be confusing. Suspend tracking while the load happens so it
      // doesn't push the empty/default state onto history.
      plotHistoryRef.current.suspended += 1;
      setPlotItems(s.plotItems || plotItems);
      setPlotPast([]);
      setPlotFuture([]);
      setTimeout(() => { plotHistoryRef.current.suspended = Math.max(0, plotHistoryRef.current.suspended - 1); }, 0);
      setPlotSize({ w: 40, d: 25, color: "blue", ...(s.plotSize || plotSize) });
      setCustomLibs(s.customLibs || customLibs);
      setCustomGroups(s.customGroups || []);
    }
    setView("builder");
  };

  // Feature 1: Duplicate project — same 1-project ceiling applies on free.
  // Duplicating from a free account would otherwise be a sneaky workaround.
  const duplicateProject = (projectId) => {
    if (isFree && projects.length >= 1) {
      showUpgrade("More than one rider needs Pro");
      return;
    }
    const orig = projects.find(p => p.id === projectId);
    if (!orig) return;
    const dupe = {
      ...orig,
      id: uid(),
      name: (orig.name || "Untitled") + " (copy)",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProjects(ps => [...ps, dupe]);
  };

  // Feature 1: Delete project
  const deleteProject = (projectId) => {
    if (confirm("Delete this rider? This cannot be undone.")) {
      setProjects(ps => ps.filter(p => p.id !== projectId));
      if (currentProjectId === projectId) {
        setCurrentProjectId(null);
        setView("projects");
      }
    }
  };

  // Feature 1: Format relative time
  const relativeTime = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Projects view
  if (view === "projects") {
    return (
      <div style={{
        minHeight: "100vh",
        backgroundColor: BRAND.black,
        color: BRAND.bone,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        {/* Header */}
        <header className="px-8 flex items-center justify-between"
          style={{ height: 64, borderBottom: `1px solid rgba(244,241,234,0.10)` }}>
          <div className="flex items-center gap-3">
            <div style={{
              width: 28, height: 28,
              border: `1px solid ${BRAND.orange}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Archivo', system-ui, sans-serif", fontWeight: 900, fontSize: 12,
              color: BRAND.orange, letterSpacing: "0.05em",
            }}>TR</div>
            <div className="flex flex-col leading-none">
              <Display weight={900} style={{ fontSize: 13, letterSpacing: "0.18em", color: BRAND.bone }}>
                TECHNICAL RIDER
              </Display>
              <Mono style={{ fontSize: 8.5, color: BRAND.orange, marginTop: 3, opacity: 0.85 }}>
                PROJECTS
              </Mono>
            </div>
          </div>
          <Btn variant="primary" onClick={createNewRider}>
            <Plus className="w-3.5 h-3.5"/> New Rider
          </Btn>
        </header>

        {/* Projects Grid */}
        <div className="p-8">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20"
              style={{ color: "rgba(244,241,234,0.55)" }}>
              <StickyNote className="w-12 h-12 mb-4" style={{ opacity: 0.4 }}/>
              <p className="text-lg mb-4">No riders yet</p>
              <Btn variant="primary" onClick={createNewRider}>
                <Plus className="w-3.5 h-3.5"/> Create your first rider
              </Btn>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 16,
            }}>
              {projects.map(proj => (
                <div key={proj.id}
                  style={{
                    backgroundColor: "rgba(244,241,234,0.025)",
                    border: `1px solid rgba(244,241,234,0.10)`,
                    borderRadius: 4,
                    padding: 16,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND.orange; e.currentTarget.style.backgroundColor = "rgba(212,100,30,0.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(244,241,234,0.10)"; e.currentTarget.style.backgroundColor = "rgba(244,241,234,0.025)"; }}>
                  <Display weight={800} style={{ fontSize: 18, color: BRAND.bone, marginBottom: 4 }}>
                    {proj.state?.general?.artist || "Untitled Rider"}
                  </Display>
                  <div style={{ fontSize: 13, color: "rgba(244,241,234,0.7)", marginBottom: 12 }}>
                    {proj.state?.general?.tour || "No tour"}
                  </div>
                  <Mono style={{ fontSize: 9, color: "rgba(244,241,234,0.45)", marginBottom: 14 }}>
                    Last edited {relativeTime(proj.updatedAt)}
                  </Mono>
                  <div className="flex gap-2">
                    <Btn variant="default" className="flex-1" onClick={() => loadProject(proj.id)}>
                      <span style={{ fontSize: 9 }}>OPEN</span>
                    </Btn>
                    <Btn variant="default" onClick={() => duplicateProject(proj.id)} title="Duplicate">
                      <span style={{ fontSize: 9 }}>DUPLICATE</span>
                    </Btn>
                    <Btn variant="default" onClick={() => deleteProject(proj.id)} title="Delete">
                      <Trash2 className="w-3 h-3"/>
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pro nudge — appears below the project list when a free user has
              hit the 1-project ceiling. Just an info row with an upgrade
              CTA; doesn't block any existing UI. Hidden entirely for Pro. */}
          {isFree && projects.length >= 1 && (
            <div className="mt-6"
              style={{
                border: `1px dashed rgba(212,100,30,0.40)`,
                background: "rgba(212,100,30,0.04)",
                borderRadius: 3,
                padding: "12px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 16,
              }}>
              <div>
                <Mono style={{ fontSize: 9, color: BRAND.orange, letterSpacing: "0.18em", fontWeight: 700 }}>
                  AT YOUR FREE LIMIT · 1 OF 1 RIDERS
                </Mono>
                <div style={{ fontSize: 12, color: "rgba(244,241,234,0.70)", marginTop: 4 }}>
                  Pro unlocks unlimited tour projects, clean PDFs with your own branding, multiple stage plots, shareable links, and more.
                </div>
              </div>
              <button onClick={() => showUpgrade("Unlimited Riders")}
                style={{
                  padding: "9px 14px",
                  background: BRAND.orange,
                  color: BRAND.black,
                  border: `1px solid ${BRAND.orange}`,
                  borderRadius: 2,
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
                  fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap",
                }}>
                See Pro
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Builder view (Feature 3: Add back button)
  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: BRAND.black,
      color: BRAND.bone,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* TOP BAR */}
      <header className="px-6 flex items-center justify-between"
        style={{ height: 56, borderBottom: `1px solid rgba(244,241,234,0.10)` }}>
        <div className="flex items-center gap-3">
          <Btn variant="ghost" onClick={() => { saveCurrentProject(); setView("projects"); }}>
            ← Back to Projects
          </Btn>
          <div style={{ width: 1, height: 22, backgroundColor: "rgba(244,241,234,0.18)" }} />
          {showPlot && (
            <Btn variant="blue" onClick={() => setShowPlot(false)}>
              ← Back to Rider
            </Btn>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Subtle wordmark */}
          <div className="flex items-center gap-2.5">
            <div style={{
              width: 28, height: 28,
              border: `1px solid ${BRAND.orange}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Archivo', system-ui, sans-serif", fontWeight: 900, fontSize: 12,
              color: BRAND.orange, letterSpacing: "0.05em",
            }}>TR</div>
            <div className="flex flex-col leading-none">
              <Display weight={900} style={{ fontSize: 13, letterSpacing: "0.18em", color: BRAND.bone }}>
                TECHNICAL RIDER
              </Display>
              <Mono style={{ fontSize: 8.5, color: BRAND.orange, marginTop: 3, opacity: 0.85 }}>
                · Field-Tested Builder ·
              </Mono>
            </div>
          </div>
          <div style={{ width: 1, height: 22, backgroundColor: "rgba(244,241,234,0.18)" }} />
          <div className="flex flex-col leading-tight">
            <span className="text-sm" style={{ color: BRAND.bone }}>{general.artist || "Untitled Artist"}</span>
            <Mono style={{ fontSize: 9, opacity: 0.5 }}>v{general.version} · {general.date}</Mono>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Save status indicator — gives visual feedback that auto-save is working */}
          <div className="flex items-center gap-1.5" style={{ marginRight: 6 }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              backgroundColor:
                saveStatus === "saving" ? BRAND.orange :
                saveStatus === "saved"  ? "#7DCB8E" :
                saveStatus === "dirty"  ? "rgba(244,241,234,0.40)" :
                "rgba(244,241,234,0.20)",
              transition: "background-color 0.2s",
            }}/>
            <Mono style={{ fontSize: 8.5, color: "rgba(244,241,234,0.55)", letterSpacing: "0.16em" }}>
              {saveStatus === "saving" ? "Saving…" :
               saveStatus === "saved"  ? "Saved" :
               saveStatus === "dirty"  ? "Unsaved" :
               "Auto-save"}
            </Mono>
          </div>
          {!showPlot && (
            <Btn variant="blue" onClick={() => setShowPlot(true)}>
              <LayoutGrid className="w-3.5 h-3.5"/> Stage Plot
            </Btn>
          )}
          {/* Stage Plot PNG export — paid feature. Renders the live preview
              SVG to a high-res PNG and downloads it. Useful for emailing
              just the plot to a venue tech without the rider wrapper. */}
          {showPlot && (
            <Btn variant="default" onClick={exportStagePlotPNG}>
              <Upload className="w-3.5 h-3.5" style={{ transform: "rotate(180deg)" }}/> PNG {isFree && <Mono style={{ fontSize: 8, color: BRAND.orange, marginLeft: 4, letterSpacing: "0.16em" }}>PRO</Mono>}
            </Btn>
          )}
          {/* Share & Collaborate — surfaces the backend-dependent Pro features
              (shareable link, team access, version history, cloud sync).
              For free users this is just a paywall hook. For paid users this
              shows a "coming soon" notice because the backend isn't online
              yet; the entry point is in place so the day the backend lights
              up, this button starts working. */}
          <Btn variant="default" onClick={() => {
            if (isFree) { showUpgrade("Share & Collaborate"); return; }
            window.alert(
              "Share & Collaborate features\n\n" +
              "• Shareable links — send a rider to a venue via URL\n" +
              "• Team access — TM + crew on the same rider\n" +
              "• Version history — compare revisions across tours\n" +
              "• Cloud sync — same data on laptop, phone, iPad\n\n" +
              "These activate when the backend launches. Your tier is already set up — no action needed."
            );
          }}>
            <Upload className="w-3.5 h-3.5"/> Share {isFree && <Mono style={{ fontSize: 8, color: BRAND.orange, marginLeft: 4, letterSpacing: "0.16em" }}>PRO</Mono>}
          </Btn>
          <Btn variant="default" onClick={saveCurrentProject}><Save className="w-3.5 h-3.5"/> Save</Btn>
          <Btn variant="primary" onClick={() => {
            // The on-screen rider preview is rendered at the narrow pane width
            // (col-span-3 of a 12-col grid), so all type and layout is sized for
            // that. When we print, the browser would otherwise just rasterize
            // that small layout onto a real 8.5×11 page — making everything
            // look tiny. Fix: measure the actual on-screen page width, compute
            // a zoom factor so it fills 8.5in (816px @ 96dpi), and stash it as
            // a CSS variable that the print stylesheet uses to scale the doc.
            try {
              const doc = document.querySelector(".rider-preview-doc");
              if (doc) {
                const onscreenW = doc.getBoundingClientRect().width;
                const targetPx = 816; // 8.5in at 96dpi
                const zoom = onscreenW > 0 ? (targetPx / onscreenW) : 1;
                document.documentElement.style.setProperty("--rider-print-zoom", String(zoom));
              }
            } catch (e) { /* no-op — fall back to default 1 */ }
            window.print();
          }}>
            <Printer className="w-3.5 h-3.5"/> Print / PDF
          </Btn>
        </div>
      </header>

      {/* WORKSPACE LAYOUT — switches between rider 3-pane and stage plot 2-pane */}
      {showPlot ? (
        <div className="grid grid-cols-12" style={{ height: "calc(100vh - 56px)" }}>
          {/* LEFT PANEL: Library (top, scrollable) + Inspector (bottom) */}
          <aside className="col-span-2"
            style={{ borderRight: "1px solid rgba(244,241,234,0.10)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div className="px-4 pt-4 pb-2" style={{ flexShrink: 0 }}>
              <Mono style={{ fontSize: 9, opacity: 0.45 }}>— Stage Plot —</Mono>
            </div>
            <div className="px-4 pb-3" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <StagePlotLibrary
                inputs={inputs}
                addInput={addInput}
                onDragStart={(it) => setPlotDragLib(it)}
                customGroups={customGroups}
                onDeleteGroup={(gid) => setCustomGroups(prev => prev.filter(g => g.id !== gid))}
              />
            </div>
            {/* Inspector stays visible always; renders muted/disabled when nothing is selected */}
            <div className="px-4 pt-3"
              style={{ borderTop: "1px solid rgba(244,241,234,0.10)", flexShrink: 0, maxHeight: "55%", overflowY: "auto", paddingBottom: 24 }}>
              <StagePlotInspector
                items={plotItems}
                selectedId={selectedPlotId}
                selectedIds={selectedPlotIds}
                setItems={setPlotItems}
                setSelectedId={setSelectedPlotId}
                setSelectedIds={setSelectedPlotIds}
                customGroups={customGroups}
                setCustomGroups={setCustomGroups}
              />
            </div>
          </aside>

          {/* CENTER CANVAS — fills the rest */}
          <main className="col-span-10 overflow-y-auto" style={{ backgroundColor: "rgba(244,241,234,0.015)" }}>
            <div className="max-w-none mx-auto p-7">
              <StagePlotBuilder
                items={plotItems} setItems={setPlotItems}
                size={plotSize} setSize={setPlotSize}
                selectedId={selectedPlotId} setSelectedId={setSelectedPlotId}
                selectedIds={selectedPlotIds} setSelectedIds={setSelectedPlotIds}
                dragLib={plotDragLib} setDragLib={setPlotDragLib}
                onUndo={undoPlot} onRedo={redoPlot}
                canUndo={plotPast.length > 0} canRedo={plotFuture.length > 0}
                historyRef={plotHistoryRef}
                inputs={inputs}
              />
            </div>
          </main>
        </div>
      ) : (
        <div className="grid grid-cols-12" style={{ height: "calc(100vh - 56px)" }}>
          {/* LEFT NAV */}
          <aside className="col-span-2 overflow-y-auto"
            style={{ borderRight: "1px solid rgba(244,241,234,0.10)" }}>
            <div className="px-4 pt-4 pb-2">
              <Mono style={{ fontSize: 9, opacity: 0.45 }}>— Sections —</Mono>
            </div>
            {SECTIONS.map(s => {
              const Icon = s.icon;
              const active = activeSection === s.id && !showPlot;
              return (
                <button key={s.id}
                  onClick={() => { setActiveSection(s.id); setShowPlot(false); }}
                  className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors"
                  style={{
                    borderLeft: `2px solid ${active ? BRAND.orange : "transparent"}`,
                    backgroundColor: active ? "rgba(212,100,30,0.08)" : "transparent",
                    color: active ? BRAND.bone : "rgba(244,241,234,0.7)",
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = "rgba(244,241,234,0.04)"; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}>
                  <Mono style={{ fontSize: 9, opacity: 0.6, color: active ? BRAND.orange : undefined }}>{s.num}</Mono>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ opacity: 0.7 }}/>
                  <span className="text-sm">{s.label}</span>
                </button>
              );
            })}
            <div className="mt-3" style={{ borderTop: "1px solid rgba(244,241,234,0.10)" }}>
              <button onClick={() => setShowPlot(true)}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors"
                style={{
                  borderLeft: `2px solid ${showPlot ? BRAND.blue : "transparent"}`,
                  backgroundColor: showPlot ? "rgba(27,58,92,0.30)" : "transparent",
                  color: showPlot ? BRAND.bone : "rgba(244,241,234,0.7)",
                }}>
                <Mono style={{ fontSize: 9, opacity: 0.6 }}>—</Mono>
                <LayoutGrid className="w-3.5 h-3.5" style={{ opacity: 0.7 }}/>
                <span className="text-sm">Stage Plot Builder</span>
              </button>
              {/* Stage Plot Source — emphasized row beneath Stage Plot Builder.
                  Mirrors the toggle in General Info > Images so the user can change
                  which plot the rider prints from either context. */}
              <StagePlotSourceToggle
                value={general.stagePlotSource || "live"}
                onChange={v => setGeneral(g => ({ ...g, stagePlotSource: v }))}
                variant="row"
              />
            </div>
          </aside>

          {/* CENTER EDITOR */}
          <main className="col-span-7 overflow-y-auto" style={{ backgroundColor: "rgba(244,241,234,0.015)" }}>
            <div className="max-w-5xl mx-auto p-7">
              <SectionEditor
                section={activeSection}
                state={{
                  general, setGeneral, crew, setCrew,
                  paMain, setPaMain, paSubs, setPaSubs,
                  paSpecs, setPaSpecs, paCoverage, setPaCoverage, paConfig, setPaConfig,
                  foh, setFoh, mon, setMon,
                  iemRows, setIemRows, wedgeRows, setWedgeRows,
                  sideFillRows, setSideFillRows, subFillRows, setSubFillRows,
                  backlineItems, setBacklineItems,
                  auxRows, setAuxRows,
                  inputs, addInput, updateInput, removeInput, reorderInputs, loadInputTemplate,
                  mixes, setMixes, addMix,
                  customLibs, addCustom,
                  sectionNotes, setSectionNote,
                }}
              />
            </div>
          </main>

          {/* RIGHT PREVIEW (Bone document surface) — Feature 2 & 3: Pagination + auto-scroll */}
          <aside ref={previewPaneRef} className="rider-preview-pane col-span-3 overflow-y-auto"
            style={{ borderLeft: "1px solid rgba(244,241,234,0.10)", backgroundColor: BRAND.black }}>
            <div className="sticky top-0 z-10 px-4 py-2 flex items-center justify-between"
              style={{ backgroundColor: BRAND.black, borderBottom: "1px solid rgba(244,241,234,0.10)" }}>
              <Mono style={{ fontSize: 9, opacity: 0.55 }}>— Live Document —</Mono>
              <Mono style={{ fontSize: 8, opacity: 0.35 }}>Auto-syncs</Mono>
            </div>
            <div style={{ padding: 12 }}>
              <RiderPreview
                general={general} crew={crew}
                paMain={paMain} paSubs={paSubs}
                paSpecs={paSpecs} paCoverage={paCoverage} paConfig={paConfig}
                foh={foh} mon={mon}
                iemRows={iemRows} wedgeRows={wedgeRows}
                sideFillRows={sideFillRows} subFillRows={subFillRows}
                backlineItems={backlineItems}
                auxRows={auxRows} inputs={inputs} mixes={mixes}
                plotItems={plotItems} plotSize={plotSize}
                sectionNotes={sectionNotes}
              />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

// -------------------- SECTION EDITOR ROUTER --------------------
function SectionEditor({ section, state }) {
  switch (section) {
    case "general":  return <GeneralSection {...state} />;
    case "pa":       return <PASection {...state} />;
    case "consoles": return <ConsolesSection {...state} />;
    case "inputs":   return <InputListSection {...state} />;
    case "monsys":   return <MonSysSection {...state} />;
    case "monmix":   return <MonMixSection {...state} />;
    case "backline": return <BacklineSection {...state} />;
    case "aux":      return <AuxSection {...state} />;
    case "notes":    return <NotesSection {...state} />;
    default: return null;
  }
}

const SectionHeader = ({ num, title, blurb }) => (
  <div className="mb-6 pb-4" style={{ borderBottom: "1px solid rgba(244,241,234,0.10)" }}>
    <div className="flex items-baseline gap-3">
      <Mono style={{ fontSize: 11, color: BRAND.orange, fontWeight: 700 }}>SECTION · {num}</Mono>
      <span style={{ width: 32, height: 1, backgroundColor: BRAND.orange, opacity: 0.6 }}/>
    </div>
    <h1 className="mt-2" style={{
      fontFamily: "'Archivo', system-ui, sans-serif",
      fontWeight: 900, fontSize: 30, lineHeight: 1.05, color: BRAND.bone,
      letterSpacing: "0.12em", textTransform: "uppercase",
    }}>{title}</h1>
    {blurb && <p className="mt-2 text-sm" style={{ color: "rgba(244,241,234,0.55)", maxWidth: 640 }}>{blurb}</p>}
  </div>
);

// -------------------- 1. GENERAL --------------------
function GeneralSection({ general, setGeneral, crew, setCrew }) {
  const fileRef = useRef();
  const plotRef = useRef();
  const logoRef = useRef();
  const { isPaid } = useTier();
  const { show: showUpgrade } = useUpgrade();
  // Image upload: cap raw file size at 5 MB. Auto-resize to max 1200px on the
  // longest side and re-encode as JPEG q=0.85 so localStorage doesn't bloat.
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const MAX_IMAGE_DIM = 1200;
  const handleFile = (e, key) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      const mb = (f.size / 1024 / 1024).toFixed(1);
      window.alert(`Image is ${mb} MB — please upload a file under 5 MB.`);
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target.result;
      // Decode → measure → if it's already small enough, store as-is. Otherwise
      // downscale via canvas and re-encode.
      const img = new Image();
      img.onload = () => {
        const longest = Math.max(img.naturalWidth, img.naturalHeight);
        if (longest <= MAX_IMAGE_DIM) {
          setGeneral(g => ({ ...g, [key]: dataUrl }));
          return;
        }
        const scale = MAX_IMAGE_DIM / longest;
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        // Use JPEG for photos; if PNG transparency needed for logos, the user
        // can keep them small enough not to trigger the rescale path.
        const out = canvas.toDataURL("image/jpeg", 0.85);
        setGeneral(g => ({ ...g, [key]: out }));
      };
      img.onerror = () => {
        // Decode failed — store the raw data URL anyway and let the browser
        // try its best. Better than silently swallowing the upload.
        setGeneral(g => ({ ...g, [key]: dataUrl }));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(f);
  };
  const updateCrew = (id, patch) => setCrew(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));
  const removeCrew = (id) => setCrew(cs => cs.filter(c => c.id !== id));
  const addCrew    = () => setCrew(cs => cs.length >= MAX_CREW ? cs : [...cs, { id: uid(), role: "", name: "", phone: "", email: "" }]);
  const teamAtCap  = crew.length >= MAX_CREW;

  // Subsection completion logic
  const docComplete = !!(general.artist && general.tour && general.version && general.date);
  const imagesComplete = !!(general.coverImage || general.stagePlotUpload);
  const introComplete = !!(general.intro && general.intro.trim());
  const crewComplete = crew.some(c => c.name && (c.phone || c.email));
  const introContComplete = !!(general.introContinued && general.introContinued.trim());

  return (
    <div>
      <SectionHeader num="01" title="General Info" blurb="Artist info, identifying images, the rider intro, the team that travels with the show, and the rider's continued intro." />

      <SectionProgress items={[
        { label: "Artist & Doc", complete: docComplete },
        { label: "Images",       complete: imagesComplete },
        { label: "Intro",        complete: introComplete },
        { label: "Team",         complete: crewComplete },
        { label: "Intro Cont.",  complete: introContComplete },
      ]}/>

      <Card defined complete={docComplete} title="Artist & Document" subtitle="01-A">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Artist / Band</FieldLabel>
            <Input value={general.artist} placeholder="e.g. The Velvet Underground"
              maxLength={80}
              onChange={e => setGeneral(g => ({ ...g, artist: e.target.value.slice(0, 80) }))}/>
          </div>
          <div>
            <FieldLabel>Tour / Project</FieldLabel>
            <Input value={general.tour} placeholder="e.g. Summer Tour 2026"
              maxLength={100}
              onChange={e => setGeneral(g => ({ ...g, tour: e.target.value.slice(0, 100) }))}/>
          </div>
          <div>
            <FieldLabel>Document version</FieldLabel>
            <Input value={general.version}
              maxLength={12}
              onChange={e => setGeneral(g => ({ ...g, version: e.target.value.slice(0, 12) }))}/>
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <Input type="date" value={general.date}
              onChange={e => setGeneral(g => ({ ...g, date: e.target.value }))}/>
          </div>
        </div>
      </Card>

      <div className="mt-4">
        <Card defined complete={imagesComplete} title="Images" subtitle="01-B"
          action={
            <StagePlotSourceToggle
              value={general.stagePlotSource || "live"}
              onChange={v => setGeneral(g => ({ ...g, stagePlotSource: v }))}
              variant="compact"
            />
          }>
          <div className="grid grid-cols-3 gap-3">
            <ImageDropTile label="Cover Image" image={general.coverImage}
              onPick={() => fileRef.current?.click()} onClear={() => setGeneral(g => ({ ...g, coverImage: null }))} />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e, "coverImage")} />
            {/* Brand Logo is paid-only. Free users see a locked tile that
                opens the upgrade modal on click. Paid users use it normally —
                the logo renders as a small mark on every printed page. Kept
                separate from Cover Image so a band can use a stylized cover
                photo without it getting tiled across every page footer. */}
            <PaidImageDropTile
              label="Brand Logo"
              image={general.brandLogo}
              isPaid={isPaid}
              onUpgrade={() => showUpgrade("Custom Branding")}
              subtitle="Small mark on every page · Pro"
              onPick={() => logoRef.current?.click()}
              onClear={() => setGeneral(g => ({ ...g, brandLogo: null }))} />
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e, "brandLogo")} />
            <ImageDropTile label="Stage Plot (PDF/Image upload)" image={general.stagePlotUpload}
              subtitle="Or build one in the Stage Plot Builder"
              onPick={() => plotRef.current?.click()} onClear={() => setGeneral(g => ({ ...g, stagePlotUpload: null }))} />
            <input ref={plotRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e, "stagePlotUpload")} />
          </div>
        </Card>
      </div>

      {/* 01-C Intro — lands on page 2 of the printed rider. Empty by default; Apply Template fills it in. */}
      <div className="mt-4">
        <Card defined complete={introComplete} title="Intro" subtitle="01-C"
          action={
            <button onClick={() => {
              const existing = (general.intro || "").trim();
              if (existing) {
                const ok = window.confirm("Intro already has content. Click OK to REPLACE it with the template, or Cancel to leave it unchanged.");
                if (!ok) return;
              }
              setGeneral(g => ({ ...g, intro: INTRO_TEMPLATE }));
            }}
              className="flex items-center gap-1.5"
              style={{
                padding: "8px 14px",
                backgroundColor: BRAND.orange,
                color: BRAND.black,
                border: `1px solid ${BRAND.orange}`,
                borderRadius: 2,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                fontWeight: 700,
                cursor: "pointer",
              }}
              title="Apply the default intro template">
              <FileText className="w-3 h-3"/> Apply Template
            </button>
          }>
          <Textarea rows={8} value={general.intro || ""}
            placeholder="Type your intro here…"
            maxLength={1200}
            style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13, lineHeight: 1.6 }}
            onChange={e => setGeneral(g => ({ ...g, intro: e.target.value.slice(0, 1200) }))}/>
          <CharCounter count={(general.intro || "").length} max={1200} />
        </Card>
      </div>

      <div className="mt-4">
        <Card defined collapsible defaultOpen={false} complete={crewComplete} title="Team" subtitle="01-D"
          action={
            <div className="flex items-center gap-2">
              <Mono style={{ fontSize: 9, opacity: 0.55 }}>{crew.length} / {MAX_CREW}</Mono>
              <Btn variant={teamAtCap ? "default" : "primary"}
                onClick={(e) => { e.stopPropagation(); if (!teamAtCap) addCrew(); }}
                style={teamAtCap ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                title={teamAtCap ? `Maximum of ${MAX_CREW} team members` : "Add a team member"}>
                <Plus className="w-3 h-3"/> {teamAtCap ? "At cap" : "Add member"}
              </Btn>
            </div>
          }>
          <div>
            <div className="grid grid-cols-12 gap-2 px-2 py-1.5">
              <FieldLabel>Role</FieldLabel><div className="col-span-2"></div>
              <div className="col-span-3"><FieldLabel>Name</FieldLabel></div>
              <div className="col-span-3"><FieldLabel>Phone</FieldLabel></div>
              <div className="col-span-3"><FieldLabel>Email</FieldLabel></div>
            </div>
            <div className="space-y-1.5">
              {crew.map(c => (
                <div key={c.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3"><Input value={c.role}  placeholder="Role" onChange={e => updateCrew(c.id, { role: e.target.value })}/></div>
                  <div className="col-span-3"><Input value={c.name}  placeholder="Name" onChange={e => updateCrew(c.id, { name: e.target.value })}/></div>
                  <div className="col-span-3"><Input value={c.phone} placeholder="Phone" onChange={e => updateCrew(c.id, { phone: e.target.value })}/></div>
                  <div className="col-span-2"><Input value={c.email} placeholder="Email" onChange={e => updateCrew(c.id, { email: e.target.value })}/></div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => removeCrew(c.id)} className="p-1.5"
                      style={{ color: "rgba(244,241,234,0.45)" }}
                      onMouseEnter={e => e.currentTarget.style.color = BRAND.orange}
                      onMouseLeave={e => e.currentTarget.style.color = "rgba(244,241,234,0.45)"}>
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* 01-E Intro (Continued) — sits BELOW Team on the printed rider. Default-collapsed. */}
      <div className="mt-4">
        <Card defined collapsible defaultOpen={false} complete={introContComplete} title="Intro (Continued)" subtitle="01-E"
          action={
            <button onClick={(e) => {
              e.stopPropagation();
              const existing = (general.introContinued || "").trim();
              if (existing) {
                const ok = window.confirm("Intro (Continued) already has content. Click OK to REPLACE it with the template, or Cancel to leave it unchanged.");
                if (!ok) return;
              }
              setGeneral(g => ({ ...g, introContinued: INTRO_CONTINUED_TEMPLATE }));
            }}
              className="flex items-center gap-1.5"
              style={{
                padding: "8px 14px",
                backgroundColor: BRAND.orange,
                color: BRAND.black,
                border: `1px solid ${BRAND.orange}`,
                borderRadius: 2,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                fontWeight: 700,
                cursor: "pointer",
              }}
              title="Apply the default intro-continued template">
              <FileText className="w-3 h-3"/> Apply Template
            </button>
          }>
          <Textarea rows={6} value={general.introContinued || ""}
            placeholder="Type your intro continuation here…"
            maxLength={1200}
            style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13, lineHeight: 1.6 }}
            onChange={e => setGeneral(g => ({ ...g, introContinued: e.target.value.slice(0, 1200) }))}/>
          <CharCounter count={(general.introContinued || "").length} max={1200} />
        </Card>
      </div>
    </div>
  );
}

// Paid-gated variant of ImageDropTile. When `isPaid` is false the tile renders
// with a dimmed appearance and a "PRO" tag, and clicking opens the upgrade
// modal instead of the file picker. When paid, behaves identically to a
// regular ImageDropTile.
function PaidImageDropTile({ label, image, isPaid, onUpgrade, onPick, onClear, subtitle }) {
  if (isPaid) {
    return <ImageDropTile label={label} image={image} onPick={onPick} onClear={onClear} subtitle={subtitle}/>;
  }
  return (
    <div>
      <div className="flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <Mono style={{ fontSize: 8, color: BRAND.orange, letterSpacing: "0.18em", fontWeight: 700 }}>PRO</Mono>
      </div>
      <div onClick={onUpgrade}
        className="relative aspect-video flex items-center justify-center overflow-hidden cursor-pointer transition-colors"
        style={{
          border: "1px dashed rgba(212,100,30,0.30)",
          backgroundColor: "rgba(212,100,30,0.04)",
          borderRadius: 2,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND.orange; e.currentTarget.style.backgroundColor = "rgba(212,100,30,0.10)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(212,100,30,0.30)"; e.currentTarget.style.backgroundColor = "rgba(212,100,30,0.04)"; }}>
        <div className="text-center" style={{ color: "rgba(244,241,234,0.60)" }}>
          <Upload className="w-5 h-5 mx-auto mb-1.5" style={{ opacity: 0.5 }}/>
          <Mono style={{ fontSize: 9, color: BRAND.orange, letterSpacing: "0.14em" }}>Upgrade to unlock</Mono>
          {subtitle && <div className="mt-1 text-[10px]" style={{ opacity: 0.7 }}>{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}

// "Best on desktop" banner — appears when the viewport is phone-width
// (≤ 720px) since the app is desktop-first. iPad in either orientation
// (≥ 768px) is wide enough to skip this. Dismissible per browser via
// localStorage so the user doesn't see it on every navigation.
function MobileBanner() {
  const PHONE_BREAKPOINT = 720;
  const KEY = "trb-mobile-banner-dismissed";
  const [isPhone, setIsPhone] = useState(() => typeof window !== "undefined" && window.innerWidth <= PHONE_BREAKPOINT);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(KEY) === "1"; } catch (_) { return false; }
  });
  useEffect(() => {
    const onResize = () => setIsPhone(window.innerWidth <= PHONE_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  if (!isPhone || dismissed) return null;
  const dismiss = () => {
    try { localStorage.setItem(KEY, "1"); } catch (_) {}
    setDismissed(true);
  };
  return (
    <div role="alert" style={{
      position: "sticky", top: 0, zIndex: 200,
      background: BRAND.orange, color: BRAND.black,
      padding: "8px 12px",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: 12, lineHeight: 1.3,
    }}>
      <span style={{ fontWeight: 600 }}>
        Built for desktop. Some controls may feel cramped on this screen — try iPad or a laptop for the full experience.
      </span>
      <button onClick={dismiss} aria-label="Dismiss"
        style={{
          background: "transparent", border: "1px solid rgba(14,14,14,0.4)",
          padding: "3px 8px", borderRadius: 2, cursor: "pointer",
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: BRAND.black,
          flexShrink: 0,
        }}>
        OK
      </button>
    </div>
  );
}

function ImageDropTile({ label, image, onPick, onClear, subtitle }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div onClick={onPick}
        className="relative aspect-video flex items-center justify-center overflow-hidden cursor-pointer transition-colors"
        style={{
          border: "1px dashed rgba(244,241,234,0.22)",
          backgroundColor: "rgba(244,241,234,0.025)",
          borderRadius: 2,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND.orange; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(244,241,234,0.22)"; }}>
        {image ? (
          <>
            <img src={image} alt={label} className="w-full h-full object-contain"/>
            <button onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="absolute top-2 right-2 p-1"
              style={{ backgroundColor: BRAND.black, border: `1px solid ${BRAND.orange}`, borderRadius: 2 }}>
              <X className="w-3.5 h-3.5" style={{color: BRAND.orange}}/>
            </button>
          </>
        ) : (
          <div className="text-center" style={{ color: "rgba(244,241,234,0.45)" }}>
            <Upload className="w-5 h-5 mx-auto mb-1.5"/>
            <Mono style={{ fontSize: 9 }}>Drop image or click to upload</Mono>
            {subtitle && <div className="mt-1 text-[10px]" style={{ opacity: 0.7 }}>{subtitle}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------- 2. PA --------------------
function PASection({ paMain, setPaMain, paSubs, setPaSubs, paSpecs, setPaSpecs, paCoverage, setPaCoverage, paConfig, setPaConfig, customLibs, addCustom, sectionNotes, setSectionNote }) {
  // Subsection completion
  const hangsComplete = !!(paMain.find(r => r.kind === "preferred")?.item) && !!(paSubs.find(r => r.kind === "preferred")?.item);
  const specsComplete = !!(paSpecs.splTarget && paSpecs.freqLow && paSpecs.freqHigh);
  const coverageComplete = !!(paCoverage.depth && paCoverage.width);
  const configComplete = !!paConfig.type;

  return (
    <div>
      <SectionHeader num="02" title="PA / Sound System" blurb="System hangs, performance specs, coverage and configuration. Define what 'good sound' means before you arrive." />

      <SectionProgress items={[
        { label: "System Hangs", complete: hangsComplete },
        { label: "Specs",        complete: specsComplete },
        { label: "Coverage",     complete: coverageComplete },
        { label: "Config",       complete: configComplete },
      ]}/>

      {/* System hangs — default open */}
      <Card defined collapsible defaultOpen complete={hangsComplete} title="System Hangs" subtitle="02-A">
        <div className="space-y-4">
          <EquipmentTable title="Main PA" library={SEED.pa} customKey="pa" customLibs={customLibs} addCustom={addCustom}
            rows={paMain} setRows={setPaMain}
            extraColumns={[{ key: "qty", label: "Qty / side", placeholder: "e.g. 12" }]} />
          <EquipmentTable title="Subs" library={SEED.pa} customKey="pa" customLibs={customLibs} addCustom={addCustom}
            rows={paSubs} setRows={setPaSubs}
            extraColumns={[{ key: "qty", label: "Qty", placeholder: "e.g. 8" }, { key: "config", label: "Sub array", placeholder: "Cardioid front" }]} />
        </div>
      </Card>

      {/* Performance Specs */}
      <div className="mt-4">
        <Card defined collapsible defaultOpen={false} complete={specsComplete} title="Performance Specifications" subtitle="02-B">
          {/* Level Specs */}
          <div className="mb-5">
            <Mono style={{ fontSize: 10, color: BRAND.orange, fontWeight: 700 }}>Level Specs</Mono>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div>
                <FieldLabel>SPL @ FOH</FieldLabel>
                <Select value={paSpecs.splTarget}
                  onChange={e => setPaSpecs(s => ({ ...s, splTarget: e.target.value }))}>
                  <option value="" style={{backgroundColor: BRAND.black}}>—</option>
                  {Array.from({ length: 31 }, (_, i) => 85 + i).map(n => (
                    <option key={n} value={String(n)} style={{backgroundColor: BRAND.black}}>{n} dB</option>
                  ))}
                </Select>
              </div>
              <div>
                <FieldLabel>Weighting</FieldLabel>
                <Select value={paSpecs.splWeighting} onChange={e => setPaSpecs(s => ({ ...s, splWeighting: e.target.value }))}>
                  {SEED.spaWeighting.map(w => <option key={w} style={{backgroundColor: BRAND.black}}>{w}</option>)}
                </Select>
              </div>
              <div>
                <FieldLabel>Uniformity (± dB)</FieldLabel>
                <Input value={paSpecs.uniformity} placeholder="e.g. ±3 dB across coverage"
                  onChange={e => setPaSpecs(s => ({ ...s, uniformity: e.target.value }))}/>
              </div>
            </div>
          </div>

          {/* Frequency Response */}
          <div className="mb-5 pt-4" style={{ borderTop: "1px solid rgba(244,241,234,0.08)" }}>
            <Mono style={{ fontSize: 10, color: BRAND.orange, fontWeight: 700 }}>Frequency Response</Mono>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <FieldLabel>Low end (≥)</FieldLabel>
                <Input value={paSpecs.freqLow} placeholder="e.g. 40 Hz"
                  onChange={e => setPaSpecs(s => ({ ...s, freqLow: e.target.value }))}/>
              </div>
              <div>
                <FieldLabel>High end (≤)</FieldLabel>
                <Input value={paSpecs.freqHigh} placeholder="e.g. 16 kHz"
                  onChange={e => setPaSpecs(s => ({ ...s, freqHigh: e.target.value }))}/>
              </div>
            </div>
          </div>

          {/* Quality requirements */}
          <div className="pt-4" style={{ borderTop: "1px solid rgba(244,241,234,0.08)" }}>
            <Mono style={{ fontSize: 10, color: BRAND.orange, fontWeight: 700 }}>Quality Requirements</Mono>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <Checkbox checked={paSpecs.phaseAligned}
                onChange={e => setPaSpecs(s => ({ ...s, phaseAligned: e.target.checked }))}
                label="Phase-aligned system"
                sub="All systems must be phase-aligned to avoid cancellations." />
              <Checkbox checked={paSpecs.noiseFree}
                onChange={e => setPaSpecs(s => ({ ...s, noiseFree: e.target.checked }))}
                label="Noise-free system"
                sub="Free of hum, hiss, RF interference, and ground-loop artifacts." />
            </div>
          </div>

          <div className="mt-5 pt-4" style={{ borderTop: "1px solid rgba(244,241,234,0.08)" }}>
            <FieldLabel>Spec notes</FieldLabel>
            <Textarea rows={2} value={paSpecs.notes}
              placeholder="e.g. SMAART tuning required prior to soundcheck. THD &lt; 1% at rated SPL."
              onChange={e => setPaSpecs(s => ({ ...s, notes: e.target.value }))}/>
          </div>
        </Card>
      </div>

      {/* Coverage & Distribution */}
      <div className="mt-4">
        <Card defined collapsible defaultOpen={false} complete={coverageComplete} title="Coverage & Distribution" subtitle="02-C">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Coverage depth (ft)</FieldLabel>
              <Input value={paCoverage.depth} placeholder="e.g. 120 ft"
                onChange={e => setPaCoverage(c => ({ ...c, depth: e.target.value }))}/>
            </div>
            <div>
              <FieldLabel>Coverage width (ft)</FieldLabel>
              <Input value={paCoverage.width} placeholder="e.g. 80 ft"
                onChange={e => setPaCoverage(c => ({ ...c, width: e.target.value }))}/>
            </div>
            <div>
              <FieldLabel>Delay zones</FieldLabel>
              <Input value={paCoverage.delayZones} placeholder="e.g. 1 ring at 90 ft, time-aligned"
                onChange={e => setPaCoverage(c => ({ ...c, delayZones: e.target.value }))}/>
            </div>
            <div>
              <FieldLabel>Front fills</FieldLabel>
              <Input value={paCoverage.frontFills} placeholder="e.g. 6× front fill across stage lip"
                onChange={e => setPaCoverage(c => ({ ...c, frontFills: e.target.value }))}/>
            </div>
          </div>
        </Card>
      </div>

      {/* Configuration */}
      <div className="mt-4">
        <Card defined collapsible defaultOpen={false} complete={configComplete} title="Configuration" subtitle="02-D">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>System type</FieldLabel>
              <Select value={paConfig.type} onChange={e => setPaConfig(c => ({ ...c, type: e.target.value }))}>
                <option value="">—</option>
                {SEED.paConfigs.map(c => <option key={c} style={{backgroundColor: BRAND.black}}>{c}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel>Rigging / position</FieldLabel>
              <Input value={paConfig.rigging} placeholder="e.g. flown @ 28', 1° array splay"
                onChange={e => setPaConfig(c => ({ ...c, rigging: e.target.value }))}/>
            </div>
          </div>
          <div className="mt-3">
            <FieldLabel>Configuration notes</FieldLabel>
            <Textarea rows={2} value={paConfig.notes}
              placeholder="e.g. cardioid sub array required, no ground-stack, motors must be 1-ton min."
              onChange={e => setPaConfig(c => ({ ...c, notes: e.target.value }))}/>
          </div>
        </Card>
      </div>

      <SectionNotes
        subtitle="02-E"
        value={sectionNotes?.pa}
        onChange={v => setSectionNote("pa", v)}
        placeholder="e.g. PA must be tuned and time-aligned by load-in · No DSP processing on the master bus · Subwoofer LFE feed via dedicated sub send…"/>
    </div>
  );
}

// -------------------- 3. CONSOLES --------------------
function ConsolesSection({ foh, setFoh, mon, setMon, customLibs, addCustom, sectionNotes, setSectionNote }) {
  const fohComplete = !!(foh.find(r => r.kind === "preferred")?.item);
  const monComplete = !!(mon.find(r => r.kind === "preferred")?.item);

  return (
    <div>
      <SectionHeader num="03" title="Consoles" blurb="FOH and monitor desk preferences. Software versions or required cards in notes." />
      <SectionProgress items={[
        { label: "Front of House", complete: fohComplete },
        { label: "Monitors",       complete: monComplete },
      ]}/>

      <Tips
        title="Tips for Consoles"
        tips={[
          { label: "Same family", text: "Consoles from the same family often allow sharing show files (when supported) and keep a familiar interface." },
          { label: "Show file sharing", text: "Some families (CL, dLive, SD, X32, Vi) support show file sharing via specific software." },
        ]}
      />

      <div className="space-y-4">
        <Card defined complete={fohComplete} title="Front of House" subtitle="03-A">
          <EquipmentTable title="FOH Console" library={SEED.consoles} customKey="consoles" customLibs={customLibs} addCustom={addCustom}
            rows={foh} setRows={setFoh} />
        </Card>
        <Card defined complete={monComplete} title="Monitor Console" subtitle="03-B">
          <EquipmentTable title="Monitor Desk" library={SEED.consoles} customKey="consoles" customLibs={customLibs} addCustom={addCustom}
            rows={mon} setRows={setMon} />
        </Card>
      </div>

      <SectionNotes
        subtitle="03-C"
        value={sectionNotes?.consoles}
        onChange={v => setSectionNote("consoles", v)}
        placeholder="e.g. FOH must run software v5.2+ · Waves SoundGrid card required · Both desks networked for shared multi-track recording · No analog desks accepted…"/>
    </div>
  );
}

// -------------------- 4. INPUT LIST --------------------
const MAX_CHANNELS = 48;

function InputListSection({ inputs, addInput, updateInput, removeInput, reorderInputs, loadInputTemplate, customLibs, addCustom, sectionNotes, setSectionNote }) {
  // Derived channel numbers — stereo rows claim two slots, so the display
  // channel for each row depends on what came before it. Use channelMap[idx]
  // rather than idx+1 for any user-facing channel number.
  const channelMap = computeChannelMap(inputs);

  // Smart-replace check: if any existing row has user content (a source, mic,
  // notes, etc.), confirm before clobbering it; otherwise replace silently.
  const handleLoadTemplate = () => {
    const hasUserData = inputs.some(i => (i.source || i.mic || i.notes || i.stand));
    if (hasUserData) {
      const ok = window.confirm(
        `Replace the current ${inputs.length} channel${inputs.length === 1 ? "" : "s"} with the 16-channel band template? This can't be undone.`
      );
      if (!ok) return;
    }
    if (loadInputTemplate) loadInputTemplate();
  };
  // Drag-to-reorder state. dragFromIdx = the row currently being dragged.
  // dropTargetIdx = the insertion gap the user is hovering over (0..inputs.length).
  // Cleared on dragend / drop.
  const [dragFromIdx, setDragFromIdx] = React.useState(null);
  const [dropTargetIdx, setDropTargetIdx] = React.useState(null);
  const channelsComplete = inputs.some(i => i.source && i.mic);
  const atLimit = inputs.length >= MAX_CHANNELS;
  const fileInputRef = useRef(null);

  // CSV export
  const exportCSV = () => {
    const header = ["Ch", "Source", "Mic / DI", "Stand", "+48V", "Stereo", "Notes"];
    const rows = inputs.map((i, idx) => [
      channelMap[idx]?.label ?? (idx + 1),
      i.source || "",
      i.mic || "",
      i.stand || "",
      i.phantom ? "Y" : "N",
      i.stereo ? "Y" : "N",
      i.notes || "",
    ]);
    const escape = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [header, ...rows].map(r => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `input-list-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV import — replaces current input list
  const importCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      // Naive CSV parse — handles quoted fields with commas
      const parseRow = (line) => {
        const out = []; let cur = ""; let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (inQ) {
            if (c === '"' && line[i+1] === '"') { cur += '"'; i++; }
            else if (c === '"') { inQ = false; }
            else cur += c;
          } else {
            if (c === '"') inQ = true;
            else if (c === ",") { out.push(cur); cur = ""; }
            else cur += c;
          }
        }
        out.push(cur);
        return out;
      };
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 1) return;
      // Detect header row (looks for non-numeric first cell)
      const firstRow = parseRow(lines[0]);
      const hasHeader = isNaN(parseInt(firstRow[0]));
      const dataLines = hasHeader ? lines.slice(1) : lines;
      const parsed = dataLines.slice(0, MAX_CHANNELS).map(line => {
        const cols = parseRow(line);
        return {
          id: uid(),
          ch: 0, // ignored — auto-numbered by row order
          source: (cols[1] || "").trim(),
          mic:    (cols[2] || "").trim(),
          stand:  (cols[3] || "").trim(),
          phantom: /^(y|yes|true|1|✓)$/i.test((cols[4] || "").trim()),
          notes:  (cols[5] || "").trim(),
        };
      });
      // Ask main app to swap inputs — handled via a custom event for now
      window.dispatchEvent(new CustomEvent("rider-replace-inputs", { detail: parsed }));
    };
    reader.readAsText(file);
    e.target.value = ""; // allow re-import of same file
  };

  return (
    <div>
      <SectionHeader num="06" title="Input List" blurb="Channel-by-channel sources, up to 48 channels. Synced bidirectionally with the Stage Plot." />
      <SectionProgress items={[
        { label: "Channels Defined", complete: channelsComplete },
      ]}/>

      <Tips
        title="How to Configure Inputs"
        tips={[
          { label: "Source",         text: "What is connected — example, vocal, guitar, keyboard." },
          { label: "Microphone / DI", text: "Specific equipment used." },
          { label: "Stand",          text: "Type of support, if applicable." },
          { label: "+48V",           text: "Phantom power supply, if applicable." },
        ]}
      />

      <Card defined complete={channelsComplete} title="Channels" subtitle="06-A"
        action={
          <div className="flex items-center gap-2">
            <Btn variant="default" onClick={handleLoadTemplate}>
              <LayoutGrid className="w-3 h-3"/> Load Template
            </Btn>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importCSV}/>
            <Btn variant="default" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3 h-3"/> Import CSV
            </Btn>
            <Btn variant="default" onClick={exportCSV}>
              <FileText className="w-3 h-3"/> Export CSV
            </Btn>
            <Mono style={{ fontSize: 9, opacity: 0.55, marginLeft: 4 }}>
              {inputs.length} / {MAX_CHANNELS}
            </Mono>
          </div>
        }>
        <div className="grid gap-2 px-2 py-1.5"
          style={{ gridTemplateColumns: "52px 1.3fr 1.5fr 1fr 50px 50px 1.3fr 28px" }}>
          <FieldLabel>Ch</FieldLabel>
          <FieldLabel>Source</FieldLabel>
          <FieldLabel>Mic / DI</FieldLabel>
          <FieldLabel>Stand</FieldLabel>
          <FieldLabel>+48V</FieldLabel>
          <FieldLabel>Stereo</FieldLabel>
          <FieldLabel>Notes</FieldLabel>
          <div></div>
        </div>
        <div>
          {inputs.map((i, idx) => {
            const isDragging = dragFromIdx === idx;
            const showLineAbove = dropTargetIdx === idx && dragFromIdx !== null && dragFromIdx !== idx && dragFromIdx !== idx - 1;
            return (
            <React.Fragment key={i.id}>
              {/* Insertion line shown above this row when it's the drop target. */}
              <div style={{
                height: showLineAbove ? 3 : 6,
                background: showLineAbove ? BRAND.orange : "transparent",
                transition: "height 80ms ease",
                marginBottom: showLineAbove ? 3 : 0,
              }}/>
              <div
                onDragOver={(e) => {
                  // Decide if the drag is going above or below the midpoint
                  // of this row to set the insertion gap before / after.
                  if (dragFromIdx === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  const rect = e.currentTarget.getBoundingClientRect();
                  const isAbove = e.clientY < rect.top + rect.height / 2;
                  setDropTargetIdx(isAbove ? idx : idx + 1);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFromIdx !== null && dropTargetIdx !== null && reorderInputs) {
                    reorderInputs(dragFromIdx, dropTargetIdx);
                  }
                  setDragFromIdx(null);
                  setDropTargetIdx(null);
                }}
                className="grid gap-2 items-center"
                style={{
                  gridTemplateColumns: "52px 1.3fr 1.5fr 1fr 50px 50px 1.3fr 28px",
                  opacity: isDragging ? 0.35 : 1,
                  transition: "opacity 120ms ease",
                }}>
              {/* Channel # — also the drag handle. Click+hold to reorder rows. */}
              <div
                draggable
                onDragStart={(e) => {
                  setDragFromIdx(idx);
                  setDropTargetIdx(null);
                  e.dataTransfer.effectAllowed = "move";
                  // Some browsers (Firefox) need data set to start the drag.
                  try { e.dataTransfer.setData("text/plain", String(i.id)); } catch (_) {}
                }}
                onDragEnd={() => { setDragFromIdx(null); setDropTargetIdx(null); }}
                className="flex items-center justify-center"
                title="Drag to reorder"
                style={{
                  height: 36,
                  border: `1px solid ${isDragging ? BRAND.orange : "rgba(212,100,30,0.35)"}`,
                  backgroundColor: isDragging ? "rgba(212,100,30,0.20)" : "rgba(212,100,30,0.08)",
                  color: BRAND.orange,
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
                  borderRadius: 2,
                  cursor: "grab",
                  userSelect: "none",
                }}>
                {channelMap[idx]?.label ?? (idx + 1)}
              </div>
              <LibrarySelect value={i.source}
                onChange={v => updateInput(i.id, { source: v })}
                options={SEED.sources} customLibrary={customLibs.sources}
                onAddCustom={v => addCustom("sources", v)}
                placeholder="Source"/>
              <LibrarySelect value={i.mic}
                onChange={v => updateInput(i.id, { mic: v })}
                options={SEED.mics} customLibrary={customLibs.mics}
                onAddCustom={v => addCustom("mics", v)}
                placeholder="Mic / DI"/>
              <Select value={i.stand} onChange={e => updateInput(i.id, { stand: e.target.value })}>
                <option value="">—</option>
                {SEED.monStandTypes.map(s => <option key={s} style={{backgroundColor: BRAND.black}}>{s}</option>)}
              </Select>
              <div className="flex justify-center">
                <Checkbox checked={i.phantom} onChange={e => updateInput(i.id, { phantom: e.target.checked })} label=""/>
              </div>
              {/* Stereo toggle — claiming this row makes it span TWO consecutive
                  channel numbers (e.g. row that would have been Ch 5 becomes
                  Ch 5-6). Channel numbers below renumber automatically because
                  they're derived from computeChannelMap, not stored per row. */}
              <div className="flex justify-center">
                <Checkbox checked={!!i.stereo} onChange={e => updateInput(i.id, { stereo: e.target.checked })} label=""/>
              </div>
              <Input value={i.notes} placeholder="Notes"
                onChange={e => updateInput(i.id, { notes: e.target.value })}/>
              <button onClick={() => removeInput(i.id)} className="p-1.5"
                style={{ color: "rgba(244,241,234,0.45)" }}
                onMouseEnter={e => e.currentTarget.style.color = BRAND.orange}
                onMouseLeave={e => e.currentTarget.style.color = "rgba(244,241,234,0.45)"}>
                <Trash2 className="w-3.5 h-3.5"/>
              </button>
            </div>
            </React.Fragment>
            );
          })}
          {/* Tail drop zone — lets the user drop after the last row. */}
          <div
            onDragOver={(e) => {
              if (dragFromIdx === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDropTargetIdx(inputs.length);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFromIdx !== null && dropTargetIdx !== null && reorderInputs) {
                reorderInputs(dragFromIdx, dropTargetIdx);
              }
              setDragFromIdx(null);
              setDropTargetIdx(null);
            }}
            style={{
              height: dropTargetIdx === inputs.length && dragFromIdx !== null && dragFromIdx !== inputs.length - 1 ? 12 : 8,
              background: dropTargetIdx === inputs.length && dragFromIdx !== null && dragFromIdx !== inputs.length - 1 ? BRAND.orange : "transparent",
              transition: "height 80ms ease",
            }}/>
        </div>

        {/* Add Channel button — centered, below the table */}
        <div className="mt-4 flex justify-center">
          <button onClick={() => addInput()} disabled={atLimit}
            className="flex items-center gap-2 transition-colors"
            style={{
              padding: "10px 22px",
              backgroundColor: atLimit ? "rgba(244,241,234,0.05)" : BRAND.orange,
              color: atLimit ? "rgba(244,241,234,0.4)" : BRAND.black,
              border: `1px solid ${atLimit ? "rgba(244,241,234,0.15)" : BRAND.orange}`,
              borderRadius: 2,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
              fontWeight: 700,
              cursor: atLimit ? "not-allowed" : "pointer",
            }}>
            <Plus className="w-4 h-4"/>
            {atLimit ? `Channel limit reached (${MAX_CHANNELS})` : "Add Channel"}
          </button>
        </div>
      </Card>
      <div className="mt-3 flex items-center gap-2" style={{ color: "rgba(244,241,234,0.55)" }}>
        <Move className="w-3 h-3"/>
        <Mono style={{ fontSize: 9 }}>Channel numbers auto-assign by row order · Reorder rows to renumber · Channels become draggable labels in the Stage Plot Builder · Up to {MAX_CHANNELS} channels</Mono>
      </div>

      <SectionNotes
        subtitle="06-B"
        value={sectionNotes?.inputs}
        onChange={v => setSectionNote("inputs", v)}
        placeholder="e.g. ProTools playback on channels 41-48 · Talkback on private mix bus · Drum mic-up notes…"/>
    </div>
  );
}

// -------------------- 5. MONITOR SYSTEMS --------------------
function MonSysSection({
  iemRows, setIemRows, wedgeRows, setWedgeRows,
  sideFillRows, setSideFillRows, subFillRows, setSubFillRows,
  customLibs, addCustom, sectionNotes, setSectionNote,
}) {
  const iemComplete      = !!(iemRows.find(r => r.kind === "preferred")?.item);
  const wedgeComplete    = !!(wedgeRows.find(r => r.kind === "preferred")?.item);
  const sideFillComplete = !!(sideFillRows.find(r => r.kind === "preferred")?.item);
  const subFillComplete  = !!(subFillRows.find(r => r.kind === "preferred")?.item);

  // Standard column order: Qty, Model (item), Supplier, Notes.
  // For IEMs the Freq band sits between Model and Supplier.
  const standardOrder = ["qty", "item", "supplier", "notes"];
  const iemOrder      = ["qty", "item", "band", "supplier", "notes"];

  return (
    <div>
      <SectionHeader num="04" title="Monitor Systems" blurb="IEMs, floor wedges, side fills, and sub fills supplied for the show." />
      <SectionProgress items={[
        { label: "IEM Systems",  complete: iemComplete },
        { label: "Floor Wedges", complete: wedgeComplete },
        { label: "Side Fills",   complete: sideFillComplete },
        { label: "Sub Fills",    complete: subFillComplete },
      ]}/>

      {/* System Status — live counts pulled from each subsection's preferred row qty */}
      {(() => {
        const systems = [
          { label: "IEM Systems",  rows: iemRows },
          { label: "Floor Wedges", rows: wedgeRows },
          { label: "Side Fills",   rows: sideFillRows },
          { label: "Sub Fills",    rows: subFillRows },
        ].map(s => {
          const pref = s.rows.find(r => r.kind === "preferred");
          const qty = parseInt(pref?.extras?.qty) || 0;
          return { ...s, qty, configured: qty > 0 };
        });
        const configuredCount = systems.filter(s => s.configured).length;

        return (
          <div className="mb-4"
            style={{
              backgroundColor: "rgba(244,241,234,0.025)",
              border: "1px solid rgba(244,241,234,0.10)",
              borderRadius: 2,
            }}>
            {/* Header: configured count */}
            <div className="px-4 py-2.5 flex items-center justify-between"
              style={{ borderBottom: "1px solid rgba(244,241,234,0.10)" }}>
              <Mono style={{ fontSize: 10, color: BRAND.bone, opacity: 0.85, fontWeight: 700 }}>
                — System Status —
              </Mono>
              <div className="flex items-center gap-1.5">
                <span style={{
                  fontFamily: "'Archivo', system-ui, sans-serif",
                  fontWeight: 900, fontSize: 11,
                  color: configuredCount > 0 ? BRAND.orange : "rgba(244,241,234,0.40)",
                  lineHeight: 1,
                }}>
                  {configuredCount}
                </span>
                <Mono style={{ fontSize: 9, color: configuredCount > 0 ? BRAND.bone : "rgba(244,241,234,0.55)" }}>
                  / {systems.length} systems configured
                </Mono>
              </div>
            </div>

            {/* Four highlighted tiles */}
            <div className="grid grid-cols-4 gap-1.5 p-2.5">
              {systems.map(s => (
                <div key={s.label} className="flex items-center justify-between px-2 py-1.5"
                  style={{
                    backgroundColor: s.configured ? "rgba(212,100,30,0.12)" : "rgba(244,241,234,0.04)",
                    border: `1px solid ${s.configured ? "rgba(212,100,30,0.55)" : "rgba(244,241,234,0.12)"}`,
                    borderRadius: 2,
                    minWidth: 0,
                  }}>
                  <Mono style={{
                    fontSize: 8.5,
                    color: s.configured ? BRAND.bone : "rgba(244,241,234,0.55)",
                    fontWeight: s.configured ? 700 : 400,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    paddingRight: 6,
                  }}>{s.label}</Mono>
                  <span style={{
                    fontFamily: "'Archivo', system-ui, sans-serif",
                    fontWeight: 900,
                    fontSize: 11,
                    lineHeight: 1,
                    color: s.configured ? BRAND.orange : "rgba(244,241,234,0.30)",
                    flexShrink: 0,
                  }}>
                    {s.qty || "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="space-y-4">
        <Card defined collapsible defaultOpen complete={iemComplete} title="IEM Systems" subtitle="04-A">
          <EquipmentTable title="In-Ear Monitor System" library={SEED.iems} customKey="iems" customLibs={customLibs} addCustom={addCustom}
            rows={iemRows} setRows={setIemRows}
            extraColumns={[
              { key: "qty",  label: "Qty",       placeholder: "e.g. 6" },
              { key: "band", label: "Freq band", placeholder: "G band" },
            ]}
            columnOrder={iemOrder} />
        </Card>
        <Card defined collapsible defaultOpen={false} complete={wedgeComplete} title="Floor Wedges" subtitle="04-B">
          <EquipmentTable title="Wedges" library={SEED.wedges} customKey="wedges" customLibs={customLibs} addCustom={addCustom}
            rows={wedgeRows} setRows={setWedgeRows}
            extraColumns={[{ key: "qty", label: "Qty", placeholder: "e.g. 4" }]}
            columnOrder={standardOrder} />
        </Card>
        <Card defined collapsible defaultOpen={false} complete={sideFillComplete} title="Side Fills" subtitle="04-C">
          <EquipmentTable title="Side Fill System" library={SEED.wedges} customKey="wedges" customLibs={customLibs} addCustom={addCustom}
            rows={sideFillRows} setRows={setSideFillRows}
            extraColumns={[{ key: "qty", label: "Qty", placeholder: "e.g. 2" }]}
            columnOrder={standardOrder} />
        </Card>
        <Card defined collapsible defaultOpen={false} complete={subFillComplete} title="Sub Fills" subtitle="04-D">
          <EquipmentTable title="Stage Sub Fill" library={SEED.pa} customKey="pa" customLibs={customLibs} addCustom={addCustom}
            rows={subFillRows} setRows={setSubFillRows}
            extraColumns={[{ key: "qty", label: "Qty", placeholder: "e.g. 2" }]}
            columnOrder={standardOrder} />
        </Card>
      </div>

      <SectionNotes
        subtitle="04-E"
        value={sectionNotes?.monsys}
        onChange={v => setSectionNote("monsys", v)}
        placeholder="e.g. All wedges must be coaxial · IEM RF coordination required, no overlap with venue licensed spectrum · Side fills off the deck on stands…"/>
    </div>
  );
}

// -------------------- 6. MONITOR MIXES --------------------
// Returns an array of "display rows" — primary mixes plus synthetic R-side rows
// for stereo entries — each annotated with the calculated console mix number.
function expandMixes(mixes) {
  const rows = [];
  let next = 1;
  for (const m of mixes) {
    rows.push({ ...m, mixNum: next, side: m.format === "Stereo" ? "L" : null, isPrimary: true });
    if (m.format === "Stereo") {
      // Synthetic right-side row, locked, inherits parent fields
      rows.push({
        id: m.id + "-R",
        parentId: m.id,
        mixNum: next + 1,
        side: "R",
        recipient: m.recipient,
        type: m.type,
        format: "Stereo",
        notes: "",
        isPrimary: false,
      });
      next += 2;
    } else {
      next += 1;
    }
  }
  return rows;
}

function MonMixSection({ mixes, setMixes, addMix, sectionNotes, setSectionNote }) {
  const update = (id, patch) => setMixes(m => m.map(x => x.id === id ? { ...x, ...patch } : x));
  const remove = (id) => setMixes(m => m.filter(x => x.id !== id));

  const displayRows = expandMixes(mixes);
  const totalMixes = displayRows.length; // Total console buses consumed
  const mixesComplete = mixes.some(m => m.recipient);

  return (
    <div>
      <SectionHeader num="05" title="Monitor Mixes" blurb="Each mix bus, who's on it, and the console format. Stereo mixes consume two consecutive bus numbers." />
      <SectionProgress items={[
        { label: "Mix Buses Defined", complete: mixesComplete },
      ]}/>
      <Card defined complete={mixesComplete} title="Mix Buses" subtitle="05-A"
        action={
          <Mono style={{ fontSize: 9, opacity: 0.55 }}>
            {mixes.length} mixes · {totalMixes} buses
          </Mono>
        }>
        {/* Header row */}
        <div className="grid gap-2 px-2 py-1.5"
          style={{ gridTemplateColumns: "70px 1.3fr 1fr 1fr 1.6fr 28px" }}>
          <FieldLabel>Mix #</FieldLabel>
          <FieldLabel>Recipient</FieldLabel>
          <FieldLabel>Type</FieldLabel>
          <FieldLabel>Format</FieldLabel>
          <FieldLabel>Notes</FieldLabel>
          <div></div>
        </div>

        {/* Rows: primary + synthetic R-side pairs */}
        <div className="space-y-1.5">
          {displayRows.map((row) => {
            const isLocked = !row.isPrimary;
            return (
              <div key={row.id} className="grid gap-2 items-center"
                style={{
                  gridTemplateColumns: "70px 1.3fr 1fr 1fr 1.6fr 28px",
                  // R-side rows recede with a faint warm-gray rail — L rows look like mono rows
                  ...(isLocked ? {
                    backgroundColor: "rgba(244,241,234,0.04)",
                    borderLeft: "2px solid rgba(244,241,234,0.18)",
                    paddingLeft: 6, marginLeft: -8,
                  } : {}),
                }}>
                {/* Mix # — L row matches mono (full orange); R row is gray */}
                <div className="flex items-center justify-center"
                  style={{
                    height: 36,
                    border: `1px solid ${isLocked ? "rgba(244,241,234,0.18)" : "rgba(212,100,30,0.35)"}`,
                    backgroundColor: isLocked ? "rgba(244,241,234,0.05)" : "rgba(212,100,30,0.08)",
                    color: isLocked ? "rgba(244,241,234,0.55)" : BRAND.orange,
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
                    borderRadius: 2,
                  }}>
                  {row.mixNum}{row.side ? ` ${row.side}` : ""}
                </div>

                {/* Recipient */}
                {isLocked ? (
                  <div className="flex items-center px-2.5 text-sm" style={{
                    height: 36,
                    backgroundColor: "rgba(244,241,234,0.025)",
                    border: "1px dashed rgba(244,241,234,0.12)",
                    color: "rgba(244,241,234,0.55)",
                    fontStyle: "italic",
                    borderRadius: 2,
                  }}>{row.recipient || "—"} <Mono style={{ fontSize: 8, marginLeft: 6, opacity: 0.55 }}>(R-side)</Mono></div>
                ) : (
                  <Input value={row.recipient} placeholder="e.g. Lead Vox"
                    onChange={e => update(row.id, { recipient: e.target.value })}/>
                )}

                {/* Type */}
                {isLocked ? (
                  <div className="flex items-center px-2.5 text-sm" style={{
                    height: 36, backgroundColor: "rgba(244,241,234,0.025)",
                    border: "1px dashed rgba(244,241,234,0.12)",
                    color: "rgba(244,241,234,0.55)", fontStyle: "italic",
                    borderRadius: 2,
                  }}>{row.type}</div>
                ) : (
                  <Select value={row.type} onChange={e => update(row.id, { type: e.target.value })}>
                    <option style={{backgroundColor: BRAND.black}}>Wedge</option>
                    <option style={{backgroundColor: BRAND.black}}>IEM</option>
                    <option style={{backgroundColor: BRAND.black}}>Side fill</option>
                    <option style={{backgroundColor: BRAND.black}}>Drum sub</option>
                  </Select>
                )}

                {/* Format */}
                {isLocked ? (
                  <div className="flex items-center px-2.5 text-sm" style={{
                    height: 36, backgroundColor: "rgba(244,241,234,0.025)",
                    border: "1px dashed rgba(244,241,234,0.12)",
                    color: "rgba(244,241,234,0.55)", fontStyle: "italic",
                    borderRadius: 2,
                  }}>Stereo</div>
                ) : (
                  <Select value={row.format} onChange={e => update(row.id, { format: e.target.value })}>
                    <option style={{backgroundColor: BRAND.black}}>Mono</option>
                    <option style={{backgroundColor: BRAND.black}}>Stereo</option>
                  </Select>
                )}

                {/* Notes */}
                {isLocked ? (
                  <div className="flex items-center px-2.5" style={{
                    height: 36, backgroundColor: "rgba(244,241,234,0.025)",
                    border: "1px dashed rgba(244,241,234,0.12)",
                    color: "rgba(244,241,234,0.45)",
                    borderRadius: 2,
                  }}>
                    <Mono style={{ fontSize: 9 }}>Auto-paired right side · locked</Mono>
                  </div>
                ) : (
                  <Input value={row.notes} placeholder="e.g. Mostly me, click, kick, bass"
                    onChange={e => update(row.id, { notes: e.target.value })}/>
                )}

                {/* Delete (primary rows only) */}
                <div className="flex items-center justify-end">
                  {row.isPrimary ? (
                    <button onClick={() => remove(row.id)} className="p-1.5"
                      style={{ color: "rgba(244,241,234,0.45)" }}
                      onMouseEnter={e => e.currentTarget.style.color = BRAND.orange}
                      onMouseLeave={e => e.currentTarget.style.color = "rgba(244,241,234,0.45)"}>
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  ) : (
                    <Mono style={{ fontSize: 8, color: "rgba(244,241,234,0.40)" }}>↵</Mono>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Mix button — centered below the table, matches Input List pattern */}
        <div className="mt-4 flex justify-center">
          <button onClick={addMix}
            className="flex items-center gap-2"
            style={{
              padding: "10px 22px",
              backgroundColor: BRAND.orange,
              color: BRAND.black,
              border: `1px solid ${BRAND.orange}`,
              borderRadius: 2,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
              fontWeight: 700,
              cursor: "pointer",
            }}>
            <Plus className="w-4 h-4"/> Add Mix
          </button>
        </div>
      </Card>

      <div className="mt-3 flex items-center gap-2" style={{ color: "rgba(244,241,234,0.55)" }}>
        <Move className="w-3 h-3"/>
        <Mono style={{ fontSize: 9 }}>Set a mix to Stereo and the next mix # auto-pairs as the R side · Numbering reflects the actual buses consumed on the console</Mono>
      </div>

      <SectionNotes
        subtitle="05-B"
        value={sectionNotes?.monmix}
        onChange={v => setSectionNote("monmix", v)}
        placeholder="e.g. All IEM mixes routed to PSM1000 transmitters · Mix bus delays must match FOH timing · Subgroup talkback to Mix 14…"/>
    </div>
  );
}

// -------------------- 7. BACKLINE --------------------
// Flat list of items. Each item picks a category, which drives the brand/model
// dropdowns. Specifications is a wide free-text field for custom details.
function BacklineItemCard({ item, idx, onChange, onRemove }) {
  const cat = SEED.backlineCategories.find(c => c.key === item.category) || SEED.backlineCategories[0];
  const brands = cat.brandKey ? SEED[cat.brandKey] : [];
  const presets = (cat.presetsKey && item.brand) ? (SEED[cat.presetsKey][item.brand] || []) : [];
  const modelOptions = [...presets, "Other"];
  const itemFilled = !!(item.category && (item.brand || item.category === "other"));

  return (
    <div className="relative" style={{
      backgroundColor: itemFilled ? "rgba(212,100,30,0.04)" : "rgba(244,241,234,0.025)",
      border: `1px solid ${itemFilled ? "rgba(212,100,30,0.45)" : "rgba(244,241,234,0.12)"}`,
      borderRadius: 2,
    }}>
      {/* Item header */}
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{
          borderBottom: `1px solid ${itemFilled ? "rgba(212,100,30,0.35)" : "rgba(244,241,234,0.10)"}`,
          backgroundColor: itemFilled ? "rgba(212,100,30,0.08)" : "rgba(244,241,234,0.02)",
        }}>
        <div className="flex items-center gap-2.5">
          <span style={{
            width: 22, height: 22,
            border: `1px solid ${BRAND.orange}`,
            backgroundColor: itemFilled ? BRAND.orange : "transparent",
            color: itemFilled ? BRAND.black : BRAND.orange,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 10, fontWeight: 700, borderRadius: 1,
          }}>{idx + 1}</span>
          <Mono style={{ fontSize: 10, color: BRAND.orange, fontWeight: 700 }}>
            ITEM · {cat.label.toUpperCase()}
          </Mono>
        </div>
        <button onClick={onRemove} className="p-1.5 transition-colors"
          style={{ color: "rgba(244,241,234,0.45)" }}
          onMouseEnter={e => { e.currentTarget.style.color = BRAND.orange; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(244,241,234,0.45)"; }}
          title="Remove item">
          <Trash2 className="w-3.5 h-3.5"/>
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Row 1: Category · Brand · Model · (Cab/Stand) · Supplier */}
        <div className="grid gap-3" style={{
          gridTemplateColumns: cat.hasCab || cat.hasStand
            ? "1fr 1fr 1.2fr 0.9fr 1fr"
            : "1fr 1fr 1.2fr 1fr",
        }}>
          <div>
            <FieldLabel>Category</FieldLabel>
            <Select value={item.category}
              onChange={e => onChange({ category: e.target.value, brand: "", model: "" })}>
              {SEED.backlineCategories.map(c => (
                <option key={c.key} value={c.key} style={{backgroundColor: BRAND.black}}>{c.label}</option>
              ))}
            </Select>
          </div>

          {/* Brand — only for categories with brand library */}
          <div>
            <FieldLabel>Brand</FieldLabel>
            {cat.brandKey ? (
              <Select value={item.brand}
                onChange={e => onChange({ brand: e.target.value, model: "" })}>
                <option value="" style={{backgroundColor: BRAND.black}}>—</option>
                {brands.map(b => (
                  <option key={b} value={b} style={{backgroundColor: BRAND.black}}>{b}</option>
                ))}
              </Select>
            ) : (
              <Input value={item.brand} placeholder="Brand"
                onChange={e => onChange({ brand: e.target.value })}/>
            )}
          </div>

          {/* Preferred Model — populated from brand selection */}
          <div>
            <FieldLabel>
              <span className="inline-flex items-center gap-1">
                <Star className="w-2.5 h-2.5" style={{ color: BRAND.orange, fill: BRAND.orange }}/>
                Preferred Model
              </span>
            </FieldLabel>
            {cat.presetsKey ? (
              <Select value={item.model}
                onChange={e => onChange({ model: e.target.value })}
                disabled={!item.brand}>
                <option value="" style={{backgroundColor: BRAND.black}}>
                  {item.brand ? "—" : "Select brand first"}
                </option>
                {modelOptions.map(m => (
                  <option key={m} value={m} style={{backgroundColor: BRAND.black}}>{m}</option>
                ))}
              </Select>
            ) : (
              <Input value={item.model} placeholder="Model / description"
                onChange={e => onChange({ model: e.target.value })}/>
            )}
          </div>

          {/* Cab — guitar/bass amps only */}
          {cat.hasCab && (
            <div>
              <FieldLabel>Cab</FieldLabel>
              <Input value={item.cab} placeholder="4×12 / 8×10"
                onChange={e => onChange({ cab: e.target.value })}/>
            </div>
          )}

          {/* Stand — keys only */}
          {cat.hasStand && (
            <div>
              <FieldLabel>Stand</FieldLabel>
              <Input value={item.stand} placeholder="Double-tier X"
                onChange={e => onChange({ stand: e.target.value })}/>
            </div>
          )}

          <div>
            <FieldLabel>Supplier</FieldLabel>
            <Select value={item.supplier} onChange={e => onChange({ supplier: e.target.value })}>
              <option value="" style={{backgroundColor: BRAND.black}}>—</option>
              {SEED.suppliers.map(s => <option key={s} style={{backgroundColor: BRAND.black}}>{s}</option>)}
            </Select>
          </div>
        </div>

        {/* Row 2: Specifications — wide textarea, slightly taller */}
        <div>
          <FieldLabel>Specifications</FieldLabel>
          <Textarea rows={3} value={item.specs}
            placeholder={
              cat.key === "drums"
                ? "e.g. 22\" kick, 14×5.5 snare, 12\" rack tom, 16\" floor tom, hi-hat clutch, throne, all hardware…"
                : cat.key === "gtr"
                ? "e.g. footswitch included, no SS rectifier, fresh tubes preferred, 1× 4×12 with V30s…"
                : cat.key === "bass"
                ? "e.g. 1× 8×10 cab, 1/4'' speakon, fresh strings on backline bass if provided…"
                : cat.key === "keys"
                ? "e.g. damper pedal, music stand, dual-tier stand, MIDI to laptop via DIN, OS v3.5+…"
                : "Specs, requirements, accessories, special requests…"
            }
            maxLength={600}
            style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, lineHeight: 1.6 }}
            onChange={e => onChange({ specs: e.target.value.slice(0, 600) })}/>
          <CharCounter count={(item.specs || "").length} max={600} />
        </div>
      </div>
    </div>
  );
}

function BacklineSection({ backlineItems, setBacklineItems, sectionNotes, setSectionNote }) {
  const update = (id, patch) => setBacklineItems(items => items.map(it => it.id === id ? { ...it, ...patch } : it));
  const remove = (id) => setBacklineItems(items => items.filter(it => it.id !== id));
  const addItem = (category = "drums") => setBacklineItems(items => [...items, {
    id: uid(), category, brand: "", model: "", supplier: "", cab: "", stand: "", specs: "",
  }]);

  const itemsComplete = backlineItems.some(it => it.brand || (it.category === "other" && it.model));

  return (
    <div>
      <SectionHeader num="07" title="Backline" blurb="Add each piece of backline you need supplied. Pick a category, brand, and model — then describe the specifics." />
      <SectionProgress items={[
        { label: "Items Defined", complete: itemsComplete },
      ]}/>

      <Card defined complete={itemsComplete} title="Backline Items" subtitle="07-A"
        action={
          <Mono style={{ fontSize: 9, opacity: 0.55 }}>
            {backlineItems.length} item{backlineItems.length !== 1 ? "s" : ""}
          </Mono>
        }>
        <div className="space-y-3">
          {backlineItems.map((item, idx) => (
            <BacklineItemCard key={item.id} item={item} idx={idx}
              onChange={(patch) => update(item.id, patch)}
              onRemove={() => remove(item.id)}/>
          ))}
          {backlineItems.length === 0 && (
            <div className="text-center py-8" style={{ color: "rgba(244,241,234,0.4)" }}>
              <Mono style={{ fontSize: 10 }}>No backline items yet · Click below to add the first one</Mono>
            </div>
          )}
        </div>

        {/* Add Item — centered below list */}
        <div className="mt-4 flex justify-center">
          <button onClick={() => addItem("drums")}
            className="flex items-center gap-2"
            style={{
              padding: "10px 22px",
              backgroundColor: BRAND.orange,
              color: BRAND.black,
              border: `1px solid ${BRAND.orange}`,
              borderRadius: 2,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
              fontWeight: 700, cursor: "pointer",
            }}>
            <Plus className="w-4 h-4"/> Add Item
          </button>
        </div>
      </Card>

      <SectionNotes
        subtitle="07-B"
        value={sectionNotes?.backline}
        onChange={v => setSectionNote("backline", v)}
        placeholder="e.g. All backline must be inspected at load-in by drum tech · Cymbals supplied by artist · Vintage gear on a case-by-case basis…"/>
    </div>
  );
}

// -------------------- 8. AUXILIARY --------------------
function AuxSection({ auxRows, setAuxRows, sectionNotes, setSectionNote }) {
  const update = (id, patch) => setAuxRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  const remove = (id) => setAuxRows(rs => rs.filter(r => r.id !== id));
  const add    = () => setAuxRows(rs => [...rs, { id: uid(), kind: "accepted", item: "", supplier: "", notes: "", extras: { qty: "" } }]);
  const auxComplete = auxRows.some(r => r.item);
  return (
    <div>
      <SectionHeader num="08" title="Auxiliary Equipment" blurb="DIs, sub-snakes, comms, risers, drum shield, music stands, power drops, anything else." />
      <SectionProgress items={[
        { label: "Items Listed", complete: auxComplete },
      ]}/>
      <Card defined complete={auxComplete} title="Items" subtitle="08-A"
        action={<Btn variant="primary" onClick={add}><Plus className="w-3 h-3"/> Add item</Btn>}>
        <div className="grid gap-2 px-2 py-1.5"
          style={{ gridTemplateColumns: "2fr 0.6fr 1fr 1.6fr 28px" }}>
          <FieldLabel>Item</FieldLabel><FieldLabel>Qty</FieldLabel><FieldLabel>Supplier</FieldLabel>
          <FieldLabel>Notes</FieldLabel><div></div>
        </div>
        <div className="space-y-1.5">
          {auxRows.map(r => (
            <div key={r.id} className="grid gap-2 items-center"
              style={{ gridTemplateColumns: "2fr 0.6fr 1fr 1.6fr 28px" }}>
              <Input value={r.item} placeholder="e.g. 4-channel comms, 8'×8'×24'' drum riser"
                onChange={e => update(r.id, { item: e.target.value })}/>
              <Input value={r.extras?.qty || ""} placeholder="Qty"
                onChange={e => update(r.id, { extras: { ...(r.extras||{}), qty: e.target.value } })}/>
              <Select value={r.supplier} onChange={e => update(r.id, { supplier: e.target.value })}>
                <option value="">—</option>
                {SEED.suppliers.map(s => <option key={s} style={{backgroundColor: BRAND.black}}>{s}</option>)}
              </Select>
              <Input value={r.notes} placeholder="Notes" onChange={e => update(r.id, { notes: e.target.value })}/>
              <button onClick={() => remove(r.id)} className="p-1.5"
                style={{ color: "rgba(244,241,234,0.45)" }}>
                <Trash2 className="w-3.5 h-3.5"/>
              </button>
            </div>
          ))}
        </div>
      </Card>

      <SectionNotes
        subtitle="08-B"
        value={sectionNotes?.aux}
        onChange={v => setSectionNote("aux", v)}
        placeholder="e.g. All comms must be wireless · Risers carpeted, no skirts · Drum shield must be 4-panel acrylic, full height · Sub-snake from FOH to stage no longer than 250'…"/>
    </div>
  );
}

// -------------------- 9. NOTES --------------------
// Final Notes recommended categories. Each has trigger keywords that, when
// detected in the notes textarea, light up the corresponding indicator.
const FINAL_NOTES_CATEGORIES = [
  { key: "schedules", label: "Schedules",            keywords: ["schedule", "load in", "load-in", "soundcheck", "show time", "doors"] },
  { key: "power",     label: "Power Requirements",   keywords: ["power", "electrical", "generator", "amperage", "voltage"] },
  { key: "access",    label: "Access Information",   keywords: ["access", "backstage", "loading", "parking", "dock"] },
  { key: "specifics", label: "Specific Requirements",keywords: ["specific", "requirement", "preset", "configuration", "playback", "backing track"] },
];

const FINAL_NOTES_TEMPLATE =
`SCHEDULES:
• Load In: [add a time]
• Soundcheck: [add a time]
• Show: [add a time]

POWER:
• Electrical power requirements for equipment
• Generator backup if necessary

ACCESS:
• Backstage access time
• Loading area for equipment
• Parking for van/bus

SPECIFIC REQUIREMENTS:
• Specific PA configurations
• Console presets
• IEM configurations
• Backing tracks or playbacks
`;

// Final Notes character limits
const NOTES_WARN  = 2000;
const NOTES_MAX   = 5000;

function NotesSection({ general, setGeneral }) {
  const notesText = general.notes || "";
  const notesComplete = !!notesText.trim();
  const charCount = notesText.length;
  const charWarn = charCount >= NOTES_WARN;
  const charMaxed = charCount >= NOTES_MAX;

  // Auto-detect coverage by scanning the notes for each category's keywords
  const lower = notesText.toLowerCase();
  const coverage = FINAL_NOTES_CATEGORIES.map(cat => ({
    ...cat,
    covered: cat.keywords.some(k => lower.includes(k)),
  }));

  const applyTemplate = () => {
    if (notesText.trim()) {
      const choice = window.confirm(
        "Notes already contain content. Click OK to APPEND the template to the end, or Cancel to leave notes unchanged."
      );
      if (!choice) return;
      const merged = ((general.notes || "").trimEnd() + "\n\n" + FINAL_NOTES_TEMPLATE).slice(0, NOTES_MAX);
      setGeneral(g => ({ ...g, notes: merged }));
    } else {
      setGeneral(g => ({ ...g, notes: FINAL_NOTES_TEMPLATE.slice(0, NOTES_MAX) }));
    }
  };

  // Hard-cap input at NOTES_MAX
  const updateNotes = (val) => {
    setGeneral(g => ({ ...g, notes: val.slice(0, NOTES_MAX) }));
  };

  return (
    <div>
      <SectionHeader num="09" title="Final Notes" blurb="Load-in, hospitality, schedules, power, access, and any special requests." />
      <SectionProgress items={[
        { label: "Notes Provided", complete: notesComplete },
      ]}/>

      {/* Tips — sits above the data cards, visually distinct (Bone-hairline, no orange) */}
      <Tips
        title="Tips for Final Notes"
        tips={[
          { label: "Be specific",     text: "Include specific technical detail, brands, or equipment models when relevant." },
          { label: "Priority",        text: "Mention the most critical requirements first, then the secondary ones." },
          { label: "Include context", text: "Explain why certain requirements exist to help the tech team understand." },
        ]}
      />

      {/* Recommended Information panel */}
      <Card defined complete={coverage.every(c => c.covered)} title="Recommended Information" subtitle="09-A">
        <p className="text-sm mb-3" style={{ color: "rgba(244,241,234,0.65)", lineHeight: 1.5 }}>
          Consider adding schedules, power requirements, access information, and specific requirements.
          Indicators below light up automatically as you cover each topic in the notes.
        </p>

        {/* Compact 4-across coverage indicators */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {coverage.map(c => (
            <div key={c.key} className="flex items-center gap-2 px-2.5 py-1.5"
              style={{
                backgroundColor: c.covered ? "rgba(212,100,30,0.10)" : "rgba(244,241,234,0.025)",
                border: `1px solid ${c.covered ? "rgba(212,100,30,0.45)" : "rgba(244,241,234,0.12)"}`,
                borderRadius: 2,
                minWidth: 0,
              }}>
              <span style={{
                width: 12, height: 12, flexShrink: 0,
                border: `1px solid ${c.covered ? BRAND.orange : "rgba(244,241,234,0.30)"}`,
                backgroundColor: c.covered ? BRAND.orange : "transparent",
                borderRadius: 1,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {c.covered && <span style={{ color: BRAND.black, fontSize: 9, lineHeight: 1, fontWeight: 700 }}>✓</span>}
              </span>
              <Mono style={{
                fontSize: 9,
                color: c.covered ? BRAND.bone : "rgba(244,241,234,0.55)",
                fontWeight: c.covered ? 700 : 400,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>{c.label}</Mono>
            </div>
          ))}
        </div>

        {/* Apply template button */}
        <div className="pt-3" style={{ borderTop: "1px solid rgba(244,241,234,0.10)" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Mono style={{ fontSize: 9, color: BRAND.orange, fontWeight: 700 }}>STARTER TEMPLATE</Mono>
              <div className="text-sm mt-0.5" style={{ color: "rgba(244,241,234,0.65)" }}>
                Drop a structured outline into the notes — fill in the placeholders.
              </div>
            </div>
            <button onClick={applyTemplate}
              className="flex items-center gap-2 flex-shrink-0"
              style={{
                padding: "10px 18px",
                backgroundColor: BRAND.orange,
                color: BRAND.black,
                border: `1px solid ${BRAND.orange}`,
                borderRadius: 2,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase",
                fontWeight: 700, cursor: "pointer",
              }}>
              <FileText className="w-3.5 h-3.5"/> Apply Template
            </button>
          </div>
        </div>
      </Card>

      {/* The actual notes textarea + character counter */}
      <div className="mt-4">
        <Card defined complete={notesComplete} title="Free-form Notes" subtitle="09-B">
          <Textarea rows={20} value={notesText}
            placeholder={"• Load-in: 4 hours min, dock-high access required.\n• Power: 200A 3-phase service in stage left wing.\n• Hospitality: hot meal for 8 by soundcheck.\n• …"}
            style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, lineHeight: 1.7 }}
            maxLength={NOTES_MAX}
            onChange={e => updateNotes(e.target.value)}/>

          {/* Character counter */}
          <div className="mt-2 flex items-center justify-between">
            <Mono style={{ fontSize: 9, opacity: 0.45 }}>
              {charMaxed ? "Limit reached" : charWarn ? "Keep it tight — readability matters" : "Concise riders are better-read riders"}
            </Mono>
            <Mono style={{
              fontSize: 9,
              color: charMaxed ? BRAND.orange : charWarn ? BRAND.orange : "rgba(244,241,234,0.55)",
              fontWeight: charWarn ? 700 : 400,
            }}>
              {charCount.toLocaleString()} / {NOTES_MAX.toLocaleString()}
            </Mono>
          </div>
        </Card>
      </div>
    </div>
  );
}

// -------------------- STAGE PLOT BUILDER --------------------
// Library items support optional fields:
//   icon         — path to PNG asset; rendered with mix-blend-mode multiply (currently unused)
//   rotatable    — defaults true; set false to hide the rotation slider in the Inspector
//   displayScale — visual scale multiplier of the icon relative to the footprint (defaults 1)
//   layer        — "floor" | "default" | "top"; defaults "default"
//   snap         — defaults true; per-item snap-to-grid (whole feet)
//   details      — optional array of small visual hints rendered inside the item box.
//                  Coordinates are NORMALIZED to 0..1 (fractions of the item's w/h).
//                  Detail types:
//                    { type:"rect",   x, y, w, h, fill?, stroke?, strokeWidth? }
//                    { type:"line",   x1, y1, x2, y2, stroke?, strokeWidth? }
//                    { type:"circle", cx, cy, r, fill?, stroke?, strokeWidth? }
//                  Default fill is rgba(14,14,14,0.55) (Stage Black hint), stroke none,
//                  rendered as inline SVG so they scale with the item box.
//                  Items without details just render plain shapes — that's totally fine.
//   labelPos     — "center" (default) | "bottom" | "top".
//                  Use "bottom" / "top" when the visual hints occupy the other half so
//                  the label and the hints don't overlap (e.g. keyboard with key-hints
//                  on top → label sits at the bottom).
const PLOT_CATEGORIES = [
  {
    name: "Drum Kits",
    items: [
      // Original kit-cluster (outline-style drum primitives, drops as a group).
      { type: "drumkit", label: "Drum Kit - Outline", isKit: true,
        kit: [
          // ox/oy = offset from the drop center, in ft. Tight cluster — pieces
          // overlap heavily. Layout (audience at bottom, drummer at top).
          { type: "throne", label: "Throne",    w: 1.4, h: 1.4, shape: "circle", ox:  0.0, oy: -2.4 },
          { type: "floor",  label: "Floor Tom", w: 1.6, h: 1.6, shape: "circle", ox: -1.5, oy: -1.5 },
          { type: "hat",    label: "Hi-Hat",    w: 1.2, h: 1.2, shape: "circle", ox:  1.6, oy: -1.5 },
          { type: "tom",    label: "Tom",       w: 1.4, h: 1.4, shape: "circle", ox: -0.5, oy: -0.5 },
          { type: "snare",  label: "Snare",     w: 1.4, h: 1.4, shape: "circle", ox:  0.6, oy: -0.5 },
          { type: "tom",    label: "Tom",       w: 1.4, h: 1.4, shape: "circle", ox:  1.5, oy: -0.4 },
          { type: "cymbal", label: "Cymbal",    w: 1.6, h: 1.6, shape: "circle", ox: -1.7, oy:  0.7, layer: "top" },
          { type: "kick",   label: "Kick",      w: 2.0, h: 2.0, shape: "circle", ox:  0.0, oy:  0.7 },
          { type: "cymbal", label: "Cymbal",    w: 1.6, h: 1.6, shape: "circle", ox:  1.7, oy:  0.8, layer: "top" },
        ] },
      // Icon drum kits — PNG illustrations, footprints derived at 93 px/ft.
      { type: "ic-drumkit-1", label: "Drum Kit 1",          w: 7.5, h: 5, shape: "rect", icon: "/icons/drum_kit_1.png" },
      { type: "ic-drumkit-2", label: "Drum Kit 2",          w: 6.5, h: 6, shape: "rect", icon: "/icons/drum_kit_2.png" },
      { type: "ic-drumkit-3", label: "Drum Kit - Silhouette", w: 6, h: 6, shape: "rect", icon: "/icons/drum_kit_3.png" },
    ],
  },
  {
    name: "Individual Drums",
    items: [
      // Original outline-style drum primitives (single pieces).
      { type: "kick",   label: "Kick - Outline",      w: 2, h: 2,  shape: "circle" },
      { type: "snare",  label: "Snare - Outline",     w: 1.4, h: 1.4, shape: "circle" },
      { type: "hat",    label: "Hi-Hat - Outline",    w: 1.2, h: 1.2, shape: "circle" },
      { type: "tom",    label: "Tom - Outline",       w: 1.4, h: 1.4, shape: "circle" },
      { type: "floor",  label: "Floor Tom - Outline", w: 1.6, h: 1.6, shape: "circle" },
      { type: "cymbal", label: "Cymbal - Outline",    w: 1.6, h: 1.6, shape: "circle", layer: "top" },
      { type: "throne", label: "Throne - Outline",    w: 1.4, h: 1.4, shape: "circle" },
    ],
  },
  {
    name: "Amps & Cabs",
    items: [
      { type: "gtramp",  label: "Guitar Amp - Outline", w: 2.5, h: 2,   shape: "rect" },
      { type: "bassamp", label: "Bass Amp - Outline",   w: 2.8, h: 2.4, shape: "rect" },
      { type: "iso",     label: "Iso Cab - Outline",    w: 2,   h: 2,   shape: "rect" },
      // Original pedal board primitive (outline detail style).
      { type: "pedalboard", label: "Pedal Board - Outline", w: 2.2, h: 1.2, shape: "rect", labelPos: "bottom",
        details: [
          { type: "circle", cx: 0.20, cy: 0.32, r: 0.07, fill: "rgba(14,14,14,0.45)" },
          { type: "circle", cx: 0.50, cy: 0.32, r: 0.07, fill: "rgba(14,14,14,0.45)" },
          { type: "circle", cx: 0.80, cy: 0.32, r: 0.07, fill: "rgba(14,14,14,0.45)" },
        ] },
      { type: "ic-guitar-amp-1", label: "Guitar Amp 1", w: 3,   h: 2.5, shape: "rect", icon: "/icons/guitar_amp_1.png" },
      { type: "ic-guitar-amp-2", label: "Guitar Amp 2", w: 2.5, h: 1.5, shape: "rect", icon: "/icons/guitar_amp_2.png" },
      // Pedal board icon — +25% size, 180° baked in (it almost always faces upstage).
      { type: "ic-pedalboard",   label: "Pedal Board",  w: 2.8, h: 1.5, shape: "rect", rot: 180, icon: "/icons/pedal_board_1.png" },
    ],
  },
  {
    name: "Keys",
    items: [
      // Keyboard with the 17-slat 2-3 black-key cluster across the top half. Label
      // sits in the bottom half so the hints and label don't overlap.
      { type: "keys",    label: "Keyboard - Outline",  w: 4,   h: 1.2, shape: "rect",
        details: [
          // Top-half "black key" hints, normalized to 0..1 of the item box.
          { type: "rect", x: 0.085, y: 0.06, w: 0.019, h: 0.38 },
          { type: "rect", x: 0.123, y: 0.06, w: 0.019, h: 0.38 },
          { type: "rect", x: 0.198, y: 0.06, w: 0.019, h: 0.38 },
          { type: "rect", x: 0.236, y: 0.06, w: 0.019, h: 0.38 },
          { type: "rect", x: 0.274, y: 0.06, w: 0.019, h: 0.38 },
          { type: "rect", x: 0.349, y: 0.06, w: 0.019, h: 0.38 },
          { type: "rect", x: 0.387, y: 0.06, w: 0.019, h: 0.38 },
          { type: "rect", x: 0.462, y: 0.06, w: 0.019, h: 0.38 },
          { type: "rect", x: 0.500, y: 0.06, w: 0.019, h: 0.38 },
          { type: "rect", x: 0.538, y: 0.06, w: 0.019, h: 0.38 },
          { type: "rect", x: 0.613, y: 0.06, w: 0.019, h: 0.38 },
          { type: "rect", x: 0.651, y: 0.06, w: 0.019, h: 0.38 },
          { type: "rect", x: 0.726, y: 0.06, w: 0.019, h: 0.38 },
          { type: "rect", x: 0.764, y: 0.06, w: 0.019, h: 0.38 },
          { type: "rect", x: 0.802, y: 0.06, w: 0.019, h: 0.38 },
          { type: "rect", x: 0.877, y: 0.06, w: 0.019, h: 0.38 },
          { type: "rect", x: 0.915, y: 0.06, w: 0.019, h: 0.38 },
        ],
        labelPos: "bottom" },
      // DJ table primitive (outline detail style).
      { type: "djtable", label: "DJ Table - Outline", w: 5, h: 2, shape: "rect", labelPos: "bottom",
        details: [
          // Left turntable platter (with center spindle dot)
          { type: "circle", cx: 0.18, cy: 0.40, r: 0.30, stroke: "rgba(14,14,14,0.55)", strokeWidth: 1.2, fill: "none" },
          { type: "circle", cx: 0.18, cy: 0.40, r: 0.04, fill: "rgba(14,14,14,0.55)" },
          // Right turntable platter
          { type: "circle", cx: 0.82, cy: 0.40, r: 0.30, stroke: "rgba(14,14,14,0.55)", strokeWidth: 1.2, fill: "none" },
          { type: "circle", cx: 0.82, cy: 0.40, r: 0.04, fill: "rgba(14,14,14,0.55)" },
          // Mixer outline in the middle
          { type: "rect",   x: 0.42, y: 0.18, w: 0.16, h: 0.50, stroke: "rgba(14,14,14,0.40)", strokeWidth: 1, fill: "none" },
        ] },
      // Icon keyboards — +10% over their derived footprint.
      { type: "ic-keyboard-1", label: "Keyboard 1", w: 4.4, h: 1.7, shape: "rect", icon: "/icons/keyboard_1.png" },
      { type: "ic-keyboard-2", label: "Keyboard 2", w: 4.4, h: 1.7, shape: "rect", icon: "/icons/keyboard_2.png" },
      { type: "ic-keyboard-3", label: "Keyboard 3", w: 3.9, h: 1.7, shape: "rect", icon: "/icons/keyboard_3.png" },
      { type: "ic-keyboard-4", label: "Keyboard 4", w: 2.8, h: 2.2, shape: "rect", icon: "/icons/keyboard_4.png" },
    ],
  },
  {
    name: "Stands",
    items: [
      // Original stand primitives (outline style).
      { type: "stand",   label: "Mic Stand - Outline",  w: 0.8, h: 0.8, shape: "diamond" },
      { type: "boomstand", label: "Boom Mic - Outline", w: 1.4, h: 0.8, shape: "rect" },
      { type: "music",   label: "Music Stand - Outline", w: 1.2, h: 1.2, shape: "rect" },
      { type: "stool",   label: "Stool - Outline",      w: 1.2, h: 1.2, shape: "circle" },
      // Icon mic stands.
      { type: "ic-mic-stand-1", label: "Mic Stand - Boom", w: 1.5, h: 2,   shape: "rect", icon: "/icons/mic_stand_1.png" },
      { type: "ic-mic-stand-2", label: "Mic Stand 1",      w: 1.5, h: 1.5, shape: "rect", icon: "/icons/mic_stand_2.png" },
      { type: "ic-mic-stand-3", label: "Mic Stand 2",      w: 1.5, h: 1.5, shape: "rect", icon: "/icons/mic_stand_3.png" },
    ],
  },
  {
    name: "Instruments",
    items: [
      // Icon instruments — laid flat, top-down. Start at 45° (first rotation stop)
      // so they read at a natural played angle the moment they drop.
      { type: "ic-bass",      label: "Bass Guitar 1",     w: 1.5, h: 4, shape: "rect", rot: 45, icon: "/icons/bass_1.png" },
      { type: "ic-eguitar-1", label: "Electric Guitar 1", w: 1.5, h: 4,   shape: "rect", rot: 45, icon: "/icons/electric_guitar_1.png" },
      { type: "ic-eguitar-2", label: "Electric Guitar 2", w: 1.5, h: 4,   shape: "rect", rot: 45, icon: "/icons/electric_guitar_2.png" },
      { type: "ic-eguitar-3", label: "Electric Guitar 3", w: 1.4, h: 4.1, shape: "rect", rot: 45, icon: "/icons/electric_guitar_3.png" },
    ],
  },
  {
    name: "DJ / Playback",
    items: [
      { type: "ic-cdj-1",  label: "DJ Mixer / CDJ 1", w: 4,   h: 2.5, shape: "rect", icon: "/icons/mixer_cdj_1.png" },
      { type: "ic-cdj-2",  label: "DJ Mixer / CDJ 2", w: 4.5, h: 2,   shape: "rect", icon: "/icons/mixer_cdj_2.png" },
      { type: "ic-laptop", label: "Laptop",           w: 2,   h: 1.5, shape: "rect", icon: "/icons/laptop_1.png" },
    ],
  },
  {
    name: "Stage / Risers",
    items: [
      // Original riser primitives (outline style).
      { type: "riser",   label: "Riser 8x8 - Outline", w: 8, h: 8, shape: "rect", layer: "floor" },
      { type: "riser48", label: "Riser 4x8 - Outline", w: 4, h: 8, shape: "rect", layer: "floor" },
      { type: "riser84", label: "Riser 8x4 - Outline", w: 8, h: 4, shape: "rect", layer: "floor" },
      { type: "riser44", label: "Riser 4x4 - Outline", w: 4, h: 4, shape: "rect", layer: "floor" },
      // Icon stage decks — PNG illustrations.
      { type: "ic-deck-4x4-1", label: "Stage Deck 4×4 1", w: 4, h: 4, shape: "rect", layer: "floor", icon: "/icons/stage_deck_4x4_1.png" },
      { type: "ic-deck-4x4-2", label: "Stage Deck 4×4 2", w: 4, h: 4, shape: "rect", layer: "floor", icon: "/icons/stage_deck_4x4_2.png" },
      { type: "ic-deck-4x8-1", label: "Stage Deck 4×8 1", w: 4, h: 8, shape: "rect", layer: "floor", icon: "/icons/stage_deck_8x8_1.png" },
      { type: "ic-deck-4x8-2", label: "Stage Deck 4×8 2", w: 4, h: 8, shape: "rect", layer: "floor", icon: "/icons/stage_deck_8x8_2.png" },
      { type: "ic-stairs",     label: "Stairs",          w: 4, h: 3.5, shape: "rect", layer: "floor", icon: "/icons/stairs_1.png" },
    ],
  },
  {
    name: "Monitors & Speakers",
    items: [
      { type: "wedge",    label: "Floor Wedge - Outline", w: 2,   h: 1.4, shape: "trap" },
      { type: "drumfill", label: "Drum Fill - Outline",   w: 2.4, h: 2.8, shape: "rect" },
      { type: "iem",      label: "IEM Pack - Outline",    w: 1,   h: 0.8, shape: "rect" },
      { type: "sidefill", label: "Side Fill - Outline",   w: 2.4, h: 2.4, shape: "rect" },
      { type: "subfill",  label: "Sub Fill - Outline",    w: 2.4, h: 1.6, shape: "rect" },
      { type: "ic-wedge-1", label: "Floor Wedge 1", w: 3.5, h: 2.5, shape: "rect", icon: "/icons/wedge_1.png" },
      { type: "ic-wedge-2", label: "Floor Wedge 2", w: 3,   h: 2.5, shape: "rect", icon: "/icons/wedge_2.png" },
      { type: "ic-wedge-3", label: "Floor Wedge 3", w: 3.2, h: 2.3, shape: "rect", icon: "/icons/wedge_3.png" },
      { type: "ic-wedge-4", label: "Floor Wedge 4", w: 3.1, h: 1.8, shape: "rect", icon: "/icons/wedge_4.png" },
    ],
  },
  {
    name: "I/O & Power",
    items: [
      { type: "di",     label: "DI Box - Outline",          w: 1,   h: 0.8, shape: "rect" },
      { type: "snake",  label: "Snake / Stage Box - Outline", w: 1.8, h: 1.0, shape: "rect" },
      { type: "power",  label: "Power Drop - Outline",      w: 1.2, h: 1.2, shape: "diamond" },
      { type: "ic-stage-box-1", label: "Stage Box 1", w: 2,   h: 1, shape: "rect", icon: "/icons/stage_box_1.png" },
      { type: "ic-stage-box-2", label: "Stage Box 2", w: 1.5, h: 1, shape: "rect", icon: "/icons/stage_box_2.png" },
      { type: "ic-power-box",   label: "Power Box",   w: 1,   h: 1, shape: "rect", icon: "/icons/power_box_1.png" },
    ],
  },
  {
    name: "Truss & Rigging",
    items: [
      // Truss sticks — 1ft wide, X-bracing every 2ft. Layer: top (overhead).
      // Coords are normalized 0..1 so the X-pattern repeats based on each truss's
      // length (2ft cell = 0.2 of a 10ft truss, 0.25 of an 8ft, 0.4 of a 5ft).
      // 10ft truss: 5 X-cells.
      { type: "truss10", label: "Truss 10ft - Outline", w: 10, h: 1, shape: "rect", layer: "top", labelPos: "bottom",
        details: [
          { type: "line", x1: 0.0,  y1: 0, x2: 0.2,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 0.2,  y1: 0, x2: 0.0,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 0.2,  y1: 0, x2: 0.4,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 0.4,  y1: 0, x2: 0.2,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 0.4,  y1: 0, x2: 0.6,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 0.6,  y1: 0, x2: 0.4,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 0.6,  y1: 0, x2: 0.8,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 0.8,  y1: 0, x2: 0.6,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 0.8,  y1: 0, x2: 1.0,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 1.0,  y1: 0, x2: 0.8,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
        ] },
      // 8ft truss: 4 X-cells (each 2ft = 0.25).
      { type: "truss8", label: "Truss 8ft - Outline", w: 8, h: 1, shape: "rect", layer: "top", labelPos: "bottom",
        details: [
          { type: "line", x1: 0.0,  y1: 0, x2: 0.25, y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 0.25, y1: 0, x2: 0.0,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 0.25, y1: 0, x2: 0.5,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 0.5,  y1: 0, x2: 0.25, y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 0.5,  y1: 0, x2: 0.75, y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 0.75, y1: 0, x2: 0.5,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 0.75, y1: 0, x2: 1.0,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 1.0,  y1: 0, x2: 0.75, y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
        ] },
      // 5ft truss: 2 X-cells + 1 single diagonal at the end. Roughly: cells at
      // 0..0.4 and 0.4..0.8 (each 2ft = 0.4), then a final 1ft segment from 0.8..1.0.
      { type: "truss5", label: "Truss 5ft - Outline", w: 5, h: 1, shape: "rect", layer: "top", labelPos: "bottom",
        details: [
          { type: "line", x1: 0.0,  y1: 0, x2: 0.4,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 0.4,  y1: 0, x2: 0.0,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 0.4,  y1: 0, x2: 0.8,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 0.8,  y1: 0, x2: 0.4,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 0.8,  y1: 0, x2: 1.0,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 1.0,  y1: 0, x2: 0.8,  y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
        ] },
      // Corner block: 1ft × 1ft square with a single X-brace.
      { type: "trussc", label: "Truss Corner - Outline", w: 1, h: 1, shape: "rect", layer: "top",
        details: [
          { type: "line", x1: 0, y1: 0, x2: 1, y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
          { type: "line", x1: 1, y1: 0, x2: 0, y2: 1, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.75 },
        ] },
      { type: "ic-truss", label: "Truss 8ft", w: 8, h: 1.5, shape: "rect", layer: "top", icon: "/icons/truss_1.png" },
    ],
  },
  {
    name: "Lighting",
    items: [
      // PAR can: small round fixture, single inner-ring "lens" hint.
      // Default to top layer (hung from truss).
      { type: "par", label: "PAR Can - Outline", w: 1, h: 1, shape: "circle", layer: "top",
        details: [
          { type: "circle", cx: 0.5, cy: 0.5, r: 0.30, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.2, fill: "none" },
        ] },
      { type: "movinglight", label: "Moving Light - Outline", w: 1.5, h: 1.5, shape: "rect", layer: "top",
        details: [
          { type: "circle", cx: 0.5, cy: 0.5, r: 0.32, stroke: "rgba(14,14,14,0.65)", strokeWidth: 1.4, fill: "none" },
          { type: "circle", cx: 0.5, cy: 0.5, r: 0.10, fill: "rgba(14,14,14,0.55)" },
        ] },
      // Icon lighting fixtures — PNG illustrations, top layer (hung overhead).
      // All except the PAR can are +15% over their derived footprint.
      { type: "ic-light-1", label: "Moving Light 1", w: 1.9, h: 2.9, shape: "rect", layer: "top", icon: "/icons/light_1.png" },
      { type: "ic-light-2", label: "Moving Light 2", w: 2.0, h: 2.9, shape: "rect", layer: "top", icon: "/icons/light_2.png" },
      { type: "ic-light-3", label: "Moving Light 3", w: 1.6, h: 2.9, shape: "rect", layer: "top", icon: "/icons/light_3.png" },
      { type: "ic-light-4", label: "Moving Light 4", w: 1.4, h: 2.0, shape: "rect", layer: "top", icon: "/icons/light_4.png" },
      { type: "ic-light-5", label: "Light - JDC1",   w: 1.9, h: 1.5, shape: "rect", layer: "top", icon: "/icons/light_5.png" },
      { type: "ic-light-6", label: "Light - Fresnel", w: 1.8, h: 1.9, shape: "rect", layer: "top", icon: "/icons/light_6.png" },
      { type: "ic-light-7", label: "Light - PAR Can", w: 1.3, h: 1.8, shape: "rect", layer: "top", icon: "/icons/light_7.png" },
    ],
  },
  {
    name: "Production",
    items: [
      // FOH / production-world gear — consoles, racks, switchers.
      { type: "ic-audio-console",  label: "Audio Console",     w: 4.6, h: 3.2, shape: "rect", icon: "/icons/audio_console_1.png" },
      { type: "ic-light-console-1", label: "Lighting Console 1", w: 4,  h: 2,   shape: "rect", icon: "/icons/lighting_console_1.png" },
      { type: "ic-light-console-2", label: "Lighting Console 2", w: 4,  h: 1.7, shape: "rect", icon: "/icons/lighting_console_2.png" },
      { type: "ic-outboard",       label: "Outboard Rack",     w: 2,   h: 3,   shape: "rect", icon: "/icons/outboard_gear_1.png" },
      { type: "ic-video-switcher", label: "Video Switcher",    w: 3,   h: 1.5, shape: "rect", icon: "/icons/video_switcher_1.png" },
    ],
  },
  {
    name: "Stage Markers",
    items: [
      // Anatomy markers — float on top so they're never hidden behind gear.
      // Outline-only (transparent fill) so they read as labels rather than physical objects.
      { type: "mark-up",   label: "Upstage",     w: 3.5, h: 0.7, shape: "rect", layer: "top",
        details: [{ type: "rect", x: 0, y: 0, w: 1, h: 1, stroke: "rgba(14,14,14,0.55)", strokeWidth: 1.5, fill: "none" }] },
      { type: "mark-down", label: "Downstage",   w: 3.5, h: 0.7, shape: "rect", layer: "top",
        details: [{ type: "rect", x: 0, y: 0, w: 1, h: 1, stroke: "rgba(14,14,14,0.55)", strokeWidth: 1.5, fill: "none" }] },
      { type: "mark-sl",   label: "Stage Left",  w: 3.5, h: 0.7, shape: "rect", layer: "top",
        details: [{ type: "rect", x: 0, y: 0, w: 1, h: 1, stroke: "rgba(14,14,14,0.55)", strokeWidth: 1.5, fill: "none" }] },
      { type: "mark-sr",   label: "Stage Right", w: 3.5, h: 0.7, shape: "rect", layer: "top",
        details: [{ type: "rect", x: 0, y: 0, w: 1, h: 1, stroke: "rgba(14,14,14,0.55)", strokeWidth: 1.5, fill: "none" }] },
      // Curtain / scrim: long thin rect across the stage with vertical pleat hashes.
      // Default upstage-ish width but user can resize as needed via Inspector.
      { type: "curtain", label: "Curtain / Scrim", w: 20, h: 0.5, shape: "rect", layer: "default", labelPos: "bottom",
        details: [
          // Repeating short vertical hashes evoking fabric pleats.
          { type: "line", x1: 0.05, y1: 0.10, x2: 0.05, y2: 0.90, stroke: "rgba(14,14,14,0.45)", strokeWidth: 1 },
          { type: "line", x1: 0.10, y1: 0.10, x2: 0.10, y2: 0.90, stroke: "rgba(14,14,14,0.45)", strokeWidth: 1 },
          { type: "line", x1: 0.15, y1: 0.10, x2: 0.15, y2: 0.90, stroke: "rgba(14,14,14,0.45)", strokeWidth: 1 },
          { type: "line", x1: 0.20, y1: 0.10, x2: 0.20, y2: 0.90, stroke: "rgba(14,14,14,0.45)", strokeWidth: 1 },
          { type: "line", x1: 0.25, y1: 0.10, x2: 0.25, y2: 0.90, stroke: "rgba(14,14,14,0.45)", strokeWidth: 1 },
          { type: "line", x1: 0.30, y1: 0.10, x2: 0.30, y2: 0.90, stroke: "rgba(14,14,14,0.45)", strokeWidth: 1 },
          { type: "line", x1: 0.35, y1: 0.10, x2: 0.35, y2: 0.90, stroke: "rgba(14,14,14,0.45)", strokeWidth: 1 },
          { type: "line", x1: 0.40, y1: 0.10, x2: 0.40, y2: 0.90, stroke: "rgba(14,14,14,0.45)", strokeWidth: 1 },
          { type: "line", x1: 0.45, y1: 0.10, x2: 0.45, y2: 0.90, stroke: "rgba(14,14,14,0.45)", strokeWidth: 1 },
          { type: "line", x1: 0.50, y1: 0.10, x2: 0.50, y2: 0.90, stroke: "rgba(14,14,14,0.45)", strokeWidth: 1 },
          { type: "line", x1: 0.55, y1: 0.10, x2: 0.55, y2: 0.90, stroke: "rgba(14,14,14,0.45)", strokeWidth: 1 },
          { type: "line", x1: 0.60, y1: 0.10, x2: 0.60, y2: 0.90, stroke: "rgba(14,14,14,0.45)", strokeWidth: 1 },
          { type: "line", x1: 0.65, y1: 0.10, x2: 0.65, y2: 0.90, stroke: "rgba(14,14,14,0.45)", strokeWidth: 1 },
          { type: "line", x1: 0.70, y1: 0.10, x2: 0.70, y2: 0.90, stroke: "rgba(14,14,14,0.45)", strokeWidth: 1 },
          { type: "line", x1: 0.75, y1: 0.10, x2: 0.75, y2: 0.90, stroke: "rgba(14,14,14,0.45)", strokeWidth: 1 },
          { type: "line", x1: 0.80, y1: 0.10, x2: 0.80, y2: 0.90, stroke: "rgba(14,14,14,0.45)", strokeWidth: 1 },
          { type: "line", x1: 0.85, y1: 0.10, x2: 0.85, y2: 0.90, stroke: "rgba(14,14,14,0.45)", strokeWidth: 1 },
          { type: "line", x1: 0.90, y1: 0.10, x2: 0.90, y2: 0.90, stroke: "rgba(14,14,14,0.45)", strokeWidth: 1 },
          { type: "line", x1: 0.95, y1: 0.10, x2: 0.95, y2: 0.90, stroke: "rgba(14,14,14,0.45)", strokeWidth: 1 },
        ] },
      // Stage entrance arrow: 2×1.5 rect with a chevron pointing UP (entering from
      // upstage). User can rotate to point in whatever direction the entrance is.
      { type: "entrance", label: "Entrance", w: 2, h: 1.5, shape: "rect", layer: "top", labelPos: "bottom",
        details: [
          // Chevron pointing up (toward 0 on the y-axis): two diagonals meeting at top center.
          { type: "line", x1: 0.20, y1: 0.50, x2: 0.50, y2: 0.18, stroke: "rgba(14,14,14,0.65)", strokeWidth: 2 },
          { type: "line", x1: 0.50, y1: 0.18, x2: 0.80, y2: 0.50, stroke: "rgba(14,14,14,0.65)", strokeWidth: 2 },
          // Arrow shaft.
          { type: "line", x1: 0.50, y1: 0.20, x2: 0.50, y2: 0.55, stroke: "rgba(14,14,14,0.65)", strokeWidth: 2 },
        ] },
    ],
  },
];

// Within each category, surface the icon (PNG) items before the older
// outline/primitive items. JS Array.prototype.sort is stable in modern engines,
// so this preserves authored order inside each group. Icon items = those with
// an `icon` field; everything else (outline primitives, the kit cluster, markers)
// sorts after.
PLOT_CATEGORIES.forEach(cat => {
  cat.items.sort((a, b) => (a.icon ? 0 : 1) - (b.icon ? 0 : 1));
});

// Renders the per-item `details` array as a positioned SVG layer that fills the
// item's box. Coordinates in details are normalized 0..1 (fractions of item w/h).
//
// CIRCLE FIX: the SVG uses preserveAspectRatio="none" so the 0..1 viewBox stretches
// to fill the parent. This means a `<circle>` with r=0.2 would distort along the
// longer axis. To keep circles round, we render them as ELLIPSES with rx/ry
// COMPENSATED for the parent's aspect ratio.
//
// Math: if the parent box is W ft × H ft (in stage feet), the on-screen box
// stretches the SVG's 1×1 viewBox into W:H proportion. For a desired apparent
// radius r (relative to min(W,H)), we set rx = r * (min/W), ry = r * (min/H).
// This pre-distorts the ellipse so it reads as a true circle.
const ItemDetailLayer = ({ details, w, h }) => {
  if (!details || details.length === 0) return null;
  const DEFAULT_FILL = "rgba(14,14,14,0.55)";
  const W = Math.max(0.0001, w || 1);
  const H = Math.max(0.0001, h || 1);
  const minDim = Math.min(W, H);
  const rxScale = minDim / W; // multiplier on x-radius to compensate for viewbox stretch
  const ryScale = minDim / H;
  return (
    <svg viewBox="0 0 1 1" preserveAspectRatio="none" style={{
      position: "absolute", inset: 0, width: "100%", height: "100%",
      pointerEvents: "none",
    }}>
      {details.map((d, i) => {
        // strokeWidth values are in CSS pixels (combined with vectorEffect="non-scaling-stroke",
        // they render at the literal pixel width regardless of viewBox scale).
        if (d.type === "rect") {
          return <rect key={i} x={d.x} y={d.y} width={d.w} height={d.h}
            fill={d.fill === undefined ? DEFAULT_FILL : d.fill}
            stroke={d.stroke || "none"}
            strokeWidth={d.strokeWidth || 0}
            vectorEffect="non-scaling-stroke"/>;
        }
        if (d.type === "line") {
          return <line key={i} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}
            stroke={d.stroke || DEFAULT_FILL}
            strokeWidth={d.strokeWidth || 1}
            vectorEffect="non-scaling-stroke"/>;
        }
        if (d.type === "circle") {
          // Render as ellipse with rx/ry pre-compensated so the on-screen result is
          // a true circle. r in details is normalized to "fraction of min(W,H)".
          return <ellipse key={i} cx={d.cx} cy={d.cy}
            rx={d.r * rxScale} ry={d.r * ryScale}
            fill={d.fill === undefined ? DEFAULT_FILL : d.fill}
            stroke={d.stroke || "none"}
            strokeWidth={d.strokeWidth || 0}
            vectorEffect="non-scaling-stroke"/>;
        }
        return null;
      })}
    </svg>
  );
};

function StagePlotLibrary({ inputs, onDragStart, customGroups = [], onDeleteGroup, addInput }) {
  const [query, setQuery] = useState("");
  // Collapsed-category state. On load every category starts collapsed EXCEPT
  // the first one (Drum Kits) — left open as a visual cue that headers expand.
  // Clicking a header toggles it. When a search query is active, all categories
  // force-expand so results are always visible regardless of collapse state.
  const [collapsed, setCollapsed] = useState(() => {
    const init = {};
    PLOT_CATEGORIES.forEach((cat, i) => { if (i > 0) init[cat.name] = true; });
    return init;
  });
  const toggleCategory = (name) => setCollapsed(c => ({ ...c, [name]: !c[name] }));

  // Inline quick-add for the "Channels (from Input List)" section. Clicking "+"
  // opens a tiny inline field so the user can write a source name without
  // jumping back to the Input List section. Stereo checkbox claims two
  // consecutive channels. Enter commits; Escape cancels.
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddSource, setQuickAddSource] = useState("");
  const [quickAddStereo, setQuickAddStereo] = useState(false);
  const commitQuickAdd = () => {
    const src = quickAddSource.trim();
    if (!src) { setQuickAddOpen(false); return; }
    if (typeof addInput === "function") {
      addInput({ source: src, stereo: quickAddStereo });
    }
    setQuickAddSource("");
    setQuickAddStereo(false);
    setQuickAddOpen(false);
  };

  // Stereo-aware channel map for the "Channels (from Input List)" section —
  // stereo rows render as "CH5-6 · KEYS" and drag as a single pin claiming
  // both channel numbers when dropped on the stage.
  const channelMap = computeChannelMap(inputs);

  const q = query.trim().toLowerCase();
  const filteredCategories = q
    ? PLOT_CATEGORIES.map(cat => ({
        ...cat,
        items: cat.items.filter(it =>
          it.label.toLowerCase().includes(q) ||
          cat.name.toLowerCase().includes(q) ||
          (it.type && it.type.toLowerCase().includes(q))
        ),
      })).filter(cat => cat.items.length > 0)
    : PLOT_CATEGORIES;
  // Filter user-saved groups against the search query too.
  const filteredGroups = q
    ? customGroups.filter(g => (g.label || "").toLowerCase().includes(q))
    : customGroups;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Mono style={{ fontSize: 9, opacity: 0.55, flexShrink: 0 }}>— Equipment Library —</Mono>

      {/* Sticky search bar */}
      <div style={{ marginTop: 8, flexShrink: 0, position: "relative" }}>
        <Search className="w-3 h-3" style={{
          position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
          color: "rgba(244,241,234,0.45)",
        }}/>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search equipment…"
          style={{
            width: "100%",
            padding: "6px 8px 6px 24px",
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 12,
            backgroundColor: "rgba(244,241,234,0.04)",
            color: BRAND.bone,
            border: "1px solid rgba(244,241,234,0.14)",
            borderRadius: 2,
            outline: "none",
          }}
          onFocus={e => e.currentTarget.style.borderColor = BRAND.orange}
          onBlur={e => e.currentTarget.style.borderColor = "rgba(244,241,234,0.14)"}
        />
        {query && (
          <button onClick={() => setQuery("")}
            style={{
              position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
              padding: 2, color: "rgba(244,241,234,0.55)", cursor: "pointer",
              background: "transparent", border: 0,
            }}
            title="Clear search">
            <X className="w-3 h-3"/>
          </button>
        )}
      </div>

      {/* Stacked, scrollable list */}
      <div style={{ flex: 1, overflowY: "auto", marginTop: 6, minHeight: 0 }}>
        {filteredCategories.length === 0 && filteredGroups.length === 0 && (
          <div className="mt-4">
            <Mono style={{ fontSize: 9, opacity: 0.4 }}>No matches for "{query}"</Mono>
          </div>
        )}

        {/* Saved Groups — user-defined kits saved via the multi-select inspector.
            Each one drags as a kit (drops multiple pieces with a shared groupId). */}
        {filteredGroups.length > 0 && (
          <div className="mt-4">
            <Mono style={{ fontSize: 9, color: BRAND.orange, fontWeight: 700 }}>Saved Groups</Mono>
            <div className="mt-1.5" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {filteredGroups.map(g => (
                <div key={g.id} draggable
                  onDragStart={() => onDragStart({ isKit: true, kit: g.pieces, label: g.label, type: g.id })}
                  className="px-2 py-1.5 cursor-grab text-[11px] flex items-center gap-2 select-none transition-colors"
                  style={{
                    border: "1px solid rgba(212,100,30,0.30)",
                    color: BRAND.bone,
                    borderRadius: 2,
                    fontFamily: "'Inter', system-ui, sans-serif",
                    backgroundColor: "rgba(212,100,30,0.04)",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND.orange; e.currentTarget.style.backgroundColor = "rgba(212,100,30,0.10)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(212,100,30,0.30)"; e.currentTarget.style.backgroundColor = "rgba(212,100,30,0.04)"; }}>
                  <LayoutGrid className="w-3 h-3 flex-shrink-0" style={{ opacity: 0.8, color: BRAND.orange }}/>
                  <span style={{ flex: 1 }}>{g.label}</span>
                  <span style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 8.5, opacity: 0.55, letterSpacing: "0.08em",
                  }}>{g.pieces.length}×</span>
                  {onDeleteGroup && (
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete saved group "${g.label}"?`)) onDeleteGroup(g.id); }}
                      style={{
                        padding: 1,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "rgba(244,241,234,0.45)",
                      }}
                      title="Delete saved group">
                      <X className="w-3 h-3"/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredCategories.map(cat => {
          // A search query force-expands every category; otherwise honor the
          // per-category collapsed state.
          const isOpen = !!q || !collapsed[cat.name];
          return (
          <div key={cat.name} className="mt-4">
            {/* Clickable category header — arrow + label + hairline bar. */}
            <button type="button" onClick={() => !q && toggleCategory(cat.name)}
              className="w-full flex items-center gap-2 select-none"
              style={{ background: "transparent", border: 0, padding: 0, cursor: q ? "default" : "pointer" }}>
              <span style={{
                color: BRAND.orange, fontSize: 9, lineHeight: 1,
                transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 120ms ease",
                display: "inline-block",
              }}>▶</span>
              <Mono style={{ fontSize: 9, color: BRAND.orange, fontWeight: 700, whiteSpace: "nowrap" }}>{cat.name}</Mono>
              <span style={{ flex: 1, height: 1, background: "rgba(212,100,30,0.30)" }}/>
              <Mono style={{ fontSize: 8, color: "rgba(244,241,234,0.40)" }}>{cat.items.length}</Mono>
            </button>
            {isOpen && (
              <div className="mt-1.5" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {cat.items.map(it => (
                  <div key={it.type} draggable
                    onDragStart={() => onDragStart(it)}
                    className="px-2 py-1.5 cursor-grab text-[11px] flex items-center gap-2 select-none transition-colors"
                    style={{
                      border: "1px solid rgba(244,241,234,0.15)",
                      color: "rgba(244,241,234,0.75)",
                      borderRadius: 2,
                      fontFamily: "'Inter', system-ui, sans-serif",
                      backgroundColor: "rgba(244,241,234,0.02)",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND.orange; e.currentTarget.style.color = BRAND.bone; e.currentTarget.style.backgroundColor = "rgba(212,100,30,0.06)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(244,241,234,0.15)"; e.currentTarget.style.color = "rgba(244,241,234,0.75)"; e.currentTarget.style.backgroundColor = "rgba(244,241,234,0.02)"; }}>
                    <Square className="w-3 h-3 flex-shrink-0" style={{ opacity: 0.6 }}/>
                    <span>{it.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          );
        })}

        {!q && (
          <div className="mt-5 pt-3" style={{ borderTop: "1px solid rgba(244,241,234,0.10)" }}>
            <Mono style={{ fontSize: 9, color: BRAND.orange, fontWeight: 700 }}>Channels (from Input List)</Mono>
            <div className="flex flex-wrap gap-1 mt-1.5 items-center">
              {/* Channel pills are draggable — drop one on the stage and it
                  lands as a small labeled pin (type: "channel-pin"). The pin
                  stores inputId rather than a frozen label so renaming the
                  source back in the Input List updates the pin live. Stereo
                  inputs render as "CH5-6 · KEYS" and drop as a single pin. */}
              {inputs.map((i, idx) => i.source && (
                <span key={i.id}
                  draggable
                  onDragStart={(e) => {
                    onDragStart({
                      isChannel: true,
                      inputId: i.id,
                      label: i.source,
                      isStereo: !!i.stereo,
                      channelStart: channelMap[idx].start,
                      channelEnd: channelMap[idx].end,
                    });
                    // Firefox needs data on the DataTransfer to start the drag.
                    try { e.dataTransfer.setData("text/plain", i.id); } catch (_) {}
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  title="Drag onto stage to place a channel pin"
                  style={{
                    backgroundColor: "rgba(212,100,30,0.14)",
                    color: BRAND.orange,
                    padding: "2px 6px", borderRadius: 2,
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                    cursor: "grab", userSelect: "none",
                  }}>
                  CH{channelMap[idx].label} · {i.source}
                </span>
              ))}
              {/* Empty-state hint when no sources are filled in yet. The "+"
                  affordance below still works — user can add their first
                  channel without leaving the stage view. */}
              {inputs.filter(i => i.source).length === 0 && (
                <Mono style={{ fontSize: 9, opacity: 0.4 }}>None yet — use + to add</Mono>
              )}
              {/* Quick-add "+" — tap to open an inline source-name field. */}
              {!quickAddOpen && inputs.length < 48 && (
                <button type="button"
                  onClick={() => setQuickAddOpen(true)}
                  title="Add a channel to the Input List"
                  style={{
                    color: BRAND.orange,
                    background: "transparent",
                    border: `1px dashed rgba(212,100,30,0.55)`,
                    padding: "1px 6px", borderRadius: 2,
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 11, fontWeight: 700, lineHeight: "12px",
                    cursor: "pointer",
                  }}>
                  +
                </button>
              )}
            </div>

            {/* Inline quick-add form. Channel number is implicit — the new row
                gets appended, so it'll be the next available number (with
                stereo accounted for). User types a source, optionally checks
                Stereo, hits Enter (or clicks Add). Escape cancels. */}
            {quickAddOpen && (
              <div className="mt-2 flex items-center gap-1.5"
                style={{
                  padding: "5px 6px",
                  border: `1px solid rgba(212,100,30,0.40)`,
                  borderRadius: 2,
                  backgroundColor: "rgba(212,100,30,0.05)",
                }}>
                <Mono style={{ fontSize: 9, color: BRAND.orange, opacity: 0.7 }}>
                  CH{(() => {
                    // Preview the channel number this row will land on,
                    // factoring in the in-progress Stereo toggle (it claims
                    // one slot now and will claim two once committed, but
                    // the preview just shows the starting channel).
                    const last = channelMap[channelMap.length - 1];
                    return last ? last.end + 1 : 1;
                  })()}
                </Mono>
                <input type="text"
                  value={quickAddSource}
                  onChange={e => setQuickAddSource(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); commitQuickAdd(); }
                    else if (e.key === "Escape") { e.preventDefault(); setQuickAddOpen(false); setQuickAddSource(""); setQuickAddStereo(false); }
                  }}
                  autoFocus
                  placeholder="Source name…"
                  style={{
                    flex: 1, minWidth: 0,
                    background: "rgba(14,14,14,0.5)",
                    color: BRAND.bone,
                    border: "1px solid rgba(244,241,234,0.18)",
                    borderRadius: 2,
                    padding: "3px 6px",
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: 11,
                    outline: "none",
                  }}/>
                <label className="flex items-center gap-1 select-none" style={{ cursor: "pointer" }}>
                  <input type="checkbox"
                    checked={quickAddStereo}
                    onChange={e => setQuickAddStereo(e.target.checked)}
                    style={{ accentColor: BRAND.orange, width: 12, height: 12 }}/>
                  <Mono style={{ fontSize: 9, color: "rgba(244,241,234,0.75)" }}>Stereo</Mono>
                </label>
                <button type="button" onClick={commitQuickAdd}
                  style={{
                    color: BRAND.black, background: BRAND.orange,
                    border: `1px solid ${BRAND.orange}`,
                    padding: "2px 8px", borderRadius: 2,
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
                    cursor: "pointer",
                  }}>ADD</button>
                <button type="button"
                  onClick={() => { setQuickAddOpen(false); setQuickAddSource(""); setQuickAddStereo(false); }}
                  title="Cancel"
                  style={{
                    color: "rgba(244,241,234,0.55)", background: "transparent",
                    border: "none", padding: "0 2px", cursor: "pointer",
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 12, lineHeight: 1,
                  }}>×</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StagePlotInspector({ items, selectedId, selectedIds = [], setItems, setSelectedId, setSelectedIds, customGroups = [], setCustomGroups }) {
  const sel = items.find(i => i.id === selectedId);
  const isActive = !!sel;
  const updateItem = (id, patch) => setItems(it => it.map(i => i.id === id ? { ...i, ...patch } : i));
  const removeItem = (id) => setItems(it => it.filter(i => i.id !== id));
  const dimmedStyle = { opacity: isActive ? 1 : 0.35, pointerEvents: isActive ? "auto" : "none", transition: "opacity 0.15s" };

  // Multi-select rotation state — tracks total degrees applied since the
  // selection was last changed. Reset whenever the selection key changes.
  // Each delta from this slider is applied as a rotation around the bounding
  // box, snap-aware. Stored as state in the inspector itself; we don't
  // persist this anywhere (it's a session-only spinner).
  const selectionKey = [...selectedIds].sort().join(",");
  const [multiRot, setMultiRot] = useState(0);
  // Group name input — also resets when the selection changes.
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const lastSelectionKeyRef = useRef(selectionKey);
  useEffect(() => {
    if (lastSelectionKeyRef.current !== selectionKey) {
      lastSelectionKeyRef.current = selectionKey;
      setMultiRot(0);
      setGroupNameDraft("");
    }
  }, [selectionKey]);

  // -------- Multi-select mode --------
  // When more than one item is selected (via marquee), render a different
  // inspector that operates on the whole selection: Layer-apply-to-all,
  // Delete-all, and a count readout. (Rotate + W/H + Group ship in Round 2/3.)
  if (selectedIds.length > 1) {
    const selItems = items.filter(i => selectedIds.includes(i.id));
    const count = selItems.length;
    // Bounding box of the multi-selection (axis-aligned, footprint coords).
    const minX = Math.min(...selItems.map(s => s.x));
    const minY = Math.min(...selItems.map(s => s.y));
    const maxX = Math.max(...selItems.map(s => s.x + s.w));
    const maxY = Math.max(...selItems.map(s => s.y + s.h));
    const bboxW = maxX - minX;
    const bboxH = maxY - minY;
    // Determine the "common" layer: if all members share one, show it; otherwise show null.
    const layers = new Set(selItems.map(i => i.layer || "default"));
    const commonLayer = layers.size === 1 ? [...layers][0] : null;
    const applyLayerToAll = (layer) => {
      setItems(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, layer } : i));
    };
    const deleteAll = () => {
      setItems(prev => prev.filter(i => !selectedIds.includes(i.id)));
      setSelectedIds([]);
    };
    // Rotate the whole selection around its bounding-box center by `deltaDeg`.
    // Each item's center orbits around (cx,cy) and its own `rot` adds the delta.
    // Snap-aware: position rounds to half-foot if the item has snap on.
    const rotateBy = (deltaDeg) => {
      if (!deltaDeg) return;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const ang = deltaDeg * Math.PI / 180;
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      setItems(prev => prev.map(it => {
        if (!selectedIds.includes(it.id)) return it;
        const ix = it.x + it.w / 2;
        const iy = it.y + it.h / 2;
        const ox = ix - cx;
        const oy = iy - cy;
        const rx = ox * cosA - oy * sinA;
        const ry = ox * sinA + oy * cosA;
        let newX = cx + rx - it.w / 2;
        let newY = cy + ry - it.h / 2;
        if (it.snap !== false) {
          newX = snapCenter(newX, it.w);
          newY = snapCenter(newY, it.h);
        }
        return {
          ...it,
          x: newX,
          y: newY,
          rot: (((it.rot || 0) + deltaDeg) % 360 + 360) % 360,
        };
      }));
    };
    // Slider handler — applies the delta from current multiRot to the new value.
    const onRotateSliderChange = (newVal) => {
      const delta = newVal - multiRot;
      rotateBy(delta);
      setMultiRot(newVal);
    };
    // Save the current selection as a custom group in the library. Captures
    // each piece with its offsets relative to the bounding-box center, so when
    // dragged from the library later it spawns the same arrangement. Also
    // stamps the existing on-canvas items with a fresh shared groupId so the
    // current arrangement behaves as a group immediately — clicking one item
    // picks the whole group, dragging moves it together. This matches the
    // behavior of dropping the group back in from the library later.
    const saveAsGroup = () => {
      const name = groupNameDraft.trim();
      if (!name || !setCustomGroups) return;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const pieces = selItems.map(it => ({
        type: it.type, label: it.label, shape: it.shape,
        w: it.w, h: it.h,
        ox: (it.x + it.w / 2) - cx,
        oy: (it.y + it.h / 2) - cy,
        rot: it.rot || 0,
        layer: it.layer || "default",
        snap: it.snap !== false,
        icon: it.icon || null,
        displayScale: it.displayScale,
        details: it.details,
        labelPos: it.labelPos,
        channel: "",
        notes: "",
      }));
      const newGroup = { id: uid(), label: name, pieces };
      setCustomGroups(prev => [...prev, newGroup]);
      // Stamp the on-canvas items with a shared groupId so they behave as a
      // group from this point forward.
      const sharedGid = uid();
      setItems(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, groupId: sharedGid } : i));
      setGroupNameDraft("");
    };
    return (
      <div style={{ padding: 0 }}>
        <div className="flex items-center justify-between">
          <Mono style={{ fontSize: 9, opacity: 0.55, color: BRAND.orange, fontWeight: 700 }}>— Multi-Select —</Mono>
          <Mono style={{ fontSize: 9, opacity: 0.7, letterSpacing: "0.14em" }}>
            {count} ITEMS
          </Mono>
        </div>
        <div className="space-y-3 mt-3">
          {/* Bounding-box dimensions readout (read-only — informational only). */}
          <div>
            <FieldLabel>Dimensions</FieldLabel>
            <div style={{
              padding: "5px 9px",
              background: "rgba(244,241,234,0.04)",
              border: "1px solid rgba(244,241,234,0.14)",
              borderRadius: 2,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 11, letterSpacing: "0.10em",
              color: "rgba(244,241,234,0.75)",
            }}>
              {bboxW.toFixed(1)} × {bboxH.toFixed(1)} ft
            </div>
          </div>

          {/* Rotation slider: 0–360°, snaps to 45° stops. Drag through the
              stops to rotate the whole selection around its bounding-box center.
              Tick marks below the track show the 8 stop positions. */}
          <div>
            <FieldLabel>Rotation</FieldLabel>
            <div style={{ position: "relative", padding: "4px 0 12px" }}>
              <input type="range" min={0} max={360} step={45}
                value={multiRot}
                onChange={e => onRotateSliderChange(parseInt(e.target.value, 10))}
                style={{
                  width: "100%",
                  accentColor: BRAND.orange,
                  cursor: "pointer",
                }}/>
              {/* Tick marks: 9 dashes (0, 45, 90, ..., 360) along the slider track. */}
              <div style={{
                position: "absolute",
                left: 0, right: 0, bottom: 0,
                display: "flex",
                justifyContent: "space-between",
                pointerEvents: "none",
              }}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                  <span key={i} style={{
                    width: 1, height: 6,
                    background: "rgba(244,241,234,0.45)",
                  }}/>
                ))}
              </div>
            </div>
          </div>

          <div>
            <FieldLabel>Layer (apply to all)</FieldLabel>
            <div className="flex" style={{
              border: "1px solid rgba(244,241,234,0.18)",
              borderRadius: 2,
              overflow: "hidden",
            }}>
              {[
                { v: "floor",   label: "Floor" },
                { v: "default", label: "Default" },
                { v: "top",     label: "Top" },
              ].map((opt, i) => {
                const sel2 = commonLayer === opt.v;
                return (
                  <button key={opt.v} type="button"
                    onClick={() => applyLayerToAll(opt.v)}
                    style={{
                      flex: 1,
                      padding: "5px 4px",
                      background: sel2 ? "rgba(212,100,30,0.16)" : "transparent",
                      color: sel2 ? BRAND.orange : "rgba(244,241,234,0.65)",
                      borderLeft: i > 0 ? "1px solid rgba(244,241,234,0.12)" : "none",
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase",
                      cursor: "pointer",
                    }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {commonLayer === null && (
              <Mono style={{ fontSize: 8, opacity: 0.45, marginTop: 4, letterSpacing: "0.10em" }}>
                Mixed layers — pick one to apply.
              </Mono>
            )}
          </div>

          {/* Save selection as a reusable Group in the library. Name field +
              Save button. After saving, the group appears in the equipment
              library under "Saved Groups" and can be dragged onto the canvas
              like a kit. */}
          {setCustomGroups && (
            <div>
              <FieldLabel>Group</FieldLabel>
              <Input value={groupNameDraft}
                placeholder="e.g. Keys Player Rig"
                onChange={e => setGroupNameDraft(e.target.value.slice(0, 40))}/>
              <button type="button"
                onClick={saveAsGroup}
                disabled={!groupNameDraft.trim()}
                className="mt-1.5 w-full py-1 flex items-center justify-center gap-1.5"
                style={{
                  backgroundColor: groupNameDraft.trim() ? "rgba(212,100,30,0.10)" : "transparent",
                  border: `1px solid ${groupNameDraft.trim() ? BRAND.orange : "rgba(244,241,234,0.18)"}`,
                  color: groupNameDraft.trim() ? BRAND.orange : "rgba(244,241,234,0.40)",
                  borderRadius: 2,
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase",
                  cursor: groupNameDraft.trim() ? "pointer" : "not-allowed",
                }}>
                + Save as Group
              </button>
            </div>
          )}

          <button onClick={deleteAll}
            className="w-full py-1.5 flex items-center justify-center gap-2"
            style={{
              backgroundColor: "rgba(212,100,30,0.10)",
              border: `1px solid rgba(212,100,30,0.35)`,
              color: BRAND.orange,
              borderRadius: 2,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
              cursor: "pointer",
            }}>
            <Trash2 className="w-3.5 h-3.5"/> Delete selection
          </button>

          <Mono style={{ fontSize: 8, opacity: 0.40, letterSpacing: "0.12em", lineHeight: 1.5 }}>
            Drag any selected item to move all together. Click empty canvas to deselect.
          </Mono>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      <div className="flex items-center justify-between">
        <Mono style={{ fontSize: 9, opacity: 0.55 }}>— Inspector —</Mono>
        {!isActive && (
          <Mono style={{ fontSize: 8, opacity: 0.40, letterSpacing: "0.16em" }}>
            Select an item
          </Mono>
        )}
      </div>
      <div className="space-y-3 mt-3" style={dimmedStyle}>
        <div>
          <FieldLabel>Label</FieldLabel>
          <Input value={isActive ? sel.label : ""} disabled={!isActive}
            onChange={e => isActive && updateItem(sel.id, { label: e.target.value })}/>
        </div>
        {/* Channel pins use a single Size slider (0.5x .. 1.5x) instead of
            free Width/Height inputs — the pin footprint is always proportional
            to its base size, so a one-dimensional control is cleaner and the
            ±50% cap matches what was asked for. Every other item type keeps
            the free W/H inputs. */}
        {isActive && sel.type === "channel-pin" ? (() => {
          const scale = sel.pinScale ?? 1;
          const baseW = sel.isStereo ? 3.5 : 3.0;
          const baseH = 0.75;
          const SCALE_MIN = 0.5, SCALE_MAX = 1.5, SCALE_STEP = 0.05;
          const setScale = (next) => {
            const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, next));
            updateItem(sel.id, {
              pinScale: clamped,
              w: +(baseW * clamped).toFixed(3),
              h: +(baseH * clamped).toFixed(3),
            });
          };
          return (
            <div>
              <div className="flex items-center justify-between">
                <FieldLabel>Label Size</FieldLabel>
                <Mono style={{ fontSize: 9, color: "rgba(244,241,234,0.55)" }}>
                  {Math.round(scale * 100)}%
                </Mono>
              </div>
              <div className="flex items-center gap-2">
                <div style={{ position: "relative", flex: 1, padding: "4px 0 12px" }}>
                  <input type="range"
                    min={SCALE_MIN} max={SCALE_MAX} step={SCALE_STEP}
                    value={scale}
                    onChange={e => setScale(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: BRAND.orange, cursor: "pointer" }}/>
                  {/* Tick at the 100% midpoint so the default is easy to find by eye. */}
                  <div style={{
                    position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)",
                    width: 1, height: 6, background: "rgba(244,241,234,0.45)", pointerEvents: "none",
                  }}/>
                </div>
                <button type="button"
                  onClick={() => setScale(1)}
                  title="Reset to 100%"
                  style={{
                    padding: "3px 8px",
                    background: "transparent",
                    border: "1px solid rgba(244,241,234,0.18)",
                    borderRadius: 2,
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
                    color: "rgba(244,241,234,0.65)",
                    cursor: "pointer",
                  }}>
                  100%
                </button>
              </div>
            </div>
          );
        })() : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>Width (ft)</FieldLabel>
              <Input type="number" step="0.5" value={isActive ? sel.w : ""} disabled={!isActive}
                onChange={e => isActive && updateItem(sel.id, { w: Math.max(0.5, parseFloat(e.target.value)||1) })}/>
            </div>
            <div>
              <FieldLabel>Height (ft)</FieldLabel>
              <Input type="number" step="0.5" value={isActive ? sel.h : ""} disabled={!isActive}
                onChange={e => isActive && updateItem(sel.id, { h: Math.max(0.5, parseFloat(e.target.value)||1) })}/>
            </div>
          </div>
        )}
        {(!isActive || sel.rotatable !== false) && (
          <div>
            <FieldLabel>Rotation</FieldLabel>
            <div className="flex items-center gap-2">
              {/* Slider snaps to 45° stops (step=45) so items lock to 8 uniform
                  orientations — matches the multi-select rotation slider. Tick
                  marks below the track show the 8 stop positions. */}
              <div style={{ position: "relative", flex: 1, padding: "4px 0 12px" }}>
                <input type="range" min="0" max="360" step="45"
                  value={isActive ? (sel.rot || 0) : 0} disabled={!isActive}
                  onChange={e => isActive && updateItem(sel.id, { rot: parseInt(e.target.value) })}
                  style={{ width: "100%", accentColor: BRAND.orange, cursor: isActive ? "pointer" : "not-allowed" }}/>
                <div style={{
                  position: "absolute", left: 0, right: 0, bottom: 0,
                  display: "flex", justifyContent: "space-between", pointerEvents: "none",
                }}>
                  {[0,1,2,3,4,5,6,7,8].map(n => (
                    <span key={n} style={{ width: 1, height: 6, background: "rgba(244,241,234,0.45)" }}/>
                  ))}
                </div>
              </div>
              <button onClick={() => isActive && updateItem(sel.id, { rot: ((sel.rot || 0) + 45) % 360 })}
                disabled={!isActive}
                className="p-1.5"
                title="Rotate 45°"
                style={{ border: "1px solid rgba(244,241,234,0.18)", color: BRAND.bone, borderRadius: 2,
                  cursor: isActive ? "pointer" : "not-allowed" }}>
                <RotateCw className="w-3 h-3"/>
              </button>
            </div>
          </div>
        )}
        <div>
          <FieldLabel>Layer</FieldLabel>
          {/* Segmented control: three buttons side-by-side; the one matching the
              item's layer is highlighted in orange. Click any to switch tiers.
              Cleaner than the dropdown — no menu to open, current layer always
              visible at a glance. */}
          <div className="flex" style={{
            border: "1px solid rgba(244,241,234,0.18)",
            borderRadius: 2,
            overflow: "hidden",
          }}>
            {[
              { v: "floor",   label: "Floor" },
              { v: "default", label: "Default" },
              { v: "top",     label: "Top" },
            ].map((opt, i) => {
              const sel2 = isActive && (sel.layer || "default") === opt.v;
              return (
                <button key={opt.v} type="button"
                  onClick={() => isActive && updateItem(sel.id, { layer: opt.v })}
                  disabled={!isActive}
                  style={{
                    flex: 1,
                    padding: "5px 4px",
                    background: sel2 ? "rgba(212,100,30,0.16)" : "transparent",
                    color: sel2 ? BRAND.orange : "rgba(244,241,234,0.65)",
                    borderLeft: i > 0 ? "1px solid rgba(244,241,234,0.12)" : "none",
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase",
                    cursor: isActive ? "pointer" : "not-allowed",
                  }}>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <FieldLabel>Snap to Grid</FieldLabel>
          <button type="button"
            onClick={() => isActive && updateItem(sel.id, { snap: sel.snap === false ? true : false })}
            disabled={!isActive}
            aria-pressed={isActive ? sel.snap !== false : false}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "flex-start", gap: 8,
              padding: "5px 9px",
              width: "100%",
              background: isActive && sel.snap !== false ? "rgba(212,100,30,0.10)" : "transparent",
              border: `1px solid ${isActive && sel.snap !== false ? BRAND.orange : "rgba(244,241,234,0.18)"}`,
              borderRadius: 2, cursor: isActive ? "pointer" : "not-allowed",
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
              color: isActive && sel.snap !== false ? BRAND.orange : "rgba(244,241,234,0.65)",
            }}>
            <span style={{
              position: "relative", display: "inline-block",
              width: 22, height: 11, borderRadius: 999, flexShrink: 0,
              background: isActive && sel.snap !== false ? BRAND.orange : "rgba(244,241,234,0.20)",
              transition: "background 120ms ease",
            }}>
              <span style={{
                position: "absolute", top: 1,
                left: isActive && sel.snap !== false ? 12 : 1,
                width: 9, height: 9, borderRadius: 999, background: BRAND.bone,
                transition: "left 120ms ease",
              }}/>
            </span>
            <span>{isActive && sel.snap !== false ? "On" : "Off"}</span>
          </button>
        </div>
        {/* Group info: only shows when the selected item is part of a group.
            Shows how many items are in the group + a button to detach this one. */}
        {isActive && sel.groupId && (() => {
          const groupSize = items.filter(i => i.groupId === sel.groupId).length;
          return (
            <div>
              <FieldLabel>Group</FieldLabel>
              <div style={{
                padding: "6px 8px",
                background: "rgba(212,100,30,0.06)",
                border: "1px solid rgba(212,100,30,0.30)",
                borderRadius: 2,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 9.5, letterSpacing: "0.10em",
                color: "rgba(244,241,234,0.75)",
                marginBottom: 6,
              }}>
                Linked with {groupSize - 1} other {groupSize - 1 === 1 ? "item" : "items"}.
                Drag any one to move all together.
              </div>
              <button onClick={() => updateItem(sel.id, { groupId: undefined })}
                className="w-full py-1 flex items-center justify-center gap-1.5"
                style={{
                  backgroundColor: "transparent",
                  border: "1px solid rgba(244,241,234,0.18)",
                  color: BRAND.bone,
                  borderRadius: 2,
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
                  cursor: "pointer",
                }}>
                Detach from group
              </button>
            </div>
          );
        })()}
        <div>
          <FieldLabel>Channel #</FieldLabel>
          <Input value={isActive ? (sel.channel || "") : ""} placeholder="e.g. 1" disabled={!isActive}
            onChange={e => isActive && updateItem(sel.id, { channel: e.target.value })}/>
        </div>
        <div>
          <FieldLabel>Notes</FieldLabel>
          <Textarea rows={3} value={isActive ? (sel.notes || "") : ""} disabled={!isActive}
            onChange={e => isActive && updateItem(sel.id, { notes: e.target.value })}/>
        </div>
        <button onClick={() => { if (isActive) { removeItem(sel.id); setSelectedId(null); } }}
          disabled={!isActive}
          className="w-full py-1.5 flex items-center justify-center gap-2"
          style={{
            backgroundColor: "rgba(212,100,30,0.10)",
            border: `1px solid rgba(212,100,30,0.35)`,
            color: BRAND.orange,
            borderRadius: 2,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
            cursor: isActive ? "pointer" : "not-allowed",
          }}>
          <Trash2 className="w-3.5 h-3.5"/> Delete item
        </button>
      </div>
    </div>
  );
}

function StagePlotBuilder({ items, setItems, size, setSize, selectedId, setSelectedId, selectedIds = [], setSelectedIds, dragLib, setDragLib, onUndo, onRedo, canUndo, canRedo, historyRef, inputs = [] }) {
  const stageRef = useRef(null);
  const wrapperRef = useRef(null);

  // Marquee selection state. When the user mousedowns on the empty stage area,
  // we start tracking a rectangle. On mouseup, items whose footprints intersect
  // the rectangle become selected. Coords are in stage feet (not pixels).
  const [marquee, setMarquee] = useState(null); // { x1, y1, x2, y2 } in ft, or null

  // Helper: which items currently match the multi-selection. Empty if nothing
  // is selected, single-id array if one item, longer if multi-selected.
  const selectedSet = new Set(selectedIds);

  // Migration: backfill icon/rotatable/displayScale on items by looking each
  // item's `type` up in PLOT_CATEGORIES. Runs whenever items change, but is
  // idempotent — skips items that already have all three fields, and bails
  // out without dispatching state if no item needs patching. This means items
  // dropped before these fields existed will pick up the library default on
  // the next render cycle.
  useLayoutEffect(() => {
    let changed = false;
    const next = items.map(it => {
      let tmpl = null;
      for (const cat of PLOT_CATEGORIES) {
        const m = cat.items.find(i => i.type === it.type);
        if (m) { tmpl = m; break; }
      }
      if (!tmpl) return it;
      const patch = {};
      if (it.icon == null && tmpl.icon) patch.icon = tmpl.icon;
      if (it.rotatable === undefined) patch.rotatable = tmpl.rotatable !== false;
      if (it.displayScale === undefined && tmpl.displayScale) patch.displayScale = tmpl.displayScale;
      if (it.layer === undefined) patch.layer = tmpl.layer || "default";
      if (it.snap === undefined) patch.snap = tmpl.snap !== false; // default ON
      if (it.details === undefined && tmpl.details) patch.details = tmpl.details;
      if (it.labelPos === undefined && tmpl.labelPos) patch.labelPos = tmpl.labelPos;
      if (Object.keys(patch).length === 0) return it;
      changed = true;
      return { ...it, ...patch };
    });
    if (changed) {
      // This is an internal field-backfill (filling in icon/layer/snap/etc.
      // from the library template), NOT a user edit. Suspend undo history
      // around it so it doesn't land as its own snapshot. Without this,
      // normalizing freshly-loaded or freshly-dropped items produced a
      // phantom history entry — which is why dropping one kit used to take
      // two undos to remove. Mirrors the suspend pattern used by undo/redo.
      if (historyRef && historyRef.current) {
        historyRef.current.suspended += 1;
        setItems(next);
        setTimeout(() => {
          historyRef.current.suspended = Math.max(0, historyRef.current.suspended - 1);
        }, 0);
      } else {
        setItems(next);
      }
    }
  }, [items, setItems, historyRef]);

  // Dynamic fit-scale: pixels per foot at "Fit" zoom. Computed from the canvas
  // pane's available width so the stage fills ~90% of the pane regardless of
  // dimensions or viewport size. Clamped 18..80.
  const [fitScale, setFitScale] = useState(40);
  // Zoom multiplier layered on top of fit-scale. 1 = Fit (auto). Stepped via the
  // Zoom control in the toolbar and Cmd/Ctrl+scroll. Range 60%..140% in 10% steps.
  const [zoom, setZoom] = useState(1);
  // Effective px-per-foot used everywhere downstream (rendering + all foot↔pixel
  // math: snap, drag, marquee). Layering zoom here means every interaction keeps
  // working at any zoom level with no extra rework.
  const SCALE = fitScale * zoom;
  // Discrete zoom stops for the +/- buttons — 10% increments, 60%..140%.
  const ZOOM_STOPS = [0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4];
  const stepZoom = (dir) => {
    setZoom(z => {
      // Find the nearest stop and move one step in `dir`.
      let idx = ZOOM_STOPS.reduce((best, s, i) =>
        Math.abs(s - z) < Math.abs(ZOOM_STOPS[best] - z) ? i : best, 0);
      idx = Math.max(0, Math.min(ZOOM_STOPS.length - 1, idx + dir));
      return ZOOM_STOPS[idx];
    });
  };
  // Builder Guide popover open/closed state. Escape and click-outside-anywhere
  // close it so it never gets in the user's way.
  const [guideOpen, setGuideOpen] = useState(false);
  useEffect(() => {
    if (!guideOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setGuideOpen(false); };
    const onClick = () => setGuideOpen(false);
    window.addEventListener("keydown", onKey);
    // Defer click listener by one tick so the opening click doesn't immediately close it.
    const t = setTimeout(() => window.addEventListener("click", onClick), 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
      window.removeEventListener("click", onClick);
    };
  }, [guideOpen]);

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const recompute = () => {
      // Available width inside the wrapper, minus padding (24 each side = 48).
      const availW = Math.max(0, el.clientWidth - 48);
      const availH = Math.max(0, el.clientHeight - 48);
      if (availW <= 0 || availH <= 0) return;
      // Scale that fits the stage to ~92% of available width AND height.
      const scaleW = (availW * 0.92) / Math.max(1, size.w);
      const scaleH = (availH * 0.92) / Math.max(1, size.d);
      const next = Math.max(18, Math.min(80, Math.floor(Math.min(scaleW, scaleH))));
      setFitScale(prev => Math.abs(prev - next) > 0 ? next : prev);
    };
    recompute();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(recompute);
      ro.observe(el);
      return () => ro.disconnect();
    } else {
      window.addEventListener("resize", recompute);
      return () => window.removeEventListener("resize", recompute);
    }
  }, [size.w, size.d]);

  const stageWpx = size.w * SCALE;
  const stageDpx = size.d * SCALE;

  // Channel-pin live link bookkeeping. Each channel-pin item stores an
  // `inputId` referencing an Input List row; we re-derive its display label
  // ("CH3 · KICK IN" or "CH5-6 · KEYS") on every render from the current
  // inputs state, so renaming / reordering / toggling stereo on a source
  // propagates to placed pins automatically. If the linked input is later
  // deleted, the pin falls back to its stored label and shows a broken-link
  // hint (the lookup returns null below).
  const inputsChannelMap = computeChannelMap(inputs);
  const inputsById = new Map(inputs.map((i, idx) => [i.id, { input: i, channel: inputsChannelMap[idx] }]));

  // Cmd/Ctrl + scroll-wheel zooms the canvas. Registered as a non-passive
  // listener so preventDefault works (stops the browser page-zoom). Plain
  // scroll (no modifier) is left alone — it still scrolls the pane.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      setZoom(z => {
        let idx = ZOOM_STOPS.reduce((best, s, i) =>
          Math.abs(s - z) < Math.abs(ZOOM_STOPS[best] - z) ? i : best, 0);
        idx = Math.max(0, Math.min(ZOOM_STOPS.length - 1, idx + dir));
        return ZOOM_STOPS[idx];
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    const rect = stageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / SCALE;
    const y = (e.clientY - rect.top) / SCALE;
    const data = dragLib;
    if (!data) return;

    // Channel drop: data has `isChannel:true` and an `inputId` pointing back
    // at the Input List row. We create a single small "channel-pin" item on
    // the stage that displays "CH# · SOURCE" (or "CH#-# · SOURCE" for stereo).
    // The pin stores the inputId rather than baking the source into a label,
    // so when the user renames the source back in the Input List the pin
    // updates live. Stereo pins are slightly wider to fit "CH##-##".
    if (data.isChannel) {
      // Base footprint (matches pinScale = 1). The Inspector exposes a Size
      // slider that scales pinScale within ±50% of this base; w/h are
      // recomputed from pinScale * base whenever the slider moves so drag /
      // snap / marquee selection all continue to see the correct dimensions.
      const baseW = data.isStereo ? 3.5 : 3.0;
      const baseH = 0.75;
      const pinW = baseW;
      const pinH = baseH;
      const snap = true;
      let pinX = x - pinW / 2;
      let pinY = y - pinH / 2;
      if (snap) { pinX = snapCenter(pinX, pinW); pinY = snapCenter(pinY, pinH); }
      setItems(it => [...it, {
        id: uid(),
        type: "channel-pin",
        inputId: data.inputId,           // live link back to the Input List row
        label: data.label || "",         // fallback if the input row is later deleted
        isStereo: !!data.isStereo,       // fallback for the same reason
        channelStart: data.channelStart, // fallback / display when link is broken
        channelEnd: data.channelEnd,
        pinScale: 1,                     // 0.5 .. 1.5 — driven by Inspector slider
        shape: "rect",
        rotatable: true,
        layer: "top",                    // pins ride above icons so they're always readable
        snap: true,
        x: Math.max(0, Math.min(size.w - pinW, pinX)),
        y: Math.max(0, Math.min(size.d - pinH, pinY)),
        w: pinW, h: pinH, rot: 0,
        channel: "", notes: "",
      }]);
      setDragLib(null);
      return;
    }

    // Kit drop: data has `isKit:true` and a `kit` array. Each entry has ox/oy
    // (offsets in ft from the drop center) plus drum-piece fields. We drop one
    // independent item per entry so the user can drag/label/channel them
    // individually after. All pieces share a generated groupId so dragging any
    // one moves the whole group together. Pieces drop with snap:false to
    // preserve the tight overlapping cluster (the GROUP drag is what snaps).
    if (data.isKit && Array.isArray(data.kit)) {
      // Snap the kit's CENTER to a whole foot so the cluster lands on the grid
      // even though the pieces themselves are sub-foot offset from one another.
      const cx = Math.round(x);
      const cy = Math.round(y);
      const groupId = uid();
      const newItems = data.kit.map(piece => {
        const pX = cx + (piece.ox || 0) - piece.w / 2;
        const pY = cy + (piece.oy || 0) - piece.h / 2;
        return {
          id: uid(),
          groupId, // shared id so drags move the whole kit together
          type: piece.type, label: piece.label, shape: piece.shape,
          icon: piece.icon || null,
          rotatable: piece.rotatable !== false,
          displayScale: piece.displayScale || 1,
          layer: piece.layer || "default",
          snap: false, // pieces don't self-snap — the group drag handles snapping
          details: piece.details,
          labelPos: piece.labelPos,
          x: Math.max(0, Math.min(size.w - piece.w, pX)),
          y: Math.max(0, Math.min(size.d - piece.h, pY)),
          w: piece.w, h: piece.h, rot: 0,
          channel: "", notes: "",
        };
      });
      setItems(it => [...it, ...newItems]);
      setDragLib(null);
      return;
    }

    // Single-item drop. Snap to grid lands the item's CENTER on the half-foot
    // grid so it centers cleanly regardless of its width/height in feet.
    const snap = data.snap !== false;
    let dropX = x - data.w / 2;
    let dropY = y - data.h / 2;
    if (snap) { dropX = snapCenter(dropX, data.w); dropY = snapCenter(dropY, data.h); }
    setItems(it => [...it, {
      id: uid(),
      type: data.type, label: data.label, shape: data.shape,
      icon: data.icon || null,
      rotatable: data.rotatable !== false,
      displayScale: data.displayScale || 1,
      layer: data.layer || "default",
      snap,
      details: data.details,
      labelPos: data.labelPos,
      x: Math.max(0, Math.min(size.w - data.w, dropX)),
      y: Math.max(0, Math.min(size.d - data.h, dropY)),
      w: data.w, h: data.h, rot: data.rot || 0, // library item may carry a starting rotation
      channel: "", notes: "",
    }]);
    setDragLib(null);
  };

  const updateItem = (id, patch) => setItems(it => it.map(i => i.id === id ? { ...i, ...patch } : i));

  const onItemDrag = (e, id) => {
    e.stopPropagation();
    const item = items.find(i => i.id === id); if (!item) return;
    const startX = e.clientX, startY = e.clientY;

    // Multi-select drag: if the dragged item is part of a multi-selection,
    // move ALL selected items by the same delta. Same approach as group drag
    // (capture starts, clamp by combined bounding box, snap the delta).
    if (selectedIds.length > 1 && selectedSet.has(id)) {
      const members = items.filter(i => selectedSet.has(i.id));
      const starts = members.map(m => ({ id: m.id, x: m.x, y: m.y, w: m.w, h: m.h }));
      const gMinX = Math.min(...starts.map(s => s.x));
      const gMinY = Math.min(...starts.map(s => s.y));
      const gMaxX = Math.max(...starts.map(s => s.x + s.w));
      const gMaxY = Math.max(...starts.map(s => s.y + s.h));
      const move = (ev) => {
        let dx = (ev.clientX - startX) / SCALE;
        let dy = (ev.clientY - startY) / SCALE;
        dx = Math.round(dx * 2) / 2;
        dy = Math.round(dy * 2) / 2;
        dx = Math.max(-gMinX, Math.min(size.w - gMaxX, dx));
        dy = Math.max(-gMinY, Math.min(size.d - gMaxY, dy));
        const startsById = Object.fromEntries(starts.map(s => [s.id, s]));
        setItems(prev => prev.map(p => {
          const s = startsById[p.id];
          if (!s) return p;
          return { ...p, x: s.x + dx, y: s.y + dy };
        }));
      };
      const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
      return;
    }

    // Group drag: if the item is in a group, move ALL group members by the same
    // delta. Capture every group member's starting position, the bounding box of
    // the whole group, and clamp the drag delta so the group stays inside the
    // stage. The group's drag delta is rounded to whole feet (snap behavior at
    // the group level) so the cluster keeps its relative spacing.
    if (item.groupId) {
      const groupMembers = items.filter(i => i.groupId === item.groupId);
      const starts = groupMembers.map(m => ({ id: m.id, x: m.x, y: m.y, w: m.w, h: m.h }));
      // Bounding box of the group at start.
      const gMinX = Math.min(...starts.map(s => s.x));
      const gMinY = Math.min(...starts.map(s => s.y));
      const gMaxX = Math.max(...starts.map(s => s.x + s.w));
      const gMaxY = Math.max(...starts.map(s => s.y + s.h));
      const move = (ev) => {
        let dx = (ev.clientX - startX) / SCALE;
        let dy = (ev.clientY - startY) / SCALE;
        // Snap the group drag delta to half-foot increments so the cluster
        // shifts by half-foot units while preserving its relative spacing.
        dx = Math.round(dx * 2) / 2;
        dy = Math.round(dy * 2) / 2;
        // Clamp delta so no group member leaves the stage.
        dx = Math.max(-gMinX, Math.min(size.w - gMaxX, dx));
        dy = Math.max(-gMinY, Math.min(size.d - gMaxY, dy));
        const startsById = Object.fromEntries(starts.map(s => [s.id, s]));
        setItems(prev => prev.map(p => {
          const s = startsById[p.id];
          if (!s) return p;
          return { ...p, x: s.x + dx, y: s.y + dy };
        }));
      };
      const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
      setSelectedId(id);
      return;
    }

    // Single-item drag. Snap rounds to nearest 0.5 ft (half-foot grid) for finer
    // positioning while still feeling structured.
    const ix = item.x, iy = item.y;
    const snap = item.snap !== false;
    const move = (ev) => {
      const dx = (ev.clientX - startX) / SCALE;
      const dy = (ev.clientY - startY) / SCALE;
      let nx = ix + dx;
      let ny = iy + dy;
      if (snap) { nx = snapCenter(nx, item.w); ny = snapCenter(ny, item.h); }
      updateItem(id, {
        x: Math.max(0, Math.min(size.w - item.w, nx)),
        y: Math.max(0, Math.min(size.d - item.h, ny)),
      });
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    setSelectedId(id);
  };

  // Stage color theming.
  //   "blue"  = Blueprint Blue stage rectangle on the Stage Black header surround (so the blue pops)
  //   "white" = warmer Bone (#F1ECDD) stage rectangle on the original Blueprint Blue surround
  // Surround color is mode-specific: Stage Black for Blue mode (matches the top header),
  // Blueprint Blue for White mode.
  const stageColor = size.color || "blue";
  const isWhite = stageColor === "white";
  const canvasBg = isWhite ? BRAND.blue : BRAND.black;
  const stageFillBg = isWhite ? "#F1ECDD" : BRAND.blue;
  const stageBorder = isWhite ? "rgba(14,14,14,0.35)" : "rgba(244,241,234,0.25)";
  const gridLine = isWhite ? "rgba(14,14,14,0.22)" : "rgba(244,241,234,0.18)";
  // Slightly thicker lines on White stage to give them presence over the cream.
  const gridLineWidth = isWhite ? 2 : 1;
  // Audience/Upstage labels sit OUTSIDE the stage rectangle — Bone reads on both surrounds.
  const audienceColor = BRAND.bone;

  // Color swatch renderer for Blue/White toggle below.
  const ColorSwatch = ({ value, label, swatchBg, gridSwatch }) => {
    const sel = stageColor === value;
    return (
      <button type="button"
        onClick={() => setSize(s => ({ ...s, color: value }))}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
          padding: "4px 6px",
          height: 48, // pinned to match the Builder Guide button for a uniform baseline
          background: sel ? "rgba(212,100,30,0.10)" : "transparent",
          border: `1px solid ${sel ? BRAND.orange : "rgba(244,241,234,0.20)"}`,
          borderRadius: 2, cursor: "pointer",
        }}>
        <div style={{
          width: 36, height: 22, background: swatchBg,
          backgroundImage: `linear-gradient(to right, ${gridSwatch} 1px, transparent 1px), linear-gradient(to bottom, ${gridSwatch} 1px, transparent 1px)`,
          backgroundSize: "6px 6px",
          border: `1px solid ${sel ? BRAND.orange : "rgba(244,241,234,0.20)"}`,
          borderRadius: 1,
        }}/>
        <span style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
          color: sel ? BRAND.orange : "rgba(244,241,234,0.65)",
        }}>{label}</span>
      </button>
    );
  };

  return (
    <div>
      {/* Compact section header — section title only. The Builder Guide button
          moved into the controls row below to recover vertical space for the canvas. */}
      <div className="mb-3 pb-2 flex items-end" style={{ borderBottom: "1px solid rgba(244,241,234,0.10)" }}>
        <Mono style={{
          fontSize: 16, color: BRAND.bone, fontWeight: 800,
          letterSpacing: "0.20em", textTransform: "uppercase",
        }}>STAGE PLOT BUILDER</Mono>
      </div>

      {/* Stage controls bar — Help | Dimensions | Color | Grid | Guides | History */}
      <div className="mb-3 flex items-start gap-8 flex-wrap" style={{ position: "relative" }}>
        <div>
          <Mono style={{ fontSize: 10, color: "rgba(244,241,234,0.55)", letterSpacing: "0.18em" }}>HELP</Mono>
          <div className="mt-2 relative">
            <button type="button" onClick={() => setGuideOpen(o => !o)}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                padding: "0 16px",
                height: 48, // match the color swatch outer height for a uniform baseline
                background: guideOpen ? BRAND.orange : "rgba(212,100,30,0.12)",
                border: `1px solid ${BRAND.orange}`,
                color: guideOpen ? BRAND.black : BRAND.orange,
                borderRadius: 2,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase",
                fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
              }}>
              ▤ Builder Guide
            </button>
            {guideOpen && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: "absolute", top: "100%", left: 0, marginTop: 6,
                  width: 380, padding: 16, zIndex: 50,
                  backgroundColor: BRAND.black,
                  border: `1px solid ${BRAND.orange}`,
                  borderRadius: 2,
                  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                }}>
                <div className="flex items-start justify-between mb-3">
                  <Mono style={{ fontSize: 11, color: BRAND.orange, letterSpacing: "0.18em", fontWeight: 700 }}>
                    Stage Plot Builder Guide
                  </Mono>
                  <button onClick={() => setGuideOpen(false)}
                    style={{ color: "rgba(244,241,234,0.55)", fontSize: 14, lineHeight: 1, cursor: "pointer", background: "none", border: "none" }}>×</button>
                </div>
                <div style={{ fontSize: 11.5, lineHeight: 1.55, color: "rgba(244,241,234,0.85)" }}>
                  <div style={{ marginBottom: 10 }}>
                    Drag items from the library onto the stage. Click any item to edit, scale, rotate, or assign a channel.
                  </div>
                  <div style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 9, letterSpacing: "0.18em", color: "rgba(244,241,234,0.50)",
                    textTransform: "uppercase", marginTop: 12, marginBottom: 6,
                  }}>Item Editing</div>
                  <ul style={{ paddingLeft: 14, marginBottom: 4 }}>
                    <li><b>Layer</b> — Floor / Default / Top tier picker.</li>
                    <li><b>Snap to Grid</b> — per item, default On. Turn off for free-form positioning.</li>
                    <li><b>Rotation</b> — slider or 90° button for compatible items.</li>
                  </ul>
                  <div style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 9, letterSpacing: "0.18em", color: "rgba(244,241,234,0.50)",
                    textTransform: "uppercase", marginTop: 12, marginBottom: 6,
                  }}>Keyboard Shortcuts</div>
                  <ul style={{ paddingLeft: 14, marginBottom: 4 }}>
                    <li><b>Arrow keys</b> — nudge selected item 1 ft.</li>
                    <li><b>Shift + Arrow</b> — nudge 0.5 ft (snap-aware).</li>
                    <li><b>Cmd/Ctrl + Z</b> — undo. <b>Shift+Z</b> or <b>Y</b> — redo.</li>
                  </ul>
                  <div style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 9, letterSpacing: "0.18em", color: "rgba(244,241,234,0.50)",
                    textTransform: "uppercase", marginTop: 12, marginBottom: 6,
                  }}>Output</div>
                  <ul style={{ paddingLeft: 14, marginBottom: 0 }}>
                    <li>The plot prints in the rider preview&apos;s Stage Plot section.</li>
                    <li>Choose Live / Uploaded / Both via <b>Stage Plot Source</b> in the sidebar or General Info.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
        <div>
          <Mono style={{ fontSize: 10, color: "rgba(244,241,234,0.55)", letterSpacing: "0.18em" }}>STAGE DIMENSIONS</Mono>
          <div className="mt-2 flex items-center gap-2" style={{ height: 30 }}>
            <Input type="number" min={10} max={80} value={size.w}
              title="Width (ft)"
              style={{ width: 64, textAlign: "center" }}
              onChange={e => setSize(s => ({ ...s, w: Math.max(10, Math.min(80, parseInt(e.target.value)||40)) }))}/>
            <span style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 12, color: "rgba(244,241,234,0.55)", letterSpacing: "0.10em",
            }}>×</span>
            <Input type="number" min={10} max={80} value={size.d}
              title="Depth (ft)"
              style={{ width: 64, textAlign: "center" }}
              onChange={e => setSize(s => ({ ...s, d: Math.max(10, Math.min(80, parseInt(e.target.value)||30)) }))}/>
            <span style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 9, color: "rgba(244,241,234,0.45)", letterSpacing: "0.18em",
              textTransform: "uppercase", marginLeft: 2,
            }}>ft</span>
          </div>
        </div>

        <div>
          <Mono style={{ fontSize: 10, color: "rgba(244,241,234,0.55)", letterSpacing: "0.18em" }}>STAGE COLOR</Mono>
          <div className="mt-2 flex items-center gap-2">
            <ColorSwatch value="blue" label="Blue" swatchBg={BRAND.blue} gridSwatch="rgba(244,241,234,0.30)" />
            <ColorSwatch value="white" label="White" swatchBg="#F1ECDD" gridSwatch="rgba(14,14,14,0.10)" />
          </div>
        </div>

        <div>
          <Mono style={{ fontSize: 10, color: "rgba(244,241,234,0.55)", letterSpacing: "0.18em" }}>GRID</Mono>
          <div className="mt-2">
            <button type="button"
              onClick={() => setSize(s => ({ ...s, grid: s.grid === false ? true : false }))}
              aria-pressed={size.grid !== false}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "flex-start", gap: 8,
                padding: "6px 10px",
                width: 78, // fixed width so toggle stays put when "On" → "Off" text changes
                background: (size.grid !== false) ? "rgba(212,100,30,0.10)" : "transparent",
                border: `1px solid ${(size.grid !== false) ? BRAND.orange : "rgba(244,241,234,0.20)"}`,
                borderRadius: 2, cursor: "pointer",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                color: (size.grid !== false) ? BRAND.orange : "rgba(244,241,234,0.65)",
              }}>
              <span style={{
                position: "relative", display: "inline-block",
                width: 24, height: 12, borderRadius: 999, flexShrink: 0,
                background: (size.grid !== false) ? BRAND.orange : "rgba(244,241,234,0.20)",
                transition: "background 120ms ease",
              }}>
                <span style={{
                  position: "absolute", top: 1, left: (size.grid !== false) ? 13 : 1,
                  width: 10, height: 10, borderRadius: 999, background: BRAND.bone,
                  transition: "left 120ms ease",
                }}/>
              </span>
              <span style={{ display: "inline-block", textAlign: "left" }}>
                {(size.grid !== false) ? "On" : "Off"}
              </span>
            </button>
          </div>
        </div>

        <div>
          <Mono style={{ fontSize: 10, color: "rgba(244,241,234,0.55)", letterSpacing: "0.18em" }}>GUIDES</Mono>
          <div className="mt-2">
            <button type="button"
              onClick={() => setSize(s => ({ ...s, guides: s.guides === false ? true : false }))}
              aria-pressed={size.guides !== false}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "flex-start", gap: 8,
                padding: "6px 10px",
                width: 78,
                background: (size.guides !== false) ? "rgba(212,100,30,0.10)" : "transparent",
                border: `1px solid ${(size.guides !== false) ? BRAND.orange : "rgba(244,241,234,0.20)"}`,
                borderRadius: 2, cursor: "pointer",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                color: (size.guides !== false) ? BRAND.orange : "rgba(244,241,234,0.65)",
              }}>
              <span style={{
                position: "relative", display: "inline-block",
                width: 24, height: 12, borderRadius: 999, flexShrink: 0,
                background: (size.guides !== false) ? BRAND.orange : "rgba(244,241,234,0.20)",
                transition: "background 120ms ease",
              }}>
                <span style={{
                  position: "absolute", top: 1, left: (size.guides !== false) ? 13 : 1,
                  width: 10, height: 10, borderRadius: 999, background: BRAND.bone,
                  transition: "left 120ms ease",
                }}/>
              </span>
              <span style={{ display: "inline-block", textAlign: "left" }}>
                {(size.guides !== false) ? "On" : "Off"}
              </span>
            </button>
          </div>
        </div>

        {onUndo && onRedo && (
          <div>
            <Mono style={{ fontSize: 10, color: "rgba(244,241,234,0.55)", letterSpacing: "0.18em" }}>HISTORY</Mono>
            <div className="mt-2 flex items-center gap-1.5">
              <button type="button" onClick={onUndo} disabled={!canUndo}
                title="Undo (Cmd/Ctrl+Z)"
                style={{
                  padding: "5px 10px",
                  background: canUndo ? "transparent" : "transparent",
                  border: `1px solid ${canUndo ? "rgba(244,241,234,0.20)" : "rgba(244,241,234,0.08)"}`,
                  borderRadius: 2, cursor: canUndo ? "pointer" : "not-allowed",
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                  color: canUndo ? "rgba(244,241,234,0.80)" : "rgba(244,241,234,0.30)",
                }}>
                ↶ Undo
              </button>
              <button type="button" onClick={onRedo} disabled={!canRedo}
                title="Redo (Cmd/Ctrl+Shift+Z)"
                style={{
                  padding: "5px 10px",
                  background: canRedo ? "transparent" : "transparent",
                  border: `1px solid ${canRedo ? "rgba(244,241,234,0.20)" : "rgba(244,241,234,0.08)"}`,
                  borderRadius: 2, cursor: canRedo ? "pointer" : "not-allowed",
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                  color: canRedo ? "rgba(244,241,234,0.80)" : "rgba(244,241,234,0.30)",
                }}>
                Redo ↷
              </button>
            </div>
          </div>
        )}

        <div>
          <Mono style={{ fontSize: 10, color: "rgba(244,241,234,0.55)", letterSpacing: "0.18em" }}>ZOOM</Mono>
          <div className="mt-2 flex items-center gap-1.5">
            <button type="button" onClick={() => stepZoom(-1)} disabled={zoom <= ZOOM_STOPS[0]}
              title="Zoom out"
              style={{
                width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent",
                border: `1px solid ${zoom > ZOOM_STOPS[0] ? "rgba(244,241,234,0.20)" : "rgba(244,241,234,0.08)"}`,
                borderRadius: 2, cursor: zoom > ZOOM_STOPS[0] ? "pointer" : "not-allowed",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 13, fontWeight: 700,
                color: zoom > ZOOM_STOPS[0] ? "rgba(244,241,234,0.80)" : "rgba(244,241,234,0.30)",
              }}>
              −
            </button>
            <span style={{
              minWidth: 46, textAlign: "center",
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
              color: "rgba(244,241,234,0.80)",
            }}>
              {Math.round(zoom * 100)}%
            </span>
            <button type="button" onClick={() => stepZoom(1)} disabled={zoom >= ZOOM_STOPS[ZOOM_STOPS.length - 1]}
              title="Zoom in"
              style={{
                width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent",
                border: `1px solid ${zoom < ZOOM_STOPS[ZOOM_STOPS.length-1] ? "rgba(244,241,234,0.20)" : "rgba(244,241,234,0.08)"}`,
                borderRadius: 2, cursor: zoom < ZOOM_STOPS[ZOOM_STOPS.length-1] ? "pointer" : "not-allowed",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 13, fontWeight: 700,
                color: zoom < ZOOM_STOPS[ZOOM_STOPS.length-1] ? "rgba(244,241,234,0.80)" : "rgba(244,241,234,0.30)",
              }}>
              +
            </button>
            <button type="button" onClick={() => setZoom(1)}
              title="Reset zoom to Fit"
              style={{
                padding: "5px 10px", height: 26,
                background: zoom === 1 ? "rgba(212,100,30,0.10)" : "transparent",
                border: `1px solid ${zoom === 1 ? BRAND.orange : "rgba(244,241,234,0.20)"}`,
                borderRadius: 2, cursor: "pointer",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                color: zoom === 1 ? BRAND.orange : "rgba(244,241,234,0.80)",
              }}>
              Fit
            </button>
          </div>
        </div>
      </div>

      <div>
        <div ref={wrapperRef}
          className="relative flex items-center justify-center"
          style={{
            backgroundColor: canvasBg,
            border: "1px solid rgba(244,241,234,0.10)",
            borderRadius: 2,
            padding: 24,
            // Fixed height (not minHeight) — the surround pane is a stable
            // viewport. When the stage is zoomed past Fit it overflows this
            // box and scrolls INTERNALLY, instead of growing the pane and
            // pushing the whole page down. That keeps the stage (and its
            // centerline / mid-stage guides) anchored to a fixed on-screen
            // center across every zoom level, rather than drifting with zoom.
            height: "calc(100vh - 260px)",
            width: "100%",
            overflow: "auto",
          }}
          onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
          {/* Architectural frame — present in both color modes. Pure decoration:
              hairline border ~14px in from each edge of the surround pane, with
              L-bracket corner marks. Pointer-events:none so it never blocks dropping. */}
          <div aria-hidden="true" style={{
            position: "absolute",
            top: 14, left: 14, right: 14, bottom: 14,
            border: "1px solid rgba(244,241,234,0.18)",
            pointerEvents: "none",
            zIndex: 0,
          }}>
            {/* Corner L-brackets — small accents that punch up the frame intersections */}
            {[
              { top: -1, left: -1, b: ["top","left"] },
              { top: -1, right: -1, b: ["top","right"] },
              { bottom: -1, left: -1, b: ["bottom","left"] },
              { bottom: -1, right: -1, b: ["bottom","right"] },
            ].map((c, i) => (
              <div key={i} style={{
                position: "absolute",
                width: 14, height: 14,
                top: c.top, left: c.left, right: c.right, bottom: c.bottom,
                borderTop: c.b.includes("top") ? "2px solid rgba(244,241,234,0.55)" : "none",
                borderBottom: c.b.includes("bottom") ? "2px solid rgba(244,241,234,0.55)" : "none",
                borderLeft: c.b.includes("left") ? "2px solid rgba(244,241,234,0.55)" : "none",
                borderRight: c.b.includes("right") ? "2px solid rgba(244,241,234,0.55)" : "none",
              }}/>
            ))}
          </div>
          <div ref={stageRef}
            onMouseDown={(e) => {
              // Only start a marquee on background mousedown — items handle their own onMouseDown
              // and stopPropagation via the dragger. e.target === currentTarget means the click
              // hit the stage div itself, not a child item.
              if (e.target !== e.currentTarget) return;
              // Don't start a marquee if user is mid-library-drag.
              if (dragLib) return;
              const rect = stageRef.current.getBoundingClientRect();
              const startXft = (e.clientX - rect.left) / SCALE;
              const startYft = (e.clientY - rect.top) / SCALE;
              let curMarquee = { x1: startXft, y1: startYft, x2: startXft, y2: startYft };
              setMarquee(curMarquee);
              let didDrag = false;
              const onMove = (ev) => {
                const curX = (ev.clientX - rect.left) / SCALE;
                const curY = (ev.clientY - rect.top) / SCALE;
                curMarquee = { x1: startXft, y1: startYft, x2: curX, y2: curY };
                setMarquee(curMarquee);
                if (Math.abs(curX - startXft) > 0.1 || Math.abs(curY - startYft) > 0.1) didDrag = true;
              };
              const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
                if (!didDrag) {
                  // Click on empty canvas (no drag) — deselect everything.
                  setMarquee(null);
                  setSelectedIds([]);
                  return;
                }
                // Marquee was drawn — collect items whose footprints intersect it.
                const mLeft = Math.min(curMarquee.x1, curMarquee.x2);
                const mRight = Math.max(curMarquee.x1, curMarquee.x2);
                const mTop = Math.min(curMarquee.y1, curMarquee.y2);
                const mBottom = Math.max(curMarquee.y1, curMarquee.y2);
                const hit = items.filter(it => {
                  const iL = it.x, iR = it.x + it.w, iT = it.y, iB = it.y + it.h;
                  return iL < mRight && iR > mLeft && iT < mBottom && iB > mTop;
                }).map(it => it.id);
                setSelectedIds(hit);
                setMarquee(null);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            }}
            className="relative"
            style={{
              width: stageWpx, height: stageDpx,
              backgroundColor: stageFillBg,
              border: `1px solid ${stageBorder}`,
              backgroundImage: (size.grid === false) ? "none" : `linear-gradient(to right, ${gridLine} ${gridLineWidth}px, transparent ${gridLineWidth}px), linear-gradient(to bottom, ${gridLine} ${gridLineWidth}px, transparent ${gridLineWidth}px)`,
              backgroundSize: `${SCALE}px ${SCALE}px`,
              zIndex: 1,
            }}>
            {/* Stage guides — Centerline (vertical) and Mid-stage (horizontal).
                Both stretch edge-to-edge inside the stage rectangle as faint
                hairlines so the user can sight the four quadrants while placing
                items. Centerline gets slightly more weight since it's the more
                critical reference (everything is positioned relative to center).
                Pointer-events:none so they never block drops or item drags. */}
            {size.guides !== false && (
              <>
                <div aria-hidden="true" style={{
                  position: "absolute",
                  top: 0, bottom: 0, left: "50%",
                  width: 0,
                  borderLeft: `1.5px solid ${isWhite ? "rgba(14,14,14,0.32)" : "rgba(244,241,234,0.38)"}`,
                  pointerEvents: "none",
                  zIndex: 2,
                }}/>
                <div aria-hidden="true" style={{
                  position: "absolute",
                  left: 0, right: 0, top: "50%",
                  height: 0,
                  borderTop: `1px solid ${isWhite ? "rgba(14,14,14,0.25)" : "rgba(244,241,234,0.30)"}`,
                  pointerEvents: "none",
                  zIndex: 2,
                }}/>
              </>
            )}
            {/* Dimension marks — present in both color modes. Architectural style:
                hairline rule with end-brackets pointing inward, mono numeric callout
                in the middle. Width line above the stage, depth line to the right.
                They track the stage's actual width/depth as the user changes them. */}
            <>
                {/* Top: width dimension — sits above the UPSTAGE label */}
                <div aria-hidden="true" style={{
                  position: "absolute",
                  left: 0, right: 0, top: -62, height: 14,
                  pointerEvents: "none",
                }}>
                  <div style={{
                    position: "absolute", left: 0, right: 0, top: 7, height: 1,
                    background: "rgba(244,241,234,0.35)",
                  }}/>
                  <div style={{ position: "absolute", left: 0, top: 0, width: 1, height: 14, background: "rgba(244,241,234,0.55)" }}/>
                  <div style={{ position: "absolute", right: 0, top: 0, width: 1, height: 14, background: "rgba(244,241,234,0.55)" }}/>
                  <div style={{
                    position: "absolute", left: "50%", top: 0,
                    transform: "translate(-50%, -2px)",
                    background: canvasBg, padding: "0 8px",
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 11, color: BRAND.bone, letterSpacing: "0.16em",
                  }}>
                    {size.w}&apos;
                  </div>
                </div>
                {/* Right: depth dimension */}
                <div aria-hidden="true" style={{
                  position: "absolute",
                  top: 0, bottom: 0, right: -56, width: 14,
                  pointerEvents: "none",
                }}>
                  <div style={{
                    position: "absolute", top: 0, bottom: 0, left: 7, width: 1,
                    background: "rgba(244,241,234,0.35)",
                  }}/>
                  <div style={{ position: "absolute", top: 0, left: 0, width: 14, height: 1, background: "rgba(244,241,234,0.55)" }}/>
                  <div style={{ position: "absolute", bottom: 0, left: 0, width: 14, height: 1, background: "rgba(244,241,234,0.55)" }}/>
                  <div style={{
                    position: "absolute", top: "50%", left: 0,
                    transform: "translate(-2px, -50%)",
                    background: canvasBg, padding: "4px 0",
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 11, color: BRAND.bone, letterSpacing: "0.16em",
                    writingMode: "vertical-rl",
                  }}>
                    {size.d}&apos;
                  </div>
                </div>
            </>
            <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: -32 }}>
              <Mono style={{ fontSize: 12, color: audienceColor, opacity: 0.85, letterSpacing: "0.18em" }}>↓ AUDIENCE ↓</Mono>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2" style={{ top: -32 }}>
              <Mono style={{ fontSize: 12, color: audienceColor, opacity: 0.85, letterSpacing: "0.18em" }}>UPSTAGE</Mono>
            </div>

            {/* Group bounding-box highlight: when the selected item is part of a
                group, draw a subtle dashed rect around the group's outer bounds
                so the user can see what's grouped together. Pointer-events:none
                so it never blocks clicks on the items inside. */}
            {(() => {
              const sel = items.find(i => i.id === selectedId);
              if (!sel || !sel.groupId) return null;
              const members = items.filter(i => i.groupId === sel.groupId);
              if (members.length < 2) return null;
              const minX = Math.min(...members.map(m => m.x));
              const minY = Math.min(...members.map(m => m.y));
              const maxX = Math.max(...members.map(m => m.x + m.w));
              const maxY = Math.max(...members.map(m => m.y + m.h));
              const PAD = 0.25; // ft of breathing room around the bounding box
              return (
                <div aria-hidden="true" style={{
                  position: "absolute",
                  left: (minX - PAD) * SCALE,
                  top: (minY - PAD) * SCALE,
                  width: (maxX - minX + PAD * 2) * SCALE,
                  height: (maxY - minY + PAD * 2) * SCALE,
                  border: `1px dashed ${BRAND.orange}`,
                  borderRadius: 2,
                  pointerEvents: "none",
                  zIndex: 99999, // above items but doesn't block them (pointer-events:none)
                }}/>
              );
            })()}

            {/* Live marquee rectangle while the user is dragging a selection. */}
            {marquee && (() => {
              const x = Math.min(marquee.x1, marquee.x2) * SCALE;
              const y = Math.min(marquee.y1, marquee.y2) * SCALE;
              const w = Math.abs(marquee.x2 - marquee.x1) * SCALE;
              const h = Math.abs(marquee.y2 - marquee.y1) * SCALE;
              return (
                <div aria-hidden="true" style={{
                  position: "absolute",
                  left: x, top: y, width: w, height: h,
                  border: `1px dashed ${BRAND.orange}`,
                  background: "rgba(212,100,30,0.06)",
                  pointerEvents: "none",
                  zIndex: 99998,
                }}/>
              );
            })()}

            {/* Multi-select bounding box: when more than one item is selected, draw
                a dashed orange rect around their combined bounding box. */}
            {selectedIds.length > 1 && (() => {
              const sel = items.filter(i => selectedSet.has(i.id));
              if (sel.length < 2) return null;
              const minX = Math.min(...sel.map(s => s.x));
              const minY = Math.min(...sel.map(s => s.y));
              const maxX = Math.max(...sel.map(s => s.x + s.w));
              const maxY = Math.max(...sel.map(s => s.y + s.h));
              const PAD = 0.25;
              return (
                <div aria-hidden="true" style={{
                  position: "absolute",
                  left: (minX - PAD) * SCALE,
                  top: (minY - PAD) * SCALE,
                  width: (maxX - minX + PAD * 2) * SCALE,
                  height: (maxY - minY + PAD * 2) * SCALE,
                  border: `1.5px dashed ${BRAND.orange}`,
                  borderRadius: 2,
                  pointerEvents: "none",
                  zIndex: 99999,
                }}/>
              );
            })()}

            {items.map((it, itemIdx) => {
              const inSelection = selectedSet.has(it.id);
              const isSoleSelection = inSelection && selectedIds.length === 1;
              const active = isSoleSelection; // legacy "fully selected" — only true for single-select
              const multiActive = inSelection && selectedIds.length > 1;
              const hasIcon = !!it.icon;
              const isChannelPin = it.type === "channel-pin";
              const rotatable = it.rotatable !== false;
              // Stacking: layer band (Floor=100, Default=1000, Top=2000) + array index
              // (so later-dropped items in the same layer stack on top of earlier ones).
              // Active item gets a +100000 boost so the user can always see what they've
              // selected.
              const layerBase = it.layer === "floor" ? 100 : (it.layer === "top" ? 2000 : 1000);
              const zBase = layerBase + itemIdx;
              return (
                <div key={it.id}
                  onMouseDown={(e) => onItemDrag(e, it.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    // If the item is already part of a multi-selection, preserve it.
                    if (selectedIds.length > 1 && selectedSet.has(it.id)) return;
                    // If the item is part of a group, select the WHOLE group so
                    // clicking any member highlights/selects all of them.
                    // (Double-click on a grouped item drills into the single
                    // piece — see onDoubleClick handler below.)
                    if (it.groupId) {
                      const groupIds = items.filter(i => i.groupId === it.groupId).map(i => i.id);
                      setSelectedIds(groupIds);
                      return;
                    }
                    // Plain single-item select.
                    setSelectedIds([it.id]);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    // Double-click "drills in" to a single item even when it's
                    // part of a group — so you can edit just this piece's label,
                    // channel, notes, etc. without ungrouping. Group is preserved
                    // (groupId stays on the items); it's purely a selection change.
                    setSelectedIds([it.id]);
                  }}
                  className={cls(
                    "absolute flex items-center justify-center select-none cursor-move transition-shadow",
                    !hasIcon && it.shape === "circle" ? "rounded-full" : "",
                    !hasIcon && it.shape === "diamond" ? "rotate-45" : ""
                  )}
                  style={{
                    left: it.x * SCALE, top: it.y * SCALE,
                    width: it.w * SCALE, height: it.h * SCALE,
                    transform: rotatable ? `rotate(${it.rot || 0}deg)` : "none",
                    backgroundColor: isChannelPin
                      ? "rgba(212,100,30,0.92)"  // orange pill, sits above icons
                      : (hasIcon ? "transparent" : BRAND.bone),
                    // Icon items: footprint outline always hidden — the icon IS the visual.
                    // Channel pins: solid orange pill so they read against any stage tile.
                    // Selection still works (inspector populates) but no orange ring on canvas.
                    // Non-icon items keep their always-visible border + active highlight.
                    // Multi-select: subtle 1px orange dashed accent on each member (the
                    // bounding box rendered above does the heavy lifting).
                    border: isChannelPin
                      ? `1px solid ${active || multiActive ? BRAND.bone : "rgba(14,14,14,0.55)"}`
                      : (hasIcon
                          ? (multiActive ? `1px dashed ${BRAND.orange}` : "1px solid transparent")
                          : `1px solid ${active ? BRAND.orange : (multiActive ? BRAND.orange : BRAND.black)}`),
                    borderRadius: isChannelPin ? 3 : undefined,
                    boxShadow: (!hasIcon && !isChannelPin && active) ? `0 0 0 2px ${BRAND.orange}` : (isChannelPin && active ? `0 0 0 2px ${BRAND.bone}` : "none"),
                    color: isChannelPin ? BRAND.black : BRAND.black,
                    zIndex: (active || multiActive) ? zBase + 100000 : zBase,
                    // Allow icon to overflow the footprint when displayScale > 1.
                    overflow: hasIcon && (it.displayScale || 1) > 1 ? "visible" : "hidden",
                  }}>
                  {isChannelPin ? (() => {
                    // Channel pin label rendering. Look up the live source +
                    // channel position by inputId. If the input row was
                    // deleted, fall back to the stored channel/label and
                    // render a "broken link" treatment so the user notices.
                    const linked = it.inputId ? inputsById.get(it.inputId) : null;
                    const isBroken = !!it.inputId && !linked;
                    const liveLabel = linked
                      ? `CH${linked.channel.label} · ${linked.input.source || "—"}`
                      : (it.label
                          ? `CH${it.isStereo && it.channelEnd ? `${it.channelStart}-${it.channelEnd}` : (it.channelStart || "?")} · ${it.label}`
                          : "CH?");
                    // Auto-fit font to the pin width — but scale the upper
                    // bound with the pin's user-chosen size (pinScale, 0.5..
                    // 1.5x) so a "label size" slider in the Inspector actually
                    // changes the visible font weight on the canvas, not just
                    // the orange pill behind it. Floor at 5px so a 0.5x pin
                    // is still legible.
                    const itemWpx = it.w * SCALE;
                    const padPx = 6;
                    const pinScale = it.pinScale ?? 1;
                    const maxLabel = Math.max(6, 11 * pinScale);
                    let labelSize = maxLabel;
                    while (labelSize > 5 && liveLabel.length * labelSize * 0.62 > itemWpx - padPx) {
                      labelSize -= 0.5;
                    }
                    return (
                      <span style={{
                        position: "absolute",
                        left: 0, right: 0, top: "50%",
                        transform: "translateY(-50%)",
                        textAlign: "center",
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        fontSize: labelSize, fontWeight: 700, letterSpacing: "0.04em",
                        color: isBroken ? "rgba(14,14,14,0.55)" : BRAND.black,
                        textDecoration: isBroken ? "line-through" : "none",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        padding: "0 4px",
                        zIndex: 1,
                      }}>{liveLabel.toUpperCase()}</span>
                    );
                  })() : hasIcon ? (
                    <>
                      {/* Icon visually scaled up by displayScale (default 1) while
                          the footprint stays at w x h. The img is absolutely positioned
                          at center and overflows the parent if displayScale > 1.
                          IMPORTANT: maxWidth:none overrides Tailwind's preflight reset
                          (`img { max-width: 100% }`) which would otherwise clamp the
                          scaled width back down to 100% of parent. */}
                      <img src={it.icon} alt={it.label}
                        style={{
                          position: "absolute",
                          left: "50%", top: "50%",
                          width: `${(it.displayScale || 1) * 100}%`,
                          height: `${(it.displayScale || 1) * 100}%`,
                          maxWidth: "none",
                          transform: "translate(-50%, -50%)",
                          objectFit: "contain",
                          pointerEvents: "none",
                          // Full-color icon illustrations render with normal compositing
                          // (no mix-blend) so colors stay true on any stage background.
                        }}/>
                      {it.channel && (
                        <span style={{
                          position: "absolute", bottom: 1, right: 2,
                          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                          fontSize: 8, fontWeight: 700, letterSpacing: "0.04em",
                          color: BRAND.orange,
                          backgroundColor: "rgba(244,241,234,0.85)",
                          padding: "0 3px", borderRadius: 1,
                          zIndex: 2,
                        }}>CH{it.channel}</span>
                      )}
                    </>
                  ) : (() => {
                    // Auto-size the label so it fits the item's footprint without
                    // spilling. Approximate: a JetBrains Mono character at fontSize N
                    // is ~N*0.62 px wide. We get available px from the item's
                    // smaller dimension and the label's length, then clamp 7..11.
                    // If label was already going to fit at 11, leave it at 11.
                    const itemWpx = it.w * SCALE;
                    const labelLen = (it.label || "").length;
                    const padPx = 6; // breathing room inside the box
                    const maxPxAtN = (n) => labelLen * n * 0.62; // approx mono width
                    let labelSize = 11;
                    while (labelSize > 7 && maxPxAtN(labelSize) > itemWpx - padPx) {
                      labelSize -= 0.5;
                    }
                    return (
                      <>
                        {/* Detail layer: small visual hints (key clusters, speaker cones,
                            mic heads, etc.) rendered as inline SVG so they scale with the
                            item box. Coords in `details` are normalized 0..1. */}
                        <ItemDetailLayer details={it.details} w={it.w} h={it.h}/>
                        {/* Label: position depends on `labelPos`. `bottom` puts it in the
                            lower band of the box (good when details fill the top half),
                            `top` does the inverse, default is centered. Font size auto-shrinks
                            to fit the footprint (down to 7px floor) so labels never spill. */}
                        <span className={cls("text-center px-0.5 leading-tight whitespace-nowrap", it.shape === "diamond" && "-rotate-45")}
                          style={{
                            position: "absolute",
                            left: 0, right: 0,
                            top: it.labelPos === "top" ? "8%" : (it.labelPos === "bottom" ? "auto" : "50%"),
                            bottom: it.labelPos === "bottom" ? "8%" : "auto",
                            transform: it.labelPos === "top" || it.labelPos === "bottom" ? "none" : "translateY(-50%)",
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                            fontSize: labelSize, fontWeight: 700, letterSpacing: "0.04em",
                            zIndex: 1,
                          }}>
                          {it.label.toUpperCase()}{it.channel && <><br/>CH{it.channel}</>}
                        </span>
                      </>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-3 text-center">
          <Mono style={{ fontSize: 11, opacity: 0.7, letterSpacing: "0.16em", textTransform: "uppercase", color: BRAND.bone }}>
            Stage: {size.w}&apos; wide × {size.d}&apos; deep &nbsp;·&nbsp; 1 grid square = 1 ft
          </Mono>
        </div>
      </div>
    </div>
  );
}

// -------------------- STAGE PLOT PREVIEW (SVG, for rider preview) --------------------
// Renders the same data the editor uses (plotItems + plotSize) as a print-friendly
// SVG embedded in the rider preview. Uses the document's Bone/Stage Black palette
// rather than the editor's Blueprint Blue surround so it reads as part of the rider.
// Auto-fits to a target pixel width while preserving the stage's W:D aspect ratio.
function StagePlotPreview({ items = [], size = { w: 40, d: 25 } }) {
  const stageW = Math.max(1, size.w || 40);
  const stageD = Math.max(1, size.d || 30);

  // Layout constants (in SVG units = px). Stage rectangle gets MARGIN_X/Y of
  // breathing room inside the SVG for the dimension marks and orientation labels
  // to live in. Now that the architectural frame is gone, gutters are tighter
  // so the stage fills more of the canvas — small details read better in print.
  const MARGIN_X = 24; // just enough for the depth dim mark + number callout
  const MARGIN_TOP = 28;
  const MARGIN_BOTTOM = 24;
  const TARGET_W = 720; // rendered width inside the rider page
  // Compute pixel scale (px per ft) so the stage fits TARGET_W minus margins.
  const innerW = TARGET_W - MARGIN_X * 2;
  const PX_PER_FT = innerW / stageW;
  const stageWpx = stageW * PX_PER_FT;
  const stageDpx = stageD * PX_PER_FT;
  const totalH = stageDpx + MARGIN_TOP + MARGIN_BOTTOM;
  const totalW = TARGET_W;

  // Sort by layer band so floor renders below default below top.
  const layerRank = (l) => l === "floor" ? 0 : (l === "top" ? 2 : 1);
  const sorted = [...items].sort((a, b) => {
    const dr = layerRank(a.layer) - layerRank(b.layer);
    return dr !== 0 ? dr : 0; // stable: same layer keeps array order
  });

  // Stage rectangle origin in SVG space.
  const SX = MARGIN_X;
  const SY = MARGIN_TOP;

  // Hairline ink colors from the print palette.
  const ink = "rgba(14,14,14,0.92)";
  const inkSoft = "rgba(14,14,14,0.42)";
  const inkFaint = "rgba(14,14,14,0.18)";
  const inkGrid = "rgba(14,14,14,0.10)";

  // Build the grid: 1ft squares.
  const gridLines = [];
  if (size.grid !== false) {
    for (let x = 1; x < stageW; x++) {
      gridLines.push(<line key={`vx${x}`} x1={SX + x * PX_PER_FT} y1={SY} x2={SX + x * PX_PER_FT} y2={SY + stageDpx} stroke={inkGrid} strokeWidth={0.5}/>);
    }
    for (let y = 1; y < stageD; y++) {
      gridLines.push(<line key={`hy${y}`} x1={SX} y1={SY + y * PX_PER_FT} x2={SX + stageWpx} y2={SY + y * PX_PER_FT} stroke={inkGrid} strokeWidth={0.5}/>);
    }
  }

  // Render an item — supports rect / circle / diamond / trap shapes (matching the editor library).
  const renderItem = (it, idx) => {
    const cx = SX + (it.x + it.w / 2) * PX_PER_FT;
    const cy = SY + (it.y + it.h / 2) * PX_PER_FT;
    const w = it.w * PX_PER_FT;
    const h = it.h * PX_PER_FT;
    const rot = it.rotatable !== false ? (it.rot || 0) : 0;
    const transform = `rotate(${rot}, ${cx}, ${cy})`;
    const label = (it.label || "").toUpperCase();
    const channel = it.channel ? `CH${it.channel}` : "";
    // Bumped label scaling: floor 7.5, ceiling 9, sized by item width.
    const fontSize = Math.max(7.5, Math.min(9, w / 7));

    // Common stroke/fill for non-icon shapes.
    const fill = "rgba(244,241,234,0.85)"; // bone fill so they sit on white page cleanly
    const stroke = ink;
    const sw = 0.75;

    let shape;
    if (it.shape === "circle") {
      shape = <ellipse cx={cx} cy={cy} rx={w/2} ry={h/2} fill={fill} stroke={stroke} strokeWidth={sw}/>;
    } else if (it.shape === "diamond") {
      const dx = w / 2, dy = h / 2;
      shape = <polygon points={`${cx},${cy-dy} ${cx+dx},${cy} ${cx},${cy+dy} ${cx-dx},${cy}`} fill={fill} stroke={stroke} strokeWidth={sw}/>;
    } else if (it.shape === "trap") {
      // Trapezoid (wedge monitor look): wider top, narrow bottom angled toward the listener.
      const inset = w * 0.18;
      shape = <polygon points={`${cx-w/2},${cy-h/2} ${cx+w/2},${cy-h/2} ${cx+w/2-inset},${cy+h/2} ${cx-w/2+inset},${cy+h/2}`} fill={fill} stroke={stroke} strokeWidth={sw}/>;
    } else {
      // rect default
      shape = <rect x={cx-w/2} y={cy-h/2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={sw}/>;
    }

    // Render the per-item details as small SVG primitives, mapped from normalized
    // 0..1 coords (relative to the item box) into the item's actual pixel rect.
    // Circles render as true circles using r * min(w, h) so they don't distort.
    const renderDetails = () => {
      if (!it.details || it.details.length === 0) return null;
      const x0 = cx - w/2, y0 = cy - h/2;
      const minDim = Math.min(w, h);
      const DEFAULT_FILL = "rgba(14,14,14,0.55)";
      return it.details.map((d, i) => {
        if (d.type === "rect") {
          return <rect key={`d${i}`} x={x0 + d.x*w} y={y0 + d.y*h} width={d.w*w} height={d.h*h}
            fill={d.fill === undefined ? DEFAULT_FILL : d.fill}
            stroke={d.stroke || "none"}
            strokeWidth={d.strokeWidth || 0}/>;
        }
        if (d.type === "line") {
          return <line key={`d${i}`}
            x1={x0 + d.x1*w} y1={y0 + d.y1*h}
            x2={x0 + d.x2*w} y2={y0 + d.y2*h}
            stroke={d.stroke || DEFAULT_FILL}
            strokeWidth={d.strokeWidth || 1}/>;
        }
        if (d.type === "circle") {
          return <circle key={`d${i}`} cx={x0 + d.cx*w} cy={y0 + d.cy*h}
            r={d.r * minDim}
            fill={d.fill === undefined ? DEFAULT_FILL : d.fill}
            stroke={d.stroke || "none"}
            strokeWidth={d.strokeWidth || 0}/>;
        }
        return null;
      });
    };

    // Label vertical position: matches the canvas labelPos behavior so the print
    // looks the same as the editor.
    const labelY = (() => {
      if (it.labelPos === "bottom") return cy + h/2 - h*0.16;
      if (it.labelPos === "top") return cy - h/2 + h*0.20;
      return cy + (channel ? -1 : fontSize/3);
    })();

    // Icon items: render the PNG as an <image> filling the footprint (scaled by
    // displayScale, centered). No shape/details/label — the icon IS the visual.
    // A small channel tag still prints if a channel is assigned.
    if (it.icon) {
      const ds = it.displayScale || 1;
      const iw = w * ds, ih = h * ds;
      return (
        <g key={it.id || idx} transform={transform}>
          <image href={it.icon} x={cx - iw/2} y={cy - ih/2} width={iw} height={ih}
            preserveAspectRatio="xMidYMid meet"/>
          {channel && (
            <text x={cx} y={cy + h/2 - 2} textAnchor="middle"
              fontFamily="'JetBrains Mono', ui-monospace, monospace"
              fontSize={fontSize - 1} fontWeight={700} fill="#D4641E"
              style={{ letterSpacing: "0.04em" }}>
              {channel}
            </text>
          )}
        </g>
      );
    }

    return (
      <g key={it.id || idx} transform={transform}>
        {shape}
        {renderDetails()}
        {label && (
          <text x={cx} y={labelY} textAnchor="middle"
            fontFamily="'JetBrains Mono', ui-monospace, monospace"
            fontSize={fontSize} fontWeight={700} fill={ink}
            style={{ letterSpacing: "0.04em" }}>
            {label}
          </text>
        )}
        {channel && (
          <text x={cx} y={labelY + fontSize + 2} textAnchor="middle"
            fontFamily="'JetBrains Mono', ui-monospace, monospace"
            fontSize={fontSize - 1} fontWeight={700} fill="#D4641E"
            style={{ letterSpacing: "0.04em" }}>
            {channel}
          </text>
        )}
      </g>
    );
  };

  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      <svg className="stage-plot-preview" viewBox={`0 0 ${totalW} ${totalH}`} width="100%" height="auto"
        style={{ display: "block", maxWidth: "100%" }}
        preserveAspectRatio="xMidYMid meet">
        {/* Architectural frame + L-bracket corners removed — used to live here.
            Per user feedback (frame was eating canvas room); the rider preview
            now shows only the stage area, grid, dimension marks, and labels. */}

        {/* UPSTAGE label */}
        <text x={SX + stageWpx/2} y={SY - 18} textAnchor="middle"
          fontFamily="'JetBrains Mono', ui-monospace, monospace"
          fontSize={9} fontWeight={700} fill={ink}
          style={{ letterSpacing: "0.18em" }}>UPSTAGE</text>

        {/* Width dimension mark — above the stage, below UPSTAGE */}
        <g>
          <line x1={SX} y1={SY - 8} x2={SX + stageWpx} y2={SY - 8} stroke={inkSoft} strokeWidth={0.75}/>
          <line x1={SX} y1={SY - 12} x2={SX} y2={SY - 4} stroke={ink} strokeWidth={1}/>
          <line x1={SX + stageWpx} y1={SY - 12} x2={SX + stageWpx} y2={SY - 4} stroke={ink} strokeWidth={1}/>
          <rect x={SX + stageWpx/2 - 14} y={SY - 14} width={28} height={11} fill="rgba(244,241,234,1)"/>
          <text x={SX + stageWpx/2} y={SY - 6} textAnchor="middle"
            fontFamily="'JetBrains Mono', ui-monospace, monospace"
            fontSize={9} fontWeight={700} fill={ink}
            style={{ letterSpacing: "0.06em" }}>{size.w}&apos;</text>
        </g>

        {/* Depth dimension mark — to the right of the stage */}
        <g>
          <line x1={SX + stageWpx + 12} y1={SY} x2={SX + stageWpx + 12} y2={SY + stageDpx} stroke={inkSoft} strokeWidth={0.75}/>
          <line x1={SX + stageWpx + 8} y1={SY} x2={SX + stageWpx + 16} y2={SY} stroke={ink} strokeWidth={1}/>
          <line x1={SX + stageWpx + 8} y1={SY + stageDpx} x2={SX + stageWpx + 16} y2={SY + stageDpx} stroke={ink} strokeWidth={1}/>
          <rect x={SX + stageWpx + 6} y={SY + stageDpx/2 - 7} width={14} height={14} fill="rgba(244,241,234,1)"/>
          <text x={SX + stageWpx + 13} y={SY + stageDpx/2 + 3} textAnchor="middle"
            fontFamily="'JetBrains Mono', ui-monospace, monospace"
            fontSize={9} fontWeight={700} fill={ink}
            style={{ letterSpacing: "0.06em" }}>{size.d}&apos;</text>
        </g>

        {/* Stage rectangle */}
        <rect x={SX} y={SY} width={stageWpx} height={stageDpx}
          fill="rgba(14,14,14,0.02)" stroke={ink} strokeWidth={1}/>
        {gridLines}

        {/* Items, layer-sorted */}
        {sorted.map((it, idx) => renderItem(it, idx))}

        {/* AUDIENCE label */}
        <text x={SX + stageWpx/2} y={SY + stageDpx + 18} textAnchor="middle"
          fontFamily="'JetBrains Mono', ui-monospace, monospace"
          fontSize={9} fontWeight={700} fill={ink}
          style={{ letterSpacing: "0.18em" }}>↓ AUDIENCE ↓</text>
      </svg>
      <div style={{ marginTop: 6, textAlign: "center" }}>
        <span style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 8, color: "rgba(14,14,14,0.55)", letterSpacing: "0.16em", textTransform: "uppercase",
        }}>
          Stage: {stageW}&apos; wide × {stageD}&apos; deep &nbsp;·&nbsp; 1 grid square = 1 ft
        </span>
      </div>
    </div>
  );
}

// -------------------- LIVE PREVIEW (Bone document) --------------------
function RiderPreview(p) {
  // Tier gate — the free PDF carries a subtle "Made with Backstage Blueprint"
  // attribution on every page (and in the closing footer); the paid PDF is
  // clean, no BB markings anywhere. Both reads come from a single source
  // (useTier) so the gate flips atomically when the tier changes.
  const { isPaid } = useTier();

  const Block = ({ title, children, num, sectionId }) => (
    <div className="mb-3 print:break-inside-avoid" data-section-id={sectionId}>
      <div className="flex items-baseline gap-1.5 mb-1">
        <Mono style={{ fontSize: 8, color: BRAND.orange, fontWeight: 700 }}>§{num}</Mono>
        <span style={{
          fontFamily: "'Archivo', system-ui, sans-serif", fontWeight: 800, fontSize: 11,
          color: BRAND.black, letterSpacing: "0.04em", textTransform: "uppercase",
        }}>{title}</span>
      </div>
      <div style={{ borderTop: `0.5px solid ${BRAND.black}`, paddingTop: 4 }}>
        {children}
      </div>
    </div>
  );

  const Row = ({ rows, label }) => {
    const filled = rows.filter(r => r.item);
    if (filled.length === 0) return <div style={{ fontSize: 10, fontStyle: "italic", color: "rgba(14,14,14,0.55)" }}>No {label?.toLowerCase()} specified</div>;
    return (
      <div style={{ fontSize: 10 }}>
        {filled.map(r => (
          <div key={r.id} className="flex" style={{ marginBottom: 1 }}>
            <span style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 8, fontWeight: 700, letterSpacing: "0.06em",
              width: 70, flexShrink: 0,
              color: r.kind === "preferred" ? BRAND.orange : "rgba(14,14,14,0.42)",
            }}>
              {r.kind === "preferred" ? "PREFERRED" : "ACCEPTED"}
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ fontWeight: 600 }}>{r.item}</span>
              {r.supplier && <span style={{ color: "rgba(14,14,14,0.55)" }}> · {r.supplier}</span>}
              {r.notes && <span style={{ color: "rgba(14,14,14,0.55)", fontStyle: "italic" }}> — {r.notes}</span>}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // --- Block list (drives both visible doc and hidden sizer) ---
  const blocks = [
    { id: "cover",          sectionId: "general",  forcePageBefore: false },
    { id: "intro",          sectionId: "general",  forcePageBefore: true  },
    { id: "team",           sectionId: "general",  forcePageBefore: false },
    { id: "introContinued", sectionId: "general",  forcePageBefore: false },
    { id: "pa",             sectionId: "pa",       forcePageBefore: true  },
    { id: "consoles",       sectionId: "consoles", forcePageBefore: false },
    { id: "monsys",         sectionId: "monsys",   forcePageBefore: false },
    { id: "monmix",         sectionId: "monmix",   forcePageBefore: false },
    { id: "inputs",         sectionId: "inputs",   forcePageBefore: false },
    { id: "backline",       sectionId: "backline", forcePageBefore: false },
    { id: "aux",            sectionId: "aux",      forcePageBefore: false },
    { id: "plot",           sectionId: "stage-plot" },
    { id: "notes",          sectionId: "notes",    forcePageBefore: true  },
    { id: "footer",         sectionId: "notes" },
  ];

  const renderBlock = (block, sizerProps) => {
    // sizerProps: { ref, dataSizer } — when present, attach to the outermost
    // element so we can measure offsetHeight and so the visible/sizer copies
    // are distinguishable in the DOM.
    const wrap = (node) => {
      if (!node) return null;
      if (!sizerProps) return node;
      // Clone to attach ref + data-sizer to the outermost element.
      return React.cloneElement(node, {
        ref: sizerProps.ref,
        "data-sizer": "1",
      });
    };
    switch (block.id) {
      case "cover":
        return wrap(
          <div key="cover" data-section-id={block.sectionId}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,            // fill its parent page (visible) or natural in sizer
              width: "100%",
              textAlign: "center",
              padding: "32px 18px",
              pageBreakAfter: "always",
              boxSizing: "border-box",
            }}>
            <div style={{
              position: "absolute",
              top: 24, left: "50%", transform: "translateX(-50%)",
            }}>
              <Mono style={{ fontSize: 8.5, color: BRAND.orange, fontWeight: 700, letterSpacing: "0.32em" }}>
                · TECHNICAL RIDER ·
              </Mono>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{
              fontFamily: "'Archivo', system-ui, sans-serif",
              fontWeight: 900,
              fontSize: 38,
              color: BRAND.black,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              lineHeight: 1.05,
              maxWidth: "100%",
              wordBreak: "break-word",
            }}>
              {p.general.artist || "UNTITLED ARTIST"}
            </div>
            {p.general.tour && (
              <div style={{
                fontFamily: "'Archivo', system-ui, sans-serif",
                fontWeight: 700,
                fontSize: 14,
                color: "rgba(14,14,14,0.80)",
                letterSpacing: "0.04em",
                marginTop: 10,
              }}>
                {p.general.tour}
              </div>
            )}
            <div style={{
              width: 36, height: 2, backgroundColor: BRAND.orange, marginTop: 18, marginBottom: 18,
            }}/>
            {p.general.coverImage ? (
              <img src={p.general.coverImage} alt=""
                style={{
                  maxWidth: "70%",
                  maxHeight: 200,
                  objectFit: "contain",
                  marginTop: 8,
                }}/>
            ) : null}
            <div style={{ flex: 1 }} />
            {/* Cover footer — version + date in token-based Stage Black @ 55%.
                FIELD-TESTED stamp removed from cover (decorative usage; the
                stamp is reserved for earned states elsewhere in the document). */}
            <div style={{
              position: "absolute",
              bottom: 18, left: 18, right: 18,
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
            }}>
              <Mono style={{ fontSize: 7.5, color: "rgba(14,14,14,0.55)", letterSpacing: "0.18em" }}>
                v{p.general.version || "1.0"} · {p.general.date || ""}
              </Mono>
            </div>
          </div>
        );
      case "intro": {
        const introResolved = resolveIntro(p.general.intro, p.general.artist);
        return wrap(
          <div key="intro" data-section-id={block.sectionId}
            style={{ padding: "6px 6px 12px", marginBottom: 8 }}>
            <Mono style={{ fontSize: 8, color: BRAND.orange, fontWeight: 700, letterSpacing: "0.22em" }}>§01 · INTRO</Mono>
            <div style={{
              fontFamily: "'Archivo', system-ui, sans-serif",
              fontWeight: 900,
              fontSize: 22,
              color: BRAND.black,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              lineHeight: 1.05,
              marginTop: 4,
            }}>
              {p.general.artist || "Untitled Artist"}
            </div>
            <div style={{ width: 28, height: 2, backgroundColor: BRAND.orange, marginTop: 10, marginBottom: 14 }} />
            <div style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 9.5,
              lineHeight: 1.5,
              color: "rgba(14,14,14,0.92)",
              whiteSpace: "pre-wrap",
            }}>
              {introResolved || <span style={{ color: "rgba(14,14,14,0.42)", fontStyle: "italic" }}>Add a rider intro in the General Info section.</span>}
            </div>
          </div>
        );
      }
      case "header":
        return wrap(
          <div key="header" data-section-id={block.sectionId} style={{ borderBottom: `1.5px solid ${BRAND.black}`, paddingBottom: 8, marginBottom: 10 }}>
            <div className="flex items-start gap-2.5">
              {p.general.coverImage && <img src={p.general.coverImage} alt="" style={{ width: 44, height: 44, objectFit: "contain" }}/>}
              <div className="flex-1">
                <Mono style={{ fontSize: 8, color: BRAND.orange, fontWeight: 700 }}>· TECHNICAL RIDER ·</Mono>
                <div style={{ fontFamily: "'Archivo', system-ui, sans-serif", fontWeight: 900, fontSize: 16, color: BRAND.black, lineHeight: 1.05, marginTop: 2, letterSpacing: "0.01em" }}>{p.general.artist || "UNTITLED ARTIST"}</div>
                <div style={{ fontSize: 10, color: "rgba(14,14,14,0.72)", marginTop: 1 }}>{p.general.tour}</div>
                <Mono style={{ fontSize: 7, color: "rgba(14,14,14,0.42)", marginTop: 3 }}>v{p.general.version} · {p.general.date}</Mono>
              </div>
            </div>
          </div>
        );
      case "team":
        return wrap(
          <div key="team" data-section-id={block.sectionId}>
            <Block num="01" title="Team" sectionId={block.sectionId}>
              {p.crew.filter(c => c.name || c.role).map(c => (
                <div key={c.id} style={{ fontSize: 10, marginBottom: 1 }}>
                  <span style={{ fontWeight: 700 }}>{c.role || "—"}:</span> <span>{c.name || "TBD"}</span>
                  {c.phone && <span style={{ color: "rgba(14,14,14,0.55)" }}> · {c.phone}</span>}
                  {c.email && <span style={{ color: "rgba(14,14,14,0.55)" }}> · {c.email}</span>}
                </div>
              ))}
              {p.crew.filter(c => c.name || c.role).length === 0 && (
                <div style={{ fontSize: 10, fontStyle: "italic", color: "rgba(14,14,14,0.55)" }}>No team members listed</div>
              )}
            </Block>
          </div>
        );
      case "introContinued": {
        const text = p.general.introContinued;
        if (!text || !text.trim()) return null;
        return wrap(
          <div key="introContinued" data-section-id={block.sectionId}
            style={{ padding: "10px 6px 8px", marginTop: 8 }}>
            <div style={{ width: 24, height: 1, backgroundColor: "rgba(14,14,14,0.25)", marginBottom: 8 }} />
            <div style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 9.5,
              lineHeight: 1.5,
              color: "rgba(14,14,14,0.92)",
