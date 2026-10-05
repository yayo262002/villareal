import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { direccionCompleta, enlaceCompartir, enlaceWhatsapp, negocio } from "@/config/negocio";
import { buscarProducto, direccionDeFotoDeProducto, type Producto } from "@/lib/productos";
import { imagenDeProducto } from "@/lib/fotos-referenciales";
import { buscarFamilia } from "@/lib/familias";
import { presentacionYContenido } from "@/lib/marcas-texto";
import { buscarVariante, direccionDeFotoDeVariante, variantesDeProducto, type Variante } from "@/lib/variantes";
import { claveDe, nombreDeVenta, porQueSeCobra } from "@/lib/catalogo";
import { leerTasa } from "@/lib/ajustes";
import { resenasDeVariante } from "@/lib/resenas";
import { haySesion } from "@/lib/sesion";
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
import { FotoDeProducto } from "@/components/foto-de-producto";
import { AvisoDeEjemplos, ListaDeResenas } from "@/components/resenas";
import { ComoComprar } from "@/components/como-comprar";
import { BotonAgregar } from "@/components/carrito/boton-agregar";
import { IconoWhatsapp } from "@/components/icono-whatsapp";
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
  return `${nombreDeVenta(producto.nombre, variante.nombre)} en ${negocio.localidad}. ${detalle}Al mayor, a tasa BCV.`;
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
    brand: variante.marca ? { "@type": "Brand", name: variante.marca } : undefined,
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
 * su producto. Su foto, su precio con «Agregar al carrito», su propia
 * descripción y las reseñas de los negocios que la compran, que son de esa
 * marca y no de las otras. Las de ejemplo solo las ve el dueño, con la
 * sesión del panel abierta.
 */
export default async function PaginaMarca({ params }: Parametros) {
  const { producto: segmentoProducto, marca: segmentoMarca } = await params;
  const encontrada = await marcaDe(segmentoProducto, segmentoMarca);
  if (!encontrada) notFound();
  const { producto, variante } = encontrada;

  const esElDueno = await haySesion();
  const [tasa, resenas, hermanas, familia] = await Promise.all([
    leerTasa(),
    resenasDeVariante(variante.id, esElDueno),
    variantesDeProducto(producto.id, true),
    producto.familia_id ? buscarFamilia(producto.familia_id) : null,
  ]);
  const presentacion = presentacionYContenido(variante);
  const nombre = nombreDeVenta(producto.nombre, variante.nombre);
  const foto = direccionDeFotoDeVariante(variante);
  // Sin foto de la marca, la del producto (la suya o la de referencia).
  const delProducto = imagenDeProducto(direccionDeFotoDeProducto(producto), producto.nombre);
  const ventajas = ventajasDe(variante.descripcion);
  const otras = hermanas.filter((v) => v.id !== variante.id);
  const pedir = enlaceWhatsapp(`Hola, quiero pedir ${nombre.toLowerCase()}.`);
  const mayor = enlaceWhatsapp(`Hola, quiero comprar ${nombre.toLowerCase()} al mayor.`);
  const compartir = enlaceCompartir(`${nombre} en ${negocio.nombre}: ${direccionCompleta(rutaVariante(producto, variante))}`);

  return (
    <>
      <DatosEstructurados datos={datosDeLaMarca(producto, variante)} />
      <CabeceraPublica actual="productos" />

      <main id="contenido" className={estilos.contenido}>
        <nav className={estilos.migas} aria-label="Estás en">
          <Link href="/">Inicio</Link>
          <Link href="/productos">Productos</Link>
          {familia && familia.activa === 1 && <Link href={`/categoria/${familia.slug}`}>{familia.nombre}</Link>}
          <Link href={rutaProducto(producto)}>{producto.nombre}</Link>
          <span aria-current="page">{variante.marca || variante.nombre}</span>
        </nav>

        <article className={estilos.ficha}>
          <header className={estilos.fichaCabecera}>
            <FotoDeProducto imagen={foto ? { src: foto, referencial: false } : delProducto} nombre={nombre} className={estilos.fotoGrande} tamano={800} prioridad aviso />
          </header>

          <div className={estilos.fichaPrincipal}>
            {/* El tipo de producto manda; la marca y la presentación lo acompañan. */}
            {variante.marca && <p className={estilos.fichaMarca}>Marca {variante.marca}</p>}
            <h1 className={estilos.fichaNombre}>{producto.nombre}</h1>
            <p className={estilos.fichaUnidad}>
              {presentacion ? `${presentacion} · ` : ""}Al mayor, por {porQueSeCobra({ ...producto, presentacion: "", contenido: "" })}
            </p>

            <div className={estilos.bloque}>
              <h2 className={estilos.bloqueTitulo}>Precio de hoy</h2>
              <PreciosProducto producto={{ precio_usd: variante.precio_usd, unidad: producto.unidad }} tasa={tasa?.valor ?? null} />
              <LineaTasa tasa={tasa} className={estilos.tasa} />
              <BotonAgregar clave={claveDe(producto.id, variante.id)} nombre={nombre} unidad={producto.unidad} conCantidad />
              {pedir && (
                <a className={`boton ${estilos.botonWhatsapp} ${estilos.botonPedir}`} href={pedir} target="_blank" rel="noopener">
                  <IconoWhatsapp />
                  Pedir por WhatsApp
                </a>
              )}
              <a className={estilos.compartir} href={compartir} target="_blank" rel="noopener">
                Compartir este producto por WhatsApp
              </a>
            </div>
          </div>

          {(resenas.length > 0 || ventajas.length > 0) && (
            <section className={`${estilos.bloque} ${estilos.fichaAncha}`} aria-labelledby="titulo-por-que">
              <h2 id="titulo-por-que" className={estilos.bloqueTitulo}>
                Por qué elegirlo
              </h2>
              {resenas.some((r) => r.de_ejemplo) && <AvisoDeEjemplos />}
              <ListaDeResenas resenas={resenas} />
              {ventajas.length > 0 && (
                <ul className={estilos.ventajas}>
                  {ventajas.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <div className={estilos.fichaAncha}>
            <ComoComprar mayor={mayor} />
          </div>

          {otras.length > 0 && (
            <section className={estilos.fichaAncha} aria-labelledby="titulo-otras">
              <h2 id="titulo-otras" className={estilos.subtitulo}>
                Más de {producto.nombre.toLowerCase()}
              </h2>
              <ul className={estilos.otros}>
                {otras.map((v) => {
                  const suFoto = direccionDeFotoDeVariante(v);
                  return (
                    <li key={v.id}>
                      <Link href={rutaVariante(producto, v)} className={estilos.otro}>
                        <FotoDeProducto imagen={suFoto ? { src: suFoto, referencial: false } : delProducto} nombre={v.nombre} className={estilos.otroFoto} tamano={128} />
                        {v.marca || v.nombre}
                        {v.marca && presentacionYContenido(v) && <span className={estilos.otroDetalle}>{presentacionYContenido(v)}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </article>
      </main>

      <PiePublico />
    </>
  );
}
