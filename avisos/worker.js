// Worker "puente-avisos": cada 5 minutos le pide al Puente que revise la cola y mande los avisos de publicar.
// No guarda secretos: la llave para entrar la comparte con el Puente por KV ("avisos-token"); si no existe, la crea.
export default {
  async scheduled(_evento, env) {
    let llave = await env.ESTADO.get("avisos-token");
    if (!llave) { llave = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join(""); await env.ESTADO.put("avisos-token", llave); }
    const r = await fetch("https://puente-fabrica.pages.dev/api/avisos/tick", { headers: { "x-aviso": llave } });
    console.log("tick", r.status, (await r.text()).slice(0, 200));
  },
};
