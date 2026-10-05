import "server-only";
import { createClient, type Client, type InValue, type Transaction } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";
import { ESQUEMA, PRODUCTOS_INICIALES, RECONSTRUIR_PRODUCTOS, RENOMBRES } from "./esquema";
import { BORRADORES, FAMILIAS_INICIALES, familiasPorNombre, mismoNombre } from "./catalogo-inicial";
import { limpiarTexto, separarMarcaYContenido } from "./marcas-texto";

/**
 * Conexión a la base de datos con el cliente de libsql, que habla el mismo
 * SQLite en dos sitios:
 *
 * - Sin configurar nada: un archivo en `datos/villareal.db`. Para el local
 *   o un servidor propio.
 * - Con `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`: una base en Turso, que
 *   es lo que hace falta en Vercel porque allí no hay disco que persista.
 *
 * Todas las funciones son asíncronas por eso: contra Turso cada consulta
 * viaja por la red.
 */

export type { InValue, Transaction };

function esRemota(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL);
}

export function urlBaseDeDatos(): string {
  if (esRemota()) return process.env.TURSO_DATABASE_URL!;
  const ruta = process.env.RUTA_BASE_DATOS ?? path.join(process.cwd(), "datos", "villareal.db");
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  return "file:" + ruta.replace(/\\/g, "/");
}

/**
 * Las consultas a Turso viajan por `fetch`, y Next guarda en su caché las
 * respuestas de `fetch` de las páginas estáticas, también de una
 * compilación a la siguiente: una consulta podía devolver la base de otro
 * día (el 05/10/2026 la puesta al día leyó la base de antes de las familias
 * y creó una). Por eso van por el `fetch` de siempre, el que Next guarda
 * aparte y no pasa por su caché: la base se lee siempre al día, y las
 * páginas estáticas se siguen guardando enteras y rehaciéndose con
 * `revalidatePath`. Si algún día Next no lo guardara, se pide sin caché.
 */
function fetchSinCache(entrada: RequestInfo | URL, opciones?: RequestInit): Promise<Response> {
  const deNext = globalThis.fetch as typeof fetch & { _nextOriginalFetch?: typeof fetch };
  return deNext._nextOriginalFetch ? deNext._nextOriginalFetch(entrada, opciones) : deNext(entrada, { ...opciones, cache: "no-store" });
}

async function abrir(): Promise<Client> {
  const cliente = createClient({
    url: urlBaseDeDatos(),
    authToken: esRemota() ? process.env.TURSO_AUTH_TOKEN : undefined,
    fetch: fetchSinCache,
  });
  if (!esRemota()) {
    await cliente.execute("pragma journal_mode = wal");
    await cliente.execute("pragma foreign_keys = on");
  }
  await cliente.executeMultiple(ESQUEMA);
  await migrar(cliente);
  await sembrar(cliente);
  return cliente;
}

async function definicionDe(cliente: Client, tabla: string): Promise<string> {
  const def = await cliente.execute({ sql: "select sql from sqlite_master where type = 'table' and name = ?", args: [tabla] });
  return String(def.rows[0]?.sql ?? "");
}

/** Añade una columna a una tabla que ya existe. Si otro proceso se adelantó, no es un error. */
async function añadirColumna(cliente: Client, tabla: string, columna: string): Promise<void> {
  try {
    await cliente.execute(`alter table ${tabla} add column ${columna}`);
  } catch (error) {
    if (!/duplicate column/i.test(String(error))) throw error;
  }
}

/**
 * Pone al día las bases creadas con un esquema anterior. Next compila con
 * varios procesos a la vez, así que dos pueden intentar lo mismo: añadir
 * una columna que ya está no es un error.
 */
