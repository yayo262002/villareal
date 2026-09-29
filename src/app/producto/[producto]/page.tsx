import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { enlaceWhatsapp, negocio } from "@/config/negocio";
import { buscarProducto, listarProductos } from "@/lib/productos";
import { leerTasa } from "@/lib/ajustes";
import { bs, fechaCorta, nombreUnidad } from "@/lib/dinero";
import { idDeRuta, rutaProducto } from "@/lib/enlaces";
import { CabeceraPublica, PiePublico, PreciosProducto, ventajasDe } from "@/components/publico";
import { IlustracionProducto } from "@/components/ilustracion-producto";
import estilos from "../../page.module.css";

type Parametros = { params: Promise<{ producto: string }> };

/** El producto de la dirección, solo si existe y está publicado. */
async function productoDe(segmento: string) {
  const id = idDeRuta(segmento);
  const producto = id ? await buscarProducto(id) : null;
  return producto && producto.activo ? producto : null;
}

export async function generateMetadata({ params }: Parametros): Promise<Metadata> {
  const { producto: segmento } = await params;
  const producto = await productoDe(segmento);
  if (!producto) return { title: "Producto" };
  const ventajas = ventajasDe(producto.descripcion);
  return {
    title: producto.nombre,
    description: ventajas.length > 0 ? `${producto.nombre}: ${ventajas.join(", ").toLowerCase()}.` : negocio.descripcion,
  };
}

/**
 * La página de un producto: a ella llevan «Ver detalles» y el nombre de
 * cada tarjeta de la portada. Dibujo grande, precios, ventajas, cómo se paga
 * y dónde se recoge, con el botón de pedir siempre a mano.
 */
export default async function PaginaProducto({ params }: Parametros) {
  const { producto: segmento } = await params;
  const producto = await productoDe(segmento);
  if (!producto) notFound();

  const [tasa, todos] = await Promise.all([leerTasa(), listarProductos(true)]);
  const ventajas = ventajasDe(producto.descripcion);
  const otros = todos.filter((p) => p.id !== producto.id);
  const pedir = enlaceWhatsapp(`Hola, quiero pedir ${producto.nombre.toLowerCase()}.`);
  const mayor = enlaceWhatsapp(`Hola, quiero comprar ${producto.nombre.toLowerCase()} al mayor.`);

  return (
    <>
      <CabeceraPublica />

      <main className={estilos.contenido}>
        <section className={estilos.seccion}>
          <Link href="/" className={estilos.volver}>
            ← Todos los productos
          </Link>

          <article className={estilos.ficha}>
            <header className={estilos.fichaCabecera}>
              <IlustracionProducto nombre={producto.nombre} className={estilos.dibujoGrande} />
              <h1 className={estilos.fichaNombre}>{producto.nombre}</h1>
              <p className={estilos.fichaUnidad}>Se vende por {nombreUnidad(producto.unidad)}, al detal y al mayor</p>
            </header>

            <div className={estilos.bloque}>
              <h2 className={estilos.bloqueTitulo}>Precio de hoy</h2>
              <PreciosProducto producto={producto} tasa={tasa?.valor ?? null} />
              {tasa && (
                <p className={estilos.tasa}>
                  A la tasa de {bs(tasa.valor)} por dólar, del {fechaCorta(tasa.actualizada_en)}.
                </p>
              )}
              {pedir && (
                <a className={`boton boton--acento ${estilos.botonGrande}`} style={{ marginTop: 0 }} href={pedir} target="_blank" rel="noopener">
                  Pedir por WhatsApp
                </a>
              )}
            </div>

            {ventajas.length > 0 && (
              <div className={estilos.bloque}>
                <h2 className={estilos.bloqueTitulo}>Por qué elegirlo</h2>
                <ul className={estilos.ventajas}>
                  {ventajas.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className={estilos.bloque}>
              <h2 className={estilos.bloqueTitulo}>Cómo comprar</h2>
              <dl className={estilos.datos}>
                <div>
                  <dt>Formas de pago</dt>
                  <dd>Pago móvil, transferencia, efectivo, Zelle o Binance. En bolívares, a la tasa del día.</dd>
                </div>
                {(negocio.direccion || negocio.ciudad) && (
                  <div>
                    <dt>Tienda física</dt>
                    <dd>{[negocio.direccion, negocio.ciudad].filter(Boolean).join(", ")}</dd>
                  </div>
                )}
                {negocio.horario && (
                  <div>
                    <dt>Horario</dt>
                    <dd>{negocio.horario}</dd>
                  </div>
                )}
                {mayor && (
                  <div>
                    <dt>Al mayor</dt>
                    <dd>
                      <a href={mayor} target="_blank" rel="noopener">
                        Consulta las condiciones por WhatsApp
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {otros.length > 0 && (
              <div>
                <h2 className={estilos.subtitulo}>Otros productos</h2>
                <ul className={estilos.otros}>
                  {otros.map((p) => (
                    <li key={p.id}>
                      <Link href={rutaProducto(p)} className={estilos.otro}>
                        <IlustracionProducto nombre={p.nombre} />
                        {p.nombre}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        </section>
      </main>

      <PiePublico />
    </>
  );
}
