import Link from "next/link";
import { negocio } from "@/config/negocio";
import { exigirPanel } from "@/lib/panel";
import { repartoDelMes, primerMesConVentas } from "@/lib/reparto";
import { PARTES_MAXIMAS, margenSobreElCosto, mensajeDelReparto, puntosEnTexto } from "@/lib/reparto-calculo";
import { partesDelReparto } from "@/lib/ajustes";
import { anotarDescuentoDelReparto, guardarPartesDelReparto, quitarDescuentoDelReparto } from "@/lib/acciones";
import { mesDe } from "@/lib/factura-calculo";
import { hoy, mesLegible, usd, usdConSigno } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Reparto del mes" };

/** Los meses desde el primero con ventas hasta el de hoy, el más nuevo primero. */
function mesesDesde(primero: string | null, hasta: string): string[] {
  const meses: string[] = [];
  let [a, m] = hasta.split("-").map(Number);
  const tope = primero ?? hasta;
  while (meses.length < 120) {
    const mes = `${a}-${String(m).padStart(2, "0")}`;
    meses.push(mes);
    if (mes <= tope) break;
    m--;
    if (m === 0) {
      m = 12;
      a--;
    }
  }
  return meses;
}

const pct = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("es-VE", { maximumFractionDigits: 1 })} %`);

/**
 * El reparto del mes (el dueño, 18/11/2026): la ganancia de lo cobrado en un mes, que es lo cobrado menos lo que
 * costaba la mercancía el día de cada venta, menos lo que se paga antes (la comisión de la vendedora), repartida por
 * puntos entre el fondo de previsión, la cuota del préstamo y los socios; y el resumen para mandárselo al hermano por
 * WhatsApp. Las cuentas, con pruebas, en `reparto-calculo.ts`.
 */
export default async function PaginaReparto({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  await exigirPanel();
  const parametros = await searchParams;
  const mesDeHoy = mesDe(hoy());
  const pedido = typeof parametros.mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(parametros.mes) ? parametros.mes : mesDeHoy;
  const mes = pedido > mesDeHoy ? mesDeHoy : pedido;
  const [r, partes, primero] = await Promise.all([repartoDelMes(mes), partesDelReparto(), primerMesConVentas()]);
  const meses = mesesDesde(primero && primero < mes ? primero : mes, mesDeHoy);
  const mensaje = mensajeDelReparto(r, mesLegible(mes), negocio.nombreCorto);
  const filasDePartes = Array.from({ length: PARTES_MAXIMAS }, (_, i) => partes[i] ?? null);
  const gananciaCobrada = r.cobrado.ganancia;
  const margenCobrado = margenSobreElCosto(r.cobrado.ganancia, r.cobrado.costo);

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 className={estilos.titulo}>Reparto del mes</h1>
      </div>
      <Avisos parametros={parametros} />
      <p className="ayuda">
        La ganancia de lo <strong>cobrado</strong> en el mes: lo que pagaron los clientes menos lo que costaba la mercancía <strong>el día de cada venta</strong>.
        Primero se resta lo que se paga antes (la comisión de la vendedora) y lo que queda se reparte por puntos: con 2 de 10, a esa parte le tocan 2 de cada 10
        dólares de la ganancia, deje el producto un 5 % o un 15 %. Lo vendido y aún no cobrado entra en el mes en que se cobre.
      </p>

      <section className="tarjeta">
        <form method="get" action="/admin/reparto" className={estilos.buscador} role="search">
          <label htmlFor="mes">Mes</label>
          <select id="mes" name="mes" defaultValue={mes}>
            {meses.map((m) => (
              <option key={m} value={m}>
                {mesLegible(m)}
              </option>
            ))}
          </select>
          <button type="submit" className="boton boton--secundario">
            Ver
          </button>
        </form>

        <dl className={estilos.cifras}>
          <div className={estilos.cifra}>
            <dt>Vendido en el mes</dt>
            <dd>{usd(r.vendido.total)}</dd>
            <div className={estilos.cifraNota}>{r.vendido.notas === 1 ? "1 nota" : `${r.vendido.notas} notas`}</div>
          </div>
          <div className={estilos.cifra}>
            <dt>Cobrado en el mes</dt>
            <dd>{usd(r.cobrado.total)}</dd>
            <div className={estilos.cifraNota}>{r.cobrado.abonos === 1 ? "1 abono" : `${r.cobrado.abonos} abonos`}</div>
          </div>
          <div className={estilos.cifra}>
            <dt>Ganancia de lo cobrado</dt>
            <dd>{usdConSigno(gananciaCobrada)}</dd>
            <div className={estilos.cifraNota}>{margenCobrado === null ? "Sin costo guardado" : `Deja un ${pct(margenCobrado)} sobre el costo`}</div>
          </div>
          <div className={`${estilos.cifra} ${r.aRepartir < 0 ? estilos["cifra--alerta"] : ""}`}>
            <dt>A repartir</dt>
            <dd>{usd(Math.max(0, r.aRepartir))}</dd>
            {r.totalDescuentos > 0 && <div className={estilos.cifraNota}>Después de restar {usd(r.totalDescuentos)}</div>}
          </div>
        </dl>
      </section>

      {r.cobrado.sinCosto > 0 && (
        <p className="aviso aviso--aviso">
          {usd(r.cobrado.sinCosto)} de lo cobrado este mes son de ventas <strong>sin costo guardado</strong> y no entran en la ganancia: las anotadas antes del
          18/11/2026, cuando la venta aún no guardaba su costo, o de un producto sin costo en Productos. No se estima: es mejor que falte a que se reparta de más.
        </p>
      )}

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Lo que le toca a cada uno</h2>
        {r.aRepartir <= 0 ? (
          <p className="vacio">
            {r.aRepartir < 0
              ? `Este mes lo que se paga antes (${usd(r.totalDescuentos)}) es más que la ganancia cobrada (${usd(gananciaCobrada)}): no queda nada para repartir.`
              : "Este mes todavía no hay ganancia cobrada para repartir."}
          </p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Parte</th>
                  <th className="numero">Puntos</th>
                  <th className="numero">Le toca</th>
                </tr>
              </thead>
              <tbody>
                {r.partes.map((p) => (
                  <tr key={p.nombre}>
                    <td data-label="Parte">{p.nombre}</td>
                    <td data-label="Puntos" className="numero">
                      {puntosEnTexto(p.puntos)} de {puntosEnTexto(r.puntos)}
                    </td>
                    <td data-label="Le toca" className="numero">
                      <strong>{usd(p.monto)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ marginTop: "var(--espacio-4)" }}>
          <a href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} className="boton" target="_blank" rel="noopener">
            Mandar el resumen por WhatsApp
          </a>
        </p>
        <details style={{ marginTop: "var(--espacio-3)" }}>
          <summary className="ayuda">Ver el mensaje</summary>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14, marginTop: "var(--espacio-2)" }}>{mensaje}</pre>
        </details>
      </section>

      <section className="tarjeta" id="antes">
        <h2 className={estilos.subtitulo}>Lo que se paga antes de repartir</h2>
        <p className="ayuda">
          Lo que sale de la ganancia de {mesLegible(mes)} antes del reparto: la comisión de la vendedora, por ejemplo. Se resta de la ganancia cobrada y se reparte
          lo que queda.
        </p>
        {r.descuentos.length > 0 && (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Qué es</th>
                  <th className="numero">Monto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {r.descuentos.map((d) => (
                  <tr key={d.id}>
                    <td data-label="Qué es">{d.concepto}</td>
                    <td data-label="Monto" className="numero">
                      {usd(d.monto_usd)}
                    </td>
                    <td data-label="">
                      <form action={quitarDescuentoDelReparto}>
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="mes" value={mes} />
                        <button type="submit" className="boton boton--secundario">
                          Quitar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form action={anotarDescuentoDelReparto} className="formulario" style={{ marginTop: "var(--espacio-3)" }}>
          <input type="hidden" name="mes" value={mes} />
          <div className="campo">
            <label htmlFor="concepto">Qué es</label>
            <input id="concepto" name="concepto" type="text" maxLength={80} placeholder="Comisión de Marisol" required />
          </div>
          <div className="campo" style={{ maxWidth: 240 }}>
            <label htmlFor="monto_usd">Monto en dólares</label>
            <input id="monto_usd" name="monto_usd" type="text" inputMode="decimal" placeholder="25,00" required />
          </div>
          <button type="submit" className="boton boton--secundario">
            Anotar en {mesLegible(mes)}
          </button>
        </form>
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Cómo sale la cuenta</h2>
        <dl className="ayuda" style={{ display: "grid", gap: "var(--espacio-2)", fontSize: 15 }}>
          <div>
            <dt>
              <strong>Cobrado en {mesLegible(mes)}: {usd(r.cobrado.total)}</strong>
            </dt>
            <dd style={{ margin: 0 }}>
              De ventas con costo: {usd(r.cobrado.conCosto)}, que costaron {usd(r.cobrado.costo)}: ganancia {usdConSigno(gananciaCobrada)}.
              {r.cobrado.sinCosto > 0 && <> De ventas sin costo guardado: {usd(r.cobrado.sinCosto)} (no cuentan).</>}
              {r.cobrado.aCuenta > 0 && <> A cuenta, sin nota que pagar todavía: {usd(r.cobrado.aCuenta)} (no es ganancia hasta que se venda).</>}
            </dd>
          </div>
          <div>
            <dt>
              <strong>Vendido en {mesLegible(mes)}: {usd(r.vendido.total)}</strong>
            </dt>
            <dd style={{ margin: 0 }}>
              Lo que tiene costo deja {usdConSigno(r.vendido.ganancia)} en el papel ({pct(margenSobreElCosto(r.vendido.ganancia, r.vendido.costo))} sobre el costo).
              Se reparte cuando se cobra.
            </dd>
          </div>
        </dl>
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Lo que deja cada producto</h2>
        <p className="ayuda">De lo vendido en {mesLegible(mes)}, con el costo del día de cada venta.</p>
        {r.productos.length === 0 ? (
          <p className="vacio">Nada vendido en {mesLegible(mes)} con su costo guardado.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="numero">Vendido</th>
                  <th className="numero">Costó</th>
                  <th className="numero">Ganancia</th>
                  <th className="numero">Sobre el costo</th>
                </tr>
              </thead>
              <tbody>
                {r.productos.map((p) => (
                  <tr key={p.producto}>
                    <td data-label="Producto">{p.producto}</td>
                    <td data-label="Vendido" className="numero">
                      {usd(p.vendido)}
                    </td>
                    <td data-label="Costó" className="numero">
                      {usd(p.costo)}
                    </td>
                    <td data-label="Ganancia" className="numero">
                      {usdConSigno(p.ganancia)}
                    </td>
                    <td data-label="Sobre el costo" className="numero">
                      {pct(margenSobreElCosto(p.ganancia, p.costo))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {r.sinCosto.length > 0 && (
          <p className="ayuda" style={{ marginTop: "var(--espacio-3)" }}>
            Sin costo guardado: {r.sinCosto.map((p) => `${p.producto} (${usd(p.vendido)})`).join(", ")}. Si a un producto le falta el costo, ponlo en{" "}
            <Link href="/admin/productos">Productos</Link> (o únelo a la lista del detal): las ventas siguientes ya lo guardan.
          </p>
        )}
      </section>

      <section className="tarjeta" id="partes">
        <h2 className={estilos.subtitulo}>Las partes y sus puntos</h2>
        <p className="ayuda">
          Valen para todos los meses. Cada parte se lleva sus puntos de cada 10 (o del total que sumen): con 2 de 10, el 20 % de lo que se reparte. Una fila vacía
          no cuenta.
        </p>
        <form action={guardarPartesDelReparto} className="formulario">
          <input type="hidden" name="mes" value={mes} />
          <div className="tabla-envoltorio">
            <table className={estilos.tabla} style={{ maxWidth: 460 }}>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {filasDePartes.map((p, i) => (
                  <tr key={i}>
                    <td>
                      <input name={`nombre_${i}`} type="text" defaultValue={p?.nombre ?? ""} maxLength={40} aria-label={`Fila ${i + 1}: nombre`} style={{ width: "100%" }} />
                    </td>
                    <td>
                      <input
                        name={`puntos_${i}`}
                        type="text"
                        inputMode="decimal"
                        defaultValue={p ? puntosEnTexto(p.puntos) : ""}
                        aria-label={`Fila ${i + 1}: puntos`}
                        style={{ width: "100%" }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="submit" className="boton boton--secundario">
            Guardar las partes
          </button>
        </form>
      </section>
    </>
  );
}
