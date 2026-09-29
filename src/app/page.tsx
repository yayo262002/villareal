import Link from "next/link";
import { enlaceWhatsapp, negocio, whatsappLegible } from "@/config/negocio";
import { listarProductos } from "@/lib/productos";
import { leerTasa } from "@/lib/ajustes";
import { bs, fechaCorta } from "@/lib/dinero";
import { rutaProducto } from "@/lib/enlaces";
import { CabeceraPublica, PiePublico, PreciosProducto } from "@/components/publico";
import { IlustracionProducto } from "@/components/ilustracion-producto";
import estilos from "./page.module.css";

/**
 * La web pública, pensada para abrirse en el teléfono desde un mensaje de
 * WhatsApp: los productos con su dibujo y su precio en bolívares, y nada
 * antes. Los detalles de cada uno están en su propia página. Lo que no está
 * configurado (tasa, precios) no se inventa: se omite o se dice que está
 * pendiente.
 */
export default async function PaginaInicio() {
  const [productos, tasa] = await Promise.all([listarProductos(true), leerTasa()]);
  const whatsapp = enlaceWhatsapp("Hola, quiero información sobre sus productos.");
  const hayContacto = Boolean(
    whatsapp || negocio.correo || negocio.direccion || negocio.ciudad || negocio.horario,
  );

  return (
    <>
      <CabeceraPublica />

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
                const ruta = rutaProducto(p);
                const pedir = enlaceWhatsapp(`Hola, quiero pedir ${p.nombre.toLowerCase()}.`);
                return (
                  <li key={p.id} className={estilos.producto}>
                    <Link href={ruta} className={estilos.productoCabecera}>
                      <IlustracionProducto nombre={p.nombre} className={estilos.dibujo} />
                      <h2 className={estilos.nombre}>{p.nombre}</h2>
                    </Link>
                    <PreciosProducto producto={p} tasa={tasa?.valor ?? null} />
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

      <PiePublico />
    </>
  );
}
