/**
 * Los stickers de Villa Real para responder a los clientes por WhatsApp:
 * cuando pagan, cuando piden, para cobrar con buena cara, saludos,
 * productos y horario. Aquí está la lista; `scripts/stickers.ts` los
 * dibuja (512 × 512, fondo transparente) en `public/stickers/`, y
 * `/admin/stickers` los enseña para guardarlos en el teléfono.
 */

export const GRUPOS_DE_STICKERS = {
  pagos: "Cuando pagan",
  formas: "Formas de pago",
  pedidos: "Pedidos y entregas",
  cobros: "Para cobrar con buena cara",
  saludos: "Saludos y cortesía",
  productos: "Productos y promos",
  horario: "Horario",
} as const;

export type GrupoDeSticker = keyof typeof GRUPOS_DE_STICKERS;

/** La forma del sticker y sus colores. */
export type FormaDeSticker = "circulo" | "cuadrado" | "burbuja" | "sello";
export type ColorDeSticker = "verde" | "dorado" | "negro" | "crema";
export type IconoDeSticker =
  | "check"
  | "camion"
  | "reloj"
  | "campana"
  | "telefono"
  | "corazon"
  | "estrella"
  | "sol"
  | "luna"
  | "paquete"
  | "dolar"
  | "nota"
  | "queso"
  | "huevo"
  | "banco"
  | "billete"
  | "captura"
  | "cruz";

export type Sticker = {
  slug: string;
  /** El texto, línea a línea: cada línea va centrada. */
  lineas: string[];
  grupo: GrupoDeSticker;
  forma: FormaDeSticker;
  color: ColorDeSticker;
  /** El icono pequeño de abajo, como acento; arriba siempre va el león. */
  icono?: IconoDeSticker;
  /** Líneas más pequeñas debajo del texto: los datos del pago móvil. */
  detalle?: string[];
};

