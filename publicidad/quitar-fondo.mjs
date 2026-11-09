// Deja cada foto de producto lista para el cartel: le quita el fondo con un recortador de
// verdad (una red neuronal, @imgly/background-removal-node), le corrige el color tomando el
// fondo de la foto original como referencia de blanco, la aviva un poco y la recorta al
// producto. De publicidad/fotos/originales/ a publicidad/fotos/, en PNG con transparencia.
//
//   npm i --no-save @imgly/background-removal-node     (una vez; no va en package.json)
//   node publicidad/quitar-fondo.mjs                   todas las fotos
//   node publicidad/quitar-fondo.mjs mortadela-de-pollo   solo esa
//
// La primera vez baja el modelo (unos 80 MB) y lo deja en caché. El recortador trae su
// propio sharp, que choca con el del proyecto en el mismo proceso: por eso el recorte corre
// en un proceso hijo (--recortar) y el color se trabaja aquí con el sharp del proyecto.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const origen = path.join(aqui, "fotos", "originales");
const destino = path.join(aqui, "fotos");
const argumentos = process.argv.slice(2);
/** Fotos claras sobre blanco puro (las de la web) en que el recortador se come el producto: con ellas vale
 *  con recortar lo blanco, que en esas fotos es exactamente el fondo. */
const SOLO_LO_BLANCO = new Set(["mozzarella"]);
/** Fotos en que el recortador toma el envoltorio por fondo (un paquete rosado, translúcido): el fondo es lo que
 *  se toca desde los bordes de la foto y no tiene color (gris, blanco o negro); lo demás es producto. */
const DESDE_LOS_BORDES = new Set(["pechuga-de-pavo"]);
/** Fotos que ya vienen bien recortadas (de un banco de fotos, o el pan, la mortadela extra y el queso paisa, que el dueño mandó sin fondo): se respeta su transparencia. */
const CON_SU_RECORTE = new Set(["huevos", "pan-de-sandwich", "mortadela-extra", "queso-paisa"]);
/** Fotos con un tinte azul o lila en el envoltorio (reflejos del fondo azul en que se fotografió): los píxeles
 *  claros con más azul que rojo vuelven al color del envoltorio, con su misma luz; el azul oscuro de una
 *  etiqueta no se toca. El color es el del envoltorio de esa foto. */
const SIN_TINTE_AZUL = new Map([["bolona-de-pollo", [232, 118, 66]]]);
/** Fotos que se giran antes de nada (grados, a la derecha): las mortadelas (Alibal, Punta de Monte) se fotografiaron acostadas y en el cartel van de pie
 *  (104 y no 90 porque en la foto está ladeada; con la perspectiva, el cálculo de abajo no la endereza bien). */
const GIRAR_PRIMERO = new Map([["mortadela-de-pollo", 104], ["mortadela-punta-de-monte", 90]]);
/** La regla de verticalidad: estos productos van derechos en el cartel. Se mide la inclinación de la pieza
 *  (el eje largo de su silueta) y se endereza. Lo que no es alargado o va acostado (la mozzarella con sus
 *  lonjas, la bolsa de suero, el cartón de huevos, el paquete de salchichas) no se toca. */
const ENDEREZAR = new Set(["mortadela-extra", "queso-amarillo", "queso-amarillo-vallecito", "jamon-de-espalda", "jamon-ahumado", "jamon-de-pierna", "jamon-arepero", "bolona-de-pollo", "pechuga-de-pavo"]);

if (argumentos[0] === "--recortar") {
  // El proceso hijo: solo el recorte, con el recortador y nada más.
  const [, entrada, salida] = argumentos;
  const { removeBackground } = await import("@imgly/background-removal-node");
  const blob = await removeBackground(new Blob([fs.readFileSync(entrada)], { type: "image/png" }), { output: { format: "image/png", quality: 1 } });
  fs.writeFileSync(salida, Buffer.from(await blob.arrayBuffer()));
  process.exit(0);
}

const { default: sharp } = await import("sharp");
const temporal = fs.mkdtempSync(path.join(os.tmpdir(), "fotos-cartel-"));

