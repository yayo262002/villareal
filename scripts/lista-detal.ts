import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { crearClienteDesdeEntorno } from "../src/lib/conexion.ts";
import {
  CATEGORIAS_DETAL,
  CLAVES_REGLAS_DETAL,
  enBolivares,
  precioDetalUsd,
  precioMayorUsd,
  reglasDesdeAjustes,
  type ArticuloParaPrecio,
  type CategoriaDetal,
} from "../src/lib/detal-calculo.ts";
import { IVA_GENERAL_POR_DEFECTO } from "../src/lib/factura-calculo.ts";
import { diaDeLaSemana, fechaCorta, hoy } from "../src/lib/dinero.ts";

/**
 * `npm run lista`: las listas de precios del detal de hoy en archivos para
 * enseñarlas en el teléfono. Lee la lista de la base (la de Turso si
 * `.env.local` apunta allí), le pone los precios con la tasa vigente y las
 * mismas reglas que el panel (`src/lib/detal-calculo.ts`), y deja en
 * `listas/`:
 *
 *   lista-de-precios-AAAA-MM-DD.pdf      la del detal: una página larga, del ancho de un teléfono
 *   lista-de-precios-AAAA-MM-DD-1.jpg…   la misma en pantallas, para mandarla como fotos
 *   lista-charcuteria-AAAA-MM-DD.pdf, -1.jpg…  la charcutería aparte, cada producto con su precio al detal y al mayor
 *   lista-al-mayor-AAAA-MM-DD.pdf, -1.jpg…  la del mayor (lo que tiene precio al mayor: la charcutería)
 *   tabla-por-peso-AAAA-MM-DD.pdf, .jpg   la hoja de la rebanadora: lo que se vende por kilo, en bolívares por peso
 *                                         (100 g, 200 g, el cuarto, 300 g, el medio y el kilo), en carta para imprimir
 *
 * Solo lee la base. Hace falta Chrome (lo usa publicidad/generar.mjs).
 */

type Fila = { nombre: string; categoria: CategoriaDetal; unidad: string } & ArticuloParaPrecio;

const raiz = process.cwd();
const carpetaPublicidad = path.join(raiz, "publicidad");
const carpetaListas = process.env.CARPETA_LISTAS ?? path.join(raiz, "listas");

const db = crearClienteDesdeEntorno();
const ajustes = new Map(
  (await db.execute({ sql: `select clave, valor from ajustes where clave in ('tasa_bs', 'iva_pct', ${CLAVES_REGLAS_DETAL.map(() => "?").join(", ")})`, args: [...CLAVES_REGLAS_DETAL] })).rows.map(
    (f) => [String(f.clave), String(f.valor)],
  ),
);
const numeroDe = (clave: string): number | null => (ajustes.has(clave) && Number.isFinite(Number(ajustes.get(clave))) ? Number(ajustes.get(clave)) : null);
// Las mismas reglas que reglasDelDetal() en src/lib/ajustes.ts.
const iva = numeroDe("iva_pct");
const reglas = reglasDesdeAjustes((clave) => ajustes.get(clave), iva !== null && iva >= 0 && iva <= 100 ? iva : IVA_GENERAL_POR_DEFECTO);
const tasa = numeroDe("tasa_bs");

const filas = (
  await db.execute(
    "select nombre, categoria, unidad, costo_bs, costo_usd, iva, tasa_compra, margen_pct, precio_usd, precio_mayor_usd from lista_detal where activo = 1 order by nombre collate nocase",
  )
).rows.map((f) => ({ ...f }) as unknown as Fila);
db.close();

/** Los productos con precio, por categoría y por nombre, con el precio que diga `precio` (el del detal o el del mayor). */
function agrupar(precio: (f: Fila) => number | null) {
  return (Object.keys(CATEGORIAS_DETAL) as CategoriaDetal[])
    .map((categoria) => ({
      nombre: CATEGORIAS_DETAL[categoria],
      articulos: filas
        .filter((f) => f.categoria === categoria)
        .map((f) => ({ nombre: f.nombre, unidad: f.unidad, usd: precio(f), bs: enBolivares(precio(f), tasa, reglas.redondeo_bs) }))
        .filter((a) => a.usd !== null)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    }))
    .filter((g) => g.articulos.length > 0);
}
const contar = (grupos: ReturnType<typeof agrupar>) => grupos.reduce((n, g) => n + g.articulos.length, 0);

const dia = hoy();
const comun = { fecha: dia, fechaLarga: `${diaDeLaSemana(dia)} ${fechaCorta(dia)}`, tasa, redondeo: reglas.redondeo_bs };
const detal = { ...comun, prefijo: "lista-precios", destino: "lista-de-precios", mayor: false, antetitulo: "Charcutería Villa Real", titulo: "Lista de precios", grupos: agrupar((f) => precioDetalUsd(f, reglas)) };
const mayor = { ...comun, prefijo: "lista-mayor", destino: "lista-al-mayor", mayor: true, antetitulo: "Villa Real · al mayor", titulo: "Precios al mayor", grupos: agrupar((f) => precioMayorUsd(f, reglas)) };
if (contar(detal.grupos) === 0) throw new Error("La lista del detal está vacía: no hay nada que enseñar.");

