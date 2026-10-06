import "server-only";
import { ejecutar, fila, filas, transaccion } from "./db";
import { aSlug } from "./enlaces";
import { normalizarPortada } from "./foto-producto";
import { PORTADAS_INCLUIDAS } from "./portadas";

/**
 * Las familias del catálogo: Burger, Pizzería, Quesos, Huevos… Cada
 * producto tiene una principal y puede salir también en otras sin
 * repetirse en la base (`producto_categorias`). La web enseña cada familia
 * en `/categoria/[slug]` con sus productos publicados; el panel las crea,
 * las edita, las ordena, las esconde y las borra (antes, sus productos
 * pasan a otra).
 */

export type Familia = {
  id: number;
  nombre: string;
  /** El de su dirección: /categoria/burger. No cambia aunque cambie el nombre. */
  slug: string;
  descripcion: string;
  /** Uno de los iconos de `iconos.ts`. */
  icono: string;
  orden: number;
  activa: number;
  /** 1: una colección por tipo de negocio (Burger, Pizzería), que junta productos de varias familias. 0: una familia de productos. */
  coleccion: number;
  creado_en: string;
  /** Cuándo se subió su portada, o null si no tiene. */
  foto_version: string | null;
};

export type FamiliaConCuentas = Familia & {
  /** Los productos que la tienen como principal. */
  principales: number;
  /** Los que salen en ella además de en la suya. */
  relacionados: number;
  /** Los que se ven en su página: publicados, de una forma o de otra. */
  publicados: number;
};

export type DatosFamilia = { nombre: string; descripcion: string; icono: string; orden: number; activa: boolean; coleccion: boolean };

/** Las familias de productos (Quesos, Embutidos…), sin las colecciones. */
export function familiasDeProductos<F extends { coleccion: number }>(familias: F[]): F[] {
  return familias.filter((f) => f.coleccion !== 1);
}

/** Las colecciones por tipo de negocio (Burger, Pizzería). */
export function colecciones<F extends { coleccion: number }>(familias: F[]): F[] {
  return familias.filter((f) => f.coleccion === 1);
}

const CONSULTA = `
  select f.*, ff.actualizado_en as foto_version
  from familias f
  left join fotos_familias ff on ff.familia_id = f.id
`;

function completar(f: Familia): Familia {
  return { ...f, orden: Number(f.orden), activa: Number(f.activa), coleccion: Number(f.coleccion ?? 0), foto_version: f.foto_version ?? null };
}

/** En el orden que eligió el dueño. */
export async function listarFamilias(soloActivas = false): Promise<Familia[]> {
  return (await filas<Familia>(`${CONSULTA} ${soloActivas ? "where f.activa = 1" : ""} order by f.orden, f.nombre collate nocase`)).map(completar);
}

export async function listarFamiliasConCuentas(): Promise<FamiliaConCuentas[]> {
  const lista = await filas<FamiliaConCuentas>(
    `select f.*, ff.actualizado_en as foto_version,
       (select count(*) from productos p where p.familia_id = f.id) as principales,
       (select count(*) from producto_categorias c where c.familia_id = f.id) as relacionados,
       (select count(*) from productos p where p.activo = 1 and (p.familia_id = f.id or exists (
          select 1 from producto_categorias c where c.producto_id = p.id and c.familia_id = f.id))) as publicados
     from familias f
     left join fotos_familias ff on ff.familia_id = f.id
     order by f.orden, f.nombre collate nocase`,
  );
  return lista.map((f) => ({
    ...completar(f),
    principales: Number(f.principales),
    relacionados: Number(f.relacionados),
    publicados: Number(f.publicados),
  }));
}

export async function buscarFamilia(id: number): Promise<Familia | null> {
  const f = await fila<Familia>(`${CONSULTA} where f.id = ?`, [id]);
  return f ? completar(f) : null;
}

export async function buscarFamiliaPorSlug(slug: string): Promise<Familia | null> {
  const f = await fila<Familia>(`${CONSULTA} where f.slug = ?`, [slug]);
  return f ? completar(f) : null;
}

/** La familia con ese nombre, sin mirar tildes ni mayúsculas, o null. */
export async function buscarFamiliaPorNombre(nombre: string): Promise<Familia | null> {
  const slug = aSlug(nombre);
  return (await listarFamilias()).find((f) => aSlug(f.nombre) === slug) ?? null;
}

/** Un slug que no tenga otra: «salsas», y si ya está, «salsas-2». */
async function slugLibre(nombre: string): Promise<string> {
  const base = aSlug(nombre) || "familia";
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await fila("select id from familias where slug = ?", [slug]))) return slug;
  }
}

export async function crearFamilia(datos: DatosFamilia): Promise<number> {
  const r = await ejecutar("insert into familias (nombre, slug, descripcion, icono, orden, activa, coleccion) values (?, ?, ?, ?, ?, ?, ?)", [
    datos.nombre,
    await slugLibre(datos.nombre),
    datos.descripcion,
    datos.icono,
    datos.orden,
    datos.activa ? 1 : 0,
    datos.coleccion ? 1 : 0,
  ]);
  return r.ultimoId;
}

