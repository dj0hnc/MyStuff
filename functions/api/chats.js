// Historial de pláticas del chat, separado por persona y proyecto (misma memoria KV, clave chats:<usuario>:<proyecto>).
// GET    /api/chats?p=karen          -> [{id, titulo, at, n}]  (lo más reciente primero)
// GET    /api/chats?p=karen&id=x     -> {id, titulo, at, mensajes}
// POST   /api/chats {p, id, titulo}  -> renombrar
// DELETE /api/chats?p=karen&id=x     -> borrar
// El chat (/api/chat) guarda solo cada intercambio con guardarHilo(). Quién es lo pone el middleware.
import { PROYECTOS } from "./estado.js";

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const clave = (u, p) => `chats:${u}:${PROYECTOS.includes(p) ? p : "clipper"}`;
const MAX_HILOS = 60, MAX_MSGS = 80;
// ponytail: todos los hilos de una persona en un solo valor de KV; sobra para cientos de pláticas. Si crece, un valor por hilo.
export const leerHilos = async (env, u, p) => { try { return JSON.parse((await env.ESTADO.get(clave(u, p))) || "[]"); } catch { return []; } };
const escribir = (env, u, p, hilos) => env.ESTADO.put(clave(u, p), JSON.stringify(hilos.slice(0, MAX_HILOS)));

export async function guardarHilo(env, u, p, id, mensajes) {
  const hilos = await leerHilos(env, u, p), ahora = new Date().toISOString();
  let h = hilos.find((x) => x.id === id);
  if (!h) { h = { id: id || crypto.randomUUID().slice(0, 10), titulo: String(mensajes.find((m) => m.rol === "yo")?.texto || "Plática").replace(/\s+/g, " ").slice(0, 60) }; }
  h.mensajes = mensajes.slice(-MAX_MSGS).map((m) => ({ rol: ["yo", "fabrica", "pedido"].includes(m.rol) ? m.rol : "fabrica", texto: String(m.texto || "").slice(0, 4000) }));
  h.at = ahora;
  await escribir(env, u, p, [h, ...hilos.filter((x) => x.id !== h.id)]);
  return h.id;
}

export async function onRequest({ request, env, data }) {
  const u = data.usuario; if (!u) return json({ error: "sin_usuario" }, 400);
  if (!env.ESTADO) return json({ error: "sin_kv" }, 503);
  const url = new URL(request.url), p = url.searchParams.get("p"), id = url.searchParams.get("id");
  if (request.method === "GET") {
    const hilos = await leerHilos(env, u, p);
    if (id) { const h = hilos.find((x) => x.id === id); return h ? json(h) : json({ error: "no_existe" }, 404); }
    return json(hilos.map(({ id, titulo, at, mensajes }) => ({ id, titulo, at, n: mensajes.length })));
  }
  if (request.method === "DELETE") { const hilos = await leerHilos(env, u, p); await escribir(env, u, p, hilos.filter((x) => x.id !== id)); return json({ ok: true }); }
  if (request.method === "POST") {
    const b = await request.json().catch(() => ({})), hilos = await leerHilos(env, u, b.p), h = hilos.find((x) => x.id === b.id);
    if (!h) return json({ error: "no_existe" }, 404);
    h.titulo = String(b.titulo || "").trim().slice(0, 60) || h.titulo; await escribir(env, u, b.p, hilos); return json({ ok: true });
  }
  return json({ error: "metodo" }, 405);
}
