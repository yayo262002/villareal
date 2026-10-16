import Link from "next/link";
import { catalogoDelPos } from "@/lib/pos";
import { skuPropuesto } from "@/lib/pos-calculo";
import { asignarCodigo } from "@/lib/acciones";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Códigos de barras" };

/**
 * Los códigos de barras y los SKU de todo lo que se vende, para ponerlos
 * con el lector en un momento: cada fila es un formulario; el lector
 * escribe el código en la casilla y pulsa Enter, que es guardar. El SKU es
 * opcional (se propone uno); el código tiene que ser único.
 */
export default async function PaginaCodigos({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const catalogo = await catalogoDelPos();
  const sinCodigo = catalogo.filter((a) => !a.codigo_barras);
  const primeroVacio = sinCodigo[0]?.clave;

  return (
    <>
      <div>
        <p>
          <Link href="/admin/ventas">← Ventas</Link>
        </p>
        <h1 className={estilos.titulo}>Códigos de barras y SKU</h1>
      </div>
      <Avisos parametros={parametros} />
      <p className={estilos.ayuda}>
        Pon el cursor en la casilla del artículo y pasa el lector por su código: lo escribe y guarda solo. También se puede escribir a mano. El
        código tiene que ser único; el SKU es un nombre corto propio, opcional (se propone uno). Lo que no tiene código se busca en la caja por
        su nombre o su marca, sin problema.{" "}
        {sinCodigo.length === 0 ? "Todos los artículos tienen código." : `${sinCodigo.length} ${sinCodigo.length === 1 ? "artículo" : "artículos"} sin código.`}
      </p>

      <section className="tarjeta">
        <div className="tabla-envoltorio">
          <table className="tabla tabla--fichas">
            <thead>
              <tr>
                <th>Artículo</th>
                <th>Código de barras</th>
                <th>SKU</th>
                <th>
                  <span className="visualmente-oculto">Guardar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {catalogo.map((a) => {
                const idFila = `codigo-${a.clave}`;
                const propuesta = skuPropuesto(a.tipo, a.marca, a.contenido);
                return (
                  <tr key={a.clave} id={`articulo-${a.clave}`}>
                    <td data-label="Artículo">
                      <strong>{a.nombre}</strong>
                      {a.presentacionTexto ? <span className="ayuda"> · {a.presentacionTexto}</span> : null}
                      {a.familia ? <span className="ayuda"> · {a.familia}</span> : null}
                    </td>
                    <td data-label="Código de barras">
                      <input
                        form={idFila}
                        name="codigo_barras"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        defaultValue={a.codigo_barras}
                        placeholder="Escanea aquí"
                        autoFocus={a.clave === primeroVacio}
                        aria-label={`Código de barras de ${a.nombre}`}
                        style={{ minWidth: 180 }}
                      />
                    </td>
                    <td data-label="SKU">
                      <input form={idFila} name="sku" type="text" autoComplete="off" defaultValue={a.sku} placeholder={propuesta} aria-label={`SKU de ${a.nombre}`} style={{ minWidth: 140 }} />
                    </td>
                    <td className={estilos.accionesFila}>
                      <form id={idFila} action={asignarCodigo}>
                        <input type="hidden" name="clave" value={a.clave} />
                        <input type="hidden" name="volver_a" value={`/admin/codigos#articulo-${a.clave}`} />
                        <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                          {a.codigo_barras ? "Cambiar" : "Guardar"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
