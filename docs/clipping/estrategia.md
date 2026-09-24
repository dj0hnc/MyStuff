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

### Cómo elegir campañas (Vyro, Whop)

Acepta solo si cumple casi todo:
- **7 días o más por delante.** Solo cuentan las vistas antes del cierre y cada post necesita un mínimo (Vyro: 5,000).
- **Poco pagado todavía** (menos de 50%): queda presupuesto.
- **Mismo tema que la cuenta** (hoy @dj0hnclipper: negocios, Shark Tank, podcasts, suplementos, apps), para que el algoritmo no se confunda.
- **Reglas que podemos cumplir:** duración mínima, texto obligatorio, hashtags, música solo de la biblioteca comercial de TikTok.
- **Ojo con cláusulas de IA:** si prohíben herramientas que entrenen con lo que subes, no se usa Gemini gratis (solo Whisper local y el plan a mano con `npm run remix -- --plan`).

Rechazada: FX "Adults S2" (terminaba en 1 día, mínimo 30 s, tema distinto, cláusula de IA).
Activa: Ketone-IQ (`docs/clipping/campanas/ketone-iq.md`), 10 edits listos (planes `ketone-iq-plan*.json`).

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

### Carril C · escenas de película explicadas (sin narrar tú)

Las escenas fuertes enganchan y son eternas, pero subirlas tal cual es la vía más rápida a
perder el canal: los estudios tienen todo en Content ID (el dinero se va para ellos) y
algunos mandan strikes (3 = canal borrado). El formato que sí sobrevive es la escena
**explicada**: tomas cortas + narración con contexto, dato oculto o teoría.

```bash
npm run recap -- "https://www.youtube.com/watch?v=TRAILER" --handle @tucanal
npm run recap -- "URL" --idioma en --handle @tucanal_en      # versión en inglés
```

Gemini ve el video y escribe; la voz de IA narra; no se usa el audio original ni música.

Fuentes, de menos a más riesgo:
1. **Dominio público** (riesgo cero): *La noche de los muertos vivientes* (1968), *Nosferatu*,
   *Metrópolis*, *El gabinete del Dr. Caligari*, películas de Chaplin y Buster Keaton.
   Completas en archive.org; baja la película y usa `--desde/--hasta` con la escena.
2. **Tráilers y clips oficiales** que los estudios suben para promocionar.
3. Escenas de estrenos: aun narradas pueden recibir reclamos. Hazlo en un canal aparte,
   nunca en la cuenta de The Rave Couple.



```bash
# Una vez por semana: espía a 2 o 3 canales que ya crecieron en tu nicho y revisa el tuyo
npm run stats -- @competidor1 @competidor2 @tucanal

# Cada día: producción completa en un comando
#   busca virales, clipea los 2 mejores que no has usado (4 clips cada uno),
#   versión con subtítulos en español + versión original, y arma el calendario
npm run fabrica -- --subs es --doble --handle @tucanal
```

Resultado:
- `out/clips/*.mp4`: clips 1080x1920 sin pausas, con gancho y subtítulos (`-es` en el nombre = traducidos).
- `out/publicar/calendario.md`: qué subir, a qué hora y en qué cuenta, con título, descripción y hashtags.
- `out/publicar/calendario.csv`: lo mismo para cargarlo en un programador (Metricool, Buffer).

Tú solo subes (o cargas el CSV en el programador). A mano, clip por clip:

```bash
npm run virales -- podcast-en negocios-en --periodo hoy
npm run clipear -- "https://www.youtube.com/watch?v=..." --n 5 --subs es --handle @tucanal
```

Publica 3 a 5 clips al día por cuenta. Cada semana corre `npm run stats -- @tucanal`:
repite el patrón de los ganadores (2x la mediana) y deja lo que no pegó.

## 4. Reglas para que pegue

- **Los primeros 2 segundos lo son todo**: el gancho arriba y la frase más fuerte primero
  (el script ya lo hace).
- 20 a 45 s rinde mejor que 60 s para tener buena retención. Las pausas se cortan solas.
- Subtítulos grandes a media pantalla, lejos de los botones de TikTok (ya viene así).
- Da crédito al creador original en la descripción (ya viene en el .md).
- No subas a Instagram un archivo con marca de agua de TikTok: sube siempre el .mp4 limpio.
- Programa las publicaciones con Metricool (tiene plan gratis) o desde cada app.

## 5. Herramientas

| Herramienta | Para qué | Costo |
| --- | --- | --- |
| `npm run virales` (este repo) | Encontrar videos largos con más vistas del día, la semana o el mes por nicho | Gratis |
| `npm run fabrica` (este repo) | Producción diaria completa y calendario de publicación | Gratis |
| `npm run stats` (este repo) | Ganadores de tu canal y de la competencia, patrón y próximas ideas | Gratis |
| `npm run recap` (este repo) | Escenas de película explicadas con voz de IA, sin narrar tú | Gratis (Gemini + voz de Gemini o ElevenLabs) |
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

## 7. Por qué no se sube solo (todavía)

- **YouTube:** la API sí permite subir, pero los proyectos nuevos sin verificar quedan con
  los videos en privado hasta pasar una auditoría de Google (gratis, tarda semanas).
  Si quieres, se tramita y luego agregamos `npm run subir`.
- **TikTok e Instagram:** sus APIs de publicación piden app aprobada o cuenta de empresa.
- Mientras tanto, lo más rápido es el CSV en Metricool o Buffer (tienen plan gratis) o subir desde el celular.
