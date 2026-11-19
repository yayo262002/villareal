// El reel de Instagram de Villa Real (el dueño, 19/11/2026: «¿me puedes hacer un video para Instagram con todo lo que
// ya sabes de mí?»). Dibuja publicidad/reel.html con las fotos recortadas de publicidad/fotos/ y lo graba con el propio
// Chrome (MediaRecorder, MP4 H.264, 1080 × 1920, sin sonido: la música se le pone en Instagram). No hace falta ffmpeg.
//
//   node publicidad/reel.mjs        las dos versiones en listas/videos/: con la inauguración del viernes 20/11 y sin fecha
//
// La grabación va en tiempo real: cada versión tarda lo que dura. Después abre el video ya grabado, dice su duración y
// saca unas fotos de distintos momentos para revisarlo (en una carpeta temporal, no en listas/).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, "..");
const sharp = createRequire(path.join(raiz, "package.json"))("sharp");
const CHROME = process.env.CHROME ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "google-chrome");
const PUERTO = 9345;
const salida = path.join(process.env.CARPETA_LISTAS ?? path.join(raiz, "listas"), "videos");

const FOTOS = [
  "tocineta", "mozzarella", "queso-amarillo", "queso-amarillo-vallecito", "pecorino-sortilegio", "pecorino-guaralact",
  "jamon-de-espalda", "pechuga-de-pavo-drago", "mortadela-tapara", "pepperoni-la-vega", "chorizo-ajo-la-vega",
  "chorizo-ahumado-la-vega", "salchicha-picante-la-vega",
];
const VERSIONES = [
  { archivo: "reel-villa-real-inauguracion-2026-11-20.mp4", orden: ["logo", "todo", "quesos", "embutidos", "mayor", "inauguracion", "cierre"] },
  { archivo: "reel-villa-real.mp4", orden: ["logo", "todo", "quesos", "embutidos", "mayor", "cierre"] },
];

// Las fotos, achicadas (no hace falta más de 900 px de alto) y dentro de la página, para que el lienzo no quede «sucio».
const datos = {};
for (const f of FOTOS) {
  const png = await sharp(path.join(aqui, "fotos", `${f}.png`)).resize({ height: 900, withoutEnlargement: true }).png().toBuffer();
  datos[f] = `data:image/png;base64,${png.toString("base64")}`;
}
datos.leon = `data:image/svg+xml;base64,${fs.readFileSync(path.join(raiz, "public", "marca", "leon.svg")).toString("base64")}`;
const temporal = fs.mkdtempSync(path.join(os.tmpdir(), "reel-"));
const pagina = path.join(temporal, "reel.html");
fs.writeFileSync(pagina, fs.readFileSync(path.join(aqui, "reel.html"), "utf8").replace("/*FOTOS*/", `window.FOTOS = ${JSON.stringify(datos)};`));

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "reel-chrome-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PUERTO}`,
    `--user-data-dir=${perfil}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--allow-file-access-from-files",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--window-size=600,1000",
    "about:blank",
  ],
  { stdio: "ignore" },
);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
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
  const ws = new WebSocket(objetivos.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r, f) => ((ws.onopen = r), (ws.onerror = f)));
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
  const enviar = (method, params = {}) => new Promise((r, f) => { const id = siguiente++; pendientes.set(id, { r, f }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluar = async (expresion) => {
    const r = await enviar("Runtime.evaluate", { expression: expresion, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  await enviar("Page.enable");
  await enviar("Page.navigate", { url: pathToFileURL(pagina).href });
  for (let i = 0; i < 80; i++) {
    if ((await evaluar("document.readyState")) === "complete") break;
    await espera(250);
  }
  await evaluar("window.listo");
  fs.mkdirSync(salida, { recursive: true });

  for (const v of VERSIONES) {
    const r = await evaluar(`window.grabar(${JSON.stringify(v.orden)})`);
    const partes = [];
    for (let desde = 0; desde < r.bytes; desde += 2_000_000) partes.push(Buffer.from(await evaluar(`window.trozo(${desde}, ${desde + 2_000_000})`), "base64"));
    const destino = path.join(salida, v.archivo);
    fs.writeFileSync(destino, Buffer.concat(partes));
    console.log(`${path.relative(raiz, destino)}: ${r.segundos.toFixed(1)} s, ${(r.bytes / 1e6).toFixed(1)} MB, ${r.cuadros} cuadros (${r.lento} lentos), ${r.tipo}`);
  }

  // Revisarlo: el video grabado, abierto en una página, con su duración y unas fotos de distintos momentos.
  const revisar = path.join(temporal, "revisar");
  console.log(`  fotos para revisar en ${revisar}`);
  fs.mkdirSync(revisar, { recursive: true });
  for (const v of VERSIONES) {
    const html = path.join(temporal, "ver.html");
    fs.writeFileSync(html, `<!doctype html><video id="v" src="${pathToFileURL(path.join(salida, v.archivo)).href}" muted preload="auto"></video>`);
    await enviar("Page.navigate", { url: pathToFileURL(html).href });
    await espera(800);
    const info = await evaluar(`new Promise((r) => { const v = document.getElementById("v"); const ya = () => r({ duracion: v.duration, ancho: v.videoWidth, alto: v.videoHeight }); if (v.readyState >= 1) ya(); else v.onloadedmetadata = ya; v.onerror = () => r({ error: String(v.error && v.error.message) }); })`);
    console.log(`  ${v.archivo}: ${JSON.stringify(info)}`);
    const momentos = [1.5, 5, 8, 11.5, 14.5, 17.5, 21];
    for (const s of momentos) {
      const foto = await evaluar(`new Promise((r) => { const v = document.getElementById("v"); const t = Math.min(${s}, (isFinite(v.duration) ? v.duration : 30) - 0.1); v.onseeked = () => { const c = document.createElement("canvas"); c.width = 540; c.height = 960; c.getContext("2d").drawImage(v, 0, 0, 540, 960); r(c.toDataURL("image/jpeg", 0.8)); }; v.currentTime = t; })`);
      fs.writeFileSync(path.join(revisar, `${v.archivo.replace(/\.mp4$/, "")}-${String(s).replace(".", "_")}s.jpg`), Buffer.from(foto.split(",")[1], "base64"));
    }
  }
  ws.close();
} finally {
  chrome.kill();
}
