import "server-only";
import { ejecutar, fila, filas } from "./db";
import { diaDeLaSemana, fechaCorta, hoy } from "./dinero";
import { esFinDeSemana, esViernes, lunesDespuesDe, ultimoDiaHabilDespuesDe } from "./tasa";
import { IVA_GENERAL_POR_DEFECTO } from "./factura-calculo";
import { CLAVES_REGLAS_DETAL, reglasDesdeAjustes, type ReglasDelDetal } from "./detal-calculo";
import { leerAjustesDeDelivery, type AjustesDeDelivery } from "./delivery";
import { partesDesdeAjuste, type ParteDelReparto } from "./reparto-calculo";

/**
 * Ajustes sueltos del negocio, guardados como clave y valor. La tasa del
 * día (bolívares por dólar) es el principal: con ella la web publica los
 * precios en bolívares y el formulario de pagos la propone.
 */

/** De dónde salió la tasa vigente: la escribió el dueño o se trajo sola del BCV. */
export type OrigenTasa = "manual" | "bcv";

export type Tasa = {
  valor: number;
  actualizada_en: string;
  origen: OrigenTasa;
  /** El día desde el que vale según el BCV: desde el viernes en la noche hasta el domingo, el lunes. null en las de antes. */
  fecha_valor: string | null;
};

type Ajuste = { clave: string; valor: string; actualizado_en: string };

async function leer(...claves: string[]): Promise<Map<string, Ajuste>> {
  const huecos = claves.map(() => "?").join(", ");
  const lista = await filas<Ajuste>(`select clave, valor, actualizado_en from ajustes where clave in (${huecos})`, claves);
  return new Map(lista.map((a) => [a.clave, a]));
}

async function guardar(clave: string, valor: string): Promise<void> {
  await ejecutar(
    `insert into ajustes (clave, valor, actualizado_en) values (?, ?, datetime('now'))
     on conflict(clave) do update set valor = excluded.valor, actualizado_en = excluded.actualizado_en`,
    [clave, valor],
  );
}

async function quitar(clave: string): Promise<void> {
  await ejecutar("delete from ajustes where clave = ?", [clave]);
}

export async function leerTasa(): Promise<Tasa | null> {
  const ajustes = await leer("tasa_bs", "tasa_origen", "tasa_fecha_valor");
  const tasa = ajustes.get("tasa_bs");
  if (!tasa) return null;
  const valor = Number(tasa.valor);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return {
    valor,
    actualizada_en: tasa.actualizado_en,
    origen: ajustes.get("tasa_origen")?.valor === "bcv" ? "bcv" : "manual",
    fecha_valor: ajustes.get("tasa_fecha_valor")?.valor ?? null,
  };
}

/**
 * Pone la tasa vigente y la deja en el historial. `fechaValor` es el día
 * desde el que vale según el BCV: un sábado se guarda la del lunes, y queda
 * también como la tasa de ese lunes. El viernes en la noche la del lunes
 * queda como la de ese lunes, no como la del viernes: lo que se pagó el
 * viernes de día y se anote después va con la del viernes. Lo que se anota
 * esa misma noche toma la del lunes (`tasaEnFecha`).
 */
export async function guardarTasa(valor: number, origen: OrigenTasa = "manual", fechaValor: string | null = null): Promise<void> {
  if (!(valor > 0)) throw new Error("La tasa tiene que ser mayor que cero.");
  const dia = hoy();
  const valeDesde = fechaValor && /^\d{4}-\d{2}-\d{2}$/.test(fechaValor) ? fechaValor : dia;
  await guardar("tasa_bs", String(valor));
  await guardar("tasa_origen", origen);
  await guardar("tasa_fecha_valor", valeDesde);
  // Queda en el historial: así un abono o una nota de días atrás se registran con la tasa que había ese día.
  const enElHistorial = valeDesde <= dia ? [dia] : esFinDeSemana(dia) ? [dia, valeDesde] : [valeDesde];
  for (const fecha of enElHistorial) {
    await ejecutar(
      `insert into tasas (fecha, valor, origen, actualizada_en) values (?, ?, ?, datetime('now'))
       on conflict(fecha) do update set valor = excluded.valor, origen = excluded.origen, actualizada_en = excluded.actualizada_en`,
      [fecha, valor, origen],
    );
  }
}

