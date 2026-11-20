// La lista de precios del burger (Villa Real, al mayor) en PDF y en pantallas JPG, con el diseño de publicidad/lista-precios.html
// (el dueño, 20/11/2026: «dame un pdf con todos los precios burger»). Lo publicado en la web con precio, por familias, más los
// combos activos. Sin costos (es para los clientes) y sin los huevos mientras su precio sea de ejemplo. Desde la carpeta del
// proyecto: node publicidad/lista-burger.mjs. Deja los archivos en listas/precios/<fecha>/lista-burger-<fecha>*.
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

const bsDe = (usd) => Math.round(usd * tasa * 100) / 100;
const grupos = filasDeMisPrecios(productos, variantes, familias, tasa)
  .map((g) => ({
    nombre: g.familia,
    articulos: g.filas.filter((f) => f.precio !== null).map((f) => ({ nombre: f.detalle ? `${f.tipo} · ${f.detalle}` : f.tipo, unidad: f.porKilo ? "kg" : "unidad", usd: f.precio, bs: bsDe(f.precio) })),
  }))
  .filter((g) => g.articulos.length > 0);
if (ofertas.length) grupos.push({ nombre: "Combos", articulos: ofertas.map((o) => ({ nombre: `${o.nombre}: ${o.descripcion.replace(/\.$/, "")}`, unidad: "unidad", usd: o.precio_usd, bs: bsDe(o.precio_usd) })) });

const ahora = new Date(Date.now() - 4 * 3600 * 1000);
const dia = ahora.toISOString().slice(0, 10);
const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const [a, m, d] = dia.split("-");
const lista = {
  fecha: dia,
  fechaLarga: `${dias[ahora.getUTCDay()]} ${d}/${m}/${a}`,
  tasa,
  redondeo: 5,
  prefijo: "lista-burger",
  destino: "lista-burger",
  mayor: true,
  antetitulo: "Villa Real · al mayor",
  titulo: "Lista de precios",
  grupos,
  nota: "Precios al mayor de hoy, en bolívares a la tasa del BCV y en dólares. Pide por WhatsApp: 0424-6343236 · www.comercializadoravillareal.com",
};
const publicidad = path.join(raiz, "publicidad");
fs.writeFileSync(path.join(publicidad, "lista-precios-datos.js"), `// Lo escribe el guion de la lista del burger. No va al repositorio.\nglobalThis.LISTAS = ${JSON.stringify([lista], null, 1)};\n`);
const r = spawnSync(process.execPath, [path.join(publicidad, "generar.mjs"), "lista-precios"], { stdio: "inherit" });
if (r.status !== 0) throw new Error("No se pudo dibujar la lista.");
const destino = path.join(raiz, "listas", "precios", dia);
fs.mkdirSync(destino, { recursive: true });
const hechos = [];
for (const f of fs.readdirSync(publicidad).filter((f) => /^lista-burger(-\d+)?\.(pdf|jpg)$/.test(f)).sort()) {
  const nuevo = f.replace("lista-burger", `lista-burger-${dia}`);
  fs.renameSync(path.join(publicidad, f), path.join(destino, nuevo));
  hechos.push(nuevo);
}
for (const f of fs.readdirSync(publicidad).filter((f) => /^lista-burger.*\.png$/.test(f))) fs.rmSync(path.join(publicidad, f));
console.log(`${grupos.reduce((n, g) => n + g.articulos.length, 0)} precios en ${grupos.length} grupos${deEjemplo ? " (sin los huevos: precio de ejemplo)" : ""}`);
console.log(hechos.join("\n"));
