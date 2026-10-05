import "server-only";
import https from "node:https";
import tls from "node:tls";
import { guardarTasa, leerTasa, ponerAvisoTasa, tasaAutomatica } from "./ajustes";
import { esFinDeSemana, esLaDelLunes, leerTasaDelBcv, revisarTasa, sabadoDe, type TasaPublicada } from "./tasa";
import { INTERMEDIO_DEL_BCV } from "./certificado-bcv";
import { fechaCorta, fechaDeLaBase, hoy } from "./dinero";

/**
 * Trae la tasa oficial del BCV y la pone como tasa del día. La llama la
 * tarea diaria de Vercel cada mañana y el botón «Traer la del BCV ahora»
 * del panel.
 *
 * Entre semana se lee de DolarApi, un servicio público que la copia de la
 * página del banco. Los sábados y domingos vale la del lunes, como en los
 * comercios; DolarApi sigue dando la del viernes hasta el lunes, pero el BCV
 * publica la del lunes el viernes por la tarde, así que el fin de semana se
 * lee de su página. Nada de lo que llega se da por bueno sin revisar (ver
 * `tasa.ts`), y si algo falla la tasa que había se queda como estaba.
 */

const FUENTE = "https://ve.dolarapi.com/v1/dolares/oficial";
const PAGINA_DEL_BCV = "https://www.bcv.org.ve/";
const ESPERA_MAXIMA_MS = 10_000;

export type ResultadoTasa =
  | { estado: "actualizada"; valor: number; anterior: number | null; /** La fecha valor, si es la del lunes puesta en fin de semana. */ delLunes: string | null }
  | { estado: "se_queda"; valor: number; motivo: string }
  | { estado: "apagada" }
  | { estado: "sin_respuesta"; motivo: string }
  | { estado: "rechazada"; motivo: string };

function diasDesde(momentoUtc: string): number {
  const instante = new Date(momentoUtc.replace(" ", "T") + "Z").getTime();
  return Number.isNaN(instante) ? 1 : (Date.now() - instante) / (24 * 60 * 60 * 1000);
}

function motivoDe(error: unknown, porDefecto: string): string {
  return error instanceof Error ? error.message : porDefecto;
}

/**
 * La página del BCV, comprobando su certificado. El servidor del BCV no manda
 * el intermedio que firmó el suyo; se le da aquí (`certificado-bcv.ts`), sin
 * apagar la comprobación.
 */
function leerPaginaDelBcv(): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const peticion = https.get(
      PAGINA_DEL_BCV,
      {
        ca: [...tls.rootCertificates, INTERMEDIO_DEL_BCV],
        timeout: ESPERA_MAXIMA_MS,
        headers: { "user-agent": "Mozilla/5.0 (compatible; VillaReal/1.0)" },
      },
      (respuesta) => {
        if (respuesta.statusCode !== 200) {
          respuesta.resume();
          rechazar(new Error(`la página del BCV respondió ${respuesta.statusCode}`));
          return;
        }
        respuesta.setEncoding("utf8");
        let cuerpo = "";
        respuesta.on("data", (trozo: string) => {
          cuerpo += trozo;
          if (cuerpo.length > 3_000_000) peticion.destroy(new Error("la página del BCV es demasiado grande"));
        });
        respuesta.on("end", () => resolver(cuerpo));
        respuesta.on("error", rechazar);
      },
    );
    peticion.on("timeout", () => peticion.destroy(new Error("la página del BCV no respondió a tiempo")));
    peticion.on("error", rechazar);
  });
}

/** La tasa de DolarApi y su fecha valor (la trae como «2026-10-02T00:00:00-04:00»). */
async function leerDolarApi(fecha: string): Promise<{ valor: unknown; fechaValor: string }> {
  const respuesta = await fetch(FUENTE, { cache: "no-store", signal: AbortSignal.timeout(ESPERA_MAXIMA_MS) });
  if (!respuesta.ok) throw new Error(`la fuente respondió ${respuesta.status}`);
  const datos = (await respuesta.json()) as { promedio?: unknown; fechaActualizacion?: unknown };
  const dia = typeof datos.fechaActualizacion === "string" ? datos.fechaActualizacion.slice(0, 10) : "";
  // Una fecha rara o lejana no se cree: entonces vale desde hoy.
  const creible = /^\d{4}-\d{2}-\d{2}$/.test(dia) && Math.abs(Date.parse(dia) - Date.parse(fecha)) <= 31 * 24 * 60 * 60 * 1000;
  return { valor: datos.promedio, fechaValor: creible ? dia : fecha };
}

