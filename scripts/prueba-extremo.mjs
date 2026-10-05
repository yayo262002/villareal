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
import sharp from "sharp";

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
/** La foto de un producto como las de catálogo: alto y blanco, con el paquete (rojo) pequeño en el medio. */
async function fotoDeProducto() {
  const png = await sharp({ create: { width: 300, height: 600, channels: 3, background: "#ffffff" } })
    .composite([{ input: await sharp({ create: { width: 100, height: 100, channels: 3, background: "#d02020" } }).png().toBuffer(), left: 100, top: 250 }])
    .png()
    .toBuffer();
  return new File([png], "paquete.png", { type: "image/png" });
}

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

/** Escribe en el archivo temporal. Solo en local, para casos que el panel no deja crear (las tasas de otros días). */
function escribirEnLocal(sql, args = []) {
  const db = new DatabaseSync(rutaDb);
  try {
    db.prepare(sql).run(...args);
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

/** Como `portadaCon`, para cualquier página que se guarda hecha (Ofertas). */
async function paginaCon(ruta, texto) {
  let ultima = await pagina(ruta, "");
  for (let i = 0; i < 20 && !ultima.html.includes(texto); i++) {
    await new Promise((r) => setTimeout(r, 250));
    ultima = await pagina(ruta, "");
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
  for (const [k, v] of Object.entries(campos)) {
    if (Array.isArray(v)) for (const uno of v) datos.append(k, uno);
    else datos.set(k, v);
  }
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
  comprobar(
    "llamada a quien monta su negocio y cómo llegar",
    legible(html).includes("¿Estás montando tu negocio?") && html.includes("Contactar por WhatsApp") && html.includes("google.com/maps/search") && html.includes("Saltar al contenido") && html.includes('id="contacto"'),
  );

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
  const mapa = await r.text();
  comprobar("mapa del sitio con los productos, Productos, Ofertas y cada categoría", r.status === 200 && mapa.includes("/producto/") && mapa.includes("/productos<") && mapa.includes("/ofertas<") && mapa.includes("/categoria/"));
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
  comprobar("la tarea diaria exporta el día anterior (o dice que no hubo movimientos)", ["guardada", "sin_movimientos"].includes(resultado.exportacion?.estado), JSON.stringify(resultado.exportacion));
  comprobar(
    "una tasa que salta demasiado no entra sola",
    ["rechazada", "sin_respuesta", "se_queda"].includes(resultado.tasa?.estado),
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

  r = await enviar("/admin/productos/1", 'id="precio-1"', {
    id: "1", nombre: "Queso amarillo", unidad: "kg", costo_usd: "6.8",
    margen_pct: "25", precio_usd: "",
  });
  comprobar("costo 6,80 con 25 %", r.destino.includes("guardado"), r.destino);

  const panel = (await pagina("/admin/productos")).html;
  const fichaDelAmarillo = (await pagina("/admin/productos/1")).html;
  comprobar(
    "panel: precio al mayor USD 8,50 = Bs 310,25, y nada de detal",
    fichaDelAmarillo.includes('value="8.5"') && panel.includes("Bs 310,25") && panel.includes("Precio al mayor") && !panel.includes("Al detal"),
  );

  r = await enviar("/admin/productos/2", 'id="precio-2"', {
    id: "2", nombre: "Queso mozzarella", unidad: "kg", costo_usd: "",
    margen_pct: "20", precio_usd: "",
  });
  comprobar("un margen sin costo se rechaza", r.destino.includes("hace falta el costo"), r.destino);

  r = await enviar("/admin/productos/2", 'id="precio-2"', {
    id: "2", nombre: "Queso mozzarella", unidad: "kg", costo_usd: "",
    margen_pct: "", precio_usd: "7",
  });
  comprobar("un precio escrito a mano se acepta", r.destino.includes("guardado"), r.destino);

  // Bs 255,50 es el último cambio: la mozzarella a USD 7 con la tasa a 36,50.
  const web = (await portadaCon("Bs 255,50")).html;
  comprobar("web: el precio al mayor del queso amarillo en bolívares, y nada de detal", web.includes("· al mayor") && web.includes("Bs 310,25") && !web.includes("al detal") && !web.includes("Al detal"));
  comprobar("web: dólares y tasa", web.includes(usd("8,50")) && web.includes("36,50"));
  comprobar("web: la mozzarella a 7 (Bs 255,50)", web.includes("Bs 255,50"));
  comprobar("portada: sin reseñas; van dentro de cada producto", !web.includes("«"));
  comprobar("portada: cada producto con su dibujo y su enlace a los detalles", (web.match(/href="\/producto\/\d+-[a-z-]+"/g) ?? []).length >= 8 && (web.match(/aria-label="Dibujo de /g) ?? []).length === 4);
  comprobar("portada: los detalles ya no están en la portada", !web.includes("no se desborona"));
  const ficha = await pagina("/producto/2-queso-mozzarella", "");
  comprobar("página de la mozzarella: ventajas, precio y pedir", ficha.status === 200 && ficha.html.includes("Perfecta para rallar") && ficha.html.includes("no se desborona") && ficha.html.includes("Bs 255,50") && ficha.html.includes("quiero%20pedir%20queso%20mozzarella"));
  const fichaAmarillo = await pagina("/producto/1-cualquier-nombre", "");
  comprobar(
    "página del queso amarillo: el precio al mayor, sus detalles, «Agregar al carrito» y otros de su familia",
    fichaAmarillo.html.includes("Bs 310,25") && legible(fichaAmarillo.html).includes("Al mayor, por kilo") && fichaAmarillo.html.includes("Por qué elegirlo") &&
      fichaAmarillo.html.includes(">Agregar al carrito<") && fichaAmarillo.html.includes("De la misma familia") && fichaAmarillo.html.includes('href="/categoria/quesos"'),
  );
  comprobar("todos los productos tienen detalles", (await Promise.all([3, 4].map((id) => pagina(`/producto/${id}`, "")))).every((p) => p.status === 200 && p.html.includes("Por qué elegirlo")));
  comprobar("un producto que no existe da 404", (await pagina("/producto/999-nada", "")).status === 404 && (await pagina("/producto/queso", "")).status === 404);
  comprobar("web: huevos y pecorino rallado, sin precio inventado", web.includes("Huevos") && web.includes("Queso pecorino rallado") && web.includes("Consulta el precio del día"));
  comprobar("web: cada tarjeta con su «Agregar» y sus detalles; en la página, el pedido directo por WhatsApp", web.includes(">Agregar<") && web.includes(">Ver detalles<") && fichaAmarillo.html.includes("quiero%20pedir%20queso%20amarillo"));

  // Marcas y presentaciones: dos bolsas de pecorino. La portada dice «desde» con la más barata; la página las enseña con su foto.
  r = await enviar("/admin/productos/4", 'id="variante-nueva-4-nombre"', {
    producto_id: "4", nombre: "Sortilegio 500 g", descripcion: "Rallado, semigraso, madurado", costo_usd: "", precio_usd: "4", foto: fotoFirmada(),
  });
  comprobar("añadir una marca con foto a un producto", r.destino.includes("«Sortilegio 500 g» añadida") && r.destino.includes("Con su foto"), r.destino);
  varianteSortilegio = Number((await consultar("select max(id) as id from variantes"))[0].id);
  r = await enviar("/admin/productos/4", 'id="variante-nueva-4-nombre"', { producto_id: "4", nombre: "Guaralac 500 g", descripcion: "", costo_usd: "", precio_usd: "3.5" });
  comprobar("añadir otra sin foto", r.destino.includes("«Guaralac 500 g» añadida"), r.destino);
  const guaralacId = Number((await consultar("select max(id) as id from variantes"))[0].id);
  const portadaMarcas = (await portadaCon("Bs 127,75")).html;
  comprobar(
    "portada: el pecorino dice «desde» con la más barata (3,50) y cuántas marcas hay",
    portadaMarcas.includes("desde </span>Bs 127,75") && portadaMarcas.includes("2 marcas o presentaciones") &&
      portadaMarcas.includes('href="/producto/4-queso-pecorino-rallado#marcas"') && portadaMarcas.includes(">Ver opciones<") && portadaMarcas.includes("Ver las 2 opciones de Queso pecorino rallado"),
    portadaMarcas.slice(Math.max(0, portadaMarcas.indexOf("pecorino rallado</a>") - 100), portadaMarcas.indexOf("pecorino rallado</a>") + 900).replace(/\s+/g, " "),
  );
  const fichaPecorino = await pagina("/producto/4-queso-pecorino-rallado", "");
  comprobar(
    "página del pecorino: las dos marcas, con foto, descripción, precio y su botón de pedir",
    fichaPecorino.html.includes("Marcas y presentaciones") && fichaPecorino.html.includes("Sortilegio 500 g") && fichaPecorino.html.includes("Guaralac 500 g") &&
      fichaPecorino.html.includes(`/foto-variante/${varianteSortilegio}?v=`) && fichaPecorino.html.includes("Rallado, semigraso, madurado") &&
      fichaPecorino.html.includes("Bs 146,00") && fichaPecorino.html.includes("quiero%20pedir%20queso%20pecorino%20rallado%20sortilegio%20500%20g"),
  );
  // Las marcas van en su sección; debajo, otros productos de la familia con su propio «Agregar».
  const inicioMarcas = fichaPecorino.html.indexOf('id="marcas"');
  const seccionDeMarcas = fichaPecorino.html.slice(inicioMarcas, fichaPecorino.html.indexOf("</section>", inicioMarcas));
  comprobar(
    "con marcas, se pide desde la marca elegida: el botón de arriba lleva a las marcas y cada una tiene el suyo",
    fichaPecorino.html.includes('href="#marcas"') && fichaPecorino.html.includes('id="marcas"') && fichaPecorino.html.includes('aria-label="Pedir Sortilegio 500 g por WhatsApp"') &&
      !fichaPecorino.html.includes('quiero%20pedir%20queso%20pecorino%20rallado."') && (seccionDeMarcas.match(/>Agregar</g) ?? []).length === 2,
  );
  const fotoVariante = await fetch(base + `/foto-variante/${varianteSortilegio}`);
  comprobar("la foto de la marca se sirve a la web", fotoVariante.status === 200 && fotoVariante.headers.get("content-type") === "image/png");
  comprobar("la vista previa del pecorino dice «desde»", (await fetch(base + "/producto/4-queso-pecorino-rallado/opengraph-image")).status === 200);
  r = await enviar("/admin/productos/4", `id="variante-${varianteSortilegio}-nombre"`, { variante_id: String(varianteSortilegio), nombre: "Sortilegio 500 g", descripcion: "Rallado, semigraso, madurado", costo_usd: "", precio_usd: "4.2" });
  comprobar("cambiar el precio de una marca", r.destino.includes("guardada") && (await pagina("/admin/productos/4")).html.includes('value="4.2"'), r.destino);
  r = await enviar("/admin/productos/4", `id="variante-${varianteSortilegio}-nombre"`, {
    variante_id: String(varianteSortilegio), nombre: "Sortilegio 500 g", descripcion: "Rallado, semigraso, madurado", costo_usd: "", precio_usd: "4.2", foto: await fotoDeProducto(),
  });
  const fotoGuardada = await fetch(base + `/foto-variante/${varianteSortilegio}`);
  const fotoBuffer = Buffer.from(await fotoGuardada.arrayBuffer());
  const fotoMeta = await sharp(fotoBuffer).metadata();
  const pixeles = await sharp(fotoBuffer).raw().toBuffer();
  const pixel = (x, y) => [pixeles[(y * 800 + x) * 3], pixeles[(y * 800 + x) * 3 + 1], pixeles[(y * 800 + x) * 3 + 2]];
  const esRojo = ([r2, g, b]) => r2 > 150 && g < 90 && b < 90;
  comprobar(
    "la foto de una marca se guarda cuadrada (800 × 800, JPEG) y sin el fondo que sobra: el paquete llena la foto",
    r.destino.includes("Con su foto") && fotoGuardada.headers.get("content-type") === "image/jpeg" && fotoMeta.width === 800 && fotoMeta.height === 800 &&
      esRojo(pixel(400, 400)) && esRojo(pixel(45, 45)) && esRojo(pixel(755, 755)) && !esRojo(pixel(10, 10)),
    `${r.destino} ${fotoGuardada.headers.get("content-type")} ${fotoMeta.width}x${fotoMeta.height} centro=${pixel(400, 400)} esquina=${pixel(45, 45)}`,
  );
  r = await enviar("/admin/productos/4", `name="variante_id" value="${guaralacId}"`, { variante_id: String(guaralacId), activo: "0" }, cookie, {}, 'name="activo"');
  const portadaUna = (await portadaCon("Bs 153,30")).html;
  comprobar(
    "escondida una, queda el precio de la otra sin «desde» (4,20 = Bs 153,30) y la página ya no la enseña",
    r.destino.includes("escondida") && !portadaUna.includes("desde </span>Bs 153,30") && !(await pagina("/producto/4", "")).html.includes("Guaralac"),
    r.destino,
  );
  await enviar("/admin/productos/4", `name="variante_id" value="${guaralacId}"`, { variante_id: String(guaralacId), activo: "1" }, cookie, {}, 'name="activo"');
  r = await enviar("/admin/productos/4", `name="variante_id" value="${varianteSortilegio}"`, { variante_id: String(varianteSortilegio), activo: "0" }, cookie, {}, 'name="activo"');
  comprobar(
    "la foto de una marca escondida no se sirve al público, solo al dueño",
    (await fetch(base + `/foto-variante/${varianteSortilegio}`)).status === 404 && (await fetch(base + `/foto-variante/${varianteSortilegio}`, { headers: { cookie } })).status === 200,
  );
  await enviar("/admin/productos/4", `name="variante_id" value="${varianteSortilegio}"`, { variante_id: String(varianteSortilegio), activo: "1" }, cookie, {}, 'name="activo"');
  await portadaCon("desde </span>Bs 127,75");

  // Cada marca tiene su página: se llega pinchándola, con su foto, su precio, su descripción entera y su botón de pedir.
  const rutaSortilegio = `/producto/4-queso-pecorino-rallado/${varianteSortilegio}-sortilegio-500-g`;
  r = await enviar("/admin/productos/4", `id="variante-${varianteSortilegio}-nombre"`, {
    variante_id: String(varianteSortilegio), nombre: "Sortilegio 500 g", descripcion: "Rallado, semigraso, madurado\nBolsa de 500 g\nPara pastas y pizzas", costo_usd: "", precio_usd: "4.2",
  });
  comprobar("la descripción de una marca puede tener varias líneas", r.destino.includes("guardada"), r.destino);
  const conEnlace = (await pagina("/producto/4-queso-pecorino-rallado", "")).html;
  comprobar(
    "en la página del producto cada marca lleva a la suya, y de su descripción se ve la primera línea",
    conEnlace.includes(`href="${rutaSortilegio}"`) && conEnlace.includes(">Ver detalles<") && conEnlace.includes("Rallado, semigraso, madurado") && !conEnlace.includes("Para pastas y pizzas"),
  );
  const paginaMarca = await pagina(rutaSortilegio, "");
  const textoMarca = legible(paginaMarca.html);
  comprobar(
    "la página de la marca: su nombre, su foto, su precio, toda su descripción, su botón de pedir y las otras marcas",
    paginaMarca.status === 200 && textoMarca.includes("Queso pecorino rallado Sortilegio 500 g") && paginaMarca.html.includes(`/foto-variante/${varianteSortilegio}?v=`) &&
      textoMarca.includes("Bs 153,30") && textoMarca.includes("<li>Para pastas y pizzas</li>") && paginaMarca.html.includes(">Pedir por WhatsApp<") &&
      paginaMarca.html.includes("quiero%20pedir%20queso%20pecorino%20rallado%20sortilegio%20500%20g") && textoMarca.includes("Otras marcas de queso pecorino rallado") &&
      textoMarca.includes("Guaralac 500 g") && paginaMarca.html.includes('rel="canonical"'),
    String(paginaMarca.status),
  );
  const rutaGuaralac = `/producto/4-queso-pecorino-rallado/${guaralacId}-guaralac-500-g`;
  await enviar("/admin/productos/4", `name="variante_id" value="${guaralacId}"`, { variante_id: String(guaralacId), activo: "0" }, cookie, {}, 'name="activo"');
  const escondida = (await pagina(rutaGuaralac, "")).status;
  await enviar("/admin/productos/4", `name="variante_id" value="${guaralacId}"`, { variante_id: String(guaralacId), activo: "1" }, cookie, {}, 'name="activo"');
  comprobar(
    "una marca escondida, una de otro producto o un número que no existe dan 404; con otro nombre detrás, llega igual",
    escondida === 404 && (await pagina(`/producto/1-queso-amarillo/${varianteSortilegio}-sortilegio`, "")).status === 404 &&
      (await pagina("/producto/4-queso-pecorino-rallado/999999-nada", "")).status === 404 && (await pagina(`/producto/4/${varianteSortilegio}`, "")).status === 200,
    String(escondida),
  );
  comprobar("la vista previa de la marca al compartirla", (await fetch(base + `${rutaSortilegio}/opengraph-image`)).status === 200);
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
  comprobar("el día previsto no puede ser antes de la fecha de la nota", r.destino.includes("no puede ser antes de la fecha de la nota"), r.destino);
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { cliente_id: String(clienteId), fecha: "2026-09-15", cantidad_1: "2", precio_1: "7.48", entrega: "local", entrega_prevista: "2026-10-27", foto: fotoFirmada() });
  comprobar("«ya la entregué» con un día previsto de entrega no se guarda", r.destino.includes("Marcaste «Sí, ya la entregué» y a la vez pusiste un día previsto de entrega (27/10/2026)"), r.destino);
  const dentroDeDosMeses = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { cliente_id: String(clienteId), fecha: "2026-09-15", cantidad_1: "2", precio_1: "7.48", entrega: "despacho", entrega_prevista: dentroDeDosMeses });
  comprobar("un día previsto a más de un mes pide confirmar", r.destino.includes("está a más de un mes") && r.destino.includes("confirmar=1"), r.destino);
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
  r = await enviar("/admin/productos/4", `name="variante_id" value="${varianteSortilegio}"`, { variante_id: String(varianteSortilegio) }, cookie, {}, "Sí, eliminar");
  comprobar("una marca ya vendida no se borra: se esconde", r.destino.includes("no se puede borrar"), r.destino);
  await enviar(`/admin/ventas/${ventaMarca}/eliminar`, 'name="id"', { id: String(ventaMarca) });
  comprobar("borrada la venta, la cuenta vuelve a como estaba", cerca((await cuentasDe(detalId)).ventas, 17 + 8.5 + 3.5), JSON.stringify(await cuentasDe(detalId)));

  // La foto de la nota se lee: si no es una nota, o su fecha o su suma no cuadran, avisa y pide revisar.
  const cuadra = { es_nota: true, fecha: "2026-09-16", lineas: [{ descripcion: "Mozzarella", clave: "2", cantidad: 0.5, precio: 7, importe: 3.5 }], total: 3.5, firmada: true };
  const mediaMozzarella = { cliente_id: String(detalId), fecha: "2026-09-16", cantidad_2: "0.5", precio_2: "7", entrega: "local" };
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { ...mediaMozzarella, foto: fotoLeida(cuadra) });
  comprobar("la foto se lee y, si cuadra, se guarda diciéndolo", r.destino.includes("se leyó y cuadra con lo anotado"), r.destino);
  const leidaId = Number(r.destino.match(/\/admin\/ventas\/(\d+)\/nota/)?.[1]);
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { ...mediaMozzarella, foto: fotoLeida({ ...cuadra, es_nota: false }) });
  comprobar("una foto que no es la nota avisa y no guarda", r.destino.includes("no parece una nota de entrega") && r.destino.includes("confirmar_nota=1") && r.destino.includes("foto_espera="), r.destino);
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { ...mediaMozzarella, foto: fotoLeida({ ...cuadra, fecha: "2026-09-12" }) });
  comprobar("otra fecha en la nota avisa con las dos fechas", r.destino.includes("La nota dice 12/09/2026 y anotaste 16/09/2026 como fecha de la nota"), r.destino);
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

  // La captura del pago se lee sola: sin monto, rellena el abono; con monto, lo comprueba; y queda guardada con el abono.
  // Línea a línea: otros kilos, un producto que no se anotó, uno anotado que la nota no trae.
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { ...mediaMozzarella, foto: fotoLeida({ ...cuadra, lineas: [{ descripcion: "Mozzarella", clave: "2", cantidad: 1, precio: 7, importe: 7 }], total: 7 }) });
  comprobar(
    "la nota dice otros kilos: lo dice con el nombre del producto, y no repite el total",
    r.destino.includes("En la nota Queso mozzarella son 1 kg y anotaste 0,5 kg") && r.destino.includes(`importa ${usd("7,00")} y lo anotado da ${usd("3,50")}`) && !r.destino.includes("lo anotado suma"),
    r.destino,
  );
  r = await enviar("/admin/ventas", 'name="cantidad_1"', {
    ...mediaMozzarella,
    foto: fotoLeida({ ...cuadra, lineas: [...cuadra.lineas, { descripcion: "queso amarillo", clave: null, cantidad: 2, precio: 8.5, importe: 17 }], total: 20.5 }),
  });
  comprobar("la nota trae un producto que no se anotó", r.destino.includes(`En la nota hay «queso amarillo» por ${usd("17,00")} que no anotaste`), r.destino);
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { ...mediaMozzarella, cantidad_3: "1", precio_3: "3.4", foto: fotoLeida(cuadra) });
  comprobar("se anotó un producto que la nota no trae", r.destino.includes("Anotaste 1 cartón de Huevos y en la nota no aparece"), r.destino);
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { ...mediaMozzarella, foto: fotoLeida({ ...cuadra, lineas: [{ descripcion: "mozarela cuadrada", clave: null, cantidad: 0.5, precio: 7, importe: 3.5 }] }) });
  comprobar("sin clave del lector, la línea se reconoce por el nombre y cuadra", r.destino.includes("se leyó y cuadra con lo anotado"), r.destino);
  await enviar(`/admin/ventas/${Number(r.destino.match(/\/admin\/ventas\/(\d+)\/nota/)?.[1])}/eliminar`, 'name="id"', { id: String(Number(r.destino.match(/\/admin\/ventas\/(\d+)\/nota/)?.[1])) });
  const capturaBs = { es_comprobante: true, metodo: "pago_movil", moneda: "VES", monto: 3650, fecha: "2026-09-21", referencia: "004512", banco: "Banesco" };
  const fichaDetal = `/admin/clientes/${detalId}`;
  r = await enviar(fichaDetal, 'name="monto"', { cliente_id: String(detalId), fecha: "2026-09-16", metodo: "pago_movil", monto: "", tasa: "36.5", volver_a: fichaDetal, foto: fotoLeida(capturaBs) });
  comprobar(
    "sin monto, la captura se lee: monto, método, fecha y referencia, y el equivalente en dólares a la tasa del día",
    r.destino.includes("Leí la captura") && r.destino.includes("monto=3650") && r.destino.includes("metodo=pago_movil") && r.destino.includes("fecha=2026-09-21") &&
      r.destino.includes("referencia=004512") && r.destino.includes("foto_espera=") && r.destino.includes("100,00"),
    r.destino,
  );
  const capturaEspera = Number(r.destino.match(/foto_espera=(\d+)/)?.[1]);
  const abonoLeido = (await pagina(r.destino)).html;
  comprobar(
    "el formulario del abono vuelve relleno con lo leído y con la captura ya guardada",
    abonoLeido.includes('value="3650"') && abonoLeido.includes('value="004512"') && abonoLeido.includes(`name="foto_espera" value="${capturaEspera}"`),
  );
  r = await enviar(fichaDetal, 'name="monto"', {
    cliente_id: String(detalId), fecha: "2026-09-21", metodo: "pago_movil", monto: "3650", tasa: "36.5", referencia: "004512", volver_a: fichaDetal, foto_espera: String(capturaEspera),
  });
  const [captura] = await consultar("select a.id, a.pago_id, p.monto_usd from adjuntos a join pagos p on p.id = a.pago_id where a.cliente_id = ?", [detalId]);
  comprobar(
    "al guardar, el abono entra en dólares (3650 / 36,5 = 100) y la captura queda unida a él, con su enlace en la ficha",
    r.destino.includes("Abono registrado con su captura") && Boolean(captura) && cerca(Number(captura?.monto_usd), 100) && (await pagina(fichaDetal)).html.includes(`/admin/adjuntos/${captura?.id}`),
    `${r.destino} ${JSON.stringify(captura)}`,
  );
  r = await enviar(fichaDetal, 'name="monto"', { cliente_id: String(detalId), fecha: "2026-09-21", metodo: "pago_movil", monto: "3000", tasa: "36.5", volver_a: fichaDetal, foto: fotoLeida(capturaBs) });
  comprobar("con un monto que no es el de la captura, avisa y pide revisar", r.destino.includes("La captura dice Bs 3.650,00 y escribiste Bs 3.000,00") && r.destino.includes("confirmar_captura=1"), r.destino);
  r = await enviar(fichaDetal, 'name="monto"', { cliente_id: String(detalId), fecha: "2026-09-21", metodo: "pago_movil", monto: "3000", tasa: "36.5", volver_a: fichaDetal, foto: fotoLeida({ ...capturaBs, es_comprobante: false }) });
  comprobar("una foto que no es un comprobante avisa", r.destino.includes("no parece el comprobante"), r.destino);
  r = await enviar(fichaDetal, 'name="monto"', { cliente_id: String(detalId), fecha: "2026-09-21", metodo: "transferencia", monto: "3650", tasa: "36.5", volver_a: fichaDetal, foto: fotoLeida(capturaBs) });
  comprobar("la captura es de un pago móvil y se eligió transferencia: avisa", r.destino.includes("La captura parece un pago por pago móvil y elegiste Transferencia"), r.destino);
  r = await enviar(fichaDetal, 'name="monto"', { cliente_id: String(detalId), fecha: "2026-09-21", metodo: "pago_movil", monto: "100", tasa: "36.5", volver_a: fichaDetal });
  comprobar("un pago móvil sin comprobante no se registra", r.destino.includes("Falta adjuntar el comprobante de pago") && r.destino.includes("Pago móvil"), r.destino);
  r = await enviar(fichaDetal, 'name="monto"', { cliente_id: String(detalId), fecha: "2026-09-21", metodo: "zelle", monto: "10", tasa: "", volver_a: fichaDetal });
  comprobar("un Zelle sin comprobante tampoco", r.destino.includes("Falta adjuntar el comprobante de pago"), r.destino);
  r = await enviar(fichaDetal, 'name="monto"', { cliente_id: String(detalId), fecha: "2026-09-21", metodo: "efectivo_usd", monto: "1", tasa: "", volver_a: fichaDetal });
  const [efectivo] = await consultar("select max(id) as id from pagos where cliente_id = ?", [detalId]);
  comprobar("en efectivo no hace falta comprobante", r.destino.includes("Abono registrado") && Boolean(efectivo?.id), r.destino);
  await enviar(`/admin/pagos/${efectivo.id}/eliminar`, 'name="id"', { id: String(efectivo.id) });
  r = await enviar(fichaDetal, 'name="monto"', { cliente_id: String(detalId), fecha: "2026-09-21", metodo: "", monto: "1", tasa: "", volver_a: fichaDetal });
  comprobar("sin decir cómo pagó, no se registra", r.destino.includes("Elige cómo pagó"), r.destino);

  // La tasa de cada día: la de un abono de ese día, o la vigente si no hay nada de ese día.
  const tasaDel21 = await (await fetch(base + "/admin/tasas/2026-09-21", { headers: { cookie } })).json();
  const tasaDel10 = await (await fetch(base + "/admin/tasas/2026-09-10", { headers: { cookie } })).json();
  comprobar(
    "la tasa de un día: la del abono de ese día, y si no la vigente, diciendo de dónde sale",
    tasaDel21?.valor === 36.5 && tasaDel21.fuente === "abono" && tasaDel10?.valor === 36.5 && tasaDel10.fuente === "actual" && typeof tasaDel10.descripcion === "string",
    JSON.stringify([tasaDel21, tasaDel10]),
  );
  comprobar("la tasa de un día no se consulta sin sesión", (await fetch(base + "/admin/tasas/2026-09-21", { redirect: "manual" })).status !== 200);

  // Los fines de semana vale la tasa del lunes, como en los comercios (aquí, con tasas de 2031 puestas a mano en la base temporal).
  escribirEnLocal("insert or replace into tasas (fecha, valor, origen) values ('2031-03-07', 40, 'bcv'), ('2031-03-10', 41, 'bcv')");
  const [viernes, sabado, domingo] = await Promise.all(
    ["2031-03-07", "2031-03-08", "2031-03-09"].map(async (f) => (await fetch(base + `/admin/tasas/${f}`, { headers: { cookie } })).json()),
  );
  comprobar(
    "el sábado y el domingo valen con la tasa del lunes; el viernes, con la suya",
    viernes?.valor === 40 && viernes.fuente === "bcv" && sabado?.valor === 41 && sabado.fuente === "lunes" && sabado.desde === "2031-03-10" &&
      domingo?.valor === 41 && String(sabado.descripcion).includes("lunes 10/03/2031"),
    JSON.stringify([viernes, sabado, domingo]),
  );
  r = await enviar(fichaDetal, 'name="monto"', { cliente_id: String(detalId), fecha: "2026-09-21", metodo: "pago_movil", monto: "365", tasa: "", volver_a: fichaDetal, foto: fotoFirmada() });
  const [sinTasa] = await consultar("select id, tasa, monto_usd from pagos where cliente_id = ? order by id desc limit 1", [detalId]);
  comprobar(
    "un abono en bolívares sin tasa escrita toma la que había ese día (365 / 36,5 = 10) y lo dice",
    r.destino.includes("Abono registrado") && r.destino.includes("Tasa del 21/09/2026") && cerca(Number(sinTasa.tasa), 36.5) && cerca(Number(sinTasa.monto_usd), 10),
    `${r.destino} ${JSON.stringify(sinTasa)}`,
  );
  await enviar(`/admin/pagos/${sinTasa.id}/eliminar`, 'name="id"', { id: String(sinTasa.id) });
  r = await enviar(fichaDetal, 'name="monto"', { cliente_id: String(detalId), fecha: "2026-09-21", metodo: "pago_movil", monto: "20", tasa: "36.5", volver_a: fichaDetal, foto: fotoFirmada() });
  comprobar("Bs 20 a 36,50 no llegan a un dólar: pregunta si de verdad fue en bolívares", r.destino.includes("¿Seguro que el abono fue en bolívares?") && r.destino.includes("confirmar_monto=1"), r.destino);
  r = await enviar(fichaDetal, 'name="monto"', { cliente_id: String(detalId), fecha: "2026-09-21", metodo: "pago_movil", monto: "20", tasa: "36.5", confirmar_monto: "1", volver_a: fichaDetal, foto: fotoFirmada() });
  const [confirmado] = await consultar("select id, monto_usd from pagos where cliente_id = ? order by id desc limit 1", [detalId]);
  comprobar("confirmado, se guarda igual (USD 0,55)", r.destino.includes("Abono registrado") && cerca(Number(confirmado.monto_usd), 0.55), r.destino);
  await enviar(`/admin/pagos/${confirmado.id}/eliminar`, 'name="id"', { id: String(confirmado.id) });
  const abonoConFecha = (await pagina(`/admin/clientes/${detalId}`)).html;
  comprobar("el formulario del abono pide la fecha del pago, cómo pagó, y el monto con la tasa de ese día", abonoConFecha.includes("Fecha del pago") && abonoConFecha.includes("Elige cómo pagó") && abonoConFecha.includes("Tasa de ese día") && abonoConFecha.includes('id="pago-captura-ayuda"'));

  r = await enviar(`/admin/clientes/${clienteId}`, 'name="monto"', {
    cliente_id: String(clienteId), fecha: "2026-09-20", metodo: "pago_movil", monto: "146", tasa: "36.5",
    volver_a: `/admin/clientes/${clienteId}`, foto: fotoFirmada(),
  });
  comprobar(`pago en bolívares con tasa: Bs 146 = USD 4 (${r.ms} ms)`, r.destino.includes("Abono registrado") && cerca((await cuentasDe(clienteId)).pagos, 4));

  r = await enviar(`/admin/clientes/${clienteId}`, 'name="monto"', {
    cliente_id: String(clienteId), fecha: "2026-09-20", metodo: "pago_movil", monto: "0.1", tasa: "36.5",
    volver_a: `/admin/clientes/${clienteId}`, foto: fotoFirmada(),
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
  // «Recordar» va por /admin/recordar/[id], que manda a wa.me con el mensaje armado (y deja anotado el día).
  const recordatorio = (await pagina(`/admin/recordar/${clienteId}`)).destino;
  comprobar("el recordatorio por WhatsApp dice desde cuándo venció cada nota", recordatorio.includes("wa.me/584120000000") && /vencida hace \d+ días/.test(recordatorio), recordatorio);
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

  // El enlace personal del cliente: con él ve su cuenta sin clave; sin él, nada.
  let fichaEnlace = (await pagina(`/admin/clientes/${clienteId}`)).html;
  comprobar("sin enlace, la ficha ofrece crearlo", fichaEnlace.includes("Crear su enlace de cuenta") && !fichaEnlace.includes("/cuenta/"));
  r = await enviar(`/admin/clientes/${clienteId}`, 'name="enlace_de_cuenta" value="crear"', { id: String(clienteId), enlace_de_cuenta: "crear" });
  const [{ enlace }] = await consultar("select enlace from clientes where id = ?", [clienteId]);
  comprobar("crear el enlace de cuenta", r.destino.includes("Enlace creado") && /^[a-hj-km-np-z2-9]{14}$/.test(String(enlace)), `${r.destino} ${enlace}`);
  const cuenta = await pagina(`/cuenta/${enlace}`, "");
  const textoCuenta = legible(cuenta.html);
  comprobar(
    "el cliente abre su cuenta con el enlace, sin clave: su nombre, lo pendiente, sus notas por pagar y su último abono, y nada de otros",
    cuenta.status === 200 && textoCuenta.includes(nombre) && textoCuenta.includes("Tienes pendiente") && textoCuenta.includes(usd("20,96")) &&
      textoCuenta.includes("2 notas por pagar") && textoCuenta.includes(`Nota ${numeroDelPedido}`) && textoCuenta.includes("Pago móvil") &&
      !textoCuenta.includes("Cliente Detal") && textoCuenta.includes("días pendiente") && textoCuenta.includes("Queso amarillo ×") &&
      cuenta.html.includes(`href="/cuenta/${enlace}/notas"`) && cuenta.html.includes(`href="/cuenta/${enlace}/abonos"`),
    `${cuenta.status} ${textoCuenta.slice(0, 400)}`,
  );
  const notasDelCliente = await pagina(`/cuenta/${enlace}/notas`, "");
  comprobar(
    "sus notas: por pagar y pagadas, cada una con su estado y su enlace",
    notasDelCliente.status === 200 && legible(notasDelCliente.html).includes("Abonada") && legible(notasDelCliente.html).includes("Por pagar") &&
      notasDelCliente.html.includes(`href="/cuenta/${enlace}/nota/${pedidoId}"`),
    String(notasDelCliente.status),
  );
  const notaDelCliente = legible((await pagina(`/cuenta/${enlace}/nota/${pedidoId}`, "")).html);
  comprobar(
    "la nota entera para el cliente: lo que llevaba, el total, lo abonado, lo que queda y pedir lo mismo",
    notaDelCliente.includes(`Nota ${numeroDelPedido}`) && notaDelCliente.includes("Queso amarillo") && notaDelCliente.includes(usd("10,00")) &&
      notaDelCliente.includes(usd("4,00")) && notaDelCliente.includes(usd("6,00")) && notaDelCliente.includes("Pedir lo mismo otra vez") &&
      notaDelCliente.includes("Fecha límite de pago"),
    notaDelCliente.slice(0, 600),
  );
  const [abonoDelCliente] = await consultar("select id from pagos where cliente_id = ? order by id desc limit 1", [clienteId]);
  const abonosDelCliente = await pagina(`/cuenta/${enlace}/abonos`, "");
  comprobar(
    "sus abonos, con el método, los bolívares con su tasa, el comprobante y el enlace al recibo",
    abonosDelCliente.status === 200 && legible(abonosDelCliente.html).includes("Pago móvil") && legible(abonosDelCliente.html).includes("Bs 146,00") &&
      legible(abonosDelCliente.html).includes("con comprobante") && abonosDelCliente.html.includes(`href="/cuenta/${enlace}/abono/${abonoDelCliente.id}"`),
    String(abonosDelCliente.status),
  );
  const reciboDelCliente = await pagina(`/cuenta/${enlace}/abono/${abonoDelCliente.id}`, "");
  const comprobanteDelCliente = reciboDelCliente.html.match(new RegExp(`/cuenta/${enlace}/comprobante/(\\d+)`))?.[1];
  comprobar(
    "el recibo de un abono: monto, tasa, método y el comprobante que mandó, que se sirve solo con su enlace",
    reciboDelCliente.status === 200 && legible(reciboDelCliente.html).includes("Recibo de abono") && legible(reciboDelCliente.html).includes(usd("4,00")) &&
      Boolean(comprobanteDelCliente) && (await fetch(base + `/cuenta/${enlace}/comprobante/${comprobanteDelCliente}`)).status === 200 &&
      (await fetch(base + `/cuenta/abcdefghjkmnpq/comprobante/${comprobanteDelCliente}`)).status === 404,
    `${reciboDelCliente.status} ${comprobanteDelCliente}`,
  );
  const [ventaAjena] = await consultar("select id from ventas where cliente_id <> ? order by id limit 1", [clienteId]);
  comprobar(
    "la nota o el abono de otro cliente, o uno que no existe, dan 404",
    (await pagina(`/cuenta/${enlace}/nota/${ventaAjena.id}`, "")).status === 404 && (await pagina(`/cuenta/${enlace}/nota/999999`, "")).status === 404 &&
      (await pagina(`/cuenta/${enlace}/abono/999999`, "")).status === 404,
  );
  const movimientosDelCliente = legible((await pagina(`/cuenta/${enlace}/movimientos`, "")).html);
  comprobar("sus movimientos, con el saldo después de cada uno", movimientosDelCliente.includes("Todos los movimientos") && movimientosDelCliente.includes("Saldo") && movimientosDelCliente.includes("Pago móvil"));
  comprobar(
    "la cuenta no se indexa ni sale a los buscadores",
    cuenta.html.includes('name="robots"') && cuenta.html.includes("noindex") && (await (await fetch(base + "/robots.txt")).text()).includes("/cuenta"),
  );
  comprobar("un enlace que no existe o mal escrito da 404", (await pagina("/cuenta/abcdefghjkmnpq", "")).status === 404 && (await pagina("/cuenta/x", "")).status === 404);
  fichaEnlace = (await pagina(`/admin/clientes/${clienteId}`)).html;
  comprobar(
    "la ficha enseña el enlace, lo manda por WhatsApp y el recordatorio de deuda lo lleva",
    fichaEnlace.includes(`/cuenta/${enlace}`) && fichaEnlace.includes("Mandárselo por WhatsApp") &&
      (await pagina(`/admin/recordar/${clienteId}`)).destino.includes(`/cuenta/${enlace}`),
  );
  r = await enviar(`/admin/clientes/${clienteId}`, 'name="enlace_de_cuenta" value="renovar"', { id: String(clienteId), enlace_de_cuenta: "renovar" });
  const [{ enlace: enlaceNuevo }] = await consultar("select enlace from clientes where id = ?", [clienteId]);
  comprobar(
    "renovar el enlace: el viejo deja de funcionar y el nuevo abre",
    r.destino.includes("renovado") && enlaceNuevo !== enlace && (await pagina(`/cuenta/${enlace}`, "")).status === 404 && (await pagina(`/cuenta/${enlaceNuevo}`, "")).status === 200,
    r.destino,
  );
  const recibo = decodeURIComponent(ficha.match(/href="https:\/\/wa\.me\/584120000000\?text=([^"]*Recibimos[^"]*)"/)?.[1] ?? "");
  comprobar(
    "ficha: estado de cuenta y recibo del abono por WhatsApp",
    ficha.includes(`/admin/clientes/${clienteId}/estado`) && ficha.includes(">Enviar recibo<") &&
      recibo.includes("Recibimos su abono del 20/09/2026.") && recibo.includes("Método: Pago móvil") && recibo.includes("Saldo pendiente a hoy"),
    recibo,
  );

  const cuentas = await pagina("/admin/cuentas");
  comprobar(`lo que te deben (${cuentas.ms} ms)`, cuentas.html.includes(nombre) && cuentas.html.includes(">Recordar</a>"));
  const informe = await pagina("/admin/estadisticas?periodo=todo");
  const textoInforme = legible(informe.html);
  comprobar(
    `estadísticas: por producto, por cliente, cómo pagaron, por día de la semana, todos los movimientos, y nada de detal (${informe.ms} ms)`,
    textoInforme.includes("Por producto") && textoInforme.includes(nombre) && textoInforme.includes("Cómo pagaron") && textoInforme.includes("Pago móvil") &&
      textoInforme.includes("Por día de la semana") && textoInforme.includes("Todos los movimientos") && textoInforme.includes("Exportaciones diarias") && !textoInforme.includes("Al detal"),
  );
  const estadisticasDelMes = legible((await pagina("/admin/estadisticas?desde=2026-09-01&hasta=2026-09-30")).html);
  comprobar("estadísticas de un período a medida: septiembre, con la venta de prueba", estadisticasDelMes.includes("Período del 01/09/2026 al 30/09/2026") && estadisticasDelMes.includes(nombre));
  comprobar("el enlace viejo del informe lleva a estadísticas", (await pagina("/admin/informe")).destino.includes("/admin/estadisticas"));
  // La tarea diaria rehace las exportaciones de un rango: aquí, septiembre, mientras sus movimientos existen.
  const respuestaTarea = await fetch(base + "/api/tarea-diaria?desde=2026-09-01&hasta=2026-09-30", { headers: { authorization: "Bearer " + env.CRON_SECRET } });
  const rehecha = await respuestaTarea.json().catch(() => ({}));
  const excelDelDia = await fetch(base + "/admin/exportaciones/2026-09-20", { headers: { cookie } });
  const textoExcel = Buffer.from(await excelDelDia.arrayBuffer()).toString("utf8");
  comprobar(
    "las exportaciones de septiembre se guardan día a día y el Excel del 20 se baja desde el panel",
    rehecha.exportacion?.estado === "guardada" && rehecha.exportacion.dias >= 3 && excelDelDia.status === 200 && (excelDelDia.headers.get("content-disposition") ?? "").includes("movimientos-2026-09-20.csv") &&
      textoExcel.includes("20/09/2026;Abono;;Bodega Prueba, C.A.;;Pago móvil;146,00;Bs;36,5000;;4,00;"),
    `${JSON.stringify(rehecha.exportacion)} ${excelDelDia.status} ${textoExcel.slice(0, 200)}`,
  );
  comprobar("un día sin movimientos no tiene Excel, y sin sesión no se baja ninguno", (await fetch(base + "/admin/exportaciones/2026-09-02", { headers: { cookie } })).status === 404 && (await fetch(base + "/admin/exportaciones/2026-09-20", { redirect: "manual" })).status !== 200);
  comprobar("las estadísticas listan la exportación del 20 de septiembre", (await pagina("/admin/estadisticas")).html.includes('href="/admin/exportaciones/2026-09-20"'));
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
  comprobar("subir la foto de la nota", respuesta.status === 303 && (await cuentasDe(clienteId)).fotos === 5, `${respuesta.status} ${JSON.stringify(await cuentasDe(clienteId))}`);
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
  const posicion = (texto) => lista.indexOf(texto);
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
  // La reseña de una marca sale en la página de esa marca, no en la del producto ni en la de la otra marca.
  const rutaSortilegio = `/producto/4-queso-pecorino-rallado/${varianteSortilegio}-sortilegio-500-g`;
  const deLaMarca = "Rinde más en las pastas y no se apelmaza.";
  const panelConMarcas = (await pagina("/admin/resenas")).html;
  comprobar(
    "en el panel la reseña se escribe en su marca, y cada marca tiene su botón para pedirla",
    panelConMarcas.includes(`value="4-${varianteSortilegio}"`) && panelConMarcas.includes("Queso pecorino rallado Sortilegio 500 g") && !panelConMarcas.includes('<option value="4">'),
  );
  r = await enviar("/admin/resenas", 'name="autor"', { clave: `4-${varianteSortilegio}`, autor: "Restaurante de la marca (prueba)", detalle: "", texto: deLaMarca, permiso: "1" });
  comprobar("guardar la reseña de una marca", r.destino.includes("Ya sale en la página de «Queso pecorino rallado Sortilegio 500 g»"), r.destino);
  const marcaConResena = legible((await pagina(rutaSortilegio, "")).html);
  const productoSinElla = legible((await pagina("/producto/4-queso-pecorino-rallado", "")).html);
  comprobar(
    "sale en la página de la marca y no en la del producto, que dice cuántas tiene cada marca",
    marcaConResena.includes(`«${deLaMarca}»`) && marcaConResena.indexOf(deLaMarca) > marcaConResena.indexOf("Por qué elegirlo") &&
      !productoSinElla.includes(deLaMarca) && productoSinElla.includes("1 reseña"),
  );
  r = await enviar("/admin/resenas", 'name="autor"', { clave: `1-${varianteSortilegio}`, autor: "Nadie", detalle: "", texto: "No vale", permiso: "1" });
  comprobar("una marca que no es de ese producto no se acepta", r.destino.includes("Elige de qué producto"), r.destino);
}

const PROVEEDOR_DE_PRUEBA = "Quesos de prueba (borrar)";

/** Proveedores: a quién se le debe, con sus días de crédito, compras y pagos. Borrar pide la clave. */
async function probarProveedores() {
  let r = await enviar("/admin/proveedores", 'name="dias_credito"', { nombre: PROVEEDOR_DE_PRUEBA, telefono: "0414-0000001", dias_credito: "7", cedula_rif: "", direccion: "", nota: "" });
  const id = Number(r.destino.match(/\/admin\/proveedores\/(\d+)/)?.[1]);
  comprobar(`alta de proveedor (${r.ms} ms)`, r.destino.includes("Proveedor guardado") && id > 0, r.destino);
  if (!id) throw new Error("Sin proveedor no se puede seguir");

  r = await enviar(`/admin/proveedores/${id}`, 'name="otros_usd"', { proveedor_id: String(id), fecha: "2026-09-01", cantidad_2: "20", precio_2: "5", otros_usd: "", descripcion: "20 kg de mozzarella", nota: "" });
  comprobar("una compra de USD 100 el 1 de septiembre", r.destino.includes("Compra registrada"), r.destino);
  r = await enviar(`/admin/proveedores/${id}`, 'name="monto"', { proveedor_id: String(id), fecha: "2026-09-10", metodo: "efectivo_usd", monto: "40", tasa: "", volver_a: `/admin/proveedores/${id}` });
  comprobar("un pago de USD 40 al proveedor", r.destino.includes("Pago al proveedor registrado"), r.destino);

  const ficha = legible((await pagina(`/admin/proveedores/${id}`)).html);
  comprobar(
    "la ficha del proveedor: le debo USD 60 y la compra está vencida (y el informe suma compras y pagos)",
    ficha.includes(`Le debo ${usd("60,00")}`) && ficha.includes("20 kg de mozzarella") && ficha.includes(">Abonada<") && /Vencida hace \d+ días/.test(ficha),
  );
  const informe = legible((await pagina("/admin/estadisticas")).html);
  comprobar("las estadísticas suman por mes lo comprado y lo pagado a proveedores", informe.includes("Pagado a proveedores") && informe.includes("Entró neto") && informe.includes(usd("100,00")));
  const lista = legible((await pagina("/admin/proveedores")).html);
  comprobar("la lista de proveedores dice cuánto se le debe y desde cuándo", lista.includes(PROVEEDOR_DE_PRUEBA) && lista.includes(`Le debo ${usd("60,00")}`) && /Vencida hace \d+ días/.test(lista));
  const resumen = legible((await pagina("/admin")).html);
  comprobar("el resumen lo enseña en «A quién le debo»", resumen.indexOf(PROVEEDOR_DE_PRUEBA) > resumen.indexOf("A quién le debo"));

  // La captura del pago al proveedor: se lee sola, el pago va con la tasa de ese día y la captura queda unida a él.
  const fichaRuta = `/admin/proveedores/${id}`;
  const capturaProv = { es_comprobante: true, metodo: "pago_movil", moneda: "VES", monto: 3650, fecha: "2026-09-21", referencia: "778899", banco: "Banesco" };
  r = await enviar(fichaRuta, 'name="monto"', { proveedor_id: String(id), fecha: "2026-09-16", metodo: "pago_movil", monto: "", tasa: "36.5", volver_a: fichaRuta, foto: fotoLeida(capturaProv) });
  comprobar(
    "sin monto, la captura del pago al proveedor se lee y el formulario vuelve relleno",
    r.destino.includes("Leí la captura") && r.destino.includes("monto=3650") && r.destino.includes("fecha=2026-09-21") && r.destino.includes("foto_espera="),
    r.destino,
  );
  const capturaEsperaProv = Number(r.destino.match(/foto_espera=(\d+)/)?.[1]);
  r = await enviar(fichaRuta, 'name="monto"', {
    proveedor_id: String(id), fecha: "2026-09-21", metodo: "pago_movil", monto: "3650", tasa: "", referencia: "778899", volver_a: fichaRuta, foto_espera: String(capturaEsperaProv),
  });
  const [capturaProveedor] = await consultar(
    "select a.id, a.pago_proveedor_id, p.monto_usd, p.tasa from adjuntos_proveedores a join pagos_proveedores p on p.id = a.pago_proveedor_id where a.proveedor_id = ?",
    [id],
  );
  comprobar(
    "el pago entra con la tasa de ese día (sin escribirla) y la captura queda unida a él",
    r.destino.includes("Pago al proveedor registrado con su captura") && r.destino.includes("Tasa del 21/09/2026") && Boolean(capturaProveedor) &&
      capturaProveedor.tasa > 0 && cerca(Number(capturaProveedor.monto_usd), 3650 / Number(capturaProveedor.tasa)),
    `${r.destino} ${JSON.stringify(capturaProveedor)}`,
  );
  const fichaConCaptura = (await pagina(fichaRuta)).html;
  comprobar("la ficha enlaza la captura del pago y el formulario pide cómo pagaste", fichaConCaptura.includes(`/admin/adjuntos-proveedor/${capturaProveedor.id}`) && fichaConCaptura.includes("Cómo pagaste"));
  const archivo = await pagina(`/admin/adjuntos-proveedor/${capturaProveedor.id}`, cookie, true);
  comprobar(
    "la captura se abre con sesión y no sin ella",
    archivo.status === 200 && archivo.cabeceras.get("content-type") === "image/png" && (await pagina(`/admin/adjuntos-proveedor/${capturaProveedor.id}`, "")).status !== 200,
    String(archivo.status),
  );

  // El enlace del proveedor: con él ve nuestra cuenta con él, sin clave.
  r = await enviar(fichaRuta, 'name="enlace_de_cuenta" value="crear"', { id: String(id), enlace_de_cuenta: "crear" });
  const [{ enlace: enlaceProv }] = await consultar("select enlace from proveedores where id = ?", [id]);
  comprobar("crear el enlace del proveedor", r.destino.includes("Enlace creado") && typeof enlaceProv === "string" && enlaceProv.length === 14, r.destino);
  const cuentaProv = await pagina(`/proveedor/${enlaceProv}`, "");
  const textoProv = legible(cuentaProv.html);
  comprobar(
    "el proveedor ve, sin clave, lo que le debemos, la compra y los pagos con su comprobante",
    cuentaProv.status === 200 && textoProv.includes(PROVEEDOR_DE_PRUEBA) && textoProv.includes("20 kg de mozzarella") && textoProv.includes("Pago móvil") &&
      textoProv.includes(`/proveedor/${enlaceProv}/comprobante/${capturaProveedor.id}`) && cuentaProv.html.includes("noindex"),
    String(cuentaProv.status),
  );
  comprobar(
    "su comprobante se abre con su enlace; otro, o un enlace inventado, dan 404",
    (await pagina(`/proveedor/${enlaceProv}/comprobante/${capturaProveedor.id}`, "", true)).status === 200 &&
      (await pagina(`/proveedor/${enlaceProv}/comprobante/999999`, "")).status === 404 && (await pagina("/proveedor/abcdefghjkmnpq", "")).status === 404,
  );
  const fichaConEnlace = (await pagina(fichaRuta)).html;
  comprobar(
    "la ficha del proveedor enseña el enlace, lo manda por WhatsApp y los buscadores no entran",
    fichaConEnlace.includes(`/proveedor/${enlaceProv}`) && fichaConEnlace.includes("Mandárselo por WhatsApp") && (await (await fetch(base + "/robots.txt")).text()).includes("/proveedor"),
  );
  r = await enviar(fichaRuta, 'name="enlace_de_cuenta" value="renovar"', { id: String(id), enlace_de_cuenta: "renovar" });
  comprobar("renovar el enlace: el viejo deja de funcionar", r.destino.includes("Enlace renovado") && (await pagina(`/proveedor/${enlaceProv}`, "")).status === 404, r.destino);


  const [compra] = await consultar("select id from compras where proveedor_id = ?", [id]);
  // El último pago es el de la captura: al borrarlo, la captura se va con él.
  const [pago] = await consultar("select id from pagos_proveedores where proveedor_id = ? order by id desc limit 1", [id]);
  r = await enviar(`/admin/compras/${compra.id}/eliminar`, 'name="id"', { id: String(compra.id) });
  comprobar("borrar una compra", r.destino.includes("Compra eliminada"), r.destino);
  r = await enviar(`/admin/pagos-proveedor/${pago.id}/eliminar`, 'name="id"', { id: String(pago.id) });
  comprobar("borrar un pago al proveedor se lleva su captura", r.destino.includes("Pago eliminado") && (await consultar("select count(*) as n from adjuntos_proveedores where pago_proveedor_id = ?", [pago.id]))[0].n == 0, r.destino);

  r = await enviar(`/admin/proveedores/${id}/eliminar`, 'name="clave"', { id: String(id), clave: "no-es-la-clave" });
  comprobar("borrar un proveedor con una clave mala no borra", r.destino.includes("La clave no es correcta"), r.destino);
  r = await enviar(`/admin/proveedores/${id}/eliminar`, 'name="clave"', { id: String(id), clave: env.ADMIN_CLAVE });
  comprobar(
    "con la clave buena se borra el proveedor, con sus capturas",
    r.destino.includes("eliminado con sus compras") && (await consultar("select count(*) as n from proveedores where id = ?", [id]))[0].n == 0 &&
      (await consultar("select count(*) as n from adjuntos_proveedores where proveedor_id = ?", [id]))[0].n == 0,
    r.destino,
  );
}

/**
 * La web publicada tiene los datos de verdad del negocio, así que aquí solo
 * se mira: ninguna de estas peticiones crea, cambia ni borra nada, ni gasta
 * números de nota, ni guarda copias en la nube. Todo lo que escribe se
 * prueba en local, con una base de usar y tirar.
 */
const PROVEEDOR_DE_INVENTARIO = "Lácteos de prueba (borrar)";

/**
 * El inventario entra con las compras (sus líneas de producto) y sale con
 * cada venta; el peso por pieza se aprende de las notas; recordar una
 * deuda deja anotado el día; y los nombres nuevos: «Fecha de la nota»,
 * «Lo que te deben», «Inventario».
 */
async function probarInventario() {
  const hoyIso = new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);
  const hoyCorta = `${hoyIso.slice(8, 10)}/${hoyIso.slice(5, 7)}/${hoyIso.slice(0, 4)}`;
  const kg = (n) => new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 }).format(n);

  // Un cliente propio con tres notas de mozzarella con piezas y kilos; la primera, del 1 de septiembre, ya venció.
  let r = await enviar("/admin/clientes", 'name="cedula_rif"', { nombre: "Charcutería Inventario", telefono: "0412-0000009", direccion: "Carrera 20 con calle 30", razon_social: "" });
  const clienteId = Number(r.destino.match(/nuevo=(\d+)/)?.[1]);
  comprobar("alta del cliente del inventario", r.destino.includes("Cliente guardado") && clienteId > 0, r.destino);
  if (!clienteId) throw new Error("Sin cliente no se puede seguir");
  for (const [fecha, piezas, kilos] of [["2026-09-01", "2", "5"], [hoyIso, "2", "5.2"], [hoyIso, "4", "9.8"]]) {
    r = await enviar("/admin/ventas", 'name="cantidad_1"', { cliente_id: String(clienteId), fecha, piezas_2: piezas, cantidad_2: kilos, precio_2: "7.7", entrega: "local", foto: fotoFirmada() });
    comprobar(`venta de ${piezas} piezas y ${kilos} kg de mozzarella`, r.destino.includes("Venta registrada"), r.destino);
  }
  const ventas = legible((await pagina("/admin/ventas")).html);
  comprobar(
    "la fecha se llama como en el papel, «Fecha de la nota», y el formulario ya sabe lo que pesa una pieza",
    ventas.includes("Fecha de la nota") && !ventas.includes("Fecha de despacho") && ventas.includes("Suele pesar 2,5 kg por pieza"),
  );
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { cliente_id: String(clienteId), fecha: hoyIso, piezas_2: "2", cantidad_2: "8", precio_2: "7.7", entrega: "local", foto: fotoFirmada() });
  comprobar(
    "2 piezas y 8 kg no casan con 2,5 kg por pieza: avisa y pide confirmar",
    r.destino.includes("cada pieza suele pesar 2,5 kg (en tus últimas 3 notas)") && r.destino.includes("4 kg por pieza") && r.destino.includes("confirmar=1"),
    r.destino,
  );
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { cliente_id: String(clienteId), fecha: hoyIso, piezas_2: "2", cantidad_2: "5.3", precio_2: "7.7" });
  comprobar("2 piezas y 5,3 kg sí casan: pasa sin aviso (y se para después, en la entrega)", r.destino.includes("Elige si ya la entregaste") && !r.destino.includes("suele pesar"), r.destino);

  // El proveedor y la compra como la nota: una fila por producto con sus kilos y su costo.
  r = await enviar("/admin/proveedores", 'name="dias_credito"', { nombre: PROVEEDOR_DE_INVENTARIO, telefono: "0414-0000002", dias_credito: "7", cedula_rif: "", direccion: "", nota: "" });
  const proveedorId = Number(r.destino.match(/\/admin\/proveedores\/(\d+)/)?.[1]);
  if (!proveedorId) throw new Error("Sin proveedor no se puede seguir");
  const fichaProveedor = (await pagina(`/admin/proveedores/${proveedorId}`)).html;
  comprobar(
    "la compra se anota como la nota: una fila por producto con piezas, kilos y costo, y «otras cosas»",
    fichaProveedor.includes('name="piezas_2"') && fichaProveedor.includes('name="cantidad_3"') && fichaProveedor.includes('name="precio_3"') && fichaProveedor.includes('name="otros_usd"'),
  );
  const compraBase = { proveedor_id: String(proveedorId), descripcion: "", nota: "", otros_usd: "" };
  r = await enviar(`/admin/proveedores/${proveedorId}`, 'name="otros_usd"', { ...compraBase, fecha: "2026-09-20" });
  comprobar("una compra sin productos ni otras cosas no se guarda", r.destino.includes("Escribe los kilos y el costo de al menos un producto"), r.destino);
  r = await enviar(`/admin/proveedores/${proveedorId}`, 'name="otros_usd"', { ...compraBase, fecha: "2026-09-20", cantidad_2: "20" });
  comprobar("kilos sin costo no se guardan, y el formulario vuelve con lo escrito", r.destino.includes("escribe el costo") && r.destino.includes("cantidad_2=20"), r.destino);
  r = await enviar(`/admin/proveedores/${proveedorId}`, 'name="otros_usd"', { ...compraBase, fecha: "2026-09-20", cantidad_2: "1", precio_2: "50" });
  comprobar("un costo por encima del precio de venta pide confirmar", r.destino.includes("lo vendes a") && r.destino.includes("confirmar=1"), r.destino);
  r = await enviar(`/admin/proveedores/${proveedorId}`, 'name="otros_usd"', { ...compraBase, fecha: "2031-01-01", cantidad_2: "1", precio_2: "5" });
  comprobar("una compra de mañana en adelante no vale", r.destino.includes("no puede ser de mañana"), r.destino);
  r = await enviar(`/admin/proveedores/${proveedorId}`, 'name="otros_usd"', { ...compraBase, fecha: "2026-09-20", piezas_2: "8", cantidad_2: "20", precio_2: "5", cantidad_3: "10", precio_3: "2", otros_usd: "4" });
  comprobar(`compra con líneas: 20 kg de mozzarella, 10 cartones de huevos y 4 dólares de flete (${r.ms} ms)`, r.destino.includes("Compra registrada") && r.destino.includes("inventario"), r.destino);
  const [compra] = await consultar("select id, total_usd, descripcion from compras where proveedor_id = ? order by id desc limit 1", [proveedorId]);
  comprobar(
    "el total sale de las líneas más lo otro, y la descripción se escribe sola",
    compra && cerca(compra.total_usd, 124) && compra.descripcion.includes("20 kg de Queso mozzarella") && compra.descripcion.includes("Huevos") && compra.descripcion.includes("otras cosas"),
    JSON.stringify(compra),
  );
  const lineasDeCompra = await consultar("select * from compra_lineas where compra_id = ? order by id", [compra.id]);
  comprobar(
    "las líneas quedan guardadas con sus piezas y su subtotal",
    lineasDeCompra.length === 2 && lineasDeCompra[0].piezas == 8 && cerca(lineasDeCompra[0].subtotal_usd, 100) && cerca(lineasDeCompra[1].subtotal_usd, 20),
    JSON.stringify(lineasDeCompra),
  );
  comprobar("la ficha del proveedor enseña la compra con sus productos", legible((await pagina(`/admin/proveedores/${proveedorId}`)).html).includes("20 kg de Queso mozzarella"));

  // El inventario: lo comprado menos todo lo vendido de mozzarella en estas pruebas.
  const [{ vendido }] = await consultar("select coalesce(sum(cantidad), 0) as vendido from venta_lineas where producto_id = 2 and variante_id is null");
  let existencia = Math.round((20 - vendido) * 1000) / 1000;
  let inventario = legible((await pagina("/admin/inventario")).html);
  comprobar(
    `inventario: hay ${kg(existencia)} kg de mozzarella (20 comprados menos ${kg(vendido)} vendidos), con su peso por pieza, y los huevos comprados`,
    inventario.includes(`${kg(existencia)} kg`) && inventario.includes("2,5 kg por pieza") && inventario.includes("Huevos") && inventario.includes("10 cart"),
  );
  r = await enviar("/admin/inventario", 'name="motivo"', { clave: "2", tipo: "recuento", cantidad: "15", motivo: "Recuento de prueba" });
  comprobar("un recuento corrige la existencia a lo contado", r.destino.includes(`pasa de ${kg(existencia)} kg a 15 kg`), r.destino);
  const [ajuste] = await consultar("select cantidad, motivo from inventario_ajustes order by id desc limit 1");
  comprobar("el ajuste guardado es lo contado menos lo que había", ajuste && cerca(ajuste.cantidad, 15 - existencia) && ajuste.motivo === "Recuento de prueba", JSON.stringify(ajuste));
  r = await enviar("/admin/inventario", 'name="motivo"', { clave: "2", tipo: "merma", cantidad: "1", motivo: "" });
  comprobar("una merma resta", r.destino.includes("quedan 14 kg"), r.destino);
  existencia = 14;
  inventario = legible((await pagina("/admin/inventario")).html);
  comprobar("la existencia y los últimos recuentos y mermas salen en Inventario", inventario.includes("14 kg") && inventario.includes("Recuento de prueba") && inventario.includes("Merma"));
  r = await enviar("/admin/ventas", 'name="cantidad_1"', { cliente_id: String(clienteId), fecha: hoyIso, cantidad_2: "30", precio_2: "7.7", entrega: "local", foto: fotoFirmada() });
  comprobar("vender más de lo que hay en inventario avisa y pide confirmar", r.destino.includes("anotaste 30 kilos y en el inventario hay 14") && r.destino.includes("confirmar=1"), r.destino);
  comprobar("el formulario de venta dice lo que hay", legible((await pagina("/admin/ventas")).html).includes("Hay 14 kg"));

  // Recordatorios de cobro: la nota del 1 de septiembre ya pasó su semana.
  let resumen = legible((await pagina("/admin")).html);
  comprobar(
    "el resumen pide recordar a quien pasó su plazo y aún no se le ha recordado",
    resumen.includes("Cobros para recordar") && resumen.includes(`data-recordar="${clienteId}"`) && resumen.includes(`href="/admin/recordar/${clienteId}"`),
  );
  const sinSesion = await pagina(`/admin/recordar/${clienteId}`, "");
  comprobar("recordar sin sesión no abre nada", sinSesion.status !== 200 && !sinSesion.destino.startsWith("https://wa.me/"), String(sinSesion.status));
  const recordar = await pagina(`/admin/recordar/${clienteId}`);
  comprobar(
    "recordar abre WhatsApp con la deuda y deja anotado el día",
    recordar.status === 302 && recordar.destino.includes("wa.me/584120000009") && recordar.destino.includes("Hola Charcutería Inventario"),
    recordar.destino.slice(0, 160),
  );
  const [recordado] = await consultar("select fecha, saldo_usd from recordatorios where cliente_id = ?", [clienteId]);
  comprobar("queda anotado hoy con el saldo", recordado && recordado.fecha === hoyIso && recordado.saldo_usd > 0, JSON.stringify(recordado));
  resumen = legible((await pagina("/admin")).html);
  comprobar(
    "el resumen ya no lo pide, y la ficha dice cuándo se le recordó",
    !resumen.includes(`data-recordar="${clienteId}"`) && legible((await pagina(`/admin/clientes/${clienteId}`)).html).includes(`Recordado el ${hoyCorta}`),
  );

  // Los nombres: «Lo que te deben» en vez de «Cuentas por pagar», también en el menú y en la cartera.
  const cuentas = legible((await pagina("/admin/cuentas")).html);
  comprobar(
    "«Cuentas por pagar» ahora es «Lo que te deben», también en el menú y en la cartera",
    cuentas.includes("Lo que te deben") && cuentas.includes("Notas que te deben") && !cuentas.includes("Cuentas por pagar") && cuentas.includes(">Te deben<") && cuentas.includes(">Inventario<") &&
      legible((await pagina("/admin/clientes")).html).includes("<dt>Te deben</dt>"),
  );
}

