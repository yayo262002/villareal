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
  await sharp(path.join(origen, archivo)).flatten({ background: "#ffffff" }).png().toFile(plana);

  const { data: orig, info } = await sharp(plana).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let data;
  if (SOLO_LO_BLANCO.has(nombre)) {
    // 1. Solo lo blanco es fondo: cuanto más se aleja un píxel del blanco, más producto es.
    data = Buffer.from(orig);
    for (let i = 0; i < data.length; i += 4) {
      const lejos = Math.max(255 - data[i], 255 - data[i + 1], 255 - data[i + 2]);
      data[i + 3] = Math.min(255, Math.max(0, (lejos - 6) * 12));
    }
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
  if (info.height < 700) imagen = imagen.resize({ height: 800, kernel: "lanczos3" });
  const corregida = await imagen.modulate({ saturation: 1.08 }).sharpen({ sigma: 0.7 }).png().toBuffer();
  const salida = await sharp(corregida).trim({ threshold: 6 }).png().toFile(path.join(destino, `${nombre}.png`));
  console.log(`${nombre}.png: ${salida.width} × ${salida.height}; ${como}`);
}
fs.rmSync(temporal, { recursive: true, force: true });
