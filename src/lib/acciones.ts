"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cerrarSesion, claveEsCorrecta, exigirSesion, iniciarSesion } from "./sesion";
import {
  actualizarCliente,
  buscarCliente,
  listarClientes,
  buscarClientePorTelefono,
  crearCliente,
  eliminarCliente,
  guardarSitio,
  type SitioDelMapa,
  type TipoCliente,
} from "./clientes";
import { buscarEnElMapa, necesitaElMapa } from "./mapa";
import {
  actualizarProveedor,
  buscarCompra,
  buscarPagoProveedor,
  buscarProveedor,
  crearCompra,
  crearProveedor,
  eliminarCompra,
  eliminarPagoProveedor,
  eliminarProveedor,
  registrarPagoProveedor,
} from "./proveedores";
import { leerDiasDeCredito } from "./credito";
import { explicarMotivo, leerDireccion } from "./direcciones";
import { esSoloUnTelefono, telefonoLegible } from "./whatsapp";
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
import { buscarVenta, crearVenta, eliminarVenta, marcarEntrega, ultimoPrecioAlCliente, type LineaVenta } from "./ventas";
import { lineaRellena, revisarFecha, revisarVenta, type LineaEscrita } from "./venta-sensata";
import { listarProductos } from "./productos";
import {
  actualizarVariante,
  buscarVariante,
  cambiarActivaVariante,
  crearVariante,
  eliminarVariante,
  guardarFotoDeVariante,
  listarVariantes,
  quitarFotoDeVariante,
  type DatosVariante,
} from "./variantes";
import { vendiblesDe } from "./catalogo";
import { numeroDeNota } from "./entregas";
import { buscarPago, eliminarPago, registrarPago } from "./pagos";
import { TAMANO_MAXIMO_ADJUNTO, buscarAdjunto, eliminarAdjunto, esTipoAdjunto, guardarAdjunto } from "./adjuntos";
import { anotarLecturaDeFoto, aparcarFoto, buscarFotoEnEspera, olvidarFotoEnEspera, pasarFotoAAdjuntos } from "./fotos-en-espera";
import { lectorDisponible, leerNota } from "./lector-de-notas";
import { compararNota, interpretarLectura, type NotaLeida } from "./nota-leida";
import { guardarCopiaNube } from "./copias-nube";
import {
  buscarResena,
  crearResena,
  eliminarResena,
  esconderResena,
  guardarFotoDeResena,
  ponerResenasDeEjemplo,
  publicarResena,
  quitarFotoDeResena,
  quitarResenasDeEjemplo,
} from "./resenas";
import { leerResena } from "./resenas-texto";
import { esMetodoPago, esUnidad, hoy, monedaDelMetodo, redondear } from "./dinero";

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

/**
 * Para lo que no tiene vuelta atrás, como borrar un cliente con todo lo
 * suyo: además de la sesión se pide la clave del panel otra vez. Los
 * fallos cuentan como los de la entrada, para que nadie la adivine desde
 * aquí probando.
 */
async function exigirClave(datos: FormData, volverA: string): Promise<void> {
  const direccion = await direccionDeLaPeticion();
  if (await entradaBloqueada(direccion)) {
    volverConError(volverA, `Demasiados intentos fallidos. Espera ${VENTANA_MINUTOS} minutos y vuelve a probar.`);
  }
  if (!claveEsCorrecta(texto(datos, "clave"))) {
    await anotarEntradaFallida(direccion);
    volverConError(volverA, "La clave no es correcta. No se borró nada.");
  }
}

/** Un archivo de un formulario, o null si no se eligió ninguno. */
function archivoDe(datos: FormData, campo: string): File | null {
  const valor = datos.get(campo);
  return valor instanceof File && valor.size > 0 ? valor : null;
}

/** La foto de la nota firmada que exige una entrega: una foto, de menos de 4 MB. Devuelve el motivo si no vale. */
function revisarFotoDeLaNota(foto: File): string | null {
  if (!esTipoAdjunto(foto.type) || foto.type === "application/pdf") return "La foto de la nota tiene que ser una foto (JPG, PNG o WebP).";
  if (foto.size > TAMANO_MAXIMO_ADJUNTO) return "La foto de la nota pesa más de 4 MB. Hazla con menos resolución.";
  return null;
}

const SIN_FOTO = "Si ya la entregaste, adjunta la foto de la nota firmada por el cliente.";

