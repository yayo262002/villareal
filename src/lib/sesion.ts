import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { claveEsCorrecta as compararClave, hayClaveConfigurada, secretoDeSesion } from "./clave";
import { ejecutar, fila } from "./db";
import { subirVersionDeSesion, versionDeSesion } from "./ajustes";

/**
 * El panel lo usa una sola persona (o dos), así que una clave basta: no hay usuarios ni tabla de sesiones. La clave
 * nace en `.env.local` y se puede cambiar desde «He olvidado la clave» (`clave.ts`).
 *
 * La cookie no lleva la clave: lleva cuándo se entró, la versión de las sesiones y una firma HMAC de las dos cosas
 * (revisión de seguridad del 14/11/2026). La firma usa un secreto hecho de dos partes:
 * - la clave del panel (o su resumen, si se cambió): si la clave cambia, todas las sesiones caducan solas;
 * - un secreto al azar del servidor, en la tabla `secretos`, que no va en las copias: una copia de la base no sirve
 *   para fabricar una cookie, y con una cookie robada no se puede adivinar la clave probando fuera de línea.
 * Una sesión vale 30 días. «Cerrar la sesión en todos los teléfonos» sube la versión y las de antes dejan de valer.
 *
 * Las cookies del formato anterior (la firma de un texto fijo) valen hasta el 15/12/2026 para no sacar al dueño del
 * panel de golpe; la primera acción que hace con una de ellas se la cambia por una nueva.
 */

export const COOKIE_SESION = "villareal_sesion";
const DIAS_DE_SESION = 30;
const VIEJAS_VALEN_HASTA = Date.UTC(2026, 11, 15);
const TEXTO_FIRMADO_VIEJO = "panel-villareal-v1";

export async function claveConfigurada(): Promise<boolean> {
  return hayClaveConfigurada();
}

function igualesEnTiempoConstante(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// El secreto del servidor no cambia: se recuerda mientras viva el proceso (una consulta menos en cada página).
let delServidorEnMemoria: string | null = null;

/** El secreto al azar del servidor: se crea la primera vez y no sale nunca de la base (ni en las copias). */
async function secretoDelServidor(): Promise<string> {
  if (delServidorEnMemoria) return delServidorEnMemoria;
  const guardado = await fila<{ valor: string }>("select valor from secretos where clave = 'sesion'");
  if (!guardado) await ejecutar("insert or ignore into secretos (clave, valor) values ('sesion', ?)", [randomBytes(32).toString("hex")]);
  delServidorEnMemoria = guardado?.valor ?? (await fila<{ valor: string }>("select valor from secretos where clave = 'sesion'"))!.valor;
  return delServidorEnMemoria;
}

/**
 * El secreto con que se firma: la clave (o su resumen) mezclada con el del servidor. La clave se lee siempre de nuevo:
 * si cambia («He olvidado la clave»), las sesiones de antes caducan en el momento.
 */
async function secretoDeFirma(): Promise<string> {
  const [deLaClave, delServidor] = await Promise.all([secretoDeSesion(), secretoDelServidor()]);
  return createHmac("sha256", delServidor).update(deLaClave).digest("hex");
}

function firmar(secreto: string, emitida: number, version: number): string {
  return createHmac("sha256", secreto).update(`v2|${emitida}|${version}`).digest("hex");
}

async function cookieNueva(): Promise<string> {
  const [secreto, version] = await Promise.all([secretoDeFirma(), versionDeSesion()]);
  const emitida = Date.now();
  return `v2.${emitida.toString(36)}.${version}.${firmar(secreto, emitida, version)}`;
}

async function ponerCookie(valor: string): Promise<void> {
  const almacen = await cookies();
  almacen.set(COOKIE_SESION, valor, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * DIAS_DE_SESION,
  });
}

export async function claveEsCorrecta(intento: string): Promise<boolean> {
  return compararClave(intento);
}

export async function iniciarSesion(): Promise<void> {
  await ponerCookie(await cookieNueva());
}

export async function cerrarSesion(): Promise<void> {
  const almacen = await cookies();
  almacen.delete(COOKIE_SESION);
}

/** «Cerrar la sesión en todos los teléfonos»: las cookies de antes dejan de valer; este teléfono sigue dentro. */
export async function cerrarTodasLasSesiones(): Promise<void> {
  await subirVersionDeSesion();

  await iniciarSesion();
}

type EstadoDeLaCookie = "valida" | "vieja" | "no";

async function revisarCookie(valor: string | undefined): Promise<EstadoDeLaCookie> {
  if (!valor || !(await hayClaveConfigurada())) return "no";
  const partes = valor.split(".");
  if (partes.length === 4 && partes[0] === "v2") {
    const emitida = parseInt(partes[1], 36);
    const version = Number(partes[2]);
    if (!Number.isFinite(emitida) || !Number.isInteger(version)) return "no";
    const ahora = Date.now();
    if (emitida > ahora + 5 * 60_000 || ahora - emitida > DIAS_DE_SESION * 86400_000) return "no";
    const [secreto, vigente] = await Promise.all([secretoDeFirma(), versionDeSesion()]);
    if (version !== vigente) return "no";
    return igualesEnTiempoConstante(partes[3], firmar(secreto, emitida, version)) ? "valida" : "no";
  }
  // El formato de antes: la firma de un texto fijo con el secreto de la clave, mientras dure la transición.
  if (Date.now() < VIEJAS_VALEN_HASTA && /^[0-9a-f]{64}$/.test(valor)) {
    const vieja = createHmac("sha256", await secretoDeSesion()).update(TEXTO_FIRMADO_VIEJO).digest("hex");
    return igualesEnTiempoConstante(valor, vieja) ? "vieja" : "no";
  }
  return "no";
}

/** Si la petición trae una sesión válida. Se recuerda durante la petición: el layout y la página lo preguntan los dos. */
export const haySesion = cache(async (): Promise<boolean> => {
  const almacen = await cookies();
  return (await revisarCookie(almacen.get(COOKIE_SESION)?.value)) !== "no";
});

/** Para las acciones del servidor: lanza si no hay sesión válida. Una cookie del formato de antes se cambia por una nueva. */
export async function exigirSesion(): Promise<void> {
  const almacen = await cookies();
  const estado = await revisarCookie(almacen.get(COOKIE_SESION)?.value);
  if (estado === "no") throw new Error("No has iniciado sesión.");
  if (estado === "vieja") await ponerCookie(await cookieNueva());
}
