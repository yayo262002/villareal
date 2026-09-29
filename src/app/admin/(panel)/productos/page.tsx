import { listarProductos } from "@/lib/productos";
import { leerTasa } from "@/lib/ajustes";
import { alternarProducto, cambiarTasa, editarProducto, guardarProducto } from "@/lib/acciones";
import { UNIDADES, aBolivares, bs, fechaCorta, nombreUnidad, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Productos" };

/**
 * Productos y precios. El dueño escribe lo que le cuesta cada producto en
 * dólares y el porcentaje que le suma; el precio de venta sale solo. La web
 * lo publica en bolívares con la tasa del día, que también se pone aquí.
 * Cada producto es una ficha con todo lo suyo y un solo botón de guardar,
 * pensada para el teléfono.
 */
export default async function PaginaProductos({
  searchParams,
}: {
  searchParams: Promise<ParametrosAviso>;
}) {
  const parametros = await searchParams;
  const [productos, tasa] = await Promise.all([listarProductos(), leerTasa()]);
  const sinPrecio = productos.filter((p) => p.activo && p.precio_usd === null);

  const opcionesUnidad = Object.entries(UNIDADES).map(([valor, nombre]) => (
    <option key={valor} value={valor}>
      {nombre}
    </option>
  ));

  return (
    <>
      <h1 className={estilos.titulo}>Productos y precios</h1>
      <Avisos parametros={parametros} />

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Tasa del día</h2>
        <form action={cambiarTasa} className="formulario">
          <div className="campo">
            <label htmlFor="tasa">Bolívares por dólar</label>
            <input
              id="tasa"
              name="tasa"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              required
              defaultValue={tasa?.valor ?? ""}
              placeholder="36,50"
            />
            <span className="ayuda">
              {tasa
                ? `Vigente: ${bs(tasa.valor)} por dólar, puesta el ${fechaCorta(tasa.actualizada_en)}. Al cambiarla cambian todos los precios en bolívares de la web.`
                : "Sin tasa, la web muestra los precios solo en dólares."}
            </span>
          </div>
          <div>
            <button type="submit" className="boton">
              Guardar tasa
            </button>
          </div>
        </form>
      </section>

      {sinPrecio.length > 0 && (
        <p className="aviso aviso--aviso">
          {sinPrecio.length === 1
            ? `«${sinPrecio[0].nombre}» no tiene precio: la web dice «consulta el precio del día».`
            : `${sinPrecio.length} productos no tienen precio: la web dice «consulta el precio del día».`}
        </p>
      )}

      <section className={estilos.listaProductos}>
        {productos.map((p) => {
          const enBs = p.precio_usd !== null ? aBolivares(p.precio_usd, tasa?.valor ?? null) : null;
          return (
            <article key={p.id} className={`tarjeta ${p.activo ? "" : estilos.tarjetaApagada}`}>
              <div className={estilos.encabezado}>
                <h2 className={estilos.subtitulo} style={{ marginBottom: 0 }}>
                  {p.nombre}
                </h2>
                <span className={`${estilos.estado} ${p.activo ? estilos["estado--pagada"] : estilos["estado--por_pagar"]}`}>
                  {p.activo ? "En la web" : "Oculto"}
                </span>
              </div>

              <p className={estilos.precioResumen}>
                {p.precio_usd === null ? (
                  <span className="ayuda">Sin precio de venta.</span>
                ) : (
                  <>
                    Vende a <strong>{usd(p.precio_usd)}</strong>
                    {enBs !== null && (
                      <>
                        {" = "}
                        <strong className={estilos.precioBs}>{bs(enBs)}</strong>
                      </>
                    )}{" "}
                    por {nombreUnidad(p.unidad)}
                    {p.costo_usd !== null && p.margen_pct !== null && (
                      <span className="ayuda">
                        {" "}
                        (costo {usd(p.costo_usd)} + {p.margen_pct} %)
                      </span>
                    )}
                  </>
                )}
              </p>

              <form action={editarProducto} className="formulario">
                <input type="hidden" name="id" value={p.id} />
                <div className="formulario__fila">
                  <div className="campo">
                    <label htmlFor={`nombre-${p.id}`}>Nombre</label>
                    <input id={`nombre-${p.id}`} name="nombre" type="text" required defaultValue={p.nombre} />
                  </div>
                  <div className="campo">
                    <label htmlFor={`unidad-${p.id}`}>Se vende por</label>
                    <select id={`unidad-${p.id}`} name="unidad" defaultValue={p.unidad}>
                      {opcionesUnidad}
                    </select>
                  </div>
                </div>
                <div className={estilos.filaTres}>
                  <div className="campo">
                    <label htmlFor={`costo-${p.id}`}>Costo USD</label>
                    <input
                      id={`costo-${p.id}`}
                      name="costo_usd"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      defaultValue={p.costo_usd ?? ""}
                      placeholder="6,80"
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor={`margen-${p.id}`}>Margen %</label>
                    <input
                      id={`margen-${p.id}`}
                      name="margen_pct"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      defaultValue={p.margen_pct ?? ""}
                      placeholder="25"
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor={`precio-${p.id}`}>Venta USD</label>
                    <input
                      id={`precio-${p.id}`}
                      name="precio_usd"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      defaultValue={p.precio_usd ?? ""}
                      placeholder="Sale solo"
                    />
                  </div>
                </div>
                <span className="ayuda">
                  Con costo y margen el precio de venta sale solo. Si los dejas vacíos, vale el precio de venta que
                  escribas.
                </span>
                <div className="campo">
                  <label htmlFor={`descripcion-${p.id}`}>Ventajas (una por línea, se ven en la web)</label>
                  <textarea id={`descripcion-${p.id}`} name="descripcion" rows={3} defaultValue={p.descripcion ?? ""} />
                </div>
                <div>
                  <button type="submit" className="boton">
                    Guardar {p.nombre}
                  </button>
                </div>
              </form>

              <form action={alternarProducto} className={estilos.alternar}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="activo" value={p.activo ? "0" : "1"} />
                <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                  {p.activo ? "Ocultar de la web" : "Publicar en la web"}
                </button>
              </form>
            </article>
          );
        })}
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Nuevo producto</h2>
        <form action={guardarProducto} className="formulario">
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="producto-nombre">Nombre</label>
              <input id="producto-nombre" name="nombre" type="text" required />
            </div>
            <div className="campo">
              <label htmlFor="producto-unidad">Se vende por</label>
              <select id="producto-unidad" name="unidad" defaultValue="kg">
                {opcionesUnidad}
              </select>
            </div>
          </div>
          <div className={estilos.filaTres}>
            <div className="campo">
              <label htmlFor="producto-costo">Costo USD</label>
              <input id="producto-costo" name="costo_usd" type="number" inputMode="decimal" step="0.01" min="0" />
            </div>
            <div className="campo">
              <label htmlFor="producto-margen">Margen %</label>
              <input id="producto-margen" name="margen_pct" type="number" inputMode="decimal" step="0.1" min="0" />
            </div>
            <div className="campo">
              <label htmlFor="producto-precio">Venta USD</label>
              <input id="producto-precio" name="precio_usd" type="number" inputMode="decimal" step="0.01" min="0" />
            </div>
          </div>
          <span className="ayuda">Déjalo todo vacío si todavía no sabes el precio.</span>
          <div className="campo">
            <label htmlFor="producto-descripcion">Ventajas (una por línea)</label>
            <textarea id="producto-descripcion" name="descripcion" rows={3} placeholder={"Gratina muy bien\nPerfecta para pizza"} />
          </div>
          <div>
            <button type="submit" className="boton">
              Crear producto
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
