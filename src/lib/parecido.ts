/**
 * Buscar «parecido»: encontrar a un cliente o un producto aunque se escriba
 * con una letra de más, de menos o cambiada («Cleiderman» por
 * «Cleinderman», «burguer» por «burger», «pizeria» por «pizzería»). Se
 * compara sin tildes ni mayúsculas y con las letras que suenan igual
 * juntas (b y v, s, z y c suave, y, ll e i, la h muda; la ch aparte), y se tolera un error
 * por palabra (dos en las largas). Cálculo puro, con pruebas; lo usan la
 * caja y la cartera, en el navegador y en el servidor.
 *
 * Mientras se escribe, lo escrito es el principio de una palabra: «c» trae a
 * Cecilia, a Cheo y a Carlos, y «gu», a Guillermo, aunque al juntar los
 * sonidos «Cecilia» empiece por «s» y «Guillermo» por «g». Por eso también
 * vale empezar igual letra por letra. Con una sola letra, solo eso: «c» no
 * trae a Quintero.
 */

/** Sin tildes ni mayúsculas, la ñ como n y solo letras y números: lo escrito tal cual, sin juntar lo que suena igual. */
export function aplanar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Sin tildes ni mayúsculas, y con las letras que suenan igual escritas igual. */
export function simplificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/ch/g, "x")
    .replace(/qu(?=[ei])/g, "k")
    .replace(/c(?=[ei])/g, "s")
    .replace(/c/g, "k")
    .replace(/z/g, "s")
    .replace(/v/g, "b")
    .replace(/ll/g, "y")
    .replace(/y/g, "i")
    .replace(/h/g, "")
    .replace(/gu(?=[ei])/g, "g")
    .replace(/j/g, "g")
    .replace(/w/g, "u")
    // Una letra doble cuenta como una («pizzeria» y «pizeria»); solo el par, para que «zzzz» no se vuelva una sola letra.
    .replace(/(.)\1/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cuántas letras hay que cambiar, poner o quitar para pasar de `a` a `b`; si son más de `tope`, devuelve `tope + 1`. */
export function distancia(a: string, b: string, tope: number): number {
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    let minimo = i;
    for (let j = 1; j <= b.length; j++) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min(anterior[j] + 1, actual[j - 1] + 1, anterior[j - 1] + coste);
      if (actual[j] < minimo) minimo = actual[j];
    }
    if (minimo > tope) return tope + 1;
    anterior = actual;
  }
  return anterior[b.length];
}

/** Cuántos errores se le perdonan a una palabra escrita: ninguno a las muy cortas, uno a las normales, dos a las largas. */
export function tolerancia(palabra: string): number {
  if (palabra.length <= 3) return 0;
  if (palabra.length <= 6) return 1;
  return 2;
}

/** Cómo de bien casa una palabra escrita con una del texto: 3 empieza igual, 2 la contiene, 1 se parece, 0 nada. */
export function puntoDePalabra(escrita: string, candidata: string): number {
  if (!escrita) return 0;
  if (candidata.startsWith(escrita)) return 3;
  if (escrita.length >= 3 && candidata.includes(escrita)) return 2;
  const tope = tolerancia(escrita);
  if (tope === 0) return 0;
  // Lo escrito puede ser el principio de la palabra: se compara con un trozo de su largo (y uno más, por si falta o sobra una letra).
  const trozos = [candidata.slice(0, escrita.length), candidata.slice(0, escrita.length + 1), candidata];
  return trozos.some((t) => distancia(escrita, t, tope) <= tope) ? 1 : 0;
}

/** Una palabra como se escribió (sin tildes ni mayúsculas) y como suena. */
type Palabra = { plano: string; sonido: string };

function palabrasDe(texto: string): Palabra[] {
  return aplanar(texto)
    .split(" ")
    .filter(Boolean)
    .map((plano) => ({ plano, sonido: simplificar(plano) }));
}

/**
 * Cómo casa una palabra escrita con una del texto (3, 2, 1 o 0, como `puntoDePalabra`): empezar igual vale letra por letra o
 * por cómo suena; contenerla, desde tres letras; parecerse, por cómo suena. Una sola letra solo casa con las palabras que
 * empiezan por ella.
 */
function casaPalabra(escrita: Palabra, candidata: Palabra): number {
  if (candidata.plano.startsWith(escrita.plano)) return 3;
  if (escrita.plano.length < 2) return 0;
  if (escrita.plano.length >= 3 && candidata.plano.includes(escrita.plano)) return 2;
  return puntoDePalabra(escrita.sonido, candidata.sonido);
}

/**
 * Cómo de bien casa lo escrito con un texto (nombre, razón social,
 * teléfono…): cada palabra escrita tiene que casar con alguna del texto;
 * suma los puntos de la mejor de cada una. 0 si alguna no casa con nada.
 */
export function puntuarParecido(consulta: string, texto: string): number {
  const escritas = palabrasDe(consulta);
  if (escritas.length === 0) return 0;
  const palabras = palabrasDe(texto);
  // Un número escrito de corrido («04246343236») casa con el teléfono escrito con guion.
  const soloDigitos = aplanar(texto).replace(/\D/g, "");
  let total = 0;
  for (const escrita of escritas) {
    let mejor = 0;
    for (const palabra of palabras) mejor = Math.max(mejor, casaPalabra(escrita, palabra));
    if (mejor === 0 && /^\d{3,}$/.test(escrita.plano) && soloDigitos.includes(escrita.plano)) mejor = 2;
    if (mejor === 0) return 0;
    total += mejor;
  }
  return total;
}

/**
 * El sitio de un elemento en lo que se busca: 0 si no casa, y cuanto más, más arriba. Lo principal (el nombre, la razón
 * social, el teléfono) va antes que lo de más (la dirección, la nota), que solo cuenta desde tres letras escritas: con una
 * letra, «c» no trae a todos los que viven en una calle o una carrera. Y entre los que casan con lo principal, primero los
 * que empiezan por lo escrito: con «a», Ana Panadería antes que Pizzería Ana.
 */
export function ordenDeParecido(consulta: string, principal: string, mas = ""): number {
  const puntos = puntuarParecido(consulta, principal);
  if (puntos > 0) {
    const [primera] = palabrasDe(consulta);
    const [inicio] = palabrasDe(principal);
    const empieza = Boolean(primera && inicio && casaPalabra(primera, inicio) === 3);
    return 1000 + (empieza ? 100 : 0) + puntos;
  }
  if (!mas || aplanar(consulta).replace(/ /g, "").length < 3) return 0;
  return puntuarParecido(consulta, `${principal} ${mas}`);
}

export function coincideParecido(consulta: string, texto: string): boolean {
  return puntuarParecido(consulta, texto) > 0;
}

/**
 * Los elementos que casan con lo escrito, los que mejor casan primero (a igual casa, en el orden que venían). `masDe`, lo
 * que se busca además, después de lo principal (`ordenDeParecido`).
 */
export function buscarParecidos<T>(consulta: string, elementos: T[], textoDe: (e: T) => string, maximo = Infinity, masDe?: (e: T) => string): T[] {
  if (!aplanar(consulta)) return elementos.slice(0, maximo);
  return elementos
    .map((e, i) => ({ e, i, puntos: ordenDeParecido(consulta, textoDe(e), masDe?.(e)) }))
    .filter((x) => x.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos || a.i - b.i)
    .slice(0, maximo)
    .map((x) => x.e);
}
