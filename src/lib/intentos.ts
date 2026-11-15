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
 * muchas direcciones distintas. Ese tope frena (cada intento tarda unos
 * segundos más), pero no bloquea: antes bloqueaba a todos, y cualquiera
 * podía dejar al dueño sin entrar mandando 40 claves malas cada cuarto de
 * hora (revisión de seguridad del 14/11/2026). La dirección que falla
 * cinco veces sí espera.
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
  if (Number(f?.suyos ?? 0) >= FALLOS_POR_DIRECCION) return true;
  // Muchos fallos de muchas direcciones a la vez: se frena a todos unos segundos, sin dejar fuera al dueño.
  if (Number(f?.todos ?? 0) >= FALLOS_EN_TOTAL) await new Promise((r) => setTimeout(r, SEGUNDOS_DE_FRENO * 1000));
  return false;
}

/** Lo que tarda de más cada intento cuando hay muchos fallos de muchas direcciones a la vez. */
export const SEGUNDOS_DE_FRENO = 3;

export async function anotarEntradaFallida(direccion: string): Promise<void> {
  await ejecutar("insert into entradas_fallidas (direccion) values (?)", [direccion]);
  // Lo de hace más de un día ya no sirve para nada.
  await ejecutar("delete from entradas_fallidas where momento < datetime('now', '-1 day')");
}

export async function olvidarEntradasFallidas(direccion: string): Promise<void> {
  await ejecutar("delete from entradas_fallidas where direccion = ?", [direccion]);
}

/**
 * Un freno para lo público que cuesta (la consulta del delivery con una dirección escrita pregunta al mapa libre, y si
 * le preguntamos demasiado nos bloquea, también al panel): cuántas veces se ha pedido en los últimos minutos, desde esa
 * dirección y en total. Si se puede, lo anota y devuelve true (revisión de seguridad del 14/11/2026).
 */
export async function peticionPermitida(tipo: string, direccion: string, limites: { porDireccion: number; enTotal: number; minutos: number }): Promise<boolean> {
  const f = await fila<{ suyos: number; todos: number }>(
    `select coalesce(sum(case when direccion = ? then 1 else 0 end), 0) as suyos, count(*) as todos
       from peticiones_publicas where tipo = ? and momento > datetime('now', ?)`,
    [direccion, tipo, `-${limites.minutos} minutes`],
  );
  if (Number(f?.suyos ?? 0) >= limites.porDireccion || Number(f?.todos ?? 0) >= limites.enTotal) return false;
  await ejecutar("insert into peticiones_publicas (tipo, direccion) values (?, ?)", [tipo, direccion]);
  await ejecutar("delete from peticiones_publicas where momento < datetime('now', '-1 day')");
  return true;
}
