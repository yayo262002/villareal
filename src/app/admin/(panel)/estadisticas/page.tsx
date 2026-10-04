import Link from "next/link";
import { movimientosEntre } from "@/lib/caja";
import { contarVentasPorEntregar, ventasPorMes } from "@/lib/ventas";
import { clientesConVencimiento } from "@/lib/vencimientos";
import { totalDebidoAProveedores } from "@/lib/proveedores";
import { listarExportaciones } from "@/lib/exportaciones";
import { leerFecha } from "@/lib/exportar";
import {
  PERIODOS,
  esNombreDePeriodo,
  periodoDe,
  porCliente,
  porDia,
  porDiaDeLaSemana,
  porMetodo,
  porProducto,
  resumenDe,
  todosLosMovimientos,
  type NombreDePeriodo,
} from "@/lib/estadisticas";
import { cantidad, fechaCorta, formatearMonto, hoy, mesLegible, redondear, usd, usdConSigno, type Moneda } from "@/lib/dinero";
import estilos from "../panel.module.css";

export const metadata = { title: "Estadísticas" };

/** Cuántos movimientos se enseñan en la lista: para más, el Excel. */
const MOVIMIENTOS_A_LA_VISTA = 300;
/** Hasta cuántos días se dibuja la evolución día a día. */
const DIAS_CON_BARRAS = 62;

type Parametros = Record<string, string | string[] | undefined>;

function texto(p: Parametros, campo: string): string {
  const v = p[campo];
  return typeof v === "string" ? v : "";
}

/** Una barra proporcional, para ver de un vistazo quién pesa más. */
function Barra({ parte }: { parte: number }) {
  return (
    <span className={estilos.barra} aria-hidden="true">
      <span className={estilos.barraRelleno} style={{ width: `${Math.max(2, Math.min(100, parte))}%` }} />
    </span>
  );
}

/**
 * Las estadísticas del negocio: un período a elegir y, de ese período,
 * cuánto se vendió y cobró, de qué, a quién, cómo pagaron, qué días se
 * vende más, la evolución día a día y la lista de absolutamente todos los
 * movimientos. Abajo, las descargas para Excel y las exportaciones que la
 * tarea diaria guarda sola cada mañana.
 */
