import Link from "next/link";
import { listarClientes } from "@/lib/clientes";
import { listarProductos } from "@/lib/productos";
import { listarVentas, lineasDeVenta } from "@/lib/ventas";
import { guardarVenta } from "@/lib/acciones";
import { FILAS_VENTA } from "@/lib/constantes";
import { cantidad, fechaCorta, hoy, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Ventas" };

export default async function PaginaVentas({
  searchParams,
}: {
  searchParams: Promise<ParametrosAviso>;
}) {
  const parametros = await searchParams;
  const clientePreseleccionado = typeof parametros.cliente === "string" ? parametros.cliente : "";
  const clientes = listarClientes();
  const productos = listarProductos(true);
  const ventas = listarVentas(50).map((v) => ({ ...v, lineas: lineasDeVenta(v.id) }));

  return (
    <>
      <h1 className={estilos.titulo}>Ventas</h1>
      <Avisos parametros={parametros} />

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Registrar venta</h2>
        {clientes.length === 0 ? (
          <p className="aviso aviso--aviso">
            Primero <Link href="/admin/clientes">registra un cliente</Link>.
          </p>
        ) : (
          <form action={guardarVenta} className="formulario">
            <div className="formulario__fila">
              <div className="campo">
                <label htmlFor="venta-cliente">Cliente</label>
                <select id="venta-cliente" name="cliente_id" required defaultValue={clientePreseleccionado}>
                  <option value="" disabled>
                    Elige un cliente
                  </option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="venta-fecha">Fecha</label>
                <input id="venta-fecha" name="fecha" type="date" required defaultValue={hoy()} />
              </div>
            </div>

            {Array.from({ length: FILAS_VENTA }, (_, i) => (
              <fieldset key={i} className={estilos.filaVenta} style={{ border: "none", margin: 0 }}>
                <legend className="visualmente-oculto">Producto {i + 1}</legend>
                <div className="campo">
                  <label htmlFor={`producto_${i}`}>Producto</label>
                  <select id={`producto_${i}`} name={`producto_${i}`} defaultValue="">
                    <option value="">{i === 0 ? "Elige un producto" : "(vacío)"}</option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                        {p.precio_usd !== null ? ` · ${usd(p.precio_usd)}/${p.unidad}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor={`cantidad_${i}`}>Cantidad</label>
                  <input
                    id={`cantidad_${i}`}
                    name={`cantidad_${i}`}
                    type="number"
                    inputMode="decimal"
                    step="0.001"
                    min="0.001"
                  />
                </div>
                <div className="campo">
                  <label htmlFor={`precio_${i}`}>Precio USD por unidad</label>
                  <input
                    id={`precio_${i}`}
                    name={`precio_${i}`}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                  />
                </div>
              </fieldset>
            ))}

            <div className="campo">
              <label htmlFor="venta-nota">Nota</label>
              <input id="venta-nota" name="nota" type="text" />
            </div>
            <div>
              <button type="submit" className="boton">
                Registrar venta
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Últimas ventas</h2>
        {ventas.length === 0 ? (
          <p className="vacio">Todavía no hay ventas.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Productos</th>
                  <th className="numero">Total</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id}>
                    <td>{fechaCorta(v.fecha)}</td>
                    <td>
                      <Link href={`/admin/clientes/${v.cliente_id}`}>{v.cliente_nombre}</Link>
                    </td>
                    <td>
                      {v.lineas
                        .map((l) => `${cantidad(l.cantidad, l.unidad)} ${l.producto_nombre}`)
                        .join(" · ")}
                    </td>
                    <td className="numero">{usd(v.total_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
