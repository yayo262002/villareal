import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { crearClienteDesdeEntorno } from "../src/lib/conexion.ts";
import { CLAVES_REGLAS_DETAL, costoEnDolares, enBolivares, precioDetalUsd, reglasDesdeAjustes, type ArticuloParaPrecio } from "../src/lib/detal-calculo.ts";
import { COMBOS_DEL_DETAL, claveDeNombreDetal, faltanParaElCombo, precioDelCombo } from "../src/lib/combos-detal.ts";
import { IVA_GENERAL_POR_DEFECTO } from "../src/lib/factura-calculo.ts";
import { diaDeLaSemana, fechaCorta, hoy } from "../src/lib/dinero.ts";

/**
 * `npm run combos`: el precio de cada combo del detal de hoy, desglosado producto por producto, y el flier del estado de
 * WhatsApp con esos precios. Cada combo cuesta lo que suman sus productos al precio del detal de hoy, subido al centavo:
 * la misma cuenta que la caja (`src/lib/combos-detal.ts`), con la lista de la base (la de Turso si `.env.local` apunta
 * allí). Deja en `listas/`:
 *
 *   precios-combos-AAAA-MM-DD-1.pdf, .jpg   los de todos los días (1 a 9), cada producto con lo que lleva y su precio
 *   precios-combos-AAAA-MM-DD-2.pdf, .jpg   los especiales
 *   estado-combos-AAAA-MM-DD.jpg            el flier para el estado de WhatsApp, con los precios de hoy
 *
 * Las hojas son para el dueño: con lo que cuesta cada combo y lo que deja. Solo lee la base. Hace falta Chrome (lo usa
 * publicidad/generar.mjs).
 */

type Fila = { nombre: string; unidad: string } & ArticuloParaPrecio;

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
const ivaGuardado = numeroDe("iva_pct");
const iva = ivaGuardado !== null && ivaGuardado >= 0 && ivaGuardado <= 100 ? ivaGuardado : IVA_GENERAL_POR_DEFECTO;
const reglas = reglasDesdeAjustes((clave) => ajustes.get(clave), iva);
const tasa = numeroDe("tasa_bs");
// Toda la lista, también lo escondido de la lista de la familia: como la caja.
const filas = (
  await db.execute("select nombre, categoria, unidad, costo_bs, costo_usd, iva, tasa_compra, margen_pct, precio_usd, precio_mayor_usd from lista_detal")
).rows.map((f) => ({ ...f }) as unknown as Fila);
db.close();

const porNombre = new Map(filas.map((f) => [claveDeNombreDetal(f.nombre), f]));
/**
 * Lo que aún no está en la lista del detal, con su costo por kilo estimado (el dueño): con él la hoja y el flier dicen un
 * precio, marcado «estimado»; la caja no lo usa (allí se escribe a mano hasta que se cargue). Se quita al cargarlo.
 */
const ESTIMADOS: Record<string, number> = { "queso paisa": 10 };
const precioEstimado = (nombre: string): number | null => {
  const costo = ESTIMADOS[claveDeNombreDetal(nombre)];
  return costo === undefined ? null : Math.ceil(Math.round((costo / 0.8) * 1e6) / 1e4) / 100;
};
const precioDe = (nombre: string): number | null => {
  const fila = porNombre.get(claveDeNombreDetal(nombre));
  return fila ? precioDetalUsd(fila, reglas) : precioEstimado(nombre);
};

/** Lo que lleva de un producto, como se dice en la charcutería: «200 g», «6 huevos», «1 unidad». */
function cuanto(nombre: string, unidad: string, cantidad: number): string {
  // Lo que va por kilo, una pieza de 1 kg que se vende entera («Mortadela especial Alibal 1 kg») y lo que aún no está en la
  // lista (el queso paisa), en gramos.
  if (unidad === "kg" || (cantidad < 1 && (/\b1 kg\b/.test(nombre) || unidad === ""))) return `${Math.round(cantidad * 1000)} g`;
  const deCuantos = /de (\d+)\)/.exec(nombre);
  if (deCuantos) return `${Math.round(cantidad * Number(deCuantos[1]))} ${nombre.split(" ")[0].toLowerCase()}`;
  return cantidad === 1 ? "1 unidad" : `${cantidad} unidades`;
}

