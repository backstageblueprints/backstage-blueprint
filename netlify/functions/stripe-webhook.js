// =========================================================
// Netlify Function: stripe-webhook
// Order 010 · Stripe Webhook + Entitlement Insert
//
// POST /.netlify/functions/stripe-webhook
// Receives signed Stripe webhook events. On `checkout.session.completed`:
//   1. Verifies the signature with STRIPE_WEBHOOK_SECRET.
//   2. Pulls the Clerk user_id from session.client_reference_id.
//   3. Maps the purchased price ID → entitlement type(s) using a config
//      table (price_1Tan9yEWm3WEFi10RrSIefaB → ["toolkit_paid"]).
//      Course price ID added later will map to ["course_owner","toolkit_paid"].
//   4. Upserts the entitlement row(s) into Supabase via the service-role
//      key (SUPABASE_SERVICE_ROLE_KEY), keyed on (user_id, entitlement_type)
//      for idempotency. Stripe webhook retries are safe by design.
//
// Stripe dashboard webhook config (Order 010 PREREQ-1):
//   - Endpoint: this function's URL
//   - Listen for: checkout.session.completed
//   - Signing secret stored as STRIPE_WEBHOOK_SECRET in Netlify env
//
// Env vars required:
//   STRIPE_SECRET_KEY            — for Stripe SDK (signature verify)
//   STRIPE_WEBHOOK_SECRET        — for signature verification
//   VITE_SUPABASE_URL            — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY    — service role key (bypasses RLS, server-only)
//
// IMPORTANT: this function MUST read the raw request body for signature
// verification. Netlify base64-encodes the body when isBase64Encoded=true;
// we handle both cases below.
// =========================================================

const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

// Price ID → entitlement type(s) mapping. Adding Course later = one row.
const PRICE_TO_ENTITLEMENTS = {
  // Toolkit Membership (Backstage Blueprint sandbox test mode)
  "price_1Tan9yEWm3WEFi10RrSIefaB": ["toolkit_paid"],
  // Course (future): "price_xxxxxxxxxxxx": ["course_owner", "toolkit_paid"],
};

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
  // Get the RAW body. Netlify may have base64-encoded it.
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

  // 2. We only care about completed checkout sessions for now
  if (stripeEvent.type !== "checkout.session.completed") {
    // Acknowledge other events with 200 so Stripe doesn't retry.
    return { statusCode: 200, body: JSON.stringify({ received: true, ignored: stripeEvent.type }) };
  }

  const session = stripeEvent.data.object;
  const clerkUserId = session.client_reference_id;

  if (!clerkUserId) {
    // Test purchases made before Clerk signup landed have no user reference.
    // 200 so Stripe doesn't retry, but log it.
    console.warn("[stripe-webhook] checkout.session.completed with no client_reference_id; session:", session.id);
    return { statusCode: 200, body: JSON.stringify({ received: true, skipped: "no_user_ref" }) };
  }

  // 3. Figure out which entitlement(s) this purchase grants.
  // We need to expand line_items to see the price IDs.
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

  const entitlementTypes = new Set();
  for (const pid of priceIds) {
    const types = PRICE_TO_ENTITLEMENTS[pid];
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

  // 4. Upsert into Supabase entitlements (idempotent — retries are safe
  //    because of the UNIQUE constraint on (user_id, entitlement_type)).
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
    // Return 500 so Stripe retries the delivery.
    return { statusCode: 500, body: `Supabase error: ${error.message}` };
  }

  console.log(
    `[stripe-webhook] Granted ${rows.length} entitlement(s) to ${clerkUserId} from session ${session.id}`
  );
  return {
    statusCode: 200,
    body: JSON.stringify({ received: true, granted: rows.map((r) => r.entitlement_type) }),
  };
};
