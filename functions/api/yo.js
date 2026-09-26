// Quién está usando el panel (lo pone el middleware desde la cookie) y cambio de PIN propio.
// GET  /api/yo -> {usuario, nombre, color, proyectos, pinPropio}
// POST /api/yo {actual, nuevo} -> guarda el PIN nuevo (hash) en KV "usuarios"
import { USUARIOS, pines, sha } from "../_middleware.js";

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export async function onRequestGet({ env, data }) {
  if (!data.usuario) return json({ usuario: null });
  return json({ usuario: data.usuario, ...USUARIOS[data.usuario], pinPropio: !!(await pines(env))[data.usuario]?.pin });
}

export async function onRequestPost({ request, env, data }) {
  const u = data.usuario; if (!u) return json({ error: "sin_usuario" }, 400);
  const b = await request.json().catch(() => ({})), todos = await pines(env), propio = todos[u]?.pin;
  const actualOk = propio ? (await sha(`pin:${u}:${b.actual}`)) === propio : String(b.actual) === String(env.PIN);
  if (!actualOk) { await new Promise((r) => setTimeout(r, 1200)); return json({ error: "actual", mensaje: "El PIN actual no es correcto." }, 403); }
  if (!/^\d{4,12}$/.test(String(b.nuevo || ""))) return json({ error: "nuevo", mensaje: "El PIN nuevo debe tener de 4 a 12 números." }, 400);
  todos[u] = { pin: await sha(`pin:${u}:${b.nuevo}`), at: new Date().toISOString() };
  await env.ESTADO.put("usuarios", JSON.stringify(todos));
  return json({ ok: true });
}
