// Prepara el flier de hamburguesas que el dueño hizo con ChatGPT (25/11/2026) para ponerle encima los productos de
// verdad y el león de la marca: le borra el león que dibujó ChatGPT (cada fila se rellena con el color que tiene a la
// izquierda y a la derecha) y saca aparte la cinta «CON SALSAS ¡Todo listo!» (por su amarillo y lo que encierra), para
// volver a ponerla encima de los productos. Uso: node publicidad/flier-chatgpt-base.mjs <imagen de ChatGPT>
// Deja publicidad/fondos/chatgpt-hamburguesas-base.png y chatgpt-hamburguesas-cinta.png.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const sharp = createRequire(path.join(aqui, "..", "package.json"))("sharp");
const origen = process.argv[2];
if (!origen) throw new Error("Falta la imagen de ChatGPT");

const { data, info } = await sharp(origen).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const px = (x, y) => (y * W + x) * 4;

// 1. El león dibujado (x 38–206, y 12–244; por debajo de la fila 198 solo hasta la x 165, que ahí empieza la «d»):
//    cada fila, del color que tiene justo a su izquierda (el fondo rojo).
const L = { x0: 38, x1: 206, y0: 12, y1: 244 };
const base = Buffer.from(data);
for (let y = L.y0; y <= L.y1; y++) {
  const a = px(L.x0 - 4, y);
  const hasta = y > 198 ? 165 : L.x1;
  for (let x = L.x0; x <= hasta; x++) for (let c = 0; c < 3; c++) base[px(x, y) + c] = data[a + c];
}
// Un poco de desenfoque solo en ese trozo, para que no se vean las rayas de cada fila.
const trozo = await sharp(base, { raw: info }).extract({ left: L.x0, top: L.y0, width: 165 - L.x0 + 1, height: L.y1 - L.y0 + 1 }).blur(8).png().toBuffer();
const trozoArriba = await sharp(base, { raw: info }).extract({ left: 160, top: L.y0, width: L.x1 - 160 + 1, height: 198 - L.y0 + 1 }).blur(8).png().toBuffer();
await sharp(base, { raw: info }).composite([{ input: trozo, left: L.x0, top: L.y0 }, { input: trozoArriba, left: 160, top: L.y0 }]).png().toFile(path.join(aqui, "fondos", "chatgpt-hamburguesas-base.png"));

// 2. La cinta, por su contorno medido a mano (en la imagen de ChatGPT), con el borde suave.
const CONTORNO = [[300, 605], [317, 572], [420, 562], [530, 552], [620, 549], [638, 557], [630, 610], [616, 644], [470, 652], [345, 659], [290, 662], [283, 640]];
const C = { x0: 278, y0: 544, w: 366, h: 124 };
const puntos = CONTORNO.map(([x, y]) => `${x - C.x0},${y - C.y0}`).join(" ");
const silueta = Buffer.from(`<svg width="${C.w}" height="${C.h}" xmlns="http://www.w3.org/2000/svg"><polygon points="${puntos}" fill="#fff"/></svg>`);
const suave = await sharp(silueta).blur(1.2).png().toBuffer();
await sharp(origen).extract({ left: C.x0, top: C.y0, width: C.w, height: C.h }).ensureAlpha().composite([{ input: suave, blend: "dest-in" }]).png().toFile(path.join(aqui, "fondos", "chatgpt-hamburguesas-cinta.png"));
console.log(`base ${W}×${H}; cinta en x ${C.x0}, y ${C.y0}`);
