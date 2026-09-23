// yt-dlp compartido: se descarga solo a .tools/ la primera vez (ignorado por git).
import { existsSync, chmodSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

export const ytdlp = async () => {
  const bin = ".tools/yt-dlp";
  if (!existsSync(bin)) {
    console.log("Descargando yt-dlp...");
    await mkdir(".tools", { recursive: true });
    const r = await fetch("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp");
    await writeFile(bin, Buffer.from(await r.arrayBuffer()));
    chmodSync(bin, 0o755);
  }
  return bin;
};
