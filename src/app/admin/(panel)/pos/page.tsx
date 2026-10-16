import { permanentRedirect } from "next/navigation";

/** La caja ya es «Registrar venta», en Ventas: el enlace viejo sigue llevando allí. */
export default function PaginaPos() {
  permanentRedirect("/admin/ventas");
}
