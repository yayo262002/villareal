import "server-only";
import { ejecutar, fila, filas, transaccion } from "./db";
import { aDolares, redondear, type MetodoPago, type Moneda } from "./dinero";

/**
 * Los proveedores: a quién le compra el negocio y cuánto le debe. Es el
 * espejo de los clientes: cada compra suma a lo que se debe y cada pago
 * que se le hace resta. Los pagos van contra el proveedor, no contra una
 * compra, y se aplican a las compras más antiguas primero (`cuentas.ts`).
 */

export type Proveedor = {
  id: number;
  nombre: string;
  telefono: string;
  cedula_rif: string;
  direccion: string;
  nota: string;
  /** Los días que da el proveedor para pagarle cada compra. */
  dias_credito: number;
  creado_en: string;
};

export type ProveedorConSaldo = Proveedor & {
  total_comprado_usd: number;
  total_pagado_usd: number;
  /** Lo que el negocio le debe. Negativo si se le pagó de más. */
  saldo_usd: number;
  ultima_compra: string | null;
};

export type DatosProveedor = Omit<Proveedor, "id" | "creado_en">;

export type Compra = {
  id: number;
  proveedor_id: number;
  proveedor_nombre: string;
  fecha: string;
  descripcion: string;
  total_usd: number;
  nota: string;
  tasa: number | null;
  creado_en: string;
};

export type PagoProveedor = {
  id: number;
  proveedor_id: number;
  proveedor_nombre: string;
  fecha: string;
  metodo: MetodoPago;
  moneda: Moneda;
  monto: number;
  tasa: number | null;
  monto_usd: number;
  referencia: string;
  nota: string;
  creado_en: string;
};

const CONSULTA_CON_SALDO = `
  select
    p.*,
    coalesce((select sum(total_usd) from compras c where c.proveedor_id = p.id), 0) as total_comprado_usd,
    coalesce((select sum(monto_usd) from pagos_proveedores g where g.proveedor_id = p.id), 0) as total_pagado_usd,
    (select max(fecha) from compras c where c.proveedor_id = p.id) as ultima_compra
  from proveedores p
`;

function conSaldo(f: ProveedorConSaldo): ProveedorConSaldo {
  const comprado = Number(f.total_comprado_usd);
  const pagado = Number(f.total_pagado_usd);
  return { ...f, total_comprado_usd: comprado, total_pagado_usd: pagado, saldo_usd: redondear(comprado - pagado) };
}

export async function listarProveedores(): Promise<ProveedorConSaldo[]> {
  const f = await filas<ProveedorConSaldo>(`${CONSULTA_CON_SALDO} order by p.nombre collate nocase`);
  return f.map(conSaldo);
}

export async function buscarProveedor(id: number): Promise<ProveedorConSaldo | null> {
  const f = await fila<ProveedorConSaldo>(`${CONSULTA_CON_SALDO} where p.id = ?`, [id]);
  return f ? conSaldo(f) : null;
}

export async function crearProveedor(datos: DatosProveedor): Promise<number> {
  const r = await ejecutar(
    `insert into proveedores (nombre, telefono, cedula_rif, direccion, nota, dias_credito)
     values (?, ?, ?, ?, ?, ?)`,
    [datos.nombre, datos.telefono, datos.cedula_rif, datos.direccion, datos.nota, datos.dias_credito],
  );
  return r.ultimoId;
}

export async function actualizarProveedor(id: number, datos: DatosProveedor): Promise<void> {
  await ejecutar(
    `update proveedores
     set nombre = ?, telefono = ?, cedula_rif = ?, direccion = ?, nota = ?, dias_credito = ?
     where id = ?`,
    [datos.nombre, datos.telefono, datos.cedula_rif, datos.direccion, datos.nota, datos.dias_credito, id],
  );
}

/** Cuánto hay del proveedor: para decirlo antes de borrarlo. */
export async function loQueTieneElProveedor(id: number): Promise<{ compras: number; pagos: number }> {
  const f = await fila<{ compras: number; pagos: number }>(
    `select
       (select count(*) from compras where proveedor_id = ?) as compras,
       (select count(*) from pagos_proveedores where proveedor_id = ?) as pagos`,
    [id, id],
  );
  return { compras: Number(f?.compras ?? 0), pagos: Number(f?.pagos ?? 0) };
}

