// Crudos: videos y fotos originales que Juan y Karen suben para que la Fábrica los trabaje. Viven en R2 (binding CRUDOS).
// Sin límite práctico: el panel los sube en partes (multipart de R2), así no choca con el tope de 100 MB por petición.
//   GET    /api/crudos?p=karen                      -> lista
//   POST   /api/crudos/iniciar   {p, nombre, tipo, nota, quien} -> {key, id}
//   PUT    /api/crudos/parte?key&id&n  (cuerpo = pedazo) -> {n, etag}
//   POST   /api/crudos/terminar  {key, id, partes:[{n,etag}], p, nota, quien} -> crea el pedido "Editar crudo" en el panel
//   POST   /api/crudos/cancelar  {key, id}
//   POST   /api/crudos/enlace    {p, url, nota, quien}  -> link de Dropbox/Drive/WeTransfer/TikTok/lo que sea: queda como pedido (funciona aun sin R2)
//   GET    /api/crudos/bajar?key[&descargar=1] (acepta Range: se ve en el panel, se baja con curl o como archivo)
// Finales en 1080: iniciar con {carpeta:"finales", nombre:"<id>.mp4"} guarda en finales/<p>/<id>.mp4 (se reemplaza al volver a subir, sin pedido).
//   DELETE /api/crudos?key
// El PIN lo cuida _middleware.js.
import { clave, PROYECTOS } from "../estado.js";

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const keyOk = (k) => typeof k === "string" && PROYECTOS.some((p) => k.startsWith(p + "/") || k.startsWith(`finales/${p}/`)) && !k.includes("..") && k.length < 300;

// Links directos donde se pueda (así la rutina baja el archivo con curl sin página intermedia).
function directo(u) {
  if (/(^|\.)dropbox\.com$/.test(u.hostname)) { u.searchParams.set("dl", "1"); return u.toString(); }
  const drive = /drive\.google\.com\/file\/d\/([\w-]+)/.exec(u.toString());
  if (drive) return `https://drive.usercontent.google.com/download?id=${drive[1]}&export=download&confirm=t`;
  return u.toString();
}
async function pedido(env, p, texto, quien, extra = {}) {
  if (!env.ESTADO) return;
  const e = JSON.parse((await env.ESTADO.get(clave(p))) || "{}"), ahora = new Date().toISOString();
  e.pedidos = [{ id: crypto.randomUUID().slice(0, 8), texto, quien, at: ahora, estado: "nuevo", ...extra }, ...(e.pedidos || [])].slice(0, 200);
  e.bitacora = [{ quien, que: texto.split("\n")[0].slice(0, 80), at: ahora }, ...(e.bitacora || [])].slice(0, 150);
  await env.ESTADO.put(clave(p), JSON.stringify(e));
}

