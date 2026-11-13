import Link from "next/link";
import { combosEnLaCaja } from "@/lib/combos-en-la-caja";
import { skuDelCombo } from "@/lib/combos-detal";
import { barrasCode128 } from "@/lib/codigo128";
import { fechaCorta, hoy } from "@/lib/dinero";
import { BotonImprimir } from "@/components/boton-imprimir";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import panel from "../../panel.module.css";
import estilos from "./etiquetas.module.css";

export const metadata = { title: "Etiquetas de los combos" };

const MAXIMO_POR_COMBO = 60;

/** El nombre en la etiqueta: sin «Combo» delante en los de todos los días («Jamón de espalda + mozzarella»); los especiales, con su nombre. */
function nombreEnLaEtiqueta(nombre: string, especial: boolean): string {
  if (especial) return nombre;
  const sin = nombre.replace(/^Combo /, "");
  return sin.charAt(0).toUpperCase() + sin.slice(1);
}

/** El precio como en el flier y las hojas: con el signo de dólar. */
const dolares = (n: number) => `$${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** El código de barras del SKU del combo, en SVG: al escanear la bandeja, la caja mete el combo en la venta. */
function CodigoDeBarras({ texto }: { texto: string }) {
  const margen = 10;
  const { barras, ancho } = barrasCode128(texto);
  return (
    <svg className={estilos.codigo} viewBox={`0 0 ${ancho + 2 * margen} 30`} preserveAspectRatio="none" role="img" aria-label={`Código de barras ${texto}`}>
      {barras.map((b) => (
        <rect key={b.x} x={b.x + margen} y={0} width={b.ancho} height={30} />
      ))}
    </svg>
  );
}

/**
 * Las etiquetas de las bandejas de los combos, para imprimir en hojas carta
 * (diez por hoja) y pegar en cada bandeja: el número y el nombre del combo,
 * lo que lleva, su precio de hoy (el de la charcutería) y el código de
 * barras de su SKU («COMBO-3»): en la caja, escanear la bandeja mete el
 * combo en la venta. Se elige cuántas de cada uno; como el precio cambia
 * con los costos, se imprimen otra vez cuando cambie.
 */
export default async function PaginaEtiquetas({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const combos = await combosEnLaCaja();
  const pedidas = (clave: string) => {
    const escrito = parametros[`c_${clave}`];
    if (typeof escrito !== "string") return 1;
    const n = Math.round(Number(escrito));
    return Number.isFinite(n) ? Math.min(MAXIMO_POR_COMBO, Math.max(0, n)) : 1;
  };
  const etiquetas = combos.flatMap((c) => Array.from({ length: pedidas(c.combo.clave) }, (_, i) => ({ c, i })));
  const hoyEs = fechaCorta(hoy());

  return (
    <>
      <div className={`${panel.encabezado} ${panel.noImprimir}`}>
        <div>
          <p>
            <Link href="/admin/ventas">← Ventas</Link>
          </p>
          <h1 className={panel.titulo}>Etiquetas de los combos</h1>
        </div>
        <div className={panel.accionesFila} style={{ flexWrap: "wrap" }}>
          <BotonImprimir className="boton">Imprimir {etiquetas.length === 1 ? "la etiqueta" : `las ${etiquetas.length} etiquetas`}</BotonImprimir>
        </div>
      </div>
      <div className={panel.noImprimir}>
        <Avisos parametros={parametros} />
        <p className="ayuda" style={{ maxWidth: "70ch" }}>
          Una etiqueta por bandeja, con su precio de hoy (el mismo de la charcutería) y el código de barras de su número: en la caja, escanear la bandeja mete el combo en
          la venta. Se imprimen en hojas carta, diez por hoja, en papel adhesivo o normal, y se recortan por la raya. El precio cambia con los costos: imprímelas otra vez
          cuando cambie.
        </p>
        <form method="get" action="/admin/combos/etiquetas" className={`tarjeta ${estilos.cuantas}`}>
          <h2 className={panel.subtitulo} style={{ gridColumn: "1 / -1", margin: 0 }}>
            Cuántas de cada uno
          </h2>
          {combos.map((c) => (
            <label key={c.combo.clave} className={estilos.cuantasFila}>
              <span>
                <strong>{c.combo.n}.</strong> {nombreEnLaEtiqueta(c.combo.nombre, c.combo.n >= 10)}
                {c.precio_usd === null && <span className="ayuda"> (sin precio: le falta {c.faltan.join(", ")} en la lista del detal)</span>}
              </span>
              <input type="number" name={`c_${c.combo.clave}`} min={0} max={MAXIMO_POR_COMBO} defaultValue={pedidas(c.combo.clave)} inputMode="numeric" />
            </label>
          ))}
          <button type="submit" className="boton boton--secundario" style={{ gridColumn: "1 / -1", justifySelf: "start" }}>
            Ver las etiquetas
          </button>
        </form>
      </div>

      {etiquetas.length === 0 ? (
        <p className="vacio">No pediste ninguna etiqueta.</p>
      ) : (
        <div className={estilos.hoja}>
          {etiquetas.map(({ c, i }) => {
            const sku = skuDelCombo(c.combo);
            const especial = c.combo.n >= 10;
            return (
              <article key={`${c.combo.clave}-${i}`} className={`${estilos.etiqueta} ${especial ? estilos.especial : ""}`}>
                <header className={estilos.banda}>
                  <span>Villa Real</span>
                  <strong>Combo {c.combo.n}</strong>
                </header>
                <div className={estilos.cuerpo}>
                  <p className={estilos.nombre}>{nombreEnLaEtiqueta(c.combo.nombre, especial)}</p>
                  <p className={estilos.detalle}>{c.combo.detalle}</p>
                  <div className={estilos.pie}>
                    <div>
                      <p className={estilos.precio}>{c.precio_usd !== null ? dolares(c.precio_usd) : "Consulte"}</p>
                      <p className={estilos.fecha}>{c.precio_usd !== null ? `Precio del ${hoyEs} · se paga en Bs a la tasa BCV` : "el precio del día"}</p>
                    </div>
                    <div className={estilos.barras}>
                      <CodigoDeBarras texto={sku} />
                      <span>{sku}</span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
