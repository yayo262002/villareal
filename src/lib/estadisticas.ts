import { METODOS_PAGO, redondear } from "./dinero.ts";
import { sumarDias } from "./credito.ts";
import type { MovimientosCompletos } from "./movimientos.ts";

/**
 * Las estadísticas del negocio: a partir de los movimientos de un período
 * (ventas con sus líneas, abonos, compras y pagos a proveedores) se saca
 * cuánto se vendió y de qué, a quién, cómo se cobró, qué días se vende más
 * y la lista de todo lo que pasó. Cálculo puro, con pruebas: la base solo
 * da los movimientos.
 */

export type Periodo = { desde: string | null; hasta: string | null };

/** Los períodos de un toque. */
export const PERIODOS = [
  ["mes", "Este mes"],
  ["mes-pasado", "Mes pasado"],
  ["30", "Últimos 30 días"],
  ["90", "Últimos 90 días"],
  ["ano", "Este año"],
  ["todo", "Todo"],
] as const;
export type NombreDePeriodo = (typeof PERIODOS)[number][0];

export function esNombreDePeriodo(valor: string): valor is NombreDePeriodo {
  return PERIODOS.some(([nombre]) => nombre === valor);
}

/** Las fechas de un período con nombre, contadas desde hoy (AAAA-MM-DD). */
export function periodoDe(nombre: NombreDePeriodo, hoy: string): Periodo {
  const mes = hoy.slice(0, 7);
  switch (nombre) {
    case "mes":
      return { desde: `${mes}-01`, hasta: hoy };
    case "mes-pasado": {
      const primeroDeEste = `${mes}-01`;
      const ultimoDelPasado = sumarDias(primeroDeEste, -1);
      return { desde: `${ultimoDelPasado.slice(0, 7)}-01`, hasta: ultimoDelPasado };
    }
    case "30":
      return { desde: sumarDias(hoy, -29), hasta: hoy };
    case "90":
      return { desde: sumarDias(hoy, -89), hasta: hoy };
    case "ano":
      return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
    case "todo":
      return { desde: null, hasta: null };
  }
}

export type Resumen = {
  vendido: number;
  notas: number;
  cobrado: number;
  abonos: number;
  /** Kilos vendidos, solo de lo que se vende por kilo. */
  kilos: number;
  /** Lo que se vende de media en cada nota. */
  ticketMedio: number;
  clientesQueCompraron: number;
  comprado: number;
  pagadoProveedores: number;
  /** Cobrado menos pagado a proveedores: lo que entró de verdad. */
  entroNeto: number;
};

const suma = (valores: number[]) => redondear(valores.reduce((s, v) => s + Number(v), 0));

export function resumenDe(m: MovimientosCompletos): Resumen {
  const vendido = suma(m.ventas.map((v) => v.total_usd));
  const cobrado = suma(m.abonos.map((a) => a.monto_usd));
  const pagadoProveedores = suma(m.pagos.map((p) => p.monto_usd));
  return {
    vendido,
    notas: m.ventas.length,
    cobrado,
    abonos: m.abonos.length,
    kilos: Math.round(m.ventas.flatMap((v) => v.lineas).filter((l) => l.unidad === "kg").reduce((s, l) => s + Number(l.cantidad), 0) * 1000) / 1000,
    ticketMedio: m.ventas.length > 0 ? redondear(vendido / m.ventas.length) : 0,
    clientesQueCompraron: new Set(m.ventas.map((v) => v.cliente_id)).size,
    comprado: suma(m.compras.map((c) => c.total_usd)),
    pagadoProveedores,
    entroNeto: redondear(cobrado - pagadoProveedores),
  };
}

export type PorProducto = { producto: string; unidad: string; cantidad: number; vendido: number; /** Qué parte del vendido, en %. */ parte: number };

