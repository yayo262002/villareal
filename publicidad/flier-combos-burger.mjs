// Los fliers de los combos del burger: hamburguesas y perros, para el estado de WhatsApp (1080 × 1920) y para un
// post de Instagram (1080 × 1350). Los precios salen de la base (las ofertas 5 a 8, las de la web), así que el flier
// dice lo mismo que la web. Solo lee la base. Uso: node --env-file=.env.local publicidad/flier-combos-burger.mjs
// Deja los JPG en listas/combos/<fecha>/ y una copia en Descargas.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, "..");
const requerir = createRequire(path.join(raiz, "package.json"));
const { createClient } = requerir("@libsql/client");
const sharp = requerir("sharp");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const precios = new Map((await db.execute("select id, precio_usd, estado from ofertas where id in (5, 6, 7, 8)")).rows.map((r) => [Number(r.id), r]));
const precio = (id) => {
  const o = precios.get(id);
  if (!o || o.estado !== "activa" || o.precio_usd === null) throw new Error(`El combo ${id} no está activo o no tiene precio`);
  return Number(o.precio_usd);
};

// Lo que lleva cada combo, como lo dice la web (descripción de cada oferta), en corto. Las fotos, de publicidad/fotos/.
const foto = (nombre) => (fs.existsSync(path.join(aqui, "fotos", nombre)) ? `fotos/${nombre}` : null);
const fotos = (lista) => lista.map(([nombre, alto]) => ({ src: foto(nombre), alto })).filter((f) => f.src);
const DATOS = {
  whatsapp: "0424-6343236",
  direccion: "Calle 38 entre carreras 30 y 31 · Barquisimeto",
  hamburguesas: {
    de: "de hamburguesas",
    fotos: fotos([["carne-hot-burger.png", 56], ["pan-hamburguesa.png", 70], ["queso-amarillo.png", 100], ["papas-ralladas.png", 70], ["big-cola.png", 100], ["pepsi.png", 96]]),
    combos: [
      { premium: false, cuantas: "10 hamburguesas", unidades: 10, cadaUna: "cada hamburguesa con papas y refresco", precio: precio(5),
        lleva: ["10 carnes de 56 g", "10 panes artesanales", "200 g de queso amarillo", "Papas ralladas (150 g)", "Big Cola de 2 L"],
        salsas: "Salsas aparte: mayonesa, ketchup y mostaza" },
      { premium: true, cuantas: "8 hamburguesas", nota: "2 de ellas dobles", unidades: 8, cadaUna: "cada hamburguesa con papas y refresco", precio: precio(6),
        lleva: ["10 carnes de 85 g", "8 panes brioche con ajonjolí", "200 g de queso amarillo", "Papas ralladas (150 g)", "Pepsi de 1,5 L"],
        salsas: "Salsas aparte: mayonesa, ketchup, mostaza y cheddar" },
    ],
  },
  perros: {
    de: "de perros calientes",
    fotos: fotos([["salchichas.png", 58], ["salchichas-alimex.png", 58], ["pan-perro.png", 80], ["papas-ralladas.png", 70], ["big-cola.png", 100], ["pepsi.png", 96]]),
    combos: [
      { premium: false, cuantas: "20 perros", unidades: 20, cadaUna: "cada perro con papas y refresco", precio: precio(7),
        lleva: ["20 salchichas tipo wieners", "20 panes de perro artesanales", "2 papas ralladas (150 g)", "2 Big Cola de 2 L"],
        salsas: "Salsas aparte: mayonesa, ketchup y mostaza" },
      { premium: true, cuantas: "20 perros", unidades: 20, cadaUna: "cada perro con papas y refresco", precio: precio(8),
        lleva: ["20 salchichas tipo Viena", "20 panes grandes con ajonjolí", "2 papas ralladas (150 g)", "2 Pepsi de 1,5 L"],
        salsas: "Salsas aparte: mayonesa, ketchup, mostaza y maíz" },
    ],
  },
};
fs.writeFileSync(path.join(aqui, "flier-combos-datos.js"), `window.DATOS_FLIER = ${JSON.stringify(DATOS, null, 2)};\n`);

const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(new Date());
const salida = path.join(raiz, "listas", "combos", hoy);
fs.mkdirSync(salida, { recursive: true });
const descargas = path.join(os.homedir(), "Downloads");
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "flier-chrome-"));
const DISENOS = [["flier-combos-burger.html", "flier-combo"], ["flier-combos-mezcla.html", "flier-combo-mezcla"]];
for (const [html, prefijo] of DISENOS) for (const tipo of ["hamburguesas", "perros"]) {
  for (const [formato, alto] of html.includes("mezcla") ? [["estado", 1920]] : [["estado", 1920], ["post", 1350]]) {
    const png = path.join(perfil, `${prefijo}-${tipo}-${formato}.png`);
    const url = `${pathToFileURL(path.join(aqui, html)).href}?tipo=${tipo}&formato=${formato}`;
    const r = spawnSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--force-device-scale-factor=1", `--user-data-dir=${perfil}`, `--window-size=1080,${alto + 240}`, "--virtual-time-budget=4000", `--screenshot=${png}`, url], { stdio: "ignore", timeout: 120000 });
    if (r.status !== 0 || !fs.existsSync(png)) throw new Error(`Chrome no hizo ${tipo} ${formato}`);
    const jpg = path.join(salida, `${prefijo}-${tipo}-${formato}-${hoy}.jpg`);
    // Chrome dibuja la página algo más baja que la ventana: se pide más alta y se corta a la medida.
    await sharp(png).extract({ left: 0, top: 0, width: 1080, height: alto }).jpeg({ quality: 90 }).toFile(jpg);
    fs.copyFileSync(jpg, path.join(descargas, path.basename(jpg)));
    console.log(path.relative(raiz, jpg));
  }
}
