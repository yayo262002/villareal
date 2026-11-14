import Link from "next/link";
import { negocio } from "@/config/negocio";
import { claveDelBanco, tasaEnFecha, ultimoContactoDelBanco, type ContactoDelBanco } from "@/lib/ajustes";
import { avisosDePagoPendientes, clientesParaElegir, listarMovimientos, pagadoresDeLaCasa, sugerenciasPara, type MovimientoBanco } from "@/lib/banco";
import { COMO_SE_SUPO } from "@/lib/banco-calculo";
import {
  abonarPagoDelBanco,
  crearClaveDelTelefonoDelBanco,
  deshacerPagoDelBanco,
  marcarPagoDeLaCasa,
  marcarPagoDelBanco,
  olvidarPagadorDeLaCasa,
  pegarAvisoDelBanco,
  quitarAvisoDePagoDelCliente,
} from "@/lib/acciones";
import { bs, fechaCorta, fechaDeLaBase, horaDeLaBase, redondear, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { BotonCopiar } from "@/components/boton-copiar";
import estilos from "../panel.module.css";
import propios from "./banco.module.css";

export const metadata = { title: "Pago móvil" };

/** «hace 5 minutos», «hace 3 horas», «el 12/11 a las 08:30». */
function cuandoFue(contacto: ContactoDelBanco): string {
  const minutos = Math.round((Date.now() - new Date(contacto.momento).getTime()) / 60000);
  if (minutos < 1) return "hace un momento";
  if (minutos < 60) return `hace ${minutos} ${minutos === 1 ? "minuto" : "minutos"}`;
  if (minutos < 24 * 60) {
    const horas = Math.round(minutos / 60);
    return `hace ${horas} ${horas === 1 ? "hora" : "horas"}`;
  }
  return `el ${fechaCorta(fechaDeLaBase(contacto.momento))} a las ${horaDeLaBase(contacto.momento)}`;
}

/** De quién dice el banco que es: su nombre, su teléfono, o nada. */
function quienPago(m: MovimientoBanco): string {
  return [m.titular, m.telefono].filter(Boolean).join(" · ") || "El banco no dice de quién";
}

/**
 * El pago móvil que entra al banco: lo que el teléfono del negocio reenvía
 * del BDVapp se abona solo a su cliente (por su teléfono, porque ya pagó
 * antes desde ahí, porque lo avisó desde su enlace o porque ya estaba
 * anotado). Lo que no se sabe de quién es espera arriba, con lo que se le
 * parece, para elegirlo de un toque; lo abonado se puede deshacer. Abajo,
 * pegar un aviso a mano (si el teléfono falla) y cómo se configura el
 * teléfono. La lógica, en `src/lib/banco.ts`.
 */
export default async function PaginaBanco({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const [porIdentificar, aplicados, noEran, descartados, avisos, clientes, clave, contacto, deLaCasa] = await Promise.all([
    listarMovimientos("por_conciliar"),
    listarMovimientos("aplicado", 40),
    listarMovimientos("no_es_abono", 20),
    listarMovimientos("descartado", 20),
    avisosDePagoPendientes(),
    clientesParaElegir(),
    claveDelBanco(),
    ultimoContactoDelBanco(),
    pagadoresDeLaCasa(),
  ]);
  const sugerencias = await sugerenciasPara(porIdentificar);
  const tasas = new Map(await Promise.all(porIdentificar.map(async (m) => [m.id, await tasaEnFecha(m.fecha)] as const)));
  const direccion = clave ? `${negocio.web}/api/banco?clave=${clave}` : null;

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 className={estilos.titulo}>Pago móvil</h1>
      </div>
      <Avisos parametros={parametros} />

      <p className={propios.estadoTelefono}>
        {!clave ? (
          <>
            El teléfono del banco todavía no está conectado. <a href="#telefono">Configúralo abajo</a>.
          </>
        ) : !contacto ? (
          <>
            El teléfono del banco todavía no ha mandado nada. <a href="#telefono">Cómo se configura</a>.
          </>
        ) : (
          <>
            Lo último que mandó el teléfono del banco llegó <strong>{cuandoFue(contacto)}</strong>
            {contacto.era_un_pago ? " (un pago)." : " (no era un pago recibido)."}
          </>
        )}
      </p>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>
          {porIdentificar.length === 0 ? "Nada por identificar" : porIdentificar.length === 1 ? "1 pago por identificar" : `${porIdentificar.length} pagos por identificar`}
        </h2>
        {porIdentificar.length === 0 ? (
          <p className="vacio">Todos los pagos que entraron al banco ya están abonados a su cliente.</p>
        ) : (
          <>
            <p className="ayuda">
              Entraron al banco y no se sabe de quién son. Elige el cliente y se le abona con la tasa del día del pago; la próxima vez que pague desde ese
              teléfono (o con ese nombre en el banco), entrará solo.
            </p>
            <ul className={propios.pagos}>
              {porIdentificar.map((m) => {
                const tasa = tasas.get(m.id);
                const propuestas = sugerencias.get(m.id) ?? [];
                return (
                  <li key={m.id} id={`pago-${m.id}`} className={propios.pago}>
                    <div className={propios.pagoCabecera}>
                      <span className={propios.pagoMonto}>{bs(m.monto_bs)}</span>
                      {tasa && <span className={propios.pagoUsd}>≈ {usd(redondear(m.monto_bs / tasa.valor))}</span>}
                    </div>
                    <p className={propios.pagoDatos}>
                      <strong>{quienPago(m)}</strong>
                      <br />
                      {fechaCorta(m.fecha)}
                      {m.hora ? ` a las ${m.hora}` : ""}
                      {m.referencia ? ` · Ref. ${m.referencia}` : ""}
                      {m.origen === "a_mano" ? " · pegado a mano" : ""}
                    </p>
                    {propuestas.length > 0 && (
                      <div className={propios.propuestas}>
                        {propuestas.map((p) => (
                          <form key={p.cliente_id} action={abonarPagoDelBanco}>
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="cliente_id" value={p.cliente_id} />
                            <button type="submit" className="boton">
                              Es de {p.nombre}
                            </button>
                            <span className="ayuda"> {p.motivo}</span>
                          </form>
                        ))}
                      </div>
                    )}
                    <form action={abonarPagoDelBanco} className={propios.elegir}>
                      <input type="hidden" name="id" value={m.id} />
                      <div className="campo">
                        <label htmlFor={`cliente-${m.id}`}>{propuestas.length > 0 ? "¿Es de otro cliente?" : "¿De quién es?"}</label>
                        <select id={`cliente-${m.id}`} name="cliente_id" defaultValue="" required>
                          <option value="" disabled>
                            Elige el cliente
                          </option>
                          {clientes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.rotulo}
                              {c.saldo_usd > 0 ? ` — debe ${usd(c.saldo_usd)}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button type="submit" className="boton boton--secundario">
                        Abonar
                      </button>
                    </form>
                    <div className={propios.otrasAcciones}>
                      <form action={marcarPagoDelBanco}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="estado" value="no_es_abono" />
                        <button type="submit" className={estilos.botonEnlace}>
                          No es de un cliente
                        </button>
                      </form>
                      {(m.titular || m.telefono) && (
                        <form action={marcarPagoDeLaCasa}>
                          <input type="hidden" name="id" value={m.id} />
                          <button type="submit" className={estilos.botonEnlace} title="Es de la familia: este y los siguientes de quien lo hizo se apartan solos">
                            Es de la casa (siempre)
                          </button>
                        </form>
                      )}
                      <form action={marcarPagoDelBanco}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="estado" value="descartado" />
                        <button type="submit" className={estilos.botonEnlace}>
                          Descartar (repetido o de prueba)
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {avisos.length > 0 && (
        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Clientes que avisaron que pagaron</h2>
          <p className="ayuda">Lo avisaron desde su enlace de cuenta («Ya pagué») y el pago aún no ha llegado al banco. Cuando llegue, se les abona solo.</p>
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Avisó</th>
                  <th>Cliente</th>
                  <th className="numero">Monto</th>
                  <th>Referencia</th>
                  <th>
                    <span className="visualmente-oculto">Quitar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {avisos.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Avisó">{fechaCorta(fechaDeLaBase(a.creado_en))}</td>
                    <td data-label="Cliente">
                      <Link href={`/admin/clientes/${a.cliente_id}`}>{a.cliente_nombre}</Link>
                    </td>
                    <td data-label="Monto" className="numero">
                      {bs(Number(a.monto_bs))}
                    </td>
                    <td data-label="Referencia">{a.referencia}</td>
                    <td data-label="">
                      <form action={quitarAvisoDePagoDelCliente}>
                        <input type="hidden" name="id" value={a.id} />
                        <button type="submit" className={estilos.botonEnlace}>
                          Quitar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Abonados</h2>
        {aplicados.length === 0 ? (
          <p className="vacio">Todavía no ha entrado ningún pago del banco.</p>
        ) : (
          <>
            <p className="ayuda">
              Cada pago que entró y a quién se le abonó. Si alguno no es de ese cliente, «Deshacer» le quita el abono y el pago vuelve arriba.
            </p>
            <div className="tabla-envoltorio">
              <table className="tabla tabla--fichas">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="numero">Monto</th>
                    <th>Cliente</th>
                    <th>Cómo se supo</th>
                    <th>Del banco</th>
                    <th>
                      <span className="visualmente-oculto">Deshacer</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {aplicados.map((m) => (
                    <tr key={m.id} id={`pago-${m.id}`}>
                      <td data-label="Fecha">
                        {fechaCorta(m.fecha)}
                        {m.hora ? ` ${m.hora}` : ""}
                      </td>
                      <td data-label="Monto" className="numero">
                        {bs(m.monto_bs)}
                        {m.monto_usd !== null && <span className="ayuda"> {usd(Number(m.monto_usd))}</span>}
                      </td>
                      <td data-label="Cliente">{m.cliente_id ? <Link href={`/admin/clientes/${m.cliente_id}`}>{m.cliente_nombre}</Link> : "—"}</td>
                      <td data-label="Cómo se supo">{m.como && m.como !== "de_la_casa" ? COMO_SE_SUPO[m.como] : "—"}</td>
                      <td data-label="Del banco">
                        {quienPago(m)}
                        {m.referencia ? ` · Ref. ${m.referencia}` : ""}
                      </td>
                      <td data-label="">
                        <form action={deshacerPagoDelBanco}>
                          <input type="hidden" name="id" value={m.id} />
                          <button type="submit" className={estilos.botonEnlace}>
                            Deshacer
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {deLaCasa.length > 0 && (
        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Pagan de la casa</h2>
          <p className="ayuda">Sus pagos no son abonos de clientes: se apartan solos, sin avisarte.</p>
          <ul className={propios.apartados}>
            {deLaCasa.map((p) => (
              <li key={p.clave}>
                <span>{p.quien}</span>
                <form action={olvidarPagadorDeLaCasa}>
                  <input type="hidden" name="clave" value={p.clave} />
                  <button type="submit" className={estilos.botonEnlace}>
                    Quitar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {noEran.length + descartados.length > 0 && (
        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>No eran abonos</h2>
          <ul className={propios.apartados}>
            {[...noEran, ...descartados].map((m) => (
              <li key={m.id}>
                <span>
                  {fechaCorta(m.fecha)} · <strong>{bs(m.monto_bs)}</strong> · {quienPago(m)}
                  {m.referencia ? ` · Ref. ${m.referencia}` : ""} · {m.como === "de_la_casa" ? "de la casa" : m.estado === "no_es_abono" ? "no es de un cliente" : "descartado"}
                </span>
                {m.estado === "no_es_abono" && m.como !== "de_la_casa" && (m.titular || m.telefono) && (
                  <form action={marcarPagoDeLaCasa}>
                    <input type="hidden" name="id" value={m.id} />
                    <button type="submit" className={estilos.botonEnlace}>
                      Es de la casa (siempre)
                    </button>
                  </form>
                )}
                <form action={marcarPagoDelBanco}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="estado" value="por_conciliar" />
                  <button type="submit" className={estilos.botonEnlace}>
                    Volver a la bandeja
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Pegar un aviso del banco</h2>
        <form action={pegarAvisoDelBanco} className="formulario">
          <div className="campo">
            <label htmlFor="texto">El aviso, como llega (la notificación o el SMS del BDV)</label>
            <textarea
              id="texto"
              name="texto"
              rows={4}
              required
              placeholder="Recibiste un PagomovilBDV por Bs.57.158,84 del 0424-5550199 Ref: 012345678094 en fecha 14-11-26 hora: 08:30."
            />
            <span className="ayuda">
              Si el teléfono no lo mandó solo: cópialo del BDVapp y pégalo aquí. Se pueden pegar varios seguidos. Uno que ya estaba (la misma referencia) no se
              repite.
            </span>
          </div>
          <button type="submit" className="boton boton--secundario">
            Leer el aviso
          </button>
        </form>
      </section>

      <section className="tarjeta" id="telefono">
        <h2 className={estilos.subtitulo}>El teléfono del banco</h2>
        <p>
          Un teléfono del negocio le manda a la web cada aviso de pago del banco. Con un <strong>iPhone</strong>: dos toques en la parte de atrás cuando
          llega la notificación del BDVapp (el iPhone no deja que nada la lea sola), o, si te llegan, los <strong>SMS</strong> del BDV, que sí entran solos.
          Con un <strong>Android</strong>: las notificaciones del BDVapp, solas, con la app MacroDroid.
        </p>
        {direccion ? (
          <>
            <div className="campo">
              <label htmlFor="direccion">La dirección del teléfono (lleva la clave: no la compartas)</label>
              <input id="direccion" type="text" readOnly value={direccion} className={propios.direccion} />
            </div>
            <BotonCopiar texto={direccion} etiqueta="Copiar la dirección" />
            <form action={crearClaveDelTelefonoDelBanco}>
              <button type="submit" className={estilos.botonEnlace}>
                Cambiar la clave (la de ahora deja de valer)
              </button>
            </form>
          </>
        ) : (
          <form action={crearClaveDelTelefonoDelBanco}>
            <button type="submit" className="boton">
              Crear la dirección del teléfono
            </button>
          </form>
        )}
        <h3 className={propios.subtituloTelefono}>Con un iPhone: dos toques atrás (las notificaciones del BDVapp)</h3>
        <ol className={propios.pasos}>
          <li>
            App <strong>Atajos</strong> → «+» (un atajo nuevo) y ponle de nombre <strong>Pago móvil al panel</strong>. Añade estas tres acciones, en este
            orden:
            <ul>
              <li>
                <strong>«Hacer captura de pantalla»</strong>.
              </li>
              <li>
                <strong>«Extraer texto de la imagen»</strong> (de la captura).
              </li>
              <li>
                <strong>«Obtener contenido de URL»</strong>: pega la dirección de arriba («Copiar la dirección»); toca la flechita «&gt;»: Método{" "}
                <strong>POST</strong>; Cuerpo de la solicitud <strong>JSON</strong>; «Añadir nuevo campo» → «Texto», con la clave <strong>texto</strong> y,
                de valor, la variable <strong>«Texto»</strong> (el que se extrajo).
              </li>
            </ul>
          </li>
          <li>
            Ajustes → Accesibilidad → Tocar → <strong>Tocar atrás</strong> → «Doble toque» → elige <strong>Pago móvil al panel</strong>.
          </li>
          <li>
            Cuando te llegue un pago: baja las notificaciones (o déjala en la pantalla) para que se vea el aviso del BDV <strong>entero</strong>, con la
            referencia, y da <strong>dos toques</strong> en la parte de atrás del iPhone. Se manda todo lo que se ve; si salen varios pagos, entran todos, y
            uno que ya estaba no se cuenta dos veces.
          </li>
          <li>Para probar: dos toques en cualquier pantalla. Arriba de esta página saldrá que llegó algo «(no era un pago recibido)».</li>
        </ol>
        <p className="ayuda">
          Si el aviso sale cortado («Ref: 01234…»), mantenlo pulsado para verlo entero antes de los dos toques: con la referencia a medias puede quedar sin
          identificar.
        </p>

        <h3 className={propios.subtituloTelefono}>Con un iPhone que recibe los SMS del BDV (entran solos)</h3>
        <ol className={propios.pasos}>
          <li>
            Que te lleguen a este iPhone los <strong>SMS del BDV</strong> de los pagos recibidos (al número que tiene registrado el banco). Si no te llegan,
            actívalos con el BDV. El iPhone no deja leer las notificaciones del BDVapp: solo los SMS.
          </li>
          <li>
            Guarda como contacto el número del que llegan esos SMS, con el nombre <strong>BDV</strong>.
          </li>
          <li>
            App <strong>Atajos</strong> → «Automatización» → «+» → <strong>«Mensaje»</strong>. En «Remitente», el contacto <strong>BDV</strong>; en «El
            mensaje contiene», <strong>Recibiste</strong>. Marca <strong>«Ejecutar inmediatamente»</strong> → «Siguiente» → «Nueva automatización en
            blanco».
          </li>
          <li>
            Añade la acción <strong>«Obtener contenido de URL»</strong> y pega en la URL la dirección de arriba («Copiar la dirección»). Toca la flechita
            «&gt;»: Método <strong>POST</strong>; Cuerpo de la solicitud <strong>JSON</strong>; «Añadir nuevo campo» → «Texto», con la clave{" "}
            <strong>texto</strong> y, de valor, la variable <strong>«Entrada del atajo»</strong> (el mensaje).
          </li>
          <li>
            Para probar, toca ▶ en la automatización: arriba de esta página saldrá que llegó algo «(no era un pago recibido)». Con eso ya está conectado.
          </li>
        </ol>
        <p className="ayuda">
          El remitente es importante: sin él, cualquiera podría mandarte un SMS que diga «Recibiste…» y se anotaría como un abono. Hace falta iOS 17 o más
          nuevo para que se ejecute sin preguntar.
        </p>

        <h3 className={propios.subtituloTelefono}>Con un Android (las notificaciones del BDVapp)</h3>
        <ol className={propios.pasos}>
          <li>En el teléfono del banco, con la sesión del BDVapp abierta, instala <strong>MacroDroid</strong> desde Google Play.</li>
          <li>
            «Añadir macro» → <strong>Disparador</strong>: «Notificación» → «Notificación recibida» → elige la app <strong>BDVapp</strong>; en «Texto», que
            contenga <strong>Recibiste</strong>. MacroDroid pedirá el permiso de leer las notificaciones: dáselo.
          </li>
          <li>
            <strong>Acción</strong>: «Conectividad» → «Petición HTTP». Método <strong>POST</strong>; la dirección, la de arriba; en el cuerpo (texto),
            con el botón de «texto mágico», el <strong>título</strong> y el <strong>texto de la notificación</strong>.
          </li>
          <li>Guarda la macro y déjala encendida.</li>
          <li>
            En el teléfono: Ajustes → Batería → Inicio de aplicaciones → MacroDroid en manual, con todo activado. Si no, el teléfono la duerme y deja de
            mandar.
          </li>
          <li>
            Para probar, toca «Probar acciones» en la macro: arriba de esta página saldrá que llegó algo «(no era un pago recibido)». Con eso ya está
            conectado.
          </li>
        </ol>
        <p className="ayuda">
          Si el teléfono no deja dar a MacroDroid el permiso de las notificaciones (pasa en algunos Android Go), activa los SMS del BDV y usa el disparador
          «SMS recibido», solo del número del BDV, con el texto del SMS en el cuerpo: el aviso dice lo mismo. Un pago que se anota a mano (con su captura,
          o en la caja) y llega también del banco se une y no se cuenta dos veces.
        </p>
      </section>
    </>
  );
}
