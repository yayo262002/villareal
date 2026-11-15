import Link from "next/link";
import { documentosSinControl } from "@/lib/facturas";
import { ponerControlesDeFacturas } from "@/lib/acciones";
import { NOMBRE_DOCUMENTO, numeroDeFactura } from "@/lib/factura-calculo";
import { fechaCorta, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../../panel.module.css";
import { exigirPanel } from "@/lib/panel";

export const metadata = { title: "Números de control" };

/**
 * Los números de control de todas las facturas y notas de crédito que los esperan, en una sola pantalla: la imprenta
 * digital los da correlativos, así que se escriben uno a uno o se llenan todos seguidos desde el primero.
 */
export default async function PaginaNumerosDeControl({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  await exigirPanel();
  const parametros = await searchParams;
  const pendientes = await documentosSinControl();

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 className={estilos.titulo}>Números de control</h1>
        <div className={estilos.accionesFila}>
          <Link href="/admin/facturas" className="boton boton--secundario">
            ← Facturas
          </Link>
        </div>
      </div>
      <Avisos parametros={parametros} />
      <p className="ayuda">
        El número de control lo asigna la imprenta digital autorizada por el SENIAT a cada factura y a cada nota de crédito. Escríbelo aquí cuando te llegue: hasta
        tenerlo, el documento no vale como factura fiscal. Lo que dejes vacío sigue pendiente.
      </p>

      {pendientes.length === 0 ? (
        <p className="vacio">Todos los documentos tienen su número de control.</p>
      ) : (
        <>
          {pendientes.length > 1 && (
            <form action={ponerControlesDeFacturas} className="tarjeta" style={{ display: "grid", gap: "var(--espacio-2)" }}>
              <h2 className={estilos.subtitulo} style={{ margin: 0 }}>
                Todos seguidos
              </h2>
              <p className="ayuda" style={{ margin: 0 }}>
                Si la imprenta te dio los números en orden, escribe el primero y se ponen los {pendientes.length} seguidos, en el orden en que se emitieron (de la{" "}
                {NOMBRE_DOCUMENTO[pendientes[0].tipo].toLowerCase()} N.º {numeroDeFactura(pendientes[0].numero)} en adelante).
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--espacio-2)", alignItems: "end" }}>
                <div className="campo" style={{ flex: "1 1 220px", margin: 0 }}>
                  <label htmlFor="desde">El primer número de control</label>
                  <input id="desde" name="desde" type="text" autoComplete="off" placeholder="00-00000123" maxLength={40} required />
                </div>
                <button type="submit" className="boton">
                  Ponerlos seguidos
                </button>
              </div>
            </form>
          )}

          <form action={ponerControlesDeFacturas} style={{ marginTop: "var(--espacio-3)" }}>
            <div className="tabla-envoltorio">
              <table className="tabla tabla--fichas">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th className="num">Total</th>
                    <th>N.º de control</th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((d) => (
                    <tr key={d.id}>
                      <td data-label="Documento">
                        <Link href={`/admin/facturas/${d.id}`}>
                          {NOMBRE_DOCUMENTO[d.tipo]} {numeroDeFactura(d.numero)}
                        </Link>
                        {d.estado === "anulada" && <span className={estilos.sinNombre}> · anulada</span>}
                      </td>
                      <td data-label="Fecha">{fechaCorta(d.fecha)}</td>
                      <td data-label="Cliente">{d.cliente}</td>
                      <td data-label="Total" className="num">
                        {usd(d.total_usd)}
                      </td>
                      <td data-label="N.º de control">
                        <input
                          name={`control_${d.id}`}
                          type="text"
                          autoComplete="off"
                          maxLength={40}
                          aria-label={`Número de control de la ${NOMBRE_DOCUMENTO[d.tipo].toLowerCase()} ${numeroDeFactura(d.numero)}`}
                          style={{ width: "100%", minWidth: 0 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="submit" className="boton" style={{ marginTop: "var(--espacio-3)" }}>
              Guardar los números escritos
            </button>
          </form>
        </>
      )}
    </>
  );
}
