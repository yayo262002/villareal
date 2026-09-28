import Link from "next/link";
import { enlaceWhatsapp, negocio } from "@/config/negocio";
import { listarProductos } from "@/lib/productos";
import { usd } from "@/lib/dinero";
import estilos from "./page.module.css";

/**
 * La web pública. Muestra lo que hay en la base y lo que está configurado
 * en `negocio.ts`; lo que falta (teléfono, dirección, precios) no se
 * inventa: se omite o se dice que está pendiente.
 */
export default function PaginaInicio() {
  const productos = listarProductos(true);
  const whatsapp = enlaceWhatsapp(`Hola, quiero información sobre sus quesos.`);
  const hayContacto = Boolean(whatsapp || negocio.direccion || negocio.ciudad);

  return (
    <>
      <header className={estilos.cabecera}>
        <div className={estilos.contenido}>
          <span className={estilos.logo}>{negocio.nombre}</span>
          <nav aria-label="Principal" className={estilos.nav}>
            <a href="#productos">Productos</a>
            <a href="#contacto">Contacto</a>
          </nav>
        </div>
      </header>

      <main>
        <section className={estilos.portada}>
          <div className={estilos.contenido}>
            <p className={estilos.etiqueta}>{negocio.lema}</p>
            <h1 className={estilos.titulo}>{negocio.nombre}</h1>
            <p className={estilos.subtitulo}>{negocio.descripcion}</p>
            <div className={estilos.acciones}>
              {whatsapp ? (
                <a className="boton boton--acento" href={whatsapp} target="_blank" rel="noopener">
                  Pedir por WhatsApp
                </a>
              ) : (
                <a className="boton boton--acento" href="#productos">
                  Ver productos
                </a>
              )}
              <a className="boton boton--secundario" href="#contacto">
                Cómo llegar
              </a>
            </div>
          </div>
        </section>

        <section id="productos" className={estilos.seccion}>
          <div className={estilos.contenido}>
            <h2 className={estilos.tituloSeccion}>Productos</h2>
            {productos.length === 0 ? (
              <p className="vacio">Todavía no hay productos publicados.</p>
            ) : (
              <ul className={estilos.productos}>
                {productos.map((p) => (
                  <li key={p.id} className={estilos.producto}>
                    <h3>{p.nombre}</h3>
                    {p.precio_usd === null ? (
                      <p className={estilos.precioPendiente}>Consulta el precio del día</p>
                    ) : (
                      <p className={estilos.precio}>
                        {usd(p.precio_usd)} <span>por {p.unidad}</span>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className={estilos.notaPrecios}>
              Los precios están en dólares y puedes pagar en bolívares a la tasa del día, por pago
              móvil, transferencia o efectivo.
            </p>
          </div>
        </section>

        <section id="contacto" className={`${estilos.seccion} ${estilos.seccionSuave}`}>
          <div className={estilos.contenido}>
            <h2 className={estilos.tituloSeccion}>Contacto</h2>
            {hayContacto ? (
              <dl className={estilos.contacto}>
                {whatsapp && (
                  <div>
                    <dt>WhatsApp</dt>
                    <dd>
                      <a href={whatsapp} target="_blank" rel="noopener">
                        Escríbenos
                      </a>
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
            ) : (
              <p className="vacio">Pronto publicaremos el teléfono y la dirección del local.</p>
            )}
          </div>
        </section>
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