/**
 * @param forzar Traerla aunque la actualización automática esté apagada:
 *   es lo que hace el botón del panel.
 */
export async function actualizarTasaOficial({ forzar = false } = {}): Promise<ResultadoTasa> {
  if (!forzar && !(await tasaAutomatica())) return { estado: "apagada" };

  const fecha = hoy();
  const vigente = await leerTasa();
  const finDeSemana = esFinDeSemana(fecha);

  // Sábado y domingo: la del lunes, de la página del BCV.
  let delLunes: TasaPublicada | null = null;
  let sinLunes = "";
  if (finDeSemana) {
    try {
      const publicada = leerTasaDelBcv(await leerPaginaDelBcv());
      if (!publicada) sinLunes = "la página del BCV no trae la tasa donde siempre";
      else if (!esLaDelLunes(publicada.fechaValor, fecha)) sinLunes = "el BCV todavía no publicó la del lunes";
      else delLunes = publicada;
    } catch (error) {
      sinLunes = motivoDe(error, "no se pudo leer la página del BCV");
    }
    // Sin la del lunes, no se pisa una tasa puesta este mismo fin de semana: la del lunes de ayer, o la que escribió el dueño.
    if (!delLunes && vigente && fechaDeLaBase(vigente.actualizada_en) >= sabadoDe(fecha)) {
      await ponerAvisoTasa(`No se pudo traer la tasa del lunes del BCV (${sinLunes}). Sigue la que había.`);
      return { estado: "se_queda", valor: vigente.valor, motivo: sinLunes };
    }
  }

  // Entre semana, o si el fin de semana no se pudo leer la del lunes: la de DolarApi, la que vale hoy.
  let candidata: { valor: unknown; fechaValor: string };
  if (delLunes) {
    candidata = delLunes;
  } else {
    try {
      candidata = await leerDolarApi(fecha);
    } catch (error) {
      const motivo = motivoDe(error, "no se pudo consultar la fuente");
      await ponerAvisoTasa(`No se pudo traer la tasa del BCV: ${motivo}. Sigue la que había.`);
      return { estado: "sin_respuesta", motivo };
    }
    // Una tasa más vieja que la vigente no la reemplaza: el lunes temprano DolarApi puede dar aún la del viernes, cuando ya está la del lunes.
    if (vigente?.fecha_valor && candidata.fechaValor < vigente.fecha_valor) {
      return { estado: "se_queda", valor: vigente.valor, motivo: `la fuente aún da la del ${fechaCorta(candidata.fechaValor)} y la vigente es la del ${fechaCorta(vigente.fecha_valor)}` };
    }
  }

  const revision = revisarTasa(vigente?.valor ?? null, candidata.valor, vigente ? diasDesde(vigente.actualizada_en) : 1);
  if (!revision.aceptada) {
    await ponerAvisoTasa(`No se cambió la tasa: ${revision.motivo}. Revísala y escríbela a mano si es correcta.`);
    return { estado: "rechazada", motivo: revision.motivo };
  }

  // Se guarda aunque no haya cambiado: así consta que hoy se comprobó.
  await guardarTasa(revision.valor, "bcv", candidata.fechaValor);
  await ponerAvisoTasa(
    finDeSemana && !delLunes ? `Es fin de semana y no se pudo usar la tasa del lunes (${sinLunes}): sigue la última del BCV. Si la sabes, escríbela a mano.` : null,
  );
  return { estado: "actualizada", valor: revision.valor, anterior: vigente?.valor ?? null, delLunes: delLunes?.fechaValor ?? null };
}
