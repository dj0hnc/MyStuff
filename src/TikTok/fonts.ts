import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Fuentes servidas desde public/fonts, así el render no depende de internet.
export const montserrat = "Montserrat";
export const bebas = "Bebas Neue";
export const script = "Dancing Script";
export const serif = "Cormorant Garamond";

export const fontsReady = Promise.all([
  loadFont({ family: montserrat, url: staticFile("fonts/Montserrat-700.woff2"), weight: "700" }),
  loadFont({ family: montserrat, url: staticFile("fonts/Montserrat-900.woff2"), weight: "900" }),
  loadFont({ family: bebas, url: staticFile("fonts/BebasNeue-400.woff2"), weight: "400" }),
  loadFont({ family: script, url: staticFile("fonts/DancingScript-700.woff2"), weight: "700" }),
  loadFont({ family: serif, url: staticFile("fonts/CormorantGaramond-700.woff2"), weight: "700" }),
]);
