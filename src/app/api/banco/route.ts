import { claveDelBancoValida, recibirDelBanco } from "@/lib/banco";
import { bs, fechaEnVenezuela } from "@/lib/dinero";
import { separarAvisos } from "@/lib/banco-calculo";

/**
 * POST /api/banco: el teléfono del negocio (el que tiene el BDVapp) manda aquí
 * cada aviso del banco, con MacroDroid o una app parecida. La clave va en la
 * dirección (`?clave=…`), en la cabecera `X-Clave` o como `Authorization:
 * Bearer …`; se crea en el panel, en Pago móvil. El cuerpo puede ser el texto
 * del aviso tal cual, un formulario o un JSON: se juntan todos sus textos
 * (el título y el cuerpo de la notificación) y se lee el pago. Lo que no es
 * un pago recibido no se guarda. Contesta siempre 200 con lo que hizo, salvo
 * con la clave equivocada (401), para que la app no lo reintente.
 *
 * GET /api/banco?clave=…: para comprobar desde el teléfono que la dirección
 * y la clave están bien. No guarda nada.
 */

const SIN_CACHE = { "cache-control": "no-store" };

function claveDe(peticion: Request): string {
  const autorizacion = peticion.headers.get("authorization") ?? "";
  return (
    peticion.headers.get("x-clave") ||
    (autorizacion.startsWith("Bearer ") ? autorizacion.slice(7) : "") ||
    new URL(peticion.url).searchParams.get("clave") ||
    ""
  ).trim();
}

/** Todos los textos de un JSON (el título, el cuerpo, la app…), en orden, sin entrar demasiado hondo. */
function textosDe(valor: unknown, hondo = 0): string[] {
  if (typeof valor === "string") return [valor];
  if (typeof valor === "number") return [String(valor)];
  if (hondo > 3 || valor === null || typeof valor !== "object") return [];
  return Object.values(valor as Record<string, unknown>).flatMap((v) => textosDe(v, hondo + 1));
}

async function textoDelCuerpo(peticion: Request): Promise<string> {
  const crudo = (await peticion.text()).slice(0, 8000);
  const tipo = peticion.headers.get("content-type") ?? "";
  if (tipo.includes("json") || /^\s*[{[]/.test(crudo)) {
    try {
      return textosDe(JSON.parse(crudo)).join(" ");
    } catch {
      return crudo;
    }
  }
  if (tipo.includes("application/x-www-form-urlencoded")) {
    return [...new URLSearchParams(crudo).values()].join(" ");
  }
  return crudo;
}

export async function POST(peticion: Request): Promise<Response> {
  if (!(await claveDelBancoValida(claveDe(peticion)))) {
    return Response.json({ ok: false, mensaje: "La clave no es la buena. Cópiala otra vez del panel (Pago móvil)." }, { status: 401, headers: SIN_CACHE });
  }
  const texto = await textoDelCuerpo(peticion);
  // El texto leído de una captura de la pantalla puede traer varios avisos: cada uno empieza por «Recibiste». Lo que va
  // antes (la hora, el nombre de la app) se deja; sin ningún aviso, el texto entero (para anotar que el teléfono habló).
  // Cada uno con el día que dice el encabezado de su notificación («mié, 20:45»), para la transferencia, que no lo trae.
  const avisos = separarAvisos(texto, fechaEnVenezuela(new Date())).slice(0, 20);
  const resultados = [];
  for (const { aviso, encabezado } of avisos.length > 0 ? avisos : [{ aviso: texto, encabezado: null }]) resultados.push(await recibirDelBanco(aviso, "telefono", encabezado));
  const leidos = resultados.filter((r) => r.tipo !== "no_es_pago");
  if (leidos.length === 0) {
    const primero = resultados[0];
    // Lo lee el dueño en el iPhone al terminar el atajo: que diga que está conectado, no solo que no era un pago.
    const motivo = primero?.tipo === "no_es_pago" ? primero.motivo : "Llegó vacío.";
    return Response.json(
      { ok: true, leido: false, mensaje: `Conectado con el panel. En lo que se veía no había ningún pago recibido del BDV (${motivo.replace(/\.$/, "").toLowerCase()}).` },
      { headers: SIN_CACHE },
    );
  }
  const mensajes = leidos.map((r) => {
    const m = r.movimiento;
    return r.tipo === "repetido"
      ? `Ya estaba: ${bs(m.monto_bs)}, ref. ${m.referencia || "sin referencia"}.`
      : m.estado === "aplicado"
        ? `${bs(m.monto_bs)} abonados a ${m.cliente_nombre}.`
        : `${bs(m.monto_bs)} por identificar en el panel.`;
  });
  const estados = leidos.map((r) => (r.tipo === "repetido" ? "repetido" : r.movimiento.estado));
  return Response.json({ ok: true, leido: true, estado: estados[0], estados, mensaje: mensajes.join(" ") }, { headers: SIN_CACHE });
}

export async function GET(peticion: Request): Promise<Response> {
  if (!(await claveDelBancoValida(claveDe(peticion)))) {
    return Response.json({ ok: false, mensaje: "La clave no es la buena. Cópiala otra vez del panel (Pago móvil)." }, { status: 401, headers: SIN_CACHE });
  }
  return Response.json({ ok: true, mensaje: "La dirección y la clave están bien. El teléfono tiene que mandar cada aviso del banco con POST." }, { headers: SIN_CACHE });
}
