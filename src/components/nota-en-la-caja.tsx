"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { cantidad as cantidadLegible, fechaCorta, usd, type Unidad } from "@/lib/dinero";
import { describirSaldo } from "@/lib/pos-calculo";
import type { NotaLeida } from "@/lib/nota-leida";
import type { VentaDeLaNota } from "@/lib/nota-a-venta";
import type { ClienteParecido } from "@/lib/cliente-de-la-nota";
import { FotoAmpliable } from "@/components/foto-ampliable";
import estilos from "./pos.module.css";

/**
 * La nota de papel en la caja: el botón «Leer una nota» (toma la foto o la
 * elige de las fotos) y, cuando está leída, lo que dice, para revisarlo de
 * un vistazo antes de confirmar: de quién es (y si no se sabe, lo pregunta
 * con los clientes que se le parecen y por qué), cada renglón con el
 * producto que es, lo que no se sabe qué producto es (para elegirlo), si el
 * total cuadra con la caja, y los avisos. El estado lo lleva la caja
 * (`pos.tsx`); esto solo lo enseña y devuelve lo que se toca.
 */

/** Lo que la caja guarda de una nota leída. */
export type NotaEnLaCaja = {
  /** La foto en el teléfono, para verla al lado (se pierde al recargar). */
  vista: string | null;
  nota: NotaLeida;
  venta: VentaDeLaNota;
  /** Los clientes que se parecen a lo que dice la nota, del más probable al menos. */
  parecidos: ClienteParecido[];
  /** El cliente que el dueño dijo que es («Sí, es este»), o el que ya estaba elegido y casa. */
  confirmadoPara: number | null;
  /** Si lo leído ya pasó al carrito (si el carrito tenía algo, se pregunta antes). */
  enElCarrito: boolean;
  /** Los renglones sin producto ya resueltos: agregados o descartados. */
  resueltos: number[];
};

/** De quién es la nota: ya se sabe, hay que preguntarlo, el elegido no casa, o la nota no lo dice. */
export type EstadoDelCliente = "ok" | "pregunta" | "no_casa" | "sin_dato";

export type ClienteDeLaLista = { id: number; rotulo: string; nombre: string; saldo_usd: number };
export type ArticuloDeLaLista = { clave: string; nombre: string; unidad: Unidad; precio_usd: number | null };

export function BotonLeerNota({ seLee, leyendo, hayNota, onFoto }: { seLee: boolean; leyendo: boolean; hayNota: boolean; onFoto: (archivo: File) => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  return (
    <div className={estilos.lector}>
      <button
        type="button"
        className={`boton ${estilos.botonLeer}`}
        disabled={!seLee || leyendo}
        onClick={() => entrada.current?.click()}
        aria-describedby={hayNota ? undefined : "pos-leer-ayuda"}
      >
        <span aria-hidden="true" className={estilos.botonLeerIcono}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.4-2h5.8l1.4 2h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
            <circle cx="12" cy="12.5" r="3.4" />
          </svg>
        </span>
        {leyendo ? "Leyendo la nota…" : hayNota ? "Leer otra nota" : "Leer una nota de papel"}
      </button>
      {/* Sin «capture»: así deja tomar la foto o elegir una que ya está en el teléfono (una nota de días atrás). */}
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const archivo = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (archivo) onFoto(archivo);
        }}
      />
      {/* Con una nota ya leída, la explicación sobra: la ficha de abajo lo dice todo. */}
      {!hayNota && (
        <span id="pos-leer-ayuda" className={`ayuda ${estilos.lectorAyuda}`}>
          {seLee
            ? "Toma la foto de la nota (o elígela de tus fotos) y la caja se llena sola: el cliente, la fecha, los productos y los precios. Tú revisas y confirmas."
            : "Para que la caja se llene sola con la foto de la nota falta la clave del lector (ANTHROPIC_API_KEY en Vercel)."}
        </span>
      )}
    </div>
  );
}

/** Mientras se lee: la foto y una raya que avanza. */
export function LeyendoNota({ vista }: { vista: string | null }) {
  return (
    <div className={estilos.nota} aria-live="polite" aria-busy="true">
      <div className={estilos.notaCabecera}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {vista && <img src={vista} alt="La nota que se está leyendo" className={estilos.notaVista} />}
        <div className={estilos.notaTitulo}>
          <strong>Leyendo la nota…</strong>
          <span className="ayuda">El cliente, la fecha y cada renglón. Tarda unos segundos.</span>
          <span className={estilos.leyendo} />
        </div>
      </div>
    </div>
  );
}

