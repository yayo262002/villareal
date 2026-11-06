import "server-only";
import { ejecutar, fila, filas, transaccion } from "./db";
import { textoCoincide } from "./buscar";
import { hoy } from "./dinero";
import type { TipoIva } from "./factura-calculo";
import {
  CATEGORIAS_DETAL,
  costoEnDolares,
  decidirCarga,
  enBolivares,
  precioDetalUsd,
  precioMayorUsd,
  variacionPct,
  type CategoriaDetal,
  type LineaDeCostos,
  type LineaDeFactura,
  type ReglasDelDetal,
  type UnidadDetal,
} from "./detal-calculo";

/**
 * La lista de precios del detal, desde la base: los productos de la
 * charcutería con su costo o su precio, y lo que vale cada uno hoy. Las
 * cuentas están en `detal-calculo.ts`.
 */

export type ArticuloDetal = {
  id: number;
  nombre: string;
  categoria: CategoriaDetal;
  unidad: UnidadDetal;
  costo_bs: number | null;
  costo_usd: number | null;
  iva: TipoIva;
  tasa_compra: number | null;
  margen_pct: number | null;
  precio_usd: number | null;
  precio_mayor_usd: number | null;
  proveedor: string;
  fecha_compra: string | null;
  costo_usd_anterior: number | null;
  fecha_compra_anterior: string | null;
  activo: number;
  actualizado_en: string;
};

/** Un producto con sus precios de hoy, calculados. */
export type ArticuloConPrecio = ArticuloDetal & {
  /** Lo que costó, en dólares y con su IVA (de la factura a su tasa, o el costo en dólares). */
  costo_en_dolares: number | null;
  /** Cuánto cambió el costo desde la compra anterior, en %. */
  variacion_pct: number | null;
  detal_usd: number | null;
  detal_bs: number | null;
  mayor_usd: number | null;
  mayor_bs: number | null;
};

export type DatosArticuloDetal = Omit<ArticuloDetal, "id" | "activo" | "actualizado_en" | "costo_usd_anterior" | "fecha_compra_anterior">;

const COLUMNAS = `id, nombre, categoria, unidad, costo_bs, costo_usd, iva, tasa_compra, margen_pct, precio_usd, precio_mayor_usd, proveedor, fecha_compra,
  costo_usd_anterior, fecha_compra_anterior, activo, actualizado_en`;

/** Le pone a cada producto su precio de hoy. */
export function conPrecios(articulos: ArticuloDetal[], reglas: ReglasDelDetal, tasaDeHoy: number | null): ArticuloConPrecio[] {
  return articulos.map((a) => {
    const detal = precioDetalUsd(a, reglas);
    const mayor = precioMayorUsd(a, reglas);
    const costo = costoEnDolares(a, reglas.iva_pct);
    return {
      ...a,
      costo_en_dolares: costo,
      variacion_pct: variacionPct(costo, a.costo_usd_anterior),
      detal_usd: detal,
      detal_bs: enBolivares(detal, tasaDeHoy, reglas.redondeo_bs),
      mayor_usd: mayor,
      mayor_bs: enBolivares(mayor, tasaDeHoy, reglas.redondeo_bs),
    };
  });
}

/** Los productos de la lista, por categoría y por nombre; con `busqueda`, solo los que responden (sin tildes ni mayúsculas). */
export async function listarArticulosDetal(busqueda = "", soloActivos = false): Promise<ArticuloDetal[]> {
  const todos = await filas<ArticuloDetal>(`select ${COLUMNAS} from lista_detal ${soloActivos ? "where activo = 1" : ""} order by nombre collate nocase`);
  const orden = Object.keys(CATEGORIAS_DETAL);
  const lugar = (c: string) => (orden.includes(c) ? orden.indexOf(c) : orden.indexOf("viveres"));
  return todos
    .filter((a) => textoCoincide([a.nombre, CATEGORIAS_DETAL[a.categoria] ?? "", a.proveedor], busqueda))
    .sort((a, b) => lugar(a.categoria) - lugar(b.categoria));
}

