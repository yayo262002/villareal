/**
 * Cuánto pesa una pieza de cada queso, aprendido de las notas: con las
 * últimas notas que anotaron piezas y kilos se saca el peso por pieza que
 * suele tener (la mediana, para que una nota rara no lo mueva). Si un día
 * las piezas y los kilos de una nota no casan con eso, se avisa. Cálculo
 * puro, con pruebas.
 */

export type PesoTipico = { peso: number; muestras: number };

/** Con menos notas que esto no se aprende nada. */
export const MUESTRAS_MINIMAS = 3;
/** Lo que se aleja del peso típico sin avisar: un 15 %. */
export const DESVIO_QUE_AVISA = 0.15;
/** Cuántas de las últimas notas se miran. */
export const NOTAS_QUE_SE_MIRAN = 20;

export function pesoTipico(pesosPorPieza: number[]): PesoTipico | null {
  const validos = pesosPorPieza.filter((p) => Number.isFinite(p) && p > 0);
  if (validos.length < MUESTRAS_MINIMAS) return null;
  const orden = [...validos].sort((a, b) => a - b);
  const mitad = Math.floor(orden.length / 2);
  const mediana = orden.length % 2 === 1 ? orden[mitad] : (orden[mitad - 1] + orden[mitad]) / 2;
  return { peso: Math.round(mediana * 1000) / 1000, muestras: validos.length };
}

function formatear(n: number): string {
  return new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 }).format(n);
}

/** El aviso si los kilos por pieza de una nota se salen de lo que suele pesar; null si cuadra. */
export function revisarPesoPorPieza(nombre: string, piezas: number, kilos: number, tipico: PesoTipico): string | null {
  if (!(piezas > 0) || !(kilos > 0)) return null;
  const peso = kilos / piezas;
  if (Math.abs(peso - tipico.peso) <= tipico.peso * DESVIO_QUE_AVISA) return null;
  return `${nombre}: cada pieza suele pesar ${formatear(tipico.peso)} kg (en tus últimas ${tipico.muestras} notas) y hoy anotaste ${piezas} ${piezas === 1 ? "pieza" : "piezas"} y ${formatear(kilos)} kg, que son ${formatear(peso)} kg por pieza. Revisa los kilos o las piezas.`;
}
