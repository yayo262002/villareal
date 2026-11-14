import { buscarClientePorEnlace } from "@/lib/clientes";
import { avisoDePagoDelCliente, avisosRecientesDelCliente } from "@/lib/banco";
import { leerMontoBs, referenciaUtil } from "@/lib/banco-calculo";
import { esEnlaceValido } from "@/lib/enlace-cuenta";

/**
 * «Ya pagué», desde el enlace de cuenta del cliente: la referencia y el monto
 * de su pago móvil o su transferencia. Si el pago ya entró al banco y espera
 * en la bandeja, se le abona en el momento; si no ha llegado, se le abona
 * solo cuando llegue (`src/lib/banco.ts`). No pide clave: vale el enlace, que
 * es personal. Como mucho diez avisos al día por cliente. Vuelve a su cuenta
 * con lo que pasó en `?pago=`.
 */
export async function POST(peticion: Request, { params }: { params: Promise<{ enlace: string }> }): Promise<Response> {
  const { enlace } = await params;
  const cliente = esEnlaceValido(enlace) ? await buscarClientePorEnlace(enlace) : null;
  if (!cliente) return new Response("No encontrado", { status: 404 });
  const volver = (resultado: string) => Response.redirect(new URL(`/cuenta/${enlace}?pago=${resultado}#ya-pague`, peticion.url), 303);

  let datos: FormData;
  try {
    datos = await peticion.formData();
  } catch {
    return volver("error");
  }
  const referencia = String(datos.get("referencia") ?? "").trim().slice(0, 40);
  const monto = leerMontoBs(String(datos.get("monto") ?? "").replace(/^\s*bs\.?\s*/i, "").replace(/\s/g, "").slice(0, 30));
  if (!referenciaUtil(referencia)) return volver("sin_referencia");
  if (!monto || monto > 100_000_000) return volver("sin_monto");
  if ((await avisosRecientesDelCliente(cliente.id)) >= 10) return volver("muchos");
  return volver(await avisoDePagoDelCliente({ id: cliente.id, rotulo: cliente.rotulo }, referencia, monto));
}