type FotoDeLaNota = { id: number; tipo: string; datos: Uint8Array; lectura: string | null };

/**
 * La foto de la nota firmada, recién hecha o aparcada de un intento
 * anterior. La recién hecha se aparca en el momento: si el formulario
 * vuelve con un aviso, la trae por su número y no hay que repetirla.
 * `mala` es el motivo si la foto nueva no vale.
 */
async function recogerFotoDeLaNota(datos: FormData): Promise<{ foto: FotoDeLaNota | null; mala: string | null }> {
  const nueva = archivoDe(datos, "foto");
  if (nueva) {
    const mala = revisarFotoDeLaNota(nueva);
    if (mala) return { foto: null, mala };
    const contenido = new Uint8Array(await nueva.arrayBuffer());
    const id = await aparcarFoto(nueva.type, contenido);
    return { foto: { id, tipo: nueva.type, datos: contenido, lectura: null }, mala: null };
  }
  const aparcada = await buscarFotoEnEspera(numero(datos, "foto_espera") ?? 0);
  if (!aparcada) return { foto: null, mala: null };
  return { foto: { id: aparcada.id, tipo: aparcada.tipo, datos: new Uint8Array(aparcada.datos), lectura: aparcada.lectura }, mala: null };
}

type Lectura = { nota: NotaLeida | null; intentada: boolean };

/**
 * Lee la nota con el lector, una sola vez por foto: lo leído se guarda con
 * ella. `intentada` dice si hay lector; `nota` es null si no se pudo leer.
 */
async function leerLaNota(foto: FotoDeLaNota): Promise<Lectura> {
  if (!lectorDisponible()) return { nota: null, intentada: false };
  if (foto.lectura !== null) return { nota: interpretarLectura(foto.lectura), intentada: true };
  const nota = await leerNota(foto);
  if (nota) await anotarLecturaDeFoto(foto.id, JSON.stringify(nota));
  return { nota, intentada: true };
}

/** Lo que se le dice al dueño de la lectura, después de guardar. */
function comentarioDeLaLectura(lectura: Lectura, reparos: string[]): string {
  if (!lectura.intentada) return "";
  if (!lectura.nota) return " (La nota no se pudo leer esta vez.)";
  return reparos.length === 0 ? " La nota se leyó y cuadra con lo anotado." : " La nota se leyó y se guardó con los avisos que revisaste.";
}

/** El aviso con lo que no cuadra, y qué hacer. */
function avisoDeLaNota(reparos: string[], despues: string): string {
  return `${reparos.join(" ")} Revisa la foto y lo anotado; si está bien así, marca «Ya revisé la foto de la nota» y ${despues}.`;
}

/** La foto aparcada pasa a ser la de esa venta. */
async function guardarFotoDeLaNota(foto: FotoDeLaNota, clienteId: number, ventaId: number): Promise<void> {
  await pasarFotoAAdjuntos(foto.id, clienteId, ventaId, `Nota N.º ${numeroDeNota(ventaId)} firmada`);
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
  // El negocio vende solo al mayor: todos los clientes son mayoristas.
  const tipo: TipoCliente = "mayor";
  const telefono = telefonoLegible(texto(datos, "telefono"));
  return {
    // Quien se registra solo con el teléfono lleva el teléfono como nombre.
    nombre: nombre || telefono,
    telefono,
    cedula_rif: texto(datos, "cedula_rif"),
    direccion: texto(datos, "direccion"),
    tipo,
    nota: texto(datos, "nota"),
    dias_credito: leerDiasDeCredito(numero(datos, "dias_credito")),
    razon_social: texto(datos, "razon_social"),
  };
}

/**
 * Si la dirección no dice calle y carrera, se le pregunta al mapa. Lo que
 * conteste se guarda con el cliente; si no contesta, el cliente se guarda
 * igual y se avisa.
 */
async function sitioDe(direccion: string): Promise<SitioDelMapa> {
  return necesitaElMapa(direccion) ? await buscarEnElMapa(direccion) : null;
}

