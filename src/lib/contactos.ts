import "server-only";
import { ejecutar, filas } from "./db";

/**
 * Cada vez que el dueño habla con un cliente fuera de una venta o un abono:
 * lo llamó, lo visitó, le escribió. El estudio de clientes cuenta desde el
 * último trato, sea el que sea.
 */

export const TIPOS_DE_CONTACTO = { llamada: "Lo llamé", visita: "Lo visité", whatsapp: "Le escribí por WhatsApp", otro: "Otro" } as const;
export type TipoDeContacto = keyof typeof TIPOS_DE_CONTACTO;

export function esTipoDeContacto(valor: string): valor is TipoDeContacto {
  return valor in TIPOS_DE_CONTACTO;
}

export type Contacto = { id: number; cliente_id: number; fecha: string; tipo: TipoDeContacto; nota: string; creado_en: string };

export async function anotarContacto(clienteId: number, fecha: string, tipo: TipoDeContacto, nota: string): Promise<number> {
  const r = await ejecutar("insert into contactos (cliente_id, fecha, tipo, nota) values (?, ?, ?, ?)", [clienteId, fecha, tipo, nota.slice(0, 300)]);
  return r.ultimoId;
}

export async function listarContactosDe(clienteId: number, limite = 10): Promise<Contacto[]> {
  return filas<Contacto>("select * from contactos where cliente_id = ? order by fecha desc, id desc limit ?", [clienteId, limite]);
}

/** El último contacto de cada cliente: id del cliente → fecha. */
export async function ultimosContactos(): Promise<Map<number, string>> {
  const lista = await filas<{ cliente_id: number; fecha: string }>("select cliente_id, max(fecha) as fecha from contactos group by cliente_id");
  return new Map(lista.map((c) => [Number(c.cliente_id), c.fecha]));
}
