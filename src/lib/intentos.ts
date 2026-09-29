import "server-only";
import { headers } from "next/headers";
import { ejecutar, fila } from "./db";

/**
 * Freno a quien pruebe claves en la entrada del panel. El panel está en
 * internet y solo lo protege una clave: sin freno, un programa puede probar
 * miles. Cada fallo se anota con la dirección de quien lo hizo; con
 * demasiados en poco tiempo, esa dirección espera.
 *
 * También hay un tope para todos a la vez, por si los intentos vienen de
 * muchas direcciones distintas.
 */

export const VENTANA_MINUTOS = 15;
export const FALLOS_POR_DIRECCION = 5;
export const FALLOS_EN_TOTAL = 40;

/** La dirección de quien hace la petición. Vercel la pone en `x-forwarded-for`. */
export async function direccionDeLaPeticion(): Promise<string> {
  const cabeceras = await headers();
  const reenviada = cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (reenviada || cabeceras.get("x-real-ip") || "desconocida").slice(0, 64);
}

export async function entradaBloqueada(direccion: string): Promise<boolean> {
  const f = await fila<{ suyos: number; todos: number }>(
    `select
       coalesce(sum(case when direccion = ? then 1 else 0 end), 0) as suyos,
       count(*) as todos
     from entradas_fallidas
     where momento > datetime('now', ?)`,
    [direccion, `-${VENTANA_MINUTOS} minutes`],
  );
  return Number(f?.suyos ?? 0) >= FALLOS_POR_DIRECCION || Number(f?.todos ?? 0) >= FALLOS_EN_TOTAL;
}

export async function anotarEntradaFallida(direccion: string): Promise<void> {
  await ejecutar("insert into entradas_fallidas (direccion) values (?)", [direccion]);
  // Lo de hace más de un día ya no sirve para nada.
  await ejecutar("delete from entradas_fallidas where momento < datetime('now', '-1 day')");
}

export async function olvidarEntradasFallidas(direccion: string): Promise<void> {
  await ejecutar("delete from entradas_fallidas where direccion = ?", [direccion]);
}
