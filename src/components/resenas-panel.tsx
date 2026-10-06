import Link from "next/link";
import type { Producto } from "@/lib/productos";
import type { Variante } from "@/lib/variantes";
import { direccionDeFoto, type Resena } from "@/lib/resenas";
import { LARGO_MAXIMO_DEL_NOMBRE, LARGO_MAXIMO_DEL_TEXTO } from "@/lib/resenas-texto";
import { nombreDeVenta } from "@/lib/catalogo";
import { rutaProducto, rutaVariante } from "@/lib/enlaces";
import { direccionCompleta, enlaceCompartir, negocio } from "@/config/negocio";
import { mensajePedirResena } from "@/lib/whatsapp";
import { fechaCorta, fechaDeLaBase } from "@/lib/dinero";
import { alternarResena, cambiarFotoDeResena, guardarResena, retirarFotoDeResena } from "@/lib/acciones";
import { EntradaFoto } from "@/components/entrada-foto";
import estilos from "@/app/admin/(panel)/panel.module.css";

/**
 * Las piezas de las reseñas en el panel, compartidas por la página de
 * Reseñas y por la ficha de cada producto: una reseña con lo que se puede
 * hacer con ella, el formulario para escribir una nueva y la sección
 * entera de un producto con las suyas y las de sus marcas. `volverA` dice
 * a qué página vuelve cada acción.
 */