const FAMILIA_DE_PRUEBA = "Panadería de prueba";

/**
 * El catálogo por familias: las familias iniciales y los productos de antes
 * en la suya, crear una familia (también desde el formulario de producto),
 * el formulario completo con sus otras categorías, los borradores, cambiar
 * solo el precio, borrar con cuidado, preparar el catálogo inicial y las
 * ofertas.
 */
async function probarCatalogo() {
  const familias = await consultar("select id, slug, nombre from familias order by orden");
  const idDe = Object.fromEntries(familias.map((f) => [f.slug, Number(f.id)]));
  comprobar("las diez familias iniciales, en su orden", familias.length >= 10 && familias[0].slug === "burger" && familias[1].slug === "pizzeria", JSON.stringify(familias.map((f) => f.slug)));
  const [amarillo] = await consultar("select familia_id from productos where id = 1");
  const otrasDelAmarillo = (await consultar("select familia_id from producto_categorias where producto_id = 1")).map((f) => Number(f.familia_id));
  comprobar(
    "el queso amarillo de antes quedó en Quesos y sale también en Burger",
    Number(amarillo.familia_id) === idDe.quesos && otrasDelAmarillo.includes(idDe.burger),
    JSON.stringify([amarillo, otrasDelAmarillo]),
  );
  const panelFamilias = legible((await pagina("/admin/familias")).html);
  comprobar("el panel de familias las enseña con sus productos", panelFamilias.includes("Familias y categorías") && panelFamilias.includes("Embutidos") && panelFamilias.includes("productos suyos"));

  // Una familia nueva desde su panel.
  let r = await enviar("/admin/familias", 'id="familia-nueva-nombre"', { nombre: FAMILIA_DE_PRUEBA, descripcion: "Pan y harinas", icono: "otros", orden: "", activa: "1" });
  comprobar("crear una familia", r.destino.includes(`Familia «${FAMILIA_DE_PRUEBA}» creada`), r.destino);
  r = await enviar("/admin/familias", 'id="familia-nueva-nombre"', { nombre: "panaderia DE prueba", descripcion: "", icono: "otros", orden: "", activa: "1" });
  comprobar("otra con el mismo nombre (sin mirar tildes ni mayúsculas) no se crea", r.destino.includes("Ya hay una familia"), r.destino);
  const [panaderia] = await consultar("select id, slug, orden from familias where nombre = ?", [FAMILIA_DE_PRUEBA]);
  comprobar("la familia nueva va detrás de las otras, con su slug", panaderia && panaderia.slug === "panaderia-de-prueba" && Number(panaderia.orden) >= 11, JSON.stringify(panaderia));

  // «Agregar producto»: el formulario completo, con su familia y sus otras categorías.
  const formulario = legible((await pagina("/admin/productos/nuevo")).html);
  comprobar(
    "el formulario de producto pregunta la familia y las otras categorías, y deja crear una familia",
    formulario.includes("¿A qué familia pertenece este producto?") && formulario.includes("¿En qué otras categorías quieres mostrarlo?") &&
      formulario.includes("＋ Crear nueva familia") && formulario.includes(FAMILIA_DE_PRUEBA),
  );
  const nuevo = {
    formulario: "completo", nombre: "Tocineta ahumada (prueba)", descripcion: "Ahumada\nEn lonjas", familia_id: String(idDe.embutidos), unidad: "kg", marca: "",
    presentacion: "Paquete", contenido: "1 kg", costo_usd: "", margen_pct: "", precio_usd: "12", precio_detal_usd: "", estado: "activo", destacado: "1", existencia: "",
  };
  r = await enviar("/admin/productos/nuevo", 'name="formulario"', { ...nuevo, categoria: [String(idDe.burger), String(idDe.pizzeria), String(idDe.embutidos)] });
  const idTocineta = Number(r.destino.match(/\/admin\/productos\/(\d+)/)?.[1]);
  comprobar("crear un producto con su familia, otras categorías y destacado", r.destino.includes("creado y publicado") && idTocineta > 0, r.destino);
  const [tocineta] = await consultar("select familia_id, activo, borrador, destacado, presentacion, precio_usd from productos where id = ?", [idTocineta]);
  const susOtras = (await consultar("select familia_id from producto_categorias where producto_id = ?", [idTocineta])).map((f) => Number(f.familia_id));
  comprobar(
    "queda en Embutidos y sale en Burger y en Pizzería, sin repetir la suya, en la web y destacado",
    Number(tocineta.familia_id) === idDe.embutidos && susOtras.length === 2 && susOtras.includes(idDe.burger) && susOtras.includes(idDe.pizzeria) &&
      Number(tocineta.activo) === 1 && Number(tocineta.borrador) === 0 && Number(tocineta.destacado) === 1 && tocineta.presentacion === "Paquete" && cerca(Number(tocineta.precio_usd), 12),
    JSON.stringify([tocineta, susOtras]),
  );
  r = await enviar("/admin/productos/nuevo", 'name="formulario"', { ...nuevo, nombre: "Sin familia", familia_id: "" });
  comprobar("sin familia no se guarda, y el formulario vuelve con lo escrito", r.destino.includes("Elige a qué familia pertenece") && r.destino.includes("nombre=Sin+familia") && r.destino.includes("relleno=1"), r.destino);

  // «Crear la familia y elegirla» sin salir del formulario: vuelve con lo escrito y la familia nueva elegida.
  r = await enviar("/admin/productos/nuevo", 'name="formulario"', {
    ...nuevo, nombre: "Pan de prueba", familia_id: "", crear_familia: "1", nueva_familia_nombre: "Congelados de prueba", nueva_familia_icono: "papas", nueva_familia_orden: "", nueva_familia_activa: "1",
  });
  const [congelados] = await consultar("select id, icono from familias where nombre = ?", ["Congelados de prueba"]);
  comprobar(
    "crear una familia desde el formulario de producto la deja elegida, con lo escrito",
    Boolean(congelados) && congelados.icono === "papas" && r.destino.includes(`familia_id=${congelados?.id}`) && r.destino.includes("nombre=Pan+de+prueba") && r.destino.includes("creada y elegida"),
    r.destino,
  );
  const vuelta = (await pagina(r.destino)).html;
  comprobar(
    "el formulario vuelve relleno y con la familia nueva elegida",
    vuelta.includes('value="Pan de prueba"') && new RegExp(`<option value="${congelados?.id}" selected=""`).test(vuelta),
  );

  // Un borrador no sale en la web ni en las ventas.
  r = await enviar("/admin/productos/nuevo", 'name="formulario"', {
    ...nuevo, nombre: "Salsa secreta (prueba)", familia_id: String(idDe["salsas-y-aderezos"]), unidad: "unidad", precio_usd: "", estado: "borrador", destacado: "",
  });
  const idBorrador = Number(r.destino.match(/\/admin\/productos\/(\d+)/)?.[1]);
  comprobar(
    "un borrador se guarda sin precio y no sale en la web ni en las ventas",
    r.destino.includes("en borrador") && (await pagina(`/producto/${idBorrador}`, "")).status === 404 && !(await pagina("/admin/ventas")).html.includes(`cantidad_${idBorrador}"`),
    r.destino,
  );

  // Cambiar solo el precio deja lo demás como estaba; con el formulario entero, una casilla sin marcar es un «no».
  r = await enviar(`/admin/productos/${idTocineta}`, `id="precio-${idTocineta}"`, { id: String(idTocineta), precio_usd: "13" });
  const [tras] = await consultar("select precio_usd, destacado from productos where id = ?", [idTocineta]);
  const [{ n: otrasTras }] = await consultar("select count(*) as n from producto_categorias where producto_id = ?", [idTocineta]);
  comprobar("cambiar solo el precio deja las categorías y el destacado", cerca(Number(tras.precio_usd), 13) && Number(tras.destacado) === 1 && Number(otrasTras) === 2, JSON.stringify([tras, otrasTras]));
  r = await enviar(`/admin/productos/${idTocineta}`, `id="precio-${idTocineta}"`, { ...nuevo, id: String(idTocineta), precio_usd: "13", destacado: "", categoria: [String(idDe.burger)], existencia: "8" });
  const [despues] = await consultar("select destacado from productos where id = ?", [idTocineta]);
  const otrasDespues = (await consultar("select familia_id from producto_categorias where producto_id = ?", [idTocineta])).map((f) => Number(f.familia_id));
  const [recuento] = await consultar("select cantidad from inventario_ajustes where producto_id = ? order by id desc limit 1", [idTocineta]);
  comprobar(
    "con el formulario entero, desmarcar es quitar; y la existencia escrita queda como recuento",
    r.destino.includes("guardado") && Number(despues.destacado) === 0 && otrasDespues.length === 1 && otrasDespues[0] === idDe.burger && Boolean(recuento) && cerca(Number(recuento.cantidad), 8),
    JSON.stringify([r.destino, despues, otrasDespues, recuento]),
  );
  r = await enviar(`/admin/productos/${idTocineta}`, `id="precio-${idTocineta}"`, { id: String(idTocineta), foto: await fotoDeProducto() });
  const fotoTocineta = await fetch(base + `/foto-producto/${idTocineta}`);
  comprobar("la foto del producto se guarda y se sirve", r.destino.includes("Con su foto") && fotoTocineta.status === 200 && fotoTocineta.headers.get("content-type") === "image/jpeg", r.destino);

  // Borrar: uno sin ventas se borra con lo suyo; uno vendido, no.
  const confirmar = legible((await pagina(`/admin/productos/${idBorrador}/eliminar`)).html);
  comprobar("antes de borrar un producto, se confirma", confirmar.includes("No tiene vuelta atrás") && confirmar.includes("Sí, eliminar"));
  r = await enviar(`/admin/productos/${idBorrador}/eliminar`, 'name="id"', { id: "1" }, cookie, {}, "Sí, eliminar");
  comprobar("uno ya vendido no se borra ni a la fuerza", r.destino.includes("no se puede borrar") && (await consultar("select count(*) as n from productos where id = 1"))[0].n == 1, r.destino);
  const vendido = legible((await pagina("/admin/productos/1/eliminar")).html);
  comprobar("su pantalla de borrar lo explica y ofrece esconderlo", vendido.includes("No se puede borrar") && vendido.includes("Ocultarlo de la web"));
  comprobar("uno con un recuento de inventario tampoco se borra", legible((await pagina(`/admin/productos/${idTocineta}/eliminar`)).html).includes("1 recuento de inventario"));
  r = await enviar(`/admin/productos/${idBorrador}/eliminar`, 'name="id"', { id: String(idBorrador) }, cookie, {}, "Sí, eliminar");
  comprobar("un producto sin ventas se borra", r.destino.includes("borrado") && (await consultar("select count(*) as n from productos where id = ?", [idBorrador]))[0].n == 0, r.destino);

  // Borrar una familia con productos pide antes a cuál pasan.
  await enviar(`/admin/productos/${idTocineta}`, `id="precio-${idTocineta}"`, { id: String(idTocineta), familia_id: String(panaderia.id) });
  r = await enviar(`/admin/familias/${panaderia.id}/eliminar`, 'name="pasar_a"', { id: String(panaderia.id), pasar_a: "" });
  comprobar("una familia con productos no se borra sin decir a cuál pasan", r.destino.includes("Elige a qué familia pasan"), r.destino);
  r = await enviar(`/admin/familias/${panaderia.id}/eliminar`, 'name="pasar_a"', { id: String(panaderia.id), pasar_a: String(idDe.embutidos) });
  const [movida] = await consultar("select familia_id from productos where id = ?", [idTocineta]);
  comprobar(
    "con la familia elegida, sus productos pasan a ella y la familia se borra",
    r.destino.includes("borrada") && r.destino.includes("pasaron a «Embutidos»") && Number(movida.familia_id) === idDe.embutidos &&
      (await consultar("select count(*) as n from familias where id = ?", [panaderia.id]))[0].n == 0,
    r.destino,
  );

  // El catálogo inicial: en borrador, sin precio y sin publicar; los combos también.
  r = await enviar("/admin/productos", "Preparar el catálogo inicial", {});
  const borradores = await consultar("select nombre, activo, precio_usd from productos where borrador = 1");
  comprobar(
    "preparar el catálogo crea los productos en borrador, sin precio y sin publicar, y los combos",
    r.destino.includes("Preparados") && r.destino.includes("3 combos") && borradores.length >= 40 && borradores.every((b) => Number(b.activo) === 0 && b.precio_usd === null),
    `${r.destino} ${borradores.length}`,
  );
  const [{ n: noDuplica }] = await consultar("select count(*) as n from productos where nombre in ('Tocineta', 'Queso amarillo', 'Huevos', 'Queso mozzarella')");
  comprobar("no duplica lo que ya había, y el botón ya no sale", Number(noDuplica) === 4 && !(await pagina("/admin/productos")).html.includes("Preparar el catálogo inicial"), String(noDuplica));
  comprobar("los borradores no salen en la portada ni en las ventas", !(await pagina("/", "")).html.includes("Ketchup") && !(await pagina("/admin/ventas")).html.includes("Ketchup"));
  const [tocinetaDelCatalogo] = await consultar("select p.id, f.slug from productos p join familias f on f.id = p.familia_id where p.nombre = 'Tocineta'");
  const susCategorias = (await consultar("select f.slug from producto_categorias c join familias f on f.id = c.familia_id where c.producto_id = ? order by f.slug", [tocinetaDelCatalogo.id])).map((f) => f.slug);
  comprobar(
    "la tocineta del catálogo: en Embutidos y también en Burger y en Pizzería",
    tocinetaDelCatalogo.slug === "embutidos" && susCategorias.join() === "burger,pizzeria",
    JSON.stringify([tocinetaDelCatalogo, susCategorias]),
  );
  comprobar("la lista de productos filtra los borradores", legible((await pagina("/admin/productos?estado=borrador")).html).includes("Ketchup"));

  // Las ofertas: nacen en borrador, se les pone precio, fechas y lo que llevan.
  const ofertas = await consultar("select id, nombre, estado, precio_usd from ofertas order by orden");
  const packBurger = ofertas.find((o) => o.nombre === "Pack Burger");
  const lleva = (await consultar("select p.id, p.nombre from oferta_productos op join productos p on p.id = op.producto_id where op.oferta_id = ?", [packBurger?.id]));
  comprobar(
    "los tres combos en borrador y sin precio, con lo que llevan",
    ofertas.length === 3 && ofertas.every((o) => o.estado === "borrador" && o.precio_usd === null) && lleva.some((p) => p.nombre === "Tocineta") && lleva.some((p) => p.nombre === "Ketchup"),
    JSON.stringify([ofertas, lleva]),
  );
  r = await enviar(`/admin/ofertas/${packBurger.id}`, 'name="precio_usd"', {
    id: String(packBurger.id), nombre: "Pack Burger", descripcion: "Queso, tocineta, papas y salsas", precio_usd: "45", desde: "2026-01-01", hasta: "2030-12-31",
    estado: "activa", orden: "1", producto: lleva.map((p) => String(p.id)), [`cantidad_${tocinetaDelCatalogo.id}`]: "2 kg",
  });
  const [guardada] = await consultar("select estado, precio_usd, hasta from ofertas where id = ?", [packBurger.id]);
  const [cuantoTocineta] = await consultar("select cantidad from oferta_productos where oferta_id = ? and producto_id = ?", [packBurger.id, tocinetaDelCatalogo.id]);
  comprobar(
    "editar una oferta: precio, fechas, estado y cuánto lleva de cada uno",
    r.destino.includes("guardada") && guardada.estado === "activa" && cerca(Number(guardada.precio_usd), 45) && guardada.hasta === "2030-12-31" && cuantoTocineta?.cantidad === "2 kg",
    JSON.stringify([r.destino, guardada, cuantoTocineta]),
  );
  r = await enviar(`/admin/ofertas/${packBurger.id}`, 'name="precio_usd"', { id: String(packBurger.id), nombre: "Pack Burger", descripcion: "", precio_usd: "", desde: "2026-02-01", hasta: "2026-01-01", estado: "activa", orden: "1" });
  comprobar("una oferta que acaba antes de empezar no se guarda", r.destino.includes("no puede acabar antes de empezar"), r.destino);
  comprobar("el panel de ofertas la enseña en la web, con su precio", legible((await pagina("/admin/ofertas")).html).includes("Pack Burger") && legible((await pagina("/admin/ofertas")).html).includes(usd("45,00")));
}

