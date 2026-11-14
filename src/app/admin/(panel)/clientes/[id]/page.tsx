import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarCliente } from "@/lib/clientes";
import { conLineas, listarVentasDeCliente } from "@/lib/ventas";
import { listarPagosDeCliente, ultimaTasa } from "@/lib/pagos";
import { listarAdjuntosDeCliente } from "@/lib/adjuntos";
import { listarContactosDe, TIPOS_DE_CONTACTO } from "@/lib/contactos";
import { listarPreciosEspecialesDe } from "@/lib/precios-especiales";
import { listarProductos } from "@/lib/productos";
import { listarVariantes } from "@/lib/variantes";
import { vendiblesDe } from "@/lib/catalogo";
import { describirTrato, estudiarCliente } from "@/lib/seguimiento";
import { aplicarPagos, movimientosDeCuenta, repartoDeAbonos } from "@/lib/cuentas";
import { conVencimiento } from "@/lib/credito";
import { anotarContactoAccion, cambiarEnlaceDeCuenta, editarCliente, guardarPrecioEspecialAccion, quitarPrecioEspecialAccion, situarClienteEnElMapa, subirAdjunto } from "@/lib/acciones";
import { numeroDeNota } from "@/lib/entregas";
import { leerTasa } from "@/lib/ajustes";
import { METODOS_PAGO, fechaCorta, fechaDeLaBase, hoy, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { recordatoriosDe, ultimoRecordatorioDe } from "@/lib/recordatorios";
import { facturasDeVentas } from "@/lib/facturas";
import { delBancoPorPago } from "@/lib/banco";
import { HistorialDelCliente, leerFiltroDelHistorial } from "@/components/historial-cliente";
import { FormularioPago } from "@/components/formulario-pago";
import { EntradaFoto } from "@/components/entrada-foto";
import { negocio } from "@/config/negocio";
import { enlaceAlMapa, situar } from "@/lib/despacho";
import { explicarMotivo } from "@/lib/direcciones";
import { sinNombre as leFaltaNombre } from "@/lib/rotulo";
import { enlaceWhatsappA, mensajeAbono, mensajeEnlaceDeCuenta, mensajeNota, mensajePedirResena, mensajeRecordatorio } from "@/lib/whatsapp";
import { direccionDeCuenta } from "@/lib/enlace-cuenta";
import { rutaProducto, rutaVariante } from "@/lib/enlaces";
import { claveDe } from "@/lib/catalogo";
import { direccionCompleta } from "@/config/negocio";
import estilos from "../../panel.module.css";

export default async function PaginaCliente({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ParametrosAviso>;
}) {
  const { id } = await params;
  const parametros = await searchParams;
  const cliente = await buscarCliente(Number(id));
  if (!cliente) notFound();

  const [ventas, pagos, adjuntos, tasa, tasaDelDia, recordadoEl, contactos, preciosEspeciales, productos, variantes, recordatorios] = await Promise.all([
    listarVentasDeCliente(cliente.id).then(conLineas),
    listarPagosDeCliente(cliente.id),
    listarAdjuntosDeCliente(cliente.id),
    ultimaTasa(),
    leerTasa(),
    ultimoRecordatorioDe(cliente.id),
    listarContactosDe(cliente.id, 500),
    listarPreciosEspecialesDe(cliente.id),
    listarProductos(true),
    listarVariantes(),
    recordatoriosDe(cliente.id),
  ]);
  const [facturas, delBanco] = await Promise.all([facturasDeVentas(ventas.map((v) => v.id)), delBancoPorPago(pagos.map((p) => p.id))]);
  // Lo que se le puede poner a precio especial: todo lo que se vende, con su nombre de venta.
  const vendibles = vendiblesDe(productos, variantes);
  const nombreDeVendible = new Map(vendibles.map((v) => [v.clave, v.nombre]));
  const cuentas = conVencimiento(aplicarPagos(ventas, cliente.total_pagado_usd), cliente.dias_credito, hoy());
  const vencido = cuentas.filter((c) => c.vencida).reduce((s, c) => s + c.pendiente_usd, 0);
  const ciudad = `${negocio.localidad}, ${negocio.estado}, Venezuela`;
  const situacion = situar(cliente, ciudad);
  const mapa = enlaceAlMapa(cliente, ciudad);
  const ventaDeAdjunto = new Map(ventas.map((v) => [v.id, v]));
  const aqui = (ancla: string) => encodeURIComponent(`/admin/clientes/${cliente.id}#${ancla}`);
  // Cada abono con su número (del más antiguo al más nuevo) y lo que debía el cliente antes y lo que quedó después.
  const abonosEnOrden = [...pagos].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
  const numeroDeAbono = new Map(abonosEnOrden.map((p, i) => [p.id, i + 1]));
  const saldoTras = new Map(movimientosDeCuenta(ventas, pagos).map((m) => [`${m.tipo}-${m.id}`, m.saldo_usd]));
  const reparto = repartoDeAbonos(ventas, pagos);
  // El seguimiento: cuándo fue el último trato con este cliente, sea el que sea.
  const trato = estudiarCliente({ alta: cliente.creado_en, ventas, abonos: pagos, ultimoRecordatorio: recordadoEl, ultimoContacto: contactos[0]?.fecha ?? null }, hoy());

  // Enlaces de WhatsApp: recordar la deuda y mandar cada nota. Solo si hay teléfono.
  const pendientes = cuentas.filter((c) => c.pendiente_usd > 0).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const recordatorio =
    cliente.saldo_usd > 0
      ? enlaceWhatsappA(
          cliente.telefono,
          mensajeRecordatorio({
            negocio: negocio.nombre,
            cliente: cliente.nombre,
            saldo_usd: cliente.saldo_usd,
            pendientes,
            tasa,
            enlace: cliente.enlace ? direccionDeCuenta(cliente.enlace) : null,
          }),
        )
      : null;
  // Para mandarle su enlace personal, con el que ve su cuenta sin clave.
  const mandarEnlace = cliente.enlace
    ? enlaceWhatsappA(cliente.telefono, mensajeEnlaceDeCuenta({ negocio: negocio.nombre, cliente: cliente.nombre, enlace: direccionDeCuenta(cliente.enlace) }))
    : null;
  const enlaceNota = (v: (typeof cuentas)[number]) =>
    enlaceWhatsappA(
      cliente.telefono,
      mensajeNota({
        negocio: negocio.nombre,
        cliente: cliente.nombre,
        fecha: v.fecha,
        numero: numeroDeNota(v.id),
        lineas: v.lineas,
        total_usd: v.total_usd,
        saldo_usd: cliente.saldo_usd,
        tasa,
        vence: v.pendiente_usd > 0 ? v.vence : undefined,
        enlace: cliente.enlace ? direccionDeCuenta(cliente.enlace) : null,
      }),
    );

  // Pedirle su opinión de lo que ha comprado, para las reseñas de la web: de cada marca, si la tiene, que tiene su propia página.
  const comprados = new Map<string, { nombre: string; ruta: string }>();
  for (const l of ventas.flatMap((v) => v.lineas)) {
    const clave = claveDe(l.producto_id, l.variante_id ?? null);
    if (comprados.has(clave)) continue;
    // `producto_nombre` ya lleva la marca detrás («Queso amarillo Kemmental»); para la dirección hace falta el producto solo.
    const delProducto = l.variante_nombre && l.producto_nombre.endsWith(` ${l.variante_nombre}`) ? l.producto_nombre.slice(0, -l.variante_nombre.length - 1) : l.producto_nombre;
    const producto = { id: l.producto_id, nombre: delProducto };
    comprados.set(clave, {
      nombre: l.producto_nombre,
      ruta: l.variante_id && l.variante_nombre ? rutaVariante(producto, { id: l.variante_id, nombre: l.variante_nombre }) : rutaProducto(producto),
    });
  }
  const pedirResena = [...comprados]
    .map(([id, { nombre, ruta }]) => ({
      id,
      nombre,
      enlace: enlaceWhatsappA(
        cliente.telefono,
        mensajePedirResena({
          negocio: negocio.nombre,
          cliente: cliente.nombre,
          producto: nombre,
          enlace: direccionCompleta(ruta),
        }),
      ),
    }))
    .filter((p): p is { id: string; nombre: string; enlace: string } => p.enlace !== null);

  // El recibo de cada abono, con el saldo como está hoy.
  const enlaceRecibo = (p: (typeof pagos)[number]) =>
    enlaceWhatsappA(
      cliente.telefono,
      mensajeAbono({
        negocio: negocio.nombre,
        cliente: cliente.nombre,
        fecha: p.fecha,
        metodo: METODOS_PAGO[p.metodo],
        monto: p.monto,
        moneda: p.moneda,
        tasa: p.tasa,
        monto_usd: p.monto_usd,
        referencia: p.referencia,
        saldo_usd: cliente.saldo_usd,
        tasaDelDia: tasaDelDia?.valor,
        enlace: cliente.enlace ? direccionDeCuenta(cliente.enlace) : null,
      }),
    );

  const claseSaldo =
    cliente.saldo_usd > 0 ? estilos.deuda : cliente.saldo_usd < 0 ? estilos.favor : estilos.saldado;
  const textoSaldo =
    cliente.saldo_usd > 0
      ? `Debe ${usd(cliente.saldo_usd)}`
      : cliente.saldo_usd < 0
        ? `A favor ${usd(-cliente.saldo_usd)}`
        : "Al día";

  return (
    <>
      <div className={estilos.encabezado}>
        <div>
          <p>
            <Link href="/admin/clientes">← Clientes</Link>
          </p>
          <h1 className={estilos.titulo}>{cliente.rotulo}</h1>
          {cliente.razon_social && cliente.nombre && (
            <p className={estilos.ayuda} style={{ marginBottom: 0 }}>Atención: {cliente.nombre}</p>
          )}
          {leFaltaNombre(cliente) && (
            <p className={estilos.sinNombre}>
              Sin nombre: <Link href="#datos">ponlo en Datos</Link> cuando lo sepas.
            </p>
          )}
        </div>
        <div className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
          {recordatorio && (
            <a href={`/admin/recordar/${cliente.id}`} target="_blank" rel="noopener" className="boton boton--acento">
              Recordar deuda por WhatsApp
            </a>
          )}
          {recordatorio && recordadoEl && <span className="ayuda">Recordado el {fechaCorta(recordadoEl)}</span>}
          <Link href={`/admin/ventas?cliente=${cliente.id}`} className="boton boton--secundario">
            Nueva venta
          </Link>
          {(ventas.length > 0 || pagos.length > 0) && (
            <Link href={`/admin/clientes/${cliente.id}/estado`} className="boton boton--secundario">
              Estado de cuenta
            </Link>
          )}
        </div>
      </div>
      {cliente.saldo_usd > 0 && !recordatorio && (
        <p className={estilos.ayuda}>
          Pon un teléfono venezolano completo (por ejemplo 0412-1234567) para poder recordarle la deuda
          por WhatsApp.
        </p>
      )}
      <Avisos parametros={parametros} />


      <dl className={estilos.cifras}>
        <div className={estilos.cifra}>
          <dt>Comprado</dt>
          <dd>{usd(cliente.total_comprado_usd)}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Abonado</dt>
          <dd>{usd(cliente.total_pagado_usd)}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Saldo</dt>
          <dd className={claseSaldo}>{textoSaldo}</dd>
        </div>
        <div className={`${estilos.cifra} ${vencido > 0 ? estilos["cifra--alerta"] : ""}`}>
          <dt>Con el plazo vencido</dt>
          <dd>{usd(vencido)}</dd>
        </div>
      </dl>

      <div className={estilos.dosColumnas}>
        <section className="tarjeta" id="abono">
          <h2 className={estilos.subtitulo}>Registrar abono</h2>
          <FormularioPago
            clientes={[cliente]}
            clienteFijo={cliente.id}
            ultimaTasa={tasa}
            volverA={`/admin/clientes/${cliente.id}`}
            parametros={parametros}
          />
        </section>

        <section className="tarjeta" id="datos">
          <h2 className={estilos.subtitulo}>Datos</h2>
          {cliente.direccion && situacion.situada && (
            <p className={estilos.ayuda}>
              {situacion.origen === "cuadricula" ? "Entra en la ruta de despacho: " : "Entra en la ruta según el mapa: "}
              <strong>{situacion.texto}</strong>
              {situacion.origen === "mapa" && situacion.aproximada ? " (aproximado)" : ""}.
              {mapa && (
                <>
                  {" "}
                  <a href={mapa} target="_blank" rel="noopener">
                    Ver en el mapa
                  </a>
                </>
              )}
            </p>
          )}
          {cliente.direccion && !situacion.situada && (
            <div className="aviso aviso--aviso" style={{ marginBottom: "var(--espacio-4)" }}>
              La dirección no se pudo comprobar: {explicarMotivo(situacion.motivo)} Queda fuera de la ruta de despacho.
              Escríbela con la calle y la carrera, como «Carrera 19 con calle 25», o con el nombre del sitio o de la
              avenida.
              {mapa && (
                <>
                  {" "}
                  <a href={mapa} target="_blank" rel="noopener">
                    Buscarla en el mapa
                  </a>
                </>
              )}
              <form action={situarClienteEnElMapa} style={{ marginTop: "var(--espacio-2)" }}>
                <input type="hidden" name="id" value={cliente.id} />
                <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                  Buscar la dirección en el mapa
                </button>
              </form>
            </div>
          )}
          <form action={editarCliente} className="formulario">
            <input type="hidden" name="id" value={cliente.id} />
            <div className="formulario__fila">
              <div className="campo">
                <label htmlFor="razon_social">Razón social o negocio</label>
                <input id="razon_social" name="razon_social" type="text" autoComplete="off" autoCorrect="off" defaultValue={cliente.razon_social} placeholder="Burger Cleiderman, Tutto Pan, C.A." />
                <span className="ayuda">Lo que sale en grande en las listas y en la nota.</span>
              </div>
              <div className="campo">
                <label htmlFor="nombre">Nombre de la persona</label>
                <input id="nombre" name="nombre" type="text" autoComplete="off" autoCorrect="off" defaultValue={cliente.nombre} placeholder="Luis, María" />
                <span className="ayuda">Quién atiende: a él se le saluda por WhatsApp.</span>
              </div>
            </div>
            <div className="formulario__fila">
              <div className="campo">
                <label htmlFor="telefono">Teléfono</label>
                <input id="telefono" name="telefono" type="tel" inputMode="tel" defaultValue={cliente.telefono} />
              </div>
              <div className="campo">
                <label htmlFor="cedula_rif">Cédula o RIF</label>
                <input id="cedula_rif" name="cedula_rif" type="text" defaultValue={cliente.cedula_rif} />
              </div>
            </div>
            <div className="campo">
              <label htmlFor="direccion">Dirección</label>
              <input
                id="direccion"
                name="direccion"
                type="text"
                defaultValue={cliente.direccion}
                placeholder="Carrera 19 con calle 25"
              />
            </div>
            <div className="formulario__fila">
              <div className="campo">
                <label htmlFor="dias_credito">Días de crédito</label>
                <input
                  id="dias_credito"
                  name="dias_credito"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="365"
                  step="1"
                  defaultValue={cliente.dias_credito}
                />
                <span className="ayuda">Cada nota vence a esos días de su fecha.</span>
              </div>
            </div>
            <div className="campo">
              <label htmlFor="nota">Nota</label>
              <input id="nota" name="nota" type="text" defaultValue={cliente.nota} />
            </div>
            <label className={estilos.casilla}>
              <input type="checkbox" name="de_la_casa" value="1" defaultChecked={Boolean(cliente.de_la_casa)} />
              <span>
                Es de la casa (la familia)
                <span className="ayuda"> Lo que debe no se cobra: no sale en cobros, vencidos, avisos ni «por llamar».</span>
              </span>
            </label>
            <div className={estilos.accionesFila} style={{ flexWrap: "wrap", justifyContent: "space-between" }}>
              <button type="submit" className="boton boton--secundario">
                Guardar cambios
              </button>
              <Link href={`/admin/clientes/${cliente.id}/eliminar`} className="enlace-fila">
                Eliminar cliente
              </Link>
            </div>
          </form>
        </section>
      </div>

      <section className="tarjeta" id="seguimiento">
        <h2 className={estilos.subtitulo}>Seguimiento</h2>
        <p className={estilos.ayuda}>
          <strong className={trato.porLlamar ? estilos.vencida : undefined}>{describirTrato(trato)}</strong>
          {trato.ultimaCompra ? ` · última compra el ${fechaCorta(trato.ultimaCompra)}` : " · nunca ha comprado"}
          {trato.ultimoAbono ? ` · último abono el ${fechaCorta(trato.ultimoAbono)}` : ""}
          {recordadoEl ? ` · recordatorio el ${fechaCorta(recordadoEl)}` : ""}
          {contactos[0] ? ` · ${TIPOS_DE_CONTACTO[contactos[0].tipo].toLowerCase()} el ${fechaCorta(contactos[0].fecha)}` : ""}
          {trato.cadaCuantosDias ? ` · suele comprar cada ${trato.cadaCuantosDias} días` : ""}
          {trato.proximaCompra ? ` · le tocaría el ${fechaCorta(trato.proximaCompra)}` : ""}
          {trato.porLlamar ? " · toca llamarlo para ofrecerle mercancía." : "."}{" "}
          <Link href="/admin/clientes/seguimiento">Estudio de clientes</Link>
        </p>
        <form action={anotarContactoAccion} className="formulario">
          <input type="hidden" name="cliente_id" value={cliente.id} />
          <input type="hidden" name="volver_a" value={`/admin/clientes/${cliente.id}#seguimiento`} />
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="contacto-tipo">Qué trato hubo</label>
              <select id="contacto-tipo" name="tipo" defaultValue="llamada">
                {Object.entries(TIPOS_DE_CONTACTO).map(([valor, nombre]) => (
                  <option key={valor} value={valor}>
                    {nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="contacto-fecha">Cuándo</label>
              <input id="contacto-fecha" name="fecha" type="date" max={hoy()} defaultValue={hoy()} />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="contacto-nota">Qué quedó (opcional)</label>
            <input id="contacto-nota" name="nota" type="text" maxLength={300} placeholder="Va a pedir el viernes" />
          </div>
          <div>
            <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
              Anotar el trato
            </button>
          </div>
        </form>
        {contactos.length > 0 && (
          <ul className={estilos.pedidos} style={{ marginTop: "var(--espacio-3)" }}>
            {contactos.slice(0, 10).map((c) => (
              <li key={c.id}>
                <p>
                  <strong>{fechaCorta(c.fecha)}</strong> · {TIPOS_DE_CONTACTO[c.tipo]}
                  {c.nota ? ` · ${c.nota}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="tarjeta" id="precios">
        <h2 className={estilos.subtitulo}>Precios especiales</h2>
        <p className={estilos.ayuda}>
          Lo que se le cobra a este cliente en vez del precio al mayor. La caja lo usa sola al elegirlo; en Ventas sigue escribiéndose el precio
          de cada nota.
        </p>
        {preciosEspeciales.length > 0 && (
          <ul className={estilos.pedidos} style={{ marginBottom: "var(--espacio-3)" }}>
            {preciosEspeciales.map((p) => {
              const clave = p.variante_id ? `${p.producto_id}-${p.variante_id}` : String(p.producto_id);
              return (
                <li key={p.id}>
                  <p>
                    <strong>{nombreDeVendible.get(clave) ?? "Artículo que ya no se vende"}</strong> · {usd(p.precio_usd)}
                  </p>
                  <form action={quitarPrecioEspecialAccion}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="cliente_id" value={cliente.id} />
                    <button type="submit" className={estilos.botonEnlace}>
                      Quitar
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        <form action={guardarPrecioEspecialAccion} className="formulario">
          <input type="hidden" name="cliente_id" value={cliente.id} />
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="precio-especial-clave">Producto</label>
              <select id="precio-especial-clave" name="clave" required defaultValue="">
                <option value="" disabled>
                  Elige el producto
                </option>
                {vendibles.map((v) => (
                  <option key={v.clave} value={v.clave}>
                    {v.nombre}
                    {v.precio_usd !== null ? ` (al mayor ${usd(v.precio_usd)})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="precio-especial-precio">Precio especial (USD)</label>
              <input id="precio-especial-precio" name="precio_usd" type="number" inputMode="decimal" min="0" step="0.01" required />
            </div>
          </div>
          <div>
            <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
              Guardar precio especial
            </button>
          </div>
        </form>
      </section>

      <HistorialDelCliente
        clienteId={cliente.id}
        ventas={cuentas}
        pagos={pagos}
        adjuntos={adjuntos}
        facturas={facturas}
        delBanco={delBanco}
        contactos={contactos}
        recordatorios={recordatorios}
        numeroDeAbono={numeroDeAbono}
        saldoTras={saldoTras}
        reparto={reparto}
        enlaceNota={enlaceNota}
        enlaceRecibo={enlaceRecibo}
        ver={leerFiltroDelHistorial(parametros.ver)}
        todo={parametros.todo === "1"}
      />

      {pedirResena.length > 0 && (
        <section className="tarjeta">
          <h2 className={estilos.subtitulo}>Pedirle una reseña</h2>
          <p className={estilos.ayuda}>
            Abre WhatsApp con el mensaje escrito: le pregunta qué le parece el producto y si da permiso para
            publicarlo con su nombre. Lo que responda se anota en <Link href="/admin/resenas">Reseñas</Link>.
          </p>
          <div className={estilos.carteraAcciones}>
            {pedirResena.map((p) => (
              <a key={p.id} href={p.enlace} target="_blank" rel="noopener" className={estilos.whatsapp}>
                {p.nombre}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* El enlace personal con el que el cliente ve su cuenta, sin clave. */}
      <section className="tarjeta" id="enlace">
        <h2 className={estilos.subtitulo}>Su enlace de cuenta</h2>
        {cliente.enlace ? (
          <>
            <p className={estilos.ayuda}>
              Con este enlace ve en su teléfono lo que tiene pendiente, sus notas y sus abonos, siempre al día y sin clave. Es solo suyo: si lo
              compartió de más, renuévalo y el anterior deja de funcionar.
            </p>
            <p className={estilos.enlaceDeCuenta}>
              <a href={direccionDeCuenta(cliente.enlace)} target="_blank" rel="noopener">
                {direccionDeCuenta(cliente.enlace)}
              </a>
            </p>
            <div className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
              {mandarEnlace && (
                <a href={mandarEnlace} target="_blank" rel="noopener" className="boton boton--acento">
                  Mandárselo por WhatsApp
                </a>
              )}
              <form action={cambiarEnlaceDeCuenta}>
                <input type="hidden" name="id" value={cliente.id} />
                <input type="hidden" name="enlace_de_cuenta" value="renovar" />
                <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                  Renovar el enlace
                </button>
              </form>
            </div>
          </>
        ) : (
          <form action={cambiarEnlaceDeCuenta}>
            <p className={estilos.ayuda}>
              Crea su enlace personal y mándaselo por WhatsApp: con él ve lo que tiene pendiente, sus notas y sus abonos, siempre al día y sin clave.
            </p>
            <input type="hidden" name="id" value={cliente.id} />
            <input type="hidden" name="enlace_de_cuenta" value="crear" />
            <button type="submit" className="boton">
              Crear su enlace de cuenta
            </button>
          </form>
        )}
      </section>

      <section className="tarjeta" id="fotos">
        <h2 className={estilos.subtitulo}>Notas de entrega</h2>
        <p className={estilos.ayuda}>
          Haz una foto a la nota en papel y guárdala aquí. Queda unida al cliente y, si la eliges, a
          la venta. Las fotos entran en la copia de seguridad.
        </p>
        <form action={subirAdjunto} className="formulario" encType="multipart/form-data">
          <input type="hidden" name="cliente_id" value={cliente.id} />
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="archivo">Foto o PDF</label>
              <EntradaFoto nombre="archivo" id="archivo" />
            </div>
            <div className="campo">
              <label htmlFor="venta_id">De qué venta</label>
              <select id="venta_id" name="venta_id" defaultValue="">
                <option value="">Sin venta concreta</option>
                {ventas.map((v) => (
                  <option key={v.id} value={v.id}>
                    {fechaCorta(v.fecha)} · {usd(v.total_usd)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="campo">
            <label htmlFor="descripcion">Descripción</label>
            <input id="descripcion" name="descripcion" type="text" placeholder="Nota n.º 123" />
          </div>
          <div>
            <button type="submit" className="boton boton--secundario">
              Guardar foto
            </button>
          </div>
        </form>

        {adjuntos.length > 0 && (
          <ul className={estilos.miniaturas}>
            {adjuntos.map((a) => {
              const venta = a.venta_id ? ventaDeAdjunto.get(a.venta_id) : undefined;
              return (
                <li key={a.id} className={estilos.miniatura}>
                  <Link href={`/admin/adjuntos/${a.id}/ver?volver_a=${aqui("fotos")}`}>
                    {a.tipo === "application/pdf" ? (
                      <span className={estilos.miniaturaPdf}>PDF</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/admin/adjuntos/${a.id}`} alt={a.descripcion || "Nota de entrega"} loading="lazy" />
                    )}
                  </Link>
                  <div className={estilos.miniaturaTexto}>
                    <strong>{a.descripcion || "Nota"}</strong>
                    <span>
                      {fechaCorta(fechaDeLaBase(a.creado_en))}
                      {venta ? ` · venta del ${fechaCorta(venta.fecha)} (${usd(venta.total_usd)})` : ""}
                      {/* La foto de una nota que después se borró: se queda con el cliente, y se dice. */}
                      {!venta && !a.pago_id && /^Nota N\.º/.test(a.descripcion) ? " · esa nota ya se borró; la foto se queda aquí" : ""}
                      {a.pago_id && numeroDeAbono.has(a.pago_id) ? ` · abono N.º ${numeroDeAbono.get(a.pago_id)}` : ""}
                    </span>
                    <Link href={`/admin/adjuntos/${a.id}/eliminar`} className="enlace-fila">
                      Eliminar
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = await buscarCliente(Number(id));
  return { title: cliente?.nombre ?? "Cliente" };
}
