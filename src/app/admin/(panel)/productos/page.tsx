import { listarProductos } from "@/lib/productos";
import { leerTasa } from "@/lib/ajustes";
import { alternarProducto, cambiarPrecio, cambiarTasa, editarProducto, guardarProducto } from "@/lib/acciones";
import { UNIDADES, aBolivares, bs, fechaCorta, nombreUnidad, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Productos" };

/**
 * Productos y precios. El dueño escribe lo que le cuesta cada producto en
 * dólares y el porcentaje que le suma; el precio de venta sale solo. La web
 * lo publica en bolívares con la tasa del día, que también se pone aquí.
 */
export default async function PaginaProductos({
  searchParams,
}: {
  searchParams: Promise<ParametrosAviso>;
}) {
  const parametros = await searchParams;
  const [productos, tasa] = await Promise.all([listarProductos(), leerTasa()]);
  const sinPrecio = productos.filter((p) => p.activo && p.precio_usd === null);

  return (
    <>
      <h1 className={estilos.titulo}>Productos y precios</h1>
      <Avisos parametros={parametros} />

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Tasa del día</h2>
        <form action={cambiarTasa} className={estilos.accionesFila}>
          <label htmlFor="tasa" className="visualmente-oculto">
            Bolívares por dólar
          </label>
          <input
            id="tasa"
            name="tasa"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
            defaultValue={tasa?.valor ?? ""}
            placeholder="Bs por dólar"
            className={estilos.entradaPequena}
          />
          <button type="submit" className="boton">
            Guardar tasa
          </button>
          <span className={estilos.ayuda} style={{ margin: 0 }}>
            {tasa
              ? `Vigente: ${bs(tasa.valor)} por dólar, puesta el ${fechaCorta(tasa.actualizada_en)}.`
              : "Sin tasa: la web muestra los precios solo en dólares."}
          </span>
        </form>
      </section>

      {sinPrecio.length > 0 && (
        <p className="aviso aviso--aviso">
          {sinPrecio.length === 1
            ? `«${sinPrecio[0].nombre}» no tiene precio: la web dice «consulta el precio del día».`
            : `${sinPrecio.length} productos no tienen precio: la web dice «consulta el precio del día».`}
        </p>
      )}

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Precios</h2>
        <p className={estilos.ayuda}>
          Escribe lo que te cuesta y tu porcentaje: el precio de venta sale solo. Si prefieres, deja
          costo y margen vacíos y escribe el precio de venta directamente.
        </p>
        <div className="tabla-envoltorio">
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="numero">Costo USD</th>
                <th className="numero">Margen %</th>
                <th className="numero">Venta USD</th>
                <th className="numero">Venta Bs</th>
                <th></th>
                <th>Web</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => {
                const enBs = p.precio_usd !== null ? aBolivares(p.precio_usd, tasa?.valor ?? null) : null;
                const formulario = `precio-${p.id}`;
                return (
                  <tr key={p.id} className={p.activo ? "" : estilos.filaApagada}>
                    <td>
                      <strong>{p.nombre}</strong> <span className="ayuda">/ {nombreUnidad(p.unidad)}</span>
                    </td>
                    <td className="numero">
                      <input
                        form={formulario}
                        name="costo_usd"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        defaultValue={p.costo_usd ?? ""}
                        placeholder="6,80"
                        aria-label={`Costo de ${p.nombre}`}
                        className={estilos.entradaPequena}
                      />
                    </td>
                    <td className="numero">
                      <input
                        form={formulario}
                        name="margen_pct"
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min="0"
                        defaultValue={p.margen_pct ?? ""}
                        placeholder="25"
                        aria-label={`Margen de ${p.nombre}`}
                        className={estilos.entradaPequena}
                      />
                    </td>
                    <td className="numero">
                      <input
                        form={formulario}
                        name="precio_usd"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        defaultValue={p.precio_usd ?? ""}
                        placeholder="Sin precio"
                        aria-label={`Precio de venta de ${p.nombre}`}
                        className={estilos.entradaPequena}
                      />
                    </td>
                    <td className={`numero ${estilos.precioBs}`}>{enBs !== null ? bs(enBs) : "—"}</td>
                    <td>
                      <form id={formulario} action={cambiarPrecio}>
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                          Guardar
                        </button>
                      </form>
                    </td>
                    <td>
                      <form action={alternarProducto}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="activo" value={p.activo ? "0" : "1"} />
                        <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                          {p.activo ? "Ocultar" : "Publicar"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {tasa && (
          <p className={estilos.ayuda} style={{ marginTop: "var(--espacio-4)", marginBottom: 0 }}>
            «Venta Bs» es el precio en dólares por la tasa del día ({bs(tasa.valor)}). Cambia la tasa
            y todos los precios en bolívares cambian a la vez.
          </p>
        )}
      </section>

      <div className={estilos.dosColumnas}>
        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Nuevo producto</h2>
          <form action={guardarProducto} className="formulario">
            <div className="campo">
              <label htmlFor="producto-nombre">Nombre</label>
              <input id="producto-nombre" name="nombre" type="text" required />
            </div>
            <div className="formulario__fila">
              <div className="campo">
                <label htmlFor="producto-unidad">Se vende por</label>
                <select id="producto-unidad" name="unidad" defaultValue="kg">
                  {Object.entries(UNIDADES).map(([valor, nombre]) => (
                    <option key={valor} value={valor}>
                      {nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="producto-costo">Costo en USD</label>
                <input id="producto-costo" name="costo_usd" type="number" inputMode="decimal" step="0.01" min="0" />
              </div>
            </div>
            <div className="formulario__fila">
              <div className="campo">
                <label htmlFor="producto-margen">Margen %</label>
                <input id="producto-margen" name="margen_pct" type="number" inputMode="decimal" step="0.1" min="0" />
              </div>
              <div className="campo">
                <label htmlFor="producto-precio">O precio de venta en USD</label>
                <input id="producto-precio" name="precio_usd" type="number" inputMode="decimal" step="0.01" min="0" />
                <span className="ayuda">Déjalo todo vacío si todavía no lo sabes.</span>
              </div>
            </div>
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

        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Nombre y ventajas</h2>
          <p className={estilos.ayuda}>Lo que escribas aquí es lo que ve el cliente en la web, debajo del precio.</p>
          <div className={estilos.listaProductos}>
            {productos.map((p) => (
              <form key={p.id} action={editarProducto} className={`formulario ${estilos.productoEditar}`}>
                <input type="hidden" name="id" value={p.id} />
                <div className="formulario__fila">
                  <div className="campo">
                    <label htmlFor={`nombre-${p.id}`}>Nombre</label>
                    <input id={`nombre-${p.id}`} name="nombre" type="text" required defaultValue={p.nombre} />
                  </div>
                  <div className="campo">
                    <label htmlFor={`unidad-${p.id}`}>Se vende por</label>
                    <select id={`unidad-${p.id}`} name="unidad" defaultValue={p.unidad}>
                      {Object.entries(UNIDADES).map(([valor, nombre]) => (
                        <option key={valor} value={valor}>
                          {nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="campo">
                  <label htmlFor={`descripcion-${p.id}`}>Ventajas (una por línea)</label>
                  <textarea id={`descripcion-${p.id}`} name="descripcion" rows={3} defaultValue={p.descripcion ?? ""} />
                </div>
                <div>
                  <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                    Guardar {p.nombre}
                  </button>
                  {p.precio_usd !== null && (
                    <span className="ayuda" style={{ marginLeft: "var(--espacio-3)" }}>
                      Vende a {usd(p.precio_usd)} / {nombreUnidad(p.unidad)}
                    </span>
                  )}
                </div>
              </form>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
