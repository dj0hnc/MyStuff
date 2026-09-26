// Avisos al cel de quien entró.
// GET    /api/push                    -> {publica, suscrito, prefs}  (llave VAPID para suscribirse)
// POST   /api/push {sub, prefs}       -> guarda este dispositivo  · prefs: {horarios: bool, listos: bool}
// POST   /api/push?prueba=1           -> manda un aviso de prueba a mis dispositivos
// DELETE /api/push {endpoint}         -> quita este dispositivo
import { vapid, suscripciones, guardarSuscripciones, enviar } from "../../lib/push.js";

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export async function onRequest({ request, env, data }) {
  const u = data.usuario; if (!u) return json({ error: "sin_usuario" }, 400);
  const url = new URL(request.url), lista = await suscripciones(env, u);
  if (request.method === "GET") {
    const ep = url.searchParams.get("endpoint"), mia = lista.find((x) => x.sub.endpoint === ep);
    return json({ publica: (await vapid(env)).publica, suscrito: !!mia, prefs: mia?.prefs || null, dispositivos: lista.length });
  }
  const b = await request.json().catch(() => ({}));
  if (request.method === "POST" && url.searchParams.get("prueba")) return json({ enviados: await enviar(env, u, { titulo: "🔔 Avisos activados", cuerpo: "Así te va a llegar cuando toque publicar o algo quede listo.", url: "/", tag: "prueba" }) });
  if (request.method === "POST") {
    const s = b.sub; if (!s?.endpoint || !/^https:\/\//.test(s.endpoint) || !s.keys?.p256dh || !s.keys?.auth) return json({ error: "sub" }, 400);
    const prefs = { horarios: b.prefs?.horarios !== false, listos: b.prefs?.listos !== false };
    await guardarSuscripciones(env, u, [{ sub: { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }, prefs, at: new Date().toISOString() }, ...lista.filter((x) => x.sub.endpoint !== s.endpoint)]);
    return json({ ok: true, prefs });
  }
  if (request.method === "DELETE") { await guardarSuscripciones(env, u, lista.filter((x) => x.sub.endpoint !== b.endpoint)); return json({ ok: true }); }
  return json({ error: "metodo" }, 405);
}
