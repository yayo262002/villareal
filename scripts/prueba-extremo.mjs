// Prueba de extremo a extremo: usa la web como la usaría el dueño, por los
// formularios HTML, y comprueba que las cuentas cuadran.
//
//   npm run prueba:local   arranca `next start` con una base temporal (hace
//                          falta `npm run build` antes). Prueba también los
//                          precios, porque la base es de usar y tirar.
//   npm run prueba:web     contra la web publicada. No toca productos ni la
//                          tasa: crea un cliente de prueba y lo borra todo.
//
// La clave y el acceso a Turso salen de `.env.local`; aquí no hay secretos.

import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createClient } from "@libsql/client";

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

let fallos = 0;
function comprobar(nombre, condicion, detalle = "") {
  console.log(`${condicion ? "ok   " : "FALLO"} ${nombre}${condicion ? "" : " → " + detalle}`);
  if (!condicion) fallos++;
}

// ---------- La base, para comprobar y para limpiar ----------

/** En local se lee el archivo temporal; en producción, Turso. */
async function consultar(sql, args = []) {
  if (enProduccion) {
    const nube = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
    try {
      return (await nube.execute({ sql, args })).rows.map((f) => ({ ...f }));
    } finally {
      nube.close();
    }
  }
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

async function pagina(ruta, conCookie = cookie) {
  const t = Date.now();
  const r = await fetch(base + ruta, { headers: { cookie: conCookie }, redirect: "manual" });
  return {
    status: r.status,
    cabeceras: r.headers,
    html: r.status === 200 ? await r.text() : "",
    destino: decodeURIComponent(r.headers.get("location") ?? ""),
    ms: Date.now() - t,
  };
}

/** El identificador de la acción del formulario que contiene `marca`. */
function accionDe(html, marca) {
  const formulario = (html.match(/<form[\s\S]*?<\/form>/g) ?? []).find((f) => f.includes(marca));
  if (!formulario) throw new Error(`No hay formulario con ${marca}`);
  const accion = formulario.match(/name="(\$ACTION_ID_[a-f0-9]+)"/);
  if (!accion) throw new Error(`El formulario de ${marca} no lleva acción`);
  return accion[1];
}

/** Envía un formulario como lo haría el navegador sin JavaScript. */
async function enviar(ruta, marca, campos, conCookie = cookie, cabeceras = {}) {
  const { html, status } = await pagina(ruta, conCookie);
  if (status !== 200) throw new Error(`GET ${ruta} → ${status}`);
  const datos = new FormData();
  datos.set(accionDe(html, marca), "");
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
    env: { ...process.env, ...env, TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", RUTA_BASE_DATOS: rutaDb },
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

  const mala = await enviar("/admin/entrar", 'name="clave"', { clave: "incorrecta" }, "");
  comprobar("una clave incorrecta no entra", mala.destino.includes("no es correcta"));

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
  comprobar("datos de la tienda para los buscadores", /"@type":"Store"/.test(html) && html.includes('"addressLocality":"Barquisimeto"') && html.includes('"telephone":"+584245541749"'));
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
    margen_pct: "25", precio_usd: "", margen_mayor_pct: "10", precio_mayor_usd: "",
  });
  comprobar("costo 6,80 con 25 % y 10 %", r.destino.includes("guardado"), r.destino);

  const panel = (await pagina("/admin/productos")).html;
  comprobar(
    "panel: detal USD 8,50 = Bs 310,25 y mayor USD 7,48 = Bs 273,02",
    panel.includes('value="8.5"') && panel.includes("Bs 310,25") && panel.includes('value="7.48"') && panel.includes("Bs 273,02"),
  );

  r = await enviar("/admin/productos", 'id="precio-2"', {
    id: "2", nombre: "Queso mozzarella", unidad: "kg", costo_usd: "",
    margen_pct: "20", precio_usd: "", margen_mayor_pct: "", precio_mayor_usd: "",
  });
  comprobar("un margen sin costo se rechaza", r.destino.includes("hace falta el costo"), r.destino);

  r = await enviar("/admin/productos", 'id="precio-2"', {
    id: "2", nombre: "Queso mozzarella", unidad: "kg", costo_usd: "",
    margen_pct: "", precio_usd: "7", margen_mayor_pct: "", precio_mayor_usd: "",
  });
  comprobar("un precio escrito a mano se acepta", r.destino.includes("guardado"), r.destino);

  const web = (await pagina("/", "")).html;
  comprobar("web: los dos precios del queso amarillo en bolívares", web.includes("Al detal") && web.includes("Al mayor") && web.includes("Bs 310,25") && web.includes("Bs 273,02"));
  comprobar("web: dólares y tasa", web.includes(usd("8,50")) && web.includes(usd("7,48")) && web.includes("36,50"));
  comprobar("web: un solo precio se llama «Precio»", web.includes(">Precio<") && web.includes("Bs 255,50"));
  comprobar("portada: cada producto con su dibujo y su enlace a los detalles", (web.match(/href="\/producto\/\d+-[a-z-]+"/g) ?? []).length >= 8 && (web.match(/aria-label="Dibujo de /g) ?? []).length === 4);
  comprobar("portada: los detalles ya no están en la portada", !web.includes("no se desborona"));
  const ficha = await pagina("/producto/2-queso-mozzarella", "");
  comprobar("página de la mozzarella: ventajas, precio y pedir", ficha.status === 200 && ficha.html.includes("Perfecta para rallar") && ficha.html.includes("no se desborona") && ficha.html.includes("Bs 255,50") && ficha.html.includes("quiero%20pedir%20queso%20mozzarella"));
  const fichaAmarillo = await pagina("/producto/1-cualquier-nombre", "");
  comprobar("página del queso amarillo: los dos precios y sus detalles", fichaAmarillo.html.includes("Bs 310,25") && fichaAmarillo.html.includes("Bs 273,02") && fichaAmarillo.html.includes("Por qué elegirlo") && fichaAmarillo.html.includes("Otros productos"));
  comprobar("todos los productos tienen detalles", (await Promise.all([3, 4].map((id) => pagina(`/producto/${id}`, "")))).every((p) => p.status === 200 && p.html.includes("Por qué elegirlo")));
  comprobar("un producto que no existe da 404", (await pagina("/producto/999-nada", "")).status === 404 && (await pagina("/producto/queso", "")).status === 404);
  comprobar("web: huevos y pecorino rallado, sin precio inventado", web.includes("Huevos") && web.includes("Queso pecorino rallado") && web.includes("Consulta el precio del día"));
  comprobar("web: pedir cada producto por WhatsApp", web.includes("quiero%20pedir%20queso%20amarillo"));
}

/** Alta de cliente, ventas, pago, cuentas, foto, descargas y borrados. */
async function probarNegocio() {
  const nombre = enProduccion ? "Prueba Vercel (borrar)" : "Bodega Prueba";
  let r = await enviar("/admin/clientes", 'name="cedula_rif"', {
    nombre, telefono: "0412-0000000", direccion: "Carrera 19 con calle 25", tipo: "mayor",
  });
  const clienteId = Number(r.destino.match(/nuevo=(\d+)/)?.[1]);
  comprobar(`alta de cliente mayorista (${r.ms} ms)`, r.destino.includes("Cliente guardado") && clienteId > 0, r.destino);
  if (!clienteId) throw new Error("Sin cliente no se puede seguir");
  const limpiar = [clienteId];

  try {
    const [producto] = await consultar("select id from productos order by id limit 1");
    const productoId = String(producto.id);

    r = await enviar("/admin/ventas", 'name="producto_0"', {
      cliente_id: String(clienteId), fecha: "2026-09-01", producto_0: productoId, cantidad_0: "2", precio_0: "5", nota: "primera",
    });
    comprobar(`venta con precio escrito (${r.ms} ms)`, r.destino.includes("Venta registrada") && cerca((await cuentasDe(clienteId)).ventas, 10));

    let esperado = 10;
    if (!enProduccion) {
      r = await enviar("/admin/ventas", 'name="producto_0"', {
        cliente_id: String(clienteId), fecha: "2026-09-15", producto_0: "1", cantidad_0: "2", precio_0: "",
      });
      esperado += 14.96;
      comprobar("al mayorista, sin precio escrito, se le cobra al mayor (2 × 7,48)", cerca((await cuentasDe(clienteId)).ventas, esperado), JSON.stringify(await cuentasDe(clienteId)));

      r = await enviar("/admin/clientes", 'name="cedula_rif"', { nombre: "Cliente Detal", telefono: "", tipo: "detal" });
      const detalId = Number(r.destino.match(/nuevo=(\d+)/)?.[1]);
      limpiar.push(detalId);
      r = await enviar("/admin/ventas", 'name="producto_0"', {
        cliente_id: String(detalId), fecha: "2026-09-15", producto_0: "1", cantidad_0: "2", precio_0: "",
      });
      comprobar("al cliente al detal se le cobra al detal (2 × 8,50)", cerca((await cuentasDe(detalId)).ventas, 17), JSON.stringify(await cuentasDe(detalId)));

      r = await enviar("/admin/ventas", 'name="producto_0"', {
        cliente_id: String(clienteId), fecha: "2026-09-15", producto_0: "3", cantidad_0: "1", precio_0: "",
      });
      comprobar("un producto sin precio no se vende sin escribirlo", r.destino.includes("no tiene precio"), r.destino);
    }

    r = await enviar(`/admin/clientes/${clienteId}`, 'name="monto"', {
      cliente_id: String(clienteId), fecha: "2026-09-20", metodo: "pago_movil", monto: "146", tasa: "36.5",
      volver_a: `/admin/clientes/${clienteId}`,
    });
    comprobar(`pago en bolívares con tasa: Bs 146 = USD 4 (${r.ms} ms)`, r.destino.includes("Abono registrado") && cerca((await cuentasDe(clienteId)).pagos, 4));

    const ficha = (await pagina(`/admin/clientes/${clienteId}`)).html;
    comprobar("ficha: la primera nota queda abonada con USD 6 pendientes", ficha.includes(">Abonada<") && ficha.includes(usd("6,00")));
    comprobar("ficha: recordar deuda y enviar nota por WhatsApp", ficha.includes("Recordar deuda por WhatsApp") && ficha.includes(">Enviar nota<") && ficha.includes("wa.me/584120000000"));
    comprobar("ficha: la dirección entra en la ruta y tiene mapa", ficha.includes("Entra en la ruta de despacho") && ficha.includes("google.com/maps/search"));

    // La nota de entrega de la primera venta.
    const notaId = Math.min(...[...ficha.matchAll(/\/admin\/ventas\/(\d+)\/nota/g)].map((m) => Number(m[1])));
    const nota = await pagina(`/admin/ventas/${notaId}/nota`);
    comprobar(
      `nota de entrega (${nota.ms} ms)`,
      nota.status === 200 && nota.html.includes("Nota de entrega") && legible(nota.html).includes(`N.º ${String(notaId).padStart(6, "0")}`) &&
        nota.html.includes(nombre) && nota.html.includes("0412-0000000") && nota.html.includes("Carrera 19 con calle 25") &&
        nota.html.includes(usd("10,00")) && nota.html.includes("No es una factura"),
    );
    comprobar("la nota dice lo abonado y lo que queda", nota.html.includes(usd("4,00")) && nota.html.includes(usd("6,00")) && nota.html.includes("Abonada"));
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

    const cuentas = await pagina("/admin/cuentas");
    comprobar(`cuentas por pagar (${cuentas.ms} ms)`, cuentas.html.includes(nombre) && cuentas.html.includes(">Recordar</a>"));
    const informe = await pagina("/admin/informe");
    comprobar(`informe con detal y mayor (${informe.ms} ms)`, informe.html.includes("Al detal y al mayor") && informe.html.includes("Al mayor") && informe.html.includes(nombre));
    const busca = await pagina(`/admin/clientes?q=${encodeURIComponent(nombre.slice(0, 6).toUpperCase())}`);
    comprobar("buscador de clientes sin distinguir mayúsculas", busca.html.includes(nombre) && busca.html.includes("Ver todos"));
    const productos = await pagina("/admin/productos");
    comprobar("panel de productos con los dos precios", productos.html.includes("Al detal") && productos.html.includes("Al mayor") && productos.html.includes("Tasa del día"));

    // Foto de la nota.
    const datos = new FormData();
    datos.set(accionDe(ficha, 'name="archivo"'), "");
    datos.set("cliente_id", String(clienteId));
    datos.set("descripcion", "Nota 45");
    datos.set("archivo", new File([png], "nota.png", { type: "image/png" }));
    let respuesta = await fetch(base + `/admin/clientes/${clienteId}`, { method: "POST", headers: { cookie }, body: datos, redirect: "manual" });
    comprobar("subir la foto de la nota", respuesta.status === 303 && (await cuentasDe(clienteId)).fotos === 1, String(respuesta.status));
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
    comprobar("lista de clientes para Excel", respuesta.status === 200 && csv[0] === 0xef && csv.toString("utf8").includes(`${nombre};0412-0000000`));

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
  } finally {
    if (enProduccion) await borrarDeLaNube(limpiar);
  }
}

/** Solo en local: el alta rápida, los repetidos y el orden de la ruta. */
async function probarCartera() {
  const alta = (campos) => enviar("/admin/clientes", 'name="cedula_rif"', { nombre: "", telefono: "", direccion: "", tipo: "detal", ...campos });

  let r = await alta({ telefono: "0414 555 0101", direccion: "Calle 38 con carrera 28" });
  const cercaId = Number(r.destino.match(/nuevo=(\d+)/)?.[1]);
  comprobar("alta rápida: solo teléfono y dirección", r.destino.includes("Cliente guardado: 0414-5550101.") && !r.destino.includes("Ojo") && cercaId > 0, r.destino);

  r = await alta({ telefono: "04245550102", direccion: "Carrera 22 entre calles 30 y 31", nombre: "Pizzería La Esquina" });
  comprobar("alta con nombre", r.destino.includes("Cliente guardado: Pizzería La Esquina."), r.destino);

  r = await alta({ telefono: "0416-5550103", direccion: "Urb. Del Este, casa 4" });
  comprobar("una dirección fuera de la cuadrícula se guarda, con aviso", r.destino.includes("Cliente guardado") && r.destino.includes("Ojo: queda fuera de la ruta de despacho. La dirección parece una urbanización"), r.destino);

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
    ]),
    JSON.stringify(guardados),
  );

  // La cartera ordenada por la ruta: del más cercano a la tienda al más lejano, y al final los que no se ubican.
  const cartera = (await pagina("/admin/clientes?orden=ruta")).html;
  const lista = cartera.slice(cartera.indexOf("Por ruta desde la tienda"));
  const posicion = (texto) => lista.indexOf(`>${texto}</a>`);
  const orden = ["0414-5550101", "Pizzería La Esquina", "Bodega Prueba", "0416-5550103"].map(posicion);
  comprobar(
    "cartera ordenada por la ruta desde la tienda",
    orden.every((p) => p > 0) && orden.join() === [...orden].sort((a, b) => a - b).join(),
    orden.join(),
  );
  comprobar("la cartera dice quién queda fuera de la ruta y por qué", legible(cartera).includes("Fuera de la ruta. La dirección parece una urbanización"));

  const busca = await pagina("/admin/clientes?q=esquina");
  comprobar("la cartera se busca por nombre", busca.html.includes("Pizzería La Esquina") && busca.html.includes("1 de "));

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

/** El panel no borra clientes: los de prueba se quitan directamente de Turso. */
async function borrarDeLaNube(clientes) {
  const nube = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
  try {
    for (const id of clientes.filter(Boolean)) {
      await nube.execute({ sql: "delete from venta_lineas where venta_id in (select id from ventas where cliente_id = ?)", args: [id] });
      for (const tabla of ["adjuntos", "ventas", "pagos"]) {
        await nube.execute({ sql: `delete from ${tabla} where cliente_id = ?`, args: [id] });
      }
      await nube.execute({ sql: "delete from clientes where id = ?", args: [id] });
    }
    const quedan = await nube.execute("select (select count(*) from clientes) c, (select count(*) from ventas) v, (select count(*) from productos) p");
    console.log("en la nube quedan:", JSON.stringify({ ...quedan.rows[0] }));
  } finally {
    nube.close();
  }
}

// ---------- Principal ----------

try {
  console.log(enProduccion ? `Probando ${base}` : "Probando en local con una base temporal");
  if (!enProduccion) await arrancarServidor();

  const web = await pagina("/", "");
  comprobar(`web pública (${web.ms} ms)`, web.status === 200 && web.html.includes("Precios de hoy") && web.html.includes("wa.me/584245541749"));

  const primera = web.html.match(/href="(\/producto\/\d+[a-z0-9-]*)"/)?.[1];
  const detalle = primera ? await pagina(primera, "") : null;
  comprobar("la página de un producto abre desde la portada", Boolean(detalle) && detalle.status === 200 && detalle.html.includes("Cómo comprar") && detalle.html.includes("Todos los productos"), String(primera));

  await probarPresentacion(web);
  await probarEntrada();
  if (!enProduccion) await probarPrecios();
  await probarNegocio();
  if (!enProduccion) {
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
