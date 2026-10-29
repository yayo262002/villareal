import "server-only";
import { negocio, whatsappLegible } from "@/config/negocio";
import { ejecutar, fila, filas, transaccion } from "./db";
import { buscarVenta } from "./ventas";
import { buscarCliente } from "./clientes";
import { rotuloDe } from "./rotulo";
import { alicuotaIva, leerTasa, numeracionDeFacturasDesde } from "./ajustes";
import { horaDeLaBase, hoy } from "./dinero";
import {
  avisoDePeriodo,
  calcularFactura,
  numeroDeFactura,
  type DocumentoDelLibro,
  type LineaFacturada,
  type LineaParaFacturar,
  type TipoDeDocumento,
  type TipoIva,
} from "./factura-calculo";

/**
 * Las facturas y las notas de crédito, desde la base. Una factura sale de
 * una venta (su nota de entrega) y guarda una foto de todo lo que lleva:
 * así no cambia aunque después cambie el precio del producto o el nombre
 * del cliente. Las cuentas puras están en `factura-calculo.ts`.
 */

export type EmisorFacturado = {
  nombre: string;
  rif: string;
  direccion: string;
  telefono: string;
};

export type ClienteFacturado = {
  nombre: string;
  razon_social: string;
  cedula_rif: string;
  direccion: string;
  telefono: string;
};

export type EstadoDeFactura = "emitida" | "anulada";

export type Factura = {
  id: number;
  tipo: TipoDeDocumento;
  numero: number;
  venta_id: number | null;
  /** La factura que anula, si es una nota de crédito. */
  factura_id: number | null;
  cliente_id: number | null;
  fecha: string;
  hora: string;
  emisor: EmisorFacturado;
  cliente: ClienteFacturado;
  lineas: LineaFacturada[];
  subtotal_usd: number;
  descuento_usd: number;
  exento_usd: number;
  base_imponible_usd: number;
  iva_pct: number;
  iva_usd: number;
  total_usd: number;
  tasa: number | null;
  total_bs: number | null;
  numero_control: string;
  control_puesto_en: string | null;
  estado: EstadoDeFactura;
  anulada_en: string | null;
  motivo: string;
  creado_en: string;
};

type FilaDeFactura = Omit<Factura, "emisor" | "cliente" | "lineas"> & {
  emisor: string;
  cliente: string;
  lineas: string;
};

function aFactura(f: FilaDeFactura): Factura {
  return {
    ...f,
    tipo: f.tipo === "nota_credito" ? "nota_credito" : "factura",
    numero: Number(f.numero),
    venta_id: f.venta_id === null || f.venta_id === undefined ? null : Number(f.venta_id),
    factura_id: f.factura_id === null || f.factura_id === undefined ? null : Number(f.factura_id),
    cliente_id: f.cliente_id === null || f.cliente_id === undefined ? null : Number(f.cliente_id),
    emisor: JSON.parse(f.emisor) as EmisorFacturado,
    cliente: JSON.parse(f.cliente) as ClienteFacturado,
    lineas: JSON.parse(f.lineas) as LineaFacturada[],
    subtotal_usd: Number(f.subtotal_usd),
    descuento_usd: Number(f.descuento_usd),
    exento_usd: Number(f.exento_usd),
    base_imponible_usd: Number(f.base_imponible_usd),
    iva_pct: Number(f.iva_pct),
    iva_usd: Number(f.iva_usd),
    total_usd: Number(f.total_usd),
    tasa: f.tasa === null || f.tasa === undefined ? null : Number(f.tasa),
    total_bs: f.total_bs === null || f.total_bs === undefined ? null : Number(f.total_bs),
    estado: f.estado === "anulada" ? "anulada" : "emitida",
    numero_control: f.numero_control ?? "",
    motivo: f.motivo ?? "",
    hora: f.hora ?? "",
  };
}

/** Cómo se llama al cliente en una factura: la razón social si la hay; si no, el nombre; si no, el teléfono. */
export function rotuloFacturado(c: ClienteFacturado): string {
  return rotuloDe(c);
}

/** Quién emite: lo que dice `negocio.ts` en el momento de facturar. */
function emisorDeHoy(): EmisorFacturado {
  return {
    nombre: negocio.razonSocial || negocio.nombre,
    rif: negocio.rif,
    direccion: [negocio.direccion, negocio.ciudad].filter(Boolean).join(", "),
    telefono: whatsappLegible(),
  };
}

