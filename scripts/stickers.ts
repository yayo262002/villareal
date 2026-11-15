/**
 * Dibuja los stickers de WhatsApp de Villa Real (src/lib/stickers.ts):
 * cada uno a 512 × 512 con fondo transparente, en PNG y en WebP (el
 * formato de los stickers), y un ZIP con todos. Los pinta Chrome, que
 * sabe de fuentes y de SVG: una página con todos en rejilla y una captura
 * por sticker. Uso: `node scripts/stickers.ts` (hace falta Chrome).
 *
 * El león es public/marca/leon-transparente.png y la letra, Archivo Black
 * (src/assets/fuentes, licencia OFL). Salen en public/stickers/.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import { STICKERS, type ColorDeSticker, type FormaDeSticker, type IconoDeSticker, type Sticker } from "../src/lib/stickers.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const salida = path.join(raiz, "public", "stickers");
const CHROME = process.env.CHROME ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "google-chrome");
const LADO = 512;
const COLUMNAS = 4;
const PUERTO = 9338;

const COLORES: Record<ColorDeSticker, { fondo: string; texto: string; acento: string; borde: string }> = {
  verde: { fondo: "#163f28", texto: "#fffdf7", acento: "#f3c84b", borde: "#ffffff" },
  dorado: { fondo: "#f3c84b", texto: "#0f2a1b", acento: "#0f2a1b", borde: "#ffffff" },
  negro: { fondo: "#141414", texto: "#f3c84b", acento: "#f3c84b", borde: "#ffffff" },
  crema: { fondo: "#fffdf7", texto: "#163f28", acento: "#c99a1f", borde: "#163f28" },
};

/** Las formas, dibujadas dentro de 512 × 512 con sitio para el borde. */
function forma(tipo: FormaDeSticker): string {
  switch (tipo) {
    case "circulo":
      return `<circle cx="256" cy="256" r="232"/>`;
    case "cuadrado":
      return `<rect x="26" y="26" width="460" height="460" rx="88"/>`;
    case "burbuja":
      return `<path d="M100 26 H412 A74 74 0 0 1 486 100 V352 A74 74 0 0 1 412 426 H206 L134 486 L156 426 H100 A74 74 0 0 1 26 352 V100 A74 74 0 0 1 100 26 Z"/>`;
    case "sello": {
      const puntos: string[] = [];
      for (let i = 0; i < 48; i++) {
        const radio = i % 2 === 0 ? 234 : 214;
        const angulo = (Math.PI * 2 * i) / 48 - Math.PI / 2;
        puntos.push(`${(256 + radio * Math.cos(angulo)).toFixed(1)},${(256 + radio * Math.sin(angulo)).toFixed(1)}`);
      }
      return `<polygon points="${puntos.join(" ")}" stroke-linejoin="round"/>`;
    }
  }
}

