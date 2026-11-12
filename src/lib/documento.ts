/**
 * La cédula o el RIF de quien compra, como va en la factura: su letra, un
 * guion y los números sin puntos («V-12345678», «J-40806430-8»). Se puede
 * escribir como venga («12.345.678», «v12345678», «J408064308», «e 8123456»):
 * un número solo es una cédula venezolana. Sin `server-only`: la caja lo usa
 * en el teléfono para reconocer a quien ya compró.
 *
 * La providencia de facturación (SNAT/2026/00093, art. 8, num. 6) pide el
 * nombre y el RIF de quien compra; a una persona que no necesita la factura
 * para sus impuestos le basta la cédula, «como mínimo». No hay excepción por
 * monto: dos lonchas también llevan cédula.
 */

/** V venezolano, E extranjero, J empresa, G gobierno, C consejo comunal, P pasaporte. */
export type LetraDeDocumento = "V" | "E" | "J" | "G" | "C" | "P";

export type Documento = {
  letra: LetraDeDocumento;
  /** El documento como va en la factura: «V-12345678», «V-12345678-9», «J-40806430-8», «P-AB123456». */
  texto: string;
  /**
   * Con lo que se reconoce a la misma persona aunque una vez dé la cédula y otra el RIF: la letra y el número, sin
   * ceros delante y sin el dígito final del RIF («V-12345678» y «V-12345678-9» son la misma).
   */
  clave: string;
};

/** Lee una cédula, un RIF o un pasaporte escrito de cualquier forma; null si no es ninguno. */
export function leerDocumento(escrito: string): Documento | null {
  const limpio = escrito
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s.,_/]+/g, "")
    .replace(/^([VEJGCP])-+/, "$1");
  if (!limpio) return null;

  // Un pasaporte: la P y letras o números.
  const pasaporte = limpio.match(/^P-?([A-Z0-9]{5,15})$/);
  if (pasaporte) return { letra: "P", texto: `P-${pasaporte[1]}`, clave: `P-${pasaporte[1]}` };

  // Sin letra, un número solo es una cédula venezolana.
  const conLetra = /^[VEJGC]/.test(limpio) ? limpio : `V${limpio}`;
  const letra = conLetra[0] as LetraDeDocumento;
  const resto = conLetra.slice(1);

  // El RIF: ocho números y el dígito que lo comprueba, con o sin guion («40806430-8» o «408064308»).
  const rif = resto.match(/^(\d{8})-?(\d)$/);
  if (rif) return { letra, texto: `${letra}-${rif[1]}-${rif[2]}`, clave: `${letra}-${Number(rif[1])}` };

  // Una empresa, el gobierno o un consejo comunal solo tienen RIF: sin el dígito final no está completo.
  if (letra === "J" || letra === "G" || letra === "C") return null;

  // La cédula: de cinco a ocho números (las de nueve con guion ya son RIF, arriba).
  const cedula = resto.match(/^(\d{5,8})$/);
  if (cedula) {
    const numero = String(Number(cedula[1]));
    return { letra, texto: `${letra}-${numero}`, clave: `${letra}-${numero}` };
  }
  return null;
}

/** Por qué no vale lo escrito, dicho para la caja; vacío si vale o si no se escribió nada. */
export function problemaDelDocumento(escrito: string): string {
  if (!escrito.trim()) return "";
  if (leerDocumento(escrito)) return "";
  const limpio = escrito.toUpperCase().replace(/[\s.,_/-]+/g, "");
  if (/^[JGC]\d{8}$/.test(limpio)) return "A ese RIF le falta el último número (el que va después del guion).";
  return "Eso no es una cédula ni un RIF: escribe el número de la cédula (12345678) o el RIF con su letra (J-12345678-9).";
}