/** De dónde sale la tasa de un día: guardada ese día (del BCV o a mano), la del lunes en un fin de semana, de un abono o una nota de ese día, la última anterior, o la vigente. */
export type FuenteDeTasa = "bcv" | "manual" | "lunes" | "abono" | "nota" | "anterior" | "actual";

export type TasaDeUnDia = {
  fecha: string;
  valor: number;
  fuente: FuenteDeTasa;
  /** El día del que viene de verdad: el de la última anterior, o el lunes en un fin de semana. */
  desde: string;
};

/**
 * La tasa que había un día. Un sábado o un domingo, la del lunes que le
 * sigue si ya se conoce (o la del martes, si el lunes fue feriado), como en
 * los comercios; y hoy viernes, si ya se trajo la del lunes (en la noche),
 * esa. Si no: la guardada ese día, la de un abono o una nota de ese día, la
 * última guardada antes, y si no la vigente. Para proponerla al registrar
 * algo con fecha atrasada, y en la caja; el dueño la puede cambiar.
 */
export async function tasaEnFecha(fecha: string): Promise<TasaDeUnDia | null> {
  if (fecha === hoy() && (esViernes(fecha) || esFinDeSemana(fecha))) {
    const vigente = await leerTasa();
    if (vigente?.fecha_valor && vigente.fecha_valor > fecha) return { fecha, valor: vigente.valor, fuente: "lunes", desde: vigente.fecha_valor };
  }
  if (esFinDeSemana(fecha)) {
    const delLunes = await fila<{ fecha: string; valor: number }>(
      "select fecha, valor from tasas where fecha between ? and ? order by fecha limit 1",
      [lunesDespuesDe(fecha), ultimoDiaHabilDespuesDe(fecha)],
    );
    if (delLunes) return { fecha, valor: Number(delLunes.valor), fuente: "lunes", desde: delLunes.fecha };
  }
  const guardada = await fila<{ valor: number; origen: string }>("select valor, origen from tasas where fecha = ?", [fecha]);
  if (guardada) return { fecha, valor: Number(guardada.valor), fuente: fuenteDe(guardada.origen), desde: fecha };
  const deAbono = await fila<{ tasa: number }>("select tasa from pagos where fecha = ? and tasa is not null order by id desc limit 1", [fecha]);
  if (deAbono) return { fecha, valor: Number(deAbono.tasa), fuente: "abono", desde: fecha };
  const deNota = await fila<{ tasa: number }>("select tasa from ventas where fecha = ? and tasa is not null order by id desc limit 1", [fecha]);
  if (deNota) return { fecha, valor: Number(deNota.tasa), fuente: "nota", desde: fecha };
  const anterior = await fila<{ fecha: string; valor: number }>("select fecha, valor from tasas where fecha < ? order by fecha desc limit 1", [fecha]);
  if (anterior) return { fecha, valor: Number(anterior.valor), fuente: "anterior", desde: anterior.fecha };
  const actual = await leerTasa();
  return actual ? { fecha, valor: actual.valor, fuente: "actual", desde: fecha } : null;
}

function fuenteDe(origen: string): FuenteDeTasa {
  return origen === "bcv" || origen === "abono" || origen === "nota" ? origen : "manual";
}

/** «del BCV ese día», «la del lunes 05/10/2026…», «la de un abono de ese día», «la última guardada, del 30/09/2026», «la vigente». */
export function describirFuenteDeTasa(t: TasaDeUnDia): string {
  switch (t.fuente) {
    case "bcv":
      return "del BCV ese día";
    case "manual":
      return "escrita a mano ese día";
    case "lunes":
      return `la del ${diaDeLaSemana(t.desde)} ${fechaCorta(t.desde)}: desde el viernes en la noche y el fin de semana vale la del próximo día hábil`;
    case "abono":
      return "la de un abono de ese día";
    case "nota":
      return "la de una nota de ese día";
    case "anterior":
      return `la última guardada, del ${fechaCorta(t.desde)}`;
    case "actual":
      return "la vigente";
  }
}

