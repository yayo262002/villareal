import { negocio } from "@/config/negocio";
import { ajustesDelDelivery } from "@/lib/ajustes";
import { guardarTarifasDelDelivery } from "@/lib/acciones";
import { calcularDelivery } from "@/lib/delivery-servidor";
import { TARIFAS_MAXIMAS, ZONA_DE_DELIVERY, enlaceDeUbicacion, textoKm } from "@/lib/delivery";
import { usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Delivery" };

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : (v ?? "")).trim().slice(0, 200);

/**
 * El delivery de la web: las tarifas por distancia (en línea recta desde la tienda) con las que el carrito le dice al
 * cliente cuánto cuesta llevarle el pedido, el monto desde el que es gratis y «Probar una dirección», para ver a cuántos
 * kilómetros queda un cliente antes de poner los precios. Sin tarifas, la web dice la distancia y «por confirmar».
 */
export default async function PaginaDelivery({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const ajustes = await ajustesDelDelivery();
  const probar = uno(parametros.probar);
  const prueba = probar ? await calcularDelivery({ direccion: probar }) : null;
  const filas = Array.from({ length: TARIFAS_MAXIMAS }, (_, i) => ajustes.tarifas[i] ?? null);

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 className={estilos.titulo}>Delivery</h1>
      </div>
      <Avisos parametros={parametros} />

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Cómo lo calcula la web</h2>
        <p>
          En el carrito, el cliente elige <strong>delivery</strong> o <strong>lo busco en la tienda</strong>. Con delivery, toca «Usar mi ubicación» (el GPS
          del teléfono) o escribe su dirección, y la web mide a cuántos kilómetros está de la tienda ({negocio.direccion.split(",")[0]}), en línea recta, y le
          dice el precio con las tarifas de abajo. Al pedido por WhatsApp van su dirección, el enlace a su ubicación en el mapa, la distancia y el precio.
        </p>
        <p className="ayuda">
          Se reparte en {ZONA_DE_DELIVERY}. Más lejos, la web le dice que se confirma por WhatsApp. Sin tarifas, o más allá de la última, dice la distancia y
          «por confirmar».
        </p>
      </section>

      <section className="tarjeta" style={{ marginTop: "var(--espacio-4)" }}>
        <h2 className={estilos.subtitulo}>Tarifas por distancia</h2>
        <form action={guardarTarifasDelDelivery} className="formulario">
          <table className={estilos.tabla} style={{ maxWidth: 420 }}>
            <thead>
              <tr>
                <th scope="col">Hasta (km)</th>
                <th scope="col">Precio del delivery ($)</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((t, i) => (
                <tr key={i}>
                  <td>
                    <input
                      name={`hasta_km_${i}`}
                      type="text"
                      inputMode="decimal"
                      defaultValue={t ? String(t.hasta_km).replace(".", ",") : ""}
                      aria-label={`Fila ${i + 1}: hasta cuántos kilómetros`}
                      placeholder={i === 0 ? "3" : ""}
                      style={{ width: "100%" }}
                    />
                  </td>
                  <td>
                    <input
                      name={`precio_usd_${i}`}
                      type="text"
                      inputMode="decimal"
                      defaultValue={t ? t.precio_usd.toFixed(2).replace(".", ",") : ""}
                      aria-label={`Fila ${i + 1}: precio en dólares`}
                      placeholder={i === 0 ? "1,00" : ""}
                      style={{ width: "100%" }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ayuda">
            Una fila por tramo, en el orden que quieras: «hasta 3 km, 1 $; hasta 6 km, 2 $». El cliente paga la primera que llega hasta su distancia. Una fila
            vacía no cuenta; borra las dos casillas de una fila para quitarla.
          </p>
          <div className="campo" style={{ maxWidth: 420 }}>
            <label htmlFor="gratis_desde_usd">Delivery gratis con una compra desde ($, opcional)</label>
            <input
              id="gratis_desde_usd"
              name="gratis_desde_usd"
              type="text"
              inputMode="decimal"
              defaultValue={ajustes.gratis_desde_usd !== null ? ajustes.gratis_desde_usd.toFixed(2).replace(".", ",") : ""}
            />
            <span className="ayuda">Vacío: el delivery siempre se cobra. Solo vale dentro de las tarifas: más lejos, se confirma.</span>
          </div>
          <button type="submit" className="boton">
            Guardar las tarifas
          </button>
        </form>
      </section>

      <section className="tarjeta" style={{ marginTop: "var(--espacio-4)" }}>
        <h2 className={estilos.subtitulo}>Probar una dirección</h2>
        <form method="get" action="/admin/delivery" className="formulario">
          <div className="campo">
            <label htmlFor="probar">Dirección</label>
            <input id="probar" name="probar" type="text" defaultValue={probar} placeholder="Calle 60 con carrera 19 · Urb. El Pedregal · C.C. Sambil" maxLength={200} />
            <span className="ayuda">Para ver a cuántos kilómetros queda un cliente y qué le cobraría la web.</span>
          </div>
          <button type="submit" className="boton boton--secundario">
            Probar
          </button>
        </form>
        {prueba && (
          <div className="ayuda" role="status" style={{ marginTop: "var(--espacio-3)", fontSize: 15 }}>
            {!prueba.ok ? (
              <p>{prueba.motivo}</p>
            ) : (
              <p>
                <strong>{prueba.lugar}</strong>: a {textoKm(prueba.km)} de la tienda, en línea recta.{" "}
                {!prueba.en_zona ? (
                  <>Fuera de {ZONA_DE_DELIVERY}: la web le dice que se confirma por WhatsApp.</>
                ) : prueba.precio_usd !== null ? (
                  <>
                    La web le cobra <strong>{usd(prueba.precio_usd)}</strong>
                    {prueba.gratis_desde_usd !== null ? ` (gratis desde ${usd(prueba.gratis_desde_usd)} de compra)` : ""}.
                  </>
                ) : (
                  <>La web le dice «por confirmar»: no hay tarifa que llegue hasta ahí.</>
                )}{" "}
                <a href={enlaceDeUbicacion(prueba.punto)} target="_blank" rel="noopener">
                  Ver en el mapa
                </a>
              </p>
            )}
          </div>
        )}
      </section>
    </>
  );
}
