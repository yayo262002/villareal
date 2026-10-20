"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type InputHTMLAttributes } from "react";
import { METODOS_PAGO, METODOS_EN_BOLIVARES, bs, cantidad, fechaCorta, usd, type MetodoPago, type Unidad } from "@/lib/dinero";
import {
  NOMBRE_MODO,
  cambioDe,
  cuentaDespues,
  describirSaldo,
  faltaPorPagar,
  revisarVentaPos,
  totalesDe,
  type LineaDelPos,
  type ModoDePago,
  type PagoDelPos,
} from "@/lib/pos-calculo";
import { asignarCodigo, guardarVentaPos } from "@/lib/acciones";
import { EntradaFoto } from "@/components/entrada-foto";
import { sumarDias } from "@/lib/credito";
import estilos from "./pos.module.css";
import panel from "@/app/admin/(panel)/panel.module.css";

/**
 * Registrar venta, como una caja: se busca el cliente y se ve su saldo, se
 * escanea o se busca cada producto y entra al carrito, se elige cómo paga
 * (todo ahora, una parte o queda pendiente) y se confirma. La entrega y la
 * observación van plegadas abajo. Hecha para un computador con lector de
 * códigos (el lector escribe el código y pulsa Enter) y atajos: F2 buscar
 * producto, F4 cliente, F8 confirmar, Esc cancelar, Enter confirmar en la
 * ventana. El carrito se guarda en el navegador: si la página se recarga o
 * la venta vuelve con un aviso, no se pierde nada.
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
  /** Lo que suele pesar una pieza, si se sabe. */
  pesoTipico: number | null;
};

export type ClienteParaLaCaja = {
  id: number;
  rotulo: string;
  nombre: string;
  telefono: string;
  /** Lo comprado menos lo abonado: positivo, debe; negativo, a favor. La misma cifra que en Clientes. */
  saldo_usd: number;
  /** Los días de crédito que tiene en su ficha (7 si no se dijo otra cosa). */
  dias_credito: number;
};

type Linea = LineaDelPos & { precioManual: boolean; piezas: number | null };

type Entrega = "ahora" | "despacho";

type Props = {
  catalogo: ArticuloParaLaCaja[];
  clientes: ClienteParaLaCaja[];
  mostradorId: number;
  tasa: number | null;
  /** Por cliente y por clave de artículo: el precio especial. */
  preciosEspeciales: Record<number, Record<string, number>>;
  sinTope: boolean;
  /** La fecha de hoy en Venezuela: la de la nota, salvo que se cambie. */
  hoy: string;
  /** El número que llevará esta nota. */
  siguienteNota: string;
  /** Si hay lector de notas (la foto se lee y se coteja). */
  seLee: boolean;
  /** Las claves de las ventas ya guardadas: un carrito con una de ellas ya se vendió y no se vuelve a enseñar. */
  clavesVendidas: string[];
  /** La clave de una venta que volvió con un aviso: ese carrito se conserva. */
  claveDevuelta?: string;
  /** La foto de la nota que se puso en el intento anterior y sigue guardada. */
  fotoEnEspera?: string;
  pideConfirmar?: boolean;
  pideConfirmarNota?: boolean;
  /** El cliente con el que se abrió la caja (desde su ficha). */
  clienteInicial?: number;
  /** Lo que el servidor contestó al intentar guardar, para enseñarlo también junto a «Confirmar». */
  error?: string;
};

const GUARDADO = "venta-carrito";
const CAJERO = "pos-cajero";
const MAXIMO_DE_RESULTADOS = 8;

const numero = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 });

