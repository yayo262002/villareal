"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cerrarSesion, claveEsCorrecta, exigirSesion, iniciarSesion } from "./sesion";
import { actualizarCliente, buscarCliente, crearCliente, type TipoCliente } from "./clientes";
import { actualizarPrecio, cambiarActivo, crearProducto, type Unidad } from "./productos";
import { buscarVenta, crearVenta, eliminarVenta, type LineaVenta } from "./ventas";
import { buscarPago, eliminarPago, registrarPago } from "./pagos";
import { buscarAdjunto, eliminarAdjunto, guardarAdjunto } from "./adjuntos";
import { guardarCopiaNube } from "./copias-nube";
import { esMetodoPago, monedaDelMetodo } from "./dinero";
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

function volverConError(ruta: string, mensaje: string): never {
  redirect(`${ruta}?error=${encodeURIComponent(mensaje)}`);
}

function volverConExito(ruta: string, mensaje: string): never {
  revalidatePath("/admin", "layout");
  revalidatePath("/");
  redirect(`${ruta}?ok=${encodeURIComponent(mensaje)}`);
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

// ---------- Sesión ----------

export async function entrar(datos: FormData): Promise<void> {
  if (!claveEsCorrecta(texto(datos, "clave"))) {
    volverConError("/admin/entrar", "La clave no es correcta.");
  }
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
  return {
    nombre,
    telefono: texto(datos, "telefono"),
    cedula_rif: texto(datos, "cedula_rif"),
    direccion: texto(datos, "direccion"),
    tipo,
    nota: texto(datos, "nota"),
  };
}

export async function guardarCliente(datos: FormData): Promise<void> {
  await exigirSesion();
  const cliente = leerCliente(datos);
  if (!cliente.nombre) volverConError("/admin/clientes", "El nombre es obligatorio.");

  const id = await crearCliente(cliente);
  volverConExito(`/admin/clientes/${id}`, "Cliente registrado.");
}

export async function editarCliente(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  if (!id) volverConError("/admin/clientes", "No se encontró el cliente.");
  const cliente = leerCliente(datos);
  if (!cliente.nombre) volverConError(`/admin/clientes/${id}`, "El nombre es obligatorio.");

  await actualizarCliente(id, cliente);
  volverConExito(`/admin/clientes/${id}`, "Datos guardados.");
}

// ---------- Productos ----------

export async function guardarProducto(datos: FormData): Promise<void> {
  await exigirSesion();
  const nombre = texto(datos, "nombre");
  if (!nombre) volverConError("/admin/productos", "El nombre es obligatorio.");
  const unidad: Unidad = texto(datos, "unidad") === "unidad" ? "unidad" : "kg";
  const precio = numero(datos, "precio_usd");
  if (precio !== null && precio < 0) volverConError("/admin/productos", "El precio no puede ser negativo.");

  await crearProducto(nombre, unidad, precio);
  volverConExito("/admin/productos", "Producto creado.");
}

export async function cambiarPrecio(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  if (!id) volverConError("/admin/productos", "No se encontró el producto.");
  const precio = numero(datos, "precio_usd");
  if (precio !== null && precio < 0) volverConError("/admin/productos", "El precio no puede ser negativo.");

  await actualizarPrecio(id, precio);
  volverConExito("/admin/productos", "Precio actualizado.");
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

  const lineas: LineaVenta[] = [];
  for (let i = 0; i < FILAS_VENTA; i++) {
    const productoId = numero(datos, `producto_${i}`);
    const cantidad = numero(datos, `cantidad_${i}`);
    const precio = numero(datos, `precio_${i}`);
    if (!productoId && cantidad === null && precio === null) continue;
    if (!productoId || cantidad === null || precio === null) {
      volverConError("/admin/ventas", `La fila ${i + 1} está incompleta: producto, cantidad y precio.`);
    }
    lineas.push({ producto_id: productoId, cantidad, precio_unitario_usd: precio });
  }

  try {
    await crearVenta(clienteId, fecha, lineas, texto(datos, "nota"));
  } catch (error) {
    volverConError("/admin/ventas", mensajeDe(error));
  }
  volverConExito(`/admin/clientes/${clienteId}`, "Venta registrada.");
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
  const volverA = texto(datos, "volver_a") || "/admin/pagos";
  const clienteId = numero(datos, "cliente_id");
  const fecha = texto(datos, "fecha");
  const metodo = texto(datos, "metodo");
  const monto = numero(datos, "monto");
  const tasa = numero(datos, "tasa");

  if (!clienteId) volverConError(volverA, "Elige un cliente.");
  if (!fecha) volverConError(volverA, "Falta la fecha.");
  if (!esMetodoPago(metodo)) volverConError(volverA, "Elige el método de pago.");
  if (monto === null || monto <= 0) volverConError(volverA, "El monto tiene que ser mayor que cero.");

  const moneda = monedaDelMetodo(metodo);
  if (moneda === "VES" && (tasa === null || tasa <= 0)) {
    volverConError(volverA, "Un pago en bolívares necesita la tasa del día (Bs por dólar).");
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
    volverConError(volverA, mensajeDe(error));
  }
  volverConExito(`/admin/clientes/${clienteId}`, "Pago registrado.");
}

/** Igual que `borrarVenta`: la confirmación está en `/admin/pagos/[id]/eliminar`. */
export async function borrarPago(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const pago = id ? await buscarPago(id) : null;
  if (!id || !pago) volverConError("/admin/pagos", "No se encontró el pago.");

  await eliminarPago(id);
  volverConExito(`/admin/clientes/${pago.cliente_id}`, "Pago eliminado.");
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
  const volverA = `/admin/clientes/${clienteId}`;

  const archivo = datos.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) volverConError(volverA, "Elige una foto de la nota.");

  const ventaId = numero(datos, "venta_id");
  const venta = ventaId ? await buscarVenta(ventaId) : null;
  if (ventaId && (!venta || venta.cliente_id !== clienteId)) {
    volverConError(volverA, "Esa venta no es de este cliente.");
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
    volverConError(volverA, mensajeDe(error));
  }
  volverConExito(volverA, "Foto guardada.");
}

export async function borrarAdjunto(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  const adjunto = id ? await buscarAdjunto(id) : null;
  if (!id || !adjunto) volverConError("/admin/clientes", "No se encontró la foto.");

  await eliminarAdjunto(id);
  volverConExito(`/admin/clientes/${adjunto.cliente_id}`, "Foto eliminada.");
}
