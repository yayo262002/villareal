import Link from "next/link";
import { listarClientes, resumenDeudas } from "@/lib/clientes";
import { clientesConVencimiento, proveedoresConVencimiento } from "@/lib/vencimientos";
import { describirVencimiento } from "@/lib/credito";
import { cierreDelDia } from "@/lib/caja";
import { listarPagos, totalCobradoUsd } from "@/lib/pagos";
import { contarVentasPorEntregar, listarVentas, totalVendidoUsd, vendidoDesde } from "@/lib/ventas";
import { numeroDeNota } from "@/lib/entregas";
import { METODOS_PAGO, fechaCorta, formatearMonto, hoy, mesLegible, redondear, usd } from "@/lib/dinero";
import { listarCopiasNube } from "@/lib/copias-nube";
import { leerTasa } from "@/lib/ajustes";
import { negocio } from "@/config/negocio";
import { enlaceWhatsappA, mensajeRecordatorio } from "@/lib/whatsapp";
import { copiarAhora } from "@/lib/acciones";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "./panel.module.css";

export const metadata = { title: "Resumen" };

export default async function PaginaResumen({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const mes = hoy().slice(0, 7);
  const [clientes, deudas, ultimasVentas, ultimosPagos, vendido, cobrado, copiasNube, tasa, porEntregar, vendidoEsteMes, conVencimiento, proveedores] =
    await Promise.all([
      listarClientes(),
      resumenDeudas(),
      listarVentas(5),
      listarPagos(5),
      totalVendidoUsd(),
      totalCobradoUsd(),
      listarCopiasNube(),
      leerTasa(),
      contarVentasPorEntregar(),
      vendidoDesde(`${mes}-01`),
      clientesConVencimiento(),
      proveedoresConVencimiento(),
    ]);
  const hoyCierre = await cierreDelDia(hoy());
  // Quien debe: primero los que ya pasaron su plazo, con el más atrasado arriba.
  const deudores = conVencimiento
    .filter((c) => c.saldo_usd > 0)
    .sort((a, b) => b.vencido_usd - a.vencido_usd || b.mayor_atraso - a.mayor_atraso || b.saldo_usd - a.saldo_usd);
  const vencido = redondear(deudores.reduce((s, c) => s + c.vencido_usd, 0));
  const acreedores = proveedores.filter((p) => p.saldo_usd > 0).sort((a, b) => b.vencido_usd - a.vencido_usd || b.saldo_usd - a.saldo_usd);
  const debo = redondear(acreedores.reduce((s, p) => s + p.saldo_usd, 0));
  // Recordatorio corto (solo el saldo); el detalle de las notas está en la ficha.
  const recordatorio = (c: (typeof deudores)[number]) =>
    enlaceWhatsappA(
      c.telefono,
      mensajeRecordatorio({ negocio: negocio.nombre, cliente: c.nombre, saldo_usd: c.saldo_usd, pendientes: [], tasa: tasa?.valor }),
    );

  return (
    <>
      <h1 className={estilos.titulo}>Resumen</h1>
      <Avisos parametros={parametros} />

      <nav aria-label="Lo que más se hace" className={estilos.atajos}>
        <Link href="/admin/clientes" className="boton">
          Cliente nuevo
        </Link>
        <Link href="/admin/ventas" className="boton">
          Anotar venta
        </Link>
        <Link href="/admin/pagos" className="boton">
          Registrar abono
        </Link>
        <Link href="/admin/despacho" className="boton boton--acento">
          Ruta de despacho
        </Link>
      </nav>

      <section className={`tarjeta ${estilos.hoy}`}>
        <div className={estilos.encabezado}>
          <h2 className={estilos.subtitulo} style={{ marginBottom: 0 }}>
            Hoy, {fechaCorta(hoy())}
          </h2>
          <Link href="/admin/caja">Cierre del día</Link>
        </div>
        <dl className={estilos.hoyCifras}>
          <div>
            <dt>Vendido</dt>
            <dd>{usd(hoyCierre.ventas.total_usd)}</dd>
          </div>
          <div>
            <dt>Entró</dt>
            <dd>{usd(hoyCierre.cobrado.total_usd)}</dd>
          </div>
          <div>
            <dt>Salió</dt>
            <dd>{usd(hoyCierre.pagado_a_proveedores.total_usd)}</dd>
          </div>
        </dl>
      </section>

      <dl className={`${estilos.cifras} ${estilos["cifras--seis"]}`}>
        <div className={estilos.cifra}>
          <dt>Clientes</dt>
          <dd>
            <Link href="/admin/clientes">{clientes.length}</Link>
          </dd>
        </div>
        <div className={`${estilos.cifra} ${porEntregar > 0 ? estilos["cifra--alerta"] : ""}`}>
          <dt>Pedidos por entregar</dt>
          <dd>
            <Link href="/admin/despacho">{porEntregar}</Link>
          </dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Vendido en {mesLegible(mes).toLowerCase()}</dt>
          <dd>{usd(vendidoEsteMes)}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Vendido en total</dt>
          <dd>{usd(vendido)}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Cobrado</dt>
          <dd>{usd(cobrado)}</dd>
        </div>
        <div className={`${estilos.cifra} ${deudas.total_por_cobrar_usd > 0 ? estilos["cifra--alerta"] : ""}`}>
          <dt>Me deben</dt>
          <dd>{usd(deudas.total_por_cobrar_usd)}</dd>
        </div>
        <div className={`${estilos.cifra} ${vencido > 0 ? estilos["cifra--alerta"] : ""}`}>
          <dt>Con el plazo vencido</dt>
          <dd>{usd(vencido)}</dd>
        </div>
        <div className={`${estilos.cifra} ${debo > 0 ? estilos["cifra--alerta"] : ""}`}>
          <dt>Debo a proveedores</dt>
          <dd>
            <Link href="/admin/proveedores">{usd(debo)}</Link>
          </dd>
        </div>
      </dl>

      <div className={estilos.dosColumnas}>
        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Quién debe</h2>
          {deudores.length === 0 ? (
            <p className="vacio">Nadie debe nada.</p>
          ) : (
            <div className="tabla-envoltorio">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th className="numero">Debe</th>
                    <th>Plazo</th>
                    <th>
                      <span className="visualmente-oculto">Recordar</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {deudores.slice(0, 8).map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/admin/clientes/${c.id}`}>{c.nombre}</Link>
                      </td>
                      <td className={`numero ${c.vencido_usd > 0 ? estilos.vencida : estilos.deuda}`}>{usd(c.saldo_usd)}</td>
                      <td>
                        {c.vencido_usd > 0 ? (
                          <span className={estilos.vencida}>{describirVencimiento(c.mayor_atraso)}</span>
                        ) : c.proximo_vencimiento ? (
                          <span className="ayuda">Vence el {fechaCorta(c.proximo_vencimiento)}</span>
                        ) : (
                          ""
                        )}
                      </td>
                      <td>
                        {recordatorio(c) && (
                          <a href={recordatorio(c)!} target="_blank" rel="noopener" className={estilos.whatsapp}>
                            Recordar
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {deudores.length > 8 && (
                <p className={estilos.ayuda}>
                  <Link href="/admin/cuentas">Ver todas las cuentas por pagar</Link>
                </p>
              )}
            </div>
          )}
        </section>

        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>A quién le debo</h2>
          {acreedores.length === 0 ? (
            <p className="vacio">
              No debes nada a ningún proveedor. <Link href="/admin/proveedores">Ver proveedores</Link>.
            </p>
          ) : (
            <div className="tabla-envoltorio">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th className="numero">Le debo</th>
                    <th>Plazo</th>
                  </tr>
                </thead>
                <tbody>
                  {acreedores.slice(0, 8).map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/admin/proveedores/${p.id}`}>{p.nombre}</Link>
                      </td>
                      <td className={`numero ${p.vencido_usd > 0 ? estilos.vencida : estilos.deuda}`}>{usd(p.saldo_usd)}</td>
                      <td>
                        {p.vencido_usd > 0 ? (
                          <span className={estilos.vencida}>{describirVencimiento(p.mayor_atraso)}</span>
                        ) : p.proximo_vencimiento ? (
                          <span className="ayuda">Vence el {fechaCorta(p.proximo_vencimiento)}</span>
                        ) : (
                          ""
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
          <h2 className={estilos.subtitulo}>Últimos abonos</h2>
          {ultimosPagos.length === 0 ? (
            <p className="vacio">
              Todavía no hay abonos. <Link href="/admin/pagos">Registrar el primero</Link>.
            </p>
          ) : (
            <div className="tabla-envoltorio">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Método</th>
                    <th className="numero">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimosPagos.map((p) => (
                    <tr key={p.id}>
                      <td>{fechaCorta(p.fecha)}</td>
                      <td>
                        <Link href={`/admin/clientes/${p.cliente_id}`}>{p.cliente_nombre}</Link>
                      </td>
                      <td>{METODOS_PAGO[p.metodo]}</td>
                      <td className="numero">{formatearMonto(p.monto, p.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Últimas ventas</h2>
        {ultimasVentas.length === 0 ? (
          <p className="vacio">
            Todavía no hay ventas. <Link href="/admin/ventas">Registrar la primera</Link>.
          </p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nota</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th className="numero">Total</th>
                </tr>
              </thead>
              <tbody>
                {ultimasVentas.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/admin/ventas/${v.id}/nota`}>{numeroDeNota(v.id)}</Link>
                    </td>
                    <td>{fechaCorta(v.fecha)}</td>
                    <td>
                      <Link href={`/admin/clientes/${v.cliente_id}`}>{v.cliente_nombre}</Link>
                    </td>
                    <td className="numero">{usd(v.total_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Copias de seguridad</h2>
        <p className={estilos.ayuda}>
          Todo lo que registras, fotos incluidas, cabe en un solo archivo. Cada noche se guarda una
          copia en la nube (se conservan las últimas 14). Descarga una de vez en cuando y guárdala en
          Drive o en otro teléfono: con ese archivo se recupera todo.
        </p>
        <div className={estilos.accionesFila}>
          <a href="/admin/copia" download className="boton boton--secundario">
            Descargar copia de ahora
          </a>
          <form action={copiarAhora}>
            <button type="submit" className="boton boton--secundario">
              Guardar copia en la nube
            </button>
          </form>
        </div>
        {copiasNube.length > 0 && (
          <ul className={estilos.copias}>
            {copiasNube.map((c) => (
              <li key={c.id}>
                <span>
                  {fechaCorta(c.creado_en)} {c.creado_en.slice(11, 16)} · {Math.round(c.tamano / 1024)} KB
                </span>
                <a href={`/admin/copias/${c.id}`} download>
                  Descargar
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
