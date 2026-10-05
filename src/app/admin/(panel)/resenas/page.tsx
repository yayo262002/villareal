import Link from "next/link";
import { listarProductos } from "@/lib/productos";
import { agruparPorProducto, listarVariantes } from "@/lib/variantes";
import { nombreDeVenta, vendiblesDe } from "@/lib/catalogo";
import { direccionDeFoto, listarResenas, type Resena } from "@/lib/resenas";
import { LARGO_MAXIMO_DEL_NOMBRE, LARGO_MAXIMO_DEL_TEXTO } from "@/lib/resenas-texto";
import {
  alternarResena,
  cambiarFotoDeResena,
  cargarResenasDeEjemplo,
  guardarResena,
  retirarFotoDeResena,
  retirarResenasDeEjemplo,
} from "@/lib/acciones";
import { EntradaFoto } from "@/components/entrada-foto";
import { rutaProducto, rutaVariante } from "@/lib/enlaces";
import { direccionCompleta, enlaceCompartir, negocio } from "@/config/negocio";
import { mensajePedirResena } from "@/lib/whatsapp";
import { fechaCorta, fechaDeLaBase } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Reseñas" };

/** Una reseña en el panel: lo que dice, de quién es, si se ve, y qué se puede hacer con ella. */
function ResenaDelPanel({ resena }: { resena: Resena }) {
  const foto = direccionDeFoto(resena);
  return (
    <li className={estilos.carteraCliente}>
      <p className={estilos.resenaTexto}>«{resena.texto}»</p>
      <p className={estilos.carteraDato}>
        {foto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="" width={44} height={44} className={estilos.fotoResena} />
        )}
        <strong>{resena.autor}</strong>
        {resena.detalle ? ` · ${resena.detalle}` : ""}
        <span className="ayuda"> · {fechaCorta(fechaDeLaBase(resena.creado_en))}</span>
      </p>
      <div className={estilos.carteraAcciones}>
        {resena.de_ejemplo ? (
          <span className={`${estilos.estado} ${estilos["estado--parcial"]}`}>De ejemplo: solo la ves tú</span>
        ) : !resena.con_permiso ? (
          <span className={`${estilos.estado} ${estilos["estado--por_pagar"]}`}>Falta el permiso</span>
        ) : resena.publicada ? (
          <span className={`${estilos.estado} ${estilos["estado--pagada"]}`}>Publicada</span>
        ) : (
          <span className={`${estilos.estado} ${estilos["estado--parcial"]}`}>Escondida</span>
        )}
        {!resena.de_ejemplo && (
          <form action={alternarResena}>
            <input type="hidden" name="id" value={resena.id} />
            <input type="hidden" name="publicada" value={resena.publicada && resena.con_permiso ? "0" : "1"} />
            <button type="submit" className={estilos.botonEnlace}>
              {!resena.con_permiso ? "Ya me dio permiso: publicar" : resena.publicada ? "Esconder" : "Publicar"}
            </button>
          </form>
        )}
        <Link href={`/admin/resenas/${resena.id}/eliminar`} className="enlace-fila">
          Eliminar
        </Link>
      </div>
      {!resena.de_ejemplo && (
        <details className={estilos.masDatos}>
          <summary>{foto ? "Cambiar o quitar la foto" : "Ponerle una foto"}</summary>
          <div className={estilos.accionesFila} style={{ flexWrap: "wrap", alignItems: "flex-end", marginTop: "var(--espacio-2)" }}>
            <form action={cambiarFotoDeResena} encType="multipart/form-data" className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
              <input type="hidden" name="id" value={resena.id} />
              <EntradaFoto nombre="foto" id={`foto-${resena.id}`} soloFoto ladoMaximo={480} />
              <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                Guardar foto
              </button>
            </form>
            {foto && (
              <form action={retirarFotoDeResena}>
                <input type="hidden" name="id" value={resena.id} />
                <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                  Quitar foto
                </button>
              </form>
            )}
          </div>
        </details>
      )}
    </li>
  );
}

