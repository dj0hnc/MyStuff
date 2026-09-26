// Crudos desde cualquier dispositivo (lo usan los 3 paneles): subir archivos o pegar un link (Dropbox, Drive, WeTransfer, TikTok…).
// Cada archivo se parte en pedazos de 25 MB y se suben de 3 en 3 a R2 (/api/crudos). Si se va la señal, espera a que regrese;
// si se cierra la página, al volver a elegir el mismo archivo retoma desde el último pedazo (R2 guarda la subida 7 días).
// Crudos.montar(nodo, {p, quien: () => "Juan", toast})
// Crudos.espacio(nodo, {p, publicados: () => [{id, titulo, hd}], editados: () => Set(keys de crudos ya editados), onLiberado(id), toast})
(() => {
  const PARTE = 25 * 1024 * 1024, A_LA_VEZ = 3, INTENTOS = 10;
  const css = `
  .cr{display:grid;gap:12px}
  .cr-zona{display:grid;place-items:center;gap:6px;text-align:center;padding:26px 16px;border:2px dashed var(--cr-a,#29e7ff);border-radius:18px;background:color-mix(in srgb,var(--cr-a,#29e7ff) 8%,transparent);cursor:pointer;color:inherit}
  .cr-zona.encima{background:color-mix(in srgb,var(--cr-a,#29e7ff) 20%,transparent)}
  .cr-zona b{font-size:19px}.cr-zona small{opacity:.75}
  .cr-zona:focus-within{outline:2px solid #ffc857;outline-offset:3px}
  .cr textarea,.cr input[type=url]{width:100%;padding:11px;border-radius:12px;border:1px solid rgba(127,127,160,.35);background:rgba(0,0,0,.25);color:inherit;font:500 16px/1.4 system-ui,sans-serif}
  .cr textarea{min-height:64px;resize:vertical}
  .cr-link{display:grid;grid-template-columns:1fr auto;gap:8px}
  .cr-o{display:flex;align-items:center;gap:10px;opacity:.7;font-size:13px;font-weight:700}.cr-o::before,.cr-o::after{content:"";flex:1;height:1px;background:rgba(127,127,160,.35)}
  .cr-item{display:grid;grid-template-columns:64px 1fr auto;gap:10px;align-items:center;padding:10px;border-radius:14px;border:1px solid rgba(127,127,160,.3);background:rgba(0,0,0,.2)}
  .cr-item video,.cr-item img,.cr-item .cr-ico{width:64px;height:88px;object-fit:cover;border-radius:8px;background:#000;display:grid;place-items:center;font-size:28px}
  .cr-item b{display:block;font-size:14px;overflow-wrap:anywhere}.cr-item small{display:block;opacity:.75;font-size:12px;overflow-wrap:anywhere}
  .cr-barra{height:8px;border-radius:99px;background:rgba(127,127,160,.25);overflow:hidden;margin-top:6px}
  .cr-barra i{display:block;height:100%;width:0;background:var(--cr-a,#29e7ff);transition:width .3s}
  .cr-b{appearance:none;border:1px solid rgba(127,127,160,.4);background:rgba(0,0,0,.25);color:inherit;border-radius:10px;padding:8px 12px;font:700 13px system-ui,sans-serif;cursor:pointer;text-decoration:none;text-align:center}
  .cr-b.si{background:var(--cr-a,#29e7ff);border-color:var(--cr-a,#29e7ff);color:#05080f}
  .cr-acc{display:grid;gap:6px}
  .cr-aviso{padding:12px;border-radius:12px;border:1px solid #ffb020;color:#ffb020;background:rgba(255,176,32,.08);font-size:14px}`;
  const st = document.createElement("style"); st.textContent = css; document.head.append(st);
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const mb = (n) => (n >= 1073741824 ? (n / 1073741824).toFixed(1) + " GB" : Math.max(1, Math.round(n / 1048576)) + " MB");
  const ls = { get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const api = async (ruta, opt = {}) => { const r = await fetch("/api/crudos" + ruta, opt); if (r.status === 401) location.reload(); const d = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(d.mensaje || d.error || "HTTP " + r.status), { d, status: r.status }); return d; };
  const postJ = (ruta, body) => api(ruta, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const enLinea = () => (navigator.onLine ? Promise.resolve() : new Promise((r) => addEventListener("online", r, { once: true })));
  const AVISO_R2 = "Para subir archivos falta activar el almacenamiento (R2) en Cloudflare: dash.cloudflare.com → R2 → Activar, y avísale a Claude. Mientras, pega un link de Dropbox o Drive: ese sí funciona ya.";
  let subiendo = 0;
  addEventListener("beforeunload", (e) => { if (subiendo) { e.preventDefault(); e.returnValue = ""; } });

  function montar(nodo, o) {
    const raiz = h("div", "cr"), zona = h("label", "cr-zona"), inp = h("input"), nota = h("textarea"), cola = h("div", "cr-acc"), lista = h("div", "cr-acc"), aviso = h("div", "cr-aviso"); aviso.hidden = true;
    inp.type = "file"; inp.multiple = true; inp.accept = "video/*,image/*"; inp.hidden = true;
    zona.append(inp, h("b", null, "＋ Subir crudos"), h("small", null, "Videos o fotos del tamaño que sea. Si se corta la señal, sigue solo."));
    const fl = h("form", "cr-link"), url = h("input"), bl = h("button", "cr-b si", "Mandar link"); url.type = "url"; url.inputMode = "url"; url.placeholder = "Pega un link: Dropbox, Drive, WeTransfer, TikTok, iCloud…"; url.setAttribute("aria-label", "Link del crudo"); bl.type = "submit"; fl.append(url, bl);
    nota.placeholder = "¿Qué quieres que haga la Fábrica? (ej. corta lo mejor en 15 s, subtítulos, para TikTok)"; nota.maxLength = 500; nota.setAttribute("aria-label", "Instrucciones para la Fábrica");
    raiz.append(aviso, nota, zona, h("div", "cr-o", "o"), fl, cola, h("b", null, "Crudos guardados"), lista); nodo.replaceChildren(raiz);
    ["dragenter", "dragover"].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add("encima"); }));
    ["dragleave", "drop"].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove("encima"); }));
    zona.addEventListener("drop", (e) => subirTodos([...e.dataTransfer.files]));
    inp.onchange = () => { subirTodos([...inp.files]); inp.value = ""; };
    fl.onsubmit = async (e) => {
      e.preventDefault(); const u = url.value.trim(); if (!u) return;
      bl.disabled = true;
      try { await postJ("/enlace", { p: o.p, url: u, nota: nota.value.trim(), quien: o.quien() }); url.value = ""; o.toast?.("Link mandado a la Fábrica"); cargar(); }
      catch (err) { o.toast?.(err.message); }
      bl.disabled = false;
    };

    async function subirTodos(files) { for (const f of files) await subir(f); cargar(); }
    async function subir(f, it) {
      const huella = `crudo:${o.p}:${f.name}:${f.size}:${f.lastModified}`, previo = ls.get(huella); // para retomar
      if (!it) {
        it = h("div", "cr-item"); const prev = f.type.startsWith("image") ? h("img") : h("video");
        prev.src = URL.createObjectURL(f); if (prev.tagName === "VIDEO") { prev.muted = true; prev.playsInline = true; }
        it.append(prev, h("div"), h("div", "cr-acc")); cola.prepend(it);
      }
      const txt = it.children[1], acc = it.children[2], barra = h("div", "cr-barra"), i = h("i"), info = h("small", null, previo ? "Retomando donde se quedó…" : "Preparando…"), cancelar = h("button", "cr-b", "Cancelar");
      barra.append(i); txt.replaceChildren(h("b", null, f.name), info, barra); cancelar.type = "button"; acc.replaceChildren(cancelar);
      let parar = false; cancelar.onclick = () => (parar = true);
      subiendo++; let lock = null; try { lock = await navigator.wakeLock?.request("screen"); } catch {} // que no se apague la pantalla a media subida
      let ini = previo;
      try {
        if (!ini) { ini = { ...(await postJ("/iniciar", { p: o.p, nombre: f.name, tipo: f.type, tam: f.size, nota: nota.value.trim(), quien: o.quien() })), partes: [] }; ls.set(huella, ini); }
        const total = Math.max(1, Math.ceil(f.size / PARTE)), hechas = new Set(ini.partes.map((x) => x.n)), t0 = Date.now(), base = hechas.size;
        const pendientes = Array.from({ length: total }, (_, k) => k + 1).filter((n) => !hechas.has(n));
        const pinta = () => { const sub = Math.min(f.size, hechas.size * PARTE), vel = ((hechas.size - base) * PARTE) / Math.max(1, (Date.now() - t0) / 1000); i.style.width = (hechas.size / total) * 100 + "%"; info.textContent = `${mb(sub)} de ${mb(f.size)}${hechas.size > base ? ` · ${mb(vel)}/s` : ""}`; };
        pinta();
        const trabajador = async () => {
          while (pendientes.length && !parar) {
            const n = pendientes.shift(), pedazo = f.slice((n - 1) * PARTE, Math.min(f.size, n * PARTE));
            for (let intento = 1; ; intento++) {
              await enLinea();
              try { const r = await api(`/parte?key=${encodeURIComponent(ini.key)}&id=${encodeURIComponent(ini.id)}&n=${n}`, { method: "PUT", body: pedazo }); ini.partes.push(r); hechas.add(n); ls.set(huella, ini); break; }
              catch (e) { if (parar || intento >= INTENTOS || (e.status >= 400 && e.status < 500)) throw e; info.textContent = `Se cortó la señal, reintentando (${intento})…`; await new Promise((r) => setTimeout(r, Math.min(30000, 1000 * 2 ** intento))); }
            }
            pinta();
          }
        };
        await Promise.all(Array.from({ length: Math.min(A_LA_VEZ, pendientes.length || 1) }, trabajador));
        if (parar) throw Object.assign(new Error("cancelado"), { cancelado: true });
        await postJ("/terminar", { key: ini.key, id: ini.id, partes: ini.partes, nota: nota.value.trim(), quien: o.quien() });
        ls.set(huella, null); info.textContent = `✓ Subido (${mb(f.size)}). Quedó como pedido para la Fábrica.`; i.style.width = "100%"; acc.replaceChildren(); o.toast?.("Crudo subido");
      } catch (e) {
        if (e.status === 503) { aviso.textContent = AVISO_R2; aviso.hidden = false; it.remove(); ls.set(huella, null); }
        else if (e.cancelado) { if (ini) postJ("/cancelar", { key: ini.key, id: ini.id }).catch(() => {}); ls.set(huella, null); info.textContent = "Cancelado."; acc.replaceChildren(); }
        else { // se queda guardado para retomar
          if (e.status === 404 || e.status === 400 || e.status === 507) ls.set(huella, null); // la subida ya no existe en R2 (o no cabe): empezará de cero
          info.textContent = `Se detuvo: ${e.message}.`; const re = h("button", "cr-b si", "Reintentar"); re.type = "button"; re.onclick = () => subir(f, it).then(cargar); acc.replaceChildren(re);
        }
      } finally { subiendo--; lock?.release?.().catch(() => {}); }
    }

    async function cargar() {
      try {
        const { crudos } = await api(`?p=${o.p}`);
        lista.replaceChildren(...(crudos.length ? crudos.map(fila) : [h("small", null, "Todavía no hay crudos subidos.")]));
      } catch (e) {
        if (e.status === 503) { aviso.textContent = AVISO_R2; aviso.hidden = false; }
        lista.replaceChildren(h("small", null, "Los links que mandes quedan como pedido en la lista de pedidos."));
      }
    }
    function fila(c) {
      const src = `/api/crudos/bajar?key=${encodeURIComponent(c.key)}`, it = h("div", "cr-item"), tipo = c.enlace ? "enlace" : c.tipo.startsWith("image") ? "img" : "video";
      const prev = tipo === "enlace" ? h("div", "cr-ico", "🔗") : tipo === "img" ? h("img") : h("video");
      if (tipo !== "enlace") { prev.src = tipo === "img" ? src : src + "#t=1"; prev.preload = "metadata"; if (tipo === "video") { prev.muted = true; prev.playsInline = true; } }
      const t = h("div"); t.append(h("b", null, c.nombre || c.key.split("/").pop()), h("small", null, `${tipo === "enlace" ? "Link" : mb(c.tam)} · ${c.quien || ""} · ${new Date(c.at).toLocaleString("es-MX", { timeZone: "America/Chicago", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`));
      if (c.nota) t.append(h("small", null, "“" + c.nota + "”"));
      const acc = h("div", "cr-acc"), ver = h("a", "cr-b", tipo === "enlace" ? "Abrir" : "Ver"), borrar = h("button", "cr-b", "Borrar");
      ver.href = c.enlace || src; ver.target = "_blank"; ver.rel = "noopener"; borrar.type = "button";
      borrar.onclick = async () => { if (!confirm(`¿Borrar ${c.nombre || "este crudo"}? No se puede deshacer.`)) return; await api(`?key=${encodeURIComponent(c.key)}`, { method: "DELETE" }).catch(() => {}); cargar(); };
      acc.append(ver, borrar); it.append(prev, t, acc); return it;
    }
    cargar();
  }
  // --- Espacio: cuánto se usa del plan gratis (10 GB) y qué se puede liberar sin perder nada importante ---
  const cssE = `.es{display:grid;gap:10px}.es-barra{height:14px;border-radius:99px;background:rgba(127,127,160,.25);overflow:hidden}.es-barra i{display:block;height:100%;border-radius:99px}
  .es-num{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-weight:700}.es-num small{opacity:.75;font-weight:600}
  .es-fila{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:8px 10px;border-radius:12px;border:1px solid rgba(127,127,160,.3);background:rgba(0,0,0,.2);font-size:14px}
  .es-fila small{display:block;opacity:.75}.es h4{margin:6px 0 0;font-size:14px}`;
  const st2 = document.createElement("style"); st2.textContent = cssE; document.head.append(st2);
  function espacio(nodo, o) {
    const pinta = async () => {
      let e; try { e = await api("/espacio"); } catch (x) { nodo.replaceChildren(h("small", null, x.status === 503 ? "Falta activar el almacenamiento (R2)." : "No se pudo leer el espacio.")); return; }
      const pct = (e.total / e.limite) * 100, color = pct < 70 ? "#35d07f" : pct < 90 ? "#ffb020" : "#ff4d6d";
      const raiz = h("div", "es"), barra = h("div", "es-barra"), i = h("i"); i.style.width = Math.max(1, Math.min(100, pct)) + "%"; i.style.background = color; barra.append(i);
      const num = h("div", "es-num"); num.append(h("span", null, `${mb(e.total)} de ${mb(e.limite)} usados`), h("small", null, `${pct.toFixed(0)}% · gratis hasta 10 GB`));
      const det = h("small", null, `Aquí: crudos ${mb(e.carpetas[o.p] || 0)} · finales 1080 ${mb(e.carpetas["finales/" + o.p] || 0)} · todo el Puente ${mb(e.total)}`); det.style.opacity = ".8";
      raiz.append(num, barra, det);
      if (pct >= 80) raiz.append(h("div", "cr-aviso", "Se está llenando: libera lo ya publicado o los crudos ya editados para que las subidas no se detengan."));
      const pub = (o.publicados?.() || []).filter((v) => e.finales[v.hd] != null);
      if (pub.length) {
        const total = pub.reduce((a, v) => a + e.finales[v.hd], 0), todos = h("button", "cr-b si", `Liberar todos (${mb(total)})`); todos.type = "button";
        raiz.append(h("h4", null, `Ya publicados en todas sus redes · ${pub.length}`), h("small", null, "Se borra su copia en 1080 de la nube; la vista previa se queda en la videoteca."));
        todos.onclick = async () => { if (!confirm(`¿Liberar el 1080 de ${pub.length} videos ya publicados (${mb(total)})?`)) return; todos.disabled = true; for (const v of pub) await liberar(v); pinta(); };
        raiz.append(todos);
        pub.slice(0, 30).forEach((v) => { const f = h("div", "es-fila"), t = h("div"), b = h("button", "cr-b", "Liberar"); b.type = "button"; t.append(document.createTextNode(v.titulo), h("small", null, `1080 · ${mb(e.finales[v.hd])}`)); b.onclick = async () => { b.disabled = true; await liberar(v); pinta(); }; f.append(t, b); raiz.append(f); });
      }
      const ed = o.editados?.() || new Set();
      if (ed.size) {
        const l = (await api(`?p=${o.p}`).catch(() => ({ crudos: [] }))).crudos.filter((c) => ed.has(c.key));
        if (l.length) {
          raiz.append(h("h4", null, `Crudos ya editados · ${l.length}`), h("small", null, "La Fábrica ya los trabajó: se pueden borrar."));
          l.forEach((c) => { const f = h("div", "es-fila"), t = h("div"), b = h("button", "cr-b", "Borrar"); b.type = "button"; t.append(document.createTextNode(c.nombre || c.key.split("/").pop()), h("small", null, mb(c.tam))); b.onclick = async () => { if (!confirm("¿Borrar este crudo? No se puede deshacer.")) return; b.disabled = true; await api(`?key=${encodeURIComponent(c.key)}`, { method: "DELETE" }).catch(() => {}); o.toast?.("Borrado"); pinta(); }; f.append(t, b); raiz.append(f); });
        }
      }
      if (!pub.length && !ed.size && pct < 80) raiz.append(h("small", null, "Todo en orden: no hay nada que liberar por ahora."));
      nodo.replaceChildren(raiz);
    };
    const liberar = async (v) => { await api(`?key=${encodeURIComponent(v.hd)}`, { method: "DELETE" }).catch(() => {}); await o.onLiberado?.(v.id); o.toast?.("Espacio liberado"); };
    pinta();
    return { refrescar: pinta };
  }
  window.Crudos = { montar, espacio };
})();
