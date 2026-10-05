import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarProducto, loQueTieneElProducto, sePuedeBorrar } from "@/lib/productos";
import { alternarProducto, borrarProducto } from "@/lib/acciones";
import estilos from "../../../panel.module.css";

export const metadata = { title: "Eliminar producto" };

/** La confirmación antes de borrar un producto: dice qué se lleva, o por qué no se puede. */
export default async function PaginaEliminarProducto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numero = Number(id);
  const producto = Number.isSafeInteger(numero) && numero > 0 ? await buscarProducto(numero) : null;
  if (!producto) notFound();
  const tiene = await loQueTieneElProducto(producto.id);
  const volver = `/admin/productos/${producto.id}`;
  const seBorra = sePuedeBorrar(tiene);
  const partes = [
    tiene.variantes ? `${tiene.variantes} ${tiene.variantes === 1 ? "marca" : "marcas"}` : "",
    tiene.resenas ? `${tiene.resenas} ${tiene.resenas === 1 ? "reseña" : "reseñas"}` : "",
    tiene.ofertas ? `su sitio en ${tiene.ofertas} ${tiene.ofertas === 1 ? "oferta" : "ofertas"}` : "",
  ].filter(Boolean);

  return (
    <>
      <div>
        <p>
          <Link href={volver}>← {producto.nombre}</Link>
        </p>
        <h1 className={estilos.titulo}>¿Eliminar «{producto.nombre}»?</h1>
      </div>

      <section className="tarjeta">
        {seBorra ? (
          <>
            <p>
              Se borra el producto{partes.length > 0 ? ` con ${partes.join(", ")}` : ""}, sus fotos y sus categorías. <strong>No tiene vuelta atrás.</strong>
            </p>
            <form action={borrarProducto} className={estilos.accionesFila} style={{ flexWrap: "wrap", marginTop: "var(--espacio-4)" }}>
              <input type="hidden" name="id" value={producto.id} />
              <button type="submit" className="boton boton--peligro">
                Sí, eliminar
              </button>
              <Link href={volver} className="boton boton--secundario">
                Cancelar
              </Link>
            </form>
          </>
        ) : (
          <>
            <p>
              No se puede borrar: aparece en{" "}
              {[
                tiene.ventas ? `${tiene.ventas} ${tiene.ventas === 1 ? "línea de venta" : "líneas de venta"}` : "",
                tiene.compras ? `${tiene.compras} ${tiene.compras === 1 ? "compra" : "compras"}` : "",
                tiene.ajustes ? `${tiene.ajustes} ${tiene.ajustes === 1 ? "recuento" : "recuentos"} de inventario` : "",
              ]
                .filter(Boolean)
                .join(", ")}
              , que lo nombran. Escóndelo: deja de salir en la web y en las ventas, y lo que ya pasó se queda como estaba.
            </p>
            <div className={estilos.accionesFila} style={{ flexWrap: "wrap", marginTop: "var(--espacio-4)" }}>
              {producto.activo ? (
                <form action={alternarProducto}>
                  <input type="hidden" name="id" value={producto.id} />
                  <input type="hidden" name="activo" value="0" />
                  <input type="hidden" name="volver_a" value={volver} />
                  <button type="submit" className="boton">
                    Ocultarlo de la web
                  </button>
                </form>
              ) : null}
              <Link href={volver} className="boton boton--secundario">
                Volver
              </Link>
            </div>
          </>
        )}
      </section>
    </>
  );
}
