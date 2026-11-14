import { leerDocumento } from "./documento.ts";
import { aplanar, distancia, simplificar, tolerancia } from "./parecido.ts";

/**
 * De quién es una nota de papel, por lo que dice en «Señor(es)» y en «RIF».
 * La nota se escribe deprisa y con el nombre con que se trata al cliente:
 * «Nelson» por la Pizzería NEL's, cuyo dueño se llama Nelson (el dueño, el
 * 14/11/2026: «quiero que lo relacione y me lo pregunte, y si el nombre no
 * coincide con el cliente también me lo avise»). Aquí se compara lo escrito
 * con el negocio (la razón social), el nombre de la persona y el RIF de cada
 * cliente, y con los nombres que ya se escribieron en sus notas otras veces
 * (lo aprendido al guardar cada venta con su foto). Nunca decide solo: dice
 * quién se parece y por qué, y la caja lo pregunta; al guardar, si el
 * cliente elegido no casa con la nota, se avisa. Puro, con pruebas.
 */

/** Lo que dice la nota de a quién va (`nota-leida.ts`). */
export type ClienteEscrito = { nombre: string | null; rif: string | null };

export type ClienteParaLaNota = {
  id: number;
  /** Lo que va en grande: la razón social si la hay, si no el nombre. */
  rotulo: string;
  /** Cómo se llama la persona («Nelson»). */
  nombre: string;
  razon_social?: string;
  cedula_rif: string;
};

/** Un nombre escrito en una nota que resultó ser de un cliente: se aprende al guardar la venta con esa nota. */
export type NombreAprendido = { nombre: string; cliente_id: number; veces: number };

export type PorQueSeParece = "rif" | "aprendido" | "nombre";

export type ClienteParecido = {
  id: number;
  /** Lo más fuerte por lo que se parece. */
  por: PorQueSeParece;
  /** Por qué, en palabras: «se llama Nelson», «el RIF de la nota es el suyo». */
  motivo: string;
  /** Para ordenar: el RIF pesa más que lo aprendido, y lo aprendido más que el nombre. */
  fuerza: number;
};

/** Palabras que no dicen quién es: tratamientos, artículos y la forma de la sociedad («C.A.», «S.R.L.»). */
const RELLENO = new Set(["sr", "sra", "srta", "sres", "senor", "senora", "senores", "senorita", "don", "dona", "de", "del", "la", "el", "los", "las", "lo", "y", "e", "en", "ca", "sa", "srl", "rl", "cia", "compania", "sociedad", "firma", "personal", "fp"]);

/**
 * Palabras del tipo de negocio: dicen qué es, no quién es. «Pizzería La Esquina» y «Pizzería Napoli» no son el mismo
 * cliente por ser pizzerías; cuentan solo para desempatar.
 */
const DEL_NEGOCIO = new Set([
  "pizzeria", "pizzas", "pizza", "panaderia", "pasteleria", "reposteria", "burger", "burgers", "burguer", "hamburguesas",
  "hamburgueseria", "restaurant", "restaurante", "rest", "bodega", "bodegon", "abasto", "abastos", "charcuteria",
  "comercial", "comercializadora", "inversiones", "inversora", "distribuidora", "distribuciones", "cafe", "cafeteria",
  "lunch", "comida", "comidas", "rapida", "rapidas", "food", "foods", "grill", "arepera", "licoreria", "supermercado",
  "mercado", "minimarket", "market", "tienda", "local", "fruteria", "carniceria", "queseria", "heladeria", "perros",
  "perro", "calientes", "caliente", "hot", "dog", "dogs", "shawarma", "sushi", "parrilla", "bar", "empanadas",
  "cachapas", "kiosko", "kiosco", "delivery", "express", "centro",
]);

type Palabra = { plano: string; sonido: string };

function palabrasDe(texto: string): Palabra[] {
  return aplanar(texto)
    .split(" ")
    .filter((p) => p.length >= 2 && !RELLENO.has(p))
    .map((plano) => ({ plano, sonido: simplificar(plano) }));
}

const distintivas = (palabras: Palabra[]) => palabras.filter((p) => !DEL_NEGOCIO.has(p.plano));

/** Lo escrito de corrido, sin el tipo de negocio ni el relleno pero con las letras sueltas: «NEL's» da «nels». */
function deCorrido(texto: string): string {
  return aplanar(texto)
    .split(" ")
    .filter((p) => p && !RELLENO.has(p) && !DEL_NEGOCIO.has(p))
    .join("");
}

/**
 * Cómo se guarda un nombre escrito en una nota, para reconocerlo la próxima vez: sin tildes, sin mayúsculas y sin el
 * relleno («Sr. Nelson» y «nelson» son el mismo). Vacío si no queda nada.
 */
