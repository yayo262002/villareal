import { permanentRedirect } from "next/navigation";

/** El informe de antes es ahora Estadísticas: los enlaces viejos siguen llegando. */
export default function PaginaInforme() {
  permanentRedirect("/admin/estadisticas");
}
