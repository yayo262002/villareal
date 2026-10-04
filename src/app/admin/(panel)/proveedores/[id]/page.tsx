import Link from "next/link";
import { notFound } from "next/navigation";
import { negocio } from "@/config/negocio";
import { buscarProveedor, listarComprasDeProveedor, listarPagosDeProveedor } from "@/lib/proveedores";
import { ultimaTasa } from "@/lib/pagos";
import { NOMBRE_ESTADO, aplicarPagos } from "@/lib/cuentas";
import { conVencimiento, describirVencimiento } from "@/lib/credito";
import { cambiarEnlaceDeProveedor, editarProveedor, guardarCompra, guardarPagoProveedor } from "@/lib/acciones";
import { listarProductos } from "@/lib/productos";
import { listarVariantes } from "@/lib/variantes";
import { vendiblesDe } from "@/lib/catalogo";
import { existenciasPorClave } from "@/lib/inventario";
import { listarAdjuntosDeProveedor } from "@/lib/adjuntos";
import { enlaceWhatsappA, mensajeEnlaceDeProveedor } from "@/lib/whatsapp";
import { direccionDeCuentaDeProveedor } from "@/lib/enlace-cuenta";
import { METODOS_PAGO, fechaCorta, formatearMonto, hoy, usd, tasaLegible } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { FormularioPago } from "@/components/formulario-pago";
import { FilaDeProducto } from "@/components/fila-de-producto";
import { TotalDeVenta } from "@/components/total-de-venta";
import estilos from "../../panel.module.css";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proveedor = await buscarProveedor(Number(id));
  return { title: proveedor?.nombre ?? "Proveedor" };
}

/** Lo que el formulario de compra trae ya escrito: al volver con un aviso, nada se pierde. */
function escrito(datos: ParametrosAviso, campo: string): string {
  const valor = datos[campo];
  return typeof valor === "string" ? valor : "";
}

