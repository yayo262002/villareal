import Link from "next/link";
import { negocio } from "@/config/negocio";
import { listarClientes } from "@/lib/clientes";
import { conLineas, listarVentasPorEntregar, type VentaConLineas } from "@/lib/ventas";
import { leerTasa } from "@/lib/ajustes";
import { cambiarEntrega } from "@/lib/acciones";
import { enlaceAlMapa, planDeDespacho } from "@/lib/despacho";
import { describirUbicacion, explicarMotivo } from "@/lib/direcciones";
import { cargaDe, numeroDeNota, pedidosPorCliente, resumenDeLineas } from "@/lib/entregas";
import { distanciaLegible } from "@/lib/ruta";
import { cantidad, fechaCorta, hoy, redondear, usd } from "@/lib/dinero";
import { enlaceWhatsappA, mensajeEnCamino } from "@/lib/whatsapp";
import { BotonImprimir } from "@/components/boton-imprimir";
import { EntradaFoto } from "@/components/entrada-foto";
import { diasEntre } from "@/lib/credito";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Ruta de despacho" };

const CIUDAD = `${negocio.localidad}, ${negocio.estado}, Venezuela`;

const MODOS = {
  entregas: "Pedidos por entregar",
  todos: "Todos los clientes",
  deben: "Los clientes que deben",
  elegidos: "Los clientes elegidos",
} as const;
type Modo = keyof typeof MODOS;

/** «para hoy», «atrasada 2 días», «para el 03/10». */
function plazoDeEntrega(prevista: string | null, fecha: string): string {
  if (!prevista) return "";
  const atraso = diasEntre(prevista, fecha);
  if (atraso > 0) return `atrasada: era para el ${fechaCorta(prevista)}`;
  if (atraso === 0) return "para hoy";
  if (atraso === -1) return "para mañana";
  return `para el ${fechaCorta(prevista)}`;
}

