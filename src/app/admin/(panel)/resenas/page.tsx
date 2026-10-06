import Link from "next/link";
import { listarProductos } from "@/lib/productos";
import { agruparPorProducto, listarVariantes } from "@/lib/variantes";
import { nombreDeVenta, vendiblesDe } from "@/lib/catalogo";
import { listarResenas, type Resena } from "@/lib/resenas";
import { cargarResenasDeEjemplo, retirarResenasDeEjemplo } from "@/lib/acciones";
import { rutaProducto, rutaVariante } from "@/lib/enlaces";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { FormularioDeResena, ResenaDelPanel, enlacePedirResena } from "@/components/resenas-panel";
import estilos from "../panel.module.css";

export const metadata = { title: "Reseñas" };

const AQUI = "/admin/resenas";

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
  pedir: string | null;
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
            {pedir && (
              <a href={pedir} target="_blank" rel="noopener" className={estilos.whatsapp}>
                Pedir reseña por WhatsApp
              </a>
            )}
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
            <ResenaDelPanel key={r.id} resena={r} volverA={AQUI} />
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * Las reseñas: lo que dicen los negocios que compran. El dueño le pide el
 * comentario al cliente y lo escribe aquí (o en la ficha del producto)
 * con sus palabras. Salen en los detalles del producto en la web; la de
 * una marca, también en la página de esa marca.
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
          Pregúntale al cliente qué le parece el producto y escríbelo aquí con sus palabras (o en la ficha del producto, en «Reseñas»). Sale en los
          detalles del producto, en «Por qué elegirlo», con el nombre de su negocio: por eso hace falta su permiso.
        </p>
        <FormularioDeResena opciones={opciones.map((o) => ({ clave: o.clave, nombre: o.nombre }))} elegida={elegido} volverA={AQUI} />
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
                pedir={enlacePedirResena(p.nombre, rutaProducto(p))}
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
                <p className={estilos.ayuda}>Son de antes de las marcas: salen en los detalles de {p.nombre.toLowerCase()}. Las nuevas se escriben en su marca.</p>
                <ul className={estilos.cartera}>
                  {sinMarca.map((r) => (
                    <ResenaDelPanel key={r.id} resena={r} volverA={AQUI} />
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
                  pedir={enlacePedirResena(nombreDeVenta(p.nombre, v.nombre), rutaVariante(p, v))}
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
          Sirven para ver cómo queda la página antes de tener las de verdad. No las dijo ningún cliente: por eso <strong>solo las ves tú</strong>,
          con el panel abierto, y llevan la etiqueta «Ejemplo». Quien entra a la web no las ve. Cada marca lleva las suyas.
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