/** Las reseñas de un producto sin marcas, o de una marca: con sus botones para pedir una y ver la página. */
function GrupoDeResenas({
  titulo,
  resenas,
  enLaWeb,
  pedir,
  ruta,
  clave,
  pequeno = false,
}: {
  titulo: string;
  resenas: Resena[];
  enLaWeb: boolean;
  pedir: string;
  ruta: string;
  clave: string;
  pequeno?: boolean;
}) {
  return (
    <>
      <div className={estilos.encabezado} style={{ marginBottom: "var(--espacio-3)" }}>
        {pequeno ? (
          <h3 className={estilos.subtituloPequeno}>
            {titulo} ({resenas.length})
          </h3>
        ) : (
          <h2 className={estilos.subtitulo} style={{ marginBottom: 0 }}>
            {titulo} ({resenas.length})
          </h2>
        )}
        {enLaWeb ? (
          <div className={estilos.carteraAcciones} style={{ marginTop: 0 }}>
            <a href={pedir} target="_blank" rel="noopener" className={estilos.whatsapp}>
              Pedir reseña por WhatsApp
            </a>
            <a href={ruta} target="_blank" rel="noopener">
              Ver cómo queda en la web
            </a>
          </div>
        ) : (
          <span className="ayuda">Escondido de la web</span>
        )}
      </div>
      {resenas.length === 0 ? (
        <p className="vacio">
          Todavía no tiene reseñas. <Link href={`/admin/resenas?clave=${clave}`}>Escribir la primera</Link>
        </p>
      ) : (
        <ul className={estilos.cartera}>
          {resenas.map((r) => (
            <ResenaDelPanel key={r.id} resena={r} />
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * Las reseñas: lo que dicen los negocios que compran. El dueño le pide el
 * comentario al cliente y lo escribe aquí con sus palabras. La de un
 * producto sin marcas sale en la página del producto; la de una marca, en
 * la página de esa marca, porque cada marca es otro producto.
 */
export default async function PaginaResenas({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const elegido = typeof parametros.clave === "string" ? parametros.clave : typeof parametros.producto === "string" ? parametros.producto : "";
  const [productos, variantes, resenas] = await Promise.all([listarProductos(), listarVariantes(), listarResenas()]);

  const opciones = vendiblesDe(productos, variantes);
  const variantesDe = agruparPorProducto(variantes);
  const deEjemplo = resenas.filter((r) => r.de_ejemplo).length;
  const delDueno = resenas.length - deEjemplo;
  const enLaWeb = resenas.filter((r) => !r.de_ejemplo && r.publicada && r.con_permiso).length;
  const sinPermiso = resenas.filter((r) => !r.de_ejemplo && !r.con_permiso).length;
  // El mensaje para pedir la reseña: sin número, para elegir el contacto en WhatsApp.
  const pedir = (nombre: string, ruta: string) =>
    enlaceCompartir(mensajePedirResena({ negocio: negocio.nombre, producto: nombre, enlace: direccionCompleta(ruta) }));

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
        {sinPermiso > 0 && (
          <div className={`${estilos.cifra} ${estilos["cifra--alerta"]}`}>
            <dt>Esperan el permiso</dt>
            <dd>{sinPermiso}</dd>
          </div>
        )}
      </dl>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Reseña nueva</h2>
        <p className={estilos.ayuda}>
          Pregúntale al cliente qué le parece el producto y escríbelo aquí con sus palabras. Sale en la página del producto (o de la marca, si
          tiene varias), en «Por qué elegirlo», con el nombre de su negocio: por eso hace falta su permiso.
        </p>
        <form action={guardarResena} className="formulario" encType="multipart/form-data">
          <div className="campo">
            <label htmlFor="resena-producto">Producto o marca</label>
            <select id="resena-producto" name="clave" required defaultValue={elegido}>
              <option value="" disabled>
                Elige un producto o una marca
              </option>
              {opciones.map((o) => (
                <option key={o.clave} value={o.clave}>
                  {o.nombre}
                </option>
              ))}
            </select>
            <span className="ayuda">De un producto con marcas, la reseña es de una de ellas: cada marca tiene la suya.</span>
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
                placeholder="Pizzería 33"
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
          <div className="campo">
            <label htmlFor="resena-foto">Foto (opcional)</label>
            <EntradaFoto nombre="foto" id="resena-foto" opcional soloFoto ladoMaximo={480} />
            <span className="ayuda">
              Pequeña y redonda junto al nombre, como en un comentario de Instagram: el local, el dueño o el plato. Se
              reduce sola.
            </span>
          </div>
          <label className={estilos.casilla}>
            <input type="checkbox" name="permiso" value="1" />
            <span>Me dio permiso para publicarla con su nombre</span>
          </label>
          <p className="ayuda">Sin marcar, se guarda escondida hasta que te lo dé.</p>
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
        const marcas = (variantesDe.get(p.id) ?? []).filter((v) => v.activo || suyas.some((r) => r.variante_id === v.id));
        const sinMarca = suyas.filter((r) => r.variante_id === null);
        if (marcas.length === 0) {
          return (
            <section key={p.id} className="tarjeta">
              <GrupoDeResenas
                titulo={p.nombre}
                resenas={suyas}
                enLaWeb={p.activo === 1}
                pedir={pedir(p.nombre, rutaProducto(p))}
                ruta={rutaProducto(p)}
                clave={String(p.id)}
              />
            </section>
          );
        }
        return (
          <section key={p.id} className="tarjeta">
            <h2 className={estilos.subtitulo}>
              {p.nombre} ({suyas.length})
            </h2>
            {sinMarca.length > 0 && (
              <div className={estilos.grupoResenas}>
                <h3 className={estilos.subtituloPequeno}>Del producto entero ({sinMarca.length})</h3>
                <p className={estilos.ayuda}>
                  Son de antes de las marcas: salen en la página de {p.nombre.toLowerCase()}. Las nuevas se escriben en su marca.
                </p>
                <ul className={estilos.cartera}>
                  {sinMarca.map((r) => (
                    <ResenaDelPanel key={r.id} resena={r} />
                  ))}
                </ul>
              </div>
            )}
            {marcas.map((v) => (
              <div key={v.id} className={estilos.grupoResenas}>
                <GrupoDeResenas
                  titulo={v.nombre}
                  resenas={suyas.filter((r) => r.variante_id === v.id)}
                  enLaWeb={p.activo === 1 && v.activo === 1}
                  pedir={pedir(nombreDeVenta(p.nombre, v.nombre), rutaVariante(p, v))}
                  ruta={rutaVariante(p, v)}
                  clave={`${p.id}-${v.id}`}
                  pequeno
                />
              </div>
            ))}
          </section>
        );
      })}

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Reseñas de ejemplo</h2>
        <p className={estilos.ayuda}>
          Sirven para ver cómo queda la página antes de tener las de verdad. No las dijo ningún cliente: por eso{" "}
          <strong>solo las ves tú</strong>, con el panel abierto, y llevan la etiqueta «Ejemplo». Quien entra a la web
          no las ve. Cada marca lleva las suyas.
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
