"use server";

import { redirect } from "next/navigation";
import { exigirSesion } from "./sesion";
import { numeroWhatsapp } from "./whatsapp";
import { conectarConCodigo, crearPlantillaDePrueba, guardarDatosDeLaApp, guardarPruebas, mandarMensajeDePrueba, type ResultadoDeConectar } from "./whatsapp-api";

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

/*
 * La revisión de Meta: el token del número de prueba, mandar un mensaje y crear una plantilla. Lo que se ve en el video
 * que se manda a Meta: por eso los avisos llevan también su traducción al inglés.
 */

const motivo = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** El token de la página de Meta (WhatsApp → Configuración de la API) y, si se copiaron, los dos identificadores. */
export async function guardarTokenDePruebas(datos: FormData): Promise<void> {
  await exigirSesion();
  // El token empieza por «EAA». Se toma solo eso: si el navegador había puesto otra cosa en la casilla, no se mezcla.
  const pegado = String(datos.get("token") ?? "").replace(/s+/g, "");
  const token = pegado.match(/EAA[A-Za-z0-9]{40,}/)?.[0] ?? pegado;
  const wabaId = String(datos.get("waba_id") ?? "").replace(/D/g, "");
  const telefonoId = String(datos.get("telefono_id") ?? "").replace(/D/g, "");
  if (!/^[A-Za-z0-9]{20,2000}$/.test(token)) volver("error", "El token es un texto largo que empieza por «EA»: cópialo entero de WhatsApp → Configuración de la API («Token de acceso»).");
  let numero: string;
  try {
    numero = await guardarPruebas({ token, wabaId, telefonoId });
  } catch (error) {
    volver(
      "error",
      `Meta no aceptó el token: ${motivo(error)}. Lo pegado tenía ${token.length} letras${token.startsWith("EAA") ? "" : " y no empieza por «EAA»"}. Cópialo con el botón de copiar de Meta, bórralo todo en la casilla y pégalo otra vez.`,
    );
  }
  volver("ok", `Token guardado. Número de prueba: ${numero}. (Test number saved.)`);
}

/** Un mensaje desde el número de prueba al teléfono que se escriba (tiene que estar en la lista de destinatarios de Meta). */
export async function mandarPruebaWhatsapp(datos: FormData): Promise<void> {
  await exigirSesion();
  const escrito = String(datos.get("para") ?? "");
  const cifras = escrito.replace(/D/g, "");
  const para = numeroWhatsapp(escrito) ?? (cifras.length >= 8 && cifras.length <= 15 ? cifras : null);
  const texto = String(datos.get("texto") ?? "").trim().slice(0, 1000);
  if (!para) volver("error", "Escribe el teléfono que recibe, como 0412-1234567 (o con el código del país).");
  let id: string;
  try {
    id = await mandarMensajeDePrueba({ para, texto });
  } catch (error) {
    volver("error", `No se mandó: ${motivo(error)}.`);
  }
  volver("ok", `Mensaje enviado a +${para} (Message sent). Id: ${id}`);
}

const CATEGORIAS = ["UTILITY", "MARKETING"];
const IDIOMAS = ["es", "es_MX", "es_ES", "en_US"];

/** Una plantilla de mensaje nueva en la cuenta de prueba: nombre en minúsculas con guiones bajos, sin variables. */
export async function crearPlantillaWhatsapp(datos: FormData): Promise<void> {
  await exigirSesion();
  const nombre = String(datos.get("nombre") ?? "").trim();
  const categoria = String(datos.get("categoria") ?? "");
  const idioma = String(datos.get("idioma") ?? "");
  const texto = String(datos.get("texto") ?? "").trim();
  if (!/^[a-z0-9_]{1,60}$/.test(nombre)) volver("error", "El nombre de la plantilla va en minúsculas, sin espacios ni tildes: por ejemplo «pedido_listo».");
  if (!CATEGORIAS.includes(categoria) || !IDIOMAS.includes(idioma)) volver("error", "Elige la categoría y el idioma.");
  if (!texto || texto.length > 1024) volver("error", "Escribe el mensaje de la plantilla (hasta 1024 letras).");
  if (texto.includes("{{")) volver("error", "Por ahora, la plantilla sin variables ({{1}}): escribe el mensaje completo.");
  let resultado: string;
  try {
    resultado = await crearPlantillaDePrueba({ nombre, categoria, idioma, texto });
  } catch (error) {
    volver("error", `Meta no creó la plantilla: ${motivo(error)}.`);
  }
  volver("ok", `Plantilla «${nombre}» creada (Template created): ${resultado}`);
}
