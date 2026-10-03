import { randomBytes } from "node:crypto";
import { negocio } from "../config/negocio.ts";

/**
 * El enlace personal con el que un cliente ve su cuenta sin clave:
 * `/cuenta/abcdefghjkmnpq`. Catorce letras y números al azar, sin 0, o,
 * 1, l ni i, para que se pueda dictar por teléfono sin confundir nada. No
 * se adivina (más de 10^20 combinaciones) y se puede renovar.
 */

const ALFABETO = "abcdefghjkmnpqrstuvwxyz23456789";
export const LARGO_DEL_ENLACE = 14;

export function nuevoEnlace(): string {
  let enlace = "";
  for (const byte of randomBytes(LARGO_DEL_ENLACE)) enlace += ALFABETO[byte % ALFABETO.length];
  return enlace;
}

/** Solo lo que puede ser un enlace: así una dirección rara ni llega a la base. */
export function esEnlaceValido(texto: string): boolean {
  return new RegExp(`^[${ALFABETO}]{${LARGO_DEL_ENLACE}}$`).test(texto);
}

/** La dirección completa, para mandarla por WhatsApp. */
export function direccionDeCuenta(enlace: string): string {
  return `${negocio.web}/cuenta/${enlace}`;
}
