// La cinta amarilla de los fliers de combos (la de ChatGPT: «CON SALSAS ¡Todo listo!») sin «CON SALSAS» (26/11/2026: los
// combos ya no llevan salsa; cada pote es un adicional de 0,50 $). Se borran las letras negras de arriba, rellenando cada
// una con el amarillo que tiene a los lados en la misma fila; «¡Todo listo!», que es rojo, no se toca. El texto nuevo lo
// pone el HTML encima.
// Uso: node publicidad/flier-cinta-sin-salsas.mjs   Deja publicidad/fondos/chatgpt-cinta-sin-salsas.png.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const sharp = createRequire(path.join(aqui, "..", "package.json"))("sharp");
const { data, info } = await sharp(path.join(aqui, "fondos", "chatgpt-hamburguesas-cinta.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const px = (x, y) => (y * W + x) * 4;
/** Donde está «CON SALSAS», en píxeles de la cinta (366 × 124). */
const X0 = 58, X1 = 322, Y0 = 0, Y1 = 66;
const esLetra = (i) => data[i + 3] > 0 && data[i] < 200 && data[i + 1] < 160 && !(data[i] > 150 && data[i] - data[i + 1] > 90);
const esAmarillo = (i) => data[i + 3] > 200 && data[i] > 205 && data[i + 1] > 165 && data[i + 2] < 120;

// Las letras y un borde de 2 píxeles alrededor (el antialias, entre negro y amarillo).
const letra = new Uint8Array(W * H);
for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) if (esLetra(px(x, y))) letra[y * W + x] = 1;
const mascara = new Uint8Array(W * H);
for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
  if (!letra[y * W + x]) continue;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const xx = x + dx, yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
    const i = px(xx, yy);
    // El borde no se come lo rojo de «¡Todo listo!» ni lo transparente de fuera de la cinta.
    if (data[i + 3] > 0 && !(data[i] > 150 && data[i] - data[i + 1] > 90)) mascara[yy * W + xx] = 1;
  }
}
const salida = Buffer.from(data);
const buscar = (x, y, paso) => {
  for (let k = 1; k < 60; k++) {
    const xx = x + paso * k;
    if (xx < 0 || xx >= W) return null;
    const i = px(xx, y);
    if (!mascara[y * W + xx] && esAmarillo(i)) return { k, c: [data[i], data[i + 1], data[i + 2]] };
  }
  return null;
};
let n = 0;
for (let y = Y0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!mascara[y * W + x]) continue;
  const iz = buscar(x, y, -1), de = buscar(x, y, 1);
  let c;
  if (iz && de) c = iz.c.map((v, k) => (v * de.k + de.c[k] * iz.k) / (iz.k + de.k));
  else c = (iz ?? de)?.c ?? [253, 214, 20];
  const i = px(x, y);
  for (let k = 0; k < 3; k++) salida[i + k] = Math.round(c[k]);
  n++;
}
// Un suavizado de lo rellenado, solo con lo rellenado y el amarillo de al lado.
const suave = Buffer.from(salida);
for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
  if (!mascara[y * W + x]) continue;
  const s = [0, 0, 0];
  let m = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const xx = x + dx, yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
    const i = px(xx, yy);
    if (mascara[yy * W + xx] || esAmarillo(i)) { for (let k = 0; k < 3; k++) s[k] += salida[i + k]; m++; }
  }
  const i = px(x, y);
  for (let k = 0; k < 3; k++) suave[i + k] = Math.round(s[k] / m);
}
await sharp(suave, { raw: info }).png().toFile(path.join(aqui, "fondos", "chatgpt-cinta-sin-salsas.png"));
console.log(`${n} píxeles de «CON SALSAS» rellenados`);
