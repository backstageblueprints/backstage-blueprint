// =========================================================
// BB BACKEND INTEGRATION — Clerk + Supabase + Stripe
// Order 009 · Toolkit Integration
//
// Graceful-degradation pattern: if the env vars aren't set,
// every function here returns null/false and the app keeps
// running in its current behavior (URL-param/localStorage
// tier read, dev-toggle upgrade button).
//
// When Gibby fills in the env vars below, this module
// quietly activates real Clerk session reads, real Supabase
// entitlement checks, and real Stripe Checkout.
//
// Required env vars (Vite reads VITE_* at build time):
//   VITE_CLERK_PUBLISHABLE_KEY          — pk_live_... or pk_test_...
//   VITE_SUPABASE_URL                   — https://<project>.supabase.co
//   VITE_SUPABASE_ANON_KEY              — public anon key
//   VITE_STRIPE_PUBLISHABLE_KEY         — pk_live_... or pk_test_...
//   VITE_STRIPE_TOOLKIT_PRICE_ID        — price_xxxxxxxxxxxx
//
// See .env.example in the project root for the full template.
// =========================================================

const CLERK_PK = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
const STRIPE_PRICE_ID = import.meta.env.VITE_STRIPE_TOOLKIT_PRICE_ID || "";

// Cache resolved clients across calls — Clerk.load() especially is expensive.
let _clerkPromise = null;
let _supabasePromise = null;

/**
 * Whether the auth/entitlement integration is fully configured.
 * False = run in dev-mode (URL param + localStorage).
 */
export function bbAuthReady() {
  return Boolean(CLERK_PK && SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Whether Stripe checkout is fully configured.
 * False = upgrade button falls back to dev toggle.
 */
export function bbCheckoutReady() {
  return Boolean(STRIPE_PK && STRIPE_PRICE_ID);
}

/**
 * Async: check Clerk session + Supabase entitlement.
 * Returns 'paid' | 'free' | null (null = integration off; keep current tier).
 *
 * Called once on app mount inside TierProvider's useEffect.
 * Re-call on tab focus or after session change to pick up new entitlements.
 */
export async function verifyTierFromBackend() {
  if (!bbAuthReady()) return null;
  try {
    if (!_clerkPromise) {
      _clerkPromise = (async () => {
        const ClerkModule = await import("@clerk/clerk-js");
        const Clerk = ClerkModule.Clerk || ClerkModule.default;
        const instance = new Clerk(CLERK_PK);
        await instance.load();
        return instance;
      })();
    }
    const clerk = await _clerkPromise;
    const user = clerk.user;
    if (!user) return "free"; // logged out → guest pass = free

    if (!_supabasePromise) {
      _supabasePromise = (async () => {
        const { createClient } = await import("@supabase/supabase-js");
        return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      })();
    }
    const supabase = await _supabasePromise;

    const { data, error } = await supabase
      .from("entitlements")
      .select("status")
      .eq("user_id", user.id)
      .eq("entitlement_type", "toolkit_paid")
      .eq("status", "active")
      .limit(1);

    if (error) {
      console.warn("[BB] Supabase entitlement read error:", error.message);
      return null;
    }
    return data && data.length > 0 ? "paid" : "free";
  } catch (err) {
    // SDK not installed, network error, etc. — fail open to current tier.
    console.warn("[BB] Tier verification skipped:", err && err.message ? err.message : err);
    return null;
  }
}

/**
 * Async: start Stripe Checkout for the Toolkit subscription.
 * Returns true if redirect started successfully, false otherwise.
 * Caller should fall back to dev behavior on false.
 *
 * Server-side mode (Order 009 update — 2026-06-01):
 * - POSTs to /.netlify/functions/create-checkout-session
 * - The function uses STRIPE_SECRET_KEY (server-only) to create a session
 * - We follow the returned `url` to checkout.stripe.com
 *
 * Order 010 update — 2026-06-01 PM:
 * - Reads the current Clerk session (if any) and passes the user_id as
 *   clerk_user_id in the request body. The function stamps it onto the
 *   Stripe Session as client_reference_id, which the webhook then uses
 *   to attach the resulting entitlement to the right user.
 * - If no Clerk session exists, we still allow checkout (anonymous test
 *   purchases), but the webhook will skip the entitlement insert — no
 *   user to attach it to. In production this case shouldn't happen
 *   because the toolkit.html Free CTA routes through Clerk signup first.
 */
export async function startBBCheckout() {
  try {
    // Try to grab the Clerk user_id, but don't fail if Clerk isn't ready.
    let clerkUserId = null;
    if (bbAuthReady()) {
      try {
        if (!_clerkPromise) {
          _clerkPromise = (async () => {
            const ClerkModule = await import("@clerk/clerk-js");
            const Clerk = ClerkModule.Clerk || ClerkModule.default;
            const instance = new Clerk(CLERK_PK);
            await instance.load();
            return instance;
          })();
        }
        const clerk = await _clerkPromise;
        if (clerk && clerk.user && clerk.user.id) {
          clerkUserId = clerk.user.id;
        }
      } catch (clerkErr) {
        console.warn("[BB] Clerk lookup before checkout failed (continuing anonymously):", clerkErr && clerkErr.message ? clerkErr.message : clerkErr);
      }
    }

    const res = await fetch("/.netlify/functions/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clerk_user_id: clerkUserId }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.warn("[BB] Checkout session error:", errBody.error || res.statusText);
      return false;
    }
    const { url } = await res.json();
    if (!url) return false;
    window.location.assign(url);
    return true; // redirect happens; control passes to Stripe
  } catch (err) {
    console.warn("[BB] Checkout skipped:", err && err.message ? err.message : err);
    return false;
  }
}

/**
 * Optional: route the user to the BB Clerk signup, returning to /toolkit/ after.
 * Used by the toolkit.html sales page's Free signup CTA.
 * (Kept here so the routing convention lives in one place.)
 */
export function getBBSignupUrl(returnPath = "/toolkit/") {
  return `/signup?return=${encodeURIComponent(returnPath)}`;
}
