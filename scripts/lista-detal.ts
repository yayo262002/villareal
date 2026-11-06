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
 *   lista-al-mayor-AAAA-MM-DD.pdf, -1.jpg…  la del mayor (lo que tiene precio al mayor: la charcutería)
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
// La del mayor sale solo si algo tiene precio al mayor.
const listas = contar(mayor.grupos) > 0 ? [detal, mayor] : [detal];
fs.writeFileSync(
  path.join(carpetaPublicidad, "lista-precios-datos.js"),
  `// Lo escribe npm run lista (scripts/lista-detal.ts). No va al repositorio.\nglobalThis.LISTAS = ${JSON.stringify(listas, null, 1)};\n`,
);

// Se dibuja con el mismo guion que los carteles, y lo que sale pasa a listas/ con la fecha.
const DIBUJOS = /^lista-(precios|mayor)(-\d+)?\.(pdf|jpg|png)$/;
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
console.log(
  `\n${contar(detal.grupos)} productos al detal${listas.length > 1 ? ` y ${contar(mayor.grupos)} al mayor` : ""} a la tasa ${tasa ?? "(sin tasa)"} en ${carpetaListas}:\n  ${hechos.join("\n  ")}`,
);