/**
 * Si la tasa se trae sola del BCV cada mañana. Encendido mientras el dueño
 * no lo apague: el negocio cobra a tasa BCV, y una tasa de ayer publica
 * precios en bolívares que ya no son.
 */
export async function tasaAutomatica(): Promise<boolean> {
  return (await leer("tasa_automatica")).get("tasa_automatica")?.valor !== "0";
}

export async function ponerTasaAutomatica(encendida: boolean): Promise<void> {
  await guardar("tasa_automatica", encendida ? "1" : "0");
}

/** Lo último que falló al traer la tasa, para enseñarlo en el panel. */
export async function leerAvisoTasa(): Promise<{ mensaje: string; momento: string } | null> {
  const aviso = (await leer("tasa_aviso")).get("tasa_aviso");
  return aviso ? { mensaje: aviso.valor, momento: aviso.actualizado_en } : null;
}

export async function ponerAvisoTasa(mensaje: string | null): Promise<void> {
  if (mensaje === null) await quitar("tasa_aviso");
  else await guardar("tasa_aviso", mensaje);
}

/**
 * Marca de que los precios publicados son de ejemplo y no los del dueño.
 * Mientras esté puesta, el panel lo avisa arriba de Productos. La quita el
 * dueño cuando ya ha puesto los suyos.
 */
export async function hayPreciosDeEjemplo(): Promise<boolean> {
  return (await leer("precios_de_ejemplo")).get("precios_de_ejemplo")?.valor === "1";
}

export async function quitarPreciosDeEjemplo(): Promise<void> {
  await quitar("precios_de_ejemplo");
}

/** Si la caja puede vender más de lo que hay en inventario (el inventario puede ir atrasado). Apagado si no se dijo. */
export async function permitirStockNegativo(): Promise<boolean> {
  return (await leer("permitir_stock_negativo")).get("permitir_stock_negativo")?.valor === "1";
}

export async function ponerPermitirStockNegativo(permitir: boolean): Promise<void> {
  await guardar("permitir_stock_negativo", permitir ? "1" : "0");
}

/** La alícuota general del IVA (16 % si el dueño no puso otra). */
export async function alicuotaIva(): Promise<number> {
  const valor = Number((await leer("iva_pct")).get("iva_pct")?.valor);
  return Number.isFinite(valor) && valor >= 0 && valor <= 100 ? valor : IVA_GENERAL_POR_DEFECTO;
}

export async function ponerAlicuotaIva(pct: number): Promise<void> {
  await guardar("iva_pct", String(pct));
}

/**
 * Desde qué número se numeran las facturas: si el negocio ya emitió
 * facturas antes de este sistema (en papel), la primera de aquí sigue la
 * cuenta. Vale 1 si no se dijo nada.
 */
export async function numeracionDeFacturasDesde(): Promise<number> {
  const valor = Number((await leer("facturas_desde")).get("facturas_desde")?.valor);
  return Number.isInteger(valor) && valor >= 1 ? valor : 1;
}

export async function ponerNumeracionDeFacturasDesde(numero: number): Promise<void> {
  await guardar("facturas_desde", String(numero));
}

/**
 * Las reglas de la lista del detal: en los víveres, el margen sobre el
 * costo (20 % si no se dijo otra cosa) y el del mayor (sin poner, no hay
 * precio al mayor salvo el escrito a mano); en la charcutería, el costo
 * entre 0,80 al detal y más un 10 % al mayor; la alícuota del IVA (la de
 * las facturas) y de cuánto en cuánto se suben los bolívares (5). Las
 * cuentas, en `reglasDesdeAjustes`.
 */
export async function reglasDelDetal(): Promise<ReglasDelDetal> {
  const [a, ivaPct] = await Promise.all([leer(...CLAVES_REGLAS_DETAL), alicuotaIva()]);
  return reglasDesdeAjustes((clave) => a.get(clave)?.valor, ivaPct);
}

