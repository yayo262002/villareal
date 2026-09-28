import "server-only";
import { db } from "./db";
import { aDolares, redondear, type MetodoPago, type Moneda } from "./dinero";

export type Pago = {
  id: number;
  cliente_id: number;
  cliente_nombre: string;
  fecha: string;
  metodo: MetodoPago;
  moneda: Moneda;
  monto: number;
  tasa: number | null;
  monto_usd: number;
  referencia: string;
  nota: string;
  creado_en: string;
};

export type DatosPago = {
  cliente_id: number;
  fecha: string;
  metodo: MetodoPago;
  moneda: Moneda;
  monto: number;
  tasa: number | null;
  referencia: string;
  nota: string;
};

const CONSULTA_PAGOS = `
  select p.*, c.nombre as cliente_nombre
  from pagos p
  join clientes c on c.id = p.cliente_id
`;

export function listarPagos(limite = 100): Pago[] {
  return db()
    .prepare(`${CONSULTA_PAGOS} order by p.fecha desc, p.id desc limit ?`)
    .all(limite) as Pago[];
}

export function listarPagosDeCliente(clienteId: number): Pago[] {
  return db()
    .prepare(`${CONSULTA_PAGOS} where p.cliente_id = ? order by p.fecha desc, p.id desc`)
    .all(clienteId) as Pago[];
}

/**
 * El equivalente en dólares se calcula al guardar y se conserva junto a la
 * tasa. Así el saldo del cliente no se mueve si la tasa de mañana es otra.
 */
export function registrarPago(datos: DatosPago): number {
  if (!(datos.monto > 0)) throw new Error("El monto tiene que ser mayor que cero.");
  const montoUsd = aDolares(datos.monto, datos.moneda, datos.tasa);

  const resultado = db()
    .prepare(
      `insert into pagos (cliente_id, fecha, metodo, moneda, monto, tasa, monto_usd, referencia, nota)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      datos.cliente_id,
      datos.fecha,
      datos.metodo,
      datos.moneda,
      redondear(datos.monto),
      datos.moneda === "VES" ? datos.tasa : null,
      montoUsd,
      datos.referencia,
      datos.nota,
    );
  return Number(resultado.lastInsertRowid);
}

export function totalCobradoUsd(): number {
  const fila = db().prepare("select coalesce(sum(monto_usd), 0) as t from pagos").get() as { t: number };
  return redondear(fila.t);
}

/** La última tasa que se usó en un pago en bolívares, para sugerirla en el formulario. */
export function ultimaTasa(): number | null {
  const fila = db()
    .prepare("select tasa from pagos where moneda = 'VES' and tasa is not null order by fecha desc, id desc limit 1")
    .get() as { tasa: number } | undefined;
  return fila?.tasa ?? null;
}