/**
 * La vitrina con el catálogo ya preparado: buscar, cada familia (también
 * una vacía y una escondida), la oferta activa, y el carrito con un
 * producto, una marca y un combo, sin lo que no se puede pedir.
 */
async function probarVitrina() {
  const [tocineta] = await consultar("select id from productos where nombre = 'Tocineta ahumada (prueba)'");
  const [ketchup] = await consultar("select id from productos where nombre = 'Ketchup'");
  const [sortilegio] = await consultar("select id from variantes where nombre = 'Sortilegio 500 g'");
  const [packBurger] = await consultar("select id from ofertas where nombre = 'Pack Burger'");
  const [packPizzeria] = await consultar("select id from ofertas where nombre = 'Pack Pizzería'");

  const todos = legible((await pagina("/productos", "")).html);
  comprobar("todos los productos: los publicados sí, los borradores no", todos.includes("Tocineta ahumada (prueba)") && todos.includes("Queso mozzarella") && !todos.includes("Ketchup"));
  const buscada = legible((await pagina("/productos?q=TOCINETA", "")).html);
  comprobar(
    "buscar sin mirar mayúsculas encuentra la tocineta, y solo lo que coincide",
    buscada.includes("Tocineta ahumada (prueba)") && !buscada.includes("Queso mozzarella") && buscada.includes("1 producto encontrado"),
  );
  comprobar("buscar por una familia encuentra lo que sale en ella", legible((await pagina("/productos?q=pizzeria", "")).html).includes("Queso mozzarella"));
  const nada = legible((await pagina("/productos?q=ketchup", "")).html);
  comprobar(
    "un borrador no se encuentra, y se ofrece preguntarlo por WhatsApp",
    nada.includes("Ningún producto encontrado") && nada.includes("No encontramos «ketchup»") && nada.includes("wa.me/584246343236?text=Hola%2C%20%C2%BFtienen%20ketchup%3F"),
  );

  const embutidos = await pagina("/categoria/embutidos", "");
  comprobar(
    "la categoría Embutidos enseña la tocineta, con su foto y su «Agregar»",
    embutidos.status === 200 && legible(embutidos.html).includes("Tocineta ahumada (prueba)") && embutidos.html.includes(`/foto-producto/${tocineta.id}?v=`) && embutidos.html.includes(">Agregar<"),
  );
  const burger = legible((await pagina("/categoria/burger", "")).html);
  comprobar(
    "Burger enseña lo suyo y lo que también sale en ella, sin repetir",
    burger.includes("Queso amarillo") && (burger.match(/>Tocineta ahumada \(prueba\)</g) ?? []).length === 1 && burger.includes('aria-current="page"'),
  );
  const vacia = await pagina("/categoria/congelados-de-prueba", "");
  comprobar("una familia sin nada publicado lo dice y ofrece preguntar", vacia.status === 200 && legible(vacia.html).includes("Todavía no hay productos de congelados de prueba publicados"));
  const [congelados] = await consultar("select id from familias where slug = 'congelados-de-prueba'");
  let r = await enviar("/admin/familias", `name="id" value="${congelados.id}"`, { id: String(congelados.id), activa: "0" }, cookie, {}, 'name="activa"');
  comprobar("una familia escondida no tiene página", r.destino.includes("escondida") && (await pagina("/categoria/congelados-de-prueba", "")).status === 404, r.destino);
  await enviar("/admin/familias", `name="id" value="${congelados.id}"`, { id: String(congelados.id), activa: "1" }, cookie, {}, 'name="activa"');
  comprobar("el panel enlaza la página de cada familia en la web", (await pagina("/admin/familias")).html.includes('href="/categoria/burger"'));

  const ofertas = await paginaCon("/ofertas", "Pack Burger");
  const textoOfertas = legible(ofertas.html);
  comprobar(
    "la oferta activa sale en Ofertas con su precio, lo que lleva, su «Agregar» y su pedido por WhatsApp; la de borrador, no",
    ofertas.status === 200 && textoOfertas.includes(usd("45,00")) && textoOfertas.includes("Ketchup") && ofertas.html.includes(`id="oferta-${packBurger.id}"`) &&
      ofertas.html.includes(">Agregar<") && ofertas.html.includes("quiero%20el%20combo%20Pack%20Burger") && !textoOfertas.includes("Pack Pizzería"),
  );
  comprobar("la portada enseña la oferta activa", legible((await portadaCon("Pack Burger")).html).includes("Ofertas y combos"));

  const claves = [String(tocineta.id), `4-${sortilegio.id}`, "4", String(ketchup.id), `o${packBurger.id}`, `o${packPizzeria.id}`];
  const api = await (await fetch(base + `/api/carrito?claves=${encodeURIComponent(claves.join(","))}`)).json();
  const de = Object.fromEntries(api.productos.map((p) => [p.clave, p]));
  comprobar(
    "el carrito: el producto y la marca con su precio de hoy, el combo activo como combo; lo que tiene marcas suelto, un borrador y un combo sin publicar, no",
    cerca(de[String(tocineta.id)]?.precio_usd, 13) && de[String(tocineta.id)]?.porQue === "kilo" && de[`4-${sortilegio.id}`]?.nombre === "Queso pecorino rallado Sortilegio 500 g" &&
      cerca(de[`4-${sortilegio.id}`]?.precio_usd, 4.2) && de[`o${packBurger.id}`]?.porQue === "combo" && cerca(de[`o${packBurger.id}`]?.precio_usd, 45) &&
      !de["4"] && !de[String(ketchup.id)] && !de[`o${packPizzeria.id}`] && api.productos.length === 3,
    JSON.stringify(api).slice(0, 700),
  );
}

