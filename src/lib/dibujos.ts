import { aSlug } from "./enlaces.ts";

/**
 * Un dibujo sencillo para cada producto, elegido por su nombre. Todos
 * comparten el mismo fondo y el mismo trazo para que la lista se vea de una
 * pieza. Un producto nuevo que no encaje en ninguno lleva el dibujo genérico.
 *
 * Son SVG escritos como texto, sin React, para poder usarlos en dos sitios:
 * en la web, dentro de la página, y en las imágenes que salen al compartir
 * un enlace, que solo admiten una imagen ya hecha.
 *
 * Los colores son los del propio alimento, no los de la interfaz: por eso
 * van escritos aquí y no en `tokens.css`.
 */

export type TipoDeDibujo = "mozzarella" | "curado" | "rallado" | "huevos" | "suero" | "queso" | "generico";

export function tipoDeDibujo(nombre: string): TipoDeDibujo {
  const n = aSlug(nombre);
  if (n.includes("huevo")) return "huevos";
  if (n.includes("suero")) return "suero";
  if (n.includes("rallado")) return "rallado";
  if (n.includes("mozzarella") || n.includes("mozarela") || n.includes("mozarella")) return "mozzarella";
  if (n.includes("pecorino") || n.includes("parmesano") || n.includes("anejo")) return "curado";
  if (n.includes("queso")) return "queso";
  return "generico";
}

const FONDO = `<circle cx="60" cy="60" r="58" fill="#fbf3dc" stroke="#e8dcb8" stroke-width="2"/>`;
const sombra = (cy: number, rx: number) => `<ellipse cx="60" cy="${cy}" rx="${rx}" ry="5" fill="#000" opacity="0.10"/>`;

/** Cuña de queso amarillo con sus ojos. */
const QUESO = `${sombra(96, 46)}
<path d="M14 72 L106 46 L106 90 L14 90 Z" fill="#eeb02c"/>
<path d="M14 72 L106 46 L80 32 L30 50 Z" fill="#fbd75b"/>
<circle cx="38" cy="81" r="6" fill="#d18f17"/>
<circle cx="68" cy="73" r="8" fill="#d18f17"/>
<circle cx="93" cy="77" r="5" fill="#d18f17"/>
<circle cx="54" cy="86" r="3.5" fill="#d18f17"/>
<ellipse cx="62" cy="47" rx="7" ry="3" fill="#eeb02c"/>
<ellipse cx="84" cy="42" rx="4" ry="2" fill="#eeb02c"/>`;

/**
 * Barra de mozzarella con una rebanada cortada delante y una hoja de
 * albahaca. Cara de arriba clara, frente y costado más oscuros, para que el
 * blanco se distinga del fondo.
 */
const MOZZARELLA = `${sombra(99, 46)}
<path d="M18 56 L34 42 L98 42 L82 56 Z" fill="#fffdf4"/>
<path d="M82 56 L98 42 L98 72 L82 88 Z" fill="#dccb98"/>
<path d="M18 56 L82 56 L82 88 L18 88 Z" fill="#f5ebc8"/>
<path d="M18 56 L34 42 L98 42 L98 72 L82 88 L18 88 Z" fill="none" stroke="#b9a46a" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M18 56 L82 56 L98 42 M82 56 L82 88" fill="none" stroke="#b9a46a" stroke-width="2" stroke-linejoin="round"/>
<path d="M40 78 L72 78 Q78 78 78 84 L78 94 Q78 100 72 100 L40 100 Q34 100 34 94 L34 84 Q34 78 40 78 Z" fill="#fffdf4" stroke="#b9a46a" stroke-width="2.5"/>
<path d="M42 90 Q56 95 70 90" fill="none" stroke="#dccb98" stroke-width="2" stroke-linecap="round"/>
<g transform="translate(60 36) rotate(-24)"><ellipse rx="16" ry="7.5" fill="#2f7d32"/><path d="M-14 0 L14 0" stroke="#1f5a23" stroke-width="2"/></g>`;

/** Rueda de queso curado con una porción cortada. */
const CURADO = `${sombra(98, 48)}
<path d="M14 50 L14 80 A46 15 0 0 0 106 80 L106 50 Z" fill="#b97f2b"/>
<path d="M14 66 A46 15 0 0 0 106 66" fill="none" stroke="#9c681f" stroke-width="2"/>
<ellipse cx="60" cy="50" rx="46" ry="15" fill="#f1d68d"/>
<ellipse cx="60" cy="50" rx="38" ry="11" fill="none" stroke="#dcbb68" stroke-width="2"/>
<path d="M60 50 L106 50 L106 80 A46 15 0 0 1 84 92.5 Z" fill="#f7e7b4"/>
<path d="M60 50 L84 92.5" stroke="#dcbb68" stroke-width="2"/>
<circle cx="86" cy="66" r="2.5" fill="#dcbb68"/>
<circle cx="96" cy="74" r="2" fill="#dcbb68"/>
<circle cx="80" cy="78" r="2" fill="#dcbb68"/>`;

