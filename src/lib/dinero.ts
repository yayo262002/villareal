/**
 * El negocio fija precios en dólares y cobra en dólares o en bolívares a la
 * tasa del día. Todas las cuentas internas se llevan en USD; los bolívares
 * se convierten al registrar el pago y se guarda la tasa usada, para que
 * el número no cambie aunque la tasa cambie mañana.
 */

export type Moneda = "USD" | "VES";

export const METODOS_PAGO = {
  pago_movil: "Pago móvil",
  transferencia: "Transferencia",
  efectivo_bs: "Efectivo en bolívares",
  efectivo_usd: "Efectivo en dólares",
  zelle: "Zelle",
  binance: "Binance",
  otro: "Otro",
} as const;

export type MetodoPago = keyof typeof METODOS_PAGO;

/** Métodos que se pagan en bolívares y por tanto necesitan tasa. */
export const METODOS_EN_BOLIVARES: MetodoPago[] = ["pago_movil", "transferencia", "efectivo_bs"];

export function esMetodoPago(valor: string): valor is MetodoPago {
  return valor in METODOS_PAGO;
}

export function monedaDelMetodo(metodo: MetodoPago): Moneda {
  return METODOS_EN_BOLIVARES.includes(metodo) ? "VES" : "USD";
}

export function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Precio de venta en dólares: el costo más el margen del dueño. Con costo
 * 6,80 y margen 25 % sale 8,50. Si falta el costo o el margen no hay precio.
 */
export function precioDeVenta(costoUsd: number | null, margenPct: number | null): number | null {
  if (costoUsd === null || margenPct === null) return null;
  if (!(costoUsd >= 0) || !(margenPct >= 0)) return null;
  return redondear(costoUsd * (1 + margenPct / 100));
}

/**
 * El precio que le toca a un cliente: al mayor si es mayorista y el
 * producto tiene precio al mayor; en cualquier otro caso, al detal.
 */
export function precioParaCliente(
  precios: { precio_usd: number | null; precio_mayor_usd?: number | null },
  tipo: "detal" | "mayor",
): number | null {
  if (tipo === "mayor" && precios.precio_mayor_usd != null) return precios.precio_mayor_usd;
  return precios.precio_usd;
}

/** Un precio en dólares pasado a bolívares con la tasa del día, o null si no hay tasa. */
export function aBolivares(usd: number, tasa: number | null): number | null {
  if (!tasa || tasa <= 0) return null;
  return redondear(usd * tasa);
}

/** Convierte un monto a USD. En bolívares exige una tasa mayor que cero. */
export function aDolares(monto: number, moneda: Moneda, tasa: number | null): number {
  if (moneda === "USD") return redondear(monto);
  if (!tasa || tasa <= 0) throw new Error("Para un pago en bolívares hace falta la tasa del día.");
  return redondear(monto / tasa);
}

const formatoUsd = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const formatoBs = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function usd(n: number): string {
  return formatoUsd.format(n);
}

export function bs(n: number): string {
  return `Bs ${formatoBs.format(n)}`;
}

export function formatearMonto(monto: number, moneda: Moneda): string {
  return moneda === "USD" ? usd(monto) : bs(monto);
}

export const UNIDADES = { kg: "kg", unidad: "unidad", carton: "cartón" } as const;
export type Unidad = keyof typeof UNIDADES;

export function esUnidad(valor: string): valor is Unidad {
  return valor in UNIDADES;
}

/** «cartón», «kg», «unidad»: el nombre que se enseña de cada unidad. */
export function nombreUnidad(unidad: string): string {
  return (UNIDADES as Record<string, string>)[unidad] ?? unidad;
}

export function cantidad(n: number, unidad: string): string {
  const num = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 }).format(n);
  return `${num} ${nombreUnidad(unidad)}`;
}

/**
 * Fecha en formato YYYY-MM-DD usando la hora local, no UTC. Venezuela va
 * cuatro horas por detrás de UTC: con `toISOString()` una venta anotada a
 * las nueve de la noche saldría con la fecha de mañana.
 */
export function fechaIso(fecha: Date): string {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${a}-${m}-${d}`;
}

/** Fecha de hoy para rellenar los formularios. */
export function hoy(): string {
  return fechaIso(new Date());
}

export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** «2026-09» → «Septiembre 2026». Para el estudio de ventas. */
export function mesLegible(mes: string): string {
  const [a, m] = mes.split("-");
  const nombre = MESES[Number(m) - 1] ?? mes;
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${a}`;
}

/** Fecha de hace `dias` días, en YYYY-MM-DD, para filtrar «los últimos 30 días». */
export function hace(dias: number): string {
  const f = new Date();
  f.setDate(f.getDate() - dias);
  return fechaIso(f);
}
