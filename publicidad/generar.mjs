// Dibuja los carteles de esta carpeta con Chrome: de cada cartel de cada archivo .html, un PDF
// al tamaño real (vectorial, el que se lleva a imprimir) y un PNG de vista previa para WhatsApp.
// Una página puede traer el mismo cartel en varios colores: cada uno con su data-archivo.
//
//   node publicidad/generar.mjs            todos los carteles
//   node publicidad/generar.mjs combos     solo combos.html
//
// Chrome tiene que estar instalado.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "google-chrome");
const PUERTO = 9342;
const MM_POR_PULGADA = 25.4;
const PX_POR_MM = 96 / MM_POR_PULGADA;
/** La vista previa: unos 1500 px de ancho, que WhatsApp enseña bien sin pesar mucho. */
const ANCHO_PREVIA_PX = 1500;

const pedidos = process.argv.slice(2);
const paginas = fs
  .readdirSync(aqui)
  .filter((f) => f.endsWith(".html") && (pedidos.length === 0 || pedidos.includes(f.replace(/\.html$/, ""))))
  .sort();
if (paginas.length === 0) throw new Error("No hay ningún cartel que dibujar.");

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "carteles-chrome-"));
const chrome = spawn(
  CHROME,
  ["--headless=new", `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`, "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "about:blank"],
  { stdio: "ignore" },
);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
try {
  let objetivos = null;
  for (let i = 0; i < 40 && !objetivos; i++) {
    try {
      objetivos = await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json();
    } catch {
      await espera(250);
    }
  }
  if (!objetivos) throw new Error(`Chrome no arrancó (${CHROME}).`);
  ws = new WebSocket(objetivos.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r, f) => {
    ws.onopen = r;
    ws.onerror = f;
  });
  let siguiente = 1;
  const pendientes = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pendientes.has(d.id)) {
      const { r, f } = pendientes.get(d.id);
      pendientes.delete(d.id);
      d.error ? f(new Error(d.error.message)) : r(d.result);
    }
  };
  const enviar = (method, params = {}) =>
    new Promise((r, f) => {
      const id = siguiente++;
      pendientes.set(id, { r, f });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluar = async (expresion) => (await enviar("Runtime.evaluate", { expression: expresion, awaitPromise: true, returnByValue: true })).result.value;
  await enviar("Page.enable");

  for (const archivo of paginas) {
    await enviar("Emulation.setDeviceMetricsOverride", { width: 4000, height: 8000, deviceScaleFactor: 1, mobile: false });
    await enviar("Page.navigate", { url: pathToFileURL(path.join(aqui, archivo)).href });
    for (let i = 0; i < 40; i++) {
      if ((await evaluar("document.readyState")) === "complete") break;
      await espera(250);
    }
    await evaluar("document.fonts.ready.then(() => true)");
    await espera(400);

    const carteles = await evaluar(
      `(() => [...document.querySelectorAll("[data-archivo]")].map((c) => { const r = c.getBoundingClientRect(); return { archivo: c.dataset.archivo, ppp: Number(c.dataset.ppp) || 0, x: r.x + window.scrollX, y: r.y + window.scrollY, ancho: r.width, alto: r.height }; }))()`,
    );
    for (const cartel of carteles) {
      const anchoMm = cartel.ancho / PX_POR_MM;
      const altoMm = cartel.alto / PX_POR_MM;

      // La vista previa: unos 1500 px de ancho, o a los puntos por pulgada que pida la pieza (data-ppp) si va a imprimirse tal cual.
      const escala = cartel.ppp ? cartel.ppp / 96 : ANCHO_PREVIA_PX / cartel.ancho;
      const captura = await enviar("Page.captureScreenshot", { format: "png", clip: { x: cartel.x, y: cartel.y, width: cartel.ancho, height: cartel.alto, scale: escala }, captureBeyondViewport: true });
      fs.writeFileSync(path.join(aqui, `${cartel.archivo}.png`), Buffer.from(captura.data, "base64"));

      // El PDF al tamaño real: vectorial, con las fuentes dentro. Solo este cartel a la vista.
      await evaluar(`(() => { document.querySelectorAll("[data-archivo]").forEach((c) => { c.style.display = c.dataset.archivo === ${JSON.stringify(cartel.archivo)} ? "" : "none"; }); return true; })()`);
      const pdf = await enviar("Page.printToPDF", {
        printBackground: true,
        preferCSSPageSize: true,
        paperWidth: anchoMm / MM_POR_PULGADA,
        paperHeight: altoMm / MM_POR_PULGADA,
        marginTop: 0,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
      });
      fs.writeFileSync(path.join(aqui, `${cartel.archivo}.pdf`), Buffer.from(pdf.data, "base64"));
      await evaluar(`(() => { document.querySelectorAll("[data-archivo]").forEach((c) => { c.style.display = ""; }); return true; })()`);
      console.log(`${cartel.archivo}: ${anchoMm.toFixed(0)} × ${altoMm.toFixed(0)} mm → PNG de vista previa y PDF`);
    }
  }
} finally {
  ws?.close();
  chrome.kill();
  await espera(800);
  try {
    fs.rmSync(perfil, { recursive: true, force: true });
  } catch {
    // Chrome puede tardar un momento en soltar el perfil.
  }
}
