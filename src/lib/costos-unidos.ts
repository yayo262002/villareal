import "server-only";
import { ejecutar, fila, filas } from "./db";
import { alicuotaIva } from "./ajustes";
import { costoEnDolares } from "./detal-calculo";
import { claveDe, nombreDeVenta } from "./catalogo";
import { precioDeVenta, redondear } from "./dinero";

/**
 * El mismo costo en el detal y en el mayor. La charcutería (la lista del
 * detal) y Villa Real (el catálogo) compran lo mismo al mismo proveedor:
 * un producto de la lista se une a su artículo del catálogo y, cada vez que
 * su costo cambia en la lista (una factura cargada, unos costos pegados, un
 * cambio a mano), el artículo de Villa Real toma ese costo, y su precio al
 * mayor se rehace con su margen. La lista del detal es donde se cargan las
 * facturas, así que manda ella: lo que se cambie a mano en el catálogo lo
 * pisa la siguiente compra.
 */

export type ArticuloDelMayor = {
  /** La clave del catálogo: «2» o «2-5» (el tipo y, si tiene marcas, su artículo). */
  clave: string;
  producto_id: number;
  variante_id: number | null;
  nombre: string;
  unidad: string;
  costo_usd: number | null;
};

/** Todo lo que se puede unir: cada tipo sin marcas y cada artículo de los que tienen, menos los combos del detal. */
export async function articulosDelMayor(): Promise<ArticuloDelMayor[]> {
  const [productos, variantes] = await Promise.all([
    filas<{ id: number; nombre: string; unidad: string; costo_usd: number | null }>("select id, nombre, unidad, costo_usd from productos where combo_detal is null order by nombre collate nocase"),
    filas<{ id: number; producto_id: number; nombre: string; costo_usd: number | null; activo: number }>("select id, producto_id, nombre, costo_usd, activo from variantes order by nombre collate nocase"),
  ]);
  const lista: ArticuloDelMayor[] = [];
  for (const p of productos) {
    const suyas = variantes.filter((v) => Number(v.producto_id) === Number(p.id));
    if (suyas.length === 0) {
      lista.push({ clave: claveDe(Number(p.id), null), producto_id: Number(p.id), variante_id: null, nombre: p.nombre, unidad: p.unidad, costo_usd: p.costo_usd ?? null });
      continue;
    }
    for (const v of suyas) {
      lista.push({
        clave: claveDe(Number(p.id), Number(v.id)),
        producto_id: Number(p.id),
        variante_id: Number(v.id),
        nombre: nombreDeVenta(p.nombre, v.nombre),
        unidad: p.unidad,
        costo_usd: v.costo_usd ?? null,
      });
    }
  }
  return lista;
}

/** El artículo del mayor unido a un producto del detal, si lo hay. */
export async function articuloUnidoA(detal: { producto_id: number | null; variante_id: number | null }): Promise<ArticuloDelMayor | null> {
  if (!detal.producto_id) return null;
  const clave = claveDe(Number(detal.producto_id), detal.variante_id ? Number(detal.variante_id) : null);
  return (await articulosDelMayor()).find((a) => a.clave === clave) ?? null;
}

/** Los productos del detal unidos a un tipo del catálogo (o a sus artículos), para decirlo en su ficha. */
export async function unidosEnElDetal(productoId: number): Promise<{ id: number; nombre: string }[]> {
  return (await filas<{ id: number; nombre: string }>("select id, nombre from lista_detal where producto_id = ? order by nombre collate nocase", [productoId])).map((f) => ({
    id: Number(f.id),
    nombre: f.nombre,
  }));
}

/** Une (o desune, con clave vacía) un producto del detal con su artículo de Villa Real, y le pone ya el mismo costo. */
export async function unirAlMayor(detalId: number, clave: string): Promise<{ articulo: ArticuloDelMayor | null; cambiados: string[] }> {
  if (!clave) {
    await ejecutar("update lista_detal set producto_id = null, variante_id = null where id = ?", [detalId]);
    return { articulo: null, cambiados: [] };
  }
  const articulo = (await articulosDelMayor()).find((a) => a.clave === clave) ?? null;
  if (!articulo) throw new Error("Ese artículo ya no está en el catálogo.");
  await ejecutar("update lista_detal set producto_id = ?, variante_id = ? where id = ?", [articulo.producto_id, articulo.variante_id, detalId]);
  return { articulo, cambiados: await igualarCostosDelMayor([detalId]) };
}

/**
 * Pone en Villa Real el costo de los productos del detal unidos (todos, o los que se digan) y rehace su precio al
 * mayor con su margen. Devuelve lo que cambió, dicho para el panel («Mozzarella: 7,60 $»).
 */
export async function igualarCostosDelMayor(soloIds?: number[]): Promise<string[]> {
  if (soloIds && soloIds.length === 0) return [];
  const filtro = soloIds ? ` and id in (${soloIds.map(() => "?").join(", ")})` : "";
  const unidos = await filas<{ id: number; nombre: string; costo_bs: number | null; costo_usd: number | null; iva: "general" | "exento"; tasa_compra: number | null; producto_id: number; variante_id: number | null }>(
    `select id, nombre, costo_bs, costo_usd, iva, tasa_compra, producto_id, variante_id from lista_detal where producto_id is not null${filtro}`,
    soloIds ?? [],
  );
  if (unidos.length === 0) return [];
  const ivaPct = await alicuotaIva();
  const cambiados: string[] = [];
  for (const d of unidos) {
    const calculado = costoEnDolares(d, ivaPct);
    if (calculado === null) continue;
    const costo = Math.round(calculado * 10000) / 10000;
    const producto = await fila<{ nombre: string; costo_usd: number | null; margen_pct: number | null; precio_usd: number | null }>(
      "select nombre, costo_usd, margen_pct, precio_usd from productos where id = ?",
      [d.producto_id],
    );
    if (!producto) continue;
    if (d.variante_id) {
      const variante = await fila<{ nombre: string; costo_usd: number | null; precio_usd: number | null }>("select nombre, costo_usd, precio_usd from variantes where id = ? and producto_id = ?", [
        d.variante_id,
        d.producto_id,
      ]);
      if (!variante || variante.costo_usd === costo) continue;
      const precio = precioDeVenta(costo, producto.margen_pct) ?? variante.precio_usd;
      await ejecutar("update variantes set costo_usd = ?, precio_usd = ? where id = ?", [costo, precio, d.variante_id]);
      cambiados.push(`${nombreDeVenta(producto.nombre, variante.nombre)}: ${redondear(costo).toLocaleString("es-VE", { minimumFractionDigits: 2 })} $`);
    } else {
      if (producto.costo_usd === costo) continue;
      const precio = precioDeVenta(costo, producto.margen_pct) ?? producto.precio_usd;
      await ejecutar("update productos set costo_usd = ?, precio_usd = ? where id = ?", [costo, precio, d.producto_id]);
      cambiados.push(`${producto.nombre}: ${redondear(costo).toLocaleString("es-VE", { minimumFractionDigits: 2 })} $`);
    }
  }
  return cambiados;
}
