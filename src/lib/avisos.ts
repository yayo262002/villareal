import "server-only";
import { ejecutar, filas } from "./db";
import { listarVentasPorEntregar } from "./ventas";
import { clientesConVencimiento } from "./vencimientos";
import { existencias } from "./inventario";
import { leerTasa } from "./ajustes";
import { estudioDeClientes } from "./estudio-de-clientes";
import { diasEntre } from "./credito";
import { cantidad, fechaCorta, hoy, usd } from "./dinero";
import { numeroDeNota } from "./entregas";
import { textoDelAvisoDeLaManana, type Aviso, type DatosDeLaManana } from "./aviso-manana";
import { empujarAviso, type ResultadoDelEnvio } from "./push";

/**
 * La campanita del panel: los avisos de lo que el sistema sabe antes que
 * el dueño. Cada uno lleva una clave (qué cosa y de qué día o semana) y
 * así el mismo aviso no se repite. El de cada mañana va también al
 * teléfono (`push.ts`).
 */

export type AvisoGuardado = {
  id: number;
  clave: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  url: string;
  creado_en: string;
  leido_en: string | null;
};

type AvisoNuevo = Aviso & { clave: string; tipo: string };

/** Guarda un aviso si no existía ya uno con esa clave. Dice si era nuevo. */
export async function crearAviso(aviso: AvisoNuevo): Promise<boolean> {
  const r = await ejecutar("insert or ignore into avisos (clave, tipo, titulo, cuerpo, url) values (?, ?, ?, ?, ?)", [
    aviso.clave,
    aviso.tipo,
    aviso.titulo,
    aviso.cuerpo,
    aviso.url,
  ]);
  return r.cambios > 0;
}

/** Varios de una vez, en una sola sentencia. Devuelve cuántos eran nuevos. */
async function crearAvisos(avisos: AvisoNuevo[]): Promise<number> {
  if (avisos.length === 0) return 0;
  const huecos = avisos.map(() => "(?, ?, ?, ?, ?)").join(", ");
  const r = await ejecutar(
    `insert or ignore into avisos (clave, tipo, titulo, cuerpo, url) values ${huecos}`,
    avisos.flatMap((a) => [a.clave, a.tipo, a.titulo, a.cuerpo, a.url]),
  );
  return r.cambios;
}

export async function listarAvisos(limite = 80): Promise<AvisoGuardado[]> {
  // Los más nuevos primero; los de una misma tanda, en el orden en que se crearon (el de la mañana, primero).
  return filas<AvisoGuardado>("select * from avisos order by creado_en desc, id asc limit ?", [limite]);
}

export async function contarAvisosSinLeer(): Promise<number> {
  const [f] = await filas<{ n: number }>("select count(*) as n from avisos where leido_en is null");
  return Number(f?.n ?? 0);
}

export async function marcarAvisosLeidos(): Promise<void> {
  await ejecutar("update avisos set leido_en = datetime('now') where leido_en is null");
}

/** Los avisos de más de 90 días se van: la campanita no es un archivo. */
export async function podarAvisos(): Promise<void> {
  await ejecutar("delete from avisos where creado_en < datetime('now', '-90 days')");
}

/** La semana del año, para los avisos que se repiten como mucho una vez por semana. */
function semanaDe(fecha: string): string {
  const [a, m, d] = fecha.slice(0, 10).split("-").map(Number);
  const dia = Date.UTC(a, m - 1, d);
  const primero = Date.UTC(a, 0, 1);
  return `${a}-s${Math.floor((dia - primero) / 86400000 / 7)}`;
}

type Candidatos = { datos: DatosDeLaManana; avisos: AvisoNuevo[] };

