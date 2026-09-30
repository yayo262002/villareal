import { ALREDEDORES, estaEnLosAlrededores, type Punto } from "./plano.ts";
import { leerDireccion } from "./direcciones.ts";

/**
 * Buscar en el mapa una dirección que no dice calle y carrera: un centro
 * comercial, una avenida con nombre, un edificio conocido. Se pregunta al
 * buscador libre de OpenStreetMap (Nominatim), acotado a Barquisimeto y sus
 * alrededores. Lo que devuelve es aproximado, y se dice así en el panel.
 *
 * Sin `server-only` para poder probarlo desde un script. Con la variable
 * MAPA_APAGADO=1 no se llama a nadie (las pruebas locales).
 */

export type Sitio = Punto & {
  /** Cómo llama el mapa al lugar: «C.C. Terepaima II, Avenida Intercomunal…». */
  sitio: string;
};

const BUSCADOR = "https://nominatim.openstreetmap.org/search";
const IDENTIFICACION = "villareal-panel/1.0 (comercializadoravillareal@gmail.com)";
const ESPERA_MAXIMA_MS = 8000;

type Respuesta = { lat: string; lon: string; display_name: string };

/** El nombre del sitio, corto: las tres primeras partes de lo que dice el mapa. */
function nombreCorto(nombre: string): string {
  return nombre
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && !/^\d{4}$/.test(p) && p !== "Venezuela")
    .slice(0, 3)
    .join(", ");
}

async function preguntar(texto: string): Promise<Sitio | null> {
  const parametros = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    countrycodes: "ve",
    bounded: "1",
    viewbox: `${ALREDEDORES.lonMin},${ALREDEDORES.latMax},${ALREDEDORES.lonMax},${ALREDEDORES.latMin}`,
    q: texto,
  });
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_MAXIMA_MS);
  try {
    const r = await fetch(`${BUSCADOR}?${parametros}`, {
      headers: { "User-Agent": IDENTIFICACION, "Accept-Language": "es" },
      signal: control.signal,
    });
    if (!r.ok) return null;
    const lista = (await r.json()) as Respuesta[];
    const primero = lista[0];
    if (!primero) return null;
    const punto = { lat: Number(primero.lat), lon: Number(primero.lon) };
    if (!Number.isFinite(punto.lat) || !Number.isFinite(punto.lon) || !estaEnLosAlrededores(punto)) return null;
    return { ...punto, sitio: nombreCorto(primero.display_name) };
  } catch {
    return null;
  } finally {
    clearTimeout(reloj);
  }
}

/** «Av. Libertador con calle 30» → «Avenida Libertador». Null si no hay avenida con nombre. */
export function avenidaConNombre(direccion: string): string | null {
  const hallazgo = direccion.match(/\b(?:av(?:enida)?|avda)\.?\s+([^\d,;()]+?)(?=\s*(?:,|;|\(|\bcon\b|\bentre\b|\besq|\bcruce\b|\bfrente\b|\bal lado\b|\bcerca\b|\bdiag|$))/i);
  const nombre = hallazgo?.[1]?.trim().replace(/\s+/g, " ");
  if (!nombre || nombre.length < 3 || /^\d+$/.test(nombre)) return null;
  return `Avenida ${nombre}`;
}

/**
 * Busca la dirección entera; si no aparece y nombra una avenida, busca la
 * avenida sola (el punto es entonces un sitio cualquiera de la avenida).
 * Devuelve null si el mapa no la conoce o si está apagado.
 */
export async function buscarEnElMapa(direccion: string): Promise<Sitio | null> {
  const texto = direccion.trim();
  if (!texto || process.env.MAPA_APAGADO === "1") return null;
  const ciudad = "Barquisimeto, Lara";
  const entera = await preguntar(`${texto}, ${ciudad}`);
  if (entera) return entera;
  // «C.C. Sambil, local 12»: el local sobra para el mapa.
  const primeraParte = texto.split(/[,;(]/)[0].trim();
  if (primeraParte && primeraParte !== texto) {
    const sinDetalle = await preguntar(`${primeraParte}, ${ciudad}`);
    if (sinDetalle) return sinDetalle;
  }
  const avenida = avenidaConNombre(texto);
  if (!avenida) return null;
  const sola = await preguntar(`${avenida}, ${ciudad}`);
  return sola ? { ...sola, sitio: `${sola.sitio} (un punto de la avenida)` } : null;
}

/** Si a una dirección le hace falta el mapa: no se entiende por calle y carrera. */
export function necesitaElMapa(direccion: string): boolean {
  return direccion.trim() !== "" && !leerDireccion(direccion).ubicada;
}
