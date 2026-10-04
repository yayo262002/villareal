import type { Vendible } from "@/lib/catalogo";
import type { PesoTipico } from "@/lib/piezas";
import { cantidad, usd } from "@/lib/dinero";
import estilos from "@/app/admin/(panel)/panel.module.css";

/** Lo que el formulario trae ya escrito: al volver con un aviso, nada se pierde. */
type Escrito = Record<string, string | string[] | undefined>;

function escrito(datos: Escrito, campo: string): string {
  const valor = datos[campo];
  return typeof valor === "string" ? valor : "";
}

type Props = {
  producto: Vendible;
  datos: Escrito;
  /** En una venta el precio es el de venta; en una compra, lo que costó. */
  modo: "venta" | "compra";
  /** Lo que hay en inventario, si se sigue. */
  existencia?: number | null;
  /** Lo que suele pesar una pieza, si se sabe. */
  pesoTipico?: PesoTipico | null;
  /** Lo que costó la última vez, en una compra. */
  ultimoCosto?: number | null;
};

/**
 * Una fila por producto (o por cada marca o presentación, si las tiene),
 * como la nota de papel: piezas (si se anotan), kilos o cartones, y el
 * precio en dólares. La usan el formulario de venta y el de compra; los
 * campos se llaman igual (`piezas_`, `cantidad_`, `precio_` más la clave).
 */
export function FilaDeProducto({ producto, datos, modo, existencia = null, pesoTipico = null, ultimoCosto = null }: Props) {
  const porKilo = producto.unidad === "kg";
  const unidad = porKilo ? "Kilos" : producto.unidad === "carton" ? "Cartones" : "Unidades";
  const porUna = porKilo ? "por kilo" : producto.unidad === "carton" ? "por cartón" : "por unidad";
  const referencia = modo === "venta" ? producto.precio_usd : ultimoCosto;
  const pistas = [
    modo === "venta" && producto.precio_usd !== null ? `En la lista: ${usd(producto.precio_usd)}` : "",
    modo === "compra" && ultimoCosto !== null ? `La última vez: ${usd(ultimoCosto)} ${porUna}` : "",
    existencia !== null ? `Hay ${cantidad(existencia, producto.unidad)}` : "",
    porKilo && pesoTipico ? `Suele pesar ${cantidad(pesoTipico.peso, "kg")} por pieza` : "",
  ].filter(Boolean);
  return (
    <fieldset className={`${estilos.filaVenta} ${porKilo ? "" : estilos["filaVenta--dos"]}`}>
      <legend>{producto.nombre}</legend>
      {/* Las piezas son cosa del queso: un cartón de huevos no tiene piezas. */}
      {porKilo && (
        <div className="campo">
          <label htmlFor={`piezas_${producto.clave}`}>Piezas</label>
          <input
            id={`piezas_${producto.clave}`}
            name={`piezas_${producto.clave}`}
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            placeholder="opcional"
            defaultValue={escrito(datos, `piezas_${producto.clave}`)}
          />
        </div>
      )}
      <div className="campo">
        <label htmlFor={`cantidad_${producto.clave}`}>{unidad}</label>
        <input
          id={`cantidad_${producto.clave}`}
          name={`cantidad_${producto.clave}`}
          type="number"
          inputMode="decimal"
          step={porKilo ? "0.001" : "1"}
          min="0"
          defaultValue={escrito(datos, `cantidad_${producto.clave}`)}
        />
      </div>
      <div className="campo">
        <label htmlFor={`precio_${producto.clave}`}>{modo === "venta" ? `USD ${porUna}` : `Costo USD ${porUna}`}</label>
        <input
          id={`precio_${producto.clave}`}
          name={`precio_${producto.clave}`}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder={referencia !== null ? String(referencia) : ""}
          defaultValue={escrito(datos, `precio_${producto.clave}`)}
        />
      </div>
      {pistas.length > 0 && <span className={estilos.filaVentaLista}>{pistas.join(" · ")}</span>}
    </fieldset>
  );
}
