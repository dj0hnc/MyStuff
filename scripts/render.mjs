// Renderiza TikTokPro tomando hook, kicker y cta de public/guion.json
// (lo escribe `npm run guion`). Cualquier prop extra se pasa como JSON.
//
// Uso:  npm run video
//       npm run video -- out/mi-video.mp4
//       npm run video -- out/zorro.mp4 '{"fondoImagen":"img/zorro.jpg"}'

import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const [salida = "out/tiktok-pro.mp4", extra = "{}"] = process.argv.slice(2);

let props = {};
try {
  const g = JSON.parse(await readFile("public/guion.json", "utf8"));
  props = { hook: g.hook, kicker: g.kicker, cta: g.cta, palabrasClave: g.palabrasClave ?? [] };
  console.log(`Usando guion.json: "${g.hook}" / ${g.kicker} / "${g.cta}"`);
} catch {
  console.log("Sin public/guion.json, uso los props por defecto de Root.tsx");
}
props = { ...props, ...JSON.parse(extra) };

execFileSync("npx", ["remotion", "render", "TikTokPro", salida, "--concurrency=4", "--crf=23", `--props=${JSON.stringify(props)}`], {
  stdio: "inherit",
});