/** El siguiente número correlativo de un tipo: el último más uno, o desde donde dijo el dueño si va más allá. */
export async function siguienteNumeroDeFactura(tipo: TipoDeDocumento): Promise<number> {
  const f = await fila<{ ultimo: number | null }>("select max(numero) as ultimo from facturas where tipo = ?", [tipo]);
  const siguiente = Number(f?.ultimo ?? 0) + 1;
  if (tipo !== "factura") return siguiente;
  return Math.max(siguiente, await numeracionDeFacturasDesde());
}

export async function buscarFactura(id: number): Promise<Factura | null> {
  const f = await fila<FilaDeFactura>("select * from facturas where id = ?", [id]);
  return f ? aFactura(f) : null;
}

/** La factura emitida (no anulada) de una venta, si la tiene. */
export async function facturaVigenteDeVenta(ventaId: number): Promise<Factura | null> {
  const f = await fila<FilaDeFactura>("select * from facturas where venta_id = ? and tipo = 'factura' and estado = 'emitida' order by id desc limit 1", [ventaId]);
  return f ? aFactura(f) : null;
}

export type FacturaResumida = {
  id: number;
  numero: number;
  estado: EstadoDeFactura;
  numero_control: string;
};

/** De varias ventas, su factura (la vigente; si todas están anuladas, la última), para enlazarla desde las listas. */
export async function facturasDeVentas(ventaIds: number[]): Promise<Map<number, FacturaResumida>> {
  const resultado = new Map<number, FacturaResumida>();
  if (ventaIds.length === 0) return resultado;
  const huecos = ventaIds.map(() => "?").join(", ");
  const lista = await filas<{
    id: number;
    venta_id: number;
    numero: number;
    estado: string;
    numero_control: string;
  }>(`select id, venta_id, numero, estado, numero_control from facturas where tipo = 'factura' and venta_id in (${huecos}) order by id`, ventaIds);
  for (const f of lista) {
    const ventaId = Number(f.venta_id);
    const anterior = resultado.get(ventaId);
    if (anterior && anterior.estado === "emitida") continue;
    resultado.set(ventaId, {
      id: Number(f.id),
      numero: Number(f.numero),
      estado: f.estado === "anulada" ? "anulada" : "emitida",
      numero_control: f.numero_control ?? "",
    });
  }
  return resultado;
}

/** La nota de crédito que anuló una factura, si la hay. */
export async function notaDeCreditoDe(facturaId: number): Promise<Factura | null> {
  const f = await fila<FilaDeFactura>("select * from facturas where tipo = 'nota_credito' and factura_id = ? order by id desc limit 1", [facturaId]);
  return f ? aFactura(f) : null;
}

/** El tipo de IVA de cada producto, para clasificar las líneas de la venta. */
async function ivaDeProductos(ids: number[]): Promise<Map<number, TipoIva>> {
  const resultado = new Map<number, TipoIva>();
  if (ids.length === 0) return resultado;
  const huecos = ids.map(() => "?").join(", ");
  for (const p of await filas<{ id: number; iva: string }>(`select id, iva from productos where id in (${huecos})`, ids)) {
    resultado.set(Number(p.id), p.iva === "exento" ? "exento" : "general");
  }
  return resultado;
}

