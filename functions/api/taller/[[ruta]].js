// Taller: renders de Remotion en vivo. scripts/taller.mjs avisa aquí el avance; los paneles lo muestran con su barra.
//   GET  /api/taller             -> {trabajos:[{id, titulo, proyecto, comp, etapa, pct, restante, estado, inicio, at, foto, salida, linea}]}
//   POST /api/taller {id, ...}   -> crea/actualiza un trabajo (estado: renderizando | listo | error)
//   PUT  /api/taller/foto?id=x   (cuerpo = jpg) · GET /api/taller/foto?id=x   -> vistazo de lo que se está creando (en R2)
// ponytail: KV gratis da 1,000 escrituras al día; taller.mjs avisa cada 15 s como máximo. Si se renderiza mucho, pasar a Durable Objects.
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const CLAVE = "taller", idOk = (x) => /^[\w-]{4,60}$/.test(String(x || ""));
const leer = async (env) => { try { return JSON.parse((await env.ESTADO.get(CLAVE)) || "[]"); } catch { return []; } };

export async function onRequest({ request, env, params }) {
  if (!env.ESTADO) return json({ error: "sin_kv" }, 503);
  const url = new URL(request.url), ruta = (params.ruta || []).join("/"), m = request.method;
  if (ruta === "foto") {
    const id = url.searchParams.get("id"); if (!idOk(id) || !env.CRUDOS) return json({ error: "foto" }, 400);
    if (m === "PUT") { const b = await request.arrayBuffer(); if (b.byteLength > 2e6) return json({ error: "grande" }, 413); await env.CRUDOS.put(`taller/${id}.jpg`, b, { httpMetadata: { contentType: "image/jpeg" } }); return json({ ok: true }); }
    const o = await env.CRUDOS.get(`taller/${id}.jpg`); return o ? new Response(o.body, { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=60" } }) : json({ error: "no_existe" }, 404);
  }
  if (ruta !== "") return json({ error: "ruta" }, 404);
  if (m === "GET") return json({ trabajos: await leer(env) });
  if (m === "POST") {
    const b = await request.json().catch(() => ({})); if (!idOk(b.id)) return json({ error: "id" }, 400);
    const ahora = new Date().toISOString(), lista = await leer(env), t = lista.find((x) => x.id === b.id) || { id: b.id, inicio: ahora };
    for (const k of ["titulo", "proyecto", "comp", "etapa", "salida", "linea"]) if (b[k] != null) t[k] = String(b[k]).slice(0, 200);
    if (b.pct != null) t.pct = Math.max(0, Math.min(100, Math.round(Number(b.pct) || 0)));
    if (b.restante != null) t.restante = Math.max(0, Math.round(Number(b.restante) || 0));
    if (["renderizando", "listo", "error"].includes(b.estado)) t.estado = b.estado;
    if (b.foto) t.foto = true;
    t.at = ahora;
    const vivos = [t, ...lista.filter((x) => x.id !== t.id)].filter((x) => x.estado === "renderizando" ? Date.now() - Date.parse(x.at) < 36e5 : Date.now() - Date.parse(x.at) < 864e5); // los atorados >1 h o los viejos >1 día se van
    await env.ESTADO.put(CLAVE, JSON.stringify(vivos.slice(0, 20)));
    return json(t);
  }
  return json({ error: "metodo" }, 405);
}
