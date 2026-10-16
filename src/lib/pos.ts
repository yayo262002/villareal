import "server-only";
import { ejecutar, fila } from "./db";
import { listarProductos } from "./productos";
import { listarVariantes } from "./variantes";
import { listarFamilias } from "./familias";
import { presentacionDe, vendiblesDe, type Vendible } from "./catalogo";
import { existencias } from "./inventario";
import type { EstadoDeExistencia } from "./stock";
import type { PesoTipico } from "./piezas";
import { buscarCliente, crearCliente, listarClientes, type Cliente, type ClienteConSaldo } from "./clientes";
import { buscarVentaPorClavePos, crearVenta, type LineaVenta } from "./ventas";
import { registrarPago } from "./pagos";
import { monedaDelMetodo, redondear } from "./dinero";
import { totalesDe, type LineaDelPos, type ModoDePago, type PagoDelPos } from "./pos-calculo";

/**
 * La caja (el punto de venta) desde la base: el catálogo con lo que hay de
 * cada artículo, el cliente de mostrador y el guardado de la venta, que
 * crea la venta y sus pagos con lo que ya existe (el inventario baja solo
 * porque las líneas de venta ya restan; la cuenta del cliente es la de
 * siempre: la venta suma y cada pago resta). Lo que se revisa antes de
 * guardar está en `acciones.ts`, con las mismas reglas del formulario de
 * siempre.
 */

export type ArticuloDelPos = Vendible & {
  /** El nombre del tipo de producto solo («Mozzarella»), sin la marca. */
  tipo: string;
  existencia: number | null;
  estado: EstadoDeExistencia;
  familia: string;
  /** «Bolsa de 2,5 kg», o nada. */
  presentacionTexto: string;
  /** Lo que suele pesar una pieza, si ya se aprendió de las notas. */
  pesoTipico: PesoTipico | null;
};

export async function catalogoDelPos(): Promise<ArticuloDelPos[]> {
  const [productos, variantes, familias, stock] = await Promise.all([listarProductos(true), listarVariantes(), listarFamilias(), existencias()]);
  const nombreDeFamilia = new Map(familias.map((f) => [f.id, f.nombre]));
  const existenciaDe = new Map(stock.map((e) => [e.clave, e]));
  const porProducto = new Map(productos.map((p) => [p.id, p]));
  const porVariante = new Map(variantes.map((v) => [v.id, v]));
  return vendiblesDe(productos, variantes).map((v) => {
    const e = existenciaDe.get(v.clave);
    const producto = porProducto.get(v.producto_id);
    const variante = v.variante_id ? porVariante.get(v.variante_id) : null;
    return {
      ...v,
      tipo: producto?.nombre ?? v.nombre,
      existencia: e?.seguido ? e.existencia : null,
      estado: e?.estado ?? "sin_seguir",
      familia: producto?.familia_id ? (nombreDeFamilia.get(producto.familia_id) ?? "") : "",
      presentacionTexto: presentacionDe(variante ?? producto ?? { presentacion: "", contenido: "" }),
      pesoTipico: e?.pesoPorPieza ?? null,
    };
  });
}

export const NOMBRE_DEL_MOSTRADOR = "Mostrador";

/** El cliente de mostrador es el de las ventas sin cliente: no tiene cuenta, paga en el momento. */
export function esMostrador(cliente: Pick<Cliente, "nombre" | "telefono">): boolean {
  return cliente.nombre === NOMBRE_DEL_MOSTRADOR && !cliente.telefono;
}

/** El cliente de las ventas sin cliente: se crea la primera vez que hace falta. */
export async function clienteDeMostrador(): Promise<ClienteConSaldo> {
  const existente = (await listarClientes()).find(esMostrador);
  if (existente) return existente;
  const id = await crearCliente({
    nombre: NOMBRE_DEL_MOSTRADOR,
    telefono: "",
    cedula_rif: "",
    direccion: "",
    tipo: "mayor",
    nota: "Las ventas de la caja sin cliente: quien compra y paga en el momento.",
    dias_credito: 0,
    razon_social: "",
  });
  return (await buscarCliente(id))!;
}