/** Lo que hay que decirle al dueño sobre la dirección: si sirve o no para la ruta. */
function avisoDeDireccion(direccion: string, sitio: SitioDelMapa): string {
  const lectura = leerDireccion(direccion);
  if (lectura.ubicada) return "";
  if (sitio) return ` La dirección no dice calle y carrera, pero el mapa la sitúa en: ${sitio.sitio}. Compruébalo.`;
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

  const sitio = await sitioDe(cliente.direccion);
  const id = await crearCliente(cliente, sitio);
  revalidatePath("/admin", "layout");
  const sinNombre = esSoloUnTelefono(cliente.nombre) ? " Sin nombre, por ahora." : "";
  redirect(
    `/admin/clientes?ok=${encodeURIComponent(`Cliente guardado: ${cliente.nombre}.${sinNombre}${avisoDeDireccion(cliente.direccion, sitio)}`)}&nuevo=${id}`,
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

  // Si la dirección no cambió, lo que dijo el mapa sigue valiendo y no se vuelve a preguntar.
  const anterior = await buscarCliente(id);
  const mismaDireccion = anterior !== null && anterior.direccion.trim() === cliente.direccion.trim();
  const sitio: SitioDelMapa =
    mismaDireccion && anterior.lat !== null && anterior.lon !== null
      ? { lat: anterior.lat, lon: anterior.lon, sitio: anterior.sitio }
      : await sitioDe(cliente.direccion);
  await actualizarCliente(id, cliente, sitio);
  volverConExito(`/admin/clientes/${id}`, `Datos guardados.${avisoDeDireccion(cliente.direccion, sitio)}`);
}

/** Cuántos clientes se buscan en el mapa por cada pulsación: el mapa pide ir despacio, una consulta por segundo. */
const CLIENTES_POR_TANDA = 8;

/**
 * El botón de la cartera «Buscar en el mapa a los que faltan»: los clientes
 * cuya dirección no dice calle y carrera y a los que el mapa no ha situado
 * todavía (los de antes de tener mapa, o los que fallaron). De ocho en ocho.
 */
export async function situarClientesQueFaltan(): Promise<void> {
  await exigirSesion();
  const pendientes = (await listarClientes()).filter((c) => necesitaElMapa(c.direccion) && c.lat === null);
  const tanda = pendientes.slice(0, CLIENTES_POR_TANDA);
  let situados = 0;
  for (const [i, c] of tanda.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1100));
    const sitio = await buscarEnElMapa(c.direccion);
    if (!sitio) continue;
    await guardarSitio(c.id, sitio);
    situados++;
  }
  const quedan = pendientes.length - tanda.length;
  volverConExito(
    "/admin/clientes?orden=ruta",
    `El mapa situó a ${situados} de ${tanda.length}.${quedan > 0 ? ` Quedan ${quedan}: pulsa otra vez.` : ""}${tanda.length > situados ? " A los que no encontró, escríbeles la calle y la carrera o el nombre del sitio." : ""}`,
  );
}

/** El botón «Buscar la dirección en el mapa» de la ficha: para volver a intentarlo o para los clientes de antes. */
export async function situarClienteEnElMapa(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const cliente = id ? await buscarCliente(id) : null;
  if (!id || !cliente) volverConError("/admin/clientes", "No se encontró el cliente.");
  if (!cliente.direccion.trim()) volverConError(`/admin/clientes/${id}`, "Escribe primero la dirección.");
  if (leerDireccion(cliente.direccion).ubicada) volverConError(`/admin/clientes/${id}`, "Esa dirección ya se entiende por su calle y su carrera: no hace falta el mapa.");

  const sitio = await buscarEnElMapa(cliente.direccion);
  await guardarSitio(id, sitio);
  if (!sitio) volverConError(`/admin/clientes/${id}`, "El mapa no encuentra esa dirección. Prueba con el nombre del sitio o de la avenida, sin más detalles.");
  volverConExito(`/admin/clientes/${id}`, `El mapa la sitúa en: ${sitio.sitio}. Compruébalo con «Ver en el mapa».`);
}

/**
 * Borra un cliente con sus ventas, abonos y fotos. Pide la clave del panel:
 * la confirmación está en `/admin/clientes/[id]/eliminar`.
 */
export async function borrarCliente(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const cliente = id ? await buscarCliente(id) : null;
  if (!id || !cliente) volverConError("/admin/clientes", "No se encontró el cliente.");
  await exigirClave(datos, `/admin/clientes/${id}/eliminar`);

  await eliminarCliente(id);
  volverConExito("/admin/clientes", `Cliente ${cliente.nombre} eliminado con todo lo suyo.`);
}

// ---------- Proveedores ----------

