/**
 * Un código de barras Code 128 (juego B: letras, números y signos), el que
 * lee cualquier lector USB. Lo usan las etiquetas de las bandejas de los
 * combos: el código es el SKU del combo («COMBO-3»), así que al escanear la
 * bandeja la caja mete el combo en la venta. Sin librerías: la tabla del
 * estándar y su dígito de control. Puro, con pruebas.
 */

/** Los anchos de barra y espacio de cada valor (0 a 106), alternando barra, espacio, barra…; cada uno suma 11 módulos (la parada, 13). */
const PATRONES = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
] as const;

const INICIO_B = 104;
const PARADA = 106;

/** Los valores del código, con el inicio, el dígito de control y la parada. Solo letras, números y signos ASCII (32 a 126). */
export function valoresCode128(texto: string): number[] {
  const datos = [...texto].map((c) => {
    const codigo = c.charCodeAt(0);
    if (codigo < 32 || codigo > 126) throw new Error(`«${c}» no se puede poner en un código de barras.`);
    return codigo - 32;
  });
  const control = (INICIO_B + datos.reduce((suma, v, i) => suma + v * (i + 1), 0)) % 103;
  return [INICIO_B, ...datos, control, PARADA];
}

/** Las barras: cada una con dónde empieza y cuánto mide, en módulos (el ancho de la barra más fina), sin los márgenes. */
export function barrasCode128(texto: string): { barras: { x: number; ancho: number }[]; ancho: number } {
  const barras: { x: number; ancho: number }[] = [];
  let x = 0;
  for (const valor of valoresCode128(texto)) {
    const patron = PATRONES[valor];
    for (let i = 0; i < patron.length; i++) {
      const ancho = Number(patron[i]);
      if (i % 2 === 0) barras.push({ x, ancho });
      x += ancho;
    }
  }
  return { barras, ancho: x };
}

/** Para las pruebas: que la tabla esté entera y bien (cada patrón suma 11, la parada 13, y no hay dos iguales). */
export function tablaCode128(): readonly string[] {
  return PATRONES;
}