export default async function PaginaEstadisticas({ searchParams }: { searchParams: Promise<Parametros> }) {
  const parametros = await searchParams;
  const fechaDeHoy = hoy();
  const desdeEscrito = leerFecha(texto(parametros, "desde"));
  const hastaEscrito = leerFecha(texto(parametros, "hasta"));
  const aMedida = Boolean(desdeEscrito || hastaEscrito);
  const nombre: NombreDePeriodo = esNombreDePeriodo(texto(parametros, "periodo")) ? (texto(parametros, "periodo") as NombreDePeriodo) : "mes";
  const periodo = aMedida ? { desde: desdeEscrito, hasta: hastaEscrito } : periodoDe(nombre, fechaDeHoy);

  const [movimientos, meses, clientes, debo, porEntregar, exportaciones] = await Promise.all([
    movimientosEntre(periodo.desde, periodo.hasta),
    ventasPorMes(),
    clientesConVencimiento(fechaDeHoy),
    totalDebidoAProveedores(),
    contarVentasPorEntregar(),
    listarExportaciones(30),
  ]);

  const resumen = resumenDe(movimientos);
  const productos = porProducto(movimientos);
  const porClientes = porCliente(movimientos);
  const metodos = porMetodo(movimientos);
  const semana = porDiaDeLaSemana(movimientos);
  const dias = porDia(movimientos);
  const todos = todosLosMovimientos(movimientos);
  const porCobrar = redondear(clientes.reduce((s, c) => s + Math.max(0, c.saldo_usd), 0));
  const vencido = redondear(clientes.reduce((s, c) => s + c.vencido_usd, 0));
  const quienesDeben = clientes.filter((c) => c.saldo_usd > 0).length;
  const maximoDia = Math.max(1, ...dias.map((d) => d.vendido));
  const maximoSemana = Math.max(1, ...semana.map((d) => d.vendido));
  const maximoMes = Math.max(1, ...meses.map((m) => Number(m.vendido_usd)));
  const maximoCliente = Math.max(1, ...porClientes.map((c) => c.vendido));

  const consulta = aMedida
    ? `desde=${periodo.desde ?? ""}&hasta=${periodo.hasta ?? ""}`
    : `desde=${periodo.desde ?? ""}&hasta=${periodo.hasta ?? ""}`;
  const tituloDelPeriodo = aMedida
    ? `${periodo.desde ? `del ${fechaCorta(periodo.desde)}` : "desde el principio"} ${periodo.hasta ? `al ${fechaCorta(periodo.hasta)}` : "hasta hoy"}`
    : PERIODOS.find(([n]) => n === nombre)?.[1].toLowerCase() ?? "";

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 className={estilos.titulo}>Estadísticas</h1>
        <Link href="#descargas" className="boton boton--secundario">
          Descargar para Excel
        </Link>
      </div>

      {/* El período: de un toque, o escrito. */}
      <div className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
        {PERIODOS.map(([n, etiqueta]) => (
          <Link
            key={n}
            href={`/admin/estadisticas?periodo=${n}`}
            className={`boton ${!aMedida && n === nombre ? "" : "boton--secundario"} ${estilos.botonPequeno}`}
          >
            {etiqueta}
          </Link>
        ))}
      </div>
      <form method="get" action="/admin/estadisticas" className={estilos.periodoAMedida}>
        <div className="campo">
          <label htmlFor="estadisticas-desde">Desde</label>
          <input id="estadisticas-desde" name="desde" type="date" defaultValue={aMedida ? (periodo.desde ?? "") : ""} max={fechaDeHoy} />
        </div>
        <div className="campo">
          <label htmlFor="estadisticas-hasta">Hasta</label>
          <input id="estadisticas-hasta" name="hasta" type="date" defaultValue={aMedida ? (periodo.hasta ?? "") : ""} max={fechaDeHoy} />
        </div>
        <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
          Ver ese período
        </button>
      </form>

      <h2 className={estilos.subtitulo}>
        {aMedida ? `Período ${tituloDelPeriodo}` : nombre === "todo" ? "Todo, desde el principio" : tituloDelPeriodo.charAt(0).toUpperCase() + tituloDelPeriodo.slice(1)}
      </h2>
      <dl className={estilos.cifras}>
        <div className={estilos.cifra}>
          <dt>Vendido</dt>
          <dd>{usd(resumen.vendido)}</dd>
          <dd className={estilos.cifraNota}>
            {resumen.notas} {resumen.notas === 1 ? "nota" : "notas"}
            {resumen.notas > 0 ? ` · ${usd(resumen.ticketMedio)} de media` : ""}
          </dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Cobrado</dt>
          <dd>{usd(resumen.cobrado)}</dd>
          <dd className={estilos.cifraNota}>
            {resumen.abonos} {resumen.abonos === 1 ? "abono" : "abonos"}
          </dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Kilos vendidos</dt>
          <dd>{cantidad(resumen.kilos, "kg")}</dd>
          <dd className={estilos.cifraNota}>
            {resumen.clientesQueCompraron} {resumen.clientesQueCompraron === 1 ? "cliente compró" : "clientes compraron"}
          </dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Entró neto</dt>
          <dd>{usdConSigno(resumen.entroNeto)}</dd>
          <dd className={estilos.cifraNota}>
            comprado {usd(resumen.comprado)} · pagado {usd(resumen.pagadoProveedores)}
          </dd>
        </div>
      </dl>

      <h2 className={estilos.subtitulo}>Hoy, en total</h2>
      <dl className={estilos.cifras}>
        <div className={`${estilos.cifra} ${porCobrar > 0 ? estilos["cifra--deuda"] : ""}`}>
          <dt>Por cobrar</dt>
          <dd>{usd(porCobrar)}</dd>
          <dd className={estilos.cifraNota}>
            {quienesDeben} {quienesDeben === 1 ? "cliente debe" : "clientes deben"}
          </dd>
        </div>
        <div className={`${estilos.cifra} ${vencido > 0 ? estilos["cifra--alerta"] : ""}`}>
          <dt>Con el plazo vencido</dt>
          <dd>{usd(vencido)}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Debo a proveedores</dt>
          <dd>{usd(debo)}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Pedidos por entregar</dt>
          <dd>{porEntregar}</dd>
        </div>
      </dl>

      {dias.length > 0 && dias.length <= DIAS_CON_BARRAS && (
        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Día a día</h2>
          <ol className={estilos.barras}>
            {dias.map((d) => (
              <li key={d.fecha}>
                <span className={estilos.barraRotulo}>{fechaCorta(d.fecha).slice(0, 5)}</span>
                <Barra parte={(d.vendido / maximoDia) * 100} />
                <span className={estilos.barraCifra}>
                  {usd(d.vendido)}
                  {d.cobrado > 0 ? <span className="ayuda"> · cobrado {usd(d.cobrado)}</span> : ""}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className={estilos.dosColumnas}>
        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Por producto</h2>
          {productos.length === 0 ? (
            <p className="vacio">Sin ventas en este período.</p>
          ) : (
            <ol className={estilos.barras}>
              {productos.map((p) => (
                <li key={p.producto}>
                  <span className={estilos.barraRotulo}>{p.producto}</span>
                  <Barra parte={p.parte} />
                  <span className={estilos.barraCifra}>
                    {usd(p.vendido)} <span className="ayuda">· {cantidad(p.cantidad, p.unidad)} · {p.parte} %</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Por cliente</h2>
          {porClientes.length === 0 ? (
            <p className="vacio">Sin ventas ni abonos en este período.</p>
          ) : (
            <ol className={estilos.barras}>
              {porClientes.map((c) => (
                <li key={c.cliente_id}>
                  <span className={estilos.barraRotulo}>
                    <Link href={`/admin/clientes/${c.cliente_id}`}>{c.cliente}</Link>
                  </span>
                  <Barra parte={(c.vendido / maximoCliente) * 100} />
                  <span className={estilos.barraCifra}>
                    {usd(c.vendido)}{" "}
                    <span className="ayuda">
                      · {c.ventas} {c.ventas === 1 ? "nota" : "notas"} · abonó {usd(c.abonado)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className={estilos.dosColumnas}>
        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Cómo pagaron</h2>
          {metodos.length === 0 ? (
            <p className="vacio">Sin abonos en este período.</p>
          ) : (
            <div className="tabla-envoltorio">
              <table className="tabla tabla--fichas">
                <thead>
                  <tr>
                    <th>Método</th>
                    <th className="numero">Abonos</th>
                    <th className="numero">Monto</th>
                    <th className="numero">En USD</th>
                  </tr>
                </thead>
                <tbody>
                  {metodos.map((m) => (
                    <tr key={`${m.metodo}-${m.moneda}`}>
                      <td data-label="Método">{m.nombre}</td>
                      <td data-label="Abonos" className="numero">{m.abonos}</td>
                      <td data-label="Monto" className="numero">{formatearMonto(m.monto, m.moneda as Moneda)}</td>
                      <td data-label="En USD" className="numero">{usd(m.usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Por día de la semana</h2>
          <ol className={estilos.barras}>
            {semana.map((d) => (
              <li key={d.dia}>
                <span className={estilos.barraRotulo}>{d.nombre}</span>
                <Barra parte={(d.vendido / maximoSemana) * 100} />
                <span className={estilos.barraCifra}>
                  {usd(d.vendido)} <span className="ayuda">· {d.ventas} {d.ventas === 1 ? "nota" : "notas"}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Por mes</h2>
        <p className={estilos.ayuda}>
          Todos los meses, sin filtro de período. Lo que se vendió y lo que se cobró a los clientes; lo que se compró y lo que se pagó a los
          proveedores. Cobrado menos pagado es lo que entró de verdad ese mes.
        </p>
        {meses.length === 0 ? (
          <p className="vacio">Todavía no hay ventas ni pagos.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="numero">Ventas</th>
                  <th className="numero">Vendido</th>
                  <th className="numero">Cobrado</th>
                  <th className="numero">Comprado</th>
                  <th className="numero">Pagado a proveedores</th>
                  <th className="numero">Entró neto</th>
                </tr>
              </thead>
              <tbody>
                {meses.map((m) => (
                  <tr key={m.mes}>
                    <td data-label="Mes">
                      <Link href={`/admin/estadisticas?desde=${m.mes}-01&hasta=${m.mes}-31`}>{mesLegible(m.mes)}</Link>
                      <Barra parte={(Number(m.vendido_usd) / maximoMes) * 100} />
                    </td>
                    <td data-label="Ventas" className="numero">{m.ventas}</td>
                    <td data-label="Vendido" className="numero">{usd(Number(m.vendido_usd))}</td>
                    <td data-label="Cobrado" className="numero">{usd(Number(m.cobrado_usd))}</td>
                    <td data-label="Comprado" className="numero">{usd(Number(m.comprado_usd))}</td>
                    <td data-label="Pagado a proveedores" className="numero">{usd(Number(m.pagado_proveedores_usd))}</td>
                    <td data-label="Entró neto" className="numero">{usdConSigno(Number(m.cobrado_usd) - Number(m.pagado_proveedores_usd))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta" id="movimientos">
        <h2 className={estilos.subtitulo}>
          Todos los movimientos{todos.length > MOVIMIENTOS_A_LA_VISTA ? ` (los últimos ${MOVIMIENTOS_A_LA_VISTA} de ${todos.length})` : ` (${todos.length})`}
        </h2>
        <p className={estilos.ayuda}>Cada venta, abono, compra y pago a proveedor del período, del más reciente al más antiguo. Para tenerlos todos en Excel, abajo.</p>
        {todos.length === 0 ? (
          <p className="vacio">Nada en este período.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Quién</th>
                  <th>Detalle</th>
                  <th className="numero">USD</th>
                </tr>
              </thead>
              <tbody>
                {todos.slice(0, MOVIMIENTOS_A_LA_VISTA).map((m) => (
                  <tr key={`${m.tipo}-${m.id}`}>
                    <td data-label="Fecha">{fechaCorta(m.fecha)}</td>
                    <td data-label="Tipo">
                      <span className={`${estilos.estado} ${m.tipo === "Venta" ? estilos["estado--por_pagar"] : m.tipo === "Abono" ? estilos["estado--pagada"] : estilos["estado--parcial"]}`}>
                        {m.tipo}
                      </span>
                    </td>
                    <td data-label="Quién">{m.quien}</td>
                    <td data-label="Detalle">{m.enlace ? <Link href={m.enlace}>{m.detalle}</Link> : m.detalle}</td>
                    <td data-label="USD" className="numero">
                      {m.tipo === "Venta" || m.tipo === "Compra" ? usd(m.usd) : <strong>{usd(m.usd)}</strong>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta" id="descargas">
        <h2 className={estilos.subtitulo}>Descargar para Excel</h2>
        <p className={estilos.ayuda}>
          El período de arriba, o todo desde el principio. Abren en Excel; cada monto en dólares va en su columna para poder sumarlas.
        </p>
        <div className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
          <a href={`/admin/caja/exportar?${consulta}`} download className="boton">
            Movimientos del período
          </a>
          <a href={`/admin/caja/exportar?${consulta}&forma=dias`} download className="boton boton--secundario">
            Resumen por día
          </a>
          <a href="/admin/caja/exportar" download className="boton boton--secundario">
            Todo, desde el principio
          </a>
          <a href="/admin/clientes/exportar" download className="boton boton--secundario">
            Lista de clientes
          </a>
        </div>

        <h3 className={estilos.subtituloPequeno} style={{ marginTop: "var(--espacio-5)" }}>
          Exportaciones diarias
        </h3>
        <p className={estilos.ayuda}>
          Cada mañana a las 6 se guarda sola el Excel con los movimientos del día anterior (se conservan 90 días). Los días sin movimientos no
          tienen archivo. Tu ordenador deja además los suyos cada noche en la carpeta «exportaciones».
        </p>
        {exportaciones.length === 0 ? (
          <p className="vacio">Todavía no hay ninguna: la primera sale mañana a las 6.</p>
        ) : (
          <ul className={estilos.listaDescargas}>
            {exportaciones.map((e) => (
              <li key={e.fecha}>
                <a href={`/admin/exportaciones/${e.fecha}`} download>
                  {fechaCorta(e.fecha)}
                </a>
                <span className="ayuda">
                  {" "}
                  · {e.movimientos} {e.movimientos === 1 ? "movimiento" : "movimientos"} · {Math.max(1, Math.round(e.tamano / 1024))} KB
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
