import Link from "next/link";
import { listarClientes } from "@/lib/clientes";
import { listarPagos, ultimaTasa } from "@/lib/pagos";
import { METODOS_PAGO, fechaCorta, formatearMonto, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { FormularioPago } from "@/components/formulario-pago";
import estilos from "../panel.module.css";

export const metadata = { title: "Pagos" };

export default async function PaginaPagos({
  searchParams,
}: {
  searchParams: Promise<ParametrosAviso>;
}) {
  const parametros = await searchParams;
  const clientes = listarClientes();
  const pagos = listarPagos(100);

  return (
    <>
      <h1 className={estilos.titulo}>Pagos</h1>
      <Avisos parametros={parametros} />

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Registrar pago</h2>
        {clientes.length === 0 ? (
          <p className="aviso aviso--aviso">
            Primero <Link href="/admin/clientes">registra un cliente</Link>.
          </p>
        ) : (
          <FormularioPago clientes={clientes} ultimaTasa={ultimaTasa()} volverA="/admin/pagos" />
        )}
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Últimos pagos</h2>
        {pagos.length === 0 ? (
          <p className="vacio">Todavía no hay pagos.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla">
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
                    <td>{fechaCorta(p.fecha)}</td>
                    <td>
                      <Link href={`/admin/clientes/${p.cliente_id}`}>{p.cliente_nombre}</Link>
                    </td>
                    <td>{METODOS_PAGO[p.metodo]}</td>
                    <td className="numero">{formatearMonto(p.monto, p.moneda)}</td>
                    <td className="numero">{p.tasa ? p.tasa.toFixed(2) : "—"}</td>
                    <td className="numero">{usd(p.monto_usd)}</td>
                    <td>{p.referencia || "—"}</td>
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
