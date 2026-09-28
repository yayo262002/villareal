"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cerrarSesion, claveEsCorrecta, exigirSesion, iniciarSesion } from "./sesion";
import { actualizarCliente, crearCliente, type TipoCliente } from "./clientes";
import { actualizarPrecio, cambiarActivo, crearProducto, type Unidad } from "./productos";
import { crearVenta, type LineaVenta } from "./ventas";
import { registrarPago } from "./pagos";
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

  const id = crearCliente(cliente);
  volverConExito(`/admin/clientes/${id}`, "Cliente registrado.");
}

export async function editarCliente(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  if (!id) volverConError("/admin/clientes", "No se encontró el cliente.");
  const cliente = leerCliente(datos);
  if (!cliente.nombre) volverConError(`/admin/clientes/${id}`, "El nombre es obligatorio.");

  actualizarCliente(id, cliente);
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

  crearProducto(nombre, unidad, precio);
  volverConExito("/admin/productos", "Producto creado.");
}

export async function cambiarPrecio(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  if (!id) volverConError("/admin/productos", "No se encontró el producto.");
  const precio = numero(datos, "precio_usd");
  if (precio !== null && precio < 0) volverConError("/admin/productos", "El precio no puede ser negativo.");

  actualizarPrecio(id, precio);
  volverConExito("/admin/productos", "Precio actualizado.");
}

export async function alternarProducto(datos: FormData): Promise<void> {
  await exigirSesion();
  const id = numero(datos, "id");
  if (!id) volverConError("/admin/productos", "No se encontró el producto.");
  cambiarActivo(id, texto(datos, "activo") === "1");
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
    crearVenta(clienteId, fecha, lineas, texto(datos, "nota"));
  } catch (error) {
    volverConError("/admin/ventas", error instanceof Error ? error.message : "No se pudo guardar.");
  }
  volverConExito(`/admin/clientes/${clienteId}`, "Venta registrada.");
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
    registrarPago({
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
    volverConError(volverA, error instanceof Error ? error.message : "No se pudo guardar.");
  }
  volverConExito(`/admin/clientes/${clienteId}`, "Pago registrado.");
}
