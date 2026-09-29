import "server-only";
import { guardarTasa, leerTasa, ponerAvisoTasa, tasaAutomatica } from "./ajustes";
import { revisarTasa } from "./tasa";

/**
 * Trae la tasa oficial del BCV y la pone como tasa del día. La llama la
 * tarea diaria de Vercel cada mañana y el botón «Traer la del BCV ahora»
 * del panel.
 *
 * El BCV no ofrece la tasa en un formato para programas; se lee de
 * DolarApi, un servicio público que la copia de la página del banco. Por
 * eso nada de lo que llega se da por bueno sin revisar (ver `tasa.ts`), y
 * si algo falla la tasa que había se queda como estaba.
 */

const FUENTE = "https://ve.dolarapi.com/v1/dolares/oficial";
const ESPERA_MAXIMA_MS = 10_000;

export type ResultadoTasa =
  | { estado: "actualizada"; valor: number; anterior: number | null }
  | { estado: "apagada" }
  | { estado: "sin_respuesta"; motivo: string }
  | { estado: "rechazada"; motivo: string };

function diasDesde(momentoUtc: string): number {
  const instante = new Date(momentoUtc.replace(" ", "T") + "Z").getTime();
  return Number.isNaN(instante) ? 1 : (Date.now() - instante) / (24 * 60 * 60 * 1000);
}

/**
 * @param forzar Traerla aunque la actualización automática esté apagada:
 *   es lo que hace el botón del panel.
 */
export async function actualizarTasaOficial({ forzar = false } = {}): Promise<ResultadoTasa> {
  if (!forzar && !(await tasaAutomatica())) return { estado: "apagada" };

  let recibida: unknown;
  try {
    const respuesta = await fetch(FUENTE, { cache: "no-store", signal: AbortSignal.timeout(ESPERA_MAXIMA_MS) });
    if (!respuesta.ok) throw new Error(`la fuente respondió ${respuesta.status}`);
    recibida = ((await respuesta.json()) as { promedio?: unknown }).promedio;
  } catch (error) {
    const motivo = error instanceof Error ? error.message : "no se pudo consultar la fuente";
    await ponerAvisoTasa(`No se pudo traer la tasa del BCV: ${motivo}. Sigue la que había.`);
    return { estado: "sin_respuesta", motivo };
  }

  const vigente = await leerTasa();
  const revision = revisarTasa(vigente?.valor ?? null, recibida, vigente ? diasDesde(vigente.actualizada_en) : 1);
  if (!revision.aceptada) {
    await ponerAvisoTasa(`No se cambió la tasa: ${revision.motivo}. Revísala y escríbela a mano si es correcta.`);
    return { estado: "rechazada", motivo: revision.motivo };
  }

  // Se guarda aunque no haya cambiado: así consta que hoy se comprobó.
  await guardarTasa(revision.valor, "bcv");
  await ponerAvisoTasa(null);
  return { estado: "actualizada", valor: revision.valor, anterior: vigente?.valor ?? null };
}
