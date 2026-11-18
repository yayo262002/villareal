import { redondear, usd, usdConSigno } from "./dinero.ts";
import { repartoDeAbonos } from "./cuentas.ts";

/**
 * El reparto del mes: la ganancia de lo cobrado en un mes, repartida por
 * puntos entre el fondo de previsión, la cuota del préstamo y los socios.
 *
 * - La ganancia de una venta es lo que se cobra por ella menos lo que
 *   costaba su mercancía el día de la venta (`venta_lineas.costo_unitario_usd`):
 *   si el costo sube después, esa venta no gana más en el papel; y lo que
 *   se reparte no es el dinero que hace falta para volver a comprar.
 * - Solo cuenta lo cobrado: un abono paga las notas del cliente de la más
 *   antigua a la más nueva (`repartoDeAbonos`, el mismo reparto de siempre) y
 *   trae la ganancia de lo que paga, en proporción. Una venta de octubre
 *   cobrada en noviembre reparte en noviembre; lo vendido y no cobrado,
 *   cuando se cobre.
 * - Lo que se vendió sin costo guardado (las ventas de antes del 18/11/2026,
 *   o un producto sin costo en Productos) no entra en la ganancia: se dice
 *   aparte, no se estima.
 * - Antes de repartir se resta lo que se paga primero (la comisión de la
 *   vendedora…), y lo que queda se reparte por puntos: con 2 de 10 puntos,
 *   2 de cada 10 dólares de la ganancia, deje la venta un 5 % o un 15 %.
 *
 * Es cálculo puro, sin base de datos, para poder probarlo.
 */

export type ParteDelReparto = { nombre: string; puntos: number };

/** Las partes de siempre (el dueño, 12/11 y 18/11/2026): 10 puntos, 2 de ellos para el hermano. Se cambian en la pantalla. */
export const PARTES_INICIALES: readonly ParteDelReparto[] = [
  { nombre: "Fondo de previsión", puntos: 2 },
  { nombre: "Cuota del préstamo", puntos: 1 },
  { nombre: "Yo", puntos: 3 },
  { nombre: "Papá", puntos: 2 },
  { nombre: "Mi hermano", puntos: 2 },
];

/** Cuántas filas tiene el formulario de las partes. */
export const PARTES_MAXIMAS = 8;

export type VentaDelReparto = { id: number; cliente_id: number; fecha: string; total_usd: number };
export type LineaDelReparto = { venta_id: number; producto: string; cantidad: number; subtotal_usd: number; costo_unitario_usd: number | null };
export type AbonoDelReparto = { id: number; cliente_id: number; fecha: string; monto_usd: number };
export type DescuentoDelReparto = { id: number; concepto: string; monto_usd: number };

/** Lo que dejó una venta: lo cobrado por lo que tiene costo, lo que costó, la ganancia y lo que no tiene costo. */
export type CuentaDeUnaVenta = { total: number; conCosto: number; costo: number; ganancia: number; sinCosto: number };

/**
 * La cuenta de una venta. El descuento de la caja (el total ya lo tiene restado) se reparte entre las líneas en
 * proporción, como en la factura. Sin redondear: se redondea al final del mes.
 */
export function cuentaDeLaVenta(venta: Pick<VentaDelReparto, "total_usd">, lineas: LineaDelReparto[]): CuentaDeUnaVenta {
  const total = Number(venta.total_usd);
  const bruto = lineas.reduce((s, l) => s + Number(l.subtotal_usd), 0);
  if (!(bruto > 0) || !(total > 0)) return { total, conCosto: 0, costo: 0, ganancia: 0, sinCosto: Math.max(0, total) };
  const factor = total / bruto;
  let conCosto = 0;
  let costo = 0;
  for (const l of lineas) {
    if (l.costo_unitario_usd === null || l.costo_unitario_usd === undefined) continue;
    conCosto += Number(l.subtotal_usd) * factor;
    costo += Number(l.cantidad) * Number(l.costo_unitario_usd);
  }
  return { total, conCosto, costo, ganancia: conCosto - costo, sinCosto: total - conCosto };
}

