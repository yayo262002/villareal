import Link from "next/link";
import { listarClientes } from "@/lib/clientes";
import { listarProductos } from "@/lib/productos";
import { listarVariantes } from "@/lib/variantes";
import { vendiblesDe } from "@/lib/catalogo";
import { guardarVenta } from "@/lib/acciones";
import { leerTasa } from "@/lib/ajustes";
import { hoy } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { TotalDeVenta } from "@/components/total-de-venta";
import { FilaDeProducto } from "@/components/fila-de-producto";
import { existenciasPorClave } from "@/lib/inventario";
import { EntradaFoto } from "@/components/entrada-foto";
import { lectorDisponible } from "@/lib/lector-de-notas";
import estilos from "../../panel.module.css";

export const metadata = { title: "Registrar venta (formulario clásico)" };
/** Guardar una venta puede incluir leer la foto de la nota, que tarda unos segundos. */
export const maxDuration = 60;

/** Lo que el formulario trae ya escrito: al volver con un aviso, nada se pierde. */
type Escrito = Record<string, string | string[] | undefined>;
function escrito(datos: Escrito, campo: string): string {
  const valor = datos[campo];
  return typeof valor === "string" ? valor : "";
}

/**
 * El formulario de venta de siempre, como la nota de papel: una fila por
 * producto. Es el respaldo de la caja de Ventas: funciona sin JavaScript y
 * sirve si un día el navegador no carga la caja. Las mismas reglas, la
 * misma acción (`guardarVenta`).
 */
export default async function PaginaVentaClasica({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const clientePreseleccionado = typeof parametros.cliente === "string" ? parametros.cliente : "";
  const pideConfirmar = parametros.confirmar === "1";
  const pideConfirmarNota = parametros.confirmar_nota === "1";
  // La foto que se puso en el intento anterior sigue guardada: no hay que repetirla.
  const fotoEnEspera = escrito(parametros, "foto_espera");
  const seLee = lectorDisponible();
  const [clientes, productos, variantes, tasa, existencias] = await Promise.all([listarClientes(), listarProductos(true), listarVariantes(), leerTasa(), existenciasPorClave()]);
  const vendibles = vendiblesDe(productos, variantes);

  return (
    <>
      <div>
        <p>
          <Link href="/admin/ventas">← Ventas</Link>
        </p>
        <h1 className={estilos.titulo}>Registrar venta (formulario clásico)</h1>
      </div>
      <Avisos parametros={parametros} />
      <p className={estilos.ayuda}>
        Una fila por producto, como la nota de papel. La caja de <Link href="/admin/ventas">Ventas</Link> hace lo mismo más rápido, con buscador y
        carrito; este formulario queda de respaldo y funciona sin JavaScript.
      </p>

      <section className="tarjeta">
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
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="venta-fecha">Fecha de la nota</label>
                <input id="venta-fecha" name="fecha" type="date" required max={hoy()} defaultValue={escrito(parametros, "fecha") || hoy()} />
                <span className="ayuda">La que lleva la nota de papel, aunque sea de días atrás: los días de crédito cuentan desde ahí. No es el día de entrega.</span>
              </div>
            </div>

            {vendibles.map((v) => {
              const inventario = existencias.get(v.clave);
              return (
                <FilaDeProducto
                  key={v.clave}
                  producto={v}
                  datos={parametros}
                  modo="venta"
                  existencia={inventario?.seguido ? inventario.existencia : null}
                  pesoTipico={inventario?.pesoPorPieza ?? null}
                />
              );
            })}
            <TotalDeVenta claves={vendibles.map((v) => v.clave)} tasa={tasa?.valor ?? null} />

            {pideConfirmar && (
              <label className={estilos.casilla}>
                <input type="checkbox" name="confirmar" value="1" />
                <span>Lo escrito es correcto: guardar igual</span>
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
                  <span className="ayuda">Solo si queda por entregar. Sale en el despacho y el resumen te lo recuerda.</span>
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
    </>
  );
}
