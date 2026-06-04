// =========================================================
// Netlify Function: create-portal-session
// Order 012 · Pass Pages · Billing
//
// POST /.netlify/functions/create-portal-session
// Body: { clerk_user_id: "user_..." }
// Returns: { url: "https://billing.stripe.com/..." }
//
// Looks up the user's stripe_customer_id from the stripe_customers
// table (populated by stripe-webhook on checkout.session.completed),
// then creates a Stripe Billing Portal session and returns the URL
// for the client to redirect to.
//
// Env vars required:
//   STRIPE_SECRET_KEY          — for Stripe SDK
//   VITE_SUPABASE_URL          — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY  — service role key (server-only)
//
// SCHEMA DEPENDENCY: requires the stripe_customers table created by
// Order 012's SQL migration. Will return 503 if the table is missing.
// =========================================================

const Stripe = require("stripe");

const RETURN_URL = "https://brilliant-gnome-5fc4a0.netlify.app/members.html";

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "method_not_allowed" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "bad_json" }) }; }

  const userId = body.clerk_user_id;
  if (!userId || typeof userId !== "string") {
    return { statusCode: 400, body: JSON.stringify({ error: "missing_user_id" }) };
  }

  const SECRET = process.env.STRIPE_SECRET_KEY;
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SECRET || !SUPABASE_URL || !SERVICE_KEY) {
    console.error("[create-portal-session] Missing env");
    return { statusCode: 500, body: JSON.stringify({ error: "server_misconfigured" }) };
  }

  // 1) Look up the user's stripe_customer_id
  let stripeCustomerId;
  try {
    const lookupUrl = `${SUPABASE_URL}/rest/v1/stripe_customers?clerk_user_id=eq.${encodeURIComponent(userId)}&select=stripe_customer_id`;
    const res = await fetch(lookupUrl, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    if (res.status === 404 || res.status === 406) {
      // Table missing (404) or no rows (PostgREST sometimes 406)
      return { statusCode: 503, body: JSON.stringify({ error: "server_misconfigured", detail: "stripe_customers table not ready" }) };
    }
    if (!res.ok) {
      const t = await res.text();
      console.warn("[create-portal-session] Supabase lookup err:", res.status, t);
      return { statusCode: 502, body: JSON.stringify({ error: "supabase_error" }) };
    }
    const rows = await res.json();
    if (!rows || rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: "no_stripe_customer" }) };
    }
    stripeCustomerId = rows[0].stripe_customer_id;
  } catch (e) {
    console.error("[create-portal-session] lookup failed:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: "lookup_failed" }) };
  }

  // 2) Create Stripe Billing Portal session
  try {
    const stripe = Stripe(SECRET);
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: RETURN_URL,
    });
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ url: session.url })
    };
  } catch (e) {
    console.error("[create-portal-session] Stripe err:", e.message);
    return { statusCode: 502, body: JSON.stringify({ error: "stripe_error", message: e.message }) };
  }
};
