import Link from "next/link";
import { listarClientes } from "@/lib/clientes";
import { listarVentas, type Venta } from "@/lib/ventas";
import { NOMBRE_ESTADO, aplicarPagos, type CuentaDeVenta } from "@/lib/cuentas";
import { conVencimiento, describirUrgencia, describirVencimiento, porUrgencia, type ConVencimiento } from "@/lib/credito";
import { fechaCorta, hoy, redondear, usd } from "@/lib/dinero";
import { enlaceWhatsappA } from "@/lib/whatsapp";
import estilos from "../panel.module.css";

export const metadata = { title: "Lo que te deben" };

const PAGADAS_A_MOSTRAR = 50;

/**
 * Lo que te deben: quién, ordenado por lo que vence antes (mientras menos
 * tiempo le quede para pagar, más arriba), y nota a nota; y lo ya pagado.
 * Los pagos de cada cliente se aplican a sus ventas de la más antigua a la
 * más nueva (ver `lib/cuentas.ts`), así que una venta figura como pagada
 * cuando los pagos del cliente ya la cubren.
 */
export default async function PaginaCuentas() {
  const [clientes, ventas] = await Promise.all([listarClientes(), listarVentas(5000)]);

  const pagadoPorCliente = new Map(clientes.map((c) => [c.id, c.total_pagado_usd]));
  const ventasPorCliente = new Map<number, Venta[]>();
  for (const v of ventas) {
    const lista = ventasPorCliente.get(v.cliente_id) ?? [];
    lista.push(v);
    ventasPorCliente.set(v.cliente_id, lista);
  }

  const diasDeCredito = new Map(clientes.map((c) => [c.id, c.dias_credito]));
  const fecha = hoy();
  const cuentas: ConVencimiento<CuentaDeVenta<Venta>>[] = [];
  for (const [clienteId, lista] of ventasPorCliente) {
    cuentas.push(...conVencimiento(aplicarPagos(lista, pagadoPorCliente.get(clienteId) ?? 0), diasDeCredito.get(clienteId) ?? 7, fecha));
  }
  const ordenar = (a: Venta, b: Venta) => b.fecha.localeCompare(a.fecha) || b.id - a.id;
  // Por lo que vence antes: la más atrasada arriba, después la que vence hoy, mañana…; a igual plazo, la de más pendiente.
  const porPagar = cuentas.filter((c) => c.estado !== "pagada").sort((a, b) => b.atraso - a.atraso || b.pendiente_usd - a.pendiente_usd);
  const pagadas = cuentas.filter((c) => c.estado === "pagada").sort(ordenar);
  const totalPendiente = redondear(porPagar.reduce((s, c) => s + c.pendiente_usd, 0));
  const totalVencido = redondear(porPagar.filter((c) => c.vencida).reduce((s, c) => s + c.pendiente_usd, 0));

  // Quién te debe, en el mismo orden: a cada cliente, lo que debe, lo vencido y la nota que le vence antes.
  const rotuloDe = new Map(clientes.map((c) => [c.id, c.rotulo]));
  const porCliente = new Map<number, { cliente_id: number; rotulo: string; saldo_usd: number; vencido_usd: number; notas: number; urgencia: number | null }>();
  for (const c of porPagar) {
    const d = porCliente.get(c.cliente_id) ?? { cliente_id: c.cliente_id, rotulo: rotuloDe.get(c.cliente_id) ?? c.cliente_nombre, saldo_usd: 0, vencido_usd: 0, notas: 0, urgencia: null };
    d.saldo_usd = redondear(d.saldo_usd + c.pendiente_usd);
    if (c.vencida) d.vencido_usd = redondear(d.vencido_usd + c.pendiente_usd);
    d.notas += 1;
    d.urgencia = d.urgencia === null ? c.atraso : Math.max(d.urgencia, c.atraso);
    porCliente.set(c.cliente_id, d);
  }
  const deudores = [...porCliente.values()].sort(porUrgencia);

  // «Recordar» va por /admin/recordar/[id], que arma el mensaje con las notas y deja anotado el día. Solo con teléfono.
  const puedeRecordar = new Map(clientes.map((c) => [c.id, c.saldo_usd > 0 && enlaceWhatsappA(c.telefono, "") !== null]));

  return (
    <>
      <h1 className={estilos.titulo}>Lo que te deben</h1>

      <dl className={estilos.cifras}>
        <div className={`${estilos.cifra} ${totalPendiente > 0 ? estilos["cifra--alerta"] : ""}`}>
          <dt>Te deben</dt>
          <dd>{usd(totalPendiente)}</dd>
        </div>
        <div className={`${estilos.cifra} ${totalVencido > 0 ? estilos["cifra--alerta"] : ""}`}>
          <dt>Con el plazo vencido</dt>
          <dd>{usd(totalVencido)}</dd>
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
        <h2 className={estilos.subtitulo}>Quién te debe</h2>
        <p className={estilos.ayuda}>Por lo que vence antes: arriba el más atrasado; después, el que vence hoy, mañana…</p>
        {deudores.length === 0 ? (
          <p className="vacio">Nadie debe nada.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th className="numero">Debe</th>
                  <th className="numero">Vencido</th>
                  <th>Plazo más cercano</th>
                  <th>
                    <span className="visualmente-oculto">Recordar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {deudores.map((d) => (
                  <tr key={d.cliente_id}>
                    <td data-label="Cliente">
                      <Link href={`/admin/clientes/${d.cliente_id}`}>{d.rotulo}</Link>
                      <span className="ayuda"> · {d.notas === 1 ? "1 nota" : `${d.notas} notas`}</span>
                    </td>
                    <td data-label="Debe" className={`numero ${estilos.deuda}`}>{usd(d.saldo_usd)}</td>
                    <td data-label="Vencido" className={`numero ${d.vencido_usd > 0 ? estilos.vencida : ""}`}>{d.vencido_usd > 0 ? usd(d.vencido_usd) : "—"}</td>
                    <td data-label="Plazo más cercano">
                      <span className={d.vencido_usd > 0 ? estilos.vencida : "ayuda"}>{describirUrgencia(d.urgencia)}</span>
                    </td>
                    <td>
                      {puedeRecordar.get(d.cliente_id) ? (
                        <a href={`/admin/recordar/${d.cliente_id}`} target="_blank" rel="noopener" className={estilos.whatsapp}>
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
        <h2 className={estilos.subtitulo}>Notas que te deben</h2>
        {porPagar.length === 0 ? (
          <p className="vacio">Nadie debe nada.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th className="numero">Total</th>
                  <th className="numero">Pendiente</th>
                  <th>Estado</th>
                  <th>Vence</th>
                  <th>
                    <span className="visualmente-oculto">Recordar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {porPagar.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Fecha">{fechaCorta(c.fecha)}</td>
                    <td data-label="Cliente">
                      <Link href={`/admin/clientes/${c.cliente_id}`}>{c.cliente_nombre}</Link>
                    </td>
                    <td data-label="Total" className="numero">{usd(c.total_usd)}</td>
                    <td data-label="Pendiente" className={`numero ${estilos.deuda}`}>{usd(c.pendiente_usd)}</td>
                    <td data-label="Estado">
                      <span className={`${estilos.estado} ${estilos[`estado--${c.estado}`]}`}>
                        {NOMBRE_ESTADO[c.estado]}
                      </span>
                    </td>
                    <td data-label="Vence">
                      <span className={c.vencida ? estilos.vencida : undefined}>{describirVencimiento(c.atraso)}</span>
                    </td>
                    <td>
                      {puedeRecordar.get(c.cliente_id) ? (
                        <a href={`/admin/recordar/${c.cliente_id}`} target="_blank" rel="noopener" className={estilos.whatsapp}>
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
        <h2 className={estilos.subtitulo}>Notas ya pagadas</h2>
        {pagadas.length === 0 ? (
          <p className="vacio">Todavía no hay ninguna cuenta pagada.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
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
                    <td data-label="Fecha">{fechaCorta(c.fecha)}</td>
                    <td data-label="Cliente">
                      <Link href={`/admin/clientes/${c.cliente_id}`}>{c.cliente_nombre}</Link>
                    </td>
                    <td data-label="Total" className="numero">{usd(c.total_usd)}</td>
                    <td data-label="Nota">{c.nota || "—"}</td>
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
