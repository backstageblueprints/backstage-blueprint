// admin-bulk-create-templates.js
// DEPRECATED & NEUTRALIZED — one-off used 06.03.2026 to bulk-create the 14 template Stripe prices.
// ADMIN_TOKEN env var has been removed from Netlify so this endpoint would fail auth anyway,
// but we also strip the body to a permanent 410 Gone so the dead code surface is zero.
// Hard-delete this file when convenient.
exports.handler = async () => ({
  statusCode: 410,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ error: "gone", note: "one-off bulk-create function was retired after templates were provisioned 06.03.2026" })
});
