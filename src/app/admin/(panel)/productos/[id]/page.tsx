import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarProducto, categoriasDeProducto, direccionDeFotoDeProducto, seccionesDeProducto } from "@/lib/productos";
import { listarMarcas, presentacionesUsadas } from "@/lib/marcas";
import { direccionDeFotoDeVariante, variantesDeProducto } from "@/lib/variantes";
import { listarFamilias } from "@/lib/familias";
import { existenciaSinMarca } from "@/lib/inventario";
import { NOMBRE_ESTADO_PRODUCTO, estadoDeProducto, type EstadoProducto } from "@/lib/catalogo";
import { leerTasa } from "@/lib/ajustes";
import { rutaProducto } from "@/lib/enlaces";
import { alternarProducto, retirarFotoDeProducto } from "@/lib/acciones";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { FormularioProducto } from "@/components/formulario-producto";
import { LineaPrecio, MarcasDelProducto } from "@/components/marcas-producto";
import { FotoDeProducto } from "@/components/foto-de-producto";
import { imagenDeProducto } from "@/lib/fotos-referenciales";
import estilos from "../../panel.module.css";

const CLASE_DE_ESTADO: Record<EstadoProducto, string> = { activo: "estado--pagada", borrador: "estado--parcial", inactivo: "estado--por_pagar" };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const producto = await buscarProducto(Number(id));
  return { title: producto?.nombre ?? "Producto" };
}

/** La ficha de un producto: todo lo suyo en un formulario, su foto, si está en la web, sus marcas y, al final, borrarlo. */
export default async function PaginaProducto({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ParametrosAviso> }) {
  const { id } = await params;
  const parametros = await searchParams;
  const numero = Number(id);
  const producto = Number.isSafeInteger(numero) && numero > 0 ? await buscarProducto(numero) : null;
  if (!producto) notFound();

  const [categorias, variantes, familias, tasa, existencia, secciones, marcas, presentaciones] = await Promise.all([
    categoriasDeProducto(producto.id),
    variantesDeProducto(producto.id),
    listarFamilias(),
    leerTasa(),
    existenciaSinMarca(producto.id),
    seccionesDeProducto(producto.id),
    listarMarcas(),
    presentacionesUsadas(),
  ]);
  const estado = estadoDeProducto(producto);
  const conMarcas = variantes.some((v) => v.activo);
  const foto = direccionDeFotoDeProducto(producto);
  const publicadas = variantes.filter((v) => v.activo);
  const fotoDeSuMarca = publicadas.length === 1 ? direccionDeFotoDeVariante(publicadas[0]) : null;

  return (
    <>
      <div className={estilos.encabezado}>
        <div>
          <p>
            <Link href="/admin/productos">← Productos</Link>
          </p>
          <h1 className={estilos.titulo}>{producto.nombre}</h1>
        </div>
        <span className={`${estilos.estado} ${estilos[CLASE_DE_ESTADO[estado]]}`}>{NOMBRE_ESTADO_PRODUCTO[estado]}</span>
      </div>
      <Avisos parametros={parametros} />

      <section className="tarjeta">
        <div className={estilos.varianteTitulo} style={{ marginBottom: "var(--espacio-3)" }}>
          <FotoDeProducto imagen={imagenDeProducto(foto, producto.nombre, fotoDeSuMarca)} nombre={producto.nombre} className={estilos.fotoMediana} tamano={144} />
          <ul className={estilos.precioResumen} style={{ margin: 0 }}>
            <LineaPrecio nombre="Precio al mayor" precio={producto.precio_usd} margen={producto.margen_pct} costo={producto.costo_usd} tasa={tasa?.valor ?? null} unidad={producto.unidad} />
          </ul>
        </div>
        <div className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
          {estado === "activo" ? (
            <a href={rutaProducto(producto)} target="_blank" rel="noopener" className={`boton boton--secundario ${estilos.botonPequeno}`}>
              Ver en la web
            </a>
          ) : null}
          <form action={alternarProducto}>
            <input type="hidden" name="id" value={producto.id} />
            <input type="hidden" name="activo" value={estado === "activo" ? "0" : "1"} />
            <input type="hidden" name="volver_a" value={`/admin/productos/${producto.id}`} />
            <button type="submit" className={`boton ${estado === "activo" ? "boton--secundario" : ""} ${estilos.botonPequeno}`}>
              {estado === "activo" ? "Ocultar de la web" : estado === "borrador" ? "Publicar: sacarlo del borrador" : "Publicar en la web"}
            </button>
          </form>
          {foto && (
            <form action={retirarFotoDeProducto}>
              <input type="hidden" name="id" value={producto.id} />
              <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                Quitar la foto
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Datos del tipo de producto</h2>
        <FormularioProducto
          producto={producto}
          categorias={categorias}
          familias={familias}
          parametros={parametros}
          tasa={tasa?.valor ?? null}
          conMarcas={conMarcas}
          existencia={conMarcas ? null : existencia}
          secciones={secciones}
        />
      </section>

      <MarcasDelProducto producto={producto} variantes={variantes} tasa={tasa?.valor ?? null} marcas={marcas} presentaciones={presentaciones} />

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Borrar el producto</h2>
        <p className={estilos.ayuda}>
          Un producto que ya se vendió, se compró o se contó no se borra: las notas y el inventario lo nombran. Ese se esconde con «Ocultar de la web».
        </p>
        <Link href={`/admin/productos/${producto.id}/eliminar`} className="enlace-fila">
          Eliminar producto
        </Link>
      </section>
    </>
  );
}
