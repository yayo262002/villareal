import { permanentRedirect } from "next/navigation";
import { exigirPanel } from "@/lib/panel";

/** El informe de antes es ahora Estadísticas: los enlaces viejos siguen llegando. */
export default async function PaginaInforme() {
  await exigirPanel();
  permanentRedirect("/admin/estadisticas");
}
