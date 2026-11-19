import Link from "next/link";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { agregarArticuloDeCompra, alternarArticuloDeCompra, destacharListaDeCompra, quitarArticuloDeCompra } from "@/lib/acciones";
import { usd } from "@/lib/dinero";
import { listarCompra } from "@/lib/lista-compra";
import { TIPOS_DE_COMPRA, agruparCompra, cuentaDeCompra, type ArticuloDeCompra } from "@/lib/lista-compra-calculo";
import { exigirPanel } from "@/lib/panel";
import estilos from "../panel.module.css";
import propios from "./compra.module.css";

export const metadata = { title: "Lista de compra" };

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : (v ?? "")).trim();

/** El ancla de un grupo: «Tío Víctor» → «g-tio-victor». */
const anclaDeGrupo = (clave: string) =>
  `g-${clave
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)}`;

/**
 * La lista de compra (el dueño, 18/11/2026: «hazme la lista que pueda abrir en el teléfono»): lo que hay que comprar,
 * por tipo o por proveedor, con dónde sale más barato y a cuánto. Se toca un producto para tacharlo; se agrega lo que
 * falte, se quita lo que sobre y, terminada la compra, «Destachar todo» la deja como nueva. Sin JavaScript: cada toque
 * es un formulario que vuelve a la altura del producto.
 */
