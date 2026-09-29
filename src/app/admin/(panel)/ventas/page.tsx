import Link from "next/link";
import { listarClientes } from "@/lib/clientes";
import { listarProductos, type Producto } from "@/lib/productos";
import { conLineas, listarVentas } from "@/lib/ventas";
import { guardarVenta } from "@/lib/acciones";
import { FILAS_VENTA, FILAS_VENTA_A_LA_VISTA } from "@/lib/constantes";
import { numeroDeNota, resumenDeLineas } from "@/lib/entregas";
import { fechaCorta, hoy, nombreUnidad, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Ventas" };

/** Una fila del formulario: producto, cantidad y precio. */
function FilaDeVenta({ i, productos }: { i: number; productos: Producto[] }) {
  return (
    <fieldset className={estilos.filaVenta} style={{ border: "none", margin: 0 }}>
      <legend className="visualmente-oculto">Producto {i + 1}</legend>
      <div className="campo">
        <label htmlFor={`producto_${i}`}>Producto</label>
        <select id={`producto_${i}`} name={`producto_${i}`} defaultValue="">
          <option value="">{i === 0 ? "Elige un producto" : "(vacío)"}</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
              {p.precio_usd !== null ? ` · detal ${usd(p.precio_usd)}` : ""}
              {p.precio_mayor_usd !== null ? ` · mayor ${usd(p.precio_mayor_usd)}` : ""}
              {p.precio_usd !== null || p.precio_mayor_usd !== null ? ` / ${nombreUnidad(p.unidad)}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor={`cantidad_${i}`}>Cantidad</label>
        <input id={`cantidad_${i}`} name={`cantidad_${i}`} type="number" inputMode="decimal" step="0.001" min="0.001" />
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
          placeholder="Vacío = el del producto"
        />
      </div>
    </fieldset>
  );
}

export default async function PaginaVentas({
  searchParams,
}: {
  searchParams: Promise<ParametrosAviso>;
}) {
  const parametros = await searchParams;
  const clientePreseleccionado = typeof parametros.cliente === "string" ? parametros.cliente : "";
  const [clientes, productos, ventas] = await Promise.all([
    listarClientes(),
    listarProductos(true),
    listarVentas(50).then(conLineas),
  ]);
  const filas = Array.from({ length: FILAS_VENTA }, (_, i) => i);

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
                      {c.tipo === "mayor" ? " (al mayor)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="venta-fecha">Fecha</label>
                <input id="venta-fecha" name="fecha" type="date" required defaultValue={hoy()} />
              </div>
            </div>

            {filas.slice(0, FILAS_VENTA_A_LA_VISTA).map((i) => (
              <FilaDeVenta key={i} i={i} productos={productos} />
            ))}
            <details className={estilos.masDatos}>
              <summary>Más productos</summary>
              <div className="formulario" style={{ marginTop: "var(--espacio-3)" }}>
                {filas.slice(FILAS_VENTA_A_LA_VISTA).map((i) => (
                  <FilaDeVenta key={i} i={i} productos={productos} />
                ))}
              </div>
            </details>

            <div className="formulario__fila">
              <div className="campo">
                <label htmlFor="venta-entrega">Entrega</label>
                <select id="venta-entrega" name="entrega" defaultValue="local">
                  <option value="local">Ya entregada (se la lleva del local)</option>
                  <option value="despacho">Por entregar (va al despacho)</option>
                </select>
                <span className="ayuda">Lo que queda por entregar sale en la ruta de despacho.</span>
              </div>
              <div className="campo">
                <label htmlFor="venta-nota">Nota</label>
                <input id="venta-nota" name="nota" type="text" />
              </div>
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
                  <th>Nota</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Productos</th>
                  <th className="numero">Total</th>
                  <th>Entrega</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/admin/ventas/${v.id}/nota`}>{numeroDeNota(v.id)}</Link>
                    </td>
                    <td>{fechaCorta(v.fecha)}</td>
                    <td>
                      <Link href={`/admin/clientes/${v.cliente_id}`}>{v.cliente_nombre}</Link>
                    </td>
                    <td>{resumenDeLineas(v.lineas)}</td>
                    <td className="numero">{usd(v.total_usd)}</td>
                    <td>
                      {v.por_entregar ? (
                        <Link href="/admin/despacho" className={`${estilos.estado} ${estilos["estado--parcial"]}`}>
                          Por entregar
                        </Link>
                      ) : (
                        <span className={`${estilos.estado} ${estilos["estado--pagada"]}`}>Entregada</span>
                      )}
                    </td>
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
