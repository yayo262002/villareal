import "server-only";
import { ejecutar, fila, filas } from "./db";
import { aDolares, fechaCorta, redondear, usd, type MetodoPago, type Moneda } from "./dinero";
import { aplicarPagos, centimosDeLaTasa, type CentimosDeLaTasa } from "./cuentas";
import { leerTasa } from "./ajustes";
import { ROTULO_DEL_CLIENTE } from "./clientes";

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
  /** Cuántas capturas (comprobantes) tiene guardadas: 0 o 1 normalmente. */
  con_comprobante: number;
  /** La venta que se cobró en la caja, si el pago salió de ahí. */
  venta_id: number | null;
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
  /** La venta que se cobró en la caja, si el pago salió de ahí. */
  venta_id?: number | null;
};

const CONSULTA_PAGOS = `
  select p.*, ${ROTULO_DEL_CLIENTE} as cliente_nombre,
         (select count(*) from adjuntos a where a.pago_id = p.id) as con_comprobante
  from pagos p
  join clientes c on c.id = p.cliente_id
`;

export async function listarPagos(limite = 100): Promise<Pago[]> {
  return filas<Pago>(`${CONSULTA_PAGOS} order by p.fecha desc, p.id desc limit ?`, [limite]);
}

/** Los pagos con los que se cobró una venta en la caja, en orden. */
export async function pagosDeVenta(ventaId: number): Promise<Pago[]> {
  return filas<Pago>(`${CONSULTA_PAGOS} where p.venta_id = ? order by p.id`, [ventaId]);
}

export async function listarPagosDeCliente(clienteId: number): Promise<Pago[]> {
  return filas<Pago>(`${CONSULTA_PAGOS} where p.cliente_id = ? order by p.fecha desc, p.id desc`, [clienteId]);
}

export async function buscarPago(id: number): Promise<Pago | null> {
  return fila<Pago>(`${CONSULTA_PAGOS} where p.id = ?`, [id]);
}

/** Borra un pago. Devuelve false si no existía. */
export async function eliminarPago(id: number): Promise<boolean> {
  // La captura se queda con el cliente, sin abono: en Turso no se puede contar con la clave foránea.
  await ejecutar("update adjuntos set pago_id = null where pago_id = ?", [id]);
  // Si el pago entró por el banco, el movimiento vuelve a la bandeja de Pago móvil: el dinero entró, aunque el abono ya no esté.
  await ejecutar(
    "update movimientos_banco set estado = 'por_conciliar', como = '', cliente_id = null, pago_id = null, resuelto_en = null where pago_id = ?",
    [id],
  );
  const r = await ejecutar("delete from pagos where id = ?", [id]);
  return r.cambios > 0;
}

/** Lo que se acomodó de un abono por los céntimos de la tasa, para decírselo al dueño. */
export type Acomodo = CentimosDeLaTasa & { antes: number; fechas: string[] };

/**
 * Si un abono en bolívares de ese cliente paga notas enteras con unos céntimos de más o de menos por la tasa
 * (`centimosDeLaTasa`), lo que pasaría a valer y de qué notas; null si no hay nada que acomodar.
 */