export async function buscarArticuloDetal(id: number): Promise<ArticuloDetal | null> {
  return fila<ArticuloDetal>(`select ${COLUMNAS} from lista_detal where id = ?`, [id]);
}

export async function buscarArticuloDetalPorNombre(nombre: string): Promise<ArticuloDetal | null> {
  return fila<ArticuloDetal>(`select ${COLUMNAS} from lista_detal where nombre = ? collate nocase`, [nombre]);
}

function valores(d: DatosArticuloDetal) {
  return [d.nombre, d.categoria, d.unidad, d.costo_bs, d.costo_usd, d.iva, d.tasa_compra, d.margen_pct, d.precio_usd, d.precio_mayor_usd, d.proveedor, d.fecha_compra];
}

export async function crearArticuloDetal(d: DatosArticuloDetal): Promise<number> {
  const { ultimoId } = await ejecutar(
    `insert into lista_detal (nombre, categoria, unidad, costo_bs, costo_usd, iva, tasa_compra, margen_pct, precio_usd, precio_mayor_usd, proveedor, fecha_compra)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    valores(d),
  );
  return ultimoId;
}

export async function actualizarArticuloDetal(id: number, d: DatosArticuloDetal): Promise<void> {
  await ejecutar(
    `update lista_detal set nombre = ?, categoria = ?, unidad = ?, costo_bs = ?, costo_usd = ?, iva = ?, tasa_compra = ?, margen_pct = ?, precio_usd = ?,
       precio_mayor_usd = ?, proveedor = ?, fecha_compra = ?, actualizado_en = datetime('now') where id = ?`,
    [...valores(d), id],
  );
}

/** Esconde un producto de la lista (o lo vuelve a enseñar) sin perder su costo. */
export async function cambiarActivoDetal(id: number, activo: boolean): Promise<void> {
  await ejecutar("update lista_detal set activo = ?, actualizado_en = datetime('now') where id = ?", [activo ? 1 : 0, id]);
}

export async function quitarArticuloDetal(id: number): Promise<void> {
  await ejecutar("delete from lista_detal where id = ?", [id]);
}

/** Lo que dejó la carga de una factura. */
export type ResultadoDeCarga = {
  /** Productos que no estaban. */
  nuevos: number;
  /** Productos que toman el costo de esta factura (la más nueva). */
  actualizados: number;
  /** Productos con una compra más nueva: el costo de esta factura queda como el anterior, de referencia. */
  anteriores: number;
  /** Productos con dos compras más nuevas que esta: no cambian. */
  sinCambio: number;
};

type Guardado = {
  id: number;
  costo_bs: number | null;
  costo_usd: number | null;
  iva: TipoIva;
  tasa_compra: number | null;
  fecha_compra: string | null;
  costo_usd_anterior: number | null;
  fecha_compra_anterior: string | null;
};

/** Una línea de compra: de una factura en bolívares (sin IVA, a la tasa de la compra) o un costo en dólares. `unidad` null: la del formulario. */
export type LineaDeCompra = { nombre: string; iva: TipoIva; unidad: UnidadDetal | null } & ({ costo_bs: number; costo_usd: null } | { costo_bs: null; costo_usd: number });

/** Las líneas de una factura en bolívares, para cargarlas. */
export function lineasDeFactura(lineas: LineaDeFactura[]): LineaDeCompra[] {
  return lineas.map((l) => ({ nombre: l.nombre, iva: l.iva, unidad: null, costo_bs: l.costo_bs, costo_usd: null }));
}

/** Las líneas de una lista de costos en dólares, para cargarlas. */
export function lineasDeCostos(lineas: LineaDeCostos[]): LineaDeCompra[] {
  return lineas.map((l) => ({ nombre: l.nombre, iva: l.iva, unidad: l.unidad, costo_bs: null, costo_usd: l.costo_usd }));
}

/**
 * Carga las líneas de una compra: una factura en bolívares (con la tasa de
 * su día) o una lista de costos en dólares (la charcutería). Lo que no está
 * en la lista (por el nombre, sin mirar mayúsculas) entra en la categoría y
 * la unidad elegidas. Lo que ya está se queda con el costo de la compra más
 * nueva y guarda el de la anterior (`decidirCarga`): una compra vieja
 * cargada tarde no pisa una más nueva. El margen propio, el precio a mano y
 * la categoría de lo que ya estaba no se tocan; la unidad, solo si la línea
 * la dice.
 */
export async function cargarCompraDetal(datos: {
  lineas: LineaDeCompra[];
  categoria: CategoriaDetal;
  unidad: UnidadDetal;
  /** La tasa del día de la compra, para lo que viene en bolívares. */
  tasa: number | null;
  proveedor: string;
  fecha: string | null;
  iva_pct: number;
}): Promise<ResultadoDeCarga> {
  const fecha = datos.fecha ?? hoy();
  if (datos.tasa === null && datos.lineas.some((l) => l.costo_bs !== null)) throw new Error("Falta la tasa de la compra para lo que viene en bolívares.");
  return transaccion(async (tx) => {
    const resultado: ResultadoDeCarga = { nuevos: 0, actualizados: 0, anteriores: 0, sinCambio: 0 };
    // La misma línea dos veces en la compra: vale la última.
    const porNombre = new Map(datos.lineas.map((l) => [l.nombre.toLowerCase(), l]));
    for (const l of porNombre.values()) {
      const tasa = l.costo_bs !== null ? datos.tasa : null;
      const r = await tx.execute({
        sql: "select id, costo_bs, costo_usd, iva, tasa_compra, fecha_compra, costo_usd_anterior, fecha_compra_anterior from lista_detal where nombre = ? collate nocase",
        args: [l.nombre],
      });
      const g = r.rows[0] as unknown as Guardado | undefined;
      if (!g) {
        await tx.execute({
          sql: `insert into lista_detal (nombre, categoria, unidad, costo_bs, costo_usd, iva, tasa_compra, proveedor, fecha_compra) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [l.nombre, datos.categoria, l.unidad ?? datos.unidad, l.costo_bs, l.costo_usd, l.iva, tasa, datos.proveedor, fecha],
        });
        resultado.nuevos++;
        continue;
      }
      const decision = decidirCarga(g, fecha);
      if (decision === "actual" || decision === "mismo_dia") {
        // La que había pasa a ser la anterior, salvo que sea del mismo día (se corrige) o no tuviera costo.
        const teniaCosto = g.costo_bs !== null || g.costo_usd !== null;
        const anteriorUsd = decision === "actual" ? (costoEnDolares(g, datos.iva_pct) ?? g.costo_usd_anterior) : g.costo_usd_anterior;
        const anteriorFecha = decision === "actual" ? (teniaCosto ? g.fecha_compra : g.fecha_compra_anterior) : g.fecha_compra_anterior;
        await tx.execute({
          sql: `update lista_detal set costo_bs = ?, costo_usd = ?, iva = ?, tasa_compra = ?, unidad = coalesce(?, unidad), proveedor = ?, fecha_compra = ?,
                  costo_usd_anterior = ?, fecha_compra_anterior = ?, activo = 1, actualizado_en = datetime('now') where id = ?`,
          args: [l.costo_bs, l.costo_usd, l.iva, tasa, l.unidad, datos.proveedor, fecha, anteriorUsd, anteriorFecha, Number(g.id)],
        });
        resultado.actualizados++;
      } else if (decision === "anterior") {
        await tx.execute({
          sql: "update lista_detal set costo_usd_anterior = ?, fecha_compra_anterior = ?, actualizado_en = datetime('now') where id = ?",
          args: [costoEnDolares({ costo_bs: l.costo_bs, costo_usd: l.costo_usd, iva: l.iva, tasa_compra: tasa }, datos.iva_pct), fecha, Number(g.id)],
        });
        resultado.anteriores++;
      } else {
        resultado.sinCambio++;
      }
    }
    return resultado;
  });
}

export async function contarArticulosDetal(): Promise<number> {
  return (await fila<{ n: number }>("select count(*) as n from lista_detal"))?.n ?? 0;
}
