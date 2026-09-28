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

export function cantidad(n: number, unidad: string): string {
  const num = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 }).format(n);
  return `${num} ${unidad}`;
}

/** Fecha de hoy en formato YYYY-MM-DD, para rellenar los formularios. */
export function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}