type Suma = { total: number; conCosto: number; costo: number; ganancia: number; sinCosto: number };
const suma0 = (): Suma => ({ total: 0, conCosto: 0, costo: 0, ganancia: 0, sinCosto: 0 });
const redondearSuma = (s: Suma): Suma => ({
  total: redondear(s.total),
  conCosto: redondear(s.conCosto),
  costo: redondear(s.costo),
  ganancia: redondear(s.ganancia),
  sinCosto: redondear(s.sinCosto),
});

export type ParteRepartida = ParteDelReparto & { monto: number };

export type RepartoDelMes = {
  mes: string;
  /** Lo vendido en el mes (por la fecha de la nota), y lo que deja en el papel lo que tiene costo. */
  vendido: Suma & { notas: number };
  /** Lo cobrado en el mes, y la ganancia que trae; `aCuenta`, lo que no paga ninguna nota (queda a favor del cliente). */
  cobrado: Suma & { abonos: number; aCuenta: number };
  /** Lo que deja cada producto de lo vendido en el mes, del que más deja al que menos. */
  productos: { producto: string; vendido: number; costo: number; ganancia: number }[];
  /** Lo vendido en el mes sin costo guardado, por producto. */
  sinCosto: { producto: string; vendido: number }[];
  descuentos: DescuentoDelReparto[];
  totalDescuentos: number;
  /** La ganancia cobrada menos lo que se paga antes. Negativa si no alcanzó: entonces no se reparte nada. */
  aRepartir: number;
  puntos: number;
  partes: ParteRepartida[];
};

/** Los puntos que cuentan: los de las partes con nombre y más de cero. */
export function puntosDe(partes: readonly ParteDelReparto[]): number {
  return partes.reduce((s, p) => s + (p.puntos > 0 ? p.puntos : 0), 0);
}

/**
 * Reparte un monto por puntos, al centavo, y sin perder ni sumar un centavo: lo que sobra al redondear va a las
 * partes a las que más les faltaba. Con un monto de cero o menos, a nadie le toca nada.
 */
export function repartirPorPuntos(monto: number, partes: readonly ParteDelReparto[]): ParteRepartida[] {
  const puntos = puntosDe(partes);
  const centavos = Math.round(monto * 100);
  if (!(centavos > 0) || !(puntos > 0)) return partes.map((p) => ({ ...p, monto: 0 }));
  const exactos = partes.map((p) => (p.puntos > 0 ? (centavos * p.puntos) / puntos : 0));
  const enteros = exactos.map((e) => Math.floor(e + 1e-9));
  let sobran = centavos - enteros.reduce((s, n) => s + n, 0);
  const porResto = exactos.map((e, i) => ({ i, resto: e - enteros[i] })).sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (const { i } of porResto) {
    if (sobran <= 0) break;
    if (!(partes[i].puntos > 0)) continue;
    enteros[i]++;
    sobran--;
  }
  return partes.map((p, i) => ({ ...p, monto: enteros[i] / 100 }));
}

