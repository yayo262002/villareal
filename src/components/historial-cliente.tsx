import Link from "next/link";
import type { VentaConLineas } from "@/lib/ventas";
import type { Pago } from "@/lib/pagos";
import type { Adjunto } from "@/lib/adjuntos";
import type { FacturaResumida } from "@/lib/facturas";
import type { Contacto } from "@/lib/contactos";
import { TIPOS_DE_CONTACTO } from "@/lib/contactos";
import type { DelBanco } from "@/lib/banco";
import { COMO_SE_SUPO } from "@/lib/banco-calculo";
import { NOMBRE_ESTADO, type CuentaDeVenta, type RepartoDeAbonos } from "@/lib/cuentas";
import { describirVencimiento, type ConVencimiento } from "@/lib/credito";
import { numeroDeNota, resumenDeLineas } from "@/lib/entregas";
import { numeroDeFactura } from "@/lib/factura-calculo";
import { METODOS_PAGO, aBolivares, bs, cantidad, fechaCorta, fechaDeLaBase, formatearMonto, horaDeLaBase, tasaLegible, usd } from "@/lib/dinero";
import { FotoAmpliable } from "@/components/foto-ampliable";
import panel from "@/app/admin/(panel)/panel.module.css";
import estilos from "./historial-cliente.module.css";

/** Una venta del cliente con lo pagado, lo pendiente y su vencimiento. */
export type VentaDelHistorial = ConVencimiento<CuentaDeVenta<VentaConLineas>>;
export type Recordatorio = { id: number; fecha: string; saldo_usd: number };

export const FILTROS_DEL_HISTORIAL = {
  todo: "Todo",
  ventas: "Ventas",
  abonos: "Abonos",
  pendientes: "Por pagar",
  tratos: "Llamadas y recordatorios",
} as const;
export type FiltroDelHistorial = keyof typeof FILTROS_DEL_HISTORIAL;

export function leerFiltroDelHistorial(valor: string | string[] | undefined): FiltroDelHistorial {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v && v in FILTROS_DEL_HISTORIAL ? (v as FiltroDelHistorial) : "todo";
}

/** Cuántas operaciones se enseñan antes de «Ver todo el historial». */
const PRIMERAS = 30;

type Entrada =
  | { tipo: "venta"; fecha: string; id: number; venta: VentaDelHistorial }
  | { tipo: "abono"; fecha: string; id: number; pago: Pago }
  | { tipo: "contacto"; fecha: string; id: number; contacto: Contacto }
  | { tipo: "recordatorio"; fecha: string; id: number; recordatorio: Recordatorio };

/** El mismo día, de lo último a lo primero: el abono después de la venta, y las llamadas al final del día. */
const RANGO: Record<Entrada["tipo"], number> = { recordatorio: 3, contacto: 2, abono: 1, venta: 0 };

/** «Quedó debiendo USD 70,00», «Quedó al día», «Quedó a favor USD 5,00». */
function comoQuedo(saldo: number | undefined): string {
  if (saldo === undefined) return "";
  if (saldo > 0.004) return `Quedó debiendo ${usd(saldo)}`;
  if (saldo < -0.004) return `Quedó a favor ${usd(-saldo)}`;
  return "Quedó al día";
}

/** «N.º 2», «N.º 2 y N.º 3», «N.º 1, N.º 2 y N.º 4». */
function lista(textos: string[]): string {
  return textos.length <= 1 ? (textos[0] ?? "") : `${textos.slice(0, -1).join(", ")} y ${textos[textos.length - 1]}`;
}

/**
 * El historial de un cliente en su ficha: todas sus operaciones juntas, de
 * la más nueva a la más vieja (cada venta, cada abono, cada llamada y cada
 * recordatorio), con cómo quedó su cuenta después de cada una. Se filtra
 * por tipo sin JavaScript (`?ver=`), y cada venta y cada abono abren su
 * detalle ahí mismo: los productos, a qué notas fue cada abono, la foto de
 * la nota firmada y la captura del pago, que se amplían al tocarlas.
 */
