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
