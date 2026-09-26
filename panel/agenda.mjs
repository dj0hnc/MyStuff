// Cola de publicación: a qué hora le toca a cada video pendiente. La usan el panel (await import("/agenda.mjs")) y el servidor
// (import ... from "../../../panel/agenda.mjs") para que los avisos y la pantalla digan lo mismo.
// Regla: nada se pierde. Si se pasó un horario sin publicar, el siguiente video se queda en ese horario marcado "tarde"
// (minutos de retraso) hasta que lo publiquen o digan "pásalo al siguiente horario" (omitidos). Solo el último horario
// vencido del día cuenta como tarde; los anteriores se sueltan para no amontonar pendientes.
// calcularAgenda(pendientes:[{id}] en orden, pubHoy:n publicados hoy, slots:[[hora, horaYT]], t:{fecha,min}, omitidos:["HH:MM AM"] de hoy)
//   -> [{id, fecha, hora, horaYT, tarde}]
export const aMin = (h) => { const m = /(\d+):(\d+)\s*(AM|PM)/i.exec(h || ""); if (!m) return null; let hh = +m[1] % 12; if (/PM/i.test(m[3])) hh += 12; return hh * 60 + +m[2]; };
const sumaDia = (d) => new Date(Date.parse(d + "T12:00:00Z") + 864e5).toISOString().slice(0, 10);
const GRACIA = 20; // minutos después de la hora en que todavía cuenta "a tiempo"
export function calcularAgenda(pendientes, pubHoy, slots, t, omitidos = []) {
    const corte = Math.max(-1, ...omitidos.map(aMin).filter((x) => x != null)); // "pásalo" suelta ese horario vencido y los anteriores
    const hoy = slots.slice(pubHoy).filter(([h]) => aMin(h) > corte); // los primeros horarios del día los "usaron" los publicados hoy
    const vencidos = hoy.filter(([h]) => aMin(h) <= t.min - GRACIA), futuros = hoy.filter(([h]) => aMin(h) > t.min - GRACIA);
    const turnos = [...(vencidos.length ? [{ s: vencidos.at(-1), tarde: t.min - aMin(vencidos.at(-1)[0]) }] : []), ...futuros.map((s) => ({ s, tarde: 0 }))].map((x) => ({ ...x, dia: t.fecha }));
    let dia = t.fecha, i = 0; const out = [];
    for (const v of pendientes) {
      while (i >= turnos.length) { dia = sumaDia(dia); turnos.push(...slots.map((s) => ({ s, tarde: 0, dia }))); }
      const tu = turnos[i++]; out.push({ id: v.id, fecha: tu.dia, hora: tu.s[0], horaYT: tu.s[1], tarde: tu.tarde });
    }
    return out;
  }
