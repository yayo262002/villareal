export type ParametrosAviso = Record<string, string | string[] | undefined>;

function primero(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/**
 * Muestra el resultado de la última acción. Los mensajes viajan en la URL
 * porque los formularios no llevan JavaScript; ver `lib/acciones.ts`.
 */
export function Avisos({ parametros }: { parametros: ParametrosAviso }) {
  const ok = primero(parametros.ok);
  const error = primero(parametros.error);
  if (!ok && !error) return null;
  return (
    <div role="status" aria-live="polite">
      {ok && <p className="aviso aviso--exito">{ok}</p>}
      {error && <p className="aviso aviso--error">{error}</p>}
    </div>
  );
}
