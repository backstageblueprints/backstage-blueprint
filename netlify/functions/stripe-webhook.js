// =========================================================
// Netlify Function: stripe-webhook
// Orders 010 + 011 + 012 · Multi-product entitlement lifecycle
//
// POST /.netlify/functions/stripe-webhook
//
// Handled events:
//   checkout.session.completed     — grant entitlements
//   charge.refunded                — revoke entitlements for refunded purchase (refund_policy.md)
//   customer.subscription.deleted  — revoke subscription-source entitlements
//   invoice.payment_failed         — mark lapse_pending (7-day grace per lapse_grace_period.md)
//   customer.subscription.updated  — clear lapse_pending if subscription back to active
//
// Defensive about schema: `source` and `stripe_session_id` / `stripe_charge_id`
// columns on `entitlements` may or may not exist depending on whether the
// Leg 3 SQL migration has run. Inserts try with the column then retry without
// on column-missing errors. Revocation handlers warn + skip rather than
// crashing if lookup columns aren't available yet.
//
// Env vars required:
//   STRIPE_SECRET_KEY            — for Stripe SDK (signature verify)
//   STRIPE_WEBHOOK_SECRET        — for signature verification
//   VITE_SUPABASE_URL            — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY    — service role key (bypasses RLS, server-only)
//
// Product price IDs (resolved at runtime):
//   VITE_STRIPE_TOOLKIT_PRICE_ID — Toolkit Membership ($5/mo) → toolkit_paid (subscription)
//   STRIPE_COURSE_PRICE_ID       — Course ($199 one-time) → course_owner + toolkit_paid (course_bundle)
//   STRIPE_BLUEPRINT_PRICE_ID    — Blueprint ($49 one-time) → blueprint_paid
//   STRIPE_TEMPLATE_PRICES       — JSON map { "slug": "price_id" } → template:<slug>_owned each
// =========================================================

const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

// Postgres error code for "column does not exist"
const PG_UNDEFINED_COLUMN = "42703";

// =====================================================================
// Kit API integration — Order 013 Leg B
// =====================================================================
// Fire-and-forget tag application on subscriber email. Used by the lapse +
// recovery handlers to drive Kit's day-1/3/6 reminder cadence.
//
// Wiring requirements:
//   KIT_API_KEY env var must be set in Netlify. Without it, every Kit call
//   short-circuits silently (logs a single warning), so the webhook stays
//   working in test mode + during the Order 013 flip window.
//
// Tag names (Order 013 spec):
//   lapse:toolkit-3day      — fired when invoice.payment_failed flags lapse_pending
//   recovery:toolkit-3day   — fired when customer.subscription.updated clears the flag
//
// Kit auto-creates tags on first use via the v3 subscribers endpoint, so the
// tags don't need to pre-exist (per Order 013 03_Wiring/kit_api_wiring.md).
// =====================================================================

const KIT_API_BASE = "https://api.kit.com/v3";

// In-memory cache for the duration of a function instance. Netlify recycles
// instances so this is best-effort, not durable — that's fine, the lookup
// is cheap and infrequent.
const __kitTagIdCache = new Map();

