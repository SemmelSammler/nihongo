// POST /api/inbox/ack  { "ids": ["2026-11-03-001", …] }  → setzt fetched_at, damit Einträge nicht doppelt kommen.
import { json, vorab } from "./index.js";

export async function onRequest({ request, env }) {
  const stop = await vorab(request, env); if (stop) return stop;
  if (request.method !== "POST") return json({ error: "Nur POST" }, 405);
  let body; try { body = await request.json(); } catch { return json({ error: "Kein JSON" }, 400); }
  const ids = (Array.isArray(body && body.ids) ? body.ids : []).filter((x) => typeof x === "string" && x.length <= 64).slice(0, 500);
  if (!ids.length) return json({ ok: true, n: 0 });
  const jetzt = new Date().toISOString(), stmts = [];
  for (let i = 0; i < ids.length; i += 50) {
    const teil = ids.slice(i, i + 50);
    stmts.push(env.INBOX_DB.prepare("UPDATE inbox SET fetched_at = ? WHERE fetched_at IS NULL AND id IN (" + teil.map(() => "?").join(",") + ")").bind(jetzt, ...teil));
  }
  await env.INBOX_DB.batch(stmts);
  return json({ ok: true, n: ids.length });
}
