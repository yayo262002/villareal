import Link from "next/link";
import { negocio } from "@/config/negocio";
import { contarMensajes, estadoDePruebas, estadoWhatsapp, palabraDeVerificacion, plantillasDePrueba, ultimosMensajes } from "@/lib/whatsapp-api";
import { VERSION_GRAPH } from "@/lib/whatsapp-calculo";
import { crearPlantillaWhatsapp, guardarDatosWhatsapp, guardarTokenDePruebas, mandarPruebaWhatsapp } from "@/lib/acciones-whatsapp";
import { telefonoLegible } from "@/lib/whatsapp";
import { fechaCorta, fechaDeLaBase, horaDeLaBase } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { BotonCopiar } from "@/components/boton-copiar";
import { ConectarWhatsapp } from "@/components/conectar-whatsapp";
import estilos from "../panel.module.css";
import { exigirPanel } from "@/lib/panel";

export const metadata = { title: "WhatsApp" };

const CAMPOS_DEL_WEBHOOK = ["messages", "smb_message_echoes", "history", "smb_app_state_sync", "account_update"];

/**
 * El WhatsApp del negocio conectado a la web (el dueño, 21/11/2026: «automatizar todos los WhatsApp que entren», con el
 * mismo número). Arriba, cómo está; luego los tres pasos (los datos de la app de Meta, la dirección de los avisos y
 * conectar el número, que no lo saca del teléfono) y, abajo, los últimos mensajes. Por ahora solo se reciben y se
 * guardan: nada contesta solo. La lógica, en `src/lib/whatsapp-api.ts`.
 */
