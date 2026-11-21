"use server";

import { redirect } from "next/navigation";
import { exigirSesion } from "./sesion";
import { conectarConCodigo, guardarDatosDeLaApp, type ResultadoDeConectar } from "./whatsapp-api";

/** Las acciones de la pantalla WhatsApp del panel (`/admin/whatsapp`). Cada una comprueba la sesión. */

const PANTALLA = "/admin/whatsapp";

function volver(clave: "ok" | "error", mensaje: string): never {
  redirect(`${PANTALLA}?${clave}=${encodeURIComponent(mensaje)}`);
}

/** Los datos de la app de Meta: solo cifras en los ids; la clave secreta, 32 letras y números (vacía, se deja la que había). */
export async function guardarDatosWhatsapp(datos: FormData): Promise<void> {
  await exigirSesion();
  const appId = String(datos.get("app_id") ?? "").trim();
  const configId = String(datos.get("config_id") ?? "").trim();
  const secreto = String(datos.get("secreto") ?? "").trim();
  if (!/^\d{6,25}$/.test(appId)) volver("error", "El identificador de la app son solo cifras: cópialo de Meta for Developers (arriba, «Identificador de la app»).");
  if (configId && !/^\d{6,25}$/.test(configId)) volver("error", "El identificador de la configuración son solo cifras.");
  if (secreto && !/^[0-9a-f]{32}$/i.test(secreto)) volver("error", "La clave secreta de la app son 32 letras y números: cópiala entera de Configuración → Básica → «Clave secreta de la app» (pulsa «Mostrar»).");
  await guardarDatosDeLaApp({ appId, configId, secreto });
  volver("ok", secreto ? "Datos de la app guardados, con la clave secreta." : "Datos de la app guardados.");
}

/** Lo que llama el botón «Conectar el número» al cerrarse la ventana de Meta, con el código y lo que la ventana dijo. */
export async function conectarWhatsapp(datos: { code: string; wabaId: string; telefonoId: string }): Promise<ResultadoDeConectar> {
  await exigirSesion();
  // El código es largo y lleva letras, cifras y algún signo: se quita solo lo que no se ve (espacios, saltos).
  const limpio = (v: unknown) => String(v ?? "").replace(/[^\x21-\x7e]/g, "").slice(0, 2000);
  const code = limpio(datos.code);
  if (!code) return { ok: false, mensaje: "La ventana de Meta no devolvió el código. Vuelve a intentarlo." };
  return conectarConCodigo({ code, wabaId: limpio(datos.wabaId).replace(/\D/g, ""), telefonoId: limpio(datos.telefonoId).replace(/\D/g, "") });
}