/** Un error con el que el panel sabe adónde volver: la ficha del cliente si le falta el RIF. */
export class FaltaElRif extends Error {
  constructor(
    public readonly clienteId: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

/**
 * Emite la factura de una venta: calcula el IVA con lo que hay hoy (la
 * alícuota, el tipo de IVA de cada producto, la tasa del día) y la guarda
 * con su número. Una venta con una factura vigente no se factura otra vez.
 */
export async function emitirFacturaDeVenta(ventaId: number): Promise<{ id: number; numero: number; aviso: string | null }> {
  const venta = await buscarVenta(ventaId);
  if (!venta) throw new Error("No se encontró la venta.");
  const yaTiene = await facturaVigenteDeVenta(ventaId);
  if (yaTiene) throw new Error(`Esta venta ya tiene la factura N.º ${numeroDeFactura(yaTiene.numero)}. Para hacerle otra, anula esa primero con una nota de crédito.`);
  const cliente = await buscarCliente(venta.cliente_id);
  if (!cliente) throw new Error("No se encontró el cliente de la venta.");
  if (!cliente.cedula_rif.trim())
    throw new FaltaElRif(cliente.id, `Para facturar hace falta la cédula o el RIF de ${rotuloDe(cliente)}: ponlo en su ficha y vuelve a pulsar «Facturar».`);
  if (venta.lineas.length === 0) throw new Error("La venta no tiene productos.");

  const [tipos, ivaPct, tasaDeHoy] = await Promise.all([ivaDeProductos(venta.lineas.map((l) => l.producto_id)), alicuotaIva(), leerTasa()]);
  const lineas: LineaParaFacturar[] = venta.lineas.map((l) => ({
    descripcion: l.producto_nombre,
    cantidad: Number(l.cantidad),
    unidad: l.unidad,
    precio_unitario_usd: Number(l.precio_unitario_usd),
    importe_usd: Number(l.subtotal_usd),
    iva: tipos.get(l.producto_id) ?? "general",
  }));
  // Los bolívares de la factura van a la tasa del día en que se emite; si hoy no hay, a la de la nota.
  const cuentas = calcularFactura({
    lineas,
    descuento_usd: Number(venta.descuento_usd),
    iva_pct: ivaPct,
    tasa: tasaDeHoy?.valor ?? venta.tasa ?? null,
  });
  const fecha = hoy();
  const hora = horaDeLaBase(new Date().toISOString());
  const clienteFacturado: ClienteFacturado = {
    nombre: cliente.nombre,
    razon_social: cliente.razon_social,
    cedula_rif: cliente.cedula_rif.trim(),
    direccion: cliente.direccion,
    telefono: cliente.telefono,
  };

  // El número se toma al guardar; si dos facturas se emiten a la vez, el índice único hace repetir a la segunda.
  for (let intento = 0; intento < 3; intento++) {
    const numero = await siguienteNumeroDeFactura("factura");
    try {
      const r = await ejecutar(
        `insert into facturas (tipo, numero, venta_id, factura_id, cliente_id, fecha, hora, emisor, cliente, lineas,
                               subtotal_usd, descuento_usd, exento_usd, base_imponible_usd, iva_pct, iva_usd, total_usd, tasa, total_bs)
         values ('factura', ?, ?, null, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          numero,
          venta.id,
          cliente.id,
          fecha,
          hora,
          JSON.stringify(emisorDeHoy()),
          JSON.stringify(clienteFacturado),
          JSON.stringify(cuentas.lineas),
          cuentas.subtotal_usd,
          cuentas.descuento_usd,
          cuentas.exento_usd,
          cuentas.base_imponible_usd,
          cuentas.iva_pct,
          cuentas.iva_usd,
          cuentas.total_usd,
          cuentas.tasa,
          cuentas.total_bs,
        ],
      );
      return {
        id: r.ultimoId,
        numero,
        aviso: avisoDePeriodo(venta.fecha, fecha),
      };
    } catch (error) {
      if (intento === 2 || !/unique/i.test(error instanceof Error ? error.message : String(error))) throw error;
    }
  }
  throw new Error("No se pudo dar número a la factura: inténtalo otra vez.");
}

/** El número de control lo asigna la imprenta digital autorizada; se anota aquí cuando llega. */
export async function ponerNumeroDeControl(id: number, numeroControl: string): Promise<void> {
  await ejecutar("update facturas set numero_control = ?, control_puesto_en = case when ? = '' then null else datetime('now') end where id = ?", [
    numeroControl,
    numeroControl,
    id,
  ]);
}

/**
 * Anula una factura emitiendo una nota de crédito por el mismo importe,
 * que la referencia. La factura queda «anulada» y conserva su número: en
 * el libro de ventas salen las dos. La venta no se toca.
 */
export async function anularConNotaDeCredito(facturaId: number, motivo: string): Promise<number> {
  const factura = await buscarFactura(facturaId);
  if (!factura || factura.tipo !== "factura") throw new Error("No se encontró la factura.");
  if (factura.estado === "anulada") throw new Error("Esa factura ya está anulada.");
  const fecha = hoy();
  const hora = horaDeLaBase(new Date().toISOString());
  for (let intento = 0; intento < 3; intento++) {
    const numero = await siguienteNumeroDeFactura("nota_credito");
    try {
      return await transaccion(async (tx) => {
        const r = await tx.execute({
          sql: `insert into facturas (tipo, numero, venta_id, factura_id, cliente_id, fecha, hora, emisor, cliente, lineas,
                                      subtotal_usd, descuento_usd, exento_usd, base_imponible_usd, iva_pct, iva_usd, total_usd, tasa, total_bs, motivo)
                values ('nota_credito', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            numero,
            factura.venta_id,
            factura.id,
            factura.cliente_id,
            fecha,
            hora,
            JSON.stringify(factura.emisor),
            JSON.stringify(factura.cliente),
            JSON.stringify(factura.lineas),
            factura.subtotal_usd,
            factura.descuento_usd,
            factura.exento_usd,
            factura.base_imponible_usd,
            factura.iva_pct,
            factura.iva_usd,
            factura.total_usd,
            factura.tasa,
            factura.total_bs,
            motivo,
          ],
        });
        await tx.execute({
          sql: "update facturas set estado = 'anulada', anulada_en = datetime('now'), motivo = ? where id = ?",
          args: [motivo, factura.id],
        });
        return Number(r.lastInsertRowid);
      });
    } catch (error) {
      if (intento === 2 || !/unique/i.test(error instanceof Error ? error.message : String(error))) throw error;
    }
  }
  throw new Error("No se pudo dar número a la nota de crédito: inténtalo otra vez.");
}

