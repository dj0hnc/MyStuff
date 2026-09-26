// Puerta del Puente de mando: todo el sitio (página, videos, datos, API) pide el PIN de entrada.
// Se valida una vez y queda una cookie firmada por 180 días. La rutina de Claude entra con el header x-pin.

const html = (body, status = 200, extra = {}) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...extra } });

async function firma(pin) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("puente:" + pin));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const PUERTA = (error) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#05080f"><title>Puente de Mando · Acceso</title><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="icon" href="/icono-192.png"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Puente">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Orbitron:wght@800&family=Rajdhani:wght@600&family=Share+Tech+Mono&display=swap">
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{display:grid;place-items:center;padding:16px;background:radial-gradient(900px 500px at 50% -120px,#0d2440,transparent 60%),repeating-linear-gradient(0deg,rgba(41,231,255,.035) 0 1px,transparent 1px 4px),#05080f;color:#d6ecff;font:600 16px "Rajdhani",system-ui,sans-serif}
form{width:min(360px,100%);display:grid;gap:14px;padding:26px 22px;border:1px solid #1b3656;border-radius:16px;background:rgba(10,19,34,.92);box-shadow:0 0 40px rgba(41,231,255,.12);text-align:center}
h1{margin:0;font:800 20px "Orbitron",sans-serif;letter-spacing:.12em;color:#29e7ff}
p{margin:0;color:#7fb8d6}
input{width:100%;text-align:center;letter-spacing:.5em;font:400 30px "Share Tech Mono",monospace;padding:12px;border-radius:10px;border:1px solid #1b3656;background:#05080f;color:#29e7ff}
input:focus{outline:2px solid #ffb020;outline-offset:2px}
button{padding:13px;border:0;border-radius:10px;background:#29e7ff;color:#05080f;font:800 14px "Orbitron",sans-serif;letter-spacing:.14em;cursor:pointer}
.err{color:#ff4d4d;font-family:"Share Tech Mono",monospace}
</style></head><body>
<form method="post" action="/__entrar">
<h1>PUENTE DE MANDO</h1><p>La Fábrica · acceso de tripulación</p>
<input name="pin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="••••••" required autofocus aria-label="PIN de entrada">
${error ? `<div class="err">${error}</div>` : ""}
<button type="submit">ENTRAR</button>
</form></body></html>`;

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

export async function onRequest({ request, env, next }) {
  if (!env.PIN) return next(); // ponytail: sin PIN tampoco hay cortes por rango; hoy siempre hay PIN
  const url = new URL(request.url);

  if (/^\/(manifest\.webmanifest|icono-\d+\.png|apple-touch-icon\.png)$/.test(url.pathname)) return next(); // el cel los pide para instalar la app, sin cookie
  if (url.pathname === "/__salir") return new Response(null, { status: 302, headers: { Location: "/", "Set-Cookie": "puente=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax" } });

  if (url.pathname === "/__entrar" && request.method === "POST") {
    const pin = String((await request.formData()).get("pin") || "");
    if (pin === String(env.PIN)) {
      return new Response(null, { status: 302, headers: { Location: "/", "Set-Cookie": `puente=${await firma(env.PIN)}; Path=/; Max-Age=15552000; HttpOnly; Secure; SameSite=Lax` } });
    }
    await new Promise((r) => setTimeout(r, 1200)); // frena intentos a lo loco
    return html(PUERTA("PIN incorrecto"), 401);
  }

  const cookie = request.headers.get("cookie") || "";
  const ok = cookie.includes(`puente=${await firma(env.PIN)}`) || request.headers.get("x-pin") === String(env.PIN);
  if (ok) {
    if (/^\/(karen|rave)\/?$/.test(url.pathname)) return env.ASSETS.fetch(new URL("/proyecto", url)); // una sola página para los paneles de proyecto
    return url.pathname.endsWith(".mp4") ? conRango(request, await next()) : next();
  }
  if (url.pathname.startsWith("/api/")) return new Response(JSON.stringify({ error: "pin" }), { status: 401, headers: { "content-type": "application/json" } });
  return html(PUERTA(""), 401);
}
