import Link from "next/link";
import { listarClientes } from "@/lib/clientes";
import { guardarCliente } from "@/lib/acciones";
import { usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Clientes" };

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<ParametrosAviso>;
}) {
  const parametros = await searchParams;
  const clientes = listarClientes();

  return (
    <>
      <h1 className={estilos.titulo}>Clientes</h1>
      <Avisos parametros={parametros} />

      <div className={estilos.dosColumnas}>
        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Registrar cliente</h2>
          <form action={guardarCliente} className="formulario">
            <div className="campo">
              <label htmlFor="nombre">Nombre o negocio</label>
              <input id="nombre" name="nombre" type="text" required autoComplete="off" />
            </div>
            <div className="formulario__fila">
              <div className="campo">
                <label htmlFor="telefono">Teléfono</label>
                <input id="telefono" name="telefono" type="tel" inputMode="tel" placeholder="0412-1234567" />
              </div>
              <div className="campo">
                <label htmlFor="cedula_rif">Cédula o RIF</label>
                <input id="cedula_rif" name="cedula_rif" type="text" placeholder="V-12345678" />
              </div>
            </div>
            <div className="campo">
              <label htmlFor="direccion">Dirección</label>
              <input id="direccion" name="direccion" type="text" />
            </div>
            <div className="formulario__fila">
              <div className="campo">
                <label htmlFor="tipo">Tipo</label>
                <select id="tipo" name="tipo" defaultValue="detal">
                  <option value="detal">Detal</option>
                  <option value="mayor">Mayor</option>
                </select>
              </div>
              <div className="campo">
                <label htmlFor="nota">Nota</label>
                <input id="nota" name="nota" type="text" />
              </div>
            </div>
            <div>
              <button type="submit" className="boton">
                Registrar
              </button>
            </div>
          </form>
        </section>

        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Todos los clientes</h2>
          {clientes.length === 0 ? (
            <p className="vacio">Todavía no hay clientes registrados.</p>
          ) : (
            <div className="tabla-envoltorio">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Teléfono</th>
                    <th>Tipo</th>
                    <th className="numero">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/admin/clientes/${c.id}`}>{c.nombre}</Link>
                      </td>
                      <td>{c.telefono || "—"}</td>
                      <td>{c.tipo === "mayor" ? "Mayor" : "Detal"}</td>
                      <td className={`numero ${c.saldo_usd > 0 ? estilos.deuda : estilos.saldado}`}>
                        {c.saldo_usd > 0 ? `Debe ${usd(c.saldo_usd)}` : "Al día"}
                      </td>
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
