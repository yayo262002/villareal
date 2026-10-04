import "server-only";
import { ejecutar, fila, filas, transaccion } from "./db";
import { aDolares, cantidad, redondear, unidadEnPalabras, usd, type MetodoPago, type Moneda } from "./dinero";

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

/** Borra un proveedor con sus compras (y sus líneas) y sus pagos. Todo o nada. Quien llama ya pidió la clave. */
export async function eliminarProveedor(id: number): Promise<boolean> {
  return transaccion(async (tx) => {
    await tx.execute({ sql: "delete from compra_lineas where compra_id in (select id from compras where proveedor_id = ?)", args: [id] });
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

export type LineaDeCompraNueva = {
  producto_id: number;
  variante_id: number | null;
  /** «Queso mozzarella» o «Queso amarillo Kemmental»; para la descripción. */
  nombre: string;
  unidad: string;
  piezas: number | null;
  /** Kilos, o cartones si el producto va así. */
  cantidad: number;
  costo_unitario_usd: number;
};

/** «10 cartones», «1 unidad», «20 kg». */
function enUnidades(n: number, unidad: string): string {
  if (unidad === "kg") return cantidad(n, "kg");
  const num = cantidad(n, "").trim();
  if (unidad === "carton") return `${num} ${n === 1 ? "cartón" : "cartones"}`;
  return `${num} ${n === 1 ? "unidad" : "unidades"}`;
}

/** «20 kg de Queso mozzarella a USD 5,00 el kilo, 10 cartones de Huevos a USD 2,00 el cartón y otras cosas por USD 4,00». */
function descripcionDeLineas(lineas: LineaDeCompraNueva[], otros: number): string {
  const partes = lineas.map((l) => `${enUnidades(l.cantidad, l.unidad)} de ${l.nombre} a ${usd(l.costo_unitario_usd)} el ${unidadEnPalabras(l.unidad)}`);
  if (otros > 0) partes.push(`otras cosas por ${usd(otros)}`);
  return partes.length > 1 ? `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}` : (partes[0] ?? "");
}

/**
 * Una compra con sus líneas, en una sola transacción. El total sale de las
 * líneas más «otras cosas»; no se acepta del formulario. Si no se escribió
 * qué se compró, la descripción se arma con las líneas.
 */
export async function crearCompra(datos: {
  proveedor_id: number;
  fecha: string;
  descripcion: string;
  /** Lo que no es un producto (flete, hielo), en dólares. */
  otros_usd: number;
  nota: string;
  tasa: number | null;
  lineas: LineaDeCompraNueva[];
}): Promise<number> {
  for (const l of datos.lineas) {
    if (!(l.cantidad > 0)) throw new Error("La cantidad tiene que ser mayor que cero.");
    if (!(l.costo_unitario_usd > 0)) throw new Error("El costo tiene que ser mayor que cero.");
  }
  const otros = datos.otros_usd > 0 ? redondear(datos.otros_usd) : 0;
  const total = redondear(datos.lineas.reduce((s, l) => s + l.cantidad * l.costo_unitario_usd, 0) + otros);
  if (!(total > 0)) throw new Error("El total tiene que ser mayor que cero.");
  const descripcion = datos.descripcion || descripcionDeLineas(datos.lineas, otros);
  return transaccion(async (tx) => {
    const compra = await tx.execute({
      sql: "insert into compras (proveedor_id, fecha, descripcion, total_usd, nota, tasa) values (?, ?, ?, ?, ?, ?) returning id",
      args: [datos.proveedor_id, datos.fecha, descripcion, total, datos.nota, datos.tasa && datos.tasa > 0 ? datos.tasa : null],
    });
    const compraId = Number(compra.rows[0].id);
    for (const l of datos.lineas) {
      await tx.execute({
        sql: `insert into compra_lineas (compra_id, producto_id, variante_id, piezas, cantidad, costo_unitario_usd, subtotal_usd)
              values (?, ?, ?, ?, ?, ?, ?)`,
        args: [compraId, l.producto_id, l.variante_id, l.piezas, l.cantidad, l.costo_unitario_usd, redondear(l.cantidad * l.costo_unitario_usd)],
      });
    }
    return compraId;
  });
}

/** Borra una compra con sus líneas: el inventario deja de contarla. */
export async function eliminarCompra(id: number): Promise<boolean> {
  return transaccion(async (tx) => {
    await tx.execute({ sql: "delete from compra_lineas where compra_id = ?", args: [id] });
    const r = await tx.execute({ sql: "delete from compras where id = ?", args: [id] });
    return r.rowsAffected > 0;
  });
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
  if (!(montoUsd > 0)) throw new Error("Ese monto no llega a un centavo de dólar. Revisa el monto y la tasa.");
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