export async function onRequest({ request, env, params }) {
  const url = new URL(request.url), ruta = (params.ruta || []).join("/"), m = request.method;
  if (ruta === "enlace" && m === "POST") {
    const b = await request.json().catch(() => ({})), p = PROYECTOS.includes(b.p) ? b.p : null;
    let u; try { u = new URL(String(b.url || "").trim()); } catch {}
    if (!p || !u || !/^https?:$/.test(u.protocol)) return json({ error: "enlace", mensaje: "Pega un link completo (https://…)." }, 400);
    const bajar = directo(u), quien = String(b.quien || "Alguien").slice(0, 24), nota = String(b.nota || "").slice(0, 400);
    await pedido(env, p, `Editar crudo desde link${nota ? ": " + nota : ""}\nLink: ${u}\nBajar: yt-dlp o curl -L "${bajar}" -o public/reedit/<nombre>`, quien, { enlace: u.toString() });
    if (env.CRUDOS) await env.CRUDOS.put(`${p}/${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}-enlace.url`, u.toString(), { httpMetadata: { contentType: "text/uri-list" }, customMetadata: { nombre: u.hostname + u.pathname.slice(0, 60), nota, quien, enlace: u.toString() } });
    return json({ ok: true, bajar });
  }
  if (!env.CRUDOS) return json({ error: "sin_r2", mensaje: "Falta activar el almacenamiento R2 en Cloudflare." }, 503);
  try {
    if (ruta === "" && m === "GET") {
      const p = PROYECTOS.includes(url.searchParams.get("p")) ? url.searchParams.get("p") : "clipper";
      const l = await env.CRUDOS.list({ prefix: p + "/", include: ["customMetadata", "httpMetadata"], limit: 500 });
      return json({ crudos: l.objects.map((o) => ({ key: o.key, tam: o.size, at: o.uploaded, tipo: o.httpMetadata?.contentType || "", ...o.customMetadata })).sort((a, b) => String(b.at).localeCompare(String(a.at))) });
    }
    if (ruta === "iniciar" && m === "POST") {
      const b = await request.json(), p = PROYECTOS.includes(b.p) ? b.p : null;
      if (!p) return json({ error: "proyecto" }, 400);
      const nombre = String(b.nombre || "crudo").normalize("NFKD").replace(/[^\w.-]+/g, "-").slice(-80);
      const key = b.carpeta === "finales" ? `finales/${p}/${nombre}` : `${p}/${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}-${nombre}`;
      const up = await env.CRUDOS.createMultipartUpload(key, { httpMetadata: { contentType: String(b.tipo || "application/octet-stream").slice(0, 80) }, customMetadata: { nombre: String(b.nombre || nombre).slice(0, 120), nota: String(b.nota || "").slice(0, 500), quien: String(b.quien || "").slice(0, 24) } });
      return json({ key, id: up.uploadId });
    }
    if (ruta === "parte" && m === "PUT") {
      const key = url.searchParams.get("key"), n = Number(url.searchParams.get("n"));
      if (!keyOk(key) || !(n >= 1 && n <= 10000)) return json({ error: "parte" }, 400);
      const parte = await env.CRUDOS.resumeMultipartUpload(key, url.searchParams.get("id")).uploadPart(n, await request.arrayBuffer());
      return json({ n: parte.partNumber, etag: parte.etag });
    }
    if (ruta === "terminar" && m === "POST") {
      const b = await request.json();
      if (!keyOk(b.key) || !Array.isArray(b.partes)) return json({ error: "terminar" }, 400);
      const obj = await env.CRUDOS.resumeMultipartUpload(b.key, b.id).complete(b.partes.map((x) => ({ partNumber: Number(x.n), etag: String(x.etag) })).sort((a, c) => a.partNumber - c.partNumber));
      if (b.key.startsWith("finales/")) return json({ key: b.key, tam: obj.size }); // un final no es pedido
      const p = b.key.split("/")[0], quien = String(b.quien || "Alguien").slice(0, 24);
      const mb = (obj.size / 1048576).toFixed(0), nombre = b.key.split("/").pop();
      // queda como pedido para la rutina, con el comando para bajarlo
      await pedido(env, p, `Editar crudo "${nombre}" (${mb} MB)${b.nota ? ": " + String(b.nota).slice(0, 400) : ""}\nBajar: curl -H "x-pin: $PANEL_PIN" "${url.origin}/api/crudos/bajar?key=${encodeURIComponent(b.key)}" -o public/reedit/${nombre}`, quien, { crudo: b.key });
      return json({ key: b.key, tam: obj.size });
    }
    if (ruta === "cancelar" && m === "POST") {
      const b = await request.json(); if (keyOk(b.key)) await env.CRUDOS.resumeMultipartUpload(b.key, b.id).abort().catch(() => {});
      return json({ ok: true });
    }
    if (ruta === "bajar" && (m === "GET" || m === "HEAD")) {
      const key = url.searchParams.get("key"); if (!keyOk(key)) return json({ error: "key" }, 400);
      const rg = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "");
      const range = rg && (rg[1] || rg[2]) ? (rg[1] === "" ? { suffix: Number(rg[2]) } : rg[2] === "" ? { offset: Number(rg[1]) } : { offset: Number(rg[1]), length: Number(rg[2]) - Number(rg[1]) + 1 }) : undefined;
      const o = await env.CRUDOS.get(key, range ? { range } : {});
      if (!o) return json({ error: "no_existe" }, 404);
      const h = new Headers({ "accept-ranges": "bytes", "cache-control": "private, max-age=3600" }); o.writeHttpMetadata(h);
      h.set("content-disposition", `${url.searchParams.get("descargar") ? "attachment" : "inline"}; filename="${key.split("/").pop()}"`);
      if (!range) { h.set("content-length", String(o.size)); return new Response(m === "HEAD" ? null : o.body, { headers: h }); }
      const ini = o.range.offset ?? o.size - o.range.suffix, len = o.range.length ?? o.size - ini;
      h.set("content-range", `bytes ${ini}-${ini + len - 1}/${o.size}`); h.set("content-length", String(len));
      return new Response(o.body, { status: 206, headers: h });
    }
    if (ruta === "" && m === "DELETE") {
      const key = url.searchParams.get("key"); if (!keyOk(key)) return json({ error: "key" }, 400);
      await env.CRUDOS.delete(key); return json({ ok: true });
    }
    return json({ error: "ruta" }, 404);
  } catch (e) { return json({ error: "r2", mensaje: String(e.message || e).slice(0, 200) }, 500); }
}
