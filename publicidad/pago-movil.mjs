// El cartel del pago móvil (publicidad/pago-movil.html) con los datos de verdad, que no van en el código: los toma de
// PAGO_MOVIL_BANCO, PAGO_MOVIL_TELEFONO y PAGO_MOVIL_CEDULA de .env.local, y el QR de la imagen que se le pase.
//
//   node publicidad/pago-movil.mjs                     sin QR: un recuadro que dice dónde va
//   node publicidad/pago-movil.mjs ruta/del/qr.png     con el QR (una captura del QR del banco; se recorta lo blanco)
//
// Deja listas/pago-movil/pago-movil.pdf (carta, para imprimir) y .jpg (para mandarlo por WhatsApp). La página con los
// datos se escribe un momento en publicidad/ para que generar.mjs la dibuje, y se borra siempre después.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, "..");
const sharp = createRequire(path.join(raiz, "package.json"))("sharp");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(raiz, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const banco = env.PAGO_MOVIL_BANCO, telefono = env.PAGO_MOVIL_TELEFONO, documento = env.PAGO_MOVIL_CEDULA;
if (!banco || !telefono || !documento) throw new Error("Faltan PAGO_MOVIL_BANCO, PAGO_MOVIL_TELEFONO o PAGO_MOVIL_CEDULA en .env.local.");
const escapar = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// En el pago móvil el banco se elige por su código: el del Banco de Venezuela es el 0102.
const bancoConCodigo = /venezuela/i.test(banco) && !/\d{4}/.test(banco) ? `${banco} · 0102` : banco;

let qr = '<div class="falta">Aquí va el QR del pago móvil</div>';
const rutaQr = process.argv[2];
if (rutaQr) {
  // El QR del banco suele venir en una captura: se recorta el borde blanco y se deja cuadrado.
  const recortado = await sharp(rutaQr).flatten({ background: "#ffffff" }).trim({ threshold: 30 }).png().toBuffer();
  qr = `<img src="data:image/png;base64,${recortado.toString("base64")}" alt="QR del pago móvil">`;
}

const html = fs
  .readFileSync(path.join(aqui, "pago-movil.html"), "utf8")
  .replace("{{QR}}", qr)
  .replace("{{BANCO}}", escapar(bancoConCodigo))
  .replace("{{TELEFONO}}", escapar(telefono))
  .replace("{{ETIQUETA_DOCUMENTO}}", /^[JGjg]/.test(documento) ? "RIF" : "Cédula")
  .replace("{{DOCUMENTO}}", escapar(documento));
const temporal = path.join(aqui, "zz-pago-movil.html");
const salida = path.join(process.env.CARPETA_LISTAS ?? path.join(raiz, "listas"), "pago-movil");
try {
  fs.writeFileSync(temporal, html);
  const r = spawnSync(process.execPath, [path.join(aqui, "generar.mjs"), "zz-pago-movil"], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("No se pudo dibujar el cartel.");
  fs.mkdirSync(salida, { recursive: true });
  // Todo esto está en OneDrive: mientras sincroniza un archivo, Windows no deja reemplazarlo ni borrarlo (EBUSY, EPERM), y
  // se espera un poco. El de publicidad/ lleva los datos: no puede quedarse ahí.
  const conPaciencia = async (hacer) => {
    for (let intento = 1; ; intento++) {
      try {
        return hacer();
      } catch (e) {
        if (!["EBUSY", "EPERM"].includes(e.code) || intento >= 30) throw e;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  };
  for (const ext of ["pdf", "jpg"]) {
    const de = path.join(aqui, `pago-movil.${ext}`), a = path.join(salida, `pago-movil.${ext}`);
    await conPaciencia(() => fs.copyFileSync(de, a));
    await conPaciencia(() => fs.rmSync(de));
  }
  console.log(`listo en ${path.relative(raiz, salida)}${rutaQr ? "" : " (sin QR todavía)"}`);
} finally {
  fs.rmSync(temporal, { force: true });
}
