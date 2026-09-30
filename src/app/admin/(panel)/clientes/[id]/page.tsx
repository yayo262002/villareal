import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarCliente } from "@/lib/clientes";
import { conLineas, listarVentasDeCliente } from "@/lib/ventas";
import { listarPagosDeCliente, ultimaTasa } from "@/lib/pagos";
import { listarAdjuntosDeCliente } from "@/lib/adjuntos";
import { NOMBRE_ESTADO, aplicarPagos } from "@/lib/cuentas";
import { conVencimiento, describirVencimiento } from "@/lib/credito";
import { editarCliente, situarClienteEnElMapa, subirAdjunto } from "@/lib/acciones";
import { numeroDeNota, resumenDeLineas } from "@/lib/entregas";
import { leerTasa } from "@/lib/ajustes";
import { METODOS_PAGO, fechaCorta, fechaDeLaBase, formatearMonto, hoy, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { FormularioPago } from "@/components/formulario-pago";
import { EntradaFoto } from "@/components/entrada-foto";
import { negocio } from "@/config/negocio";
import { enlaceAlMapa, situar } from "@/lib/despacho";
import { explicarMotivo } from "@/lib/direcciones";
import { enlaceWhatsappA, esSoloUnTelefono, mensajeAbono, mensajeNota, mensajePedirResena, mensajeRecordatorio } from "@/lib/whatsapp";
import { rutaProducto } from "@/lib/enlaces";
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

  const [ventas, pagos, adjuntos, tasa, tasaDelDia] = await Promise.all([
    listarVentasDeCliente(cliente.id).then(conLineas),
    listarPagosDeCliente(cliente.id),
    listarAdjuntosDeCliente(cliente.id),
    ultimaTasa(),
    leerTasa(),
  ]);
  const cuentas = conVencimiento(aplicarPagos(ventas, cliente.total_pagado_usd), cliente.dias_credito, hoy());
  const vencido = cuentas.filter((c) => c.vencida).reduce((s, c) => s + c.pendiente_usd, 0);
  const ciudad = `${negocio.localidad}, ${negocio.estado}, Venezuela`;
  const situacion = situar(cliente, ciudad);
  const mapa = enlaceAlMapa(cliente, ciudad);
  const ventaDeAdjunto = new Map(ventas.map((v) => [v.id, v]));

  // Enlaces de WhatsApp: recordar la deuda y mandar cada nota. Solo si hay teléfono.
  const pendientes = cuentas.filter((c) => c.pendiente_usd > 0).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const recordatorio =
    cliente.saldo_usd > 0
      ? enlaceWhatsappA(
          cliente.telefono,
          mensajeRecordatorio({ negocio: negocio.nombre, cliente: cliente.nombre, saldo_usd: cliente.saldo_usd, pendientes, tasa }),
        )
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
      }),
    );

  // Pedirle su opinión de lo que ha comprado, para las reseñas de la web.
  const comprados = new Map(ventas.flatMap((v) => v.lineas).map((l) => [l.producto_id, l.producto_nombre]));
  const pedirResena = [...comprados]
    .map(([id, nombre]) => ({
      id,
      nombre,
      enlace: enlaceWhatsappA(
        cliente.telefono,
        mensajePedirResena({
          negocio: negocio.nombre,
          cliente: cliente.nombre,
          producto: nombre,
          enlace: direccionCompleta(rutaProducto({ id, nombre })),
        }),
      ),
    }))
    .filter((p): p is { id: number; nombre: string; enlace: string } => p.enlace !== null);

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
          <h1 className={estilos.titulo}>{cliente.nombre}</h1>
          {cliente.razon_social && <p className={estilos.ayuda} style={{ marginBottom: 0 }}>{cliente.razon_social}</p>}
          {esSoloUnTelefono(cliente.nombre) && (
            <p className={estilos.sinNombre}>
              Sin nombre: <Link href="#datos">ponlo en Datos</Link> cuando lo sepas.
            </p>
          )}
        </div>
        <div className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
          {recordatorio && (
            <a href={recordatorio} target="_blank" rel="noopener" className="boton boton--acento">
              Recordar deuda por WhatsApp
            </a>
          )}
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
                <label htmlFor="nombre">Nombre del cliente</label>
                <input id="nombre" name="nombre" type="text" defaultValue={esSoloUnTelefono(cliente.nombre) ? "" : cliente.nombre} placeholder={cliente.telefono} />
              </div>
              <div className="campo">
                <label htmlFor="razon_social">Razón social</label>
                <input id="razon_social" name="razon_social" type="text" defaultValue={cliente.razon_social} placeholder="Tutto Pan, C.A." />
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
                <label htmlFor="tipo">Le vendes</label>
                <select id="tipo" name="tipo" defaultValue={cliente.tipo}>
                  <option value="detal">Al detal</option>
                  <option value="mayor">Al mayor</option>
                </select>
              </div>
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

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Cuentas</h2>
        {cuentas.length === 0 ? (
          <p className="vacio">Sin ventas todavía.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Nota</th>
                  <th>Fecha</th>
                  <th>Productos</th>
                  <th className="numero">Total</th>
                  <th className="numero">Pendiente</th>
                  <th>Estado</th>
                  <th>Vence</th>
                  <th>Observación</th>
                  <th>
                    <span className="visualmente-oculto">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {cuentas.map((v) => (
                  <tr key={v.id}>
                    <td data-label="Nota">
                      <Link href={`/admin/ventas/${v.id}/nota`}>{numeroDeNota(v.id)}</Link>
                    </td>
                    <td data-label="Fecha">{fechaCorta(v.fecha)}</td>
                    <td data-label="Productos">{resumenDeLineas(v.lineas)}</td>
                    <td data-label="Total" className="numero">{usd(v.total_usd)}</td>
                    <td data-label="Pendiente" className="numero">{v.pendiente_usd > 0 ? usd(v.pendiente_usd) : "—"}</td>
                    <td data-label="Estado">
                      <span className={`${estilos.estado} ${estilos[`estado--${v.estado}`]}`}>
                        {NOMBRE_ESTADO[v.estado]}
                      </span>
                      {v.por_entregar ? (
                        <>
                          {" "}
                          <Link href="/admin/despacho" className={`${estilos.estado} ${estilos["estado--parcial"]}`}>
                            Por entregar
                          </Link>
                        </>
                      ) : null}
                    </td>
                    <td data-label="Vence">
                      {v.pendiente_usd > 0 ? (
                        <span className={v.vencida ? estilos.vencida : undefined}>{describirVencimiento(v.atraso)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td data-label="Observación">{v.nota || "—"}</td>
                    <td className={estilos.accionesFila}>
                      <Link href={`/admin/ventas/${v.id}/nota`}>Ver nota</Link>
                      {enlaceNota(v) && (
                        <a href={enlaceNota(v)!} target="_blank" rel="noopener" className={estilos.whatsapp}>
                          Enviar nota
                        </a>
                      )}
                      <Link href={`/admin/ventas/${v.id}/eliminar`} className="enlace-fila">
                        Eliminar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Abonos</h2>
        {pagos.length === 0 ? (
          <p className="vacio">Sin abonos todavía.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Método</th>
                  <th className="numero">Monto</th>
                  <th className="numero">Tasa</th>
                  <th className="numero">En USD</th>
                  <th>Referencia</th>
                  <th>
                    <span className="visualmente-oculto">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Fecha">{fechaCorta(p.fecha)}</td>
                    <td data-label="Método">{METODOS_PAGO[p.metodo]}</td>
                    <td data-label="Monto" className="numero">{formatearMonto(p.monto, p.moneda)}</td>
                    <td data-label="Tasa" className="numero">{p.tasa ? p.tasa.toFixed(2) : "—"}</td>
                    <td data-label="En USD" className="numero">{usd(p.monto_usd)}</td>
                    <td data-label="Referencia">{p.referencia || "—"}</td>
                    <td className={estilos.accionesFila}>
                      {enlaceRecibo(p) && (
                        <a href={enlaceRecibo(p)!} target="_blank" rel="noopener" className={estilos.whatsapp}>
                          Enviar recibo
                        </a>
                      )}
                      <Link href={`/admin/pagos/${p.id}/eliminar`} className="enlace-fila">
                        Eliminar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta">
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
                  <a href={`/admin/adjuntos/${a.id}`} target="_blank" rel="noopener">
                    {a.tipo === "application/pdf" ? (
                      <span className={estilos.miniaturaPdf}>PDF</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/admin/adjuntos/${a.id}`} alt={a.descripcion || "Nota de entrega"} loading="lazy" />
                    )}
                  </a>
                  <div className={estilos.miniaturaTexto}>
                    <strong>{a.descripcion || "Nota"}</strong>
                    <span>
                      {fechaCorta(fechaDeLaBase(a.creado_en))}
                      {venta ? ` · venta del ${fechaCorta(venta.fecha)} (${usd(venta.total_usd)})` : ""}
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
