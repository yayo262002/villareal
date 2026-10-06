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
  ponerEnlace,
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
  ponerEnlaceDeProveedor,
  registrarPagoProveedor,
  type LineaDeCompraNueva,
} from "./proveedores";
import { leerDiasDeCredito, sumarDias } from "./credito";
import { explicarMotivo, leerDireccion } from "./direcciones";
import { esSoloUnTelefono, telefonoLegible } from "./whatsapp";
import {
  actualizarProducto,
  buscarProducto,
  cambiarActivo,
  categoriasDeProducto,
  crearProducto,
  eliminarProducto,
  guardarFotoDeProducto,
  ponerCategorias,
  ponerEstado,
  quitarFotoDeProducto,
  seccionesDeProducto,
  type DatosProducto,
  type PreciosProducto,
  type Producto,
  type Unidad,
} from "./productos";
import {
  actualizarFamilia,
  buscarFamilia,
  buscarFamiliaPorNombre,
  cambiarActivaFamilia,
  crearFamilia,
  eliminarFamilia,
  guardarFotoDeFamilia,
  quitarFotoDeFamilia,
  siguienteOrden,
  type DatosFamilia,
} from "./familias";
import { actualizarOferta, buscarOferta, crearOferta, eliminarOferta, esEstadoDeOferta, listarOfertas } from "./ofertas";
import { prepararCatalogoInicial } from "./preparar-catalogo";
import { esIcono } from "./iconos";
import { describirFuenteDeTasa, guardarTasa, ponerAvisoTasa, ponerTasaAutomatica, quitarPreciosDeEjemplo, tasaEnFecha } from "./ajustes";
import { actualizarTasaOficial } from "./tasa-oficial";
import {
  VENTANA_MINUTOS,
  anotarEntradaFallida,
  direccionDeLaPeticion,
  entradaBloqueada,
  olvidarEntradasFallidas,
} from "./intentos";
import { buscarVenta, crearVenta, eliminarVenta, marcarEntrega, ultimoPrecioAlCliente, type LineaVenta } from "./ventas";
import { KILOS_MAXIMOS, PRECIO_MAXIMO, lineaRellena, revisarFecha, revisarVenta, type LineaEscrita } from "./venta-sensata";
import { existenciaSinMarca, existenciasPorClave, registrarAjuste } from "./inventario";
import { ajustePorRecuento } from "./stock";
import { listarProductos } from "./productos";
import {
  actualizarVariante,
  buscarVariante,
  cambiarActivaVariante,
  crearVariante,
  eliminarVariante,
  guardarFotoDeVariante,
  listarVariantes,
  pasarAArticulo,
  quitarFotoDeVariante,
  type DatosVariante,
} from "./variantes";
import { buscarMarca, eliminarMarca, marcaPorNombre, renombrarMarca, unirMarcas } from "./marcas";
import { NOMBRE_ESTADO_PRODUCTO, claveDe, esEstadoDeProducto, estadoDeProducto, nombreDeVenta, vendiblesDe, type EstadoProducto } from "./catalogo";
import { nuevoEnlace } from "./enlace-cuenta";
import { numeroDeNota } from "./entregas";
import { buscarPago, eliminarPago, registrarPago } from "./pagos";
import { TAMANO_MAXIMO_ADJUNTO, buscarAdjunto, eliminarAdjunto, esTipoAdjunto, guardarAdjunto } from "./adjuntos";
import { anotarLecturaDeFoto, aparcarFoto, buscarFotoEnEspera, olvidarFotoEnEspera, pasarFotoAAdjuntos, pasarFotoAAdjuntosDeProveedor } from "./fotos-en-espera";
import { lectorDisponible, leerCaptura, leerNota, type ProductoDelCatalogo } from "./lector-de-notas";
import { compararNota, interpretarLectura, type NotaLeida } from "./nota-leida";
import { compararCaptura, describirCaptura, interpretarCaptura, propuestaDesdeCaptura, type CapturaLeida } from "./captura-leida";
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
import {
  METODOS_PAGO,
  bs,
  cantidad,
  esMetodoPago,
  esUnidad,
  fechaCorta,
  hoy,
  monedaDelMetodo,
  necesitaComprobante,
  redondear,
  usd,
  type MetodoPago,
  type Moneda,
} from "./dinero";

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
  // El aviso va antes del «#»: lo que va detrás no llega al servidor.
  const [camino, ancla] = ruta.split("#", 2);
  return `${camino}${camino.includes("?") ? "&" : "?"}${clave}=${encodeURIComponent(mensaje)}${ancla ? `#${ancla}` : ""}`;
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
async function leerLaNota(foto: FotoDeLaNota, catalogo: ProductoDelCatalogo[]): Promise<Lectura> {
  if (!lectorDisponible()) return { nota: null, intentada: false };
  if (foto.lectura !== null) return { nota: interpretarLectura(foto.lectura), intentada: true };
  const nota = await leerNota(foto, catalogo);
  if (nota) await anotarLecturaDeFoto(foto.id, JSON.stringify(nota));
  return { nota, intentada: true };
}

type LecturaDeCaptura = { captura: CapturaLeida | null; intentada: boolean };

