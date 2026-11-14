/**
 * Las fotos grandes de la web, hechas con la mercancía de verdad del negocio: los productos recortados (los de las hojas
 * de los combos, en publicidad/fotos/) sobre un fondo de color liso de la marca, con su sombra y una luz suave detrás, al
 * estilo de un catálogo de una app de pedidos. El dueño no quería fotos de comida de internet (13/11/2026: «nada, ni el
 * de la hamburguesa, quesos, nada»). Deja:
 *
 *   public/portada/heroe.webp, heroe-movil.webp   la de arriba de la portada (pantalla ancha y teléfono)
 *   public/familias/<familia>.webp                 la de cada familia y colección (las tarjetas y la cabecera de su página);
 *                                                  las que aún no tienen mercancía con foto, el color con el león
 *   public/productos/huevos.webp, jamon-arepero.webp, queso-blanco.webp   referencias de producto: la mercancía sobre blanco
 *
 * Después, `npm run miniaturas` para sus miniaturas. Uso: `npm run fotos-web`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp, { type OverlayOptions } from "sharp";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RECORTES = path.join(raiz, "publicidad", "fotos");

/** Un producto en la escena: su foto recortada, el centro (fracción del ancho), dónde apoya (fracción del alto) y su alto. */
type Pieza = { foto: string; x: number; apoyo: number; alto: number; giro?: number };
type Escena = { archivo: string; ancho: number; alto: number; fondo: string; luz: string; alturaDeLaLuz?: number; piezas: Pieza[]; leon?: boolean };

// Los colores de la marca (src/styles/tokens.css): verde bosque, el oro del león y crema.
const VERDE = "#10331f";
const VERDE_HONDO = "#0a2416";
const ORO = "#f0c24f";
const CREMA = "#f3e7cc";