export function calcularReparto(datos: {
  mes: string;
  ventas: VentaDelReparto[];
  lineas: LineaDelReparto[];
  abonos: AbonoDelReparto[];
  descuentos: DescuentoDelReparto[];
  partes: readonly ParteDelReparto[];
}): RepartoDelMes {
  const { mes } = datos;
  const delMes = (fecha: string) => fecha.slice(0, 7) === mes;
  const lineasDe = new Map<number, LineaDelReparto[]>();
  for (const l of datos.lineas) lineasDe.set(Number(l.venta_id), [...(lineasDe.get(Number(l.venta_id)) ?? []), l]);
  const cuenta = new Map(datos.ventas.map((v) => [Number(v.id), cuentaDeLaVenta(v, lineasDe.get(Number(v.id)) ?? [])]));

  // Lo vendido en el mes, y lo que deja cada producto.
  const vendido = { ...suma0(), notas: 0 };
  const porProducto = new Map<string, { vendido: number; costo: number; ganancia: number }>();
  const sinCostoPorProducto = new Map<string, number>();
  for (const v of datos.ventas) {
    if (!delMes(v.fecha)) continue;
    const c = cuenta.get(Number(v.id))!;
    vendido.notas++;
    vendido.total += c.total;
    vendido.conCosto += c.conCosto;
    vendido.costo += c.costo;
    vendido.ganancia += c.ganancia;
    vendido.sinCosto += c.sinCosto;
    const lineas = lineasDe.get(Number(v.id)) ?? [];
    const bruto = lineas.reduce((s, l) => s + Number(l.subtotal_usd), 0);
    const factor = bruto > 0 ? c.total / bruto : 0;
    for (const l of lineas) {
      const cobrado = Number(l.subtotal_usd) * factor;
      if (l.costo_unitario_usd === null || l.costo_unitario_usd === undefined) {
        sinCostoPorProducto.set(l.producto, (sinCostoPorProducto.get(l.producto) ?? 0) + cobrado);
        continue;
      }
      const costo = Number(l.cantidad) * Number(l.costo_unitario_usd);
      const p = porProducto.get(l.producto) ?? { vendido: 0, costo: 0, ganancia: 0 };
      porProducto.set(l.producto, { vendido: p.vendido + cobrado, costo: p.costo + costo, ganancia: p.ganancia + cobrado - costo });
    }
  }

  // Lo cobrado en el mes: cada abono, a las notas que paga (de la más antigua a la más nueva, cliente por cliente).
  const cobrado = { ...suma0(), abonos: 0, aCuenta: 0 };
  const clientes = new Set([...datos.ventas.map((v) => Number(v.cliente_id)), ...datos.abonos.map((a) => Number(a.cliente_id))]);
  for (const cliente of clientes) {
    const abonos = datos.abonos.filter((a) => Number(a.cliente_id) === cliente);
    if (!abonos.some((a) => delMes(a.fecha))) continue;
    const ventas = datos.ventas.filter((v) => Number(v.cliente_id) === cliente);
    const reparto = repartoDeAbonos(ventas, abonos);
    for (const a of abonos) {
      if (!delMes(a.fecha)) continue;
      cobrado.abonos++;
      cobrado.total += Number(a.monto_usd);
      cobrado.aCuenta += reparto.aFavor.get(a.id) ?? 0;
      for (const parte of reparto.porAbono.get(a.id) ?? []) {
        const c = cuenta.get(parte.venta_id);
        if (!c || !(c.total > 0)) continue;
        const k = parte.usd / c.total;
        cobrado.conCosto += c.conCosto * k;
        cobrado.costo += c.costo * k;
        cobrado.ganancia += c.ganancia * k;
        cobrado.sinCosto += c.sinCosto * k;
      }
    }
  }

  const descuentos = datos.descuentos.map((d) => ({ ...d, monto_usd: redondear(Number(d.monto_usd)) }));
  const totalDescuentos = redondear(descuentos.reduce((s, d) => s + d.monto_usd, 0));
  const gananciaCobrada = redondear(cobrado.ganancia);
  const aRepartir = redondear(gananciaCobrada - totalDescuentos);
  const partes = datos.partes.filter((p) => p.nombre.trim() && p.puntos > 0);

  return {
    mes,
    vendido: { ...redondearSuma(vendido), notas: vendido.notas },
    cobrado: { ...redondearSuma(cobrado), ganancia: gananciaCobrada, abonos: cobrado.abonos, aCuenta: redondear(cobrado.aCuenta) },
    productos: [...porProducto.entries()]
      .map(([producto, p]) => ({ producto, vendido: redondear(p.vendido), costo: redondear(p.costo), ganancia: redondear(p.ganancia) }))
      .sort((a, b) => b.ganancia - a.ganancia || a.producto.localeCompare(b.producto)),
    sinCosto: [...sinCostoPorProducto.entries()].map(([producto, v]) => ({ producto, vendido: redondear(v) })).sort((a, b) => b.vendido - a.vendido),
    descuentos,
    totalDescuentos,
    aRepartir,
    puntos: puntosDe(partes),
    partes: repartirPorPuntos(aRepartir, partes),
  };
}

/** Lo que deja una venta sobre su costo, en %: 7,60 → 8,36 deja un 10 %. Null sin costo. */
export function margenSobreElCosto(ganancia: number, costo: number): number | null {
  return costo > 0 ? (ganancia / costo) * 100 : null;
}

