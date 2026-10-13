import { haySesion } from "@/lib/sesion";
import { clavesVapid, esSuscripcion, guardarTelefono, quitarTelefono } from "@/lib/push";

/**
 * Los teléfonos con los avisos activados. Lo usa el botón «Activar avisos
 * en este teléfono» de la campanita: GET da la clave pública con la que el
 * navegador se suscribe, POST guarda la suscripción, DELETE la quita. Solo
 * con sesión; el proxy ya corta el paso sin ella.
 */
async function sinSesion(): Promise<Response | null> {
  return (await haySesion()) ? null : new Response("No has iniciado sesión.", { status: 401 });
}

export async function GET(): Promise<Response> {
  const corte = await sinSesion();
  if (corte) return corte;
  const claves = await clavesVapid();
  return Response.json({ clavePublica: claves.publica }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const corte = await sinSesion();
  if (corte) return corte;
  const datos = (await request.json().catch(() => null)) as { suscripcion?: unknown; aparato?: unknown } | null;
  if (!datos || !esSuscripcion(datos.suscripcion)) return Response.json({ error: "La suscripción no está completa." }, { status: 400 });
  await guardarTelefono(datos.suscripcion, typeof datos.aparato === "string" ? datos.aparato : "");
  return Response.json({ ok: true });
}

export async function DELETE(request: Request): Promise<Response> {
  const corte = await sinSesion();
  if (corte) return corte;
  const datos = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (!datos || typeof datos.endpoint !== "string") return Response.json({ error: "Falta el endpoint." }, { status: 400 });
  return Response.json({ ok: await quitarTelefono(datos.endpoint) });
}