/** Lee la captura de un pago con el lector, una sola vez por foto: lo leído se guarda con ella. */
async function leerLaCaptura(foto: FotoDeLaNota): Promise<LecturaDeCaptura> {
  if (!lectorDisponible()) return { captura: null, intentada: false };
  if (foto.lectura !== null) return { captura: interpretarCaptura(foto.lectura), intentada: true };
  const captura = await leerCaptura(foto);
  if (captura) await anotarLecturaDeFoto(foto.id, JSON.stringify(captura));
  return { captura, intentada: true };
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

type Volver = (mensaje: string, como?: "error" | "ok", casilla?: "confirmar_captura" | "confirmar_monto") => never;

type PagoRevisado = {
  /** El cliente o el proveedor. */
  id: number;
  fecha: string;
  metodo: MetodoPago;
  moneda: Moneda;
  monto: number;
  /** La tasa que se guarda: solo en bolívares. */
  tasa: number | null;
  /** « Tasa del 21/09/2026: Bs 36,50 por dólar (…).» si se usó la de ese día; si no, vacío. */
  notaDeTasa: string;
  foto: FotoDeLaNota | null;
  lectura: LecturaDeCaptura;
  reparos: string[];
  volver: Volver;
};

type QuienPaga = {
  campoId: "cliente_id" | "proveedor_id";
  sinId: string;
  /** El abono de un cliente exige la captura con pago móvil, transferencia, Zelle y Binance; el pago a un proveedor, no. */
  comprobanteObligatorio: boolean;
  nombre: "abono" | "pago";
  boton: string;
};

/**
 * Lo común del abono de un cliente y del pago a un proveedor. La captura se
 * aparca desde el principio (si el formulario vuelve, no hay que repetirla)
 * y, si hay lector, se lee: sin monto, el formulario vuelve relleno con lo
 * leído y el equivalente en dólares a la tasa de ese día; con monto, se
 * comprueba contra la captura. Un pago en bolívares sin tasa escrita toma
 * la que había el día del pago. Lo raro pide confirmar.
 */
async function revisarPago(datos: FormData, origen: string, quien: QuienPaga): Promise<PagoRevisado> {
  const id = numero(datos, quien.campoId);
  const fecha = texto(datos, "fecha");
  const metodo = texto(datos, "metodo");
  const monto = numero(datos, "monto");
  const tasa = numero(datos, "tasa");

  const { foto, mala: fotoMala } = await recogerFotoDeLaNota(datos);
  if (fotoMala) volverConError(origen, fotoMala);
  // Con lo escrito en la dirección, el formulario vuelve relleno.
  const escrito = new URLSearchParams();
  for (const campo of [quien.campoId, "fecha", "metodo", "monto", "tasa", "referencia", "nota"]) if (texto(datos, campo)) escrito.set(campo, texto(datos, campo));
  if (foto) escrito.set("foto_espera", String(foto.id));
  const volver: Volver = (mensaje, como = "error", casilla) => {
    if (casilla) escrito.set(casilla, "1");
    const destino = `${origen}${origen.includes("?") ? "&" : "?"}${escrito.toString()}`;
    if (como === "ok") volverConExito(destino, mensaje);
    volverConError(destino, mensaje);
  };

  if (!id) volver(quien.sinId);

  // Con la captura y sin monto, se lee y el formulario vuelve relleno para revisar.
  let lectura: LecturaDeCaptura = { captura: null, intentada: false };
  if (foto) lectura = await leerLaCaptura(foto);
  if (lectura.captura && (monto === null || monto <= 0)) {
    // El equivalente en dólares va con la tasa del día del pago que dice la captura.
    const diaDelPago = lectura.captura.fecha && lectura.captura.fecha <= hoy() ? lectura.captura.fecha : hoy();
    const tasaDelDia = (await tasaEnFecha(diaDelPago))?.valor ?? tasa;
    const propuesta = propuestaDesdeCaptura(lectura.captura, tasaDelDia, hoy());
    if (propuesta) {
      escrito.set("metodo", propuesta.metodo);
      escrito.set("monto", String(propuesta.monto));
      escrito.set("fecha", propuesta.fecha);
      if (propuesta.referencia) escrito.set("referencia", propuesta.referencia);
      if (propuesta.tasa) escrito.set("tasa", String(propuesta.tasa));
      escrito.set("leida", "1");
      volver(`${describirCaptura(lectura.captura, propuesta)} Revisa y pulsa «${quien.boton}».`, "ok");
    }
    volver(
      lectura.captura.esComprobante
        ? `No pude sacar el monto de la captura. Escríbelo tú y guarda: la captura queda con el ${quien.nombre}.`
        : "Esa foto no parece el comprobante de un pago. Si lo es, escribe el monto y guarda.",
    );
  }

  if (!fecha) volver("Falta la fecha.");
  if (!esMetodoPago(metodo)) volver(quien.nombre === "abono" ? "Elige cómo pagó el cliente." : "Elige cómo pagaste.");
  // Un pago móvil, una transferencia, un Zelle o un Binance dejan comprobante: el abono de un cliente no se registra sin su captura.
  if (quien.comprobanteObligatorio && necesitaComprobante(metodo) && !foto) {
    volver(`Falta adjuntar el comprobante de pago: la captura del ${METODOS_PAGO[metodo]}. Sin ella no se registra el abono.`);
  }
  if (monto === null || monto <= 0) volver(foto ? "Escribe el monto, o déjalo vacío para que se lea de la captura." : "El monto tiene que ser mayor que cero.");

  const moneda = monedaDelMetodo(metodo);
  // En bolívares hace falta la tasa: la escrita, o si no la que había el día del pago.
  let tasaUsada = tasa;
  let notaDeTasa = "";
  if (moneda === "VES" && (tasaUsada === null || tasaUsada <= 0)) {
    const deEseDia = await tasaEnFecha(fecha);
    if (!deEseDia) volver("Un pago en bolívares necesita la tasa (Bs por dólar) y no hay ninguna guardada: escríbela.");
    tasaUsada = deEseDia.valor;
    notaDeTasa = ` Tasa del ${fechaCorta(fecha)}: ${bs(deEseDia.valor)} por dólar (${describirFuenteDeTasa(deEseDia)}).`;
  }
  // Un monto en bolívares que no llega a un dólar casi siempre es un monto en dólares con el método equivocado.
  // (Lo que no llega ni a un centavo lo rechaza el registro sin preguntar.)
  if (moneda === "VES" && tasaUsada && monto < tasaUsada && redondear(monto / tasaUsada) >= 0.01 && texto(datos, "confirmar_monto") !== "1") {
    volver(
      `${bs(monto)} son ${usd(redondear(monto / tasaUsada))} a ${bs(tasaUsada)} por dólar. ¿Seguro que el ${quien.nombre} fue en bolívares? Si ${quien.nombre === "abono" ? "el cliente pagó" : "pagaste"} en dólares, elige un método en dólares; si está bien así, marca «El monto es correcto» y guarda otra vez.`,
      "error",
      "confirmar_monto",
    );
  }

  // Con el monto escrito, la captura se comprueba: lo que no cuadre se avisa antes de guardar.
  let reparos: string[] = [];
  if (lectura.captura) {
    reparos = compararCaptura(lectura.captura, { monto, moneda, fecha, metodo });
    if (reparos.length > 0 && texto(datos, "confirmar_captura") !== "1") {
      volver(`${reparos.join(" ")} Revisa la captura y lo escrito; si está bien así, marca «Ya revisé la captura» y guarda otra vez.`, "error", "confirmar_captura");
    }
  }

  return { id, fecha, metodo, moneda, monto, tasa: moneda === "VES" ? tasaUsada : null, notaDeTasa, foto, lectura, reparos, volver };
}

/** Lo que se le dice al dueño de la captura, después de guardar. */
function comentarioDeLaCaptura(p: PagoRevisado): string {
  if (!p.foto) return "";
  if (p.lectura.intentada && !p.lectura.captura) return " (La captura no se pudo leer; queda guardada igual.)";
  return p.reparos.length > 0 ? " Guardado con los avisos que revisaste." : "";
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

/**
 * Una compra como la nota del proveedor: por cada producto (o marca) las
 * piezas si se anotaron, los kilos o cartones y lo que costó cada uno, más
 * lo que no es producto (flete, hielo). El total sale de ahí, y con las
 * líneas entra el inventario. Lo raro (un costo por encima del precio de
 * venta) pide confirmar; el formulario vuelve con lo escrito.
 */
export async function guardarCompra(datos: FormData): Promise<void> {
  await exigirSesion();
  const proveedorId = numero(datos, "proveedor_id");
  const proveedor = proveedorId ? await buscarProveedor(proveedorId) : null;
  if (!proveedorId || !proveedor) volverConError("/admin/proveedores", "No se encontró el proveedor.");
  const [productos, variantes] = await Promise.all([listarProductos(true), listarVariantes()]);
  const vendibles = vendiblesDe(productos, variantes);

  // Con lo escrito en la dirección, el formulario de la compra vuelve relleno.
  const escrito = new URLSearchParams();
  for (const campo of ["fecha", "otros_usd", "descripcion", "nota"]) if (texto(datos, campo)) escrito.set(campo, texto(datos, campo));
  for (const v of vendibles) {
    for (const campo of ["piezas", "cantidad", "precio"]) {
      const valor = texto(datos, `${campo}_${v.clave}`);
      if (valor) escrito.set(`${campo}_${v.clave}`, valor);
    }
  }
  const volver: (mensaje: string, confirmar?: boolean) => never = (mensaje, confirmar) => {
    if (confirmar) escrito.set("confirmar", "1");
    volverConError(`/admin/proveedores/${proveedorId}?${escrito.toString()}`, mensaje);
  };

  const fecha = texto(datos, "fecha");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(new Date(fecha + "T00:00:00Z").getTime())) volver("Falta la fecha de la compra.");
  if (fecha > hoy()) volver("La fecha de la compra no puede ser de mañana en adelante.");
  const otros = numero(datos, "otros_usd") ?? 0;
  if (otros < 0 || otros > 100000) volver("Revisa el monto de las otras cosas.");

  const errores: string[] = [];
  const avisos: string[] = [];
  const lineas: LineaDeCompraNueva[] = [];
  for (const v of vendibles) {
    const piezas = numero(datos, `piezas_${v.clave}`);
    const kilos = numero(datos, `cantidad_${v.clave}`);
    const costo = numero(datos, `precio_${v.clave}`);
    if (piezas === null && kilos === null && costo === null) continue;
    const unidades = v.unidad === "kg" ? "kilos" : v.unidad === "carton" ? "cartones" : "unidades";
    if (kilos === null || !(kilos > 0)) errores.push(`${v.nombre}: escribe los ${unidades}.`);
    else if (kilos > KILOS_MAXIMOS * 10) errores.push(`${v.nombre}: ${kilos} ${unidades} no puede ser.`);
    if (costo === null || !(costo > 0)) errores.push(`${v.nombre}: escribe el costo en dólares.`);
    else if (costo > PRECIO_MAXIMO) errores.push(`${v.nombre}: ${usd(costo)} no puede ser.`);
    if (piezas !== null && (!Number.isInteger(piezas) || piezas <= 0)) errores.push(`${v.nombre}: las piezas son un número entero, 1 o más.`);
    if (kilos === null || costo === null || !(kilos > 0) || !(costo > 0)) continue;
    if (v.precio_usd !== null && costo > v.precio_usd) avisos.push(`${v.nombre}: lo compras a ${usd(costo)} y lo vendes a ${usd(v.precio_usd)}.`);
    lineas.push({ producto_id: v.producto_id, variante_id: v.variante_id, nombre: v.nombre, unidad: v.unidad, piezas, cantidad: kilos, costo_unitario_usd: costo });
  }
  if (errores.length > 0) volver(errores.join(" "));
  if (lineas.length === 0 && !(otros > 0)) volver("Escribe los kilos y el costo de al menos un producto, o el monto de otras cosas.");
  if (lineas.length === 0 && !texto(datos, "descripcion")) volver("Di qué compraste: sin productos, hace falta la descripción.");
  if (avisos.length > 0 && texto(datos, "confirmar") !== "1") volver(`${avisos.join(" ")} Si es así, marca «Lo escrito es correcto» y guarda otra vez.`, true);

  try {
    // La compra va con la tasa del día de la compra, aunque se registre después.
    const tasa = await tasaEnFecha(fecha);
    await crearCompra({
      proveedor_id: proveedorId,
      fecha,
      descripcion: texto(datos, "descripcion"),
      otros_usd: otros,
      nota: texto(datos, "nota"),
      tasa: tasa?.valor ?? null,
      lineas,
    });
  } catch (error) {
    volver(mensajeDe(error));
  }
  volverConExito(`/admin/proveedores/${proveedorId}`, lineas.length > 0 ? "Compra registrada. El inventario ya la cuenta." : "Compra registrada.");
}

/**
 * Un recuento (lo contado manda y el sistema anota la diferencia), una
 * merma (resta) o una entrada sin compra (suma), desde Inventario.
 */
export async function guardarAjusteDeInventario(datos: FormData): Promise<void> {
  await exigirSesion();
  const volverA = "/admin/inventario";
  const existencias = await existenciasPorClave();
  const e = existencias.get(texto(datos, "clave"));
  if (!e) volverConError(volverA, "Elige un producto.");
  const tipo = texto(datos, "tipo");
  const escrita = numero(datos, "cantidad");
  if (escrita === null || escrita < 0 || escrita > KILOS_MAXIMOS * 10) volverConError(volverA, `${e.nombre}: escribe la cantidad.`);
  let cambio = 0;
  let mensaje = "";
  let motivo = texto(datos, "motivo");
  if (tipo === "recuento") {
    cambio = ajustePorRecuento(e.existencia, escrita);
    if (cambio === 0) volverConExito(volverA, `${e.nombre}: el inventario ya decía ${cantidad(escrita, e.unidad)}. Nada que corregir.`);
    motivo ||= "Recuento";
    mensaje = `${e.nombre}: la existencia pasa de ${cantidad(e.existencia, e.unidad)} a ${cantidad(escrita, e.unidad)}.`;
  } else if (tipo === "merma" || tipo === "entrada") {
    if (!(escrita > 0)) volverConError(volverA, `${e.nombre}: la cantidad tiene que ser más de cero.`);
    cambio = tipo === "merma" ? -escrita : escrita;
    motivo ||= tipo === "merma" ? "Merma" : "Entrada sin compra";
    const quedan = Math.round((e.existencia + cambio) * 1000) / 1000;
    mensaje = `${e.nombre}: ${tipo === "merma" ? "merma" : "entrada"} anotada, quedan ${cantidad(quedan, e.unidad)}.`;
  } else {
    volverConError(volverA, "Elige qué pasó.");
  }
  await registrarAjuste({ fecha: hoy(), producto_id: e.producto_id, variante_id: e.variante_id, cantidad: cambio, motivo });
  volverConExito(volverA, mensaje);
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

/**
 * Un pago al proveedor. Mismo formulario y misma captura que el abono de
 * un cliente (aquí la captura no es obligatoria: se guarda si la hay) y
 * la misma tasa: la del día del pago si no se escribe otra.
 */
export async function guardarPagoProveedor(datos: FormData): Promise<void> {
  await exigirSesion();
  const proveedorId = numero(datos, "proveedor_id");
  const origen = volverA(datos, proveedorId ? `/admin/proveedores/${proveedorId}` : "/admin/proveedores");
  const p = await revisarPago(datos, origen, { campoId: "proveedor_id", sinId: "Elige un proveedor.", comprobanteObligatorio: false, nombre: "pago", boton: "Registrar pago" });
  if (!(await buscarProveedor(p.id))) volverConError("/admin/proveedores", "No se encontró el proveedor.");

  let pagoId = 0;
  try {
    pagoId = await registrarPagoProveedor({
      proveedor_id: p.id,
      fecha: p.fecha,
      metodo: p.metodo,
      moneda: p.moneda,
      monto: p.monto,
      tasa: p.tasa,
      referencia: texto(datos, "referencia"),
      nota: texto(datos, "nota"),
    });
    if (p.foto) await pasarFotoAAdjuntosDeProveedor(p.foto.id, p.id, pagoId, `Captura del pago del ${fechaCorta(p.fecha)}`);
  } catch (error) {
    // Si el pago ya entró y solo falló la captura, no se vuelve al formulario: se anotaría dos veces.
    if (pagoId) volverConExito(`/admin/proveedores/${p.id}`, `Pago registrado, pero la captura no se guardó: ${mensajeDe(error)}`);
    p.volver(mensajeDe(error));
  }
  volverConExito(`/admin/proveedores/${p.id}`, `Pago al proveedor registrado${p.foto ? " con su captura" : ""}.${p.notaDeTasa}${comentarioDeLaCaptura(p)}`);
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

// ---------- El enlace de cuenta del cliente ----------

/**
 * El enlace personal con el que el cliente ve su cuenta sin clave. Se crea
 * una vez; «renovar» pone otro y el anterior deja de funcionar, por si se
 * compartió de más.
 */
export async function cambiarEnlaceDeCuenta(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const cliente = id ? await buscarCliente(id) : null;
  if (!id || !cliente) volverConError("/admin/clientes", "No se encontró el cliente.");
  const renovar = texto(datos, "enlace_de_cuenta") === "renovar";
  if (cliente.enlace && !renovar) volverConExito(`/admin/clientes/${id}#enlace`, "Este cliente ya tiene su enlace.");
  await ponerEnlace(id, nuevoEnlace());
  volverConExito(
    `/admin/clientes/${id}#enlace`,
    renovar ? "Enlace renovado: el anterior ya no funciona. Mándale el nuevo." : "Enlace creado. Mándaselo por WhatsApp: con él ve su cuenta al día.",
  );
}

/** El enlace personal con el que el proveedor ve nuestra cuenta con él. Igual que el del cliente. */
export async function cambiarEnlaceDeProveedor(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const proveedor = id ? await buscarProveedor(id) : null;
  if (!id || !proveedor) volverConError("/admin/proveedores", "No se encontró el proveedor.");
  const renovar = texto(datos, "enlace_de_cuenta") === "renovar";
  if (proveedor.enlace && !renovar) volverConExito(`/admin/proveedores/${id}#enlace`, "Este proveedor ya tiene su enlace.");
  await ponerEnlaceDeProveedor(id, nuevoEnlace());
  volverConExito(
    `/admin/proveedores/${id}#enlace`,
    renovar ? "Enlace renovado: el anterior ya no funciona. Mándale el nuevo." : "Enlace creado. Mándaselo por WhatsApp: con él ve nuestra cuenta con él, al día.",
  );
}

// ---------- Productos ----------

/**
 * Costo, margen y precio de un formulario de producto. Si están costo y
 * margen, el precio de venta sale de ahí; si no, vale el precio escrito.
 */
function leerPrecios(datos: FormData, volver: (mensaje: string) => never): PreciosProducto {
  const precios: PreciosProducto = {
    costo_usd: numero(datos, "costo_usd"),
    margen_pct: numero(datos, "margen_pct"),
    precio_usd: numero(datos, "precio_usd"),
  };
  for (const valor of Object.values(precios)) {
    if (valor !== null && valor < 0) volver("Costo, margen y precio no pueden ser negativos.");
  }
  // Con marcas, el margen es para sacar el precio de cada una de su costo: el tipo no necesita costo propio.
  if (precios.costo_usd === null && precios.margen_pct !== null && texto(datos, "precios_de") !== "marcas") {
    volver("Para usar un margen hace falta el costo. Escríbelo, o pon el precio de venta a mano.");
  }
  return precios;
}

function leerUnidad(datos: FormData): Unidad {
  const valor = texto(datos, "unidad");
  return esUnidad(valor) ? valor : "kg";
}

const iconoDe = (valor: string) => (esIcono(valor) ? valor : "otros");

/** Los campos del formulario de producto que vuelven escritos si algo falla. */
const CAMPOS_DEL_PRODUCTO = [
  "tipo",
  "nombre",
  "descripcion",
  "unidad",
  "costo_usd",
  "margen_pct",
  "precio_usd",
  "precio_detal_usd",
  "marca",
  "marca_lista",
  "presentacion",
  "presentacion_lista",
  "contenido",
  "familia_id",
  "estado",
  "destacado",
  "en_oferta",
  "existencia",
  "nueva_familia_nombre",
  "nueva_familia_descripcion",
  "nueva_familia_icono",
  "nueva_familia_orden",
  "nueva_familia_coleccion",
  "seccion",
];

/**
 * La marca y la presentación llegan de dos sitios: una lista para elegir
 * (`marca_lista`, `presentacion_lista`) y un campo para escribir una nueva
 * (`marca`, `presentacion`). Lo escrito manda; «nueva» en la lista sin
 * escribir nada es nada.
 */
function marcaEscrita(datos: FormData): string {
  const lista = texto(datos, "marca_lista");
  return texto(datos, "marca") || (lista && lista !== "nueva" ? lista : "");
}

function presentacionEscrita(datos: FormData): string {
  const lista = texto(datos, "presentacion_lista");
  return texto(datos, "presentacion") || (lista && lista !== "nueva" ? lista : "");
}

/** Lo escrito en el formulario de producto, para que vuelva relleno: `relleno` dice que lo de la dirección manda. */
function escritoDelProducto(datos: FormData): URLSearchParams {
  const escrito = new URLSearchParams();
  for (const campo of CAMPOS_DEL_PRODUCTO) {
    const valor = texto(datos, campo);
    if (valor) escrito.set(campo, valor);
  }
  for (const categoria of datos.getAll("categoria")) if (typeof categoria === "string" && categoria) escrito.append("categoria", categoria);
  for (const [campo, valor] of datos.entries()) if (campo.startsWith("seccion_") && typeof valor === "string" && valor.trim()) escrito.set(campo, valor);
  escrito.set("relleno", "1");
  return escrito;
}

/**
 * «Crear la familia y elegirla», dentro del formulario de producto: crea la
 * familia y vuelve al formulario con todo lo escrito y la familia nueva ya
 * elegida. Sin JavaScript: la foto del producto, si se había puesto, hay
 * que volver a ponerla.
 */
async function crearFamiliaDesdeElProducto(datos: FormData, origen: string): Promise<never> {
  const escrito = escritoDelProducto(datos);
  const volver = (mensaje: string): never => volverConError(`${origen}?${escrito.toString()}`, mensaje);
  const nombre = texto(datos, "nueva_familia_nombre");
  if (!nombre) volver("Escribe el nombre de la familia nueva.");
  if (await buscarFamiliaPorNombre(nombre)) volver(`Ya hay una familia «${nombre}»: elígela en la lista.`);
  const id = await crearFamilia({
    nombre,
    descripcion: texto(datos, "nueva_familia_descripcion"),
    icono: iconoDe(texto(datos, "nueva_familia_icono")),
    orden: numero(datos, "nueva_familia_orden") ?? (await siguienteOrden()),
    activa: texto(datos, "nueva_familia_activa") === "1",
    coleccion: texto(datos, "nueva_familia_coleccion") === "1",
  });
  let aviso = "";
  const portada = archivoDe(datos, "nueva_familia_portada");
  if (portada) {
    try {
      await guardarFotoDeFamilia(id, portada.type, new Uint8Array(await portada.arrayBuffer()));
    } catch (error) {
      aviso = ` La portada no se guardó: ${mensajeDe(error)}`;
    }
  }
  for (const campo of ["nueva_familia_nombre", "nueva_familia_descripcion", "nueva_familia_icono", "nueva_familia_orden"]) escrito.delete(campo);
  escrito.set("familia_id", String(id));
  volverConExito(`${origen}?${escrito.toString()}`, `Familia «${nombre}» creada y elegida.${aviso} Sigue con el producto y guárdalo.`);
}

type FormularioDeProducto = {
  datos: DatosProducto;
  estado: EstadoProducto;
  categorias: number[] | null;
  /** La sección en cada otra familia, si el formulario las trae. */
  secciones: Map<number, string> | null;
  existencia: number | null;
  /** Si la marca escrita no existía y se acaba de crear. */
  marcaNueva: string | null;
};

/**
 * Lee el formulario de un producto. El formulario entero lleva
 * `formulario=completo`: entonces una casilla sin marcar es un «no» y la
 * familia es obligatoria. Un campo de texto que no viene se deja como
 * estaba: así sirve el mismo destino para cambiar solo el precio, y un
 * campo que el formulario no enseña (la marca de un producto con varias)
 * no se borra.
 */
async function leerFormularioDeProducto(datos: FormData, actual: Producto | null, volver: (mensaje: string) => never): Promise<FormularioDeProducto> {
  const completo = texto(datos, "formulario") === "completo";
  const viene = (campo: string) => datos.has(campo) || (completo && !actual);
  const nombre = viene("nombre") ? texto(datos, "nombre") : (actual?.nombre ?? "");
  if (!nombre) volver("El nombre es obligatorio.");
  const precios = datos.has("costo_usd") || datos.has("precio_usd") ? leerPrecios(datos, volver) : (actual ?? { costo_usd: null, margen_pct: null, precio_usd: null });
  const detal = viene("precio_detal_usd") ? numero(datos, "precio_detal_usd") : (actual?.precio_detal_usd ?? null);
  if (detal !== null && detal < 0) volver("El precio al detal no puede ser negativo.");
  const familia = viene("familia_id") ? numero(datos, "familia_id") : (actual?.familia_id ?? null);
  if (completo && (!familia || !(await buscarFamilia(familia)))) volver("Elige a qué familia pertenece el producto.");
  const categorias = completo ? datos.getAll("categoria").map(Number).filter((n) => Number.isSafeInteger(n) && n > 0) : null;
  // La sección en cada otra familia: la escrita, o la que tenía si el formulario no la trae.
  let secciones: Map<number, string> | null = null;
  if (categorias) {
    const antes = actual ? await seccionesDeProducto(actual.id) : new Map<number, string>();
    secciones = new Map(categorias.map((f) => [f, datos.has(`seccion_${f}`) ? texto(datos, `seccion_${f}`) : (antes.get(f) ?? "")]));
  }
  const estadoEscrito = texto(datos, "estado");
  const estado: EstadoProducto = esEstadoDeProducto(estadoEscrito) ? estadoEscrito : actual ? estadoDeProducto(actual) : "activo";
  const existencia = numero(datos, "existencia");
  if (existencia !== null && (existencia < 0 || existencia > KILOS_MAXIMOS * 100)) volver("Revisa la existencia: lo que contaste, en kilos o unidades.");
  // La marca escrita es una de la lista o una nueva, que se crea aquí: ya no hay nada más que revisar.
  let marca = { nombre: actual?.marca ?? "", id: actual?.marca_id ?? null };
  let marcaNueva: string | null = null;
  if (datos.has("marca") || datos.has("marca_lista")) {
    const elegida = await marcaPorNombre(marcaEscrita(datos));
    marca = { nombre: elegida.marca?.nombre ?? "", id: elegida.marca?.id ?? null };
    if (elegida.nueva && elegida.marca) marcaNueva = elegida.marca.nombre;
  }
  return {
    datos: {
      nombre,
      unidad: viene("unidad") ? leerUnidad(datos) : (actual?.unidad ?? "kg"),
      descripcion: viene("descripcion") ? texto(datos, "descripcion") : (actual?.descripcion ?? ""),
      costo_usd: precios.costo_usd,
      margen_pct: precios.margen_pct,
      precio_usd: precios.precio_usd,
      precio_detal_usd: detal,
      familia_id: familia,
      marca: marca.nombre,
      marca_id: marca.id,
      seccion: viene("seccion") ? texto(datos, "seccion") : (actual?.seccion ?? ""),
      presentacion: viene("presentacion") || datos.has("presentacion_lista") ? presentacionEscrita(datos) : (actual?.presentacion ?? ""),
      contenido: viene("contenido") ? texto(datos, "contenido") : (actual?.contenido ?? ""),
      destacado: completo ? texto(datos, "destacado") === "1" : Boolean(actual?.destacado),
      en_oferta: completo ? texto(datos, "en_oferta") === "1" : Boolean(actual?.en_oferta),
    },
    estado,
    categorias,
    secciones,
    existencia,
    marcaNueva,
  };
}

/** Lo que va después de guardar el producto: sus otras familias, su foto y, si se escribió, la existencia contada. */
async function despuesDeGuardar(id: number, formulario: FormularioDeProducto, datos: FormData): Promise<string> {
  if (formulario.categorias) await ponerCategorias(id, formulario.categorias, formulario.datos.familia_id, formulario.secciones ?? undefined);
  let aviso = formulario.marcaNueva ? ` Marca «${formulario.marcaNueva}» creada.` : "";
  const foto = archivoDe(datos, "foto");
  if (foto) {
    try {
      await guardarFotoDeProducto(id, foto.type, new Uint8Array(await foto.arrayBuffer()));
      aviso += " Con su foto.";
    } catch (error) {
      aviso += ` La foto no se guardó: ${mensajeDe(error)}`;
    }
  }
  if (formulario.existencia !== null) {
    const cambio = ajustePorRecuento(await existenciaSinMarca(id), formulario.existencia);
    if (cambio !== 0) {
      await registrarAjuste({ fecha: hoy(), producto_id: id, variante_id: null, cantidad: cambio, motivo: "Recuento desde la ficha del producto" });
    }
    aviso += ` Existencia: ${cantidad(formulario.existencia, formulario.datos.unidad)}.`;
  }
  return aviso;
}

const DESPUES_DE_CREAR: Record<EstadoProducto, string> = {
  borrador: "en borrador: no sale en la web hasta que lo actives",
  activo: "y publicado: ya sale en la web",
  inactivo: "oculto: no sale en la web hasta que lo actives",
};

export async function guardarProducto(datos: FormData): Promise<void> {
  await exigirSesion();
  const origen = "/admin/productos/nuevo";
  if (texto(datos, "crear_familia") === "1") await crearFamiliaDesdeElProducto(datos, origen);
  const volver = (mensaje: string): never => volverConError(`${origen}?${escritoDelProducto(datos).toString()}`, mensaje);
  const formulario = await leerFormularioDeProducto(datos, null, volver);
  const id = await crearProducto(formulario.datos, formulario.estado);
  const aviso = await despuesDeGuardar(id, formulario, datos);
  volverConExito(
    `/admin/productos/${id}`,
    `Producto «${formulario.datos.nombre}» creado ${DESPUES_DE_CREAR[formulario.estado]}.${aviso} Sus marcas y presentaciones se añaden abajo, en «Marcas y presentaciones».`,
  );
}

/**
 * Guarda la ficha de un producto. Los campos que el formulario no traiga se
 * dejan como estaban, así el mismo destino sirve para cambiar solo el
 * precio.
 */
export async function editarProducto(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const producto = id ? await buscarProducto(id) : null;
  if (!id || !producto) volverConError("/admin/productos", "No se encontró el producto.");
  const origen = `/admin/productos/${id}`;
  if (texto(datos, "crear_familia") === "1") await crearFamiliaDesdeElProducto(datos, origen);
  const completo = texto(datos, "formulario") === "completo";
  const volver = (mensaje: string): never => volverConError(completo ? `${origen}?${escritoDelProducto(datos).toString()}` : volverA(datos, origen), mensaje);
  const formulario = await leerFormularioDeProducto(datos, producto, volver);
  await actualizarProducto(id, formulario.datos);
  if (formulario.estado !== estadoDeProducto(producto)) await ponerEstado(id, formulario.estado);
  const aviso = await despuesDeGuardar(id, formulario, datos);
  volverConExito(volverA(datos, origen), `«${formulario.datos.nombre}» guardado.${aviso} La web ya lo muestra así.`);
}

export async function retirarFotoDeProducto(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const producto = id ? await buscarProducto(id) : null;
  if (!id || !producto) volverConError("/admin/productos", "No se encontró el producto.");
  await quitarFotoDeProducto(id);
  volverConExito(volverA(datos, `/admin/productos/${id}`), `Foto quitada de «${producto.nombre}»: la web vuelve a enseñar la foto de referencia.`);
}

/**
 * Solo la foto de un tipo de producto, desde la galería de Fotos: se
 * guarda centrada, sobre blanco y del tamaño de todas (800 × 800); una sin
 * fondo (PNG transparente) queda sobre blanco, no sobre negro.
 */
export async function cambiarFotoDeProducto(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const producto = id ? await buscarProducto(id) : null;
  if (!id || !producto) volverConError("/admin/fotos", "No se encontró el producto.");
  const vuelta = volverA(datos, `/admin/productos/${id}`);
  const foto = archivoDe(datos, "foto");
  if (!foto) volverConError(vuelta, `Elige la foto de ${producto.nombre}.`);
  try {
    await guardarFotoDeProducto(id, foto.type, new Uint8Array(await foto.arrayBuffer()));
  } catch (error) {
    volverConError(vuelta, `La foto no se guardó: ${mensajeDe(error)}`);
  }
  volverConExito(vuelta, `Foto de «${producto.nombre}» cambiada: la web ya la enseña, centrada y sobre blanco.`);
}

export async function cambiarFotoDeVariante(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "variante_id");
  const variante = id ? await buscarVariante(id) : null;
  if (!id || !variante) volverConError("/admin/fotos", "No se encontró la marca o presentación.");
  const vuelta = volverA(datos, `/admin/productos/${variante.producto_id}`);
  const foto = archivoDe(datos, "foto");
  if (!foto) volverConError(vuelta, `Elige la foto de ${variante.nombre}.`);
  try {
    await guardarFotoDeVariante(id, foto.type, new Uint8Array(await foto.arrayBuffer()));
  } catch (error) {
    volverConError(vuelta, `La foto no se guardó: ${mensajeDe(error)}`);
  }
  volverConExito(vuelta, `Foto de «${variante.nombre}» cambiada: la web ya la enseña, centrada y sobre blanco.`);
}

/** La confirmación está en `/admin/productos/[id]/eliminar`. Uno ya vendido, comprado o contado no se borra: se esconde. */
export async function borrarProducto(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const producto = id ? await buscarProducto(id) : null;
  if (!id || !producto) volverConError("/admin/productos", "No se encontró el producto.");
  const resultado = await eliminarProducto(id);
  if (resultado === "con_movimientos") {
    volverConError(`/admin/productos/${id}`, `«${producto.nombre}» no se puede borrar: ya tiene ventas, compras o recuentos que lo nombran. Escóndelo de la web.`);
  }
  volverConExito("/admin/productos", `Producto «${producto.nombre}» borrado.`);
}

/** Crea en borrador los productos y los combos del catálogo inicial que falten. */
export async function prepararCatalogo(): Promise<void> {
  await exigirSesion();
  const { productos, ofertas } = await prepararCatalogoInicial();
  if (productos === 0 && ofertas === 0) volverConExito("/admin/productos", "El catálogo inicial ya estaba preparado: no faltaba nada.");
  volverConExito(
    "/admin/productos?estado=borrador",
    `Preparados ${productos} productos y ${ofertas} combos en borrador: sin precio y sin publicar. Completa los que vendas y actívalos; borra los que no.`,
  );
}

// ---------- Artículos: cada marca y presentación de un tipo de producto ----------

/**
 * Marca, presentación, contenido, descripción, costo y precio de un
 * artículo, del formulario. La marca es una de la lista o una nueva, que
 * se crea al guardar; hace falta la marca o la presentación.
 */
async function leerVariante(datos: FormData, origen: string): Promise<{ variante: DatosVariante; marcaNueva: string | null }> {
  const escrita = marcaEscrita(datos);
  const presentacion = presentacionEscrita(datos);
  const contenido = texto(datos, "contenido");
  if (!escrita && !presentacion && !contenido) {
    volverConError(origen, "Escribe la marca (o elígela de la lista), la presentación o las dos: «Guaralact», «Bolsa de 1 kg».");
  }
  const costo = numero(datos, "costo_usd");
  const precio = numero(datos, "precio_usd");
  for (const valor of [costo, precio]) {
    if (valor !== null && valor < 0) volverConError(origen, "Costo y precios no pueden ser negativos.");
  }
  const { marca, nueva } = await marcaPorNombre(escrita);
  return {
    variante: {
      marca_id: marca?.id ?? null,
      marca: marca?.nombre ?? "",
      presentacion,
      contenido,
      descripcion: texto(datos, "descripcion"),
      costo_usd: costo,
      precio_usd: precio,
    },
    marcaNueva: nueva && marca ? marca.nombre : null,
  };
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

/**
 * Añade un artículo (una marca o presentación) a un tipo de producto. Si el
 * tipo se vendía hasta ahora sin separar artículos, lo que vendía pasa
 * antes a la lista (`pasarAArticulo`): así no desaparece de la web. Desde
 * «Agregar producto», el formulario trae también las otras categorías del
 * tipo, que se guardan con él.
 */
export async function guardarVariante(datos: FormData): Promise<void> {
  await exigirSesion();
  const productoId = numero(datos, "producto_id");
  const producto = productoId ? await buscarProducto(productoId) : null;
  if (!productoId || !producto) volverConError("/admin/productos", "No se encontró el producto.");
  const origen = volverA(datos, `/admin/productos/${producto.id}`);
  const { variante, marcaNueva } = await leerVariante(datos, origen);
  if (!variante.marca && !variante.presentacion && !variante.contenido && texto(datos, "tipo")) {
    volverConError(origen, `${producto.nombre} ya está: para añadirle un artículo di su marca (de la lista o una nueva), su presentación o su contenido.`);
  }
  const pasado = await pasarAArticulo(producto);
  const id = await crearVariante(producto, variante);
  const foto = await ponerFotoDeVariante(datos, id);
  // Desde «Agregar producto»: las casillas marcadas se suman a las categorías del tipo (quitarle una se hace en su ficha),
  // marcarlo destacado lo destaca, y el estado elegido se le aplica (así un borrador se publica al darle su primera marca).
  if (texto(datos, "categorias_del_tipo") === "1") {
    const marcadas = datos.getAll("categoria").map(Number).filter((n) => Number.isSafeInteger(n) && n > 0);
    const deAntes = await categoriasDeProducto(producto.id);
    await ponerCategorias(producto.id, [...new Set([...deAntes, ...marcadas])], producto.familia_id);
    if (texto(datos, "destacado") === "1" && !producto.destacado) {
      await actualizarProducto(producto.id, { ...producto, destacado: true, en_oferta: Boolean(producto.en_oferta) });
    }
  }
  const estadoPedido = texto(datos, "estado");
  const publicado = esEstadoDeProducto(estadoPedido) && estadoPedido !== estadoDeProducto(producto) ? estadoPedido : null;
  if (publicado) await ponerEstado(producto.id, publicado);
  const etiqueta = nombreDeVenta(producto.nombre, (await buscarVariante(id))?.nombre);
  const antes = pasado ? ` Lo que ya vendías de ${producto.nombre} pasó a la lista como un artículo más.` : "";
  const estadoAviso = publicado ? ` ${producto.nombre} queda ${NOMBRE_ESTADO_PRODUCTO[publicado].toLowerCase()}.` : "";
  volverConExito(
    `/admin/productos/${producto.id}#marcas`,
    `«${etiqueta}» añadido.${marcaNueva ? ` Marca «${marcaNueva}» creada.` : ""}${foto}${antes}${estadoAviso} La web ya lo enseña dentro de ${producto.nombre}.`,
  );
}

/**
 * «Agregar producto», en un solo formulario: si el tipo elegido es uno que
 * ya está, se le añade el artículo (marca, presentación, precio, foto); si
 * es «nuevo», se crea el tipo con todo lo escrito, como siempre.
 */
export async function agregarProducto(datos: FormData): Promise<void> {
  // El tipo viene del selector; un formulario de antes lo manda como `producto_id`.
  const tipo = texto(datos, "tipo") || texto(datos, "producto_id");
  if (!tipo || tipo === "nuevo") return guardarProducto(datos);
  datos.set("producto_id", tipo);
  datos.set("categorias_del_tipo", "1");
  if (!texto(datos, "volver_a")) datos.set("volver_a", `/admin/productos/nuevo?tipo=${encodeURIComponent(tipo)}`);
  return guardarVariante(datos);
}

export async function editarVariante(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "variante_id");
  const variante = id ? await buscarVariante(id) : null;
  const producto = variante ? await buscarProducto(variante.producto_id) : null;
  if (!id || !variante || !producto) volverConError("/admin/productos", "No se encontró la marca o presentación.");
  const { variante: nueva, marcaNueva } = await leerVariante(datos, `/admin/productos/${producto.id}`);
  await actualizarVariante(id, producto, nueva);
  const foto = await ponerFotoDeVariante(datos, id);
  const etiqueta = nombreDeVenta(producto.nombre, (await buscarVariante(id))?.nombre);
  volverConExito(`/admin/productos/${producto.id}#marcas`, `«${etiqueta}» guardado.${marcaNueva ? ` Marca «${marcaNueva}» creada.` : ""}${foto}`);
}

// ---------- Marcas ----------

export async function cambiarNombreDeMarca(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const marca = id ? await buscarMarca(id) : null;
  if (!id || !marca) volverConError("/admin/marcas", "No se encontró la marca.");
  const nombre = texto(datos, "nombre");
  const resultado = await renombrarMarca(id, nombre);
  if (resultado === "vacio") volverConError("/admin/marcas", "Escribe el nombre de la marca.");
  if (resultado === "ya_existe") volverConError("/admin/marcas", `Ya hay una marca «${nombre}». Si es la misma, únelas.`);
  volverConExito("/admin/marcas", `«${marca.nombre}» ahora se llama «${nombre.trim()}», también en sus artículos.`);
}

/** Une dos marcas que son la misma (por una errata): todo lo de una pasa a la otra. */
export async function juntarMarcas(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const destino = numero(datos, "destino");
  const [marca, otra] = await Promise.all([id ? buscarMarca(id) : null, destino ? buscarMarca(destino) : null]);
  if (!id || !destino || !marca || !otra) volverConError("/admin/marcas", "Elige con qué marca unirla.");
  const resultado = await unirMarcas(id, destino);
  if (resultado === "misma") volverConError("/admin/marcas", "Es la misma marca.");
  volverConExito("/admin/marcas", `«${marca.nombre}» unida a «${otra.nombre}»: sus artículos ya dicen «${otra.nombre}».`);
}

export async function borrarMarca(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const marca = id ? await buscarMarca(id) : null;
  if (!id || !marca) volverConError("/admin/marcas", "No se encontró la marca.");
  const resultado = await eliminarMarca(id);
  if (resultado === "en_uso") volverConError("/admin/marcas", `«${marca.nombre}» todavía tiene artículos: cámbialos de marca o únela con otra.`);
  volverConExito("/admin/marcas", `Marca «${marca.nombre}» borrada.`);
}

export async function alternarVariante(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "variante_id");
  const variante = id ? await buscarVariante(id) : null;
  if (!id || !variante) volverConError("/admin/productos", "No se encontró la marca o presentación.");
  const activa = texto(datos, "activo") === "1";
  await cambiarActivaVariante(id, activa);
  volverConExito(`/admin/productos/${variante.producto_id}`, activa ? `«${variante.nombre}» vuelve a estar en la web.` : `«${variante.nombre}» escondida: no sale en la web ni en las ventas.`);
}

export async function retirarFotoDeVariante(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "variante_id");
  const variante = id ? await buscarVariante(id) : null;
  if (!id || !variante) volverConError("/admin/productos", "No se encontró la marca o presentación.");
  await quitarFotoDeVariante(id);
  volverConExito(volverA(datos, `/admin/productos/${variante.producto_id}`), `Foto quitada de «${variante.nombre}».`);
}

