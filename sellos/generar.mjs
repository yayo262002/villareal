// Dibuja los sellos de sellos.html con Chrome: un PNG por sello (600 ppp, negro sobre
// blanco, al tamaño real) y un PDF con todos los modelos en A4 para llevar a la sellería.
//
//   node sellos/generar.mjs
//
// Deja los archivos en esta misma carpeta. Chrome tiene que estar instalado.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "google-chrome");
const PUERTO = 9341;
// 96 px por pulgada en CSS; a 600 ppp, cada píxel de CSS son 6,25 píxeles de imagen.
const ESCALA = 6.25;

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "sellos-chrome-"));
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
      if (d.error) f(new Error(d.error.message));
      else r(d.result);
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
  await enviar("Emulation.setDeviceMetricsOverride", { width: 900, height: 1400, deviceScaleFactor: 1, mobile: false });
  await enviar("Page.navigate", { url: pathToFileURL(path.join(aqui, "sellos.html")).href });
  for (let i = 0; i < 40; i++) {
    if ((await evaluar("document.readyState")) === "complete") break;
    await espera(250);
  }
  await evaluar("document.fonts.ready.then(() => true)");
  await espera(300);

  // Un PNG por sello, recortado a su marco.
  const sellos = await evaluar(`Array.from(document.querySelectorAll(".sello[data-archivo]")).map((s) => { const r = s.getBoundingClientRect(); return { archivo: s.dataset.archivo, x: r.x + window.scrollX, y: r.y + window.scrollY, ancho: r.width, alto: r.height }; })`);
  for (const s of sellos) {
    const captura = await enviar("Page.captureScreenshot", {
      format: "png",
      clip: { x: s.x, y: s.y, width: s.ancho, height: s.alto, scale: ESCALA },
      captureBeyondViewport: true,
    });
    const destino = path.join(aqui, `${s.archivo}.png`);
    fs.writeFileSync(destino, Buffer.from(captura.data, "base64"));
    console.log(`${path.basename(destino)}: ${(s.ancho / 3.7795).toFixed(0)} × ${(s.alto / 3.7795).toFixed(0)} mm`);
  }

  // Todos los modelos en A4, para imprimir o mandar.
  const pdf = await enviar("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
  fs.writeFileSync(path.join(aqui, "sellos.pdf"), Buffer.from(pdf.data, "base64"));
  console.log("sellos.pdf");
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
