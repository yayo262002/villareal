import Link from "next/link";
import { existencias, listarAjustes } from "@/lib/inventario";
import { crearEnlaceDeExistencias, guardarAjusteDeInventario, ponerStockNegativo } from "@/lib/acciones";
import { enlaceDeExistencias, permitirStockNegativo } from "@/lib/ajustes";
import { negocio } from "@/config/negocio";
import { cantidad, fechaCorta, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";
import { exigirPanel } from "@/lib/panel";

export const metadata = { title: "Inventario" };

const NOMBRE_DE_ESTADO = { sin_seguir: "Sin seguir", sin: "Sin existencia", poco: "Queda poco", bien: "Bien" } as const;

/**
 * El inventario: lo que hay de cada producto y marca, cuánto se compró y
 * se vendió, cuántas piezas serían y cuántos días dura al ritmo de los
 * últimos 30. Entra con las compras (sus líneas de producto), sale con cada
 * venta y se corrige aquí con un recuento o una merma.
 */
export default async function PaginaInventario({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  await exigirPanel();
  const parametros = await searchParams;
  const [lista, ajustes, sinTope, enlace] = await Promise.all([existencias(), listarAjustes(15), permitirStockNegativo(), enlaceDeExistencias()]);
  const seguidos = lista.filter((e) => e.seguido);
  const direccion = enlace ? `${negocio.web}/existencias/${enlace}` : null;
  const mensaje = direccion
    ? `Hola, este es el enlace para ver lo que hay en la tienda, al día con las ventas: ${direccion}\nGuárdalo en la pantalla de inicio del teléfono y ábrelo antes de ofrecer.`
    : "";
  const avisan = seguidos.filter((e) => e.estado === "sin" || e.estado === "poco");

  return (
    <>
      <h1 className={estilos.titulo}>Inventario</h1>
      <Avisos parametros={parametros} />

      <p className={estilos.ayuda}>
        Entra con cada compra a un proveedor (sus kilos por producto), sale con cada venta y se corrige con un recuento o una merma. Un producto
        se empieza a seguir con su primera compra o su primer recuento.
      </p>
      <div className={estilos.accionesFila} style={{ flexWrap: "wrap", marginBottom: "var(--espacio-4)" }}>
        <Link href="/admin/inventario/contar" className="boton">
          Contar todo
        </Link>
        <a href="#vendedora" className="boton boton--secundario">
          Lo que ve la vendedora
        </a>
      </div>
      {seguidos.length === 0 && (
        <p className="aviso aviso--aviso">
          Todavía no se ha contado nada: el inventario no sabe lo que hay. Empieza por «Contar todo» (cuenta la cava y los estantes y escribe cada
          cosa); desde ahí, las ventas lo descuentan solas y las compras lo suben.
        </p>
      )}
      <form action={ponerStockNegativo} className={`${estilos.accionesFila} ${estilos.noImprimir}`} style={{ flexWrap: "wrap", alignItems: "center", marginBottom: "var(--espacio-4)" }}>
        <input type="hidden" name="permitir" value={sinTope ? "0" : "1"} />
        <span className="ayuda">
          La caja {sinTope ? "puede vender aunque el inventario diga que no hay" : "no vende más de lo que hay en inventario"}.
        </span>
        <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
          {sinTope ? "No vender sin existencia" : "Permitir vender sin existencia"}
        </button>
      </form>

      {avisan.length > 0 && (
        <p className="aviso aviso--aviso">
          {avisan.map((e) => `${e.nombre}: ${e.estado === "sin" ? "sin existencia" : `queda poco (${cantidad(e.existencia, e.unidad)}, para unos ${e.diasQueDura} días)`}`).join(". ")}.
        </p>
      )}

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Existencias</h2>
        <div className="tabla-envoltorio">
          <table className="tabla tabla--fichas">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="numero">Existencia</th>
                <th>Estado</th>
                <th className="numero">Comprado</th>
                <th className="numero">Vendido</th>
                <th className="numero">Ajustes</th>
                <th className="numero">Vendido 30 días</th>
                <th>Dura</th>
                <th className="numero">Último costo</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.clave} className={e.seguido ? undefined : estilos.filaApagada}>
                  <td data-label="Producto">
                    <strong>{e.nombre}</strong>
                    {e.pesoPorPieza && <span className="ayuda"> · {cantidad(e.pesoPorPieza.peso, "kg")} por pieza</span>}
                  </td>
                  <td data-label="Existencia" className="numero">
                    {e.seguido ? (
                      <strong className={e.existencia <= 0 ? estilos.vencida : undefined}>
                        {cantidad(e.existencia, e.unidad)}
                        {e.piezas !== null ? ` (~${e.piezas} ${e.piezas === 1 ? "pieza" : "piezas"})` : ""}
                      </strong>
                    ) : (
                      <span className="ayuda">—</span>
                    )}
                  </td>
                  <td data-label="Estado">
                    <span className={`${estilos.estado} ${e.estado === "bien" ? estilos["estado--pagada"] : e.estado === "poco" ? estilos["estado--parcial"] : e.estado === "sin" ? estilos["estado--por_pagar"] : ""}`}>
                      {NOMBRE_DE_ESTADO[e.estado]}
                    </span>
                  </td>
                  <td data-label="Comprado" className="numero" data-vacio={e.comprado ? undefined : ""}>{cantidad(e.comprado, e.unidad)}</td>
                  <td data-label="Vendido" className="numero">{cantidad(e.vendido, e.unidad)}</td>
                  <td data-label="Ajustes" className="numero" data-vacio={e.ajustado ? undefined : ""}>{`${e.ajustado > 0 ? "+" : ""}${cantidad(e.ajustado, e.unidad)}`}</td>
                  <td data-label="Vendido 30 días" className="numero">{cantidad(e.vendidoReciente, e.unidad)}</td>
                  <td data-label="Dura" data-vacio={e.diasQueDura === null ? "" : undefined}>{e.diasQueDura === null ? "—" : `unos ${e.diasQueDura} días`}</td>
                  <td data-label="Último costo" className="numero" data-vacio={e.ultimoCosto === null ? "" : undefined}>{e.ultimoCosto === null ? "—" : usd(e.ultimoCosto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={estilos.ayuda} style={{ marginTop: "var(--espacio-3)", marginBottom: 0 }}>
          Las compras con sus kilos se anotan en la ficha de cada <Link href="/admin/proveedores">proveedor</Link>. «Dura» sale de lo vendido en los
          últimos 30 días.
        </p>
      </section>

      <section className="tarjeta" id="vendedora" style={{ marginBottom: "var(--espacio-4)" }}>
        <h2 className={estilos.subtitulo}>Lo que ve la vendedora</h2>
        {direccion ? (
          <>
            <p className={estilos.ayuda}>
              Con este enlace ve desde su teléfono, sin clave, lo que hay de cada producto de la web, al día con las ventas: cuánto hay, si queda
              poco, si se acabó o si no se ha contado. Sin costos ni nada más del panel.
            </p>
            <p>
              <a href={`/existencias/${enlace}`} target="_blank" rel="noopener" style={{ overflowWrap: "anywhere" }}>
                {direccion}
              </a>
            </p>
            <div className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
              <a href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} className="boton" target="_blank" rel="noopener">
                Mandarlo por WhatsApp
              </a>
              <form action={crearEnlaceDeExistencias}>
                <input type="hidden" name="renovar" value="1" />
                <button type="submit" className="boton boton--secundario">
                  Renovar el enlace
                </button>
              </form>
            </div>
            <p className={estilos.ayuda}>
              Puesto en la pantalla de inicio es una app, «Lo que hay». Si se compartió de más, «Renovar» pone otro y el anterior deja de funcionar.
            </p>
          </>
        ) : (
          <form action={crearEnlaceDeExistencias}>
            <p className={estilos.ayuda}>
              Crea el enlace y mándaselo a la vendedora: con él ve en su teléfono lo que hay para ofrecer, sin clave y sin costos.
            </p>
            <button type="submit" className="boton">
              Crear el enlace
            </button>
          </form>
        )}
      </section>

      <div className={estilos.dosColumnas}>
        <section className="tarjeta" id="ajuste">
          <h2 className={estilos.subtitulo}>Recuento o merma</h2>
          <p className={estilos.ayuda}>
            Contaste y hay otra cosa, se perdió algo, o entró algo sin compra: anótalo aquí y la existencia se corrige.
          </p>
          <form action={guardarAjusteDeInventario} className="formulario">
            <div className="campo">
              <label htmlFor="ajuste-clave">Producto</label>
              <select id="ajuste-clave" name="clave" required defaultValue="">
                <option value="" disabled>
                  Elige un producto
                </option>
                {lista.map((e) => (
                  <option key={e.clave} value={e.clave}>
                    {e.nombre}
                    {e.seguido ? ` (hay ${cantidad(e.existencia, e.unidad)})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="formulario__fila">
              <div className="campo">
                <label htmlFor="ajuste-tipo">Qué pasó</label>
                <select id="ajuste-tipo" name="tipo" required defaultValue="recuento">
                  <option value="recuento">Conté y tengo esta cantidad</option>
                  <option value="merma">Se perdió o se dañó esta cantidad</option>
                  <option value="entrada">Entró esta cantidad sin compra</option>
                </select>
              </div>
              <div className="campo">
                <label htmlFor="ajuste-cantidad">Cantidad (kilos, cartones o unidades)</label>
                <input id="ajuste-cantidad" name="cantidad" type="number" inputMode="decimal" step="0.001" min="0" required />
              </div>
            </div>
            <div className="campo">
              <label htmlFor="ajuste-motivo">Motivo</label>
              <input id="ajuste-motivo" name="motivo" type="text" placeholder="Recuento del sábado · Se dañó una pieza" />
            </div>
            <div>
              <button type="submit" className="boton">
                Anotar
              </button>
            </div>
          </form>
        </section>

        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Últimos recuentos y mermas</h2>
          {ajustes.length === 0 ? (
            <p className="vacio">Todavía ninguno.</p>
          ) : (
            <div className="tabla-envoltorio">
              <table className="tabla tabla--fichas">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th className="numero">Cambio</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {ajustes.map((a) => (
                    <tr key={a.id}>
                      <td data-label="Fecha">{fechaCorta(a.fecha)}</td>
                      <td data-label="Producto">{a.producto_nombre}</td>
                      <td data-label="Cambio" className={`numero ${a.cantidad < 0 ? estilos.vencida : ""}`}>{`${a.cantidad > 0 ? "+" : ""}${cantidad(a.cantidad, a.unidad)}`}</td>
                      <td data-label="Motivo" data-vacio={a.motivo ? undefined : ""}>{a.motivo || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
