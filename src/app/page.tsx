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
                // Los precios que tiene el producto. Con uno solo no hace falta decir cuál es.
                const precios = [
                  { nombre: "Al detal", usd: p.precio_usd },
                  { nombre: "Al mayor", usd: p.precio_mayor_usd },
                ].filter((x): x is { nombre: string; usd: number } => x.usd !== null);
                const ventajas = (p.descripcion ?? "").split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
                const pedir = enlaceWhatsapp(`Hola, quiero pedir ${p.nombre.toLowerCase()}.`);
                return (
                  <li key={p.id} className={estilos.producto}>
                    <h2 className={estilos.nombre}>{p.nombre}</h2>
                    {precios.length === 0 ? (
                      <p className={estilos.precioPendiente}>Consulta el precio del día</p>
                    ) : (
                      <dl className={`${estilos.precios} ${precios.length === 1 ? estilos.preciosUno : ""}`}>
                        {precios.map((precio) => {
                          const enBs = aBolivares(precio.usd, tasa?.valor ?? null);
                          return (
                            <div
                              key={precio.nombre}
                              className={`${estilos.precioCaja} ${precio.nombre === "Al mayor" ? estilos.precioCajaMayor : ""}`}
                            >
                              <dt>{precios.length === 1 ? "Precio" : precio.nombre}</dt>
                              <dd className={estilos.precio}>{enBs !== null ? bs(enBs) : usd(precio.usd)}</dd>
                              <dd className={estilos.precioUsd}>
                                {enBs !== null ? `${usd(precio.usd)} ` : ""}por {nombreUnidad(p.unidad)}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    )}
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
            {productos.some((p) => p.precio_mayor_usd !== null) &&
              " Para comprar al mayor, consulta las condiciones por WhatsApp."}
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