/** «2», «2,5»: los puntos como se escriben aquí. */
export function puntosEnTexto(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

/**
 * Las partes guardadas en los ajustes (JSON). Lo que no se entienda, o una lista vacía, vuelve a las de siempre: el
 * reparto nunca se queda sin partes.
 */
export function partesDesdeAjuste(valor: string | undefined | null): ParteDelReparto[] {
  if (!valor) return PARTES_INICIALES.map((p) => ({ ...p }));
  try {
    const leidas = JSON.parse(valor) as unknown;
    if (!Array.isArray(leidas)) throw new Error("no es una lista");
    const partes = leidas
      .map((p) => ({ nombre: String((p as ParteDelReparto)?.nombre ?? "").trim().slice(0, 40), puntos: Number((p as ParteDelReparto)?.puntos) }))
      .filter((p) => p.nombre && Number.isFinite(p.puntos) && p.puntos > 0);
    return partes.length > 0 ? partes : PARTES_INICIALES.map((p) => ({ ...p }));
  } catch {
    return PARTES_INICIALES.map((p) => ({ ...p }));
  }
}

/**
 * Las partes escritas en el formulario (nombre y puntos por fila). Una fila vacía no cuenta; un nombre sin puntos, o
 * unos puntos sin nombre, es un error que se dice.
 */
export function partesDelFormulario(filas: { nombre: string; puntos: string }[]): { partes: ParteDelReparto[] } | { error: string } {
  const partes: ParteDelReparto[] = [];
  for (const [i, f] of filas.entries()) {
    const nombre = f.nombre.trim().replace(/\s+/g, " ").slice(0, 40);
    const escrito = f.puntos.trim().replace(",", ".");
    if (!nombre && !escrito) continue;
    if (!nombre) return { error: `En la fila ${i + 1} falta el nombre: ¿de quién son esos puntos?` };
    const puntos = Number(escrito);
    if (!escrito || !Number.isFinite(puntos) || puntos <= 0) return { error: `A «${nombre}» le faltan los puntos: un número mayor que cero, como 2 o 2,5.` };
    if (puntos > 100) return { error: `${puntosEnTexto(puntos)} puntos para «${nombre}» son demasiados: los puntos son partes de la ganancia, como 2 de 10.` };
    if (partes.some((p) => p.nombre.toLowerCase() === nombre.toLowerCase())) return { error: `«${nombre}» está dos veces.` };
    partes.push({ nombre, puntos: Math.round(puntos * 100) / 100 });
  }
  if (partes.length === 0) return { error: "Escribe al menos una parte, con su nombre y sus puntos." };
  return { partes };
}

/**
 * El resumen del mes para mandarlo por WhatsApp (al hermano, que está fuera): lo vendido, lo cobrado, la ganancia, lo
 * que se paga antes y lo que le toca a cada uno, con cómo se saca la cuenta.
 */
export function mensajeDelReparto(r: RepartoDelMes, nombreDelMes: string, negocio: string): string {
  const lineas: string[] = [`*Reparto de ${nombreDelMes}* · ${negocio}`, ""];
  lineas.push(`Vendido en el mes: ${usd(r.vendido.total)} (${r.vendido.notas === 1 ? "1 nota" : `${r.vendido.notas} notas`})`);
  lineas.push(`Cobrado en el mes: ${usd(r.cobrado.total)}`);
  lineas.push(`Ganancia de lo cobrado: ${usdConSigno(r.cobrado.ganancia)}`);
  if (r.cobrado.sinCosto > 0) lineas.push(`(Sin contar ${usd(r.cobrado.sinCosto)} cobrados de ventas sin costo guardado.)`);
  for (const d of r.descuentos) lineas.push(`Antes de repartir, ${d.concepto}: −${usd(d.monto_usd)}`);
  lineas.push(`*A repartir: ${usd(Math.max(0, r.aRepartir))}*`);
  lineas.push("");
  if (r.aRepartir > 0) {
    for (const p of r.partes) lineas.push(`${p.nombre} (${puntosEnTexto(p.puntos)} de ${puntosEnTexto(r.puntos)}): ${usd(p.monto)}`);
  } else {
    lineas.push("Este mes no queda ganancia para repartir.");
  }
  lineas.push("");
  lineas.push(
    "La ganancia es lo cobrado menos lo que costaba la mercancía el día de cada venta. Lo vendido y aún no cobrado entra en el mes en que se cobre.",
  );
  return lineas.join("\n");
}