for (const archivo of fs.readdirSync(origen).sort()) {
  if (!/\.(jpe?g|png|webp)$/i.test(archivo)) continue;
  const nombre = archivo.replace(/\.[^.]+$/, "");
  if (argumentos.length > 0 && !argumentos.includes(nombre)) continue;

  // La foto original, aplanada sobre blanco (algunas ya vienen con transparencia).
  const plana = path.join(temporal, `${nombre}-plana.png`);
  const cortada = path.join(temporal, `${nombre}-cortada.png`);
  // El giro va en un paso aparte: sharp aplana antes de girar, y las esquinas del giro quedarían transparentes.
  let original = await descontaminar(path.join(origen, archivo));
  if (GIRAR_PRIMERO.has(nombre)) original = await sharp(original).rotate(GIRAR_PRIMERO.get(nombre), { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp(original).flatten({ background: "#ffffff" }).png().toFile(plana);

  const { data: orig, info } = await sharp(plana).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let data;
  if (SOLO_LO_BLANCO.has(nombre)) {
    // 1. Solo lo blanco es fondo: cuanto más se aleja un píxel del blanco, más producto es.
    data = Buffer.from(orig);
    for (let i = 0; i < data.length; i += 4) {
      const lejos = Math.max(255 - data[i], 255 - data[i + 1], 255 - data[i + 2]);
      data[i + 3] = Math.min(255, Math.max(0, (lejos - 6) * 12));
    }
  } else if (CON_SU_RECORTE.has(nombre)) {
    // 1. El recorte que trae, descontaminado.
    data = Buffer.from((await sharp(plana).ensureAlpha().raw().toBuffer({ resolveWithObject: true })).data);
    const suya = await sharp(await descontaminar(path.join(origen, archivo))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (suya.info.width === info.width && suya.info.height === info.height) for (let i = 3; i < data.length; i += 4) data[i] = suya.data[i];
  } else if (DESDE_LOS_BORDES.has(nombre)) {
    // 1. Desde los bordes hacia dentro, por los píxeles sin color (gris, blanco o negro): eso es fondo.
    data = Buffer.from(orig);
    const { width, height } = info;
    const sinColor = (i) => Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) < 40;
    const fondo = new Uint8Array(width * height);
    const cola = [];
    for (let x = 0; x < width; x++) cola.push(x, (height - 1) * width + x);
    for (let y = 0; y < height; y++) cola.push(y * width, y * width + width - 1);
    while (cola.length > 0) {
      const k = cola.pop();
      if (fondo[k] || !sinColor(k * 4)) continue;
      fondo[k] = 1;
      const x = k % width;
      const y = (k - x) / width;
      if (x > 0) cola.push(k - 1);
      if (x < width - 1) cola.push(k + 1);
      if (y > 0) cola.push(k - width);
      if (y < height - 1) cola.push(k + width);
    }
    for (let k = 0; k < fondo.length; k++) data[k * 4 + 3] = fondo[k] ? 0 : 255;
  } else {
    // 1. El recorte, en su proceso.
    const hijo = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--recortar", plana, cortada], { stdio: ["ignore", "inherit", "pipe"] });
    if (hijo.status !== 0) throw new Error(`No se pudo recortar ${archivo}: ${String(hijo.stderr).split("\n").filter((l) => !l.includes("GLib")).join("\n")}`);
    data = (await sharp(cortada).ensureAlpha().raw().toBuffer({ resolveWithObject: true })).data;
  }

  if (SIN_TINTE_AZUL.has(nombre)) quitarTinteAzul(data, SIN_TINTE_AZUL.get(nombre));

  // Un píxel menos de contorno: ahí es donde queda el color del fondo viejo (el «bordecito azul»).
  erosionar(data, info.width, info.height);

  // 2. El color. Si el fondo de la foto original es claro, sirve de referencia de blanco: un fondo que
  //    salió gris o amarillento se lleva a blanco y el producto se corrige con él. Si el fondo es oscuro
  //    (una foto sobre negro) no dice nada del blanco: se estiran los niveles del propio producto, para
  //    que lo más claro de la etiqueta quede casi blanco y lo más oscuro, casi negro.
  const fondo = [0, 0, 0];
  let n = 0;
  const luces = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) {
      fondo[0] += orig[i];
      fondo[1] += orig[i + 1];
      fondo[2] += orig[i + 2];
      n++;
    } else if (data[i + 3] > 200) {
      luces.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
  }
  let ganancias = [1, 1, 1];
  let desplazamiento = 0;
  let como = "sin cambio";
  const mediasDelFondo = n > info.width * info.height * 0.05 ? fondo.map((c) => c / n) : null;
  const fondoClaro = mediasDelFondo && mediasDelFondo.every((m) => m > 150);
  if (fondoClaro) {
    // Cada canal sube hasta dejar el fondo en blanco, sin pasarse; un fondo ya blanco no se toca.
    ganancias = mediasDelFondo.map((m) => Math.min(1.35, Math.max(1, 250 / Math.max(m, 1))));
    como = `blanco de referencia ×${ganancias.map((g) => g.toFixed(2)).join("/")}`;
  } else if (luces.length > 100) {
    luces.sort((x, y) => x - y);
    const oscuro = luces[Math.floor(luces.length * 0.01)];
    const claro = luces[Math.floor(luces.length * 0.99)];
    const a = Math.min(1.6, Math.max(1, 238 / Math.max(claro - oscuro, 1)));
    desplazamiento = 10 - a * oscuro;
    ganancias = [a, a, a];
    como = `niveles del producto ×${a.toFixed(2)} ${desplazamiento >= 0 ? "+" : ""}${desplazamiento.toFixed(0)}`;
  }

  // 3. Las fotos pequeñas se agrandan con suavizado (no ganan detalle, pero no se ven los píxeles en el
  //    cartel); después, un poco más de viveza y nitidez, y el recorte al producto.
  let imagen = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).linear(ganancias.concat([1]), [desplazamiento, desplazamiento, desplazamiento, 0]);
  let giro = 0;
  if (ENDEREZAR.has(nombre)) {
    giro = inclinacion(data, info.width, info.height);
    if (Math.abs(giro) >= 0.5) imagen = imagen.rotate(giro, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
    como += `; enderezada ${giro.toFixed(1)}°`;
  }
  if (info.height < 700) imagen = imagen.resize({ height: 800, kernel: "lanczos3" });
  const corregida = await imagen.modulate({ saturation: 1.08 }).sharpen({ sigma: 0.7 }).png().toBuffer();
  const salida = await sharp(corregida).trim({ threshold: 6 }).png().toFile(path.join(destino, `${nombre}.png`));
  console.log(`${nombre}.png: ${salida.width} × ${salida.height}; ${como}`);
}
fs.rmSync(temporal, { recursive: true, force: true });

/**
 * Una foto que ya viene recortada (PNG con transparencia, de una app que quita fondos) guarda en los
 * píxeles medio transparentes del borde el color del fondo que tenía: sobre blanco salen manchas azules
 * o moradas. Se les pone el color de los píxeles de dentro del producto que tienen al lado, y se deja la
 * transparencia como estaba. Una foto sin transparencia sale tal cual.
 */
async function descontaminar(ruta) {
  const imagen = sharp(ruta);
  const { hasAlpha } = await imagen.metadata();
  if (!hasAlpha) return ruta;
  const { data, info } = await imagen.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const firme = new Uint8Array(width * height);
  for (let k = 0; k < firme.length; k++) firme[k] = data[k * 4 + 3] >= 230 ? 1 : 0;
  // Desde lo firme hacia fuera, pasada a pasada: cada píxel flojo toma la media de los firmes que lo rodean.
  for (let pasada = 0; pasada < 12; pasada++) {
    const nuevos = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const k = y * width + x;
        if (firme[k] || data[k * 4 + 3] === 0) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
            const j = yy * width + xx;
            if (!firme[j]) continue;
            r += data[j * 4]; g += data[j * 4 + 1]; b += data[j * 4 + 2]; n++;
          }
        }
        if (n > 0) nuevos.push(k, Math.round(r / n), Math.round(g / n), Math.round(b / n));
      }
    }
    if (nuevos.length === 0) break;
    for (let i = 0; i < nuevos.length; i += 4) {
      const k = nuevos[i];
      data[k * 4] = nuevos[i + 1]; data[k * 4 + 1] = nuevos[i + 2]; data[k * 4 + 2] = nuevos[i + 3];
      firme[k] = 1;
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/** Deja la transparencia de cada píxel en la menor de las de su alrededor: el contorno pierde un píxel. */
function erosionar(data, width, height) {
  const alfa = new Uint8Array(width * height);
  for (let k = 0; k < alfa.length; k++) alfa[k] = data[k * 4 + 3];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let menor = 255;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(width - 1, Math.max(0, x + dx));
          const yy = Math.min(height - 1, Math.max(0, y + dy));
          menor = Math.min(menor, alfa[yy * width + xx]);
        }
      }
      data[(y * width + x) * 4 + 3] = menor;
    }
  }
}

