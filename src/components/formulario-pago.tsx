import { guardarPago } from "@/lib/acciones";
import { METODOS_PAGO, METODOS_EN_BOLIVARES, METODOS_CON_COMPROBANTE, hoy } from "@/lib/dinero";
import type { ClienteConSaldo } from "@/lib/clientes";
import { lectorDisponible } from "@/lib/lector-de-notas";
import { EntradaFoto } from "@/components/entrada-foto";
import estilos from "@/app/admin/(panel)/panel.module.css";

/** Lo que el formulario trae ya escrito (al volver con un aviso, o leído de la captura). */
type Escrito = Record<string, string | string[] | undefined>;

function escrito(datos: Escrito | undefined, campo: string): string {
  const valor = datos?.[campo];
  return typeof valor === "string" ? valor : "";
}

type Props = {
  clientes: Pick<ClienteConSaldo, "id" | "rotulo" | "saldo_usd">[];
  /** Si viene, el cliente queda fijo y no se muestra el selector. */
  clienteFijo?: number;
  ultimaTasa: number | null;
  volverA: string;
  /** Lo que venía en la dirección: el formulario vuelve relleno. */
  parametros?: Escrito;
  /** Con la captura del pago, que se guarda con el abono y, si hay lector, se lee. No para proveedores. */
  conCaptura?: boolean;
  /** Para los pagos a proveedores: otra acción y otro nombre del campo. */
  accion?: (datos: FormData) => Promise<void>;
  campoId?: string;
  etiqueta?: string;
  textoDelBoton?: string;
};

/**
 * Se usa en la página de pagos, en la ficha de cada cliente y, con otra
 * acción, en la de cada proveedor. Los métodos en bolívares llevan la tasa
 * como campo obligatorio; los demás la ignoran. Con la captura del pago,
 * el monto se puede dejar vacío: se lee de ella.
 */
export function FormularioPago({
  clientes,
  clienteFijo,
  ultimaTasa,
  volverA,
  parametros,
  conCaptura = true,
  accion = guardarPago,
  campoId = "cliente_id",
  etiqueta = "Cliente",
  textoDelBoton = "Registrar abono",
}: Props) {
  const fotoEnEspera = conCaptura ? escrito(parametros, "foto_espera") : "";
  const leida = escrito(parametros, "leida") === "1";
  const pideConfirmar = escrito(parametros, "confirmar_captura") === "1";
  const seLee = conCaptura && lectorDisponible();

  return (
    <form action={accion} className="formulario" encType={conCaptura ? "multipart/form-data" : undefined}>
      <input type="hidden" name="volver_a" value={volverA} />

      {clienteFijo ? (
        <input type="hidden" name={campoId} value={clienteFijo} />
      ) : (
        <div className="campo">
          <label htmlFor="pago-cliente">{etiqueta}</label>
          <select id="pago-cliente" name={campoId} required defaultValue={escrito(parametros, campoId)}>
            <option value="" disabled>
              Elige un cliente
            </option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rotulo}
                {c.saldo_usd > 0 ? ` (debe $${c.saldo_usd.toFixed(2)})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="formulario__fila">
        <div className="campo">
          <label htmlFor="pago-fecha">Fecha</label>
          <input id="pago-fecha" name="fecha" type="date" required defaultValue={escrito(parametros, "fecha") || hoy()} />
        </div>
        <div className="campo">
          <label htmlFor="pago-metodo">{conCaptura ? "Cómo pagó" : "Método"}</label>
          <select id="pago-metodo" name="metodo" required defaultValue={escrito(parametros, "metodo")}>
            <option value="" disabled>
              {conCaptura ? "Elige cómo pagó" : "Elige el método"}
            </option>
            {Object.entries(METODOS_PAGO).map(([valor, nombre]) => (
              <option key={valor} value={valor}>
                {nombre}
                {METODOS_EN_BOLIVARES.includes(valor as keyof typeof METODOS_PAGO) ? " (Bs)" : " (USD)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="formulario__fila">
        <div className="campo">
          <label htmlFor="pago-monto">Monto</label>
          <input
            id="pago-monto"
            name="monto"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required={!conCaptura}
            defaultValue={escrito(parametros, "monto")}
          />
          <span className="ayuda">
            {leida
              ? "Monto, método, fecha y referencia leídos de la captura: revísalos y guarda."
              : `Lo que paga ahora, sea todo o una parte. En la moneda del método.${seLee ? " Con la captura puesta, déjalo vacío y se lee de ella." : ""}`}
          </span>
        </div>
        <div className="campo">
          <label htmlFor="pago-tasa">Tasa del día (Bs por dólar)</label>
          <input
            id="pago-tasa"
            name="tasa"
            type="number"
            inputMode="decimal"
            step="any"
            min="0.01"
            defaultValue={escrito(parametros, "tasa") || ultimaTasa || undefined}
          />
          <span className="ayuda">Solo para pagos en bolívares. Se guarda con el pago.</span>
        </div>
      </div>

      <div className="formulario__fila">
        <div className="campo">
          <label htmlFor="pago-referencia">Referencia</label>
          <input id="pago-referencia" name="referencia" type="text" placeholder="Últimos dígitos" defaultValue={escrito(parametros, "referencia")} />
        </div>
        <div className="campo">
          <label htmlFor="pago-nota">Nota</label>
          <input id="pago-nota" name="nota" type="text" defaultValue={escrito(parametros, "nota")} />
        </div>
      </div>

      {conCaptura && (
        <div className="campo">
          <label htmlFor="pago-captura">Comprobante de pago</label>
          {fotoEnEspera && <input type="hidden" name="foto_espera" value={fotoEnEspera} />}
          <EntradaFoto nombre="foto" id="pago-captura" opcional soloFoto ladoMaximo={1400} />
          <span className="ayuda">
            {fotoEnEspera
              ? "La captura ya está guardada; solo pon otra si quieres cambiarla."
              : `La captura del pago. Obligatoria con ${METODOS_CON_COMPROBANTE.map((m) => METODOS_PAGO[m]).join(", ").replace(/, ([^,]+)$/, " y $1").toLowerCase()}; en efectivo no hace falta. Queda guardada con el abono.`}
            {seLee && !fotoEnEspera ? " Se lee sola: monto, fecha y referencia, y se pasa a dólares con la tasa del día." : ""}
          </span>
          {pideConfirmar && (
            <label className={estilos.casilla}>
              <input type="checkbox" name="confirmar_captura" value="1" />
              <span>Ya revisé la captura: guardar igual</span>
            </label>
          )}
        </div>
      )}

      <div>
        <button type="submit" className="boton">
          {textoDelBoton}
        </button>
      </div>
    </form>
  );
}
