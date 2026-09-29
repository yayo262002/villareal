"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cerrarSesion, claveEsCorrecta, exigirSesion, iniciarSesion } from "./sesion";
import {
  actualizarCliente,
  buscarCliente,
  buscarClientePorTelefono,
  crearCliente,
  type TipoCliente,
} from "./clientes";
import { explicarMotivo, leerDireccion } from "./direcciones";
import { telefonoLegible } from "./whatsapp";
import {
  actualizarProducto,
  buscarProducto,
  cambiarActivo,
  crearProducto,
  type PreciosProducto,
  type Unidad,
} from "./productos";
import { guardarTasa, leerTasa, ponerAvisoTasa, ponerTasaAutomatica, quitarPreciosDeEjemplo } from "./ajustes";
import { actualizarTasaOficial } from "./tasa-oficial";
import {
  VENTANA_MINUTOS,
  anotarEntradaFallida,
  direccionDeLaPeticion,
  entradaBloqueada,
  olvidarEntradasFallidas,
} from "./intentos";
import { buscarVenta, crearVenta, eliminarVenta, marcarEntrega, type LineaVenta } from "./ventas";
import { numeroDeNota } from "./entregas";
import { buscarPago, eliminarPago, registrarPago } from "./pagos";
import { buscarAdjunto, eliminarAdjunto, guardarAdjunto } from "./adjuntos";
import { guardarCopiaNube } from "./copias-nube";
import { esMetodoPago, esUnidad, monedaDelMetodo, precioParaCliente } from "./dinero";
import { FILAS_VENTA } from "./constantes";

/**
 * Todas las acciones del panel. Cada una comprueba la sesión primero: una
 * acción del servidor se puede llamar con un POST directo, sin pasar por la
 * pantalla, así que el proxy no basta.
 *
 * Los formularios son HTML normal sin JavaScript en el cliente. Los errores
 * vuelven en la URL (`?error=`) y los aciertos también (`?ok=`): funciona
 * aunque el teléfono tenga mala señal y el script no llegue a cargar.
 */

