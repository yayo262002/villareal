import { aBolivares, bs, redondear, usd } from "./dinero.ts";

/**
 * El carrito de la web: lo que el cliente va eligiendo para pedirlo por
 * WhatsApp. En el teléfono solo se guarda qué y cuánto (`LineaDelCarrito`);
 * los nombres y los precios se piden a la web cada vez, así nunca se pide
 * con un precio viejo. Enviarlo abre WhatsApp con el pedido escrito: no
 * registra nada en el negocio, y la web lo dice. Cálculo puro, con pruebas.
 */

/** Lo que guarda el teléfono: la clave del producto («3»; con marca, «1-7»; un combo, «o2») y cuánto. */
export type LineaDelCarrito = { clave: string; cantidad: number };

/** Lo que dice la web de cada producto del carrito, al día. */
export type ProductoDelCarrito = {
  clave: string;
  /** «Queso amarillo Kemmental». */
  nombre: string;
  /** «kilo», «cartón», «bolsa de 2,5 kg», «combo». */
  porQue: string;
  /** «kg», «unidad», «carton», «combo»: decide si se piden decimales. */
  unidad: string;
  /** El precio al mayor en dólares; null: «precio por confirmar». */
  precio_usd: number | null;
  ruta: string;
  foto: string | null;
};

export const CLAVE_DEL_CARRITO = "villareal-carrito";
/** Lo más que se deja pedir de una vez por la web: más que eso, mejor hablarlo. */
export const CANTIDAD_MAXIMA = 999;

export const CLAVE_VALIDA = /^(\d{1,9}(-\d{1,9})?|o\d{1,9})$/;

/** La clave de un combo en el carrito: «o2». */
export function claveDeOferta(id: number): string {
  return `o${id}`;
}

/** Lo que se puede pedir de algo que va por kilo: de medio en medio; lo demás, de uno en uno. */
export function pasoDe(unidad: string): number {
  return unidad === "kg" ? 0.5 : 1;
}

/** Deja una cantidad en algo que se pueda pedir: positiva, en su paso y sin pasarse. 0 es quitarlo. */
export function cantidadValida(cantidad: number, unidad: string): number {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return 0;
  const paso = pasoDe(unidad);
  const redondeada = Math.round(cantidad / paso) * paso;
  return Math.min(CANTIDAD_MAXIMA, Math.max(paso, Math.round(redondeada * 1000) / 1000));
}

/** Lee lo guardado en el teléfono sin fiarse: lo que no tenga forma de línea se descarta. */
export function leerCarrito(texto: string | null): LineaDelCarrito[] {
  if (!texto) return [];
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return [];
  }
  if (!Array.isArray(datos)) return [];
  const lineas: LineaDelCarrito[] = [];
  for (const d of datos) {
    if (!d || typeof d !== "object") continue;
    const { clave, cantidad } = d as Record<string, unknown>;
    if (typeof clave !== "string" || !CLAVE_VALIDA.test(clave) || typeof cantidad !== "number" || !(cantidad > 0) || cantidad > CANTIDAD_MAXIMA) continue;
    if (!lineas.some((l) => l.clave === clave)) lineas.push({ clave, cantidad });
  }
  return lineas.slice(0, 100);
}

/** Suma a lo que ya había de ese producto, o lo añade al final. */
export function agregarAlCarrito(lineas: LineaDelCarrito[], clave: string, cantidad: number, unidad: string): LineaDelCarrito[] {
  const actual = lineas.find((l) => l.clave === clave)?.cantidad ?? 0;
  return ponerCantidad(lineas, clave, actual + cantidad, unidad);
}

/** Pone la cantidad de un producto; con 0, lo quita. */
export function ponerCantidad(lineas: LineaDelCarrito[], clave: string, cantidad: number, unidad: string): LineaDelCarrito[] {
  const valida = cantidadValida(cantidad, unidad);
  if (valida === 0) return lineas.filter((l) => l.clave !== clave);
  return lineas.some((l) => l.clave === clave) ? lineas.map((l) => (l.clave === clave ? { clave, cantidad: valida } : l)) : [...lineas, { clave, cantidad: valida }];
}

export type LineaConPrecio = LineaDelCarrito & { producto: ProductoDelCarrito | null; subtotal_usd: number | null };

export type Totales = {
  lineas: LineaConPrecio[];
  /** Lo que suman las líneas con precio. */
  total_usd: number;
  total_bs: number | null;
  /** Cuántas no tienen precio todavía: el total no las cuenta. */
  sinPrecio: number;
  /** Cuántas ya no están en la web: no entran en el pedido. */
  noDisponibles: number;
};

export function totalesDelCarrito(lineas: LineaDelCarrito[], productos: ProductoDelCarrito[], tasa: number | null): Totales {
  const deCadaUno = new Map(productos.map((p) => [p.clave, p]));
  const conPrecio: LineaConPrecio[] = lineas.map((l) => {
    const producto = deCadaUno.get(l.clave) ?? null;
    const subtotal = producto && producto.precio_usd !== null ? redondear(producto.precio_usd * l.cantidad) : null;
    return { ...l, producto, subtotal_usd: subtotal };
  });
  const total = redondear(conPrecio.reduce((s, l) => s + (l.subtotal_usd ?? 0), 0));
  return {
    lineas: conPrecio,
    total_usd: total,
    total_bs: total > 0 ? aBolivares(total, tasa) : null,
    sinPrecio: conPrecio.filter((l) => l.producto && l.producto.precio_usd === null).length,
    noDisponibles: conPrecio.filter((l) => !l.producto).length,
  };
}

