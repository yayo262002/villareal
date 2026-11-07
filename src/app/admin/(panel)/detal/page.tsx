import Link from "next/link";
import { conPrecios, contarArticulosDetal, listarArticulosDetal, type ArticuloConPrecio } from "@/lib/detal";
import { enlaceDeLaLista, leerTasa, reglasDelDetal, tasaEnFecha } from "@/lib/ajustes";
import { agregarArticuloDetal, cargarCostosDelDetal, cargarFacturaDelDetal, crearEnlaceDeLaLista, guardarReglasDelDetal } from "@/lib/acciones";
import { CAMBIO_GRANDE_PCT, CATEGORIAS_DETAL, costoConIva, type CategoriaDetal } from "@/lib/detal-calculo";
import { bs, bsRedondo, fechaCorta, fechaDeLaBase, hoy, tasaLegible, usd } from "@/lib/dinero";
import { negocio } from "@/config/negocio";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Lista del detal" };

/** Un precio en dólares con sus centavos, como lo lleva la familia en su lista. */
function dolares(n: number): string {
  return usd(n);
}

/** El divisor de la charcutería como lo dice el dueño: «0,80». */
function divisorLegible(n: number): string {
  return n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/** Un cambio en %, con su signo: «+12,5», «−3». */
function signo(pct: number): string {
  const texto = Math.abs(pct).toLocaleString("es-VE", { maximumFractionDigits: 1 });
  return pct > 0 ? `+${texto}` : pct < 0 ? `−${texto}` : "0";
}

/**
 * La lista de precios de la charcutería (el detal): cada producto con lo
 * que costó, su precio en dólares y en bolívares a la tasa BCV de hoy,
 * subidos siempre a favor del negocio; la charcutería, también al mayor.
 * Aquí se cargan las facturas de compra y los costos en dólares y se ponen
 * las reglas; la familia la ve con su enlace, sin clave, en /lista.
 */
export default async function PaginaDetal({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const busqueda = typeof parametros.q === "string" ? parametros.q.slice(0, 80) : "";
  const [articulos, total, reglas, tasa, tasaDeHoy, enlace] = await Promise.all([
    listarArticulosDetal(busqueda),
    contarArticulosDetal(),
    reglasDelDetal(),
    leerTasa(),
    tasaEnFecha(hoy()),
    enlaceDeLaLista(),
  ]);
  const lista = conPrecios(articulos, reglas, tasa?.valor ?? null);
  const hayMayor = lista.some((a) => a.mayor_usd !== null);
  // Lo que cambió mucho de costo desde la compra anterior, lo que más primero.
  const cambios = lista
    .filter((a) => a.variacion_pct !== null && Math.abs(a.variacion_pct) >= CAMBIO_GRANDE_PCT)
    .sort((a, b) => Math.abs(b.variacion_pct ?? 0) - Math.abs(a.variacion_pct ?? 0));
  const porCategoria = Object.keys(CATEGORIAS_DETAL)
    .map((c) => ({ categoria: c as CategoriaDetal, articulos: lista.filter((a) => a.categoria === c) }))
    .filter((g) => g.articulos.length > 0);
  const direccion = enlace ? `${negocio.web}/lista/${enlace}` : null;
  const mensaje = direccion
    ? `Esta es la lista de precios de la charcutería, al día con la tasa del BCV:\n${direccion}\n\nPara tenerla como app: ábrela y ponla en la pantalla de inicio (en el iPhone, en Safari: Compartir → «Agregar a pantalla de inicio»). El icono abre directo la lista.`
    : "";

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 className={estilos.titulo}>Lista del detal</h1>
        <div className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
          {enlace && (
            <a href={`/lista/${enlace}`} className="boton boton--secundario" target="_blank" rel="noopener">
              Verla como la familia
            </a>
          )}
          <a href="#costos" className="boton">
            Cargar costos de la charcutería
          </a>
          <a href="#cargar" className="boton">
            Cargar una factura
          </a>
        </div>
      </div>
      <Avisos parametros={parametros} />

      <div className="ayuda">
        Cada precio sale de lo que costó el producto:
        <ul style={{ margin: "var(--espacio-1) 0", paddingLeft: "1.2em" }}>
          <li>
            <strong>Charcutería</strong>: lo que cobra el proveedor, en dólares. Al detal, el costo entre {divisorLegible(reglas.charcuteria_divisor)} (cubre la merma, las bolsas
            y el papel); al mayor,{" "}
            {reglas.charcuteria_mayor_pct === null ? "sin precio (no está puesto)" : `el costo más un ${reglas.charcuteria_mayor_pct.toLocaleString("es-VE")} %`}.
          </li>
          <li>
            <strong>Víveres y lo demás</strong>: el costo de la factura con su IVA si es gravado, a la tasa BCV del día de la compra, más un{" "}
            {reglas.margen_pct.toLocaleString("es-VE")} %
            {reglas.margen_mayor_pct !== null ? `; al mayor, más un ${reglas.margen_mayor_pct.toLocaleString("es-VE")} %` : ""}.
          </li>
        </ul>
        Los dólares se suben al centavo y los bolívares, a la tasa BCV de hoy, de {reglas.redondeo_bs} en {reglas.redondeo_bs}. Siempre hacia arriba: nunca en contra del
        negocio.
      </div>
      {tasa ? (
        <p className="aviso aviso--exito">
          Tasa {tasa.origen === "bcv" ? "BCV" : "escrita a mano"} de hoy: <strong>{tasaLegible(tasa.valor)}</strong> bolívares por dólar ·{" "}
          {fechaCorta(tasa.fecha_valor ?? fechaDeLaBase(tasa.actualizada_en))}. Los bolívares de la lista cambian solos cada mañana con la del BCV.
        </p>
      ) : (
        <p className="aviso aviso--aviso">
          Todavía no hay tasa del día: la lista enseña solo los dólares. Ponla en <Link href="/admin/productos">Productos</Link>.
        </p>
      )}
      {cambios.length > 0 && (
        <div className="aviso aviso--aviso">
          <strong>
            {cambios.length === 1 ? "Un producto cambió" : `${cambios.length} productos cambiaron`} de costo más de un {CAMBIO_GRANDE_PCT} % desde la compra anterior
          </strong>
          , en dólares y con el IVA, cada compra a la tasa BCV de su día:
          <ul style={{ margin: "var(--espacio-2) 0 0", paddingLeft: "1.2em" }}>
            {cambios.map((a) => (
              <li key={a.id}>
                <Link href={`/admin/detal/${a.id}`}>{a.nombre}</Link>: {dolares(a.costo_usd_anterior ?? 0)}
                {a.fecha_compra_anterior ? ` el ${fechaCorta(a.fecha_compra_anterior)}` : ""} → {dolares(a.costo_en_dolares ?? 0)}
                {a.fecha_compra ? ` el ${fechaCorta(a.fecha_compra)}` : ""} ({signo(a.variacion_pct ?? 0)} %)
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="tarjeta">
        <form method="get" action="/admin/detal" className={estilos.buscador} role="search">
          <label htmlFor="q">Buscar</label>
          <input id="q" name="q" type="search" defaultValue={busqueda} placeholder="harina, mavesa, jabón…" />
          <button type="submit" className="boton boton--secundario">
            Buscar
          </button>
          {busqueda && (
            <Link href="/admin/detal" className="boton boton--secundario">
              Ver todos
            </Link>
          )}
        </form>

        {total === 0 ? (
          <p className="vacio">La lista está vacía. Carga la primera factura abajo, o agrega un producto con su precio.</p>
        ) : lista.length === 0 ? (
          <p className="vacio">Nada responde a «{busqueda}».</p>
        ) : (
          porCategoria.map((g) => (
            <div key={g.categoria} style={{ marginTop: "var(--espacio-4)" }}>
              <h2 className={estilos.subtitulo}>
                {CATEGORIAS_DETAL[g.categoria]} <span className="ayuda">· {g.articulos.length}</span>
              </h2>
              <div className="tabla-envoltorio">
                <table className="tabla tabla--fichas">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="numero">Costo</th>
                      <th className="numero">Al detal</th>
                      <th className="numero">En Bs hoy</th>
                      {hayMayor && <th className="numero">Al mayor</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {g.articulos.map((a) => (
                      <FilaDetal key={a.id} articulo={a} ivaPct={reglas.iva_pct} hayMayor={hayMayor} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="tarjeta" id="costos" style={{ marginTop: "var(--espacio-4)" }}>
        <h2 className={estilos.subtitulo}>Cargar costos de la charcutería</h2>
        <p className="ayuda">
          Lo que te cobra el proveedor, en dólares, una línea por producto: el nombre y el costo al final («Jamón de espalda 5,20»). Es lo que pagas: no se le suma IVA, salvo
          que la línea diga <strong>(G)</strong>. Si un producto se vende por unidad y no por kilo, ponle «c/u» después del costo. Lo que ya está en la lista toma el costo
          nuevo y guarda el anterior.
        </p>
        <form action={cargarCostosDelDetal} className="formulario">
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="costos_proveedor">Proveedor</label>
              <input id="costos_proveedor" name="proveedor" type="text" maxLength={80} placeholder="El Drago" />
            </div>
            <div className="campo">
              <label htmlFor="costos_fecha">Fecha de los costos</label>
              <input id="costos_fecha" name="fecha_compra" type="date" max={hoy()} defaultValue={hoy()} />
            </div>
            <div className="campo">
              <label htmlFor="costos_categoria">Categoría de lo nuevo</label>
              <select id="costos_categoria" name="categoria" defaultValue="charcuteria">
                {Object.entries(CATEGORIAS_DETAL).map(([valor, nombre]) => (
                  <option key={valor} value={valor}>
                    {nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="costos_unidad">Lo nuevo se vende por</label>
              <select id="costos_unidad" name="unidad" defaultValue="kg">
                <option value="kg">Kilo</option>
                <option value="unidad">Unidad</option>
              </select>
            </div>
          </div>
          <div className="campo">
            <label htmlFor="costos_lineas">Costos en dólares</label>
            <textarea id="costos_lineas" name="lineas" rows={8} required placeholder={"Jamón de espalda 5,20\nQueso amarillo 6,80\nSalchichas paquete 1 kg 3,10 c/u"} />
          </div>
          <button type="submit" className="boton">
            Cargar costos
          </button>
        </form>
      </section>

      <section className="tarjeta" id="cargar" style={{ marginTop: "var(--espacio-4)" }}>
        <h2 className={estilos.subtitulo}>Cargar una factura de compra</h2>
        <p className="ayuda">
          Una línea por producto: la cantidad, el precio de una unidad tal como viene en la factura (sin IVA) y el nombre con <strong>(E)</strong> si es exento o{" "}
          <strong>(G)</strong> si lleva IVA. También vale como sale en el papel, con la cantidad encima del nombre. Lo que ya está en la lista toma el costo nuevo.
        </p>
        <form action={cargarFacturaDelDetal} className="formulario">
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="proveedor">Proveedor</label>
              <input id="proveedor" name="proveedor" type="text" maxLength={80} placeholder="Cecosesola" />
            </div>
            <div className="campo">
              <label htmlFor="fecha_compra">Fecha de la factura</label>
              <input id="fecha_compra" name="fecha_compra" type="date" max={hoy()} defaultValue={hoy()} />
            </div>
            <div className="campo">
              <label htmlFor="tasa_compra">Tasa BCV de ese día</label>
              <input id="tasa_compra" name="tasa_compra" type="text" inputMode="decimal" placeholder={tasaDeHoy ? tasaLegible(tasaDeHoy.valor) : "896,12"} />
              <span className="ayuda">Vacía: la del BCV que quedó guardada ese día.</span>
            </div>
            <div className="campo">
              <label htmlFor="categoria_factura">Categoría de lo nuevo</label>
              <select id="categoria_factura" name="categoria" defaultValue="viveres">
                {Object.entries(CATEGORIAS_DETAL).map(([valor, nombre]) => (
                  <option key={valor} value={valor}>
                    {nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="campo">
            <label htmlFor="lineas">Líneas de la factura</label>
            <textarea id="lineas" name="lineas" rows={8} required placeholder={"12 x 447,59 Jugo Natulac Pera 200 ml (G)\n6 x 875,00 Maíz de Cotufa El Maizalito 400 g (E)"} />
          </div>
          <button type="submit" className="boton">
            Cargar
          </button>
        </form>
      </section>

      <section className="tarjeta" id="agregar" style={{ marginTop: "var(--espacio-4)" }}>
        <h2 className={estilos.subtitulo}>Agregar un producto</h2>
        <p className="ayuda">
          Con lo que costó (el precio sale solo, con la regla de su categoría): en dólares, como lo cobra el proveedor, o en bolívares, como viene en la factura. O con su precio
          al detal en dólares escrito a mano.
        </p>
        <form action={agregarArticuloDetal} className="formulario">
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" type="text" required maxLength={120} placeholder="Queso amarillo" />
            </div>
            <div className="campo">
              <label htmlFor="categoria">Categoría</label>
              <select id="categoria" name="categoria" defaultValue="charcuteria">
                {Object.entries(CATEGORIAS_DETAL).map(([valor, nombre]) => (
                  <option key={valor} value={valor}>
                    {nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="unidad">Se vende por</label>
              <select id="unidad" name="unidad" defaultValue="kg">
                <option value="kg">Kilo</option>
                <option value="unidad">Unidad</option>
              </select>
            </div>
          </div>
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="costo_usd">Costo en dólares (lo que cobra el proveedor)</label>
              <input id="costo_usd" name="costo_usd" type="text" inputMode="decimal" placeholder="5,20" />
            </div>
            <div className="campo">
              <label htmlFor="costo_bs">O el costo de la factura en Bs (sin IVA)</label>
              <input id="costo_bs" name="costo_bs" type="text" inputMode="decimal" placeholder="447,59" />
            </div>
            <div className="campo">
              <label htmlFor="iva">IVA</label>
              <select id="iva" name="iva" defaultValue="">
                <option value="">Elige si hay costo…</option>
                <option value="exento">No se le suma: es lo que pago, o exento (E)</option>
                <option value="general">Se le suma el {reglas.iva_pct} %: gravado (G)</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="tasa_compra_uno">Tasa BCV de la compra (si es en Bs)</label>
              <input id="tasa_compra_uno" name="tasa_compra" type="text" inputMode="decimal" placeholder="Vacía: la de hoy" />
            </div>
            <div className="campo">
              <label htmlFor="margen_pct">Margen propio (% sobre el costo)</label>
              <input id="margen_pct" name="margen_pct" type="text" inputMode="decimal" placeholder="Vacío: el de su categoría" />
            </div>
          </div>
          <p className="ayuda">O con su precio escrito a mano:</p>
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="precio_usd">Precio al detal en dólares</label>
              <input id="precio_usd" name="precio_usd" type="text" inputMode="decimal" placeholder="7,70" />
            </div>
            <div className="campo">
              <label htmlFor="precio_mayor_usd">Precio al mayor en dólares (si tiene)</label>
              <input id="precio_mayor_usd" name="precio_mayor_usd" type="text" inputMode="decimal" />
            </div>
          </div>
          <button type="submit" className="boton">
            Agregar a la lista
          </button>
        </form>
      </section>

      <section className="tarjeta" id="reglas" style={{ marginTop: "var(--espacio-4)" }}>
        <h2 className={estilos.subtitulo}>Las reglas de la lista</h2>
        <form action={guardarReglasDelDetal} className="formulario">
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="regla_divisor">Charcutería al detal: el costo entre</label>
              <input id="regla_divisor" name="charcuteria_divisor" type="text" inputMode="decimal" defaultValue={divisorLegible(reglas.charcuteria_divisor)} required />
              <span className="ayuda">0,80: un 25 % más, que cubre la merma, las bolsas y el papel.</span>
            </div>
            <div className="campo">
              <label htmlFor="regla_mayor_charcuteria">Charcutería al mayor (%)</label>
              <input
                id="regla_mayor_charcuteria"
                name="charcuteria_mayor_pct"
                type="text"
                inputMode="decimal"
                defaultValue={reglas.charcuteria_mayor_pct === null ? "" : String(reglas.charcuteria_mayor_pct).replace(".", ",")}
                placeholder="Sin poner"
              />
              <span className="ayuda">Lo que se le suma al costo: 10 %. Vacío, sin precio al mayor.</span>
            </div>
          </div>
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="regla_margen">Víveres al detal (%)</label>
              <input id="regla_margen" name="margen_pct" type="text" inputMode="decimal" defaultValue={String(reglas.margen_pct).replace(".", ",")} required />
              <span className="ayuda">Lo que se le suma al costo con IVA: 20 %. Vale para todo lo que no es charcutería.</span>
            </div>
            <div className="campo">
              <label htmlFor="regla_mayor">Víveres al mayor (%)</label>
              <input
                id="regla_mayor"
                name="margen_mayor_pct"
                type="text"
                inputMode="decimal"
                defaultValue={reglas.margen_mayor_pct === null ? "" : String(reglas.margen_mayor_pct).replace(".", ",")}
                placeholder="Sin poner"
              />
              <span className="ayuda">Vacío: la lista no enseña precio al mayor, salvo el que se escriba a mano.</span>
            </div>
            <div className="campo">
              <label htmlFor="regla_redondeo">Subir los bolívares de</label>
              <input id="regla_redondeo" name="redondeo_bs" type="text" inputMode="decimal" defaultValue={String(reglas.redondeo_bs)} required />
              <span className="ayuda">De 5 en 5: si da 723, se cobra 725.</span>
            </div>
          </div>
          <button type="submit" className="boton">
            Guardar reglas
          </button>
        </form>
        <p className="ayuda" style={{ marginTop: "var(--espacio-3)" }}>
          El IVA de los gravados es el de las facturas ({reglas.iva_pct} %): se cambia en <Link href="/admin/facturas">Facturas</Link>.
        </p>
      </section>

      <section className="tarjeta" id="enlace" style={{ marginTop: "var(--espacio-4)" }}>
        <h2 className={estilos.subtitulo}>El enlace para la familia</h2>
        {direccion ? (
          <>
            <p className="ayuda">
              Con este enlace se ve la lista al día, en bolívares y en dólares, sin clave y sin entrar al panel. Solo la lista: nada de clientes ni de cuentas.
            </p>
            <p>
              <a href={`/lista/${enlace}`} target="_blank" rel="noopener" style={{ overflowWrap: "anywhere" }}>
                {direccion}
              </a>
            </p>
            <div className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
              <a href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} className="boton" target="_blank" rel="noopener">
                Mandarlo por WhatsApp
              </a>
              <form action={crearEnlaceDeLaLista}>
                <input type="hidden" name="renovar" value="1" />
                <button type="submit" className="boton boton--secundario">
                  Renovar el enlace
                </button>
              </form>
            </div>
            <p className="ayuda">
              Puesta en la pantalla de inicio del teléfono es una app, «Precios», que abre directo en la lista. Si se compartió de más, «Renovar» pone otro y el anterior
              deja de funcionar (también el icono: hay que ponerlo otra vez con el enlace nuevo).
            </p>
          </>
        ) : (
          <form action={crearEnlaceDeLaLista}>
            <p className="ayuda">Crea el enlace y mándaselo a tu mamá: con él ve la lista al día en su teléfono, sin clave.</p>
            <button type="submit" className="boton">
              Crear el enlace
            </button>
          </form>
        )}
      </section>
    </>
  );
}

function FilaDetal({ articulo: a, ivaPct, hayMayor }: { articulo: ArticuloConPrecio; ivaPct: number; hayMayor: boolean }) {
  const porKilo = a.unidad === "kg" ? " /kg" : "";
  const iva =
    a.costo_usd !== null ? (a.iva === "general" ? `+ IVA ${ivaPct} %` : null) : a.costo_bs !== null ? (a.iva === "exento" ? "Exento" : `Gravado ${ivaPct} %`) : null;
  return (
    <tr>
      <td data-label="Producto">
        <Link href={`/admin/detal/${a.id}`}>{a.nombre}</Link>
        {!a.activo && <span className={estilos.sinNombre}> · escondido</span>}
        <span className="ayuda" style={{ display: "block" }}>
          {[iva, a.proveedor || null, a.fecha_compra ? fechaCorta(a.fecha_compra) : null].filter(Boolean).join(" · ")}
        </span>
      </td>
      <td data-label="Costo" className="numero">
        {a.costo_usd !== null || a.costo_bs !== null ? (
          <>
            {a.costo_usd !== null ? (
              <>
                {dolares(Math.round((a.costo_en_dolares ?? 0) * 10000) / 10000)}
                {porKilo}
              </>
            ) : (
              <>
                {bs(costoConIva(a.costo_bs ?? 0, a.iva, ivaPct))}
                {a.costo_en_dolares !== null && (
                  <span className="ayuda" style={{ display: "block" }}>
                    {dolares(Math.round(a.costo_en_dolares * 10000) / 10000)} a {tasaLegible(a.tasa_compra ?? 0)}
                  </span>
                )}
              </>
            )}
            {a.variacion_pct !== null && (
              <span className="ayuda" style={{ display: "block" }}>
                antes {dolares(a.costo_usd_anterior ?? 0)}
                {a.fecha_compra_anterior ? ` (${fechaCorta(a.fecha_compra_anterior)})` : ""} ·{" "}
                {Math.abs(a.variacion_pct) >= CAMBIO_GRANDE_PCT ? <strong>{signo(a.variacion_pct)} %</strong> : `${signo(a.variacion_pct)} %`}
              </span>
            )}
          </>
        ) : (
          <span className="ayuda">precio a mano</span>
        )}
      </td>
      <td data-label="Al detal" className="numero">
        <strong>{a.detal_usd !== null ? `${dolares(a.detal_usd)}${porKilo}` : "—"}</strong>
        {a.margen_pct !== null && a.precio_usd === null && <span className="ayuda" style={{ display: "block" }}>margen {a.margen_pct} %</span>}
      </td>
      <td data-label="En Bs hoy" className="numero">
        <strong>{a.detal_bs !== null ? `${bsRedondo(a.detal_bs)}${porKilo}` : "—"}</strong>
      </td>
      {hayMayor && (
        <td data-label="Al mayor" className="numero">
          {a.mayor_usd !== null ? (
            <>
              {dolares(a.mayor_usd)}
              {porKilo}
              {a.mayor_bs !== null && <span className="ayuda" style={{ display: "block" }}>{bsRedondo(a.mayor_bs)}</span>}
            </>
          ) : (
            "—"
          )}
        </td>
      )}
    </tr>
  );
}
