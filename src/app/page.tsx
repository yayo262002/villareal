import Link from "next/link";
import { enlaceWhatsapp, negocio, whatsappLegible } from "@/config/negocio";
import { listarProductos } from "@/lib/productos";
import { usd } from "@/lib/dinero";
import estilos from "./page.module.css";

/**
 * La web pública, pensada para abrirse en el teléfono desde un mensaje de
 * WhatsApp: el nombre, los productos con su precio y el botón para pedir,
 * sin nada antes. Lo que no está configurado (teléfono, precios) no se
 * inventa: se omite o se dice que está pendiente.
 */
export default async function PaginaInicio() {
  const productos = await listarProductos(true);
  const whatsapp = enlaceWhatsapp("Hola, quiero información sobre sus quesos.");
  const hayContacto = Boolean(
    whatsapp || negocio.correo || negocio.direccion || negocio.ciudad || negocio.horario,
  );

  return (
    <>
      <header className={estilos.cabecera}>
        <div className={estilos.contenido}>
          <div>
            <p className={estilos.logo}>{negocio.nombre}</p>
            <p className={estilos.lema}>{negocio.lema}</p>
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
          <h1 id="titulo-precios" className={estilos.titulo}>
            Precios de hoy
          </h1>
          {productos.length === 0 ? (
            <p className="vacio">Todavía no hay productos publicados.</p>
          ) : (
            <ul className={estilos.productos}>
              {productos.map((p) => (
                <li key={p.id} className={estilos.producto}>
                  <span className={estilos.nombre}>{p.nombre}</span>
                  {p.precio_usd === null ? (
                    <span className={estilos.precioPendiente}>Consulta el precio del día</span>
                  ) : (
                    <span className={estilos.precio}>
                      {usd(p.precio_usd)} <small>/ {p.unidad}</small>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className={estilos.notaPrecios}>
            Precios en dólares. Puedes pagar en bolívares a la tasa del día por pago móvil,
            transferencia o efectivo.
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