async function migrar(cliente: Client): Promise<void> {
  let sql = await definicionDe(cliente, "productos");
  if (!(sql.includes("costo_usd") && sql.includes("'carton'"))) {
    await cliente.executeMultiple(RECONSTRUIR_PRODUCTOS);
    sql = await definicionDe(cliente, "productos");
  }
  if (!sql.includes("precio_mayor_usd")) {
    await añadirColumna(cliente, "productos", "margen_mayor_pct real");
    await añadirColumna(cliente, "productos", "precio_mayor_usd real");
  }
  const ventas = await definicionDe(cliente, "ventas");
  if (!/\btasa\b/.test(ventas)) {
    await añadirColumna(cliente, "ventas", "tasa real");
  }
  // Las ventas anteriores quedan como entregadas: ninguna aparece de golpe en el despacho.
  if (!ventas.includes("por_entregar")) {
    await añadirColumna(cliente, "ventas", "por_entregar integer not null default 0");
    await añadirColumna(cliente, "ventas", "entregada_en text");
  }
  // Las reseñas que ya hubiera quedan sin permiso anotado: no se publican solas.
  if (!(await definicionDe(cliente, "resenas")).includes("con_permiso")) {
    await añadirColumna(cliente, "resenas", "con_permiso integer not null default 0");
  }
  if (!(await definicionDe(cliente, "ventas")).includes("entrega_prevista")) {
    await añadirColumna(cliente, "ventas", "entrega_prevista text");
  }
  const clientes = await definicionDe(cliente, "clientes");
  if (!clientes.includes("razon_social")) await añadirColumna(cliente, "clientes", "razon_social text not null default ''");
  if (!clientes.includes("sitio")) {
    await añadirColumna(cliente, "clientes", "lat real");
    await añadirColumna(cliente, "clientes", "lon real");
    await añadirColumna(cliente, "clientes", "sitio text not null default ''");
  }
  if (!clientes.includes("enlace")) await añadirColumna(cliente, "clientes", "enlace text");
  if (!(await definicionDe(cliente, "adjuntos")).includes("pago_id")) await añadirColumna(cliente, "adjuntos", "pago_id integer references pagos(id)");
  if (!(await definicionDe(cliente, "resenas")).includes("variante_id")) await añadirColumna(cliente, "resenas", "variante_id integer references variantes(id)");
  // El historial de tasas empieza con las que ya quedaron guardadas en los abonos y las notas de antes.
  const tasas = await cliente.execute("select count(*) as n from tasas");
  if (Number(tasas.rows[0]?.n ?? 0) === 0) {
    await cliente.execute(
      `insert or ignore into tasas (fecha, valor, origen)
       select fecha, tasa, 'abono' from pagos where tasa is not null and id in (select max(id) from pagos where tasa is not null group by fecha)`,
    );
    await cliente.execute(
      `insert or ignore into tasas (fecha, valor, origen)
       select fecha, tasa, 'nota' from ventas where tasa is not null and id in (select max(id) from ventas where tasa is not null group by fecha)`,
    );
  }
  if (!(await definicionDe(cliente, "proveedores")).includes("enlace")) await añadirColumna(cliente, "proveedores", "enlace text");
  await cliente.execute("create unique index if not exists clientes_enlace on clientes(enlace)");
  await cliente.execute("create unique index if not exists proveedores_enlace on proveedores(enlace)");
  const lineas = await definicionDe(cliente, "venta_lineas");
  if (!lineas.includes("piezas")) await añadirColumna(cliente, "venta_lineas", "piezas integer");
  if (!lineas.includes("variante_id")) await añadirColumna(cliente, "venta_lineas", "variante_id integer references variantes(id)");
  // Los clientes de antes reciben los siete días de crédito de siempre.
  if (!(await definicionDe(cliente, "clientes")).includes("dias_credito")) {
    await añadirColumna(cliente, "clientes", "dias_credito integer not null default 7");
  }
  // El catálogo por familias: la familia principal de cada producto, si es un borrador, su marca y su presentación,
  // el precio al detal si lo hay, y si se destaca o sale en ofertas. Todo opcional: lo que había sigue igual.
  const deProductos = await definicionDe(cliente, "productos");
  for (const [columna, definicion] of [
    ["familia_id", "familia_id integer references familias(id)"],
    ["borrador", "borrador integer not null default 0"],
    ["marca", "marca text not null default ''"],
    ["presentacion", "presentacion text not null default ''"],
    ["contenido", "contenido text not null default ''"],
    ["precio_detal_usd", "precio_detal_usd real"],
    ["destacado", "destacado integer not null default 0"],
    ["en_oferta", "en_oferta integer not null default 0"],
    ["marca_id", "marca_id integer references marcas(id)"],
    ["seccion", "seccion text not null default ''"],
  ] as const) {
    if (!new RegExp(`\\b${columna}\\b`).test(deProductos)) await añadirColumna(cliente, "productos", definicion);
  }
  await cliente.execute("create index if not exists productos_familia on productos(familia_id)");
  if (!/\bseccion\b/.test(await definicionDe(cliente, "producto_categorias"))) {
    await añadirColumna(cliente, "producto_categorias", "seccion text not null default ''");
  }
  // Las marcas como algo propio: cada artículo con su marca, su presentación y su contenido.
  if (!/\bmarca_id\b/.test(await definicionDe(cliente, "variantes"))) {
    await añadirColumna(cliente, "variantes", "marca_id integer references marcas(id)");
    await añadirColumna(cliente, "variantes", "presentacion text not null default ''");
    await añadirColumna(cliente, "variantes", "contenido text not null default ''");
  }
  // Una sola vez, y queda anotado en los ajustes (una copia hecha con el código nuevo ya trae las columnas, vacías):
  // los artículos de antes, que tenían marca y tamaño en un solo nombre («Sortilegio 500 g»), con los dos separados
  // (el nombre que dicen las notas no cambia), y las secciones del catálogo inicial en lo que ya estaba preparado.
  if (!(await cliente.execute("select 1 from ajustes where clave = 'catalogo_por_marcas'")).rows.length) {
    await separarMarcasDeLosArticulos(cliente);
    await ponerSeccionesDelCatalogo(cliente);
    await cliente.execute("insert or ignore into ajustes (clave, valor) values ('catalogo_por_marcas', '1')");
  }
  await enlazarMarcasDeLosProductos(cliente);
  // Las familias iniciales, la primera vez. Lo decide la base en una sola sentencia (una lectura aparte podría
  // llegar vieja), y el slug único evita duplicarlas si dos procesos lo intentan a la vez. Las que se añadan al
  // código después no se crean solas en una base que ya tiene familias: las crea el dueño.
  await cliente.execute({
    sql: `insert or ignore into familias (nombre, slug, descripcion, icono, orden)
          select column1, column2, column3, column4, column5 from (values ${FAMILIAS_INICIALES.map(() => "(?, ?, ?, ?, ?)").join(", ")})
          where not exists (select 1 from familias)`,
    args: FAMILIAS_INICIALES.flatMap((f) => [f.nombre, f.slug, f.descripcion, f.icono, f.orden]),
  });
}

