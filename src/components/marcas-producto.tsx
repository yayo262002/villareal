import type { Producto } from "@/lib/productos";
import { direccionDeFotoDeVariante, type Variante } from "@/lib/variantes";
import { rutaVariante } from "@/lib/enlaces";
import { aBolivares, bs, nombreUnidad, usd } from "@/lib/dinero";
import { alternarVariante, borrarVariante, editarVariante, guardarVariante, retirarFotoDeVariante } from "@/lib/acciones";
import { EntradaFoto } from "@/components/entrada-foto";
import estilos from "@/app/admin/(panel)/panel.module.css";

/** «Precio al mayor: USD 8,50 = Bs 310,25 por kg (costo USD 6,80 + 25 %)». */
export function LineaPrecio({
  nombre,
  precio,
  margen,
  costo,
  tasa,
  unidad,
}: {
  nombre: string;
  precio: number | null;
  margen: number | null;
  costo: number | null;
  tasa: number | null;
  unidad: string;
}) {
  if (precio === null) {
    return (
      <li>
        {nombre}: <span className="ayuda">sin precio</span>
      </li>
    );
  }
  const enBs = aBolivares(precio, tasa);
  return (
    <li>
      {nombre}: <strong>{usd(precio)}</strong>
      {enBs !== null && (
        <>
          {" = "}
          <strong className={estilos.precioBs}>{bs(enBs)}</strong>
        </>
      )}{" "}
      por {nombreUnidad(unidad)}
      {costo !== null && margen !== null && (
        <span className="ayuda">
          {" "}
          (costo {usd(costo)} + {margen} %)
        </span>
      )}
    </li>
  );
}

/**
 * Los campos de una marca o presentación: nombre, su descripción (una
 * ventaja por línea), costo y precio (con el costo sale del margen del
 * producto), y la foto, que el teléfono reduce antes de subir.
 */
function CamposVariante({ id, variante, producto }: { id: string; variante: Variante | null; producto: Producto }) {
  const conMargen = producto.margen_pct !== null;
  return (
    <>
      <div className="campo">
        <label htmlFor={`${id}-nombre`}>Marca o presentación</label>
        <input id={`${id}-nombre`} name="nombre" type="text" required defaultValue={variante?.nombre ?? ""} placeholder="Kemmental · Sortilegio 500 g" />
      </div>
      <div className="campo">
        <label htmlFor={`${id}-descripcion`}>Descripción (una ventaja por línea)</label>
        <textarea
          id={`${id}-descripcion`}
          name="descripcion"
          rows={3}
          defaultValue={variante?.descripcion ?? ""}
          placeholder={"Tipo Emmental, semiduro, madurado\nFunde bien en las hamburguesas"}
        />
        <span className="ayuda">Sale en su página. La primera línea se ve también en la lista de marcas del producto.</span>
      </div>
      <div className={estilos.filaTres}>
        <div className="campo">
          <label htmlFor={`${id}-costo`}>Lo que te cuesta, USD</label>
          <input id={`${id}-costo`} name="costo_usd" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={variante?.costo_usd ?? ""} />
        </div>
        <div className="campo">
          <label htmlFor={`${id}-precio`}>Precio al mayor, USD</label>
          <input id={`${id}-precio`} name="precio_usd" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={variante?.precio_usd ?? ""} placeholder={conMargen ? "Sale del costo" : ""} />
        </div>
      </div>
      <span className="ayuda">
        {conMargen
          ? `Con el costo, el precio sale con el margen del producto (${producto.margen_pct} %). Sin margen vale el precio que escribas.`
          : "Escribe el precio de venta, o el costo y ponle margen al producto para que salga solo."}
      </span>
      <div className="campo">
        <label htmlFor={`${id}-foto`}>{variante?.foto_version ? "Cambiar la foto" : "Foto (el paquete, por ejemplo)"}</label>
        <EntradaFoto nombre="foto" id={`${id}-foto`} opcional soloFoto ladoMaximo={1200} />
      </div>
    </>
  );
}

