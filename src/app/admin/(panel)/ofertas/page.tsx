import Link from "next/link";
import { NOMBRE_ESTADO_OFERTA, listarOfertas, type EstadoOferta } from "@/lib/ofertas";
import { estaVigente } from "@/lib/catalogo";
import { leerTasa } from "@/lib/ajustes";
import { guardarOferta } from "@/lib/acciones";
import { aBolivares, bs, fechaCorta, hoy, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Ofertas" };

const CLASE: Record<EstadoOferta, string> = { activa: "estado--pagada", borrador: "estado--parcial", inactiva: "estado--por_pagar" };

/** Las ofertas y combos: cuáles salen hoy en la web, cuáles son borradores, y una nueva. Cada una se edita en su ficha. */
export default async function PaginaOfertas({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const [ofertas, tasa] = await Promise.all([listarOfertas(), leerTasa()]);
  const fecha = hoy();

  return (
    <>
      <div>
        <p>
          <Link href="/admin/productos">← Productos</Link>
        </p>
        <h1 className={estilos.titulo}>Ofertas y combos</h1>
      </div>
      <Avisos parametros={parametros} />
      <p className={estilos.ayuda}>
        Una oferta junta varios productos con un precio y unas fechas. Sale en la web (en Ofertas) solo si está activa y dentro de sus fechas. Los
        productos marcados «Mostrarlo en Ofertas» en su ficha salen también ahí.
      </p>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Ofertas ({ofertas.length})</h2>
        {ofertas.length === 0 ? (
          <p className="vacio">Todavía no hay ninguna.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Oferta</th>
                  <th>Estado</th>
                  <th className="numero">Precio</th>
                  <th>Fechas</th>
                  <th>Lleva</th>
                </tr>
              </thead>
              <tbody>
                {ofertas.map((o) => {
                  const enBs = o.precio_usd !== null ? aBolivares(o.precio_usd, tasa?.valor ?? null) : null;
                  return (
                    <tr key={o.id} className={o.estado === "activa" ? undefined : estilos.filaApagada}>
                      <td data-label="Oferta">
                        <Link href={`/admin/ofertas/${o.id}`}>
                          <strong>{o.nombre}</strong>
                        </Link>
                      </td>
                      <td data-label="Estado">
                        <span className={`${estilos.estado} ${estilos[CLASE[o.estado]]}`}>{NOMBRE_ESTADO_OFERTA[o.estado]}</span>
                        {o.estado === "activa" && !estaVigente(o, fecha) ? <span className="ayuda"> · fuera de fechas</span> : null}
                      </td>
                      <td data-label="Precio" className="numero">
                        {o.precio_usd === null ? <span className="ayuda">sin precio</span> : `${usd(o.precio_usd)}${enBs !== null ? ` · ${bs(enBs)}` : ""}`}
                      </td>
                      <td data-label="Fechas" data-vacio={o.desde || o.hasta ? undefined : ""}>
                        {o.desde || o.hasta ? `${o.desde ? `del ${fechaCorta(o.desde)}` : ""} ${o.hasta ? `al ${fechaCorta(o.hasta)}` : "sin fin"}`.trim() : "—"}
                      </td>
                      <td data-label="Lleva">{o.productos.length === 0 ? <span className="ayuda">nada todavía</span> : o.productos.map((p) => p.nombre).join(", ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Oferta nueva</h2>
        <form action={guardarOferta} className="formulario">
          <div className="campo">
            <label htmlFor="oferta-nombre">Nombre</label>
            <input id="oferta-nombre" name="nombre" type="text" required placeholder="Pack Burger" />
          </div>
          <div className="campo">
            <label htmlFor="oferta-descripcion">Descripción</label>
            <input id="oferta-descripcion" name="descripcion" type="text" placeholder="Queso, tocineta, papas y salsas" />
          </div>
          <div>
            <button type="submit" className="boton">
              Crear oferta
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
