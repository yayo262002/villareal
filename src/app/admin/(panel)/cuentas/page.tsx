import Link from "next/link";
import { listarClientes } from "@/lib/clientes";
import { listarVentas, type Venta } from "@/lib/ventas";
import { NOMBRE_ESTADO, aplicarPagos, type CuentaDeVenta } from "@/lib/cuentas";
import { fechaCorta, redondear, usd } from "@/lib/dinero";
import { negocio } from "@/config/negocio";
import { enlaceWhatsappA, mensajeRecordatorio } from "@/lib/whatsapp";
import { leerTasa } from "@/lib/ajustes";
import estilos from "../panel.module.css";

export const metadata = { title: "Cuentas" };

const PAGADAS_A_MOSTRAR = 50;

/**
 * Cuentas por pagar y cuentas pagadas, venta a venta. Los pagos de cada
 * cliente se aplican a sus ventas de la más antigua a la más nueva (ver
 * `lib/cuentas.ts`), así que una venta figura como pagada cuando los pagos
 * del cliente ya la cubren.
 */
export default async function PaginaCuentas() {
  const [clientes, ventas, tasa] = await Promise.all([listarClientes(), listarVentas(5000), leerTasa()]);

  const pagadoPorCliente = new Map(clientes.map((c) => [c.id, c.total_pagado_usd]));
  const ventasPorCliente = new Map<number, Venta[]>();
  for (const v of ventas) {
    const lista = ventasPorCliente.get(v.cliente_id) ?? [];
    lista.push(v);
    ventasPorCliente.set(v.cliente_id, lista);
  }

  const cuentas: CuentaDeVenta<Venta>[] = [];
  for (const [clienteId, lista] of ventasPorCliente) {
    cuentas.push(...aplicarPagos(lista, pagadoPorCliente.get(clienteId) ?? 0));
  }
  const ordenar = (a: Venta, b: Venta) => b.fecha.localeCompare(a.fecha) || b.id - a.id;
  const porPagar = cuentas.filter((c) => c.estado !== "pagada").sort(ordenar);
  const pagadas = cuentas.filter((c) => c.estado === "pagada").sort(ordenar);
  const totalPendiente = redondear(porPagar.reduce((s, c) => s + c.pendiente_usd, 0));

  // Un recordatorio por cliente con todas sus notas pendientes.
  const recordatorios = new Map<number, string | null>();
  for (const cliente of clientes) {
    if (cliente.saldo_usd <= 0) continue;
    const pendientes = porPagar
      .filter((c) => c.cliente_id === cliente.id)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    recordatorios.set(
      cliente.id,
      enlaceWhatsappA(
        cliente.telefono,
        mensajeRecordatorio({ negocio: negocio.nombre, cliente: cliente.nombre, saldo_usd: cliente.saldo_usd, pendientes, tasa: tasa?.valor }),
      ),
    );
  }

  return (
    <>
      <h1 className={estilos.titulo}>Cuentas</h1>

      <dl className={estilos.cifras}>
        <div className={`${estilos.cifra} ${totalPendiente > 0 ? estilos["cifra--alerta"] : ""}`}>
          <dt>Por pagar</dt>
          <dd>{usd(totalPendiente)}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Notas por pagar</dt>
          <dd>{porPagar.length}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Notas pagadas</dt>
          <dd>{pagadas.length}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Clientes que deben</dt>
          <dd>{new Set(porPagar.map((c) => c.cliente_id)).size}</dd>
        </div>
      </dl>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Cuentas por pagar</h2>
        {porPagar.length === 0 ? (
          <p className="vacio">Nadie debe nada.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th className="numero">Total</th>
                  <th className="numero">Pendiente</th>
                  <th>Estado</th>
                  <th>
                    <span className="visualmente-oculto">Recordar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {porPagar.map((c) => (
                  <tr key={c.id}>
                    <td>{fechaCorta(c.fecha)}</td>
                    <td>
                      <Link href={`/admin/clientes/${c.cliente_id}`}>{c.cliente_nombre}</Link>
                    </td>
                    <td className="numero">{usd(c.total_usd)}</td>
                    <td className={`numero ${estilos.deuda}`}>{usd(c.pendiente_usd)}</td>
                    <td>
                      <span className={`${estilos.estado} ${estilos[`estado--${c.estado}`]}`}>
                        {NOMBRE_ESTADO[c.estado]}
                      </span>
                    </td>
                    <td>
                      {recordatorios.get(c.cliente_id) ? (
                        <a href={recordatorios.get(c.cliente_id)!} target="_blank" rel="noopener" className={estilos.whatsapp}>
                          Recordar
                        </a>
                      ) : (
                        <span className="ayuda">Sin teléfono</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Cuentas pagadas</h2>
        {pagadas.length === 0 ? (
          <p className="vacio">Todavía no hay ninguna cuenta pagada.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th className="numero">Total</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {pagadas.slice(0, PAGADAS_A_MOSTRAR).map((c) => (
                  <tr key={c.id}>
                    <td>{fechaCorta(c.fecha)}</td>
                    <td>
                      <Link href={`/admin/clientes/${c.cliente_id}`}>{c.cliente_nombre}</Link>
                    </td>
                    <td className="numero">{usd(c.total_usd)}</td>
                    <td>{c.nota || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pagadas.length > PAGADAS_A_MOSTRAR && (
              <p className={estilos.ayuda}>
                Se muestran las {PAGADAS_A_MOSTRAR} más recientes de {pagadas.length}. El resto está en la
                ficha de cada cliente.
              </p>
            )}
          </div>
        )}
      </section>
    </>
  );
}
