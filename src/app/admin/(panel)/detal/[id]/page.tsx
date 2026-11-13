import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarArticuloDetal, conPrecios } from "@/lib/detal";
import { leerTasa, reglasDelDetal } from "@/lib/ajustes";
import { esconderArticuloDetal, guardarArticuloDetal, quitarArticuloDetalAccion, unirArticuloDetalAlMayor } from "@/lib/acciones";
import { articuloUnidoA, articulosDelMayor } from "@/lib/costos-unidos";
import { CATEGORIAS_DETAL, costoConIva, margenDelMayor, reglaDelDetal } from "@/lib/detal-calculo";
import { bs, bsRedondo, fechaCorta, hoy, tasaLegible, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../../panel.module.css";

export const metadata = { title: "Producto de la lista del detal" };

type Parametros = { params: Promise<{ id: string }>; searchParams: Promise<ParametrosAviso> };

/** Un número para un campo del formulario, con coma decimal como se escribe aquí. */
const enCampo = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

/** La ficha de un producto de la lista del detal: sus cuentas de hoy, cambiarlo, esconderlo o quitarlo. */
export default async function PaginaArticuloDetal({ params, searchParams }: Parametros) {
  const { id } = await params;
  const parametros = await searchParams;
  const articulo = /^\d+$/.test(id) ? await buscarArticuloDetal(Number(id)) : null;
  if (!articulo) notFound();
  const [reglas, tasa, articulosDelCatalogo, unido] = await Promise.all([
    reglasDelDetal(),
    leerTasa(),
    articulosDelMayor(),
    articuloUnidoA({ producto_id: articulo.producto_id ?? null, variante_id: articulo.variante_id ?? null }),
  ]);
  const [a] = conPrecios([articulo], reglas, tasa?.valor ?? null);
  const porKilo = a.unidad === "kg" ? " el kilo" : "";
  const regla = reglaDelDetal(a, reglas);
  const margenMayor = margenDelMayor(a.categoria, reglas);
  const divisor = (n: number) => n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const costo = a.costo_usd !== null ? "El costo" : "El costo con IVA";

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 className={estilos.titulo}>{a.nombre}</h1>
        <Link href="/admin/detal" className="boton boton--secundario">
          ← La lista
        </Link>
      </div>
      <Avisos parametros={parametros} />
      {!a.activo && <p className="aviso aviso--aviso">Escondido: no sale en la lista que ve la familia.</p>}

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Su precio de hoy</h2>
        <dl className={estilos.cifras}>
          <div className={estilos.cifra}>
            <dt>Al detal</dt>
            <dd>{a.detal_usd !== null ? usd(a.detal_usd) : "—"}</dd>
            {a.detal_bs !== null && <div className={estilos.cifraNota}>{bsRedondo(a.detal_bs)}{porKilo} a la tasa de hoy</div>}
          </div>
          {a.mayor_usd !== null && (
            <div className={estilos.cifra}>
              <dt>Al mayor</dt>
              <dd>{usd(a.mayor_usd)}</dd>
              {a.mayor_bs !== null && <div className={estilos.cifraNota}>{bsRedondo(a.mayor_bs)}{porKilo}</div>}
            </div>
          )}
          {a.costo_en_dolares !== null && (
            <div className={estilos.cifra}>
              <dt>Costo</dt>
              <dd>{usd(Math.round(a.costo_en_dolares * 10000) / 10000)}</dd>
              {a.costo_usd !== null ? (
                <div className={estilos.cifraNota}>
                  En dólares, como lo cobra el proveedor{a.iva === "general" ? ` (${usd(a.costo_usd)} + IVA ${reglas.iva_pct} %)` : ""}
                  {a.fecha_compra ? `, del ${fechaCorta(a.fecha_compra)}` : ""}
                </div>
              ) : (
                <div className={estilos.cifraNota}>
                  {bs(a.costo_bs ?? 0)} {a.iva === "exento" ? "exento" : `+ IVA ${reglas.iva_pct} % = ${bs(costoConIva(a.costo_bs ?? 0, a.iva, reglas.iva_pct))}`}, a la tasa{" "}
                  {tasaLegible(a.tasa_compra ?? 0)}
                  {a.fecha_compra ? ` del ${fechaCorta(a.fecha_compra)}` : ""}
                </div>
              )}
              {a.variacion_pct !== null && (
                <div className={estilos.cifraNota}>
                  La compra anterior{a.fecha_compra_anterior ? `, del ${fechaCorta(a.fecha_compra_anterior)}` : ""}, costó {usd(a.costo_usd_anterior ?? 0)}:{" "}
                  {a.variacion_pct > 0 ? "subió" : a.variacion_pct < 0 ? "bajó" : "igual"} {Math.abs(a.variacion_pct).toLocaleString("es-VE")} %.
                </div>
              )}
            </div>
          )}
        </dl>
        <p className="ayuda">
          {regla.forma === "a_mano"
            ? "El precio al detal está escrito a mano: no sale del costo."
            : regla.forma === "entre"
              ? `Al detal: ${costo.toLowerCase()} entre ${divisor(regla.divisor)} (la regla de la charcutería: cubre la merma, las bolsas y el papel), subido al centavo.`
              : `Al detal: ${costo.toLowerCase()} más el ${regla.pct.toLocaleString("es-VE")} %${regla.propio ? " (su margen propio)" : ""}, subido al centavo.`}{" "}
          {a.precio_mayor_usd !== null
            ? "El precio al mayor está escrito a mano."
            : a.mayor_usd !== null && margenMayor !== null
              ? `Al mayor: ${costo.toLowerCase()} más el ${margenMayor.toLocaleString("es-VE")} %, subido al centavo.`
              : ""}{" "}
          Los bolívares, a la tasa de hoy y subidos de {reglas.redondeo_bs} en {reglas.redondeo_bs}.
        </p>
      </section>

      <section className="tarjeta" style={{ marginTop: "var(--espacio-4)" }}>
        <h2 className={estilos.subtitulo}>El mismo producto en Villa Real</h2>
        <p className="ayuda" style={{ maxWidth: "65ch" }}>
          Unido a su artículo del catálogo de Villa Real, los dos tienen el mismo costo: cada vez que cambie aquí (una factura cargada, unos costos pegados o un cambio
          a mano), cambia allí, y su precio al mayor se rehace con su margen.
        </p>
        {unido ? (
          <p>
            Unido a <Link href={`/admin/productos/${unido.producto_id}`}>{unido.nombre}</Link>
            {unido.costo_usd !== null ? `, con costo ${usd(unido.costo_usd)}` : ""}.
          </p>
        ) : (
          <p className="ayuda">Todavía no está unido: cada uno lleva su costo.</p>
        )}
        <form action={unirArticuloDetalAlMayor} className={estilos.formularioCorto} style={{ maxWidth: 520 }}>
          <input type="hidden" name="id" value={a.id} />
          <label htmlFor="unir-articulo">Su artículo en Villa Real</label>
          <select id="unir-articulo" name="articulo" defaultValue={unido?.clave ?? ""}>
            <option value="">— Ninguno: cada uno con su costo</option>
            {articulosDelCatalogo.map((x) => (
              <option key={x.clave} value={x.clave}>
                {x.nombre}
                {x.unidad === "kg" ? " (por kilo)" : ""}
              </option>
            ))}
          </select>
          <span className="ayuda">Que sea el mismo producto y por la misma unidad: el costo por kilo con el del kilo.</span>
          <button type="submit" className="boton">
            Guardar
          </button>
        </form>
      </section>

      <section className="tarjeta" style={{ marginTop: "var(--espacio-4)" }}>
        <h2 className={estilos.subtitulo}>Cambiarlo</h2>
        <form action={guardarArticuloDetal} className="formulario">
          <input type="hidden" name="id" value={a.id} />
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" type="text" required maxLength={120} defaultValue={a.nombre} />
            </div>
            <div className="campo">
              <label htmlFor="categoria">Categoría</label>
              <select id="categoria" name="categoria" defaultValue={a.categoria}>
                {Object.entries(CATEGORIAS_DETAL).map(([valor, nombre]) => (
                  <option key={valor} value={valor}>
                    {nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="unidad">Se vende por</label>
              <select id="unidad" name="unidad" defaultValue={a.unidad}>
                <option value="unidad">Unidad</option>
                <option value="kg">Kilo</option>
              </select>
            </div>
          </div>
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="costo_usd">Costo en dólares (lo que cobra el proveedor)</label>
              <input id="costo_usd" name="costo_usd" type="text" inputMode="decimal" defaultValue={enCampo(a.costo_usd)} />
            </div>
            <div className="campo">
              <label htmlFor="costo_bs">O el costo de la factura en Bs (sin IVA)</label>
              <input id="costo_bs" name="costo_bs" type="text" inputMode="decimal" defaultValue={enCampo(a.costo_bs)} />
            </div>
            <div className="campo">
              <label htmlFor="iva">IVA</label>
              <select id="iva" name="iva" defaultValue={a.iva}>
                <option value="exento">No se le suma: es lo que pago, o exento (E)</option>
                <option value="general">Se le suma el {reglas.iva_pct} %: gravado (G)</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="tasa_compra">Tasa BCV de la compra (si es en Bs)</label>
              <input id="tasa_compra" name="tasa_compra" type="text" inputMode="decimal" defaultValue={enCampo(a.tasa_compra)} />
            </div>
            <div className="campo">
              <label htmlFor="fecha_compra">Fecha de la compra</label>
              <input id="fecha_compra" name="fecha_compra" type="date" max={hoy()} defaultValue={a.fecha_compra ?? hoy()} />
            </div>
          </div>
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="margen_pct">Margen propio (% sobre el costo)</label>
              <input id="margen_pct" name="margen_pct" type="text" inputMode="decimal" defaultValue={enCampo(a.margen_pct)} placeholder="Vacío: el de su categoría" />
            </div>
            <div className="campo">
              <label htmlFor="precio_usd">Precio al detal a mano ($)</label>
              <input id="precio_usd" name="precio_usd" type="text" inputMode="decimal" defaultValue={enCampo(a.precio_usd)} placeholder="Vacío: sale del costo" />
            </div>
            <div className="campo">
              <label htmlFor="precio_mayor_usd">Precio al mayor a mano ($)</label>
              <input id="precio_mayor_usd" name="precio_mayor_usd" type="text" inputMode="decimal" defaultValue={enCampo(a.precio_mayor_usd)} />
            </div>
            <div className="campo">
              <label htmlFor="proveedor">Proveedor</label>
              <input id="proveedor" name="proveedor" type="text" maxLength={80} defaultValue={a.proveedor} />
            </div>
          </div>
          <button type="submit" className="boton">
            Guardar
          </button>
        </form>
      </section>

      <section className="tarjeta" id="quitar" style={{ marginTop: "var(--espacio-4)" }}>
        <h2 className={estilos.subtitulo}>Esconderlo o quitarlo</h2>
        <form action={esconderArticuloDetal} style={{ marginBottom: "var(--espacio-3)" }}>
          <input type="hidden" name="id" value={a.id} />
          <input type="hidden" name="mostrar" value={a.activo ? "0" : "1"} />
          <button type="submit" className="boton boton--secundario">
            {a.activo ? "Esconderlo de la lista" : "Volver a enseñarlo"}
          </button>
          <span className="ayuda"> Escondido no sale en la lista de la familia, pero su costo se guarda para la próxima compra.</span>
        </form>
        <form action={quitarArticuloDetalAccion} className="formulario">
          <input type="hidden" name="id" value={a.id} />
          <label className="ayuda">
            <input type="checkbox" name="confirmar" value="si" required /> Sí, quitar «{a.nombre}» de la lista
          </label>
          <button type="submit" className="boton boton--peligro">
            Quitarlo de la lista
          </button>
        </form>
      </section>
    </>
  );
}
