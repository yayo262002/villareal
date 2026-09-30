import { METODOS_PAGO, fechaCorta, nombreUnidad, redondear } from "./dinero.ts";

/**
 * Lo que se descarga para abrir en Excel: los movimientos uno por uno y el
 * resumen de cada día. Van en CSV con punto y coma, que es lo que entiende
 * Excel en castellano, y los números con coma decimal por lo mismo: con
 * punto, Excel lee «10.5» como una fecha. Cálculo puro, con pruebas.
 */

/** Una celda del CSV: entre comillas si lleva punto y coma, comillas o salto de línea. */
export function celda(valor: string | number | null | undefined): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Un número como lo lee Excel en castellano: coma decimal y sin separador de miles. Vacío si no hay. */
export function numeroParaExcel(n: number | null | undefined, decimales = 2): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "";
  return Number(n).toFixed(decimales).replace(".", ",");
}

/** El archivo entero, con la marca que le dice a Excel que viene en UTF-8. */
export function aCsv(cabecera: string[], filas: (string | number | null | undefined)[][]): string {
  const lineas = [cabecera, ...filas].map((fila) => fila.map(celda).join(";"));
  return "﻿" + lineas.join("\r\n") + "\r\n";
}

type LineaVendida = { cantidad: number; unidad: string; producto_nombre: string };
type VentaExportable = { id: number; fecha: string; cliente_nombre: string; total_usd: number; nota: string; lineas: LineaVendida[] };
type PagoExportable = {
  id: number;
  fecha: string;
  metodo: string;
  moneda: string;
  monto: number;
  tasa: number | null;
  monto_usd: number;
  referencia: string;
  nota: string;
};
type AbonoExportable = PagoExportable & { cliente_nombre: string };
type CompraExportable = { id: number; fecha: string; proveedor_nombre: string; descripcion: string; total_usd: number; nota: string };
type PagoProveedorExportable = PagoExportable & { proveedor_nombre: string };

export type Movimientos = {
  ventas: VentaExportable[];
  abonos: AbonoExportable[];
  compras: CompraExportable[];
  pagos: PagoProveedorExportable[];
};

export const CABECERA_DE_MOVIMIENTOS = [
  "Fecha",
  "Tipo",
  "Nota n.º",
  "Cliente o proveedor",
  "Detalle",
  "Método",
  "Monto",
  "Moneda",
  "Tasa",
  "Vendido USD",
  "Entró USD",
  "Comprado USD",
  "Salió USD",
  "Referencia",
  "Observación",
];

/** El orden de los tipos dentro de un mismo día: primero lo que se vende, después lo que entra, lo que se compra y lo que sale. */
const ORDEN = { Venta: 0, Abono: 1, Compra: 2, "Pago a proveedor": 3 } as const;
type Tipo = keyof typeof ORDEN;

function numeroDeNota(id: number): string {
  return String(id).padStart(6, "0");
}

function lineasEnTexto(lineas: LineaVendida[]): string {
  const cifra = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 });
  return lineas.map((l) => `${cifra.format(l.cantidad)} ${nombreUnidad(l.unidad)} ${l.producto_nombre}`).join(" · ");
}

function nombreDelMetodo(metodo: string): string {
  return (METODOS_PAGO as Record<string, string>)[metodo] ?? metodo;
}

/**
 * Una fila por movimiento, del día más antiguo al más nuevo. Cada monto en
 * dólares va en su columna (vendido, entró, comprado, salió) para poder
 * sumar cada una por separado en Excel.
 */
export function filasDeMovimientos(m: Movimientos): string[][] {
  type Fila = { fecha: string; tipo: Tipo; id: number; celdas: string[] };
  const filas: Fila[] = [];

  for (const v of m.ventas) {
    filas.push({
      fecha: v.fecha,
      tipo: "Venta",
      id: v.id,
      celdas: [numeroDeNota(v.id), v.cliente_nombre, lineasEnTexto(v.lineas), "", "", "", "", numeroParaExcel(v.total_usd), "", "", "", "", v.nota],
    });
  }
  for (const a of m.abonos) {
    filas.push({
      fecha: a.fecha,
      tipo: "Abono",
      id: a.id,
      celdas: ["", a.cliente_nombre, "", nombreDelMetodo(a.metodo), numeroParaExcel(a.monto), a.moneda === "VES" ? "Bs" : "USD", numeroParaExcel(a.tasa, 4), "", numeroParaExcel(a.monto_usd), "", "", a.referencia, a.nota],
    });
  }
  for (const c of m.compras) {
    filas.push({
      fecha: c.fecha,
      tipo: "Compra",
      id: c.id,
      celdas: ["", c.proveedor_nombre, c.descripcion, "", "", "", "", "", "", numeroParaExcel(c.total_usd), "", "", c.nota],
    });
  }
  for (const p of m.pagos) {
    filas.push({
      fecha: p.fecha,
      tipo: "Pago a proveedor",
      id: p.id,
      celdas: ["", p.proveedor_nombre, "", nombreDelMetodo(p.metodo), numeroParaExcel(p.monto), p.moneda === "VES" ? "Bs" : "USD", numeroParaExcel(p.tasa, 4), "", "", "", numeroParaExcel(p.monto_usd), p.referencia, p.nota],
    });
  }

  filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || ORDEN[a.tipo] - ORDEN[b.tipo] || a.id - b.id);
  return filas.map((f) => [fechaCorta(f.fecha), f.tipo, ...f.celdas]);
}