/** Los iconos, a trazo, en una caja de 24. */
const ICONOS: Record<IconoDeSticker, string> = {
  check: `<path d="M4 12.5l5 5L20 6.5"/>`,
  camion: `<path d="M2 5h13v11H2z"/><path d="M15 9h4l3 3.5V16h-7z"/><circle cx="6" cy="18.5" r="2"/><circle cx="18" cy="18.5" r="2"/>`,
  reloj: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2.5"/>`,
  campana: `<path d="M18 9a6 6 0 0 0-12 0c0 6.5-2.5 8-2.5 8h17S18 15.5 18 9"/><path d="M13.7 20.5a2 2 0 0 1-3.4 0"/>`,
  telefono: `<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10 18h4"/>`,
  corazon: `<path d="M12 20.5s-7.5-4.6-9.2-9.2A4.8 4.8 0 0 1 12 7.1a4.8 4.8 0 0 1 9.2 4.2c-1.7 4.6-9.2 9.2-9.2 9.2z"/>`,
  estrella: `<path d="M12 3l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.4l-5.7 3.1 1.2-6.4L2.8 9.7l6.4-.8z"/>`,
  sol: `<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>`,
  luna: `<path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.8 6.8 0 0 0 9.7 9.7z"/>`,
  paquete: `<path d="M3 7.5l9-4.5 9 4.5v9l-9 4.5-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/>`,
  dolar: `<path d="M12 2.5v19"/><path d="M16.5 6.5H10a3.2 3.2 0 0 0 0 6.4h4a3.2 3.2 0 0 1 0 6.4H7"/>`,
  nota: `<path d="M6 2.5h8.5l4.5 4.5v14.5H6z"/><path d="M14.5 2.5V7H19M9 12.5h6M9 16.5h6"/>`,
  queso: `<path d="M3 15.5L14 5l7 3.5v8H3z"/><path d="M3 15.5l11-10.5"/><circle cx="9" cy="13" r="1.2"/><circle cx="15" cy="11.5" r="1.2"/><circle cx="12" cy="9" r="0.9"/>`,
  huevo: `<path d="M12 2.5c-3.6 0-7 5.2-7 10.3a7 7 0 0 0 14 0C19 7.7 15.6 2.5 12 2.5z"/>`,
  banco: `<path d="M3 9.5l9-5.5 9 5.5z"/><path d="M4.5 9.5v8M9.5 9.5v8M14.5 9.5v8M19.5 9.5v8M3 17.5h18M2 21h20"/>`,
  billete: `<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M5.5 9.5h.01M18.5 14.5h.01"/>`,
  captura: `<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5-8 8"/>`,
  cruz: `<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>`,
};

/** El tamaño de letra para que la línea más larga quepa en la forma. */
function tamanoDeLetra(lineas: string[], tipo: FormaDeSticker, altoDisponible: number): number {
  const ancho = tipo === "circulo" || tipo === "sello" ? 330 : 390;
  const masLarga = Math.max(...lineas.map((l) => l.length));
  const porAncho = ancho / (masLarga * 0.6);
  const porAlto = altoDisponible / (lineas.length * 1.08);
  return Math.max(30, Math.min(porAncho, porAlto, 76));
}

const PROPORCION_DEL_LEON = 1668 / 2400;

// ---------- Los cinco de todos los días, con su propio diseño ----------
//
// El dueño (15/11/2026): «haz diseños más bonitos, pero solo necesito esos». Cada uno con el borde blanco recortado
// alrededor de todo (letras incluidas) y una sombra suave, como un sticker de verdad: así se ve igual sobre cualquier
// fondo del chat. Letra grande, que se lea en el tamaño pequeño del chat; el león, sobre verde, que es donde se ve.

const VERDE = "#163f28";
const VERDE_OSCURO = "#0f2a1b";
const ORO = "#f3c84b";
const ORO_HONDO = "#d9a521";
const CREMA = "#fffdf7";
const ROJO = "#d64a3a";

/** El borde blanco recortado alrededor de todo lo que se dibuja dentro, con su sombra. */
function troquel(id: string): string {
  return `<filter id="${id}" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
    <feMorphology in="SourceAlpha" operator="dilate" radius="13" result="grueso"/>
    <feGaussianBlur in="grueso" stdDeviation="1.2" result="suave"/>
    <feComponentTransfer in="suave" result="borde"><feFuncA type="linear" slope="3" intercept="-0.4"/></feComponentTransfer>
    <feFlood flood-color="#ffffff"/>
    <feComposite in2="borde" operator="in" result="blanco"/>
    <feDropShadow in="blanco" dx="0" dy="5" stdDeviation="5" flood-color="#000000" flood-opacity="0.3" result="conSombra"/>
    <feMerge><feMergeNode in="conSombra"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`;
}