/** La ficha de un proveedor: lo que le has comprado, lo que le has pagado y lo que le debes. */
export default async function PaginaProveedor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ParametrosAviso>;
}) {
  const { id } = await params;
  const parametros = await searchParams;
  const proveedor = await buscarProveedor(Number(id));
  if (!proveedor) notFound();

  const [compras, pagos, adjuntos, tasa, productos, variantes, existencias] = await Promise.all([
    listarComprasDeProveedor(proveedor.id),
    listarPagosDeProveedor(proveedor.id),
    listarAdjuntosDeProveedor(proveedor.id),
    ultimaTasa(),
    listarProductos(true),
    listarVariantes(),
    existenciasPorClave(),
  ]);
  const vendibles = vendiblesDe(productos, variantes);
  const pideConfirmar = parametros.confirmar === "1";
  const cuentas = conVencimiento(aplicarPagos(compras, proveedor.total_pagado_usd), proveedor.dias_credito, hoy());
  const vencido = cuentas.filter((c) => c.vencida).reduce((s, c) => s + c.pendiente_usd, 0);
  // La captura de cada pago, para enlazarla desde su fila.
  const capturaDe = new Map(adjuntos.filter((a) => a.pago_proveedor_id).map((a) => [a.pago_proveedor_id, a.id]));
  // Para mandarle su enlace personal, con el que ve nuestra cuenta con él sin clave.
  const mandarEnlace = proveedor.enlace
    ? enlaceWhatsappA(
        proveedor.telefono,
        mensajeEnlaceDeProveedor({ negocio: negocio.nombre, proveedor: proveedor.nombre, enlace: direccionDeCuentaDeProveedor(proveedor.enlace) }),
      )
    : null;

  const claseSaldo = proveedor.saldo_usd > 0 ? estilos.deuda : proveedor.saldo_usd < 0 ? estilos.favor : estilos.saldado;
  const textoSaldo =
    proveedor.saldo_usd > 0
      ? `Le debo ${usd(proveedor.saldo_usd)}`
      : proveedor.saldo_usd < 0
        ? `A mi favor ${usd(-proveedor.saldo_usd)}`
        : "Al día";

  return (
    <>
      <div className={estilos.encabezado}>
        <div>
          <p>
            <Link href="/admin/proveedores">← Proveedores</Link>
          </p>
          <h1 className={estilos.titulo}>{proveedor.nombre}</h1>
        </div>
      </div>
      <Avisos parametros={parametros} />

      <dl className={estilos.cifras}>
        <div className={estilos.cifra}>
          <dt>Comprado</dt>
          <dd>{usd(proveedor.total_comprado_usd)}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Pagado</dt>
          <dd>{usd(proveedor.total_pagado_usd)}</dd>
        </div>
        <div className={estilos.cifra}>
          <dt>Saldo</dt>
          <dd className={claseSaldo}>{textoSaldo}</dd>
        </div>
        <div className={`${estilos.cifra} ${vencido > 0 ? estilos["cifra--alerta"] : ""}`}>
          <dt>Vencido</dt>
          <dd>{usd(vencido)}</dd>
        </div>
      </dl>

      <section className="tarjeta" id="compra">
        <h2 className={estilos.subtitulo}>Registrar compra</h2>
        <p className={estilos.ayuda}>
          Como la nota del proveedor: una fila por producto con los kilos (o cartones) y lo que costó cada uno. Con eso entra el{" "}
          <Link href="/admin/inventario">inventario</Link>.
        </p>
        <form action={guardarCompra} className="formulario">
          <input type="hidden" name="proveedor_id" value={proveedor.id} />
          <div className="campo">
            <label htmlFor="compra-fecha">Fecha de la compra</label>
            <input id="compra-fecha" name="fecha" type="date" required max={hoy()} defaultValue={escrito(parametros, "fecha") || hoy()} />
          </div>

          {vendibles.map((v) => {
            const inventario = existencias.get(v.clave);
            return (
              <FilaDeProducto
                key={v.clave}
                producto={v}
                datos={parametros}
                modo="compra"
                existencia={inventario?.seguido ? inventario.existencia : null}
                ultimoCosto={inventario?.ultimoCosto ?? null}
              />
            );
          })}

          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="compra-otros">Otras cosas, en dólares</label>
              <input
                id="compra-otros"
                name="otros_usd"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="opcional"
                defaultValue={escrito(parametros, "otros_usd")}
              />
              <span className="ayuda">Lo que no es un producto: flete, hielo, bolsas.</span>
            </div>
            <div className="campo">
              <label htmlFor="compra-descripcion">Qué compraste</label>
              <input
                id="compra-descripcion"
                name="descripcion"
                type="text"
                placeholder="Si lo dejas vacío, se escribe solo"
                defaultValue={escrito(parametros, "descripcion")}
              />
            </div>
          </div>
          <TotalDeVenta claves={vendibles.map((v) => v.clave)} tasa={null} rotulo="Total de la compra" campoExtra="otros_usd" />

          {pideConfirmar && (
            <label className={estilos.casilla}>
              <input type="checkbox" name="confirmar" value="1" />
              <span>Lo escrito es correcto: guardar igual</span>
            </label>
          )}

          <div className="campo">
            <label htmlFor="compra-nota">Nota</label>
            <input id="compra-nota" name="nota" type="text" placeholder="Factura n.º 1234" defaultValue={escrito(parametros, "nota")} />
          </div>
          <p className="ayuda">
            Vence a los {proveedor.dias_credito} días de la fecha. Se cambia en Datos.
          </p>
          <div>
            <button type="submit" className="boton">
              Registrar compra
            </button>
          </div>
        </form>
      </section>

      <section className="tarjeta" id="pago">
        <h2 className={estilos.subtitulo}>Registrar pago al proveedor</h2>
        <FormularioPago
          quien="proveedor"
          clientes={[{ id: proveedor.id, rotulo: proveedor.nombre, saldo_usd: proveedor.saldo_usd }]}
          clienteFijo={proveedor.id}
          ultimaTasa={tasa}
          volverA={`/admin/proveedores/${proveedor.id}`}
          parametros={parametros}
          accion={guardarPagoProveedor}
          campoId="proveedor_id"
          etiqueta="Proveedor"
          textoDelBoton="Registrar pago"
        />
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Compras</h2>
        {cuentas.length === 0 ? (
          <p className="vacio">Sin compras todavía.</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Qué</th>
                  <th className="numero">Total</th>
                  <th className="numero">Pendiente</th>
                  <th>Estado</th>
                  <th>Vence</th>
                  <th>
                    <span className="visualmente-oculto">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {cuentas.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Fecha">{fechaCorta(c.fecha)}</td>
                    <td data-label="Qué">{c.descripcion || c.nota || "—"}</td>
                    <td data-label="Total" className="numero">{usd(c.total_usd)}</td>
                    <td data-label="Pendiente" className="numero">{c.pendiente_usd > 0 ? usd(c.pendiente_usd) : "—"}</td>
                    <td data-label="Estado">
                      <span className={`${estilos.estado} ${estilos[`estado--${c.estado}`]}`}>{NOMBRE_ESTADO[c.estado]}</span>
                    </td>
                    <td data-label="Vence">
                      {c.pendiente_usd > 0 ? (
                        <span className={c.vencida ? estilos.vencida : undefined}>{describirVencimiento(c.atraso)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <Link href={`/admin/compras/${c.id}/eliminar`} className="enlace-fila">
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
        <h2 className={estilos.subtitulo}>Pagos hechos</h2>
        {pagos.length === 0 ? (
          <p className="vacio">Sin pagos todavía.</p>
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
                    <td data-label="Tasa" className="numero" data-vacio={p.tasa ? undefined : ""}>{p.tasa ? tasaLegible(p.tasa) : "—"}</td>
                    <td data-label="En USD" className="numero">{usd(p.monto_usd)}</td>
                    <td data-label="Referencia" data-vacio={p.referencia ? undefined : ""}>{p.referencia || "—"}</td>
                    <td className={estilos.accionesFila}>
                      {capturaDe.has(p.id) && (
                        <a href={`/admin/adjuntos-proveedor/${capturaDe.get(p.id)}`} target="_blank" rel="noopener" className="enlace-fila">
                          Captura
                        </a>
                      )}
                      <Link href={`/admin/pagos-proveedor/${p.id}/eliminar`} className="enlace-fila">
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

      {/* El enlace personal con el que el proveedor ve nuestra cuenta con él, sin clave. */}
      <section className="tarjeta" id="enlace">
        <h2 className={estilos.subtitulo}>Su enlace de cuenta</h2>
        {proveedor.enlace ? (
          <>
            <p className={estilos.ayuda}>
              Con este enlace ve en su teléfono lo que le debemos, cada compra con lo pagado y cada pago con su comprobante, siempre al día y sin
              clave. Es solo suyo: si se compartió de más, renuévalo y el anterior deja de funcionar.
            </p>
            <p className={estilos.enlaceDeCuenta}>
              <a href={direccionDeCuentaDeProveedor(proveedor.enlace)} target="_blank" rel="noopener">
                {direccionDeCuentaDeProveedor(proveedor.enlace)}
              </a>
            </p>
            <div className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
              {mandarEnlace && (
                <a href={mandarEnlace} target="_blank" rel="noopener" className="boton boton--acento">
                  Mandárselo por WhatsApp
                </a>
              )}
              <form action={cambiarEnlaceDeProveedor}>
                <input type="hidden" name="id" value={proveedor.id} />
                <input type="hidden" name="enlace_de_cuenta" value="renovar" />
                <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                  Renovar el enlace
                </button>
              </form>
            </div>
          </>
        ) : (
          <form action={cambiarEnlaceDeProveedor}>
            <p className={estilos.ayuda}>
              Crea su enlace personal y mándaselo por WhatsApp: con él ve lo que le debemos, cada compra y cada pago con su comprobante, siempre
              al día y sin clave.
            </p>
            <input type="hidden" name="id" value={proveedor.id} />
            <input type="hidden" name="enlace_de_cuenta" value="crear" />
            <button type="submit" className="boton">
              Crear su enlace de cuenta
            </button>
          </form>
        )}
      </section>

      <section className="tarjeta" id="datos">
        <h2 className={estilos.subtitulo}>Datos</h2>
        <form action={editarProveedor} className="formulario">
          <input type="hidden" name="id" value={proveedor.id} />
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="nombre">Nombre o empresa</label>
              <input id="nombre" name="nombre" type="text" defaultValue={proveedor.nombre} />
            </div>
            <div className="campo">
              <label htmlFor="telefono">Teléfono</label>
              <input id="telefono" name="telefono" type="tel" inputMode="tel" defaultValue={proveedor.telefono} />
            </div>
          </div>
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="dias_credito">Días de crédito que te da</label>
              <input
                id="dias_credito"
                name="dias_credito"
                type="number"
                inputMode="numeric"
                min="0"
                max="365"
                step="1"
                defaultValue={proveedor.dias_credito}
              />
            </div>
            <div className="campo">
              <label htmlFor="cedula_rif">Cédula o RIF</label>
              <input id="cedula_rif" name="cedula_rif" type="text" defaultValue={proveedor.cedula_rif} />
            </div>
          </div>
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="direccion">Dirección</label>
              <input id="direccion" name="direccion" type="text" defaultValue={proveedor.direccion} />
            </div>
            <div className="campo">
              <label htmlFor="nota">Nota</label>
              <input id="nota" name="nota" type="text" defaultValue={proveedor.nota} />
            </div>
          </div>
          <div className={estilos.accionesFila} style={{ flexWrap: "wrap", justifyContent: "space-between" }}>
            <button type="submit" className="boton boton--secundario">
              Guardar cambios
            </button>
            <Link href={`/admin/proveedores/${proveedor.id}/eliminar`} className="enlace-fila">
              Eliminar proveedor
            </Link>
          </div>
        </form>
      </section>
    </>
  );
}
