import "server-only";
import { negocio } from "@/config/negocio";

/**
 * Mandar un correo al dueño (hoy, solo el enlace para poner una clave
 * nueva). La web no tiene servidor de correo: lo manda Resend
 * (https://resend.com, con plan gratuito) con la clave `RESEND_API_KEY`.
 * Sin dominio propio, Resend solo entrega al correo con el que se abrió la
 * cuenta, y ese es el del dueño: el destino es `CORREO_DEL_DUENO` o, si no
 * está, el correo del negocio (`src/config/negocio.ts`). Sin clave de
 * Resend no se manda nada y el panel lo dice.
 */

export function correoDelDueno(): string {
  return (process.env.CORREO_DEL_DUENO ?? negocio.correo ?? "").trim();
}

export function correoConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY) && correoDelDueno().includes("@");
}

/** «comercializadoravillareal@gmail.com» → «co…al@gmail.com», para decir adónde fue sin enseñar el correo entero. */
export function correoDisimulado(correo: string): string {
  const [usuario, dominio] = correo.split("@");
  if (!usuario || !dominio) return "tu correo";
  const visible = usuario.length <= 4 ? usuario.slice(0, 1) : `${usuario.slice(0, 2)}…${usuario.slice(-2)}`;
  return `${visible}@${dominio}`;
}

export async function enviarCorreo(mensaje: { asunto: string; texto: string }): Promise<void> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) throw new Error("No hay clave de Resend (RESEND_API_KEY).");
  const remitente = process.env.CORREO_REMITENTE || `${negocio.nombre} <onboarding@resend.dev>`;
  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${clave}`, "content-type": "application/json" },
    body: JSON.stringify({ from: remitente, to: [correoDelDueno()], subject: mensaje.asunto, text: mensaje.texto }),
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => "");
    throw new Error(`Resend contestó ${respuesta.status}: ${detalle.slice(0, 200)}`);
  }
}
