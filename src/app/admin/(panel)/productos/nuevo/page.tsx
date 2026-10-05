import Link from "next/link";
import { listarFamilias } from "@/lib/familias";
import { leerTasa } from "@/lib/ajustes";
import { categoriasDeProducto, listarProductos } from "@/lib/productos";
import { variantesDeProducto } from "@/lib/variantes";
import { listarMarcas, presentacionesUsadas } from "@/lib/marcas";
import { presentacionYContenido } from "@/lib/marcas-texto";
import { NOMBRE_ESTADO_PRODUCTO, estadoDeProducto } from "@/lib/catalogo";
import { guardarVariante } from "@/lib/acciones";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { FormularioProducto } from "@/components/formulario-producto";
import { CamposVariante, ListasDeMarcas } from "@/components/marcas-producto";
import estilos from "../../panel.module.css";

export const metadata = { title: "Agregar producto" };

function primero(valor: string | string[] | undefined): string {
  return typeof valor === "string" ? valor : Array.isArray(valor) ? (valor[0] ?? "") : "";
}

/**
 * «Agregar producto», en el orden en que se piensa el catálogo: FAMILIA →
 * TIPO DE PRODUCTO → MARCA → PRESENTACIÓN → PRECIO. Primero se elige el
 * tipo (Mozzarella, Suero…), agrupado por familias, o se crea uno nuevo; si
 * es uno que ya está, se le añade el artículo: su marca (de la lista o una
 * nueva), su presentación, su precio, su foto y las categorías en que sale.
 * Si es nuevo, el formulario entero del tipo, con «Crear nueva familia».
 * Sin JavaScript: el primer paso es un formulario que va y vuelve.
 */
