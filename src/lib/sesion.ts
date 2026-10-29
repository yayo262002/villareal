import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { claveEsCorrecta as compararClave, hayClaveConfigurada, secretoDeSesion } from "./clave";

/**
 * El panel lo usa una sola persona (o dos), así que una clave basta: no
 * hay usuarios ni tabla de sesiones. La clave nace en `.env.local` y se
 * puede cambiar desde «He olvidado la clave» (`clave.ts`).
 *
 * La cookie no lleva la clave: lleva una firma HMAC de un texto fijo con
 * un secreto que sale de la clave. Quien lea la cookie no puede sacar la
 * clave de ahí, y si la clave cambia todas las sesiones caducan solas.
 */

export const COOKIE_SESION = "villareal_sesion";
const TEXTO_FIRMADO = "panel-villareal-v1";

export async function claveConfigurada(): Promise<boolean> {
  return hayClaveConfigurada();
}

function firma(secreto: string): string {
  return createHmac("sha256", secreto).update(TEXTO_FIRMADO).digest("hex");
}

function igualesEnTiempoConstante(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function claveEsCorrecta(intento: string): Promise<boolean> {
  return compararClave(intento);
}

export async function iniciarSesion(): Promise<void> {
  const almacen = await cookies();
  almacen.set(COOKIE_SESION, firma(await secretoDeSesion()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function cerrarSesion(): Promise<void> {
  const almacen = await cookies();
  almacen.delete(COOKIE_SESION);
}

export async function haySesion(): Promise<boolean> {
  if (!(await hayClaveConfigurada())) return false;
  const almacen = await cookies();
  const valor = almacen.get(COOKIE_SESION)?.value;
  if (!valor) return false;
  return igualesEnTiempoConstante(valor, firma(await secretoDeSesion()));
}

/** Para las acciones del servidor: lanza si no hay sesión válida. */
export async function exigirSesion(): Promise<void> {
  if (!(await haySesion())) throw new Error("No has iniciado sesión.");
}
