import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { direccionCompleta, enlaceCompartir, enlaceWhatsapp, negocio } from "@/config/negocio";
import { buscarProducto, type Producto } from "@/lib/productos";
import { buscarVariante, direccionDeFotoDeVariante, variantesDeProducto, type Variante } from "@/lib/variantes";
import { nombreDeVenta } from "@/lib/catalogo";
import { leerTasa } from "@/lib/ajustes";
import { resenasDeVariante } from "@/lib/resenas";
import { haySesion } from "@/lib/sesion";
import { unidadEnPalabras } from "@/lib/dinero";
import { idDeRuta, rutaProducto, rutaVariante } from "@/lib/enlaces";
import {
  CabeceraPublica,
  DatosEstructurados,
  LineaTasa,
  PiePublico,
  PreciosProducto,
  datosDeLaTienda,
  ventajasDe,
} from "@/components/publico";
import { IlustracionProducto } from "@/components/ilustracion-producto";
import { AvisoDeEjemplos, ListaDeResenas } from "@/components/resenas";
import { ComoComprar } from "@/components/como-comprar";
import estilos from "../../../page.module.css";

type Parametros = { params: Promise<{ producto: string; marca: string }> };

/** La marca de la dirección, solo si existe, es de ese producto y los dos están publicados. */
async function marcaDe(segmentoProducto: string, segmentoMarca: string): Promise<{ producto: Producto; variante: Variante } | null> {
  const idProducto = idDeRuta(segmentoProducto);
  const idMarca = idDeRuta(segmentoMarca);
  if (!idProducto || !idMarca) return null;
  const [producto, variante] = await Promise.all([buscarProducto(idProducto), buscarVariante(idMarca)]);
  if (!producto || !producto.activo || !variante || !variante.activo || variante.producto_id !== producto.id) return null;
  return { producto, variante };
}

/** Una frase que resume la marca, para los buscadores y la vista previa. */
function resumenDe(producto: Producto, variante: Variante): string {
  const ventajas = ventajasDe(variante.descripcion);
  const detalle = ventajas.length > 0 ? `${ventajas.join(". ")}. ` : "";
  return `${nombreDeVenta(producto.nombre, variante.nombre)} en ${negocio.localidad}. ${detalle}Solo al mayor, a tasa BCV.`;
}

export async function generateMetadata({ params }: Parametros): Promise<Metadata> {
  const { producto: segmentoProducto, marca: segmentoMarca } = await params;
  const encontrada = await marcaDe(segmentoProducto, segmentoMarca);
  if (!encontrada) return { title: "Producto", robots: { index: false } };
  const { producto, variante } = encontrada;
  const nombre = nombreDeVenta(producto.nombre, variante.nombre);
  const ruta = rutaVariante(producto, variante);
  return {
    title: nombre,
    description: resumenDe(producto, variante),
    // Se llega con cualquier nombre detrás de los números; la dirección buena es una.
    alternates: { canonical: ruta },
    openGraph: {
      type: "website",
      locale: "es_VE",
      siteName: negocio.nombre,
      title: `${nombre} · ${negocio.nombre}`,
      description: resumenDe(producto, variante),
      url: ruta,
    },
  };
}

/** La marca y su precio, como los entienden los buscadores. Las reseñas no van: Google no acepta las que recoge el propio negocio. */
function datosDeLaMarca(producto: Producto, variante: Variante): Record<string, unknown> {
  const ruta = direccionCompleta(rutaVariante(producto, variante));
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: nombreDeVenta(producto.nombre, variante.nombre),
    description: resumenDe(producto, variante),
    image: `${ruta}/opengraph-image`,
    url: ruta,
    brand: { "@type": "Brand", name: variante.nombre },
    offers:
      variante.precio_usd === null
        ? undefined
        : {
            "@type": "Offer",
            price: variante.precio_usd,
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            url: ruta,
            seller: datosDeLaTienda(),
          },
  };
}

