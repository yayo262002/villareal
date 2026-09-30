import "server-only";
import { ejecutar, fila, filas, transaccion } from "./db";
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
  /** Cuántos días tiene para pagar cada nota. */
  dias_credito: number;
  /** El nombre legal del negocio, para la nota. Puede faltar. */
  razon_social: string;
  /** Dónde lo puso el mapa, si hizo falta buscarlo; null si no. */
  lat: number | null;
  lon: number | null;
  /** Cómo llama el mapa a ese sitio. */
  sitio: string;
  creado_en: string;
};

/**
 * Cómo se llama al cliente en las listas: la razón social si la hay, y si
 * no, el nombre. En SQL, para las consultas que juntan ventas y pagos con
 * su cliente (`c` es la tabla clientes).
 */
export const ROTULO_DEL_CLIENTE = "case when c.razon_social <> '' then c.razon_social else c.nombre end";

export function rotuloDe(c: { nombre: string; razon_social?: string | null }): string {
  return c.razon_social?.trim() || c.nombre;
}

/** Cliente con lo que ha comprado, lo que ha pagado y lo que debe, todo en USD. */
export type ClienteConSaldo = Cliente & {
  /** La razón social si la hay; si no, el nombre. Lo que va en grande. */
  rotulo: string;
  total_comprado_usd: number;
  total_pagado_usd: number;
  saldo_usd: number;
  ultima_compra: string | null;
  /** Cuántos pedidos suyos faltan por entregar. */
  por_entregar: number;
};

export type DatosCliente = Omit<Cliente, "id" | "creado_en" | "lat" | "lon" | "sitio">;

export type SitioDelMapa = { lat: number; lon: number; sitio: string } | null;

const CONSULTA_CON_SALDO = `
  select
    c.*,
    coalesce((select sum(total_usd) from ventas v where v.cliente_id = c.id), 0) as total_comprado_usd,
    coalesce((select sum(monto_usd) from pagos p where p.cliente_id = c.id), 0) as total_pagado_usd,
    (select max(fecha) from ventas v where v.cliente_id = c.id) as ultima_compra,
    (select count(*) from ventas v where v.cliente_id = c.id and v.por_entregar = 1) as por_entregar
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
    por_entregar: Number(f.por_entregar),
    rotulo: rotuloDe(f),
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

export async function crearCliente(datos: DatosCliente, sitio: SitioDelMapa = null): Promise<number> {
  const r = await ejecutar(
    `insert into clientes (nombre, telefono, cedula_rif, direccion, tipo, nota, dias_credito, razon_social, lat, lon, sitio)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.nombre, datos.telefono, datos.cedula_rif, datos.direccion, datos.tipo, datos.nota, datos.dias_credito, datos.razon_social,
      sitio?.lat ?? null, sitio?.lon ?? null, sitio?.sitio ?? "",
    ],
  );
  return r.ultimoId;
}

/** Guarda los datos y, con ellos, lo que el mapa dijo de la dirección (o nada, si no hizo falta o no la encontró). */
export async function actualizarCliente(id: number, datos: DatosCliente, sitio: SitioDelMapa = null): Promise<void> {
  await ejecutar(
    `update clientes
     set nombre = ?, telefono = ?, cedula_rif = ?, direccion = ?, tipo = ?, nota = ?, dias_credito = ?, razon_social = ?,
         lat = ?, lon = ?, sitio = ?
     where id = ?`,
    [
      datos.nombre, datos.telefono, datos.cedula_rif, datos.direccion, datos.tipo, datos.nota, datos.dias_credito, datos.razon_social,
      sitio?.lat ?? null, sitio?.lon ?? null, sitio?.sitio ?? "", id,
    ],
  );
}

/** Solo lo que dijo el mapa, cuando se vuelve a buscar sin cambiar los datos. */
export async function guardarSitio(id: number, sitio: SitioDelMapa): Promise<void> {
  await ejecutar("update clientes set lat = ?, lon = ?, sitio = ? where id = ?", [sitio?.lat ?? null, sitio?.lon ?? null, sitio?.sitio ?? "", id]);
}

/** Cuánto hay del cliente: para decirlo antes de borrarlo. */
export async function loQueTieneElCliente(id: number): Promise<{ ventas: number; pagos: number; adjuntos: number }> {
  const f = await fila<{ ventas: number; pagos: number; adjuntos: number }>(
    `select
       (select count(*) from ventas where cliente_id = ?) as ventas,
       (select count(*) from pagos where cliente_id = ?) as pagos,
       (select count(*) from adjuntos where cliente_id = ?) as adjuntos`,
    [id, id, id],
  );
  return { ventas: Number(f?.ventas ?? 0), pagos: Number(f?.pagos ?? 0), adjuntos: Number(f?.adjuntos ?? 0) };
}

/**
 * Borra un cliente con todo lo suyo: ventas con sus líneas, abonos y fotos.
 * Todo o nada. Devuelve false si no existía. Quien llama ya pidió la clave.
 */
export async function eliminarCliente(id: number): Promise<boolean> {
  return transaccion(async (tx) => {
    await tx.execute({ sql: "delete from venta_lineas where venta_id in (select id from ventas where cliente_id = ?)", args: [id] });
    for (const tabla of ["adjuntos", "ventas", "pagos"]) {
      await tx.execute({ sql: `delete from ${tabla} where cliente_id = ?`, args: [id] });
    }
    const r = await tx.execute({ sql: "delete from clientes where id = ?", args: [id] });
    return r.rowsAffected > 0;
  });
}

/** Cuántos clientes deben algo y cuánto suman. Para el resumen del panel. */
export async function resumenDeudas(): Promise<{ clientes_con_deuda: number; total_por_cobrar_usd: number }> {
  const clientes = (await listarClientes()).filter((c) => c.saldo_usd > 0);
  return {
    clientes_con_deuda: clientes.length,
    total_por_cobrar_usd: redondear(clientes.reduce((s, c) => s + c.saldo_usd, 0)),
  };
}
