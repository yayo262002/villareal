import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { ejecutar, fila } from "./db";

/**
 * La clave del panel. Nace en `.env.local` (`ADMIN_CLAVE`), pero el dueño
 * puede cambiarla desde «He olvidado la clave»: la nueva se guarda en la
 * base, en `ajustes`, como un resumen con sal (scrypt), nunca en claro. Si
 * hay una guardada, manda ella; si no, vale la de `.env.local`. Para
 * volver a la de `.env.local` basta borrar el ajuste `clave_panel`.
 *
 * La recuperación va con un enlace de un solo uso que vale media hora: se
 * guarda solo su resumen, así ni la base ni una copia sirven para entrar.
 */

export const LARGO_MINIMO_CLAVE = 8;
const AJUSTE_CLAVE = "clave_panel";
const AJUSTE_RECUPERACION = "recuperacion";
const MINUTOS_DEL_ENLACE = 30;
const MINUTOS_ENTRE_PEDIDOS = 2;
/** Lo guardado se recuerda unos segundos: cada pantalla y cada acción comprueban la sesión. */
const CACHE_MS = 10_000;

type ClaveGuardada = { sal: string; hash: string; cambiada_en: string };
type Recuperacion = { hash: string; expira: string; pedida_en: string };

let cache: { valor: ClaveGuardada | null; hasta: number } | null = null;

async function leerAjuste(clave: string): Promise<string | null> {
  const f = await fila<{ valor: string }>("select valor from ajustes where clave = ?", [clave]);
  return f?.valor ?? null;
}

async function guardarAjuste(clave: string, valor: string): Promise<void> {
  await ejecutar(
    `insert into ajustes (clave, valor, actualizado_en) values (?, ?, datetime('now'))
     on conflict(clave) do update set valor = excluded.valor, actualizado_en = excluded.actualizado_en`,
    [clave, valor],
  );
}

function igualesEnTiempoConstante(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function resumenDe(clave: string, sal: string): string {
  return scryptSync(clave, sal, 32).toString("hex");
}

function claveDelEntorno(): string {
  return process.env.ADMIN_CLAVE ?? "";
}

/** La clave guardada en la base, si el dueño la cambió alguna vez. */
export async function claveGuardada(): Promise<ClaveGuardada | null> {
  if (cache && cache.hasta > Date.now()) return cache.valor;
  let valor: ClaveGuardada | null = null;
  try {
    const texto = await leerAjuste(AJUSTE_CLAVE);
    if (texto) {
      const leida = JSON.parse(texto) as Partial<ClaveGuardada>;
      if (leida.sal && leida.hash) valor = { sal: leida.sal, hash: leida.hash, cambiada_en: leida.cambiada_en ?? "" };
    }
  } catch {
    valor = null;
  }
  cache = { valor, hasta: Date.now() + CACHE_MS };
  return valor;
}

/** Hay una clave con la que entrar: la de `.env.local` o una guardada. */
export async function hayClaveConfigurada(): Promise<boolean> {
  return claveDelEntorno().length >= LARGO_MINIMO_CLAVE || (await claveGuardada()) !== null;
}

/** El secreto con el que se firma la cookie: cambia con la clave, y así las sesiones de antes caducan. */
export async function secretoDeSesion(): Promise<string> {
  const guardada = await claveGuardada();
  return guardada ? guardada.hash : claveDelEntorno();
}

export async function claveEsCorrecta(intento: string): Promise<boolean> {
  const guardada = await claveGuardada();
  if (guardada) return igualesEnTiempoConstante(resumenDe(intento, guardada.sal), guardada.hash);
  const entorno = claveDelEntorno();
  return entorno.length >= LARGO_MINIMO_CLAVE && igualesEnTiempoConstante(intento, entorno);
}

/** Lo que no sirve como clave nueva, o null si vale. */
export function revisarClaveNueva(clave: string, otraVez: string): string | null {
  if (clave.length < LARGO_MINIMO_CLAVE) return `La clave tiene que tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`;
  if (clave !== otraVez) return "Las dos claves no coinciden: escríbela igual las dos veces.";
  return null;
}

export async function guardarClaveNueva(clave: string): Promise<void> {
  const sal = randomBytes(16).toString("hex");
  const guardada: ClaveGuardada = { sal, hash: resumenDe(clave, sal), cambiada_en: new Date().toISOString() };
  await guardarAjuste(AJUSTE_CLAVE, JSON.stringify(guardada));
  cache = { valor: guardada, hasta: Date.now() + CACHE_MS };
}

function resumenDelEnlace(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function recuperacionVigente(): Promise<Recuperacion | null> {
  try {
    const texto = await leerAjuste(AJUSTE_RECUPERACION);
    if (!texto) return null;
    const r = JSON.parse(texto) as Partial<Recuperacion>;
    return r.hash && r.expira && r.pedida_en ? { hash: r.hash, expira: r.expira, pedida_en: r.pedida_en } : null;
  } catch {
    return null;
  }
}

/**
 * Un enlace nuevo para poner otra clave: devuelve el secreto que va en el
 * enlace (solo se guarda su resumen) y hasta cuándo vale. Si se pidió otro
 * hace un momento, dice cuántos minutos faltan para poder pedir el siguiente.
 */
export async function crearEnlaceDeRecuperacion(): Promise<{ token: string; expira: Date } | { espera: number }> {
  const anterior = await recuperacionVigente();
  if (anterior) {
    const pasados = (Date.now() - Date.parse(anterior.pedida_en)) / 60_000;
    if (pasados >= 0 && pasados < MINUTOS_ENTRE_PEDIDOS) return { espera: Math.max(1, Math.ceil(MINUTOS_ENTRE_PEDIDOS - pasados)) };
  }
  const token = randomBytes(32).toString("hex");
  const expira = new Date(Date.now() + MINUTOS_DEL_ENLACE * 60_000);
  const r: Recuperacion = { hash: resumenDelEnlace(token), expira: expira.toISOString(), pedida_en: new Date().toISOString() };
  await guardarAjuste(AJUSTE_RECUPERACION, JSON.stringify(r));
  return { token, expira };
}

/** Si el secreto de un enlace es el vigente y no ha caducado. */
export async function enlaceDeRecuperacionVale(token: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  const r = await recuperacionVigente();
  if (!r) return false;
  if (Date.parse(r.expira) < Date.now()) return false;
  return igualesEnTiempoConstante(resumenDelEnlace(token), r.hash);
}

/** El enlace se gasta al usarse. */
export async function gastarEnlaceDeRecuperacion(): Promise<void> {
  await ejecutar("delete from ajustes where clave = ?", [AJUSTE_RECUPERACION]);
}

export const MINUTOS_QUE_VALE_EL_ENLACE = MINUTOS_DEL_ENLACE;
