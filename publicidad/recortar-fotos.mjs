// Recorta el aire que sobra alrededor de cada foto de producto: las de publicidad/fotos/originales/
// (las de la web, sobre blanco, o las que manda el dueño) quedan en publicidad/fotos/ como PNG
// pegadas al producto, para ponerlas juntas en el cartel.
//
//   node publicidad/recortar-fotos.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const origen = path.join(aqui, "fotos", "originales");
const destino = path.join(aqui, "fotos");

for (const archivo of fs.readdirSync(origen).sort()) {
  if (!/\.(jpe?g|png|webp)$/i.test(archivo)) continue;
  const nombre = archivo.replace(/\.[^.]+$/, "");
  const salida = path.join(destino, `${nombre}.png`);
  const imagen = sharp(path.join(origen, archivo));
  const { hasAlpha } = await imagen.metadata();
  // Con transparencia se recorta lo transparente; sobre blanco, lo blanco (con margen para el JPEG).
  const recortada = hasAlpha ? imagen.trim({ threshold: 10 }) : imagen.trim({ background: "#ffffff", threshold: 28 });
  const info = await recortada.png().toFile(salida);
  console.log(`${nombre}.png: ${info.width} × ${info.height}${hasAlpha ? " (transparente)" : ""}`);
}
