// =========================================================
// Netlify Function: create-checkout-session
// Order 009 · Toolkit Integration (server-side checkout)
//
// POST /.netlify/functions/create-checkout-session
// Creates a Stripe Checkout Session using the server-side
// STRIPE_SECRET_KEY and returns { url } for the browser to
// redirect to. Replaces the deprecated client-only Checkout.
//
// Env vars required (set in Netlify → Site → Env vars):
//   STRIPE_SECRET_KEY            — sk_test_... or sk_live_...
//   VITE_STRIPE_TOOLKIT_PRICE_ID — price_xxxxxxxxxxxx
//     (VITE_ prefix kept for cross-use with the client bundle)
// =========================================================

const Stripe = require("stripe");

exports.handler = async (event) => {
  // CORS / preflight — same-origin POSTs don't strictly need this,
  // but leave a friendly preflight handler in case of edge cases.
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

  const stripe = Stripe(secretKey);
  const host = event.headers.host || event.headers["x-forwarded-host"] || "brilliant-gnome-5fc4a0.netlify.app";
  const origin = `https://${host}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/toolkit/?upgrade=success&sid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/toolkit/?upgrade=cancelled`,
      // allow_promotion_codes: true,  // enable later when promo codes are configured
    });

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
