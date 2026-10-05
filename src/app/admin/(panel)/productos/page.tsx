import { listarProductos, type Producto } from "@/lib/productos";
import { agruparPorProducto, direccionDeFotoDeVariante, listarVariantes, type Variante } from "@/lib/variantes";
import { precioPublicado } from "@/lib/catalogo";
import { hayPreciosDeEjemplo, leerAvisoTasa, leerTasa, tasaAutomatica } from "@/lib/ajustes";
import {
  alternarProducto,
  alternarTasaAutomatica,
  alternarVariante,
  borrarVariante,
  cambiarTasa,
  traerTasaOficial,
  confirmarPrecios,
  editarProducto,
  editarVariante,
  guardarProducto,
  guardarVariante,
  retirarFotoDeVariante,
} from "@/lib/acciones";
import { UNIDADES, aBolivares, bs, diaDeLaSemana, fechaCorta, fechaDeLaBase, hoy, nombreUnidad, usd } from "@/lib/dinero";
import { rutaVariante } from "@/lib/enlaces";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { EntradaFoto } from "@/components/entrada-foto";
import estilos from "../panel.module.css";

export const metadata = { title: "Productos" };

/** «Al detal: USD 8,50 = Bs 310,25 por kg (costo USD 6,80 + 25 %)». */
function LineaPrecio({
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

/** Los dos campos de un precio: su margen y el precio de venta que sale o se escribe. */
function CamposPrecio({
  titulo,
  id,
  campoMargen,
  campoPrecio,
  margen,
  precio,
  ejemploMargen,
}: {
  titulo: string;
  id: string;
  campoMargen: string;
  campoPrecio: string;
  margen: number | null;
  precio: number | null;
  ejemploMargen: string;
}) {
  return (
    <fieldset className={estilos.grupoPrecio}>
      <legend>{titulo}</legend>
      <div className="campo">
        <label htmlFor={`margen-${id}`}>Margen %</label>
        <input
          id={`margen-${id}`}
          name={campoMargen}
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          defaultValue={margen ?? ""}
          placeholder={ejemploMargen}
        />
      </div>
      <div className="campo">
        <label htmlFor={`precio-${id}`}>Venta USD</label>
        <input
          id={`precio-${id}`}
          name={campoPrecio}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          defaultValue={precio ?? ""}
          placeholder="Sale solo"
        />
      </div>
    </fieldset>
  );
}

/**
 * Los campos de una marca o presentación: nombre, una línea para la web,
 * costo y precios (con el costo salen de los márgenes del producto), y la
 * foto, que el teléfono reduce antes de subir.
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
 * Productos y precios. El negocio vende solo al mayor: cada producto tiene
 * un precio, que sale de lo que cuesta en dólares más el porcentaje del
 * dueño. La web lo publica en bolívares con la tasa del día, que
 * también se pone aquí. Cada producto es una ficha con todo lo suyo y un
 * solo botón de guardar, pensada para el teléfono.
 */
export default async function PaginaProductos({
  searchParams,
}: {
  searchParams: Promise<ParametrosAviso>;
}) {
  const parametros = await searchParams;
  const [productos, variantes, tasa, deEjemplo, automatica, avisoTasa] = await Promise.all([
    listarProductos(),
    listarVariantes(),
    leerTasa(),
    hayPreciosDeEjemplo(),
    tasaAutomatica(),
    leerAvisoTasa(),
  ]);
  const variantesDe = agruparPorProducto(variantes);
  // Un producto con marcas publica el precio de ellas: sin precio es que ninguna lo tiene.
  const sinPrecio = productos.filter((p) => {
    const publicado = precioPublicado(p, variantesDe.get(p.id) ?? []);
    return p.activo && publicado.precio_usd === null;
  });
  const tasaValor = tasa?.valor ?? null;

  const opcionesUnidad = Object.entries(UNIDADES).map(([valor, nombre]) => (
    <option key={valor} value={valor}>
      {nombre}
    </option>
  ));

  return (
    <>
      <h1 className={estilos.titulo}>Productos y precios</h1>
      <Avisos parametros={parametros} />

      {deEjemplo && (
        <div className="aviso aviso--error">
          <p>
            <strong>Los precios publicados son de ejemplo.</strong> Se pusieron para que la web no saliera vacía y
            cualquiera puede verlos. Cambia el costo y los márgenes de cada producto por los tuyos y después pulsa el
            botón.
          </p>
          <form action={confirmarPrecios} style={{ marginTop: "var(--espacio-3)" }}>
            <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
              Ya puse mis precios
            </button>
          </form>
        </div>
      )}

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Tasa del día</h2>
        <form action={cambiarTasa} className="formulario">
          <div className="campo">
            <label htmlFor="tasa">Bolívares por dólar</label>
            <input
              id="tasa"
              name="tasa"
              type="number"
              inputMode="decimal"
              step="any"
              min="0.01"
              required
              defaultValue={tasa?.valor ?? ""}
              placeholder="36,50"
            />
            <span className="ayuda">
              {tasa
                ? `Vigente: ${bs(tasa.valor)} por dólar, ${
                    tasa.origen === "bcv" ? "traída del BCV" : "escrita a mano"
                  } el ${fechaCorta(fechaDeLaBase(tasa.actualizada_en))}.${
                    tasa.fecha_valor && tasa.fecha_valor > hoy()
                      ? ` Es la del ${diaDeLaSemana(tasa.fecha_valor)} ${fechaCorta(tasa.fecha_valor)}: los fines de semana vale la del lunes, como en los comercios.`
                      : ""
                  } Al cambiarla cambian todos los precios en bolívares de la web.`
                : "Sin tasa, la web muestra los precios solo en dólares."}
            </span>
          </div>
          <div>
            <button type="submit" className="boton">
              Guardar tasa
            </button>
          </div>
        </form>

        {avisoTasa && (
          <p className="aviso aviso--aviso" style={{ marginTop: "var(--espacio-4)" }}>
            {avisoTasa.mensaje} ({fechaCorta(fechaDeLaBase(avisoTasa.momento))})
          </p>
        )}

        <div className={estilos.alternar}>
          <p className={estilos.ayuda}>
            {automatica
              ? "Cada mañana, antes de abrir, la tasa se trae sola del BCV y los precios en bolívares se ponen al día. Los sábados y domingos se trae la del lunes, que el BCV publica el viernes por la tarde. Si escribes una a mano, vale hasta la mañana siguiente."
              : "La tasa no se actualiza sola: vale la que escribas tú hasta que la cambies."}
          </p>
          <div className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
            <form action={traerTasaOficial}>
              <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                Traer la del BCV ahora
              </button>
            </form>
            <form action={alternarTasaAutomatica}>
              <input type="hidden" name="encender" value={automatica ? "0" : "1"} />
              <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                {automatica ? "No actualizarla sola" : "Actualizarla sola cada mañana"}
              </button>
            </form>
          </div>
        </div>
      </section>

      {sinPrecio.length > 0 && (
        <p className="aviso aviso--aviso">
          {sinPrecio.length === 1
            ? `«${sinPrecio[0].nombre}» no tiene precio: la web dice «consulta el precio del día».`
            : `${sinPrecio.length} productos no tienen precio: la web dice «consulta el precio del día».`}
        </p>
      )}

      <section className={estilos.listaProductos}>
        {productos.map((p) => {
          const suyas = variantesDe.get(p.id) ?? [];
          const publicadas = suyas.filter((v) => v.activo).length;
          return (
          <article key={p.id} className={`tarjeta ${p.activo ? "" : estilos.tarjetaApagada}`}>
            <div className={estilos.encabezado}>
              <h2 className={estilos.subtitulo} style={{ marginBottom: 0 }}>
                {p.nombre}
              </h2>
              <span className={`${estilos.estado} ${p.activo ? estilos["estado--pagada"] : estilos["estado--por_pagar"]}`}>
                {p.activo ? "En la web" : "Oculto"}
              </span>
            </div>

            <ul className={estilos.precioResumen}>
              <LineaPrecio nombre="Precio al mayor" precio={p.precio_usd} margen={p.margen_pct} costo={p.costo_usd} tasa={tasaValor} unidad={p.unidad} />
            </ul>

            {publicadas > 0 && (
              <p className="aviso aviso--aviso">
                Este producto tiene {publicadas === 1 ? "una marca o presentación publicada" : `${publicadas} marcas o presentaciones publicadas`}: la web
                enseña el precio de ellas{publicadas > 1 ? " («desde» la más barata)" : ""} y las ventas se anotan por marca. El precio de aquí abajo no se usa
                mientras haya alguna publicada; el margen sí: con él sale el precio de cada marca a partir de su costo.
              </p>
            )}

            <form action={editarProducto} className="formulario">
              <input type="hidden" name="id" value={p.id} />
              <div className="formulario__fila">
                <div className="campo">
                  <label htmlFor={`nombre-${p.id}`}>Nombre</label>
                  <input id={`nombre-${p.id}`} name="nombre" type="text" required defaultValue={p.nombre} />
                </div>
                <div className="campo">
                  <label htmlFor={`unidad-${p.id}`}>Se vende por</label>
                  <select id={`unidad-${p.id}`} name="unidad" defaultValue={p.unidad}>
                    {opcionesUnidad}
                  </select>
                </div>
              </div>
              <div className="campo">
                <label htmlFor={`costo-${p.id}`}>Lo que te cuesta, en USD</label>
                <input
                  id={`costo-${p.id}`}
                  name="costo_usd"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  defaultValue={p.costo_usd ?? ""}
                  placeholder="6,80"
                />
              </div>
              <div className={estilos.filaDos}>
                <CamposPrecio
                  titulo="Precio al mayor"
                  id={String(p.id)}
                  campoMargen="margen_pct"
                  campoPrecio="precio_usd"
                  margen={p.margen_pct}
                  precio={p.precio_usd}
                  ejemploMargen="25"
                />
              </div>
              <span className="ayuda">Con el costo y el margen, el precio de venta sale solo. Sin margen vale el precio que escribas.</span>
              <div className="campo">
                <label htmlFor={`descripcion-${p.id}`}>Ventajas (una por línea, se ven en la web)</label>
                <textarea id={`descripcion-${p.id}`} name="descripcion" rows={3} defaultValue={p.descripcion ?? ""} />
              </div>
              <div>
                <button type="submit" className="boton">
                  Guardar {p.nombre}
                </button>
              </div>
            </form>

            <form action={alternarProducto} className={estilos.alternar}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="activo" value={p.activo ? "0" : "1"} />
              <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                {p.activo ? "Ocultar de la web" : "Publicar en la web"}
              </button>
            </form>

            {/* Las marcas o presentaciones en que se vende: cada una con su precio y su foto. */}
            <section className={estilos.variantes} aria-label={`Marcas y presentaciones de ${p.nombre}`}>
              <h3 className={estilos.subtituloPequeno}>Marcas y presentaciones</h3>
              <p className={estilos.ayuda} style={{ marginBottom: 0 }}>
                Si vendes el mismo producto de dos marcas o en dos tamaños, ponlas aquí con su precio y su foto. La portada dice «desde» con la más barata y la
                página del producto las enseña todas; cada una tiene además su propia página, con su descripción y sus reseñas. En la venta sale una fila por cada una.
              </p>
              {suyas.map((v) => {
                const foto = direccionDeFotoDeVariante(v);
                return (
                  <article key={v.id} className={`${estilos.variante} ${v.activo ? "" : estilos.tarjetaApagada}`}>
                    <div className={estilos.encabezado}>
                      <div className={estilos.varianteTitulo}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {foto && <img src={foto} alt="" width={56} height={56} className={estilos.fotoVariante} />}
                        <h4 className={estilos.subtituloPequeno}>{v.nombre}</h4>
                      </div>
                      <span className={`${estilos.estado} ${v.activo ? estilos["estado--pagada"] : estilos["estado--por_pagar"]}`}>
                        {v.activo ? "En la web" : "Oculta"}
                      </span>
                    </div>
                    <ul className={estilos.precioResumen}>
                      <LineaPrecio nombre="Precio al mayor" precio={v.precio_usd} margen={v.costo_usd !== null ? p.margen_pct : null} costo={v.costo_usd} tasa={tasaValor} unidad={p.unidad} />
                    </ul>
                    <form action={editarVariante} className="formulario" encType="multipart/form-data">
                      <input type="hidden" name="variante_id" value={v.id} />
                      <CamposVariante id={`variante-${v.id}`} variante={v} producto={p} />
                      <div>
                        <button type="submit" className="boton">
                          Guardar {v.nombre}
                        </button>
                      </div>
                    </form>
                    <div className={estilos.accionesFila} style={{ flexWrap: "wrap", marginTop: "var(--espacio-3)" }}>
                      {p.activo && v.activo ? (
                        <a href={rutaVariante(p, v)} target="_blank" rel="noopener" className={`boton boton--secundario ${estilos.botonPequeno}`}>
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
                  <input type="hidden" name="producto_id" value={p.id} />
                  <CamposVariante id={`variante-nueva-${p.id}`} variante={null} producto={p} />
                  <div>
                    <button type="submit" className="boton boton--secundario">
                      Añadir a {p.nombre}
                    </button>
                  </div>
                </form>
              </details>
            </section>
          </article>
          );
        })}
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Nuevo producto</h2>
        <form action={guardarProducto} className="formulario">
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="producto-nombre">Nombre</label>
              <input id="producto-nombre" name="nombre" type="text" required />
            </div>
            <div className="campo">
              <label htmlFor="producto-unidad">Se vende por</label>
              <select id="producto-unidad" name="unidad" defaultValue="kg">
                {opcionesUnidad}
              </select>
            </div>
          </div>
          <div className="campo">
            <label htmlFor="producto-costo">Lo que te cuesta, en USD</label>
            <input id="producto-costo" name="costo_usd" type="number" inputMode="decimal" step="0.01" min="0" />
          </div>
          <div className={estilos.filaDos}>
            <CamposPrecio
              titulo="Precio al mayor"
              id="nuevo"
              campoMargen="margen_pct"
              campoPrecio="precio_usd"
              margen={null}
              precio={null}
              ejemploMargen="25"
            />
          </div>
          <span className="ayuda">Déjalo todo vacío si todavía no sabes los precios.</span>
          <div className="campo">
            <label htmlFor="producto-descripcion">Ventajas (una por línea)</label>
            <textarea id="producto-descripcion" name="descripcion" rows={3} placeholder={"Gratina muy bien\nPerfecta para pizza"} />
          </div>
          <div>
            <button type="submit" className="boton">
              Crear producto
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
