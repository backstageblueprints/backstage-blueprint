// =========================================================
// Netlify Function: get-my-entitlements
// Order 011 · Templates delivery wiring
//
// POST /.netlify/functions/get-my-entitlements
// Body: { clerk_user_id: "user_..." }
// Returns: { entitlements: ["template:master-budget_owned", "blueprint_paid", ...] }
//
// Server-side Supabase query using SUPABASE_SERVICE_ROLE_KEY so the entitlements
// table stays private. Called by my-binder.html (and any future page that needs
// live ownership state) after Clerk lazy-loads the signed-in user.
//
// Env vars required:
//   VITE_SUPABASE_URL          — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY  — service role key (server-only, bypasses RLS)
// =========================================================

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    };
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

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[get-my-entitlements] Missing env: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return { statusCode: 500, body: JSON.stringify({ error: "server_misconfigured" }) };
  }

  const url = `${SUPABASE_URL}/rest/v1/entitlements?user_id=eq.${encodeURIComponent(userId)}&select=entitlement_type`;
  try {
    const res = await fetch(url, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    });
    if (!res.ok) {
      const t = await res.text();
      console.warn("[get-my-entitlements] Supabase err:", res.status, t);
      return { statusCode: 502, body: JSON.stringify({ error: "supabase_error", status: res.status }) };
    }
    const rows = await res.json();
    const entitlements = rows.map(r => r.entitlement_type);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ entitlements })
    };
  } catch (e) {
    console.error("[get-my-entitlements] fetch failed:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: "fetch_failed" }) };
  }
};
