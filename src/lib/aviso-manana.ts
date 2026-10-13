import { bs, fechaCorta, usd } from "./dinero.ts";

/**
 * El aviso de cada mañana al teléfono del dueño: lo que el sistema sabe
 * antes que él. Cálculo puro, con pruebas; los datos los junta
 * `avisoDeLaManana` en `avisos.ts`.
 */

export type DatosDeLaManana = {
  fecha: string;
  entregasHoy: number;
  entregasAtrasadas: number;
  clientesVencidos: number;
  vencidoUsd: number;
  /** «Mozzarella (3 días)», «Huevos sin existencia». */
  inventarioBajo: string[];
  tasa: number | null;
  /** Cuántos llevan una semana o más sin trato (el estudio de clientes). */
  clientesPorLlamar: number;
};

export type Aviso = {
  titulo: string;
  cuerpo: string;
  /** La pantalla del panel que se abre al tocarlo. */
  url: string;
  /** Un aviso nuevo con la misma etiqueta sustituye al anterior en vez de apilarse. */
  etiqueta?: string;
};

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;

function diaDeLaSemana(fecha: string): string {
  const [a, m, d] = fecha.slice(0, 10).split("-").map(Number);
  return DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

export function textoDelAvisoDeLaManana(d: DatosDeLaManana): Aviso {
  const lineas: string[] = [];
  if (d.entregasHoy > 0 || d.entregasAtrasadas > 0) {
    const partes: string[] = [];
    if (d.entregasHoy > 0) partes.push(`${plural(d.entregasHoy, "entrega", "entregas")} para hoy`);
    if (d.entregasAtrasadas > 0) partes.push(plural(d.entregasAtrasadas, "atrasada", "atrasadas"));
    lineas.push(`Entregas: ${partes.join(" y ")}.`);
  } else lineas.push("Sin entregas pendientes.");
  if (d.clientesVencidos > 0) lineas.push(`${plural(d.clientesVencidos, "cliente", "clientes")} con el plazo vencido: ${usd(d.vencidoUsd)}.`);
  else lineas.push("Nadie con el plazo vencido.");
  if (d.inventarioBajo.length > 0) lineas.push(`Queda poco: ${d.inventarioBajo.join(", ")}.`);
  if (d.clientesPorLlamar > 0) lineas.push(`${plural(d.clientesPorLlamar, "cliente", "clientes")} por llamar: una semana o más sin trato.`);
  if (d.tasa) lineas.push(`Tasa BCV: ${bs(d.tasa)} por dólar.`);
  const urgente = d.entregasAtrasadas > 0 || d.clientesVencidos > 0;
  return {
    titulo: `Buenos días · ${diaDeLaSemana(d.fecha)} ${fechaCorta(d.fecha)}`,
    cuerpo: lineas.join("\n"),
    url: urgente ? "/admin" : "/admin/despacho",
    etiqueta: "manana",
  };
}
