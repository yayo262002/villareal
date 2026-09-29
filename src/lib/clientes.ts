import "server-only";
import { ejecutar, fila, filas } from "./db";
import { redondear } from "./dinero";
import { mismoTelefono } from "./whatsapp";

export type TipoCliente = "detal" | "mayor";

export type Cliente = {
  id: number;
  nombre: string;
  telefono: string;
  cedula_rif: string;
  direccion: string;
  tipo: TipoCliente;
  nota: string;
  creado_en: string;
};

/** Cliente con lo que ha comprado, lo que ha pagado y lo que debe, todo en USD. */
export type ClienteConSaldo = Cliente & {
  total_comprado_usd: number;
  total_pagado_usd: number;
  saldo_usd: number;
  ultima_compra: string | null;
};

export type DatosCliente = Omit<Cliente, "id" | "creado_en">;

const CONSULTA_CON_SALDO = `
  select
    c.*,
    coalesce((select sum(total_usd) from ventas v where v.cliente_id = c.id), 0) as total_comprado_usd,
    coalesce((select sum(monto_usd) from pagos p where p.cliente_id = c.id), 0) as total_pagado_usd,
    (select max(fecha) from ventas v where v.cliente_id = c.id) as ultima_compra
  from clientes c
`;

function conSaldo(f: ClienteConSaldo): ClienteConSaldo {
  const comprado = Number(f.total_comprado_usd);
  const pagado = Number(f.total_pagado_usd);
  return {
    ...f,
    total_comprado_usd: comprado,
    total_pagado_usd: pagado,
    saldo_usd: redondear(comprado - pagado),
  };
}

export async function listarClientes(): Promise<ClienteConSaldo[]> {
  const f = await filas<ClienteConSaldo>(`${CONSULTA_CON_SALDO} order by c.nombre collate nocase`);
  return f.map(conSaldo);
}

export async function buscarCliente(id: number): Promise<ClienteConSaldo | null> {
  const f = await fila<ClienteConSaldo>(`${CONSULTA_CON_SALDO} where c.id = ?`, [id]);
  return f ? conSaldo(f) : null;
}

/**
 * El cliente que ya tiene ese teléfono, se escriba como se escriba. Evita
 * registrar dos veces al mismo al dar de alta deprisa.
 */
export async function buscarClientePorTelefono(telefono: string, salvoId?: number): Promise<Cliente | null> {
  if (!telefono.trim()) return null;
  const conTelefono = await filas<Cliente>("select * from clientes where telefono <> ''");
  return conTelefono.find((c) => c.id !== salvoId && mismoTelefono(c.telefono, telefono)) ?? null;
}

export async function crearCliente(datos: DatosCliente): Promise<number> {
  const r = await ejecutar(
    `insert into clientes (nombre, telefono, cedula_rif, direccion, tipo, nota)
     values (?, ?, ?, ?, ?, ?)`,
    [datos.nombre, datos.telefono, datos.cedula_rif, datos.direccion, datos.tipo, datos.nota],
  );
  return r.ultimoId;
}

export async function actualizarCliente(id: number, datos: DatosCliente): Promise<void> {
  await ejecutar(
    `update clientes
     set nombre = ?, telefono = ?, cedula_rif = ?, direccion = ?, tipo = ?, nota = ?
     where id = ?`,
    [datos.nombre, datos.telefono, datos.cedula_rif, datos.direccion, datos.tipo, datos.nota, id],
  );
}

/** Cuántos clientes deben algo y cuánto suman. Para el resumen del panel. */
export async function resumenDeudas(): Promise<{ clientes_con_deuda: number; total_por_cobrar_usd: number }> {
  const clientes = (await listarClientes()).filter((c) => c.saldo_usd > 0);
  return {
    clientes_con_deuda: clientes.length,
    total_por_cobrar_usd: redondear(clientes.reduce((s, c) => s + c.saldo_usd, 0)),
  };
}