export function claveDeNombre(texto: string): string {
  return palabrasDe(texto)
    .map((p) => p.plano)
    .join(" ")
    .slice(0, 80);
}

/** Cuánto se parecen dos palabras: 3 iguales (o suenan igual), 2 una empieza como la otra, 1 con una letra cambiada, 0 nada. */
function parecidoDePalabras(a: Palabra, b: Palabra): number {
  if (a.plano === b.plano || a.sonido === b.sonido) return 3;
  const [corta, larga] = a.plano.length <= b.plano.length ? [a, b] : [b, a];
  if (corta.plano.length >= 4 && (larga.plano.startsWith(corta.plano) || larga.sonido.startsWith(corta.sonido))) return 2;
  const tope = tolerancia(corta.sonido);
  if (tope > 0 && distancia(a.sonido, b.sonido, tope) <= tope) return 1;
  return 0;
}

/**
 * Cómo casa lo escrito en la nota con un nombre del cliente (su negocio o su persona): qué parte de lo escrito casa
 * (`parte`, de 0 a 1), qué parte del nombre del cliente queda dicha (`cubre`) y los puntos de cada palabra. Escrito de
 * corrido también vale («Nelson» empieza como «NEL's», «Tuttopan» como «Tutto Pan»).
 */
function casaConNombre(escrito: string, nombreDelCliente: string): { parte: number; cubre: number; puntos: number } {
  const nada = { parte: 0, cubre: 0, puntos: 0 };
  const leidas = distintivas(palabrasDe(escrito));
  const suyas = distintivas(palabrasDe(nombreDelCliente));
  if (leidas.length === 0) return nada;
  let casadas = 0;
  let puntos = 0;
  for (const l of leidas) {
    const mejor = Math.max(0, ...suyas.map((s) => parecidoDePalabras(l, s)));
    if (mejor > 0) casadas++;
    puntos += mejor;
  }
  let parte = casadas / leidas.length;
  let cubre = suyas.length ? suyas.filter((s) => leidas.some((l) => parecidoDePalabras(l, s) > 0)).length / suyas.length : 0;
  const a = deCorrido(escrito);
  const b = deCorrido(nombreDelCliente);
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) {
    parte = Math.max(parte, 1);
    cubre = Math.max(cubre, Math.min(1, a.length / b.length));
    puntos = Math.max(puntos, 2 * leidas.length);
  }
  return { parte, cubre, puntos };
}

/** Lo aprendido que casa con lo escrito: el mismo nombre, o con una letra cambiada (la letra de mano). */
function aprendidoQueCasa(clave: string, aprendido: NombreAprendido): "igual" | "parecido" | null {
  if (!clave || !aprendido.nombre) return null;
  if (aprendido.nombre === clave) return "igual";
  const a = simplificar(clave).replace(/ /g, "");
  const b = simplificar(aprendido.nombre).replace(/ /g, "");
  const tope = tolerancia(a.length <= b.length ? a : b);
  return a === b || (tope > 0 && distancia(a, b, tope) <= tope) ? "parecido" : null;
}

const vecesTexto = (veces: number) => (veces === 1 ? "en otra nota suya" : `en ${veces} notas suyas`);

/**
 * Los nombres de un cliente con que se compara la nota, cada uno con cómo decirlo: el negocio (la razón social, o el
 * rótulo si no es el nombre de la persona) y la persona. Un solo nombre que lleva el tipo de negocio («Pizzería La
 * Esquina») es el negocio; si no, la persona.
 */
function nombresDelCliente(c: ClienteParaLaNota): { texto: string; motivo: string }[] {
  const persona = c.nombre.trim();
  const rotulo = c.rotulo.trim();
  const negocio = (c.razon_social ?? "").trim() || (rotulo && aplanar(rotulo) !== aplanar(persona) ? rotulo : "");
  const pareceNegocio = (t: string) => aplanar(t).split(" ").some((p) => DEL_NEGOCIO.has(p));
  const nombres: { texto: string; motivo: string }[] = [];
  if (negocio) nombres.push({ texto: negocio, motivo: `su negocio es ${negocio}` });
  if (persona && aplanar(persona) !== aplanar(negocio)) nombres.push({ texto: persona, motivo: negocio || !pareceNegocio(persona) ? `se llama ${persona}` : `su negocio es ${persona}` });
  return nombres;
}

/**
 * Los clientes que se parecen a lo que dice la nota, del más probable al menos, con el porqué. Vacío si la nota no dice
 * nada útil (sin nombre ni RIF, o solo «Pizzería»). Se comparan el RIF, lo aprendido de otras notas, el negocio y el
 * nombre de la persona.
 */
