// EDL (lista de decisiones de edición) para reeditar un video existente
// respetando su audio original.
export type Bloque = {
  video: { from: number; to: number }; // rango del video fuente, segundos
  // "sync": el audio va pegado al video. Un rango: cama de audio continua
  // independiente (montajes sin diálogo, la música no salta). "none": mudo.
  audio: "sync" | { from: number; to: number } | "none";
  gain: number; // multiplicador de volumen (1 = original)
  quien: "ella" | "el" | "ambos" | "nadie";
  label?: string;
  labelPos?: "top" | "center";
  sub?: string; // texto pequeño bajo el label
  dialogo?: boolean;
  fadeIn?: number; // frames de fade de entrada del audio (para cambios de música)
  fadeOut?: number; // frames de fade de salida
  nota?: string; // texto de referencia (no se muestra)
};
export type Word = { text: string; start: number; end: number };
export type EDL = {
  src: string; // video en public/
  audioSrc: string; // audio extraído en public/
  srcWidth?: number; // tamaño del video fuente (default 720x958)
  srcHeight?: number;
  bloques: Bloque[];
  words: Word[]; // palabras con tiempos del video FUENTE
  handle: string;
  colores: { ella: string; el: string };
};