const ESCENAS: Escena[] = [
  // La de arriba, en la pantalla ancha: el texto va a la izquierda, sobre el verde; los productos, a la derecha.
  {
    archivo: "public/portada/heroe.webp",
    ancho: 1920,
    alto: 1000,
    fondo: VERDE_HONDO,
    luz: "rgba(240, 194, 79, 0.30)",
    piezas: [
      { foto: "jamon-de-pierna", x: 0.55, apoyo: 0.77, alto: 0.44 },
      { foto: "queso-kemmental", x: 0.67, apoyo: 0.76, alto: 0.53 },
      { foto: "jamon-de-espalda", x: 0.79, apoyo: 0.77, alto: 0.51 },
      { foto: "tocineta", x: 0.515, apoyo: 0.9, alto: 0.37 },
      { foto: "mozzarella", x: 0.62, apoyo: 0.91, alto: 0.31 },
      { foto: "queso-amarillo", x: 0.735, apoyo: 0.92, alto: 0.42 },
      { foto: "pecorino-sortilegio", x: 0.845, apoyo: 0.93, alto: 0.26 },
    ],
  },
  // En el teléfono: los productos arriba, en el centro; abajo, el verde donde monta el título.
  {
    archivo: "public/portada/heroe-movil.webp",
    ancho: 900,
    alto: 760,
    fondo: VERDE_HONDO,
    luz: "rgba(240, 194, 79, 0.32)",
    piezas: [
      { foto: "jamon-de-pierna", x: 0.23, apoyo: 0.58, alto: 0.37 },
      { foto: "queso-kemmental", x: 0.5, apoyo: 0.57, alto: 0.46 },
      { foto: "jamon-de-espalda", x: 0.77, apoyo: 0.58, alto: 0.44 },
      { foto: "tocineta", x: 0.17, apoyo: 0.73, alto: 0.31 },
      { foto: "mozzarella", x: 0.39, apoyo: 0.74, alto: 0.26 },
      { foto: "queso-amarillo", x: 0.61, apoyo: 0.75, alto: 0.36 },
      { foto: "pecorino-sortilegio", x: 0.84, apoyo: 0.76, alto: 0.21 },
    ],
  },
  // Las familias y las colecciones, en 4:3. La misma foto sale en la tarjeta (cuadrada en el teléfono, apaisada en la
  // pantalla ancha: allí se ve del 12 % al 88 % de alto) y en la cabecera de su página (en el teléfono, con el nombre desde la
  // mitad para abajo): los productos van en la franja de arriba, entre el 15 % y el 55 % del alto.
  {
    archivo: "public/familias/quesos.webp",
    ancho: 960,
    alto: 720,
    fondo: ORO,
    luz: "rgba(255, 248, 225, 0.55)",
    alturaDeLaLuz: 0.36,
    piezas: [
      { foto: "queso-kemmental", x: 0.39, apoyo: 0.47, alto: 0.32 },
      { foto: "queso-amarillo", x: 0.55, apoyo: 0.48, alto: 0.33 },
      { foto: "mozzarella", x: 0.45, apoyo: 0.545, alto: 0.21 },
      { foto: "pecorino-sortilegio", x: 0.63, apoyo: 0.55, alto: 0.17 },
    ],
  },
  {
    archivo: "public/familias/embutidos.webp",
    ancho: 960,
    alto: 720,
    fondo: CREMA,
    luz: "rgba(255, 255, 255, 0.6)",
    alturaDeLaLuz: 0.36,
    piezas: [
      { foto: "jamon-de-pierna", x: 0.36, apoyo: 0.46, alto: 0.28 },
      { foto: "jamon-de-espalda", x: 0.5, apoyo: 0.455, alto: 0.33 },
      { foto: "pechuga-de-pavo-drago", x: 0.64, apoyo: 0.46, alto: 0.28 },
      { foto: "tocineta", x: 0.42, apoyo: 0.545, alto: 0.24 },
      { foto: "mortadela-punta-de-monte", x: 0.6, apoyo: 0.555, alto: 0.095, giro: -90 },
    ],
  },
  {
    archivo: "public/familias/lacteos.webp",
    ancho: 960,
    alto: 720,
    fondo: VERDE,
    luz: "rgba(240, 194, 79, 0.28)",
    alturaDeLaLuz: 0.36,
    piezas: [
      { foto: "suero-guaralact", x: 0.38, apoyo: 0.52, alto: 0.36 },
      { foto: "suero-cremoso-guaralact", x: 0.5, apoyo: 0.535, alto: 0.35 },
      { foto: "suero-san-pedro", x: 0.62, apoyo: 0.545, alto: 0.27 },
    ],
  },
  {
    archivo: "public/familias/huevos.webp",
    ancho: 960,
    alto: 720,
    fondo: CREMA,
    luz: "rgba(255, 255, 255, 0.6)",
    alturaDeLaLuz: 0.36,
    piezas: [{ foto: "huevos", x: 0.5, apoyo: 0.53, alto: 0.3 }],
  },
  {
    archivo: "public/familias/burger.webp",
    ancho: 960,
    alto: 720,
    fondo: VERDE,
    luz: "rgba(240, 194, 79, 0.32)",
    alturaDeLaLuz: 0.36,
    piezas: [
      { foto: "queso-kemmental", x: 0.39, apoyo: 0.47, alto: 0.31 },
      { foto: "jamon-de-espalda", x: 0.6, apoyo: 0.47, alto: 0.32 },
      { foto: "tocineta", x: 0.44, apoyo: 0.55, alto: 0.24 },
      { foto: "queso-amarillo", x: 0.53, apoyo: 0.555, alto: 0.28 },
      { foto: "salchichas", x: 0.66, apoyo: 0.56, alto: 0.15 },
    ],
  },
  {
    archivo: "public/familias/pizzeria.webp",
    ancho: 960,
    alto: 720,
    fondo: ORO,
    luz: "rgba(255, 248, 225, 0.55)",
    alturaDeLaLuz: 0.36,
    piezas: [
      { foto: "jamon-de-espalda", x: 0.39, apoyo: 0.47, alto: 0.32 },
      { foto: "jamon-ahumado", x: 0.59, apoyo: 0.47, alto: 0.31 },
      { foto: "mozzarella", x: 0.45, apoyo: 0.555, alto: 0.22 },
      { foto: "pecorino-sortilegio", x: 0.61, apoyo: 0.56, alto: 0.18 },
    ],
  },
  // Lo que todavía no tiene mercancía con foto: el color con el león, sin fotos de internet.
  ...["salsas-y-aderezos", "papas-y-congelados", "bebidas", "complementos-gastronomicos", "otros-productos"].map(
    (familia, i): Escena => ({ archivo: `public/familias/${familia}.webp`, ancho: 960, alto: 720, fondo: [VERDE, ORO, CREMA][i % 3], luz: "rgba(255, 248, 225, 0.25)", alturaDeLaLuz: 0.36, piezas: [], leon: true }),
  ),
];