async function lookupKitTagIdByName(tagName) {
  if (__kitTagIdCache.has(tagName)) return __kitTagIdCache.get(tagName);
  const apiKey = process.env.KIT_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`${KIT_API_BASE}/tags?api_key=${encodeURIComponent(apiKey)}`);
    if (!res.ok) {
      console.warn(`[kit] tag list lookup failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    const tags = (data && data.tags) || [];
    for (const t of tags) {
      __kitTagIdCache.set(t.name, t.id);
    }
    return __kitTagIdCache.get(tagName) || null;
  } catch (e) {
    console.warn("[kit] tag list lookup threw:", e.message);
    return null;
  }
}

// Apply a tag to a subscriber by email. Returns { ok, status }. Never throws —
// failures are logged but do not break the webhook response.
async function fireKitTag(email, tagName) {
  if (!email || !tagName) return { ok: false, reason: "no_email_or_tag" };
  const apiKey = process.env.KIT_API_KEY;
  if (!apiKey) {
    console.warn(`[kit] KIT_API_KEY not set — skipping ${tagName} for ${email}`);
    return { ok: false, reason: "no_api_key" };
  }
  try {
    let tagId = await lookupKitTagIdByName(tagName);
    if (!tagId) {
      // Tag doesn't exist yet — create it. Kit's v3 POST /tags creates new tags.
      const createRes = await fetch(`${KIT_API_BASE}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, tag: { name: tagName } }),
      });
      if (createRes.ok) {
        const createData = await createRes.json();
        tagId = createData && createData.tag && createData.tag.id;
        if (tagId) __kitTagIdCache.set(tagName, tagId);
      }
    }
    if (!tagId) {
      console.warn(`[kit] could not resolve or create tag '${tagName}'`);
      return { ok: false, reason: "no_tag_id" };
    }
    const subRes = await fetch(`${KIT_API_BASE}/tags/${tagId}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, email }),
    });
    if (!subRes.ok) {
      console.warn(`[kit] tag-fire ${tagName} for ${email} failed: ${subRes.status}`);
      return { ok: false, reason: "subscribe_failed", status: subRes.status };
    }
    console.log(`[kit] fired tag '${tagName}' on ${email}`);
    return { ok: true };
  } catch (e) {
    console.warn(`[kit] fireKitTag threw for ${tagName} on ${email}:`, e.message);
    return { ok: false, reason: "exception", error: e.message };
  }
}

// Resolve the email for a Stripe customer ID via stripe.customers.retrieve.
// Returns null on failure — Kit calls then no-op silently.
async function getEmailForCustomer(stripe, customerId) {
  if (!customerId) return null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer && customer.deleted) return null;
    return (customer && customer.email) || null;
  } catch (e) {
    console.warn("[kit] customer email lookup failed:", e.message);
    return null;
  }
}

// -----------------------------------------------------------------------
// Price → entitlements map (built per-request from env)
// Each tuple is [entitlement_type, source]. The source matters for refund
// + lapse handling — only `source='subscription'` rows are touched by
// subscription.deleted / invoice.payment_failed; course_bundle survives both.
// -----------------------------------------------------------------------
function buildPriceMaps() {
  const priceMap = {};
  if (process.env.VITE_STRIPE_TOOLKIT_PRICE_ID) {
    priceMap[process.env.VITE_STRIPE_TOOLKIT_PRICE_ID] = [["toolkit_paid", "subscription"]];
  }
  if (process.env.STRIPE_COURSE_PRICE_ID) {
    priceMap[process.env.STRIPE_COURSE_PRICE_ID] = [
      ["course_owner", "course"],
      ["toolkit_paid", "course_bundle"],
    ];
  }
  if (process.env.STRIPE_BLUEPRINT_PRICE_ID) {
    priceMap[process.env.STRIPE_BLUEPRINT_PRICE_ID] = [["blueprint_paid", "blueprint"]];
  }
  try {
    const templatePrices = JSON.parse(process.env.STRIPE_TEMPLATE_PRICES || "{}");
    for (const [slug, priceId] of Object.entries(templatePrices)) {
      priceMap[priceId] = [[`template:${slug}_owned`, "template"]];
    }
  } catch (_) {
    console.warn("[stripe-webhook] STRIPE_TEMPLATE_PRICES is not valid JSON; skipping template mappings.");
  }
  return priceMap;
}

// -----------------------------------------------------------------------
// Defensive upsert — tries the full row, retries without optional columns
// (source, stripe_session_id, stripe_charge_id) if the column is missing.
// -----------------------------------------------------------------------
async function defensiveEntitlementUpsert(supabase, rows) {
  let { data, error } = await supabase
    .from("entitlements")
    .upsert(rows, { onConflict: "user_id,entitlement_type" })
    .select();
  if (!error) return { data, error: null, columnDropped: null };

  // Column missing → strip optional columns + retry
  if (error.code === PG_UNDEFINED_COLUMN) {
    const m = (error.message || "").match(/column "?(\w+)"? .*does not exist/i);
    const dropped = m ? m[1] : "unknown";
    console.warn(`[stripe-webhook] entitlements.${dropped} column missing — retrying without optional fields. Run Leg 3 SQL migration.`);
    const stripped = rows.map((r) => {
      const { source, stripe_session_id, stripe_charge_id, ...rest } = r;
      return rest;
    });
    ({ data, error } = await supabase
      .from("entitlements")
      .upsert(stripped, { onConflict: "user_id,entitlement_type" })
      .select());
    return { data, error, columnDropped: dropped };
  }
  return { data, error, columnDropped: null };
}

// -----------------------------------------------------------------------
// Customer → user_id lookup via stripe_customers table.
// Returns null if table missing or no row found (caller logs + skips).
// -----------------------------------------------------------------------
async function lookupClerkUserByCustomer(supabase, stripeCustomerId) {
  if (!stripeCustomerId) return null;
  try {
    const { data, error } = await supabase
      .from("stripe_customers")
      .select("clerk_user_id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();
    if (error) {
      console.warn("[stripe-webhook] stripe_customers lookup error:", error.message);
      return null;
    }
    return data ? data.clerk_user_id : null;
  } catch (e) {
    console.warn("[stripe-webhook] stripe_customers lookup threw:", e.message);
    return null;
  }
}

// =========================================================
// Event handlers
// =========================================================

// checkout.session.completed — grant entitlements + capture customer mapping
async function handleCheckoutCompleted(stripe, supabase, session) {
  const clerkUserId = session.client_reference_id;
  if (!clerkUserId) {
    console.warn("[stripe-webhook] checkout.session.completed with no client_reference_id; session:", session.id);
    return { received: true, skipped: "no_user_ref" };
  }

  let priceIds = [];
  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
    priceIds = lineItems.data.map((item) => item.price && item.price.id).filter(Boolean);
  } catch (err) {
    console.error("[stripe-webhook] Failed to list line items:", err.message);
    throw new Error("Could not read line items");
  }

  const priceMap = buildPriceMaps();
  const rows = [];
  for (const pid of priceIds) {
    const tuples = priceMap[pid];
    if (!tuples) {
      console.warn("[stripe-webhook] Unknown price ID, no entitlement mapping:", pid);
      continue;
    }
    for (const [entitlement_type, source] of tuples) {
      rows.push({
        user_id: clerkUserId,
        entitlement_type,
        status: "active",
        source,
        stripe_session_id: session.id,
      });
    }
  }

  if (rows.length === 0) {
    return { received: true, skipped: "no_known_prices", priceIds };
  }

  const { error, columnDropped } = await defensiveEntitlementUpsert(supabase, rows);
  if (error) {
    console.error("[stripe-webhook] Supabase upsert error:", error.message);
    throw new Error(`Supabase error: ${error.message}`);
  }

  // Capture stripe_customer_id mapping for billing portal + future events
  if (session.customer) {
    try {
      const { error: custErr } = await supabase
        .from("stripe_customers")
        .upsert(
          [{ clerk_user_id: clerkUserId, stripe_customer_id: session.customer }],
          { onConflict: "clerk_user_id" }
        );
      if (custErr) {
        console.warn("[stripe-webhook] stripe_customers upsert warning:", custErr.message);
      }
    } catch (e) {
      console.warn("[stripe-webhook] stripe_customers upsert failed:", e.message);
    }
  }

  console.log(
    `[stripe-webhook] Granted ${rows.length} entitlement(s) to ${clerkUserId} from session ${session.id}: ${rows.map((r) => r.entitlement_type).join(", ")}${columnDropped ? ` (warning: ${columnDropped} column missing)` : ""}`
  );
  return { received: true, granted: rows.map((r) => r.entitlement_type) };
}

// charge.refunded — immediate revoke per refund_policy.md
// Strategy: look up the original checkout session via the charge's payment_intent,
// then revoke entitlements that were granted by that session.
async function handleChargeRefunded(stripe, supabase, charge) {
  const customerId = charge.customer;
  const clerkUserId = await lookupClerkUserByCustomer(supabase, customerId);
  if (!clerkUserId) {
    console.warn("[stripe-webhook] charge.refunded: no clerk_user_id for customer", customerId, "— skipping. Migration may be needed.");
    return { received: true, skipped: "no_user_for_customer" };
  }

  // Find the session(s) that generated this charge
  let sessions = [];
  try {
    const list = await stripe.checkout.sessions.list({ payment_intent: charge.payment_intent, limit: 5 });
    sessions = list.data;
  } catch (e) {
    console.warn("[stripe-webhook] could not list sessions for payment_intent:", e.message);
  }

  if (sessions.length === 0) {
    console.warn("[stripe-webhook] charge.refunded: no session found for payment_intent", charge.payment_intent);
    return { received: true, skipped: "no_session_for_charge" };
  }

  let revoked = 0;
  for (const sess of sessions) {
    // Try to find entitlements granted by this session
    const { data: ents, error: lookupErr } = await supabase
      .from("entitlements")
      .select("id, entitlement_type, source")
      .eq("user_id", clerkUserId)
      .eq("stripe_session_id", sess.id);
    if (lookupErr) {
      if (lookupErr.code === PG_UNDEFINED_COLUMN) {
        console.warn("[stripe-webhook] charge.refunded: stripe_session_id column missing — cannot precisely revoke. Run Leg 3 migration. Skipping.");
        return { received: true, skipped: "migration_pending" };
      }
      console.warn("[stripe-webhook] charge.refunded lookup error:", lookupErr.message);
      continue;
    }
    if (!ents || ents.length === 0) continue;
    const ids = ents.map((e) => e.id);
    const { error: delErr } = await supabase.from("entitlements").delete().in("id", ids);
    if (delErr) {
      console.error("[stripe-webhook] charge.refunded delete error:", delErr.message);
      continue;
    }
    revoked += ids.length;
    console.log(`[stripe-webhook] Refund revoked ${ids.length} entitlement(s) for ${clerkUserId}: ${ents.map((e) => e.entitlement_type).join(", ")}`);
  }
  return { received: true, revoked };
}

// customer.subscription.deleted — revoke ONLY subscription-source entitlements.
// Course-bundled toolkit_paid survives (independent grant per refund_policy.md).
async function handleSubscriptionDeleted(supabase, subscription) {
  const customerId = subscription.customer;
  const clerkUserId = await lookupClerkUserByCustomer(supabase, customerId);
  if (!clerkUserId) {
    console.warn("[stripe-webhook] subscription.deleted: no clerk_user_id for customer", customerId);
    return { received: true, skipped: "no_user_for_customer" };
  }
  // Delete subscription-source toolkit_paid only
  const { data, error } = await supabase
    .from("entitlements")
    .delete()
    .eq("user_id", clerkUserId)
    .eq("entitlement_type", "toolkit_paid")
    .eq("source", "subscription")
    .select();
  if (error) {
    if (error.code === PG_UNDEFINED_COLUMN) {
      console.warn("[stripe-webhook] subscription.deleted: source column missing — cannot scope revoke to subscription only. Skipping to avoid revoking course_bundle access. Run Leg 3 migration.");
      return { received: true, skipped: "migration_pending" };
    }
    console.error("[stripe-webhook] subscription.deleted delete error:", error.message);
    throw new Error(error.message);
  }
  const n = data ? data.length : 0;
  console.log(`[stripe-webhook] subscription.deleted revoked ${n} subscription-source toolkit_paid row(s) for ${clerkUserId}`);
  return { received: true, revoked: n };
}

// invoice.payment_failed — mark lapse_pending (7-day grace per lapse_grace_period.md)
// External Kit automation handles the day-1/3/6 reminder emails based on a tag,
// and a separate scheduled job runs the day-7 revoke. This handler flips the
// Supabase status AND fires the Kit lapse:toolkit-3day tag (Order 013 Leg B).
async function handlePaymentFailed(stripe, supabase, invoice) {
  const customerId = invoice.customer;
  const clerkUserId = await lookupClerkUserByCustomer(supabase, customerId);
  if (!clerkUserId) {
    console.warn("[stripe-webhook] invoice.payment_failed: no clerk_user_id for customer", customerId);
    return { received: true, skipped: "no_user_for_customer" };
  }
  const { data, error } = await supabase
    .from("entitlements")
    .update({ status: "lapse_pending", lapse_started_at: new Date().toISOString() })
    .eq("user_id", clerkUserId)
    .eq("entitlement_type", "toolkit_paid")
    .eq("source", "subscription")
    .select();
  if (error) {
    if (error.code === PG_UNDEFINED_COLUMN) {
      console.warn("[stripe-webhook] invoice.payment_failed: source or lapse_started_at column missing — cannot mark lapse. Run Leg 3 migration.");
      return { received: true, skipped: "migration_pending" };
    }
    console.error("[stripe-webhook] invoice.payment_failed update error:", error.message);
    throw new Error(error.message);
  }
  const n = data ? data.length : 0;
  console.log(`[stripe-webhook] invoice.payment_failed flagged ${n} row(s) as lapse_pending for ${clerkUserId}`);

  // Fire Kit lapse tag — triggers the day-1/3/6 reminder cadence in Kit.
  // Email lookup via Stripe customer; tag fire is fire-and-forget.
  if (n > 0) {
    const email = invoice.customer_email || await getEmailForCustomer(stripe, customerId);
    if (email) {
      await fireKitTag(email, "lapse:toolkit-3day");
    } else {
      console.warn("[stripe-webhook] invoice.payment_failed: no email available for Kit tag fire");
    }
  }
  return { received: true, flagged: n };
}

// customer.subscription.updated — if subscription is back to active and we'd
// previously flagged lapse_pending, clear the flag (payment recovered).
// Also fires the Kit recovery:toolkit-3day tag (Order 013 Leg B).
async function handleSubscriptionUpdated(stripe, supabase, subscription) {
  if (subscription.status !== "active") {
    return { received: true, ignored_status: subscription.status };
  }
  const customerId = subscription.customer;
  const clerkUserId = await lookupClerkUserByCustomer(supabase, customerId);
  if (!clerkUserId) return { received: true, skipped: "no_user_for_customer" };

  const { data, error } = await supabase
    .from("entitlements")
    .update({ status: "active", lapse_started_at: null })
    .eq("user_id", clerkUserId)
    .eq("entitlement_type", "toolkit_paid")
    .eq("source", "subscription")
    .eq("status", "lapse_pending")
    .select();
  if (error) {
    if (error.code === PG_UNDEFINED_COLUMN) {
      console.warn("[stripe-webhook] subscription.updated: column missing — Leg 3 migration pending.");
      return { received: true, skipped: "migration_pending" };
    }
    console.error("[stripe-webhook] subscription.updated update error:", error.message);
    throw new Error(error.message);
  }
  const n = data ? data.length : 0;
  if (n > 0) {
    console.log(`[stripe-webhook] subscription.updated cleared lapse_pending on ${n} row(s) for ${clerkUserId}`);
    // Fire Kit recovery tag — Kit automation can use this to exit the user
    // from the lapse reminder cadence and send a welcome-back email.
    const email = await getEmailForCustomer(stripe, customerId);
    if (email) {
      await fireKitTag(email, "recovery:toolkit-3day");
    } else {
      console.warn("[stripe-webhook] subscription.updated: no email available for Kit tag fire");
    }
  }
  return { received: true, recovered: n };
}

// =========================================================
// Handler entry
// =========================================================

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

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  try {
    let result;
    switch (stripeEvent.type) {
      case "checkout.session.completed":
        result = await handleCheckoutCompleted(stripe, supabase, stripeEvent.data.object);
        break;
      case "charge.refunded":
        result = await handleChargeRefunded(stripe, supabase, stripeEvent.data.object);
        break;
      case "customer.subscription.deleted":
        result = await handleSubscriptionDeleted(supabase, stripeEvent.data.object);
        break;
      case "invoice.payment_failed":
        result = await handlePaymentFailed(stripe, supabase, stripeEvent.data.object);
        break;
      case "customer.subscription.updated":
        result = await handleSubscriptionUpdated(stripe, supabase, stripeEvent.data.object);
        break;
      default:
        return { statusCode: 200, body: JSON.stringify({ received: true, ignored: stripeEvent.type }) };
    }
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    console.error(`[stripe-webhook] Handler error for ${stripeEvent.type}:`, err.message);
    return { statusCode: 500, body: err.message };
  }
};
