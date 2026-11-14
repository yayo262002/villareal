"use client";

import { useEffect, useState } from "react";
import type { Entrega } from "@/lib/carrito";
import { aBolivares, bs, usd } from "@/lib/dinero";
import estilos from "./carrito.module.css";

/** Lo que contesta /api/delivery. */
type Calculo =
  | { ok: true; km: number; en_zona: boolean; lugar: string; punto: { lat: number; lon: number }; precio_usd: number | null; gratis_desde_usd: number | null }
  | { ok: false; motivo: string };

type Forma = "delivery" | "tienda";

/** Lo que el teléfono recuerda de la entrega, para no escribirlo otra vez en el próximo pedido. */
type Recordado = { forma: Forma; direccion: string; punto: { lat: number; lon: number } | null };
const CLAVE = "villareal-entrega";

function leerRecordado(): Recordado | null {
  try {
    const crudo = JSON.parse(localStorage.getItem(CLAVE) ?? "null") as Partial<Recordado> | null;
    if (!crudo || (crudo.forma !== "delivery" && crudo.forma !== "tienda")) return null;
    const punto = crudo.punto && Number.isFinite(crudo.punto.lat) && Number.isFinite(crudo.punto.lon) ? crudo.punto : null;
    return { forma: crudo.forma, direccion: typeof crudo.direccion === "string" ? crudo.direccion.slice(0, 200) : "", punto };
  } catch {
    return null;
  }
}

function recordar(r: Recordado): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(r));
  } catch {
    // Sin almacenamiento (navegación privada), se pide cada vez.
  }
}

function km(n: number): string {
  return `${new Intl.NumberFormat("es-VE", { maximumFractionDigits: 1 }).format(n)} km`;
}

/**
 * «¿Cómo lo recibes?»: delivery a Barquisimeto y Cabudare o lo busca en la tienda. Con delivery, «Usar mi ubicación» (el
 * GPS del teléfono, lo más exacto) o la dirección escrita, y la web dice a cuántos kilómetros está y cuánto cuesta (o que
 * se confirma). Lo elegido sube al carrito (`alCambiar`) para el total y el mensaje de WhatsApp.
 */
