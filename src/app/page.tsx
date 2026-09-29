import Link from "next/link";
import { enlaceWhatsapp, negocio, whatsappLegible } from "@/config/negocio";
import { listarProductos } from "@/lib/productos";
import { leerTasa } from "@/lib/ajustes";
import { aBolivares, bs, fechaCorta, nombreUnidad, usd } from "@/lib/dinero";
import estilos from "./page.module.css";

/**
 * La web pública, pensada para abrirse en el teléfono desde un mensaje de
 * WhatsApp: el nombre, los productos con su precio en bolívares y el botón
 * para pedir, sin nada antes. Lo que no está configurado (tasa, precios) no
 * se inventa: se omite o se dice que está pendiente.
 */
export default async function PaginaInicio() {
  const [productos, tasa] = await Promise.all([listarProductos(true), leerTasa()]);
  const whatsapp = enlaceWhatsapp("Hola, quiero información sobre sus productos.");
  const hayContacto = Boolean(
    whatsapp || negocio.correo || negocio.direccion || negocio.ciudad || negocio.horario,
  );

  return (
    <>
      <header className={estilos.cabecera}>
        <div className={estilos.contenido}>
          <div className={estilos.marca}>
            {/* El león coronado de la marca. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca/leon.svg" alt="" className={estilos.leon} />
            <div>
              <p className={estilos.logo}>{negocio.nombre}</p>
              <p className={estilos.lema}>{negocio.lema}</p>
            </div>
          </div>
          {whatsapp && (
            <a className="boton boton--acento" href={whatsapp} target="_blank" rel="noopener">
              WhatsApp
            </a>
          )}
        </div>
      </header>

      <main className={estilos.contenido}>
        <section className={estilos.seccion} aria-labelledby="titulo-precios">
          <div className={estilos.encabezadoPrecios}>
            <h1 id="titulo-precios" className={estilos.titulo}>
              Precios de hoy
            </h1>
            {tasa && (
              <p className={estilos.tasa}>
                Tasa: {bs(tasa.valor)} por dólar · {fechaCorta(tasa.actualizada_en)}
              </p>
            )}
          </div>

          {productos.length === 0 ? (
            <p className="vacio">Todavía no hay productos publicados.</p>
          ) : (
            <ul className={estilos.productos}>
              {productos.map((p) => {
                const enBs = p.precio_usd !== null ? aBolivares(p.precio_usd, tasa?.valor ?? null) : null;
                const ventajas = (p.descripcion ?? "").split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
                const pedir = enlaceWhatsapp(`Hola, quiero pedir ${p.nombre.toLowerCase()}.`);
                return (
                  <li key={p.id} className={estilos.producto}>
                    <div className={estilos.productoCabecera}>
                      <h2 className={estilos.nombre}>{p.nombre}</h2>
                      <div className={estilos.precioBloque}>
                        {p.precio_usd === null ? (
                          <span className={estilos.precioPendiente}>Consulta el precio del día</span>
                        ) : enBs !== null ? (
                          <>
                            <span className={estilos.precio}>
                              {bs(enBs)} <small>/ {nombreUnidad(p.unidad)}</small>
                            </span>
                            <span className={estilos.precioUsd}>{usd(p.precio_usd)}</span>
                          </>
                        ) : (
                          <span className={estilos.precio}>
                            {usd(p.precio_usd)} <small>/ {nombreUnidad(p.unidad)}</small>
                          </span>
                        )}
                      </div>
                    </div>
                    {ventajas.length > 0 && (
                      <ul className={estilos.ventajas}>
                        {ventajas.map((v) => (
                          <li key={v}>{v}</li>
                        ))}
                      </ul>
                    )}
                    {pedir && (
                      <a className={estilos.pedir} href={pedir} target="_blank" rel="noopener">
                        Pedir {p.nombre.toLowerCase()} por WhatsApp
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className={estilos.notaPrecios}>
            {tasa
              ? "Precios en bolívares a la tasa del día. También puedes pagar en dólares, Zelle o Binance."
              : "Precios en dólares. Puedes pagar en bolívares a la tasa del día por pago móvil, transferencia o efectivo."}
          </p>
          {whatsapp && (
            <a className={`boton boton--acento ${estilos.botonGrande}`} href={whatsapp} target="_blank" rel="noopener">
              Pedir por WhatsApp
            </a>
          )}
        </section>

        {hayContacto && (
          <section className={estilos.seccion} aria-labelledby="titulo-contacto">
            <h2 id="titulo-contacto" className={estilos.subtitulo}>
              Dónde estamos
            </h2>
            <dl className={estilos.contacto}>
              {whatsapp && (
                <div>
                  <dt>WhatsApp</dt>
                  <dd>
                    <a href={whatsapp} target="_blank" rel="noopener">
                      {whatsappLegible()}
                    </a>
                  </dd>
                </div>
              )}
              {negocio.correo && (
                <div>
                  <dt>Correo</dt>
                  <dd>
                    <a href={`mailto:${negocio.correo}`}>{negocio.correo}</a>
                  </dd>
                </div>
              )}
              {(negocio.direccion || negocio.ciudad) && (
                <div>
                  <dt>Dirección</dt>
                  <dd>{[negocio.direccion, negocio.ciudad].filter(Boolean).join(", ")}</dd>
                </div>
              )}
              {negocio.horario && (
                <div>
                  <dt>Horario</dt>
                  <dd>{negocio.horario}</dd>
                </div>
              )}
            </dl>
          </section>
        )}
      </main>

      <footer className={estilos.pie}>
        <div className={estilos.contenido}>
          <p>
            {negocio.razonSocial || negocio.nombre}
            {negocio.rif && ` · RIF ${negocio.rif}`}
          </p>
          <Link href="/admin">Panel</Link>
        </div>
      </footer>
    </>
  );
}
