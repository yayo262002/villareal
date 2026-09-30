import Link from "next/link";
import { listarProductos } from "@/lib/productos";
import { listarResenas, type Resena } from "@/lib/resenas";
import { LARGO_MAXIMO_DEL_NOMBRE, LARGO_MAXIMO_DEL_TEXTO } from "@/lib/resenas-texto";
import { alternarResena, cargarResenasDeEjemplo, guardarResena, retirarResenasDeEjemplo } from "@/lib/acciones";
import { rutaProducto } from "@/lib/enlaces";
import { fechaCorta, fechaDeLaBase } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Reseñas" };

/** Una reseña en el panel: lo que dice, de quién es, si se ve, y qué se puede hacer con ella. */
function ResenaDelPanel({ resena }: { resena: Resena }) {
  return (
    <li className={estilos.carteraCliente}>
      <p className={estilos.resenaTexto}>«{resena.texto}»</p>
      <p className={estilos.carteraDato}>
        <strong>{resena.autor}</strong>
        {resena.detalle ? ` · ${resena.detalle}` : ""}
        <span className="ayuda"> · {fechaCorta(fechaDeLaBase(resena.creado_en))}</span>
      </p>
      <div className={estilos.carteraAcciones}>
        {resena.de_ejemplo ? (
          <span className={`${estilos.estado} ${estilos["estado--parcial"]}`}>De ejemplo: solo la ves tú</span>
        ) : resena.publicada ? (
          <span className={`${estilos.estado} ${estilos["estado--pagada"]}`}>Publicada</span>
        ) : (
          <span className={`${estilos.estado} ${estilos["estado--por_pagar"]}`}>Escondida</span>
        )}
        {!resena.de_ejemplo && (
          <form action={alternarResena}>
            <input type="hidden" name="id" value={resena.id} />
            <input type="hidden" name="publicada" value={resena.publicada ? "0" : "1"} />
            <button type="submit" className={estilos.botonEnlace}>
              {resena.publicada ? "Esconder" : "Publicar"}
            </button>
          </form>
        )}
        <Link href={`/admin/resenas/${resena.id}/eliminar`} className="enlace-fila">
          Eliminar
        </Link>
      </div>
    </li>
  );
}

/**
 * Las reseñas de cada producto: lo que dicen los negocios que lo compran.
 * El dueño le pide el comentario al cliente y lo escribe aquí con sus
 * palabras; sale en la página del producto, en «Por qué elegirlo».
 */
export default async function PaginaResenas({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const productoElegido = typeof parametros.producto === "string" ? parametros.producto : "";
  const [productos, resenas] = await Promise.all([listarProductos(), listarResenas()]);

  const publicados = productos.filter((p) => p.activo);
  const deEjemplo = resenas.filter((r) => r.de_ejemplo).length;
  const delDueno = resenas.length - deEjemplo;
  const enLaWeb = resenas.filter((r) => !r.de_ejemplo && r.publicada).length;

  return (
    <>
      <h1 className={estilos.titulo}>Reseñas</h1>
      <Avisos parametros={parametros} />

      <dl className={estilos.cifras}>
        <div className={estilos.cifra}>
          <dt>Reseñas tuyas</dt>
          <dd>{delDueno}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Se ven en la web</dt>
          <dd>{enLaWeb}</dd>
        </div>
      </dl>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Reseña nueva</h2>
        <p className={estilos.ayuda}>
          Pregúntale al cliente qué le parece el producto y escríbelo aquí con sus palabras. Sale en la página del
          producto, en «Por qué elegirlo». Pídele permiso para poner su nombre.
        </p>
        <form action={guardarResena} className="formulario">
          <div className="campo">
            <label htmlFor="resena-producto">Producto</label>
            <select id="resena-producto" name="producto_id" required defaultValue={productoElegido}>
              <option value="" disabled>
                Elige un producto
              </option>
              {publicados.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="resena-autor">Quién lo dice</label>
              <input
                id="resena-autor"
                name="autor"
                type="text"
                required
                maxLength={LARGO_MAXIMO_DEL_NOMBRE}
                autoComplete="off"
                placeholder="Pizzería La Esquina"
              />
              <span className="ayuda">El nombre del negocio o de la persona.</span>
            </div>
            <div className="campo">
              <label htmlFor="resena-detalle">Qué negocio es (opcional)</label>
              <input
                id="resena-detalle"
                name="detalle"
                type="text"
                maxLength={LARGO_MAXIMO_DEL_NOMBRE}
                autoComplete="off"
                placeholder="Pizzería · Centro de Barquisimeto"
              />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="resena-texto">Qué dijo</label>
            <textarea
              id="resena-texto"
              name="texto"
              required
              rows={4}
              maxLength={LARGO_MAXIMO_DEL_TEXTO}
              placeholder="Gratina muy bien y no se quema."
            />
            <span className="ayuda">Sin comillas: la web las pone. Corto se lee mejor.</span>
          </div>
          <label className={estilos.casilla}>
            <input type="checkbox" name="publicada" value="1" defaultChecked />
            <span>Publicarla ya en la web</span>
          </label>
          <div>
            <button type="submit" className="boton">
              Guardar reseña
            </button>
          </div>
        </form>
      </section>

      {productos.map((p) => {
        const suyas = resenas.filter((r) => r.producto_id === p.id);
        if (!p.activo && suyas.length === 0) return null;
        return (
          <section key={p.id} className="tarjeta">
            <div className={estilos.encabezado} style={{ marginBottom: "var(--espacio-4)" }}>
              <h2 className={estilos.subtitulo} style={{ marginBottom: 0 }}>
                {p.nombre} ({suyas.length})
              </h2>
              {p.activo ? (
                <a href={rutaProducto(p)} target="_blank" rel="noopener">
                  Ver cómo queda en la web
                </a>
              ) : (
                <span className="ayuda">Producto escondido de la web</span>
              )}
            </div>
            {suyas.length === 0 ? (
              <p className="vacio">
                Todavía no tiene reseñas. <Link href={`/admin/resenas?producto=${p.id}`}>Escribir la primera</Link>
              </p>
            ) : (
              <ul className={estilos.cartera}>
                {suyas.map((r) => (
                  <ResenaDelPanel key={r.id} resena={r} />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Reseñas de ejemplo</h2>
        <p className={estilos.ayuda}>
          Sirven para ver cómo queda la página antes de tener las de verdad. No las dijo ningún cliente: por eso{" "}
          <strong>solo las ves tú</strong>, con el panel abierto, y llevan la etiqueta «Ejemplo». Quien entra a la web
          no las ve.
        </p>
        <div className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
          <form action={cargarResenasDeEjemplo}>
            <input type="hidden" name="ejemplo" value="poner" />
            <button type="submit" className="boton boton--secundario">
              {deEjemplo > 0 ? "Volver a poner las de ejemplo" : "Poner reseñas de ejemplo"}
            </button>
          </form>
          {deEjemplo > 0 && (
            <form action={retirarResenasDeEjemplo}>
              <input type="hidden" name="ejemplo" value="quitar" />
              <button type="submit" className="boton boton--secundario">
                Quitar las {deEjemplo} de ejemplo
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
