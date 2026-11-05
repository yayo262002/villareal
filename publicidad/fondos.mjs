// Los dos fondos de las hojas de cada combo:
//
//  - estante.jpg: los estantes desenfocados de detrás. Salen de la imagen de referencia del dueño
//    (fondos/referencia-dueno.png), de los lados donde no hay producto: se reflejan para llenar el centro.
//  - madera.jpg: el mostrador donde se apoyan los productos. Se calcula aquí (siempre el mismo dibujo).
//
//   node publicidad/fondos.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const carpeta = path.join(aqui, "fondos");
const referencia = path.join(carpeta, "referencia-dueno.png");

// --- Los estantes ---
const Y = 300;
const ALTO = 322;
const trozo = (left, width) => sharp(referencia).flatten({ background: "#ffffff" }).extract({ left, top: Y, width, height: ALTO }).png().toBuffer();
const izquierda = await trozo(0, 275);
const derecha = await trozo(755, 269);
/** Un lado con su reflejo al lado, estirado a un ancho común: en crudo, para mezclarlos. */
async function mitad(trozos, anchoOriginal, ancho) {
  const lienzo = sharp({ create: { width: anchoOriginal, height: ALTO, channels: 3, background: "#ffffff" } }).composite(trozos);
  const unida = await lienzo.png().toBuffer();
  return sharp(unida).resize({ width: ancho, height: ALTO, fit: "fill" }).removeAlpha().raw().toBuffer();
}
const ANCHO_ESTANTES = 1024;
const ANCHO_MITAD = 640;
const mitadIzquierda = await mitad(
  [
    { input: izquierda, left: 0, top: 0 },
    { input: await sharp(izquierda).flop().png().toBuffer(), left: 275, top: 0 },
  ],
  550,
  ANCHO_MITAD,
);
const mitadDerecha = await mitad(
  [
    { input: await sharp(derecha).flop().png().toBuffer(), left: 0, top: 0 },
    { input: derecha, left: 269, top: 0 },
  ],
  538,
  ANCHO_MITAD,
);
// Las dos mitades se solapan en el centro y pasan de una a otra poco a poco: un corte recto se veía detrás de los productos pequeños.
const inicioDerecha = ANCHO_ESTANTES - ANCHO_MITAD;
const estantes = Buffer.alloc(ANCHO_ESTANTES * ALTO * 3);
for (let y = 0; y < ALTO; y++) {
  for (let x = 0; x < ANCHO_ESTANTES; x++) {
    const peso = Math.min(1, Math.max(0, (x - inicioDerecha) / (ANCHO_MITAD - inicioDerecha)));
    for (let c = 0; c < 3; c++) {
      const a = x < ANCHO_MITAD ? mitadIzquierda[(y * ANCHO_MITAD + x) * 3 + c] : 0;
      const b = x >= inicioDerecha ? mitadDerecha[(y * ANCHO_MITAD + (x - inicioDerecha)) * 3 + c] : 0;
      estantes[(y * ANCHO_ESTANTES + x) * 3 + c] = Math.round(a * (1 - peso) + b * peso);
    }
  }
}
await sharp(estantes, { raw: { width: ANCHO_ESTANTES, height: ALTO, channels: 3 } }).blur(5).resize({ width: 2048, kernel: "cubic" }).jpeg({ quality: 88 }).toFile(path.join(carpeta, "estante.jpg"));

// --- La madera: vetas horizontales, ruido estirado a lo ancho en tres tamaños ---
function ruido(semilla) {
  let s = semilla >>> 0;
  const azar = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const N = 512;
  const tabla = new Float32Array(N * N).map(() => azar());
  const suave = (a) => a * a * (3 - 2 * a);
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = suave(x - xi);
    const fy = suave(y - yi);
    const v = (i, j) => tabla[((j & (N - 1)) * N + (i & (N - 1))) | 0];
    const a = v(xi, yi) + (v(xi + 1, yi) - v(xi, yi)) * fx;
    const b = v(xi, yi + 1) + (v(xi + 1, yi + 1) - v(xi, yi + 1)) * fx;
    return a + (b - a) * fy;
  };
}
const ANCHO_MADERA = 1800;
const ALTO_MADERA = 1000;
const n1 = ruido(11);
const n2 = ruido(23);
const n3 = ruido(37);
const CLARO = [250, 234, 201];
const OSCURO = [229, 196, 143];
const pixeles = Buffer.alloc(ANCHO_MADERA * ALTO_MADERA * 3);
for (let y = 0; y < ALTO_MADERA; y++) {
  for (let x = 0; x < ANCHO_MADERA; x++) {
    const v = 0.55 * n1(x / 620, y / 26) + 0.3 * n2(x / 240, y / 7) + 0.15 * n3(x / 90, y / 2.2);
    const t = Math.min(1, Math.max(0, (v - 0.3) * 2.3));
    const i = (y * ANCHO_MADERA + x) * 3;
    for (let c = 0; c < 3; c++) pixeles[i + c] = Math.round(CLARO[c] + (OSCURO[c] - CLARO[c]) * t);
  }
}
await sharp(pixeles, { raw: { width: ANCHO_MADERA, height: ALTO_MADERA, channels: 3 } }).jpeg({ quality: 88 }).toFile(path.join(carpeta, "madera.jpg"));
console.log("estante.jpg y madera.jpg listos");
