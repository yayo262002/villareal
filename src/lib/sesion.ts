import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * El panel lo usa una sola persona (o dos), así que una clave en `.env.local`
 * basta: no hay usuarios, ni recuperación de contraseña, ni tabla de sesiones.
 *
 * La cookie no lleva la clave: lleva una firma HMAC de un texto fijo con la
 * clave como secreto. Quien lea la cookie no puede sacar la clave de ahí, y
 * si la clave cambia todas las sesiones caducan solas.
 */

export const COOKIE_SESION = "villareal_sesion";
const TEXTO_FIRMADO = "panel-villareal-v1";
const LARGO_MINIMO_CLAVE = 8;

export function claveConfigurada(): boolean {
  const clave = process.env.ADMIN_CLAVE ?? "";
  return clave.length >= LARGO_MINIMO_CLAVE;
}

function firma(clave: string): string {
  return createHmac("sha256", clave).update(TEXTO_FIRMADO).digest("hex");
}

function igualesEnTiempoConstante(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function claveEsCorrecta(intento: string): boolean {
  if (!claveConfigurada()) return false;
  return igualesEnTiempoConstante(intento, process.env.ADMIN_CLAVE!);
}

export async function iniciarSesion(): Promise<void> {
  const almacen = await cookies();
  almacen.set(COOKIE_SESION, firma(process.env.ADMIN_CLAVE!), {
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
  if (!claveConfigurada()) return false;
  const almacen = await cookies();
  const valor = almacen.get(COOKIE_SESION)?.value;
  if (!valor) return false;
  return igualesEnTiempoConstante(valor, firma(process.env.ADMIN_CLAVE!));
}

/** Para las acciones del servidor: lanza si no hay sesión válida. */
export async function exigirSesion(): Promise<void> {
  if (!(await haySesion())) throw new Error("No has iniciado sesión.");
}
