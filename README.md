# MyStuff · videos para TikTok y YouTube con Remotion

Videos verticales generados con código: guion en texto, voz con ElevenLabs,
subtítulos sincronizados palabra por palabra, música, efectos y fondo animado.

## Flujo normal

1. Escribe el guion en `public/guion.txt`, una frase por línea, o pídeselo a Gemini:
   `npm run guion -- "3 hábitos para dormir mejor"` (gratis, también propone gancho y CTA).
2. `npm run voz` genera `public/voz.mp3` y `public/voz.json` (tiempos por palabra).
   Usa ElevenLabs; si se acaba la cuota pasa solo a la voz gratis de Gemini y saca
   los tiempos con Whisper local.
3. `npm run video` renderiza `out/tiktok-pro.mp4` con el gancho, etiqueta, CTA y
   palabras clave del guion. Listo para subir.
4. `npm run revisar` sube el video a Gemini y devuelve una crítica de editor con
   los 3 cambios de más impacto (`out/revision.md`).

Opcional:

- `npm run sonidos` regenera música de fondo y efectos (`public/musica.mp3`, `public/sfx/`).
- `npm run fondo -- "ciudad de noche"` descarga un video vertical de Pexels como fondo
  y luego pones `fondoVideo: "fondo.mp4"` en los props de `TikTokPro`.
- `npm run imagen -- "zorro caricatura vector" zorro` genera `public/img/zorro.jpg` con IA (gratis con Pollinations, o FLUX si hay saldo en fal.ai)
  y lo usas con `fondoImagen: "img/zorro.png"`.
- `npm run clip -- "el zorro saluda" --imagen public/img/zorro.png` anima esa imagen a un clip de 5 s
  (`public/clip.mp4`) para usar como `fondoVideo`.
- `npm run fondo -- "escena 1" "escena 2" "escena 3"` baja varios clips de Pexels a `public/clips/`.
- `npm run clips -- --auto 5` genera 5 clips cortos con IA (Gemini inventa las escenas a partir
  del guion; ModelScope, Pixazo, free.ai, Pollinations o fal.ai los generan, gratis los cuatro primeros).
- Con clips en `public/clips.json`, renderiza con `fondoClips: true`: el video los va cortando
  cada 3.5 s con fundido y zoom (`segundosPorClip` lo ajusta).
- `npm run voces` lista las voces de tu cuenta para elegir otra en `.env`.
- `node scripts/whisper.mjs public/mi-audio.mp3` saca tiempos por palabra de cualquier audio
  (una grabación tuya, por ejemplo) para usarlo como voz del video.
- `npm run dev` abre Remotion Studio para ver y editar en vivo.

## Reeditar material propio

- `npm run bajar -- "URL" nombre` baja un video de TikTok, Instagram, YouTube o Facebook a `public/reedit/`.
- `npm run corte-bruto -- public/reedit/nombre.mp4 --respiro 1.5` escucha el video, conserva solo lo que se
  habla, tira silencios y muletillas, nivela la voz por bloque y escribe `public/reedit/edl.json`.
  Con `--max 60` limita la duración. La EDL se puede ajustar a mano (tiempos, ganancia, textos).
- `npx remotion render Reedit out/corte.mp4` renderiza la EDL: audio original intacto, fondo desenfocado
  para fuentes que no son 9:16, textos narradores en la franja superior, subtítulos abajo.
- Los videos crudos no se suben a git (usa enlaces de nube); en el repo viven solo las EDL y los guiones.

## Clipear videos virales (ES + EN)

Estrategia completa, nicho recomendado y programas que pagan por vistas: `docs/clipping/estrategia.md`.

- `npm run virales` busca en YouTube los videos largos con más vistas de la semana por nicho
  (`podcast-es`, `podcast-en`, `negocios-es`, `negocios-en`, `streamers`, `true-crime`, `deportes`, `rave-edm`)
  o por búsqueda libre. `--periodo hoy|semana|mes`, `--cc` solo Creative Commons. Escribe `out/virales.md`.
- `npm run clipear -- "URL" --n 5 --subs es --handle @canal` baja el video, lo transcribe con Whisper,
  Gemini elige los mejores momentos y renderiza clips 9:16 con gancho arriba y subtítulos palabra por palabra
  (traducidos con `--subs`). Deja en `out/clips/` los .mp4 y un .md con títulos, descripciones y hashtags ES/EN.
  Quita las pausas de más de 0.6 s (jump cuts; `--pausa 0` las deja).
  `--encuadre cuadrado|completo|ancho`, `--dur 45`, `--desde/--hasta` (s), `--sin-render`.
- `npm run fabrica -- --subs es --doble --handle @canal` hace la producción del día en un comando: busca virales,
  clipea los que no has usado y arma `out/publicar/calendario.md` y `.csv` con fecha, hora, cuenta por idioma y textos.
- `npm run stats -- @tucanal @competidor` lee los Shorts y videos públicos, marca los ganadores (2x la mediana)
  y con Gemini explica el patrón y propone los próximos 10 clips. Escribe `out/stats-<canal>.md`.

## Escenas de película explicadas (sin narrar tú)

- `npm run recap -- "URL del tráiler o escena"` (o `public/reedit/pelicula.mp4 --desde 1800 --hasta 2400`):
  Gemini ve el video, escribe un guion con gancho y elige 8 a 12 tomas; la voz de IA lo narra
  (`npm run voz`) y `TikTokPro` corta las tomas debajo de la voz, sin el audio original ni música.
  `--tema "el final que nadie entendió"`, `--idioma en`, `--palabras 85`, `--handle @canal`.
  Deja `out/recap-<nombre>.mp4` y un .md con títulos, descripción y hashtags ES/EN.

## Composiciones (`src/Root.tsx`)

| ID | Qué es |
| --- | --- |
| `TikTokPro` | Versión completa: fuentes Montserrat y Bebas Neue, fondo con ruido y partículas, transiciones, voz, visualizador, música con ducking y efectos. |
| `TikTokVoz` | Voz y subtítulos sincronizados, estilo simple. |
| `TikTok` | Sin voz, subtítulos repartidos por tiempo. |
| `YouTube` | Igual que `TikTok` pero 1920x1080. |

Todos los textos y colores son props editables en Studio.

## Claves

Copia `.env.example` a `.env` y llena:

- `ELEVENLABS_API_KEY` para voz, efectos y música en loop (plan gratuito).
- `PEXELS_API_KEY` para fondos de video de stock (gratis en pexels.com/api).
- `FAL_KEY` para imágenes y video con IA (fal.ai, prepago; requiere saldo).
- `GEMINI_API_KEY` para guiones, voz, revisión de video y análisis de imágenes (gratis).
  Imágenes Nano Banana, música Lyria y video Veo requieren facturación activa.

`.env` está ignorado por git.

## Estructura

```
public/           guion, voz, música, efectos, fuentes y fondo
scripts/          generar-voz, generar-sonidos, buscar-fondo, listar-voces
src/TikTok/       componentes de las composiciones
src/Root.tsx      registro de composiciones y props por defecto
```