export async function acomodoDeCentimos(clienteId: number, abonoUsd: number): Promise<Acomodo | null> {
  const [ventas, pagado] = await Promise.all([
    filas<{ id: number; fecha: string; total_usd: number }>("select id, fecha, total_usd from ventas where cliente_id = ?", [clienteId]),
    fila<{ total: number }>("select coalesce(sum(monto_usd), 0) as total from pagos where cliente_id = ?", [clienteId]),
  ]);
  const abiertas = aplicarPagos(ventas, Number(pagado?.total ?? 0))
    .filter((v) => v.pendiente_usd > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
  const centimos = centimosDeLaTasa(
    abiertas.map((v) => v.pendiente_usd),
    abonoUsd,
  );
  if (!centimos) return null;
  return { ...centimos, antes: redondear(abonoUsd), fechas: abiertas.slice(0, centimos.notas).map((v) => fechaCorta(v.fecha).slice(0, 5)) };
}

/** «la nota del 10/11», «las notas del 26/10 y del 30/10». */
export function lasNotasDel(fechas: string[]): string {
  if (fechas.length === 1) return `la nota del ${fechas[0]}`;
  return `las notas del ${fechas.slice(0, -1).join(", del ")} y del ${fechas[fechas.length - 1]}`;
}

/**
 * Un abono del cliente (desde su ficha, desde Abonos o desde el banco): si es en bolívares y paga notas enteras con
 * céntimos de diferencia por la tasa, vale exactamente esas notas (los bolívares no cambian: cambia la tasa a la que
 * se pasan a dólares) y lo dice en su nota. Lo cobrado en la caja no pasa por aquí: va con su venta.
 */
export async function registrarAbono(datos: DatosPago): Promise<{ id: number; acomodo: Acomodo | null }> {
  if (datos.moneda !== "VES" || !datos.tasa || datos.tasa <= 0 || !(datos.monto > 0)) return { id: await registrarPago(datos), acomodo: null };
  const acomodo = await acomodoDeCentimos(datos.cliente_id, aDolares(datos.monto, datos.moneda, datos.tasa));
  if (!acomodo) return { id: await registrarPago(datos), acomodo: null };
  const nota = [datos.nota.trim(), `Vale ${usd(acomodo.usd)}, ${lasNotasDel(acomodo.fechas)}: céntimos de la tasa acomodados (eran ${usd(acomodo.antes)})`]
    .filter(Boolean)
    .join(" · ");
  const id = await registrarPago({ ...datos, nota }, acomodo.usd);
  return { id, acomodo };
}

/**
 * El equivalente en dólares se calcula al guardar y se conserva junto a la
 * tasa. Así el saldo del cliente no se mueve si la tasa de mañana es otra.
 * `usdAcomodado`: lo que vale un abono en bolívares con los céntimos de la
 * tasa acomodados (`registrarAbono`); la tasa guardada es entonces la que da
 * justo eso.
 */
export async function registrarPago(datos: DatosPago, usdAcomodado?: number): Promise<number> {
  if (!(datos.monto > 0)) throw new Error("El monto tiene que ser mayor que cero.");
  const montoUsd = usdAcomodado !== undefined && datos.moneda === "VES" ? redondear(usdAcomodado) : aDolares(datos.monto, datos.moneda, datos.tasa);
  const tasa = usdAcomodado !== undefined && datos.moneda === "VES" && montoUsd > 0 ? Math.round((datos.monto / montoUsd) * 10000) / 10000 : datos.tasa;
  // Bs 1 a la tasa de hoy son USD 0,00: se guardaría un abono que no abona nada.
  if (!(montoUsd > 0)) throw new Error("Ese monto no llega a un centavo de dólar. Revisa el monto y la tasa.");

  const r = await ejecutar(
    `insert into pagos (cliente_id, fecha, metodo, moneda, monto, tasa, monto_usd, referencia, nota, venta_id)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.cliente_id,
      datos.fecha,
      datos.metodo,
      datos.moneda,
      redondear(datos.monto),
      datos.moneda === "VES" ? tasa : null,
      montoUsd,
      datos.referencia,
      datos.nota,
      datos.venta_id ?? null,
    ],
  );
  return r.ultimoId;
}

export async function totalCobradoUsd(): Promise<number> {
  const f = await fila<{ t: number }>("select coalesce(sum(monto_usd), 0) as t from pagos");
  return redondear(Number(f?.t ?? 0));
}

/**
 * La tasa que se propone en el formulario de pago: la del día si el dueño
 * la puso en Productos; si no, la del último pago en bolívares.
 */
export async function ultimaTasa(): Promise<number | null> {
  const delDia = await leerTasa();
  if (delDia) return delDia.valor;
  const f = await fila<{ tasa: number }>(
    "select tasa from pagos where moneda = 'VES' and tasa is not null order by fecha desc, id desc limit 1",
  );
  return f?.tasa ?? null;
}

/**
 * Un abono igual (mismo cliente, fecha, método, moneda y monto) anotado hace
 * un momento: casi siempre es el botón pulsado dos veces, no dos abonos. El
 * que entró solo del banco no cuenta: el anotado a mano se une con él.
 */
export async function pagoRepetidoReciente(
  datos: { cliente_id: number; fecha: string; metodo: string; moneda: string; monto: number },
  minutos = 10,
): Promise<{ id: number; fecha: string; monto_usd: number } | null> {
  return fila<{ id: number; fecha: string; monto_usd: number }>(
    `select id, fecha, monto_usd from pagos
     where cliente_id = ? and fecha = ? and metodo = ? and moneda = ? and abs(monto - ?) < 0.005 and creado_en >= datetime('now', ?)
       -- El que abonó solo el banco no cuenta: anotarlo a mano lo une con él (unirPagoConElBanco), no lo repite.
       and not exists (select 1 from movimientos_banco m where m.pago_id = pagos.id and m.como <> 'anotado')
     order by id desc limit 1`,
    [datos.cliente_id, datos.fecha, datos.metodo, datos.moneda, datos.monto, `-${minutos} minutes`],
  );
}
