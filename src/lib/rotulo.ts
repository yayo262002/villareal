/**
 * Cómo se llama al cliente en las listas: la razón social si la hay, y si
 * no, el nombre. En SQL, para las consultas que juntan ventas y pagos con
 * su cliente (`c` es la tabla clientes). Sin base ni servidor: lo usan
 * también los guiones que leen la base desde fuera de la web.
 */
export const ROTULO_DEL_CLIENTE = "case when c.razon_social <> '' then c.razon_social when c.nombre <> '' then c.nombre else c.telefono end";

/** La razón social si la hay; si no, el nombre; y si tampoco, el teléfono (quien se registró solo con él). */
export function rotuloDe(c: { nombre: string; razon_social?: string | null; telefono?: string | null }): string {
  return c.razon_social?.trim() || c.nombre.trim() || c.telefono?.trim() || "";
}

/** Si al cliente le falta un nombre con letras (ni razón social ni nombre): se dice bajito y se pide ponerlo. */
export function sinNombre(c: { nombre: string; razon_social?: string | null }): boolean {
  return !/\p{L}/u.test(c.nombre) && !c.razon_social?.trim();
}
