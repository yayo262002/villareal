import "server-only";
import { ejecutar, fila, filas } from "./db";
import { listarProductos } from "./productos";
import { listarVariantes } from "./variantes";
import { claveDe, nombreDeVenta, vendiblesDe } from "./catalogo";
import { DIAS_RECIENTES, existenciasDe, type Existencia } from "./stock";
import { NOTAS_QUE_SE_MIRAN, pesoTipico, type PesoTipico } from "./piezas";
import { hace } from "./dinero";

/**
 * El inventario, desde la base: las sumas de compras, ventas y ajustes de
 * cada producto y marca, el peso por pieza aprendido de las notas y el
 * último costo de compra. El cálculo está en `stock.ts`.
 */

type Suma = { producto_id: number; variante_id: number | null; cantidad: number };

const claveDeFila = (f: { producto_id: number; variante_id: number | null }) => claveDe(f.producto_id, f.variante_id ?? null);

function aMapa(sumas: Suma[]): Map<string, number> {
  return new Map(sumas.map((s) => [claveDeFila(s), Number(s.cantidad)]));
}

/** Lo que pesa una pieza de cada producto, según las últimas notas que anotaron piezas y kilos. */
export async function pesosPorPieza(): Promise<Map<string, PesoTipico>> {
  const lineas = await filas<{ producto_id: number; variante_id: number | null; cantidad: number; piezas: number }>(
    "select producto_id, variante_id, cantidad, piezas from venta_lineas where piezas > 0 and cantidad > 0 order by id desc limit 600",
  );
  const porClave = new Map<string, number[]>();
  for (const l of lineas) {
    const clave = claveDeFila(l);
    const lista = porClave.get(clave) ?? [];
    if (lista.length < NOTAS_QUE_SE_MIRAN) lista.push(Number(l.cantidad) / Number(l.piezas));
    porClave.set(clave, lista);
  }
  const pesos = new Map<string, PesoTipico>();
  for (const [clave, lista] of porClave) {
    const tipico = pesoTipico(lista);
    if (tipico) pesos.set(clave, tipico);
  }
  return pesos;
}

export async function existencias(): Promise<Existencia[]> {
  const [productos, variantes, comprado, vendido, vendidoReciente, ajustes, costos, pesos] = await Promise.all([
    listarProductos(true),
    listarVariantes(),
    filas<Suma>(
      "select l.producto_id, l.variante_id, sum(l.cantidad) as cantidad from compra_lineas l join compras c on c.id = l.compra_id group by l.producto_id, l.variante_id",
    ),
    filas<Suma>("select producto_id, variante_id, sum(cantidad) as cantidad from venta_lineas group by producto_id, variante_id"),
    filas<Suma>(
      `select l.producto_id, l.variante_id, sum(l.cantidad) as cantidad
       from venta_lineas l join ventas v on v.id = l.venta_id
       where v.fecha >= ? group by l.producto_id, l.variante_id`,
      [hace(DIAS_RECIENTES - 1)],
    ),
    filas<Suma>("select producto_id, variante_id, sum(cantidad) as cantidad from inventario_ajustes group by producto_id, variante_id"),
    filas<{ producto_id: number; variante_id: number | null; costo_unitario_usd: number }>(
      "select l.producto_id, l.variante_id, l.costo_unitario_usd from compra_lineas l join compras c on c.id = l.compra_id order by c.fecha desc, l.id desc limit 200",
    ),
    pesosPorPieza(),
  ]);
  const ultimoCosto = new Map<string, number>();
  for (const c of costos) {
    const clave = claveDeFila(c);
    if (!ultimoCosto.has(clave)) ultimoCosto.set(clave, Number(c.costo_unitario_usd));
  }
  return existenciasDe(vendiblesDe(productos, variantes), aMapa(comprado), aMapa(vendido), aMapa(ajustes), aMapa(vendidoReciente), pesos, ultimoCosto);
}

export async function existenciasPorClave(): Promise<Map<string, Existencia>> {
  return new Map((await existencias()).map((e) => [e.clave, e]));
}

export type Ajuste = {
  id: number;
  fecha: string;
  producto_id: number;
  variante_id: number | null;
  /** Lo que suma (o resta, en negativo) a la existencia. */
  cantidad: number;
  motivo: string;
  creado_en: string;
  producto_nombre: string;
  unidad: string;
};

export async function registrarAjuste(datos: { fecha: string; producto_id: number; variante_id: number | null; cantidad: number; motivo: string }): Promise<number> {
  const r = await ejecutar("insert into inventario_ajustes (fecha, producto_id, variante_id, cantidad, motivo) values (?, ?, ?, ?, ?)", [
    datos.fecha,
    datos.producto_id,
    datos.variante_id,
    datos.cantidad,
    datos.motivo,
  ]);
  return r.ultimoId;
}

/** Los últimos recuentos y mermas, del más nuevo al más viejo. */
export async function listarAjustes(limite = 20): Promise<Ajuste[]> {
  const lista = await filas<Ajuste & { variante_nombre: string | null; nombre_producto: string }>(
    `select a.*, p.nombre as nombre_producto, p.unidad, vr.nombre as variante_nombre
     from inventario_ajustes a
     join productos p on p.id = a.producto_id
     left join variantes vr on vr.id = a.variante_id
     order by a.id desc limit ?`,
    [limite],
  );
  return lista.map((a) => ({ ...a, cantidad: Number(a.cantidad), producto_nombre: nombreDeVenta(a.nombre_producto, a.variante_nombre) }));
}

/** Lo que hay de un producto sin marcas, esté publicado o no: lo comprado menos lo vendido, más los ajustes. */
export async function existenciaSinMarca(productoId: number): Promise<number> {
  const f = await fila<{ n: number }>(
    `select
       (select coalesce(sum(l.cantidad), 0) from compra_lineas l join compras c on c.id = l.compra_id where l.producto_id = ? and l.variante_id is null)
       - (select coalesce(sum(cantidad), 0) from venta_lineas where producto_id = ? and variante_id is null)
       + (select coalesce(sum(cantidad), 0) from inventario_ajustes where producto_id = ? and variante_id is null) as n`,
    [productoId, productoId, productoId],
  );
  return Math.round(Number(f?.n ?? 0) * 1000) / 1000;
}
