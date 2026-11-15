import { redondear } from "./dinero.ts";
import { bolivaresDeLaFactura, type DocumentoDelLibro } from "./factura-calculo.ts";
import type { FacturaDeCompra } from "./libro-compras-calculo.ts";

/**
 * El IVA de cada mes, como lo declara el contador: el débito fiscal (el IVA cobrado en las facturas de venta, menos el
 * de las notas de crédito), el crédito fiscal (el IVA pagado en las facturas de compra) y lo que queda: si el débito
 * es mayor, el IVA a pagar; si es menor, un excedente de crédito que pasa al mes siguiente y se descuenta allí. Todo en
 * bolívares, que es como se declara: cada venta a la tasa con que se emitió su factura, cada compra como viene impresa.
 *
 * No cuenta las retenciones de IVA (si un cliente contribuyente especial retiene, el contador las resta aparte) ni
 * otros ajustes: es la cuenta de los dos libros, para tenerla a la vista y llevársela al contador. Puro, con pruebas.
 */

export type IvaDeUnLibro = { documentos: number; exento_bs: number; base_bs: number; iva_bs: number; total_bs: number };

/** Lo que suma en bolívares el libro de ventas de un mes. Un documento sin tasa no se puede pasar: se cuenta aparte. */
export function ivaDeLasVentas(documentos: DocumentoDelLibro[]): IvaDeUnLibro & { sin_tasa: number } {
  const suma = { documentos: 0, exento_bs: 0, base_bs: 0, iva_bs: 0, total_bs: 0, sin_tasa: 0 };
  for (const d of documentos) {
    if (!d.tasa) {
      suma.sin_tasa++;
      continue;
    }
    const signo = d.tipo === "nota_credito" ? -1 : 1;
    // Las mismas cifras que la factura impresa y el libro de ventas.
    const enBs = bolivaresDeLaFactura(d);
    if (!enBs) {
      suma.sin_tasa++;
      continue;
    }
    suma.documentos++;
    suma.exento_bs += signo * enBs.exento_bs;
    suma.base_bs += signo * enBs.base_imponible_bs;
    suma.iva_bs += signo * enBs.iva_bs;
    suma.total_bs += signo * enBs.total_bs;
  }
  return { ...suma, exento_bs: redondear(suma.exento_bs), base_bs: redondear(suma.base_bs), iva_bs: redondear(suma.iva_bs), total_bs: redondear(suma.total_bs) };
}

/** Lo que suma el libro de compras de un mes. */
export function ivaDeLasCompras(facturas: Pick<FacturaDeCompra, "exento_bs" | "base_bs" | "iva_bs" | "total_bs">[]): IvaDeUnLibro {
  return {
    documentos: facturas.length,
    exento_bs: redondear(facturas.reduce((s, f) => s + Number(f.exento_bs), 0)),
    base_bs: redondear(facturas.reduce((s, f) => s + Number(f.base_bs), 0)),
    iva_bs: redondear(facturas.reduce((s, f) => s + Number(f.iva_bs), 0)),
    total_bs: redondear(facturas.reduce((s, f) => s + Number(f.total_bs), 0)),
  };
}

export type IvaDelMes = {
  mes: string;
  /** El IVA de las ventas (débito fiscal). */
  debito_bs: number;
  /** El IVA de las compras (crédito fiscal). */
  credito_bs: number;
  /** El excedente de crédito que venía del mes anterior. */
  excedente_anterior_bs: number;
  /** Lo que hay que pagar este mes (0 si el crédito alcanza). */
  a_pagar_bs: number;
  /** El excedente que pasa al mes siguiente (0 si se paga). */
  excedente_siguiente_bs: number;
};

/**
 * Mes a mes, en orden, llevando el excedente de crédito de uno al siguiente. `meses` puede venir desordenado; los meses
 * sin nada en medio no hace falta darlos (el excedente sigue igual).
 */
export function ivaMesAMes(meses: { mes: string; debito_bs: number; credito_bs: number }[]): IvaDelMes[] {
  let excedente = 0;
  return [...meses]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((m) => {
      const saldo = redondear(m.debito_bs - m.credito_bs - excedente);
      const fila: IvaDelMes = {
        mes: m.mes,
        debito_bs: redondear(m.debito_bs),
        credito_bs: redondear(m.credito_bs),
        excedente_anterior_bs: redondear(excedente),
        a_pagar_bs: saldo > 0 ? saldo : 0,
        excedente_siguiente_bs: saldo < 0 ? -saldo : 0,
      };
      excedente = fila.excedente_siguiente_bs;
      return fila;
    });
}
