import { permanentRedirect } from "next/navigation";
import { exigirPanel } from "@/lib/panel";

/** La caja ya es «Registrar venta», en Ventas: el enlace viejo sigue llevando allí. */
export default async function PaginaPos() {
  await exigirPanel();
  permanentRedirect("/admin/ventas");
}
