import { listarProductos } from "@/lib/productos";
import { alternarProducto, cambiarPrecio, guardarProducto } from "@/lib/acciones";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Productos" };

export default async function PaginaProductos({
  searchParams,
}: {
  searchParams: Promise<ParametrosAviso>;
}) {
  const parametros = await searchParams;
  const productos = listarProductos();
  const sinPrecio = productos.filter((p) => p.activo && p.precio_usd === null);

  return (
    <>
      <h1 className={estilos.titulo}>Productos</h1>
      <Avisos parametros={parametros} />

      {sinPrecio.length > 0 && (
        <p className="aviso aviso--aviso">
          {sinPrecio.length === 1
            ? `«${sinPrecio[0].nombre}» no tiene precio: la web dice «consulta el precio del día».`
            : `${sinPrecio.length} productos no tienen precio: la web dice «consulta el precio del día».`}
        </p>
      )}

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
                  <option value="kg">Kilo</option>
                  <option value="unidad">Unidad</option>
                </select>
              </div>
              <div className="campo">
                <label htmlFor="producto-precio">Precio en USD</label>
                <input
                  id="producto-precio"
                  name="precio_usd"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                />
                <span className="ayuda">Déjalo vacío si todavía no lo sabes.</span>
              </div>
            </div>
            <div>
              <button type="submit" className="boton">
                Crear producto
              </button>
            </div>
          </form>
        </section>

        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Lista y precios</h2>
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Precio USD</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.nombre} <span className="ayuda">/ {p.unidad}</span>
                    </td>
                    <td>
                      <form action={cambiarPrecio} className={estilos.accionesFila}>
                        <input type="hidden" name="id" value={p.id} />
                        <label htmlFor={`precio-${p.id}`} className="visualmente-oculto">
                          Precio de {p.nombre}
                        </label>
                        <input
                          id={`precio-${p.id}`}
                          name="precio_usd"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          defaultValue={p.precio_usd ?? ""}
                          placeholder="Sin precio"
                          className={estilos.entradaPequena}
                        />
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
                          {p.activo ? "Ocultar de la web" : "Publicar"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
