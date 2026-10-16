import "server-only";
import { ejecutar, fila } from "./db";
import { listarProductos } from "./productos";
import { listarVariantes } from "./variantes";
import { listarFamilias } from "./familias";
import { presentacionDe, vendiblesDe, type Vendible } from "./catalogo";
import { existencias } from "./inventario";
import type { EstadoDeExistencia } from "./stock";
import { buscarCliente, crearCliente, listarClientes, type ClienteConSaldo } from "./clientes";
import { buscarVentaPorClavePos, crearVenta } from "./ventas";
import { registrarPago } from "./pagos";
import { leerTasa, permitirStockNegativo } from "./ajustes";
import { METODOS_EN_BOLIVARES, hoy, monedaDelMetodo, redondear } from "./dinero";
import { revisarCobro, totalesDe, type LineaDelPos, type PagoDelPos } from "./pos-calculo";

/**
 * La caja (el punto de venta) desde la base: el catálogo con lo que hay de
 * cada artículo, el cliente de mostrador y el cobro, que crea la venta y
 * sus pagos con lo que ya existe (la venta nace entregada y pagada, y el
 * inventario baja solo porque las líneas de venta ya restan).
 */

export type ArticuloDelPos = Vendible & {
  /** El nombre del tipo de producto solo («Mozzarella»), sin la marca. */
  tipo: string;
  existencia: number | null;
  estado: EstadoDeExistencia;
  familia: string;
  /** «Bolsa de 2,5 kg», o nada. */
  presentacionTexto: string;
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
    };
  });
}

export const NOMBRE_DEL_MOSTRADOR = "Mostrador";

/** El cliente de las ventas sin cliente: se crea la primera vez que hace falta. */
export async function clienteDeMostrador(): Promise<ClienteConSaldo> {
  const existente = (await listarClientes()).find((c) => c.nombre === NOMBRE_DEL_MOSTRADOR && !c.telefono);
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

export type VentaDelPos = {
  /** Un número al azar que pone la caja: si el mismo cobro llega dos veces, la venta es una sola. */
  clave_pos: string;
  cliente_id: number;
  cajero: string;
  descuento_usd: number;
  nota: string;
  lineas: LineaDelPos[];
  pagos: PagoDelPos[];
};

export type ResultadoDelCobro = { ventaId: number; repetida: boolean };

/**
 * Cobra: comprueba la venta, la crea (entregada, con su descuento, su
 * cajero y la tasa del día) y registra cada pago contra el cliente, unido
 * a la venta. Lo que no cuadra devuelve el motivo y no guarda nada.
 */
export async function cobrarVentaDelPos(v: VentaDelPos): Promise<ResultadoDelCobro | { motivos: string[] }> {
  const repetida = v.clave_pos ? await buscarVentaPorClavePos(v.clave_pos) : null;
  if (repetida) return { ventaId: repetida.id, repetida: true };

  const [tasa, catalogo, sinTope, cliente] = await Promise.all([leerTasa(), catalogoDelPos(), permitirStockNegativo(), buscarCliente(v.cliente_id)]);
  const motivos = revisarCobro({ lineas: v.lineas, descuento_usd: v.descuento_usd, pagos: v.pagos, tasa: tasa?.valor ?? null, metodosEnBolivares: METODOS_EN_BOLIVARES });
  if (!cliente) motivos.push("No se encontró el cliente.");
  const porClave = new Map(catalogo.map((a) => [a.clave, a]));
  for (const l of v.lineas) {
    const articulo = porClave.get(l.clave);
    if (!articulo || articulo.producto_id !== l.producto_id || (articulo.variante_id ?? null) !== (l.variante_id ?? null)) {
      motivos.push(`${l.nombre}: ya no está en el catálogo.`);
      continue;
    }
    if (!sinTope && articulo.existencia !== null && l.cantidad > articulo.existencia) {
      motivos.push(`${articulo.nombre}: hay ${articulo.existencia} y la venta lleva ${l.cantidad}. Anota la compra que falta, haz un recuento, o permite vender sin existencia en Inventario.`);
    }
  }
  if (motivos.length > 0) return { motivos };

  const { descuento, total } = totalesDe(v.lineas, v.descuento_usd, tasa?.valor ?? null);
  const fecha = hoy();
  const ventaId = await crearVenta(
    v.cliente_id,
    fecha,
    v.lineas.map((l) => ({ producto_id: l.producto_id, variante_id: l.variante_id, cantidad: Number(l.cantidad), precio_unitario_usd: Number(l.precio_usd), piezas: null })),
    v.nota,
    tasa?.valor ?? null,
    false,
    null,
    { origen: "pos", descuento_usd: descuento, cajero: v.cajero, clave_pos: v.clave_pos || null },
  );
  // El total de la venta es el de las líneas menos el descuento: así lo ven las cuentas, la caja y las estadísticas.
  if (descuento > 0) await ejecutar("update ventas set total_usd = ? where id = ?", [total, ventaId]);
  for (const p of v.pagos) {
    const moneda = monedaDelMetodo(p.metodo);
    const valorTasa = tasa?.valor ?? null;
    await registrarPago({
      cliente_id: v.cliente_id,
      fecha,
      metodo: p.metodo,
      moneda,
      monto: moneda === "VES" && valorTasa ? redondear(Number(p.monto_usd) * valorTasa) : Number(p.monto_usd),
      tasa: moneda === "VES" ? valorTasa : null,
      referencia: p.referencia ?? "",
      nota: "Cobrado en la caja",
      venta_id: ventaId,
    });
  }
  return { ventaId, repetida: false };
}

/** Si una venta salió de la caja (para enseñar su ticket y sus pagos). */
export async function esVentaDeLaCaja(ventaId: number): Promise<boolean> {
  const f = await fila<{ origen: string }>("select origen from ventas where id = ?", [ventaId]);
  return f?.origen === "pos";
}
