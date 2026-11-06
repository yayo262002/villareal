import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { crearClienteDesdeEntorno } from "../src/lib/conexion.ts";
import {
  CATEGORIAS_DETAL,
  MARGEN_DETAL_POR_DEFECTO,
  REDONDEO_BS_POR_DEFECTO,
  enBolivares,
  precioDetalUsd,
  precioMayorUsd,
  type ArticuloParaPrecio,
  type CategoriaDetal,
  type ReglasDelDetal,
} from "../src/lib/detal-calculo.ts";
import { IVA_GENERAL_POR_DEFECTO } from "../src/lib/factura-calculo.ts";
import { diaDeLaSemana, fechaCorta, hoy } from "../src/lib/dinero.ts";

/**
 * `npm run lista`: la lista de precios del detal de hoy en un archivo para
 * enseñarla en el teléfono. Lee la lista de la base (la de Turso si
 * `.env.local` apunta allí), le pone los precios con la tasa vigente y las
 * mismas reglas que el panel (`src/lib/detal-calculo.ts`), y deja en
 * `listas/`:
 *
 *   lista-de-precios-AAAA-MM-DD.pdf      una página larga, del ancho de un teléfono
 *   lista-de-precios-AAAA-MM-DD-1.jpg…   la misma lista en pantallas, para mandarla como fotos
 *
 * Solo lee la base. Hace falta Chrome (lo usa publicidad/generar.mjs).
 */

type Fila = { nombre: string; categoria: CategoriaDetal; unidad: string } & ArticuloParaPrecio;

const raiz = process.cwd();
const carpetaPublicidad = path.join(raiz, "publicidad");
const carpetaListas = process.env.CARPETA_LISTAS ?? path.join(raiz, "listas");

const db = crearClienteDesdeEntorno();
const ajustes = new Map(
  (
    await db.execute(
      "select clave, valor from ajustes where clave in ('tasa_bs', 'tasa_origen', 'tasa_fecha_valor', 'iva_pct', 'detal_margen_pct', 'detal_margen_mayor_pct', 'detal_redondeo_bs')",
    )
  ).rows.map((f) => [String(f.clave), String(f.valor)]),
);
const numeroDe = (clave: string): number | null => (ajustes.has(clave) && Number.isFinite(Number(ajustes.get(clave))) ? Number(ajustes.get(clave)) : null);
// Las mismas reglas que reglasDelDetal() en src/lib/ajustes.ts.
const iva = numeroDe("iva_pct");
const margen = numeroDe("detal_margen_pct");
const mayor = numeroDe("detal_margen_mayor_pct");
const redondeo = numeroDe("detal_redondeo_bs");
const reglas: ReglasDelDetal = {
  margen_pct: margen !== null && margen >= 0 ? margen : MARGEN_DETAL_POR_DEFECTO,
  margen_mayor_pct: mayor !== null && mayor >= 0 ? mayor : null,
  iva_pct: iva !== null && iva >= 0 && iva <= 100 ? iva : IVA_GENERAL_POR_DEFECTO,
  redondeo_bs: redondeo !== null && redondeo > 0 ? redondeo : REDONDEO_BS_POR_DEFECTO,
};
const tasa = numeroDe("tasa_bs");

const filas = (
  await db.execute(
    "select nombre, categoria, unidad, costo_bs, iva, tasa_compra, margen_pct, precio_usd, precio_mayor_usd from lista_detal where activo = 1 order by nombre collate nocase",
  )
).rows.map((f) => ({ ...f }) as unknown as Fila);
db.close();

const grupos = (Object.keys(CATEGORIAS_DETAL) as CategoriaDetal[])
  .map((categoria) => ({
    nombre: CATEGORIAS_DETAL[categoria],
    articulos: filas
      .filter((f) => f.categoria === categoria)
      .map((f) => {
        const usd = precioDetalUsd(f, reglas);
        const usdMayor = precioMayorUsd(f, reglas);
        return {
          nombre: f.nombre,
          unidad: f.unidad,
          usd,
          bs: enBolivares(usd, tasa, reglas.redondeo_bs),
          mayor_usd: usdMayor,
          mayor_bs: enBolivares(usdMayor, tasa, reglas.redondeo_bs),
        };
      })
      .filter((a) => a.usd !== null)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
  }))
  .filter((g) => g.articulos.length > 0);
const cuantos = grupos.reduce((n, g) => n + g.articulos.length, 0);
if (cuantos === 0) throw new Error("La lista del detal está vacía: no hay nada que enseñar.");

const dia = hoy();
const datos = {
  fecha: dia,
  fechaLarga: `${diaDeLaSemana(dia)} ${fechaCorta(dia)}`,
  tasa,
  redondeo: reglas.redondeo_bs,
  grupos,
};
fs.writeFileSync(
  path.join(carpetaPublicidad, "lista-precios-datos.js"),
  `// Lo escribe npm run lista (scripts/lista-detal.ts). No va al repositorio.\nglobalThis.LISTA = ${JSON.stringify(datos, null, 1)};\n`,
);

// Se dibuja con el mismo guion que los carteles, y lo que sale pasa a listas/ con la fecha.
for (const viejo of fs.readdirSync(carpetaPublicidad).filter((f) => /^lista-precios(-\d+)?\.(pdf|jpg|png)$/.test(f))) fs.rmSync(path.join(carpetaPublicidad, viejo));
const dibujo = spawnSync(process.execPath, [path.join(carpetaPublicidad, "generar.mjs"), "lista-precios"], { stdio: "inherit" });
if (dibujo.status !== 0) throw new Error("No se pudo dibujar la lista.");
fs.mkdirSync(carpetaListas, { recursive: true });
const hechos: string[] = [];
for (const archivo of fs
  .readdirSync(carpetaPublicidad)
  .filter((f) => /^lista-precios(-\d+)?\.(pdf|jpg)$/.test(f))
  .sort()) {
  const destino = archivo.replace(/^lista-precios/, `lista-de-precios-${dia}`);
  fs.renameSync(path.join(carpetaPublicidad, archivo), path.join(carpetaListas, destino));
  hechos.push(destino);
}
console.log(`\n${cuantos} productos a la tasa ${tasa ?? "(sin tasa)"} en ${carpetaListas}:\n  ${hechos.join("\n  ")}`);
