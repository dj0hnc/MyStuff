// Historial de pláticas del chat (lo usan los 3 paneles). Cada quien ve solo las suyas (las separa el servidor por quien entró).
// Historial.abrir({p, actual, onAbrir(hilo), onNueva()}) · Historial.cargar(p, id) -> {id, titulo, mensajes}
(() => {
  const css = `
  .hi-fondo{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.55);display:grid;justify-items:start}
  .hi{width:min(420px,92vw);height:100%;overflow:auto;background:#0d0f17;color:#eef1ff;border-right:1px solid #262b40;padding:calc(14px + env(safe-area-inset-top,0px)) 14px calc(20px + env(safe-area-inset-bottom,0px));display:grid;gap:10px;align-content:start;font:600 15px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif}
  .hi-top{display:flex;justify-content:space-between;align-items:center;gap:8px}.hi-top b{font-size:18px}
  .hi-b{appearance:none;padding:9px 12px;border-radius:10px;border:1px solid #2c3250;background:#1d2238;color:#eef1ff;font:800 14px system-ui,sans-serif;cursor:pointer}
  .hi-b.si{background:#35d07f;border-color:#35d07f;color:#04120a}
  .hi-it{display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;padding:10px;border-radius:12px;border:1px solid #262b40;background:#131626}
  .hi-it.actual{border-color:#35d07f}
  .hi-it button.abrir{appearance:none;border:0;background:none;color:inherit;text-align:left;font:inherit;cursor:pointer;padding:0;min-width:0}
  .hi-it b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hi-it small{color:#8e97c4;font-weight:500}
  .hi-ic{appearance:none;width:36px;height:36px;border-radius:10px;border:1px solid #2c3250;background:#1d2238;color:#eef1ff;cursor:pointer;font-size:15px}
  .hi-vacio{color:#8e97c4;padding:16px;text-align:center;border:1px dashed #2c3250;border-radius:12px}
  .hi :focus-visible{outline:2px solid #ffc857;outline-offset:2px}`;
  const st = document.createElement("style"); st.textContent = css; document.head.append(st);
  const h = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const api = (q, o) => fetch("/api/chats" + q, o).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  const cuando = (iso) => { const d = new Date(iso), m = Math.round((Date.now() - d) / 60000); return m < 1 ? "ahora" : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : d.toLocaleDateString("es-MX", { day: "numeric", month: "short" }); };
  const cargar = (p, id) => api(`?p=${p}&id=${encodeURIComponent(id)}`);

  function abrir(o) {
    const fondo = h("div", "hi-fondo"), panel = h("div", "hi"); panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Historial de pláticas");
    const cerrar = () => { fondo.remove(); document.removeEventListener("keydown", esc); };
    const esc = (e) => e.key === "Escape" && cerrar();
    fondo.onclick = (e) => e.target === fondo && cerrar(); document.addEventListener("keydown", esc);
    const top = h("div", "hi-top"), x = h("button", "hi-b", "Cerrar"); x.type = "button"; x.onclick = cerrar; top.append(h("b", null, "Tus pláticas"), x);
    const nueva = h("button", "hi-b si", "＋ Nueva plática"); nueva.type = "button"; nueva.onclick = () => { cerrar(); o.onNueva(); };
    const lista = h("div"); lista.style.cssText = "display:grid;gap:8px"; lista.append(h("div", "hi-vacio", "Cargando…"));
    panel.append(top, nueva, lista); fondo.append(panel); document.body.append(fondo); nueva.focus();
    const pinta = async () => {
      let hilos; try { hilos = await api(`?p=${o.p}`); } catch (s) { lista.replaceChildren(h("div", "hi-vacio", s === 400 ? "Entra con tu nombre (⇄ Cambiar en el inicio) para guardar tu historial." : "No se pudo cargar. Revisa la señal.")); return; }
      if (!hilos.length) { lista.replaceChildren(h("div", "hi-vacio", "Todavía no hay pláticas. Lo que platiques se guarda aquí solo.")); return; }
      lista.replaceChildren(...hilos.map((t) => {
        const it = h("div", "hi-it" + (t.id === o.actual ? " actual" : "")), ab = h("button", "abrir"), ren = h("button", "hi-ic", "✎"), bor = h("button", "hi-ic", "🗑");
        ab.type = ren.type = bor.type = "button"; ren.setAttribute("aria-label", "Renombrar " + t.titulo); bor.setAttribute("aria-label", "Borrar " + t.titulo);
        ab.append(h("b", null, t.titulo), h("small", null, `${cuando(t.at)} · ${t.n} mensajes`));
        ab.onclick = async () => { try { const hilo = await cargar(o.p, t.id); cerrar(); o.onAbrir(hilo); } catch { alert("No se pudo abrir. Revisa la señal."); } };
        ren.onclick = async () => { const n = prompt("Nuevo nombre de la plática:", t.titulo); if (!n?.trim()) return; await api("", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ p: o.p, id: t.id, titulo: n.trim() }) }).catch(() => {}); pinta(); };
        bor.onclick = async () => { if (!confirm(`¿Borrar "${t.titulo}"? No se puede deshacer.`)) return; await api(`?p=${o.p}&id=${encodeURIComponent(t.id)}`, { method: "DELETE" }).catch(() => {}); if (t.id === o.actual) o.onBorrada?.(); pinta(); };
        it.append(ab, ren, bor); return it;
      }));
    };
    pinta();
  }
  window.Historial = { abrir, cargar };
})();