/** Un texto centrado en Archivo Black, que cabe en el ancho dado (baja la letra si hace falta). */
function letrero(texto: string, y: number, tamano: number, color: string, ancho: number, x = 256): string {
  const cabe = Math.min(tamano, ancho / (texto.length * 0.62));
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="Archivo Black" font-size="${cabe.toFixed(1)}" fill="${color}">${escapar(texto)}</text>`;
}

function leonEn(leon: string, cx: number, y: number, alto: number): string {
  const ancho = alto * PROPORCION_DEL_LEON;
  return `<image href="${leon}" x="${(cx - ancho / 2).toFixed(1)}" y="${y}" width="${ancho.toFixed(1)}" height="${alto}"/>`;
}

/** Un círculo con la palomita, de sello: para «confirmado» y «recibido». */
function palomita(cx: number, cy: number, r: number, fondo: string, trazo: string): string {
  const e = r / 60;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fondo}"/>
    <path d="M${cx - 27 * e} ${cy + 1 * e} L${cx - 8 * e} ${cy + 20 * e} L${cx + 28 * e} ${cy - 20 * e}" fill="none" stroke="${trazo}" stroke-width="${(15 * e).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

const DISENOS: Record<string, (s: Sticker, leon: string) => string> = {
  "gracias-por-preferirnos": (s, leon) => `
    <path d="M70 300 H30 L52 338 L30 376 H70 Z M442 300 H482 L460 338 L482 376 H442 Z" fill="${ORO_HONDO}"/>
    <rect x="58" y="268" width="396" height="136" rx="26" fill="${ORO}"/>
    <circle cx="256" cy="168" r="122" fill="${VERDE}"/>
    <circle cx="256" cy="168" r="108" fill="none" stroke="${ORO}" stroke-width="5"/>
    ${leonEn(leon, 256, 84, 166)}
    ${letrero("¡Gracias por", 326, 50, VERDE_OSCURO, 370)}
    ${letrero("preferirnos!", 384, 50, VERDE_OSCURO, 370)}
    <path d="M256 470 C215 444 200 424 207 407 C214 391 238 389 256 408 C274 389 298 391 305 407 C312 424 297 444 256 470 Z" fill="${ROJO}"/>`,
  "pedido-confirmado": (s, leon) => `
    <circle cx="256" cy="250" r="206" fill="${VERDE}"/>
    <circle cx="256" cy="250" r="188" fill="none" stroke="${ORO}" stroke-width="5"/>
    ${leonEn(leon, 256, 74, 128)}
    ${letrero("Pedido", 268, 66, CREMA, 300)}
    ${letrero("confirmado", 330, 56, ORO, 286)}
    ${palomita(398, 402, 62, ORO, VERDE_OSCURO)}`,
  "mis-datos-de-pago-movil": (s) => {
    const [banco = "", cedula = "", telefono = ""] = s.detalle ?? [];
    return `
    <rect x="34" y="96" width="444" height="352" rx="42" fill="${VERDE}"/>
    <rect x="50" y="112" width="412" height="320" rx="30" fill="none" stroke="${ORO}" stroke-width="4"/>
    <rect x="96" y="52" width="320" height="82" rx="41" fill="${ORO}"/>
    <g transform="translate(122 70) scale(1.9)" fill="none" stroke="${VERDE_OSCURO}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICONOS.telefono}</g>
    ${letrero("Pago móvil", 108, 44, VERDE_OSCURO, 230, 286)}
    ${letrero(banco, 214, 36, CREMA, 360)}
    ${letrero(cedula, 290, 44, CREMA, 360)}
    ${letrero(telefono, 380, 64, ORO, 352)}`;
  },
  "recibido-gracias": () => `
    <path d="M100 66 H412 A64 64 0 0 1 476 130 V330 A64 64 0 0 1 412 394 H186 L104 466 L120 394 H100 A64 64 0 0 1 36 330 V130 A64 64 0 0 1 100 66 Z" fill="${ORO}"/>
    ${letrero("Recibido,", 222, 74, VERDE_OSCURO, 396)}
    ${letrero("¡gracias!", 310, 74, VERDE_OSCURO, 396)}
    ${palomita(420, 82, 58, VERDE, ORO)}`,
  confirmado: () => `
    <g transform="rotate(-4 256 256)">
      <circle cx="256" cy="206" r="164" fill="${VERDE}"/>
      <circle cx="256" cy="206" r="146" fill="none" stroke="${ORO}" stroke-width="5"/>
      <path d="M176 210 L234 266 L342 150" fill="none" stroke="${ORO}" stroke-width="42" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M44 352 H468 L452 396 L468 440 H44 L60 396 Z" fill="${ORO}"/>
      ${letrero("¡Confirmado!", 418, 58, VERDE_OSCURO, 380)}
    </g>`,
};

function svgEspecial(s: Sticker, leon: string): string | null {
  const dibujo = DISENOS[s.slug];
  if (!dibujo) return null;
  const id = `troquel-${s.slug}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>${troquel(id)}</defs>
  <g filter="url(#${id})">${dibujo(s, leon)}</g>
</svg>`;
}

function svgDe(s: Sticker, leon: string): string {
  const especial = svgEspecial(s, leon);
  if (especial) return especial;
  const c = COLORES[s.color];
  const esLogo = s.slug === "villa-real";
  const conDetalle = Boolean(s.detalle?.length);
  // Arriba, el león, grande: es la marca. Abajo, el icono pequeño, de acento.
  const leonAlto = esLogo ? 230 : conDetalle ? 112 : 150;
  const leonY = s.forma === "burbuja" ? 44 : 58;
  const pieAlto = s.icono ? 60 : 0;
  const pieY = s.forma === "burbuja" ? 372 : 404;
  const zonaTexto = { desde: leonY + leonAlto + 6, hasta: s.icono ? pieY - 6 : s.forma === "burbuja" ? 404 : 440 };
  const altoDisponible = zonaTexto.hasta - zonaTexto.desde - (conDetalle ? (s.detalle!.length * 44 + 8) : 0);
  const letra = tamanoDeLetra(s.lineas, s.forma, altoDisponible);
  const interlineado = letra * 1.08;
  const altoTexto = s.lineas.length * interlineado + (conDetalle ? s.detalle!.length * 44 + 8 : 0);
  const primeraLinea = zonaTexto.desde + (zonaTexto.hasta - zonaTexto.desde - altoTexto) / 2 + letra * 0.85;
  const texto = s.lineas
    .map((l, i) => `<text x="256" y="${(primeraLinea + i * interlineado).toFixed(1)}" text-anchor="middle" font-family="Archivo Black" font-size="${letra.toFixed(1)}" fill="${c.texto}">${escapar(l)}</text>`)
    .join("");
  const detalleY = primeraLinea + (s.lineas.length - 1) * interlineado + 8;
  // Los datos, más pequeños y en el color de acento; la línea más larga tiene que caber.
  const letraDetalle = Math.min(36, 380 / (Math.max(1, ...(s.detalle ?? []).map((l) => l.length)) * 0.6));
  const detalle = (s.detalle ?? [])
    .map((l, i) => `<text x="256" y="${(detalleY + (i + 1) * 44).toFixed(1)}" text-anchor="middle" font-family="Archivo Black" font-size="${letraDetalle.toFixed(1)}" fill="${c.acento}">${escapar(l)}</text>`)
    .join("");
  const leonAncho = leonAlto * PROPORCION_DEL_LEON;
  const arriba = `<image href="${leon}" x="${(256 - leonAncho / 2).toFixed(1)}" y="${leonY}" height="${leonAlto}" width="${leonAncho.toFixed(1)}"/>`;
  const pie = s.icono
    ? `<g transform="translate(${256 - pieAlto / 2} ${pieY}) scale(${pieAlto / 24})" fill="none" stroke="${c.acento}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONOS[s.icono]}</g>`
    : esLogo
      ? `<text x="256" y="${(s.forma === "burbuja" ? 392 : 428)}" text-anchor="middle" font-family="Archivo" font-size="22" fill="${c.acento}">Tu proveedor para burger &amp; pizza</text>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <g fill="${c.fondo}" stroke="${c.borde}" stroke-width="14">${forma(s.forma)}</g>
  ${arriba}
  ${texto}
  ${detalle}
  ${pie}
</svg>`;
}