/** El número que llevará la siguiente nota (el de la venta que se cree ahora, si nadie se adelanta). */
export async function siguienteNumeroDeVenta(): Promise<number> {
  const f = await fila<{ siguiente: number }>("select coalesce((select seq from sqlite_sequence where name = 'ventas'), (select max(id) from ventas), 0) + 1 as siguiente");
  return Number(f?.siguiente ?? 1);
}

export type VentaDelPos = {
  /** Un número al azar que pone la caja: si la misma venta llega dos veces, es una sola. */
  clave_pos: string;
  cliente_id: number;
  /** La fecha de la nota de papel (puede ser de días atrás): los días de crédito cuentan desde ahí. */
  fecha: string;
  cajero: string;
  descuento_usd: number;
  nota: string;
  modo: ModoDePago;
  /** «ahora»: entregada en el momento; «despacho»: queda por entregar el día previsto. */
  entrega: "ahora" | "despacho";
  entrega_prevista: string;
  /** Las casillas de «lo escrito es correcto» y «ya revisé la foto de la nota». */
  confirmar: boolean;
  confirmar_nota: boolean;
  lineas: LineaDelPos[];
  pagos: PagoDelPos[];
};

export type ResultadoDelGuardado = { ventaId: number; repetida: boolean; pagado: number; pendiente: number };

/**
 * Guarda una venta ya revisada: la crea (con su descuento, su cajero, la
 * tasa del día de la nota y su entrega) y registra cada pago contra el
 * cliente, unido a la venta, con la fecha de la nota y su tasa. Si la
 * misma clave ya entró, no crea nada y devuelve esa venta.
 */
export async function guardarVentaDelPos(v: VentaDelPos, tasa: number | null): Promise<ResultadoDelGuardado> {
  const repetida = v.clave_pos ? await buscarVentaPorClavePos(v.clave_pos) : null;
  if (repetida) return { ventaId: repetida.id, repetida: true, pagado: 0, pendiente: 0 };

  const { descuento, total } = totalesDe(v.lineas, v.descuento_usd, tasa);
  const lineas: LineaVenta[] = v.lineas.map((l) => ({
    producto_id: l.producto_id,
    variante_id: l.variante_id,
    cantidad: Number(l.cantidad),
    precio_unitario_usd: Number(l.precio_usd),
    piezas: l.piezas ?? null,
  }));
  const porEntregar = v.entrega === "despacho";
  const ventaId = await crearVenta(v.cliente_id, v.fecha, lineas, v.nota, tasa, porEntregar, porEntregar ? v.entrega_prevista : null, {
    origen: "pos",
    descuento_usd: descuento,
    cajero: v.cajero,
    clave_pos: v.clave_pos || null,
  });
  // El total de la venta es el de las líneas menos el descuento: así lo ven las cuentas, la caja y las estadísticas.
  if (descuento > 0) await ejecutar("update ventas set total_usd = ? where id = ?", [total, ventaId]);

  const pagos = v.modo === "credito" ? [] : v.pagos;
  let pagado = 0;
  for (const p of pagos) {
    const moneda = monedaDelMetodo(p.metodo);
    const montoUsd = redondear(Number(p.monto_usd));
    await registrarPago({
      cliente_id: v.cliente_id,
      fecha: v.fecha,
      metodo: p.metodo,
      moneda,
      monto: moneda === "VES" && tasa ? redondear(montoUsd * tasa) : montoUsd,
      tasa: moneda === "VES" ? tasa : null,
      referencia: p.referencia ?? "",
      nota: "Cobrado en la caja",
      venta_id: ventaId,
    });
    pagado = redondear(pagado + montoUsd);
  }
  return { ventaId, repetida: false, pagado, pendiente: redondear(Math.max(0, total - pagado)) };
}

/** Si una venta salió de la caja (para enseñar su ticket y sus pagos). */
export async function esVentaDeLaCaja(ventaId: number): Promise<boolean> {
  const f = await fila<{ origen: string }>("select origen from ventas where id = ?", [ventaId]);
  return f?.origen === "pos";
}