export default async function PaginaWhatsapp({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  await exigirPanel();
  const parametros = await searchParams;
  const [estado, palabra, mensajes, total, pruebas] = await Promise.all([estadoWhatsapp(), palabraDeVerificacion(), ultimosMensajes(100), contarMensajes(), estadoDePruebas()]);
  const { plantillas, error: errorDePlantillas } = pruebas.tieneToken ? await plantillasDePrueba() : { plantillas: [], error: null };
  const direccion = `${negocio.web}/api/whatsapp`;
  const listoParaConectar = Boolean(estado.appId && estado.configId && estado.tieneSecreto);

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 className={estilos.titulo}>WhatsApp</h1>
      </div>
      <Avisos parametros={parametros} />

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Cómo está</h2>
        {estado.wabaId ? (
          <p>
            <strong>Conectado</strong>
            {estado.numero ? ` · ${estado.numero}` : ""}
            {estado.nombreVerificado ? ` (${estado.nombreVerificado})` : ""}
            {estado.conectadoEn ? `, desde el ${fechaCorta(fechaDeLaBase(estado.conectadoEn))}` : ""}. El número sigue en WhatsApp Business de tu teléfono:
            contestas como siempre, y aquí queda todo.
          </p>
        ) : (
          <p>Todavía no está conectado. Son tres pasos, abajo; ninguno saca el número de tu teléfono.</p>
        )}
        <p className="ayuda">
          {total === 1 ? "1 mensaje guardado" : `${total} mensajes guardados`}.
          {estado.ultimoAviso ? ` Lo último que mandó Meta: ${estado.ultimoAviso} (hora UTC).` : " Meta todavía no ha mandado nada."}
          {estado.ultimoEvento ? ` Último aviso de la cuenta: ${estado.ultimoEvento}.` : ""}
          {estado.sincronizacion ? ` Contactos e historial: ${estado.sincronizacion}.` : ""}
        </p>
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>1. Los datos de la app de Meta</h2>
        <p className="ayuda">
          Están en Meta for Developers, en la app «Villa Real Panel»: el identificador sale arriba; la clave secreta, en Configuración de la app → Básica →
          «Clave secreta de la app» (pulsa «Mostrar»); el de la configuración, en Inicio de sesión con Facebook para empresas → Configuraciones. La clave
          secreta no se enseña nunca aquí y no va en las copias.
        </p>
        <form action={guardarDatosWhatsapp} className="formulario">
          <div className="campo">
            <label htmlFor="app_id">Identificador de la app</label>
            <input id="app_id" name="app_id" inputMode="numeric" required defaultValue={estado.appId} />
          </div>
          <div className="campo">
            <label htmlFor="config_id">Identificador de la configuración (Embedded Signup)</label>
            <input id="config_id" name="config_id" inputMode="numeric" defaultValue={estado.configId} placeholder="Solo cifras" />
          </div>
          <div className="campo">
            <label htmlFor="secreto">Clave secreta de la app</label>
            <input id="secreto" name="secreto" type="password" autoComplete="off" placeholder={estado.tieneSecreto ? "Guardada ✓ (escríbela solo para cambiarla)" : "32 letras y números"} />
          </div>
          <div>
            <button type="submit" className="boton">
              Guardar
            </button>
          </div>
        </form>
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>2. La dirección de los avisos (webhook)</h2>
        <p className="ayuda">
          En la app de Meta: WhatsApp → Configuración → Webhook → «Editar». Pega la dirección y la palabra de verificación, pulsa «Verificar y guardar» y
          luego, en «Campos del webhook», suscríbete a: {CAMPOS_DEL_WEBHOOK.join(", ")}.
        </p>
        <div className="campo">
          <label htmlFor="direccion-whatsapp">URL de devolución de llamada</label>
          <input id="direccion-whatsapp" type="text" readOnly value={direccion} />
        </div>
        <BotonCopiar texto={direccion} etiqueta="Copiar la dirección" />
        <div className="campo" style={{ marginTop: "var(--espacio-4)" }}>
          <label htmlFor="palabra-whatsapp">Token de verificación</label>
          <input id="palabra-whatsapp" type="text" readOnly value={palabra} />
        </div>
        <BotonCopiar texto={palabra} etiqueta="Copiar el token" />
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>3. Conectar el número</h2>
        <p className="ayuda">
          Se abre una ventana de Meta: elige la empresa Comercializadora Villa Real y, cuando pregunte, que el número es el de tu <strong>WhatsApp Business</strong>{" "}
          (el que ya usas). Meta manda un aviso al teléfono para confirmar y compartir los chats. Si en algún momento pide borrar la cuenta de WhatsApp o un
          código por SMS para registrar el número, <strong>para</strong>: ese es el camino que lo saca del teléfono. Mientras Meta no haya revisado la
          app (paso 4), la ventana dice que la empresa «no puede registrar clientes en este momento».
        </p>
        {listoParaConectar ? (
          <ConectarWhatsapp appId={estado.appId} configId={estado.configId} version={VERSION_GRAPH} />
        ) : (
          <p className="vacio">Primero guarda en el paso 1 el identificador de la app, el de la configuración y la clave secreta.</p>
        )}
      </section>

      <section className="tarjeta" id="revision">
        <h2 className={estilos.subtitulo}>4. La revisión de Meta · Meta App Review</h2>
        <p className="ayuda">
          Para conectar un número que está en WhatsApp Business del teléfono, Meta tiene que revisar la app. Quiere ver, en dos videos, que el panel manda un
          mensaje de WhatsApp que llega a un teléfono y que crea una plantilla de mensaje. Se hace aquí, con el número de prueba que Meta da gratis.
        </p>

        <h3 style={{ marginTop: "var(--espacio-4)" }}>Token de prueba · Test access token</h3>
        <p className="ayuda">
          En la app de Meta: WhatsApp → Configuración de la API. Copia el «Token de acceso» (vale 24 horas: si caduca, genera otro y pégalo), el
          «Identificador del número de teléfono» y el «Identificador de la cuenta de WhatsApp Business». El token no se enseña nunca aquí.
        </p>
        {pruebas.tieneToken && pruebas.tokenEn ? (
          <p>
            Token guardado el {fechaCorta(fechaDeLaBase(pruebas.tokenEn))} {horaDeLaBase(pruebas.tokenEn)}
            {pruebas.numero ? ` · número de prueba (test number): ${pruebas.numero}` : ""}.
          </p>
        ) : null}
        <form action={guardarTokenDePruebas} className="formulario">
          <div className="campo">
            <label htmlFor="token">Token de acceso · Access token</label>
            <input id="token" name="token" type="text" autoComplete="off" spellCheck={false} required placeholder={pruebas.tieneToken ? "Guardado ✓ (pega otro si caducó)" : "EAA…"} />
          </div>
          <div className="campo">
            <label htmlFor="telefono_id">Identificador del número de teléfono · Phone number ID</label>
            <input id="telefono_id" name="telefono_id" inputMode="numeric" defaultValue={pruebas.telefonoId ?? ""} placeholder="Solo cifras" />
          </div>
          <div className="campo">
            <label htmlFor="waba_id">Identificador de la cuenta de WhatsApp Business · WhatsApp Business Account ID</label>
            <input id="waba_id" name="waba_id" inputMode="numeric" defaultValue={pruebas.wabaId ?? ""} placeholder="Solo cifras" />
          </div>
          <div>
            <button type="submit" className="boton">
              Guardar · Save
            </button>
          </div>
        </form>

        {pruebas.tieneToken ? (
          <>
            <h3 style={{ marginTop: "var(--espacio-5)" }}>Mandar un mensaje · Send a WhatsApp message</h3>
            <p className="ayuda">
              El teléfono que recibe tiene que estar en la lista de Meta («Para» → «Administrar lista de números de teléfono»). Sin texto, va la plantilla
              «hello_world» de Meta, que llega siempre; un texto solo llega si ese teléfono le escribió al número de prueba en las últimas 24 horas.
            </p>
            <form action={mandarPruebaWhatsapp} className="formulario">
              <div className="campo">
                <label htmlFor="para">Para · To</label>
                <input id="para" name="para" type="tel" required placeholder="0412-1234567" />
              </div>
              <div className="campo">
                <label htmlFor="texto-prueba">Texto (opcional) · Text (optional)</label>
                <textarea id="texto-prueba" name="texto" rows={2} placeholder="Vacío: la plantilla hello_world · Empty: hello_world template" />
              </div>
              <div>
                <button type="submit" className="boton">
                  Mandar · Send
                </button>
              </div>
            </form>

            <h3 style={{ marginTop: "var(--espacio-5)" }}>Crear una plantilla · Create a message template</h3>
            <form action={crearPlantillaWhatsapp} className="formulario">
              <div className="campo">
                <label htmlFor="nombre-plantilla">Nombre · Name</label>
                <input id="nombre-plantilla" name="nombre" required defaultValue="pedido_listo" pattern="[a-z0-9_]{1,60}" />
              </div>
              <div className="campo">
                <label htmlFor="categoria-plantilla">Categoría · Category</label>
                <select id="categoria-plantilla" name="categoria" defaultValue="UTILITY">
                  <option value="UTILITY">Utilidad · Utility</option>
                  <option value="MARKETING">Publicidad · Marketing</option>
                </select>
              </div>
              <div className="campo">
                <label htmlFor="idioma-plantilla">Idioma · Language</label>
                <select id="idioma-plantilla" name="idioma" defaultValue="es">
                  <option value="es">Español · Spanish</option>
                  <option value="en_US">Inglés · English (US)</option>
                </select>
              </div>
              <div className="campo">
                <label htmlFor="texto-plantilla">Mensaje · Message body</label>
                <textarea id="texto-plantilla" name="texto" rows={3} required defaultValue="Hola, tu pedido de Villa Real está listo para entregar. ¡Gracias por tu compra!" />
              </div>
              <div>
                <button type="submit" className="boton">
                  Crear la plantilla · Create template
                </button>
              </div>
            </form>

            <h3 style={{ marginTop: "var(--espacio-5)" }}>Plantillas · Message templates</h3>
            {errorDePlantillas ? (
              <p className="aviso aviso--aviso">No se pudieron leer: {errorDePlantillas}</p>
            ) : plantillas.length === 0 ? (
              <p className="vacio">Todavía no hay plantillas en la cuenta de prueba.</p>
            ) : (
              <div className="tabla-envoltorio">
                <table className="tabla tabla--fichas">
                  <thead>
                    <tr>
                      <th>Nombre · Name</th>
                      <th>Estado · Status</th>
                      <th>Categoría · Category</th>
                      <th>Idioma · Language</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plantillas.map((p) => (
                      <tr key={`${p.nombre}-${p.idioma}`}>
                        <td data-label="Nombre">{p.nombre}</td>
                        <td data-label="Estado">{p.estado}</td>
                        <td data-label="Categoría">{p.categoria}</td>
                        <td data-label="Idioma">{p.idioma}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Los últimos mensajes</h2>
        {mensajes.length === 0 ? (
          <p className="vacio">Todavía no hay mensajes. Llegan en cuanto el número esté conectado.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Con quién</th>
                  <th>Quién escribe</th>
                  <th>Mensaje</th>
                </tr>
              </thead>
              <tbody>
                {mensajes.map((m) => (
                  <tr key={m.id}>
                    <td data-label="Cuándo">
                      {fechaCorta(fechaDeLaBase(m.momento))} {horaDeLaBase(m.momento)}
                    </td>
                    <td data-label="Con quién">
                      {m.cliente_id ? <Link href={`/admin/clientes/${m.cliente_id}`}>{m.cliente ?? telefonoLegible(m.telefono)}</Link> : m.nombre || telefonoLegible(m.telefono)}
                      {m.cliente_id ? "" : <span className="ayuda"> · {telefonoLegible(m.telefono)}</span>}
                    </td>
                    <td data-label="Quién escribe">{m.direccion === "entrante" ? "El cliente" : m.origen === "telefono" ? "Tú, desde el teléfono" : "Tú"}{m.origen === "historial" ? " (historial)" : ""}</td>
                    <td data-label="Mensaje">{m.texto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
