/**
 * Leer una dirección de Barquisimeto y situarla en la cuadrícula del centro.
 *
 * El centro de la ciudad es una cuadrícula de calles y carreras numeradas:
 * «Calle 38 entre carreras 30 y 31», «Carrera 19 con calle 25». Con el número
 * de la calle y el de la carrera se sabe dónde está un cliente y a cuántas
 * cuadras de otro, sin mapas ni servicios de pago.
 *
 * Lo que no se entiende no se adivina: una urbanización, un barrio o una
 * dirección a medias quedan «sin ubicar» y se dice por qué, para que el
 * dueño la complete. Cálculo puro, con pruebas.
 */

/** Un punto de la cuadrícula. Los medios son «entre»: carrera 30,5 es entre la 30 y la 31. */
export type Ubicacion = { calle: number; carrera: number };

export type Lectura =
  | { ubicada: true; ubicacion: Ubicacion }
  /** `parcial` guarda lo que sí se entendió (solo la calle o solo la carrera), por si el mapa completa lo demás. */
  | { ubicada: false; motivo: string; parcial?: Partial<Ubicacion> };

type Eje = "calle" | "carrera";

const NUMERO_MAXIMO = 120;

/**
 * Palabras que indican que la dirección está fuera de la cuadrícula: ahí
 * «calle 3» es la calle 3 de la urbanización, no la del centro.
 */
const FUERA_DE_LA_CUADRICULA =
  /\b(urb|urbanizacion|barrio|bo|conjunto|residencias?|resd?|caserio|parcelamiento|parcela|vereda|carretera|autopista|km|kilometro|zona industrial|via)\b/;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A qué eje se refiere una palabra de la dirección, o null si es de enlace («con», «entre»). */
function ejeDe(palabra: string, numero: number): Eje | "otro" | null {
  if (/^(calles?|cll|cl)$/.test(palabra)) return "calle";
  if (/^(carreras?|cra|kra|krr|carr|cr)$/.test(palabra)) return "carrera";
  // La avenida 20 es la carrera 20. Las demás avenidas tienen nombre, no número.
  if (/^(avenida|av|ave)$/.test(palabra)) return numero === 20 ? "carrera" : null;
  return "otro";
}

const contrario = (eje: Eje): Eje => (eje === "calle" ? "carrera" : "calle");
const media = (numeros: number[]) => numeros.reduce((s, n) => s + n, 0) / numeros.length;

export function leerDireccion(direccion: string): Lectura {
  const texto = normalizar(direccion);
  if (!texto) return { ubicada: false, motivo: "no tiene dirección" };
  if (FUERA_DE_LA_CUADRICULA.test(texto)) {
    return { ubicada: false, motivo: "parece una urbanización o un barrio, fuera de la cuadrícula del centro" };
  }

  // «calle 38», «carreras 30 y 31», «entre 30 y 31», «con 25», «esquina 25».
  const patron =
    /\b(calles?|cll|cl|carreras?|cra|kra|krr|carr|cr|avenida|ave|av|entre|con|c\/|esquina|esq)\s*(\d{1,3})(?:\s*(?:y|e|-)\s*(\d{1,3}))?\b/g;
  const valores: Record<Eje, number[]> = { calle: [], carrera: [] };
  let ultimo: Eje | null = null;

  for (const hallazgo of texto.matchAll(patron)) {
    const numeros = [hallazgo[2], hallazgo[3]]
      .filter((n): n is string => n !== undefined)
      .map(Number)
      .filter((n) => n >= 1 && n <= NUMERO_MAXIMO);
    if (numeros.length === 0) continue;

    const clase = ejeDe(hallazgo[1], numeros[0]);
    if (clase === null) continue;
    // «con 25» y «entre 30 y 31» hablan del eje que no se acaba de nombrar.
    const eje: Eje | null = clase === "otro" ? (ultimo ? contrario(ultimo) : null) : clase;
    if (!eje) continue;
    if (valores[eje].length === 0) valores[eje] = numeros.slice(0, 2);
    if (clase !== "otro") ultimo = eje;
  }

  const tieneCalle = valores.calle.length > 0;
  const tieneCarrera = valores.carrera.length > 0;
  if (tieneCalle && tieneCarrera) {
    return { ubicada: true, ubicacion: { calle: media(valores.calle), carrera: media(valores.carrera) } };
  }
  if (tieneCalle) return { ubicada: false, motivo: "falta la carrera", parcial: { calle: media(valores.calle) } };
  if (tieneCarrera) return { ubicada: false, motivo: "falta la calle", parcial: { carrera: media(valores.carrera) } };
  return { ubicada: false, motivo: "no dice calle ni carrera" };
}

/** El motivo de no poder situar una dirección, en una frase: «La dirección falta la carrera» no se dice. */
export function explicarMotivo(motivo: string): string {
  if (motivo === "no tiene dirección") return "No tiene dirección.";
  if (motivo.startsWith("falta")) return `A la dirección le ${motivo}.`;
  return `La dirección ${motivo}.`;
}

/**
 * La dirección como la entiende mejor un mapa: el cruce de la calle con la
 * carrera. «Entre la 30 y la 31» se redondea a la 30.
 */
export function cruceParaElMapa(ubicacion: Ubicacion, ciudad: string): string {
  return `Calle ${Math.floor(ubicacion.calle)} con Carrera ${Math.floor(ubicacion.carrera)}, ${ciudad}`;
}

/**
 * La ubicación dicha en palabras, para comprobarla, con la carrera primero
 * como se dice en Barquisimeto: «carrera 19 con calle 25», «carrera 22,
 * entre calles 30 y 31», «calle 38, entre carreras 30 y 31».
 */
export function describirUbicacion(u: Ubicacion): string {
  const entre = (plural: string, n: number) => `entre ${plural} ${Math.floor(n)} y ${Math.ceil(n)}`;
  const calleExacta = Number.isInteger(u.calle);
  const carreraExacta = Number.isInteger(u.carrera);
  if (calleExacta && carreraExacta) return `carrera ${u.carrera} con calle ${u.calle}`;
  if (carreraExacta) return `carrera ${u.carrera}, ${entre("calles", u.calle)}`;
  if (calleExacta) return `calle ${u.calle}, ${entre("carreras", u.carrera)}`;
  return `${entre("carreras", u.carrera)}, ${entre("calles", u.calle)}`;
}