type PropsPanel = {
  nota: NotaEnLaCaja;
  estado: EstadoDelCliente;
  clientes: Map<number, ClienteDeLaLista>;
  clienteId: number;
  mostradorId: number;
  articulos: Map<string, ArticuloDeLaLista>;
  catalogo: ArticuloDeLaLista[];
  totalDeLaCaja: number;
  aCredito: boolean;
  entregada: boolean;
  onElegirCliente: (id: number) => void;
  onEsElElegido: () => void;
  onBuscarCliente: () => void;
  onPasarAlCarrito: () => void;
  onAgregar: (renglon: number, clave: string) => void;
  onDescartar: (renglon: number) => void;
  onCerrar: () => void;
};

const NOMBRE_UNIDAD: Record<Unidad, string> = { kg: "kg", unidad: "unid.", carton: "cartón" };

export function PanelDeLaNota(p: PropsPanel) {
  const { nota, venta } = { nota: p.nota.nota, venta: p.nota.venta };
  const [eleccion, setEleccion] = useState<Record<number, string>>({});
  const elegido = p.clientes.get(p.clienteId);
  const esMostrador = p.clienteId === p.mostradorId;
  const escrito = nota.cliente?.nombre?.trim() || "";
  const rif = nota.cliente?.rif?.trim() || "";
  const pendientes = venta.sinProducto.filter((l) => !p.nota.resueltos.includes(l.renglon));
  const cuadra = venta.total !== null && Math.abs(venta.total - p.totalDeLaCaja) <= 0.011;

  if (!venta.esNota) {
    return (
      <div className={`${estilos.nota} ${estilos["nota--mal"]}`} role="alert" data-nota-leida="no-es-nota">
        <div className={estilos.notaCabecera}>
          {p.nota.vista && <FotoAmpliable src={p.nota.vista} alt="La foto que se leyó" className={estilos.notaVista} />}
          <div className={estilos.notaTitulo}>
            <strong>Esa foto no parece una nota</strong>
            <span className="ayuda">{venta.avisos[0]}</span>
          </div>
          <button type="button" className={estilos.notaCerrar} onClick={p.onCerrar} aria-label="Quitar lo leído" title="Quitar lo leído">
            ×
          </button>
        </div>
      </div>
    );
  }

  const otros = (excluir: number | null) => p.nota.parecidos.filter((c) => c.id !== excluir && c.id !== p.clienteId);
  const candidato = (c: ClienteParecido, principal: boolean) => {
    const cliente = p.clientes.get(c.id);
    if (!cliente) return null;
    const saldo = describirSaldo(cliente.saldo_usd);
    return principal ? (
      <div key={c.id} className={estilos.pregunta} data-candidato={c.id}>
        <div className={estilos.preguntaQuien}>
          <span className={estilos.preguntaEs}>¿Es</span>
          <strong>{cliente.rotulo}?</strong>
          <span className={estilos.preguntaPor}>
            {c.motivo} · <span className={estilos[`saldo--${saldo.tono}`]}>{saldo.texto}</span>
          </span>
        </div>
        <button type="button" className={`boton ${estilos.preguntaSi}`} onClick={() => p.onElegirCliente(c.id)}>
          Sí, es este
        </button>
      </div>
    ) : (
      <button key={c.id} type="button" className={estilos.otro} onClick={() => p.onElegirCliente(c.id)} data-candidato={c.id}>
        <strong>{cliente.rotulo}</strong>
        <span>{c.motivo}</span>
      </button>
    );
  };

  return (
    <div className={estilos.nota} data-nota-leida="si">
      <div className={estilos.notaCabecera}>
        {p.nota.vista && <FotoAmpliable src={p.nota.vista} alt="La nota leída" className={estilos.notaVista} />}
        <div className={estilos.notaTitulo}>
          <strong>Lo que leí de la nota</strong>
          <span className="ayuda">
            {[venta.fecha ? `del ${fechaCorta(venta.fecha)}` : "sin fecha", `${nota.lineas.length} ${nota.lineas.length === 1 ? "renglón" : "renglones"}`, venta.total !== null ? `total ${usd(venta.total)}` : ""]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
        <button type="button" className={estilos.notaCerrar} onClick={p.onCerrar} aria-label="Quitar lo leído" title="Quitar lo leído (lo del carrito se queda)">
          ×
        </button>
      </div>

      {/* De quién es. */}
      <section className={estilos.notaSeccion} aria-label="De quién es la nota" data-estado-cliente={p.estado}>
        <h3 className={estilos.notaEtiqueta}>¿De quién es?</h3>
        {p.estado === "ok" && elegido && (
          <p className={estilos.clienteOk}>
            <span aria-hidden="true">✓</span>
            <span>
              De <strong>{elegido.rotulo}</strong>
              {escrito ? <> · la nota dice «{escrito}»</> : null}
              {p.nota.parecidos.find((c) => c.id === elegido.id) ? <span className="ayuda"> ({p.nota.parecidos.find((c) => c.id === elegido.id)!.motivo})</span> : null}{" "}
              <button type="button" className={estilos.enlaceBoton} onClick={p.onBuscarCliente}>
                Cambiar
              </button>
            </span>
          </p>
        )}
        {p.estado === "sin_dato" && (
          <p className={estilos.notaTexto}>
            La nota no dice a quién va.{" "}
            {esMostrador ? (
              <>
                <button type="button" className={estilos.enlaceBoton} onClick={p.onBuscarCliente}>
                  Elige el cliente
                </button>{" "}
                arriba (F4), o déjala en el mostrador si pagó en el momento.
              </>
            ) : (
              <>
                Queda para <strong>{elegido?.rotulo}</strong>.
              </>
            )}
          </p>
        )}
        {p.estado === "pregunta" && (
          <>
            <p className={estilos.notaTexto}>
              La nota dice <strong className={estilos.escrito}>«{escrito || rif}»</strong>
              {escrito && rif ? <span className="ayuda"> · RIF {rif}</span> : null}.
            </p>
            {p.nota.parecidos.length > 0 ? (
              <>
                {candidato(p.nota.parecidos[0], true)}
                {otros(p.nota.parecidos[0].id).length > 0 && (
                  <div className={estilos.otros}>
                    <span className="ayuda">¿O es…?</span>
                    {otros(p.nota.parecidos[0].id).map((c) => (
                      candidato(c, false)
                    ))}
                  </div>
                )}
                <p className="ayuda" style={{ margin: 0 }}>
                  ¿Ninguno?{" "}
                  <button type="button" className={estilos.enlaceBoton} onClick={p.onBuscarCliente}>
                    Búscalo arriba
                  </button>{" "}
                  (F4) o <Link href="/admin/clientes">regístralo en Clientes</Link>.
                </p>
              </>
            ) : (
              <p className={estilos.notaAlerta} role="alert">
                <strong>«{escrito || rif}» no se parece a ningún cliente de tu cartera.</strong>{" "}
                <button type="button" className={estilos.enlaceBoton} onClick={p.onBuscarCliente}>
                  Búscalo arriba
                </button>{" "}
                (F4) o <Link href="/admin/clientes">regístralo en Clientes</Link>.
              </p>
            )}
          </>
        )}
        {p.estado === "no_casa" && elegido && (
          <>
            <p className={estilos.notaAlerta} role="alert">
              <strong>
                La nota dice «{escrito || rif}» y elegiste a {elegido.rotulo}
                {elegido.nombre && elegido.nombre !== elegido.rotulo ? ` (${elegido.nombre})` : ""}.
              </strong>{" "}
              {otros(null).length > 0 ? "¿No será de otro cliente?" : "¿Seguro que es de ese cliente?"}
            </p>
            {/* El que se parece a la nota, primero y grande: es lo más probable. */}
            {otros(null).length > 0 && candidato(otros(null)[0], true)}
            {otros(null).length > 1 && (
              <div className={estilos.otros}>
                <span className="ayuda">¿O es…?</span>
                {otros(null)
                  .slice(1)
                  .map((c) => candidato(c, false))}
              </div>
            )}
            <button type="button" className={`boton boton--secundario ${estilos.preguntaSi} ${estilos.dejarAsi}`} onClick={p.onEsElElegido}>
              No, es de {elegido.rotulo}: dejarla así
            </button>
          </>
        )}
      </section>

      {/* Lo que dice, renglón a renglón. */}
      <section className={estilos.notaSeccion} aria-label="Lo que dice la nota">
        <h3 className={estilos.notaEtiqueta}>Lo que dice</h3>
        {!p.nota.enElCarrito && (
          <div className={estilos.notaAlerta}>
            <span>El carrito ya tenía productos y no los cambié. </span>
            <button type="button" className={`boton ${estilos.preguntaSi}`} onClick={p.onPasarAlCarrito}>
              Pasar lo de la nota al carrito
            </button>
          </div>
        )}
        <ul className={estilos.renglones}>
          {venta.lineas.map((l) => {
            const a = p.articulos.get(l.clave);
            if (!a) return null;
            const deLista = a.precio_usd;
            const otroPrecio = l.precio !== null && deLista !== null && Math.abs(l.precio - deLista) > 0.005;
            return (
              <li key={l.clave} className={estilos.renglon} data-renglon="ok">
                <span className={estilos.renglonMarca} aria-hidden="true">
                  ✓
                </span>
                <span className={estilos.renglonCuerpo}>
                  <strong>{a.nombre}</strong>
                  <span className={estilos.renglonDetalle}>
                    {l.piezas ? `${l.piezas} pza · ` : ""}
                    {l.cantidad > 0 ? cantidadLegible(l.cantidad, a.unidad) : <em className={estilos.falta}>¿cuánto?</em>}
                    {" × "}
                    {l.precio !== null ? usd(l.precio) : <em>precio de la lista</em>}
                    {l.precio !== null && l.cantidad > 0 ? <> = <strong>{usd(Math.round(l.cantidad * l.precio * 100) / 100)}</strong></> : null}
                    {otroPrecio ? <span className={estilos.renglonLista}> · en la lista {usd(deLista!)}</span> : null}
                  </span>
                  {l.descripcion && <span className={estilos.renglonLeido}>Dice: «{l.descripcion}»</span>}
                </span>
              </li>
            );
          })}
          {pendientes.map((l) => {
            const opcion = eleccion[l.renglon] ?? l.parecidos[0] ?? "";
            const sugeridos = l.parecidos.map((c) => p.articulos.get(c)).filter((a): a is ArticuloDeLaLista => Boolean(a));
            return (
              <li key={`r${l.renglon}`} className={`${estilos.renglon} ${estilos["renglon--duda"]}`} data-renglon="duda">
                <span className={estilos.renglonMarca} aria-hidden="true">
                  ?
                </span>
                <span className={estilos.renglonCuerpo}>
                  <strong>«{l.descripcion || "un renglón sin nombre"}»</strong>
                  <span className={estilos.renglonDetalle}>
                    {l.piezas ? `${l.piezas} pza · ` : ""}
                    {l.cantidad !== null ? String(l.cantidad).replace(".", ",") : "¿cuánto?"}
                    {l.precio !== null ? ` × ${usd(l.precio)}` : ""}
                    {l.importe !== null ? <> = <strong>{usd(l.importe)}</strong></> : null}
                  </span>
                  <span className={estilos.renglonElegir}>
                    <label className="visualmente-oculto" htmlFor={`pos-nota-renglon-${l.renglon}`}>
                      Qué producto es «{l.descripcion}»
                    </label>
                    <select id={`pos-nota-renglon-${l.renglon}`} value={opcion} onChange={(e) => setEleccion({ ...eleccion, [l.renglon]: e.target.value })}>
                      <option value="">¿Qué producto es?</option>
                      {sugeridos.length > 0 && (
                        <optgroup label="Se parece a">
                          {sugeridos.map((a) => (
                            <option key={a.clave} value={a.clave}>
                              {a.nombre}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Todos">
                        {p.catalogo.map((a) => (
                          <option key={a.clave} value={a.clave}>
                            {a.nombre} ({NOMBRE_UNIDAD[a.unidad]})
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <button type="button" className={`boton ${estilos.botonChico}`} disabled={!opcion} onClick={() => opcion && p.onAgregar(l.renglon, opcion)}>
                      Agregar
                    </button>
                    <button type="button" className={estilos.enlaceBoton} onClick={() => p.onDescartar(l.renglon)}>
                      No va
                    </button>
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        {venta.total !== null && p.nota.enElCarrito && (
          <p className={`${estilos.cuadre} ${cuadra ? estilos["cuadre--bien"] : estilos["cuadre--mal"]}`} data-cuadra={cuadra ? "si" : "no"}>
            <span>
              Total de la nota <strong>{usd(venta.total)}</strong> · en la caja <strong>{usd(p.totalDeLaCaja)}</strong>
            </span>
            <span>{cuadra ? "✓ Cuadra" : pendientes.length > 0 ? "Falta elegir lo de arriba" : "No cuadra: revisa"}</span>
          </p>
        )}
      </section>

      {venta.avisos.length > 0 && (
        <ul className={estilos.notaAvisos}>
          {venta.avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}

      <ul className={estilos.notaPie}>
        {p.entregada ? (
          <li>Va como ya entregada, con esta foto como la nota firmada.</li>
        ) : (
          <li>{venta.firmada === false ? "No veo la firma del cliente:" : "No se distingue la firma:"} di abajo, en «Entrega», si ya la entregaste.</li>
        )}
        {p.aCredito && !esMostrador && <li>Queda pendiente en su cuenta. Si te pagó, cámbialo en «Cómo paga».</li>}
        {p.estado !== "ok" && p.estado !== "sin_dato" ? <li>Primero dime de quién es la nota; después, «Confirmar venta».</li> : <li>Revisa y toca «Confirmar venta».</li>}
      </ul>
    </div>
  );
}