export async function ponerReglasDelDetal(reglas: Omit<ReglasDelDetal, "iva_pct">): Promise<void> {
  await guardar("detal_margen_pct", String(reglas.margen_pct));
  await guardar("detal_redondeo_bs", String(reglas.redondeo_bs));
  await guardar("detal_charcuteria_divisor", String(reglas.charcuteria_divisor));
  if (reglas.margen_mayor_pct === null) await quitar("detal_margen_mayor_pct");
  else await guardar("detal_margen_mayor_pct", String(reglas.margen_mayor_pct));
  // Vacío y guardado: la charcutería sin precio al mayor (sin guardar, vale el 10 %).
  await guardar("detal_charcuteria_mayor_pct", reglas.charcuteria_mayor_pct === null ? "" : String(reglas.charcuteria_mayor_pct));
}

/** El enlace con el que se ve la lista del detal sin clave (`/lista/abcdefghjkmnpq`), o null si no se ha creado. */
export async function enlaceDeLaLista(): Promise<string | null> {
  return (await leer("enlace_lista_detal")).get("enlace_lista_detal")?.valor ?? null;
}

export async function ponerEnlaceDeLaLista(enlace: string): Promise<void> {
  await guardar("enlace_lista_detal", enlace);
}

/** El enlace de «Mis precios», la lista personal del dueño con costos (`/precios/abcdefghjkmnpq`), o null si no se ha creado. */
export async function enlaceDeMisPrecios(): Promise<string | null> {
  return (await leer("enlace_mis_precios")).get("enlace_mis_precios")?.valor ?? null;
}

export async function ponerEnlaceDeMisPrecios(enlace: string): Promise<void> {
  await guardar("enlace_mis_precios", enlace);
}

/** Las tarifas del delivery de la web (`/admin/delivery`): sin poner, todo por confirmar. */
export async function ajustesDelDelivery(): Promise<AjustesDeDelivery> {
  return leerAjustesDeDelivery((await leer("delivery")).get("delivery")?.valor);
}

export async function ponerAjustesDelDelivery(ajustes: AjustesDeDelivery): Promise<void> {
  await guardar("delivery", JSON.stringify(ajustes));
}

/**
 * La clave con la que el teléfono del negocio manda a la web los avisos del
 * banco (`/api/banco`). Se crea desde Pago móvil y se cambia ahí si se
 * compartió de más. null mientras no se haya creado: entonces no entra nada.
 */
export async function claveDelBanco(): Promise<string | null> {
  return (await leer("banco_clave")).get("banco_clave")?.valor || null;
}

export async function ponerClaveDelBanco(clave: string): Promise<void> {
  await guardar("banco_clave", clave);
}

/** La última vez que el teléfono mandó algo, para saber si sigue conectado. */
export type ContactoDelBanco = { momento: string; era_un_pago: boolean; motivo: string };

export async function ultimoContactoDelBanco(): Promise<ContactoDelBanco | null> {
  const valor = (await leer("banco_ultimo_contacto")).get("banco_ultimo_contacto")?.valor;
  if (!valor) return null;
  try {
    const c = JSON.parse(valor) as ContactoDelBanco;
    return typeof c.momento === "string" ? c : null;
  } catch {
    return null;
  }
}

export async function ponerUltimoContactoDelBanco(contacto: ContactoDelBanco): Promise<void> {
  await guardar("banco_ultimo_contacto", JSON.stringify(contacto));
}

/**
 * La versión de las sesiones del panel: «Cerrar la sesión en todos los teléfonos» la sube y toda cookie de antes deja de
 * valer (`sesion.ts`). No es un secreto: va en las copias como lo demás.
 */
export async function versionDeSesion(): Promise<number> {
  return Number((await leer("sesion_version")).get("sesion_version")?.valor) || 1;
}

export async function subirVersionDeSesion(): Promise<number> {
  const nueva = (await versionDeSesion()) + 1;
  await guardar("sesion_version", String(nueva));
  return nueva;
}

/** Las partes del Reparto del mes, con sus puntos: las de siempre mientras el dueño no las cambie. */
export async function partesDelReparto(): Promise<ParteDelReparto[]> {
  return partesDesdeAjuste((await leer("reparto_partes")).get("reparto_partes")?.valor);
}

export async function ponerPartesDelReparto(partes: ParteDelReparto[]): Promise<void> {
  await guardar("reparto_partes", JSON.stringify(partes));
}