/** Solo se borra la que no se vendió nunca: las notas nombran a las demás. */
export async function borrarVariante(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "variante_id");
  const variante = id ? await buscarVariante(id) : null;
  if (!id || !variante) volverConError("/admin/productos", "No se encontró la marca o presentación.");
  const resultado = await eliminarVariante(id);
  if (resultado === "con_ventas") {
    volverConError(`/admin/productos/${variante.producto_id}`, `«${variante.nombre}» ya está en alguna nota de venta: no se puede borrar. Escóndela y dejará de salir en la web y en las ventas.`);
  }
  volverConExito(`/admin/productos/${variante.producto_id}`, `«${variante.nombre}» eliminada.`);
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
    volverConExito(
      "/admin/productos",
      resultado.delLunes
        ? `Tasa del lunes ${fechaCorta(resultado.delLunes)} puesta: ${resultado.valor} bolívares por dólar. Los fines de semana vale la del lunes, como en los comercios.`
        : `Tasa del BCV puesta: ${resultado.valor} bolívares por dólar.`,
    );
  }
  if (resultado.estado === "se_queda") volverConExito("/admin/productos", `La tasa se queda en ${resultado.valor}: ${resultado.motivo}.`);
  const motivo = resultado.estado === "apagada" ? "la actualización está apagada" : resultado.motivo;
  volverConError("/admin/productos", `No se cambió la tasa: ${motivo}.`);
}

