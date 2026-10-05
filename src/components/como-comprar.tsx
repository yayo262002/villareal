import { enlaceMapa, negocio } from "@/config/negocio";
import estilos from "@/app/page.module.css";

/**
 * «Cómo comprar»: cómo se paga, dónde está la tienda, el horario y el
 * enlace para pedir precio al mayor. Lo comparten la página de cada
 * producto y la de cada marca.
 */
export function ComoComprar({ mayor }: { mayor: string | null }) {
  const mapa = enlaceMapa();
  return (
    <div className={estilos.bloque}>
      <h2 className={estilos.bloqueTitulo}>Cómo comprar</h2>
      <dl className={estilos.datos}>
        <div>
          <dt>Formas de pago</dt>
          <dd>Pago móvil, transferencia, efectivo, Zelle o Binance. En bolívares, a la tasa del día.</dd>
        </div>
        {(negocio.direccion || negocio.ciudad) && (
          <div>
            <dt>Tienda física</dt>
            <dd>
              {[negocio.direccion, negocio.ciudad].filter(Boolean).join(", ")}
              {mapa && (
                <>
                  {" · "}
                  <a href={mapa} target="_blank" rel="noopener">
                    Cómo llegar
                  </a>
                </>
              )}
            </dd>
          </div>
        )}
        {negocio.horario && (
          <div>
            <dt>Horario</dt>
            <dd>{negocio.horario}</dd>
          </div>
        )}
        {mayor && (
          <div>
            <dt>Al mayor</dt>
            <dd>
              <a href={mayor} target="_blank" rel="noopener">
                Pide el precio según la cantidad
              </a>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
