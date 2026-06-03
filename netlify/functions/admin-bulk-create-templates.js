// =========================================================
// One-off Netlify Function: admin-bulk-create-templates
// Order 011 PREREQ-3 · Bulk-create 14 Stripe products + prices.
//
// POST /.netlify/functions/admin-bulk-create-templates
// Header: X-Admin-Token: <ADMIN_TOKEN env var>
//
// Idempotent: checks for existing products with metadata.bb_slug
// match before creating. Re-running returns existing price IDs.
//
// DELETE THIS FILE after the env var is set + smoke tested.
// =========================================================

const Stripe = require("stripe");

const TEMPLATES = [
  ["master-budget",         "Master Budget",          "PREMIUM",  1000, "The 12-tab budget a working tour actually runs on."],
  ["show-design-worksheet", "Show Design Worksheet",  "STANDARD", 500,  "Translate the artist's vision into the production deliverables."],
  ["crew-onboarding",       "Crew Onboarding",        "STANDARD", 500,  "The PDF form every crew member fills out before they roll."],
  ["technical-rider",       "Technical Rider",        "STANDARD", 500,  "The technical spec the venue actually reads."],
  ["input-list",            "Input List",             "STANDARD", 500,  "Channel-by-channel for the console — pairs with the rider."],
  ["hospitality-rider",     "Hospitality Rider",      "STANDARD", 500,  "The rider section that breaks most riders. Done right."],
  ["truck-routing",         "Truck Routing",          "STANDARD", 500,  "Routing math + drive-time reality before the bus moves."],
  ["travel-grid",           "Travel Grid",            "STANDARD", 500,  "Flights, hotels, ground — one place, one source of truth."],
  ["show-advance-packet",   "Show Advance Packet",    "FLAGSHIP", 800,  "The complete advance handed to the venue. Flagship."],
  ["day-sheet",             "Day Sheet",              "STANDARD", 500,  "The one-pager every crew member pulls up before doors."],
  ["pass-sheet",            "Pass Sheet",             "STANDARD", 500,  "Credential matrix by access tier — clear on day-of."],
  ["wayfinding-pack",       "Wayfinding Pack",        "STANDARD", 500,  "Signs, room labels, dressing-room names — printable + tidy."],
  ["road-report",           "Road Report",            "FLAGSHIP", 800,  "The post-show debrief that makes the next run better. Flagship."],
  ["show-settlement",       "Show Settlement",        "STANDARD", 500,  "What to verify before you leave the venue."],
];

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  const token = event.headers["x-admin-token"] || event.headers["X-Admin-Token"];
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return { statusCode: 403, body: "Forbidden" };
  }
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { statusCode: 500, body: "STRIPE_SECRET_KEY missing" };
  }
  const stripe = Stripe(secretKey);
  const result = {};
  const log = [];

  for (const [slug, name, tier, cents, desc] of TEMPLATES) {
    try {
      // 1. Find or create the product (idempotent via metadata.bb_slug)
      const search = await stripe.products.search({
        query: `metadata['bb_slug']:'${slug}'`,
        limit: 1,
      });
      let product;
      if (search.data.length > 0) {
        product = search.data[0];
        log.push(`reused product for ${slug}: ${product.id}`);
      } else {
        product = await stripe.products.create({
          name: `BB Template · ${name}`,
          description: desc,
          metadata: { bb_slug: slug, bb_tier: tier },
        });
        log.push(`created product for ${slug}: ${product.id}`);
      }
      // 2. Find or create the price
      const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
      let price = prices.data.find(p => p.unit_amount === cents && p.currency === "usd");
      if (!price) {
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: cents,
          currency: "usd",
          metadata: { bb_slug: slug },
        });
        log.push(`created price for ${slug}: ${price.id}`);
      } else {
        log.push(`reused price for ${slug}: ${price.id}`);
      }
      result[slug] = price.id;
    } catch (err) {
      log.push(`ERROR ${slug}: ${err.message}`);
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      result,
      count: Object.keys(result).length,
      log,
    }, null, 2),
  };
};
