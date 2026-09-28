import { buscarCopiaNube } from "@/lib/copias-nube";
import { haySesion } from "@/lib/sesion";

/** GET /admin/copias/[id] descarga una copia automática guardada en la nube. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await haySesion())) return new Response("No has iniciado sesión.", { status: 401 });

  const { id } = await params;
  const copia = await buscarCopiaNube(Number(id));
  if (!copia) return new Response("No existe.", { status: 404 });

  const fecha = copia.creado_en.slice(0, 16).replace("T", " ").replace(/[: ]/g, "-");
  return new Response(copia.datos, {
    headers: {
      "content-type": "application/vnd.sqlite3",
      "content-disposition": `attachment; filename="villareal-nube-${fecha}.db"`,
      "content-length": String(copia.tamano),
      "cache-control": "private, no-store",
    },
  });
}
