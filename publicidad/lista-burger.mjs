// La lista de precios del burger (Villa Real, al mayor) en PDF y en pantallas JPG, con el diseño de publicidad/lista-precios.html
// (el dueño, 20/11/2026: «dame un pdf con todos los precios burger»). Lo publicado en la web con precio, por familias, más los
// combos activos. Sin costos (es para los clientes) y sin los huevos mientras su precio sea de ejemplo. Desde la carpeta del
// proyecto: node publicidad/lista-burger.mjs. Deja los archivos en listas/precios/<fecha>/lista-burger-<fecha>*.
// Con --dolares, solo los precios en dólares (el dueño, 27/11/2026: «un PDF para enviar por WhatsApp, solo precio en
// dólares»): sin bolívares ni tasa, y vale más de un día. Esos archivos son lista-burger-dolares-<fecha>*.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const raiz = process.cwd();
const { createClient } = createRequire(path.join(raiz, "package.json"))("@libsql/client");
const { filasDeMisPrecios } = await import(pathToFileURL(path.join(raiz, "src/lib/mis-precios.ts")).href);
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
const filas = async (sql) => (await db.execute(sql)).rows.map((r) => ({ ...r }));

const tasa = Number((await filas("select valor from ajustes where clave = 'tasa_bs'"))[0].valor);
const deEjemplo = (await filas("select 1 from ajustes where clave = 'precios_de_ejemplo'")).length > 0;
const productos = (await filas("select id, nombre, unidad, costo_usd, precio_usd, activo, borrador, familia_id, marca, presentacion, contenido, combo_detal from productos")).filter(
  (p) => !(deEjemplo && p.nombre === "Huevos"),
);
const variantes = await filas("select id, producto_id, nombre, costo_usd, precio_usd, activo from variantes");
const familias = await filas("select id, nombre, orden from familias");
const ofertas = await filas("select nombre, descripcion, precio_usd from ofertas where estado = 'activa' and precio_usd is not null and (desde is null or desde <= date('now','-4 hours')) and (hasta is null or hasta >= date('now','-4 hours')) order by orden, id");
db.close();

const dolares = process.argv.includes("--dolares");
const PREFIJO = dolares ? "lista-burger-dolares" : "lista-burger";
const bsDe = (usd) => (dolares ? null : Math.round(usd * tasa * 100) / 100);
const grupos = filasDeMisPrecios(productos, variantes, familias, tasa)
  .map((g) => ({
    nombre: g.familia,
    articulos: g.filas.filter((f) => f.precio !== null).map((f) => ({ nombre: f.detalle ? `${f.tipo} · ${f.detalle}` : f.tipo, unidad: f.porKilo ? "kg" : "unidad", usd: f.precio, bs: bsDe(f.precio) })),
  }))
  .filter((g) => g.articulos.length > 0);
// Lo que lleva cada combo, en corto: sin lo que va entre paréntesis y sin la salsa adicional, que va en su propia línea al
// final (26/11/2026: los combos no llevan salsa; cada pote es un adicional de 0,50 $ y el cliente elige cuál). Con la
// descripción entera de la web, cada combo llenaba una pantalla del teléfono. En la web sigue entera.
const ADICIONAL = /\s*Salsa adicional: ([\d,]+) \$ cada pote[^:]*: ([\s\S]*?)\.?$/;
const enCorto = (d) => String(d).replace(ADICIONAL, "").replace(/\s*\([^)]*\)/g, "").replace(/\.$/, "");
if (ofertas.length) {
  const articulos = ofertas.map((o) => ({ nombre: `${o.nombre}: ${enCorto(o.descripcion)}`, unidad: "unidad", usd: o.precio_usd, bs: bsDe(o.precio_usd) }));
  const salsa = ofertas.map((o) => String(o.descripcion).match(ADICIONAL)).find(Boolean);
  if (salsa) {
    const usd = Number(salsa[1].replace(",", "."));
    articulos.push({ nombre: `Salsa adicional para el combo, la que elijas: ${salsa[2]}`, unidad: "pote", usd, bs: bsDe(usd) });
  }
  grupos.push({ nombre: "Combos", articulos });
}

const ahora = new Date(Date.now() - 4 * 3600 * 1000);
const dia = ahora.toISOString().slice(0, 10);
const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const [a, m, d] = dia.split("-");
const lista = {
  fecha: dia,
  fechaLarga: `${dias[ahora.getUTCDay()]} ${d}/${m}/${a}`,
  tasa: dolares ? null : tasa,
  soloDolares: dolares,
  redondeo: 5,
  prefijo: PREFIJO,
  destino: PREFIJO,
  mayor: true,
  antetitulo: "Villa Real · al mayor",
  titulo: "Lista de precios",
  grupos,
  nota: dolares
    ? "Precios al mayor en dólares. Se pagan también en bolívares a la tasa del BCV del día. Pide por WhatsApp: 0424-6343236 · www.comercializadoravillareal.com"
    : "Precios al mayor de hoy, en bolívares a la tasa del BCV y en dólares. Pide por WhatsApp: 0424-6343236 · www.comercializadoravillareal.com",
};
const publicidad = path.join(raiz, "publicidad");
fs.writeFileSync(path.join(publicidad, "lista-precios-datos.js"), `// Lo escribe el guion de la lista del burger. No va al repositorio.\nglobalThis.LISTAS = ${JSON.stringify([lista], null, 1)};\n`);
const r = spawnSync(process.execPath, [path.join(publicidad, "generar.mjs"), "lista-precios"], { stdio: "inherit" });
if (r.status !== 0) throw new Error("No se pudo dibujar la lista.");
const destino = path.join(raiz, "listas", "precios", dia);
fs.mkdirSync(destino, { recursive: true });
const hechos = [];
// Lo de una vuelta anterior del mismo día se quita: si ahora salen menos pantallas, las de más quedarían viejas.
const deHoy = new RegExp(`^${PREFIJO}-${dia}(-\\d+)?\\.(pdf|jpg)$`);
for (const f of fs.readdirSync(destino).filter((f) => deHoy.test(f))) fs.rmSync(path.join(destino, f));
const recienHechos = new RegExp(`^${PREFIJO}(-\\d+)?\\.(pdf|jpg)$`);
for (const f of fs.readdirSync(publicidad).filter((f) => recienHechos.test(f)).sort()) {
  const nuevo = f.replace(PREFIJO, `${PREFIJO}-${dia}`);
  fs.renameSync(path.join(publicidad, f), path.join(destino, nuevo));
  hechos.push(nuevo);
}
for (const f of fs.readdirSync(publicidad).filter((f) => /^lista-burger.*\.png$/.test(f))) fs.rmSync(path.join(publicidad, f));
console.log(`${grupos.reduce((n, g) => n + g.articulos.length, 0)} precios en ${grupos.length} grupos${deEjemplo ? " (sin los huevos: precio de ejemplo)" : ""}`);
console.log(hechos.join("\n"));
