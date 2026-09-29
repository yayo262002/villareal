import { guardarPago } from "@/lib/acciones";
import { METODOS_PAGO, METODOS_EN_BOLIVARES, hoy } from "@/lib/dinero";
import type { ClienteConSaldo } from "@/lib/clientes";

type Props = {
  clientes: Pick<ClienteConSaldo, "id" | "nombre" | "saldo_usd">[];
  /** Si viene, el cliente queda fijo y no se muestra el selector. */
  clienteFijo?: number;
  ultimaTasa: number | null;
  volverA: string;
};

/**
 * Se usa en la página de pagos y en la ficha de cada cliente. Los métodos
 * en bolívares llevan la tasa como campo obligatorio; los demás la ignoran.
 */
export function FormularioPago({ clientes, clienteFijo, ultimaTasa, volverA }: Props) {
  return (
    <form action={guardarPago} className="formulario">
      <input type="hidden" name="volver_a" value={volverA} />

      {clienteFijo ? (
        <input type="hidden" name="cliente_id" value={clienteFijo} />
      ) : (
        <div className="campo">
          <label htmlFor="pago-cliente">Cliente</label>
          <select id="pago-cliente" name="cliente_id" required defaultValue="">
            <option value="" disabled>
              Elige un cliente
            </option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {c.saldo_usd > 0 ? ` (debe $${c.saldo_usd.toFixed(2)})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="formulario__fila">
        <div className="campo">
          <label htmlFor="pago-fecha">Fecha</label>
          <input id="pago-fecha" name="fecha" type="date" required defaultValue={hoy()} />
        </div>
        <div className="campo">
          <label htmlFor="pago-metodo">Método</label>
          <select id="pago-metodo" name="metodo" required defaultValue="pago_movil">
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
            required
          />
          <span className="ayuda">En la moneda del método: bolívares o dólares.</span>
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
            defaultValue={ultimaTasa ?? undefined}
          />
          <span className="ayuda">Solo para pagos en bolívares. Se guarda con el pago.</span>
        </div>
      </div>

      <div className="formulario__fila">
        <div className="campo">
          <label htmlFor="pago-referencia">Referencia</label>
          <input id="pago-referencia" name="referencia" type="text" placeholder="Últimos dígitos" />
        </div>
        <div className="campo">
          <label htmlFor="pago-nota">Nota</label>
          <input id="pago-nota" name="nota" type="text" />
        </div>
      </div>

      <div>
        <button type="submit" className="boton">
          Registrar pago
        </button>
      </div>
    </form>
  );
}
