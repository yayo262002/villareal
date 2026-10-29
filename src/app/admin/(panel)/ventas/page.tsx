import Link from "next/link";
import { listarClientes } from "@/lib/clientes";
import { conLineas, listarVentas } from "@/lib/ventas";
import { adjuntosDeVentas } from "@/lib/adjuntos";
import { facturasDeVentas } from "@/lib/facturas";
import { numeroDeFactura } from "@/lib/factura-calculo";
import { leerTasa, permitirStockNegativo } from "@/lib/ajustes";
import { numeroDeNota, resumenDeLineas } from "@/lib/entregas";
import { ventaCoincide } from "@/lib/buscar";
import { fechaCorta, hoy, usd } from "@/lib/dinero";
import { catalogoDelPos, clienteDeMostrador, siguienteNumeroDeVenta } from "@/lib/pos";
import { preciosEspecialesPorCliente } from "@/lib/precios-especiales";
import { lectorDisponible } from "@/lib/lector-de-notas";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { Pos, type ArticuloParaLaCaja, type ClienteParaLaCaja } from "@/components/pos";
import estilos from "../panel.module.css";

export const metadata = { title: "Ventas" };
/** Guardar una venta puede incluir leer la foto de la nota, que tarda unos segundos. */
export const maxDuration = 60;

const MAXIMO_AL_BUSCAR = 100;

/**
 * Ventas: arriba, registrar una venta como en una caja (cliente con su
 * saldo, buscador de productos, carrito, pago y confirmar); debajo, las
 * últimas ventas y el buscador. La pantalla de la caja trabaja sola con el
 * catálogo, las existencias, los clientes y la tasa que se le dan aquí; el
 * guardado vuelve al servidor con las reglas de siempre.
 */
