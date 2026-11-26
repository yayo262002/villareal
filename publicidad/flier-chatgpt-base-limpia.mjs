// El fondo del flier de hamburguesas sin los productos que dibujó ChatGPT (26/11/2026: el dueño los quiere todos «bien
// proporcionados con las medidas de la vida real», y con los de ChatGPT debajo no se podían achicar sin que se asomaran).
// Parte de fondos/chatgpt-hamburguesas-base.png (la de flier-chatgpt-base.mjs, ya sin el león dibujado) y rellena la zona
// de los productos: cada columna, desde justo debajo de la raya amarilla del título hasta la mesa, con el color que tiene
// el fondo arriba (suavizado de lado a lado: con el de cada columna salían rayas, como una cortina), oscureciéndose hacia
// abajo como el original. Por los lados, por encima de las hamburguesas, el relleno toma poco a poco el color que la
// imagen tiene justo al lado, y arriba a la izquierda (donde no hay raya) se difumina en más píxeles: así no se ve el
// borde. Junto a las hamburguesas no se toca nada. La mesa (fondos/madera.jpg) y la cinta van encima, en el HTML.
// Uso: node publicidad/flier-chatgpt-base-limpia.mjs   Deja publicidad/fondos/chatgpt-hamburguesas-limpia.png.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const sharp = createRequire(path.join(aqui, "..", "package.json"))("sharp");
const origen = path.join(aqui, "fondos", "chatgpt-hamburguesas-base.png");
const { data, info } = await sharp(origen).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const px = (x, y) => (y * W + x) * 4;

/** La zona: de x 186 a 772 por encima de los panes de las hamburguesas (hasta la fila 342); más abajo, de 204 a 758. */
const X0 = 186, X1 = 772, ABAJO = 606, HAMBURGUESAS = 342, X0_ABAJO = 204, X1_ABAJO = 758;
/** Hasta dónde baja la raya del título en cada tramo (medido columna a columna), con unos píxeles de margen. A la
 *  izquierda de la raya (x < 385) no hay nada que respetar: se empieza más arriba y se difumina más. */
const TRAMOS = [[0, 288], [385, 322], [460, 316], [500, 309], [520, 306], [545, 303], [580, 302], [640, 300], [700, 304]];
const arriba = (x) => {
  for (let i = TRAMOS.length - 1; i >= 0; i--) if (x >= TRAMOS[i][0]) return TRAMOS[i][1];
  return TRAMOS[0][1];
};
const difuminadoArriba = (x) => (x < 385 ? 18 : 4);
/** Dónde se toma el color de arriba de cada columna: debajo de las letras, a la izquierda; justo bajo la raya, en lo demás. */
const filaDelColor = (x) => (x < 385 ? 298 : arriba(x));
const media = (x, y, ancho = 1) => {
  const c = [0, 0, 0];
  let n = 0;
  for (let dx = -ancho; dx <= ancho; dx++) for (let dy = 0; dy <= 2; dy++, n++) for (let k = 0; k < 3; k++) c[k] += data[px(x + dx, y + dy) + k];
  return c.map((v) => v / n);
};
// La tapa de la Big Cola dibujada (x 578 a 626) no es fondo: ahí, el color entre sus dos lados.
const izq = media(576, filaDelColor(576)), der = media(628, filaDelColor(628));
const crudo = [];
for (let x = X0; x <= X1; x++) crudo.push(x > 576 && x < 628 ? izq.map((v, k) => v + ((der[k] - v) * (x - 576)) / 52) : media(x, filaDelColor(x)));
const suave = crudo.map((_, i) => {
  const c = [0, 0, 0];
  let n = 0;
  for (let j = Math.max(0, i - 40); j <= Math.min(crudo.length - 1, i + 40); j++, n++) for (let k = 0; k < 3; k++) c[k] += crudo[j][k];
  return c.map((v) => v / n);
});

const salida = Buffer.from(data);
for (let x = X0; x <= X1; x++) {
  const y0 = arriba(x);
  for (let y = y0; y <= ABAJO; y++) {
    const t = (y - y0) / (ABAJO - y0);
    const oscuro = 1 - 0.55 * Math.pow(t, 0.8); // hacia la mesa, más oscuro, como entre los productos del original
    let c = suave[x - X0].map((v) => v * oscuro);
    if (y < HAMBURGUESAS) {
      // Por los lados, el color de la imagen justo al lado, mezclado hacia dentro en 40 px.
      const ladoIzq = media(X0 - 3, y, 1), ladoDer = media(X1 + 3, y, 1);
      const wi = Math.min(1, (x - X0) / 40), wd = Math.min(1, (X1 - x) / 40);
      c = c.map((v, k) => ladoIzq[k] * (1 - wi) + v * wi);
      c = c.map((v, k) => ladoDer[k] * (1 - wd) + v * wd);
    }
    for (let k = 0; k < 3; k++) salida[px(x, y) + k] = Math.round(c[k]);
  }
}
// Suavizado y máscara: 1 dentro de la zona; 0 fuera, con el borde de arriba difuminado y, abajo, el de los lados corto.
const ancho = X1 - X0 + 1, top = 280, alto = ABAJO - top + 1;
const trozo = await sharp(salida, { raw: info }).extract({ left: X0, top, width: ancho, height: alto }).blur(4).raw().toBuffer();
const mascara = Buffer.alloc(ancho * alto);
for (let i = 0; i < ancho; i++) {
  const x = X0 + i;
  const y0 = arriba(x), d = difuminadoArriba(x);
  for (let j = 0; j < alto; j++) {
    const y = top + j;
    if (y < y0) continue;
    let m = Math.min(1, (y - y0 + 1) / d);
    if (y >= HAMBURGUESAS) m *= Math.max(0, Math.min(1, (x - X0_ABAJO) / 3, (X1_ABAJO - x) / 3));
    else m *= Math.min(1, (x - X0) / 6, (X1 - x) / 6);
    mascara[j * ancho + i] = Math.round(255 * m);
  }
}
const trozoConMascara = await sharp(trozo, { raw: { width: ancho, height: alto, channels: 4 } }).removeAlpha().joinChannel(mascara, { raw: { width: ancho, height: alto, channels: 1 } }).png().toBuffer();
await sharp(data, { raw: info }).composite([{ input: trozoConMascara, left: X0, top }]).png().toFile(path.join(aqui, "fondos", "chatgpt-hamburguesas-limpia.png"));
console.log(`relleno x ${X0}–${X1} (abajo ${X0_ABAJO}–${X1_ABAJO}), hasta y ${ABAJO}`);
