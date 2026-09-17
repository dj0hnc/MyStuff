# MyStuff · videos para TikTok y YouTube con Remotion

Videos verticales generados con código: guion en texto, voz con ElevenLabs,
subtítulos sincronizados palabra por palabra, música, efectos y fondo animado.

## Flujo normal

1. Escribe el guion en `public/guion.txt`, una frase por línea.
2. `npm run voz` genera `public/voz.mp3` y `public/voz.json` (tiempos por palabra).
3. `npm run render` renderiza `out/tiktok-pro.mp4`, listo para subir.

Opcional:

- `npm run sonidos` regenera música de fondo y efectos (`public/musica.mp3`, `public/sfx/`).
- `npm run fondo -- "ciudad de noche"` descarga un video vertical de Pexels como fondo
  y luego pones `fondoVideo: "fondo.mp4"` en los props de `TikTokPro`.
- `npm run voces` lista las voces de tu cuenta para elegir otra en `.env`.
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

`.env` está ignorado por git.

## Estructura

```
public/           guion, voz, música, efectos, fuentes y fondo
scripts/          generar-voz, generar-sonidos, buscar-fondo, listar-voces
src/TikTok/       componentes de las composiciones
src/Root.tsx      registro de composiciones y props por defecto
```