/** Borra un proveedor con sus compras y sus pagos. Todo o nada. Quien llama ya pidió la clave. */
export async function eliminarProveedor(id: number): Promise<boolean> {
  return transaccion(async (tx) => {
    await tx.execute({ sql: "delete from compras where proveedor_id = ?", args: [id] });
    await tx.execute({ sql: "delete from pagos_proveedores where proveedor_id = ?", args: [id] });
    const r = await tx.execute({ sql: "delete from proveedores where id = ?", args: [id] });
    return r.rowsAffected > 0;
  });
}

/** Cuánto se debe entre todos los proveedores. Para el resumen del panel. */
export async function totalDebidoAProveedores(): Promise<number> {
  const proveedores = await listarProveedores();
  return redondear(proveedores.reduce((s, p) => s + Math.max(0, p.saldo_usd), 0));
}

// ---------- Compras ----------

const CONSULTA_COMPRAS = `
  select c.*, p.nombre as proveedor_nombre
  from compras c
  join proveedores p on p.id = c.proveedor_id
`;

export async function listarCompras(limite = 100): Promise<Compra[]> {
  return filas<Compra>(`${CONSULTA_COMPRAS} order by c.fecha desc, c.id desc limit ?`, [limite]);
}

export async function listarComprasDeProveedor(proveedorId: number): Promise<Compra[]> {
  return filas<Compra>(`${CONSULTA_COMPRAS} where c.proveedor_id = ? order by c.fecha desc, c.id desc`, [proveedorId]);
}

export async function buscarCompra(id: number): Promise<Compra | null> {
  return fila<Compra>(`${CONSULTA_COMPRAS} where c.id = ?`, [id]);
}

export async function crearCompra(datos: {
  proveedor_id: number;
  fecha: string;
  descripcion: string;
  total_usd: number;
  nota: string;
  tasa: number | null;
}): Promise<number> {
  if (!(datos.total_usd > 0)) throw new Error("El total tiene que ser mayor que cero.");
  const r = await ejecutar(
    "insert into compras (proveedor_id, fecha, descripcion, total_usd, nota, tasa) values (?, ?, ?, ?, ?, ?)",
    [datos.proveedor_id, datos.fecha, datos.descripcion, redondear(datos.total_usd), datos.nota, datos.tasa && datos.tasa > 0 ? datos.tasa : null],
  );
  return r.ultimoId;
}

export async function eliminarCompra(id: number): Promise<boolean> {
  const r = await ejecutar("delete from compras where id = ?", [id]);
  return r.cambios > 0;
}

// ---------- Pagos a proveedores ----------

const CONSULTA_PAGOS = `
  select g.*, p.nombre as proveedor_nombre
  from pagos_proveedores g
  join proveedores p on p.id = g.proveedor_id
`;

export async function listarPagosAProveedores(limite = 100): Promise<PagoProveedor[]> {
  return filas<PagoProveedor>(`${CONSULTA_PAGOS} order by g.fecha desc, g.id desc limit ?`, [limite]);
}

export async function listarPagosDeProveedor(proveedorId: number): Promise<PagoProveedor[]> {
  return filas<PagoProveedor>(`${CONSULTA_PAGOS} where g.proveedor_id = ? order by g.fecha desc, g.id desc`, [proveedorId]);
}

export async function buscarPagoProveedor(id: number): Promise<PagoProveedor | null> {
  return fila<PagoProveedor>(`${CONSULTA_PAGOS} where g.id = ?`, [id]);
}

/** Igual que un abono de cliente: en bolívares se guarda con su tasa y su equivalente en dólares. */
export async function registrarPagoProveedor(datos: {
  proveedor_id: number;
  fecha: string;
  metodo: MetodoPago;
  moneda: Moneda;
  monto: number;
  tasa: number | null;
  referencia: string;
  nota: string;
}): Promise<number> {
  if (!(datos.monto > 0)) throw new Error("El monto tiene que ser mayor que cero.");
  const montoUsd = aDolares(datos.monto, datos.moneda, datos.tasa);
  const r = await ejecutar(
    `insert into pagos_proveedores (proveedor_id, fecha, metodo, moneda, monto, tasa, monto_usd, referencia, nota)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.proveedor_id,
      datos.fecha,
      datos.metodo,
      datos.moneda,
      redondear(datos.monto),
      datos.moneda === "VES" ? datos.tasa : null,
      montoUsd,
      datos.referencia,
      datos.nota,
    ],
  );
  return r.ultimoId;
}

export async function eliminarPagoProveedor(id: number): Promise<boolean> {
  const r = await ejecutar("delete from pagos_proveedores where id = ?", [id]);
  return r.cambios > 0;
}
