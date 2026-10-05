import Link from "next/link";
import type { Metadata } from "next";
import { enlaceMapa, enlaceWhatsapp, negocio, whatsappLegible } from "@/config/negocio";
import { listarProductos } from "@/lib/productos";
import { agruparPorProducto, listarVariantes } from "@/lib/variantes";
import { precioPublicado } from "@/lib/catalogo";
import { leerTasa } from "@/lib/ajustes";
import { rutaProducto } from "@/lib/enlaces";
import {
  CabeceraPublica,
  DatosEstructurados,
  LineaTasa,
  PiePublico,
  PreciosProducto,
  datosDeLaTienda,
} from "@/components/publico";
import { IlustracionProducto } from "@/components/ilustracion-producto";
import estilos from "./page.module.css";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * La web pública, pensada para abrirse en el teléfono desde un mensaje de
 * WhatsApp: los productos con su dibujo y su precio al mayor en bolívares,
 * y nada antes. Sin marcas: las marcas, los detalles y las reseñas de cada
 * uno están en su propia página, no aquí. Lo que no está
 * configurado (tasa, precios) no se inventa: se omite o se dice que está
 * pendiente.
 */
export default async function PaginaInicio() {
  const [productos, variantes, tasa] = await Promise.all([listarProductos(true), listarVariantes(), leerTasa()]);
  const variantesDe = agruparPorProducto(variantes);
  const whatsapp = enlaceWhatsapp("Hola, quiero información sobre sus productos.");
  const mayor = enlaceWhatsapp("Hola, tengo un negocio y quiero precio al mayor.");
  const mapa = enlaceMapa();
  const hayContacto = Boolean(
    whatsapp || negocio.correo || negocio.direccion || negocio.ciudad || negocio.horario,
  );

  return (
    <>
      <DatosEstructurados datos={{ "@context": "https://schema.org", ...datosDeLaTienda() }} />
      <CabeceraPublica />

      <main id="contenido" className={estilos.contenido}>
        <section className={estilos.seccion} aria-labelledby="titulo-precios">
          <div className={estilos.encabezadoPrecios}>
            <h1 id="titulo-precios" className={estilos.titulo}>
              Precios de hoy
            </h1>
            <LineaTasa tasa={tasa} className={estilos.tasa} />
          </div>
          <p className={estilos.entradilla}>
            Insumos al mayor para pizzerías, panaderías, hamburgueserías, restaurantes y bodegas, en el centro de {negocio.localidad}.
          </p>

          {productos.length === 0 ? (
            <p className="vacio">Todavía no hay productos publicados.</p>
          ) : (
            <ul className={estilos.productos}>
              {productos.map((p) => {
                const ruta = rutaProducto(p);
                const pedir = enlaceWhatsapp(`Hola, quiero pedir ${p.nombre.toLowerCase()}.`);
                // Con varias marcas, la tarjeta dice «desde» la más barata y cuántas hay.
                const publicado = precioPublicado(p, variantesDe.get(p.id) ?? []);
                return (
                  <li key={p.id} className={estilos.producto}>
                    <Link href={ruta} className={estilos.productoCabecera}>
                      <IlustracionProducto nombre={p.nombre} className={estilos.dibujo} />
                      <span>
                        <h2 className={estilos.nombre}>{p.nombre}</h2>
                        {publicado.variantes >= 2 && <span className={estilos.marcas}>{`${publicado.variantes} marcas o presentaciones`}</span>}
                      </span>
                    </Link>
                    <PreciosProducto producto={{ ...publicado, unidad: p.unidad }} tasa={tasa?.valor ?? null} desde={publicado.desde} />
                    {publicado.variantes >= 2 ? (
                      // Con varias marcas no se pide a ciegas: primero se ven las opciones con su precio, y se pide desde la elegida.
                      <div className={`${estilos.acciones} ${estilos.accionesUna}`}>
                        <Link href={`${ruta}#marcas`} className="boton">
                          {`Ver las ${publicado.variantes} opciones y pedir`}
                        </Link>
                      </div>
                    ) : (
                      <div className={estilos.acciones}>
                        <Link href={ruta} className="boton boton--secundario">
                          Ver detalles
                        </Link>
                        {pedir && (
                          <a className="boton" href={pedir} target="_blank" rel="noopener">
                            Pedir
                          </a>
                        )}
                      </div>
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

        {mayor && (
          <section className={estilos.seccion} aria-labelledby="titulo-mayor">
            <div className={estilos.mayor}>
              <h2 id="titulo-mayor" className={estilos.mayorTitulo}>
                ¿Tienes pizzería, panadería o restaurante?
              </h2>
              <p>Vendemos solo al mayor. Escríbenos y te pasamos el precio según la cantidad que necesites.</p>
              <a className="boton boton--acento" href={mayor} target="_blank" rel="noopener">
                Pedir precio al mayor
              </a>
            </div>
          </section>
        )}

        {hayContacto && (
          <section className={estilos.seccion} aria-labelledby="titulo-contacto">
            <h2 id="titulo-contacto" className={estilos.subtitulo}>
              Dónde estamos
            </h2>
            <dl className={estilos.contacto}>
              {(negocio.direccion || negocio.ciudad) && (
                <div>
                  <dt>Tienda física</dt>
                  <dd>{[negocio.direccion, negocio.ciudad].filter(Boolean).join(", ")}</dd>
                </div>
              )}
              {negocio.horario && (
                <div>
                  <dt>Horario</dt>
                  <dd>{negocio.horario}</dd>
                </div>
              )}
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
            </dl>
            {mapa && (
              <a className={`boton boton--secundario ${estilos.botonMapa}`} href={mapa} target="_blank" rel="noopener">
                Cómo llegar
              </a>
            )}
          </section>
        )}
      </main>

      <PiePublico />
    </>
  );
}
