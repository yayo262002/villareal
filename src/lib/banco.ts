import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { ejecutar, fila, filas } from "./db";
import { claveDelBanco, ponerClaveDelBanco, ponerUltimoContactoDelBanco, tasaEnFecha } from "./ajustes";
import { eliminarPago, registrarAbono } from "./pagos";
import { buscarClientePorTelefono, listarClientes, type ClienteConSaldo } from "./clientes";
import { listarVentas, type Venta } from "./ventas";
import { aplicarPagos } from "./cuentas";
import { crearAviso } from "./avisos";
import { empujarAviso } from "./push";
import { ROTULO_DEL_CLIENTE } from "./rotulo";
import { esMostrador } from "./pos";
import { telefonoLegible } from "./whatsapp";
import { pagosDeVenta } from "./pagos";
import { bs, fechaCorta, fechaEnVenezuela, horaDeLaBase, hoy, redondear, usd } from "./dinero";
import {
  COMO_SE_SUPO,
  clavesDelPagador,
  leerAvisoDelBanco,
  mismaReferencia,
  montoCuadra,
  montosParecidos,
  nombreParecido,
  referenciaDelClienteUtil,
  referenciaUtil,
  type ComoSeSupo,
} from "./banco-calculo";

/**
 * El pago móvil que entra al banco, abonado solo. El teléfono del negocio
 * (el que tiene el BDVapp) reenvía cada aviso del banco a `/api/banco`; aquí
 * se guarda y se busca de quién es, en este orden:
 *
 * 1. Ya estaba anotado (a mano, con su captura, o cobrado en la caja): se une
 *    a ese abono y no se cuenta dos veces.
 * 2. El cliente lo avisó desde su enlace de cuenta («Ya pagué», con la
 *    referencia y el monto).
 * 3. Ya había pagado antes desde ese teléfono o con ese nombre en el banco
 *    (se aprende cada vez que el dueño dice de quién era).
 * 4. Es el teléfono de un cliente de la cartera.
 *
 * Si se sabe, se le abona en bolívares con la tasa del día del pago, como
 * cualquier abono; si no, espera en la bandeja de Pago móvil (`/admin/banco`)
 * con lo que se le parece (lo que debe, su nombre) para elegirlo de un toque.
 * Cada pago que entra avisa en la campanita y en el teléfono del dueño.
 */

export type EstadoDelMovimiento = "por_conciliar" | "aplicado" | "no_es_abono" | "descartado";

export const ESTADOS_DEL_MOVIMIENTO: Record<EstadoDelMovimiento, string> = {
  por_conciliar: "Por identificar",
  aplicado: "Abonado",
  no_es_abono: "No es un abono",
  descartado: "Descartado",
};

export type MovimientoBanco = {
  id: number;
  banco: string;
  metodo: string;
  referencia: string;
  monto_bs: number;
  telefono: string;
  titular: string;
  fecha: string;
  hora: string;
  texto: string;
  origen: "telefono" | "a_mano";
  estado: EstadoDelMovimiento;
  /** Cómo se supo de quién era; «de_la_casa» si es de la familia del dueño (apartado, no es un abono). */
  como: ComoSeSupo | "" | "de_la_casa";
  cliente_id: number | null;
  pago_id: number | null;
  creado_en: string;
  resuelto_en: string | null;
  cliente_nombre: string | null;
  /** Lo que valió en dólares el abono que se hizo con él. */
  monto_usd: number | null;
};

const CONSULTA = `
  select m.*,
         case when c.id is null then null else ${ROTULO_DEL_CLIENTE} end as cliente_nombre,
         p.monto_usd as monto_usd
  from movimientos_banco m
  left join clientes c on c.id = m.cliente_id
  left join pagos p on p.id = m.pago_id
`;

export async function buscarMovimiento(id: number): Promise<MovimientoBanco | null> {
  return fila<MovimientoBanco>(`${CONSULTA} where m.id = ?`, [id]);
}

/** Los de un estado, los más nuevos primero. */
export async function listarMovimientos(estado: EstadoDelMovimiento, limite = 100): Promise<MovimientoBanco[]> {
  return filas<MovimientoBanco>(`${CONSULTA} where m.estado = ? order by m.fecha desc, m.hora desc, m.id desc limit ?`, [estado, limite]);
}

export async function contarPorIdentificar(): Promise<number> {
  const f = await fila<{ n: number }>("select count(*) as n from movimientos_banco where estado = 'por_conciliar'");
  return Number(f?.n ?? 0);
}

// ---------- La clave del teléfono ----------

/** Crea (o cambia) la clave con que el teléfono manda los avisos. La anterior deja de valer. */
export async function crearClaveDelBanco(): Promise<string> {
  const clave = randomBytes(18).toString("base64url");
  await ponerClaveDelBanco(clave);
  return clave;
}