/** El fondo: el color liso con una luz redonda y suave detrás de los productos. */
function fondo(e: Escena): Buffer {
  const cx = e.piezas.length > 0 ? (Math.min(...e.piezas.map((p) => p.x)) + Math.max(...e.piezas.map((p) => p.x))) / 2 : 0.5;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${e.ancho}" height="${e.alto}">
    <defs><radialGradient id="luz" cx="${cx}" cy="${e.alturaDeLaLuz ?? 0.48}" r="0.55"><stop offset="0" stop-color="${e.luz}"/><stop offset="1" stop-color="${e.luz.replace(/[\d.]+\)$/, "0)")}"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="${e.fondo}"/><rect width="100%" height="100%" fill="url(#luz)"/></svg>`);
}

/** Un producto a su alto, con su sombra (la silueta oscurecida y difuminada, un poco más abajo) y su apoyo en el suelo. */
async function pieza(p: Pieza, e: Escena): Promise<OverlayOptions[]> {
  let imagen = sharp(path.join(RECORTES, `${p.foto}.png`));
  if (p.giro) imagen = sharp(await imagen.rotate(p.giro, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
  const alto = Math.round(p.alto * e.alto);
  const producto = await imagen.resize({ height: alto }).png().toBuffer();
  const { width: ancho = 0 } = await sharp(producto).metadata();
  const izquierda = Math.round(p.x * e.ancho - ancho / 2);
  const arriba = Math.round(p.apoyo * e.alto - alto);
  // La sombra: la silueta en verde muy oscuro, transparente y difuminada.
  const { data, info } = await sharp(producto).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const silueta = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    silueta[i] = 5;
    silueta[i + 1] = 23;
    silueta[i + 2] = 13;
    silueta[i + 3] = Math.round(data[i + 3] * 0.42);
  }
  const margen = 40;
  const sombra = await sharp(silueta, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extend({ top: margen, bottom: margen, left: margen, right: margen, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .blur(16)
    .png()
    .toBuffer();
  // El apoyo: una elipse oscura y difuminada bajo la base.
  const anchoApoyo = Math.round(ancho * 0.95);
  const altoApoyo = Math.max(10, Math.round(e.alto * 0.035));
  const apoyo = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${anchoApoyo + 60}" height="${altoApoyo + 60}">
    <defs><filter id="d"><feGaussianBlur stdDeviation="9"/></filter></defs>
    <ellipse cx="${(anchoApoyo + 60) / 2}" cy="${(altoApoyo + 60) / 2}" rx="${anchoApoyo / 2}" ry="${altoApoyo / 2}" fill="rgba(5,23,13,0.5)" filter="url(#d)"/></svg>`);
  return [
    { input: apoyo, left: Math.round(p.x * e.ancho - (anchoApoyo + 60) / 2), top: Math.round(p.apoyo * e.alto - (altoApoyo + 60) / 2) },
    { input: sombra, left: izquierda - margen + 6, top: arriba - margen + 14 },
    { input: producto, left: izquierda, top: arriba },
  ];
}