/** Cuánto se vendió de cada producto y marca, de más a menos. */
export function porProducto(m: MovimientosCompletos): PorProducto[] {
  const grupos = new Map<string, PorProducto>();
  for (const l of m.ventas.flatMap((v) => v.lineas)) {
    const g = grupos.get(l.producto_nombre) ?? { producto: l.producto_nombre, unidad: l.unidad, cantidad: 0, vendido: 0, parte: 0 };
    g.cantidad = Math.round((g.cantidad + Number(l.cantidad)) * 1000) / 1000;
    g.vendido = redondear(g.vendido + Number(l.subtotal_usd));
    grupos.set(l.producto_nombre, g);
  }
  const total = suma([...grupos.values()].map((g) => g.vendido));
  return [...grupos.values()]
    .map((g) => ({ ...g, parte: total > 0 ? Math.round((g.vendido / total) * 100) : 0 }))
    .sort((a, b) => b.vendido - a.vendido || a.producto.localeCompare(b.producto));
}

export type PorCliente = { cliente_id: number; cliente: string; ventas: number; vendido: number; abonado: number };

/** Cada cliente con lo que compró y lo que abonó en el período, de más a menos comprado. */
export function porCliente(m: MovimientosCompletos): PorCliente[] {
  const grupos = new Map<number, PorCliente>();
  const de = (id: number, nombre: string) => {
    const g = grupos.get(id) ?? { cliente_id: id, cliente: nombre, ventas: 0, vendido: 0, abonado: 0 };
    grupos.set(id, g);
    return g;
  };
  for (const v of m.ventas) {
    const g = de(v.cliente_id, v.cliente_nombre);
    g.ventas += 1;
    g.vendido = redondear(g.vendido + Number(v.total_usd));
  }
  for (const a of m.abonos) {
    const g = de(a.cliente_id, a.cliente_nombre);
    g.abonado = redondear(g.abonado + Number(a.monto_usd));
  }
  return [...grupos.values()].sort((a, b) => b.vendido - a.vendido || b.abonado - a.abonado || a.cliente.localeCompare(b.cliente));
}

export type PorMetodo = { metodo: string; nombre: string; moneda: string; abonos: number; /** En la moneda del método. */ monto: number; usd: number };

/** Cómo pagaron los clientes: por método y moneda, de más a menos. */
export function porMetodo(m: MovimientosCompletos): PorMetodo[] {
  const grupos = new Map<string, PorMetodo>();
  for (const a of m.abonos) {
    const clave = `${a.metodo}:${a.moneda}`;
    const g = grupos.get(clave) ?? {
      metodo: a.metodo,
      nombre: (METODOS_PAGO as Record<string, string>)[a.metodo] ?? a.metodo,
      moneda: a.moneda,
      abonos: 0,
      monto: 0,
      usd: 0,
    };
    g.abonos += 1;
    g.monto = redondear(g.monto + Number(a.monto));
    g.usd = redondear(g.usd + Number(a.monto_usd));
    grupos.set(clave, g);
  }
  return [...grupos.values()].sort((a, b) => b.usd - a.usd);
}

export const DIAS_DE_LA_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

export type PorDiaDeLaSemana = { dia: number; nombre: string; ventas: number; vendido: number };

/** De lunes a domingo, cuántas notas y cuánto se vendió cada día de la semana. */
export function porDiaDeLaSemana(m: MovimientosCompletos): PorDiaDeLaSemana[] {
  const dias = DIAS_DE_LA_SEMANA.map((nombre, dia) => ({ dia, nombre, ventas: 0, vendido: 0 }));
  for (const v of m.ventas) {
    const instante = new Date(v.fecha.slice(0, 10) + "T00:00:00Z");
    if (Number.isNaN(instante.getTime())) continue;
    // getUTCDay da 0 el domingo; aquí la semana empieza el lunes.
    const d = dias[(instante.getUTCDay() + 6) % 7];
    d.ventas += 1;
    d.vendido = redondear(d.vendido + Number(v.total_usd));
  }
  return dias;
}

