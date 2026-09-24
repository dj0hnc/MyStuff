# Videos propios de @dj0hnclipper

Historias cortas narradas (negocios, datos) para crecer la cuenta. Cada lote es un JSON
con guion, caption y fuentes de imagen: `npm run lote -- docs/clipping/propios/historias-1.json`.

## Imagen conocida (fuentes reales)

Con imagen reconocible (Bezos en 1999, una tienda Blockbuster, el timbre Ring) la gente se queda;
con stock genérico se va. Cada video del JSON trae `"fuentes"` y el lote las baja solo:

- `commons:Archivo.jpg` o `.webm`: fotos y videos libres de Wikimedia Commons (busca en
  commons.wikimedia.org y copia el nombre del archivo). Las fotos se ven completas sobre una copia desenfocada.
- Una URL que yt-dlp baje desde la nube: archive.org (muchos videos de YouTube están ahí como
  `archive.org/details/youtube-<id>`), Dailymotion, TikTok.
- YouTube directo NO: bloquea las descargas desde la nube (403).

Se guardan en `public/reedit/propios/` (no va a git). Si ninguna fuente baja, cae a Pexels.
Uso: tomas de 3.5 s sin el audio original, debajo de la narración (comentario, no resubida).
