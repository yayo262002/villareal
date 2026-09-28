import Link from "next/link";
import { listarClientes } from "@/lib/clientes";
import { guardarCliente } from "@/lib/acciones";
import { fechaCorta, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Clientes" };

/** Sin tildes ni mayúsculas, para que «jose» encuentre a «José». */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<ParametrosAviso>;
}) {
  const parametros = await searchParams;
  const busqueda = typeof parametros.q === "string" ? parametros.q.trim() : "";
  const todos = await listarClientes();
  const clave = normalizar(busqueda);
  const clientes = clave
    ? todos.filter((c) =>
        [c.nombre, c.telefono, c.cedula_rif, c.direccion, c.nota].some((campo) => normalizar(campo).includes(clave)),
      )
    : todos;

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 className={estilos.titulo}>Clientes</h1>
        {todos.length > 0 && (
          <a href="/admin/clientes/exportar" download className="boton boton--secundario">
            Descargar lista (Excel)
          </a>
        )}
      </div>
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
          {todos.length > 0 && (
            <form method="get" action="/admin/clientes" className={estilos.buscador} role="search">
              <label htmlFor="buscar" className="visualmente-oculto">
                Buscar cliente
              </label>
              <input
                id="buscar"
                name="q"
                type="search"
                placeholder="Buscar por nombre, teléfono o cédula"
                defaultValue={busqueda}
              />
              <button type="submit" className="boton boton--secundario">
                Buscar
              </button>
              {busqueda && (
                <Link href="/admin/clientes" className={estilos.limpiar}>
                  Ver todos
                </Link>
              )}
            </form>
          )}
          {todos.length === 0 ? (
            <p className="vacio">Todavía no hay clientes registrados.</p>
          ) : clientes.length === 0 ? (
            <p className="vacio">Ningún cliente coincide con «{busqueda}».</p>
          ) : (
            <div className="tabla-envoltorio">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Teléfono</th>
                    <th>Tipo</th>
                    <th>Última compra</th>
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
                      <td>{c.ultima_compra ? fechaCorta(c.ultima_compra) : "—"}</td>
                      <td className={`numero ${c.saldo_usd > 0 ? estilos.deuda : estilos.saldado}`}>
                        {c.saldo_usd > 0 ? `Debe ${usd(c.saldo_usd)}` : "Al día"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {busqueda && (
                <p className={estilos.ayuda}>
                  {clientes.length} de {todos.length} clientes.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
