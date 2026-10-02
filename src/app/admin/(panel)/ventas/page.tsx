import Link from "next/link";
import { listarClientes } from "@/lib/clientes";
import { listarProductos } from "@/lib/productos";
import { listarVariantes } from "@/lib/variantes";
import { vendiblesDe, type Vendible } from "@/lib/catalogo";
import { conLineas, listarVentas } from "@/lib/ventas";
import { guardarVenta } from "@/lib/acciones";
import { leerTasa } from "@/lib/ajustes";
import { numeroDeNota, resumenDeLineas } from "@/lib/entregas";
import { ventaCoincide } from "@/lib/buscar";
import { fechaCorta, hoy, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { TotalDeVenta } from "@/components/total-de-venta";
import { EntradaFoto } from "@/components/entrada-foto";
import { lectorDisponible } from "@/lib/lector-de-notas";
import estilos from "../panel.module.css";

export const metadata = { title: "Ventas" };
/** Guardar una venta puede incluir leer la foto de la nota, que tarda unos segundos. */
export const maxDuration = 60;

const MAXIMO_AL_BUSCAR = 100;

/** Lo que el formulario trae ya escrito: al volver con un aviso, nada se pierde. */
type Escrito = Record<string, string | string[] | undefined>;
function escrito(datos: Escrito, campo: string): string {
  const valor = datos[campo];
  return typeof valor === "string" ? valor : "";
}

/**
 * Una fila por producto (o por cada marca o presentación, si las tiene),
 * como la nota de papel: piezas (si se anotan), kilos o cartones, y el
 * precio en dólares que se escribe cada vez. El importe lo calcula el
 * servidor con los kilos.
 */
function FilaDeVenta({ producto, datos }: { producto: Vendible; datos: Escrito }) {
  const porKilo = producto.unidad === "kg";
  const unidad = porKilo ? "Kilos" : producto.unidad === "carton" ? "Cartones" : "Unidades";
  const porUna = porKilo ? "USD por kilo" : producto.unidad === "carton" ? "USD por cartón" : "USD por unidad";
  const lista = [
    producto.precio_usd !== null ? `detal ${usd(producto.precio_usd)}` : "",
    producto.precio_mayor_usd !== null ? `mayor ${usd(producto.precio_mayor_usd)}` : "",
  ].filter(Boolean);
  return (
    <fieldset className={`${estilos.filaVenta} ${porKilo ? "" : estilos["filaVenta--dos"]}`}>
      <legend>{producto.nombre}</legend>
      {/* Las piezas son cosa del queso: un cartón de huevos no tiene piezas. */}
      {porKilo && (
        <div className="campo">
          <label htmlFor={`piezas_${producto.clave}`}>Piezas</label>
          <input
            id={`piezas_${producto.clave}`}
            name={`piezas_${producto.clave}`}
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            placeholder="opcional"
            defaultValue={escrito(datos, `piezas_${producto.clave}`)}
          />
        </div>
      )}
      <div className="campo">
        <label htmlFor={`cantidad_${producto.clave}`}>{unidad}</label>
        <input
          id={`cantidad_${producto.clave}`}
          name={`cantidad_${producto.clave}`}
          type="number"
          inputMode="decimal"
          step={porKilo ? "0.001" : "1"}
          min="0"
          defaultValue={escrito(datos, `cantidad_${producto.clave}`)}
        />
      </div>
      <div className="campo">
        <label htmlFor={`precio_${producto.clave}`}>{porUna}</label>
        <input
          id={`precio_${producto.clave}`}
          name={`precio_${producto.clave}`}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder={producto.precio_usd !== null ? String(producto.precio_usd) : ""}
          defaultValue={escrito(datos, `precio_${producto.clave}`)}
        />
      </div>
      {lista.length > 0 && <span className={estilos.filaVentaLista}>En la lista: {lista.join(" · ")}</span>}
    </fieldset>
  );
}

export default async function PaginaVentas({
  searchParams,
}: {
  searchParams: Promise<ParametrosAviso>;
}) {
  const parametros = await searchParams;
  const clientePreseleccionado = typeof parametros.cliente === "string" ? parametros.cliente : "";
  const busqueda = typeof parametros.q === "string" ? parametros.q.trim() : "";
  // Sin buscar, las últimas 50. Buscando, se mira entre todas y se enseñan hasta 100.
  // Si la venta volvió con un aviso, el formulario trae lo que se había escrito.
  const pideConfirmar = parametros.confirmar === "1";
  const pideConfirmarNota = parametros.confirmar_nota === "1";
  // La foto que se puso en el intento anterior sigue guardada: no hay que repetirla.
  const fotoEnEspera = escrito(parametros, "foto_espera");
  const seLee = lectorDisponible();
  const [clientes, productos, variantes, tasa, ventas] = await Promise.all([
    listarClientes(),
    listarProductos(true),
    listarVariantes(),
    leerTasa(),
    (busqueda
      ? listarVentas(100000).then((todas) => todas.filter((v) => ventaCoincide(v, busqueda)).slice(0, MAXIMO_AL_BUSCAR))
      : listarVentas(50)
    ).then(conLineas),
  ]);
  const vendibles = vendiblesDe(productos, variantes);

  return (
    <>
      <h1 className={estilos.titulo}>Ventas</h1>
      <Avisos parametros={parametros} />

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Registrar venta</h2>
        {clientes.length === 0 ? (
          <p className="aviso aviso--aviso">
            Primero <Link href="/admin/clientes">registra un cliente</Link>.
          </p>
        ) : (
          <form action={guardarVenta} className="formulario" encType="multipart/form-data">
            <div className="formulario__fila">
              <div className="campo">
                <label htmlFor="venta-cliente">Cliente</label>
                <select id="venta-cliente" name="cliente_id" required defaultValue={escrito(parametros, "cliente_id") || clientePreseleccionado}>
                  <option value="" disabled>
                    Elige un cliente
                  </option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.rotulo}
                      {c.tipo === "mayor" ? " (al mayor)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="venta-fecha">Fecha de despacho</label>
                <input id="venta-fecha" name="fecha" type="date" required max={hoy()} defaultValue={escrito(parametros, "fecha") || hoy()} />
                <span className="ayuda">La de la nota de papel, aunque sea de días atrás: los días de crédito cuentan desde ahí.</span>
              </div>
            </div>

            {vendibles.map((v) => (
              <FilaDeVenta key={v.clave} producto={v} datos={parametros} />
            ))}
            <TotalDeVenta claves={vendibles.map((v) => v.clave)} tasa={tasa?.valor ?? null} />

            {pideConfirmar && (
              <label className={estilos.casilla}>
                <input type="checkbox" name="confirmar" value="1" />
                <span>Los precios y las cantidades son correctos: guardar igual</span>
              </label>
            )}

            <fieldset className={estilos.entregaVenta}>
              <legend>Entrega</legend>
              <div className="campo">
                <label htmlFor="venta-entrega">¿Ya se la entregaste?</label>
                <select id="venta-entrega" name="entrega" required defaultValue={escrito(parametros, "entrega")}>
                  <option value="" disabled>
                    Elige una
                  </option>
                  <option value="local">Sí, ya la entregué</option>
                  <option value="despacho">No, queda por entregar</option>
                </select>
              </div>
              <div className="formulario__fila">
                <div className="campo">
                  <label htmlFor="venta-foto">Si ya la entregaste: foto de la nota firmada</label>
                  {fotoEnEspera && <input type="hidden" name="foto_espera" value={fotoEnEspera} />}
                  <EntradaFoto nombre="foto" id="venta-foto" opcional soloFoto />
                  <span className="ayuda">
                    {fotoEnEspera
                      ? "La foto que pusiste ya está guardada; solo pon otra si quieres cambiarla."
                      : "La hoja con la firma del cliente. Obligatoria si ya se entregó."}
                    {seLee && " Se lee sola: si no es la nota, o su fecha o su suma no cuadran con lo anotado, avisa."}
                  </span>
                  {pideConfirmarNota && (
                    <label className={estilos.casilla}>
                      <input type="checkbox" name="confirmar_nota" value="1" />
                      <span>Ya revisé la foto de la nota: guardar igual</span>
                    </label>
                  )}
                </div>
                <div className="campo">
                  <label htmlFor="venta-entrega-prevista">Si queda por entregar: día previsto</label>
                  <input id="venta-entrega-prevista" name="entrega_prevista" type="date" defaultValue={escrito(parametros, "entrega_prevista")} />
                  <span className="ayuda">Sale en el despacho y el resumen te lo recuerda.</span>
                </div>
              </div>
            </fieldset>
            <div className="campo">
              <label htmlFor="venta-nota">Observación</label>
              <input id="venta-nota" name="nota" type="text" defaultValue={escrito(parametros, "nota")} />
            </div>
            <div>
              <button type="submit" className="boton">
                Registrar venta
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo} id="lista">
          {busqueda ? `${ventas.length === MAXIMO_AL_BUSCAR ? "Más de " : ""}${ventas.length} ${ventas.length === 1 ? "venta" : "ventas"} con «${busqueda}»` : "Últimas ventas"}
        </h2>
        <form method="get" action="/admin/ventas#lista" className={estilos.buscador} role="search">
          <label htmlFor="buscar-venta" className="visualmente-oculto">
            Buscar una venta
          </label>
          <input
            id="buscar-venta"
            name="q"
            type="search"
            placeholder="Cliente, n.º de nota o fecha (30/09)"
            defaultValue={busqueda}
          />
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
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id}>
                    <td data-label="Nota">
                      <Link href={`/admin/ventas/${v.id}/nota`}>{numeroDeNota(v.id)}</Link>
                    </td>
                    <td data-label="Fecha">{fechaCorta(v.fecha)}</td>
                    <td data-label="Cliente">
                      <Link href={`/admin/clientes/${v.cliente_id}`}>{v.cliente_nombre}</Link>
                    </td>
                    <td data-label="Productos">{resumenDeLineas(v.lineas)}</td>
                    <td data-label="Total" className="numero">{usd(v.total_usd)}</td>
                    <td data-label="Entrega">
                      {v.por_entregar ? (
                        <Link href="/admin/despacho" className={`${estilos.estado} ${estilos["estado--parcial"]}`}>
                          Por entregar{v.entrega_prevista ? ` el ${fechaCorta(v.entrega_prevista)}` : ""}
                        </Link>
                      ) : (
                        <span className={`${estilos.estado} ${estilos["estado--pagada"]}`}>Entregada</span>
                      )}
                    </td>
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
