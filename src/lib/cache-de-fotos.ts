/**
 * Cuánto se guarda una foto que la web sirve desde la base (/foto-producto/7?v=20261006033137, la de una marca o la
 * portada de una familia). Su dirección lleva `?v=` con la fecha de la foto: al cambiarla, cambia la dirección. Con la
 * versión de hoy, el teléfono la guarda un año sin volver a preguntar; los servidores de Vercel, un día, así una foto que
 * se esconde deja de verse a más tardar al día siguiente y no se le pregunta a la base por cada visita. Sin `?v=`, o con
 * una vieja, un día. Escondida (la ve el dueño con la sesión del panel), nada. Cálculo puro, con pruebas.
 */
export function cacheDeFoto(direccion: string, version: string | null | undefined, visible: boolean): string {
  if (!visible) return "private, no-store";
  const pedida = new URL(direccion).searchParams.get("v");
  const actual = (version ?? "").replace(/\D/g, "");
  if (pedida && actual && pedida === actual) return "public, max-age=31536000, s-maxage=86400, immutable";
  return "public, max-age=86400, s-maxage=86400";
}
