// Taller en vivo (lo usan las 3 páginas): lo que Remotion está renderizando ahorita, con porcentaje, tiempo restante y foto.
// Aparece solo cuando hay algo en proceso (o terminó hace poco). Lee /api/taller: cada 5 s si hay render, cada 30 s si no.
(() => {
  const css = `
  .ta-pill{position:fixed;left:16px;bottom:calc(var(--ta-bajo,16px) + env(safe-area-inset-bottom,0px));z-index:25;display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border-radius:999px;border:1px solid #ffb020;background:rgba(10,12,20,.94);color:#ffe3a3;font:800 13px system-ui,sans-serif;cursor:pointer;box-shadow:0 0 22px rgba(255,176,32,.3)}
  .ta-pill.listo{border-color:#35d07f;color:#b6f5d2;box-shadow:0 0 22px rgba(53,208,127,.3)}
  .ta-pill.error{border-color:#ff4d6d;color:#ffb3c1}
  .ta-pill i{width:9px;height:9px;border-radius:50%;background:currentColor;animation:ta-late 1.2s infinite}
  @keyframes ta-late{50%{opacity:.25}}
  .ta-fondo{position:fixed;inset:0;z-index:75;background:rgba(0,0,0,.6);display:grid;align-items:end;justify-items:center}
  .ta{width:min(620px,100%);max-height:88vh;overflow:auto;background:#0d0f17;color:#eef1ff;border:1px solid #262b40;border-bottom:0;border-radius:20px 20px 0 0;padding:16px 16px calc(18px + env(safe-area-inset-bottom,0px));display:grid;gap:12px;font:600 15px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif}
  .ta-top{display:flex;justify-content:space-between;align-items:center}.ta-top b{font-size:18px}
  .ta-b{appearance:none;padding:9px 12px;border-radius:10px;border:1px solid #2c3250;background:#1d2238;color:#eef1ff;font:800 14px system-ui,sans-serif;cursor:pointer}
  .ta-it{display:grid;grid-template-columns:78px 1fr;gap:12px;padding:12px;border-radius:14px;border:1px solid #262b40;background:#131626}
  .ta-it img,.ta-it .ta-sin{width:78px;aspect-ratio:9/16;object-fit:cover;border-radius:10px;background:#05080f;display:grid;place-items:center;font-size:26px}
  .ta-it b{display:block}.ta-it small{display:block;color:#8e97c4;font-weight:500;overflow-wrap:anywhere}
  .ta-barra{height:10px;border-radius:99px;background:#05080f;border:1px solid #262b40;overflow:hidden;margin:8px 0 4px}
  .ta-barra i{display:block;height:100%;background:linear-gradient(90deg,#ffb020,#35d07f);transition:width .6s}
  .ta-it.error .ta-barra i{background:#ff4d6d}
  .ta-vacio{color:#8e97c4;text-align:center;padding:18px;border:1px dashed #2c3250;border-radius:12px}
  @media (prefers-reduced-motion:reduce){.ta-pill i{animation:none}.ta-barra i{transition:none}}`;
  const st = document.createElement("style"); st.textContent = css; document.head.append(st);
  const h = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const PROY = { clipper: "Clips", rave: "Rave Couple", karen: "Karen" };
  const falta = (s) => (s == null ? "" : s < 60 ? `falta ${s} s` : `falta ${Math.round(s / 60)} min`);
  const hace = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? "ahora" : m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`; };
  let trabajos = [], hoja = null, reloj = null;
  const pill = h("button", "ta-pill"); pill.type = "button"; pill.hidden = true; pill.onclick = () => abrir(); document.body.append(pill);

  function pintaPill() {
    const vivos = trabajos.filter((t) => t.estado === "renderizando"), recien = trabajos.filter((t) => t.estado !== "renderizando" && Date.now() - Date.parse(t.at) < 10 * 60000);
    if (vivos.length) { const t = vivos[0]; pill.className = "ta-pill"; pill.replaceChildren(h("i"), document.createTextNode(`🎬 ${vivos.length > 1 ? "×" + vivos.length + " " : ""}${t.pct ?? 0}%${t.restante ? " · " + falta(t.restante).replace("falta ", "") : ""}`)); }
    else if (recien.length) { const t = recien[0]; pill.className = "ta-pill " + (t.estado === "error" ? "error" : "listo"); pill.replaceChildren(document.createTextNode(t.estado === "error" ? "⚠ Falló un render" : "✓ Render listo")); }
    pill.hidden = !(vivos.length || recien.length); pill.setAttribute("aria-label", "Taller: " + pill.textContent);
  }
  function item(t) {
    const it = h("div", "ta-it" + (t.estado === "error" ? " error" : "")), foto = t.foto ? h("img") : h("div", "ta-sin", "🎬");
    if (t.foto) { foto.src = `/api/taller/foto?id=${encodeURIComponent(t.id)}`; foto.alt = "Vistazo de " + (t.titulo || "el video"); }
    const txt = h("div"), barra = h("div", "ta-barra"), i = h("i"); i.style.width = (t.pct ?? 0) + "%"; barra.append(i);
    txt.append(h("b", null, t.titulo || t.salida || t.id), h("small", null, `${PROY[t.proyecto] || t.proyecto || ""} · ${t.comp || ""} · empezó ${hace(t.inicio)}`), barra,
      h("small", null, t.estado === "renderizando" ? `${t.etapa || "Renderizando"} · ${t.pct ?? 0}% ${falta(t.restante)}` : t.estado === "error" ? `Falló: ${t.linea || "revisa la sesión de Claude"}` : `✓ Listo ${hace(t.at)}. Aparece en el panel cuando Claude lo sube.`));
    it.append(foto, txt); return it;
  }
  function pintaHoja() {
    if (!hoja) return; const lista = hoja.querySelector(".ta-lista");
    lista.replaceChildren(...(trabajos.length ? trabajos.map(item) : [h("div", "ta-vacio", "No hay nada renderizándose ahorita. Cuando Claude edite algo, aquí lo ves en vivo.")]));
  }
  function abrir() {
    const fondo = h("div", "ta-fondo"), p = h("div", "ta"); p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "Taller de renders");
    const cerrar = () => { fondo.remove(); hoja = null; document.removeEventListener("keydown", esc); };
    const esc = (e) => e.key === "Escape" && cerrar();
    fondo.onclick = (e) => e.target === fondo && cerrar(); document.addEventListener("keydown", esc);
    const top = h("div", "ta-top"), x = h("button", "ta-b", "Cerrar"); x.type = "button"; x.onclick = cerrar;
    top.append(h("b", null, "🎬 Taller · renders en vivo"), x);
    p.append(top, h("small", null, "Lo que la Fábrica está creando con Remotion: foto, porcentaje y cuánto falta. Se actualiza solo."), h("div", "ta-lista"));
    p.querySelector("small").style.color = "#8e97c4"; p.querySelector(".ta-lista").style.cssText = "display:grid;gap:10px";
    fondo.append(p); document.body.append(fondo); hoja = p; pintaHoja(); x.focus(); traer();
  }
  async function traer() {
    clearTimeout(reloj);
    if (document.visibilityState === "visible") { try { const r = await fetch("/api/taller", { cache: "no-store" }); if (r.ok) trabajos = (await r.json()).trabajos || []; } catch {} pintaPill(); pintaHoja(); }
    reloj = setTimeout(traer, trabajos.some((t) => t.estado === "renderizando") || hoja ? 5000 : 30000);
  }
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && traer());
  traer();
  window.Taller = { abrir };
})();
