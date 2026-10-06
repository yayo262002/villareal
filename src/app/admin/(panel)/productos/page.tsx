import Link from "next/link";
import { listarProductos, categoriasDeTodos, direccionDeFotoDeProducto } from "@/lib/productos";
import { agruparPorProducto, fotoDeAlgunaVariante, listarVariantes } from "@/lib/variantes";
import { listarFamilias } from "@/lib/familias";
import { NOMBRE_ESTADO_PRODUCTO, estadoDeProducto, precioPublicado, presentacionDe, type EstadoProducto } from "@/lib/catalogo";
import { hayPreciosDeEjemplo, leerAvisoTasa, leerTasa, tasaAutomatica } from "@/lib/ajustes";
import { faltanPorPreparar } from "@/lib/preparar-catalogo";
import { normalizar } from "@/lib/buscar";
import { alternarTasaAutomatica, cambiarTasa, confirmarPrecios, prepararCatalogo, traerTasaOficial } from "@/lib/acciones";
import { aBolivares, bs, diaDeLaSemana, fechaCorta, fechaDeLaBase, hoy, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { FotoDeProducto } from "@/components/foto-de-producto";
import { imagenDeProducto } from "@/lib/fotos-referenciales";
import estilos from "../panel.module.css";

export const metadata = { title: "Productos" };

const CLASE_DE_ESTADO: Record<EstadoProducto, string> = { activo: "estado--pagada", borrador: "estado--parcial", inactivo: "estado--por_pagar" };

function texto(parametros: ParametrosAviso, campo: string): string {
  const valor = parametros[campo];
  return typeof valor === "string" ? valor : "";
}

/**
 * Productos y precios. Arriba la tasa del día, con la que la web publica
 * los precios en bolívares; debajo la lista de productos, por estado (en
 * la web, borradores, ocultos), por familia o buscando, cada uno con un
 * enlace a su ficha, donde se edita todo. «Agregar producto» abre el
 * formulario completo.
 */
export default async function PaginaProductos({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const [productos, variantes, familias, categorias, tasa, deEjemplo, automatica, avisoTasa, faltan] = await Promise.all([
    listarProductos(),
    listarVariantes(),
    listarFamilias(),
    categoriasDeTodos(),
    leerTasa(),
    hayPreciosDeEjemplo(),
    tasaAutomatica(),
    leerAvisoTasa(),
    faltanPorPreparar(),
  ]);
  const variantesDe = agruparPorProducto(variantes);
  const tasaValor = tasa?.valor ?? null;
  const familiaDe = new Map(familias.map((f) => [f.id, f]));

  // Un producto con marcas publica el precio de ellas: sin precio es que ninguna lo tiene.
  const publicadoDe = (p: (typeof productos)[number]) => precioPublicado(p, variantesDe.get(p.id) ?? []);
  const sinPrecio = productos.filter((p) => p.activo && publicadoDe(p).precio_usd === null);

  const estadoElegido = texto(parametros, "estado");
  const familiaElegida = Number(texto(parametros, "familia")) || 0;
  const busqueda = texto(parametros, "q").trim();
  const cuantos = (estado: EstadoProducto) => productos.filter((p) => estadoDeProducto(p) === estado).length;
  const lista = productos.filter(
    (p) =>
      (!estadoElegido || estadoDeProducto(p) === estadoElegido) &&
      (!familiaElegida || p.familia_id === familiaElegida || (categorias.get(p.id) ?? []).includes(familiaElegida)) &&
      (!busqueda || normalizar(`${p.nombre} ${p.marca} ${p.presentacion}`).includes(normalizar(busqueda))),
  );
  const enlaceCon = (cambios: Record<string, string>) => {
    const p = new URLSearchParams({ ...(estadoElegido ? { estado: estadoElegido } : {}), ...(familiaElegida ? { familia: String(familiaElegida) } : {}), ...(busqueda ? { q: busqueda } : {}), ...cambios });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    const q = p.toString();
    return `/admin/productos${q ? `?${q}` : ""}#lista`;
  };

  return (
    <>
      <h1 className={estilos.titulo}>Productos y precios</h1>
      <Avisos parametros={parametros} />

      {deEjemplo && (
        <div className="aviso aviso--error">
          <p>
            <strong>Los precios publicados son de ejemplo.</strong> Se pusieron para que la web no saliera vacía y cualquiera puede verlos. Cambia el
            costo y los márgenes de cada producto por los tuyos y después pulsa el botón.
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
            <input id="tasa" name="tasa" type="number" inputMode="decimal" step="any" min="0.01" required defaultValue={tasa?.valor ?? ""} placeholder="36,50" />
            <span className="ayuda">
              {tasa
                ? `Vigente: ${bs(tasa.valor)} por dólar, ${tasa.origen === "bcv" ? "traída del BCV" : "escrita a mano"} el ${fechaCorta(fechaDeLaBase(tasa.actualizada_en))}.${
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
            : `${sinPrecio.length} productos en la web no tienen precio: la web dice «consulta el precio del día».`}
        </p>
      )}

      <section className="tarjeta" id="lista">
        <div className={estilos.encabezado} style={{ marginBottom: "var(--espacio-3)" }}>
          <h2 className={estilos.subtitulo} style={{ marginBottom: 0 }}>
            Productos ({productos.length})
          </h2>
          <Link href="/admin/productos/nuevo" className="boton">
            Agregar producto
          </Link>
        </div>
        <p className={estilos.ayuda}>
          <Link href="/admin/familias">Familias y categorías</Link> · <Link href="/admin/marcas">Marcas</Link> · <Link href="/admin/fotos">Fotos</Link> ·{" "}
          <Link href="/admin/ofertas">Ofertas y combos</Link> ·{" "}
          <Link href="/admin/inventario">Inventario</Link>
        </p>

        {(faltan.productos > 0 || faltan.ofertas > 0) && (
          <form action={prepararCatalogo} className={estilos.alternar} style={{ marginTop: 0, paddingTop: 0, borderTop: 0, marginBottom: "var(--espacio-4)" }}>
            <p className={estilos.ayuda}>
              Faltan por preparar {faltan.productos} productos del catálogo (tocineta, salsas, papas, bebidas…) y {faltan.ofertas} combos. Se crean
              en borrador: sin precio, sin marca y sin publicar, para que completes los que vendas y borres los que no.
            </p>
            <button type="submit" className="boton boton--secundario">
              Preparar el catálogo inicial
            </button>
          </form>
        )}

        <nav className={estilos.pestanas} aria-label="Productos por estado">
          <Link href={enlaceCon({ estado: "" })} aria-current={!estadoElegido ? "true" : undefined}>
            Todos ({productos.length})
          </Link>
          {(["activo", "borrador", "inactivo"] as const).map((e) => (
            <Link key={e} href={enlaceCon({ estado: e })} aria-current={estadoElegido === e ? "true" : undefined}>
              {e === "activo" ? "En la web" : e === "borrador" ? "Borradores" : "Ocultos"} ({cuantos(e)})
            </Link>
          ))}
        </nav>
        <form method="get" action="/admin/productos#lista" className={estilos.buscador} role="search">
          {estadoElegido && <input type="hidden" name="estado" value={estadoElegido} />}
          <label htmlFor="productos-familia" className="visualmente-oculto">
            Familia
          </label>
          <select id="productos-familia" name="familia" defaultValue={familiaElegida ? String(familiaElegida) : ""} className={estilos.entradaPequena}>
            <option value="">Todas las familias</option>
            {familias.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
          <label htmlFor="productos-buscar" className="visualmente-oculto">
            Buscar un producto
          </label>
          <input id="productos-buscar" name="q" type="search" placeholder="Buscar: tocineta, salsa…" defaultValue={busqueda} />
          <button type="submit" className="boton boton--secundario">
            Buscar
          </button>
        </form>

        {lista.length === 0 ? (
          <p className="vacio">Ningún producto con eso.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Familia</th>
                  <th>Estado</th>
                  <th className="numero">Precio al mayor</th>
                  <th>
                    <span className="visualmente-oculto">Editar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => {
                  const estado = estadoDeProducto(p);
                  const publicado = publicadoDe(p);
                  const precioBs = publicado.precio_usd !== null ? aBolivares(publicado.precio_usd, tasaValor) : null;
                  const foto = direccionDeFotoDeProducto(p);
                  // Como en la web: sin foto propia, la de la primera marca publicada con foto, o la de referencia.
                  const fotoDeSuMarca = fotoDeAlgunaVariante(variantesDe.get(p.id) ?? []);
                  const otras = (categorias.get(p.id) ?? []).map((id) => familiaDe.get(id)?.nombre).filter(Boolean);
                  const presentacion = presentacionDe(p);
                  return (
                    <tr key={p.id} className={estado === "activo" ? undefined : estilos.filaApagada}>
                      <td data-label="Producto">
                        <span className={estilos.varianteTitulo}>
                          <FotoDeProducto imagen={imagenDeProducto(foto, p.nombre, fotoDeSuMarca)} nombre={p.nombre} className={estilos.fotoPequena} tamano={80} />
                          <span>
                            <Link href={`/admin/productos/${p.id}`}>
                              <strong>{p.nombre}</strong>
                            </Link>
                            {p.destacado ? <span title="Destacado en la portada"> ★</span> : null}
                            {p.en_oferta ? <span className="ayuda"> · en ofertas</span> : null}
                            {presentacion && <span className="ayuda"> · {presentacion}</span>}
                          </span>
                        </span>
                      </td>
                      <td data-label="Familia">
                        {p.familia_id ? (familiaDe.get(p.familia_id)?.nombre ?? "—") : "—"}
                        {otras.length > 0 && <span className="ayuda"> · también en {otras.join(", ")}</span>}
                      </td>
                      <td data-label="Estado">
                        <span className={`${estilos.estado} ${estilos[CLASE_DE_ESTADO[estado]]}`}>{NOMBRE_ESTADO_PRODUCTO[estado]}</span>
                      </td>
                      <td data-label="Precio al mayor" className="numero">
                        {publicado.precio_usd === null ? (
                          <span className="ayuda">sin precio</span>
                        ) : (
                          <>
                            {publicado.desde ? "desde " : ""}
                            {usd(publicado.precio_usd)}
                            {precioBs !== null && <span className="ayuda"> · {bs(precioBs)}</span>}
                          </>
                        )}
                        {publicado.variantes > 0 && <span className="ayuda"> · {publicado.variantes === 1 ? "1 marca" : `${publicado.variantes} marcas`}</span>}
                      </td>
                      <td>
                        <Link href={`/admin/productos/${p.id}`} className="enlace-fila">
                          Editar
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
