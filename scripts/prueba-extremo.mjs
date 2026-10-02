// Prueba de extremo a extremo: usa la web como la usaría el dueño, por los
// formularios HTML, y comprueba que las cuentas cuadran.
//
//   npm run prueba:local   arranca `next start` con una base temporal (hace
//                          falta `npm run build` antes). Prueba también los
//                          precios, porque la base es de usar y tirar.
//   npm run prueba:web     contra la web publicada, SOLO MIRANDO. Allí están
//                          los datos de verdad del negocio: no crea, no
//                          cambia ni borra nada. Abre cada pantalla, baja
//                          las descargas y comprueba la copia de seguridad.
//
// La clave sale de `.env.local`; aquí no hay secretos.

import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const raiz = process.cwd();
const urlWeb = process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? null;
const enProduccion = urlWeb !== null;

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(raiz, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const puerto = 3112;
const base = urlWeb ?? `http://localhost:${puerto}`;
const carpetaTemporal = fs.mkdtempSync(path.join(os.tmpdir(), "villareal-prueba-"));
const rutaDb = path.join(carpetaTemporal, "prueba.db");
const usd = (n) => "USD " + n;

// Un PNG de 1×1 válido, para subirlo como «foto de la nota».
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** La foto de la nota firmada que exige cada entrega. */
const fotoFirmada = () => new File([png], "nota-firmada.png", { type: "image/png" });
/** Una «foto» con la lectura escrita dentro: el lector de las pruebas la saca de ahí en vez de mirar la imagen. */
const fotoLeida = (lectura) => new File([png, JSON.stringify(lectura)], "nota-firmada.png", { type: "image/png" });

/** La marca de pecorino que se crea en la prueba de precios y se vende después. */
let varianteSortilegio = 0;

let fallos = 0;
function comprobar(nombre, condicion, detalle = "") {
  console.log(`${condicion ? "ok   " : "FALLO"} ${nombre}${condicion ? "" : " → " + detalle}`);
  if (!condicion) fallos++;
}

// ---------- La base temporal de la prueba local, para comprobar ----------

/** Lee el archivo temporal. Solo en local: la base de verdad no se toca desde aquí. */
async function consultar(sql, args = []) {
  const db = new DatabaseSync(rutaDb, { readOnly: true });
  try {
    return db.prepare(sql).all(...args).map((f) => ({ ...f }));
  } finally {
    db.close();
  }
}

async function cuentasDe(clienteId) {
  const [f] = await consultar(
    `select
       coalesce((select sum(total_usd) from ventas where cliente_id = ?), 0) as ventas,
       coalesce((select sum(monto_usd) from pagos where cliente_id = ?), 0) as pagos,
       (select count(*) from adjuntos where cliente_id = ?) as fotos`,
    [clienteId, clienteId, clienteId],
  );
  return { ventas: Number(f.ventas), pagos: Number(f.pagos), fotos: Number(f.fotos) };
}

const cerca = (a, b) => Math.abs(a - b) < 0.005;

/** React parte los textos con comentarios vacíos; sin ellos se lee como lo ve la gente. */
const legible = (html) => html.replaceAll("<!-- -->", "");

// ---------- La web ----------

let cookie = `villareal_sesion=${createHmac("sha256", env.ADMIN_CLAVE).update("panel-villareal-v1").digest("hex")}`;

async function pagina(ruta, conCookie = cookie, aunqueNoSeaHtml = false) {
  const t = Date.now();
  const r = await fetch(base + ruta, { headers: { cookie: conCookie }, redirect: "manual" });
  return {
    status: r.status,
    cabeceras: r.headers,
    html: r.status === 200 || aunqueNoSeaHtml ? await r.text() : "",
    destino: decodeURIComponent(r.headers.get("location") ?? ""),
    ms: Date.now() - t,
  };
}

/**
 * La portada se guarda hecha y se rehace al cambiar un precio o la tasa.
 * Rehacerla tarda un instante: quien la pida en ese mismo momento recibe
 * la anterior. Aquí se espera a que enseñe lo nuevo, como mucho 5 segundos.
 */
async function portadaCon(texto) {
  let ultima = await pagina("/", "");
  for (let i = 0; i < 20 && !ultima.html.includes(texto); i++) {
    await new Promise((r) => setTimeout(r, 250));
    ultima = await pagina("/", "");
  }
  return ultima;
}

/** El identificador de la acción del formulario que contiene `marca`. */
function accionDe(html, marca, segundaMarca = "") {
  const formulario = (html.match(/<form[\s\S]*?<\/form>/g) ?? []).find((f) => f.includes(marca) && f.includes(segundaMarca));
  if (!formulario) throw new Error(`No hay formulario con ${marca}`);
  const accion = formulario.match(/name="(\$ACTION_ID_[a-f0-9]+)"/);
  if (!accion) throw new Error(`El formulario de ${marca} no lleva acción`);
  return accion[1];
}

/** Envía un formulario como lo haría el navegador sin JavaScript. */
async function enviar(ruta, marca, campos, conCookie = cookie, cabeceras = {}, segundaMarca = "") {
  const { html, status } = await pagina(ruta, conCookie);
  if (status !== 200) throw new Error(`GET ${ruta} → ${status}`);
  const datos = new FormData();
  datos.set(accionDe(html, marca, segundaMarca), "");
  for (const [k, v] of Object.entries(campos)) datos.set(k, v);
  const t = Date.now();
  const r = await fetch(base + ruta, { method: "POST", headers: { cookie: conCookie, ...cabeceras }, body: datos, redirect: "manual" });
  return {
    status: r.status,
    destino: decodeURIComponent(r.headers.get("location") ?? ""),
    galleta: r.headers.get("set-cookie") ?? "",
    ms: Date.now() - t,
  };
}

// ---------- Arranque del servidor local ----------

let servidor = null;
let salidaServidor = "";

async function arrancarServidor() {
  // Next lee `.env.local` por su cuenta: con las variables de Turso vacías
  // pero definidas no las pisa, y la prueba nunca toca la nube.
  servidor = spawn(process.execPath, [path.join(raiz, "node_modules/next/dist/bin/next"), "start", "-p", String(puerto)], {
    cwd: raiz,
    env: { ...process.env, ...env, TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", RUTA_BASE_DATOS: rutaDb, MAPA_APAGADO: "1", LECTOR_DE_NOTAS_FALSO: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  servidor.stdout.on("data", (d) => (salidaServidor += d));
  servidor.stderr.on("data", (d) => (salidaServidor += d));
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(base + "/admin/entrar");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("El servidor no arrancó:\n" + salidaServidor);
}

// ---------- Las pruebas ----------

async function probarEntrada() {
  const sinSesion = await pagina("/admin", "");
  comprobar("el panel sin sesión manda a entrar", sinSesion.status === 307 && sinSesion.destino.includes("/admin/entrar"));

  // Una clave mala deja anotado el fallo: en la web publicada no se prueba.
  if (!enProduccion) {
    const mala = await enviar("/admin/entrar", 'name="clave"', { clave: "incorrecta" }, "");
    comprobar("una clave incorrecta no entra", mala.destino.includes("no es correcta"));
  }

  const buena = await enviar("/admin/entrar", 'name="clave"', { clave: env.ADMIN_CLAVE }, "");
  const valor = buena.galleta.match(/villareal_sesion=([^;]+)/)?.[1];
  comprobar(`entrar con la clave (${buena.ms} ms)`, buena.status === 303 && Boolean(valor), `${buena.status} ${buena.destino}`);
  if (valor) cookie = `villareal_sesion=${valor}`;
}

/** Lo que ven los buscadores y quien recibe un enlace. Solo lee: vale en local y en la web. */
async function probarPresentacion(portada) {
  const html = portada.html;
  comprobar("la portada dice qué se vende y dónde", html.includes('lang="es-VE"') && /<meta name="description" content="[^"]*Barquisimeto/.test(html));
  comprobar("vista previa para WhatsApp: título, descripción e imagen", /property="og:title"/.test(html) && /property="og:description"/.test(html) && /property="og:image" content="[^"]*opengraph-image/.test(html));
  comprobar("datos de la tienda para los buscadores", /"@type":"Store"/.test(html) && html.includes('"addressLocality":"Barquisimeto"') && html.includes('"telephone":"+584246343236"'));
  comprobar("llamada a los negocios y cómo llegar", html.includes("Pedir precio al mayor") && html.includes("google.com/maps/search") && html.includes("Saltar al contenido"));

  let r = await fetch(base + "/opengraph-image");
  comprobar("imagen de vista previa de la portada", r.status === 200 && r.headers.get("content-type") === "image/png" && (await r.arrayBuffer()).byteLength > 20000);

  const ruta = html.match(/href="(\/producto\/\d+[a-z0-9-]*)"/)?.[1];
  const ficha = await pagina(ruta, "");
  comprobar("página de producto: dirección propia, compartir y datos para buscadores", ficha.html.includes(`rel="canonical" href="`) && ficha.html.includes(ruta) && ficha.html.includes("Compartir este producto por WhatsApp") && /"@type":"Product"/.test(ficha.html));
  r = await fetch(base + ruta + "/opengraph-image");
  comprobar("imagen de vista previa del producto", r.status === 200 && r.headers.get("content-type") === "image/png" && (await r.arrayBuffer()).byteLength > 20000);

  r = await fetch(base + "/robots.txt");
  const robots = await r.text();
  comprobar("los buscadores no entran al panel", robots.includes("Disallow: /admin") && robots.includes("sitemap.xml"));
  r = await fetch(base + "/sitemap.xml");
  comprobar("mapa del sitio con los productos", r.status === 200 && (await r.text()).includes("/producto/"));
  r = await fetch(base + "/manifest.webmanifest");
  const manifiesto = await r.json().catch(() => ({}));
  comprobar("se puede poner en la pantalla de inicio del teléfono", manifiesto.short_name === "Villa Real" && manifiesto.icons?.length >= 2);
  r = await fetch(base + "/admin/manifest.webmanifest", { redirect: "manual" });
  const manifiestoPanel = r.status === 200 ? await r.json().catch(() => ({})) : {};
  comprobar(
    "el panel tiene su propia app: manifiesto sin sesión, que abre en el panel",
    r.status === 200 && manifiestoPanel.short_name === "Panel" && manifiestoPanel.start_url === "/admin" && manifiestoPanel.display === "standalone" && manifiestoPanel.shortcuts?.length === 4,
    String(r.status),
  );
  const entrada = await pagina("/admin/entrar", "");
  comprobar(
    "la entrada enlaza el manifiesto del panel y se abre a pantalla completa en iPhone",
    entrada.html.includes('href="/admin/manifest.webmanifest"') && entrada.html.includes('name="apple-mobile-web-app-title" content="Panel"'),
  );
  for (const icono of ["/marca/icono-192.png", "/marca/icono-512.png", "/apple-icon.png"]) {
    r = await fetch(base + icono);
    comprobar(`icono ${icono}`, r.status === 200 && r.headers.get("content-type") === "image/png");
  }

  comprobar("cabeceras de seguridad", portada.cabeceras.get("x-frame-options") === "DENY" && portada.cabeceras.get("x-content-type-options") === "nosniff");
  r = await fetch(base + "/admin/entrar");
  comprobar("el panel no sale en los buscadores", (r.headers.get("x-robots-tag") ?? "").includes("noindex"));

  const perdida = await pagina("/esta-pagina-no-existe", "");
  r = await fetch(base + "/esta-pagina-no-existe");
  comprobar("página no encontrada, en castellano", r.status === 404 && (await r.text()).includes("No encontramos esa página"), String(perdida.status));
}

/** Solo en local: cinco claves malas desde una dirección la dejan fuera, a ella sola. */
async function probarFreno() {
  const intruso = { "x-forwarded-for": "203.0.113.7" };
  let ultimo;
  for (let i = 0; i < 5; i++) ultimo = await enviar("/admin/entrar", 'name="clave"', { clave: `mala-${i}` }, "", intruso);
  comprobar("las cinco primeras claves malas se rechazan una a una", ultimo.destino.includes("no es correcta"), ultimo.destino);
  const bloqueado = await enviar("/admin/entrar", 'name="clave"', { clave: env.ADMIN_CLAVE }, "", intruso);
  comprobar("a la sexta, ni la clave buena entra desde esa dirección", bloqueado.destino.includes("Demasiados intentos") && !bloqueado.galleta.includes("villareal_sesion"), bloqueado.destino);
  const otro = await enviar("/admin/entrar", 'name="clave"', { clave: env.ADMIN_CLAVE }, "", { "x-forwarded-for": "198.51.100.4" });
  comprobar("desde otra dirección se sigue pudiendo entrar", otro.status === 303 && otro.galleta.includes("villareal_sesion"), otro.destino);
}

/** Solo en local: la tarea de cada mañana. La tasa de prueba es 36,50, muy lejos de la real. */
async function probarTareaDiaria() {
  let r = await fetch(base + "/api/tarea-diaria");
  comprobar("la tarea diaria sin clave se niega", r.status === 401);
  r = await fetch(base + "/api/tarea-diaria", { headers: { authorization: "Bearer " + env.CRON_SECRET } });
  const resultado = await r.json().catch(() => ({}));
  comprobar("la tarea diaria guarda la copia", resultado.copia?.estado === "guardada", JSON.stringify(resultado));
  comprobar(
    "una tasa que salta demasiado no entra sola",
    ["rechazada", "sin_respuesta"].includes(resultado.tasa?.estado),
    JSON.stringify(resultado.tasa),
  );
  const panel = (await pagina("/admin/productos")).html;
  comprobar("la tasa sigue siendo la que había y el panel lo avisa", panel.includes('value="36.5"') && /No se (cambió|pudo traer) la tasa/.test(panel));

  let cambio = await enviar("/admin/productos", 'name="encender"', { encender: "0" });
  comprobar("la actualización automática se puede apagar", cambio.destino.includes("ya no se actualiza sola"));
  r = await fetch(base + "/api/tarea-diaria", { headers: { authorization: "Bearer " + env.CRON_SECRET } });
  comprobar("apagada, la tarea diaria no toca la tasa", (await r.json()).tasa?.estado === "apagada");
  cambio = await enviar("/admin/productos", 'name="encender"', { encender: "1" });
  comprobar("y volver a encender", cambio.destino.includes("cada mañana"));
}

/** Solo en local: tasa, costo con dos márgenes, y lo que enseña la web. */
async function probarPrecios() {
  let r = await enviar("/admin/productos", 'name="tasa"', { tasa: "36.5" });
  comprobar("guardar la tasa del día", r.destino.includes("Tasa del día guardada"));

  r = await enviar("/admin/productos", 'id="precio-1"', {
    id: "1", nombre: "Queso amarillo", unidad: "kg", costo_usd: "6.8",
    margen_pct: "25", precio_usd: "",
  });
  comprobar("costo 6,80 con 25 %", r.destino.includes("guardado"), r.destino);

  const panel = (await pagina("/admin/productos")).html;
  comprobar(
    "panel: precio al mayor USD 8,50 = Bs 310,25, y nada de detal",
    panel.includes('value="8.5"') && panel.includes("Bs 310,25") && panel.includes("Precio al mayor") && !panel.includes("Al detal"),
  );

  r = await enviar("/admin/productos", 'id="precio-2"', {
    id: "2", nombre: "Queso mozzarella", unidad: "kg", costo_usd: "",
    margen_pct: "20", precio_usd: "",
  });
  comprobar("un margen sin costo se rechaza", r.destino.includes("hace falta el costo"), r.destino);

  r = await enviar("/admin/productos", 'id="precio-2"', {
    id: "2", nombre: "Queso mozzarella", unidad: "kg", costo_usd: "",
    margen_pct: "", precio_usd: "7",
  });
  comprobar("un precio escrito a mano se acepta", r.destino.includes("guardado"), r.destino);

  // Bs 255,50 es el último cambio: la mozzarella a USD 7 con la tasa a 36,50.
  const web = (await portadaCon("Bs 255,50")).html;
  comprobar("web: el precio al mayor del queso amarillo en bolívares, y nada de detal", web.includes(">Precio al mayor<") && web.includes("Bs 310,25") && !web.includes("al detal") && !web.includes("Al detal"));
  comprobar("web: dólares y tasa", web.includes(usd("8,50")) && web.includes("36,50"));
  comprobar("web: la mozzarella a 7 (Bs 255,50)", web.includes("Bs 255,50"));
  comprobar("portada: sin reseñas; van dentro de cada producto", !web.includes("«"));
  comprobar("portada: cada producto con su dibujo y su enlace a los detalles", (web.match(/href="\/producto\/\d+-[a-z-]+"/g) ?? []).length >= 8 && (web.match(/aria-label="Dibujo de /g) ?? []).length === 4);
  comprobar("portada: los detalles ya no están en la portada", !web.includes("no se desborona"));
  const ficha = await pagina("/producto/2-queso-mozzarella", "");
  comprobar("página de la mozzarella: ventajas, precio y pedir", ficha.status === 200 && ficha.html.includes("Perfecta para rallar") && ficha.html.includes("no se desborona") && ficha.html.includes("Bs 255,50") && ficha.html.includes("quiero%20pedir%20queso%20mozzarella"));
  const fichaAmarillo = await pagina("/producto/1-cualquier-nombre", "");
  comprobar("página del queso amarillo: el precio al mayor y sus detalles", fichaAmarillo.html.includes("Bs 310,25") && fichaAmarillo.html.includes("Solo al mayor") && fichaAmarillo.html.includes("Por qué elegirlo") && fichaAmarillo.html.includes("Otros productos"));
  comprobar("todos los productos tienen detalles", (await Promise.all([3, 4].map((id) => pagina(`/producto/${id}`, "")))).every((p) => p.status === 200 && p.html.includes("Por qué elegirlo")));
  comprobar("un producto que no existe da 404", (await pagina("/producto/999-nada", "")).status === 404 && (await pagina("/producto/queso", "")).status === 404);
  comprobar("web: huevos y pecorino rallado, sin precio inventado", web.includes("Huevos") && web.includes("Queso pecorino rallado") && web.includes("Consulta el precio del día"));
  comprobar("web: pedir cada producto por WhatsApp", web.includes("quiero%20pedir%20queso%20amarillo"));

  // Marcas y presentaciones: dos bolsas de pecorino. La portada dice «desde» con la más barata; la página las enseña con su foto.
  r = await enviar("/admin/productos", 'id="variante-nueva-4-nombre"', {
    producto_id: "4", nombre: "Sortilegio 500 g", descripcion: "Rallado, semigraso, madurado", costo_usd: "", precio_usd: "4", foto: fotoFirmada(),
  });
  comprobar("añadir una marca con foto a un producto", r.destino.includes("«Sortilegio 500 g» añadida") && r.destino.includes("Con su foto"), r.destino);
  varianteSortilegio = Number((await consultar("select max(id) as id from variantes"))[0].id);
  r = await enviar("/admin/productos", 'id="variante-nueva-4-nombre"', { producto_id: "4", nombre: "Guaralac 500 g", descripcion: "", costo_usd: "", precio_usd: "3.5" });
  comprobar("añadir otra sin foto", r.destino.includes("«Guaralac 500 g» añadida"), r.destino);
  const guaralacId = Number((await consultar("select max(id) as id from variantes"))[0].id);
  const portadaMarcas = (await portadaCon("Bs 127,75")).html;
  comprobar(
    "portada: el pecorino dice «desde» con la más barata (3,50) y cuántas marcas hay",
    portadaMarcas.includes("desde </span>Bs 127,75") && portadaMarcas.includes("2 marcas o presentaciones") &&
      portadaMarcas.includes('href="/producto/4-queso-pecorino-rallado#marcas"') && portadaMarcas.includes("Ver las 2 opciones y pedir"),
    portadaMarcas.slice(Math.max(0, portadaMarcas.indexOf("pecorino rallado</h2>") - 100), portadaMarcas.indexOf("pecorino rallado</h2>") + 900).replace(/\s+/g, " "),
  );
  const fichaPecorino = await pagina("/producto/4-queso-pecorino-rallado", "");
  comprobar(
    "página del pecorino: las dos marcas, con foto, descripción, precio y su botón de pedir",
    fichaPecorino.html.includes("Marcas y presentaciones") && fichaPecorino.html.includes("Sortilegio 500 g") && fichaPecorino.html.includes("Guaralac 500 g") &&
      fichaPecorino.html.includes(`/foto-variante/${varianteSortilegio}?v=`) && fichaPecorino.html.includes("Rallado, semigraso, madurado") &&
      fichaPecorino.html.includes("Bs 146,00") && fichaPecorino.html.includes("quiero%20pedir%20queso%20pecorino%20rallado%20sortilegio%20500%20g"),
  );
  comprobar(
    "con marcas, se pide desde la marca elegida: el botón de arriba lleva a las marcas y cada una tiene el suyo",
    fichaPecorino.html.includes('href="#marcas"') && fichaPecorino.html.includes('id="marcas"') && fichaPecorino.html.includes(">Pedir Sortilegio 500 g<") &&
      !fichaPecorino.html.includes(">Pedir por WhatsApp<"),
  );
  const fotoVariante = await fetch(base + `/foto-variante/${varianteSortilegio}`);
  comprobar("la foto de la marca se sirve a la web", fotoVariante.status === 200 && fotoVariante.headers.get("content-type") === "image/png");
  comprobar("la vista previa del pecorino dice «desde»", (await fetch(base + "/producto/4-queso-pecorino-rallado/opengraph-image")).status === 200);
  r = await enviar("/admin/productos", `id="variante-${varianteSortilegio}-nombre"`, { variante_id: String(varianteSortilegio), nombre: "Sortilegio 500 g", descripcion: "Rallado, semigraso, madurado", costo_usd: "", precio_usd: "4.2" });
  comprobar("cambiar el precio de una marca", r.destino.includes("guardada") && (await pagina("/admin/productos")).html.includes('value="4.2"'), r.destino);
  r = await enviar("/admin/productos", `name="variante_id" value="${guaralacId}"`, { variante_id: String(guaralacId), activo: "0" }, cookie, {}, 'name="activo"');
  const portadaUna = (await portadaCon("Bs 153,30")).html;
  comprobar(
    "escondida una, queda el precio de la otra sin «desde» (4,20 = Bs 153,30) y la página ya no la enseña",
    r.destino.includes("escondida") && !portadaUna.includes("desde </span>Bs 153,30") && !(await pagina("/producto/4", "")).html.includes("Guaralac"),
    r.destino,
  );
  await enviar("/admin/productos", `name="variante_id" value="${guaralacId}"`, { variante_id: String(guaralacId), activo: "1" }, cookie, {}, 'name="activo"');
  r = await enviar("/admin/productos", `name="variante_id" value="${varianteSortilegio}"`, { variante_id: String(varianteSortilegio), activo: "0" }, cookie, {}, 'name="activo"');
  comprobar(
    "la foto de una marca escondida no se sirve al público, solo al dueño",
    (await fetch(base + `/foto-variante/${varianteSortilegio}`)).status === 404 && (await fetch(base + `/foto-variante/${varianteSortilegio}`, { headers: { cookie } })).status === 200,
  );
  await enviar("/admin/productos", `name="variante_id" value="${varianteSortilegio}"`, { variante_id: String(varianteSortilegio), activo: "1" }, cookie, {}, 'name="activo"');
  await portadaCon("desde </span>Bs 127,75");
}

/** Alta de cliente, ventas, pago, cuentas, foto, descargas y borrados. */
async function probarNegocio() {
  const nombre = "Bodega Prueba";
  let r = await enviar("/admin/clientes", 'name="cedula_rif"', {
    nombre, telefono: "0412-0000000", direccion: "Carrera 19 con calle 25", razon_social: "Bodega Prueba, C.A.",
  });
  const clienteId = Number(r.destino.match(/nuevo=(\d+)/)?.[1]);
  comprobar(`alta de cliente (${r.ms} ms)`, r.destino.includes("Cliente guardado") && clienteId > 0, r.destino);
  if (!clienteId) throw new Error("Sin cliente no se puede seguir");

  // La nota como la de papel: 2 piezas, 2 kilos de queso amarillo a USD 5, del 1 de septiembre, por entregar.
  r = await enviar("/admin/ventas", 'name="cantidad_1"', {
    cliente_id: String(clienteId), fecha: "2026-09-01", piezas_1: "2", cantidad_1: "2", precio_1: "5", nota: "primera",
    entrega: "despacho", entrega_prevista: "2026-09-02",
  });
  comprobar(`venta con piezas, kilos y precio (${r.ms} ms)`, r.destino.includes("Venta registrada") && cerca((await cuentasDe(clienteId)).ventas, 10), r.destino);
  const pedidoId = Number(r.destino.match(/\/admin\/ventas\/(\d+)\/nota/)?.[1]);
  comprobar("la venta que se lleva al cliente queda por entregar", r.destino.includes("Queda por entregar") && pedidoId > 0, r.destino);
  const [conPiezas] = await consultar("select piezas, cantidad, precio_unitario_usd from venta_lineas where venta_id = ?", [pedidoId]);
  comprobar("las piezas quedan anotadas y el importe sale de los kilos", conPiezas.piezas == 2 && conPiezas.cantidad == 2 && conPiezas.precio_unitario_usd == 5, JSON.stringify(conPiezas));

  // El precio se escribe cada vez: sin él no se guarda, y el formulario vuelve con lo escrito.
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { cliente_id: String(clienteId), fecha: "2026-09-15", cantidad_1: "2" });
  comprobar(
    "sin precio no se guarda y se vuelve con lo escrito",
    r.destino.includes("escribe el precio en dólares") && r.destino.includes("cantidad_1=2") && r.destino.includes(`cliente_id=${clienteId}`),
    r.destino,
  );
  // La entrega se elige a mano; si ya se entregó, va con la foto de la nota firmada; si no, con el día previsto.
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { cliente_id: String(clienteId), fecha: "2026-09-15", cantidad_1: "2", precio_1: "7.48" });
  comprobar("sin decir si se entregó, no se guarda", r.destino.includes("Elige si ya la entregaste"), r.destino);
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { cliente_id: String(clienteId), fecha: "2026-09-15", cantidad_1: "2", precio_1: "7.48", entrega: "local" });
  comprobar("entregada sin la foto de la nota firmada, no se guarda", r.destino.includes("adjunta la foto de la nota firmada"), r.destino);
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { cliente_id: String(clienteId), fecha: "2026-09-15", cantidad_1: "2", precio_1: "7.48", entrega: "despacho" });
  comprobar("por entregar sin el día previsto, no se guarda", r.destino.includes("día previsto de entrega"), r.destino);
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { cliente_id: String(clienteId), fecha: "2026-09-15", cantidad_1: "2", precio_1: "7.48", entrega: "despacho", entrega_prevista: "2026-09-10" });
  comprobar("el día previsto no puede ser antes del despacho", r.destino.includes("no puede ser antes de la fecha de despacho"), r.destino);
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { cliente_id: String(clienteId), fecha: "2026-09-15", cantidad_1: "2", precio_1: "7.48", entrega: "local", foto: fotoFirmada() });
  comprobar("entregada con la foto: se guarda y la foto queda con la venta", r.destino.includes("con la foto de la nota firmada") && (await cuentasDe(clienteId)).fotos === 1, `${r.destino} ${JSON.stringify(await cuentasDe(clienteId))}`);
  let esperado = 10 + 14.96;
  comprobar("venta a 7,48 el kilo (2 × 7,48)", cerca((await cuentasDe(clienteId)).ventas, esperado), JSON.stringify(await cuentasDe(clienteId)));

  r = await enviar("/admin/clientes", 'name="cedula_rif"', { nombre: "Cliente Detal", telefono: "" });
  const detalId = Number(r.destino.match(/nuevo=(\d+)/)?.[1]);
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { cliente_id: String(detalId), fecha: "2026-09-15", cantidad_1: "2", precio_1: "8.5", entrega: "local", foto: fotoFirmada() });
  comprobar("otra venta (2 × 8,50)", cerca((await cuentasDe(detalId)).ventas, 17), JSON.stringify(await cuentasDe(detalId)));

  // Un precio que se sale de lo normal avisa y no guarda hasta confirmar.
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { cliente_id: String(detalId), fecha: "2026-09-16", cantidad_1: "1", precio_1: "85", entrega: "local", foto: fotoFirmada() });
  comprobar(
    "un precio diez veces el de la lista avisa y pide confirmar",
    r.destino.includes("se sale de lo normal") && r.destino.includes("en la lista está a") && r.destino.includes("la última vez le cobraste") &&
      r.destino.includes("confirmar=1") && cerca((await cuentasDe(detalId)).ventas, 17),
    r.destino,
  );
  // La foto que se puso no se pierde: queda aparcada y el formulario vuelve con su número.
  const fotoAparcada = Number(r.destino.match(/foto_espera=(\d+)/)?.[1]);
  const relleno = (await pagina(r.destino)).html;
  comprobar(
    "el formulario vuelve con lo escrito, la casilla de confirmar y la foto ya guardada",
    relleno.includes('value="85"') && relleno.includes('name="confirmar"') && fotoAparcada > 0 && relleno.includes(`name="foto_espera" value="${fotoAparcada}"`) && relleno.includes("ya está guardada"),
    r.destino,
  );
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { cliente_id: String(detalId), fecha: "2026-09-16", cantidad_1: "1", precio_1: "85", confirmar: "1", entrega: "local", foto_espera: String(fotoAparcada) });
  comprobar(
    "confirmado, se guarda con esa misma foto, sin repetirla",
    r.destino.includes("Venta registrada") && cerca((await cuentasDe(detalId)).ventas, 17 + 85) && (await cuentasDe(detalId)).fotos === 2 &&
      Number((await consultar("select count(*) as n from fotos_en_espera where id = ?", [fotoAparcada]))[0].n) === 0,
    `${r.destino} ${JSON.stringify(await cuentasDe(detalId))}`,
  );
  const caraId = Number(r.destino.match(/\/admin\/ventas\/(\d+)\/nota/)?.[1]);
  await enviar(`/admin/ventas/${caraId}/eliminar`, 'name="id"', { id: String(caraId) });

  // Lo que no puede ser: una fecha de mañana, 5000 kilos, sin ningún producto.
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { cliente_id: String(detalId), fecha: "2031-01-01", cantidad_1: "1", precio_1: "8.5" });
  comprobar("una fecha de despacho de mañana en adelante no vale", r.destino.includes("no puede ser de mañana"), r.destino);
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { cliente_id: String(detalId), fecha: "2026-09-16", cantidad_1: "5000", precio_1: "8.5" });
  comprobar("5000 kilos no puede ser", r.destino.includes("kilos no puede ser"), r.destino);
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { cliente_id: String(detalId), fecha: "2026-09-16" });
  comprobar("una nota sin productos no se guarda", r.destino.includes("al menos un producto"), r.destino);

  // Dos productos en la misma nota: 1 kilo de amarillo a 8,50 y medio kilo de mozzarella a 7.
  r = await enviar("/admin/ventas", 'name="cantidad_1"', {
    cliente_id: String(detalId), fecha: "2026-09-16", cantidad_1: "1", precio_1: "8.5", cantidad_2: "0.5", precio_2: "7",
    entrega: "local", foto: fotoFirmada(),
  });
  comprobar("una nota con dos productos (8,50 + medio kilo a 7)", cerca((await cuentasDe(detalId)).ventas, 17 + 8.5 + 3.5), JSON.stringify(await cuentasDe(detalId)));

  // Una marca concreta: la fila de la venta es la de esa marca, y la nota y el despacho la nombran.
  r = await enviar("/admin/ventas", 'name="cantidad_1"', {
    cliente_id: String(detalId), fecha: "2026-09-16", [`cantidad_4-${varianteSortilegio}`]: "2", [`precio_4-${varianteSortilegio}`]: "4.2",
    entrega: "despacho", entrega_prevista: "2026-09-17",
  });
  const ventaMarca = Number(r.destino.match(/\/admin\/ventas\/(\d+)\/nota/)?.[1]);
  const [lineaMarca] = ventaMarca ? await consultar("select variante_id, subtotal_usd from venta_lineas where venta_id = ?", [ventaMarca]) : [{}];
  comprobar(
    "vender una marca concreta: la línea la guarda y la nota la nombra",
    r.destino.includes("Venta registrada") && Number(lineaMarca.variante_id) === varianteSortilegio && cerca(Number(lineaMarca.subtotal_usd), 8.4) &&
      (await pagina(`/admin/ventas/${ventaMarca}/nota`)).html.includes("Queso pecorino rallado Sortilegio 500 g"),
    r.destino,
  );
  comprobar("el despacho dice qué cargar, con la marca", legible((await pagina(`/admin/despacho?solo=entregas`)).html).includes("Queso pecorino rallado Sortilegio 500 g"));
  r = await enviar("/admin/productos", `name="variante_id" value="${varianteSortilegio}"`, { variante_id: String(varianteSortilegio) }, cookie, {}, "Sí, eliminar");
  comprobar("una marca ya vendida no se borra: se esconde", r.destino.includes("no se puede borrar"), r.destino);
  await enviar(`/admin/ventas/${ventaMarca}/eliminar`, 'name="id"', { id: String(ventaMarca) });
  comprobar("borrada la venta, la cuenta vuelve a como estaba", cerca((await cuentasDe(detalId)).ventas, 17 + 8.5 + 3.5), JSON.stringify(await cuentasDe(detalId)));

  // La foto de la nota se lee: si no es una nota, o su fecha o su suma no cuadran, avisa y pide revisar.
  const cuadra = { es_nota: true, fecha: "2026-09-16", lineas: [{ descripcion: "Mozzarella", precio: 7, importe: 3.5 }], total: 3.5, firmada: true };
  const mediaMozzarella = { cliente_id: String(detalId), fecha: "2026-09-16", cantidad_2: "0.5", precio_2: "7", entrega: "local" };
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { ...mediaMozzarella, foto: fotoLeida(cuadra) });
  comprobar("la foto se lee y, si cuadra, se guarda diciéndolo", r.destino.includes("se leyó y cuadra con lo anotado"), r.destino);
  const leidaId = Number(r.destino.match(/\/admin\/ventas\/(\d+)\/nota/)?.[1]);
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { ...mediaMozzarella, foto: fotoLeida({ ...cuadra, es_nota: false }) });
  comprobar("una foto que no es la nota avisa y no guarda", r.destino.includes("no parece una nota de entrega") && r.destino.includes("confirmar_nota=1") && r.destino.includes("foto_espera="), r.destino);
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { ...mediaMozzarella, foto: fotoLeida({ ...cuadra, fecha: "2026-09-12" }) });
  comprobar("otra fecha en la nota avisa con las dos fechas", r.destino.includes("La nota dice 12/09/2026 y la fecha de despacho anotada es 16/09/2026"), r.destino);
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { ...mediaMozzarella, foto: fotoLeida({ ...cuadra, total: 5, firmada: false }) });
  comprobar(
    "una suma que no cuadra avisa: dentro de la nota, contra lo anotado, y la firma que falta",
    r.destino.includes("revisa la suma") && r.destino.includes("lo anotado suma") && r.destino.includes("No se ve la firma"),
    r.destino,
  );
  const fotoLeidaId = Number(r.destino.match(/foto_espera=(\d+)/)?.[1]);
  const conReparos = (await pagina(r.destino)).html;
  comprobar("el formulario vuelve con la foto guardada y la casilla de «ya revisé la foto»", conReparos.includes(`name="foto_espera" value="${fotoLeidaId}"`) && conReparos.includes('name="confirmar_nota"'), r.destino);
  const fotosAntes = (await cuentasDe(detalId)).fotos;
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { ...mediaMozzarella, foto_espera: String(fotoLeidaId), confirmar_nota: "1" });
  comprobar(
    "revisada y confirmada, se guarda con esa foto y sin leerla otra vez",
    r.destino.includes("Venta registrada") && r.destino.includes("con los avisos que revisaste") && (await cuentasDe(detalId)).fotos === fotosAntes + 1,
    `${r.destino} ${JSON.stringify(await cuentasDe(detalId))}`,
  );
  const confirmadaId = Number(r.destino.match(/\/admin\/ventas\/(\d+)\/nota/)?.[1]);
  comprobar("una foto que el lector no entiende no frena la venta, y se dice", (await enviar("/admin/ventas", 'name="cantidad_1"', { ...mediaMozzarella, foto: fotoFirmada() })).destino.includes("no se pudo leer esta vez"));
  const sinLeerId = Number((await consultar("select max(id) as id from ventas"))[0].id);
  for (const id of [leidaId, confirmadaId, sinLeerId]) await enviar(`/admin/ventas/${id}/eliminar`, 'name="id"', { id: String(id) });
  comprobar("las ventas de la prueba de lectura se borran y la cuenta vuelve a como estaba", cerca((await cuentasDe(detalId)).ventas, 17 + 8.5 + 3.5), JSON.stringify(await cuentasDe(detalId)));

  r = await enviar(`/admin/clientes/${clienteId}`, 'name="monto"', {
    cliente_id: String(clienteId), fecha: "2026-09-20", metodo: "pago_movil", monto: "146", tasa: "36.5",
    volver_a: `/admin/clientes/${clienteId}`,
  });
  comprobar(`pago en bolívares con tasa: Bs 146 = USD 4 (${r.ms} ms)`, r.destino.includes("Abono registrado") && cerca((await cuentasDe(clienteId)).pagos, 4));

  r = await enviar(`/admin/clientes/${clienteId}`, 'name="monto"', {
    cliente_id: String(clienteId), fecha: "2026-09-20", metodo: "pago_movil", monto: "0.1", tasa: "36.5",
    volver_a: `/admin/clientes/${clienteId}`,
  });
  comprobar("un abono que no llega a un centavo de dólar se rechaza", r.destino.includes("no llega a un centavo") && cerca((await cuentasDe(clienteId)).pagos, 4), r.destino);

  // Se mira solo la lista: el formulario de arriba nombra a todos los clientes.
  const paginaBuscada = legible((await pagina(`/admin/ventas?q=${encodeURIComponent("bodega")}`)).html);
  const desdeLaLista = paginaBuscada.slice(paginaBuscada.indexOf('id="lista"'));
  const buscada = desdeLaLista.slice(0, desdeLaLista.indexOf("</section>"));
  const porNumero = legible((await pagina(`/admin/ventas?q=${pedidoId}`)).html);
  comprobar(
    "las ventas se buscan por cliente y por número de nota",
    buscada.includes("con «bodega»") && buscada.includes(nombre) && !buscada.includes("Cliente Detal") &&
      porNumero.includes(`1 venta con «${pedidoId}»`) && legible((await pagina("/admin/ventas?q=nadie-se-llama-asi")).html).includes("Ninguna venta coincide"),
    buscada.slice(0, 200),
  );

  const ficha = (await pagina(`/admin/clientes/${clienteId}`)).html;
  comprobar("ficha: la primera nota queda abonada con USD 6 pendientes", ficha.includes(">Abonada<") && ficha.includes(usd("6,00")));
  comprobar("ficha: recordar deuda y enviar nota por WhatsApp", ficha.includes("Recordar deuda por WhatsApp") && ficha.includes(">Enviar nota<") && ficha.includes("wa.me/584120000000"));
  comprobar("ficha: la dirección entra en la ruta y tiene mapa", ficha.includes("Entra en la ruta de despacho") && ficha.includes("google.com/maps/search"));
  comprobar(
    "ficha: la nota del 1 de septiembre pasó sus 7 días de crédito y sale vencida",
    /Vencida hace \d+ días/.test(ficha) && legible(ficha).includes("Con el plazo vencido") && ficha.includes(usd("6,00")) && ficha.includes('name="dias_credito"'),
  );
  const resumen = legible((await pagina("/admin")).html);
  comprobar("resumen: quien debe sale con su plazo vencido y lo que se debe a proveedores", /Vencida hace \d+ días/.test(resumen) && resumen.includes("Debo a proveedores") && resumen.includes("A quién le debo"));
  comprobar("resumen: recuerda la entrega pendiente y dice que va atrasada", resumen.includes("Entregas pendientes (1)") && resumen.includes("1 atrasada") && resumen.includes("atrasada: era para el 02/09/2026") && resumen.includes("Hacer la ruta"));
  comprobar("la lista de ventas dice para cuándo era", legible((await pagina("/admin/ventas")).html).includes("Por entregar el 02/09/2026"));
  const recordatorio = decodeURIComponent(ficha.match(/wa\.me\/584120000000\?text=([^"]*Tiene%20pendiente[^"]*)"/)?.[1] ?? "");
  comprobar("el recordatorio por WhatsApp dice desde cuándo venció cada nota", /vencida hace \d+ días/.test(recordatorio), recordatorio);
  const caja = legible((await pagina("/admin/caja?fecha=2026-09-20")).html);
  comprobar(
    "el cierre del día 20 de septiembre cuadra el abono en bolívares por método",
    caja.includes("Cierre del 20/09/2026") && caja.includes("Pago móvil") && caja.includes("Bs 146,00") && caja.includes(usd("4,00")) && caja.includes("1 movimiento"),
  );
  comprobar("el cierre de hoy abre sin fecha", (await pagina("/admin/caja")).html.includes("Cierre del día"));
  const cuentasVencidas = legible((await pagina("/admin/cuentas")).html);
  comprobar("cuentas: columna «Vence» y total con el plazo vencido", cuentasVencidas.includes(">Vence<") && /Vencida hace \d+ días/.test(cuentasVencidas) && cuentasVencidas.includes("Con el plazo vencido"));

  // La nota de entrega de la primera venta.
  const notaId = Math.min(...[...ficha.matchAll(/\/admin\/ventas\/(\d+)\/nota/g)].map((m) => Number(m[1])));
  const nota = await pagina(`/admin/ventas/${notaId}/nota`);
  comprobar(
    `nota de entrega (${nota.ms} ms)`,
    nota.status === 200 && nota.html.includes("Nota de entrega") && legible(nota.html).includes(`N.º ${String(notaId).padStart(6, "0")}`) &&
      nota.html.includes(nombre) && nota.html.includes("0412-0000000") && nota.html.includes("Carrera 19 con calle 25") &&
      nota.html.includes(usd("10,00")) && nota.html.includes("No es una factura"),
  );
  comprobar("la nota dice las piezas junto a los kilos", legible(nota.html).includes("2 kg (2 pzas)"));
  comprobar(
    "la nota va a nombre de la razón social, a la atención del cliente",
    legible(nota.html).includes("Señor(es)") && nota.html.includes("Bodega Prueba, C.A.") && legible(nota.html).includes("Atención") &&
      (await pagina("/admin/clientes/exportar", cookie, true)).html.includes(`${nombre};Bodega Prueba, C.A.;0412-0000000`),
  );
  comprobar("la ficha entiende la dirección y dice la carrera primero", legible(ficha).includes("carrera 19 con calle 25"));
  comprobar("la nota dice lo abonado y lo que queda", nota.html.includes(usd("4,00")) && nota.html.includes(usd("6,00")) && nota.html.includes("Abonada"));
  const notaPorWhatsapp = decodeURIComponent(nota.html.match(/wa\.me\/584120000000\?text=([^"]+)"/)?.[1] ?? "");
  comprobar(
    "la nota tiene fecha límite de pago (7 días) y va con su número por WhatsApp",
    legible(nota.html).includes("Fecha límite de pago") && legible(nota.html).includes("08/09/2026") &&
      notaPorWhatsapp.includes(`Nota N.º ${String(notaId).padStart(6, "0")} del 01/09/2026`) && notaPorWhatsapp.includes("Fecha límite de pago de esta nota: 08/09/2026"),
    notaPorWhatsapp,
  );
  comprobar("una nota que no existe da 404", (await pagina("/admin/ventas/999999/nota")).status === 404);

  // La ruta de despacho.
  const despacho = await pagina("/admin/despacho");
  comprobar(
    `ruta de despacho (${despacho.ms} ms)`,
    despacho.status === 200 && despacho.html.includes(nombre) && despacho.html.includes("Vuelta a la tienda") &&
      despacho.html.includes("google.com/maps/dir/") && despacho.html.includes("Hacer la ruta"),
  );
  const soloEste = await pagina(`/admin/despacho?c=${clienteId}`);
  comprobar("ruta con un solo cliente elegido: 1 parada, 49 cuadras de ida y vuelta", /: <!-- -->1<!-- --> <!-- -->parada/.test(soloEste.html) && soloEste.html.includes("49 cuadras"), soloEste.html.match(/Los clientes elegidos[^<]*(<!-- -->[^<]*)*/)?.[0]);

  // Los pedidos por entregar: salen en el despacho con lo que hay que cargar.
  const numeroDelPedido = String(pedidoId).padStart(6, "0");
  const entregas = await pagina("/admin/despacho?solo=entregas");
  const textoEntregas = legible(entregas.html);
  comprobar(
    `el despacho enseña el pedido por entregar (${entregas.ms} ms)`,
    textoEntregas.includes("Pedidos por entregar") && textoEntregas.includes(nombre) &&
      textoEntregas.includes(`Nota ${numeroDelPedido}`) && textoEntregas.includes(">Entregado<"),
  );
  // Lo que hay que cargar se mira con el cliente solo: en la web puede haber pedidos de verdad.
  comprobar(
    "y lo que hay que cargar para llevárselo",
    legible(soloEste.html).includes("Para cargar") && /<strong>2 (kg|cartón|unidad)<\/strong>/.test(legible(soloEste.html)) &&
      legible(soloEste.html).includes("1 pedido por entregar"),
  );
  comprobar("el aviso de «vamos en camino» lleva el pedido", decodeURIComponent(entregas.html.match(/wa\.me\/584120000000\?text=([^"]+)"/)?.[1] ?? "").includes("Vamos en camino con su pedido:"));
  comprobar("la cartera dice quién tiene un pedido esperando", (await pagina("/admin/clientes")).html.includes("1 pedido por entregar"));
  comprobar("el resumen cuenta los pedidos por entregar", legible((await pagina("/admin")).html).includes("Pedidos por entregar"));

  const marca = `name="id" value="${pedidoId}"`;
  r = await enviar("/admin/despacho?solo=entregas", marca, { id: String(pedidoId), entregada: "1", volver_a: "/admin/despacho?solo=entregas" });
  comprobar("entregar sin la foto de la nota firmada no marca nada", r.destino.includes("adjunta la foto de la nota firmada") && Number((await consultar("select por_entregar from ventas where id = ?", [pedidoId]))[0].por_entregar) === 1, r.destino);
  // La foto con otra fecha y sin firma no marca nada: vuelve a la nota con la foto guardada, y desde ahí se confirma y se vuelve al despacho.
  r = await enviar("/admin/despacho?solo=entregas", marca, {
    id: String(pedidoId), entregada: "1", volver_a: "/admin/despacho?solo=entregas",
    foto: fotoLeida({ es_nota: true, fecha: "2026-01-01", lineas: [], total: 10, firmada: false }),
  });
  comprobar(
    "una nota con otra fecha y sin firma no se marca: vuelve a la nota con la foto guardada",
    r.destino.startsWith(`/admin/ventas/${pedidoId}/nota?foto_espera=`) && r.destino.includes("La nota dice 01/01/2026") && r.destino.includes("No se ve la firma") &&
      r.destino.includes("volver_a=/admin/despacho?solo=entregas") && Number((await consultar("select por_entregar from ventas where id = ?", [pedidoId]))[0].por_entregar) === 1,
    r.destino,
  );
  const fotoPedido = Number(r.destino.match(/foto_espera=(\d+)/)?.[1]);
  const notaConReparos = (await pagina(r.destino)).html;
  comprobar("la nota enseña la foto guardada, la casilla de revisada y vuelve al despacho", notaConReparos.includes(`name="foto_espera" value="${fotoPedido}"`) && notaConReparos.includes('name="confirmar_nota"') && notaConReparos.includes('name="volver_a" value="/admin/despacho?solo=entregas"'));
  r = await enviar(`/admin/ventas/${pedidoId}/nota`, marca, { id: String(pedidoId), entregada: "1", volver_a: "/admin/despacho?solo=entregas", foto_espera: String(fotoPedido), confirmar_nota: "1" });
  let [entrega] = await consultar("select por_entregar, entregada_en from ventas where id = ?", [pedidoId]);
  comprobar(
    `marcar el pedido como entregado (${r.ms} ms)`,
    r.destino.startsWith("/admin/despacho?solo=entregas&ok=") && r.destino.includes(`Nota ${numeroDelPedido} entregada`) && r.destino.includes("con su foto guardada") &&
      Number(entrega.por_entregar) === 0 && Boolean(entrega.entregada_en),
    r.destino,
  );
  const notaEntregada = await pagina(`/admin/ventas/${pedidoId}/nota`);
  comprobar("la nota dice que ya se entregó", notaEntregada.html.includes(">Entregada<") && notaEntregada.html.includes("Mandar al despacho"));
  r = await enviar(`/admin/ventas/${pedidoId}/nota`, marca, { id: String(pedidoId), entregada: "0", volver_a: "https://example.com/admin" });
  [entrega] = await consultar("select por_entregar, entregada_en from ventas where id = ?", [pedidoId]);
  comprobar(
    "devolverla al despacho, y un destino de fuera del panel no se acepta",
    r.destino.startsWith(`/admin/ventas/${pedidoId}/nota?ok=`) && Number(entrega.por_entregar) === 1 && entrega.entregada_en === null,
    r.destino,
  );
  await enviar(`/admin/ventas/${pedidoId}/nota`, marca, { id: String(pedidoId), entregada: "1", volver_a: "", foto: fotoFirmada() });

  // El estado de cuenta y el recibo del abono.
  const estado = await pagina(`/admin/clientes/${clienteId}/estado`);
  const textoEstado = legible(estado.html);
  comprobar(
    `estado de cuenta (${estado.ms} ms)`,
    estado.status === 200 && textoEstado.includes("Estado de cuenta") && textoEstado.includes(`Nota ${numeroDelPedido}`) &&
      textoEstado.includes("Abono · Pago móvil") && textoEstado.includes("Saldo por pagar") && textoEstado.includes(usd("4,00")),
  );
  comprobar("el estado de cuenta de un cliente que no existe da 404", (await pagina("/admin/clientes/999999/estado")).status === 404);
  const recibo = decodeURIComponent(ficha.match(/href="https:\/\/wa\.me\/584120000000\?text=([^"]*Recibimos[^"]*)"/)?.[1] ?? "");
  comprobar(
    "ficha: estado de cuenta y recibo del abono por WhatsApp",
    ficha.includes(`/admin/clientes/${clienteId}/estado`) && ficha.includes(">Enviar recibo<") &&
      recibo.includes("Recibimos su abono del 20/09/2026.") && recibo.includes("Método: Pago móvil") && recibo.includes("Saldo pendiente a hoy"),
    recibo,
  );

  const cuentas = await pagina("/admin/cuentas");
  comprobar(`cuentas por pagar (${cuentas.ms} ms)`, cuentas.html.includes(nombre) && cuentas.html.includes(">Recordar</a>"));
  const informe = await pagina("/admin/informe");
  comprobar(`informe por producto y por cliente, sin detal (${informe.ms} ms)`, informe.html.includes("Por producto") && informe.html.includes(nombre) && !informe.html.includes("Al detal"));
  const busca = await pagina(`/admin/clientes?q=${encodeURIComponent(nombre.slice(0, 6).toUpperCase())}`);
  comprobar("buscador de clientes sin distinguir mayúsculas", busca.html.includes(nombre) && busca.html.includes("Ver todos"));
  const productos = await pagina("/admin/productos");
  comprobar("panel de productos con el precio al mayor", productos.html.includes("Precio al mayor") && !productos.html.includes("Al detal") && productos.html.includes("Tasa del día"));

  // Foto de la nota.
  const datos = new FormData();
  datos.set(accionDe(ficha, 'name="archivo"'), "");
  datos.set("cliente_id", String(clienteId));
  datos.set("descripcion", "Nota 45");
  datos.set("archivo", new File([png], "nota.png", { type: "image/png" }));
  let respuesta = await fetch(base + `/admin/clientes/${clienteId}`, { method: "POST", headers: { cookie }, body: datos, redirect: "manual" });
  // Ya había tres: la de la venta entregada y las dos de marcar el pedido entregado.
  comprobar("subir la foto de la nota", respuesta.status === 303 && (await cuentasDe(clienteId)).fotos === 4, `${respuesta.status} ${JSON.stringify(await cuentasDe(clienteId))}`);
  const conFoto = (await pagina(`/admin/clientes/${clienteId}`)).html;
  const adjuntoId = Number(conFoto.match(/\/admin\/adjuntos\/(\d+)"/)?.[1]);
  respuesta = await fetch(base + `/admin/adjuntos/${adjuntoId}`, { headers: { cookie } });
  comprobar("la foto se sirve tal cual", respuesta.status === 200 && Buffer.from(await respuesta.arrayBuffer()).equals(png));
  respuesta = await fetch(base + `/admin/adjuntos/${adjuntoId}`, { redirect: "manual" });
  comprobar("la foto no se sirve sin sesión", respuesta.status === 307);

  const malo = new FormData();
  malo.set(accionDe(ficha, 'name="archivo"'), "");
  malo.set("cliente_id", String(clienteId));
  malo.set("archivo", new File(["hola"], "nota.txt", { type: "text/plain" }));
  respuesta = await fetch(base + `/admin/clientes/${clienteId}`, { method: "POST", headers: { cookie }, body: malo, redirect: "manual" });
  comprobar("un archivo que no es foto se rechaza", decodeURIComponent(respuesta.headers.get("location") ?? "").includes("Solo se aceptan"));

  // Descargas.
  respuesta = await fetch(base + "/admin/clientes/exportar", { headers: { cookie } });
  const csv = Buffer.from(await respuesta.arrayBuffer());
  comprobar("lista de clientes para Excel", respuesta.status === 200 && csv[0] === 0xef && csv.toString("utf8").includes(`${nombre};Bodega Prueba, C.A.;0412-0000000`));

  // Los movimientos para Excel: la venta del día 1 y el abono del día 20.
  respuesta = await fetch(base + "/admin/caja/exportar?desde=2026-09-30&hasta=2026-09-01", { headers: { cookie } });
  const movimientos = Buffer.from(await respuesta.arrayBuffer());
  const textoMovimientos = movimientos.toString("utf8");
  comprobar(
    "movimientos para Excel: una fila por venta y por abono, con coma decimal y su tasa",
    respuesta.status === 200 && movimientos[0] === 0xef && (respuesta.headers.get("content-disposition") ?? "").includes("movimientos-2026-09-01-a-2026-09-30.csv") &&
      textoMovimientos.includes("Fecha;Tipo;Nota n.º;Cliente o proveedor;") &&
      textoMovimientos.includes(`01/09/2026;Venta;${String(notaId).padStart(6, "0")};Bodega Prueba, C.A.;`) && textoMovimientos.includes(";10,00;") &&
      textoMovimientos.includes(`20/09/2026;Abono;;Bodega Prueba, C.A.;;Pago móvil;146,00;Bs;36,5000;;4,00;`),
    textoMovimientos.slice(0, 600),
  );
  respuesta = await fetch(base + "/admin/caja/exportar?forma=dias&desde=2026-09-20&hasta=2026-09-20", { headers: { cookie } });
  const porDia = Buffer.from(await respuesta.arrayBuffer()).toString("utf8");
  comprobar(
    "resumen por día para Excel: lo que entró, en bolívares y en dólares aparte",
    respuesta.status === 200 && (respuesta.headers.get("content-disposition") ?? "").includes("resumen-por-dia-2026-09-20.csv") &&
      porDia.includes("Fecha;Notas;Vendido USD;Abonos;Entró USD;Entró en bolívares;Entró en dólares;") &&
      porDia.includes("\r\n20/09/2026;0;0,00;1;4,00;146,00;0,00;0;0,00;0;0,00;4,00\r\n"),
    porDia,
  );
  respuesta = await fetch(base + "/admin/caja/exportar", { redirect: "manual" });
  comprobar("los movimientos no se descargan sin sesión", respuesta.status === 307 || respuesta.status === 401, String(respuesta.status));
  comprobar("el cierre del día ofrece la descarga para Excel", (await pagina("/admin/caja")).html.includes("Descargar para Excel"));

  respuesta = await fetch(base + "/api/copia-automatica");
  comprobar("la copia automática sin clave se niega", respuesta.status === 401);
  respuesta = await fetch(base + "/api/copia-automatica", { headers: { authorization: "Bearer " + env.CRON_SECRET } });
  const copiaNube = await respuesta.json().catch(() => ({}));
  comprobar("la copia automática con la clave del cron", respuesta.status === 200 && copiaNube.ok === true, JSON.stringify(copiaNube));

  respuesta = await fetch(base + "/admin/copia", { headers: { cookie } });
  const archivoCopia = path.join(carpetaTemporal, "copia.db");
  fs.writeFileSync(archivoCopia, Buffer.from(await respuesta.arrayBuffer()));
  const copia = new DatabaseSync(archivoCopia, { readOnly: true });
  const enCopia = copia.prepare("select (select count(*) from ventas) v, (select count(*) from adjuntos) a, (select count(*) from productos) p").get();
  copia.close();
  comprobar("la copia de seguridad lleva ventas, fotos y productos", respuesta.status === 200 && enCopia.v >= 1 && enCopia.a >= 1 && enCopia.p >= 4, JSON.stringify({ ...enCopia }));

  // Borrados, con su pantalla de confirmación.
  r = await enviar(`/admin/adjuntos/${adjuntoId}/eliminar`, 'name="id"', { id: String(adjuntoId) });
  comprobar("borrar la foto", r.destino.includes("Foto eliminada"));
  const ventaId = Number(ficha.match(/\/admin\/ventas\/(\d+)\/eliminar/)?.[1]);
  r = await enviar(`/admin/ventas/${ventaId}/eliminar`, 'name="id"', { id: String(ventaId) });
  comprobar("borrar una venta", r.destino.includes("Venta eliminada"));
  const pagoId = Number(ficha.match(/\/admin\/pagos\/(\d+)\/eliminar/)?.[1]);
  r = await enviar(`/admin/pagos/${pagoId}/eliminar`, 'name="id"', { id: String(pagoId) });
  comprobar("borrar un pago", r.destino.includes("Abono eliminado") && cerca((await cuentasDe(clienteId)).pagos, 0));
  comprobar("una venta ya borrada da 404", (await pagina(`/admin/ventas/${ventaId}/eliminar`)).status === 404);

  // Borrar un cliente entero pide la clave del panel. Se borra el cliente
  // al detal, porque la cartera de después cuenta con el mayorista.
  const aBorrar = detalId;
  const confirmacion = await pagina(`/admin/clientes/${aBorrar}/eliminar`);
  comprobar("la pantalla de borrar un cliente dice qué se lleva y pide la clave", confirmacion.html.includes("Se borran con el cliente") && confirmacion.html.includes('name="clave"'));
  r = await enviar(`/admin/clientes/${aBorrar}/eliminar`, 'name="clave"', { id: String(aBorrar), clave: "no-es-la-clave" });
  comprobar("con una clave mala no se borra nada", r.destino.includes("La clave no es correcta") && (await consultar("select count(*) as n from clientes where id = ?", [aBorrar]))[0].n == 1, r.destino);
  r = await enviar(`/admin/clientes/${aBorrar}/eliminar`, 'name="clave"', { id: String(aBorrar), clave: env.ADMIN_CLAVE });
  const [rastro] = await consultar(
    "select (select count(*) from clientes where id = ?) c, (select count(*) from ventas where cliente_id = ?) v, (select count(*) from pagos where cliente_id = ?) p",
    [aBorrar, aBorrar, aBorrar],
  );
  comprobar(`con la clave buena se borra el cliente con todo lo suyo (${r.ms} ms)`, r.destino.includes("eliminado con todo lo suyo") && rastro.c == 0 && rastro.v == 0 && rastro.p == 0, `${r.destino} ${JSON.stringify(rastro)}`);
  comprobar("un cliente ya borrado da 404", (await pagina(`/admin/clientes/${aBorrar}`)).status === 404);
}

/** Solo en local: el alta rápida, los repetidos y el orden de la ruta. */
async function probarCartera() {
  const alta = (campos) => enviar("/admin/clientes", 'name="cedula_rif"', { nombre: "", telefono: "", direccion: "", ...campos });

  let r = await alta({ telefono: "0414 555 0101", direccion: "Calle 38 con carrera 28" });
  const cercaId = Number(r.destino.match(/nuevo=(\d+)/)?.[1]);
  comprobar("alta rápida: solo teléfono y dirección, con su aviso de que falta el nombre", r.destino.includes("Cliente guardado: 0414-5550101. Sin nombre, por ahora.") && !r.destino.includes("Ojo") && cercaId > 0, r.destino);
  comprobar("la cartera y la ficha lo dicen bajito", (await pagina("/admin/clientes")).html.includes("· sin nombre") && legible((await pagina(`/admin/clientes/${cercaId}`)).html).includes("Sin nombre: "));

  r = await alta({ telefono: "04245550102", direccion: "Carrera 22 entre calles 30 y 31", nombre: "Pizzería La Esquina" });
  comprobar("alta con nombre", r.destino.includes("Cliente guardado: Pizzería La Esquina."), r.destino);

  r = await alta({ telefono: "0416-5550103", direccion: "Urb. Del Este, casa 4" });
  comprobar("una dirección fuera de la cuadrícula se guarda, con aviso", r.destino.includes("Cliente guardado") && r.destino.includes("Ojo: queda fuera de la ruta de despacho. La dirección parece una urbanización"), r.destino);
  const conAviso = legible((await pagina(r.destino)).html);
  comprobar(
    "la cartera avisa en amarillo de que esa dirección no se pudo comprobar, con el mapa y la ficha a mano",
    conAviso.includes("aviso--aviso") && conAviso.includes("no se pudo comprobar") && conAviso.includes("Urb. Del Este, casa 4") && conAviso.includes("google.com/maps/search") && conAviso.includes("Corregir la dirección"),
  );

  r = await alta({ telefono: "0426-5550109", direccion: "Av. Libertador con calle 30", nombre: "En la avenida" });
  const enLaAvenidaId = Number(r.destino.match(/nuevo=(\d+)/)?.[1]);
  comprobar("una avenida con nombre queda fuera de la ruta si el mapa no está (la prueba lo apaga)", r.destino.includes("Ojo: queda fuera de la ruta de despacho. A la dirección le falta la carrera"), r.destino);
  const fichaAvenida = legible((await pagina(`/admin/clientes/${enLaAvenidaId}`)).html);
  comprobar("la ficha ofrece buscarla en el mapa", fichaAvenida.includes("Buscar la dirección en el mapa") && fichaAvenida.includes("Tampoco") === false);
  r = await enviar(`/admin/clientes/${enLaAvenidaId}`, ">Buscar la dirección en el mapa<", { id: String(enLaAvenidaId) });
  comprobar("con el mapa apagado, buscar no la encuentra y lo dice", r.destino.includes("El mapa no encuentra esa dirección"), r.destino);

  const carteraConFaltas = legible((await pagina("/admin/clientes")).html);
  comprobar("la cartera ofrece buscar en el mapa a los que faltan", carteraConFaltas.includes("que el mapa todavía no ha buscado") && carteraConFaltas.includes("Buscar en el mapa a los que faltan"));
  r = await enviar("/admin/clientes", ">Buscar en el mapa a los que faltan<", {});
  comprobar("con el mapa apagado, a nadie sitúa y lo dice", r.destino.includes("El mapa situó a 0 de 2"), r.destino);

  r = await alta({ telefono: "+58 414 5550101", direccion: "Otra dirección" });
  comprobar("el mismo teléfono escrito de otra forma no se registra dos veces", r.destino.includes(`/admin/clientes/${cercaId}?error=`) && r.destino.includes("ya es de este cliente"), r.destino);

  r = await alta({ direccion: "Calle 30 con carrera 20" });
  comprobar("sin teléfono ni nombre no se registra", r.destino.includes("Escribe al menos el teléfono o el nombre"), r.destino);

  const guardados = await consultar("select nombre, telefono from clientes where telefono like '04%5550%' order by telefono");
  comprobar(
    "los teléfonos se guardan escritos igual",
    JSON.stringify(guardados) === JSON.stringify([
      { nombre: "0414-5550101", telefono: "0414-5550101" },
      { nombre: "0416-5550103", telefono: "0416-5550103" },
      { nombre: "Pizzería La Esquina", telefono: "0424-5550102" },
      { nombre: "En la avenida", telefono: "0426-5550109" },
    ]),
    JSON.stringify(guardados),
  );

  // La cartera ordenada por la ruta: del más cercano a la tienda al más lejano, y al final los que no se ubican.
  const cartera = (await pagina("/admin/clientes?orden=ruta")).html;
  const lista = cartera.slice(cartera.indexOf("Por ruta desde la tienda"));
  const posicion = (texto) => lista.indexOf(`>${texto}<`);
  const orden = ["0414-5550101", "Pizzería La Esquina", "Bodega Prueba", "0416-5550103"].map(posicion);
  comprobar(
    "cartera ordenada por la ruta desde la tienda",
    orden.every((p) => p > 0) && orden.join() === [...orden].sort((a, b) => a - b).join(),
    orden.join(),
  );
  comprobar("la cartera dice quién queda fuera de la ruta y por qué", legible(cartera).includes("Fuera de la ruta. La dirección parece una urbanización"));

  const busca = await pagina("/admin/clientes?q=esquina");
  comprobar("la cartera se busca por nombre", busca.html.includes("Pizzería La Esquina") && busca.html.includes("1 de "));

  const sinPedidos = legible((await pagina("/admin/despacho?solo=entregas")).html);
  comprobar("sin pedidos por entregar, el despacho lo dice", sinPedidos.includes("Por entregar (0)") && sinPedidos.includes("No hay pedidos por entregar"));

  const despacho = (await pagina("/admin/despacho")).html;
  comprobar(
    "despacho de todos: tres paradas en orden y los demás aparte",
    /: <!-- -->3<!-- --> <!-- -->paradas/.test(despacho) && despacho.includes("Fuera de la ruta") && despacho.includes("49 cuadras"),
  );
  const mapa = decodeURIComponent(despacho.match(/href="(https:\/\/www\.google\.com\/maps\/dir\/[^"]+)"/)?.[1].replace(/&amp;/g, "&").replace(/\+/g, " ") ?? "");
  comprobar(
    "el enlace de Google Maps lleva las paradas en el orden de la ruta",
    mapa.includes("origin=Calle 38 con Carrera 30, Barquisimeto") &&
      mapa.includes("waypoints=Calle 38 con Carrera 28, Barquisimeto, Lara, Venezuela|Calle 30 con Carrera 22, Barquisimeto, Lara, Venezuela|Calle 25 con Carrera 19, Barquisimeto, Lara, Venezuela"),
    mapa,
  );
  const deudores = (await pagina("/admin/despacho?solo=deben")).html;
  comprobar("despacho solo de los que deben", deudores.includes("Los clientes que deben"));
}

const AUTOR_DE_PRUEBA = "Prueba automática (borrar)";

/**
 * Las reseñas: el permiso, publicar, esconder, la foto, los ejemplos y
 * quién los ve.
 */
async function probarResenas() {
  const [producto] = await consultar("select id, nombre from productos where activo = 1 order by id limit 1");
  const paginaDelProducto = `/producto/${producto.id}`;
  const comentario = "Llega siempre a tiempo y el queso sale parejo.";
  const idDeLaPrueba = async () => Number((await consultar("select id from resenas where autor = ? order by id desc", [AUTOR_DE_PRUEBA]))[0]?.id ?? 0);

  const panel = await pagina("/admin/resenas");
  comprobar(`panel de reseñas (${panel.ms} ms)`, panel.status === 200 && panel.html.includes("Reseña nueva") && panel.html.includes("Reseñas de ejemplo"));
  const pedir = decodeURIComponent(panel.html.match(/href="https:\/\/wa\.me\/\?text=([^"]*opini[^"]*)"/)?.[1] ?? "");
  comprobar(
    "mensaje para pedir la reseña y el permiso, a quien se elija en WhatsApp",
    panel.html.includes("Pedir reseña por WhatsApp") && pedir.includes("Nos gustaría conocer su opinión sobre este producto") &&
      pedir.includes("Con su permiso") && pedir.includes("/producto/"),
    pedir,
  );

  let r = await enviar("/admin/resenas", 'name="autor"', { producto_id: String(producto.id), autor: AUTOR_DE_PRUEBA, detalle: "", texto: "" });
  comprobar("una reseña sin comentario no se guarda", r.destino.includes("Escribe el comentario del cliente"), r.destino);

  // Sin la casilla del permiso: se guarda, pero escondida.
  r = await enviar("/admin/resenas", 'name="autor"', {
    producto_id: String(producto.id), autor: `  ${AUTOR_DE_PRUEBA} `, detalle: "Pizzería · Centro", texto: ` "${comentario}" `,
  });
  const id = await idDeLaPrueba();
  const [guardada] = await consultar("select autor, texto, publicada, con_permiso, de_ejemplo from resenas where id = ?", [id]);
  comprobar(
    `sin permiso se guarda escondida, sin espacios ni comillas de más (${r.ms} ms)`,
    r.destino.includes("falta el permiso del cliente") && guardada?.autor === AUTOR_DE_PRUEBA && guardada?.texto === comentario &&
      Number(guardada?.publicada) === 0 && Number(guardada?.con_permiso) === 0 && Number(guardada?.de_ejemplo) === 0,
    `${r.destino} ${JSON.stringify(guardada)}`,
  );
  const conLaNueva = legible((await pagina("/admin/resenas")).html);
  comprobar(
    "el panel dice que le falta el permiso y cómo publicarla",
    conLaNueva.includes(`«${comentario}»`) && conLaNueva.includes(">Falta el permiso<") && conLaNueva.includes("Ya me dio permiso: publicar") &&
      conLaNueva.includes("Esperan el permiso"),
  );
  comprobar(
    "una reseña sin permiso no sale en la web, ni para el dueño",
    !(await pagina(paginaDelProducto, "")).html.includes(comentario) && !(await pagina(paginaDelProducto)).html.includes(comentario),
  );

  const marca = `name="id" value="${id}"`;
  r = await enviar("/admin/resenas", marca, { id: String(id), publicada: "1" });
  const [conPermiso] = await consultar("select publicada, con_permiso from resenas where id = ?", [id]);
  comprobar(
    "«Ya me dio permiso: publicar» anota el permiso y la publica",
    r.destino.includes("publicada") && Number(conPermiso.publicada) === 1 && Number(conPermiso.con_permiso) === 1,
    `${r.destino} ${JSON.stringify(conPermiso)}`,
  );
  const publica = legible((await pagina(paginaDelProducto, "")).html);
  comprobar(
    "publicada, sale en «Por qué elegirlo» con su autor y sus iniciales",
    publica.includes(`«${comentario}»`) && publica.includes(`<strong>${AUTOR_DE_PRUEBA}</strong>`) &&
      publica.includes("Pizzería · Centro") && publica.includes(">PA<") && publica.indexOf(comentario) > publica.indexOf("Por qué elegirlo"),
  );
  // Las ventajas salen también en la descripción para los buscadores: aquí se mira la lista.
  const ventaja = publica.indexOf("<li>Funde bien al calentar</li>");
  comprobar("las reseñas van delante de las ventajas", ventaja > 0 && publica.indexOf(`«${comentario}»`) < ventaja, String(ventaja));

  // Las de ejemplo: las ve el dueño, el público no.
  r = await enviar("/admin/resenas", 'value="poner"', { ejemplo: "poner" });
  const puestas = Number((await consultar("select count(*) as n from resenas where de_ejemplo = 1"))[0].n);
  comprobar("poner las reseñas de ejemplo de todos los productos", r.destino.includes(`Puestas ${puestas} reseñas de ejemplo`) && puestas >= 8, r.destino);
  await enviar("/admin/resenas", 'value="poner"', { ejemplo: "poner" });
  comprobar("pulsar dos veces no las duplica", Number((await consultar("select count(*) as n from resenas where de_ejemplo = 1"))[0].n) === puestas);

  const mozzarella = "/producto/2-queso-mozzarella";
  const loQueVeElPublico = legible((await pagina(mozzarella, "")).html);
  const loQueVeElDueno = legible((await pagina(mozzarella)).html);
  comprobar(
    "el público no ve ninguna reseña de ejemplo",
    !loQueVeElPublico.includes("de ejemplo") && !loQueVeElPublico.includes(">Ejemplo<") && !loQueVeElPublico.includes("solo las ves tú") &&
      loQueVeElPublico.includes("Perfecta para rallar"),
  );
  comprobar(
    "el dueño las ve, marcadas como ejemplo y con el aviso",
    loQueVeElDueno.includes("Pizzería de ejemplo") && loQueVeElDueno.includes(">Ejemplo<") && loQueVeElDueno.includes("solo las ves tú") &&
      loQueVeElDueno.includes("Gratina parejo y no se quema"),
  );
  const delPrimero = legible((await pagina(paginaDelProducto)).html);
  comprobar("en un producto con reseña propia, la propia va antes que las de ejemplo", delPrimero.indexOf(comentario) > 0 && delPrimero.indexOf(comentario) < delPrimero.indexOf("de ejemplo</strong>"));

  // Con el permiso marcado al guardarla, sale en la web en el momento.
  r = await enviar("/admin/resenas", 'name="autor"', {
    producto_id: "2", autor: "Pizzería 33 de la prueba", detalle: "", texto: "Al rallarla no se apelmaza.", permiso: "1",
  });
  comprobar(
    "con el permiso marcado se publica al guardarla",
    r.destino.includes("Ya sale en la página") && legible((await pagina(mozzarella, "")).html).includes("«Al rallarla no se apelmaza.»"),
    r.destino,
  );
  // Las reseñas van dentro de la página del producto: la portada no enseña ninguna.
  const portadaSinCitas = legible((await pagina("/", "")).html);
  comprobar(
    "la portada no enseña reseñas: están dentro de cada producto",
    !portadaSinCitas.includes("Al rallarla no se apelmaza") && !portadaSinCitas.includes("Pizzería 33 de la prueba") && !portadaSinCitas.includes("de ejemplo"),
  );
  const [ejemplo] = await consultar("select id from resenas where de_ejemplo = 1 limit 1");
  // Una de ejemplo no tiene botón de publicar: se intenta con el formulario de otra.
  r = await enviar("/admin/resenas", marca, { id: String(ejemplo.id), publicada: "1" });
  comprobar(
    "una reseña de ejemplo no se puede publicar ni a la fuerza",
    r.destino.includes("no se publica") && !legible((await pagina(mozzarella, "")).html).includes("de ejemplo"),
    r.destino,
  );
  const otra = Number((await consultar("select id from resenas where autor = 'Pizzería 33 de la prueba'"))[0].id);

  // La foto de la reseña: se ve en la web mientras la reseña se vea.
  const panelConOtra = (await pagina("/admin/resenas")).html;
  const conFoto = new FormData();
  conFoto.set(accionDe(panelConOtra, `id="foto-${otra}"`), "");
  conFoto.set("id", String(otra));
  conFoto.set("foto", new File([png], "local.png", { type: "image/png" }));
  let respuestaFoto = await fetch(base + "/admin/resenas", { method: "POST", headers: { cookie }, body: conFoto, redirect: "manual" });
  const publicaConFoto = legible((await pagina(mozzarella, "")).html);
  const direccionFoto = publicaConFoto.match(/src="(\/foto-resena\/\d+\?v=\d+)"/)?.[1];
  comprobar("ponerle una foto a una reseña: sale redonda junto al nombre", respuestaFoto.status === 303 && decodeURIComponent(respuestaFoto.headers.get("location") ?? "").includes("Foto puesta") && Boolean(direccionFoto), String(direccionFoto));
  respuestaFoto = await fetch(base + direccionFoto);
  comprobar("la foto de la reseña se sirve al público tal cual", respuestaFoto.status === 200 && Buffer.from(await respuestaFoto.arrayBuffer()).equals(png) && (respuestaFoto.headers.get("cache-control") ?? "").includes("public"));
  const conFotoMala = new FormData();
  conFotoMala.set(accionDe(panelConOtra, `id="foto-${otra}"`), "");
  conFotoMala.set("id", String(otra));
  conFotoMala.set("foto", new File(["hola"], "nota.txt", { type: "text/plain" }));
  respuestaFoto = await fetch(base + "/admin/resenas", { method: "POST", headers: { cookie }, body: conFotoMala, redirect: "manual" });
  comprobar("un archivo que no es foto se rechaza en la reseña", decodeURIComponent(respuestaFoto.headers.get("location") ?? "").includes("JPG, PNG o WebP"));
  await enviar("/admin/resenas", `name="id" value="${otra}"`, { id: String(otra), publicada: "0" });
  comprobar("escondida la reseña, su foto deja de servirse al público pero no al dueño", (await fetch(base + direccionFoto)).status === 404 && (await fetch(base + direccionFoto, { headers: { cookie } })).status === 200);
  r = await enviar("/admin/resenas", ">Quitar foto<", { id: String(otra) });
  comprobar("quitar la foto deja la reseña", r.destino.includes("Foto quitada") && (await fetch(base + direccionFoto, { headers: { cookie } })).status === 404 && (await consultar("select count(*) as n from resenas where id = ?", [otra]))[0].n == 1, r.destino);

  await enviar(`/admin/resenas/${otra}/eliminar`, 'name="id"', { id: String(otra) });

  r = await enviar("/admin/resenas", marca, { id: String(id), publicada: "0" });
  const [escondida] = await consultar("select publicada, con_permiso from resenas where id = ?", [id]);
  comprobar(
    "esconderla la quita de la web sin borrarla ni perder el permiso",
    r.destino.includes("Reseña escondida") && !(await pagina(paginaDelProducto, "")).html.includes(comentario) &&
      Number(escondida.publicada) === 0 && Number(escondida.con_permiso) === 1,
  );

  const respuesta = await fetch(base + "/admin/copia", { headers: { cookie } });
  const archivo = path.join(carpetaTemporal, "copia-resenas.db");
  fs.writeFileSync(archivo, Buffer.from(await respuesta.arrayBuffer()));
  const copia = new DatabaseSync(archivo, { readOnly: true });
  const enCopia = copia.prepare("select count(*) as n from resenas").get();
  copia.close();
  comprobar("la copia de seguridad lleva las reseñas", Number(enCopia.n) === puestas + 1, JSON.stringify({ ...enCopia }));

  r = await enviar("/admin/resenas", 'value="quitar"', { ejemplo: "quitar" });
  const quedan = await consultar("select autor, de_ejemplo from resenas");
  comprobar("quitar las de ejemplo deja las del dueño", r.destino.includes(`Quitadas ${puestas}`) && quedan.length === 1 && quedan[0].autor === AUTOR_DE_PRUEBA, JSON.stringify(quedan));

  r = await enviar(`/admin/resenas/${id}/eliminar`, 'name="id"', { id: String(id) });
  comprobar("borrar la reseña, con su confirmación", r.destino.includes("Reseña eliminada") && (await idDeLaPrueba()) === 0, r.destino);
  comprobar("una reseña ya borrada da 404", (await pagina(`/admin/resenas/${id}/eliminar`)).status === 404);
}

const PROVEEDOR_DE_PRUEBA = "Quesos de prueba (borrar)";

/** Proveedores: a quién se le debe, con sus días de crédito, compras y pagos. Borrar pide la clave. */
async function probarProveedores() {
  let r = await enviar("/admin/proveedores", 'name="dias_credito"', { nombre: PROVEEDOR_DE_PRUEBA, telefono: "0414-0000001", dias_credito: "7", cedula_rif: "", direccion: "", nota: "" });
  const id = Number(r.destino.match(/\/admin\/proveedores\/(\d+)/)?.[1]);
  comprobar(`alta de proveedor (${r.ms} ms)`, r.destino.includes("Proveedor guardado") && id > 0, r.destino);
  if (!id) throw new Error("Sin proveedor no se puede seguir");

  r = await enviar(`/admin/proveedores/${id}`, 'name="total_usd"', { proveedor_id: String(id), fecha: "2026-09-01", total_usd: "100", descripcion: "20 kg de mozzarella", nota: "" });
  comprobar("una compra de USD 100 el 1 de septiembre", r.destino.includes("Compra registrada"), r.destino);
  r = await enviar(`/admin/proveedores/${id}`, 'name="monto"', { proveedor_id: String(id), fecha: "2026-09-10", metodo: "efectivo_usd", monto: "40", tasa: "", volver_a: `/admin/proveedores/${id}` });
  comprobar("un pago de USD 40 al proveedor", r.destino.includes("Pago al proveedor registrado"), r.destino);

  const ficha = legible((await pagina(`/admin/proveedores/${id}`)).html);
  comprobar(
    "la ficha del proveedor: le debo USD 60 y la compra está vencida (y el informe suma compras y pagos)",
    ficha.includes(`Le debo ${usd("60,00")}`) && ficha.includes("20 kg de mozzarella") && ficha.includes(">Abonada<") && /Vencida hace \d+ días/.test(ficha),
  );
  const informe = legible((await pagina("/admin/informe")).html);
  comprobar("el informe suma por mes lo comprado y lo pagado a proveedores", informe.includes("Pagado a proveedores") && informe.includes("Entró neto") && informe.includes(usd("100,00")));
  const lista = legible((await pagina("/admin/proveedores")).html);
  comprobar("la lista de proveedores dice cuánto se le debe y desde cuándo", lista.includes(PROVEEDOR_DE_PRUEBA) && lista.includes(`Le debo ${usd("60,00")}`) && /Vencida hace \d+ días/.test(lista));
  const resumen = legible((await pagina("/admin")).html);
  comprobar("el resumen lo enseña en «A quién le debo»", resumen.indexOf(PROVEEDOR_DE_PRUEBA) > resumen.indexOf("A quién le debo"));

  const [compra] = await consultar("select id from compras where proveedor_id = ?", [id]);
  const [pago] = await consultar("select id from pagos_proveedores where proveedor_id = ?", [id]);
  r = await enviar(`/admin/compras/${compra.id}/eliminar`, 'name="id"', { id: String(compra.id) });
  comprobar("borrar una compra", r.destino.includes("Compra eliminada"), r.destino);
  r = await enviar(`/admin/pagos-proveedor/${pago.id}/eliminar`, 'name="id"', { id: String(pago.id) });
  comprobar("borrar un pago al proveedor", r.destino.includes("Pago eliminado"), r.destino);

  r = await enviar(`/admin/proveedores/${id}/eliminar`, 'name="clave"', { id: String(id), clave: "no-es-la-clave" });
  comprobar("borrar un proveedor con una clave mala no borra", r.destino.includes("La clave no es correcta"), r.destino);
  r = await enviar(`/admin/proveedores/${id}/eliminar`, 'name="clave"', { id: String(id), clave: env.ADMIN_CLAVE });
  comprobar("con la clave buena se borra el proveedor", r.destino.includes("eliminado con sus compras") && (await consultar("select count(*) as n from proveedores where id = ?", [id]))[0].n == 0, r.destino);
}

/**
 * La web publicada tiene los datos de verdad del negocio, así que aquí solo
 * se mira: ninguna de estas peticiones crea, cambia ni borra nada, ni gasta
 * números de nota, ni guarda copias en la nube. Todo lo que escribe se
 * prueba en local, con una base de usar y tirar.
 */
async function probarSinEscribir() {
  const pantallas = [
    ["/admin", "Resumen", "Hoy,"],
    ["/admin/clientes", "Clientes", "Cliente nuevo"],
    ["/admin/ventas", "Ventas", "Registrar venta"],
    ["/admin/pagos", "Abonos", "Registrar abono"],
    ["/admin/despacho", "Despacho", "Ruta de despacho"],
    ["/admin/cuentas", "Cuentas", "Cuentas por pagar"],
    ["/admin/informe", "Informe", "Por mes"],
    ["/admin/productos", "Productos", "Tasa del día"],
    ["/admin/resenas", "Reseñas", "Reseña nueva"],
    ["/admin/proveedores", "Proveedores", "Proveedor nuevo"],
    ["/admin/caja", "Cierre del día", "Descargar para Excel"],
    ["/admin/app", "Cómo ponerlo como app", "Añadir a pantalla de inicio"],
  ];
  const vistas = {};
  for (const [ruta, nombre, texto] of pantallas) {
    const p = await pagina(ruta);
    vistas[ruta] = p.html;
    comprobar(`panel: ${nombre} (${p.ms} ms)`, p.status === 200 && legible(p.html).includes(texto), String(p.status));
  }

  // Lo que cuelga de cada lista, si ya hay algo cargado: una ficha, una nota, un proveedor.
  const cliente = vistas["/admin/clientes"].match(/href="\/admin\/clientes\/(\d+)"/)?.[1];
  if (cliente) {
    const ficha = await pagina(`/admin/clientes/${cliente}`);
    comprobar(`la ficha de un cliente (${ficha.ms} ms)`, ficha.status === 200 && ficha.html.includes("Registrar abono") && ficha.html.includes('name="dias_credito"'));
    comprobar("su estado de cuenta", (await pagina(`/admin/clientes/${cliente}/estado`)).html.includes("Estado de cuenta"));
    comprobar("la pantalla de borrarlo pide la clave (no se envía)", (await pagina(`/admin/clientes/${cliente}/eliminar`)).html.includes('name="clave"'));
  }
  const nota = vistas["/admin/ventas"].match(/href="(\/admin\/ventas\/\d+\/nota)"/)?.[1];
  if (nota) comprobar("una nota de entrega", (await pagina(nota)).html.includes("No es una factura"));
  const proveedor = vistas["/admin/proveedores"].match(/href="(\/admin\/proveedores\/\d+)"/)?.[1];
  if (proveedor) comprobar("la ficha de un proveedor", (await pagina(proveedor)).html.includes("Registrar compra"));
  console.log(`      (con datos: ${cliente ? "cliente" : "sin clientes"}, ${nota ? "nota" : "sin notas"}, ${proveedor ? "proveedor" : "sin proveedores"})`);

  // Las descargas.
  let respuesta = await fetch(base + "/admin/clientes/exportar", { headers: { cookie } });
  let archivo = Buffer.from(await respuesta.arrayBuffer());
  comprobar("la lista de clientes para Excel", respuesta.status === 200 && archivo[0] === 0xef && archivo.toString("utf8").includes("Nombre;Razón social;Teléfono;"));
  respuesta = await fetch(base + "/admin/caja/exportar", { headers: { cookie } });
  archivo = Buffer.from(await respuesta.arrayBuffer());
  comprobar("los movimientos para Excel", respuesta.status === 200 && archivo[0] === 0xef && archivo.toString("utf8").includes("Fecha;Tipo;Nota n.º;"));
  respuesta = await fetch(base + "/admin/caja/exportar?forma=dias", { headers: { cookie } });
  comprobar("el resumen por día para Excel", respuesta.status === 200 && Buffer.from(await respuesta.arrayBuffer()).toString("utf8").includes("Fecha;Notas;Vendido USD;"));

  // La copia de seguridad: se baja, se abre y se cuenta lo que lleva. Es leer, no guardar.
  respuesta = await fetch(base + "/admin/copia", { headers: { cookie } });
  const rutaCopia = path.join(carpetaTemporal, "copia-de-la-web.db");
  fs.writeFileSync(rutaCopia, Buffer.from(await respuesta.arrayBuffer()));
  let enCopia = null;
  try {
    const copia = new DatabaseSync(rutaCopia, { readOnly: true });
    enCopia = { ...copia.prepare("select (select count(*) from clientes) clientes, (select count(*) from ventas) ventas, (select count(*) from pagos) abonos, (select count(*) from productos) productos, (select count(*) from resenas) resenas, (select count(*) from proveedores) proveedores").get() };
    copia.close();
  } catch (error) {
    enCopia = { error: String(error) };
  }
  comprobar("la copia de seguridad se descarga y se abre", respuesta.status === 200 && enCopia.productos >= 1, JSON.stringify(enCopia));
  console.log("      en la web hay:", JSON.stringify(enCopia));

  // Lo que no debe verse sin sesión.
  for (const ruta of ["/admin/clientes/exportar", "/admin/caja/exportar", "/admin/copia"]) {
    respuesta = await fetch(base + ruta, { redirect: "manual" });
    comprobar(`sin sesión no se descarga ${ruta}`, respuesta.status === 307 || respuesta.status === 401, String(respuesta.status));
  }
  for (const ruta of ["/api/tarea-diaria", "/api/copia-automatica"]) {
    respuesta = await fetch(base + ruta);
    comprobar(`sin su clave no corre ${ruta}`, respuesta.status === 401, String(respuesta.status));
  }
  comprobar("la foto de una reseña que no existe da 404", (await fetch(base + "/foto-resena/99999999")).status === 404);

  // El público no ve las reseñas de ejemplo en ningún producto ni en la portada.
  const portada = (await pagina("/", "")).html;
  const productos = [...new Set([...portada.matchAll(/href="(\/producto\/\d+-[a-z0-9-]+)"/g)].map((m) => m[1]))];
  const conEjemplo = [];
  for (const ruta of productos) if (legible((await pagina(ruta, "")).html).includes("de ejemplo")) conEjemplo.push(ruta);
  comprobar(`ninguna reseña de ejemplo a la vista del público (${productos.length} productos)`, productos.length > 0 && conEjemplo.length === 0 && !legible(portada).includes("de ejemplo"), conEjemplo.join(", "));
}

// ---------- Principal ----------

try {
  console.log(enProduccion ? `Probando ${base}, solo mirando` : "Probando en local con una base temporal");
  if (!enProduccion) await arrancarServidor();

  const web = await pagina("/", "");
  comprobar(`web pública (${web.ms} ms)`, web.status === 200 && web.html.includes("Precios de hoy") && web.html.includes("wa.me/584246343236"));

  const primera = web.html.match(/href="(\/producto\/\d+[a-z0-9-]*)"/)?.[1];
  const detalle = primera ? await pagina(primera, "") : null;
  comprobar("la página de un producto abre desde la portada", Boolean(detalle) && detalle.status === 200 && detalle.html.includes("Cómo comprar") && detalle.html.includes("Todos los productos"), String(primera));

  await probarPresentacion(web);
  await probarEntrada();
  if (enProduccion) {
    await probarSinEscribir();
  } else {
    await probarPrecios();
    await probarNegocio();
    await probarResenas();
    await probarProveedores();
    await probarCartera();
    await probarTareaDiaria();
    await probarFreno();
  }

  console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} FALLOS`);
} catch (error) {
  console.error("ERROR:", error instanceof Error ? error.message : error);
  if (salidaServidor) console.error(salidaServidor.slice(-1500));
  fallos++;
} finally {
  if (servidor) {
    servidor.kill();
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(servidor.pid), "/T", "/F"], { stdio: "ignore" });
  }
  setTimeout(() => {
    try {
      fs.rmSync(carpetaTemporal, { recursive: true, force: true });
    } catch {
      // En Windows el archivo puede seguir cogido un momento; el sistema lo limpia.
    }
    process.exit(fallos ? 1 : 0);
  }, 1500);
}
