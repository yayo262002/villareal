import Link from "next/link";
import { listarClientes } from "@/lib/clientes";
import { listarPagos, ultimaTasa } from "@/lib/pagos";
import { METODOS_PAGO, fechaCorta, formatearMonto, usd, tasaLegible } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { FormularioPago } from "@/components/formulario-pago";
import estilos from "../panel.module.css";

export const metadata = { title: "Abonos" };

export default async function PaginaPagos({
  searchParams,
}: {
  searchParams: Promise<ParametrosAviso>;
}) {
  const parametros = await searchParams;
  const [clientes, pagos, tasa] = await Promise.all([listarClientes(), listarPagos(100), ultimaTasa()]);

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 className={estilos.titulo}>Abonos</h1>
        <Link href="/admin/caja" className="boton boton--secundario">
          Cierre del día
        </Link>
      </div>
      <Avisos parametros={parametros} />

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Registrar abono</h2>
        {clientes.length === 0 ? (
          <p className="aviso aviso--aviso">
            Primero <Link href="/admin/clientes">registra un cliente</Link>.
          </p>
        ) : (
          <FormularioPago clientes={clientes} ultimaTasa={tasa} volverA="/admin/pagos" parametros={parametros} />
        )}
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Últimos abonos</h2>
        {pagos.length === 0 ? (
          <p className="vacio">Todavía no hay abonos.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Método</th>
                  <th className="numero">Monto</th>
                  <th className="numero">Tasa</th>
                  <th className="numero">En USD</th>
                  <th>Referencia</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Fecha">{fechaCorta(p.fecha)}</td>
                    <td data-label="Cliente">
                      <Link href={`/admin/clientes/${p.cliente_id}`}>{p.cliente_nombre}</Link>
                    </td>
                    <td data-label="Método">{METODOS_PAGO[p.metodo]}</td>
                    <td data-label="Monto" className="numero">{formatearMonto(p.monto, p.moneda)}</td>
                    <td data-label="Tasa" className="numero" data-vacio={p.tasa ? undefined : ""}>{p.tasa ? tasaLegible(p.tasa) : "—"}</td>
                    <td data-label="En USD" className="numero">{usd(p.monto_usd)}</td>
                    <td data-label="Referencia" data-vacio={p.referencia ? undefined : ""}>{p.referencia || "—"}</td>
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
