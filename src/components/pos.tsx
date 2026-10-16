"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  METODOS_PAGO,
  cantidad,
  type MetodoPago,
  type Unidad,
} from "@/lib/dinero";
import {
  faltaPorPagar,
  totalesDe,
  type LineaDelPos,
  type PagoDelPos,
} from "@/lib/pos-calculo";
import { asignarCodigo, cobrarEnPos } from "@/lib/acciones";
import estilos from "./pos.module.css";
import panel from "@/app/admin/(panel)/panel.module.css";

/**
 * La caja: lo que se escanea o se busca entra al carrito, se elige el
 * cliente, se cobra y sale el ticket. Está hecha para un computador con
 * lector de códigos (el lector escribe el código y pulsa Enter, como un
 * teclado) y atajos: F2 buscar, F4 cliente, F8 cobrar, Esc cancelar,
 * Enter confirmar. El carrito se guarda en el navegador: si la página se
 * recarga o el cobro vuelve con un aviso, no se pierde nada.
 */

export type ArticuloParaLaCaja = {
  clave: string;
  producto_id: number;
  variante_id: number | null;
  nombre: string;
  unidad: Unidad;
  precio_usd: number | null;
  codigo_barras: string;
  sku: string;
  marca: string;
  presentacionTexto: string;
  familia: string;
  existencia: number | null;
  estado: "sin_seguir" | "sin" | "poco" | "bien";
};

export type ClienteParaLaCaja = { id: number; rotulo: string };

type Linea = LineaDelPos & { precioManual: boolean };

type Props = {
  catalogo: ArticuloParaLaCaja[];
  clientes: ClienteParaLaCaja[];
  mostradorId: number;
  tasa: number | null;
  /** Por cliente y por clave de artículo: el precio especial. */
  preciosEspeciales: Record<number, Record<string, number>>;
  sinTope: boolean;
  /** La clave de un cobro que volvió con un aviso: ese carrito se conserva. */
  claveDevuelta?: string;
  /** La clave de una venta recién cobrada: su carrito se vacía. */
  claveVendida?: string;
};

const GUARDADO = "pos-carrito";
const CAJERO = "pos-cajero";

const dinero = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usd = (n: number) => `USD ${dinero.format(n)}`;
const bs = (n: number) => `Bs ${dinero.format(n)}`;

