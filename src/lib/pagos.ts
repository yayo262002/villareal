import "server-only";
import { ejecutar, fila, filas } from "./db";
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

export async function listarPagos(limite = 100): Promise<Pago[]> {
  return filas<Pago>(`${CONSULTA_PAGOS} order by p.fecha desc, p.id desc limit ?`, [limite]);
}

export async function listarPagosDeCliente(clienteId: number): Promise<Pago[]> {
  return filas<Pago>(`${CONSULTA_PAGOS} where p.cliente_id = ? order by p.fecha desc, p.id desc`, [clienteId]);
}

export async function buscarPago(id: number): Promise<Pago | null> {
  return fila<Pago>(`${CONSULTA_PAGOS} where p.id = ?`, [id]);
}

/** Borra un pago. Devuelve false si no existía. */
export async function eliminarPago(id: number): Promise<boolean> {
  const r = await ejecutar("delete from pagos where id = ?", [id]);
  return r.cambios > 0;
}

/**
 * El equivalente en dólares se calcula al guardar y se conserva junto a la
 * tasa. Así el saldo del cliente no se mueve si la tasa de mañana es otra.
 */
export async function registrarPago(datos: DatosPago): Promise<number> {
  if (!(datos.monto > 0)) throw new Error("El monto tiene que ser mayor que cero.");
  const montoUsd = aDolares(datos.monto, datos.moneda, datos.tasa);

  const r = await ejecutar(
    `insert into pagos (cliente_id, fecha, metodo, moneda, monto, tasa, monto_usd, referencia, nota)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.cliente_id,
      datos.fecha,
      datos.metodo,
      datos.moneda,
      redondear(datos.monto),
      datos.moneda === "VES" ? datos.tasa : null,
      montoUsd,
      datos.referencia,
      datos.nota,
    ],
  );
  return r.ultimoId;
}

export async function totalCobradoUsd(): Promise<number> {
  const f = await fila<{ t: number }>("select coalesce(sum(monto_usd), 0) as t from pagos");
  return redondear(Number(f?.t ?? 0));
}

/** La última tasa que se usó en un pago en bolívares, para sugerirla en el formulario. */
export async function ultimaTasa(): Promise<number | null> {
  const f = await fila<{ tasa: number }>(
    "select tasa from pagos where moneda = 'VES' and tasa is not null order by fecha desc, id desc limit 1",
  );
  return f?.tasa ?? null;
}