/** Todas las de un mes («2026-10»), las más nuevas primero; sin mes, todas. */
export async function listarFacturas(mes: string | null = null): Promise<Factura[]> {
  const lista = mes
    ? await filas<FilaDeFactura>("select * from facturas where fecha like ? order by fecha desc, id desc", [`${mes}%`])
    : await filas<FilaDeFactura>("select * from facturas order by fecha desc, id desc");
  return lista.map(aFactura);
}

/** Los meses con algún documento, del más nuevo al más viejo. */
export async function mesesConFacturas(): Promise<string[]> {
  const lista = await filas<{ mes: string }>("select distinct substr(fecha, 1, 7) as mes from facturas order by mes desc");
  return lista.map((m) => m.mes);
}

/** Lo que el libro de ventas necesita de cada documento de un mes, en el orden en que se emitieron. */
export async function documentosDelLibro(mes: string): Promise<DocumentoDelLibro[]> {
  const lista = await filas<FilaDeFactura & { afectada: number | null }>(
    `select f.*, (select numero from facturas a where a.id = f.factura_id) as afectada
     from facturas f where f.fecha like ? order by f.fecha, f.id`,
    [`${mes}%`],
  );
  return lista.map((f) => {
    const factura = aFactura(f);
    return {
      tipo: factura.tipo,
      numero: factura.numero,
      numero_control: factura.numero_control,
      fecha: factura.fecha,
      cliente_nombre: rotuloFacturado(factura.cliente),
      cliente_rif: factura.cliente.cedula_rif,
      factura_afectada: f.afectada === null || f.afectada === undefined ? null : Number(f.afectada),
      venta_id: factura.venta_id,
      exento_usd: factura.exento_usd,
      base_imponible_usd: factura.base_imponible_usd,
      iva_pct: factura.iva_pct,
      iva_usd: factura.iva_usd,
      total_usd: factura.total_usd,
      tasa: factura.tasa,
      estado: factura.estado,
    };
  });
}

export async function contarFacturas(): Promise<number> {
  const f = await fila<{ n: number }>("select count(*) as n from facturas");
  return Number(f?.n ?? 0);
}

/** Cuántas facturas emitidas esperan su número de control. */
export async function facturasSinControl(): Promise<number> {
  const f = await fila<{ n: number }>("select count(*) as n from facturas where numero_control = ''");
  return Number(f?.n ?? 0);
}

/** Cuántos tipos de producto llevan IVA y cuántos están exentos (de los que no son borrador). */
export async function resumenDeIva(): Promise<{
  gravados: number;
  exentos: number;
  exentos_nombres: string[];
}> {
  const lista = await filas<{ nombre: string; iva: string }>("select nombre, iva from productos where borrador = 0 order by nombre");
  const exentos = lista.filter((p) => p.iva === "exento");
  return {
    gravados: lista.length - exentos.length,
    exentos: exentos.length,
    exentos_nombres: exentos.map((p) => p.nombre),
  };
}
