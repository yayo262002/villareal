import "server-only";
import { randomBytes } from "node:crypto";
import { ejecutar, fila, filas } from "./db";
import { telefonoLegible } from "./whatsapp";
import { VERSION_GRAPH, firmaValida, type MensajeLeido } from "./whatsapp-calculo";

/**
 * El WhatsApp del negocio conectado a la web con la API de Meta, en coexistencia: el número 0424-6343236 sigue en
 * WhatsApp Business del teléfono del dueño y, a la vez, Meta manda a `/api/whatsapp` cada mensaje (el dueño,
 * 21/11/2026: «automatizar todos los WhatsApp que entren, con el mismo número»).
 *
 * Lo que se guarda:
 * - en `ajustes`, lo que no es secreto: el id de la app de Meta, el de la configuración de «Embedded Signup», la cuenta
 *   de WhatsApp (WABA) y el número conectados;
 * - en `secretos` (fuera de las copias), la clave secreta de la app, el permiso que Meta da al conectar y la palabra
 *   con que Meta comprueba la dirección de los avisos.
 *
 * Al conectar no se registra el número (eso lo sacaría de la app del teléfono): con coexistencia ya está registrado.
 * Se suscribe la app a los avisos de la cuenta y se pide, una sola vez y en las 24 horas siguientes, que Meta mande
 * los contactos y el historial.
 */

const GRAPH = `https://graph.facebook.com/${VERSION_GRAPH}`;

/** El id de la app «Villa Real Panel» creada el 21/11/2026 en Meta for Developers. No es secreto: va en la página. */
export const APP_POR_DEFECTO = "1850654339309038";

async function leerSecreto(clave: string): Promise<string | null> {
  return (await fila<{ valor: string }>("select valor from secretos where clave = ?", [clave]))?.valor ?? null;
}

async function guardarSecreto(clave: string, valor: string): Promise<void> {
  await ejecutar("insert into secretos (clave, valor) values (?, ?) on conflict(clave) do update set valor = excluded.valor", [clave, valor]);
}

async function guardarAjuste(clave: string, valor: string): Promise<void> {
  await ejecutar(
    `insert into ajustes (clave, valor, actualizado_en) values (?, ?, datetime('now'))
     on conflict(clave) do update set valor = excluded.valor, actualizado_en = excluded.actualizado_en`,
    [clave, valor],
  );
}

/** La palabra con que Meta comprueba la dirección de los avisos («Token de verificación»). Se crea sola la primera vez. */
export async function palabraDeVerificacion(): Promise<string> {
  const guardada = await leerSecreto("whatsapp_verificacion");
  if (guardada) return guardada;
  const nueva = randomBytes(18).toString("base64url");
  await ejecutar("insert or ignore into secretos (clave, valor) values ('whatsapp_verificacion', ?)", [nueva]);
  return (await leerSecreto("whatsapp_verificacion")) ?? nueva;
}

/** Si un aviso que llega a `/api/whatsapp` lo firmó Meta con la clave secreta de la app. */
export async function avisoFirmadoPorMeta(cuerpo: string, firma: string | null): Promise<boolean> {
  const secreto = await leerSecreto("whatsapp_app_secreto");
  return secreto !== null && firmaValida(cuerpo, firma, secreto);
}

export type EstadoWhatsapp = {
  appId: string;
  configId: string;
  tieneSecreto: boolean;
  /** Ya se conectó el número: la cuenta de WhatsApp y el número, como los dio Meta. */
  wabaId: string | null;
  telefonoId: string | null;
  numero: string | null;
  nombreVerificado: string | null;
  conectadoEn: string | null;
  /** Lo que dijo Meta al pedir los contactos y el historial (o por qué no se pudo). */
  sincronizacion: string | null;
  ultimoEvento: string | null;
  ultimoAviso: string | null;
};