export default async function PaginaListaDeCompra({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  await exigirPanel();
  const parametros = await searchParams;
  const porProveedor = uno(parametros.ver) === "proveedor";
  const soloFaltan = uno(parametros.solo) === "faltan";
  const editando = uno(parametros.editar) === "1";
  const porQuitar = Number(uno(parametros.quitar)) || null;
  const confirmarDestachar = uno(parametros.confirmar) === "destachar";

  const articulos = await listarCompra();
  const { total, faltan } = cuentaDeCompra(articulos);
  const grupos = agruparCompra(articulos, porProveedor ? "proveedor" : "tipo", soloFaltan);

  /** Esta misma pantalla con otra forma de verla. */
  const enlace = (cambios: { ver?: boolean; solo?: boolean; editar?: boolean; quitar?: number; confirmar?: boolean }, ancla = "") => {
    const q = new URLSearchParams();
    if (cambios.ver ?? porProveedor) q.set("ver", "proveedor");
    if (cambios.solo ?? soloFaltan) q.set("solo", "faltan");
    if (cambios.editar ?? editando) q.set("editar", "1");
    if (cambios.quitar) q.set("quitar", String(cambios.quitar));
    if (cambios.confirmar) q.set("confirmar", "destachar");
    const s = q.toString();
    return `/admin/compra${s ? `?${s}` : ""}${ancla ? `#${ancla}` : ""}`;
  };
  const comoEsta = (
    <>
      {porProveedor && <input type="hidden" name="ver" value="proveedor" />}
      {soloFaltan && <input type="hidden" name="solo" value="faltan" />}
      {editando && <input type="hidden" name="editar" value="1" />}
    </>
  );

  const fila = (a: ArticuloDeCompra, grupo: string) => {
    const detalle = [porProveedor ? "" : a.donde, a.nota].filter(Boolean).join(" · ");
    return (
      <li key={a.id} id={`c${a.id}`} className={propios.fila}>
        <form action={alternarArticuloDeCompra} data-ligero="">
          <input type="hidden" name="id" value={a.id} />
          <input type="hidden" name="grupo" value={grupo} />
          {comoEsta}
          <button type="submit" className={propios.articulo} aria-pressed={a.listo}>
            <span className={propios.bola} aria-hidden="true" />
            <span className={propios.texto}>
              <span className={propios.nombre}>{a.nombre}</span>
              {detalle && <span className={propios.detalle}>{detalle}</span>}
            </span>
            <span className={propios.precio}>{a.precio_usd !== null ? usd(a.precio_usd) : ""}</span>
          </button>
        </form>
        {editando &&
          (porQuitar === a.id ? (
            <form action={quitarArticuloDeCompra} className={propios.confirmar}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="nombre" value={a.nombre} />
              {comoEsta}
              <span>¿Quitar «{a.nombre}» de la lista?</span>
              <button type="submit" className="boton boton--peligro">
                Sí, quitar
              </button>
              <Link href={enlace({}, `c${a.id}`)}>No</Link>
            </form>
          ) : (
            <Link href={enlace({ quitar: a.id }, `c${a.id}`)} className={propios.quitar} aria-label={`Quitar ${a.nombre} de la lista`}>
              Quitar
            </Link>
          ))}
      </li>
    );
  };

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 className={estilos.titulo}>Lista de compra</h1>
      </div>
      <Avisos parametros={parametros} />

      <section className={propios.cabeza}>
        <p className={propios.cuenta}>
          {total === 0 ? "La lista está vacía" : faltan === 0 ? "¡Ya está todo!" : `Faltan ${faltan} de ${total}`}
        </p>
        {total > 0 && <progress className={propios.progreso} max={total} value={total - faltan} aria-label="Lo comprado" />}
        <div className={propios.mandos}>
          <span className={propios.pastillas}>
            <Link href={enlace({ ver: false })} aria-current={!porProveedor ? "true" : undefined}>
              Por tipo
            </Link>
            <Link href={enlace({ ver: true })} aria-current={porProveedor ? "true" : undefined}>
              Por proveedor
            </Link>
          </span>
          <span className={propios.pastillas}>
            <Link href={enlace({ solo: false })} aria-current={!soloFaltan ? "true" : undefined}>
              Todo
            </Link>
            <Link href={enlace({ solo: true })} aria-current={soloFaltan ? "true" : undefined}>
              Lo que falta
            </Link>
          </span>
        </div>
        <p className="ayuda" style={{ margin: 0 }}>
          Toca un producto para tacharlo cuando ya lo tengas; tócalo otra vez para destacharlo.
          {editando ? " Estás quitando productos: toca «Quitar» en el que sobre." : ""}
        </p>
      </section>

      {total === 0 && <p className="tarjeta">Agrega abajo lo que hay que comprar.</p>}
      {total > 0 && grupos.length === 0 && <p className="tarjeta">No falta nada: todo está tachado.</p>}

      {grupos.map((g) => (
        <section key={g.clave} id={anclaDeGrupo(g.clave)} className={propios.grupo}>
          <h2 className={propios.titulo}>
            {g.titulo}
            <small className={g.faltan === 0 ? propios.completo : undefined}>{g.faltan === 0 ? "Completo" : `${g.faltan} por comprar`}</small>
          </h2>
          <ul className={propios.filas}>{g.articulos.map((a) => fila(a, anclaDeGrupo(g.clave)))}</ul>
        </section>
      ))}

      <section id="agregar" className="tarjeta" style={{ marginTop: "var(--espacio-4)" }}>
        <h2 className={estilos.subtitulo}>Agregar algo que falta</h2>
        <form action={agregarArticuloDeCompra} className="formulario">
          {comoEsta}
          <div className={propios.campos}>
            <div className="campo">
              <label htmlFor="compra-nombre">Qué es</label>
              <input id="compra-nombre" name="nombre" required maxLength={80} placeholder="Servilletas, vasos…" autoComplete="off" />
            </div>
            <div className="campo">
              <label htmlFor="compra-categoria">Tipo</label>
              <select id="compra-categoria" name="categoria" defaultValue="otros">
                {TIPOS_DE_COMPRA.map(([clave, nombre]) => (
                  <option key={clave} value={clave}>
                    {nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="compra-donde">Dónde (si lo sabes)</label>
              <input id="compra-donde" name="donde" maxLength={40} placeholder="Lusi, PRODISA…" autoComplete="off" />
            </div>
            <div className="campo">
              <label htmlFor="compra-precio">Precio en $ (si lo sabes)</label>
              <input id="compra-precio" name="precio_usd" type="text" inputMode="decimal" placeholder="2,50" autoComplete="off" />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="compra-nota">Nota (opcional)</label>
            <input id="compra-nota" name="nota" maxLength={120} placeholder="bulto de 12, pregunta por la marca…" autoComplete="off" />
          </div>
          <button type="submit" className="boton">
            Agregar a la lista
          </button>
        </form>
      </section>

      <section id="arreglar" className="tarjeta" style={{ marginTop: "var(--espacio-4)" }}>
        <h2 className={estilos.subtitulo}>Arreglar la lista</h2>
        <p className="ayuda">
          Si algo no lo vas a comprar, quítalo. Al terminar la compra, «Destachar todo» deja la lista como nueva para la próxima.
        </p>
        <div className={propios.botones}>
          <Link href={enlace({ editar: !editando })} className="boton boton--secundario">
            {editando ? "Listo, no quitar más" : "Quitar productos de la lista"}
          </Link>
          {confirmarDestachar ? (
            <form action={destacharListaDeCompra} className={propios.confirmar}>
              {comoEsta}
              <span>¿Destachar todo?</span>
              <button type="submit" className="boton boton--peligro">
                Sí, destachar todo
              </button>
              <Link href={enlace({}, "arreglar")}>No</Link>
            </form>
          ) : (
            <Link href={enlace({ confirmar: true }, "arreglar")} className="boton boton--secundario">
              Destachar todo
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