/** Un cuenco con queso rallado y unas hebras cayendo. */
function rallado(): string {
  // Las hebras del montón: posición, giro y tono. Tres tonos dan relieve.
  const hebras: [number, number, number, string][] = [
    [38, 58, -20, "#f6dc8a"], [52, 52, 25, "#fbe9a8"], [66, 50, -35, "#eecb6a"], [80, 56, 15, "#f6dc8a"],
    [46, 46, 40, "#eecb6a"], [60, 42, -10, "#fbe9a8"], [74, 44, 30, "#f6dc8a"], [58, 56, 60, "#eecb6a"],
    [70, 60, -50, "#fbe9a8"], [44, 62, 10, "#fbe9a8"], [86, 62, -25, "#eecb6a"], [54, 36, 20, "#f6dc8a"],
    [66, 34, -30, "#fbe9a8"],
  ];
  const cayendo: [number, number, number][] = [[30, 30, 35], [92, 26, -30], [84, 38, 50], [24, 44, -15]];
  const hebra = (x: number, y: number, giro: number, color: string, largo: number, grosor: number) =>
    `<rect x="${x - largo / 2}" y="${y - grosor / 2}" width="${largo}" height="${grosor}" rx="${grosor / 2}" fill="${color}" transform="rotate(${giro} ${x} ${y})"/>`;
  return `${sombra(101, 42)}
<path d="M26 66 Q34 34 60 30 Q86 34 94 66 Z" fill="#f3d478"/>
${hebras.map(([x, y, giro, color]) => hebra(x, y, giro, color, 16, 4)).join("")}
${cayendo.map(([x, y, giro]) => hebra(x, y, giro, "#eecb6a", 12, 3)).join("")}
<path d="M16 64 L104 64 Q102 98 60 98 Q18 98 16 64 Z" fill="#fffdf4" stroke="#b9a46a" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M24 76 Q60 86 96 76" fill="none" stroke="#e3d6ad" stroke-width="2" stroke-linecap="round"/>
<ellipse cx="60" cy="64" rx="44" ry="5" fill="none" stroke="#b9a46a" stroke-width="2.5"/>`;
}

/** Tres huevos en su cartón. */
const HUEVOS = `${sombra(100, 48)}
<ellipse cx="32" cy="60" rx="15" ry="20" fill="#f0cfa4"/>
<ellipse cx="60" cy="56" rx="15" ry="20" fill="#fff4e2"/>
<ellipse cx="88" cy="60" rx="15" ry="20" fill="#e6b98a"/>
<ellipse cx="27" cy="52" rx="4" ry="7" fill="#fff" opacity="0.55"/>
<ellipse cx="55" cy="48" rx="4" ry="7" fill="#fff" opacity="0.7"/>
<ellipse cx="83" cy="52" rx="4" ry="7" fill="#fff" opacity="0.5"/>
<path d="M10 70 Q18 62 32 72 Q46 62 60 72 Q74 62 88 72 Q102 62 110 70 L106 92 Q105 98 98 98 L22 98 Q15 98 14 92 Z" fill="#a99276"/>
<path d="M12 80 L108 80" stroke="#8f7a60" stroke-width="2"/>`;

/**
 * Una bolsa de suero de leche atada arriba, con su etiqueta: como se vende
 * aquí. Blanca con el borde marcado, como la mozzarella, para que se vea
 * sobre el fondo.
 */
const BOLSA = "M54 41 C44 45 37 51 35 61 C33 71 32 81 33 90 Q34 99 44 99 L77 99 Q87 99 88 90 C89 81 88 69 86 60 C84 51 77 45 67 41 Z";
const SUERO = `${sombra(101, 31)}
<path d="${BOLSA}" fill="#fffdf4"/>
<path d="M77 47 C84 53 87 63 87 75 L87 90 Q87 97 80 98 C83 86 84 71 81 58 C80 53 79 50 77 47 Z" fill="#efe4c4"/>
<path d="${BOLSA}" fill="none" stroke="#b9a46a" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M41 62 Q38 74 40 86" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
<path d="M53 42 Q60 37 68 42 L66 34 Q60 31 55 34 Z" fill="#f4ecd5" stroke="#b9a46a" stroke-width="2" stroke-linejoin="round"/>
<path d="M56 34 C56 26 61 19 69 15 C73 13 77 15 76 19 C74 24 67 28 64 33 Z" fill="#fffdf4" stroke="#b9a46a" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M61 30 C63 25 67 20 72 17" fill="none" stroke="#dccb98" stroke-width="1.5" stroke-linecap="round"/>
<rect x="44" y="64" width="34" height="27" rx="3" fill="#2f6db3"/>
<rect x="47" y="67" width="28" height="21" rx="2" fill="#f7f4ea"/>
<path d="M51 71.5 L71 71.5" stroke="#5b6f8f" stroke-width="2" stroke-linecap="round"/>
<path d="M54 75 L68 75" stroke="#9aa6ba" stroke-width="1.4" stroke-linecap="round"/>
<path d="M47 81 Q54 77 61 81 T75 80" fill="none" stroke="#2a9fd0" stroke-width="2.4"/>
<path d="M47 84.5 Q54 80.5 61 84.5 T75 83.5" fill="none" stroke="#f0b62c" stroke-width="2"/>`;

/** Una caja, para lo que no tenga dibujo propio. */
const GENERICO = `${sombra(98, 44)}
<path d="M20 46 L60 30 L100 46 L100 84 L60 100 L20 84 Z" fill="#d8b56a"/>
<path d="M20 46 L60 62 L100 46 L60 30 Z" fill="#edd193"/>
<path d="M60 62 L60 100" stroke="#b8923f" stroke-width="2"/>`;

const DIBUJOS: Record<TipoDeDibujo, string> = {
  queso: QUESO,
  mozzarella: MOZZARELLA,
  curado: CURADO,
  rallado: rallado(),
  huevos: HUEVOS,
  suero: SUERO,
  generico: GENERICO,
};

export const CAJA_DEL_DIBUJO = "0 0 120 120";

/** Lo que va dentro de la etiqueta `<svg>`: el fondo y el dibujo del producto. */
export function interiorDelDibujo(nombre: string): string {
  return FONDO + DIBUJOS[tipoDeDibujo(nombre)];
}

/** El dibujo como una imagen suelta, para ponerlo en un `<img>`. */
export function dibujoComoDato(nombre: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${CAJA_DEL_DIBUJO}">${interiorDelDibujo(nombre)}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
