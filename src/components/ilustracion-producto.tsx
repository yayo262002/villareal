import { aSlug } from "@/lib/enlaces";

/**
 * Un dibujo sencillo para cada producto, elegido por su nombre. Todos
 * comparten el mismo fondo y el mismo trazo para que la lista se vea de una
 * pieza. Un producto nuevo que no encaje en ninguno lleva el dibujo genérico.
 *
 * Los colores son los del propio alimento, no los de la interfaz: por eso
 * van escritos aquí y no en `tokens.css`.
 */

type Tipo = "mozzarella" | "pecorino" | "huevos" | "queso" | "generico";

function tipoDe(nombre: string): Tipo {
  const n = aSlug(nombre);
  if (n.includes("huevo")) return "huevos";
  if (n.includes("mozzarella") || n.includes("mozarela") || n.includes("mozarella")) return "mozzarella";
  if (n.includes("pecorino") || n.includes("parmesano") || n.includes("anejo")) return "pecorino";
  if (n.includes("queso")) return "queso";
  return "generico";
}

/** Cuña de queso amarillo con sus ojos. */
function Cuña() {
  return (
    <>
      <ellipse cx="62" cy="96" rx="46" ry="5" fill="#000" opacity="0.10" />
      <path d="M14 72 L106 46 L106 90 L14 90 Z" fill="#eeb02c" />
      <path d="M14 72 L106 46 L80 32 L30 50 Z" fill="#fbd75b" />
      <circle cx="38" cy="81" r="6" fill="#d18f17" />
      <circle cx="68" cy="73" r="8" fill="#d18f17" />
      <circle cx="93" cy="77" r="5" fill="#d18f17" />
      <circle cx="54" cy="86" r="3.5" fill="#d18f17" />
      <ellipse cx="62" cy="47" rx="7" ry="3" fill="#eeb02c" />
      <ellipse cx="84" cy="42" rx="4" ry="2" fill="#eeb02c" />
    </>
  );
}

/**
 * Barra de mozzarella con una rebanada cortada delante y una hoja de
 * albahaca. Lleva el mismo volumen que la cuña: cara de arriba clara, frente
 * y costado más oscuros, para que el blanco se distinga del fondo.
 */
function Mozzarella() {
  return (
    <>
      <ellipse cx="60" cy="99" rx="46" ry="5" fill="#000" opacity="0.10" />
      {/* La barra */}
      <path d="M18 56 L34 42 L98 42 L82 56 Z" fill="#fffdf4" />
      <path d="M82 56 L98 42 L98 72 L82 88 Z" fill="#dccb98" />
      <path d="M18 56 L82 56 L82 88 L18 88 Z" fill="#f5ebc8" />
      <path d="M18 56 L34 42 L98 42 L98 72 L82 88 L18 88 Z" fill="none" stroke="#b9a46a" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M18 56 L82 56 L98 42 M82 56 L82 88" fill="none" stroke="#b9a46a" strokeWidth="2" strokeLinejoin="round" />
      {/* La rebanada, apoyada delante */}
      <path d="M40 78 L72 78 Q78 78 78 84 L78 94 Q78 100 72 100 L40 100 Q34 100 34 94 L34 84 Q34 78 40 78 Z" fill="#fffdf4" stroke="#b9a46a" strokeWidth="2.5" />
      <path d="M42 90 Q56 95 70 90" fill="none" stroke="#dccb98" strokeWidth="2" strokeLinecap="round" />
      {/* Albahaca */}
      <g transform="translate(60 36) rotate(-24)">
        <ellipse rx="16" ry="7.5" fill="#2f7d32" />
        <path d="M-14 0 L14 0" stroke="#1f5a23" strokeWidth="2" />
      </g>
    </>
  );
}

/** Rueda de queso curado con una porción cortada. */
function Rueda() {
  return (
    <>
      <ellipse cx="60" cy="98" rx="48" ry="5" fill="#000" opacity="0.10" />
      <path d="M14 50 L14 80 A46 15 0 0 0 106 80 L106 50 Z" fill="#b97f2b" />
      <path d="M14 66 A46 15 0 0 0 106 66" fill="none" stroke="#9c681f" strokeWidth="2" />
      <ellipse cx="60" cy="50" rx="46" ry="15" fill="#f1d68d" />
      <ellipse cx="60" cy="50" rx="38" ry="11" fill="none" stroke="#dcbb68" strokeWidth="2" />
      {/* La porción que falta deja ver el interior. */}
      <path d="M60 50 L106 50 L106 80 A46 15 0 0 1 84 92.5 Z" fill="#f7e7b4" />
      <path d="M60 50 L84 92.5" stroke="#dcbb68" strokeWidth="2" />
      <circle cx="86" cy="66" r="2.5" fill="#dcbb68" />
      <circle cx="96" cy="74" r="2" fill="#dcbb68" />
      <circle cx="80" cy="78" r="2" fill="#dcbb68" />
    </>
  );
}

/** Tres huevos en su cartón. */
function Huevos() {
  return (
    <>
      <ellipse cx="60" cy="100" rx="48" ry="5" fill="#000" opacity="0.10" />
      <ellipse cx="32" cy="60" rx="15" ry="20" fill="#f0cfa4" />
      <ellipse cx="60" cy="56" rx="15" ry="20" fill="#fff4e2" />
      <ellipse cx="88" cy="60" rx="15" ry="20" fill="#e6b98a" />
      <ellipse cx="27" cy="52" rx="4" ry="7" fill="#fff" opacity="0.55" />
      <ellipse cx="55" cy="48" rx="4" ry="7" fill="#fff" opacity="0.7" />
      <ellipse cx="83" cy="52" rx="4" ry="7" fill="#fff" opacity="0.5" />
      <path
        d="M10 70 Q18 62 32 72 Q46 62 60 72 Q74 62 88 72 Q102 62 110 70 L106 92 Q105 98 98 98 L22 98 Q15 98 14 92 Z"
        fill="#a99276"
      />
      <path d="M12 80 L108 80" stroke="#8f7a60" strokeWidth="2" />
    </>
  );
}

/** Una caja, para lo que no sea queso ni huevos. */
function Generico() {
  return (
    <>
      <ellipse cx="60" cy="98" rx="44" ry="5" fill="#000" opacity="0.10" />
      <path d="M20 46 L60 30 L100 46 L100 84 L60 100 L20 84 Z" fill="#d8b56a" />
      <path d="M20 46 L60 62 L100 46 L60 30 Z" fill="#edd193" />
      <path d="M60 62 L60 100" stroke="#b8923f" strokeWidth="2" />
    </>
  );
}

export function IlustracionProducto({ nombre, className }: { nombre: string; className?: string }) {
  const tipo = tipoDe(nombre);
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={`Dibujo de ${nombre.toLowerCase()}`}>
      <circle cx="60" cy="60" r="58" fill="#fbf3dc" stroke="#e8dcb8" strokeWidth="2" />
      {tipo === "queso" && <Cuña />}
      {tipo === "mozzarella" && <Mozzarella />}
      {tipo === "pecorino" && <Rueda />}
      {tipo === "huevos" && <Huevos />}
      {tipo === "generico" && <Generico />}
    </svg>
  );
}