export type PorDia = { fecha: string; ventas: number; vendido: number; cobrado: number };

/** Cada día con ventas o abonos, del más antiguo al más nuevo. */
export function porDia(m: MovimientosCompletos): PorDia[] {
  const dias = new Map<string, PorDia>();
  const de = (fecha: string) => {
    const d = dias.get(fecha) ?? { fecha, ventas: 0, vendido: 0, cobrado: 0 };
    dias.set(fecha, d);
    return d;
  };
  for (const v of m.ventas) {
    const d = de(v.fecha);
    d.ventas += 1;
    d.vendido = redondear(d.vendido + Number(v.total_usd));
  }
  for (const a of m.abonos) {
    const d = de(a.fecha);
    d.cobrado = redondear(d.cobrado + Number(a.monto_usd));
  }
  return [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export type TipoDeMovimiento = "Venta" | "Abono" | "Compra" | "Pago a proveedor";

export type MovimientoUnificado = {
  fecha: string;
  tipo: TipoDeMovimiento;
  id: number;
  /** El cliente o el proveedor. */
  quien: string;
  detalle: string;
  usd: number;
  /** Adónde lleva en el panel. */
  enlace: string | null;
};

const ORDEN: Record<TipoDeMovimiento, number> = { Venta: 0, Abono: 1, Compra: 2, "Pago a proveedor": 3 };

function metodoLegible(metodo: string): string {
  return (METODOS_PAGO as Record<string, string>)[metodo] ?? metodo;
}

/** Todo lo que pasó, del más reciente al más antiguo, en una sola lista. */
export function todosLosMovimientos(m: MovimientosCompletos): MovimientoUnificado[] {
  const cifra = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 });
  const lista: MovimientoUnificado[] = [
    ...m.ventas.map((v) => ({
      fecha: v.fecha,
      tipo: "Venta" as const,
      id: v.id,
      quien: v.cliente_nombre,
      detalle: `Nota ${String(v.id).padStart(6, "0")}${v.lineas.length > 0 ? ` · ${v.lineas.map((l) => `${cifra.format(Number(l.cantidad))} ${l.unidad === "kg" ? "kg" : l.unidad === "carton" ? "cartón" : l.unidad} ${l.producto_nombre}`).join(" · ")}` : ""}`,
      usd: Number(v.total_usd),
      enlace: `/admin/ventas/${v.id}/nota`,
    })),
    ...m.abonos.map((a) => ({
      fecha: a.fecha,
      tipo: "Abono" as const,
      id: a.id,
      quien: a.cliente_nombre,
      detalle: `${metodoLegible(a.metodo)}${a.moneda === "VES" ? ` · Bs ${cifra.format(Number(a.monto))}${a.tasa ? ` a ${cifra.format(Number(a.tasa))}` : ""}` : ""}${a.referencia ? ` · ref. ${a.referencia}` : ""}`,
      usd: Number(a.monto_usd),
      enlace: `/admin/clientes/${a.cliente_id}`,
    })),
    ...m.compras.map((c) => ({
      fecha: c.fecha,
      tipo: "Compra" as const,
      id: c.id,
      quien: c.proveedor_nombre,
      detalle: c.descripcion,
      usd: Number(c.total_usd),
      enlace: null,
    })),
    ...m.pagos.map((p) => ({
      fecha: p.fecha,
      tipo: "Pago a proveedor" as const,
      id: p.id,
      quien: p.proveedor_nombre,
      detalle: `${metodoLegible(p.metodo)}${p.moneda === "VES" ? ` · Bs ${cifra.format(Number(p.monto))}` : ""}${p.referencia ? ` · ref. ${p.referencia}` : ""}`,
      usd: Number(p.monto_usd),
      enlace: null,
    })),
  ];
  return lista.sort((a, b) => b.fecha.localeCompare(a.fecha) || ORDEN[a.tipo] - ORDEN[b.tipo] || b.id - a.id);
}
