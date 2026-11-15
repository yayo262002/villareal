import "server-only";
import { redirect } from "next/navigation";
import { haySesion } from "./sesion";

/**
 * Cada pantalla del panel lo comprueba por su cuenta, al principio: sin sesión, a la entrada. El layout del panel lo
 * comprueba también, pero no basta: en Next un layout no vuelve a ejecutarse al navegar, y una petición hecha a mano
 * (el «RSC» de una sola página) puede pedir la página sin pasar por él (revisión de seguridad del 14/11/2026). La
 * prueba `panel.test.ts` falla si una pantalla nueva no lo llama. `haySesion` se recuerda durante la petición: llamarlo
 * aquí y en el layout no cuesta una consulta más.
 */
export async function exigirPanel(): Promise<void> {
  if (!(await haySesion())) redirect("/admin/entrar");
}