/** La charcutería aparte: cada producto con sus dos precios, al detal y al mayor. */
const precioDe = (usd: number | null) => ({ usd, bs: enBolivares(usd, tasa, reglas.redondeo_bs) });
const deCharcuteria = filas
  .filter((f) => f.categoria === "charcuteria")
  .map((f) => ({ nombre: f.nombre, unidad: f.unidad, detal: precioDe(precioDetalUsd(f, reglas)), mayor: precioDe(precioMayorUsd(f, reglas)) }))
  .filter((a) => a.detal.usd !== null)
  .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
const charcuteria = {
  ...comun,
  prefijo: "lista-charcuteria",
  destino: "lista-charcuteria",
  mayor: false,
  doble: true,
  antetitulo: "Villa Real · al detal y al mayor",
  titulo: "Charcutería",
  grupos: [{ nombre: CATEGORIAS_DETAL.charcuteria, articulos: deCharcuteria }],
};
// La de la charcutería sale si hay charcutería con precio; la del mayor, si algo tiene precio al mayor.
const listas = [detal, ...(deCharcuteria.length > 0 ? [charcuteria] : []), ...(contar(mayor.grupos) > 0 ? [mayor] : [])];
fs.writeFileSync(
  path.join(carpetaPublicidad, "lista-precios-datos.js"),
  `// Lo escribe npm run lista (scripts/lista-detal.ts). No va al repositorio.\nglobalThis.LISTAS = ${JSON.stringify(listas, null, 1)};\n`,
);

// Se dibuja con el mismo guion que los carteles, y lo que sale pasa a listas/ con la fecha.
const DIBUJOS = /^lista-(precios|charcuteria|mayor)(-\d+)?\.(pdf|jpg|png)$/;
for (const viejo of fs.readdirSync(carpetaPublicidad).filter((f) => DIBUJOS.test(f))) fs.rmSync(path.join(carpetaPublicidad, viejo));
const dibujo = spawnSync(process.execPath, [path.join(carpetaPublicidad, "generar.mjs"), "lista-precios"], { stdio: "inherit" });
if (dibujo.status !== 0) throw new Error("No se pudo dibujar la lista.");
fs.mkdirSync(carpetaListas, { recursive: true });
const hechos: string[] = [];
for (const lista of listas) {
  for (const archivo of fs
    .readdirSync(carpetaPublicidad)
    .filter((f) => DIBUJOS.test(f) && f.startsWith(lista.prefijo) && !/\.png$/.test(f))
    .sort()) {
    const destino = archivo.replace(lista.prefijo, `${lista.destino}-${dia}`);
    fs.renameSync(path.join(carpetaPublicidad, archivo), path.join(carpetaListas, destino));
    hechos.push(destino);
  }
}
// La hoja de la rebanadora: la charcutería que se vende por kilo, con su precio al detal en bolívares para los pesos de
// siempre. Cada peso se pasa a bolívares por su cuenta (el kilo por los gramos) y se sube de 5 en 5, como lo demás.
const PESOS = [100, 200, 250, 300, 500, 1000];
const porKilo = filas
  .filter((f) => f.categoria === "charcuteria" && f.unidad === "kg")
  .map((f) => ({ nombre: f.nombre, usdKg: precioDetalUsd(f, reglas) }))
  .filter((f): f is { nombre: string; usdKg: number } => f.usdKg !== null)
  .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  .map((f) => ({ ...f, bs: PESOS.map((g) => enBolivares((f.usdKg * g) / 1000, tasa, reglas.redondeo_bs)) }));
if (porKilo.length > 0) {
  fs.writeFileSync(
    path.join(carpetaPublicidad, "tabla-peso-datos.js"),
    `// Lo escribe npm run lista (scripts/lista-detal.ts). No va al repositorio.\nglobalThis.TABLA_PESO = ${JSON.stringify({ ...comun, pesos: PESOS, filas: porKilo }, null, 1)};\n`,
  );
  const TABLA = /^tabla-peso\.(pdf|jpg|png)$/;
  for (const viejo of fs.readdirSync(carpetaPublicidad).filter((f) => TABLA.test(f))) fs.rmSync(path.join(carpetaPublicidad, viejo));
  const tabla = spawnSync(process.execPath, [path.join(carpetaPublicidad, "generar.mjs"), "tabla-peso"], { stdio: "inherit" });
  if (tabla.status !== 0) throw new Error("No se pudo dibujar la hoja de la rebanadora.");
  for (const archivo of fs.readdirSync(carpetaPublicidad).filter((f) => TABLA.test(f) && !f.endsWith(".png"))) {
    const destino = archivo.replace("tabla-peso", `tabla-por-peso-${dia}`);
    fs.renameSync(path.join(carpetaPublicidad, archivo), path.join(carpetaListas, destino));
    hechos.push(destino);
  }
}

console.log(
  `\n${contar(detal.grupos)} productos al detal${deCharcuteria.length > 0 ? `, ${deCharcuteria.length} de charcutería` : ""}${listas.includes(mayor) ? ` y ${contar(mayor.grupos)} al mayor` : ""} a la tasa ${tasa ?? "(sin tasa)"} en ${carpetaListas}:\n  ${hechos.join("\n  ")}`,
);
