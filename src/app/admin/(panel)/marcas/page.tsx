import Link from "next/link";
import { listarMarcasConCuentas } from "@/lib/marcas";
import { borrarMarca, cambiarNombreDeMarca, juntarMarcas } from "@/lib/acciones";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Marcas" };

/**
 * Las marcas del catálogo: cuántos artículos lleva cada una y en qué tipos
 * de producto sale. Se crean solas al escribirlas en un artículo; aquí se
 * renombran (una errata), se unen dos que son la misma y se borra la que
 * ya no tiene nada.
 */
export default async function PaginaMarcas({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const marcas = await listarMarcasConCuentas();
  return (
    <>
      <div>
        <p>
          <Link href="/admin/productos">← Productos</Link>
        </p>
        <h1 className={estilos.titulo}>Marcas</h1>
        <p className={estilos.ayuda}>
          La marca es de cada artículo, no del tipo de producto: el cliente busca «Suero» y después elige Guaralact. Una marca nueva se crea sola al
          escribirla en un artículo (en «Agregar producto» o en la ficha del tipo, en «Marcas y presentaciones»).
        </p>
      </div>
      <Avisos parametros={parametros} />
      {marcas.length === 0 ? (
        <p className="vacio">Todavía no hay marcas. Aparecen al añadir la primera en un producto.</p>
      ) : (
        <ul className={estilos.cartera}>
          {marcas.map((m) => {
            const uso = m.articulos + m.productos;
            return (
              <li key={m.id} className={estilos.carteraCliente}>
                <div className={estilos.encabezado}>
                  <strong>{m.nombre}</strong>
                  <span className={`${estilos.estado} ${uso > 0 ? estilos["estado--pagada"] : estilos["estado--por_pagar"]}`}>
                    {uso === 0 ? "Sin artículos" : uso === 1 ? "1 artículo" : `${uso} artículos`}
                  </span>
                </div>
                <p className={estilos.carteraDato}>{m.tipos.length > 0 ? `En: ${m.tipos.join(" · ")}` : "No sale en ningún producto."}</p>
                <details className={estilos.masDatos}>
                  <summary>Cambiar el nombre</summary>
                  <form action={cambiarNombreDeMarca} className="formulario" style={{ marginTop: "var(--espacio-3)" }}>
                    <input type="hidden" name="id" value={m.id} />
                    <div className="campo">
                      <label htmlFor={`marca-${m.id}-nombre`}>Nombre</label>
                      <input id={`marca-${m.id}-nombre`} name="nombre" type="text" required defaultValue={m.nombre} />
                    </div>
                    <div>
                      <button type="submit" className="boton">
                        Guardar el nombre
                      </button>
                    </div>
                  </form>
                </details>
                {marcas.length > 1 && (
                  <details className={estilos.masDatos}>
                    <summary>Es la misma que otra: unirlas</summary>
                    <form action={juntarMarcas} className="formulario" style={{ marginTop: "var(--espacio-3)" }}>
                      <input type="hidden" name="id" value={m.id} />
                      <div className="campo">
                        <label htmlFor={`marca-${m.id}-destino`}>Pasar todo lo de «{m.nombre}» a</label>
                        <select id={`marca-${m.id}-destino`} name="destino" required defaultValue="">
                          <option value="" disabled>
                            Elige la marca buena
                          </option>
                          {marcas
                            .filter((o) => o.id !== m.id)
                            .map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.nombre}
                              </option>
                            ))}
                        </select>
                        <span className="ayuda">Sus artículos pasan a decir la otra marca, también en las notas donde salen, y «{m.nombre}» desaparece.</span>
                      </div>
                      <div>
                        <button type="submit" className="boton boton--secundario">
                          Unir y borrar «{m.nombre}»
                        </button>
                      </div>
                    </form>
                  </details>
                )}
                {uso === 0 && (
                  <form action={borrarMarca}>
                    <input type="hidden" name="id" value={m.id} />
                    <button type="submit" className="enlace-fila" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}>
                      Borrar «{m.nombre}»
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