/**
 * Las secciones del catálogo inicial (la tocineta, en Burger, en
 * «Proteínas»; la carne de hamburguesa, en «Proteínas») a los productos que
 * ya estaban preparados, por su nombre. Una sola vez, y solo donde no hay
 * ninguna: después las pone el dueño.
 */
async function ponerSeccionesDelCatalogo(cliente: Client): Promise<void> {
  const [productos, familias] = await Promise.all([
    cliente.execute("select id, nombre, familia_id from productos"),
    cliente.execute("select id, slug from familias"),
  ]);
  const idDe = new Map(familias.rows.map((f) => [String(f.slug), Number(f.id)]));
  for (const b of BORRADORES) {
    const p = productos.rows.find((x) => mismoNombre(String(x.nombre), b.nombre));
    if (!p) continue;
    if (b.seccion && Number(p.familia_id) === idDe.get(b.familia)) {
      await cliente.execute({ sql: "update productos set seccion = ? where id = ? and seccion = ''", args: [b.seccion, p.id] });
    }
    for (const [slug, seccion] of Object.entries(b.secciones ?? {})) {
      const familia = idDe.get(slug);
      if (!familia) continue;
      await cliente.execute({
        sql: "update producto_categorias set seccion = ? where producto_id = ? and familia_id = ? and seccion = ''",
        args: [seccion, p.id, familia],
      });
    }
  }
}

