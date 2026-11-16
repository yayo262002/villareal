import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { crearClienteDesdeEntorno } from "../src/lib/conexion.ts";
import { CLAVES_REGLAS_DETAL, costoEnDolares, enBolivares, precioDetalUsd, reglasDesdeAjustes, type ArticuloParaPrecio } from "../src/lib/detal-calculo.ts";
import { COMBOS_DEL_DETAL, COSTOS_ESTIMADOS, claveDeNombreDetal, desgloseDelCombo } from "../src/lib/combos-detal.ts";
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
 *   volante-combos-AAAA-MM-DD.pdf, .jpg     el volante de media carta para los clientes, con los precios de hoy
 *   volante-combos-AAAA-MM-DD-2-por-hoja.pdf  el mismo, dos en una hoja carta, para imprimir y cortar
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
// Lo que no está en la lista toma su precio estimado (el queso paisa, `COSTOS_ESTIMADOS`): las hojas y el flier lo dicen;
// la caja, no (allí se escribe a mano hasta que se cargue).
const enLaLista = (nombre: string) => {
  const fila = porNombre.get(claveDeNombreDetal(nombre));
  return fila ? { unidad: fila.unidad, precio: precioDetalUsd(fila, reglas) } : null;
};

const dia = hoy();
// La misma cuenta que la pestaña «Combos» de la lista de la familia y que la caja, más lo que cuesta cada parte.
const desglose = COMBOS_DEL_DETAL.map((combo) => {
  const cuenta = desgloseDelCombo(combo, enLaLista, reglas.charcuteria_divisor);
  const partes = cuenta.partes.map((p, i) => {
    const fila = porNombre.get(claveDeNombreDetal(p.nombre));
    const costo = fila ? costoEnDolares(fila, iva) : (COSTOS_ESTIMADOS[claveDeNombreDetal(p.nombre)] ?? null);
    return {
      cuanto: p.cuanto,
      nombre: p.nombre,
      unidad: p.porKilo ? "kg" : "unidad",
      precio: p.precio,
      subtotal: p.importe,
      costo: costo === null ? null : costo * combo.componentes[i].cantidad,
      estimado: p.estimado,
    };
  });
  return {
    n: combo.n,
    nombre: combo.nombre,
    // Lo que lleva varía (los recortes): el precio se escribe a mano.
    aMano: Boolean(combo.precioAMano),
    detalle: combo.detalle,
    partes,
    total: cuenta.total,
    totalBs: enBolivares(cuenta.total, tasa, reglas.redondeo_bs),
    falta: partes.filter((p) => p.precio === null || p.estimado).map((p) => p.nombre),
    costo: partes.length > 0 && partes.every((p) => p.costo !== null) ? partes.reduce((s, p) => s + (p.costo ?? 0), 0) : null,
  };
});

// En la consola, lo mismo que en las hojas.
const dos = (n: number | null) => (n === null ? "—" : n.toFixed(2).replace(".", ","));
console.log(`Combos del ${diaDeLaSemana(dia)} ${fechaCorta(dia)} · tasa ${tasa ?? "sin tasa"}`);
for (const c of desglose) {
  console.log(`${String(c.n).padStart(2)}. ${c.nombre}: $${dos(c.total)}${c.totalBs !== null ? ` (Bs ${c.totalBs})` : ""} · cuesta $${dos(c.costo)} · deja $${dos(c.total !== null && c.costo !== null ? c.total - c.costo : null)}`);
  for (const p of c.partes) console.log(`      ${p.cuanto.padEnd(13)} ${p.nombre.padEnd(48)} $${dos(p.precio)}/${p.unidad} → $${dos(p.subtotal)}`);
  if (c.falta.length > 0) console.log(`      FALTA EN LA LISTA DEL DETAL: ${c.falta.join(", ")}`);
  if (c.aMano) console.log("      Lo que lleva varía: el precio se escribe a mano.");
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
// El volante con los precios de hoy; el que va sin precios no cambia y no se toca.
const volante = spawnSync(process.execPath, [path.join(carpetaPublicidad, "generar.mjs"), "volante-combos"], {
  stdio: "inherit",
  env: { ...process.env, SOLO: "volante-combos-precios,volante-combos-precios-2-por-hoja" },
});
if (volante.status !== 0) throw new Error("No se pudo dibujar el volante con los precios.");
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
for (const [origen, destino] of [
  ["volante-combos-precios.pdf", `volante-combos-${dia}.pdf`],
  ["volante-combos-precios.jpg", `volante-combos-${dia}.jpg`],
  ["volante-combos-precios-2-por-hoja.pdf", `volante-combos-${dia}-2-por-hoja.pdf`],
]) {
  fs.copyFileSync(path.join(carpetaPublicidad, origen), path.join(carpetaListas, destino));
  console.log(path.relative(raiz, path.join(carpetaListas, destino)));
}
