"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cuantoDe, mensajeDePedido, pasoDe, ponerCantidad, totalesDelCarrito, type ProductoDelCarrito } from "@/lib/carrito";
import { aBolivares, bs, usd } from "@/lib/dinero";
import { IconoWhatsapp } from "@/components/icono-whatsapp";
import { guardarCarrito, useCarrito } from "./almacen";
import estilos from "./carrito.module.css";

type Datos = { productos: ProductoDelCarrito[]; tasa: number | null };

/**
 * El carrito: lo elegido con sus precios de hoy, cambiar cantidades o
 * quitar, el total estimado en dólares y en bolívares, y enviar el pedido
 * por WhatsApp con todo escrito. Enviarlo no registra nada: el negocio
 * contesta con la disponibilidad y el total.
 */
export function PaginaCarrito({ negocio, whatsapp }: { negocio: string; whatsapp: string | null }) {
  const lineas = useCarrito();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [fallo, setFallo] = useState(false);
  const [nombre, setNombre] = useState("");
  const [suNegocio, setSuNegocio] = useState("");
  const [nota, setNota] = useState("");
  const [vaciar, setVaciar] = useState(false);
  const claves = [...new Set(lineas.map((l) => l.clave))].sort().join(",");

  // Los nombres y los precios se piden cada vez: nunca se pide con un precio viejo.
  useEffect(() => {
    if (!claves) return;
    let vigente = true;
    fetch(`/api/carrito?claves=${encodeURIComponent(claves)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Datos) => {
        if (vigente) {
          setDatos(d);
          setFallo(false);
        }
      })
      .catch(() => vigente && setFallo(true));
    return () => {
      vigente = false;
    };
  }, [claves]);

  if (lineas.length === 0) {
    return (
      <div className={estilos.vacio}>
        <p>Tu carrito está vacío.</p>
        <Link href="/productos" className="boton boton--acento">
          Ver los productos
        </Link>
      </div>
    );
  }
  if (!datos) {
    return <p className={estilos.cargando}>{fallo ? "No se pudieron traer los precios. Revisa la conexión y vuelve a abrir el carrito." : "Cargando los precios de hoy…"}</p>;
  }

  const totales = totalesDelCarrito(lineas, datos.productos, datos.tasa);
  const mensaje = mensajeDePedido({ negocio, totales, tasa: datos.tasa, nombre, negocioDelCliente: suNegocio, nota });
  const enlace = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje)}` : null;
  const disponibles = totales.lineas.filter((l) => l.producto);
  const cambiar = (clave: string, unidad: string, cantidad: number) => guardarCarrito(ponerCantidad(lineas, clave, cantidad, unidad));

  return (
    <div className={estilos.pagina}>
      <ul className={estilos.lineas}>
        {totales.lineas.map((l) => {
          const p = l.producto;
          if (!p) {
            return (
              <li key={l.clave} className={`${estilos.linea} ${estilos.lineaApagada}`}>
                <div className={estilos.lineaTexto}>
                  <strong>Un producto que ya no está en la web</strong>
                  <span className={estilos.ayuda}>No entra en el pedido.</span>
                </div>
                <button type="button" className={estilos.quitar} onClick={() => cambiar(l.clave, "unidad", 0)}>
                  Quitar
                </button>
              </li>
            );
          }
          const paso = pasoDe(p.unidad);
          const subtotalBs = l.subtotal_usd !== null ? aBolivares(l.subtotal_usd, datos.tasa) : null;
          return (
            <li key={l.clave} className={estilos.linea}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.foto && <img src={p.foto} alt="" width={64} height={64} className={estilos.lineaFoto} />}
              <div className={estilos.lineaTexto}>
                <Link href={p.ruta}>
                  <strong>{p.nombre}</strong>
                </Link>
                <span className={estilos.ayuda}>{p.precio_usd !== null ? `${usd(p.precio_usd)} por ${p.porQue}` : "Precio por confirmar"}</span>
                <div className={estilos.cantidad} role="group" aria-label={`Cuánto de ${p.nombre}`}>
                  <button type="button" onClick={() => cambiar(l.clave, p.unidad, l.cantidad - paso)} aria-label="Menos">
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={paso}
                    step={paso}
                    defaultValue={l.cantidad}
                    key={l.cantidad}
                    onBlur={(e) => cambiar(l.clave, p.unidad, Number(e.target.value))}
                    aria-label={`Cantidad de ${p.nombre}`}
                  />
                  <button type="button" onClick={() => cambiar(l.clave, p.unidad, l.cantidad + paso)} aria-label="Más">
                    +
                  </button>
                  <span className={estilos.unidad}>{cuantoDe(l.cantidad, p).replace(/^[\d.,]+\s*×?\s*/, "")}</span>
                </div>
              </div>
              <div className={estilos.lineaPrecio}>
                {l.subtotal_usd !== null ? (
                  <span className={estilos.subtotal}>
                    <strong>{subtotalBs !== null ? bs(subtotalBs) : usd(l.subtotal_usd)}</strong>
                    {subtotalBs !== null && <span className={estilos.ayuda}>{usd(l.subtotal_usd)}</span>}
                  </span>
                ) : (
                  <span className={estilos.ayuda}>Por confirmar</span>
                )}
                <button type="button" className={estilos.quitar} onClick={() => cambiar(l.clave, p.unidad, 0)}>
                  Quitar
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <section className={estilos.resumen} aria-label="Total del pedido">
        <p className={estilos.total}>
          Total estimado: <strong>{totales.total_bs !== null ? bs(totales.total_bs) : usd(totales.total_usd)}</strong>
          {totales.total_bs !== null && <span> · {usd(totales.total_usd)}</span>}
        </p>
        {datos.tasa && <p className={estilos.ayuda}>Bolívares a la tasa BCV de hoy: {bs(datos.tasa)} por dólar.</p>}
        {totales.sinPrecio > 0 && (
          <p className={estilos.ayuda}>
            {totales.sinPrecio === 1 ? "Un producto tiene" : `${totales.sinPrecio} productos tienen`} el precio por confirmar: no entra en el total y te lo decimos al responder.
          </p>
        )}
        {totales.noDisponibles > 0 && <p className={estilos.ayuda}>Lo que ya no está en la web no entra en el pedido.</p>}

        <div className={estilos.quien}>
          <label>
            <span>Tu nombre (opcional)</span>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} autoComplete="name" />
          </label>
          <label>
            <span>Tu negocio (opcional)</span>
            <input type="text" value={suNegocio} onChange={(e) => setSuNegocio(e.target.value)} maxLength={60} autoComplete="organization" placeholder="Pizzería, hamburguesería…" />
          </label>
          <label className={estilos.nota}>
            <span>Nota (opcional)</span>
            <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder="Para el viernes · Lo busco en la tienda" />
          </label>
        </div>

        {enlace && disponibles.length > 0 ? (
          <a className={`boton ${estilos.enviar}`} href={enlace} target="_blank" rel="noopener">
            <IconoWhatsapp tamano={22} />
            Enviar pedido por WhatsApp
          </a>
        ) : (
          <p className={estilos.ayuda}>No hay ningún producto disponible para pedir.</p>
        )}
        <p className={estilos.ayuda}>
          Se abre WhatsApp con tu pedido escrito para que lo envíes. El pedido no queda hecho hasta que te respondamos con la disponibilidad y el total.
        </p>
        <div className={estilos.vaciar}>
          {vaciar ? (
            <>
              <span>¿Vaciar el carrito?</span>
              <button type="button" className={estilos.quitar} onClick={() => guardarCarrito([])}>
                Sí, vaciar
              </button>
              <button type="button" className={estilos.botonTexto} onClick={() => setVaciar(false)}>
                No
              </button>
            </>
          ) : (
            <button type="button" className={estilos.botonTexto} onClick={() => setVaciar(true)}>
              Vaciar el carrito
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