function escapar(t: string): string {
  return t.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function conChrome<T>(cuerpo: (enviar: (metodo: string, params?: object) => Promise<Record<string, unknown>>) => Promise<T>): Promise<T> {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "villareal-stickers-"));
  const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`, "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
  try {
    let version: unknown = null;
    for (let i = 0; i < 40 && !version; i++) {
      try {
        version = await (await fetch(`http://127.0.0.1:${PUERTO}/json/version`)).json();
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    if (!version) throw new Error(`Chrome no arrancó (${CHROME}).`);
    const objetivos = (await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
    const ws = new WebSocket(objetivos.find((t) => t.type === "page")!.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let siguiente = 1;
    const pendientes = new Map<number, { resolver: (v: Record<string, unknown>) => void; rechazar: (e: Error) => void }>();
    ws.onmessage = (m) => {
      const dato = JSON.parse(String(m.data));
      if (dato.id && pendientes.has(dato.id)) {
        const { resolver, rechazar } = pendientes.get(dato.id)!;
        pendientes.delete(dato.id);
        if (dato.error) rechazar(new Error(dato.error.message));
        else resolver(dato.result);
      }
    };
    const enviar = (method: string, params: object = {}) =>
      new Promise<Record<string, unknown>>((resolver, rechazar) => {
        const id = siguiente++;
        pendientes.set(id, { resolver, rechazar });
        ws.send(JSON.stringify({ id, method, params }));
      });
    try {
      return await cuerpo(enviar);
    } finally {
      ws.close();
    }
  } finally {
    // Chrome tarda un momento en soltar su carpeta; si no se deja borrar, el sistema la limpia.
    const cerrado = new Promise<void>((r) => chrome.once("exit", () => r()));
    chrome.kill();
    await Promise.race([cerrado, new Promise((r) => setTimeout(r, 3000))]);
    try {
      fs.rmSync(perfil, { recursive: true, force: true });
    } catch {
      // Da igual.
    }
  }
}

