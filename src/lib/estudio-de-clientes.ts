import "server-only";
import { listarClientes, type ClienteConSaldo } from "./clientes";
import { conLineas, listarVentas, type VentaConLineas } from "./ventas";
import { listarPagos } from "./pagos";
import { ultimosRecordatorios } from "./recordatorios";
import { ultimosContactos } from "./contactos";
import { estudiarCliente, type Trato } from "./seguimiento";
import { hoy } from "./dinero";

/**
 * El estudio de clientes desde la base: cada cliente con su trato (cuándo
 * fue el último, qué compra, cada cuánto). Los que hay que llamar van
 * primero, el que más tiempo lleva sin trato arriba. El cálculo está en
 * `seguimiento.ts`.
 */
export type ClienteEstudiado = { cliente: ClienteConSaldo; trato: Trato };

export async function estudioDeClientes(fecha = hoy(), conLoQueCompra = true): Promise<ClienteEstudiado[]> {
  const [clientes, ventas, pagos, recordados, contactos] = await Promise.all([
    listarClientes(),
    listarVentas(100000).then((lista) => (conLoQueCompra ? conLineas(lista) : lista)),
    listarPagos(100000),
    ultimosRecordatorios(),
    ultimosContactos(),
  ]);
  const ventasDe = new Map<number, typeof ventas>();
  for (const v of ventas) ventasDe.set(v.cliente_id, [...(ventasDe.get(v.cliente_id) ?? []), v]);
  const abonosDe = new Map<number, { fecha: string }[]>();
  for (const p of pagos) abonosDe.set(p.cliente_id, [...(abonosDe.get(p.cliente_id) ?? []), p]);

  const sinTrato = (t: Trato) => t.diasSinTrato ?? 100000;
  return clientes
    .map((cliente) => ({
      cliente,
      trato: estudiarCliente(
        {
          alta: cliente.creado_en,
          ventas: (ventasDe.get(cliente.id) ?? []).map((v) => ({ fecha: v.fecha, total_usd: v.total_usd, lineas: (v as Partial<VentaConLineas>).lineas })),
          abonos: abonosDe.get(cliente.id) ?? [],
          ultimoRecordatorio: recordados.get(cliente.id) ?? null,
          ultimoContacto: contactos.get(cliente.id) ?? null,
        },
        fecha,
      ),
    }))
    .sort((a, b) => Number(b.trato.porLlamar) - Number(a.trato.porLlamar) || sinTrato(b.trato) - sinTrato(a.trato) || a.cliente.rotulo.localeCompare(b.cliente.rotulo));
}