export async function estadoWhatsapp(): Promise<EstadoWhatsapp> {
  const claves = ["whatsapp_app_id", "whatsapp_config_id", "whatsapp_waba_id", "whatsapp_telefono_id", "whatsapp_numero", "whatsapp_nombre", "whatsapp_conectado_en", "whatsapp_sincronizacion", "whatsapp_ultimo_evento", "whatsapp_ultimo_aviso"];
  const guardados = new Map(
    (await filas<{ clave: string; valor: string }>(`select clave, valor from ajustes where clave in (${claves.map(() => "?").join(", ")})`, claves)).map((a) => [a.clave, a.valor]),
  );
  return {
    appId: guardados.get("whatsapp_app_id") || APP_POR_DEFECTO,
    configId: guardados.get("whatsapp_config_id") ?? "",
    tieneSecreto: (await leerSecreto("whatsapp_app_secreto")) !== null,
    wabaId: guardados.get("whatsapp_waba_id") ?? null,
    telefonoId: guardados.get("whatsapp_telefono_id") ?? null,
    numero: guardados.get("whatsapp_numero") ?? null,
    nombreVerificado: guardados.get("whatsapp_nombre") ?? null,
    conectadoEn: guardados.get("whatsapp_conectado_en") ?? null,
    sincronizacion: guardados.get("whatsapp_sincronizacion") ?? null,
    ultimoEvento: guardados.get("whatsapp_ultimo_evento") ?? null,
    ultimoAviso: guardados.get("whatsapp_ultimo_aviso") ?? null,
  };
}

/** Los datos de la app de Meta que escribe el dueño: el id, el de la configuración y, si la escribió, la clave secreta. */
export async function guardarDatosDeLaApp(datos: { appId: string; configId: string; secreto: string }): Promise<void> {
  await guardarAjuste("whatsapp_app_id", datos.appId);
  await guardarAjuste("whatsapp_config_id", datos.configId);
  if (datos.secreto) await guardarSecreto("whatsapp_app_secreto", datos.secreto);
}

type RespuestaDeMeta = Record<string, unknown> & { error?: { message?: string; code?: number; error_subcode?: number; error_user_msg?: string } };