export default async function PaginaNuevoProducto({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const tipo = primero(parametros.tipo);
  const [familias, tasa, productos, marcas, presentaciones] = await Promise.all([
    listarFamilias(),
    leerTasa(),
    listarProductos(),
    listarMarcas(),
    presentacionesUsadas(),
  ]);
  const existente = /^\d+$/.test(tipo) ? (productos.find((p) => p.id === Number(tipo)) ?? null) : null;
  // Vuelve aquí relleno si algo falló al crear un tipo nuevo, o con la familia recién creada.
  const tipoNuevo = tipo === "nuevo" || primero(parametros.relleno) === "1" || Boolean(primero(parametros.familia_id));

  if (existente) {
    const [variantes, categorias] = await Promise.all([variantesDeProducto(existente.id), categoriasDeProducto(existente.id)]);
    const familia = familias.find((f) => f.id === existente.familia_id);
    const sinSeparar = variantes.length === 0 && (existente.precio_usd !== null || existente.marca_id !== null || Boolean(existente.presentacion || existente.contenido));
    const otras = new Set(categorias);
    return (
      <>
        <div>
          <p>
            <Link href="/admin/productos/nuevo">← Elegir otro tipo</Link>
          </p>
          <h1 className={estilos.titulo}>Agregar a {existente.nombre}</h1>
          <p className={estilos.ayuda}>
            {familia ? `Familia: ${familia.nombre}. ` : ""}
            {variantes.length === 0
              ? "Todavía no tiene marcas ni presentaciones."
              : `Ya tiene: ${variantes.map((v) => v.nombre).join(" · ")}.`}{" "}
            {NOMBRE_ESTADO_PRODUCTO[estadoDeProducto(existente)]}.
          </p>
        </div>
        <Avisos parametros={parametros} />
        <section className="tarjeta">
          <form action={guardarVariante} className="formulario" encType="multipart/form-data">
            <input type="hidden" name="producto_id" value={existente.id} />
            <input type="hidden" name="volver_a" value={`/admin/productos/nuevo?tipo=${existente.id}`} />
            <input type="hidden" name="categorias_del_tipo" value="1" />
            <ListasDeMarcas marcas={marcas} presentaciones={presentaciones} />
            {sinSeparar && (
              <p className="aviso aviso--aviso">
                Hoy {existente.nombre} se vende sin separar marcas
                {[existente.marca, presentacionYContenido(existente)].filter(Boolean).length > 0
                  ? ` (${[existente.marca, presentacionYContenido(existente)].filter(Boolean).join(", ")})`
                  : ""}
                . Al guardar, eso pasa también a la lista como un artículo más, con su precio y su foto: no se pierde.
              </p>
            )}
            <CamposVariante id={`articulo-${existente.id}`} variante={null} producto={existente} />
            <fieldset className={estilos.categoriasProducto}>
              <legend>Además de en {familia?.nombre ?? "su familia"}, {existente.nombre} sale en:</legend>
              {familias
                .filter((f) => (f.activa || otras.has(f.id)) && f.id !== existente.familia_id)
                .map((f) => (
                  <label key={f.id} className={estilos.casilla}>
                    <input type="checkbox" name="categoria" value={f.id} defaultChecked={otras.has(f.id)} />
                    <span>{f.nombre}</span>
                  </label>
                ))}
              <span className="ayuda">Es del tipo, no de esta marca: vale para todas sus marcas. Una sola ficha, sin repetirse.</span>
            </fieldset>
            <div>
              <button type="submit" className="boton">
                Agregar a {existente.nombre}
              </button>
            </div>
          </form>
        </section>
      </>
    );
  }

  if (tipoNuevo) {
    return (
      <>
        <div>
          <p>
            <Link href="/admin/productos/nuevo">← Elegir un tipo que ya está</Link>
          </p>
          <h1 className={estilos.titulo}>Un tipo de producto nuevo</h1>
        </div>
        <Avisos parametros={parametros} />
        <section className="tarjeta">
          <p className={estilos.ayuda}>
            El tipo es lo que el cliente busca («Mozzarella», «Suero», «Tocineta»). Si lo vendes de una sola marca, ponla aquí; si son varias, créalo y
            añade cada una en su ficha, en «Marcas y presentaciones». Si todavía no sabes el precio, guárdalo como <strong>borrador</strong>: no sale en
            la web hasta que lo actives.
          </p>
          <FormularioProducto
            producto={null}
            categorias={[]}
            familias={familias}
            parametros={parametros}
            tasa={tasa?.valor ?? null}
            conMarcas={false}
            existencia={null}
            listas={{ marcas, presentaciones }}
          />
        </section>
      </>
    );
  }

  const sinFamilia = productos.filter((p) => !familias.some((f) => f.id === p.familia_id));
  return (
    <>
      <div>
        <p>
          <Link href="/admin/productos">← Productos</Link>
        </p>
        <h1 className={estilos.titulo}>Agregar producto</h1>
      </div>
      <Avisos parametros={parametros} />
      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>¿Qué vas a agregar?</h2>
        <p className={estilos.ayuda}>
          El catálogo va así: familia (Quesos) → tipo de producto (Mozzarella) → marca (Guaralact) → presentación (bloque de 1 kg) → precio. Elige el
          tipo; si ya está, solo le añades la marca y el precio.
        </p>
        <form method="get" action="/admin/productos/nuevo" className="formulario">
          <div className="campo">
            <label htmlFor="tipo">Tipo de producto</label>
            <select id="tipo" name="tipo" required defaultValue="">
              <option value="" disabled>
                Elige uno
              </option>
              <option value="nuevo">＋ Un tipo nuevo (no está en la lista)</option>
              {familias.map((f) => {
                const suyos = productos.filter((p) => p.familia_id === f.id);
                if (suyos.length === 0) return null;
                return (
                  <optgroup key={f.id} label={f.nombre}>
                    {suyos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                        {estadoDeProducto(p) === "activo" ? "" : ` (${NOMBRE_ESTADO_PRODUCTO[estadoDeProducto(p)].toLowerCase()})`}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
              {sinFamilia.length > 0 && (
                <optgroup label="Sin familia">
                  {sinFamilia.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div>
            <button type="submit" className="boton">
              Siguiente
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
