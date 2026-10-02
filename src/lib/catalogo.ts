/**
 * Un producto puede venderse en varias marcas o presentaciones (dos quesos
 * amarillos, dos bolsas de pecorino): sus variantes. Aquí se decide qué
 * precio publica el producto («desde» el más barato de ellas) y qué filas
 * lleva el formulario de venta. Cálculo puro, con pruebas.
 */

export type Precios = { precio_usd: number | null; precio_mayor_usd: number | null };

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
 * Lo que publica un producto: sus propios precios si no tiene variantes
 * activas; si las tiene, el más barato de cada precio, y «desde» cuando
 * hay dos o más con precio. Sin ninguna variante con precio, no hay
 * precio: la web dice «consulta el precio del día», no se inventa.
 */
export function precioPublicado(producto: Precios, variantes: VarianteDeCatalogo[]): PrecioPublicado {
  const activas = variantes.filter((v) => v.activo === 1);
  if (activas.length === 0) {
    return { precio_usd: producto.precio_usd, precio_mayor_usd: producto.precio_mayor_usd, desde: false, variantes: 0 };
  }
  const conPrecio = activas.filter((v) => v.precio_usd !== null || v.precio_mayor_usd !== null).length;
  return {
    precio_usd: menor(activas.map((v) => v.precio_usd)),
    precio_mayor_usd: menor(activas.map((v) => v.precio_mayor_usd)),
    desde: conPrecio >= 2,
    variantes: activas.length,
  };
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
      lista.push({ clave: claveDe(p.id, null), producto_id: p.id, variante_id: null, nombre: p.nombre, unidad: p.unidad, precio_usd: p.precio_usd, precio_mayor_usd: p.precio_mayor_usd });
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
        precio_mayor_usd: v.precio_mayor_usd,
      });
    }
  }
  return lista;
}