/** Si la clave que llega es la buena, comparando en tiempo constante. Sin clave creada, nada vale. */
export async function claveDelBancoValida(recibida: string): Promise<boolean> {
  const buena = await claveDelBanco();
  if (!buena || !recibida) return false;
  const a = Buffer.from(recibida);
  const b = Buffer.from(buena);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------- Lo que llega del banco ----------

/** Si una referencia es el principio de la otra (con al menos seis cifras): la misma, cortada. */
function referenciaCortada(a: string, b: string): boolean {
  if (a.length < 6 || b.length < 6) return false;
  return a.length >= b.length ? a.startsWith(b) : b.startsWith(a);
}

export type Recibido =
  | { tipo: "no_es_pago"; motivo: string }
  | { tipo: "repetido"; movimiento: MovimientoBanco }
  | { tipo: "nuevo"; movimiento: MovimientoBanco };

/**
 * Guarda un aviso del banco y busca de quién es. Lo que no es un pago
 * recibido no se guarda (puede ser una clave del banco). El mismo aviso dos
 * veces (la misma referencia) es uno solo.
 */
/**
 * Un aviso del banco. `encabezado`: el día (y la hora) que dice la notificación en la captura, para el aviso que no
 * trae «en fecha» (la transferencia): sin él vale el día en que llegó al panel.
 */
/**
 * `confiable` en falso: llegó en una captura de la pantalla sin el encabezado del BDV delante (`separarAvisos`): se
 * guarda, pero no se abona solo; espera en la bandeja a que el dueño diga de quién es.
 */
export async function recibirDelBanco(
  texto: string,
  origen: "telefono" | "a_mano",
  encabezado: { fecha: string; hora: string | null } | null = null,
  confiable = true,
): Promise<Recibido> {
  const lectura = leerAvisoDelBanco(texto);
  if (origen === "telefono") {
    await ponerUltimoContactoDelBanco({ momento: new Date().toISOString(), era_un_pago: lectura.leido, motivo: lectura.leido ? "" : lectura.motivo });
  }
  if (!lectura.leido) return { tipo: "no_es_pago", motivo: lectura.motivo };
  const m = lectura.movimiento;
  const ahora = new Date();
  // Sin fecha en el aviso, o con una que no puede ser (de mañana), vale la de cuando llegó.
  const hoyEnVenezuela = fechaEnVenezuela(ahora);
  const delAviso = m.fecha && m.fecha <= hoyEnVenezuela ? m.fecha : null;
  const delEncabezado = !delAviso && encabezado && encabezado.fecha <= hoyEnVenezuela ? encabezado : null;
  const fecha = delAviso ?? delEncabezado?.fecha ?? hoyEnVenezuela;
  const hora = (delAviso && m.hora) || delEncabezado?.hora || horaDeLaBase(ahora.toISOString());

  const igual = await movimientoIgual(m.banco, m.referencia, m.monto_bs, m.telefono, m.titular, fecha);
  if (igual) return { tipo: "repetido", movimiento: igual };

  const r = await ejecutar(
    `insert or ignore into movimientos_banco (banco, metodo, referencia, monto_bs, telefono, titular, fecha, hora, texto, origen)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [m.banco, m.metodo, m.referencia, m.monto_bs, m.telefono, m.titular, fecha, hora, texto.replace(/\s+/g, " ").trim().slice(0, 600), origen],
  );
  if (r.cambios === 0) {
    // Llegó el mismo a la vez por otro lado.
    const otro = await movimientoIgual(m.banco, m.referencia, m.monto_bs, m.telefono, m.titular, fecha);
    if (otro) return { tipo: "repetido", movimiento: otro };
  }
  // El pago de alguien de la casa (la familia del dueño) no es un abono: se aparta solo y no se avisa.
  if (await esDeLaCasa(m)) {
    await ejecutar("update movimientos_banco set estado = 'no_es_abono', como = 'de_la_casa', resuelto_en = datetime('now') where id = ?", [r.ultimoId]);
    return { tipo: "nuevo", movimiento: (await buscarMovimiento(r.ultimoId))! };
  }
  if (confiable) await conciliar(r.ultimoId);
  const movimiento = (await buscarMovimiento(r.ultimoId))!;
  await avisarDelMovimiento(movimiento);
  return { tipo: "nuevo", movimiento };
}

async function movimientoIgual(
  banco: string,
  referencia: string,
  monto: number,
  telefono: string,
  titular: string,
  fecha: string,
): Promise<MovimientoBanco | null> {
  if (referencia) {
    const exacto = await fila<MovimientoBanco>(`${CONSULTA} where m.banco = ? and m.referencia = ?`, [banco, referencia]);
    if (exacto) return exacto;
    // Leído de una captura, el aviso puede venir cortado: la referencia a medias es el principio de la entera. El mismo
    // monto ese mismo día con una referencia que empieza igual es el mismo pago.
    const mismoMonto = await filas<MovimientoBanco>(`${CONSULTA} where m.banco = ? and m.fecha = ? and abs(m.monto_bs - ?) < 0.005 and m.referencia <> ''`, [
      banco,
      fecha,
      monto,
    ]);
    return mismoMonto.find((m) => referenciaCortada(m.referencia, referencia)) ?? null;
  }
  // Sin referencia: el mismo monto, de la misma persona, el mismo día y hace menos de media hora.
  return fila<MovimientoBanco>(
    `${CONSULTA} where m.referencia = '' and abs(m.monto_bs - ?) < 0.005 and m.telefono = ? and m.titular = ? and m.fecha = ?
     and m.creado_en >= datetime('now', '-30 minutes') order by m.id desc limit 1`,
    [monto, telefono, titular, fecha],
  );
}

/** Busca de quién es un movimiento que espera, y si lo sabe, se lo abona. */
async function conciliar(id: number): Promise<void> {
  const mov = await buscarMovimiento(id);
  if (!mov || mov.estado !== "por_conciliar") return;
  const conocido = await pagadorConocido(mov);
  const porTelefono = mov.telefono ? await buscarClientePorTelefono(mov.telefono) : null;
  const quien = conocido ?? porTelefono?.id ?? null;

  // 1. Ya anotado a mano o cobrado en la caja: se une a ese abono.
  const anotado = await pagoYaAnotado(mov, quien);
  if (anotado) {
    if (await unir(mov.id, anotado.id, anotado.cliente_id, "anotado")) await aprender(mov, anotado.cliente_id);
    return;
  }
  // 2. Lo avisó el cliente desde su enlace.
  const aviso = await avisoQueCuadra(mov);
  if (aviso) {
    if (await abonar(mov, aviso.cliente_id, "aviso")) {
      await ejecutar("update avisos_de_pago set estado = 'aplicado', movimiento_id = ? where id = ?", [mov.id, aviso.id]);
      await aprender(mov, aviso.cliente_id);
    }
    return;
  }
  // 3. Ya pagó antes desde ahí. 4. Es el teléfono de un cliente.
  if (conocido) await abonar(mov, conocido, "conocido");
  else if (porTelefono) await abonar(mov, porTelefono.id, "telefono");
}

async function pagadorConocido(mov: { telefono: string; titular: string }): Promise<number | null> {
  // El teléfono manda sobre el nombre: va primero.
  for (const clave of clavesDelPagador(mov)) {
    const f = await fila<{ cliente_id: number }>(
      "select p.cliente_id from pagadores p join clientes c on c.id = p.cliente_id where p.clave = ?",
      [clave],
    );
    if (f) return Number(f.cliente_id);
  }
  return null;
}

/** Recuerda a quien pagó desde ese teléfono o con ese nombre, para el siguiente. */
async function aprender(mov: { telefono: string; titular: string }, clienteId: number): Promise<void> {
  // Lo cobrado en el mostrador no dice nada de quién paga: quien pagó ahí no tiene cuenta.
  const cliente = await fila<{ nombre: string; telefono: string }>("select nombre, telefono from clientes where id = ?", [clienteId]);
  if (!cliente || esMostrador(cliente)) return;
  for (const clave of clavesDelPagador(mov)) {
    // Quien paga a nombre de un cliente no es de la casa.
    await ejecutar("delete from pagadores_de_la_casa where clave = ?", [clave]);
    await ejecutar(
      `insert into pagadores (clave, cliente_id) values (?, ?)
       on conflict(clave) do update set cliente_id = excluded.cliente_id`,
      [clave, clienteId],
    );
  }
}

type PagoAnotado = { id: number; cliente_id: number; monto: number; referencia: string; venta_id: number | null };

/**
 * Un abono en bolívares por pago móvil o transferencia, de esos días, que no
 * está unido todavía a nada del banco y es este mismo pago: con la misma
 * referencia (y casi el mismo monto), o sin referencia, con el mismo monto y
 * del mismo cliente si se sabe quién es. Lo cobrado en la caja se guarda
 * pasado de dólares, así que ahí vale medio por ciento de diferencia.
 */
async function pagoYaAnotado(mov: MovimientoBanco, quien: number | null): Promise<PagoAnotado | null> {
  const candidatos = await filas<PagoAnotado>(
    `select p.id, p.cliente_id, p.monto, p.referencia, p.venta_id from pagos p
     where p.moneda = 'VES' and p.metodo in ('pago_movil', 'transferencia')
       and p.fecha between date(?, '-3 day') and date(?, '+3 day')
       and not exists (select 1 from movimientos_banco m where m.pago_id = p.id)
     order by p.id`,
    [mov.fecha, mov.fecha],
  );
  const conReferencia = candidatos.filter((p) => mismaReferencia(p.referencia, mov.referencia) && montosParecidos(Number(p.monto), mov.monto_bs, 0.01));
  if (conReferencia.length > 0) return masParecido(conReferencia, mov.monto_bs);
  const sinReferencia = candidatos.filter(
    (p) =>
      !referenciaUtil(p.referencia) &&
      (quien === null || p.cliente_id === quien) &&
      montosParecidos(Number(p.monto), mov.monto_bs, p.venta_id ? 0.005 : 0),
  );
  return sinReferencia.length === 1 ? sinReferencia[0] : null;
}

function masParecido<P extends { monto: number }>(lista: P[], monto: number): P {
  return [...lista].sort((a, b) => Math.abs(Number(a.monto) - monto) - Math.abs(Number(b.monto) - monto))[0];
}

type AvisoDePago = { id: number; cliente_id: number; referencia: string; monto_bs: number; estado: string; creado_en: string };

async function avisoQueCuadra(mov: MovimientoBanco): Promise<AvisoDePago | null> {
  if (!referenciaUtil(mov.referencia)) return null;
  const pendientes = await filas<AvisoDePago>(
    "select * from avisos_de_pago where estado = 'pendiente' and creado_en >= datetime('now', '-30 days') order by id",
  );
  // Seis cifras de la referencia y el mismo monto al céntimo: con menos, quien vio la captura de otro podía quedarse con su pago.
  const cuadran = pendientes.filter(
    (a) => referenciaDelClienteUtil(a.referencia) && mismaReferencia(a.referencia, mov.referencia) && montosParecidos(Number(a.monto_bs), mov.monto_bs),
  );
  // Dos clientes que dicen haber hecho el mismo pago: que decida el dueño.
  if (cuadran.length === 0 || new Set(cuadran.map((a) => a.cliente_id)).size > 1) return null;
  // Si el pago salió del teléfono de otro cliente, tampoco: que decida el dueño.
  if (await deOtroCliente(mov, cuadran[0].cliente_id)) return null;
  return cuadran[0];
}

/** Si el pago salió del teléfono de un cliente distinto de ese. */
async function deOtroCliente(mov: { telefono: string }, clienteId: number): Promise<boolean> {
  if (!mov.telefono) return false;
  const dueno = await buscarClientePorTelefono(mov.telefono);
  return Boolean(dueno && dueno.id !== clienteId);
}

/** Une el movimiento a un abono, si sigue esperando. Dice si lo unió. */
async function unir(movId: number, pagoId: number, clienteId: number, como: ComoSeSupo): Promise<boolean> {
  const r = await ejecutar(
    `update movimientos_banco set estado = 'aplicado', como = ?, cliente_id = ?, pago_id = ?, resuelto_en = datetime('now')
     where id = ? and estado = 'por_conciliar'`,
    [como, clienteId, pagoId, movId],
  );
  return r.cambios > 0;
}

/**
 * Abona el movimiento a un cliente: un pago en bolívares con la tasa del día
 * del pago, como cualquier abono. Sin tasa conocida no se puede pasar a
 * dólares, y se queda esperando. Dice si lo abonó.
 */
async function abonar(mov: MovimientoBanco, clienteId: number, como: ComoSeSupo): Promise<boolean> {
  const tasa = await tasaEnFecha(mov.fecha);
  if (!tasa) return false;
  const { id: pagoId } = await registrarAbono({
    cliente_id: clienteId,
    fecha: mov.fecha,
    metodo: mov.metodo === "transferencia" ? "transferencia" : "pago_movil",
    moneda: "VES",
    monto: mov.monto_bs,
    tasa: tasa.valor,
    referencia: mov.referencia,
    nota: como === "a_mano" ? `Del banco (${mov.banco}), elegido en Pago móvil` : `Entró solo del banco (${mov.banco}): ${COMO_SE_SUPO[como]}`,
  });
  if (await unir(mov.id, pagoId, clienteId, como)) return true;
  // Otro lo abonó mientras tanto: este abono sobra.
  await eliminarPago(pagoId);
  return false;
}

// ---------- Lo que hace el dueño en la bandeja ----------

/** El dueño dice de quién es un pago que esperaba. Se le abona y se recuerda para el siguiente. */
export async function abonarMovimientoA(movId: number, clienteId: number): Promise<MovimientoBanco> {
  const mov = await buscarMovimiento(movId);
  if (!mov) throw new Error("No se encontró ese pago del banco.");
  if (mov.estado !== "por_conciliar") throw new Error("Ese pago ya no está por identificar: recarga la página.");
  if (!(await abonar(mov, clienteId, "a_mano"))) {
    throw new Error(`No hay tasa guardada para el ${fechaCorta(mov.fecha)}: ponla en Productos y vuelve a intentarlo.`);
  }
  await aprender(mov, clienteId);
  return (await buscarMovimiento(movId))!;
}

/**
 * Deshace lo que se abonó: el abono que hizo el banco se borra y el pago
 * vuelve a la bandeja. Si era un abono anotado a mano, ese se queda (es del
 * dueño) y solo se separa del banco. Lo aprendido de ese teléfono se olvida.
 */
export async function deshacerMovimiento(movId: number): Promise<MovimientoBanco> {
  const mov = await buscarMovimiento(movId);
  if (!mov) throw new Error("No se encontró ese pago del banco.");
  if (mov.estado !== "aplicado") throw new Error("Ese pago no está abonado.");
  if (mov.como === "anotado" || !mov.pago_id) {
    await ejecutar(
      "update movimientos_banco set estado = 'por_conciliar', como = '', cliente_id = null, pago_id = null, resuelto_en = null where id = ?",
      [movId],
    );
  } else {
    await eliminarPago(mov.pago_id);
  }
  if (mov.cliente_id) {
    for (const clave of clavesDelPagador(mov)) await ejecutar("delete from pagadores where clave = ? and cliente_id = ?", [clave, mov.cliente_id]);
  }
  return (await buscarMovimiento(movId))!;
}

// ---------- Los de la casa ----------

/** Si quien pagó es de la casa (la familia del dueño): por su teléfono o su nombre en el banco. */
async function esDeLaCasa(mov: { telefono: string; titular: string }): Promise<boolean> {
  const claves = clavesDelPagador(mov);
  if (claves.length === 0) return false;
  const f = await fila<{ n: number }>(`select count(*) as n from pagadores_de_la_casa where clave in (${claves.map(() => "?").join(", ")})`, claves);
  return Number(f?.n ?? 0) > 0;
}

/** Quienes pagan y son de la casa, como se ven: el nombre o el teléfono. */
export async function pagadoresDeLaCasa(): Promise<{ clave: string; quien: string }[]> {
  const lista = await filas<{ clave: string }>("select clave from pagadores_de_la_casa order by clave");
  return lista.map(({ clave }) => ({
    clave,
    quien: clave.startsWith("tel:")
      ? telefonoLegible(clave.slice(4))
      : clave
          .replace(/^nombre:/, "")
          .split(" ")
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join(" "),
  }));
}

/**
 * «Es de la casa»: ese pago no es de un cliente y quien lo hizo tampoco lo será; sus pagos siguientes se apartan solos.
 * Los que esperan del mismo pagador se apartan también. Devuelve cuántos se apartaron.
 */
export async function marcarDeLaCasa(movId: number): Promise<number> {
  const mov = await buscarMovimiento(movId);
  if (!mov) throw new Error("No se encontró ese pago del banco.");
  if (mov.estado !== "por_conciliar" && mov.estado !== "no_es_abono") throw new Error("Ese pago ya está abonado: deshazlo primero.");
  const claves = clavesDelPagador(mov);
  if (claves.length === 0) throw new Error("Ese aviso no dice quién pagó (ni nombre ni teléfono): márcalo «No es de un cliente».");
  for (const clave of claves) {
    await ejecutar("insert or ignore into pagadores_de_la_casa (clave) values (?)", [clave]);
    // Ya no se le tiene por quien paga a nombre de un cliente.
    await ejecutar("delete from pagadores where clave = ?", [clave]);
  }
  let apartados = 0;
  for (const otro of [mov, ...(await listarMovimientos("por_conciliar", 500))]) {
    if (otro.id !== mov.id && !clavesDelPagador(otro).some((c) => claves.includes(c))) continue;
    const r = await ejecutar(
      "update movimientos_banco set estado = 'no_es_abono', como = 'de_la_casa', resuelto_en = datetime('now') where id = ? and estado in ('por_conciliar', 'no_es_abono')",
      [otro.id],
    );
    apartados += r.cambios;
  }
  return apartados;
}

/** Deja de tener a alguien por de la casa: sus pagos siguientes vuelven a esperar en la bandeja. */
export async function olvidarDeLaCasa(clave: string): Promise<void> {
  await ejecutar("delete from pagadores_de_la_casa where clave = ?", [clave]);
}

/** «No es un abono», «Descartar» y «Volver a la bandeja». */
export async function cambiarEstadoDelMovimiento(movId: number, estado: "no_es_abono" | "descartado" | "por_conciliar"): Promise<void> {
  const desde = estado === "por_conciliar" ? ["no_es_abono", "descartado"] : ["por_conciliar"];
  const r = await ejecutar(
    `update movimientos_banco set estado = ?, resuelto_en = ${estado === "por_conciliar" ? "null, como = ''" : "datetime('now')"}
     where id = ? and estado in (?, ?)`,
    [estado, movId, desde[0], desde[1] ?? desde[0]],
  );
  if (r.cambios === 0) throw new Error("Ese pago ya cambió: recarga la página.");
}

/**
 * Un abono anotado a mano o cobrado en la caja por pago móvil o
 * transferencia: si es un pago que ya entró del banco, se unen y no se
 * cuenta dos veces. Si el banco ya lo había abonado solo, ese abono se borra
 * y queda el anotado (con su captura, o con su venta). Devuelve qué pasó,
 * para decírselo al dueño, o vacío.
 */
export async function unirPagoConElBanco(pagoId: number): Promise<string> {
  const pago = await fila<PagoAnotado & { fecha: string; metodo: string; moneda: string }>(
    "select id, cliente_id, fecha, metodo, moneda, monto, referencia, venta_id from pagos where id = ?",
    [pagoId],
  );
  if (!pago || pago.moneda !== "VES" || !["pago_movil", "transferencia"].includes(pago.metodo)) return "";
  const candidatos = (
    await filas<MovimientoBanco>(
      `${CONSULTA} where m.fecha between date(?, '-3 day') and date(?, '+3 day')
       and (m.estado = 'por_conciliar' or (m.estado = 'aplicado' and m.como <> 'anotado'))
       order by m.id`,
      [pago.fecha, pago.fecha],
    )
  ).filter((m) => m.pago_id !== pago.id);

  let elegido: MovimientoBanco | null = null;
  if (referenciaUtil(pago.referencia)) {
    const iguales = candidatos.filter((m) => mismaReferencia(m.referencia, pago.referencia) && montosParecidos(m.monto_bs, Number(pago.monto), 0.01));
    elegido = iguales.length > 0 ? iguales[0] : null;
  } else {
    const iguales = candidatos.filter(
      (m) =>
        montosParecidos(m.monto_bs, Number(pago.monto), pago.venta_id ? 0.005 : 0) && (m.estado === "por_conciliar" || m.cliente_id === pago.cliente_id),
    );
    elegido = iguales.length === 1 ? iguales[0] : null;
  }
  if (!elegido) return "";

  const antes = elegido.estado === "aplicado" ? { pago: elegido.pago_id, cliente: elegido.cliente_id, nombre: elegido.cliente_nombre } : null;
  // El abono que había hecho el banco se borra (el movimiento vuelve a esperar) y se une al anotado.
  if (antes?.pago) await eliminarPago(antes.pago);
  if (!(await unir(elegido.id, pago.id, pago.cliente_id, "anotado"))) return "";
  await aprender(elegido, pago.cliente_id);
  if (!antes) return ` Era el pago móvil de ${bs(elegido.monto_bs)} que esperaba en la bandeja del banco: ya quedó unido.`;
  if (antes.cliente === pago.cliente_id) return ` Este pago ya había entrado solo del banco: quedó uno solo, este.`;
  return ` Este pago había entrado del banco y se había abonado a ${antes.nombre ?? "otro cliente"}; ahora es de este cliente, y a aquel se le quitó.`;
}

/** Los pagos por pago móvil o transferencia de una venta de la caja, unidos con lo que entró del banco. */
export async function unirVentaConElBanco(ventaId: number): Promise<void> {
  for (const p of await pagosDeVenta(ventaId)) await unirPagoConElBanco(p.id);
}

// ---------- «Ya pagué», desde el enlace del cliente ----------

export type ResultadoDelAviso = "abonado" | "ya_abonado" | "esperando";

/**
 * El cliente avisa desde su enlace que pagó, con la referencia y el monto.
 * Si ese pago ya entró al banco y espera, se le abona en el momento; si no
 * ha llegado, se le abona solo cuando llegue.
 */
export async function avisoDePagoDelCliente(cliente: { id: number; rotulo: string }, referencia: string, montoBs: number): Promise<ResultadoDelAviso> {
  const recientes = await filas<MovimientoBanco>(`${CONSULTA} where m.creado_en >= datetime('now', '-30 days') and m.estado in ('por_conciliar', 'aplicado')`);
  const igual = referenciaDelClienteUtil(referencia) ? recientes.find((m) => mismaReferencia(m.referencia, referencia) && montosParecidos(m.monto_bs, montoBs)) : undefined;
  if (igual?.estado === "aplicado" && igual.cliente_id === cliente.id) return "ya_abonado";

  const r = await ejecutar("insert into avisos_de_pago (cliente_id, referencia, monto_bs) values (?, ?, ?)", [
    cliente.id,
    referencia.replace(/\D/g, ""),
    redondear(montoBs),
  ]);
  if (igual?.estado === "por_conciliar" && !(await deOtroCliente(igual, cliente.id)) && (await abonar(igual, cliente.id, "aviso"))) {
    await ejecutar("update avisos_de_pago set estado = 'aplicado', movimiento_id = ? where id = ?", [igual.id, r.ultimoId]);
    await aprender(igual, cliente.id);
    await crearAviso({
      clave: `banco-aviso-${r.ultimoId}`,
      tipo: "banco",
      titulo: `${cliente.rotulo} avisó su pago de ${bs(montoBs)}`,
      cuerpo: "Ya había entrado al banco: quedó abonado a su cuenta.",
      url: `/admin/clientes/${cliente.id}`,
    });
    return "abonado";
  }
  await crearAviso({
    clave: `banco-aviso-${r.ultimoId}`,
    tipo: "banco",
    titulo: `${cliente.rotulo} dice que pagó ${bs(montoBs)}`,
    cuerpo:
      igual?.estado === "aplicado"
        ? `Con la referencia ${referencia}, pero ese pago se abonó a ${igual.cliente_nombre ?? "otro cliente"}. Revísalo en Pago móvil.`
        : `Referencia ${referencia}. Aún no ha llegado al banco: se le abona solo cuando llegue.`,
    url: "/admin/banco",
  });
  return "esperando";
}

/** Cuántos avisos de pago ha mandado un cliente en el último día: para que nadie llene la base. */
export async function avisosRecientesDelCliente(clienteId: number): Promise<number> {
  const f = await fila<{ n: number }>("select count(*) as n from avisos_de_pago where cliente_id = ? and creado_en >= datetime('now', '-1 day')", [clienteId]);
  return Number(f?.n ?? 0);
}

export type AvisoDePagoPendiente = AvisoDePago & { cliente_nombre: string };

/** Lo que los clientes dicen que pagaron y aún no llega al banco. */
export async function avisosDePagoPendientes(): Promise<AvisoDePagoPendiente[]> {
  return filas<AvisoDePagoPendiente>(
    `select a.*, ${ROTULO_DEL_CLIENTE} as cliente_nombre from avisos_de_pago a join clientes c on c.id = a.cliente_id
     where a.estado = 'pendiente' and a.creado_en >= datetime('now', '-30 days') order by a.id desc`,
  );
}

export async function quitarAvisoDePago(id: number): Promise<void> {
  await ejecutar("update avisos_de_pago set estado = 'quitado' where id = ? and estado = 'pendiente'", [id]);
}

// ---------- Lo que se le parece, para la bandeja ----------

export type Sugerencia = { cliente_id: number; nombre: string; motivo: string };

/**
 * A quién se le parece cada pago que espera: el cliente con un nombre como
 * el del banco, o al que el monto (pasado a dólares con la tasa de ese día)
 * le cuadra con lo que debe o con una de sus notas. Solo se propone.
 */
export async function sugerenciasPara(movimientos: MovimientoBanco[]): Promise<Map<number, Sugerencia[]>> {
  const resultado = new Map<number, Sugerencia[]>();
  if (movimientos.length === 0) return resultado;
  const [clientes, ventas] = await Promise.all([listarClientes(), listarVentas(100000)]);
  const notasDe = new Map<number, Venta[]>();
  for (const v of ventas) notasDe.set(v.cliente_id, [...(notasDe.get(v.cliente_id) ?? []), v]);
  const deudas = new Map<number, number[]>(
    clientes
      .filter((c) => c.saldo_usd > 0)
      .map((c) => [c.id, [c.saldo_usd, ...aplicarPagos(notasDe.get(c.id) ?? [], c.total_pagado_usd).map((n) => n.pendiente_usd)]]),
  );
  for (const mov of movimientos) {
    const tasa = await tasaEnFecha(mov.fecha);
    const montoUsd = tasa ? redondear(mov.monto_bs / tasa.valor) : null;
    const lista: Sugerencia[] = [];
    for (const c of clientes) {
      const motivos: string[] = [];
      if (mov.titular && nombreParecido(mov.titular, [c.nombre, c.razon_social ?? ""])) motivos.push("su nombre se parece");
      if (montoUsd !== null && montoCuadra(montoUsd, deudas.get(c.id) ?? [])) motivos.push(`debe casi eso (${usd(c.saldo_usd)} en total)`);
      if (motivos.length > 0) lista.push({ cliente_id: c.id, nombre: c.rotulo, motivo: motivos.join(" y ") });
    }
    // Primero los que cuadran por las dos cosas; como mucho, tres.
    resultado.set(mov.id, lista.sort((a, b) => b.motivo.length - a.motivo.length).slice(0, 3));
  }
  return resultado;
}

/** Los clientes para elegir en la bandeja, por su nombre. */
export async function clientesParaElegir(): Promise<Pick<ClienteConSaldo, "id" | "rotulo" | "telefono" | "saldo_usd">[]> {
  return (await listarClientes())
    .filter((c) => !esMostrador(c))
    .map((c) => ({ id: c.id, rotulo: c.rotulo, telefono: c.telefono, saldo_usd: c.saldo_usd }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "es"));
}

// ---------- Avisos ----------

/** Lo que se dice de un pago que entró: en la campanita y en el teléfono. */
export function avisoDelMovimiento(mov: MovimientoBanco): { titulo: string; cuerpo: string; url: string } {
  const ref = mov.referencia ? ` Ref. ${mov.referencia}.` : "";
  if (mov.estado === "aplicado" && mov.como === "anotado") {
    return {
      titulo: `Llegó al banco el pago de ${mov.cliente_nombre}: ${bs(mov.monto_bs)}`,
      cuerpo: `Ya estaba anotado: no se cuenta dos veces.${ref}`,
      url: `/admin/clientes/${mov.cliente_id}`,
    };
  }
  if (mov.estado === "aplicado") {
    return {
      titulo: `Pago móvil de ${mov.cliente_nombre}: ${bs(mov.monto_bs)}`,
      cuerpo: `Abonado solo a su cuenta${mov.monto_usd !== null ? ` (${usd(Number(mov.monto_usd))})` : ""}, ${COMO_SE_SUPO[mov.como && mov.como !== "de_la_casa" ? mov.como : "a_mano"]}.${ref}`,
      url: `/admin/clientes/${mov.cliente_id}`,
    };
  }
  const quien = [mov.titular, mov.telefono].filter(Boolean).join(" · ") || "sin teléfono ni nombre";
  return {
    titulo: `Pago móvil por identificar: ${bs(mov.monto_bs)}`,
    cuerpo: `${quien}.${ref} Dime de quién es en Pago móvil.`,
    url: "/admin/banco",
  };
}

async function avisarDelMovimiento(mov: MovimientoBanco): Promise<void> {
  const aviso = avisoDelMovimiento(mov);
  await crearAviso({ clave: `banco-${mov.id}`, tipo: "banco", ...aviso });
  try {
    await empujarAviso({ ...aviso, etiqueta: `banco-${mov.id}` });
  } catch {
    // Si el aviso al teléfono falla, el pago ya está guardado y en la campanita.
  }
}

/** Para el Resumen: cuántos esperan y cuánto entró hoy por el banco. */
export async function resumenDelBanco(): Promise<{ por_identificar: number; hoy_bs: number; hoy_cuantos: number }> {
  const f = await fila<{ por_identificar: number; hoy_bs: number; hoy_cuantos: number }>(
    `select (select count(*) from movimientos_banco where estado = 'por_conciliar') as por_identificar,
            coalesce((select sum(monto_bs) from movimientos_banco where fecha = ? and estado in ('por_conciliar', 'aplicado')), 0) as hoy_bs,
            (select count(*) from movimientos_banco where fecha = ? and estado in ('por_conciliar', 'aplicado')) as hoy_cuantos`,
    [hoy(), hoy()],
  );
  return { por_identificar: Number(f?.por_identificar ?? 0), hoy_bs: Number(f?.hoy_bs ?? 0), hoy_cuantos: Number(f?.hoy_cuantos ?? 0) };
}

/** Lo que dijo el banco de un abono que entró por ahí: para enseñarlo en el historial del cliente. */
export type DelBanco = { pago_id: number; banco: string; como: ComoSeSupo | ""; fecha: string; hora: string; telefono: string; titular: string; referencia: string };

export async function delBancoPorPago(pagoIds: number[]): Promise<Map<number, DelBanco>> {
  if (pagoIds.length === 0) return new Map();
  const huecos = pagoIds.map(() => "?").join(", ");
  const lista = await filas<DelBanco>(
    `select pago_id, banco, como, fecha, hora, telefono, titular, referencia from movimientos_banco where estado = 'aplicado' and pago_id in (${huecos})`,
    pagoIds,
  );
  return new Map(lista.map((m) => [Number(m.pago_id), m]));
}
