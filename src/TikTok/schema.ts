import { z } from "zod";
import { zColor } from "@remotion/zod-types";

export const tiktokSchema = z.object({
  hook: z.string().describe("Título gancho que aparece al inicio"),
  phrases: z
    .array(z.string())
    .min(1)
    .describe("Frases del guion. Se muestran una por una, palabra por palabra"),
  handle: z.string().describe("Tu usuario, por ejemplo @tunombre"),
  cta: z.string().describe("Llamado a la acción al final"),
  accent: zColor().describe("Color de la palabra resaltada"),
  bgFrom: zColor(),
  bgTo: zColor(),
});

export type TikTokProps = z.infer<typeof tiktokSchema>;