/** El id de una marca por su nombre, creándola si no está. El nombre único (sin mirar mayúsculas) evita duplicarla. */
async function idDeMarca(cliente: Client, nombre: string): Promise<number | null> {
  const limpio = limpiarTexto(nombre);
  if (!limpio) return null;
  await cliente.execute({ sql: "insert or ignore into marcas (nombre) values (?)", args: [limpio] });
  const r = await cliente.execute({ sql: "select id from marcas where nombre = ?", args: [limpio] });
  return r.rows[0] ? Number(r.rows[0].id) : null;
}

/** Una vez: cada artículo de antes con su marca y su contenido separados. Uno que ya tiene marca no se toca. */
async function separarMarcasDeLosArticulos(cliente: Client): Promise<void> {
  const viejos = await cliente.execute("select id, nombre from variantes where marca_id is null and presentacion = '' and contenido = ''");
  for (const v of viejos.rows) {
    const { marca, contenido } = separarMarcaYContenido(String(v.nombre ?? ""));
    const id = await idDeMarca(cliente, marca);
    if (id) await cliente.execute({ sql: "update variantes set marca_id = ?, contenido = ? where id = ? and marca_id is null", args: [id, contenido, v.id] });
  }
}

/** Un producto que se vende de una sola marca, escrita a mano, queda enlazado a esa marca. No hace nada si ya lo están todos. */
async function enlazarMarcasDeLosProductos(cliente: Client): Promise<void> {
  const sueltos = await cliente.execute("select id, marca from productos where marca_id is null and trim(marca) != ''");
  for (const p of sueltos.rows) {
    const id = await idDeMarca(cliente, String(p.marca ?? ""));
    if (id) await cliente.execute({ sql: "update productos set marca_id = ? where id = ? and marca_id is null", args: [id, p.id] });
  }
}

/** Las descripciones se comparan sin importar si los saltos de línea son de Windows. */
function mismoTexto(a: unknown, b: string): boolean {
  return String(a ?? "").replace(/\r\n/g, "\n").trim() === b.trim();
}

/** Productos que cambiaron de nombre en el código: se renombran, no se duplican. */
async function renombrar(cliente: Client): Promise<void> {
  for (const r of RENOMBRES) {
    const viejo = await cliente.execute({ sql: "select id, descripcion from productos where nombre = ?", args: [r.de] });
    if (viejo.rows.length === 0) continue;
    const nuevo = await cliente.execute({ sql: "select id from productos where nombre = ?", args: [r.a] });
    if (nuevo.rows.length > 0) continue;
    const descripcion = mismoTexto(viejo.rows[0].descripcion, r.descripcionVieja)
      ? r.descripcionNueva
      : String(viejo.rows[0].descripcion ?? "");
    await cliente.execute({
      sql: "update productos set nombre = ?, descripcion = ? where id = ?",
      args: [r.a, descripcion, viejo.rows[0].id],
    });
  }
}

/**
 * Crea los productos iniciales en una base nueva y pone la descripción del
 * dueño si está vacía. En una base con productos no se crea ninguno: si el
 * dueño borró o renombró uno de los iniciales, no vuelve a aparecer.
 */