export const STICKERS: Sticker[] = [
  // Cuando pagan
  { slug: "pago-recibido", lineas: ["¡Pago", "recibido!"], grupo: "pagos", forma: "circulo", color: "verde", icono: "check" },
  { slug: "gracias-por-su-pago", lineas: ["¡Gracias", "por su pago!"], grupo: "pagos", forma: "burbuja", color: "verde", icono: "corazon" },
  { slug: "abono-registrado", lineas: ["Abono", "registrado"], grupo: "pagos", forma: "cuadrado", color: "dorado", icono: "check" },
  { slug: "cuenta-al-dia", lineas: ["¡Cuenta", "al día!"], grupo: "pagos", forma: "sello", color: "verde", icono: "check" },
  { slug: "recibido-gracias", lineas: ["Recibido,", "¡gracias!"], grupo: "pagos", forma: "burbuja", color: "dorado", icono: "check" },
  { slug: "confirmado", lineas: ["¡Confirmado!"], grupo: "pagos", forma: "circulo", color: "negro", icono: "check" },
  { slug: "captura-recibida", lineas: ["Captura", "recibida"], grupo: "pagos", forma: "cuadrado", color: "verde", icono: "telefono" },
  { slug: "queda-saldo", lineas: ["Queda un", "saldo", "pendiente"], grupo: "pagos", forma: "burbuja", color: "crema", icono: "reloj" },
  { slug: "a-su-favor", lineas: ["Le queda", "saldo a favor"], grupo: "pagos", forma: "circulo", color: "dorado", icono: "estrella" },

  // Formas de pago
  { slug: "pago-movil", lineas: ["Pago", "móvil"], grupo: "formas", forma: "circulo", color: "verde", icono: "telefono" },
  // Los datos del dueño para el pago móvil (banco, cédula y teléfono) no van en el código, que es público: los pone
  // el guion desde PAGO_MOVIL_BANCO, PAGO_MOVIL_CEDULA y PAGO_MOVIL_TELEFONO de .env.local al dibujar.
  { slug: "mis-datos-de-pago-movil", lineas: ["Pago móvil"], detalle: [], grupo: "formas", forma: "cuadrado", color: "verde", icono: "telefono" },
  { slug: "transferencia", lineas: ["Transferencia"], grupo: "formas", forma: "cuadrado", color: "verde", icono: "banco" },
  { slug: "zelle", lineas: ["Zelle"], grupo: "formas", forma: "circulo", color: "dorado", icono: "dolar" },
  { slug: "binance", lineas: ["Binance"], grupo: "formas", forma: "cuadrado", color: "negro", icono: "dolar" },
  { slug: "efectivo-en-dolares", lineas: ["Efectivo", "en dólares"], grupo: "formas", forma: "circulo", color: "verde", icono: "billete" },
  { slug: "efectivo-en-bolivares", lineas: ["Efectivo", "en bolívares"], grupo: "formas", forma: "cuadrado", color: "dorado", icono: "billete" },
  { slug: "aceptamos-pago-movil-zelle-binance", lineas: ["Pago móvil,", "Zelle o", "Binance"], grupo: "formas", forma: "sello", color: "verde", icono: "telefono" },
  { slug: "como-va-a-pagar", lineas: ["¿Cómo va", "a pagar?"], grupo: "formas", forma: "burbuja", color: "crema", icono: "billete" },
  { slug: "mandeme-la-captura", lineas: ["Mándeme la", "captura,", "por favor"], grupo: "formas", forma: "burbuja", color: "verde", icono: "captura" },
  { slug: "le-paso-los-datos", lineas: ["Le paso", "los datos del", "pago móvil"], grupo: "formas", forma: "burbuja", color: "dorado", icono: "telefono" },
  { slug: "me-llego-gracias", lineas: ["¡Me llegó,", "gracias!"], grupo: "formas", forma: "circulo", color: "verde", icono: "check" },
  { slug: "aun-no-me-llega", lineas: ["Aún no", "me llega"], grupo: "formas", forma: "burbuja", color: "negro", icono: "reloj" },
  { slug: "revise-el-numero", lineas: ["Revise el", "número,", "por favor"], grupo: "formas", forma: "cuadrado", color: "crema", icono: "cruz" },
  { slug: "en-bolivares-a-tasa-bcv", lineas: ["En bolívares", "a tasa BCV"], grupo: "formas", forma: "cuadrado", color: "verde", icono: "dolar" },
  { slug: "pago-movil-recibido", lineas: ["Pago móvil", "recibido"], grupo: "formas", forma: "sello", color: "dorado", icono: "check" },
  { slug: "zelle-recibido", lineas: ["Zelle", "recibido"], grupo: "formas", forma: "circulo", color: "negro", icono: "check" },
  { slug: "referencia-por-favor", lineas: ["¿La referencia,", "por favor?"], grupo: "formas", forma: "burbuja", color: "dorado", icono: "nota" },

  // Pedidos y entregas
  { slug: "pedido-recibido", lineas: ["¡Pedido", "recibido!"], grupo: "pedidos", forma: "burbuja", color: "verde", icono: "paquete" },
  { slug: "preparando-pedido", lineas: ["Preparando", "su pedido"], grupo: "pedidos", forma: "cuadrado", color: "dorado", icono: "paquete" },
  { slug: "vamos-en-camino", lineas: ["¡Vamos", "en camino!"], grupo: "pedidos", forma: "circulo", color: "verde", icono: "camion" },
  { slug: "entregado", lineas: ["¡Entregado!"], grupo: "pedidos", forma: "sello", color: "dorado", icono: "check" },
  { slug: "listo-para-retirar", lineas: ["Listo para", "retirar"], grupo: "pedidos", forma: "cuadrado", color: "verde", icono: "paquete" },
  { slug: "que-le-mando", lineas: ["¿Qué le", "mando hoy?"], grupo: "pedidos", forma: "burbuja", color: "crema", icono: "camion" },
  { slug: "le-mando-la-nota", lineas: ["Le mando", "la nota"], grupo: "pedidos", forma: "cuadrado", color: "negro", icono: "nota" },
  { slug: "pedido-confirmado", lineas: ["Pedido", "confirmado"], grupo: "pedidos", forma: "circulo", color: "dorado", icono: "check" },

  // Para cobrar con buena cara
  { slug: "recordatorio-de-pago", lineas: ["Recordatorio", "de pago"], grupo: "cobros", forma: "burbuja", color: "crema", icono: "campana" },
  { slug: "nota-pendiente", lineas: ["Nota", "pendiente"], grupo: "cobros", forma: "cuadrado", color: "dorado", icono: "reloj" },
  { slug: "vence-hoy", lineas: ["Vence", "hoy"], grupo: "cobros", forma: "circulo", color: "negro", icono: "reloj" },
  { slug: "como-va-todo", lineas: ["¿Cómo", "va todo?"], grupo: "cobros", forma: "burbuja", color: "verde", icono: "corazon" },
  { slug: "pago-movil-o-zelle", lineas: ["Pago móvil", "o Zelle"], grupo: "cobros", forma: "cuadrado", color: "verde", icono: "telefono" },
  { slug: "tasa-bcv-de-hoy", lineas: ["Tasa BCV", "de hoy"], grupo: "cobros", forma: "circulo", color: "dorado", icono: "dolar" },
  { slug: "me-confirma-el-pago", lineas: ["¿Me confirma", "el pago?"], grupo: "cobros", forma: "burbuja", color: "dorado", icono: "telefono" },

  // Saludos y cortesía
  { slug: "buenos-dias", lineas: ["¡Buenos", "días!"], grupo: "saludos", forma: "circulo", color: "dorado", icono: "sol" },
  { slug: "buenas-tardes", lineas: ["¡Buenas", "tardes!"], grupo: "saludos", forma: "circulo", color: "verde", icono: "sol" },
  { slug: "hola-villa-real", lineas: ["Hola, le saluda", "Villa Real"], grupo: "saludos", forma: "burbuja", color: "verde" },
  { slug: "gracias-por-preferirnos", lineas: ["¡Gracias por", "preferirnos!"], grupo: "saludos", forma: "sello", color: "dorado", icono: "corazon" },
  { slug: "a-sus-ordenes", lineas: ["¡A sus", "órdenes!"], grupo: "saludos", forma: "cuadrado", color: "verde" },
  { slug: "con-gusto", lineas: ["¡Con gusto!"], grupo: "saludos", forma: "circulo", color: "crema" },
  { slug: "un-momento", lineas: ["Un momento,", "por favor"], grupo: "saludos", forma: "burbuja", color: "negro", icono: "reloj" },
  { slug: "claro-que-si", lineas: ["¡Claro", "que sí!"], grupo: "saludos", forma: "circulo", color: "verde", icono: "check" },
  { slug: "de-acuerdo", lineas: ["De acuerdo"], grupo: "saludos", forma: "cuadrado", color: "dorado", icono: "check" },
  { slug: "excelente", lineas: ["¡Excelente!"], grupo: "saludos", forma: "sello", color: "verde", icono: "estrella" },
  { slug: "muchas-gracias", lineas: ["¡Muchas", "gracias!"], grupo: "saludos", forma: "burbuja", color: "dorado", icono: "corazon" },
  { slug: "feliz-fin-de-semana", lineas: ["¡Feliz fin", "de semana!"], grupo: "saludos", forma: "circulo", color: "negro", icono: "sol" },
  { slug: "feliz-dia", lineas: ["¡Feliz día!"], grupo: "saludos", forma: "sello", color: "crema", icono: "sol" },
  { slug: "estamos-para-servirle", lineas: ["Estamos para", "servirle"], grupo: "saludos", forma: "cuadrado", color: "verde" },

  // Productos y promos
  { slug: "mozzarella-fresca", lineas: ["Mozzarella", "fresca"], grupo: "productos", forma: "cuadrado", color: "crema", icono: "queso" },
  { slug: "queso-amarillo", lineas: ["Queso", "amarillo"], grupo: "productos", forma: "circulo", color: "dorado", icono: "queso" },
  { slug: "huevos-frescos", lineas: ["Huevos", "frescos"], grupo: "productos", forma: "sello", color: "crema", icono: "huevo" },
  { slug: "llego-mercancia", lineas: ["¡Llegó", "mercancía!"], grupo: "productos", forma: "burbuja", color: "verde", icono: "camion" },
  { slug: "precio-del-dia", lineas: ["Precio", "del día"], grupo: "productos", forma: "circulo", color: "negro", icono: "dolar" },
  { slug: "promo-de-la-semana", lineas: ["Promo de", "la semana"], grupo: "productos", forma: "sello", color: "dorado", icono: "estrella" },
  { slug: "al-mayor", lineas: ["Precios", "al mayor"], grupo: "productos", forma: "cuadrado", color: "verde", icono: "dolar" },
  { slug: "villa-real", lineas: ["Villa Real"], grupo: "productos", forma: "circulo", color: "negro" },

  // Horario
  { slug: "abrimos-de-9-a-6", lineas: ["Abrimos", "de 9 a 6"], grupo: "horario", forma: "circulo", color: "verde", icono: "reloj" },
  { slug: "hoy-cerrado", lineas: ["Hoy", "cerrado"], grupo: "horario", forma: "cuadrado", color: "negro", icono: "luna" },
  { slug: "manana-con-gusto", lineas: ["Mañana,", "con gusto"], grupo: "horario", forma: "burbuja", color: "dorado", icono: "sol" },
  { slug: "lunes-a-viernes", lineas: ["Lunes", "a viernes"], grupo: "horario", forma: "cuadrado", color: "crema", icono: "reloj" },
  { slug: "ya-cerramos", lineas: ["Ya cerramos,", "mañana", "seguimos"], grupo: "horario", forma: "circulo", color: "negro", icono: "luna" },
];

export function stickersDelGrupo(grupo: GrupoDeSticker): Sticker[] {
  return STICKERS.filter((s) => s.grupo === grupo);
}