/** Los píxeles claros en que el azul gana al rojo toman el color del envoltorio, con la luz que tenían. */
function quitarTinteAzul(data, envoltorio) {
  const luz = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  const luzDelEnvoltorio = luz(...envoltorio);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const l = luz(r, g, b);
    if (b > r + 25 && l > 110) {
      const factor = l / luzDelEnvoltorio;
      data[i] = Math.min(255, Math.round(envoltorio[0] * factor));
      data[i + 1] = Math.min(255, Math.round(envoltorio[1] * factor));
      data[i + 2] = Math.min(255, Math.round(envoltorio[2] * factor));
    }
  }
}

/**
 * Cuántos grados hay que girar la pieza (a la derecha, positivo) para que su eje largo quede vertical:
 * el eje sale de los momentos de la silueta (los píxeles con transparencia), como en estadística.
 */
function inclinacion(data, width, height) {
  let n = 0, sx = 0, sy = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 127) { n++; sx += x; sy += y; }
  if (n === 0) return 0;
  const cx = sx / n, cy = sy / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 127) { sxx += (x - cx) ** 2; syy += (y - cy) ** 2; sxy += (x - cx) * (y - cy); }
  const angulo = (0.5 * Math.atan2(2 * sxy, sxx - syy) * 180) / Math.PI; // el eje largo, desde la horizontal
  let giro = 90 - angulo;
  while (giro > 90) giro -= 180;
  while (giro <= -90) giro += 180;
  return giro;
}