function normalizar(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function nuevaClave(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Un pitido corto al añadir; dos graves si no se encontró. */
function pitar(bien: boolean) {
  try {
    const Contexto =
      (
        window as unknown as {
          AudioContext?: typeof AudioContext;
          webkitAudioContext?: typeof AudioContext;
        }
      ).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Contexto) return;
    const ctx = new Contexto();
    const tonos = bien
      ? [[880, 0, 0.09]]
      : [
          [220, 0, 0.12],
          [220, 0.16, 0.12],
        ];
    for (const [frecuencia, desde, duracion] of tonos) {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.frequency.value = frecuencia;
      osc.type = "sine";
      vol.gain.value = 0.15;
      osc.connect(vol).connect(ctx.destination);
      osc.start(ctx.currentTime + desde);
      osc.stop(ctx.currentTime + desde + duracion);
    }
    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // Sin sonido no pasa nada.
  }
}

const NOMBRE_UNIDAD: Record<Unidad, string> = {
  kg: "kg",
  unidad: "unid.",
  carton: "cartón",
};
const ESTADO_TEXTO = {
  bien: "Hay",
  poco: "Queda poco",
  sin: "Sin existencia",
  sin_seguir: "Sin seguir",
} as const;

export function Pos({
  catalogo,
  clientes,
  mostradorId,
  tasa,
  preciosEspeciales,
  sinTope,
  claveDevuelta,
  claveVendida,
}: Props) {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [clienteId, setClienteId] = useState(mostradorId);
  const [cajero, setCajero] = useState("");
  const [descuento, setDescuento] = useState("");
  const [nota, setNota] = useState("");
  const [clave, setClave] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [elegido, setElegido] = useState(0);
  const [noEncontrado, setNoEncontrado] = useState<string | null>(null);
  const [asignarA, setAsignarA] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; mal?: boolean } | null>(
    null,
  );
  const [recien, setRecien] = useState<string | null>(null);
  const [cobrando, setCobrando] = useState(false);
  const [pagos, setPagos] = useState<PagoDelPos[]>([]);
  const [cargado, setCargado] = useState(false);
  const buscador = useRef<HTMLInputElement>(null);
  const selectorCliente = useRef<HTMLSelectElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const enviando = useRef(false);

  // El carrito guardado en el navegador, salvo que sea el de una venta ya cobrada.
  useEffect(() => {
    // Después de pintar (no en el mismo render), para no encadenar renders.
    const tarea = setTimeout(cargarGuardado, 0);
    return () => clearTimeout(tarea);
    function cargarGuardado() {
      try {
        const guardado = JSON.parse(
          localStorage.getItem(GUARDADO) ?? "null",
        ) as {
          clave: string;
          clienteId: number;
          lineas: Linea[];
          descuento: string;
          nota: string;
        } | null;
        if (guardado && guardado.clave && guardado.clave !== claveVendida) {
          setClave(guardado.clave);
          setLineas(guardado.lineas ?? []);
          setClienteId(guardado.clienteId || mostradorId);
          setDescuento(guardado.descuento ?? "");
          setNota(guardado.nota ?? "");
        } else {
          setClave(nuevaClave());
          if (guardado && guardado.clave === claveVendida)
            localStorage.removeItem(GUARDADO);
        }
        setCajero(localStorage.getItem(CAJERO) ?? "");
      } catch {
        setClave(nuevaClave());
      }
      setCargado(true);
    }
  }, [claveVendida, mostradorId, claveDevuelta]);

  useEffect(() => {
    if (!cargado) return;
    try {
      if (lineas.length === 0) localStorage.removeItem(GUARDADO);
      else
        localStorage.setItem(
          GUARDADO,
          JSON.stringify({ clave, clienteId, lineas, descuento, nota }),
        );
      localStorage.setItem(CAJERO, cajero);
    } catch {
      // Sin sitio para guardar no pasa nada.
    }
  }, [cargado, clave, clienteId, lineas, descuento, nota, cajero]);

  const porClave = useMemo(
    () => new Map(catalogo.map((a) => [a.clave, a])),
    [catalogo],
  );
  const precioDe = useCallback(
    (articulo: ArticuloParaLaCaja, cliente: number) =>
      preciosEspeciales[cliente]?.[articulo.clave] ?? articulo.precio_usd ?? 0,
    [preciosEspeciales],
  );

  const totales = useMemo(
    () => totalesDe(lineas, Number(descuento.replace(",", ".")) || 0, tasa),
    [lineas, descuento, tasa],
  );
  const falta = faltaPorPagar(totales.total, pagos);

  const avisar = (texto: string, mal = false) => {
    setAviso({ texto, mal });
    setTimeout(
      () => setAviso((actual) => (actual?.texto === texto ? null : actual)),
      1800,
    );
  };

  const enfocarBuscador = () => {
    buscador.current?.focus();
    buscador.current?.select();
  };

  const agregar = useCallback(
    (articulo: ArticuloParaLaCaja, cantidad = 1) => {
      setLineas((actuales) => {
        const existente = actuales.find((l) => l.clave === articulo.clave);
        if (existente)
          return actuales.map((l) =>
            l.clave === articulo.clave
              ? {
                  ...l,
                  cantidad: Math.round((l.cantidad + cantidad) * 1000) / 1000,
                }
              : l,
          );
        return [
          ...actuales,
          {
            clave: articulo.clave,
            producto_id: articulo.producto_id,
            variante_id: articulo.variante_id,
            nombre: articulo.nombre,
            unidad: articulo.unidad,
            cantidad,
            precio_usd: precioDe(articulo, clienteId),
            precioManual: false,
          },
        ];
      });
      setRecien(articulo.clave);
      setTimeout(
        () => setRecien((r) => (r === articulo.clave ? null : r)),
        1000,
      );
      pitar(true);
      avisar(`Añadido: ${articulo.nombre}`);
      setBusqueda("");
      setNoEncontrado(null);
      setElegido(0);
    },
    [clienteId, precioDe],
  );

  // Lo escrito: primero un código o SKU exacto; si no, lo que coincida en el nombre, la marca o el SKU.
  const resultados = useMemo(() => {
    const texto = normalizar(busqueda);
    if (!texto) return [];
    const exacto = catalogo.filter(
      (a) =>
        normalizar(a.codigo_barras) === texto || normalizar(a.sku) === texto,
    );
    if (exacto.length) return exacto;
    const palabras = texto.split(/\s+/);
    return catalogo
      .filter((a) => {
        const en = normalizar(
          `${a.nombre} ${a.marca} ${a.sku} ${a.presentacionTexto} ${a.familia}`,
        );
        return palabras.every((p) => en.includes(p));
      })
      .slice(0, 8);
  }, [busqueda, catalogo]);

  /** Lo que hace Enter en el buscador: el lector lo pulsa solo después del código. */
  const confirmarBusqueda = () => {
    const texto = busqueda.trim();
    if (!texto) return;
    const exacto =
      catalogo.find(
        (a) =>
          a.codigo_barras && normalizar(a.codigo_barras) === normalizar(texto),
      ) ??
      catalogo.find((a) => a.sku && normalizar(a.sku) === normalizar(texto));
    if (exacto) return agregar(exacto);
    if (resultados.length === 1) return agregar(resultados[0]);
    if (resultados.length > 1)
      return agregar(resultados[Math.min(elegido, resultados.length - 1)]);
    pitar(false);
    setNoEncontrado(texto);
    avisar("Producto no encontrado", true);
  };

  const cambiarLinea = (claveLinea: string, cambios: Partial<Linea>) =>
    setLineas((actuales) =>
      actuales.map((l) => (l.clave === claveLinea ? { ...l, ...cambios } : l)),
    );
  const quitarLinea = (claveLinea: string) =>
    setLineas((actuales) => actuales.filter((l) => l.clave !== claveLinea));

  const cambiarCliente = (nuevo: number) => {
    setClienteId(nuevo);
    // Los precios que no se tocaron a mano siguen al cliente (su precio especial, o el de la lista).
    setLineas((actuales) =>
      actuales.map((l) =>
        l.precioManual
          ? l
          : { ...l, precio_usd: precioDe(porClave.get(l.clave)!, nuevo) },
      ),
    );
  };

  const cancelar = () => {
    if (lineas.length === 0 && !busqueda) return;
    if (!window.confirm("¿Cancelar esta venta y vaciar el carrito?")) return;
    setLineas([]);
    setDescuento("");
    setNota("");
    setBusqueda("");
    setNoEncontrado(null);
    setClave(nuevaClave());
    avisar("Venta cancelada");
    enfocarBuscador();
  };

  const abrirCobro = () => {
    if (lineas.length === 0)
      return avisar("No hay productos en la venta", true);
    setPagos([{ metodo: "efectivo_usd", monto_usd: totales.total }]);
    setCobrando(true);
  };

  const confirmarCobro = () => {
    if (enviando.current) return;
    if (Math.abs(falta) > 0.01)
      return avisar(
        falta > 0 ? `Faltan ${usd(falta)}` : `Se pasa por ${usd(-falta)}`,
        true,
      );
    enviando.current = true;
    formulario.current?.requestSubmit();
  };

  // Los atajos: F2 buscar, F4 cliente, F8 cobrar, Esc cancelar o cerrar, Enter confirmar en la ventana.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        enfocarBuscador();
      } else if (e.key === "F4") {
        e.preventDefault();
        selectorCliente.current?.focus();
      } else if (e.key === "F8") {
        e.preventDefault();
        if (!cobrando) abrirCobro();
      } else if (e.key === "Escape") {
        if (cobrando) setCobrando(false);
        else if (noEncontrado) setNoEncontrado(null);
        else cancelar();
      } else if (
        e.key === "Enter" &&
        cobrando &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        confirmarCobro();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  });

  const venta = {
    clave_pos: clave,
    cliente_id: clienteId,
    cajero,
    descuento_usd: totales.descuento,
    nota,
    lineas: lineas.map((l) => ({
      clave: l.clave,
      producto_id: l.producto_id,
      variante_id: l.variante_id,
      nombre: l.nombre,
      unidad: l.unidad,
      cantidad: l.cantidad,
      precio_usd: l.precio_usd,
    })),
    pagos,
  };
  const clienteElegido = clientes.find((c) => c.id === clienteId);
  // La referencia va con el pago que la tiene: el primero que no sea efectivo (un pago móvil, una transferencia…).
  const conReferencia = pagos.findIndex(
    (p) => !["efectivo_usd", "efectivo_bs", "otro"].includes(p.metodo),
  );
  const stockDe = (l: Linea) => {
    const a = porClave.get(l.clave);
    if (!a || a.existencia === null)
      return { estado: "sin_seguir" as const, texto: "Sin seguir" };
    if (l.cantidad > a.existencia)
      return {
        estado: "sin" as const,
        texto: `Hay ${cantidad(a.existencia, a.unidad)}`,
      };
    return {
      estado: a.estado,
      texto: `${ESTADO_TEXTO[a.estado]}: ${cantidad(a.existencia, a.unidad)}`,
    };
  };

  return (
    <div className={estilos.caja}>
      <section className="tarjeta">
        <div className={estilos.escaner}>
          <label htmlFor="pos-buscar">
            <strong>Escanea el código o escribe el producto</strong>{" "}
            <span className="ayuda">(F2)</span>
          </label>
          <input
            ref={buscador}
            id="pos-buscar"
            type="search"
            autoFocus
            autoComplete="off"
            placeholder="Código de barras, SKU, nombre o marca…"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setElegido(0);
              setNoEncontrado(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmarBusqueda();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setElegido((i) =>
                  Math.min(i + 1, Math.max(0, resultados.length - 1)),
                );
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setElegido((i) => Math.max(0, i - 1));
              }
            }}
          />
          {resultados.length > 0 && busqueda && (
            <ul
              className={estilos.resultados}
              role="listbox"
              aria-label="Productos que coinciden"
            >
              {resultados.map((a, i) => (
                <li key={a.clave} role="option" aria-selected={i === elegido}>
                  <button
                    type="button"
                    className={estilos.resultado}
                    data-elegido={i === elegido ? "1" : undefined}
                    onMouseEnter={() => setElegido(i)}
                    onClick={() => agregar(a)}
                  >
                    <span className={estilos.resultadoNombre}>
                      <strong>{a.nombre}</strong>
                      <span className="ayuda">
                        {[
                          a.presentacionTexto,
                          a.sku ? `SKU ${a.sku}` : "",
                          a.familia,
                        ]
                          .filter(Boolean)
                          .join(" · ")}{" "}
                        <span
                          className={`${estilos.stock} ${estilos[`stock--${a.estado}`]}`}
                        >
                          {a.existencia === null
                            ? "Sin seguir"
                            : `${ESTADO_TEXTO[a.estado]}: ${cantidad(a.existencia, a.unidad)}`}
                        </span>
                      </span>
                    </span>
                    <span className={estilos.resultadoPrecio}>
                      {a.precio_usd === null
                        ? "sin precio"
                        : `${usd(precioDe(a, clienteId))} / ${NOMBRE_UNIDAD[a.unidad]}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {noEncontrado && (
            <div className={estilos.noEncontrado}>
              <strong>
                Producto no encontrado: «{noEncontrado}». ¿Quieres registrarlo?
              </strong>
              <form
                action={asignarCodigo}
                className={panel.accionesFila}
                style={{ flexWrap: "wrap", alignItems: "center" }}
              >
                <input
                  type="hidden"
                  name="codigo_barras"
                  value={noEncontrado}
                />
                <input type="hidden" name="volver_a" value="/admin/pos" />
                <label className="ayuda" htmlFor="pos-asignar">
                  Ponerle este código a:
                </label>
                <select
                  id="pos-asignar"
                  name="clave"
                  value={asignarA}
                  onChange={(e) => setAsignarA(e.target.value)}
                  required
                >
                  <option value="">Elige el artículo</option>
                  {catalogo.map((a) => (
                    <option key={a.clave} value={a.clave}>
                      {a.nombre}
                      {a.codigo_barras ? ` (ya tiene ${a.codigo_barras})` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className={`boton ${panel.botonPequeno}`}
                  disabled={!asignarA}
                >
                  Guardar el código
                </button>
                <Link
                  href={`/admin/productos/nuevo?codigo_barras=${encodeURIComponent(noEncontrado)}`}
                >
                  Crear un producto nuevo
                </Link>
              </form>
            </div>
          )}
        </div>

        <h2
          className={panel.subtitulo}
          style={{ marginTop: "var(--espacio-4)" }}
        >
          Venta{" "}
          {lineas.length > 0
            ? `(${lineas.length} ${lineas.length === 1 ? "artículo" : "artículos"})`
            : ""}
        </h2>
        {lineas.length === 0 ? (
          <p className="vacio">
            Escanea un producto o escríbelo arriba para empezar.
          </p>
        ) : (
          <ul className={estilos.carrito}>
            {lineas.map((l) => {
              const stock = stockDe(l);
              return (
                <li
                  key={l.clave}
                  className={`${estilos.linea} ${recien === l.clave ? estilos["linea--nueva"] : ""}`}
                >
                  <div className={estilos.lineaNombre}>
                    <strong>{l.nombre}</strong>
                    <span className="ayuda">
                      {porClave.get(l.clave)?.presentacionTexto}{" "}
                      <span
                        className={`${estilos.stock} ${estilos[`stock--${stock.estado}`]}`}
                      >
                        {stock.texto}
                      </span>
                    </span>
                  </div>
                  <span className={estilos.lineaSubtotal}>
                    {usd(Math.round(l.cantidad * l.precio_usd * 100) / 100)}
                  </span>
                  <div className={estilos.lineaCampos}>
                    <span className={estilos.masMenos}>
                      <button
                        type="button"
                        aria-label="Una menos"
                        onClick={() =>
                          cambiarLinea(l.clave, {
                            cantidad: Math.max(
                              0,
                              Math.round(
                                (l.cantidad - (l.unidad === "kg" ? 0.5 : 1)) *
                                  1000,
                              ) / 1000,
                            ),
                          })
                        }
                      >
                        −
                      </button>
                      <button
                        type="button"
                        aria-label="Una más"
                        onClick={() =>
                          cambiarLinea(l.clave, {
                            cantidad:
                              Math.round(
                                (l.cantidad + (l.unidad === "kg" ? 0.5 : 1)) *
                                  1000,
                              ) / 1000,
                          })
                        }
                      >
                        +
                      </button>
                    </span>
                    <label>
                      Cantidad
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step={l.unidad === "kg" ? "0.001" : "1"}
                        value={l.cantidad}
                        onChange={(e) =>
                          cambiarLinea(l.clave, {
                            cantidad: Number(e.target.value) || 0,
                          })
                        }
                        aria-label={`Cantidad de ${l.nombre}`}
                      />
                      <span>{NOMBRE_UNIDAD[l.unidad]}</span>
                    </label>
                    <label>
                      USD por {NOMBRE_UNIDAD[l.unidad]}
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={l.precio_usd}
                        onChange={(e) =>
                          cambiarLinea(l.clave, {
                            precio_usd: Number(e.target.value) || 0,
                            precioManual: true,
                          })
                        }
                        aria-label={`Precio de ${l.nombre}`}
                      />
                    </label>
                    <button
                      type="button"
                      className={estilos.quitar}
                      onClick={() => quitarLinea(l.clave)}
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside className={estilos.resumen}>
        <section className="tarjeta">
          <div className="campo">
            <label htmlFor="pos-cliente">
              Cliente <span className="ayuda">(F4)</span>
            </label>
            <select
              ref={selectorCliente}
              id="pos-cliente"
              value={clienteId}
              onChange={(e) => cambiarCliente(Number(e.target.value))}
            >
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id === mostradorId ? "Mostrador (sin cliente)" : c.rotulo}
                  {preciosEspeciales[c.id] ? " · precio especial" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="pos-cajero">Cajero</label>
            <input
              id="pos-cajero"
              type="text"
              value={cajero}
              onChange={(e) => setCajero(e.target.value)}
              placeholder="Quién está en la caja"
              maxLength={60}
            />
          </div>
          <dl className={estilos.totales}>
            <div>
              <dt>Subtotal</dt>
              <dd>{usd(totales.subtotal)}</dd>
            </div>
            <div>
              <dt>
                <label htmlFor="pos-descuento">Descuento (USD)</label>
              </dt>
              <dd>
                <input
                  id="pos-descuento"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={descuento}
                  onChange={(e) => setDescuento(e.target.value)}
                  style={{ width: 110, textAlign: "right" }}
                />
              </dd>
            </div>
            <div className={estilos.total}>
              <dt>Total</dt>
              <dd>{usd(totales.total)}</dd>
            </div>
            <div className={estilos.totalBs}>
              <dt>
                {tasa ? `Tasa BCV ${dinero.format(tasa)}` : "Sin tasa del día"}
              </dt>
              <dd>{totales.totalBs === null ? "—" : bs(totales.totalBs)}</dd>
            </div>
          </dl>
          <button
            type="button"
            className={`boton ${estilos.cobrar}`}
            onClick={abrirCobro}
            disabled={lineas.length === 0}
          >
            Cobrar{" "}
            <span className="ayuda" style={{ color: "inherit", opacity: 0.8 }}>
              (F8)
            </span>
          </button>
          <button
            type="button"
            className="boton boton--secundario"
            onClick={cancelar}
          >
            Cancelar venta (Esc)
          </button>
          <p className={estilos.atajos}>
            <kbd>F2</kbd> buscar · <kbd>F4</kbd> cliente · <kbd>F8</kbd> cobrar
            · <kbd>Esc</kbd> cancelar · <kbd>Enter</kbd> confirmar
            {sinTope ? " · Se puede vender sin existencia" : ""}
          </p>
        </section>
      </aside>

      {cobrando && (
        <div
          className={estilos.fondo}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pos-cobro-titulo"
          onClick={(e) => e.target === e.currentTarget && setCobrando(false)}
        >
          <div className={estilos.ventana}>
            <h2
              id="pos-cobro-titulo"
              className={panel.subtitulo}
              style={{ marginBottom: 0 }}
            >
              Cobrar {usd(totales.total)}
            </h2>
            <p className="ayuda" style={{ margin: 0 }}>
              {clienteElegido?.id === mostradorId
                ? "Mostrador"
                : clienteElegido?.rotulo}{" "}
              · {lineas.length} {lineas.length === 1 ? "artículo" : "artículos"}
              {totales.descuento > 0
                ? ` · descuento ${usd(totales.descuento)}`
                : ""}
              {totales.totalBs !== null
                ? ` · ${bs(totales.totalBs)} a ${dinero.format(tasa!)}`
                : ""}
            </p>
            <ul className={panel.pedidos}>
              {lineas.map((l) => (
                <li key={l.clave}>
                  <p>
                    {dinero.format(l.cantidad)} {NOMBRE_UNIDAD[l.unidad]}{" "}
                    {l.nombre} × {usd(l.precio_usd)} ={" "}
                    <strong>
                      {usd(Math.round(l.cantidad * l.precio_usd * 100) / 100)}
                    </strong>
                  </p>
                </li>
              ))}
            </ul>
            <div>
              <strong>Cómo paga</strong>
              {pagos.map((p, i) => (
                <div key={i} className={estilos.pago}>
                  <div className="campo">
                    <label htmlFor={`pos-metodo-${i}`}>Método</label>
                    <select
                      id={`pos-metodo-${i}`}
                      value={p.metodo}
                      onChange={(e) =>
                        setPagos(
                          pagos.map((x, j) =>
                            j === i
                              ? { ...x, metodo: e.target.value as MetodoPago }
                              : x,
                          ),
                        )
                      }
                    >
                      {(Object.keys(METODOS_PAGO) as MetodoPago[]).map((m) => (
                        <option key={m} value={m}>
                          {METODOS_PAGO[m]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="campo">
                    <label htmlFor={`pos-monto-${i}`}>Monto (USD)</label>
                    <input
                      id={`pos-monto-${i}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={p.monto_usd}
                      onChange={(e) =>
                        setPagos(
                          pagos.map((x, j) =>
                            j === i
                              ? { ...x, monto_usd: Number(e.target.value) || 0 }
                              : x,
                          ),
                        )
                      }
                    />
                  </div>
                  {pagos.length > 1 ? (
                    <button
                      type="button"
                      className={estilos.quitar}
                      onClick={() => setPagos(pagos.filter((_, j) => j !== i))}
                    >
                      Quitar
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
              <div
                className={panel.accionesFila}
                style={{
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginTop: "var(--espacio-2)",
                }}
              >
                <button
                  type="button"
                  className={`boton boton--secundario ${panel.botonPequeno}`}
                  onClick={() =>
                    setPagos([
                      ...pagos,
                      { metodo: "pago_movil", monto_usd: Math.max(0, falta) },
                    ])
                  }
                >
                  Pago mixto: añadir otra vía
                </button>
                <span
                  className={Math.abs(falta) > 0.01 ? panel.vencida : "ayuda"}
                >
                  {Math.abs(falta) <= 0.01
                    ? "Cuadra."
                    : falta > 0
                      ? `Faltan ${usd(falta)}`
                      : `Se pasa por ${usd(-falta)}`}
                </span>
              </div>
              <p className="ayuda" style={{ marginBottom: 0 }}>
                Lo que va en bolívares (pago móvil, transferencia, efectivo en
                Bs, tarjeta) se guarda a la tasa del día
                {tasa ? ` (${dinero.format(tasa)})` : ""}.
              </p>
            </div>
            <div className="campo">
              <label htmlFor="pos-referencia">
                Referencia
                {pagos.length > 1 && conReferencia >= 0
                  ? ` del ${METODOS_PAGO[pagos[conReferencia].metodo].toLowerCase()}`
                  : ""}{" "}
                (opcional)
              </label>
              <input
                id="pos-referencia"
                type="text"
                value={pagos[Math.max(conReferencia, 0)]?.referencia ?? ""}
                onChange={(e) =>
                  setPagos(
                    pagos.map((x, j) =>
                      j === Math.max(conReferencia, 0)
                        ? { ...x, referencia: e.target.value }
                        : x,
                    ),
                  )
                }
                placeholder="Últimos dígitos del pago móvil"
                maxLength={60}
              />
            </div>
            <div className="campo">
              <label htmlFor="pos-nota">Observación (opcional)</label>
              <input
                id="pos-nota"
                type="text"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                maxLength={300}
              />
            </div>
            <div className={panel.accionesFila} style={{ flexWrap: "wrap" }}>
              <button
                type="button"
                className="boton"
                onClick={confirmarCobro}
                disabled={Math.abs(falta) > 0.01}
              >
                Confirmar venta (Enter)
              </button>
              <button
                type="button"
                className="boton boton--secundario"
                onClick={() => setCobrando(false)}
              >
                Volver (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* El cobro va por esta forma, que está siempre en la página aunque no se vea: la venta entera en un JSON. Sin JavaScript no hay caja: el panel de siempre sigue en Ventas. */}
      <form ref={formulario} action={cobrarEnPos} hidden aria-hidden="true">
        <input type="hidden" name="venta" value={JSON.stringify(venta)} />
      </form>

      {aviso && (
        <div
          className={`${estilos.aviso} ${aviso.mal ? estilos["aviso--mal"] : ""}`}
          role="status"
          aria-live="polite"
        >
          {aviso.texto}
        </div>
      )}
    </div>
  );
}
