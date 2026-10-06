import type { Producto } from "@/lib/productos";
import { colecciones, familiasDeProductos, type Familia } from "@/lib/familias";
import type { Marca } from "@/lib/marcas";
import { NOMBRE_ESTADO_PRODUCTO, estadoDeProducto } from "@/lib/catalogo";
import { ICONOS } from "@/lib/iconos";
import { UNIDADES, aBolivares, bs, cantidad, usd } from "@/lib/dinero";
import { agregarProducto, editarProducto, guardarProducto } from "@/lib/acciones";
import { EntradaFoto } from "@/components/entrada-foto";
import estilos from "@/app/admin/(panel)/panel.module.css";

type Parametros = Record<string, string | string[] | undefined>;

type Props = {
  /** null: un producto nuevo. */
  producto: Producto | null;
  /** Las otras familias en que sale, como están guardadas. */
  categorias: number[];
  /** Todas las familias: el selector enseña las activas y la del producto aunque esté escondida. */
  familias: Familia[];
  /** Lo que vuelve escrito si algo falló (con `relleno=1`), o la familia recién creada. */
  parametros: Parametros;
  tasa: number | null;
  /** Si tiene marcas publicadas: entonces el precio y la existencia van en cada marca. */
  conMarcas: boolean;
  /** Lo que hay en inventario, si se sigue. */
  existencia: number | null;
  /** La sección en que sale en cada otra familia, como está guardada. */
  secciones?: Map<number, string>;
  /** Las marcas y presentaciones para elegir. */
  listas?: { marcas: Marca[]; presentaciones: string[] };
  /**
   * «Agregar producto»: arriba, el tipo de producto (uno que ya está, o
   * «nuevo»), y lo demás vale para el artículo que se le añade o para el
   * tipo nuevo, según lo elegido. `tipo` es «nuevo» o el número del tipo.
   */
  agregar?: { productos: Producto[]; tipo: string };
};

function primero(valor: string | string[] | undefined): string {
  return typeof valor === "string" ? valor : Array.isArray(valor) ? (valor[0] ?? "") : "";
}

/**
 * El formulario de un tipo de producto: lo que es (Mozzarella, Suero), a
 * qué familia pertenece, en qué negocios (Burger, Pizzería) y otras
 * familias sale (y en qué sección de cada una), su marca y su presentación
 * si se vende de una sola forma, sus precios, si está en borrador, en la
 * web u oculto, si se destaca o sale en ofertas, su foto y lo que hay. Con
 * varias marcas, el precio, la marca y la presentación van en cada
 * artículo: aquí solo queda el margen. La marca y la presentación se
 * eligen de una lista o se escriben nuevas (se crean al guardar), y la
 * familia nueva se crea desde aquí mismo. Sin JavaScript. En «Agregar
 * producto» lleva arriba el selector de tipo y lo escrito va al artículo
 * del tipo elegido, o al tipo nuevo.
 */