async function probarSinEscribir() {
  const pantallas = [
    ["/admin", "Resumen", "Hoy,"],
    ["/admin/clientes", "Clientes", "Cliente nuevo"],
    ["/admin/ventas", "Ventas", "Registrar venta"],
    ["/admin/pagos", "Abonos", "Registrar abono"],
    ["/admin/despacho", "Despacho", "Ruta de despacho"],
    ["/admin/cuentas", "Lo que te deben", "Notas que te deben"],
    ["/admin/inventario", "Inventario", "Recuento o merma"],
    ["/admin/estadisticas", "Estadísticas", "Por mes"],
    ["/admin/productos", "Productos", "Tasa del día"],
    ["/admin/productos/nuevo", "Agregar producto", "¿A qué familia pertenece este producto?"],
    ["/admin/familias", "Familias", "Familias y categorías"],
    ["/admin/ofertas", "Ofertas", "Ofertas y combos"],
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
  const fichaDeProducto = vistas["/admin/productos"].match(/href="(\/admin\/productos\/\d+)"/)?.[1];
  if (fichaDeProducto) comprobar("la ficha de un producto, con su formulario entero", (await pagina(fichaDeProducto)).html.includes("Datos del producto"));
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
  comprobar(
    `web pública (${web.ms} ms): «Todo para tu burger & pizzería», con sus categorías y sus productos`,
    web.status === 200 && /Todo para tu\s*<span>burger &amp; pizzer[ií]a<\/span>/.test(legible(web.html)) && web.html.includes("wa.me/584246343236") &&
      web.html.includes("Productos destacados") && web.html.includes('href="/productos"'),
  );

  const primera = web.html.match(/href="(\/producto\/\d+[a-z0-9-]*)"/)?.[1];
  const detalle = primera ? await pagina(primera, "") : null;
  comprobar("la página de un producto abre desde la portada", Boolean(detalle) && detalle.status === 200 && detalle.html.includes("Cómo comprar") && detalle.html.includes('aria-label="Estás en"'), String(primera));
  comprobar("la portada se presenta como proveedor para burger y pizza", !web.html.includes("Quesos y huevos") && legible(web.html).includes("Tu proveedor para burger &amp; pizza"));
  // Las páginas de la vitrina: todos los productos, cada familia, las ofertas y el carrito. Solo leer.
  const todos = await pagina("/productos", "");
  comprobar(
    "la página de todos los productos, con el buscador y las familias",
    todos.status === 200 && todos.html.includes('name="q"') && todos.html.includes('href="/categoria/') && (todos.html.match(/href="\/producto\/\d+-[a-z0-9-]+"/g) ?? []).length > 0,
  );
  const primeraFamilia = web.html.match(/href="(\/categoria\/[a-z0-9-]+)"/)?.[1];
  const deLaFamilia = primeraFamilia ? await pagina(primeraFamilia, "") : null;
  comprobar("una categoría abre desde la portada, con sus productos", Boolean(deLaFamilia) && deLaFamilia.status === 200 && deLaFamilia.html.includes('href="/producto/'), String(primeraFamilia));
  comprobar("una categoría que no existe da 404", (await pagina("/categoria/no-existe-esta", "")).status === 404);
  const ofertasWeb = await pagina("/ofertas", "");
  comprobar("la página de ofertas abre, con combos o diciendo que no hay", ofertasWeb.status === 200 && legible(ofertasWeb.html).includes("Ofertas y combos"));
  const carritoWeb = await pagina("/carrito", "");
  comprobar("la página del carrito abre y los buscadores no la guardan", carritoWeb.status === 200 && carritoWeb.html.includes("Tu pedido") && /<meta name="robots" content="noindex/.test(carritoWeb.html));
  const unaClave = todos.html.match(/href="\/producto\/(\d+)-/)?.[1] ?? "1";
  const respuestaCarrito = await fetch(base + `/api/carrito?claves=${unaClave},${encodeURIComponent("<script>")},99999999`);
  const datosCarrito = await respuestaCarrito.json().catch(() => ({}));
  comprobar(
    "el carrito pide los precios de hoy a la web, y lo raro lo descarta",
    respuestaCarrito.status === 200 && Array.isArray(datosCarrito.productos) && datosCarrito.productos.every((p) => p.clave === unaClave) && "tasa" in datosCarrito,
    JSON.stringify(datosCarrito).slice(0, 300),
  );
  // La página de una marca, si hay alguna publicada: se llega desde la de su producto.
  let rutaDeMarca = null;
  for (const ruta of [...new Set(web.html.match(/\/producto\/\d+[a-z0-9-]*/g) ?? [])]) {
    rutaDeMarca = (await pagina(ruta, "")).html.match(/href="(\/producto\/\d+[a-z0-9-]*\/\d+[a-z0-9-]*)"/)?.[1] ?? null;
    if (rutaDeMarca) break;
  }
  if (rutaDeMarca) {
    const deMarca = await pagina(rutaDeMarca, "");
    comprobar(
      "la página de una marca abre desde la de su producto, con su precio y su botón de pedir",
      deMarca.status === 200 && deMarca.html.includes(">Pedir por WhatsApp<") && deMarca.html.includes("Cómo comprar") && deMarca.html.includes('rel="canonical"'),
      rutaDeMarca,
    );
  }
  comprobar("una cuenta de cliente inventada da 404", (await pagina("/cuenta/abcdefghjkmnpq", "")).status === 404 && (await pagina("/cuenta/nada", "")).status === 404);

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
    await probarInventario();
    await probarCatalogo();
    await probarVitrina();
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