async function sembrar(cliente: Client): Promise<void> {
  await renombrar(cliente);
  const nueva = Number((await cliente.execute("select count(*) as n from productos")).rows[0]?.n ?? 0) === 0;
  for (const p of PRODUCTOS_INICIALES) {
    const hay = await cliente.execute({ sql: "select id, descripcion from productos where nombre = ?", args: [p.nombre] });
    if (hay.rows.length === 0) {
      if (!nueva) continue;
      await cliente.execute({
        sql: "insert into productos (nombre, unidad, descripcion) values (?, ?, ?)",
        args: [p.nombre, p.unidad, p.descripcion],
      });
    } else if (p.descripcion && !String(hay.rows[0].descripcion ?? "")) {
      await cliente.execute({ sql: "update productos set descripcion = ? where id = ?", args: [p.descripcion, hay.rows[0].id] });
    } else if (p.descripcionAnterior && mismoTexto(hay.rows[0].descripcion, p.descripcionAnterior)) {
      // El texto de siembra cambió y el dueño no había tocado el viejo: se pone el nuevo.
      await cliente.execute({ sql: "update productos set descripcion = ? where id = ?", args: [p.descripcion, hay.rows[0].id] });
    }
  }
  await asignarFamilias(cliente);
}

/**
 * Los productos sin familia (los de antes de las familias, o los iniciales
 * de una base nueva) van a la suya según su nombre, con las otras en que
 * salen. Uno que ya tiene familia no se toca: la elige el dueño.
 */
async function asignarFamilias(cliente: Client): Promise<void> {
  const sinFamilia = await cliente.execute("select id, nombre from productos where familia_id is null");
  if (sinFamilia.rows.length === 0) return;
  const ids = new Map((await cliente.execute("select id, slug from familias")).rows.map((r) => [String(r.slug), Number(r.id)]));
  for (const p of sinFamilia.rows) {
    const { principal, relacionadas } = familiasPorNombre(String(p.nombre));
    const familia = ids.get(principal);
    if (!familia) continue;
    // Las otras familias, antes que la suya y solo si sigue sin familia en la base: a uno que ya la tiene no se le toca nada.
    for (const slug of relacionadas) {
      const otra = ids.get(slug);
      if (!otra) continue;
      await cliente.execute({
        sql: "insert or ignore into producto_categorias (producto_id, familia_id) select ?, ? where exists (select 1 from productos where id = ? and familia_id is null)",
        args: [p.id, otra, p.id],
      });
    }
    await cliente.execute({ sql: "update productos set familia_id = ? where id = ? and familia_id is null", args: [familia, p.id] });
  }
}

// En desarrollo Next recarga los módulos a cada cambio; guardar la conexión
// en globalThis evita abrir decenas de conexiones a la misma base.
const global = globalThis as unknown as { __dbVillareal?: Promise<Client> };

export function db(): Promise<Client> {
  if (!global.__dbVillareal) {
    global.__dbVillareal = abrir().catch((error) => {
      global.__dbVillareal = undefined;
      throw error;
    });
  }
  return global.__dbVillareal;
}

/** Todas las filas de una consulta, como objetos con el nombre de cada columna. */
export async function filas<T>(sql: string, args: InValue[] = []): Promise<T[]> {
  const resultado = await (await db()).execute({ sql, args });
  return resultado.rows as unknown as T[];
}

/** La primera fila, o null si no hay ninguna. */
export async function fila<T>(sql: string, args: InValue[] = []): Promise<T | null> {
  const [primera] = await filas<T>(sql, args);
  return primera ?? null;
}

/** Un insert, update o delete. Devuelve cuántas filas tocó y el último id insertado. */
export async function ejecutar(sql: string, args: InValue[] = []): Promise<{ cambios: number; ultimoId: number }> {
  const resultado = await (await db()).execute({ sql, args });
  return { cambios: resultado.rowsAffected, ultimoId: Number(resultado.lastInsertRowid ?? 0) };
}

/** Varias escrituras que entran todas o ninguna. */
export async function transaccion<T>(cuerpo: (tx: Transaction) => Promise<T>): Promise<T> {
  const tx = await (await db()).transaction("write");
  try {
    const valor = await cuerpo(tx);
    await tx.commit();
    return valor;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}