export default async function PaginaVentas({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const texto = (campo: string) => (typeof parametros[campo] === "string" ? (parametros[campo] as string) : "");
  const busqueda = texto("q").trim();
  const [catalogo, clientes, tasa, precios, sinTope, mostrador, siguiente, ventas] = await Promise.all([
    catalogoDelPos(),
    listarClientes(),
    leerTasa(),
    preciosEspecialesPorCliente(),
    permitirStockNegativo(),
    clienteDeMostrador(),
    siguienteNumeroDeVenta(),
    // Sin buscar, las últimas 50. Buscando, se mira entre todas y se enseñan hasta 100.
    (busqueda
      ? listarVentas(100000).then((todas) => todas.filter((v) => ventaCoincide(v, busqueda)).slice(0, MAXIMO_AL_BUSCAR))
      : listarVentas(50)
    ).then(conLineas),
  ]);
  // La foto de la nota firmada de cada venta, para enlazarla desde su fila.
  const [fotos, facturas] = await Promise.all([adjuntosDeVentas(ventas.map((v) => v.id)), facturasDeVentas(ventas.map((v) => v.id))]);

  const paraLaCaja: ArticuloParaLaCaja[] = catalogo.map((a) => ({
    clave: a.clave,
    producto_id: a.producto_id,
    variante_id: a.variante_id,
    nombre: a.nombre,
    unidad: a.unidad as ArticuloParaLaCaja["unidad"],
    precio_usd: a.precio_usd,
    codigo_barras: a.codigo_barras,
    sku: a.sku,
    marca: a.marca,
    presentacionTexto: a.presentacionTexto,
    familia: a.familia,
    existencia: a.existencia,
    estado: a.estado,
    pesoTipico: a.pesoTipico?.peso ?? null,
  }));
  const paraElegir = (c: (typeof clientes)[number]): ClienteParaLaCaja => ({ id: c.id, rotulo: c.rotulo, nombre: c.nombre, telefono: c.telefono, cedula_rif: c.cedula_rif, saldo_usd: c.saldo_usd, dias_credito: c.dias_credito });
  const listaDeClientes = [paraElegir(mostrador), ...clientes.filter((c) => c.id !== mostrador.id).map(paraElegir)];
  // Las ventas recientes ya guardadas desde la caja: un carrito con una de esas claves ya se vendió.
  const clavesVendidas = [...ventas.map((v) => v.clave_pos), texto("vendida")].filter((c): c is string => Boolean(c));
  const clienteInicial = Number(texto("cliente")) || undefined;

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 className={estilos.titulo}>Ventas</h1>
        <div className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
          <Link href="#lista" className="boton boton--secundario">
            Últimas ventas
          </Link>
        </div>
      </div>
      <Avisos parametros={parametros} />

      <h2 className={estilos.subtitulo}>Registrar venta</h2>
      <Pos
        catalogo={paraLaCaja}
        clientes={listaDeClientes}
        mostradorId={mostrador.id}
        tasa={tasa?.valor ?? null}
        preciosEspeciales={precios}
        sinTope={sinTope}
        hoy={hoy()}
        siguienteNota={numeroDeNota(siguiente)}
        seLee={lectorDisponible()}
        clavesVendidas={clavesVendidas}
        claveDevuelta={texto("clave") || undefined}
        fotoEnEspera={texto("foto_espera") || undefined}
        pideConfirmar={parametros.confirmar === "1"}
        pideConfirmarNota={parametros.confirmar_nota === "1"}
        clienteInicial={clienteInicial && clienteInicial !== mostrador.id ? clienteInicial : undefined}
        error={texto("error") || undefined}
      />

      <section className="tarjeta" style={{ marginTop: "var(--espacio-4)" }}>
        <h2 className={estilos.subtitulo} id="lista">
          {busqueda ? `${ventas.length === MAXIMO_AL_BUSCAR ? "Más de " : ""}${ventas.length} ${ventas.length === 1 ? "venta" : "ventas"} con «${busqueda}»` : "Últimas ventas"}
        </h2>
        <form method="get" action="/admin/ventas#lista" className={estilos.buscador} role="search">
          <label htmlFor="buscar-venta" className="visualmente-oculto">
            Buscar una venta
          </label>
          <input id="buscar-venta" name="q" type="search" placeholder="Cliente, n.º de nota o fecha (30/09)" defaultValue={busqueda} />
          <button type="submit" className="boton boton--secundario">
            Buscar
          </button>
          {busqueda && (
            <Link href="/admin/ventas#lista" className={estilos.limpiar}>
              Ver las últimas
            </Link>
          )}
        </form>
        {ventas.length === 0 ? (
          <p className="vacio">{busqueda ? `Ninguna venta coincide con «${busqueda}».` : "Todavía no hay ventas."}</p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--fichas">
              <thead>
                <tr>
                  <th>Nota</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Productos</th>
                  <th className="numero">Total</th>
                  <th>Entrega</th>
                  <th>Factura</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => {
                  const foto = fotos.get(v.id)?.[0];
                  const factura = facturas.get(v.id);
                  return (
                    <tr key={v.id}>
                      <td data-label="Nota">
                        <Link href={`/admin/ventas/${v.id}/nota`}>{numeroDeNota(v.id)}</Link>
                        {v.origen === "pos" && <span className="ayuda"> · caja</span>}
                      </td>
                      <td data-label="Fecha">{fechaCorta(v.fecha)}</td>
                      <td data-label="Cliente">
                        <Link href={`/admin/clientes/${v.cliente_id}`}>{v.cliente_nombre}</Link>
                      </td>
                      <td data-label="Productos">{resumenDeLineas(v.lineas)}</td>
                      <td data-label="Total" className="numero">
                        {usd(v.total_usd)}
                      </td>
                      <td data-label="Entrega">
                        {v.por_entregar ? (
                          <Link href="/admin/despacho" className={`${estilos.estado} ${estilos["estado--parcial"]}`}>
                            Por entregar{v.entrega_prevista ? ` el ${fechaCorta(v.entrega_prevista)}` : ""}
                          </Link>
                        ) : (
                          <>
                            <span className={`${estilos.estado} ${estilos["estado--pagada"]}`}>Entregada</span>
                            {foto && (
                              <>
                                {" "}
                                <Link href={`/admin/adjuntos/${foto.id}/ver?volver_a=/admin/ventas`} title="La foto de la nota firmada">
                                  Foto
                                </Link>
                              </>
                            )}
                          </>
                        )}
                      </td>
                      <td data-label="Factura" data-vacio={factura ? undefined : ""}>
                        {factura ? (
                          <Link href={`/admin/facturas/${factura.id}`} className={`${estilos.estado} ${factura.estado === "anulada" ? estilos["estado--por_pagar"] : estilos["estado--pagada"]}`}>
                            {factura.estado === "anulada" ? `N.º ${numeroDeFactura(factura.numero)} anulada` : `N.º ${numeroDeFactura(factura.numero)}`}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