// ---------- Un ZIP sin compresión, para bajarlos todos de una vez ----------

const TABLA_CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of datos) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zipDe(archivos: { nombre: string; datos: Uint8Array }[]): Buffer {
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let desplazamiento = 0;
  for (const a of archivos) {
    const nombre = Buffer.from(a.nombre, "utf8");
    const crc = crc32(a.datos);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt16LE(0, 8); // sin compresión
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12); // 1/1/1980
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(a.datos.length, 18);
    local.writeUInt32LE(a.datos.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    local.writeUInt16LE(0, 28);
    locales.push(local, nombre, Buffer.from(a.datos));
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(a.datos.length, 20);
    central.writeUInt32LE(a.datos.length, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt32LE(desplazamiento, 42);
    centrales.push(central, nombre);
    desplazamiento += 30 + nombre.length + a.datos.length;
  }
  const cuerpoCentral = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(cuerpoCentral.length, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat([...locales, cuerpoCentral, fin]);
}

// ---------- Principal ----------

fs.mkdirSync(salida, { recursive: true });
const leon = pathToFileURL(path.join(raiz, "public", "marca", "leon-transparente.png")).href;
const fuenteNegra = pathToFileURL(path.join(raiz, "src", "assets", "fuentes", "ArchivoBlack-Regular.ttf")).href;
const fuenteMedia = pathToFileURL(path.join(raiz, "src", "assets", "fuentes", "Archivo-Medium.ttf")).href;
// Los datos del pago móvil del dueño vienen de .env.local (no van en el código, que es público).
const datosDePagoMovil = [process.env.PAGO_MOVIL_BANCO, process.env.PAGO_MOVIL_CEDULA ? `Cédula ${process.env.PAGO_MOVIL_CEDULA}` : "", process.env.PAGO_MOVIL_TELEFONO].filter((d): d is string => Boolean(d));
for (const s of STICKERS) if (s.slug === "mis-datos-de-pago-movil") s.detalle = datosDePagoMovil.length ? datosDePagoMovil : ["(pon tus datos en", ".env.local)"];
if (!datosDePagoMovil.length) console.log("OJO: sin PAGO_MOVIL_BANCO, PAGO_MOVIL_CEDULA y PAGO_MOVIL_TELEFONO en .env.local, el sticker de los datos sale sin ellos.");

const filas = Math.ceil(STICKERS.length / COLUMNAS);
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Archivo Black"; src: url("${fuenteNegra}"); }
@font-face { font-family: "Archivo"; src: url("${fuenteMedia}"); font-weight: 500; }
html, body { margin: 0; background: transparent; }
.rejilla { display: grid; grid-template-columns: repeat(${COLUMNAS}, ${LADO}px); width: ${COLUMNAS * LADO}px; }
.rejilla svg { display: block; }
</style></head><body><div class="rejilla">${STICKERS.map((s) => svgDe(s, leon)).join("")}</div></body></html>`;
const pagina = path.join(salida, "_rejilla.html");
fs.writeFileSync(pagina, html);

const resultados = await conChrome(async (enviar) => {
  await enviar("Emulation.setDeviceMetricsOverride", { width: COLUMNAS * LADO, height: filas * LADO, deviceScaleFactor: 1, mobile: false });
  await enviar("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  await enviar("Page.enable");
  await enviar("Runtime.enable");
  await enviar("Page.navigate", { url: pathToFileURL(pagina).href });
  await enviar("Runtime.evaluate", { expression: "document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 400)))", awaitPromise: true });
  const lista: { sticker: Sticker; png: number; webp: number }[] = [];
  for (const [i, s] of STICKERS.entries()) {
    const x = (i % COLUMNAS) * LADO;
    const y = Math.floor(i / COLUMNAS) * LADO;
    const captura = (await enviar("Page.captureScreenshot", { format: "png", clip: { x, y, width: LADO, height: LADO, scale: 1 }, captureBeyondViewport: true })) as { data: string };
    const crudo = Buffer.from(captura.data, "base64");
    // Los cinco de su propio diseño llevan sombra suave: van en color completo, que la paleta la dejaría a escalones.
    const png = await sharp(crudo).png({ compressionLevel: 9, palette: !(s.slug in DISENOS), quality: 90 }).toBuffer();
    const webp = await sharp(crudo).webp({ quality: 88, alphaQuality: 90 }).toBuffer();
    fs.writeFileSync(path.join(salida, `${s.slug}.png`), png);
    fs.writeFileSync(path.join(salida, `${s.slug}.webp`), webp);
    lista.push({ sticker: s, png: png.length, webp: webp.length });
  }
  return lista;
});
fs.rmSync(pagina, { force: true });

const zip = zipDe(resultados.map((r) => ({ nombre: `${r.sticker.slug}.png`, datos: fs.readFileSync(path.join(salida, `${r.sticker.slug}.png`)) })));
fs.writeFileSync(path.join(salida, "stickers-villa-real.zip"), zip);
const grandes = resultados.filter((r) => r.webp > 100 * 1024);
console.log(`${resultados.length} stickers en ${path.relative(raiz, salida)}; ZIP de ${Math.round(zip.length / 1024)} KB.`);
console.log(`PNG: ${Math.round(resultados.reduce((s, r) => s + r.png, 0) / resultados.length / 1024)} KB de media · WebP: ${Math.round(resultados.reduce((s, r) => s + r.webp, 0) / resultados.length / 1024)} KB de media.`);
if (grandes.length) console.log(`OJO: WebP de más de 100 KB (WhatsApp no los acepta): ${grandes.map((r) => r.sticker.slug).join(", ")}`);