/** Los pedidos que se le llevan a un cliente, cada uno con su «Entregado», que pide la foto de la nota firmada. */
function Pedidos({ pedidos, volverA }: { pedidos: VentaConLineas[] | undefined; volverA: string }) {
  if (!pedidos || pedidos.length === 0) return null;
  const fecha = hoy();
  return (
    <ul className={estilos.pedidos}>
      {pedidos.map((p) => {
        const plazo = plazoDeEntrega(p.entrega_prevista, fecha);
        return (
          <li key={p.id}>
            <p>
              <Link href={`/admin/ventas/${p.id}/nota`}>Nota {numeroDeNota(p.id)}</Link>
              {" · "}
              {resumenDeLineas(p.lineas)}
              {" · "}
              <strong>{usd(p.total_usd)}</strong>
              {plazo && <span className={plazo.startsWith("atrasada") ? estilos.vencida : "ayuda"}> · {plazo}</span>}
            </p>
            <details className={`${estilos.masDatos} ${estilos.noImprimir}`}>
              <summary>Entregado</summary>
              <form action={cambiarEntrega} encType="multipart/form-data" className={estilos.accionesFila} style={{ flexWrap: "wrap", marginTop: "var(--espacio-2)" }}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="entregada" value="1" />
                <input type="hidden" name="volver_a" value={volverA} />
                <EntradaFoto nombre="foto" id={`foto-entrega-${p.id}`} />
                <button type="submit" className={`boton ${estilos.botonPequeno}`}>
                  Guardar la nota firmada y marcar entregada
                </button>
              </form>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * La ruta de despacho: sale el orden en que conviene visitar a los
 * clientes, saliendo de la tienda y volviendo a ella. Si hay pedidos por
 * entregar, la ruta es la de esos pedidos, con lo que hay que cargar.
 * También se puede hacer con todos los clientes, con los que deben o con
 * los que se elijan; la selección viaja en la dirección de la página
 * (`?c=3&c=8`), así la ruta se puede guardar o mandar a quien reparte.
 */
export default async function PaginaDespacho({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const elegidos = new Set(
    (Array.isArray(parametros.c) ? parametros.c : parametros.c ? [parametros.c] : []).map(Number).filter((n) => n > 0),
  );

  const [todos, porEntregar, tasa] = await Promise.all([
    listarClientes(),
    listarVentasPorEntregar().then(conLineas),
    leerTasa(),
  ]);
  const pedidos = pedidosPorCliente(porEntregar);

  const solo = typeof parametros.solo === "string" ? parametros.solo : "";
  const modo: Modo =
    elegidos.size > 0
      ? "elegidos"
      : solo === "deben" || solo === "todos" || solo === "entregas"
        ? solo
        : porEntregar.length > 0
          ? "entregas"
          : "todos";
  const estaPagina =
    modo === "elegidos"
      ? `/admin/despacho?${[...elegidos].map((id) => `c=${id}`).join("&")}`
      : `/admin/despacho?solo=${modo}`;

  const delDia = todos.filter((c) =>
    modo === "elegidos" ? elegidos.has(c.id) : modo === "deben" ? c.saldo_usd > 0 : modo === "entregas" ? pedidos.has(c.id) : true,
  );
  const plan = planDeDespacho({ direccion: negocio.direccion, ciudad: CIUDAD }, delDia);
  const porCobrar = redondear(delDia.reduce((s, c) => s + Math.max(0, c.saldo_usd), 0));

  // Lo que se lleva en esta salida: los pedidos de los clientes de la ruta y de los que quedaron fuera.
  const pedidosDelDia = delDia.flatMap((c) => pedidos.get(c.id) ?? []);
  const carga = cargaDe(pedidosDelDia);
  const totalDeLosPedidos = redondear(pedidosDelDia.reduce((s, p) => s + p.total_usd, 0));

  // En la lista para elegir, los clientes van en el orden de la ruta completa: los vecinos quedan juntos.
  const planCompleto = planDeDespacho({ direccion: negocio.direccion, ciudad: CIUDAD }, todos);
  const paraElegir = [...planCompleto.ruta.paradas.map((p) => p.dato), ...planCompleto.sinUbicar.map((s) => s.cliente)];

  const avisar = (c: (typeof todos)[number]) => {
    const suyos = pedidos.get(c.id) ?? [];
    return enlaceWhatsappA(
      c.telefono,
      mensajeEnCamino({
        negocio: negocio.nombre,
        cliente: c.nombre,
        lineas: suyos.flatMap((p) => p.lineas),
        total_usd: redondear(suyos.reduce((s, p) => s + p.total_usd, 0)),
        tasa: tasa?.valor,
      }),
    );
  };

  return (
    <>
      <div className={estilos.encabezado}>
        <div>
          <p className={estilos.noImprimir}>
            <Link href="/admin/clientes">← Cartera de clientes</Link>
          </p>
          <h1 className={estilos.titulo}>Ruta de despacho</h1>
        </div>
        {plan.ruta.paradas.length > 0 && (
          <BotonImprimir className={`boton boton--secundario ${estilos.noImprimir}`}>Imprimir la ruta</BotonImprimir>
        )}
      </div>
      <div className={estilos.noImprimir}>
        <Avisos parametros={parametros} />
      </div>

      {!plan.tienda && (
        <p className="aviso aviso--error">
          La dirección de la tienda no se pudo situar. Tiene que decir la calle y la carrera, como «Calle 38 entre
          carreras 30 y 31». Está en <code>src/config/negocio.ts</code>.
        </p>
      )}

      {todos.length === 0 ? (
        <section className="tarjeta">
          <p className="vacio">
            Todavía no hay clientes. <Link href="/admin/clientes">Registra el primero</Link> con su teléfono y su
            dirección.
          </p>
        </section>
      ) : (
        <>
          <nav aria-label="Qué ruta hacer" className={`${estilos.pestanas} ${estilos.noImprimir}`} style={{ marginBottom: 0 }}>
            <Link href="/admin/despacho?solo=entregas" aria-current={modo === "entregas" ? "true" : undefined}>
              Por entregar ({porEntregar.length})
            </Link>
            <Link href="/admin/despacho?solo=todos" aria-current={modo === "todos" ? "true" : undefined}>
              Todos los clientes
            </Link>
            <Link href="/admin/despacho?solo=deben" aria-current={modo === "deben" ? "true" : undefined}>
              Los que deben
            </Link>
            {modo === "elegidos" && (
              <Link href={estaPagina} aria-current="true">
                Elegidos ({delDia.length})
              </Link>
            )}
          </nav>

          {carga.length > 0 && (
            <section className="tarjeta">
              <h2 className={estilos.subtitulo}>Para cargar</h2>
              <ul className={estilos.carga}>
                {carga.map((c) => (
                  <li key={c.producto_id}>
                    <strong>{cantidad(c.cantidad, c.unidad)}</strong> {c.producto}
                  </li>
                ))}
              </ul>
              <p className={estilos.ayuda} style={{ marginTop: "var(--espacio-3)", marginBottom: 0 }}>
                {pedidosDelDia.length} {pedidosDelDia.length === 1 ? "pedido" : "pedidos"} por entregar, que suman{" "}
                <strong>{usd(totalDeLosPedidos)}</strong>.
              </p>
            </section>
          )}

          <section className="tarjeta">
            <h2 className={estilos.subtitulo}>
              {MODOS[modo]}: {plan.ruta.paradas.length} {plan.ruta.paradas.length === 1 ? "parada" : "paradas"}
            </h2>
            {delDia.length === 0 ? (
              <p className="vacio">
                {modo === "entregas" ? (
                  <>
                    No hay pedidos por entregar. Al <Link href="/admin/ventas">anotar una venta</Link>, elige «Por
                    entregar» y saldrá aquí.
                  </>
                ) : modo === "deben" ? (
                  "Nadie debe nada."
                ) : (
                  "Ninguno de los clientes elegidos existe ya."
                )}
              </p>
            ) : plan.ruta.paradas.length === 0 ? (
              <p className="vacio">
                Ninguno de estos clientes tiene una dirección con calle y carrera. Están más abajo, con lo que le falta
                a cada uno.
              </p>
            ) : (
              <>
                <p className={estilos.ayuda}>
                  Sales de la tienda ({plan.tienda && describirUbicacion(plan.tienda)}), pasas por todos y vuelves:{" "}
                  <strong>{distanciaLegible(plan.ruta.cuadras)}</strong>.
                  {porCobrar > 0 && (
                    <>
                      {" "}
                      Por cobrar en esta ruta: <strong>{usd(porCobrar)}</strong>.
                    </>
                  )}
                </p>
                <div className={`${estilos.accionesFila} ${estilos.noImprimir}`} style={{ flexWrap: "wrap", marginBottom: "var(--espacio-4)" }}>
                  {plan.enlaces.map((tramo) => (
                    <a key={tramo.desde} href={tramo.enlace} target="_blank" rel="noopener" className="boton">
                      {plan.enlaces.length === 1
                        ? "Abrir la ruta en Google Maps"
                        : `Google Maps: paradas ${tramo.desde} a ${tramo.hasta}`}
                    </a>
                  ))}
                </div>

                <ol className={estilos.ruta}>
                  {plan.ruta.paradas.map((parada, i) => {
                    const c = parada.dato;
                    const whatsapp = avisar(c);
                    const mapa = enlaceAlMapa(c, CIUDAD);
                    return (
                      <li key={c.id} className={estilos.parada}>
                        <span className={estilos.paradaNumero}>{i + 1}</span>
                        <div className={estilos.paradaDatos}>
                          <div className={estilos.carteraCabecera}>
                            <Link href={`/admin/clientes/${c.id}`} className={estilos.carteraNombre}>
                              {c.rotulo}
                            </Link>
                            {c.saldo_usd > 0 && <span className={estilos.deuda}>Debe {usd(c.saldo_usd)}</span>}
                          </div>
                          <p className={estilos.carteraDato}>
                            {c.direccion}
                            {parada.situacion.origen === "mapa" && (
                              <span className="ayuda">
                                {" "}
                                · según el mapa: {parada.situacion.texto}
                                {parada.situacion.aproximada ? " (aproximado)" : ""}
                              </span>
                            )}
                          </p>
                          <p className={estilos.carteraDato}>
                            {c.telefono && c.telefono !== c.nombre ? `${c.telefono} · ` : ""}
                            {parada.cuadrasDesdeLaAnterior === 0
                              ? "en el mismo sitio que la anterior"
                              : `a ${distanciaLegible(parada.cuadrasDesdeLaAnterior)} de ${i === 0 ? "la tienda" : "la anterior"}`}
                            {c.nota ? ` · ${c.nota}` : ""}
                          </p>
                          <Pedidos pedidos={pedidos.get(c.id)} volverA={estaPagina} />
                          <div className={`${estilos.carteraAcciones} ${estilos.noImprimir}`}>
                            <Link href={`/admin/ventas?cliente=${c.id}`}>Venta</Link>
                            <Link href={`/admin/clientes/${c.id}#abono`}>Abono</Link>
                            {whatsapp && (
                              <a href={whatsapp} target="_blank" rel="noopener" className={estilos.whatsapp}>
                                Avisar
                              </a>
                            )}
                            {mapa && (
                              <a href={mapa} target="_blank" rel="noopener">
                                Mapa
                              </a>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  <li className={`${estilos.parada} ${estilos.paradaFinal}`}>
                    <span className={estilos.paradaNumero}>✓</span>
                    <div className={estilos.paradaDatos}>
                      <strong>Vuelta a la tienda</strong>
                      <p className={estilos.carteraDato}>a {distanciaLegible(plan.ruta.cuadrasDeVuelta)} de la última parada</p>
                    </div>
                  </li>
                </ol>
                <p className={estilos.ayuda} style={{ marginTop: "var(--espacio-4)", marginBottom: 0 }}>
                  El orden sale de contar cuadras entre calles y carreras. No sabe del sentido de las calles ni del
                  tráfico: para eso, abre la ruta en Google Maps.
                </p>
              </>
            )}
          </section>

          {plan.sinUbicar.length > 0 && (
            <section className="tarjeta">
              <h2 className={estilos.subtitulo}>Fuera de la ruta ({plan.sinUbicar.length})</h2>
              <p className={estilos.ayuda}>
                A estos no se les pudo situar. Escribe en su ficha la calle y la carrera, como «Carrera 19 con calle
                25», y entrarán en la ruta.
              </p>
              <ul className={estilos.cartera}>
                {plan.sinUbicar.map(({ cliente: c, motivo }) => {
                  const mapa = enlaceAlMapa(c, CIUDAD);
                  return (
                    <li key={c.id} className={estilos.carteraCliente}>
                      <div className={estilos.carteraCabecera}>
                        <Link href={`/admin/clientes/${c.id}`} className={estilos.carteraNombre}>
                          {c.rotulo}
                        </Link>
                        {c.saldo_usd > 0 && <span className={estilos.deuda}>Debe {usd(c.saldo_usd)}</span>}
                      </div>
                      <p className={estilos.carteraDato}>{c.direccion || "Sin dirección"}</p>
                      <p className={estilos.carteraDato}>
                        <span className="ayuda">{explicarMotivo(motivo)}</span>
                      </p>
                      <Pedidos pedidos={pedidos.get(c.id)} volverA={estaPagina} />
                      <div className={`${estilos.carteraAcciones} ${estilos.noImprimir}`}>
                        <Link href={`/admin/clientes/${c.id}#datos`}>Corregir la dirección</Link>
                        {mapa && (
                          <a href={mapa} target="_blank" rel="noopener">
                            Buscar en el mapa
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className={`tarjeta ${estilos.noImprimir}`}>
            <h2 className={estilos.subtitulo}>Elegir a quién se visita</h2>
            <p className={estilos.ayuda}>
              Marca los clientes y pulsa el botón. Van en el orden de la ruta, así los vecinos quedan juntos.
            </p>
            <form method="get" action="/admin/despacho" className="formulario">
              <ul className={estilos.eleccion}>
                {paraElegir.map((c) => (
                  <li key={c.id}>
                    <label>
                      <input
                        type="checkbox"
                        name="c"
                        value={c.id}
                        defaultChecked={modo === "elegidos" ? elegidos.has(c.id) : modo === "entregas" && pedidos.has(c.id)}
                      />
                      <span>
                        <strong>{c.rotulo}</strong>
                        <span className="ayuda"> {c.direccion || "sin dirección"}</span>
                        {c.por_entregar > 0 && <span className={estilos.deuda}> · por entregar</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div>
                <button type="submit" className="boton">
                  Hacer la ruta
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </>
  );
}
