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

/**
 * Por el oeste hay calles con letra, «calle 13A», metidas entre la 13 y la
 * 14. Se guardan como un decimal fijo por letra, distinto del ,5 que
 * significa «entre las dos», para poder escribirlas igual al enseñarlas.
 */
const LETRAS: Record<string, number> = { a: 0.3, b: 0.4, c: 0.6, d: 0.7 };

function numeroConLetra(numero: string, letra: string | undefined): number {
  return Number(numero) + (letra ? LETRAS[letra] : 0);
}

/** «13», «13A», o null si el número lleva decimales que no son de letra (los «entre»). */
export function nombreDeEje(n: number): string | null {
  if (Number.isInteger(n)) return String(n);
  const entero = Math.floor(n);
  const letra = Object.entries(LETRAS).find(([, valor]) => Math.abs(n - entero - valor) < 1e-6)?.[0];
  return letra ? `${entero}${letra.toUpperCase()}` : null;
}

export function leerDireccion(direccion: string): Lectura {
  const texto = normalizar(direccion);
  if (!texto) return { ubicada: false, motivo: "no tiene dirección" };
  if (FUERA_DE_LA_CUADRICULA.test(texto)) {
    return { ubicada: false, motivo: "parece una urbanización o un barrio, fuera de la cuadrícula del centro" };
  }

  // «calle 38», «carreras 30 y 31», «entre 30 y 31», «con 25», «esquina 25», «calle 13a», «carrera 5-b».
  const patron =
    /\b(calles?|cll|cl|carreras?|cra|kra|krr|carr|cr|avenida|ave|av|entre|con|c\/|esquina|esq)\s*(\d{1,3})(?:-?([a-d]))?(?:\s*(?:y|e|-)\s*(\d{1,3})(?:-?([a-d]))?)?\b/g;
  const valores: Record<Eje, number[]> = { calle: [], carrera: [] };
  let ultimo: Eje | null = null;

  for (const hallazgo of texto.matchAll(patron)) {
    const pares: [string | undefined, string | undefined][] = [
      [hallazgo[2], hallazgo[3]],
      [hallazgo[4], hallazgo[5]],
    ];
    const numeros = pares
      .filter((par): par is [string, string | undefined] => par[0] !== undefined)
      .map(([numero, letra]) => numeroConLetra(numero, letra))
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
  const nombre = (n: number) => nombreDeEje(n) ?? String(Math.floor(n));
  return `Calle ${nombre(ubicacion.calle)} con Carrera ${nombre(ubicacion.carrera)}, ${ciudad}`;
}

/**
 * La ubicación dicha en palabras, para comprobarla, con la carrera primero
 * como se dice en Barquisimeto: «carrera 19 con calle 25», «carrera 22,
 * entre calles 30 y 31», «calle 38, entre carreras 30 y 31».
 */
export function describirUbicacion(u: Ubicacion): string {
  const entre = (plural: string, n: number) => `entre ${plural} ${Math.floor(n)} y ${Math.ceil(n)}`;
  const calle = nombreDeEje(u.calle);
  const carrera = nombreDeEje(u.carrera);
  if (calle && carrera) return `carrera ${carrera} con calle ${calle}`;
  if (carrera) return `carrera ${carrera}, ${entre("calles", u.calle)}`;
  if (calle) return `calle ${calle}, ${entre("carreras", u.carrera)}`;
  return `${entre("carreras", u.carrera)}, ${entre("calles", u.calle)}`;
}