const dia = hoy();
const desglose = COMBOS_DEL_DETAL.map((combo) => {
  const partes = combo.componentes.map((c) => {
    const fila = porNombre.get(claveDeNombreDetal(c.detal));
    const precio = precioDe(c.detal);
    const costo = fila ? costoEnDolares(fila, iva) : (ESTIMADOS[claveDeNombreDetal(c.detal)] ?? null);
    return {
      cuanto: cuanto(c.detal, fila?.unidad ?? "", c.cantidad),
      nombre: c.detal,
      unidad: fila?.unidad === "kg" ? "kg" : "unidad",
      precio,
      subtotal: precio === null ? null : precio * c.cantidad,
      costo: costo === null ? null : costo * c.cantidad,
      estimado: !fila && precio !== null,
    };
  });
  const total = precioDelCombo(combo, precioDe);
  return {
    n: combo.n,
    nombre: combo.nombre,
    detalle: combo.detalle,
    partes,
    total,
    totalBs: enBolivares(total, tasa, reglas.redondeo_bs),
    falta: faltanParaElCombo(combo, (nombre) => (porNombre.has(claveDeNombreDetal(nombre)) ? precioDe(nombre) : null)),
    costo: partes.every((p) => p.costo !== null) ? partes.reduce((s, p) => s + (p.costo ?? 0), 0) : null,
  };
});

// En la consola, lo mismo que en las hojas.
const dos = (n: number | null) => (n === null ? "—" : n.toFixed(2).replace(".", ","));
console.log(`Combos del ${diaDeLaSemana(dia)} ${fechaCorta(dia)} · tasa ${tasa ?? "sin tasa"}`);
for (const c of desglose) {
  console.log(`${String(c.n).padStart(2)}. ${c.nombre}: $${dos(c.total)}${c.totalBs !== null ? ` (Bs ${c.totalBs})` : ""} · cuesta $${dos(c.costo)} · deja $${dos(c.total !== null && c.costo !== null ? c.total - c.costo : null)}`);
  for (const p of c.partes) console.log(`      ${p.cuanto.padEnd(13)} ${p.nombre.padEnd(48)} $${dos(p.precio)}/${p.unidad} → $${dos(p.subtotal)}`);
  if (c.falta.length > 0) console.log(`      FALTA EN LA LISTA DEL DETAL: ${c.falta.join(", ")}`);
}

// Los datos de las hojas del desglose (con lo que cuesta y lo que deja: son para el dueño) y los precios del flier.
const datos = {
  fechaLarga: `${diaDeLaSemana(dia)} ${fechaCorta(dia)}`,
  tasa,
  combos: desglose,
};
fs.writeFileSync(path.join(carpetaPublicidad, "precios-combos-datos.js"), `// Lo escribe npm run combos. No va al repositorio.\nglobalThis.PRECIOS_COMBOS = ${JSON.stringify(datos, null, 1)};\n`);
fs.writeFileSync(
  path.join(carpetaPublicidad, "combos-precios.js"),
  `// Lo escribe npm run combos con la lista del detal del día. No va al repositorio.\nglobalThis.COMBOS_PRECIOS = ${JSON.stringify(
    { fechaCorta: fechaCorta(dia), tasa, precios: Object.fromEntries(desglose.filter((c) => c.total !== null).map((c) => [c.n, c.total])) },
    null,
    1,
  )};\n`,
);

const dibujo = spawnSync(process.execPath, [path.join(carpetaPublicidad, "generar.mjs"), "precios-combos", "estado-combos"], { stdio: "inherit" });
if (dibujo.status !== 0) throw new Error("No se pudieron dibujar las hojas de los precios.");
fs.mkdirSync(carpetaListas, { recursive: true });
for (const hoja of ["1", "2"]) {
  for (const extension of ["pdf", "jpg"]) {
    const origen = path.join(carpetaPublicidad, `precios-combos-${hoja}.${extension}`);
    const destino = path.join(carpetaListas, `precios-combos-${dia}-${hoja}.${extension}`);
    fs.renameSync(origen, destino);
    console.log(path.relative(raiz, destino));
  }
}
const flier = path.join(carpetaListas, `estado-combos-${dia}.jpg`);
fs.copyFileSync(path.join(carpetaPublicidad, "estado-combos.jpg"), flier);
console.log(path.relative(raiz, flier));
