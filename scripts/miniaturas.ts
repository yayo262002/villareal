/**
 * Las miniaturas de las fotos de la web: cada foto de public/familias/ y de public/productos/, recortada al cuadrado y
 * reducida a 128 × 128 (el doble del círculo de 64 px de los atajos de la portada), en public/miniaturas/ con el mismo
 * nombre; y las portadas de las familias, a 480 × 360, en public/miniaturas/familias-480/. La portada pedía la foto
 * entera para un circulito (la de Bebidas, 140 KB) y le quitaba el turno a la foto grande de arriba. Uso:
 * `npm run miniaturas`, al añadir o cambiar una de esas fotos; una prueba avisa si falta alguna.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LADO = 128;

let hechas = 0;
for (const carpeta of ["familias", "productos"]) {
  const origen = path.join(raiz, "public", carpeta);
  const destino = path.join(raiz, "public", "miniaturas", carpeta);
  fs.mkdirSync(destino, { recursive: true });
  for (const archivo of fs.readdirSync(origen).filter((f) => f.endsWith(".webp")).sort()) {
    const salida = path.join(destino, archivo);
    await sharp(path.join(origen, archivo)).resize(LADO, LADO, { fit: "cover", position: "attention" }).webp({ quality: 78, effort: 6 }).toFile(salida);
    hechas++;
  }
  // Las de fotos que ya no están, fuera.
  for (const archivo of fs.readdirSync(destino)) if (!fs.existsSync(path.join(origen, archivo))) fs.rmSync(path.join(destino, archivo));
}
// Las portadas de las familias, también a 480 × 360: las tarjetas de la fila de categorías de la portada miden en el
// teléfono un 40 % del ancho, y con eso les basta (srcset); la foto entera queda para la pantalla ancha.
{
  const origen = path.join(raiz, "public", "familias");
  const destino = path.join(raiz, "public", "miniaturas", "familias-480");
  fs.mkdirSync(destino, { recursive: true });
  for (const archivo of fs.readdirSync(origen).filter((f) => f.endsWith(".webp")).sort()) {
    await sharp(path.join(origen, archivo)).resize(480, 360, { fit: "cover" }).webp({ quality: 76, effort: 6 }).toFile(path.join(destino, archivo));
    hechas++;
  }
  for (const archivo of fs.readdirSync(destino)) if (!fs.existsSync(path.join(origen, archivo))) fs.rmSync(path.join(destino, archivo));
}
console.log(`${hechas} miniaturas en public/miniaturas/`);