function numero(n: number): string {
  return new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 }).format(n);
}

/** «2 kilos», «1 cartón», «3 × bolsa de 2,5 kg», «2 combos». */
export function cuantoDe(cantidad: number, producto: Pick<ProductoDelCarrito, "porQue" | "unidad">): string {
  if (producto.unidad === "kg") return `${numero(cantidad)} ${cantidad === 1 ? "kilo" : "kilos"}`;
  if (producto.unidad === "combo") return `${numero(cantidad)} ${cantidad === 1 ? "combo" : "combos"}`;
  if (producto.porQue === "cartón") return `${numero(cantidad)} ${cantidad === 1 ? "cartón" : "cartones"}`;
  if (producto.porQue === "unidad") return `${numero(cantidad)} ${cantidad === 1 ? "unidad" : "unidades"}`;
  return `${numero(cantidad)} × ${producto.porQue}`;
}

/**
 * Cómo recibe el pedido: lo busca en la tienda, o se lo llevan (delivery) a su dirección, con su ubicación en el mapa
 * si la dio, a cuántos kilómetros está y lo que cuesta (null: por confirmar; 0: gratis).
 */
export type Entrega =
  | { forma: "tienda" }
  | { forma: "delivery"; direccion: string; enlace: string | null; km: number | null; enZona: boolean; precio_usd: number | null };

function km(n: number): string {
  return `${new Intl.NumberFormat("es-VE", { maximumFractionDigits: 1 }).format(n)} km`;
}

/** Las líneas de la entrega en el pedido: cómo, a dónde y cuánto. */
function lineasDeEntrega(entrega: Entrega): string[] {
  if (entrega.forma === "tienda") return ["Entrega: lo busco en la tienda."];
  const lineas = [`Entrega: delivery${entrega.direccion.trim() ? ` a ${entrega.direccion.trim()}` : ""}.`];
  if (entrega.enlace) lineas.push(`Mi ubicación: ${entrega.enlace}`);
  const distancia = entrega.km !== null ? ` (a ${km(entrega.km)} de la tienda)` : "";
  if (!entrega.enZona && entrega.km !== null) lineas.push(`Estoy fuera de Barquisimeto y Cabudare${distancia}: ¿me confirman si llegan y cuánto cuesta?`);
  else if (entrega.precio_usd === 0) lineas.push(`Delivery: gratis${distancia}.`);
  else if (entrega.precio_usd !== null) lineas.push(`Delivery: ${usd(entrega.precio_usd)}${distancia}.`);
  else lineas.push(`Delivery: por confirmar${distancia}.`);
  return lineas;
}

/**
 * El mensaje del pedido para WhatsApp: cada producto con cuánto y su
 * precio, el total estimado (en dólares y, con tasa, en bolívares), cómo
 * lo recibe (con el delivery, si ya tiene precio, en el total) y quién
 * pide, si lo dijo. Los que no tienen precio van «por confirmar».
 */
export function mensajeDePedido(datos: {
  negocio: string;
  totales: Totales;
  tasa: number | null;
  nombre?: string;
  negocioDelCliente?: string;
  nota?: string;
  entrega?: Entrega;
}): string {
  const { totales, entrega } = datos;
  const lineas = [`Hola ${datos.negocio}, quiero hacer este pedido:`];
  for (const l of totales.lineas) {
    if (!l.producto) continue;
    const cuanto = cuantoDe(l.cantidad, l.producto);
    lineas.push(
      l.subtotal_usd !== null && l.producto.precio_usd !== null
        ? `• ${cuanto} de ${l.producto.nombre}: ${usd(l.producto.precio_usd)} por ${l.producto.porQue} = ${usd(l.subtotal_usd)}`
        : `• ${cuanto} de ${l.producto.nombre} (precio por confirmar)`,
    );
  }
  if (totales.total_usd > 0) {
    // Con el delivery ya con precio, el total lo lleva.
    const delivery = entrega?.forma === "delivery" && entrega.enZona && entrega.precio_usd !== null ? entrega.precio_usd : 0;
    const total = redondear(totales.total_usd + delivery);
    const totalBs = aBolivares(total, datos.tasa);
    const enBs = totalBs !== null && datos.tasa ? ` (${bs(totalBs)} a la tasa BCV de hoy, ${bs(datos.tasa)} por dólar)` : "";
    lineas.push(`Total estimado${delivery > 0 ? " con el delivery" : ""}: ${usd(total)}${enBs}${totales.sinPrecio > 0 ? ", más lo que está por confirmar" : ""}.`);
  }
  if (entrega) lineas.push(...lineasDeEntrega(entrega));
  const quien = [datos.nombre?.trim(), datos.negocioDelCliente?.trim()].filter(Boolean).join(", ");
  if (quien) lineas.push(`A nombre de: ${quien}.`);
  if (datos.nota?.trim()) lineas.push(`Nota: ${datos.nota.trim()}`);
  lineas.push("¿Me confirman disponibilidad y el total? ¡Gracias!");
  return lineas.join("\n");
}
