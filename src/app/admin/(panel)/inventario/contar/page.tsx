import Link from "next/link";
import { existenciasPorClave } from "@/lib/inventario";
import { listarProductos } from "@/lib/productos";
import { listarVariantes } from "@/lib/variantes";
import { listarFamilias } from "@/lib/familias";
import { existenciasPorFamilia, FUERA_DE_LA_WEB, cantidadLegible } from "@/lib/existencias-por-familia";
import { guardarRecuentoGeneral } from "@/lib/acciones";
import { fechaCorta, hoy } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { exigirPanel } from "@/lib/panel";
import estilos from "../../panel.module.css";
import propios from "./contar.module.css";

export const metadata = { title: "Contar todo" };

const UNIDAD_EN_LA_CASILLA = { kg: "kilos", unidad: "unidades", carton: "cartones" } as Record<string, string>;

/**
 * El recuento general: todo lo que hay en la web (y lo que no está en ella
 * pero tiene existencia o se ha vendido), por familias, cada artículo con lo
 * que dice el sistema y una casilla para lo contado. Se guarda todo de una
 * vez; las casillas vacías no se tocan. Así se empieza a seguir el
 * inventario y así se corrige cada cierto tiempo.
 */
export default async function PaginaContarTodo({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  await exigirPanel();
  const parametros = await searchParams;
  const [productos, variantes, familias, existencias] = await Promise.all([listarProductos(), listarVariantes(), listarFamilias(), existenciasPorClave()]);
  const grupos = existenciasPorFamilia(productos, variantes, familias, existencias, { conEscondidos: true });

  return (
    <>
      <p className={estilos.ayuda} style={{ marginBottom: "var(--espacio-2)" }}>
        <Link href="/admin/inventario">← Inventario</Link>
      </p>
      <h1 className={estilos.titulo}>Contar todo</h1>
      <Avisos parametros={parametros} />
      <p className={estilos.ayuda}>
        Cuenta lo que hay en la cava y en los estantes y escríbelo en su casilla: los kilos de lo que va por kilo (pesa las piezas), y las unidades
        o los cartones de lo demás. Deja vacío lo que no contaste: no se toca. Al guardar, cada artículo queda con lo que contaste, con la fecha
        de hoy ({fechaCorta(hoy())}), y desde ahí las ventas lo descuentan solas. Guárdalo antes de anotar más ventas.
      </p>

      {grupos.length === 0 ? (
        <p className="vacio">No hay nada publicado en la web todavía.</p>
      ) : (
        <form action={guardarRecuentoGeneral} className="tarjeta">
          {grupos.map((g) => (
            <fieldset key={g.familia} className={propios.grupo}>
              <legend className={propios.familia}>{g.familia}</legend>
              {g.familia === FUERA_DE_LA_WEB && (
                <p className={estilos.ayuda}>No salen en la web, pero tienen existencia o se han vendido: cuéntalos también si están en la cava.</p>
              )}
              <ul className={propios.filas}>
                {g.filas.map((f) => {
                  const e = f.existencia;
                  const id = `contado-${f.clave}`;
                  return (
                    <li key={f.clave} className={propios.fila}>
                      <label htmlFor={id} className={propios.nombre}>
                        <strong>{f.tipo}</strong>
                        {f.detalle && <span className={propios.detalle}>{f.detalle}</span>}
                        <span className={propios.sistema}>
                          {e.seguido ? (
                            <>
                              El sistema dice{" "}
                              <span className={e.existencia < 0 ? propios.negativo : undefined}>{cantidadLegible(e.existencia, f.unidad)}</span>
                            </>
                          ) : (
                            "Sin contar todavía"
                          )}
                        </span>
                      </label>
                      <span className={propios.casilla}>
                        <input id={id} name={`contado_${f.clave}`} type="text" inputMode="decimal" autoComplete="off" placeholder="—" />
                        <span className={propios.unidad}>{UNIDAD_EN_LA_CASILLA[f.unidad] ?? f.unidad}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}
          <div className={propios.pie}>
            <div className={`campo ${propios.motivo}`}>
              <label htmlFor="motivo">Nota (opcional)</label>
              <input id="motivo" name="motivo" type="text" maxLength={120} placeholder="Recuento general" />
            </div>
            <button type="submit" className="boton">
              Guardar el recuento
            </button>
          </div>
        </form>
      )}
    </>
  );
}