export function FormularioProducto({ producto, categorias, familias, parametros, tasa, conMarcas, existencia, secciones, listas, agregar }: Props) {
  const relleno = primero(parametros.relleno) === "1";
  // Lo que vuelve escrito manda sobre lo guardado; una familia recién creada llega también así.
  const valor = (campo: string, guardado: string | number | null | undefined) =>
    relleno ? primero(parametros[campo]) : campo === "familia_id" && primero(parametros.familia_id) ? primero(parametros.familia_id) : guardado === null || guardado === undefined ? "" : String(guardado);
  const marcado = (campo: string, guardado: number | undefined) => (relleno ? primero(parametros[campo]) === "1" : Boolean(guardado));
  const otras = new Set(
    relleno ? (Array.isArray(parametros.categoria) ? parametros.categoria : parametros.categoria ? [parametros.categoria] : []).map(Number) : categorias,
  );
  const familiaElegida = valor("familia_id", producto?.familia_id);
  const elegibles = familias.filter((f) => f.activa || String(f.id) === familiaElegida);
  const negocios = colecciones(familias).filter((f) => f.activa || otras.has(f.id));
  const otrasFamilias = familiasDeProductos(familias).filter((f) => f.activa || otras.has(f.id));
  const estado = valor("estado", producto ? estadoDeProducto(producto) : "activo");
  const precioEnBs = producto?.precio_usd !== null && producto?.precio_usd !== undefined ? aBolivares(producto.precio_usd, tasa) : null;
  const detalEnBs = producto?.precio_detal_usd !== null && producto?.precio_detal_usd !== undefined ? aBolivares(producto.precio_detal_usd, tasa) : null;
  const tipoElegido = agregar ? (relleno && primero(parametros.tipo) ? primero(parametros.tipo) : agregar.tipo) : null;
  const aUnTipoQueEsta = Boolean(tipoElegido && tipoElegido !== "nuevo");
  const id = producto ? String(producto.id) : aUnTipoQueEsta ? `articulo-${tipoElegido}` : "nuevo";
  // La marca y la presentación: la de la lista si está en ella; si no, escrita.
  const marcas = listas?.marcas ?? [];
  const presentaciones = listas?.presentaciones ?? [];
  const marcaGuardada = valor("marca", producto?.marca);
  const marcaEnLista = marcas.find((m) => m.nombre.toLowerCase() === marcaGuardada.toLowerCase());
  const presentacionGuardada = valor("presentacion", producto?.presentacion);
  const presentacionEnLista = presentaciones.find((p) => p.toLowerCase() === presentacionGuardada.toLowerCase());
  const accion = agregar ? agregarProducto : producto ? editarProducto : guardarProducto;

  return (
    <form action={accion} className="formulario" encType="multipart/form-data">
      {producto && <input type="hidden" name="id" value={producto.id} />}
      <input type="hidden" name="formulario" value="completo" />

      {agregar && (
        <div className="campo">
          <label htmlFor="tipo">Tipo de producto</label>
          <select id="tipo" name="tipo" defaultValue={tipoElegido ?? "nuevo"}>
            <option value="nuevo">＋ Un tipo nuevo (escribe su nombre abajo)</option>
            {familias.map((f) => {
              const suyos = agregar.productos.filter((p) => p.familia_id === f.id);
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
            {agregar.productos.some((p) => !familias.some((f) => f.id === p.familia_id)) && (
              <optgroup label="Sin familia">
                {agregar.productos
                  .filter((p) => !familias.some((f) => f.id === p.familia_id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
          <span className="ayuda">
            Si el tipo ya está (Mozzarella, Jamón), lo de abajo es el artículo que le añades: su marca, su presentación, su precio y su foto. Si es
            nuevo, lo de abajo es el tipo entero.
          </span>
        </div>
      )}

      <div className="campo">
        <label htmlFor={`${id}-nombre`}>{agregar ? "Nombre del tipo nuevo" : "Tipo de producto"}</label>
        <input id={`${id}-nombre`} name="nombre" type="text" required={!agregar} defaultValue={valor("nombre", producto?.nombre)} placeholder="Mozzarella · Suero · Tocineta" />
        <span className="ayuda">Lo que el cliente busca, sin la marca: «Mozzarella», no «Mozzarella Guaralact». Las marcas van en sus artículos.</span>
      </div>

      <div className="campo">
        <label htmlFor={`${id}-familia`}>¿A qué familia pertenece este producto?</label>
        <select id={`${id}-familia`} name="familia_id" required={!agregar} defaultValue={familiaElegida}>
          <option value="" disabled>
            Elige una familia
          </option>
          <optgroup label="Familias de productos">
            {familiasDeProductos(elegibles).map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
                {f.activa ? "" : " (escondida)"}
              </option>
            ))}
          </optgroup>
          {colecciones(elegibles).length > 0 && (
            <optgroup label="Colecciones por negocio (solo si es un producto propio de ese negocio)">
              {colecciones(elegibles).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                  {f.activa ? "" : " (escondida)"}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <details className={estilos.masDatos}>
          <summary>＋ Crear nueva familia</summary>
          <div className="formulario" style={{ marginTop: "var(--espacio-3)" }}>
            <div className="formulario__fila">
              <div className="campo">
                <label htmlFor={`${id}-nf-nombre`}>Nombre de la familia</label>
                <input id={`${id}-nf-nombre`} name="nueva_familia_nombre" type="text" defaultValue={valor("nueva_familia_nombre", "")} placeholder="Panadería" />
              </div>
              <div className="campo">
                <label htmlFor={`${id}-nf-icono`}>Icono</label>
                <select id={`${id}-nf-icono`} name="nueva_familia_icono" defaultValue={valor("nueva_familia_icono", "otros") || "otros"}>
                  {Object.entries(ICONOS).map(([clave, icono]) => (
                    <option key={clave} value={clave}>
                      {icono.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="campo">
              <label htmlFor={`${id}-nf-descripcion`}>Descripción (se ve en su página)</label>
              <input id={`${id}-nf-descripcion`} name="nueva_familia_descripcion" type="text" defaultValue={valor("nueva_familia_descripcion", "")} />
            </div>
            <div className="formulario__fila">
              <div className="campo">
                <label htmlFor={`${id}-nf-orden`}>Orden de aparición</label>
                <input id={`${id}-nf-orden`} name="nueva_familia_orden" type="number" inputMode="numeric" min="0" step="1" placeholder="La última" defaultValue={valor("nueva_familia_orden", "")} />
              </div>
              <div className="campo">
                <label htmlFor={`${id}-nf-portada`}>Imagen de portada (opcional)</label>
                <EntradaFoto nombre="nueva_familia_portada" id={`${id}-nf-portada`} opcional soloFoto ladoMaximo={1400} />
              </div>
            </div>
            <label className={estilos.casilla}>
              <input type="checkbox" name="nueva_familia_activa" value="1" defaultChecked />
              <span>Activa: sale en la web</span>
            </label>
            <label className={estilos.casilla}>
              <input type="checkbox" name="nueva_familia_coleccion" value="1" defaultChecked={valor("nueva_familia_coleccion", "") === "1"} />
              <span>Es una colección por tipo de negocio (como Burger o Pizzería): junta productos de varias familias</span>
            </label>
            <div>
              {/* Sin validar el resto: se puede crear la familia antes de escribir el producto. */}
              <button type="submit" name="crear_familia" value="1" formNoValidate className="boton boton--secundario">
                Crear la familia y elegirla
              </button>
            </div>
          </div>
        </details>
      </div>

      <fieldset className={estilos.categoriasProducto}>
        <legend>¿En qué otras categorías quieres mostrarlo?</legend>
        {negocios.length > 0 && (
          <>
            <span className="ayuda">Negocios en que sale (colecciones): una sola ficha y un solo precio, sin repetirse.</span>
            {negocios.map((f) => (
              <label key={f.id} className={estilos.casilla}>
                <input type="checkbox" name="categoria" value={f.id} defaultChecked={otras.has(f.id)} />
                <span>{f.nombre}</span>
              </label>
            ))}
          </>
        )}
        <details className={estilos.masDatos} open={otrasFamilias.some((f) => otras.has(f.id))}>
          <summary>También en otras familias de productos</summary>
          <div style={{ marginTop: "var(--espacio-2)" }}>
            {otrasFamilias.map((f) => (
              <label key={f.id} className={estilos.casilla}>
                <input type="checkbox" name="categoria" value={f.id} defaultChecked={otras.has(f.id)} />
                <span>{f.nombre}</span>
              </label>
            ))}
            <span className="ayuda">Si marcas la suya, no pasa nada.</span>
          </div>
        </details>
        <details className={estilos.masDatos}>
          <summary>Secciones dentro de cada categoría (opcional)</summary>
          <div className="formulario" style={{ marginTop: "var(--espacio-3)" }}>
            <span className="ayuda">
              En cada colección sale agrupado con los de su familia («Quesos», «Embutidos»). Si quieres otro grupo, escríbelo: la tocineta, en
              Burger, en «Embutidos / Proteínas».
            </span>
            <div className="campo">
              <label htmlFor={`${id}-seccion`}>En su familia principal</label>
              <input id={`${id}-seccion`} name="seccion" type="text" defaultValue={valor("seccion", producto?.seccion)} placeholder="Sin sección" />
            </div>
            {familias
              .filter((f) => f.activa || otras.has(f.id))
              .map((f) => (
                <div className="campo" key={f.id}>
                  <label htmlFor={`${id}-seccion-${f.id}`}>En {f.nombre} (si lo marcaste arriba)</label>
                  <input
                    id={`${id}-seccion-${f.id}`}
                    name={`seccion_${f.id}`}
                    type="text"
                    defaultValue={relleno ? primero(parametros[`seccion_${f.id}`]) : (secciones?.get(f.id) ?? "")}
                    placeholder="Como su familia"
                  />
                </div>
              ))}
          </div>
        </details>
      </fieldset>

      {!conMarcas && (
        <>
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor={`${id}-marca-lista`}>{agregar ? "Marca" : "Marca, si lo vendes de una sola (opcional)"}</label>
              <select id={`${id}-marca-lista`} name="marca_lista" defaultValue={marcaEnLista ? marcaEnLista.nombre : marcaGuardada ? "nueva" : ""}>
                <option value="">Sin marca</option>
                {marcas.map((m) => (
                  <option key={m.id} value={m.nombre}>
                    {m.nombre}
                  </option>
                ))}
                <option value="nueva">＋ Nueva marca (escríbela al lado)</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor={`${id}-marca`}>Marca nueva</label>
              <input id={`${id}-marca`} name="marca" type="text" autoComplete="off" defaultValue={marcaEnLista ? "" : marcaGuardada} placeholder="Se crea al guardar" />
            </div>
          </div>
          <span className="ayuda">{agregar ? "Elige una de la lista o escribe una nueva. Vacía si no tiene marca." : "De varias marcas: déjala vacía y añádelas en «Marcas y presentaciones»."}</span>
        </>
      )}

      <div className="campo">
        <label htmlFor={`${id}-estado`}>Estado</label>
        <select id={`${id}-estado`} name="estado" defaultValue={estado}>
          <option value="borrador">Borrador: no sale en la web</option>
          <option value="activo">Activo: sale en la web</option>
          <option value="inactivo">Inactivo: oculto</option>
        </select>
      </div>

      <div className={estilos.filaTres}>
        <div className="campo">
          <label htmlFor={`${id}-unidad`}>Se vende por</label>
          <select id={`${id}-unidad`} name="unidad" defaultValue={valor("unidad", producto?.unidad ?? "kg") || "kg"}>
            {Object.entries(UNIDADES).map(([clave, nombre]) => (
              <option key={clave} value={clave}>
                {clave === "kg" ? "kilo" : nombre}
              </option>
            ))}
          </select>
        </div>
        {!conMarcas && (
          <>
            <div className="campo">
              <label htmlFor={`${id}-presentacion-lista`}>Presentación</label>
              <select id={`${id}-presentacion-lista`} name="presentacion_lista" defaultValue={presentacionEnLista ?? (presentacionGuardada ? "nueva" : "")}>
                <option value="">Sin presentación</option>
                {presentaciones.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value="nueva">＋ Otra (escríbela al lado)</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor={`${id}-presentacion`}>Presentación nueva</label>
              <input id={`${id}-presentacion`} name="presentacion" type="text" autoComplete="off" defaultValue={presentacionEnLista ? "" : presentacionGuardada} placeholder="Bloque · Bolsa · Caja" />
            </div>
          </>
        )}
      </div>
      {!conMarcas && (
        <div className="campo">
          <label htmlFor={`${id}-contenido`}>Peso o contenido</label>
          <input id={`${id}-contenido`} name="contenido" type="text" defaultValue={valor("contenido", producto?.contenido)} placeholder="2,5 kg · 500 g · 12 unidades" />
          <span className="ayuda">Lo que no es por kilo se cobra por su presentación: «bolsa de 2,5 kg», «caja de 12». Sin presentación, por unidad o por cartón.</span>
        </div>
      )}

      {conMarcas ? (
        <>
          <p className="aviso aviso--aviso">
            Se vende en varias marcas o presentaciones: la marca, la presentación, el costo y el precio van en cada una, abajo, y el inventario también.
            Aquí queda el margen, para sacar el precio de cada una de su costo.
          </p>
          {/* Los precios de antes se guardan como estaban: no se usan mientras haya marcas. */}
          <input type="hidden" name="precios_de" value="marcas" />
          <input type="hidden" name="costo_usd" value={producto?.costo_usd ?? ""} />
          <input type="hidden" name="precio_usd" value={producto?.precio_usd ?? ""} />
          <input type="hidden" name="precio_detal_usd" value={producto?.precio_detal_usd ?? ""} />
          <div className="campo">
            <label htmlFor={`margen-${id}`}>Margen % para sus marcas</label>
            <input id={`margen-${id}`} name="margen_pct" type="number" inputMode="decimal" step="0.1" min="0" defaultValue={valor("margen_pct", producto?.margen_pct)} placeholder="25" />
          </div>
        </>
      ) : (
        <div className="campo">
          <label htmlFor={`${id}-costo`}>Lo que te cuesta, en USD</label>
          <input id={`${id}-costo`} name="costo_usd" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={valor("costo_usd", producto?.costo_usd)} placeholder="6,80" />
        </div>
      )}
      {!conMarcas && (
        <>
          <div className={estilos.filaDos}>
            <fieldset className={estilos.grupoPrecio}>
              <legend>Precio al mayor</legend>
              <div className="campo">
                <label htmlFor={`margen-${id}`}>Margen %</label>
                <input id={`margen-${id}`} name="margen_pct" type="number" inputMode="decimal" step="0.1" min="0" defaultValue={valor("margen_pct", producto?.margen_pct)} placeholder="25" />
              </div>
              <div className="campo">
                <label htmlFor={`precio-${id}`}>Venta USD</label>
                <input id={`precio-${id}`} name="precio_usd" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={valor("precio_usd", producto?.precio_usd)} placeholder="Sale solo" />
              </div>
            </fieldset>
            <div className="campo">
              <label htmlFor={`${id}-detal`}>Precio al detal, USD (opcional)</label>
              <input id={`${id}-detal`} name="precio_detal_usd" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={valor("precio_detal_usd", producto?.precio_detal_usd)} />
              <span className="ayuda">Solo si también lo vendes suelto. Vacío: la web no habla de detal.</span>
            </div>
          </div>
          <span className="ayuda">
            Con el costo y el margen, el precio al mayor sale solo; sin margen vale el que escribas. Los precios se guardan en dólares y la web los enseña
            en bolívares a la tasa del día
            {tasa ? ` (hoy ${bs(tasa)} por dólar)` : ""}
            {precioEnBs !== null && producto?.precio_usd != null ? `: al mayor, ${usd(producto.precio_usd)} = ${bs(precioEnBs)}` : ""}
            {detalEnBs !== null && producto?.precio_detal_usd != null ? `; al detal, ${usd(producto.precio_detal_usd)} = ${bs(detalEnBs)}` : ""}.
          </span>
        </>
      )}

      {!conMarcas && !aUnTipoQueEsta && (
        <div className="campo">
          <label htmlFor={`${id}-existencia`}>Existencia (opcional): conté y hay</label>
          <input id={`${id}-existencia`} name="existencia" type="number" inputMode="decimal" step="0.001" min="0" defaultValue={valor("existencia", "")} placeholder={existencia !== null ? String(existencia) : "Kilos, cartones o unidades"} />
          <span className="ayuda">
            {existencia !== null && producto ? `Ahora el inventario dice ${cantidad(existencia, producto.unidad)}. ` : ""}Si lo escribes, se anota como un
            recuento en Inventario; vacío, no cambia nada.
          </span>
        </div>
      )}

      <div className="campo">
        <label htmlFor={`${id}-descripcion`}>Descripción: sus ventajas, una por línea (se ven en la web)</label>
        <textarea id={`${id}-descripcion`} name="descripcion" rows={4} defaultValue={valor("descripcion", producto?.descripcion)} placeholder={"Gratina muy bien\nPerfecta para pizza"} />
      </div>

      <div className="campo">
        <label htmlFor={`${id}-foto`}>{producto?.foto_version ? "Cambiar la foto" : "Foto (opcional)"}</label>
        <EntradaFoto nombre="foto" id={`${id}-foto`} opcional soloFoto ladoMaximo={1200} />
        <span className="ayuda">El producto centrado sobre fondo blanco o muy claro, como en una tienda. Sin foto, la web enseña una de referencia, que dice «Foto referencial».</span>
      </div>

      <label className={estilos.casilla}>
        <input type="checkbox" name="destacado" value="1" defaultChecked={marcado("destacado", producto?.destacado)} />
        <span>Destacarlo en la portada (Productos destacados: salen los cuatro primeros)</span>
      </label>
      <label className={estilos.casilla}>
        <input type="checkbox" name="en_oferta" value="1" defaultChecked={marcado("en_oferta", producto?.en_oferta)} />
        <span>Mostrarlo en Ofertas</span>
      </label>

      <div>
        <button type="submit" className="boton">
          {producto ? `Guardar ${producto.nombre}` : agregar ? "Guardar producto" : "Crear el tipo de producto"}
        </button>
      </div>
    </form>
  );
}
