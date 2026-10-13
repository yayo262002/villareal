import "server-only";
import webpush from "web-push";
import { negocio } from "@/config/negocio";
import { ejecutar, filas } from "./db";
import type { Aviso } from "./aviso-manana";

/**
 * Los avisos al teléfono (Web Push): cada teléfono que activó los avisos
 * queda guardado con su suscripción, y desde aquí se le manda el aviso de
 * cada mañana o uno de prueba. Las claves VAPID (con las que el servidor
 * firma lo que manda) vienen de `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`
 * si están; si no, se crean una sola vez y quedan guardadas en `ajustes`.
 * No hace falta ninguna cuenta ni servicio aparte.
 */

export type Telefono = {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  aparato: string;
  creado_en: string;
  ultimo_envio: string | null;
  fallos: number;
};

/** Tras tantos envíos seguidos sin respuesta, el teléfono se da por perdido y se quita. */
const FALLOS_PARA_QUITAR = 5;

const CLAVE_PUBLICA = "avisos_clave_publica";
const CLAVE_PRIVADA = "avisos_clave_privada";

async function clavesGuardadas(): Promise<{ publica: string; privada: string } | null> {
  const lista = await filas<{ clave: string; valor: string }>("select clave, valor from ajustes where clave in (?, ?)", [CLAVE_PUBLICA, CLAVE_PRIVADA]);
  const publica = lista.find((a) => a.clave === CLAVE_PUBLICA)?.valor;
  const privada = lista.find((a) => a.clave === CLAVE_PRIVADA)?.valor;
  return publica && privada ? { publica, privada } : null;
}

export async function clavesVapid(): Promise<{ publica: string; privada: string }> {
  const publica = process.env.VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (publica && privada) return { publica, privada };
  const guardadas = await clavesGuardadas();
  if (guardadas) return guardadas;
  // Se crean una vez. Si dos peticiones llegan a la vez, la primera que escriba gana y la otra lee lo guardado.
  const nuevas = webpush.generateVAPIDKeys();
  await ejecutar("insert or ignore into ajustes (clave, valor, actualizado_en) values (?, ?, datetime('now'))", [CLAVE_PUBLICA, nuevas.publicKey]);
  await ejecutar("insert or ignore into ajustes (clave, valor, actualizado_en) values (?, ?, datetime('now'))", [CLAVE_PRIVADA, nuevas.privateKey]);
  return (await clavesGuardadas()) ?? { publica: nuevas.publicKey, privada: nuevas.privateKey };
}

export type SuscripcionDelNavegador = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Si lo que mandó el navegador tiene la forma de una suscripción. */
export function esSuscripcion(valor: unknown): valor is SuscripcionDelNavegador {
  if (!valor || typeof valor !== "object") return false;
  const s = valor as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  return typeof s.endpoint === "string" && s.endpoint.startsWith("https://") && typeof s.keys?.p256dh === "string" && typeof s.keys?.auth === "string";
}

export async function guardarTelefono(s: SuscripcionDelNavegador, aparato: string): Promise<void> {
  await ejecutar(
    `insert into avisos_telefonos (endpoint, p256dh, auth, aparato) values (?, ?, ?, ?)
     on conflict(endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, aparato = excluded.aparato, fallos = 0`,
    [s.endpoint, s.keys.p256dh, s.keys.auth, aparato.slice(0, 120)],
  );
}

export async function quitarTelefono(endpoint: string): Promise<boolean> {
  const r = await ejecutar("delete from avisos_telefonos where endpoint = ?", [endpoint]);
  return r.cambios > 0;
}

export async function listarTelefonos(): Promise<Telefono[]> {
  return filas<Telefono>("select * from avisos_telefonos order by id");
}

export async function contarTelefonos(): Promise<number> {
  const [f] = await filas<{ n: number }>("select count(*) as n from avisos_telefonos");
  return Number(f?.n ?? 0);
}

export type ResultadoDelEnvio = { telefonos: number; enviados: number; fallidos: number };

/** Manda un aviso a todos los teléfonos. Un teléfono que ya no existe (404 o 410) se quita; uno que falla varias veces seguidas, también. */
export async function empujarAviso(aviso: Aviso): Promise<ResultadoDelEnvio> {
  const telefonos = await listarTelefonos();
  const resultado: ResultadoDelEnvio = { telefonos: telefonos.length, enviados: 0, fallidos: 0 };
  if (telefonos.length === 0) return resultado;
  const claves = await clavesVapid();
  const carga = JSON.stringify(aviso);
  for (const t of telefonos) {
    try {
      await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, carga, {
        TTL: 12 * 3600,
        vapidDetails: { subject: `mailto:${negocio.correo}`, publicKey: claves.publica, privateKey: claves.privada },
      });
      resultado.enviados++;
      await ejecutar("update avisos_telefonos set ultimo_envio = datetime('now'), fallos = 0 where id = ?", [t.id]);
    } catch (error) {
      resultado.fallidos++;
      const estado = (error as { statusCode?: number }).statusCode;
      if (estado === 404 || estado === 410 || t.fallos + 1 >= FALLOS_PARA_QUITAR) await ejecutar("delete from avisos_telefonos where id = ?", [t.id]);
      else await ejecutar("update avisos_telefonos set fallos = fallos + 1 where id = ?", [t.id]);
    }
  }
  return resultado;
}