/**
 * Las marcas o presentaciones en que se vende un producto, cada una con su
 * precio, su foto y su propia página en la web; y el formulario para
 * añadir otra.
 */
export function MarcasDelProducto({ producto, variantes, tasa }: { producto: Producto; variantes: Variante[]; tasa: number | null }) {
  return (
    <section className={`tarjeta ${estilos.variantes}`} id="marcas" aria-label={`Marcas y presentaciones de ${producto.nombre}`}>
      <h2 className={estilos.subtitulo}>Marcas y presentaciones</h2>
      <p className={estilos.ayuda} style={{ marginBottom: 0 }}>
        Si vendes el mismo producto de dos marcas o en dos tamaños, ponlas aquí con su precio y su foto. La portada dice «desde» con la más barata y la
        página del producto las enseña todas; cada una tiene además su propia página, con su descripción y sus reseñas. En la venta sale una fila por
        cada una.
      </p>
      {variantes.map((v) => {
        const foto = direccionDeFotoDeVariante(v);
        return (
          <article key={v.id} className={`${estilos.variante} ${v.activo ? "" : estilos.tarjetaApagada}`}>
            <div className={estilos.encabezado}>
              <div className={estilos.varianteTitulo}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {foto && <img src={foto} alt="" width={56} height={56} className={estilos.fotoVariante} />}
                <h3 className={estilos.subtituloPequeno}>{v.nombre}</h3>
              </div>
              <span className={`${estilos.estado} ${v.activo ? estilos["estado--pagada"] : estilos["estado--por_pagar"]}`}>{v.activo ? "En la web" : "Oculta"}</span>
            </div>
            <ul className={estilos.precioResumen}>
              <LineaPrecio nombre="Precio al mayor" precio={v.precio_usd} margen={v.costo_usd !== null ? producto.margen_pct : null} costo={v.costo_usd} tasa={tasa} unidad={producto.unidad} />
            </ul>
            <form action={editarVariante} className="formulario" encType="multipart/form-data">
              <input type="hidden" name="variante_id" value={v.id} />
              <CamposVariante id={`variante-${v.id}`} variante={v} producto={producto} />
              <div>
                <button type="submit" className="boton">
                  Guardar {v.nombre}
                </button>
              </div>
            </form>
            <div className={estilos.accionesFila} style={{ flexWrap: "wrap", marginTop: "var(--espacio-3)" }}>
              {producto.activo && v.activo ? (
                <a href={rutaVariante(producto, v)} target="_blank" rel="noopener" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                  Ver su página
                </a>
              ) : null}
              <form action={alternarVariante}>
                <input type="hidden" name="variante_id" value={v.id} />
                <input type="hidden" name="activo" value={v.activo ? "0" : "1"} />
                <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                  {v.activo ? "Ocultar de la web" : "Publicar en la web"}
                </button>
              </form>
              {foto && (
                <form action={retirarFotoDeVariante}>
                  <input type="hidden" name="variante_id" value={v.id} />
                  <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                    Quitar la foto
                  </button>
                </form>
              )}
              <details className={estilos.masDatos}>
                <summary>Eliminar</summary>
                <form action={borrarVariante} style={{ marginTop: "var(--espacio-2)" }}>
                  <input type="hidden" name="variante_id" value={v.id} />
                  <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                    Sí, eliminar «{v.nombre}»
                  </button>
                </form>
              </details>
            </div>
          </article>
        );
      })}
      <details className={estilos.masDatos}>
        <summary>Añadir una marca o presentación</summary>
        <form action={guardarVariante} className="formulario" encType="multipart/form-data" style={{ marginTop: "var(--espacio-3)" }}>
          <input type="hidden" name="producto_id" value={producto.id} />
          <CamposVariante id={`variante-nueva-${producto.id}`} variante={null} producto={producto} />
          <div>
            <button type="submit" className="boton boton--secundario">
              Añadir a {producto.nombre}
            </button>
          </div>
        </form>
      </details>
    </section>
  );
}