export function clientesParecidos(escrito: ClienteEscrito | null | undefined, clientes: ClienteParaLaNota[], aprendidos: NombreAprendido[] = [], maximo = 4): ClienteParecido[] {
  if (!escrito) return [];
  const porCliente = new Map<number, { fuerza: number; por: PorQueSeParece; motivos: string[] }>();
  const sumar = (id: number, fuerza: number, por: PorQueSeParece, motivo: string) => {
    const actual = porCliente.get(id);
    if (!actual) return porCliente.set(id, { fuerza, por, motivos: [motivo] });
    // Dos razones a la vez (se llama así y además ya se escribió así) suben un poco.
    if (fuerza > actual.fuerza) porCliente.set(id, { fuerza: fuerza + 5, por, motivos: [motivo, ...actual.motivos] });
    else porCliente.set(id, { ...actual, fuerza: actual.fuerza + 5, motivos: [...actual.motivos, motivo] });
  };

  const documento = escrito.rif ? leerDocumento(escrito.rif) : null;
  if (documento) {
    for (const c of clientes) {
      const suyo = c.cedula_rif ? leerDocumento(c.cedula_rif) : null;
      if (suyo && suyo.clave === documento.clave) sumar(c.id, 1000, "rif", `el RIF de la nota es el suyo (${suyo.texto})`);
    }
  }

  const nombre = escrito.nombre?.trim() ?? "";
  const clave = claveDeNombre(nombre);
  if (clave) {
    const ids = new Set(clientes.map((c) => c.id));
    for (const a of aprendidos) {
      if (!ids.has(a.cliente_id)) continue;
      const casa = aprendidoQueCasa(clave, a);
      if (casa) sumar(a.cliente_id, (casa === "igual" ? 500 : 450) + Math.min(a.veces, 40), "aprendido", `ya escribiste «${nombre}» ${vecesTexto(a.veces)}`);
    }
  }

  if (nombre) {
    for (const c of clientes) {
      let mejor: { fuerza: number; motivo: string } | null = null;
      for (const f of nombresDelCliente(c)) {
        const r = casaConNombre(nombre, f.texto);
        if (r.parte < 0.5) continue;
        const fuerza = Math.round(100 + r.parte * 100 + r.cubre * 40 + r.puntos * 5);
        if (!mejor || fuerza > mejor.fuerza) mejor = { fuerza, motivo: f.motivo };
      }
      if (mejor) sumar(c.id, mejor.fuerza, "nombre", mejor.motivo);
    }
  }

  return [...porCliente.entries()]
    .map(([id, x]) => ({ id, por: x.por, motivo: x.motivos.join(" · "), fuerza: x.fuerza }))
    .sort((a, b) => b.fuerza - a.fuerza || a.id - b.id)
    .slice(0, maximo);
}

/** Si la nota dice algo con que reconocer al cliente: un RIF que se lee o un nombre que no sea solo el tipo de negocio. */
export function notaDiceElCliente(escrito: ClienteEscrito | null | undefined): boolean {
  if (!escrito) return false;
  if (escrito.rif && leerDocumento(escrito.rif)) return true;
  return Boolean(escrito.nombre && distintivas(palabrasDe(escrito.nombre)).length > 0);
}

/**
 * Si la nota es de ese cliente: casa si su RIF es el de la nota, si lo escrito se parece a su negocio o a su nombre, o
 * si ya se escribió así en otras notas suyas. Si no casa, el reparo con lo que dice la nota y de quién es la venta. Si la
 * nota no dice a quién va, no hay nada que decir.
 */
export function reparoDelCliente(escrito: ClienteEscrito | null | undefined, cliente: ClienteParaLaNota, aprendidos: NombreAprendido[] = []): string | null {
  if (!escrito || !notaDiceElCliente(escrito)) return null;
  const quien = cliente.nombre.trim() && aplanar(cliente.nombre) !== aplanar(cliente.rotulo) ? `${cliente.rotulo} (${cliente.nombre.trim()})` : cliente.rotulo || cliente.nombre || "otro cliente";
  const documento = escrito.rif ? leerDocumento(escrito.rif) : null;
  const suyo = cliente.cedula_rif ? leerDocumento(cliente.cedula_rif) : null;
  if (documento && suyo) {
    if (documento.clave === suyo.clave) return null;
    return `El RIF de la nota (${documento.texto}) no es el de ${quien} (${suyo.texto}): revisa que la venta sea de ese cliente.`;
  }
  if (clientesParecidos({ nombre: escrito.nombre, rif: null }, [cliente], aprendidos).length > 0) return null;
  if (!escrito.nombre || distintivas(palabrasDe(escrito.nombre)).length === 0) return null;
  return `La nota dice «${escrito.nombre.trim()}» y la venta es de ${quien}: revisa que sea de ese cliente.`;
}
