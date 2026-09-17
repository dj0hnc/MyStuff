// Muestra las voces disponibles en tu cuenta de ElevenLabs con su ID,
// para copiar una a ELEVENLABS_VOICE_ID en .env.
const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error("Falta ELEVENLABS_API_KEY en .env");
  process.exit(1);
}
const res = await fetch("https://api.elevenlabs.io/v1/voices", {
  headers: { "xi-api-key": apiKey },
});
if (!res.ok) {
  console.error(`ElevenLabs respondió ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const { voices } = await res.json();
for (const v of voices) {
  const l = v.labels ?? {};
  console.log(`${v.voice_id}  ${v.name.padEnd(14)} ${l.gender ?? ""} ${l.accent ?? ""} ${l.description ?? ""}`);
}