async function pedirAMeta(ruta: string, opciones: { metodo?: "GET" | "POST"; token?: string; cuerpo?: Record<string, unknown> } = {}): Promise<RespuestaDeMeta> {
  const respuesta = await fetch(`${GRAPH}/${ruta}`, {
    method: opciones.metodo ?? "GET",
    headers: {
      ...(opciones.token ? { authorization: `Bearer ${opciones.token}` } : {}),
      ...(opciones.cuerpo ? { "content-type": "application/json" } : {}),
    },
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const datos = (await respuesta.json().catch(() => ({}))) as RespuestaDeMeta;
  if (!respuesta.ok || datos.error) {
    const e = datos.error;
    // Meta explica en castellano lo que no le gustó (error_user_msg) cuando puede: se dice eso, con el código para buscarlo.
    const explicacion = e?.error_user_msg ? `${e.error_user_msg.replace(/.$/, "")} — ${e.message ?? ""}` : (e?.message ?? "error de Meta");
    throw new Error(e ? `${explicacion} (código ${e.code ?? "?"}${e.error_subcode ? `/${e.error_subcode}` : ""})` : `Meta respondió ${respuesta.status}`);
  }
  return datos;
}

/** La cuenta de WhatsApp a la que da acceso el permiso, si la ventana de Meta no la dijo. */
async function cuentaDelPermiso(token: string, appId: string, secreto: string): Promise<string | null> {
  const datos = await pedirAMeta(`debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(`${appId}|${secreto}`)}`);
  const alcances = ((datos.data as Record<string, unknown> | undefined)?.granular_scopes ?? []) as { scope?: string; target_ids?: string[] }[];
  return alcances.find((a) => a.scope === "whatsapp_business_management")?.target_ids?.[0] ?? null;
}

export type ResultadoDeConectar = { ok: boolean; mensaje: string };

/**
 * Lo que se hace cuando el dueño termina la ventana de Meta («Conectar el número»): cambiar el código por el permiso
 * (vale 5 minutos), suscribir la app a los avisos de la cuenta, comprobar el número y pedir los contactos y el
 * historial. Nada registra el número: con coexistencia ya está en uso en el teléfono.
 */
export async function conectarConCodigo(datos: { code: string; wabaId: string; telefonoId: string }): Promise<ResultadoDeConectar> {
  const estado = await estadoWhatsapp();
  const secreto = await leerSecreto("whatsapp_app_secreto");
  if (!secreto) return { ok: false, mensaje: "Falta la clave secreta de la app: escríbela arriba y guarda." };

  let token: string;
  try {
    const respuesta = await pedirAMeta(
      `oauth/access_token?client_id=${encodeURIComponent(estado.appId)}&client_secret=${encodeURIComponent(secreto)}&code=${encodeURIComponent(datos.code)}`,
    );
    token = String(respuesta.access_token ?? "");
    if (!token) throw new Error("Meta no devolvió el permiso");
  } catch (error) {
    return { ok: false, mensaje: `Meta no dio el permiso: ${error instanceof Error ? error.message : error}. Vuelve a pulsar «Conectar» (el código vale 5 minutos).` };
  }
  await guardarSecreto("whatsapp_token", token);

  let wabaId = datos.wabaId;
  let telefonoId = datos.telefonoId;
  const pasos: string[] = [];
  try {
    if (!wabaId) wabaId = (await cuentaDelPermiso(token, estado.appId, secreto)) ?? "";
    if (!wabaId) return { ok: false, mensaje: "Meta dio el permiso pero no dijo qué cuenta de WhatsApp. Manda una captura de la pantalla." };
    if (!telefonoId) {
      const numeros = (await pedirAMeta(`${wabaId}/phone_numbers?fields=id,display_phone_number`, { token })).data as { id: string }[] | undefined;
      telefonoId = numeros?.[0]?.id ?? "";
    }
    await guardarAjuste("whatsapp_waba_id", wabaId);
    if (telefonoId) await guardarAjuste("whatsapp_telefono_id", telefonoId);
    await guardarAjuste("whatsapp_conectado_en", new Date().toISOString().slice(0, 19).replace("T", " "));

    await pedirAMeta(`${wabaId}/subscribed_apps`, { metodo: "POST", token });
    pasos.push("avisos suscritos");

    if (telefonoId) {
      const numero = await pedirAMeta(`${telefonoId}?fields=display_phone_number,verified_name,is_on_biz_app,platform_type`, { token });
      await guardarAjuste("whatsapp_numero", String(numero.display_phone_number ?? ""));
      await guardarAjuste("whatsapp_nombre", String(numero.verified_name ?? ""));
      pasos.push(numero.is_on_biz_app === true ? "sigue en la app del teléfono (coexistencia)" : `ojo: Meta dice is_on_biz_app=${String(numero.is_on_biz_app)}`);
    }
  } catch (error) {
    return { ok: false, mensaje: `Se conectó a medias: ${error instanceof Error ? error.message : error}. Manda una captura de esta pantalla.` };
  }

  // Los contactos y el historial: una sola vez, en las 24 horas siguientes. Si falla, se dice y se puede repetir.
  const sincronizacion: string[] = [];
  if (telefonoId) {
    for (const [tipo, nombre] of [
      ["smb_app_state_sync", "contactos"],
      ["history", "historial"],
    ] as const) {
      try {
        await pedirAMeta(`${telefonoId}/smb_app_data`, { metodo: "POST", token, cuerpo: { messaging_product: "whatsapp", sync_type: tipo } });
        sincronizacion.push(`${nombre}: pedido`);
      } catch (error) {
        sincronizacion.push(`${nombre}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
  await guardarAjuste("whatsapp_sincronizacion", sincronizacion.join(" · ") || "sin número: no se pidió");
  return { ok: true, mensaje: `WhatsApp conectado (${pasos.join(", ")}). ${sincronizacion.join(" · ")}.` };
}

/** Lo último que llegó de Meta: la hora y qué era, para saber que los avisos llegan. */
export async function anotarAviso(resumen: string, eventos: string[]): Promise<void> {
  await guardarAjuste("whatsapp_ultimo_aviso", `${new Date().toISOString().slice(0, 19).replace("T", " ")} · ${resumen}`);
  if (eventos.length > 0) await guardarAjuste("whatsapp_ultimo_evento", eventos.join(", "));
}

/** Guarda los mensajes que no estaban, cada uno unido a su cliente si su teléfono está en la cartera. Dice cuántos entraron. */
export async function guardarMensajes(mensajes: MensajeLeido[]): Promise<number> {
  let nuevos = 0;
  const clientePorTelefono = new Map<string, number | null>();
  for (const m of mensajes) {
    if (!clientePorTelefono.has(m.telefono)) {
      const cliente = await fila<{ id: number }>("select id from clientes where telefono = ? order by id limit 1", [telefonoLegible(m.telefono)]);
      clientePorTelefono.set(m.telefono, cliente?.id ?? null);
    }
    const r = await ejecutar(
      `insert or ignore into whatsapp_mensajes (wamid, telefono, nombre, direccion, origen, tipo, texto, momento, cliente_id)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [m.wamid, m.telefono, m.nombre.slice(0, 120), m.direccion, m.origen, m.tipo.slice(0, 40), m.texto.slice(0, 4000), m.momento, clientePorTelefono.get(m.telefono) ?? null],
    );
    nuevos += r.cambios;
  }
  return nuevos;
}

export type MensajeGuardado = MensajeLeido & { id: number; cliente_id: number | null; cliente: string | null };

/** Los últimos mensajes, de lo más nuevo a lo más viejo, con el cliente de la cartera si se sabe quién es. */
export async function ultimosMensajes(limite = 100): Promise<MensajeGuardado[]> {
  return filas<MensajeGuardado>(
    `select m.id, m.wamid, m.telefono, m.nombre, m.direccion, m.origen, m.tipo, m.texto, m.momento, m.cliente_id,
            coalesce(nullif(c.razon_social, ''), nullif(c.nombre, '')) as cliente
       from whatsapp_mensajes m left join clientes c on c.id = m.cliente_id
      order by m.momento desc, m.id desc limit ?`,
    [limite],
  );
}

export async function contarMensajes(): Promise<number> {
  return Number((await fila<{ n: number }>("select count(*) as n from whatsapp_mensajes"))?.n ?? 0);
}

/*
 * La revisión de Meta. Para conectar un número que está en WhatsApp Business del teléfono (coexistencia), Meta pide que
 * la app pase la revisión de dos permisos: mandar mensajes (`whatsapp_business_messaging`) y administrar la cuenta
 * (`whatsapp_business_management`). Para la revisión hacen falta una llamada de prueba con cada uno y dos videos: el
 * panel mandando un mensaje que llega a un teléfono, y el panel creando una plantilla. Se hacen con el número de prueba
 * que Meta da gratis en la app (WhatsApp → Configuración de la API) y su token, que vale 24 horas y se guarda en
 * `secretos` como los demás.
 */

export type PruebasWhatsapp = {
  tieneToken: boolean;
  /** Cuándo se pegó el token (UTC): el de la página de Meta vale 24 horas. */
  tokenEn: string | null;
  wabaId: string | null;
  telefonoId: string | null;
  numero: string | null;
};

export async function estadoDePruebas(): Promise<PruebasWhatsapp> {
  const claves = ["whatsapp_prueba_token_en", "whatsapp_prueba_waba_id", "whatsapp_prueba_telefono_id", "whatsapp_prueba_numero"];
  const guardados = new Map(
    (await filas<{ clave: string; valor: string }>(`select clave, valor from ajustes where clave in (${claves.map(() => "?").join(", ")})`, claves)).map((a) => [a.clave, a.valor]),
  );
  return {
    tieneToken: (await leerSecreto("whatsapp_token_pruebas")) !== null,
    tokenEn: guardados.get("whatsapp_prueba_token_en") ?? null,
    wabaId: guardados.get("whatsapp_prueba_waba_id") || null,
    telefonoId: guardados.get("whatsapp_prueba_telefono_id") || null,
    numero: guardados.get("whatsapp_prueba_numero") || null,
  };
}

/**
 * Guarda el token de la página de Meta y busca, si no se escribieron, la cuenta de prueba y su número. Lo comprueba
 * preguntándole a Meta por el número: un token caducado o mal copiado no se guarda. Devuelve el número de prueba.
 */
export async function guardarPruebas(datos: { token: string; wabaId: string; telefonoId: string }): Promise<string> {
  const { token } = datos;
  let { wabaId, telefonoId } = datos;
  if (!wabaId) {
    const estado = await estadoWhatsapp();
    const secreto = await leerSecreto("whatsapp_app_secreto");
    if (secreto) wabaId = (await cuentaDelPermiso(token, estado.appId, secreto).catch(() => null)) ?? "";
  }
  if (!telefonoId) {
    if (!wabaId) throw new Error("no se sabe qué cuenta es: copia también el «Identificador de la cuenta de WhatsApp Business» de la misma página");
    const numeros = (await pedirAMeta(`${wabaId}/phone_numbers?fields=id,display_phone_number`, { token })).data as { id: string }[] | undefined;
    telefonoId = numeros?.[0]?.id ?? "";
    if (!telefonoId) throw new Error("esa cuenta no tiene número de prueba");
  }
  const numero = await pedirAMeta(`${telefonoId}?fields=display_phone_number,verified_name`, { token });
  await guardarSecreto("whatsapp_token_pruebas", token);
  await guardarAjuste("whatsapp_prueba_token_en", new Date().toISOString().slice(0, 19).replace("T", " "));
  await guardarAjuste("whatsapp_prueba_waba_id", wabaId);
  await guardarAjuste("whatsapp_prueba_telefono_id", telefonoId);
  await guardarAjuste("whatsapp_prueba_numero", String(numero.display_phone_number ?? ""));
  return String(numero.display_phone_number ?? telefonoId);
}

async function tokenDePruebas(): Promise<{ token: string; pruebas: PruebasWhatsapp }> {
  const token = await leerSecreto("whatsapp_token_pruebas");
  const pruebas = await estadoDePruebas();
  if (!token || !pruebas.telefonoId) throw new Error("primero pega el token de la página de Meta y guárdalo");
  return { token, pruebas };
}

/**
 * Manda un mensaje desde el número de prueba: la plantilla «hello_world» de Meta, que llega siempre, o un texto, que
 * solo llega si esa persona le escribió al número de prueba en las últimas 24 horas. Devuelve el id del mensaje.
 */
export async function mandarMensajeDePrueba(datos: { para: string; texto: string }): Promise<string> {
  const { token, pruebas } = await tokenDePruebas();
  const cuerpo = datos.texto
    ? { messaging_product: "whatsapp", to: datos.para, type: "text", text: { body: datos.texto } }
    : { messaging_product: "whatsapp", to: datos.para, type: "template", template: { name: "hello_world", language: { code: "en_US" } } };
  const respuesta = await pedirAMeta(`${pruebas.telefonoId}/messages`, { metodo: "POST", token, cuerpo });
  return String((respuesta.messages as { id?: string }[] | undefined)?.[0]?.id ?? "sin id");
}

/** Crea una plantilla de mensaje en la cuenta de prueba (solo el cuerpo, sin variables). Devuelve su id y su estado. */
export async function crearPlantillaDePrueba(datos: { nombre: string; categoria: string; idioma: string; texto: string }): Promise<string> {
  const { token, pruebas } = await tokenDePruebas();
  if (!pruebas.wabaId) throw new Error("falta el «Identificador de la cuenta de WhatsApp Business»: pégalo junto al token");
  const respuesta = await pedirAMeta(`${pruebas.wabaId}/message_templates`, {
    metodo: "POST",
    token,
    cuerpo: { name: datos.nombre, category: datos.categoria, language: datos.idioma, components: [{ type: "BODY", text: datos.texto }] },
  });
  return `${String(respuesta.id ?? "")} · ${String(respuesta.status ?? "")}`;
}

export type PlantillaDeMeta = { nombre: string; estado: string; categoria: string; idioma: string };

/** Las plantillas de la cuenta de prueba, para verlas en el panel (y en el video). Si no se puede, por qué. */
export async function plantillasDePrueba(): Promise<{ plantillas: PlantillaDeMeta[]; error: string | null }> {
  try {
    const { token, pruebas } = await tokenDePruebas();
    if (!pruebas.wabaId) return { plantillas: [], error: null };
    const datos = (await pedirAMeta(`${pruebas.wabaId}/message_templates?fields=name,status,category,language&limit=25`, { token })).data as
      | { name?: string; status?: string; category?: string; language?: string }[]
      | undefined;
    return {
      plantillas: (datos ?? []).map((p) => ({ nombre: p.name ?? "", estado: p.status ?? "", categoria: p.category ?? "", idioma: p.language ?? "" })),
      error: null,
    };
  } catch (error) {
    return { plantillas: [], error: error instanceof Error ? error.message : String(error) };
  }
}