function leerProveedor(datos: FormData) {
  const telefono = telefonoLegible(texto(datos, "telefono"));
  return {
    nombre: texto(datos, "nombre") || telefono,
    telefono,
    cedula_rif: texto(datos, "cedula_rif"),
    direccion: texto(datos, "direccion"),
    nota: texto(datos, "nota"),
    dias_credito: leerDiasDeCredito(numero(datos, "dias_credito")),
  };
}

export async function guardarProveedor(datos: FormData): Promise<void> {
  await exigirSesion();
  const proveedor = leerProveedor(datos);
  if (!proveedor.nombre) volverConError("/admin/proveedores", "Escribe al menos el nombre o el teléfono.");
  const id = await crearProveedor(proveedor);
  redirect(`/admin/proveedores/${id}?ok=${encodeURIComponent(`Proveedor guardado: ${proveedor.nombre}.`)}`);
}

export async function editarProveedor(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  if (!id) volverConError("/admin/proveedores", "No se encontró el proveedor.");
  const proveedor = leerProveedor(datos);
  if (!proveedor.nombre) volverConError(`/admin/proveedores/${id}`, "Escribe al menos el nombre o el teléfono.");
  await actualizarProveedor(id, proveedor);
  volverConExito(`/admin/proveedores/${id}`, "Datos guardados.");
}

/** Pide la clave, como borrar un cliente. La confirmación está en `/admin/proveedores/[id]/eliminar`. */
export async function borrarProveedor(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const proveedor = id ? await buscarProveedor(id) : null;
  if (!id || !proveedor) volverConError("/admin/proveedores", "No se encontró el proveedor.");
  await exigirClave(datos, `/admin/proveedores/${id}/eliminar`);

  await eliminarProveedor(id);
  volverConExito("/admin/proveedores", `Proveedor ${proveedor.nombre} eliminado con sus compras y sus pagos.`);
}

export async function guardarCompra(datos: FormData): Promise<void> {
  await exigirSesion();
  const proveedorId = numero(datos, "proveedor_id");
  const proveedor = proveedorId ? await buscarProveedor(proveedorId) : null;
  if (!proveedorId || !proveedor) volverConError("/admin/proveedores", "No se encontró el proveedor.");
  const volverA = `/admin/proveedores/${proveedorId}`;

  const fecha = texto(datos, "fecha");
  const total = numero(datos, "total_usd");
  if (!fecha) volverConError(volverA, "Falta la fecha de la compra.");
  if (total === null || total <= 0) volverConError(volverA, "Escribe el total de la compra en dólares.");

  try {
    const tasa = await leerTasa();
    await crearCompra({
      proveedor_id: proveedorId,
      fecha,
      descripcion: texto(datos, "descripcion"),
      total_usd: total,
      nota: texto(datos, "nota"),
      tasa: tasa?.valor ?? null,
    });
  } catch (error) {
    volverConError(volverA, mensajeDe(error));
  }
  volverConExito(volverA, "Compra registrada.");
}

/** La confirmación está en `/admin/compras/[id]/eliminar`. */
export async function borrarCompra(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const compra = id ? await buscarCompra(id) : null;
  if (!id || !compra) volverConError("/admin/proveedores", "No se encontró la compra.");
  await eliminarCompra(id);
  volverConExito(`/admin/proveedores/${compra.proveedor_id}`, "Compra eliminada.");
}

