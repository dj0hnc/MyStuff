# LA FÁBRICA — The Rave Couple video pipeline

Proyecto Remotion + scripts Node que produce videos verticales para TikTok/Reels/Shorts
y reedita material propio. Dueños: JOHNC (Juan José De Alba) y Karen A. Reyes.
Canales: @theravecouple.official y @karena.reyes.

**Lee primero:** `docs/canal/master-context.md` (identidad, historia, reglas de marca),
`docs/canal/analisis-2026-09.md` (los 4 videos del canal), `docs/canal/karen-analisis-2026-09.md`.
Responde en español mexicano, directo, sin tono de agencia.

## Reglas no negociables
1. **Audio.** JOHNC es DJ de psytrance con 24 años en la escena. Cero música generada por IA
   en videos del canal. Los cortes de música van al compás (detectar BPM y rejilla de compases).
   El drop siempre cae con imagen, nunca con pantalla negra. Voz nivelada; sin clipping
   (verificar picos del archivo final). Los WAV limpios de los tracks los tiene él.
2. **Storytelling sobre efectos.** Pocos textos, grandes, legibles. Nada de whooshes de plantilla.
3. **JOHNC no es un DJ que empieza: está regresando.** Karen es protagonista, no acompañante.
4. **No inventar** relaciones, eventos ni logros. No perseguir tendencias incompatibles con la marca.
5. **Videos crudos NO van a git** (usar enlaces de nube; `public/reedit/*.mp4`, `public/clips/`
   están ignorados). Solo viven en el repo las EDL, guiones, análisis y finales comprimidos.
6. Archivos para el chat: comprimir a <30 MB (`ffmpeg -vf scale=720:1280 -crf 26`).

## Claves (archivo `.env`, ignorado por git; plantilla en `.env.example`)
ELEVENLABS_API_KEY (voz/SFX, 10K chars/mes gratis) · GEMINI_API_KEY (guion, traducción,
revisión de video, detección de habla, voz de respaldo; imágenes/Veo requieren facturación) ·
PEXELS_API_KEY (stock) · PIXAZO_API_KEY (video IA gratis, modelo `ltx-video`) ·
FAL_KEY (sin saldo) · ELEVENLABS_VOICE_ID (Liam = TX3LPaxmHKxFdv7VOQHJ).

## Comandos
Crear desde cero (narrado):
- `npm run guion -- "tema"` → `public/guion.txt` + `guion.json` (hook, kicker, cta, palabrasClave)
- `npm run traducir -- en` → adapta el guion a otro idioma (respalda `guion.<idioma>.json`)
- `npm run voz` → `public/voz.mp3` + `voz.json` (ElevenLabs; fallback Gemini TTS + Whisper local)
- `npm run clips -- --auto 4` → clips IA en `public/clips/` (Pixazo → free.ai → Pollinations → fal)
- `npm run fondo -- "q1" "q2"` → clips reales de Pexels a `public/clips/` (una query → `fondo.mp4`)
- `npm run imagen -- "desc" nombre` → `public/img/nombre.jpg`
- `npm run video -- out/x.mp4 '{"fondoClips":true}'` → render de `TikTokPro` con props del guion
- `npm run revisar -- out/x.mp4` → crítica de editor por Gemini (`out/revision.md`)

Reeditar material propio:
- `npm run bajar -- "URL" nombre` → baja TikTok/IG/YT/FB a `public/reedit/nombre.mp4` (yt-dlp en `.tools/`)
- `npm run corte-bruto -- public/reedit/x.mp4 --respiro 1.5 [--max 60] [--idioma es]`
  → EDL con solo lo hablado, aire fuera, voz nivelada → `public/reedit/edl.json`
- `npx remotion render Reedit out/x.mp4 --crf=22` → renderiza la EDL (audio original intacto)
- Análisis de audio a mano: ver `public/reedit/beat.json` (bpm, drop, downbeats) y el patrón en
  `docs/canal/` para detectar tempo/energía con ffprobe+Node (el ffmpeg de Remotion no tiene
  filtros `fps`, `gblur`; sí `volume`, `loudnorm`, `atempo`, `scale`).
- `npm run dev` abre Remotion Studio (solo en la máquina del usuario).
- `npm run lint` (eslint + tsc) antes de commit. Remotion 4.0.525, fps 30, 1080x1920.

## Composiciones (`src/Root.tsx`)
- `TikTokPro`: gancho (Bebas Neue) → subtítulos palabra a palabra (Montserrat) con visualizador →
  cierre; fondo gradiente/ruido/partículas o `fondoClips` (secuencia) o `fondoImagen` o `fondoVideo`;
  música con ducking y SFX opcionales; `palabrasClave` resaltadas.
- `Reedit`: EDL de bloques `{video:{from,to}, audio:"sync"|{from,to}|"none", gain, quien, label,
  sub, labelPos, dialogo, fadeIn, fadeOut}`; letterbox con fondo desenfocado para fuentes no 9:16;
  labels en la franja superior, subtítulos en la inferior (no chocan con texto quemado del original);
  tinte ámbar (ella) / verde neón (él).
- `TikTokVoz`, `TikTok`, `YouTube` (16:9): versiones simples.

## Estado y siguiente paso (sep 2026)
- Hecho: video 4 reeditado (`public/reedit/edl-v4.json`), corte en bruto del video 3, versión EN.
- Pendiente de los dueños: enlace de nube con crudos (unboxing, primer beat) y WAV de los tracks.
- Plan de contenido: `docs/canal/` (series DJ Journey, Old School Files, Rave Couple Life;
  para Karen: "Mexicana en Texas" y "Volver a México").
