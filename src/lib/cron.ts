import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Si la llamada viene del cron de Vercel: llega con la cabecera
 * `Authorization: Bearer CRON_SECRET`. La comparación es en tiempo
 * constante, para no ir dando pistas de la clave.
 */
export function vieneDelCron(request: Request): boolean {
  const secreto = process.env.CRON_SECRET ?? "";
  const cabecera = request.headers.get("authorization") ?? "";
  if (!secreto || !cabecera.startsWith("Bearer ")) return false;
  const a = Buffer.from(cabecera.slice(7));
  const b = Buffer.from(secreto);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Si la petición viene de un enlace en otra web (el navegador lo dice en `Sec-Fetch-Site`). Las direcciones que hacen
 * algo al abrirlas (la copia, la tarea del día, el recordatorio) no lo hacen así: con la sesión del dueño abierta, un
 * enlace en otra web las dispararía (revisión de seguridad del 14/11/2026).
 */
export function vieneDeOtraWeb(request: Request): boolean {
  return request.headers.get("sec-fetch-site") === "cross-site";
}