/** El león de la marca, grande y tenue, para las familias sin mercancía con foto. */
async function leon(e: Escena): Promise<OverlayOptions> {
  const alto = Math.round(e.alto * 0.36);
  const dibujo = await sharp(path.join(raiz, "public", "marca", "leon.svg"), { density: 300 }).resize({ height: alto }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < dibujo.data.length; i += 4) dibujo.data[i] = Math.round(dibujo.data[i] * 0.22);
  const png = await sharp(dibujo.data, { raw: { width: dibujo.info.width, height: dibujo.info.height, channels: 4 } }).png().toBuffer();
  return { input: png, left: Math.round(e.ancho / 2 - dibujo.info.width / 2), top: Math.round(e.alto * 0.15) };
}

/** Que la escena cupiera en su sitio: ningún producto se sale de la foto. */
async function revisar(e: Escena): Promise<void> {
  for (const p of e.piezas) {
    const { width = 0, height = 1 } = await sharp(path.join(RECORTES, `${p.foto}.png`)).metadata();
    const [w, h] = p.giro && Math.abs(p.giro) === 90 ? [height, width] : [width, height];
    const ancho = (w / h) * p.alto * e.alto;
    const izquierda = p.x * e.ancho - ancho / 2;
    if (izquierda < 0 || izquierda + ancho > e.ancho || p.apoyo * e.alto - p.alto * e.alto < 0) throw new Error(`${e.archivo}: ${p.foto} se sale de la foto`);
  }
}

/**
 * Las fotos de referencia de los productos que aún no tienen la suya (public/productos/): la mercancía recortada sobre
 * blanco, como las fotos que sube el dueño, en lugar de una foto de comida de internet. Solo las que hay: los huevos, el
 * jamón arepero Drago y el queso llanero (para los quesos blancos de aquí).
 */
const SOBRE_BLANCO = [
  { archivo: "public/productos/huevos.webp", foto: "huevos" },
  { archivo: "public/productos/jamon-arepero.webp", foto: "jamon-arepero" },
  { archivo: "public/productos/queso-blanco.webp", foto: "queso-llanero" },
];
const LADO_SOBRE_BLANCO = 720;

async function sobreBlanco(foto: string): Promise<Buffer> {
  const caja = Math.round(LADO_SOBRE_BLANCO * 0.8);
  const producto = await sharp(path.join(RECORTES, `${foto}.png`)).resize(caja, caja, { fit: "inside" }).png().toBuffer();
  const { width = 0, height = 0 } = await sharp(producto).metadata();
  const izquierda = Math.round((LADO_SOBRE_BLANCO - width) / 2);
  const arriba = Math.round((LADO_SOBRE_BLANCO - height) / 2);
  // Un apoyo suave bajo la base, como el de las fotos de tienda.
  const apoyo = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${LADO_SOBRE_BLANCO}" height="${LADO_SOBRE_BLANCO}">
    <defs><filter id="d"><feGaussianBlur stdDeviation="10"/></filter></defs>
    <ellipse cx="${LADO_SOBRE_BLANCO / 2}" cy="${arriba + height - 4}" rx="${width * 0.46}" ry="${Math.max(8, height * 0.04)}" fill="rgba(40,30,20,0.22)" filter="url(#d)"/></svg>`);
  return sharp({ create: { width: LADO_SOBRE_BLANCO, height: LADO_SOBRE_BLANCO, channels: 3, background: "#ffffff" } })
    .composite([{ input: apoyo }, { input: producto, left: izquierda, top: arriba }])
    .webp({ quality: 82, effort: 6 })
    .toBuffer();
}

for (const r of SOBRE_BLANCO) {
  fs.writeFileSync(path.join(raiz, r.archivo), await sobreBlanco(r.foto));
  console.log(`${r.archivo}: ${Math.round(fs.statSync(path.join(raiz, r.archivo)).size / 1024)} KB`);
}

for (const e of ESCENAS) {
  await revisar(e);
  const capas: OverlayOptions[] = [];
  if (e.leon) capas.push(await leon(e));
  for (const p of e.piezas) capas.push(...(await pieza(p, e)));
  const salida = path.join(raiz, e.archivo);
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  await sharp(fondo(e)).composite(capas).webp({ quality: 80, effort: 6 }).toFile(salida);
  console.log(`${e.archivo}: ${Math.round(fs.statSync(salida).size / 1024)} KB`);
}