function normalizar(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function nuevaClave(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Un pitido corto al añadir; dos graves si no se encontró. */
function pitar(bien: boolean) {
  try {
    const ventana = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Contexto = ventana.AudioContext ?? ventana.webkitAudioContext;
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

const NOMBRE_UNIDAD: Record<Unidad, string> = { kg: "kg", unidad: "unid.", carton: "cartón" };
const NOMBRE_CANTIDAD: Record<Unidad, string> = { kg: "Kilos", unidad: "Unidades", carton: "Cartones" };
const ESTADO_TEXTO = { bien: "Hay", poco: "Queda poco", sin: "Sin existencia", sin_seguir: "Sin seguir" } as const;
const SIN_REFERENCIA: MetodoPago[] = ["efectivo_usd", "efectivo_bs", "otro"];

type Guardado = {
  clave: string;
  clienteId: number;
  lineas: Linea[];
  descuento: string;
  nota: string;
  fecha: string;
  modo: ModoDePago;
  entrega: Entrega;
  entregaPrevista: string;
  diasCredito: string;
};

export function Pos({
  catalogo,
  clientes,
  mostradorId,
  tasa,
  preciosEspeciales,
  sinTope,
  hoy,
  siguienteNota,
  seLee,
  clavesVendidas,
  claveDevuelta,
  fotoEnEspera,
  pideConfirmar = false,
  pideConfirmarNota = false,
  clienteInicial,
  error,
}: Props) {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [clienteId, setClienteId] = useState(clienteInicial ?? mostradorId);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [listaClientes, setListaClientes] = useState(false);
  const [clienteMarcado, setClienteMarcado] = useState(0);
  const [fecha, setFecha] = useState(hoy);
  const [cajero, setCajero] = useState("");
  const [descuento, setDescuento] = useState("");
  const [nota, setNota] = useState("");
  const [clave, setClave] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [elegido, setElegido] = useState(0);
  const [noEncontrado, setNoEncontrado] = useState<string | null>(null);
  const [asignarA, setAsignarA] = useState("");
  const [asignando, setAsignando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; mal?: boolean } | null>(null);
  const [recien, setRecien] = useState<string | null>(null);
  const [modo, setModo] = useState<ModoDePago>("ahora");
  const [pagosEscritos, setPagos] = useState<PagoDelPos[]>([]);
  const [pagosTocados, setPagosTocados] = useState(false);
  const [recibido, setRecibido] = useState("");
  const [entrega, setEntrega] = useState<Entrega>("ahora");
  const [entregaPrevista, setEntregaPrevista] = useState("");
  // Los días de crédito de esta nota: vacío, los del cliente.
  const [diasCredito, setDiasCredito] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [confirmarNota, setConfirmarNota] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cargado, setCargado] = useState(false);
  const buscador = useRef<HTMLInputElement>(null);
  const buscadorCliente = useRef<HTMLInputElement>(null);
  const resumen = useRef<HTMLElement>(null);
  const formulario = useRef<HTMLFormElement>(null);

  // El carrito guardado en el navegador, salvo que sea el de una venta ya guardada.
  useEffect(() => {
    // Después de pintar (no en el mismo render), para no encadenar renders.
    const tarea = setTimeout(cargarGuardado, 0);
    return () => clearTimeout(tarea);
    function cargarGuardado() {
      try {
        const guardado = JSON.parse(localStorage.getItem(GUARDADO) ?? "null") as Partial<Guardado> | null;
        const yaVendido = Boolean(guardado?.clave && clavesVendidas.includes(guardado.clave));
        if (guardado && guardado.clave && !yaVendido) {
          setClave(guardado.clave);
          setLineas(guardado.lineas ?? []);
          setClienteId(guardado.clienteId || mostradorId);
          setDescuento(guardado.descuento ?? "");
          setNota(guardado.nota ?? "");
          setFecha(guardado.fecha && guardado.fecha <= hoy ? guardado.fecha : hoy);
          setModo(guardado.modo ?? "ahora");
          setEntrega(guardado.entrega ?? "ahora");
          setEntregaPrevista(guardado.entregaPrevista ?? "");
          setDiasCredito(guardado.diasCredito ?? "");
        } else {
          setClave(nuevaClave());
          if (yaVendido) localStorage.removeItem(GUARDADO);
        }
        setCajero(localStorage.getItem(CAJERO) ?? "");
      } catch {
        setClave(nuevaClave());
      }
      setCargado(true);
    }
  }, [clavesVendidas, mostradorId, claveDevuelta, hoy]);

  // Si el navegador vuelve a esta pantalla desde su memoria (el botón «atrás» del iPhone después de guardar), se
  // recarga: lo que había era de una venta ya guardada y con su clave no se podría registrar otra.
  useEffect(() => {
    const alVolver = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", alVolver);
    return () => window.removeEventListener("pageshow", alVolver);
  }, []);

  useEffect(() => {
    if (!cargado) return;
    try {
      if (lineas.length === 0) localStorage.removeItem(GUARDADO);
      else {
        const guardado: Guardado = { clave, clienteId, lineas, descuento, nota, fecha, modo, entrega, entregaPrevista, diasCredito };
        localStorage.setItem(GUARDADO, JSON.stringify(guardado));
      }
      localStorage.setItem(CAJERO, cajero);
    } catch {
      // Sin sitio para guardar no pasa nada.
    }
  }, [cargado, clave, clienteId, lineas, descuento, nota, cajero, fecha, modo, entrega, entregaPrevista, diasCredito]);

  const porClave = useMemo(() => new Map(catalogo.map((a) => [a.clave, a])), [catalogo]);
  const precioDe = useCallback(
    (articulo: ArticuloParaLaCaja, cliente: number) => preciosEspeciales[cliente]?.[articulo.clave] ?? articulo.precio_usd ?? 0,
    [preciosEspeciales],
  );

  const totales = useMemo(() => totalesDe(lineas, Number(descuento.replace(",", ".")) || 0, tasa), [lineas, descuento, tasa]);
  // Mientras no se toquen los pagos, el único pago es por el total: lo normal es cobrar todo en efectivo.
  const pagos = useMemo<PagoDelPos[]>(() => (pagosTocados ? pagosEscritos : [{ metodo: "efectivo_usd", monto_usd: totales.total }]), [pagosTocados, pagosEscritos, totales.total]);
  const clienteElegido = clientes.find((c) => c.id === clienteId) ?? clientes.find((c) => c.id === mostradorId);
  const esMostrador = !clienteElegido || clienteElegido.id === mostradorId;
  const pagosQueValen = modo === "credito" ? [] : pagos;
  const falta = faltaPorPagar(totales.total, pagosQueValen);
  const cuenta = cuentaDespues(clienteElegido?.saldo_usd ?? 0, totales.total, pagosQueValen);
  const soloEfectivo = modo === "ahora" && pagos.length === 1 && pagos[0].metodo === "efectivo_usd";
  const cambio = cambioDe(Number(recibido.replace(",", ".")) || 0, totales.total);
  // La referencia va con el pago que la tiene: el primero que no sea efectivo (un pago móvil, una transferencia…).
  const conReferencia = pagosQueValen.findIndex((p) => !SIN_REFERENCIA.includes(p.metodo));

  const avisar = (texto: string, mal = false) => {
    setAviso({ texto, mal });
    setTimeout(() => setAviso((actual) => (actual?.texto === texto ? null : actual)), mal ? 3200 : 1800);
  };

  const enfocarBuscador = () => {
    buscador.current?.focus();
    buscador.current?.select();
  };

  const agregar = useCallback(
    (articulo: ArticuloParaLaCaja, cuanto = 1) => {
      setLineas((actuales) => {
        const existente = actuales.find((l) => l.clave === articulo.clave);
        if (existente)
          return actuales.map((l) => (l.clave === articulo.clave ? { ...l, cantidad: Math.round((l.cantidad + cuanto) * 1000) / 1000 } : l));
        return [
          ...actuales,
          {
            clave: articulo.clave,
            producto_id: articulo.producto_id,
            variante_id: articulo.variante_id,
            nombre: articulo.nombre,
            unidad: articulo.unidad,
            cantidad: cuanto,
            precio_usd: precioDe(articulo, clienteId),
            precioManual: false,
            piezas: null,
          },
        ];
      });
      setRecien(articulo.clave);
      setTimeout(() => setRecien((r) => (r === articulo.clave ? null : r)), 1000);
      pitar(true);
      avisar(`Añadido: ${articulo.nombre}`);
      setBusqueda("");
      setNoEncontrado(null);
      setElegido(0);
    },
    [clienteId, precioDe],
  );

  // Lo escrito: primero un código o SKU exacto; si no, lo que coincida en el nombre, la marca, el SKU, la presentación o la familia.
  const resultados = useMemo(() => {
    const texto = normalizar(busqueda);
    if (!texto) return [];
    const exacto = catalogo.filter((a) => normalizar(a.codigo_barras) === texto || normalizar(a.sku) === texto);
    if (exacto.length) return exacto;
    const palabras = texto.split(/\s+/);
    return catalogo
      .filter((a) => {
        const en = normalizar(`${a.nombre} ${a.marca} ${a.sku} ${a.presentacionTexto} ${a.familia}`);
        return palabras.every((p) => en.includes(p));
      })
      .slice(0, MAXIMO_DE_RESULTADOS);
  }, [busqueda, catalogo]);

  /** Lo que hace Enter en el buscador: el lector lo pulsa solo después del código. */
  const confirmarBusqueda = () => {
    const texto = busqueda.trim();
    if (!texto) return;
    const exacto =
      catalogo.find((a) => a.codigo_barras && normalizar(a.codigo_barras) === normalizar(texto)) ??
      catalogo.find((a) => a.sku && normalizar(a.sku) === normalizar(texto));
    if (exacto) return agregar(exacto);
    if (resultados.length === 1) return agregar(resultados[0]);
    if (resultados.length > 1) return agregar(resultados[Math.min(elegido, resultados.length - 1)]);
    pitar(false);
    setNoEncontrado(texto);
    avisar("Producto no encontrado", true);
  };

  /** Ponerle el código leído a un artículo, sin salir de la caja (la acción vuelve con el aviso). */
  const asignarElCodigo = async () => {
    if (!noEncontrado || !asignarA || asignando) return;
    setAsignando(true);
    const datos = new FormData();
    datos.set("codigo_barras", noEncontrado);
    datos.set("clave", asignarA);
    datos.set("volver_a", "/admin/ventas");
    try {
      await asignarCodigo(datos);
    } finally {
      setAsignando(false);
    }
  };

  // Los clientes que coinciden con lo escrito (nombre, razón social o teléfono); sin escribir, los primeros.
  const clientesQueCoinciden = useMemo(() => {
    const texto = normalizar(busquedaCliente);
    const lista = texto
      ? clientes.filter((c) => normalizar(`${c.rotulo} ${c.nombre} ${c.telefono} ${c.telefono.replace(/\D/g, "")}`).includes(texto))
      : clientes;
    return lista.slice(0, MAXIMO_DE_RESULTADOS);
  }, [busquedaCliente, clientes]);

  const cambiarLinea = (claveLinea: string, cambios: Partial<Linea>) =>
    setLineas((actuales) => actuales.map((l) => (l.clave === claveLinea ? { ...l, ...cambios } : l)));
  const quitarLinea = (claveLinea: string) => setLineas((actuales) => actuales.filter((l) => l.clave !== claveLinea));

  const elegirCliente = (nuevo: number) => {
    setClienteId(nuevo);
    setBusquedaCliente("");
    setListaClientes(false);
    setClienteMarcado(0);
    if (nuevo === mostradorId && modo !== "ahora") setModo("ahora");
    setDiasCredito("");
    // Los precios que no se tocaron a mano siguen al cliente (su precio especial, o el de la lista).
    setLineas((actuales) => actuales.map((l) => (l.precioManual ? l : { ...l, precio_usd: precioDe(porClave.get(l.clave)!, nuevo) })));
    enfocarBuscador();
  };

  const cancelar = () => {
    if (lineas.length === 0 && !busqueda) return;
    if (!window.confirm("¿Cancelar esta venta y vaciar el carrito?")) return;
    setLineas([]);
    setDescuento("");
    setNota("");
    setBusqueda("");
    setNoEncontrado(null);
    setRecibido("");
    setPagosTocados(false);
    setModo("ahora");
    setEntrega("ahora");
    setEntregaPrevista("");
    setDiasCredito("");
    setClave(nuevaClave());
    avisar("Venta cancelada");
    enfocarBuscador();
  };

  /** Antes de abrir la confirmación se revisa aquí lo mismo que revisará el servidor: así el aviso es inmediato. */
  const abrirConfirmacion = () => {
    if (guardando) return;
    if (lineas.length === 0) return avisar("No hay productos en la venta", true);
    const motivos = revisarVentaPos({
      lineas,
      descuento_usd: totales.descuento,
      pagos,
      modo,
      esMostrador,
      tasa,
      metodosEnBolivares: METODOS_EN_BOLIVARES,
    });
    if (entrega === "despacho" && !entregaPrevista) motivos.push("Escribe el día previsto de entrega.");
    if (motivos.length > 0) {
      avisar(motivos[0], true);
      resumen.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setConfirmando(true);
  };

  const confirmarVenta = () => {
    if (guardando) return;
    setGuardando(true);
    formulario.current?.requestSubmit();
  };

  // Los atajos: F2 buscar producto, F4 cliente, F8 confirmar, Esc cancelar o cerrar, Enter confirmar en la ventana.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        enfocarBuscador();
      } else if (e.key === "F4") {
        e.preventDefault();
        buscadorCliente.current?.focus();
        setListaClientes(true);
      } else if (e.key === "F8") {
        e.preventDefault();
        if (!confirmando) abrirConfirmacion();
      } else if (e.key === "Escape") {
        if (confirmando) setConfirmando(false);
        else if (listaClientes) setListaClientes(false);
        else if (noEncontrado) setNoEncontrado(null);
        else cancelar();
      } else if (e.key === "Enter" && confirmando && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        confirmarVenta();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  });

  const venta = {
    clave_pos: clave,
    cliente_id: clienteId,
    fecha,
    cajero,
    descuento_usd: totales.descuento,
    nota,
    modo,
    entrega,
    entrega_prevista: entrega === "despacho" ? entregaPrevista : "",
    dias_credito: diasCredito.trim() === "" ? null : Number(diasCredito),
    confirmar,
    confirmar_nota: confirmarNota,
    lineas: lineas.map((l) => ({
      clave: l.clave,
      producto_id: l.producto_id,
      variante_id: l.variante_id,
      nombre: l.nombre,
      unidad: l.unidad,
      cantidad: l.cantidad,
      precio_usd: l.precio_usd,
      piezas: l.piezas,
    })),
    pagos: pagosQueValen.map((p) => ({ metodo: p.metodo, monto_usd: p.monto_usd, referencia: p.referencia ?? "" })),
  };

  const stockDe = (l: Linea) => {
    const a = porClave.get(l.clave);
    if (!a || a.existencia === null) return { estado: "sin_seguir" as const, texto: "Sin seguir" };
    if (l.cantidad > a.existencia) return { estado: "sin" as const, texto: `Hay ${cantidad(a.existencia, a.unidad)}` };
    return { estado: a.estado, texto: `${ESTADO_TEXTO[a.estado]}: ${cantidad(a.existencia, a.unidad)}` };
  };
  const saldo = describirSaldo(clienteElegido?.saldo_usd ?? 0);
  const diasEfectivos = diasCredito.trim() === "" ? (clienteElegido?.dias_credito ?? 7) : Math.max(0, Math.round(Number(diasCredito) || 0));
  const venceEl = fechaCorta(sumarDias(fecha, diasEfectivos));
  const saldoNuevo = describirSaldo(cuenta.saldoNuevo);
  const nombreDeCliente = (c: ClienteParaLaCaja) => (c.id === mostradorId ? "Mostrador (sin cliente)" : c.rotulo);
  const describirPago = () => {
    if (modo === "credito") return "Queda pendiente en su cuenta";
    const vias = pagosQueValen.map((p) => `${METODOS_PAGO[p.metodo]} ${usd(p.monto_usd)}`).join(" · ");
    return modo === "parte" ? `Paga ${vias}; quedan ${usd(cuenta.pendiente)} en su cuenta` : vias;
  };

  return (
    <form
      ref={formulario}
      action={guardarVentaPos}
      encType="multipart/form-data"
      className={estilos.caja}
      // Enter en una casilla no manda la venta: eso solo lo hace «Confirmar».
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault();
      }}
    >
      <input type="hidden" name="venta" value={JSON.stringify(venta)} />

      <div className={estilos.izquierda}>
        <section className={`tarjeta ${estilos.cabecera}`}>
          <div className={estilos.clienteCampo}>
            <label htmlFor="pos-cliente-buscar">
              Cliente <span className="ayuda">(F4)</span>
            </label>
            {clienteElegido && (
              <div className={estilos.clienteElegido} data-cliente={clienteElegido.id}>
                <strong>
                  {nombreDeCliente(clienteElegido)}
                  {!esMostrador && (
                    <span className={`${estilos.saldoEnLinea} ${estilos[`saldo--${saldo.tono}`]}`}>
                      {" "}
                      ({saldo.tono === "debe" ? "⚠️ " : "✓ "}
                      {saldo.texto})
                    </span>
                  )}
                </strong>
                {esMostrador && <span className="ayuda">Paga en el momento</span>}
              </div>
            )}
            <div className={estilos.buscadorCliente}>
              <input
                ref={buscadorCliente}
                id="pos-cliente-buscar"
                type="search"
                autoComplete="off"
                placeholder="Buscar cliente por nombre o teléfono…"
                value={busquedaCliente}
                onFocus={() => setListaClientes(true)}
                onBlur={() => setTimeout(() => setListaClientes(false), 150)}
                onChange={(e) => {
                  setBusquedaCliente(e.target.value);
                  setClienteMarcado(0);
                  setListaClientes(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const c = clientesQueCoinciden[Math.min(clienteMarcado, clientesQueCoinciden.length - 1)];
                    if (c) elegirCliente(c.id);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setClienteMarcado((i) => Math.min(i + 1, Math.max(0, clientesQueCoinciden.length - 1)));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setClienteMarcado((i) => Math.max(0, i - 1));
                  }
                }}
              />
              {listaClientes && (
                <ul id="pos-clientes" className={estilos.resultados} role="listbox" aria-label="Clientes que coinciden">
                  {clientesQueCoinciden.map((c, i) => {
                    const s = describirSaldo(c.saldo_usd);
                    return (
                      <li key={c.id} role="option" aria-selected={i === clienteMarcado}>
                        <button
                          type="button"
                          className={estilos.resultado}
                          data-elegido={i === clienteMarcado ? "1" : undefined}
                          onMouseEnter={() => setClienteMarcado(i)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => elegirCliente(c.id)}
                        >
                          <span className={estilos.resultadoNombre}>
                            <strong>
                              {nombreDeCliente(c)}
                              {c.id !== mostradorId && <span className={`${estilos.saldoEnLinea} ${estilos[`saldo--${s.tono}`]}`}> ({s.texto})</span>}
                            </strong>
                            {c.id !== mostradorId && c.telefono ? <span className="ayuda">{c.telefono}</span> : null}
                          </span>
                          {c.id === mostradorId && <span className="ayuda">sin cuenta</span>}
                        </button>
                      </li>
                    );
                  })}
                  {clientesQueCoinciden.length === 0 && (
                    <li className={estilos.sinResultados}>
                      Ningún cliente con «{busquedaCliente}». <Link href="/admin/clientes">Registrarlo en Clientes</Link>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
          <p className={estilos.numeroNota}>
            Nota <strong>N.º {siguienteNota}</strong> · {fecha === hoy ? "hoy" : fechaCorta(fecha)}
          </p>
        </section>

        <section className="tarjeta">
          <div className={estilos.escaner}>
            <label htmlFor="pos-buscar">
              <strong>Agregar producto</strong> <span className="ayuda">(F2) · escanea el código o escribe el nombre</span>
            </label>
            <input
              ref={buscador}
              id="pos-buscar"
              type="search"
              autoFocus
              autoComplete="off"
              placeholder="Código de barras, SKU, nombre, marca o categoría…"
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
                  setElegido((i) => Math.min(i + 1, Math.max(0, resultados.length - 1)));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setElegido((i) => Math.max(0, i - 1));
                }
              }}
            />
            {resultados.length > 0 && busqueda && (
              <ul className={estilos.resultados} role="listbox" aria-label="Productos que coinciden">
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
                          {[a.presentacionTexto, a.sku ? `SKU ${a.sku}` : "", a.familia].filter(Boolean).join(" · ")}{" "}
                          <span className={`${estilos.stock} ${estilos[`stock--${a.estado}`]}`}>
                            {a.existencia === null ? "Sin seguir" : a.estado === "sin" ? "❌ Sin stock" : `Stock: ${cantidad(a.existencia, a.unidad)}`}
                          </span>
                        </span>
                      </span>
                      <span className={estilos.resultadoPrecio}>
                        {a.precio_usd === null && !preciosEspeciales[clienteId]?.[a.clave] ? "sin precio" : `${usd(precioDe(a, clienteId))} / ${NOMBRE_UNIDAD[a.unidad]}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {noEncontrado && (
              <div className={estilos.noEncontrado}>
                <strong>Producto no encontrado: «{noEncontrado}». ¿Quieres registrarlo?</strong>
                <div className={panel.accionesFila} style={{ flexWrap: "wrap", alignItems: "center" }}>
                  <label className="ayuda" htmlFor="pos-asignar">
                    Ponerle este código a:
                  </label>
                  <select id="pos-asignar" value={asignarA} onChange={(e) => setAsignarA(e.target.value)}>
                    <option value="">Elige el artículo</option>
                    {catalogo.map((a) => (
                      <option key={a.clave} value={a.clave}>
                        {a.nombre}
                        {a.codigo_barras ? ` (ya tiene ${a.codigo_barras})` : ""}
                      </option>
                    ))}
                  </select>
                  <button type="button" className={`boton ${panel.botonPequeno}`} disabled={!asignarA || asignando} onClick={asignarElCodigo}>
                    {asignando ? "Guardando…" : "Guardar el código"}
                  </button>
                  <Link href={`/admin/productos/nuevo?codigo_barras=${encodeURIComponent(noEncontrado)}`}>Crear un producto nuevo</Link>
                </div>
              </div>
            )}
          </div>

          <h2 className={`${panel.subtitulo} ${estilos.tituloCarrito}`}>
            Carrito {lineas.length > 0 ? `(${lineas.length} ${lineas.length === 1 ? "artículo" : "artículos"})` : ""}
          </h2>
          {lineas.length === 0 ? (
            <p className="vacio">Escanea un producto o escríbelo arriba para empezar.</p>
          ) : (
            <div className="tabla-envoltorio">
              <table className={`tabla tabla--fichas ${estilos.carrito}`}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th className="numero">Total</th>
                    <th>
                      <span className="visualmente-oculto">Quitar</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => {
                    const stock = stockDe(l);
                    const articulo = porClave.get(l.clave);
                    return (
                      <tr key={l.clave} className={recien === l.clave ? estilos["linea--nueva"] : undefined}>
                        <td data-label="Producto">
                          <strong>{l.nombre}</strong>
                          <span className={`ayuda ${estilos.lineaDetalle}`}>
                            {articulo?.presentacionTexto ? `${articulo.presentacionTexto} · ` : ""}
                            <span className={`${estilos.stock} ${estilos[`stock--${stock.estado}`]}`}>{stock.texto}</span>
                            {l.unidad === "kg" && articulo?.pesoTipico ? ` · suele pesar ${cantidad(articulo.pesoTipico, "kg")} por pieza` : ""}
                          </span>
                        </td>
                        <td data-label="Cantidad">
                          <span className={estilos.cantidad}>
                            <label className={estilos.campoLinea}>
                              <span>{NOMBRE_CANTIDAD[l.unidad]}</span>
                              <EntradaNumero
                                valor={l.cantidad}
                                entero={l.unidad !== "kg"}
                                onCambio={(n) => cambiarLinea(l.clave, { cantidad: n ?? 0 })}
                                aria-label={`Cantidad de ${l.nombre}`}
                              />
                            </label>
                            {l.unidad === "kg" && (
                              <label className={estilos.campoLinea}>
                                <span>Piezas</span>
                                <EntradaNumero
                                  valor={l.piezas}
                                  entero
                                  placeholder="—"
                                  title="Piezas (opcional)"
                                  className={estilos.piezas}
                                  onCambio={(n) => cambiarLinea(l.clave, { piezas: n && n > 0 ? n : null })}
                                  aria-label={`Piezas de ${l.nombre}`}
                                />
                              </label>
                            )}
                          </span>
                        </td>
                        <td data-label="Precio">
                          <span className={estilos.precio}>
                            <EntradaNumero
                              valor={l.precio_usd}
                              onCambio={(n) => cambiarLinea(l.clave, { precio_usd: n ?? 0, precioManual: true })}
                              aria-label={`Precio de ${l.nombre}`}
                            />
                            <span className="ayuda">USD/{NOMBRE_UNIDAD[l.unidad]}</span>
                          </span>
                        </td>
                        <td data-label="Total" className="numero">
                          <strong>{usd(Math.round(l.cantidad * l.precio_usd * 100) / 100)}</strong>
                        </td>
                        <td className={estilos.celdaQuitar}>
                          <button type="button" className={estilos.quitar} onClick={() => quitarLinea(l.clave)} aria-label={`Quitar ${l.nombre}`} title="Quitar">
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <details className={estilos.plegable} open>
          <summary>
            Entrega{" "}
            <span className="ayuda">
              {entrega === "ahora" ? "ya entregada" : `queda por entregar${entregaPrevista ? ` el ${fechaCorta(entregaPrevista)}` : ""}`}
              {fotoEnEspera ? " · con la foto de la nota" : ""}
            </span>
          </summary>
          <div className={estilos.plegableCuerpo}>
            <div className={estilos.opciones} role="radiogroup" aria-label="Entrega">
              <label>
                <input type="radio" name="entrega_modo" checked={entrega === "ahora"} onChange={() => setEntrega("ahora")} /> Ya entregada
              </label>
              <span className={estilos.opcionConFecha}>
                <label>
                  <input
                    type="radio"
                    name="entrega_modo"
                    checked={entrega === "despacho"}
                    onChange={() => {
                      setEntrega("despacho");
                      if (!entregaPrevista) setEntregaPrevista(hoy);
                    }}
                  />{" "}
                  Queda por entregar el
                </label>
                <input
                  id="pos-entrega-prevista"
                  type="date"
                  min={fecha}
                  value={entregaPrevista || hoy}
                  aria-label="Fecha de entrega"
                  onChange={(e) => {
                    setEntregaPrevista(e.target.value);
                    setEntrega("despacho");
                  }}
                />
              </span>
            </div>
            {entrega === "despacho" ? (
              <p className="ayuda" style={{ margin: 0 }}>
                Sale en el despacho con su ruta, y el resumen te lo recuerda.
              </p>
            ) : (
              <div className="campo">
                <label htmlFor="pos-foto">Foto de la nota firmada (si la tienes a mano)</label>
                {fotoEnEspera && <input type="hidden" name="foto_espera" value={fotoEnEspera} />}
                <EntradaFoto nombre="foto" id="pos-foto" opcional soloFoto />
                <span className="ayuda">
                  {fotoEnEspera ? "La foto que pusiste ya está guardada; solo pon otra si quieres cambiarla. " : "También se puede poner después, desde la nota. "}
                  {seLee && "Se lee sola: si no es la nota, o su fecha o su suma no cuadran con lo anotado, avisa."}
                </span>
                {pideConfirmarNota && (
                  <label className={panel.casilla}>
                    <input type="checkbox" checked={confirmarNota} onChange={(e) => setConfirmarNota(e.target.checked)} />
                    <span>Ya revisé la foto de la nota: guardar igual</span>
                  </label>
                )}
              </div>
            )}
          </div>
        </details>

        <details className={estilos.plegable} open={Boolean(nota)}>
          <summary>
            Observación y cajero <span className="ayuda">{[nota, cajero].filter(Boolean).join(" · ")}</span>
          </summary>
          <div className={`${estilos.plegableCuerpo} formulario__fila`}>
            <div className="campo">
              <label htmlFor="pos-nota">Observación</label>
              <input id="pos-nota" type="text" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} />
            </div>
            <div className="campo">
              <label htmlFor="pos-cajero">Cajero</label>
              <input id="pos-cajero" type="text" value={cajero} onChange={(e) => setCajero(e.target.value)} placeholder="Quién está en la caja" maxLength={60} />
            </div>
          </div>
        </details>

        <p className={`ayuda ${estilos.pieIzquierda}`}>
          <Link href="/admin/codigos">Códigos de barras y SKU</Link> · <Link href="/admin/ventas/clasica">Formulario clásico</Link>
        </p>
      </div>

      <aside className={estilos.resumen} ref={resumen} id="resumen">
        <section className="tarjeta">
          <h2 className={panel.subtitulo} style={{ marginBottom: "var(--espacio-2)" }}>
            Resumen
          </h2>
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
                  type="text"
                  inputMode="decimal"
                  value={descuento}
                  onChange={(e) => setDescuento(e.target.value)}
                  className={estilos.descuento}
                />
              </dd>
            </div>
            <div className={estilos.total}>
              <dt>Total</dt>
              <dd>{usd(totales.total)}</dd>
            </div>
            <div className={estilos.totalBs}>
              <dt>{tasa ? `Tasa BCV ${numero.format(tasa)}` : "Sin tasa del día"}</dt>
              <dd>{totales.totalBs === null ? "—" : bs(totales.totalBs)}</dd>
            </div>
          </dl>

          <div className={`campo ${estilos.fechaVenta}`}>
            <label htmlFor="pos-fecha">Fecha de la venta</label>
            <input id="pos-fecha" type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value || hoy)} />
            <span className="ayuda">{fecha === hoy ? "Hoy. Si la nota es de otro día, cámbiala: los días de crédito cuentan desde ahí." : `La nota es del ${fechaCorta(fecha)}: los días de crédito cuentan desde ahí.`}</span>
          </div>

          <div className={estilos.modos} role="group" aria-label="Cómo paga">
            {(["ahora", "parte", "credito"] as ModoDePago[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`${estilos.modo} ${modo === m ? estilos["modo--activo"] : ""}`}
                aria-pressed={modo === m}
                disabled={m !== "ahora" && esMostrador}
                title={m !== "ahora" && esMostrador ? "Con el mostrador se paga en el momento: elige al cliente" : undefined}
                onClick={() => {
                  setModo(m);
                  if (m === "parte" && !pagosTocados) {
                    setPagosTocados(true);
                    setPagos([{ metodo: "efectivo_usd", monto_usd: 0 }]);
                  }
                  if (m === "ahora" && pagosTocados && pagos.length === 1) {
                    setPagosTocados(false);
                  }
                }}
              >
                {NOMBRE_MODO[m]}
              </button>
            ))}
          </div>

          {modo !== "credito" && (
            <div className={estilos.pagos}>
              {pagos.map((p, i) => (
                <div key={i} className={estilos.pago}>
                  <div className="campo">
                    <label htmlFor={`pos-metodo-${i}`}>Método</label>
                    <select
                      id={`pos-metodo-${i}`}
                      value={p.metodo}
                      onChange={(e) => {
                        setPagosTocados(true);
                        setPagos(pagos.map((x, j) => (j === i ? { ...x, metodo: e.target.value as MetodoPago } : x)));
                      }}
                    >
                      {(Object.keys(METODOS_PAGO) as MetodoPago[]).map((m) => (
                        <option key={m} value={m}>
                          {METODOS_PAGO[m]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="campo">
                    <label htmlFor={`pos-monto-${i}`}>{modo === "parte" ? "Paga ahora (USD)" : "Monto (USD)"}</label>
                    <EntradaNumero
                      id={`pos-monto-${i}`}
                      valor={p.monto_usd}
                      onCambio={(n) => {
                        setPagosTocados(true);
                        setPagos(pagos.map((x, j) => (j === i ? { ...x, monto_usd: n ?? 0 } : x)));
                      }}
                    />
                  </div>
                  {pagos.length > 1 ? (
                    <button
                      type="button"
                      className={estilos.quitarTexto}
                      onClick={() => {
                        setPagosTocados(true);
                        setPagos(pagos.filter((_, j) => j !== i));
                      }}
                    >
                      Quitar
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
              <div className={panel.accionesFila} style={{ flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  className={`boton boton--secundario ${panel.botonPequeno}`}
                  onClick={() => {
                    setPagosTocados(true);
                    setPagos([...pagos, { metodo: "pago_movil", monto_usd: Math.max(0, falta) }]);
                  }}
                >
                  Pago mixto: otra vía
                </button>
                <span className={modo === "ahora" && Math.abs(falta) > 0.01 ? panel.vencida : "ayuda"}>
                  {modo === "ahora"
                    ? Math.abs(falta) <= 0.01
                      ? "Cuadra."
                      : falta > 0
                        ? `Faltan ${usd(falta)}`
                        : `Se pasa por ${usd(-falta)}`
                    : `Pendiente: ${usd(cuenta.pendiente)}`}
                </span>
              </div>
              {soloEfectivo && (
                <div className={estilos.recibido}>
                  <label htmlFor="pos-recibido">Recibido (USD)</label>
                  <input id="pos-recibido" type="text" inputMode="decimal" value={recibido} onChange={(e) => setRecibido(e.target.value)} placeholder={String(totales.total).replace(".", ",")} />
                  <span>
                    Cambio: <strong>{usd(cambio)}</strong>
                  </span>
                </div>
              )}
              {conReferencia >= 0 && (
                <div className="campo">
                  <label htmlFor="pos-referencia">Referencia del {METODOS_PAGO[pagosQueValen[conReferencia].metodo].toLowerCase()} (opcional)</label>
                  <input
                    id="pos-referencia"
                    type="text"
                    value={pagosQueValen[conReferencia]?.referencia ?? ""}
                    onChange={(e) => {
                      setPagosTocados(true);
                      setPagos(pagos.map((x, j) => (j === conReferencia ? { ...x, referencia: e.target.value } : x)));
                    }}
                    placeholder="Últimos dígitos del pago"
                    maxLength={60}
                  />
                </div>
              )}
              {pagosQueValen.some((p) => METODOS_EN_BOLIVARES.includes(p.metodo)) && (
                <p className="ayuda" style={{ margin: 0 }}>
                  Lo que va en bolívares se guarda a la tasa del día de la nota{tasa ? ` (${numero.format(tasa)})` : ""}.
                </p>
              )}
            </div>
          )}

          {!esMostrador && clienteElegido && (
            <dl className={`${estilos.totales} ${estilos.cuenta}`} aria-label="Cómo queda su cuenta">
              <div>
                <dt>Saldo anterior</dt>
                <dd>{saldo.texto}</dd>
              </div>
              <div>
                <dt>Esta venta</dt>
                <dd>+ {usd(totales.total)}</dd>
              </div>
              {cuenta.pagado > 0 && (
                <div>
                  <dt>Paga ahora</dt>
                  <dd>− {usd(cuenta.pagado)}</dd>
                </div>
              )}
              <div className={estilos.saldoNuevo}>
                <dt>Nuevo saldo</dt>
                <dd className={estilos[`saldo--${saldoNuevo.tono}`]}>{saldoNuevo.texto}</dd>
              </div>
            </dl>
          )}
          {!esMostrador && clienteElegido && modo !== "ahora" && (
            <div className={estilos.credito}>
              <label htmlFor="pos-dias-credito">Días de crédito</label>
              <EntradaNumero
                id="pos-dias-credito"
                entero
                valor={diasCredito.trim() === "" ? clienteElegido.dias_credito : Number(diasCredito)}
                onCambio={(n) => setDiasCredito(n === null ? "" : String(Math.max(0, n)))}
              />
              <span className="ayuda">
                Vence el <strong>{venceEl}</strong>
                {diasCredito.trim() === "" ? " (los de su ficha)" : ""}
              </span>
            </div>
          )}

          {error && (
            <p className="aviso aviso--error" role="alert" style={{ margin: 0 }}>
              {error}
            </p>
          )}
          {pideConfirmar && (
            <label className={`${panel.casilla} ${estilos.casillaAviso}`}>
              <input type="checkbox" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} />
              <span>Lo escrito es correcto: guardar igual</span>
            </label>
          )}
          {pideConfirmarNota && entrega === "ahora" && (
            <p className={`ayuda ${estilos.casillaAviso}`}>Revisa la foto de la nota en «Entrega», abajo, y marca «Ya revisé la foto de la nota».</p>
          )}

          <button type="button" className={`boton ${estilos.cobrar}`} onClick={abrirConfirmacion} disabled={lineas.length === 0 || guardando}>
            {guardando ? "Guardando…" : "Confirmar venta"}{" "}
            {!guardando && (
              <span className="ayuda" style={{ color: "inherit", opacity: 0.8 }}>
                (F8)
              </span>
            )}
          </button>
          <button type="button" className="boton boton--secundario" onClick={cancelar}>
            Cancelar venta (Esc)
          </button>
          <p className={estilos.atajos}>
            <kbd>F2</kbd> producto · <kbd>F4</kbd> cliente · <kbd>F8</kbd> confirmar · <kbd>Esc</kbd> cancelar
            {sinTope ? " · Se puede vender sin existencia" : ""}
          </p>
        </section>
      </aside>

      {lineas.length > 0 && (
        <div className={estilos.barraMovil}>
          <span>
            <strong>{usd(totales.total)}</strong> · {lineas.length} {lineas.length === 1 ? "artículo" : "artículos"}
          </span>
          <button type="button" className="boton" onClick={() => resumen.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            Ir a cobrar
          </button>
        </div>
      )}

      {confirmando && (
        <div className={estilos.fondo} role="dialog" aria-modal="true" aria-labelledby="pos-confirmar-titulo" onClick={(e) => e.target === e.currentTarget && setConfirmando(false)}>
          <div className={estilos.ventana}>
            <h2 id="pos-confirmar-titulo" className={panel.subtitulo} style={{ marginBottom: 0 }}>
              ¿Confirmar venta?
            </h2>
            <dl className={estilos.detalle}>
              <div>
                <dt>Cliente</dt>
                <dd>{clienteElegido ? nombreDeCliente(clienteElegido) : ""}</dd>
              </div>
              <div>
                <dt>Fecha de la nota</dt>
                <dd>{fechaCorta(fecha)}</dd>
              </div>
              <div>
                <dt>Productos</dt>
                <dd>
                  {lineas.map((l) => (
                    <div key={l.clave}>
                      {numero.format(l.cantidad)} {NOMBRE_UNIDAD[l.unidad]} {l.nombre} × {usd(l.precio_usd)} = <strong>{usd(Math.round(l.cantidad * l.precio_usd * 100) / 100)}</strong>
                    </div>
                  ))}
                  {totales.descuento > 0 && <div>Descuento: − {usd(totales.descuento)}</div>}
                </dd>
              </div>
              <div className={estilos.detalleTotal}>
                <dt>Total</dt>
                <dd>
                  <strong>{usd(totales.total)}</strong>
                  {totales.totalBs !== null ? ` · ${bs(totales.totalBs)}` : ""}
                </dd>
              </div>
              <div>
                <dt>Pago</dt>
                <dd>
                  {describirPago()}
                  {soloEfectivo && cambio > 0 ? ` · cambio ${usd(cambio)}` : ""}
                </dd>
              </div>
              {!esMostrador && (
                <div>
                  <dt>Su cuenta</dt>
                  <dd>
                    {saldo.texto} → <strong className={estilos[`saldo--${saldoNuevo.tono}`]}>{saldoNuevo.texto}</strong>
                  </dd>
                </div>
              )}
              {!esMostrador && cuenta.pendiente > 0.009 && (
                <div>
                  <dt>Vence</dt>
                  <dd>
                    {venceEl} ({diasEfectivos} {diasEfectivos === 1 ? "día" : "días"} de crédito)
                  </dd>
                </div>
              )}
              <div>
                <dt>Entrega</dt>
                <dd>{entrega === "ahora" ? "Ya entregada" : `Queda por entregar el ${entregaPrevista ? fechaCorta(entregaPrevista) : "…"}`}</dd>
              </div>
            </dl>
            <div className={panel.accionesFila} style={{ flexWrap: "wrap" }}>
              <button type="button" className="boton" onClick={confirmarVenta} disabled={guardando}>
                {guardando ? "Guardando…" : "Confirmar venta (Enter)"}
              </button>
              <button type="button" className="boton boton--secundario" onClick={() => setConfirmando(false)} disabled={guardando}>
                Cancelar (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {aviso && (
        <div className={`${estilos.aviso} ${aviso.mal ? estilos["aviso--mal"] : ""}`} role="status" aria-live="polite">
          {aviso.texto}
        </div>
      )}
    </form>
  );
}

/**
 * Una casilla para un número que se escribe como aquí, con coma o con punto
 * («2,5»). Es de texto, no «number»: en el iPhone la casilla numérica
 * rechaza la coma del teclado y volvía la cantidad a 0. Mientras se escribe
 * se guarda lo tecleado tal cual; al salir se enseña el número limpio.
 */
function EntradaNumero({
  valor,
  onCambio,
  entero = false,
  ...resto
}: {
  valor: number | null;
  onCambio: (n: number | null) => void;
  entero?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode">) {
  const [texto, setTexto] = useState<string | null>(null);
  const mostrado = texto ?? (valor === null ? "" : String(valor).replace(".", ","));
  return (
    <input
      type="text"
      inputMode={entero ? "numeric" : "decimal"}
      autoComplete="off"
      value={mostrado}
      onChange={(e) => {
        const escrito = e.target.value;
        setTexto(escrito);
        if (escrito.trim() === "") return onCambio(null);
        const n = Number(escrito.replace(",", "."));
        if (Number.isFinite(n)) onCambio(entero ? Math.round(n) : n);
      }}
      onBlur={() => setTexto(null)}
      {...resto}
    />
  );
}
