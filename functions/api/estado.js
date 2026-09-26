// Cerebro compartido del Puente de mando (Cloudflare Pages Function + KV).
// GET  /api/estado  -> estado completo {videos, pedidos, bitacora}
// POST /api/estado  -> {tipo, quien, pin?, ...}:
//   {tipo:"video", id, cambios:{tiktok,youtube,vyro,vtt,vyt,nota}}
//   {tipo:"pedido", texto}
//   {tipo:"pedido-estado", pid, estado:"nuevo"|"produccion"|"listo"}
// Requiere un KV enlazado como ESTADO. Si hay variable PIN, los POST deben traerla.
// ponytail: un solo documento en KV, último que escribe gana; sobra para 2-3 personas. Si crece, pasar a D1.

const CLAVE = "v1";
const vacio = () => ({ videos: {}, pedidos: [], bitacora: [] });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const texto = (x, max) => String(x ?? "").slice(0, max);

async function leer(env) {
  try { return { ...vacio(), ...(JSON.parse((await env.ESTADO.get(CLAVE)) || "{}")) }; } catch { return vacio(); }
}

export async function onRequestGet({ env }) {
  if (!env.ESTADO) return json({ error: "sin_kv" }, 503);
  return json(await leer(env));
}

export async function onRequestPost({ request, env }) {
  if (!env.ESTADO) return json({ error: "sin_kv" }, 503);
  let b;
  try { b = await request.json(); } catch { return json({ error: "json_invalido" }, 400); }
  if (env.PIN && String(b.pin || "") !== String(env.PIN)) return json({ error: "pin" }, 401);
  const quien = texto(b.quien, 24) || "Alguien";
  const ahora = new Date().toISOString();
  const e = await leer(env);
  let que = "";

  if (b.tipo === "video") {
    const id = texto(b.id, 80);
    if (!/^[\w-]+$/.test(id)) return json({ error: "id" }, 400);
    const c = b.cambios || {}, v = (e.videos[id] ||= {});
    for (const k of ["tiktok", "youtube", "vyro"]) if (k in c) { v[k] = !!c[k]; if (c[k]) que = `${k === "vyro" ? "registró en Vyro" : "subió a " + (k === "tiktok" ? "TikTok" : "YouTube")} ${id}`; }
    for (const k of ["vtt", "vyt"]) if (k in c) { const n = Math.max(0, Math.floor(Number(c[k]) || 0)); v[k] = n; que = `anotó ${n.toLocaleString("es-MX")} vistas ${k === "vtt" ? "TikTok" : "YouTube"} en ${id}`; }
    if ("nota" in c) { v.nota = texto(c.nota, 400); que = `dejó nota en ${id}`; }
    v.por = quien; v.at = ahora;
  } else if (b.tipo === "pedido") {
    const t = texto(b.texto, 500).trim();
    if (!t) return json({ error: "vacio" }, 400);
    e.pedidos.unshift({ id: crypto.randomUUID().slice(0, 8), texto: t, quien, at: ahora, estado: "nuevo" });
    e.pedidos = e.pedidos.slice(0, 200);
    que = `pidió: ${t.slice(0, 60)}`;
  } else if (b.tipo === "pedido-estado") {
    const p = e.pedidos.find((x) => x.id === b.pid);
    if (!p || !["nuevo", "produccion", "listo"].includes(b.estado)) return json({ error: "pedido" }, 400);
    p.estado = b.estado; que = `marcó pedido como ${b.estado}`;
  } else return json({ error: "tipo" }, 400);

  if (que) e.bitacora = [{ quien, que, at: ahora }, ...e.bitacora].slice(0, 150);
  await env.ESTADO.put(CLAVE, JSON.stringify(e));
  return json(e);
}
