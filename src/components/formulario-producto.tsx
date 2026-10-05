import type { Producto } from "@/lib/productos";
import type { Familia } from "@/lib/familias";
import { estadoDeProducto } from "@/lib/catalogo";
import { ICONOS } from "@/lib/iconos";
import { UNIDADES, aBolivares, bs, cantidad, usd } from "@/lib/dinero";
import { editarProducto, guardarProducto } from "@/lib/acciones";
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
};

function primero(valor: string | string[] | undefined): string {
  return typeof valor === "string" ? valor : Array.isArray(valor) ? (valor[0] ?? "") : "";
}

/**
 * El formulario entero de un producto: lo que es, a qué familia pertenece
 * y en qué otras sale, su marca y su presentación, sus precios, si está en
 * borrador, en la web u oculto, si se destaca o sale en ofertas, su foto y
 * lo que hay. Sin JavaScript: dentro trae «Crear nueva familia», que la
 * crea y vuelve aquí con todo lo escrito y la familia ya elegida.
 */
export function FormularioProducto({ producto, categorias, familias, parametros, tasa, conMarcas, existencia }: Props) {
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
  const estado = valor("estado", producto ? estadoDeProducto(producto) : "activo");
  const precioEnBs = producto?.precio_usd !== null && producto?.precio_usd !== undefined ? aBolivares(producto.precio_usd, tasa) : null;
  const detalEnBs = producto?.precio_detal_usd !== null && producto?.precio_detal_usd !== undefined ? aBolivares(producto.precio_detal_usd, tasa) : null;
  const id = producto ? String(producto.id) : "nuevo";

  return (
    <form action={producto ? editarProducto : guardarProducto} className="formulario" encType="multipart/form-data">
      {producto && <input type="hidden" name="id" value={producto.id} />}
      <input type="hidden" name="formulario" value="completo" />

      <div className="campo">
        <label htmlFor={`${id}-nombre`}>Nombre del producto</label>
        <input id={`${id}-nombre`} name="nombre" type="text" required defaultValue={valor("nombre", producto?.nombre)} placeholder="Tocineta ahumada" />
      </div>

      <div className="campo">
        <label htmlFor={`${id}-familia`}>¿A qué familia pertenece este producto?</label>
        <select id={`${id}-familia`} name="familia_id" required defaultValue={familiaElegida}>
          <option value="" disabled>
            Elige una familia
          </option>
          {elegibles.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre}
              {f.activa ? "" : " (escondida)"}
            </option>
          ))}
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
        {familias
          .filter((f) => f.activa || otras.has(f.id))
          .map((f) => (
            <label key={f.id} className={estilos.casilla}>
              <input type="checkbox" name="categoria" value={f.id} defaultChecked={otras.has(f.id)} />
              <span>{f.nombre}</span>
            </label>
          ))}
        <span className="ayuda">Sale en su familia y en estas, sin repetirse. Si marcas la suya, no pasa nada.</span>
      </fieldset>

      <div className="formulario__fila">
        <div className="campo">
          <label htmlFor={`${id}-marca`}>Marca (opcional)</label>
          <input id={`${id}-marca`} name="marca" type="text" defaultValue={valor("marca", producto?.marca)} placeholder="Si tiene varias, ponlas abajo en Marcas" />
        </div>
        <div className="campo">
          <label htmlFor={`${id}-estado`}>Estado</label>
          <select id={`${id}-estado`} name="estado" defaultValue={estado}>
            <option value="borrador">Borrador: no sale en la web</option>
            <option value="activo">Activo: sale en la web</option>
            <option value="inactivo">Inactivo: oculto</option>
          </select>
        </div>
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
        <div className="campo">
          <label htmlFor={`${id}-presentacion`}>Presentación</label>
          <input id={`${id}-presentacion`} name="presentacion" type="text" defaultValue={valor("presentacion", producto?.presentacion)} placeholder="Bolsa · Caja · Galón" />
        </div>
        <div className="campo">
          <label htmlFor={`${id}-contenido`}>Peso o contenido</label>
          <input id={`${id}-contenido`} name="contenido" type="text" defaultValue={valor("contenido", producto?.contenido)} placeholder="2,5 kg · 12 unidades" />
        </div>
      </div>
      <span className="ayuda">
        Lo que no es por kilo se cobra por su presentación: «bolsa de 2,5 kg», «caja de 12». Sin presentación, por unidad o por cartón.
      </span>

      {conMarcas && (
        <p className="aviso aviso--aviso">
          Tiene marcas publicadas: la web enseña el precio de cada marca y el inventario va por marca. Los precios de aquí no se usan mientras haya
          alguna; el margen sí, para sacar el de cada marca de su costo.
        </p>
      )}
      <div className="campo">
        <label htmlFor={`${id}-costo`}>Lo que te cuesta, en USD</label>
        <input id={`${id}-costo`} name="costo_usd" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={valor("costo_usd", producto?.costo_usd)} placeholder="6,80" />
      </div>
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

      {!conMarcas && (
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
        <label htmlFor={`${id}-foto`}>{producto?.foto_version ? "Cambiar la foto" : "Foto del producto (opcional)"}</label>
        <EntradaFoto nombre="foto" id={`${id}-foto`} opcional soloFoto ladoMaximo={1200} />
        <span className="ayuda">Mejor sobre fondo blanco o claro: el fondo se funde con la página. Sin foto, la web enseña su dibujo.</span>
      </div>

      <label className={estilos.casilla}>
        <input type="checkbox" name="destacado" value="1" defaultChecked={marcado("destacado", producto?.destacado)} />
        <span>Destacarlo en la portada (Productos destacados)</span>
      </label>
      <label className={estilos.casilla}>
        <input type="checkbox" name="en_oferta" value="1" defaultChecked={marcado("en_oferta", producto?.en_oferta)} />
        <span>Mostrarlo en Ofertas</span>
      </label>

      <div>
        <button type="submit" className="boton">
          {producto ? `Guardar ${producto.nombre}` : "Crear producto"}
        </button>
      </div>
    </form>
  );
}
