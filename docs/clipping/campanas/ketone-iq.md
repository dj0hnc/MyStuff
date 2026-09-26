# Campaña Vyro · Ketone-IQ "Cinematic edits"

Captura del 23 sep 2026 (app.vyro.com). Termina en 13 días (~6 oct 2026).

| Campo | Valor |
| --- | --- |
| Marca | Ketone-IQ (verificada) |
| Idioma | Inglés |
| Plataforma | Solo TikTok (videos) |
| Pago | $1.50 por 1,000 vistas ($1,500 por 1M) |
| Mínimo para cobrar | 5,000 vistas por post |
| Máximo por post | $1,000 |
| Duración mínima | 15 s |
| Obligatorio en caption | `#KetoneIQPartner` (divulgación FTC) + el hashtag de la campaña |
| Collab posting | Permitido |
| Material | Carpeta "Edits" de Team Vyro en Frame.io: https://next.frame.io/share/bb7f99a0-f3c6-49b3-a356-747415bff080/8b2ee41d-e9e4-4309-9f1b-0aaa3d727de1 |

Historia de la marca: los fundadores entraron a Shark Tank con una de las valuaciones más
altas pedidas en el programa y los tiburones se rieron de ellos.

## Reglas de Vyro
- El cliente aprueba cada post a su criterio; solo cuentan los aprobados.
- Prohibido usar bots, resubir posts ajenos o publicar el mismo post dos veces en la misma cuenta.

## Cómo producir
1. Bajar el material de Frame.io (botón Download) a `public/reedit/ketone/` (no va a git).
2. Si trae voz (Shark Tank, entrevistas): `npm run clipear -- public/reedit/ketone/x.mp4 --idioma en --dur 30 --encuadre completo`.
   Si es metraje sin voz: guion en inglés + voz IA (`npm run guion`, `npm run voz`) sobre las tomas.
3. Sin música en el render: en TikTok se agrega un sonido de la Commercial Music Library
   (el contenido de marca no puede usar música comercial normal).
4. Publicar desde una cuenta de TikTok en inglés aparte (no The Rave Couple ni Karen).
