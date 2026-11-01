// Briefkasten Coach → App (Cloudflare Pages Function). Bauplan Abschnitt 8.
// GET /api/inbox liefert alle noch nicht abgeholten Einträge aus D1 (Bindung INBOX_DB).
// Schutz: Header „Authorization: Bearer <INBOX_TOKEN>“ (Secret im Pages-Projekt).
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};
export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
async function sha(s) { return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }
// Token vergleichen, ohne durch die Laufzeit etwas zu verraten (Hashes gleicher Länge, alle Bytes prüfen)
export async function erlaubt(request, env) {
  const tok = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!env.INBOX_TOKEN || !tok) return false;
  const [a, b] = await Promise.all([sha(tok), sha(env.INBOX_TOKEN)]);
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
export async function vorab(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (!env.INBOX_DB) return json({ error: "D1-Datenbank INBOX_DB ist nicht verbunden" }, 500);
  if (!(await erlaubt(request, env))) return json({ error: "Token fehlt oder ist falsch" }, 401);
  return null;
}

export async function onRequest({ request, env }) {
  const stop = await vorab(request, env); if (stop) return stop;
  if (request.method !== "GET") return json({ error: "Nur GET" }, 405);
  const r = await env.INBOX_DB.prepare("SELECT id, created_at, kind, es, de, wrong, note FROM inbox WHERE fetched_at IS NULL ORDER BY id LIMIT 500").all();
  return json({ items: r.results || [] });
}