export function HistorialDelCliente({
  clienteId,
  ventas,
  pagos,
  adjuntos,
  facturas,
  delBanco,
  contactos,
  recordatorios,
  numeroDeAbono,
  saldoTras,
  reparto,
  enlaceNota,
  enlaceRecibo,
  ver,
  todo,
}: {
  clienteId: number;
  ventas: VentaDelHistorial[];
  pagos: Pago[];
  adjuntos: Adjunto[];
  facturas: Map<number, FacturaResumida>;
  delBanco: Map<number, DelBanco>;
  contactos: Contacto[];
  recordatorios: Recordatorio[];
  numeroDeAbono: Map<number, number>;
  /** Lo que debía el cliente después de cada venta («venta-12») y de cada abono («abono-3»). */
  saldoTras: Map<string, number>;
  reparto: RepartoDeAbonos;
  enlaceNota: (venta: VentaDelHistorial) => string | null;
  enlaceRecibo: (pago: Pago) => string | null;
  ver: FiltroDelHistorial;
  todo: boolean;
}) {
  const fotosDeVenta = new Map<number, Adjunto[]>();
  const capturasDePago = new Map<number, Adjunto[]>();
  for (const a of adjuntos) {
    if (a.pago_id) capturasDePago.set(a.pago_id, [...(capturasDePago.get(a.pago_id) ?? []), a]);
    else if (a.venta_id) fotosDeVenta.set(a.venta_id, [...(fotosDeVenta.get(a.venta_id) ?? []), a]);
  }

  const todas: Entrada[] = [
    ...ventas.map((v) => ({ tipo: "venta" as const, fecha: v.fecha, id: v.id, venta: v })),
    ...pagos.map((p) => ({ tipo: "abono" as const, fecha: p.fecha, id: p.id, pago: p })),
    ...contactos.map((c) => ({ tipo: "contacto" as const, fecha: c.fecha, id: c.id, contacto: c })),
    ...recordatorios.map((r) => ({ tipo: "recordatorio" as const, fecha: r.fecha, id: r.id, recordatorio: r })),
  ].sort((a, b) => b.fecha.slice(0, 10).localeCompare(a.fecha.slice(0, 10)) || RANGO[b.tipo] - RANGO[a.tipo] || b.id - a.id);

  const cuenta: Record<FiltroDelHistorial, number> = {
    todo: todas.length,
    ventas: ventas.length,
    abonos: pagos.length,
    pendientes: ventas.filter((v) => v.pendiente_usd > 0).length,
    tratos: contactos.length + recordatorios.length,
  };
  const elegidas = todas.filter((e) =>
    ver === "ventas"
      ? e.tipo === "venta"
      : ver === "abonos"
        ? e.tipo === "abono"
        : ver === "pendientes"
          ? e.tipo === "venta" && e.venta.pendiente_usd > 0
          : ver === "tratos"
            ? e.tipo === "contacto" || e.tipo === "recordatorio"
            : true,
  );
  const vistas = todo ? elegidas : elegidas.slice(0, PRIMERAS);
  const ruta = (filtro: FiltroDelHistorial, entero = false) =>
    `/admin/clientes/${clienteId}?${new URLSearchParams({ ...(filtro !== "todo" ? { ver: filtro } : {}), ...(entero ? { todo: "1" } : {}) })}#historial`;
  const volverA = (ancla: string) => encodeURIComponent(`/admin/clientes/${clienteId}#${ancla}`);

  return (
    <section className="tarjeta" id="historial">
      {/* Las anclas de antes («#cuentas», «#abonos») llevan aquí. */}
      <span id="cuentas" />
      <span id="abonos" />
      <h2 className={panel.subtitulo}>Historial</h2>
      <p className={panel.ayuda}>
        Todo lo que ha pasado con este cliente, de lo más nuevo a lo más viejo, y cómo quedó su cuenta después de cada cosa. Toca «Ver detalle» para ver los
        productos, la foto de la nota firmada o la captura del pago.
      </p>
      <nav className={estilos.filtros} aria-label="Qué enseñar del historial">
        {(Object.keys(FILTROS_DEL_HISTORIAL) as FiltroDelHistorial[])
          .filter((f) => f === "todo" || cuenta[f] > 0)
          .map((f) => (
            <Link key={f} href={ruta(f)} className={`${estilos.filtro} ${f === ver ? estilos.filtroElegido : ""}`} aria-current={f === ver ? "true" : undefined}>
              {FILTROS_DEL_HISTORIAL[f]} <span className={estilos.cuantos}>{cuenta[f]}</span>
            </Link>
          ))}
      </nav>

      {elegidas.length === 0 ? (
        <p className="vacio">{ver === "todo" ? "Todavía no hay nada: ni ventas ni abonos." : "Nada de eso todavía."}</p>
      ) : (
        <ol className={estilos.lista}>
          {vistas.map((e) => {
            if (e.tipo === "venta") {
              const v = e.venta;
              const fotos = fotosDeVenta.get(v.id) ?? [];
              const factura = facturas.get(v.id);
              const pagadoCon = (reparto.porVenta.get(v.id) ?? []).map((p) => `N.º ${numeroDeAbono.get(p.abono_id) ?? "?"}`);
              const enBs = aBolivares(Number(v.total_usd), v.tasa);
              const whatsapp = enlaceNota(v);
              return (
                <li key={`venta-${v.id}`} id={`venta-${v.id}`} className={`${estilos.entrada} ${estilos.venta}`}>
                  <div className={estilos.fila}>
                    <div className={estilos.queEs}>
                      <p className={estilos.titulo}>
                        <span className={`${estilos.tipo} ${estilos.tipoVenta}`}>Venta</span> Nota N.º {numeroDeNota(v.id)}
                        <span className={estilos.fecha}>{fechaCorta(v.fecha)}</span>
                      </p>
                      <p className={estilos.resumen}>{resumenDeLineas(v.lineas)}</p>
                      <p className={estilos.chips}>
                        <span className={`${panel.estado} ${panel[`estado--${v.estado}`]}`}>{NOMBRE_ESTADO[v.estado]}</span>
                        {v.pendiente_usd > 0 && <span className={v.vencida ? panel.vencida : estilos.chipSuave}>{describirVencimiento(v.atraso)}</span>}
                        {v.por_entregar ? (
                          <span className={`${panel.estado} ${panel["estado--parcial"]}`}>
                            Por entregar{v.entrega_prevista ? ` el ${fechaCorta(v.entrega_prevista)}` : ""}
                          </span>
                        ) : null}
                        {fotos.length > 0 && <span className={estilos.chipSuave}>Con foto de la nota</span>}
                        {factura && <span className={estilos.chipSuave}>Factura {numeroDeFactura(factura.numero)}{factura.estado === "anulada" ? " (anulada)" : ""}</span>}
                      </p>
                    </div>
                    <div className={estilos.cifras}>
                      <span className={estilos.monto}>{usd(Number(v.total_usd))}</span>
                      <span className={estilos.queda}>{comoQuedo(saldoTras.get(`venta-${v.id}`))}</span>
                    </div>
                  </div>
                  <details className={estilos.detalle}>
                    <summary>Ver detalle</summary>
                    <div className={estilos.cuerpo}>
                      {/* Una línea por producto, como en la nota: cabe en el teléfono sin correr de lado. */}
                      <ul className={estilos.lineas}>
                        {v.lineas.map((l) => (
                          <li key={l.id}>
                            <span className={estilos.lineaNombre}>
                              {l.producto_nombre}
                              {l.piezas ? <span className={estilos.piezas}> · {l.piezas} {Number(l.piezas) === 1 ? "pieza" : "piezas"}</span> : null}
                            </span>
                            <span className={estilos.lineaCuenta}>
                              {cantidad(Number(l.cantidad), l.unidad)} × {usd(Number(l.precio_unitario_usd))}
                            </span>
                            <span className={estilos.lineaImporte}>{usd(Number(l.subtotal_usd))}</span>
                          </li>
                        ))}
                      </ul>
                      <dl className={estilos.datos}>
                        {Number(v.descuento_usd) > 0 && (
                          <div>
                            <dt>Descuento</dt>
                            <dd>−{usd(Number(v.descuento_usd))}</dd>
                          </div>
                        )}
                        <div>
                          <dt>Total</dt>
                          <dd>
                            <strong>{usd(Number(v.total_usd))}</strong>
                            {enBs !== null && v.tasa ? ` · ${bs(enBs)} a ${tasaLegible(v.tasa)} (la del día de la nota)` : ""}
                          </dd>
                        </div>
                        <div>
                          <dt>Pagado</dt>
                          <dd>
                            {v.pagado_usd > 0 ? usd(v.pagado_usd) : "Nada todavía"}
                            {pagadoCon.length > 0 ? ` · con ${pagadoCon.length === 1 ? "el abono" : "los abonos"} ${lista(pagadoCon)}` : ""}
                          </dd>
                        </div>
                        <div>
                          <dt>Queda</dt>
                          <dd>
                            {v.pendiente_usd > 0 ? (
                              <>
                                {usd(v.pendiente_usd)} · {describirVencimiento(v.atraso)} (el {fechaCorta(v.vence)})
                              </>
                            ) : (
                              "Nada: está pagada"
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>Entrega</dt>
                          <dd>
                            {v.por_entregar
                              ? `Por entregar${v.entrega_prevista ? ` el ${fechaCorta(v.entrega_prevista)}` : ""}`
                              : v.entregada_en
                                ? `Entregada el ${fechaCorta(fechaDeLaBase(v.entregada_en))} a las ${horaDeLaBase(v.entregada_en)}`
                                : "Entregada"}
                          </dd>
                        </div>
                        {v.origen === "pos" && (
                          <div>
                            <dt>Caja</dt>
                            <dd>Cobrada en la caja{v.cajero ? ` · ${v.cajero}` : ""}</dd>
                          </div>
                        )}
                        {factura && (
                          <div>
                            <dt>Factura</dt>
                            <dd>
                              <Link href={`/admin/facturas/${factura.id}`}>N.º {numeroDeFactura(factura.numero)}</Link>
                              {factura.estado === "anulada" ? " (anulada)" : factura.numero_control ? ` · control ${factura.numero_control}` : ""}
                            </dd>
                          </div>
                        )}
                        {v.nota && (
                          <div>
                            <dt>Observación</dt>
                            <dd>{v.nota}</dd>
                          </div>
                        )}
                      </dl>
                      {fotos.length > 0 ? (
                        <div className={estilos.fotos}>
                          {fotos.map((a) => (
                            <figure key={a.id} className={estilos.foto}>
                              {a.tipo === "application/pdf" ? (
                                <a href={`/admin/adjuntos/${a.id}`} target="_blank" rel="noopener" className={estilos.pdf}>
                                  Abrir el PDF de la nota
                                </a>
                              ) : (
                                <FotoAmpliable src={`/admin/adjuntos/${a.id}`} alt={a.descripcion || "Nota firmada"} className={estilos.imagen} perezosa />
                              )}
                              <figcaption>
                                {a.descripcion || "Nota firmada"} · {fechaCorta(fechaDeLaBase(a.creado_en))} ·{" "}
                                <Link href={`/admin/adjuntos/${a.id}/ver?volver_a=${volverA(`venta-${v.id}`)}`}>con su fecha</Link>
                              </figcaption>
                            </figure>
                          ))}
                        </div>
                      ) : (
                        <p className={estilos.sinFoto}>
                          Sin foto de la nota firmada.{" "}
                          {!v.por_entregar && <Link href={`/admin/ventas/${v.id}/nota`}>Ponerla desde la nota</Link>}
                        </p>
                      )}
                      <div className={estilos.acciones}>
                        <Link href={`/admin/ventas/${v.id}/nota`}>Ver la nota</Link>
                        {whatsapp && (
                          <a href={whatsapp} target="_blank" rel="noopener" className={panel.whatsapp}>
                            Enviar nota
                          </a>
                        )}
                        <Link href={`/admin/ventas/${v.id}/eliminar`} className="enlace-fila">
                          Eliminar
                        </Link>
                      </div>
                    </div>
                  </details>
                </li>
              );
            }

            if (e.tipo === "abono") {
              const p = e.pago;
              const n = numeroDeAbono.get(p.id);
              const capturas = capturasDePago.get(p.id) ?? [];
              const banco = delBanco.get(p.id);
              const despues = saldoTras.get(`abono-${p.id}`);
              const antes = despues === undefined ? undefined : despues + Number(p.monto_usd);
              const fueA = reparto.porAbono.get(p.id) ?? [];
              const sobra = reparto.aFavor.get(p.id);
              const recibo = enlaceRecibo(p);
              // La nota que pone sola la caja o el banco ya se dice en su línea: no se repite.
              const notaAutomatica = (Boolean(p.venta_id) && p.nota === "Cobrado en la caja") || (Boolean(banco) && /^(Entró solo del banco|Del banco)/.test(p.nota));
              return (
                <li key={`abono-${p.id}`} id={`abono-${p.id}`} className={`${estilos.entrada} ${estilos.abono}`}>
                  <div className={estilos.fila}>
                    <div className={estilos.queEs}>
                      <p className={estilos.titulo}>
                        <span className={`${estilos.tipo} ${estilos.tipoAbono}`}>Abono</span> N.º {n}
                        <span className={estilos.fecha}>{fechaCorta(p.fecha)}</span>
                      </p>
                      <p className={estilos.resumen}>
                        {METODOS_PAGO[p.metodo]}
                        {p.moneda === "VES" ? ` · ${formatearMonto(p.monto, p.moneda)}` : ""}
                        {p.referencia ? ` · Ref. ${p.referencia}` : ""}
                      </p>
                      <p className={estilos.chips}>
                        {capturas.length > 0 && <span className={estilos.chipSuave}>Con captura</span>}
                        {banco && <span className={estilos.chipBanco}>Entró del banco</span>}
                        {p.venta_id && <span className={estilos.chipSuave}>Cobrado en la caja</span>}
                      </p>
                    </div>
                    <div className={estilos.cifras}>
                      <span className={`${estilos.monto} ${estilos.montoAbono}`}>−{usd(Number(p.monto_usd))}</span>
                      <span className={estilos.queda}>{comoQuedo(despues)}</span>
                    </div>
                  </div>
                  <details className={estilos.detalle}>
                    <summary>Ver detalle</summary>
                    <div className={estilos.cuerpo}>
                      <dl className={estilos.datos}>
                        <div>
                          <dt>Cómo pagó</dt>
                          <dd>
                            {METODOS_PAGO[p.metodo]}: {formatearMonto(p.monto, p.moneda)}
                            {p.tasa ? ` a ${tasaLegible(p.tasa)} = ${usd(Number(p.monto_usd))}` : ""}
                          </dd>
                        </div>
                        {p.referencia && (
                          <div>
                            <dt>Referencia</dt>
                            <dd>{p.referencia}</dd>
                          </div>
                        )}
                        <div>
                          <dt>Su cuenta</dt>
                          <dd>{antes === undefined ? "—" : `Debía ${usd(antes)} → ${comoQuedo(despues).replace("Quedó", "quedó")}`}</dd>
                        </div>
                        <div>
                          <dt>Se aplicó a</dt>
                          <dd>
                            {fueA.length === 0 && !sobra
                              ? "—"
                              : lista([
                                  ...fueA.map((f) => `la nota N.º ${numeroDeNota(f.venta_id)} (${usd(f.usd)})`),
                                  ...(sobra ? [`${usd(sobra)} a su favor`] : []),
                                ])}
                          </dd>
                        </div>
                        {banco && (
                          <div>
                            <dt>Del banco</dt>
                            <dd>
                              Entró del {banco.banco} el {fechaCorta(banco.fecha)}
                              {banco.hora ? ` a las ${banco.hora}` : ""}
                              {banco.como ? ` · ${COMO_SE_SUPO[banco.como]}` : ""}
                              {banco.titular || banco.telefono ? ` · ${[banco.titular, banco.telefono].filter(Boolean).join(" · ")}` : ""}
                            </dd>
                          </div>
                        )}
                        {p.venta_id && (
                          <div>
                            <dt>Caja</dt>
                            <dd>
                              Cobrado con la <a href={`#venta-${p.venta_id}`}>nota N.º {numeroDeNota(p.venta_id)}</a>
                            </dd>
                          </div>
                        )}
                        {p.nota && !notaAutomatica && (
                          <div>
                            <dt>Nota</dt>
                            <dd>{p.nota}</dd>
                          </div>
                        )}
                      </dl>
                      {capturas.length > 0 ? (
                        <div className={estilos.fotos}>
                          {capturas.map((a) => (
                            <figure key={a.id} className={estilos.foto}>
                              {a.tipo === "application/pdf" ? (
                                <a href={`/admin/adjuntos/${a.id}`} target="_blank" rel="noopener" className={estilos.pdf}>
                                  Abrir el PDF del comprobante
                                </a>
                              ) : (
                                <FotoAmpliable src={`/admin/adjuntos/${a.id}`} alt={`Captura del abono N.º ${n}`} className={estilos.imagen} perezosa />
                              )}
                              <figcaption>
                                Captura N.º {n} · {fechaCorta(fechaDeLaBase(a.creado_en))} ·{" "}
                                <Link href={`/admin/adjuntos/${a.id}/ver?volver_a=${volverA(`abono-${p.id}`)}`}>con su fecha</Link>
                              </figcaption>
                            </figure>
                          ))}
                        </div>
                      ) : (
                        <p className={estilos.sinFoto}>{banco ? "Sin captura: lo avisó el banco." : "Sin captura."}</p>
                      )}
                      <div className={estilos.acciones}>
                        {recibo && (
                          <a href={recibo} target="_blank" rel="noopener" className={panel.whatsapp}>
                            Enviar recibo
                          </a>
                        )}
                        <Link href={`/admin/pagos/${p.id}/eliminar`} className="enlace-fila">
                          Eliminar
                        </Link>
                      </div>
                    </div>
                  </details>
                </li>
              );
            }

            if (e.tipo === "contacto") {
              const c = e.contacto;
              return (
                <li key={`contacto-${c.id}`} className={`${estilos.entrada} ${estilos.trato}`}>
                  <p className={estilos.titulo}>
                    <span className={`${estilos.tipo} ${estilos.tipoTrato}`}>Trato</span> {TIPOS_DE_CONTACTO[c.tipo]}
                    <span className={estilos.fecha}>{fechaCorta(c.fecha)}</span>
                  </p>
                  {c.nota && <p className={estilos.resumen}>{c.nota}</p>}
                </li>
              );
            }

            const r = e.recordatorio;
            return (
              <li key={`recordatorio-${r.id}`} className={`${estilos.entrada} ${estilos.trato}`}>
                <p className={estilos.titulo}>
                  <span className={`${estilos.tipo} ${estilos.tipoTrato}`}>Trato</span> Le recordaste la deuda por WhatsApp
                  <span className={estilos.fecha}>{fechaCorta(r.fecha)}</span>
                </p>
                <p className={estilos.resumen}>Debía {usd(Number(r.saldo_usd))}</p>
              </li>
            );
          })}
        </ol>
      )}
      {!todo && elegidas.length > PRIMERAS && (
        <p className={estilos.mas}>
          <Link href={ruta(ver, true)} className="boton boton--secundario">
            Ver todo el historial ({elegidas.length})
          </Link>
        </p>
      )}
    </section>
  );
}
