// Puerta del Puente de mando: todo el sitio (página, videos, datos, API) pide entrar. Cada quien tiene su entrada
// (Juan, Karen) con su propio PIN; mientras no lo cambie, vale el PIN general (secreto PIN). Queda una cookie firmada
// por 180 días con quién es, y los paneles lo leen de /api/yo. La rutina de Claude entra con el header x-pin (PIN general).

const html = (body, status = 200, extra = {}) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...extra } });
export const sha = async (t) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const firma = (usuario, env) => sha(`puente:${usuario}:${env.PIN}`); // cambiar el PIN general cierra todas las sesiones

// Las personas del Puente y el orden de sus proyectos. En KV "usuarios" se guarda solo el PIN propio (hash) de cada quien.
export const USUARIOS = {
  juan: { nombre: "Juan", color: "#29e7ff", proyectos: ["clipper", "rave", "karen"] },
  karen: { nombre: "Karen", color: "#ff5fa2", proyectos: ["karen", "rave", "clipper"] },
};
export const pines = async (env) => { try { return JSON.parse((await env.ESTADO?.get("usuarios")) || "{}"); } catch { return {}; } };

const PUERTA = (error, elegido = "") => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#05080f"><title>Puente de Mando · Acceso</title><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="icon" href="/icono-192.png"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Puente">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Orbitron:wght@800&family=Rajdhani:wght@600;700&family=Share+Tech+Mono&display=swap">
<style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%}
body{display:grid;place-items:center;min-height:100vh;padding:calc(16px + env(safe-area-inset-top,0px)) 16px calc(16px + env(safe-area-inset-bottom,0px));background:radial-gradient(900px 500px at 50% -120px,#0d2440,transparent 60%),repeating-linear-gradient(0deg,rgba(41,231,255,.035) 0 1px,transparent 1px 4px),#05080f;color:#d6ecff;font:600 16px "Rajdhani",system-ui,sans-serif}
form{width:min(460px,100%);display:grid;gap:18px;padding:28px 22px;border:1px solid #1b3656;border-radius:20px;background:rgba(10,19,34,.92);box-shadow:0 0 50px rgba(41,231,255,.12);text-align:center}
h1{margin:0;font:800 clamp(18px,5vw,22px) "Orbitron",sans-serif;letter-spacing:.12em;color:#29e7ff}
p{margin:0;color:#7fb8d6}
.quien{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}
.quien input{position:absolute;opacity:0;pointer-events:none}
.quien label{display:grid;justify-items:center;gap:10px;padding:18px 10px;border-radius:18px;border:2px solid #1b3656;background:#08111f;cursor:pointer;transition:border-color .15s,box-shadow .15s}
.quien label i{width:84px;height:84px;border-radius:50%;display:grid;place-items:center;font:800 34px "Orbitron",sans-serif;font-style:normal;color:#05080f;background:var(--c);box-shadow:0 0 24px color-mix(in srgb,var(--c) 45%,transparent)}
.quien label b{font:800 16px "Orbitron",sans-serif;letter-spacing:.08em}
.quien input:checked+label{border-color:var(--c);box-shadow:0 0 22px color-mix(in srgb,var(--c) 40%,transparent)}
.quien input:focus-visible+label{outline:2px solid #ffb020;outline-offset:3px}
.pin{width:100%;text-align:center;letter-spacing:.5em;font:400 30px "Share Tech Mono",monospace;padding:12px;border-radius:12px;border:1px solid #1b3656;background:#05080f;color:#29e7ff}
.pin:focus{outline:2px solid #ffb020;outline-offset:2px}
button{padding:14px;border:0;border-radius:12px;background:#29e7ff;color:#05080f;font:800 14px "Orbitron",sans-serif;letter-spacing:.14em;cursor:pointer}
.err{color:#ff4d4d;font-family:"Share Tech Mono",monospace}
</style></head><body>
<form method="post" action="/__entrar">
<h1>PUENTE DE MANDO</h1><p>¿Quién entra?</p>
<div class="quien" role="radiogroup" aria-label="Quién entra">
${Object.entries(USUARIOS).map(([k, u]) => `<input type="radio" name="usuario" id="u-${k}" value="${k}" required${elegido === k ? " checked" : ""}><label for="u-${k}" style="--c:${u.color}"><i>${u.nombre[0]}</i><b>${u.nombre.toUpperCase()}</b></label>`).join("")}
</div>
<input class="pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="••••••" required aria-label="Tu PIN">
${error ? `<div class="err">${error}</div>` : ""}
<button type="submit">ENTRAR</button>
</form>
<script>
const f=document.forms[0];let u="";try{u=localStorage.getItem("puente-ultimo")||""}catch{}
const r=f.querySelector('input[value="'+(${JSON.stringify(elegido)}||u)+'"]');if(r&&!f.querySelector("input[name=usuario]:checked"))r.checked=true;
f.querySelectorAll("input[name=usuario]").forEach(x=>x.addEventListener("change",()=>f.pin.focus()));
f.addEventListener("submit",()=>{try{localStorage.setItem("puente-ultimo",f.usuario.value)}catch{}});
if(f.querySelector("input[name=usuario]:checked"))f.pin.focus();
</script></body></html>`;

// Pages no responde "Range" en los estáticos y Safari (iPhone) no reproduce un video sin 206. Se corta aquí.
// ponytail: carga el mp4 entero en memoria para cortarlo; sobra con finales de 720p (~5 MB). Si pesan >50 MB, pasar a R2.
async function conRango(request, res) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "");
  if (res.status !== 200) return res;
  if (!m || (m[1] === "" && m[2] === "")) { const r = new Response(res.body, res); r.headers.set("accept-ranges", "bytes"); return r; }
  const buf = await res.arrayBuffer(), n = buf.byteLength;
  const a = m[1] === "" ? Math.max(0, n - Number(m[2])) : Number(m[1]);
  const b = m[1] === "" || m[2] === "" ? n - 1 : Math.min(Number(m[2]), n - 1);
  if (a > b || a >= n) return new Response(null, { status: 416, headers: { "content-range": `bytes */${n}` } });
  const h = new Headers(res.headers); h.set("content-range", `bytes ${a}-${b}/${n}`); h.set("content-length", String(b - a + 1)); h.set("accept-ranges", "bytes");
  return new Response(buf.slice(a, b + 1), { status: 206, headers: h });
}

export async function onRequest({ request, env, next, data }) {
  if (!env.PIN) return next(); // ponytail: sin PIN tampoco hay cortes por rango; hoy siempre hay PIN
  const url = new URL(request.url);

  if (/^\/(manifest\.webmanifest|icono-\d+\.png|apple-touch-icon\.png)$/.test(url.pathname)) return next(); // el cel los pide para instalar la app, sin cookie
  if (url.pathname === "/__salir") return new Response(null, { status: 302, headers: [["Location", "/"], ["Set-Cookie", "puente=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"]] });

  if (url.pathname === "/__entrar" && request.method === "POST") {
    const f = await request.formData(), usuario = String(f.get("usuario") || ""), pin = String(f.get("pin") || "");
    const propio = USUARIOS[usuario] && (await pines(env))[usuario]?.pin;
    const bien = USUARIOS[usuario] && (propio ? (await sha(`pin:${usuario}:${pin}`)) === propio : pin === String(env.PIN));
    if (bien) return new Response(null, { status: 302, headers: { Location: "/", "Set-Cookie": `puente=${usuario}.${await firma(usuario, env)}; Path=/; Max-Age=15552000; HttpOnly; Secure; SameSite=Lax` } });
    await new Promise((r) => setTimeout(r, 1200)); // frena intentos a lo loco
    return html(PUERTA(USUARIOS[usuario] ? "PIN incorrecto" : "Elige quién eres", USUARIOS[usuario] ? usuario : ""), 401); // solo nombres conocidos vuelven a la página
  }

  const galleta = /(?:^|;\s*)puente=([a-z]+)\.([0-9a-f]{64})/.exec(request.headers.get("cookie") || "");
  if (galleta && USUARIOS[galleta[1]] && galleta[2] === (await firma(galleta[1], env))) data.usuario = galleta[1];
  const ok = data.usuario || request.headers.get("x-pin") === String(env.PIN);
  if (ok) {
    if (/^\/(karen|rave)\/?$/.test(url.pathname)) return env.ASSETS.fetch(new URL("/proyecto", url)); // una sola página para los paneles de proyecto
    return url.pathname.endsWith(".mp4") ? conRango(request, await next()) : next();
  }
  if (url.pathname.startsWith("/api/")) return new Response(JSON.stringify({ error: "pin" }), { status: 401, headers: { "content-type": "application/json" } });
  return html(PUERTA(""), 401);
}