export function ElegirEntrega({
  compraUsd,
  tasa,
  direccionTienda,
  alCambiar,
}: {
  compraUsd: number;
  tasa: number | null;
  direccionTienda: string;
  alCambiar: (entrega: Entrega) => void;
}) {
  // Esta parte del carrito solo se pinta en el teléfono (sale después de traer los precios): lo recordado se lee al empezar.
  const [recordado] = useState(leerRecordado);
  const [forma, setForma] = useState<Forma>(recordado?.forma ?? "delivery");
  const [direccion, setDireccion] = useState(recordado?.direccion ?? "");
  const [calculo, setCalculo] = useState<Calculo | null>(null);
  const [buscando, setBuscando] = useState<"gps" | "direccion" | null>(null);
  const [avisoGps, setAvisoGps] = useState<string | null>(null);

  async function calcular(consulta: string, como: "gps" | "direccion") {
    setBuscando(como);
    try {
      const r = await fetch(`/api/delivery?${consulta}`, { cache: "no-store" });
      setCalculo((await r.json()) as Calculo);
    } catch {
      setCalculo({ ok: false, motivo: "No se pudo calcular el delivery. Revisa la conexión, o envía el pedido y te lo decimos al responder." });
    } finally {
      setBuscando(null);
    }
  }

  // Si la última vez dio su ubicación, el delivery se calcula otra vez, con las tarifas de hoy.
  useEffect(() => {
    if (recordado?.forma !== "delivery" || !recordado.punto) return;
    let vigente = true;
    fetch(`/api/delivery?lat=${recordado.punto.lat}&lon=${recordado.punto.lon}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<Calculo>)
      .then((c) => vigente && setCalculo(c))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [recordado]);

  // Lo que se recuerda, cada vez que cambia.
  useEffect(() => {
    recordar({ forma, direccion, punto: calculo?.ok ? calculo.punto : null });
  }, [forma, direccion, calculo]);

  // Lo que sube al carrito: con «gratis desde», el delivery no se cobra si la compra llega.
  const precio =
    calculo?.ok && calculo.en_zona && calculo.precio_usd !== null
      ? calculo.gratis_desde_usd !== null && compraUsd >= calculo.gratis_desde_usd
        ? 0
        : calculo.precio_usd
      : null;
  useEffect(() => {
    if (forma === "tienda") alCambiar({ forma: "tienda" });
    else
      alCambiar({
        forma: "delivery",
        direccion,
        enlace: calculo?.ok ? `https://www.google.com/maps?q=${calculo.punto.lat},${calculo.punto.lon}` : null,
        km: calculo?.ok ? calculo.km : null,
        enZona: calculo?.ok ? calculo.en_zona : true,
        precio_usd: precio,
      });
  }, [forma, direccion, calculo, precio, alCambiar]);

  function usarUbicacion() {
    setAvisoGps(null);
    if (!("geolocation" in navigator)) {
      setAvisoGps("Este teléfono no da su ubicación. Escribe tu dirección abajo.");
      return;
    }
    setBuscando("gps");
    navigator.geolocation.getCurrentPosition(
      (posicion) => void calcular(`lat=${posicion.coords.latitude.toFixed(6)}&lon=${posicion.coords.longitude.toFixed(6)}`, "gps"),
      (error) => {
        setBuscando(null);
        setAvisoGps(
          error.code === error.PERMISSION_DENIED
            ? "No nos diste permiso para ver tu ubicación. Escribe tu dirección abajo (o permite la ubicación y vuelve a tocar el botón)."
            : "No se pudo saber tu ubicación. Escribe tu dirección abajo.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  const enBs = (n: number) => {
    const b = aBolivares(n, tasa);
    return b !== null ? ` (${bs(b)})` : "";
  };

  return (
    <fieldset className={estilos.entrega}>
      <legend>¿Cómo lo recibes?</legend>
      <div className={estilos.formas}>
        <label className={estilos.forma}>
          <input type="radio" name="forma-de-entrega" value="delivery" checked={forma === "delivery"} onChange={() => setForma("delivery")} />
          <span>
            <strong>Delivery</strong>
            <span className={estilos.ayuda}>A Barquisimeto y Cabudare, según la distancia</span>
          </span>
        </label>
        <label className={estilos.forma}>
          <input type="radio" name="forma-de-entrega" value="tienda" checked={forma === "tienda"} onChange={() => setForma("tienda")} />
          <span>
            <strong>Lo busco en la tienda</strong>
            <span className={estilos.ayuda}>{direccionTienda}</span>
          </span>
        </label>
      </div>

      {forma === "delivery" && (
        <div className={estilos.delivery}>
          <button type="button" className={`boton ${estilos.ubicacion}`} onClick={usarUbicacion} disabled={buscando !== null}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
            {buscando === "gps" ? "Buscando tu ubicación…" : "Usar mi ubicación"}
          </button>
          {avisoGps && <p className={estilos.avisoEntrega}>{avisoGps}</p>}
          <label className={estilos.campoDireccion}>
            <span>Dirección de entrega</span>
            <textarea
              rows={2}
              value={direccion}
              maxLength={200}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Calle 30 entre carreras 20 y 21, casa 5 · o la urbanización y un punto de referencia"
              autoComplete="street-address"
            />
          </label>
          <button
            type="button"
            className={estilos.botonTexto}
            onClick={() => void calcular(`direccion=${encodeURIComponent(direccion)}`, "direccion")}
            disabled={buscando !== null || direccion.trim().length < 4}
          >
            {buscando === "direccion" ? "Calculando…" : "Calcular el delivery con esta dirección"}
          </button>

          {calculo && (
            <div className={estilos.resultadoEntrega} role="status">
              {!calculo.ok ? (
                <p>{calculo.motivo}</p>
              ) : !calculo.en_zona ? (
                <p>
                  Estás a unos <strong>{km(calculo.km)}</strong> de la tienda, fuera de Barquisimeto y Cabudare. Envía el pedido y te decimos si llegamos y cuánto cuesta.
                </p>
              ) : (
                <>
                  <p>
                    {calculo.lugar === "Tu ubicación" ? "Estás" : `${calculo.lugar.charAt(0).toUpperCase()}${calculo.lugar.slice(1)}: está`} a unos <strong>{km(calculo.km)}</strong> de la tienda.
                  </p>
                  <p className={estilos.precioDelivery}>
                    Delivery:{" "}
                    <strong>{precio === 0 ? "gratis" : precio !== null ? `${usd(precio)}${enBs(precio)}` : "por confirmar"}</strong>
                  </p>
                  {precio === null && <p className={estilos.ayuda}>Te decimos el costo del delivery al responder tu pedido.</p>}
                  {calculo.gratis_desde_usd !== null && precio !== 0 && calculo.precio_usd !== null && (
                    <p className={estilos.ayuda}>Gratis con una compra desde {usd(calculo.gratis_desde_usd)}.</p>
                  )}
                  {calculo.lugar === "Tu ubicación" && <p className={estilos.ayuda}>Escribe también la casa o el local y un punto de referencia, para que el repartidor llegue directo.</p>}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </fieldset>
  );
}
