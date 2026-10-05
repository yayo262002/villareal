/**
 * Un producto puede venderse en varias marcas o presentaciones (dos quesos
 * amarillos, dos bolsas de pecorino): sus variantes. Aquí se decide qué
 * precio publica el producto («desde» el más barato de ellas) y qué filas
 * lleva el formulario de venta. Cálculo puro, con pruebas.
 */

/** El precio al mayor en dólares, o null si todavía no está. */
export type Precios = { precio_usd: number | null };

export type VarianteDeCatalogo = Precios & { id: number; producto_id: number; nombre: string; activo: number };

export type ProductoDeCatalogo = Precios & { id: number; nombre: string; unidad: string; activo: number };

export type PrecioPublicado = Precios & {
  /** Si el precio es «desde»: hay varias variantes con precio y este es el más barato. */
  desde: boolean;
  /** Cuántas variantes activas tiene el producto. */
  variantes: number;
};

function menor(valores: (number | null)[]): number | null {
  const conPrecio = valores.filter((v): v is number => v !== null);
  return conPrecio.length > 0 ? Math.min(...conPrecio) : null;
}

/**
 * Lo que publica un producto: su propio precio si no tiene variantes
 * activas; si las tiene, el más barato de ellas, y «desde» cuando hay dos
 * o más con precio. Sin ninguna variante con precio, no hay precio: la web
 * dice «consulta el precio del día», no se inventa.
 */
export function precioPublicado(producto: Precios, variantes: VarianteDeCatalogo[]): PrecioPublicado {
  const activas = variantes.filter((v) => v.activo === 1);
  if (activas.length === 0) return { precio_usd: producto.precio_usd, desde: false, variantes: 0 };
  const conPrecio = activas.filter((v) => v.precio_usd !== null).length;
  return { precio_usd: menor(activas.map((v) => v.precio_usd)), desde: conPrecio >= 2, variantes: activas.length };
}

/** Una fila del formulario de venta: un producto sin variantes, o una variante concreta. */
export type Vendible = Precios & {
  /** Lo que identifica la fila en el formulario: «3» o «3-7». */
  clave: string;
  producto_id: number;
  variante_id: number | null;
  /** «Queso pecorino rallado Sortilegio 500 g». */
  nombre: string;
  unidad: string;
};

export function claveDe(productoId: number, varianteId: number | null): string {
  return varianteId ? `${productoId}-${varianteId}` : String(productoId);
}

/** «Queso amarillo Kemmental»: el nombre con el que una línea de venta dice su producto. */
export function nombreDeVenta(producto: string, variante: string | null | undefined): string {
  return variante ? `${producto} ${variante}` : producto;
}

/**
 * Las filas del formulario de venta, en el orden del panel: cada producto
 * activo sin variantes, y cada variante activa de los que las tienen.
 */
export function vendiblesDe(productos: ProductoDeCatalogo[], variantes: VarianteDeCatalogo[]): Vendible[] {
  const lista: Vendible[] = [];
  for (const p of productos) {
    if (p.activo !== 1) continue;
    const suyas = variantes.filter((v) => v.producto_id === p.id && v.activo === 1);
    if (suyas.length === 0) {
      lista.push({ clave: claveDe(p.id, null), producto_id: p.id, variante_id: null, nombre: p.nombre, unidad: p.unidad, precio_usd: p.precio_usd });
      continue;
    }
    for (const v of suyas) {
      lista.push({
        clave: claveDe(p.id, v.id),
        producto_id: p.id,
        variante_id: v.id,
        nombre: nombreDeVenta(p.nombre, v.nombre),
        unidad: p.unidad,
        precio_usd: v.precio_usd,
      });
    }
  }
  return lista;
}

// ---------- El estado de un producto, su presentación y las ofertas ----------

/** Un producto en borrador no está completo ni publicado; uno inactivo, escondido; uno activo, en la web. */
export type EstadoProducto = "borrador" | "activo" | "inactivo";

export const NOMBRE_ESTADO_PRODUCTO: Record<EstadoProducto, string> = { borrador: "Borrador", activo: "En la web", inactivo: "Oculto" };

export function estadoDeProducto(p: { activo: number; borrador: number }): EstadoProducto {
  return p.borrador ? "borrador" : p.activo ? "activo" : "inactivo";
}

export function esEstadoDeProducto(valor: string): valor is EstadoProducto {
  return valor === "borrador" || valor === "activo" || valor === "inactivo";
}

/** «Bolsa de 2,5 kg», «Caja», «2,5 kg» o nada: la presentación en una frase. */
export function presentacionDe(p: { presentacion: string; contenido: string }): string {
  const presentacion = p.presentacion.trim();
  const contenido = p.contenido.trim();
  if (presentacion && contenido) return `${presentacion} de ${contenido}`;
  return presentacion || contenido;
}

/**
 * Por qué se cobra: «kilo», «cartón», «bolsa de 2,5 kg», «unidad». Lo que
 * va por kilo se cobra por kilo aunque traiga presentación; lo demás, por
 * su presentación si la tiene.
 */
export function porQueSeCobra(p: { unidad: string; presentacion: string; contenido: string }): string {
  if (p.unidad === "kg") return "kilo";
  const presentacion = presentacionDe(p);
  if (presentacion) return presentacion.charAt(0).toLowerCase() + presentacion.slice(1);
  return p.unidad === "carton" ? "cartón" : "unidad";
}

/** Si una oferta está en la web hoy: activa y dentro de sus fechas (sin fecha, sin límite). */
export function estaVigente(o: { estado: string; desde: string | null; hasta: string | null }, hoy: string): boolean {
  return o.estado === "activa" && (!o.desde || o.desde <= hoy) && (!o.hasta || o.hasta >= hoy);
}
