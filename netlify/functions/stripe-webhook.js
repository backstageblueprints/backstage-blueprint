// =========================================================
// Netlify Function: stripe-webhook
// Orders 010 + 011 · Multi-product entitlement insert
//
// POST /.netlify/functions/stripe-webhook
// Listens for `checkout.session.completed`. Verifies Stripe signature,
// reads Clerk user_id from session.client_reference_id, maps the purchased
// price ID(s) → entitlement type(s), upserts entitlements rows into
// Supabase via the service-role key. Idempotent on (user_id, entitlement_type).
//
// Env vars required:
//   STRIPE_SECRET_KEY            — for Stripe SDK (signature verify)
//   STRIPE_WEBHOOK_SECRET        — for signature verification
//   VITE_SUPABASE_URL            — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY    — service role key (bypasses RLS, server-only)
//
// Product price IDs (resolved at runtime):
//   VITE_STRIPE_TOOLKIT_PRICE_ID — Toolkit Membership ($5/mo) → toolkit_paid
//   STRIPE_COURSE_PRICE_ID       — Course ($199 one-time) → course_owner + toolkit_paid (lifetime)
//   STRIPE_BLUEPRINT_PRICE_ID    — Blueprint ($49 one-time) → blueprint_paid
//   STRIPE_TEMPLATE_PRICES       — JSON map { "slug": "price_id" } → template:<slug>_owned each
// =========================================================

const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

// Build the price-id → entitlement-types mapping from env at request time.
// Returns a map AND a reverse map (price → template_slug) for slug lookup.
function buildPriceMaps() {
  const priceMap = {};
  if (process.env.VITE_STRIPE_TOOLKIT_PRICE_ID) {
    priceMap[process.env.VITE_STRIPE_TOOLKIT_PRICE_ID] = ["toolkit_paid"];
  }
  if (process.env.STRIPE_COURSE_PRICE_ID) {
    // Course bundles lifetime toolkit access per the locked Course-Toolkit duration decision.
    priceMap[process.env.STRIPE_COURSE_PRICE_ID] = ["course_owner", "toolkit_paid"];
  }
  if (process.env.STRIPE_BLUEPRINT_PRICE_ID) {
    priceMap[process.env.STRIPE_BLUEPRINT_PRICE_ID] = ["blueprint_paid"];
  }
  // Templates: each slug → its own entitlement_type
  try {
    const templatePrices = JSON.parse(process.env.STRIPE_TEMPLATE_PRICES || "{}");
    for (const [slug, priceId] of Object.entries(templatePrices)) {
      priceMap[priceId] = [`template:${slug}_owned`];
    }
  } catch (_) {
    console.warn("[stripe-webhook] STRIPE_TEMPLATE_PRICES is not valid JSON; skipping template mappings.");
  }
  return priceMap;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeSecret || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error("[stripe-webhook] Missing required env vars.");
    return { statusCode: 500, body: "Server misconfigured" };
  }

  const stripe = Stripe(stripeSecret);
  const sig = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  // 1. Verify signature
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type !== "checkout.session.completed") {
    return { statusCode: 200, body: JSON.stringify({ received: true, ignored: stripeEvent.type }) };
  }

  const session = stripeEvent.data.object;
  const clerkUserId = session.client_reference_id;

  if (!clerkUserId) {
    console.warn("[stripe-webhook] checkout.session.completed with no client_reference_id; session:", session.id);
    return { statusCode: 200, body: JSON.stringify({ received: true, skipped: "no_user_ref" }) };
  }

  // 2. Get the line items + figure out which entitlement(s) to grant
  let priceIds = [];
  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
    priceIds = lineItems.data
      .map((item) => item.price && item.price.id)
      .filter(Boolean);
  } catch (err) {
    console.error("[stripe-webhook] Failed to list line items:", err.message);
    return { statusCode: 500, body: "Could not read line items" };
  }

  const priceMap = buildPriceMaps();
  const entitlementTypes = new Set();
  for (const pid of priceIds) {
    const types = priceMap[pid];
    if (types) {
      types.forEach((t) => entitlementTypes.add(t));
    } else {
      console.warn("[stripe-webhook] Unknown price ID, no entitlement mapping:", pid);
    }
  }

  if (entitlementTypes.size === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, skipped: "no_known_prices", priceIds }),
    };
  }

  // 3. Upsert into Supabase entitlements (idempotent — UNIQUE constraint on user_id+entitlement_type)
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const rows = [...entitlementTypes].map((t) => ({
    user_id: clerkUserId,
    entitlement_type: t,
    status: "active",
  }));

  const { data, error } = await supabase
    .from("entitlements")
    .upsert(rows, { onConflict: "user_id,entitlement_type" })
    .select();

  if (error) {
    console.error("[stripe-webhook] Supabase upsert error:", error.message);
    return { statusCode: 500, body: `Supabase error: ${error.message}` };
  }

  console.log(
    `[stripe-webhook] Granted ${rows.length} entitlement(s) to ${clerkUserId} from session ${session.id}: ${rows.map(r => r.entitlement_type).join(", ")}`
  );
  return {
    statusCode: 200,
    body: JSON.stringify({ received: true, granted: rows.map((r) => r.entitlement_type) }),
  };
};
