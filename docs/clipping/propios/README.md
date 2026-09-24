# Videos propios de @dj0hnclipper

Historias cortas narradas (negocios, datos) para crecer la cuenta. Cada lote es un JSON
con guion, caption y fuentes de imagen: `npm run lote -- docs/clipping/propios/historias-1.json`.

## Imagen conocida (YouTube)

Con imagen reconocible (el pitch real en Shark Tank, el comercial de Blockbuster, Bezos en 1999)
la gente se queda; con stock genérico se va. Cada video del JSON trae `"youtube": [ids]`.

YouTube bloquea las descargas desde la nube (403), así que se bajan en tu compu:

1. Instala yt-dlp y ffmpeg, una sola vez:
   - Windows (PowerShell): `winget install yt-dlp.yt-dlp Gyan.FFmpeg`
   - Mac: `brew install yt-dlp ffmpeg`
2. Crea una carpeta dentro de Google Drive (ej. `propios`), ábrela en la terminal y corre:
   ```
   yt-dlp -f "bv*[vcodec^=avc1][height<=1080]+ba[ext=m4a]/b[ext=mp4]" --merge-output-format mp4 -o "%(id)s.%(ext)s" -a historias-1-fuentes.txt
   ```
   (`historias-1-fuentes.txt` está en esta carpeta del repo: cópialo a esa carpeta antes de correr el comando.)
3. Comparte la carpeta ("cualquiera con el enlace") y pasa el enlace. Se baja a
   `public/reedit/propios/` (no va a git) y se corre el lote: donde haya video de YouTube lo usa,
   donde no, cae a Pexels.

Uso: tomas de 3.5 s, sin el audio original, debajo de la narración (comentario, no resubida).
Aun así los clips de TV pueden recibir reclamo: si TikTok silencia o baja uno, se rehace con Pexels.
