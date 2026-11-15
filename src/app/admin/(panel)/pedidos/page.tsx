import Link from "next/link";
import { listarPedidos, type PedidoWeb } from "@/lib/pedidos-web";
import { marcarPedido } from "@/lib/acciones";
import { fechaCorta, fechaDeLaBase, horaDeLaBase, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";
import { exigirPanel } from "@/lib/panel";

export const metadata = { title: "Pedidos de la web" };

const ESTADO: Record<PedidoWeb["estado"], { texto: string; clase: string }> = {
  nuevo: { texto: "Nuevo", clase: "estado--por_pagar" },
  atendido: { texto: "Atendido", clase: "estado--pagada" },
  descartado: { texto: "Descartado", clase: "estado--parcial" },
};

/**
 * Los pedidos que se mandan desde el carrito de la web. El pedido llega por WhatsApp; aquí queda una copia para que no
 * se pierda entre los chats: los nuevos arriba, con lo que pidió y lo que escribió, y «Atendido» o «Descartar» cuando se
 * contesta. La venta se anota en la caja, como siempre.
 */
export default async function PaginaPedidos({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  await exigirPanel();
  const parametros = await searchParams;
  const pedidos = await listarPedidos(150);
  const nuevos = pedidos.filter((p) => p.estado === "nuevo");
  const otros = pedidos.filter((p) => p.estado !== "nuevo");

  const tarjeta = (p: PedidoWeb) => (
    <li key={p.id} className="tarjeta" id={`pedido-${p.id}`} style={{ margin: 0, display: "grid", gap: "var(--espacio-2)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--espacio-2)", justifyContent: "space-between", alignItems: "baseline" }}>
        <strong>{[p.nombre, p.negocio].filter(Boolean).join(" · ") || "Sin nombre"}</strong>
        <span className={`${estilos.estado} ${estilos[ESTADO[p.estado].clase]}`}>{ESTADO[p.estado].texto}</span>
      </div>
      <span className="ayuda">
        {fechaCorta(fechaDeLaBase(p.creado_en))} a las {horaDeLaBase(p.creado_en)} · {p.productos} {p.productos === 1 ? "producto" : "productos"}
        {p.total_usd ? ` · unos ${usd(p.total_usd)}` : ""}
      </span>
      <pre style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", font: "inherit", fontSize: 14, background: "var(--color-superficie-suave)", padding: "var(--espacio-3)", borderRadius: "var(--radio)" }}>
        {p.mensaje}
      </pre>
      <div className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
        {p.estado !== "atendido" && (
          <form action={marcarPedido}>
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="estado" value="atendido" />
            <button type="submit" className={`boton ${estilos.botonPequeno}`}>
              Atendido
            </button>
          </form>
        )}
        {p.estado === "nuevo" && (
          <form action={marcarPedido}>
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="estado" value="descartado" />
            <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
              Descartar
            </button>
          </form>
        )}
        {p.estado !== "nuevo" && (
          <form action={marcarPedido}>
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="estado" value="nuevo" />
            <button type="submit" className={estilos.botonEnlace}>
              Volver a nuevo
            </button>
          </form>
        )}
        <Link href="/admin/ventas" className={estilos.botonEnlace}>
          Anotar la venta en la caja
        </Link>
      </div>
    </li>
  );

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 className={estilos.titulo}>Pedidos de la web</h1>
      </div>
      <Avisos parametros={parametros} />
      <p className="ayuda">
        Cuando un cliente pulsa «Enviar pedido por WhatsApp» en el carrito, el pedido te llega por WhatsApp y queda también aquí, para que no se pierda entre los
        chats. No es una venta: cuando lo confirmes, anótala en la caja. Al contestarle, márcalo «Atendido».
      </p>

      <section style={{ marginTop: "var(--espacio-3)" }}>
        <h2 className={estilos.subtitulo}>Nuevos ({nuevos.length})</h2>
        {nuevos.length === 0 ? (
          <p className="vacio">Ningún pedido nuevo.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--espacio-3)" }}>{nuevos.map(tarjeta)}</ul>
        )}
      </section>

      {otros.length > 0 && (
        <section style={{ marginTop: "var(--espacio-4)" }}>
          <h2 className={estilos.subtitulo}>Atendidos y descartados</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--espacio-3)" }}>{otros.slice(0, 60).map(tarjeta)}</ul>
        </section>
      )}
    </>
  );
}