/** El slug no cambia: los enlaces que ya se compartieron siguen llegando. */
export async function actualizarFamilia(id: number, datos: DatosFamilia): Promise<void> {
  await ejecutar("update familias set nombre = ?, descripcion = ?, icono = ?, orden = ?, activa = ?, coleccion = ? where id = ?", [
    datos.nombre,
    datos.descripcion,
    datos.icono,
    datos.orden,
    datos.activa ? 1 : 0,
    datos.coleccion ? 1 : 0,
    id,
  ]);
}

export async function cambiarActivaFamilia(id: number, activa: boolean): Promise<void> {
  await ejecutar("update familias set activa = ? where id = ?", [activa ? 1 : 0, id]);
}

/** El orden que le toca a una familia nueva: detrás de las que hay. */
export async function siguienteOrden(): Promise<number> {
  const f = await fila<{ n: number | null }>("select max(orden) as n from familias");
  return Number(f?.n ?? 0) + 1;
}

/**
 * Borra una familia. Si es la principal de algún producto, esos productos
 * pasan antes a `pasarA` (sin ella no se borra); los que solo salían en
 * ella dejan de salir, o salen en `pasarA` si se eligió.
 */
export async function eliminarFamilia(id: number, pasarA: number | null): Promise<"borrada" | "falta_destino" | "no_existe"> {
  const familia = await buscarFamilia(id);
  if (!familia) return "no_existe";
  const principales = Number((await fila<{ n: number }>("select count(*) as n from productos where familia_id = ?", [id]))?.n ?? 0);
  const destino = pasarA && pasarA !== id ? await buscarFamilia(pasarA) : null;
  if (principales > 0 && !destino) return "falta_destino";
  await transaccion(async (tx) => {
    if (destino) {
      await tx.execute({ sql: "update productos set familia_id = ? where familia_id = ?", args: [destino.id, id] });
      await tx.execute({
        sql: "insert or ignore into producto_categorias (producto_id, familia_id) select producto_id, ? from producto_categorias where familia_id = ?",
        args: [destino.id, id],
      });
      // Un producto no sale como «otra familia» en la que ya es la suya.
      await tx.execute({
        sql: "delete from producto_categorias where familia_id = ? and producto_id in (select id from productos where familia_id = ?)",
        args: [destino.id, destino.id],
      });
    }
    await tx.execute({ sql: "delete from producto_categorias where familia_id = ?", args: [id] });
    await tx.execute({ sql: "delete from fotos_familias where familia_id = ?", args: [id] });
    await tx.execute({ sql: "delete from familias where id = ?", args: [id] });
  });
  return "borrada";
}

/** Los productos publicados de una familia: los suyos y los que también salen en ella. Los destacados primero. */
export async function idsDeProductosDeFamilia(familiaId: number): Promise<number[]> {
  const lista = await filas<{ id: number }>(
    `select p.id from productos p
     where p.activo = 1 and (p.familia_id = ? or exists (select 1 from producto_categorias c where c.producto_id = p.id and c.familia_id = ?))
     order by p.destacado desc, p.id`,
    [familiaId, familiaId],
  );
  return lista.map((f) => Number(f.id));
}

// ---------- La portada ----------

export type FotoDeFamilia = { familia_id: number; tipo: string; tamano: number; datos: ArrayBuffer; actualizado_en: string };

const TIPOS_DE_FOTO = ["image/jpeg", "image/png", "image/webp"];
const TAMANO_MAXIMO_DE_FOTO = 3 * 1024 * 1024;

export async function buscarFotoDeFamilia(familiaId: number): Promise<FotoDeFamilia | null> {
  return fila<FotoDeFamilia>("select * from fotos_familias where familia_id = ?", [familiaId]);
}

export async function guardarFotoDeFamilia(familiaId: number, tipoOriginal: string, original: Uint8Array): Promise<void> {
  if (!TIPOS_DE_FOTO.includes(tipoOriginal)) throw new Error("La portada tiene que ser JPG, PNG o WebP.");
  if (original.byteLength === 0) throw new Error("La foto está vacía.");
  if (original.byteLength > TAMANO_MAXIMO_DE_FOTO) throw new Error("La portada pesa más de 3 MB. Elige una más pequeña.");
  const { datos, tipo } = await normalizarPortada(original, tipoOriginal);
  await ejecutar(
    `insert into fotos_familias (familia_id, tipo, tamano, datos, actualizado_en) values (?, ?, ?, ?, datetime('now'))
     on conflict (familia_id) do update set tipo = excluded.tipo, tamano = excluded.tamano, datos = excluded.datos, actualizado_en = datetime('now')`,
    [familiaId, tipo, datos.byteLength, datos],
  );
}

export async function quitarFotoDeFamilia(familiaId: number): Promise<boolean> {
  const r = await ejecutar("delete from fotos_familias where familia_id = ?", [familiaId]);
  return r.cambios > 0;
}

/**
 * La portada de una familia: la que subió el dueño, o si no la que trae la
 * web para las familias iniciales (`public/familias/`), o ninguna.
 */
export function direccionDePortada(familia: Pick<Familia, "id" | "slug" | "foto_version">): string | null {
  if (familia.foto_version) return `/foto-familia/${familia.id}?v=${encodeURIComponent(familia.foto_version.replace(/\D/g, ""))}`;
  return PORTADAS_INCLUIDAS.has(familia.slug) ? `/familias/${familia.slug}.webp` : null;
}
