import Link from "next/link";
import { negocio } from "@/config/negocio";
import { listarClientes } from "@/lib/clientes";
import { enlaceAlMapa, planDeDespacho } from "@/lib/despacho";
import { describirUbicacion, explicarMotivo } from "@/lib/direcciones";
import { distanciaLegible } from "@/lib/ruta";
import { redondear, usd } from "@/lib/dinero";
import { enlaceWhatsappA } from "@/lib/whatsapp";
import { BotonImprimir } from "@/components/boton-imprimir";
import type { ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Ruta de despacho" };

const CIUDAD = `${negocio.localidad}, ${negocio.estado}, Venezuela`;

/**
 * La ruta de despacho: se eligen los clientes del día y sale el orden en
 * que conviene visitarlos, saliendo de la tienda y volviendo a ella. La
 * selección viaja en la dirección de la página (`?c=3&c=8`), así la ruta
 * se puede guardar en favoritos o mandar a quien reparte.
 */
export default async function PaginaDespacho({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const elegidos = new Set(
    (Array.isArray(parametros.c) ? parametros.c : parametros.c ? [parametros.c] : []).map(Number).filter((n) => n > 0),
  );
  const soloDeudores = parametros.solo === "deben";

  const todos = await listarClientes();
  const delDia = todos.filter((c) => (elegidos.size > 0 ? elegidos.has(c.id) : soloDeudores ? c.saldo_usd > 0 : true));
  const plan = planDeDespacho({ direccion: negocio.direccion, ciudad: CIUDAD }, delDia);
  const porCobrar = redondear(delDia.reduce((s, c) => s + Math.max(0, c.saldo_usd), 0));

  // En la lista para elegir, los clientes van en el orden de la ruta completa: los vecinos quedan juntos.
  const planCompleto = planDeDespacho({ direccion: negocio.direccion, ciudad: CIUDAD }, todos);
  const paraElegir = [...planCompleto.ruta.paradas.map((p) => p.dato), ...planCompleto.sinUbicar.map((s) => s.cliente)];

  const titulo =
    elegidos.size > 0 ? "Los clientes elegidos" : soloDeudores ? "Los clientes que deben" : "Todos los clientes";

  return (
    <>
      <div className={estilos.encabezado}>
        <div>
          <p className={estilos.noImprimir}>
            <Link href="/admin/clientes">← Cartera de clientes</Link>
          </p>
          <h1 className={estilos.titulo}>Ruta de despacho</h1>
        </div>
        {plan.ruta.paradas.length > 0 && (
          <BotonImprimir className={`boton boton--secundario ${estilos.noImprimir}`}>Imprimir la ruta</BotonImprimir>
        )}
      </div>

      {!plan.tienda && (
        <p className="aviso aviso--error">
          La dirección de la tienda no se pudo situar. Tiene que decir la calle y la carrera, como «Calle 38 entre
          carreras 30 y 31». Está en <code>src/config/negocio.ts</code>.
        </p>
      )}

      {todos.length === 0 ? (
        <section className="tarjeta">
          <p className="vacio">
            Todavía no hay clientes. <Link href="/admin/clientes">Registra el primero</Link> con su teléfono y su
            dirección.
          </p>
        </section>
      ) : (
        <>
          <section className="tarjeta">
            <h2 className={estilos.subtitulo}>
              {titulo}: {plan.ruta.paradas.length} {plan.ruta.paradas.length === 1 ? "parada" : "paradas"}
            </h2>
            {plan.ruta.paradas.length === 0 ? (
              <p className="vacio">
                Ninguno de estos clientes tiene una dirección con calle y carrera. Están más abajo, con lo que le falta
                a cada uno.
              </p>
            ) : (
              <>
                <p className={estilos.ayuda}>
                  Sales de la tienda ({plan.tienda && describirUbicacion(plan.tienda)}), pasas por todos y vuelves:{" "}
                  <strong>{distanciaLegible(plan.ruta.cuadras)}</strong>.
                  {porCobrar > 0 && (
                    <>
                      {" "}
                      Por cobrar en esta ruta: <strong>{usd(porCobrar)}</strong>.
                    </>
                  )}
                </p>
                <div className={`${estilos.accionesFila} ${estilos.noImprimir}`} style={{ flexWrap: "wrap", marginBottom: "var(--espacio-4)" }}>
                  {plan.enlaces.map((tramo) => (
                    <a key={tramo.desde} href={tramo.enlace} target="_blank" rel="noopener" className="boton">
                      {plan.enlaces.length === 1
                        ? "Abrir la ruta en Google Maps"
                        : `Google Maps: paradas ${tramo.desde} a ${tramo.hasta}`}
                    </a>
                  ))}
                </div>

                <ol className={estilos.ruta}>
                  {plan.ruta.paradas.map((parada, i) => {
                    const c = parada.dato;
                    const whatsapp = enlaceWhatsappA(c.telefono, `Hola, le saluda ${negocio.nombre}. Vamos en camino con su pedido.`);
                    const mapa = enlaceAlMapa(c.direccion, CIUDAD);
                    return (
                      <li key={c.id} className={estilos.parada}>
                        <span className={estilos.paradaNumero}>{i + 1}</span>
                        <div className={estilos.paradaDatos}>
                          <div className={estilos.carteraCabecera}>
                            <Link href={`/admin/clientes/${c.id}`} className={estilos.carteraNombre}>
                              {c.nombre}
                            </Link>
                            {c.saldo_usd > 0 && <span className={estilos.deuda}>Debe {usd(c.saldo_usd)}</span>}
                          </div>
                          <p className={estilos.carteraDato}>{c.direccion}</p>
                          <p className={estilos.carteraDato}>
                            {c.telefono && c.telefono !== c.nombre ? `${c.telefono} · ` : ""}
                            {parada.cuadrasDesdeLaAnterior === 0
                              ? "en el mismo sitio que la anterior"
                              : `a ${distanciaLegible(parada.cuadrasDesdeLaAnterior)} de ${i === 0 ? "la tienda" : "la anterior"}`}
                            {c.nota ? ` · ${c.nota}` : ""}
                          </p>
                          <div className={`${estilos.carteraAcciones} ${estilos.noImprimir}`}>
                            <Link href={`/admin/ventas?cliente=${c.id}`}>Venta</Link>
                            <Link href={`/admin/clientes/${c.id}#abono`}>Abono</Link>
                            {whatsapp && (
                              <a href={whatsapp} target="_blank" rel="noopener" className={estilos.whatsapp}>
                                Avisar
                              </a>
                            )}
                            {mapa && (
                              <a href={mapa} target="_blank" rel="noopener">
                                Mapa
                              </a>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  <li className={`${estilos.parada} ${estilos.paradaFinal}`}>
                    <span className={estilos.paradaNumero}>✓</span>
                    <div className={estilos.paradaDatos}>
                      <strong>Vuelta a la tienda</strong>
                      <p className={estilos.carteraDato}>a {distanciaLegible(plan.ruta.cuadrasDeVuelta)} de la última parada</p>
                    </div>
                  </li>
                </ol>
                <p className={estilos.ayuda} style={{ marginTop: "var(--espacio-4)", marginBottom: 0 }}>
                  El orden sale de contar cuadras entre calles y carreras. No sabe del sentido de las calles ni del
                  tráfico: para eso, abre la ruta en Google Maps.
                </p>
              </>
            )}
          </section>

          {plan.sinUbicar.length > 0 && (
            <section className="tarjeta">
              <h2 className={estilos.subtitulo}>Fuera de la ruta ({plan.sinUbicar.length})</h2>
              <p className={estilos.ayuda}>
                A estos no se les pudo situar. Escribe en su ficha la calle y la carrera, como «Carrera 19 con calle
                25», y entrarán en la ruta.
              </p>
              <ul className={estilos.cartera}>
                {plan.sinUbicar.map(({ cliente: c, motivo }) => {
                  const mapa = enlaceAlMapa(c.direccion, CIUDAD);
                  return (
                    <li key={c.id} className={estilos.carteraCliente}>
                      <div className={estilos.carteraCabecera}>
                        <Link href={`/admin/clientes/${c.id}`} className={estilos.carteraNombre}>
                          {c.nombre}
                        </Link>
                        {c.saldo_usd > 0 && <span className={estilos.deuda}>Debe {usd(c.saldo_usd)}</span>}
                      </div>
                      <p className={estilos.carteraDato}>{c.direccion || "Sin dirección"}</p>
                      <p className={estilos.carteraDato}>
                        <span className="ayuda">{explicarMotivo(motivo)}</span>
                      </p>
                      <div className={`${estilos.carteraAcciones} ${estilos.noImprimir}`}>
                        <Link href={`/admin/clientes/${c.id}#datos`}>Corregir la dirección</Link>
                        {mapa && (
                          <a href={mapa} target="_blank" rel="noopener">
                            Buscar en el mapa
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className={`tarjeta ${estilos.noImprimir}`}>
            <h2 className={estilos.subtitulo}>¿A quién le despachas hoy?</h2>
            <p className={estilos.ayuda}>
              Marca los clientes del día y pulsa el botón. Van en el orden de la ruta, así los vecinos quedan juntos.
            </p>
            <div className={estilos.accionesFila} style={{ flexWrap: "wrap", marginBottom: "var(--espacio-4)" }}>
              <Link href="/admin/despacho" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                Todos
              </Link>
              <Link href="/admin/despacho?solo=deben" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                Solo los que deben
              </Link>
            </div>
            <form method="get" action="/admin/despacho" className="formulario">
              <ul className={estilos.eleccion}>
                {paraElegir.map((c) => (
                  <li key={c.id}>
                    <label>
                      <input type="checkbox" name="c" value={c.id} defaultChecked={elegidos.has(c.id)} />
                      <span>
                        <strong>{c.nombre}</strong>
                        <span className="ayuda"> {c.direccion || "sin dirección"}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div>
                <button type="submit" className="boton">
                  Hacer la ruta
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </>
  );
}
