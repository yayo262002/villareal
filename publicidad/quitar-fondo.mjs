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
  } else {
    // 1. El recorte, en su proceso.
    const hijo = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--recortar", plana, cortada], { stdio: ["ignore", "inherit", "pipe"] });
    if (hijo.status !== 0) throw new Error(`No se pudo recortar ${archivo}: ${String(hijo.stderr).split("\n").filter((l) => !l.includes("GLib")).join("\n")}`);
    data = (await sharp(cortada).ensureAlpha().raw().toBuffer({ resolveWithObject: true })).data;
  }

  // 2. El blanco de referencia: el fondo de la foto original, donde el recorte dice que no hay producto.
  //    Un fondo que salió gris o amarillento se lleva a blanco y el producto se corrige con él.
  const suma = [0, 0, 0];
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) {
      suma[0] += orig[i];
      suma[1] += orig[i + 1];
      suma[2] += orig[i + 2];
      n++;
    }
  }
  let ganancias = [1, 1, 1];
  if (n > info.width * info.height * 0.05) {
    const medias = suma.map((s) => s / n);
    // Si el fondo ya es blanco limpio no se toca; si no, cada canal sube hasta dejarlo en blanco (sin pasarse).
    ganancias = medias.map((m) => Math.min(1.35, Math.max(1, 250 / Math.max(m, 1))));
  }

  // 3. El color: la corrección del blanco, un poco más de viveza y nitidez, y el recorte al producto.
  const corregida = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .linear(ganancias.concat([1]), [0, 0, 0, 0])
    .modulate({ saturation: 1.08 })
    .sharpen({ sigma: 0.7 })
    .png()
    .toBuffer();
  const salida = await sharp(corregida).trim({ threshold: 6 }).png().toFile(path.join(destino, `${nombre}.png`));
  console.log(`${nombre}.png: ${salida.width} × ${salida.height}; blanco de referencia ×${ganancias.map((g) => g.toFixed(2)).join("/")}`);
}
fs.rmSync(temporal, { recursive: true, force: true });
