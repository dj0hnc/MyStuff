# Clipping: ganar rápido con clips virales (ES + EN)

Septiembre 2026. Plan para empezar a generar ya, con las herramientas de este repo.

## 1. La verdad primero

- **YouTube no te paga desde el día 1.** Para monetizar pide 1,000 suscriptores más
  10M vistas de Shorts en 90 días (o 4,000 horas de reproducción). Tarda semanas o meses.
- **Resubir clips ajenos sin transformarlos no se monetiza.** YouTube lo marca como
  "contenido reutilizado / no auténtico" y rechaza el canal aunque tenga las vistas,
  incluso con permiso del creador. Hace falta aporte propio: subtítulos, traducción,
  gancho, edición, comentario.
- **Lo que sí paga desde el primer video: los programas de clipping.** Creadores y
  marcas te pagan por cada 1,000 vistas que hagan tus clips de su contenido. Te dan el
  material y el permiso. Es legal y es el dinero más rápido.

## 2. El plan: dos carriles al mismo tiempo

### Carril A · dinero esta semana (programas de clipping)

| Plataforma | Pago | Nota |
| --- | --- | --- |
| [Whop Content Rewards](https://whop.com/discover/) | $0.20–$6 por 1K vistas (promedio ~$1) | La más grande. Paga mientras la campaña tenga presupuesto. |
| Vyro | ~$3 por 1K vistas | Respaldada por MrBeast. |
| ClipAffiliates | $1–$5 por 1K vistas | Campañas de marcas, vistas verificadas por API. |

Cómo:
1. Crea cuenta en Whop y en una segunda plataforma (los que viven de esto usan 2 o 3).
2. Elige 2 o 3 campañas de **podcasts, streamers o apps**, con presupuesto restante
   alto y en inglés **y** en español (en español hay menos competencia).
3. Baja su material y saca 3 a 5 clips diarios por campaña con `npm run clipear`.
4. Sube cada clip a TikTok, YouTube Shorts e Instagram Reels (cuentas separadas por
   idioma) y registra los enlaces en la campaña.

Referencia: 100K vistas al día a ~$1 por 1K = ~$100 al día. Un clip que pega hace eso solo.

### Carril B · tu canal propio (el activo que crece)

**Nicho recomendado: los mejores momentos de podcasts en inglés, con subtítulos en español.**

- El público hispano de EE. UU. + LATAM es enorme y casi nadie traduce bien estos clips.
- La traducción es transformación real: ayuda con la política de contenido reutilizado.
- El mismo clip sale en dos versiones (subtítulos EN para una cuenta, ES para otra):
  el doble de contenido con el mismo trabajo.
- Temas que más crecen: dinero y negocios, historias de vida y confesiones, relaciones,
  salud y mentalidad. Evita la música con derechos (Content ID te quita las ganancias).

Usa solo contenido con permiso: campañas de clipping, creadores que permiten clips
(muchos podcasts lo dicen en su descripción) o videos Creative Commons (`npm run virales -- --cc`).

**Crear el canal en tu misma cuenta de Google** (no afecta a The Rave Couple):
YouTube → tu foto → Configuración → *Agregar o administrar canales* → *Crear un canal*.
Queda como cuenta de marca y cambias entre canales desde tu foto. Haz lo mismo en
TikTok (una cuenta por idioma) e Instagram.

## 3. La rutina diaria (1 a 2 horas)

```bash
# 1. ¿Qué está pegando hoy?
npm run virales -- podcast-en negocios-en --periodo hoy
npm run virales -- podcast-es negocios-es

# 2. Clipear el mejor (5 clips, subtítulos en español, tu marca)
npm run clipear -- "https://www.youtube.com/watch?v=..." --n 5 --subs es --handle @tucanal

# 3. Versión con el audio y subtítulos originales en inglés para la cuenta EN
#    (el video y la transcripción ya están en caché, así que es rápido)
npm run clipear -- "https://www.youtube.com/watch?v=..." --n 5 --handle @tucanal_en
```

Salen `out/clips/*.mp4` (1080x1920; los de subtítulos traducidos llevan `-es` en el nombre) y un `.md` con título, descripción,
hashtags y créditos en los dos idiomas, listos para copiar y pegar.

Publica 3 a 5 clips al día por cuenta. A la semana, repite lo que superó tu promedio
de vistas y deja lo que no.

## 4. Reglas para que pegue

- **Los primeros 2 segundos lo son todo**: el gancho arriba y la frase más fuerte primero
  (el script ya lo hace).
- 20 a 45 s rinde mejor que 60 s para tener buena retención.
- Subtítulos grandes a media pantalla, lejos de los botones de TikTok (ya viene así).
- Da crédito al creador original en la descripción (ya viene en el .md).
- No subas a Instagram un archivo con marca de agua de TikTok: sube siempre el .mp4 limpio.
- Programa las publicaciones con Metricool (tiene plan gratis) o desde cada app.

## 5. Herramientas

| Herramienta | Para qué | Costo |
| --- | --- | --- |
| `npm run virales` (este repo) | Encontrar videos largos con más vistas del día, la semana o el mes por nicho | Gratis |
| `npm run clipear` (este repo) | Transcribir, elegir momentos, traducir, cortar a 9:16 con subtítulos y textos ES/EN | Gratis (Gemini gratis + Whisper local) |
| CapCut | Retoques manuales, sin marca de agua | Gratis |
| Klap / Opus Clip / Submagic | Alternativas de pago si quieres otra opinión de IA o subtítulos animados | Suscripción; cobran por minuto de video |

Configuración: pon `GEMINI_API_KEY` en `.env` (gratis en https://aistudio.google.com/apikey).
Sin ella el script funciona, pero elige los momentos con una regla simple y no traduce.
Si YouTube bloquea la descarga (error 429), usa tus cookies con
`YTDLP_COOKIES=chrome npm run clipear -- URL`, o baja el video tú y pasa el archivo.

## 6. Lo que tienes que hacer tú

Crear las cuentas y los canales, entrar a Whop/Vyro, aceptar las campañas y subir los clips.
Todo eso pide tu identidad y tus contraseñas. Lo demás lo hacen los scripts.