/** Publicar u ocultar un producto. Publicar un borrador lo saca del borrador. */
export async function alternarProducto(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const producto = id ? await buscarProducto(id) : null;
  if (!id || !producto) volverConError("/admin/productos", "No se encontró el producto.");
  const activo = texto(datos, "activo") === "1";
  await cambiarActivo(id, activo);
  volverConExito(
    volverA(datos, "/admin/productos"),
    activo ? `«${producto.nombre}» publicado: ya sale en la web.` : `«${producto.nombre}» oculto: no sale en la web ni en las ventas.`,
  );
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
  const [productos, variantes, existencias] = await Promise.all([listarProductos(true), listarVariantes(), existenciasPorClave()]);
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
    const inventario = existencias.get(v.clave);
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
      // Lo que hay (si el inventario sigue este producto) y lo que suele pesar una pieza: para avisar si no cuadra.
      existencia: inventario?.seguido ? inventario.existencia : null,
      pesoTipico: inventario?.pesoPorPieza ?? null,
    };
    if (!lineaRellena(linea)) continue;
    linea.ultimoPrecio = await ultimoPrecioAlCliente(clienteId, v.producto_id, v.variante_id);
    escritas.push(linea);
  }

  const revision = revisarVenta(escritas);
  if (revision.errores.length > 0) volver(revision.errores.join(" "));
  if (revision.avisos.length > 0 && texto(datos, "confirmar") !== "1") {
    volver(`${revision.avisos.join(" ")} Si es así, marca «Lo escrito es correcto» y guarda otra vez.`, "confirmar");
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
  // «Ya la entregué» con un día previsto de entrega no puede ser: una de las dos cosas está mal.
  if (!porEntregar && entregaPrevista) {
    volver(
      `Marcaste «Sí, ya la entregué» y a la vez pusiste un día previsto de entrega (${fechaCorta(entregaPrevista)}). Si ya la entregaste, borra ese día; si queda por entregar, elige «No, queda por entregar».`,
    );
  }
  if (!porEntregar) {
    if (fotoMala) volver(fotoMala);
    if (!foto) volver(SIN_FOTO);
    // La foto se lee y se coteja con el pedido línea a línea: si no es la nota, o algo no cuadra, se avisa antes de guardar.
    lectura = await leerLaNota(foto, vendibles);
    const anotadas = escritas.map((l) => ({
      clave: claveDe(l.producto_id, l.variante_id),
      nombre: l.producto,
      unidad: l.unidad,
      piezas: l.piezas,
      cantidad: l.cantidad!,
      precio: l.precio!,
      importe: redondear(l.cantidad! * l.precio!),
    }));
    reparos = lectura.nota ? compararNota(lectura.nota, { fecha, total, lineas: anotadas }) : [];
    if (reparos.length > 0 && texto(datos, "confirmar_nota") !== "1") volver(avisoDeLaNota(reparos, "guarda otra vez"), "confirmar_nota");
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(entregaPrevista) || Number.isNaN(new Date(entregaPrevista + "T00:00:00Z").getTime())) {
    volver("Escribe el día previsto de entrega, para que el resumen te lo recuerde.");
  } else if (entregaPrevista < fecha) {
    volver("El día previsto de entrega no puede ser antes de la fecha de la nota.");
  } else if (entregaPrevista > sumarDias(hoy(), 30) && texto(datos, "confirmar") !== "1") {
    volver(`El día previsto de entrega (${fechaCorta(entregaPrevista)}) está a más de un mes. Si es así, marca «Lo escrito es correcto» y guarda otra vez.`, "confirmar");
  }

  let ventaId = 0;
  try {
    // La nota va con la tasa del día de la nota, aunque se registre días después.
    const tasa = await tasaEnFecha(fecha);
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
    const [productos, variantes] = await Promise.all([listarProductos(true), listarVariantes()]);
    lectura = await leerLaNota(foto, vendiblesDe(productos, variantes));
    const anotadas = venta.lineas.map((l) => ({
      clave: claveDe(l.producto_id, l.variante_id ?? null),
      nombre: l.producto_nombre,
      unidad: l.unidad,
      piezas: l.piezas,
      cantidad: Number(l.cantidad),
      precio: Number(l.precio_unitario_usd),
      importe: Number(l.subtotal_usd),
    }));
    reparos = lectura.nota ? compararNota(lectura.nota, { fecha: venta.fecha, total: venta.total_usd, lineas: anotadas }) : [];
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

/**
 * Registra un abono. La captura del pago (obligatoria con pago móvil,
 * transferencia, Zelle y Binance) se guarda con el abono; lo que se lee de
 * ella y lo que se comprueba está en `revisarPago`.
 */
export async function guardarPago(datos: FormData): Promise<void> {
  await exigirSesion();
  const origen = volverA(datos, "/admin/pagos");
  const p = await revisarPago(datos, origen, { campoId: "cliente_id", sinId: "Elige un cliente.", comprobanteObligatorio: true, nombre: "abono", boton: "Registrar abono" });
  const clienteId = p.id;

  let pagoId = 0;
  try {
    pagoId = await registrarPago({
      cliente_id: clienteId,
      fecha: p.fecha,
      metodo: p.metodo,
      moneda: p.moneda,
      monto: p.monto,
      tasa: p.tasa,
      referencia: texto(datos, "referencia"),
      nota: texto(datos, "nota"),
    });
    if (p.foto) await pasarFotoAAdjuntos(p.foto.id, clienteId, null, `Captura del abono del ${fechaCorta(p.fecha)}`, pagoId);
  } catch (error) {
    // Si el abono ya entró y solo falló la captura, no se vuelve al formulario: se anotaría dos veces.
    if (pagoId) volverConExito(`/admin/clientes/${clienteId}`, `Abono registrado, pero la captura no se guardó: ${mensajeDe(error)}`);
    p.volver(mensajeDe(error));
  }
  volverConExito(`/admin/clientes/${clienteId}`, `Abono registrado${p.foto ? " con su captura" : ""}.${p.notaDeTasa}${comentarioDeLaCaptura(p)} Abajo, en Abonos, puedes mandarle el recibo.`);
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
  // De un producto («3») o, si tiene marcas, de una de ellas («1-7»): cada marca tiene sus propias reseñas.
  const [delProducto, deLaMarca] = (texto(datos, "clave") || texto(datos, "producto_id")).split("-");
  const productoId = Number(delProducto) || 0;
  const varianteId = deLaMarca ? Number(deLaMarca) || 0 : null;
  const producto = productoId ? await buscarProducto(productoId) : null;
  const variante = varianteId ? await buscarVariante(varianteId) : null;
  if (!producto || (varianteId !== null && (!variante || variante.producto_id !== producto.id))) {
    volverConError("/admin/resenas", "Elige de qué producto es la reseña.");
  }
  const nombre = nombreDeVenta(producto.nombre, variante?.nombre);

  const lectura = leerResena({ autor: texto(datos, "autor"), detalle: texto(datos, "detalle"), texto: texto(datos, "texto") });
  if (!lectura.valida) volverConError("/admin/resenas", lectura.motivo);

  // La casilla dice que el cliente dio permiso para salir con su nombre.
  // Sin ella la reseña se guarda, pero escondida hasta tener el permiso.
  const conPermiso = texto(datos, "permiso") === "1";
  const id = await crearResena(producto.id, variante?.id ?? null, lectura.datos, conPermiso);
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
      ? `Reseña de ${lectura.datos.autor} guardada. Ya sale en la página de «${nombre}».`
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

// ---------- Familias ----------

/** Nombre, descripción, icono, orden y si está activa, del formulario de una familia. */
async function leerFamilia(datos: FormData, volver: (mensaje: string) => never): Promise<DatosFamilia> {
  const nombre = texto(datos, "nombre");
  if (!nombre) volver("La familia necesita un nombre («Burger», «Bebidas»).");
  const orden = numero(datos, "orden");
  if (orden !== null && (!Number.isInteger(orden) || orden < 0 || orden > 999)) volver("El orden es un número entero: 1 sale primero.");
  return {
    nombre,
    descripcion: texto(datos, "descripcion"),
    icono: iconoDe(texto(datos, "icono")),
    orden: orden ?? (await siguienteOrden()),
    activa: texto(datos, "activa") === "1",
    coleccion: texto(datos, "coleccion") === "1",
  };
}

async function ponerPortadaDeFamilia(datos: FormData, id: number): Promise<string> {
  const portada = archivoDe(datos, "portada");
  if (!portada) return "";
  try {
    await guardarFotoDeFamilia(id, portada.type, new Uint8Array(await portada.arrayBuffer()));
    return " Con su portada.";
  } catch (error) {
    return ` La portada no se guardó: ${mensajeDe(error)}`;
  }
}

export async function guardarFamilia(datos: FormData): Promise<void> {
  await exigirSesion();
  const origen = volverA(datos, "/admin/familias");
  const familia = await leerFamilia(datos, (mensaje) => volverConError(origen, mensaje));
  if (await buscarFamiliaPorNombre(familia.nombre)) volverConError(origen, `Ya hay una familia «${familia.nombre}».`);
  const id = await crearFamilia(familia);
  const portada = await ponerPortadaDeFamilia(datos, id);
  volverConExito(origen, `Familia «${familia.nombre}» creada.${portada} Ya se puede elegir al crear o editar un producto.`);
}

export async function editarFamilia(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const actual = id ? await buscarFamilia(id) : null;
  if (!id || !actual) volverConError("/admin/familias", "No se encontró la familia.");
  const familia = await leerFamilia(datos, (mensaje) => volverConError("/admin/familias", mensaje));
  const otra = await buscarFamiliaPorNombre(familia.nombre);
  if (otra && otra.id !== id) volverConError("/admin/familias", `Ya hay otra familia «${familia.nombre}».`);
  await actualizarFamilia(id, familia);
  const portada = await ponerPortadaDeFamilia(datos, id);
  volverConExito("/admin/familias", `Familia «${familia.nombre}» guardada.${portada}`);
}

export async function alternarFamilia(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const familia = id ? await buscarFamilia(id) : null;
  if (!id || !familia) volverConError("/admin/familias", "No se encontró la familia.");
  const activa = texto(datos, "activa") === "1";
  await cambiarActivaFamilia(id, activa);
  volverConExito(
    "/admin/familias",
    activa ? `«${familia.nombre}» vuelve a salir en la web.` : `«${familia.nombre}» escondida: su página y su tarjeta no salen. Sus productos siguen en la web.`,
  );
}

export async function retirarPortadaDeFamilia(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const familia = id ? await buscarFamilia(id) : null;
  if (!id || !familia) volverConError("/admin/familias", "No se encontró la familia.");
  await quitarFotoDeFamilia(id);
  volverConExito(volverA(datos, "/admin/familias"), `Portada quitada de «${familia.nombre}».`);
}

/** Solo la portada de una familia, desde la galería de Fotos: se recorta en 4:3 como todas. */
export async function cambiarPortadaDeFamilia(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const familia = id ? await buscarFamilia(id) : null;
  if (!id || !familia) volverConError("/admin/fotos", "No se encontró la familia.");
  const vuelta = volverA(datos, "/admin/familias");
  const portada = archivoDe(datos, "portada");
  if (!portada) volverConError(vuelta, `Elige la portada de ${familia.nombre}.`);
  try {
    await guardarFotoDeFamilia(id, portada.type, new Uint8Array(await portada.arrayBuffer()));
  } catch (error) {
    volverConError(vuelta, `La portada no se guardó: ${mensajeDe(error)}`);
  }
  volverConExito(vuelta, `Portada de «${familia.nombre}» cambiada.`);
}

/** La confirmación está en `/admin/familias/[id]/eliminar`: si tiene productos, ahí se elige a qué familia pasan. */
export async function borrarFamilia(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const familia = id ? await buscarFamilia(id) : null;
  if (!id || !familia) volverConError("/admin/familias", "No se encontró la familia.");
  const pasarA = numero(datos, "pasar_a");
  const resultado = await eliminarFamilia(id, pasarA);
  if (resultado === "falta_destino") volverConError(`/admin/familias/${id}/eliminar`, "Elige a qué familia pasan sus productos antes de borrarla.");
  const destino = pasarA ? await buscarFamilia(pasarA) : null;
  volverConExito("/admin/familias", `Familia «${familia.nombre}» borrada.${destino ? ` Sus productos pasaron a «${destino.nombre}».` : ""}`);
}

// ---------- Ofertas y combos ----------

/** Una fecha aaaa-mm-dd o nada. */
function fechaDelFormulario(datos: FormData, campo: string, volver: (mensaje: string) => never): string | null {
  const valor = texto(datos, campo);
  if (!valor) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(new Date(valor + "T00:00:00Z").getTime())) volver("Revisa las fechas de la oferta.");
  return valor;
}

export async function guardarOferta(datos: FormData): Promise<void> {
  await exigirSesion();
  const nombre = texto(datos, "nombre");
  if (!nombre) volverConError("/admin/ofertas", "La oferta necesita un nombre («Pack Burger»).");
  const id = await crearOferta({
    nombre,
    descripcion: texto(datos, "descripcion"),
    precio_usd: null,
    desde: null,
    hasta: null,
    estado: "borrador",
    orden: (await listarOfertas()).length + 1,
  });
  volverConExito(`/admin/ofertas/${id}`, `Oferta «${nombre}» creada en borrador. Elige lo que lleva, ponle precio y fechas, y actívala.`);
}

export async function editarOferta(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const oferta = id ? await buscarOferta(id) : null;
  if (!id || !oferta) volverConError("/admin/ofertas", "No se encontró la oferta.");
  const origen = `/admin/ofertas/${id}`;
  const volver: (mensaje: string) => never = (mensaje) => volverConError(origen, mensaje);
  const nombre = texto(datos, "nombre");
  if (!nombre) volver("La oferta necesita un nombre.");
  const precio = numero(datos, "precio_usd");
  if (precio !== null && precio < 0) volver("El precio no puede ser negativo.");
  const desde = fechaDelFormulario(datos, "desde", volver);
  const hasta = fechaDelFormulario(datos, "hasta", volver);
  if (desde && hasta && hasta < desde) volver("La oferta no puede acabar antes de empezar.");
  const estado = texto(datos, "estado");
  if (!esEstadoDeOferta(estado)) volver("Elige el estado de la oferta.");
  const productos = datos
    .getAll("producto")
    .map(Number)
    .filter((n) => Number.isSafeInteger(n) && n > 0)
    .map((productoId) => ({ producto_id: productoId, cantidad: texto(datos, `cantidad_${productoId}`).slice(0, 40) }));
  await actualizarOferta(id, { nombre, descripcion: texto(datos, "descripcion"), precio_usd: precio, desde, hasta, estado, orden: numero(datos, "orden") ?? oferta.orden }, productos);
  const aviso =
    estado === "activa" && productos.length === 0
      ? " Ojo: está activa y no lleva ningún producto."
      : estado === "activa" && precio === null
        ? " Está activa sin precio: la web dice «consulta el precio»."
        : "";
  volverConExito(origen, `Oferta «${nombre}» guardada.${aviso}`);
}

/** La confirmación está en `/admin/ofertas/[id]/eliminar`. */
export async function borrarOferta(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const oferta = id ? await buscarOferta(id) : null;
  if (!id || !oferta) volverConError("/admin/ofertas", "No se encontró la oferta.");
  await eliminarOferta(id);
  volverConExito("/admin/ofertas", `Oferta «${oferta.nombre}» borrada.`);
}