/** Un pago al proveedor. Mismo formulario que el abono de un cliente. */
export async function guardarPagoProveedor(datos: FormData): Promise<void> {
  await exigirSesion();
  const proveedorId = numero(datos, "proveedor_id");
  const origen = volverA(datos, proveedorId ? `/admin/proveedores/${proveedorId}` : "/admin/proveedores");
  const fecha = texto(datos, "fecha");
  const metodo = texto(datos, "metodo");
  const monto = numero(datos, "monto");
  const tasa = numero(datos, "tasa");

  if (!proveedorId || !(await buscarProveedor(proveedorId))) volverConError(origen, "Elige un proveedor.");
  if (!fecha) volverConError(origen, "Falta la fecha.");
  if (!esMetodoPago(metodo)) volverConError(origen, "Elige el método de pago.");
  if (monto === null || monto <= 0) volverConError(origen, "El monto tiene que ser mayor que cero.");
  const moneda = monedaDelMetodo(metodo);
  if (moneda === "VES" && (tasa === null || tasa <= 0)) {
    volverConError(origen, "Un pago en bolívares necesita la tasa del día (Bs por dólar).");
  }

  try {
    await registrarPagoProveedor({
      proveedor_id: proveedorId,
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
  volverConExito(`/admin/proveedores/${proveedorId}`, "Pago al proveedor registrado.");
}

/** La confirmación está en `/admin/pagos-proveedor/[id]/eliminar`. */
export async function borrarPagoProveedor(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const pago = id ? await buscarPagoProveedor(id) : null;
  if (!id || !pago) volverConError("/admin/proveedores", "No se encontró el pago.");
  await eliminarPagoProveedor(id);
  volverConExito(`/admin/proveedores/${pago.proveedor_id}`, "Pago eliminado.");
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
  };
  for (const valor of Object.values(precios)) {
    if (valor !== null && valor < 0) volverConError("/admin/productos", "Costo, margen y precio no pueden ser negativos.");
  }
  if (precios.costo_usd === null && precios.margen_pct !== null) {
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
  });
  volverConExito("/admin/productos", `«${nombre}» guardado. La web ya lo muestra así.`);
}

// ---------- Variantes: las marcas o presentaciones de un producto ----------

/** Nombre, descripción, costo y precios de una variante, del formulario. */
function leerVariante(datos: FormData): DatosVariante {
  const nombre = texto(datos, "nombre");
  if (!nombre) volverConError("/admin/productos", "La marca o presentación necesita un nombre («Kemmental», «Sortilegio 500 g»).");
  const variante: DatosVariante = {
    nombre,
    descripcion: texto(datos, "descripcion"),
    costo_usd: numero(datos, "costo_usd"),
    precio_usd: numero(datos, "precio_usd"),
  };
  for (const valor of [variante.costo_usd, variante.precio_usd]) {
    if (valor !== null && valor < 0) volverConError("/admin/productos", "Costo y precios no pueden ser negativos.");
  }
  return variante;
}

/** La foto de una variante, si viene en el formulario. */
async function ponerFotoDeVariante(datos: FormData, varianteId: number): Promise<string> {
  const foto = archivoDe(datos, "foto");
  if (!foto) return "";
  try {
    await guardarFotoDeVariante(varianteId, foto.type, new Uint8Array(await foto.arrayBuffer()));
    return " Con su foto.";
  } catch (error) {
    return ` La foto no se guardó: ${mensajeDe(error)}`;
  }
}

export async function guardarVariante(datos: FormData): Promise<void> {
  await exigirSesion();
  const productoId = numero(datos, "producto_id");
  const producto = productoId ? await buscarProducto(productoId) : null;
  if (!productoId || !producto) volverConError("/admin/productos", "No se encontró el producto.");
  const variante = leerVariante(datos);
  const id = await crearVariante(producto, variante);
  const foto = await ponerFotoDeVariante(datos, id);
  volverConExito("/admin/productos", `«${variante.nombre}» añadida a ${producto.nombre}.${foto} La web ya la enseña.`);
}

export async function editarVariante(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "variante_id");
  const variante = id ? await buscarVariante(id) : null;
  const producto = variante ? await buscarProducto(variante.producto_id) : null;
  if (!id || !variante || !producto) volverConError("/admin/productos", "No se encontró la marca o presentación.");
  const nueva = leerVariante(datos);
  await actualizarVariante(id, producto, nueva);
  const foto = await ponerFotoDeVariante(datos, id);
  volverConExito("/admin/productos", `«${producto.nombre} ${nueva.nombre}» guardada.${foto}`);
}

export async function alternarVariante(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "variante_id");
  const variante = id ? await buscarVariante(id) : null;
  if (!id || !variante) volverConError("/admin/productos", "No se encontró la marca o presentación.");
  const activa = texto(datos, "activo") === "1";
  await cambiarActivaVariante(id, activa);
  volverConExito("/admin/productos", activa ? `«${variante.nombre}» vuelve a estar en la web.` : `«${variante.nombre}» escondida: no sale en la web ni en las ventas.`);
}

export async function retirarFotoDeVariante(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "variante_id");
  const variante = id ? await buscarVariante(id) : null;
  if (!id || !variante) volverConError("/admin/productos", "No se encontró la marca o presentación.");
  await quitarFotoDeVariante(id);
  volverConExito("/admin/productos", `Foto quitada de «${variante.nombre}».`);
}

