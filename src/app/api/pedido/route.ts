import { guardarPedido, leerPedido, pedidoIgualReciente } from "@/lib/pedidos-web";
import { direccionDeLaPeticion, peticionPermitida } from "@/lib/intentos";
import { crearAviso } from "@/lib/avisos";
import { empujarAviso } from "@/lib/push";
import { usd } from "@/lib/dinero";

/**
 * POST /api/pedido: el carrito deja aquí una copia del pedido al pulsar «Enviar pedido por WhatsApp» (con
 * `navigator.sendBeacon`, sin esperar respuesta). Queda en «Pedidos de la web» del panel y avisa al teléfono del dueño,
 * para que ningún pedido se pierda entre los chats. Público: lo que llega se limpia y se recorta (`leerPedido`), y cada
 * dirección puede mandar pocos (5 por hora; 60 en total por hora).
 */
export async function POST(peticion: Request): Promise<Response> {
  const sinCache = { "cache-control": "no-store" };
  const crudo = (await peticion.text().catch(() => "")).slice(0, 20000);
  let datos: unknown = null;
  try {
    datos = JSON.parse(crudo);
  } catch {
    return Response.json({ ok: false }, { status: 400, headers: sinCache });
  }
  const pedido = leerPedido(datos);
  if (!pedido) return Response.json({ ok: false }, { status: 400, headers: sinCache });
  if (!(await peticionPermitida("pedido", await direccionDeLaPeticion(), { porDireccion: 5, enTotal: 60, minutos: 60 }))) {
    return Response.json({ ok: false }, { status: 429, headers: sinCache });
  }
  // El botón pulsado dos veces: el mismo pedido una sola vez.
  if (await pedidoIgualReciente(pedido.mensaje)) return Response.json({ ok: true, repetido: true }, { headers: sinCache });
  const id = await guardarPedido(pedido);
  const quien = [pedido.nombre, pedido.negocio].filter(Boolean).join(" · ") || "Alguien sin nombre";
  const cuerpo = `${pedido.lineas.length} ${pedido.lineas.length === 1 ? "producto" : "productos"}${pedido.total_usd ? `, unos ${usd(pedido.total_usd)}` : ""}. Contéstale por WhatsApp.`;
  await crearAviso({ clave: `pedido-web-${id}`, tipo: "pedido", titulo: `Pedido nuevo desde la web: ${quien}`, cuerpo, url: "/admin/pedidos" }).catch(() => undefined);
  await empujarAviso({ titulo: `Pedido desde la web: ${quien}`, cuerpo, url: "/admin/pedidos" }).catch(() => undefined);
  return Response.json({ ok: true }, { headers: sinCache });
}
