// Pack de 5 promos para Karen A Reyes Nail Studio (Promo composition). Uso: npm run pack-nails [-- 03-disenos]
// Requiere los clips en public/reedit/nails/pack/*.mp4 (no van a git) y GEMINI_API_KEY (voz Leda tapatía).
import { writeFile, mkdir, copyFile } from "node:fs/promises";
import { execSync } from "node:child_process";
const A = "public/reedit/nails/pack", FP = "node_modules/@remotion/compositor-linux-x64-gnu/ffprobe", FF = "node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg";
const dur = (f) => +(+execSync(`${FP} -v error -show_entries format=duration -of csv=p=0 ${f}`).toString()).toFixed(2);
const CTA = "DM @karenareyesnails";
const videos = [
  { id: "01-marca", titulo: "", hook: "Uñas lindas en Princeton TX",
    frases: ["¿Vives en Princeton, Texas, y quieres uñas lindas?", "Soy Karen, nail tech.", "Acrílicas, gel, francesas, nail art y macaron gel polish.", "Cada set hecho a tu gusto, con cita y sin prisas.", "Escríbeme por Instagram, Karen A Reyes Nails, y agenda tu cita."],
    clave: ["Princeton", "lindas", "Karen", "Acrílicas", "gel", "francesas", "art", "macaron", "gusto", "cita", "Instagram", "Karen", "Reyes", "Nails"],
    servicios: [["♥", "Uñas hermosas siempre"], ["◆", "Acrílicas y gel polish"], ["♛", "Diseños personalizados"], ["✦", "Calidad y detalle"]],
    clips: ["estudio1", "f01", "v1", "set-blanco-flores", "f03", "v3", "set-amarillo-flores-3d", "v2", "f05", "set-french-almendra", "v4", "f07", "trabajo-morado", "v5", "estudio2", "f09", "set-vaca-almendra"] },
  { id: "02-tamanos", titulo: "TÚ ELIGES EL TAMAÑO", hook: "Tú eliges el tamaño",
    frases: ["¿Cortas, medianas, largas o extra largas?", "Aquí tú eliges el tamaño y yo le doy vida a tu estilo.", "Acrílicas a tu medida, con la forma que te gusta: cuadradas, coffin o almendra.", "Cuéntame cómo las quieres.", "Escríbeme por Instagram, Karen A Reyes Nails."],
    clave: ["Cortas", "medianas", "largas", "extra", "tamaño", "estilo", "Acrílicas", "cuadradas", "coffin", "almendra", "Instagram"],
    servicios: [["S", "Cortas"], ["M", "Medianas"], ["L", "Largas"], ["XL", "Extra largas"]],
    clips: ["set-french-almendra", "v1", "set-vaca-almendra", "f03", "set-french-negro-coffin", "v5", "set-blanco-flores", "f11", "trabajo-morado"] },
  { id: "03-disenos", titulo: "DISEÑOS Y EXTRAS", hook: "Diseños y extras",
    frases: ["Francesa clásica o francesa negra.", "Baby boomer.", "Flores pintadas a mano.", "Piedras, relieve y hasta print de vaquita.", "Si lo imaginas, lo hacemos. Tus uñas con tu personalidad.", "Escríbeme por Instagram, Karen A Reyes Nails, y agenda tu cita."],
    clave: ["Francesa", "negra", "Baby", "boomer", "Flores", "mano", "Piedras", "relieve", "vaquita", "imaginas", "personalidad", "Instagram"],
    servicios: [["◆", "Francesa clásica o negra"], ["✦", "Baby boomer"], ["❀", "Flores pintadas a mano"], ["♛", "Piedras y relieve"]],
    clips: ["set-french-almendra", "set-french-negro-coffin", "f07", "set-amarillo-flores-3d", "set-blanco-flores", "trabajo-morado", "f05", "set-vaca-almendra", "v1"] },
  { id: "04-gel", titulo: "GEL POLISH + MANICURA", hook: "Gel polish con manicura",
    frases: ["¿No quieres acrílicas?", "Gel polish con manicura: uña natural, cuidada y con color que dura semanas.", "Tengo cientos de tonos, incluido el macaron gel polish.", "Rápido, bonito y sin dañar tu uña.", "Escríbeme por Instagram, Karen A Reyes Nails."],
    clave: ["Gel", "polish", "manicura", "natural", "color", "dura", "cientos", "tonos", "macaron", "Rápido", "bonito", "Instagram"],
    servicios: [["◆", "Gel polish"], ["♥", "Manicura"], ["✦", "Macaron gel polish"], ["♛", "Color que dura semanas"]],
    clips: ["v3", "f01", "v4", "f09", "v2", "set-french-almendra", "v3", "f11", "v4"] },
  { id: "05-estudio", titulo: "MI ESTUDIO EN PRINCETON", hook: "Mi estudio en Princeton TX",
    frases: ["Esto no es una mesa en la cocina.", "Es mi estudio en Princeton, Texas: privado, limpio y certificado.", "Tú, tu música y tus uñas, sin prisas y con cita.", "Ven a conocerlo.", "Escríbeme por Instagram, Karen A Reyes Nails."],
    clave: ["estudio", "Princeton", "privado", "limpio", "certificado", "música", "uñas", "cita", "conocerlo", "Instagram", "Karen", "Reyes", "Nails"],
    servicios: [["♛", "Estudio privado"], ["✦", "Certificada"], ["♥", "Con cita, sin prisas"], ["◆", "Princeton, TX"]],
    clips: ["estudio1", "estudio", "estudio2", "v2", "estudio1", "v1", "estudio2", "set-blanco-flores"] },
];
const solo = process.argv[2];
for (const v of videos) {
  if (solo && v.id !== solo) continue;
  console.log(`\n===== ${v.id}`);
  await writeFile("public/guion.txt", v.frases.join("\n") + "\n");
  await writeFile("public/guion.json", JSON.stringify({ tema: v.id, idioma: "es", hook: v.hook, kicker: "NAIL STUDIO", cta: CTA, frases: v.frases, palabrasClave: v.clave }, null, 1));
  const clips = v.clips.map((c) => ({ archivo: `reedit/nails/pack/${c}.mp4`, duracion: dur(`${A}/${c}.mp4`) }));
  await writeFile("public/clips.json", JSON.stringify({ fuente: v.id, clips }, null, 1));
  execSync("VOZ_PROVEEDOR=gemini npm run voz", { stdio: "inherit" });
  const props = { titulo: v.titulo, servicios: v.servicios.map(([icono, texto]) => ({ icono, texto })), segundosPorClip: 2.2 };
  execSync(`npx remotion render Promo out/pack/${v.id}.mp4 --concurrency=4 --crf=22 --props='${JSON.stringify(props)}'`, { stdio: "inherit" });
  execSync(`${FF} -y -loglevel error -i out/pack/${v.id}.mp4 -vf scale=720:1280 -c:v libx264 -crf 24 -c:a aac -b:a 160k out/pack/${v.id}-web.mp4`);
  await mkdir("public/reedit/nails/pack/guiones", { recursive: true });
  await copyFile("public/guion.json", `public/reedit/nails/pack/guiones/${v.id}.json`);
  await copyFile("public/voz.mp3", `public/reedit/nails/pack/guiones/${v.id}-voz.mp3`);
  await copyFile("public/voz.json", `public/reedit/nails/pack/guiones/${v.id}-voz.json`);
  console.log(`OK ${v.id}: ${dur(`out/pack/${v.id}.mp4`)} s`);
}
