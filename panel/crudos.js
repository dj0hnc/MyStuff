// Subir crudos desde cualquier dispositivo (lo usan los 3 paneles). Parte cada archivo en pedazos de 25 MB y los sube
// de 3 en 3 a R2 (/api/crudos), con reintentos: no hay tope de tamaño y si se cae la señal un pedazo no se pierde todo.
// Crudos.montar(nodo, {p, quien: () => "Juan", toast})
(() => {
  const PARTE = 25 * 1024 * 1024, A_LA_VEZ = 3;
  const css = `
  .cr{display:grid;gap:12px}
  .cr-zona{display:grid;place-items:center;gap:6px;text-align:center;padding:26px 16px;border:2px dashed var(--cr-a,#29e7ff);border-radius:18px;background:color-mix(in srgb,var(--cr-a,#29e7ff) 8%,transparent);cursor:pointer;color:inherit}
  .cr-zona.encima{background:color-mix(in srgb,var(--cr-a,#29e7ff) 20%,transparent)}
  .cr-zona b{font-size:19px}.cr-zona small{opacity:.75}
  .cr-zona:focus-within{outline:2px solid #ffc857;outline-offset:3px}
  .cr textarea{width:100%;min-height:70px;resize:vertical;padding:11px;border-radius:12px;border:1px solid rgba(127,127,160,.35);background:rgba(0,0,0,.25);color:inherit;font:500 16px/1.4 system-ui,sans-serif}
  .cr-item{display:grid;grid-template-columns:64px 1fr auto;gap:10px;align-items:center;padding:10px;border-radius:14px;border:1px solid rgba(127,127,160,.3);background:rgba(0,0,0,.2)}
  .cr-item video,.cr-item img{width:64px;height:88px;object-fit:cover;border-radius:8px;background:#000}
  .cr-item b{display:block;font-size:14px;overflow-wrap:anywhere}.cr-item small{display:block;opacity:.75;font-size:12px}
  .cr-barra{height:8px;border-radius:99px;background:rgba(127,127,160,.25);overflow:hidden;margin-top:6px}
  .cr-barra i{display:block;height:100%;width:0;background:var(--cr-a,#29e7ff);transition:width .3s}
  .cr-b{appearance:none;border:1px solid rgba(127,127,160,.4);background:rgba(0,0,0,.25);color:inherit;border-radius:10px;padding:7px 10px;font:700 13px system-ui,sans-serif;cursor:pointer;text-decoration:none;text-align:center}
  .cr-acc{display:grid;gap:6px}
  .cr-aviso{padding:12px;border-radius:12px;border:1px solid #ffb020;color:#ffb020;background:rgba(255,176,32,.08);font-size:14px}`;
  const st = document.createElement("style"); st.textContent = css; document.head.append(st);
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const mb = (n) => (n >= 1073741824 ? (n / 1073741824).toFixed(1) + " GB" : Math.max(1, Math.round(n / 1048576)) + " MB");
  const api = async (ruta, opt = {}) => { const r = await fetch("/api/crudos" + ruta, opt); if (r.status === 401) location.reload(); const d = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(d.mensaje || d.error || r.status), { d, status: r.status }); return d; };
  let subiendo = 0;
  addEventListener("beforeunload", (e) => { if (subiendo) { e.preventDefault(); e.returnValue = ""; } });

  function montar(nodo, o) {
    const raiz = h("div", "cr"), zona = h("label", "cr-zona"), inp = h("input"), nota = h("textarea"), cola = h("div", "cr-acc"), lista = h("div", "cr-acc"), aviso = h("div", "cr-aviso"); aviso.hidden = true;
    inp.type = "file"; inp.multiple = true; inp.accept = "video/*,image/*"; inp.hidden = true;
    zona.append(inp, h("b", null, "＋ Subir crudos"), h("small", null, "Videos o fotos, del tamaño que sea. Desde el cel, la tablet o la compu."));
    nota.placeholder = "¿Qué quieres que haga la Fábrica con esto? (ej. corta lo mejor en 15 s, subtítulos, para TikTok)"; nota.maxLength = 500; nota.setAttribute("aria-label", "Instrucciones para la Fábrica");
    raiz.append(aviso, zona, nota, cola, h("b", null, "Crudos guardados"), lista); nodo.replaceChildren(raiz);
    ["dragenter", "dragover"].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add("encima"); }));
    ["dragleave", "drop"].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove("encima"); }));
    zona.addEventListener("drop", (e) => subirTodos([...e.dataTransfer.files]));
    inp.onchange = () => { subirTodos([...inp.files]); inp.value = ""; };

    async function subirTodos(files) { for (const f of files) await subir(f); cargar(); }
    async function subir(f) {
      const it = h("div", "cr-item"), prev = f.type.startsWith("image") ? h("img") : h("video"), txt = h("div"), barra = h("div", "cr-barra"), i = h("i"), info = h("small", null, "Preparando…"), cancelar = h("button", "cr-b", "Cancelar");
      prev.src = URL.createObjectURL(f); if (prev.tagName === "VIDEO") { prev.muted = true; prev.playsInline = true; }
      barra.append(i); txt.append(h("b", null, f.name), info, barra); cancelar.type = "button"; it.append(prev, txt, cancelar); cola.prepend(it);
      let parar = false; cancelar.onclick = () => (parar = true);
      subiendo++; let lock = null; try { lock = await navigator.wakeLock?.request("screen"); } catch {} // que no se apague la pantalla a media subida
      let ini = null;
      try {
        ini = await api("/iniciar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ p: o.p, nombre: f.name, tipo: f.type, nota: nota.value.trim(), quien: o.quien() }) });
        const total = Math.max(1, Math.ceil(f.size / PARTE)), partes = [], t0 = Date.now(); let hechos = 0, sig = 1;
        const trabajador = async () => {
          while (sig <= total && !parar) {
            const n = sig++, pedazo = f.slice((n - 1) * PARTE, Math.min(f.size, n * PARTE));
            for (let intento = 1; ; intento++) {
              try { partes.push(await api(`/parte?key=${encodeURIComponent(ini.key)}&id=${encodeURIComponent(ini.id)}&n=${n}`, { method: "PUT", body: pedazo })); break; }
              catch (e) { if (intento >= 4 || parar) throw e; await new Promise((r) => setTimeout(r, 1500 * intento)); }
            }
            hechos++; const seg = (Date.now() - t0) / 1000, sub = Math.min(f.size, hechos * PARTE);
            i.style.width = (hechos / total) * 100 + "%"; info.textContent = `${mb(sub)} de ${mb(f.size)} · ${mb(sub / Math.max(seg, 1))}/s`;
          }
        };
        await Promise.all(Array.from({ length: Math.min(A_LA_VEZ, total) }, trabajador));
        if (parar) throw new Error("cancelado");
        await api("/terminar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: ini.key, id: ini.id, partes, nota: nota.value.trim(), quien: o.quien() }) });
        info.textContent = `✓ Subido (${mb(f.size)}). Quedó como pedido para la Fábrica.`; i.style.width = "100%"; cancelar.remove(); o.toast?.("Crudo subido");
      } catch (e) {
        if (ini) api("/cancelar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: ini.key, id: ini.id }) }).catch(() => {});
        if (e.status === 503) { aviso.textContent = "Falta activar el almacenamiento (R2) en Cloudflare. Juan: ve a dash.cloudflare.com → R2 → Activar, y avísale a Claude."; aviso.hidden = false; it.remove(); }
        else { info.textContent = parar ? "Cancelado." : `No se pudo subir: ${e.message}. Revisa la señal e intenta otra vez.`; cancelar.remove(); }
      } finally { subiendo--; lock?.release?.().catch(() => {}); }
    }

    async function cargar() {
      try {
        const { crudos } = await api(`?p=${o.p}`);
        lista.replaceChildren(...(crudos.length ? crudos.map(fila) : [h("small", null, "Todavía no hay crudos subidos.")]));
      } catch (e) {
        if (e.status === 503) { aviso.textContent = "Falta activar el almacenamiento (R2) en Cloudflare. Juan: ve a dash.cloudflare.com → R2 → Activar, y avísale a Claude."; aviso.hidden = false; }
        lista.replaceChildren();
      }
    }
    function fila(c) {
      const src = `/api/crudos/bajar?key=${encodeURIComponent(c.key)}`, it = h("div", "cr-item"), img = c.tipo.startsWith("image");
      const prev = img ? h("img") : h("video"); prev.src = img ? src : src + "#t=1"; prev.preload = "metadata"; if (!img) { prev.muted = true; prev.playsInline = true; }
      const t = h("div"); t.append(h("b", null, c.nombre || c.key.split("/").pop()), h("small", null, `${mb(c.tam)} · ${c.quien || ""} · ${new Date(c.at).toLocaleString("es-MX", { timeZone: "America/Chicago", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`));
      if (c.nota) t.append(h("small", null, "“" + c.nota + "”"));
      const acc = h("div", "cr-acc"), ver = h("a", "cr-b", "Ver"), borrar = h("button", "cr-b", "Borrar"); ver.href = src; ver.target = "_blank"; ver.rel = "noopener"; borrar.type = "button";
      borrar.onclick = async () => { if (!confirm(`¿Borrar ${c.nombre || "este crudo"}? No se puede deshacer.`)) return; await api(`?key=${encodeURIComponent(c.key)}`, { method: "DELETE" }).catch(() => {}); cargar(); };
      acc.append(ver, borrar); it.append(prev, t, acc); return it;
    }
    cargar();
  }
  window.Crudos = { montar };
})();
