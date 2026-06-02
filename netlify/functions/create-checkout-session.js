// =========================================================
// Netlify Function: create-checkout-session
// Order 009 · Toolkit Integration (server-side checkout)
// Order 010 update · accepts clerk_user_id, passes as client_reference_id
//
// POST /.netlify/functions/create-checkout-session
// Body: { clerk_user_id: string | null }
//
// Creates a Stripe Checkout Session using the server-side
// STRIPE_SECRET_KEY and returns { url } for the browser to
// redirect to. Replaces the deprecated client-only Checkout.
//
// Env vars required (set in Netlify → Site → Env vars):
//   STRIPE_SECRET_KEY            — sk_test_... or sk_live_...
//   VITE_STRIPE_TOOLKIT_PRICE_ID — price_xxxxxxxxxxxx
// =========================================================

const Stripe = require("stripe");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.VITE_STRIPE_TOOLKIT_PRICE_ID;

  if (!secretKey || !priceId) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Stripe is not configured on the server (missing STRIPE_SECRET_KEY or VITE_STRIPE_TOOLKIT_PRICE_ID).",
      }),
    };
  }

  // Parse the request body to get the Clerk user_id (if any).
  // We pass this as `client_reference_id` so the webhook (Order 010) can
  // attach the resulting entitlement to the right user_id in Supabase.
  let clerkUserId = null;
  try {
    if (event.body) {
      const parsed = JSON.parse(event.body);
      if (parsed && typeof parsed.clerk_user_id === "string" && parsed.clerk_user_id.length > 0) {
        clerkUserId = parsed.clerk_user_id;
      }
    }
  } catch (_) {
    // Body wasn't JSON; ignore and proceed without a user reference.
  }

  const stripe = Stripe(secretKey);
  const host = event.headers.host || event.headers["x-forwarded-host"] || "brilliant-gnome-5fc4a0.netlify.app";
  const origin = `https://${host}`;

  try {
    const sessionParams = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/toolkit/?upgrade=success&sid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/toolkit/?upgrade=cancelled`,
    };
    // Only set client_reference_id when we have one — Stripe rejects empty strings.
    if (clerkUserId) {
      sessionParams.client_reference_id = clerkUserId;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: session.url, id: session.id }),
    };
  } catch (err) {
    console.error("Stripe checkout session error:", err.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
