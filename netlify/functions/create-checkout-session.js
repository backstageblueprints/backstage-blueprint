// =========================================================
// Netlify Function: create-checkout-session
// Orders 009 + 010 + 011 · Toolkit + multi-product commerce
//
// POST /.netlify/functions/create-checkout-session
// Body: { product_key: string, clerk_user_id: string | null, template_slug?: string }
//
// product_key values supported:
//   "toolkit"   — Toolkit Membership ($5/mo subscription)
//   "course"    — Backstage Blueprint Course ($199 one-time)
//   "blueprint" — The Blueprint bundle ($49 one-time)
//   "template"  — Individual template (requires template_slug; price resolved
//                 from STRIPE_TEMPLATE_PRICES JSON env var)
//
// Backward-compat: if no product_key is provided, defaults to "toolkit".
// =========================================================

const Stripe = require("stripe");

// Server-side product catalog. Each product resolves to a price ID + mode.
// Price IDs are stored in env vars so no Stripe IDs in source.
function getProductConfig(productKey, templateSlug) {
  const config = {
    toolkit: {
      priceId: process.env.VITE_STRIPE_TOOLKIT_PRICE_ID,
      mode: "subscription",
      successPath: "/toolkit/?upgrade=success&sid={CHECKOUT_SESSION_ID}",
      cancelPath: "/toolkit/?upgrade=cancelled",
    },
    course: {
      priceId: process.env.STRIPE_COURSE_PRICE_ID,
      mode: "payment",
      successPath: "/course-viewer.html?purchase=success&sid={CHECKOUT_SESSION_ID}",
      cancelPath: "/course.html?purchase=cancelled",
    },
    blueprint: {
      priceId: process.env.STRIPE_BLUEPRINT_PRICE_ID,
      mode: "payment",
      successPath: "/my-binder.html?purchase=success&sid={CHECKOUT_SESSION_ID}",
      cancelPath: "/blueprint.html?purchase=cancelled",
    },
  };
  if (productKey === "template") {
    if (!templateSlug) return null;
    let templatePrices = {};
    try {
      templatePrices = JSON.parse(process.env.STRIPE_TEMPLATE_PRICES || "{}");
    } catch (_) {
      return null;
    }
    const priceId = templatePrices[templateSlug];
    if (!priceId) return null;
    return {
      priceId,
      mode: "payment",
      successPath: `/my-binder.html?purchase=success&template=${encodeURIComponent(templateSlug)}&sid={CHECKOUT_SESSION_ID}`,
      cancelPath: `/template.html?id=${encodeURIComponent(templateSlug)}&purchase=cancelled`,
    };
  }
  return config[productKey] || null;
}

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
  if (!secretKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Stripe is not configured on the server (missing STRIPE_SECRET_KEY)." }),
    };
  }

  // Parse request body
  let productKey = "toolkit";
  let clerkUserId = null;
  let templateSlug = null;
  try {
    if (event.body) {
      const parsed = JSON.parse(event.body);
      if (typeof parsed.product_key === "string" && parsed.product_key.length > 0) {
        productKey = parsed.product_key;
      }
      if (typeof parsed.clerk_user_id === "string" && parsed.clerk_user_id.length > 0) {
        clerkUserId = parsed.clerk_user_id;
      }
      if (typeof parsed.template_slug === "string" && parsed.template_slug.length > 0) {
        templateSlug = parsed.template_slug;
      }
    }
  } catch (_) {
    // body wasn't JSON; proceed with defaults
  }

  const product = getProductConfig(productKey, templateSlug);
  if (!product || !product.priceId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: `Product not configured: ${productKey}${templateSlug ? ` (template ${templateSlug})` : ""}. Server is missing the price ID env var.`,
      }),
    };
  }

  const stripe = Stripe(secretKey);
  const host = event.headers.host || event.headers["x-forwarded-host"] || "brilliant-gnome-5fc4a0.netlify.app";
  const origin = `https://${host}`;

  try {
    const sessionParams = {
      mode: product.mode,
      line_items: [{ price: product.priceId, quantity: 1 }],
      success_url: `${origin}${product.successPath}`,
      cancel_url: `${origin}${product.cancelPath}`,
    };
    if (clerkUserId) {
      sessionParams.client_reference_id = clerkUserId;
    }
    // For one-time purchases, capture the customer email automatically.
    if (product.mode === "payment") {
      sessionParams.customer_creation = "always";
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