/** Junta lo del día: lo que va en el aviso de la mañana y los avisos sueltos de la campanita. */
async function candidatosDelDia(fecha: string): Promise<Candidatos> {
  const [entregas, clientes, inventario, tasa, estudio] = await Promise.all([
    listarVentasPorEntregar(),
    clientesConVencimiento(fecha),
    existencias(),
    leerTasa(),
    estudioDeClientes(fecha, false),
  ]);
  const semana = semanaDe(fecha);
  const avisos: AvisoNuevo[] = [];

  const atrasadas = entregas.filter((e) => e.entrega_prevista && diasEntre(e.entrega_prevista, fecha) > 0);
  const paraHoy = entregas.filter((e) => e.entrega_prevista && diasEntre(e.entrega_prevista, fecha) === 0);
  for (const e of atrasadas) {
    avisos.push({
      clave: `entrega-atrasada:${e.id}:${fecha}`,
      tipo: "entrega",
      titulo: `Entrega atrasada: nota ${numeroDeNota(e.id)} de ${e.cliente_nombre}`,
      cuerpo: `Era para el ${fechaCorta(e.entrega_prevista!)}.`,
      url: "/admin/despacho",
    });
  }
  for (const e of paraHoy) {
    avisos.push({ clave: `entrega-hoy:${e.id}`, tipo: "entrega", titulo: `Hoy toca entregar la nota ${numeroDeNota(e.id)} a ${e.cliente_nombre}`, cuerpo: "", url: "/admin/despacho" });
  }

  const vencidos = clientes.filter((c) => c.saldo_usd > 0 && c.vencido_usd > 0);
  for (const c of vencidos) {
    avisos.push({
      clave: `vencido:${c.id}:${semana}`,
      tipo: "cobro",
      titulo: `${c.rotulo} pasó su plazo`,
      cuerpo: `Debe ${usd(c.saldo_usd)}; vencido ${usd(c.vencido_usd)}.`,
      url: `/admin/clientes/${c.id}`,
    });
  }

  const bajo = inventario.filter((e) => e.seguido && (e.estado === "sin" || e.estado === "poco"));
  for (const e of bajo) {
    avisos.push({
      clave: `inventario:${e.clave}:${semana}`,
      tipo: "inventario",
      titulo: e.estado === "sin" ? `${e.nombre}: sin existencia` : `${e.nombre}: queda poco`,
      cuerpo: e.estado === "sin" ? "" : `${cantidad(e.existencia, e.unidad)}, para unos ${e.diasQueDura} días.`,
      url: "/admin/inventario",
    });
  }

  // El estudio de clientes: quién lleva una semana o más sin trato.
  const porLlamar = estudio.filter((x) => x.trato.porLlamar);
  if (porLlamar.length > 0) {
    const nombres = porLlamar.slice(0, 5).map((x) => x.cliente.rotulo);
    avisos.push({
      clave: `llamar:${fecha}`,
      tipo: "clientes",
      titulo: `${porLlamar.length} ${porLlamar.length === 1 ? "cliente lleva" : "clientes llevan"} una semana o más sin trato`,
      cuerpo: `${nombres.join(", ")}${porLlamar.length > 5 ? "…" : ""}. Llámalos para ofrecerles mercancía.`,
      url: "/admin/clientes/seguimiento",
    });
  }

  const datos: DatosDeLaManana = {
    fecha,
    entregasHoy: paraHoy.length,
    entregasAtrasadas: atrasadas.length,
    clientesVencidos: vencidos.length,
    vencidoUsd: Math.round(vencidos.reduce((s, c) => s + c.vencido_usd, 0) * 100) / 100,
    inventarioBajo: bajo.map((e) => (e.estado === "sin" ? `${e.nombre} sin existencia` : `${e.nombre} (${e.diasQueDura} días)`)),
    tasa: tasa?.valor ?? null,
    clientesPorLlamar: porLlamar.length,
  };
  return { datos, avisos };
}

/**
 * Crea los avisos del día en la campanita (los que no existan ya). Lo
 * llama la tarea de la mañana y también el Resumen, por si la tarea no
 * corrió: en una sola sentencia, así no pesa.
 */
export async function generarAvisosDelDia(fecha = hoy()): Promise<{ nuevos: number; datos: DatosDeLaManana }> {
  const { datos, avisos } = await candidatosDelDia(fecha);
  const manana = textoDelAvisoDeLaManana(datos);
  const nuevos = await crearAvisos([{ ...manana, clave: `manana:${fecha}`, tipo: "manana" }, ...avisos]);
  return { nuevos, datos };
}

/** El aviso de la mañana al teléfono, además de a la campanita. Lo manda la tarea de las 7. */
export async function mandarAvisoDeLaManana(fecha = hoy()): Promise<{ aviso: Aviso; nuevos: number; envio: ResultadoDelEnvio }> {
  const { nuevos, datos } = await generarAvisosDelDia(fecha);
  const aviso = textoDelAvisoDeLaManana(datos);
  const envio = await empujarAviso(aviso);
  await podarAvisos();
  return { aviso, nuevos, envio };
}

/** El aviso de prueba, desde la campanita: para ver que llega a este teléfono. */
export function avisoDePrueba(nombreCorto: string): Aviso {
  return { titulo: `${nombreCorto}: aviso de prueba`, cuerpo: "Si lees esto, los avisos llegan a este teléfono.", url: "/admin/avisos", etiqueta: "prueba" };
}

/** Crea los avisos del día solo si todavía no está el de la mañana: lo llama el Resumen, por si la tarea de las 7 no corrió. */
export async function generarAvisosSiFaltan(fecha = hoy()): Promise<boolean> {
  const [hay] = await filas<{ n: number }>("select count(*) as n from avisos where clave = ?", [`manana:${fecha}`]);
  if (Number(hay?.n ?? 0) > 0) return false;
  await generarAvisosDelDia(fecha);
  return true;
}
