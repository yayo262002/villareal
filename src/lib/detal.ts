import "server-only";
import { ejecutar, fila, filas, transaccion } from "./db";
import { textoCoincide } from "./buscar";
import { hoy } from "./dinero";
import type { TipoIva } from "./factura-calculo";
import {
  CATEGORIAS_DETAL,
  costoEnDolares,
  enBolivares,
  precioDetalUsd,
  precioMayorUsd,
  type CategoriaDetal,
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
  iva: TipoIva;
  tasa_compra: number | null;
  margen_pct: number | null;
  precio_usd: number | null;
  precio_mayor_usd: number | null;
  proveedor: string;
  fecha_compra: string | null;
  activo: number;
  actualizado_en: string;
};

/** Un producto con sus precios de hoy, calculados. */
export type ArticuloConPrecio = ArticuloDetal & {
  costo_usd: number | null;
  detal_usd: number | null;
  detal_bs: number | null;
  mayor_usd: number | null;
  mayor_bs: number | null;
};

export type DatosArticuloDetal = Omit<ArticuloDetal, "id" | "activo" | "actualizado_en">;

const COLUMNAS = `id, nombre, categoria, unidad, costo_bs, iva, tasa_compra, margen_pct, precio_usd, precio_mayor_usd, proveedor, fecha_compra, activo, actualizado_en`;

/** Le pone a cada producto su precio de hoy. */
export function conPrecios(articulos: ArticuloDetal[], reglas: ReglasDelDetal, tasaDeHoy: number | null): ArticuloConPrecio[] {
  return articulos.map((a) => {
    const detal = precioDetalUsd(a, reglas);
    const mayor = precioMayorUsd(a, reglas);
    return {
      ...a,
      costo_usd: costoEnDolares(a, reglas.iva_pct),
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
  return todos
    .filter((a) => textoCoincide([a.nombre, CATEGORIAS_DETAL[a.categoria] ?? "", a.proveedor], busqueda))
    .sort((a, b) => orden.indexOf(a.categoria) - orden.indexOf(b.categoria));
}

export async function buscarArticuloDetal(id: number): Promise<ArticuloDetal | null> {
  return fila<ArticuloDetal>(`select ${COLUMNAS} from lista_detal where id = ?`, [id]);
}

export async function buscarArticuloDetalPorNombre(nombre: string): Promise<ArticuloDetal | null> {
  return fila<ArticuloDetal>(`select ${COLUMNAS} from lista_detal where nombre = ? collate nocase`, [nombre]);
}

function valores(d: DatosArticuloDetal) {
  return [d.nombre, d.categoria, d.unidad, d.costo_bs, d.iva, d.tasa_compra, d.margen_pct, d.precio_usd, d.precio_mayor_usd, d.proveedor, d.fecha_compra];
}

export async function crearArticuloDetal(d: DatosArticuloDetal): Promise<number> {
  const { ultimoId } = await ejecutar(
    `insert into lista_detal (nombre, categoria, unidad, costo_bs, iva, tasa_compra, margen_pct, precio_usd, precio_mayor_usd, proveedor, fecha_compra)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    valores(d),
  );
  return ultimoId;
}

export async function actualizarArticuloDetal(id: number, d: DatosArticuloDetal): Promise<void> {
  await ejecutar(
    `update lista_detal set nombre = ?, categoria = ?, unidad = ?, costo_bs = ?, iva = ?, tasa_compra = ?, margen_pct = ?, precio_usd = ?, precio_mayor_usd = ?,
       proveedor = ?, fecha_compra = ?, actualizado_en = datetime('now') where id = ?`,
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

/**
 * Carga las líneas de una factura de compra: lo que ya está en la lista
 * (por el nombre, sin mirar mayúsculas) toma el costo, el IVA y la tasa
 * nuevos y vuelve a verse; lo nuevo entra en la categoría elegida. El
 * margen propio, el precio a mano y la categoría de lo que ya estaba no se
 * tocan.
 */
export async function cargarFacturaDetal(datos: {
  lineas: LineaDeFactura[];
  categoria: CategoriaDetal;
  tasa: number;
  proveedor: string;
  fecha: string | null;
}): Promise<{ nuevos: number; actualizados: number }> {
  const fecha = datos.fecha ?? hoy();
  return transaccion(async (tx) => {
    let nuevos = 0;
    let actualizados = 0;
    // La misma línea dos veces en la factura: vale la última.
    const porNombre = new Map(datos.lineas.map((l) => [l.nombre.toLowerCase(), l]));
    for (const l of porNombre.values()) {
      const r = await tx.execute({ sql: "select id from lista_detal where nombre = ? collate nocase", args: [l.nombre] });
      const id = r.rows[0]?.id;
      if (id !== undefined && id !== null) {
        await tx.execute({
          sql: `update lista_detal set costo_bs = ?, iva = ?, tasa_compra = ?, proveedor = ?, fecha_compra = ?, activo = 1, actualizado_en = datetime('now') where id = ?`,
          args: [l.costo_bs, l.iva, datos.tasa, datos.proveedor, fecha, Number(id)],
        });
        actualizados++;
      } else {
        await tx.execute({
          sql: `insert into lista_detal (nombre, categoria, unidad, costo_bs, iva, tasa_compra, proveedor, fecha_compra) values (?, ?, 'unidad', ?, ?, ?, ?, ?)`,
          args: [l.nombre, datos.categoria, l.costo_bs, l.iva, datos.tasa, datos.proveedor, fecha],
        });
        nuevos++;
      }
    }
    return { nuevos, actualizados };
  });
}

export async function contarArticulosDetal(): Promise<number> {
  return (await fila<{ n: number }>("select count(*) as n from lista_detal"))?.n ?? 0;
}
