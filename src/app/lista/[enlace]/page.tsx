import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { conPrecios, listarArticulosDetal } from "@/lib/detal";
import { enlaceDeLaLista, leerTasa, reglasDelDetal } from "@/lib/ajustes";
import { esEnlaceValido } from "@/lib/enlace-cuenta";
import { FiltroEnVivo } from "@/components/filtro-en-vivo";
import { textoCoincide } from "@/lib/buscar";
import { CATEGORIAS_DETAL, enBolivares, type CategoriaDetal } from "@/lib/detal-calculo";
import { COMBOS_DEL_DETAL, claveDeNombreDetal, desgloseDelCombo, type DesgloseDelCombo } from "@/lib/combos-detal";
import { bsRedondo, diaDeLaSemana, fechaCorta, fechaDeLaBase, hoy, tasaLegible, usd } from "@/lib/dinero";
import estilos from "./lista.module.css";

type Parametros = { params: Promise<{ enlace: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Puesta en la pantalla de inicio, es su propia app, «Precios», que abre en esta lista (su manifiesto, al lado). */
export async function generateMetadata({ params }: Parametros): Promise<Metadata> {
  const { enlace } = await params;
  return {
    title: "Lista de precios",
    manifest: `/lista/${enlace}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: "Precios", statusBarStyle: "default" },
  };
}

/** «500 g», «1 kg»: el número y su unidad no se separan al partir la línea (como en la lista del teléfono). */
const pegarUnidad = (nombre: string) => nombre.replace(/(\d) (?=(g|kg|ml|l|cm)\b)/g, "$1 ");

/** Qué lista se ve: la del detal (todo), la de la charcutería (con sus dos precios), la del mayor o los combos desglosados. */
type Vista = "detal" | "charcuteria" | "mayor" | "combos";

const VISTAS: Vista[] = ["detal", "charcuteria", "mayor", "combos"];

/** La dirección de una de las listas, con lo que se esté buscando. */
function enlaceA(vista: Vista, busqueda: string): string {
  const parametros = new URLSearchParams();
  if (vista !== "detal") parametros.set("precio", vista);
  if (busqueda) parametros.set("q", busqueda);
  return `?${parametros.toString()}`;
}

/**
 * La lista de precios de la charcutería, para la familia: con el enlace,
 * sin clave, cada producto en bolívares a la tasa BCV de hoy (subidos a
 * favor del negocio) y en dólares. Hasta tres listas: la del detal; la de
 * la charcutería aparte, cada producto con su precio al detal y al mayor
 * (`?precio=charcuteria`); si algo tiene precio al mayor, la del mayor
 * (`?precio=mayor`); y los combos del detal (`?precio=combos`), cada uno
 * con lo que lleva, a cuánto está cada producto y lo que pone en el combo.
 * Se busca escribiendo, sin JavaScript. Solo enseña la lista: ni costos,
 * ni proveedores, ni nada del panel.
 */
export default async function PaginaLista({ params, searchParams }: Parametros) {
  const { enlace } = await params;
  const guardado = await enlaceDeLaLista();
  if (!esEnlaceValido(enlace) || enlace !== guardado) notFound();
  const parametros = await searchParams;
  const busqueda = typeof parametros.q === "string" ? parametros.q.slice(0, 80) : "";
  const [articulos, reglas, tasa] = await Promise.all([listarArticulosDetal(), reglasDelDetal(), leerTasa()]);
  const conPrecio = conPrecios(articulos, reglas, tasa?.valor ?? null);
  // Las listas enseñan lo que no está escondido; los combos usan toda la lista, como la caja (cobran lo mismo).
  const todos = conPrecio.filter((a) => Number(a.activo) === 1);
  const porNombre = new Map(conPrecio.map((a) => [claveDeNombreDetal(a.nombre), a]));
  const combos = COMBOS_DEL_DETAL.map((combo) =>
    desgloseDelCombo(
      combo,
      (nombre) => {
        const a = porNombre.get(claveDeNombreDetal(nombre));
        return a ? { unidad: a.unidad, precio: a.detal_usd } : null;
      },
      reglas.charcuteria_divisor,
    ),
  );
  const hayMayor = todos.some((a) => a.mayor_usd !== null);
  const hayCharcuteria = todos.some((a) => a.categoria === "charcuteria" && a.detal_usd !== null);
  const hayCombos = combos.some((c) => c.total !== null);
  const pedida = VISTAS.find((v) => v === parametros.precio) ?? "detal";
  const vista: Vista = (pedida === "mayor" && hayMayor) || (pedida === "charcuteria" && hayCharcuteria) || (pedida === "combos" && hayCombos) ? pedida : "detal";
  const alMayor = vista === "mayor";
  const enCombos = vista === "combos";
  const combosVistos = combos.filter((c) =>
    textoCoincide([`${c.combo.n} ${c.combo.nombre}`, c.combo.detalle, ...c.partes.map((p) => p.nombre)], busqueda),
  );
  const gruposDeCombos = [
    { titulo: "De todos los días", combos: combosVistos.filter((c) => !c.combo.especial) },
    { titulo: "Especiales", combos: combosVistos.filter((c) => c.combo.especial) },
  ].filter((g) => g.combos.length > 0);
  const lista = todos
    .filter((a) => vista !== "charcuteria" || a.categoria === "charcuteria")
    .map((a) => ({ ...a, usd: alMayor ? a.mayor_usd : a.detal_usd, bs: alMayor ? a.mayor_bs : a.detal_bs }))
    .filter((a) => a.usd !== null && textoCoincide([a.nombre, CATEGORIAS_DETAL[a.categoria] ?? ""], busqueda));
  const grupos = Object.keys(CATEGORIAS_DETAL)
    .map((c) => ({ categoria: c as CategoriaDetal, articulos: lista.filter((a) => a.categoria === c) }))
    .filter((g) => g.articulos.length > 0);
  const dia = hoy();
  const fechaTasa = tasa ? (tasa.fecha_valor ?? fechaDeLaBase(tasa.actualizada_en)) : null;

  return (
    <main className={`${estilos.pagina} ${alMayor ? estilos.alMayor : ""}`}>
      <header className={estilos.cabecera}>
        <p className={estilos.antetitulo}>
          {alMayor ? "Villa Real · al mayor" : vista === "charcuteria" ? "Villa Real · al detal y al mayor" : enCombos ? "Charcutería Villa Real · al detal" : "Charcutería Villa Real"}
        </p>
        <h1 className={estilos.titulo}>{alMayor ? "Precios al mayor" : vista === "charcuteria" ? "Charcutería" : enCombos ? "Combos" : "Lista de precios"}</h1>
        <p className={estilos.fecha}>
          {diaDeLaSemana(dia)} {fechaCorta(dia)}
        </p>
        {tasa ? (
          <p className={estilos.tasa}>
            {tasa.origen === "bcv" ? "Tasa BCV" : "Tasa"}: <strong>{tasaLegible(tasa.valor)}</strong> Bs por dólar
            {fechaTasa && fechaTasa !== dia ? ` (del ${diaDeLaSemana(fechaTasa)} ${fechaCorta(fechaTasa)})` : ""}
          </p>
        ) : (
          <p className={estilos.tasa}>Todavía no hay tasa de hoy: los precios van solo en dólares.</p>
        )}
      </header>

      {(hayMayor || hayCharcuteria || hayCombos) && (
        <nav className={estilos.pestanas} aria-label="Qué precios ver">
          <a href={enlaceA("detal", busqueda)} aria-current={vista === "detal" ? "page" : undefined}>
            Al detal
          </a>
          {hayCharcuteria && (
            <a href={enlaceA("charcuteria", busqueda)} aria-current={vista === "charcuteria" ? "page" : undefined}>
              Charcutería
            </a>
          )}
          {hayMayor && (
            <a href={enlaceA("mayor", busqueda)} aria-current={alMayor ? "page" : undefined}>
              Al mayor
            </a>
          )}
          {hayCombos && (
            <a href={enlaceA("combos", busqueda)} aria-current={enCombos ? "page" : undefined}>
              Combos
            </a>
          )}
        </nav>
      )}

      <form method="get" className={estilos.buscador} role="search">
        {vista !== "detal" && <input type="hidden" name="precio" value={vista} />}
        <label htmlFor="q" className={estilos.oculto}>
          {enCombos ? "Buscar un combo" : "Buscar un producto"}
        </label>
        <input id="q" name="q" type="search" defaultValue={busqueda} placeholder={enCombos ? "Buscar: mozzarella, pavo, perrero…" : "Buscar: jamón, harina, jabón…"} autoComplete="off" />
        <button type="submit">Buscar</button>
        {busqueda && <a href={enlaceA(vista, "")}>Todos</a>}
      </form>
      {/* Con JavaScript, la lista se filtra con cada letra; sin él, «Buscar» lo hace desde el servidor. */}
      <FiltroEnVivo entrada="q" lista="productos" clase={estilos.vacio} />

      {enCombos ? (
        gruposDeCombos.length === 0 ? (
          <p className={estilos.vacio}>{`Ningún combo lleva «${busqueda}».`}</p>
        ) : (
          <div id="productos" className={estilos.productos}>
            {gruposDeCombos.map((g) => (
              <section key={g.titulo} className={estilos.grupo} data-grupo>
                <h2 className={estilos.categoria}>{g.titulo}</h2>
                <ul className={estilos.combos}>
                  {g.combos.map((c) => (
                    <Combo key={c.combo.clave} desglose={c} bs={enBolivares(c.total, tasa?.valor ?? null, reglas.redondeo_bs)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : lista.length === 0 ? (
        <p className={estilos.vacio}>{busqueda ? `Nada responde a «${busqueda}».` : "La lista todavía está vacía."}</p>
      ) : (
        <div id="productos" className={estilos.productos}>
        {grupos.map((g) => (
          <section key={g.categoria} className={estilos.grupo} data-grupo>
            <h2 className={estilos.categoria}>
              {CATEGORIAS_DETAL[g.categoria]}
              {vista === "charcuteria" && (
                <span className={estilos.columnas} aria-hidden="true">
                  <span>Detal</span>
                  <span>Mayor</span>
                </span>
              )}
            </h2>
            <ul className={estilos.filas}>
              {g.articulos.map((a) => (
                <li key={a.id} className={estilos.fila} data-busca={a.nombre} data-busca-mas={CATEGORIAS_DETAL[a.categoria] ?? ""}>
                  <span className={estilos.nombre}>
                    {pegarUnidad(a.nombre)}
                    {a.unidad === "kg" && <span className={estilos.unidad}>{" · el kilo"}</span>}
                  </span>
                  {vista === "charcuteria" ? (
                    <span className={estilos.dosPrecios}>
                      <Precio etiqueta="Al detal" bs={a.detal_bs} dolares={a.detal_usd} />
                      <Precio etiqueta="Al mayor" bs={a.mayor_bs} dolares={a.mayor_usd} />
                    </span>
                  ) : (
                    <Precio bs={a.bs} dolares={a.usd} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        </div>
      )}

      <p className={estilos.nota}>
        {alMayor
          ? "Precios al mayor. "
          : vista === "charcuteria"
            ? "Cada producto con su precio al detal y al mayor. "
            : enCombos
              ? "Cada combo cuesta lo que suman sus productos al precio del detal de hoy (el de la pestaña Charcutería), subido al centavo: es lo mismo que cobra la caja. "
              : ""}
        Los bolívares salen del precio en dólares por la tasa del BCV de hoy, subidos de {reglas.redondeo_bs} en {reglas.redondeo_bs}.
        Cambian solos cada mañana.
      </p>
    </main>
  );
}

/**
 * Un combo desglosado: su número, su nombre y su precio; debajo, cada producto con lo que lleva, a cuánto está el kilo
 * (o la unidad) al detal y lo que pone en el combo, en dólares.
 */
function Combo({ desglose, bs }: { desglose: DesgloseDelCombo; bs: number | null }) {
  const { combo, partes, total, faltan } = desglose;
  const estimados = partes.filter((p) => p.estimado).map((p) => p.nombre);
  return (
    <li className={estilos.combo} data-busca={`${combo.n} ${combo.nombre}`} data-busca-mas={[combo.detalle, ...partes.map((p) => p.nombre)].join(" · ")}>
      <div className={estilos.comboCabeza}>
        <span className={estilos.numero} aria-hidden="true">
          {combo.n}
        </span>
        <h3 className={estilos.comboNombre}>
          <span className={estilos.oculto}>{combo.n}. </span>
          {combo.nombre}
        </h3>
        {total !== null ? (
          <Precio bs={bs} dolares={total} />
        ) : (
          <span className={estilos.precios}>
            <span className={estilos.aMano}>{combo.precioAMano ? "A mano" : "Sin precio"}</span>
          </span>
        )}
      </div>
      {partes.length > 0 ? (
        <ul className={estilos.partes}>
          {partes.map((p) => (
            <li key={p.nombre} className={estilos.parte}>
              <span className={estilos.nombre}>
                <strong>{p.cuanto}</strong> {pegarUnidad(p.nombre)}
                <span className={estilos.unidad}>
                  {p.precio === null ? " · sin precio" : ` · ${usd(p.precio)} ${p.porKilo ? "el kilo" : "la unidad"}${p.estimado ? " (estimado)" : ""}`}
                </span>
              </span>
              <span className={estilos.importe}>{p.importe === null ? "—" : usd(p.importe)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={estilos.comboNota}>{combo.detalle}.</p>
      )}
      {combo.precioAMano && <p className={estilos.comboNota}>Lo que lleva varía con lo que se esté rebanando: el precio se pone a mano.</p>}
      {faltan.length > 0 && <p className={estilos.comboNota}>Falta el precio de: {faltan.join(", ")}.</p>}
      {estimados.length > 0 && total !== null && (
        <p className={estilos.comboNota}>{`${estimados.join(", ")}: precio estimado, todavía no está en la lista.`}</p>
      )}
    </li>
  );
}

/** Un precio: en bolívares, grande, y debajo en dólares; sin tasa, solo los dólares. `etiqueta` lo nombra para quien no ve las columnas. */
function Precio({ bs, dolares, etiqueta }: { bs: number | null; dolares: number | null; etiqueta?: string }) {
  return (
    <span className={estilos.precios}>
      {etiqueta && <span className={estilos.oculto}>{etiqueta}: </span>}
      {dolares === null ? (
        <span className={estilos.usd}>—</span>
      ) : (
        <>
          <span className={estilos.bs}>{bs !== null ? bsRedondo(bs) : usd(dolares)}</span>
          {bs !== null && <span className={estilos.usd}>{usd(dolares)}</span>}
        </>
      )}
    </span>
  );
}
