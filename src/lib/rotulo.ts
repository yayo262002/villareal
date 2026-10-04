/**
 * Cómo se llama al cliente en las listas: la razón social si la hay, y si
 * no, el nombre. En SQL, para las consultas que juntan ventas y pagos con
 * su cliente (`c` es la tabla clientes). Sin base ni servidor: lo usan
 * también los guiones que leen la base desde fuera de la web.
 */
export const ROTULO_DEL_CLIENTE = "case when c.razon_social <> '' then c.razon_social else c.nombre end";

export function rotuloDe(c: { nombre: string; razon_social?: string | null }): string {
  return c.razon_social?.trim() || c.nombre;
}