function texto(datos: FormData, campo: string): string {
  const valor = datos.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

function numero(datos: FormData, campo: string): number | null {
  const valor = texto(datos, campo).replace(",", ".");
  if (valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** La ruta con el aviso añadido, tenga ya parámetros o no. */
function conAviso(ruta: string, clave: "ok" | "error", mensaje: string): string {
  return `${ruta}${ruta.includes("?") ? "&" : "?"}${clave}=${encodeURIComponent(mensaje)}`;
}

function volverConError(ruta: string, mensaje: string): never {
  redirect(conAviso(ruta, "error", mensaje));
}

function volverConExito(ruta: string, mensaje: string): never {
  // Todo lo público sale de la base: la portada y la página de cada producto.
  revalidatePath("/", "layout");
  redirect(conAviso(ruta, "ok", mensaje));
}

/**
 * A dónde volver después de una acción, cuando lo dice el formulario. Solo
 * se aceptan páginas del panel: un formulario manipulado no puede mandar
 * a otra web.
 */
function volverA(datos: FormData, porDefecto: string): string {
  const ruta = texto(datos, "volver_a");
  return /^\/admin(\/|\?|$)/.test(ruta) && !ruta.includes("//") && !ruta.includes("\\") ? ruta : porDefecto;
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

// ---------- Sesión ----------

export async function entrar(datos: FormData): Promise<void> {
  const direccion = await direccionDeLaPeticion();
  // Con demasiados fallos recientes ni se mira la clave: acertarla no sirve.
  if (await entradaBloqueada(direccion)) {
    volverConError("/admin/entrar", `Demasiados intentos fallidos. Espera ${VENTANA_MINUTOS} minutos y vuelve a probar.`);
  }
  if (!claveEsCorrecta(texto(datos, "clave"))) {
    await anotarEntradaFallida(direccion);
    volverConError("/admin/entrar", "La clave no es correcta.");
  }
  await olvidarEntradasFallidas(direccion);
  await iniciarSesion();
  redirect("/admin");
}

export async function salir(): Promise<void> {
  await cerrarSesion();
  redirect("/admin/entrar");
}

// ---------- Clientes ----------

function leerCliente(datos: FormData) {
  const nombre = texto(datos, "nombre");
  const tipo = texto(datos, "tipo") === "mayor" ? "mayor" : ("detal" as TipoCliente);
  const telefono = telefonoLegible(texto(datos, "telefono"));
  return {
    // Quien se registra solo con el teléfono lleva el teléfono como nombre.
    nombre: nombre || telefono,
    telefono,
    cedula_rif: texto(datos, "cedula_rif"),
    direccion: texto(datos, "direccion"),
    tipo,
    nota: texto(datos, "nota"),
  };
}

/** Lo que hay que decirle al dueño sobre la dirección: si sirve o no para la ruta. */
function avisoDeDireccion(direccion: string): string {
  const lectura = leerDireccion(direccion);
  if (lectura.ubicada) return "";
  return ` Ojo: queda fuera de la ruta de despacho. ${explicarMotivo(lectura.motivo)}`;
}

/**
 * Alta rápida: basta el teléfono y la dirección. Vuelve a la cartera, no a
 * la ficha, para poder registrar el siguiente sin más toques.
 */
export async function guardarCliente(datos: FormData): Promise<void> {
  await exigirSesion();
  const cliente = leerCliente(datos);
  if (!cliente.nombre) volverConError("/admin/clientes", "Escribe al menos el teléfono o el nombre.");

  const repetido = await buscarClientePorTelefono(cliente.telefono);
  if (repetido) {
    volverConError(`/admin/clientes/${repetido.id}`, "Ese teléfono ya es de este cliente. No se registró otra vez.");
  }

  const id = await crearCliente(cliente);
  revalidatePath("/admin", "layout");
  redirect(
    `/admin/clientes?ok=${encodeURIComponent(`Cliente guardado: ${cliente.nombre}.${avisoDeDireccion(cliente.direccion)}`)}&nuevo=${id}`,
  );
}

export async function editarCliente(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  if (!id) volverConError("/admin/clientes", "No se encontró el cliente.");
  const cliente = leerCliente(datos);
  if (!cliente.nombre) volverConError(`/admin/clientes/${id}`, "Escribe al menos el teléfono o el nombre.");

  const repetido = await buscarClientePorTelefono(cliente.telefono, id);
  if (repetido) {
    volverConError(`/admin/clientes/${id}`, `Ese teléfono ya es de otro cliente: ${repetido.nombre}.`);
  }

  await actualizarCliente(id, cliente);
  volverConExito(`/admin/clientes/${id}`, `Datos guardados.${avisoDeDireccion(cliente.direccion)}`);
}

// ---------- Productos ----------

/**
 * Costo, margen y precio de un formulario de producto. Si están costo y
 * margen, el precio de venta sale de ahí; si no, vale el precio escrito.
 */
function leerPrecios(datos: FormData): PreciosProducto {
  const precios: PreciosProducto = {
    costo_usd: numero(datos, "costo_usd"),
    margen_pct: numero(datos, "margen_pct"),
    precio_usd: numero(datos, "precio_usd"),
    margen_mayor_pct: numero(datos, "margen_mayor_pct"),
    precio_mayor_usd: numero(datos, "precio_mayor_usd"),
  };
  for (const valor of Object.values(precios)) {
    if (valor !== null && valor < 0) volverConError("/admin/productos", "Costo, márgenes y precios no pueden ser negativos.");
  }
  if (precios.costo_usd === null && (precios.margen_pct !== null || precios.margen_mayor_pct !== null)) {
    volverConError("/admin/productos", "Para usar un margen hace falta el costo. Escríbelo, o pon el precio de venta a mano.");
  }
  return precios;
}

function leerUnidad(datos: FormData): Unidad {
  const valor = texto(datos, "unidad");
  return esUnidad(valor) ? valor : "kg";
}

export async function guardarProducto(datos: FormData): Promise<void> {
  await exigirSesion();
  const nombre = texto(datos, "nombre");
  if (!nombre) volverConError("/admin/productos", "El nombre es obligatorio.");

  await crearProducto({ nombre, unidad: leerUnidad(datos), descripcion: texto(datos, "descripcion"), ...leerPrecios(datos) });
  volverConExito("/admin/productos", "Producto creado.");
}

/**
 * Guarda la ficha entera de un producto. Los campos que el formulario no
 * traiga se dejan como estaban, así el mismo destino sirve para cambiar
 * solo el precio.
 */
export async function editarProducto(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const producto = id ? await buscarProducto(id) : null;
  if (!id || !producto) volverConError("/admin/productos", "No se encontró el producto.");
  const nombre = datos.has("nombre") ? texto(datos, "nombre") : producto.nombre;
  if (!nombre) volverConError("/admin/productos", "El nombre es obligatorio.");

  const precios = datos.has("costo_usd") || datos.has("precio_usd") ? leerPrecios(datos) : producto;
  await actualizarProducto(id, {
    nombre,
    unidad: datos.has("unidad") ? leerUnidad(datos) : producto.unidad,
    descripcion: datos.has("descripcion") ? texto(datos, "descripcion") : producto.descripcion,
    costo_usd: precios.costo_usd,
    margen_pct: precios.margen_pct,
    precio_usd: precios.precio_usd,
    margen_mayor_pct: precios.margen_mayor_pct,
    precio_mayor_usd: precios.precio_mayor_usd,
  });
  volverConExito("/admin/productos", `«${nombre}» guardado. La web ya lo muestra así.`);
}

export async function confirmarPrecios(): Promise<void> {
  await exigirSesion();
  await quitarPreciosDeEjemplo();
  volverConExito("/admin/productos", "Hecho. Los precios publicados se dan por tuyos.");
}

// ---------- Tasa del día ----------

export async function cambiarTasa(datos: FormData): Promise<void> {
  await exigirSesion();
  const tasa = numero(datos, "tasa");
  if (tasa === null || tasa <= 0) volverConError("/admin/productos", "Escribe la tasa: bolívares por dólar.");
  await guardarTasa(tasa, "manual");
  await ponerAvisoTasa(null);
  volverConExito("/admin/productos", "Tasa del día guardada. La web ya muestra los precios en bolívares con ella.");
}

/** Enciende o apaga que la tasa se traiga sola del BCV cada mañana. */
export async function alternarTasaAutomatica(datos: FormData): Promise<void> {
  await exigirSesion();
  const encender = texto(datos, "encender") === "1";
  await ponerTasaAutomatica(encender);
  volverConExito(
    "/admin/productos",
    encender
      ? "La tasa se traerá sola del BCV cada mañana."
      : "La tasa ya no se actualiza sola. Vale la que escribas tú.",
  );
}

/** El botón «Traer la del BCV ahora»: funciona aunque lo automático esté apagado. */
export async function traerTasaOficial(): Promise<void> {
  await exigirSesion();
  const resultado = await actualizarTasaOficial({ forzar: true });
  if (resultado.estado === "actualizada") {
    volverConExito("/admin/productos", `Tasa del BCV puesta: ${resultado.valor} bolívares por dólar.`);
  }
  const motivo = resultado.estado === "apagada" ? "la actualización está apagada" : resultado.motivo;
  volverConError("/admin/productos", `No se cambió la tasa: ${motivo}.`);
}

export async function alternarProducto(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  if (!id) volverConError("/admin/productos", "No se encontró el producto.");
  await cambiarActivo(id, texto(datos, "activo") === "1");
  volverConExito("/admin/productos", "Producto actualizado.");
}

// ---------- Ventas ----------

export async function guardarVenta(datos: FormData): Promise<void> {
  await exigirSesion();
  const clienteId = numero(datos, "cliente_id");
  const fecha = texto(datos, "fecha");
  if (!clienteId) volverConError("/admin/ventas", "Elige un cliente.");
  if (!fecha) volverConError("/admin/ventas", "Falta la fecha.");
  const cliente = await buscarCliente(clienteId);
  if (!cliente) volverConError("/admin/ventas", "No se encontró el cliente.");

  const lineas: LineaVenta[] = [];
  for (let i = 0; i < FILAS_VENTA; i++) {
    const productoId = numero(datos, `producto_${i}`);
    const cantidad = numero(datos, `cantidad_${i}`);
    let precio = numero(datos, `precio_${i}`);
    if (!productoId && cantidad === null && precio === null) continue;
    if (!productoId || cantidad === null) {
      volverConError("/admin/ventas", `La fila ${i + 1} está incompleta: producto y cantidad.`);
    }
    // Sin precio escrito se cobra el del producto: al mayor si el cliente
    // es mayorista, al detal si no.
    if (precio === null) {
      const producto = await buscarProducto(productoId);
      precio = producto ? precioParaCliente(producto, cliente.tipo) : null;
      if (precio === null) {
        volverConError("/admin/ventas", `La fila ${i + 1} no tiene precio y el producto tampoco: escríbelo.`);
      }
    }
    lineas.push({ producto_id: productoId, cantidad, precio_unitario_usd: precio });
  }

  // Lo que se lleva al cliente queda por entregar y entra en el despacho.
  const porEntregar = texto(datos, "entrega") === "despacho";
  let ventaId = 0;
  try {
    const tasa = await leerTasa();
    ventaId = await crearVenta(clienteId, fecha, lineas, texto(datos, "nota"), tasa?.valor ?? null, porEntregar);
  } catch (error) {
    volverConError("/admin/ventas", mensajeDe(error));
  }
  // A la nota de entrega, para mandarla o imprimirla en el momento.
  volverConExito(
    `/admin/ventas/${ventaId}/nota`,
    porEntregar ? "Venta registrada. Queda por entregar: ya está en el despacho." : "Venta registrada.",
  );
}

/**
 * Marca un pedido como entregado, o lo devuelve al despacho si se marcó
 * por error. Se llama desde la ruta de despacho y desde la nota.
 */
export async function cambiarEntrega(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const venta = id ? await buscarVenta(id) : null;
  if (!id || !venta) volverConError("/admin/despacho", "No se encontró la venta.");

  const entregada = texto(datos, "entregada") === "1";
  await marcarEntrega(id, entregada);
  volverConExito(
    volverA(datos, `/admin/ventas/${id}/nota`),
    entregada
      ? `Nota ${numeroDeNota(id)} entregada a ${venta.cliente_nombre}.`
      : `La nota ${numeroDeNota(id)} vuelve a estar por entregar.`,
  );
}

/**
 * Borrar es la única forma de corregir una venta mal anotada: no hay
 * edición, se borra y se vuelve a registrar bien. La confirmación está en
 * `/admin/ventas/[id]/eliminar`, que es quien llama a esta acción.
 */
export async function borrarVenta(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const venta = id ? await buscarVenta(id) : null;
  if (!id || !venta) volverConError("/admin/ventas", "No se encontró la venta.");

  await eliminarVenta(id);
  volverConExito(`/admin/clientes/${venta.cliente_id}`, "Venta eliminada.");
}

// ---------- Pagos ----------

export async function guardarPago(datos: FormData): Promise<void> {
  await exigirSesion();
  const origen = volverA(datos, "/admin/pagos");
  const clienteId = numero(datos, "cliente_id");
  const fecha = texto(datos, "fecha");
  const metodo = texto(datos, "metodo");
  const monto = numero(datos, "monto");
  const tasa = numero(datos, "tasa");

  if (!clienteId) volverConError(origen, "Elige un cliente.");
  if (!fecha) volverConError(origen, "Falta la fecha.");
  if (!esMetodoPago(metodo)) volverConError(origen, "Elige el método de pago.");
  if (monto === null || monto <= 0) volverConError(origen, "El monto tiene que ser mayor que cero.");

  const moneda = monedaDelMetodo(metodo);
  if (moneda === "VES" && (tasa === null || tasa <= 0)) {
    volverConError(origen, "Un pago en bolívares necesita la tasa del día (Bs por dólar).");
  }

  try {
    await registrarPago({
      cliente_id: clienteId,
      fecha,
      metodo,
      moneda,
      monto,
      tasa: moneda === "VES" ? tasa : null,
      referencia: texto(datos, "referencia"),
      nota: texto(datos, "nota"),
    });
  } catch (error) {
    volverConError(origen, mensajeDe(error));
  }
  volverConExito(`/admin/clientes/${clienteId}`, "Abono registrado. Abajo, en Abonos, puedes mandarle el recibo.");
}

/** Igual que `borrarVenta`: la confirmación está en `/admin/pagos/[id]/eliminar`. */
export async function borrarPago(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const pago = id ? await buscarPago(id) : null;
  if (!id || !pago) volverConError("/admin/pagos", "No se encontró el pago.");

  await eliminarPago(id);
  volverConExito(`/admin/clientes/${pago.cliente_id}`, "Abono eliminado.");
}

// ---------- Copias ----------

export async function copiarAhora(): Promise<void> {
  await exigirSesion();
  let tamano = 0;
  try {
    tamano = (await guardarCopiaNube()).tamano;
  } catch (error) {
    volverConError("/admin", mensajeDe(error));
  }
  volverConExito("/admin", `Copia guardada en la nube (${Math.round(tamano / 1024)} KB).`);
}

// ---------- Adjuntos (fotos de las notas) ----------

export async function subirAdjunto(datos: FormData): Promise<void> {
  await exigirSesion();
  const clienteId = numero(datos, "cliente_id");
  const cliente = clienteId ? await buscarCliente(clienteId) : null;
  if (!clienteId || !cliente) volverConError("/admin/clientes", "No se encontró el cliente.");
  const ficha = `/admin/clientes/${clienteId}`;

  const archivo = datos.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) volverConError(ficha, "Elige una foto de la nota.");

  const ventaId = numero(datos, "venta_id");
  const venta = ventaId ? await buscarVenta(ventaId) : null;
  if (ventaId && (!venta || venta.cliente_id !== clienteId)) {
    volverConError(ficha, "Esa venta no es de este cliente.");
  }

  try {
    await guardarAdjunto({
      cliente_id: clienteId,
      venta_id: venta ? venta.id : null,
      descripcion: texto(datos, "descripcion"),
      tipo: archivo.type,
      contenido: new Uint8Array(await archivo.arrayBuffer()),
    });
  } catch (error) {
    volverConError(ficha, mensajeDe(error));
  }
  volverConExito(ficha, "Foto guardada.");
}

export async function borrarAdjunto(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const adjunto = id ? await buscarAdjunto(id) : null;
  if (!id || !adjunto) volverConError("/admin/clientes", "No se encontró la foto.");

  await eliminarAdjunto(id);
  volverConExito(`/admin/clientes/${adjunto.cliente_id}`, "Foto eliminada.");
}