/** Solo se borra la que no se vendió nunca: las notas nombran a las demás. */
export async function borrarVariante(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "variante_id");
  const variante = id ? await buscarVariante(id) : null;
  if (!id || !variante) volverConError("/admin/productos", "No se encontró la marca o presentación.");
  const resultado = await eliminarVariante(id);
  if (resultado === "con_ventas") {
    volverConError("/admin/productos", `«${variante.nombre}» ya está en alguna nota de venta: no se puede borrar. Escóndela y dejará de salir en la web y en las ventas.`);
  }
  volverConExito("/admin/productos", `«${variante.nombre}» eliminada.`);
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

/**
 * Guarda una venta como la nota de papel: por cada producto, las piezas si
 * se anotaron, los kilos (o cartones) y el precio en dólares, que se
 * escribe cada vez. Si algo no tiene sentido se vuelve al formulario con
 * lo escrito y el motivo; si solo es raro (un precio muy distinto del de
 * la lista), se pide confirmar.
 */
export async function guardarVenta(datos: FormData): Promise<void> {
  await exigirSesion();
  const clienteId = numero(datos, "cliente_id");
  const fecha = texto(datos, "fecha");
  // Una fila por producto; de los que tienen marcas o presentaciones, una por cada una.
  const [productos, variantes] = await Promise.all([listarProductos(true), listarVariantes()]);
  const vendibles = vendiblesDe(productos, variantes);

  // Con lo escrito en la dirección, el formulario vuelve relleno.
  const escrito = new URLSearchParams();
  for (const campo of ["cliente_id", "fecha", "entrega", "entrega_prevista", "nota"]) if (texto(datos, campo)) escrito.set(campo, texto(datos, campo));
  for (const v of vendibles) {
    for (const campo of ["piezas", "cantidad", "precio"]) {
      const valor = texto(datos, `${campo}_${v.clave}`);
      if (valor) escrito.set(`${campo}_${v.clave}`, valor);
    }
  }
  // La foto de la nota se aparca desde el principio: si el formulario vuelve con un aviso, no hay que repetirla.
  const { foto, mala: fotoMala } = await recogerFotoDeLaNota(datos);
  if (foto) escrito.set("foto_espera", String(foto.id));
  // Con el tipo escrito aparte, TypeScript sabe que después de `volver` no se sigue.
  const volver: (mensaje: string, casilla?: "confirmar" | "confirmar_nota") => never = (mensaje, casilla) => {
    if (casilla) escrito.set(casilla, "1");
    volverConError(`/admin/ventas?${escrito.toString()}`, mensaje);
  };

  if (!clienteId) volver("Elige un cliente.");
  const cliente = await buscarCliente(clienteId);
  if (!cliente) volver("No se encontró el cliente.");
  const malaFecha = revisarFecha(fecha, hoy());
  if (malaFecha) volver(malaFecha);

  const escritas: (LineaEscrita & { producto_id: number; variante_id: number | null })[] = [];
  for (const v of vendibles) {
    const linea = {
      producto_id: v.producto_id,
      variante_id: v.variante_id,
      producto: v.nombre,
      unidad: v.unidad,
      piezas: numero(datos, `piezas_${v.clave}`),
      cantidad: numero(datos, `cantidad_${v.clave}`),
      precio: numero(datos, `precio_${v.clave}`),
      precioDeLista: v.precio_usd,
      ultimoPrecio: null as number | null,
    };
    if (!lineaRellena(linea)) continue;
    linea.ultimoPrecio = await ultimoPrecioAlCliente(clienteId, v.producto_id, v.variante_id);
    escritas.push(linea);
  }

  const revision = revisarVenta(escritas);
  if (revision.errores.length > 0) volver(revision.errores.join(" "));
  if (revision.avisos.length > 0 && texto(datos, "confirmar") !== "1") {
    volver(`${revision.avisos.join(" ")} Si es así, marca «Los precios y las cantidades son correctos» y guarda otra vez.`, "confirmar");
  }

  const lineas: LineaVenta[] = escritas.map((l) => ({
    producto_id: l.producto_id,
    variante_id: l.variante_id,
    cantidad: l.cantidad!,
    precio_unitario_usd: l.precio!,
    piezas: l.piezas,
  }));
  // El mismo total que calcula `crearVenta`, para compararlo con el de la nota.
  const total = redondear(lineas.reduce((s, l) => s + l.cantidad * l.precio_unitario_usd, 0));

  // Lo que se lleva al cliente queda por entregar y entra en el despacho.
  // La entrega se elige a mano: si ya se entregó, va con la foto de la nota firmada; si no, con el día previsto.
  const entrega = texto(datos, "entrega");
  if (entrega !== "local" && entrega !== "despacho") volver("Elige si ya la entregaste o si queda por entregar.");
  const porEntregar = entrega === "despacho";
  const entregaPrevista = texto(datos, "entrega_prevista");
  let lectura: Lectura = { nota: null, intentada: false };
  let reparos: string[] = [];
  if (!porEntregar) {
    if (fotoMala) volver(fotoMala);
    if (!foto) volver(SIN_FOTO);
    // La foto se lee: si no es la nota, o su fecha o su suma no cuadran con lo anotado, se avisa antes de guardar.
    lectura = await leerLaNota(foto);
    reparos = lectura.nota ? compararNota(lectura.nota, { fecha, total }) : [];
    if (reparos.length > 0 && texto(datos, "confirmar_nota") !== "1") volver(avisoDeLaNota(reparos, "guarda otra vez"), "confirmar_nota");
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(entregaPrevista) || Number.isNaN(new Date(entregaPrevista + "T00:00:00Z").getTime())) {
    volver("Escribe el día previsto de entrega, para que el resumen te lo recuerde.");
  } else if (entregaPrevista < fecha) {
    volver("El día previsto de entrega no puede ser antes de la fecha de despacho.");
  }

  let ventaId = 0;
  try {
    const tasa = await leerTasa();
    ventaId = await crearVenta(clienteId, fecha, lineas, texto(datos, "nota"), tasa?.valor ?? null, porEntregar, porEntregar ? entregaPrevista : null);
    if (!porEntregar && foto) await guardarFotoDeLaNota(foto, clienteId, ventaId);
    else if (foto) await olvidarFotoEnEspera(foto.id);
  } catch (error) {
    // Si la venta ya entró y solo falló la foto, no se vuelve al formulario: se anotaría dos veces.
    if (ventaId) volverConExito(`/admin/ventas/${ventaId}/nota`, `Venta registrada, pero la foto de la nota no se guardó: ${mensajeDe(error)} Súbela desde la ficha del cliente.`);
    volver(mensajeDe(error));
  }
  // A la nota de entrega, para mandarla o imprimirla en el momento.
  volverConExito(
    `/admin/ventas/${ventaId}/nota`,
    porEntregar
      ? "Venta registrada. Queda por entregar: ya está en el despacho y en el resumen."
      : `Venta registrada con la foto de la nota firmada.${comentarioDeLaLectura(lectura, reparos)}`,
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
  const destino = volverA(datos, `/admin/ventas/${id}/nota`);
  // Entregar es entregar con la nota firmada: sin su foto no se marca.
  const { foto, mala } = await recogerFotoDeLaNota(datos);
  let lectura: Lectura = { nota: null, intentada: false };
  let reparos: string[] = [];
  if (entregada) {
    if (mala) volverConError(destino, mala);
    if (!foto) volverConError(destino, SIN_FOTO);
    lectura = await leerLaNota(foto);
    reparos = lectura.nota ? compararNota(lectura.nota, { fecha: venta.fecha, total: venta.total_usd }) : [];
    if (reparos.length > 0 && texto(datos, "confirmar_nota") !== "1") {
      // A la nota, que enseña la foto ya guardada y la casilla para confirmar, y sabe adónde volver después.
      volverConError(
        `/admin/ventas/${id}/nota?foto_espera=${foto.id}&confirmar_nota=1&volver_a=${encodeURIComponent(destino)}`,
        avisoDeLaNota(reparos, "vuelve a marcarla entregada"),
      );
    }
  }
  await marcarEntrega(id, entregada);
  if (entregada && foto) await guardarFotoDeLaNota(foto, venta.cliente_id, id);
  else if (foto) await olvidarFotoEnEspera(foto.id);
  volverConExito(
    destino,
    entregada
      ? `Nota ${numeroDeNota(id)} entregada a ${venta.cliente_nombre}, con su foto guardada.${comentarioDeLaLectura(lectura, reparos)}`
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

// ---------- Reseñas ----------

export async function guardarResena(datos: FormData): Promise<void> {
  await exigirSesion();
  const productoId = numero(datos, "producto_id");
  const producto = productoId ? await buscarProducto(productoId) : null;
  if (!productoId || !producto) volverConError("/admin/resenas", "Elige de qué producto es la reseña.");

  const lectura = leerResena({ autor: texto(datos, "autor"), detalle: texto(datos, "detalle"), texto: texto(datos, "texto") });
  if (!lectura.valida) volverConError("/admin/resenas", lectura.motivo);

  // La casilla dice que el cliente dio permiso para salir con su nombre.
  // Sin ella la reseña se guarda, pero escondida hasta tener el permiso.
  const conPermiso = texto(datos, "permiso") === "1";
  const id = await crearResena(productoId, lectura.datos, conPermiso);
  const foto = archivoDe(datos, "foto");
  if (foto) {
    try {
      await guardarFotoDeResena(id, foto.type, new Uint8Array(await foto.arrayBuffer()));
    } catch (error) {
      // La reseña ya está guardada; solo falta la foto, y se dice.
      volverConError("/admin/resenas", `Reseña guardada, pero sin la foto: ${mensajeDe(error)}`);
    }
  }
  volverConExito(
    "/admin/resenas",
    conPermiso
      ? `Reseña de ${lectura.datos.autor} guardada. Ya sale en la página de «${producto.nombre}».`
      : `Reseña de ${lectura.datos.autor} guardada, escondida: falta el permiso del cliente. Cuando te lo dé, pulsa «Ya me dio permiso: publicar».`,
  );
}

/**
 * Publica una reseña o la esconde sin borrarla. Publicar es afirmar que el
 * cliente dio su permiso: el botón lo dice y queda anotado.
 */
export async function alternarResena(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const resena = id ? await buscarResena(id) : null;
  if (!id || !resena) volverConError("/admin/resenas", "No se encontró la reseña.");
  if (resena.de_ejemplo) volverConError("/admin/resenas", "Una reseña de ejemplo no se publica: no la dijo ningún cliente.");

  if (texto(datos, "publicada") === "1") {
    await publicarResena(id);
    volverConExito("/admin/resenas", `Reseña de ${resena.autor} publicada.`);
  }
  await esconderResena(id);
  volverConExito("/admin/resenas", "Reseña escondida. No se borró.");
}

/** Pone o cambia la foto de una reseña que ya existe. */
export async function cambiarFotoDeResena(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const resena = id ? await buscarResena(id) : null;
  if (!id || !resena) volverConError("/admin/resenas", "No se encontró la reseña.");
  const foto = archivoDe(datos, "foto");
  if (!foto) volverConError("/admin/resenas", "Elige una foto.");
  try {
    await guardarFotoDeResena(id, foto.type, new Uint8Array(await foto.arrayBuffer()));
  } catch (error) {
    volverConError("/admin/resenas", mensajeDe(error));
  }
  volverConExito("/admin/resenas", `Foto puesta en la reseña de ${resena.autor}.`);
}

export async function retirarFotoDeResena(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const resena = id ? await buscarResena(id) : null;
  if (!id || !resena) volverConError("/admin/resenas", "No se encontró la reseña.");
  await quitarFotoDeResena(id);
  volverConExito("/admin/resenas", "Foto quitada. La reseña se queda.");
}

/** La confirmación está en `/admin/resenas/[id]/eliminar`. */
export async function borrarResena(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const resena = id ? await buscarResena(id) : null;
  if (!id || !resena) volverConError("/admin/resenas", "No se encontró la reseña.");

  await eliminarResena(id);
  volverConExito("/admin/resenas", "Reseña eliminada.");
}

/** Reseñas de muestra para ver cómo queda la página. Solo las ve el dueño. */
export async function cargarResenasDeEjemplo(): Promise<void> {
  await exigirSesion();
  const puestas = await ponerResenasDeEjemplo();
  volverConExito("/admin/resenas", `Puestas ${puestas} reseñas de ejemplo. Solo las ves tú; tus clientes no.`);
}

export async function retirarResenasDeEjemplo(): Promise<void> {
  await exigirSesion();
  const quitadas = await quitarResenasDeEjemplo();
  volverConExito("/admin/resenas", `Quitadas ${quitadas} reseñas de ejemplo. Las tuyas siguen donde estaban.`);
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
