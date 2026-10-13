import { diasEntre } from "./credito.ts";
import { redondear } from "./dinero.ts";

/**
 * El estudio de clientes: de cada uno, cuándo fue el último trato (una
 * compra, un abono, un recordatorio, una llamada anotada o el día en que
 * se registró), cuánto lleva sin él, qué suele comprar y cada cuánto. Los
 * que llevan una semana o más sin trato salen «por llamar»: para
 * ofrecerles mercancía y ver cómo va todo. Cálculo puro, con pruebas.
 */

/** A partir de tantos días sin trato, al cliente hay que llamarlo. */
export const DIAS_SIN_TRATO = 7;

export type VentaParaEstudio = { fecha: string; total_usd: number; lineas?: { producto_nombre: string; cantidad: number }[] };

export type DatosDeCliente = {
  /** El día en que se registró el cliente: ese día se habló con él. */
  alta: string | null;
  ventas: VentaParaEstudio[];
  abonos: { fecha: string }[];
  ultimoRecordatorio: string | null;
  ultimoContacto: string | null;
};

export type Trato = {
  ultimaCompra: string | null;
  ultimoAbono: string | null;
  ultimoTrato: string | null;
  /** null si nunca hubo trato (ni alta). */
  diasSinTrato: number | null;
  porLlamar: boolean;
  compras: number;
  compradoUsd: number;
  comprado30Usd: number;
  /** Cada cuántos días suele comprar, con dos compras o más. */
  cadaCuantosDias: number | null;
  /** Cuándo le tocaría la siguiente compra, a ese ritmo. */
  proximaCompra: string | null;
  /** Lo que más compra, de más a menos, hasta tres. */
  loQueCompra: string[];
};

function mayor(fechas: (string | null | undefined)[]): string | null {
  const validas = fechas.filter((f): f is string => Boolean(f)).map((f) => f.slice(0, 10));
  return validas.length ? validas.sort().at(-1)! : null;
}

function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

export function estudiarCliente(datos: DatosDeCliente, hoy: string): Trato {
  const fechasDeCompra = [...new Set(datos.ventas.map((v) => v.fecha.slice(0, 10)))].sort();
  const ultimaCompra = fechasDeCompra.at(-1) ?? null;
  const ultimoAbono = mayor(datos.abonos.map((a) => a.fecha));
  const ultimoTrato = mayor([datos.alta, ultimaCompra, ultimoAbono, datos.ultimoRecordatorio, datos.ultimoContacto]);
  const diasSinTrato = ultimoTrato ? Math.max(0, diasEntre(ultimoTrato, hoy)) : null;
  const porLlamar = diasSinTrato === null || diasSinTrato >= DIAS_SIN_TRATO;

  const cadaCuantosDias =
    fechasDeCompra.length >= 2 ? Math.max(1, Math.round(diasEntre(fechasDeCompra[0], fechasDeCompra.at(-1)!) / (fechasDeCompra.length - 1))) : null;
  const desde30 = sumarDias(hoy, -29);
  const porProducto = new Map<string, number>();
  for (const v of datos.ventas) for (const l of v.lineas ?? []) porProducto.set(l.producto_nombre, (porProducto.get(l.producto_nombre) ?? 0) + Number(l.cantidad));

  return {
    ultimaCompra,
    ultimoAbono,
    ultimoTrato,
    diasSinTrato,
    porLlamar,
    compras: datos.ventas.length,
    compradoUsd: redondear(datos.ventas.reduce((s, v) => s + Number(v.total_usd), 0)),
    comprado30Usd: redondear(datos.ventas.filter((v) => v.fecha.slice(0, 10) >= desde30).reduce((s, v) => s + Number(v.total_usd), 0)),
    cadaCuantosDias,
    proximaCompra: ultimaCompra && cadaCuantosDias ? sumarDias(ultimaCompra, cadaCuantosDias) : null,
    loQueCompra: [...porProducto.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nombre]) => nombre),
  };
}

/** «Sin trato desde hace 9 días», «Hoy hubo trato», «Sin ningún trato anotado». */
export function describirTrato(t: Trato): string {
  if (t.diasSinTrato === null) return "Sin ningún trato anotado";
  if (t.diasSinTrato === 0) return "Hoy hubo trato";
  if (t.diasSinTrato === 1) return "Sin trato desde ayer";
  return `Sin trato desde hace ${t.diasSinTrato} días`;
}