/**
 * La página de una marca o presentación (queso amarillo Kemmental, suero
 * de leche Guaralact): a ella se llega pinchando la marca en la página de
 * su producto. Su foto, su precio, su propia descripción y las reseñas de
 * los negocios que la compran, que son de esa marca y no de las otras.
 * Las de ejemplo solo las ve el dueño, con la sesión del panel abierta.
 */
export default async function PaginaMarca({ params }: Parametros) {
  const { producto: segmentoProducto, marca: segmentoMarca } = await params;
  const encontrada = await marcaDe(segmentoProducto, segmentoMarca);
  if (!encontrada) notFound();
  const { producto, variante } = encontrada;

  const esElDueno = await haySesion();
  const [tasa, resenas, hermanas] = await Promise.all([leerTasa(), resenasDeVariante(variante.id, esElDueno), variantesDeProducto(producto.id, true)]);
  const nombre = nombreDeVenta(producto.nombre, variante.nombre);
  const foto = direccionDeFotoDeVariante(variante);
  const ventajas = ventajasDe(variante.descripcion);
  const otras = hermanas.filter((v) => v.id !== variante.id);
  const pedir = enlaceWhatsapp(`Hola, quiero pedir ${nombre.toLowerCase()}.`);
  const mayor = enlaceWhatsapp(`Hola, quiero comprar ${nombre.toLowerCase()} al mayor.`);
  const compartir = enlaceCompartir(`${nombre} en ${negocio.nombre}: ${direccionCompleta(rutaVariante(producto, variante))}`);

  return (
    <>
      <DatosEstructurados datos={datosDeLaMarca(producto, variante)} />
      <CabeceraPublica />

      <main id="contenido" className={estilos.contenido}>
        <section className={estilos.seccion}>
          <Link href={rutaProducto(producto)} className={estilos.volver}>
            ← {producto.nombre}
          </Link>

          <article className={estilos.ficha}>
            <header className={estilos.fichaCabecera}>
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt={nombre} width={800} height={800} className={estilos.fotoGrande} />
              ) : (
                <IlustracionProducto nombre={producto.nombre} className={estilos.dibujoGrande} />
              )}
              <h1 className={estilos.fichaNombre}>{nombre}</h1>
              <p className={estilos.fichaUnidad}>Solo al mayor, por {unidadEnPalabras(producto.unidad)}</p>
            </header>

            <div className={estilos.bloque}>
              <h2 className={estilos.bloqueTitulo}>Precio de hoy</h2>
              <PreciosProducto producto={{ precio_usd: variante.precio_usd, unidad: producto.unidad }} tasa={tasa?.valor ?? null} />
              <LineaTasa tasa={tasa} className={estilos.tasa} />
              {pedir && (
                <a className={`boton boton--acento ${estilos.botonPedir}`} href={pedir} target="_blank" rel="noopener">
                  Pedir por WhatsApp
                </a>
              )}
              <a className={estilos.compartir} href={compartir} target="_blank" rel="noopener">
                Compartir este producto por WhatsApp
              </a>
            </div>

            {(resenas.length > 0 || ventajas.length > 0) && (
              <div className={estilos.bloque}>
                <h2 className={estilos.bloqueTitulo}>Por qué elegirlo</h2>
                {resenas.some((r) => r.de_ejemplo) && <AvisoDeEjemplos />}
                <ListaDeResenas resenas={resenas} />
                {ventajas.length > 0 && (
                  <ul className={estilos.ventajas}>
                    {ventajas.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <ComoComprar mayor={mayor} />

            {otras.length > 0 && (
              <div>
                <h2 className={estilos.subtitulo}>Otras marcas de {producto.nombre.toLowerCase()}</h2>
                <ul className={estilos.otros}>
                  {otras.map((v) => {
                    const suFoto = direccionDeFotoDeVariante(v);
                    return (
                      <li key={v.id}>
                        <Link href={rutaVariante(producto, v)} className={estilos.otro}>
                          {suFoto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={suFoto} alt="" width={64} height={64} className={estilos.otroFoto} loading="lazy" />
                          ) : (
                            <IlustracionProducto nombre={producto.nombre} />
                          )}
                          {v.nombre}
                        </Link>
                      </li>
                    );
                  })}
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