export const CABECERA_POR_DIA = [
  "Fecha",
  "Notas",
  "Vendido USD",
  "Abonos",
  "Entró USD",
  "Entró en bolívares",
  "Entró en dólares",
  "Compras",
  "Comprado USD",
  "Pagos a proveedores",
  "Salió USD",
  "Entró menos salió USD",
];

/**
 * Una fila por día con movimiento. «Entró en bolívares» y «Entró en
 * dólares» son lo recibido en cada moneda, para cuadrar la caja; «Entró
 * USD» es todo junto, con los bolívares ya convertidos.
 */
export function filasPorDia(m: Movimientos): string[][] {
  type Dia = { notas: number; vendido: number; abonos: number; entro: number; entroBs: number; entroUsd: number; compras: number; comprado: number; pagos: number; salio: number };
  const dias = new Map<string, Dia>();
  const dia = (fecha: string) => {
    let d = dias.get(fecha);
    if (!d) {
      d = { notas: 0, vendido: 0, abonos: 0, entro: 0, entroBs: 0, entroUsd: 0, compras: 0, comprado: 0, pagos: 0, salio: 0 };
      dias.set(fecha, d);
    }
    return d;
  };

  for (const v of m.ventas) {
    const d = dia(v.fecha);
    d.notas++;
    d.vendido += Number(v.total_usd);
  }
  for (const a of m.abonos) {
    const d = dia(a.fecha);
    d.abonos++;
    d.entro += Number(a.monto_usd);
    if (a.moneda === "VES") d.entroBs += Number(a.monto);
    else d.entroUsd += Number(a.monto);
  }
  for (const c of m.compras) {
    const d = dia(c.fecha);
    d.compras++;
    d.comprado += Number(c.total_usd);
  }
  for (const p of m.pagos) {
    const d = dia(p.fecha);
    d.pagos++;
    d.salio += Number(p.monto_usd);
  }

  return [...dias.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, d]) => [
      fechaCorta(fecha),
      String(d.notas),
      numeroParaExcel(redondear(d.vendido)),
      String(d.abonos),
      numeroParaExcel(redondear(d.entro)),
      numeroParaExcel(redondear(d.entroBs)),
      numeroParaExcel(redondear(d.entroUsd)),
      String(d.compras),
      numeroParaExcel(redondear(d.comprado)),
      String(d.pagos),
      numeroParaExcel(redondear(d.salio)),
      numeroParaExcel(redondear(d.entro - d.salio)),
    ]);
}

/** Una fecha de formulario si es válida (YYYY-MM-DD); si no, null. */
export function leerFecha(valor: string | null | undefined): string | null {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  return Number.isNaN(new Date(valor + "T00:00:00Z").getTime()) ? null : valor;
}

/** El periodo pedido, en orden: si llegan al revés se dan la vuelta. */
export function leerPeriodo(desde: string | null | undefined, hasta: string | null | undefined): { desde: string | null; hasta: string | null } {
  const a = leerFecha(desde);
  const b = leerFecha(hasta);
  return a && b && a > b ? { desde: b, hasta: a } : { desde: a, hasta: b };
}

/** `movimientos-2026-09-01-a-2026-09-30.csv`, o `…-todo.csv` si no hay fechas. */
export function nombreDelArchivo(base: string, desde: string | null, hasta: string | null): string {
  if (desde && hasta) return desde === hasta ? `${base}-${desde}.csv` : `${base}-${desde}-a-${hasta}.csv`;
  if (desde) return `${base}-desde-${desde}.csv`;
  if (hasta) return `${base}-hasta-${hasta}.csv`;
  return `${base}-todo.csv`;
}