/** Una reseña en el panel: lo que dice, de quién es, si se ve, y qué se puede hacer con ella. */
export function ResenaDelPanel({ resena, volverA, deQue }: { resena: Resena; volverA: string; deQue?: string }) {
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
        {deQue ? <span className="ayuda"> · sobre {deQue}</span> : null}
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
            <input type="hidden" name="volver_a" value={volverA} />
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
              <input type="hidden" name="volver_a" value={volverA} />
              <EntradaFoto nombre="foto" id={`foto-${resena.id}`} soloFoto ladoMaximo={480} />
              <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                Guardar foto
              </button>
            </form>
            {foto && (
              <form action={retirarFotoDeResena}>
                <input type="hidden" name="id" value={resena.id} />
                <input type="hidden" name="volver_a" value={volverA} />
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

/**
 * El formulario de una reseña nueva. `opciones` son los productos o marcas
 * de los que puede ser (en la ficha de un producto, solo él y sus marcas);
 * con una sola opción no se pregunta.
 */
export function FormularioDeResena({
  opciones,
  elegida,
  volverA,
  idBase = "resena",
}: {
  opciones: { clave: string; nombre: string }[];
  elegida: string;
  volverA: string;
  idBase?: string;
}) {
  return (
    <form action={guardarResena} className="formulario" encType="multipart/form-data">
      <input type="hidden" name="volver_a" value={volverA} />
      {opciones.length === 1 ? (
        <input type="hidden" name="clave" value={opciones[0].clave} />
      ) : (
        <div className="campo">
          <label htmlFor={`${idBase}-producto`}>Producto o marca</label>
          <select id={`${idBase}-producto`} name="clave" required defaultValue={elegida}>
            <option value="" disabled>
              Elige un producto o una marca
            </option>
            {opciones.map((o) => (
              <option key={o.clave} value={o.clave}>
                {o.nombre}
              </option>
            ))}
          </select>
          <span className="ayuda">De un producto con marcas, la reseña es de una de ellas: dice de cuál habla el cliente.</span>
        </div>
      )}
      <div className="formulario__fila">
        <div className="campo">
          <label htmlFor={`${idBase}-autor`}>Quién lo dice</label>
          <input id={`${idBase}-autor`} name="autor" type="text" required maxLength={LARGO_MAXIMO_DEL_NOMBRE} autoComplete="off" placeholder="Pizzería 33" />
          <span className="ayuda">El nombre del negocio o de la persona.</span>
        </div>
        <div className="campo">
          <label htmlFor={`${idBase}-detalle`}>Qué negocio es (opcional)</label>
          <input id={`${idBase}-detalle`} name="detalle" type="text" maxLength={LARGO_MAXIMO_DEL_NOMBRE} autoComplete="off" placeholder="Pizzería · Centro de Barquisimeto" />
        </div>
      </div>
      <div className="campo">
        <label htmlFor={`${idBase}-texto`}>Qué dijo</label>
        <textarea id={`${idBase}-texto`} name="texto" required rows={4} maxLength={LARGO_MAXIMO_DEL_TEXTO} placeholder="Gratina muy bien y no se quema." />
        <span className="ayuda">Sin comillas: la web las pone. Corto se lee mejor.</span>
      </div>
      <div className="campo">
        <label htmlFor={`${idBase}-foto`}>Foto (opcional)</label>
        <EntradaFoto nombre="foto" id={`${idBase}-foto`} opcional soloFoto ladoMaximo={480} />
        <span className="ayuda">Pequeña y redonda junto al nombre, como en un comentario de Instagram: el local, el dueño o el plato. Se reduce sola.</span>
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
  );
}

/** El mensaje para pedir la reseña por WhatsApp: sin número, para elegir el contacto. */
export function enlacePedirResena(nombre: string, ruta: string): string | null {
  return enlaceCompartir(mensajePedirResena({ negocio: negocio.nombre, producto: nombre, enlace: direccionCompleta(ruta) }));
}

/**
 * Las reseñas de un producto en su ficha: las que tiene (las suyas y las
 * de cada marca, diciendo de cuál), el formulario para escribir la
 * siguiente y el botón para pedirla por WhatsApp. Lo que se guarda aquí
 * sale en los detalles del producto en la web, en «Por qué elegirlo».
 */
export function ResenasDelProducto({ producto, variantes, resenas }: { producto: Producto; variantes: Variante[]; resenas: Resena[] }) {
  const volverA = `/admin/productos/${producto.id}#resenas`;
  const publicadas = variantes.filter((v) => v.activo);
  const opciones =
    publicadas.length === 0
      ? [{ clave: String(producto.id), nombre: producto.nombre }]
      : publicadas.map((v) => ({ clave: `${producto.id}-${v.id}`, nombre: nombreDeVenta(producto.nombre, v.nombre) }));
  const enLaWeb = resenas.filter((r) => !r.de_ejemplo && r.publicada && r.con_permiso).length;
  const pedir = enlacePedirResena(producto.nombre, rutaProducto(producto));
  return (
    <section className="tarjeta" id="resenas" aria-labelledby="titulo-resenas">
      <div className={estilos.encabezado} style={{ marginBottom: "var(--espacio-3)" }}>
        <h2 id="titulo-resenas" className={estilos.subtitulo} style={{ marginBottom: 0 }}>
          Reseñas ({resenas.length})
        </h2>
        {pedir && producto.activo === 1 && (
          <div className={estilos.carteraAcciones} style={{ marginTop: 0 }}>
            <a href={pedir} target="_blank" rel="noopener" className={estilos.whatsapp}>
              Pedir reseña por WhatsApp
            </a>
          </div>
        )}
      </div>
      <p className={estilos.ayuda}>
        Lo que dicen los negocios que compran {producto.nombre.toLowerCase()}. Cada una sale en los detalles del producto en la web, en «Por qué
        elegirlo»{publicadas.length > 0 ? ", diciendo de qué marca habla, y también en la página de esa marca" : ""}. {enLaWeb === 0 ? "Ninguna se ve todavía en la web." : enLaWeb === 1 ? "Una se ve en la web." : `${enLaWeb} se ven en la web.`}
      </p>
      {resenas.length > 0 && (
        <ul className={estilos.cartera}>
          {resenas.map((r) => {
            const marca = r.variante_id ? variantes.find((v) => v.id === r.variante_id) : null;
            return <ResenaDelPanel key={r.id} resena={r} volverA={volverA} deQue={marca ? marca.marca || marca.nombre : undefined} />;
          })}
        </ul>
      )}
      <details className={estilos.masDatos} open={resenas.length === 0}>
        <summary>＋ Añadir una reseña de un cliente</summary>
        <div style={{ marginTop: "var(--espacio-3)" }}>
          <FormularioDeResena opciones={opciones} elegida={opciones[0].clave} volverA={volverA} idBase={`resena-${producto.id}`} />
        </div>
      </details>
      {publicadas.length > 0 && (
        <p className={estilos.ayuda} style={{ marginTop: "var(--espacio-3)" }}>
          Para pedir la reseña de una marca concreta:{" "}
          {publicadas.map((v, i) => {
            const enlace = enlacePedirResena(nombreDeVenta(producto.nombre, v.nombre), rutaVariante(producto, v));
            return (
              <span key={v.id}>
                {i > 0 ? " · " : ""}
                {enlace ? (
                  <a href={enlace} target="_blank" rel="noopener">
                    {v.marca || v.nombre}
                  </a>
                ) : (
                  v.marca || v.nombre
                )}
              </span>
            );
          })}
          .
        </p>
      )}
    </section>
  );
}
