import Link from "next/link";
import { negocio } from "@/config/negocio";
import { clientesConVencimiento, type ClienteConVencimiento } from "@/lib/vencimientos";
import { DIAS_DE_CREDITO_POR_DEFECTO, describirUrgencia, describirVencimiento, porUrgencia } from "@/lib/credito";
import { guardarCliente, situarClientesQueFaltan } from "@/lib/acciones";
import { necesitaElMapa } from "@/lib/mapa";
import { enlaceAlMapa, planDeDespacho, situar } from "@/lib/despacho";
import { explicarMotivo } from "@/lib/direcciones";
import { esSoloUnTelefono } from "@/lib/whatsapp";
import { fechaCorta, redondear, usd } from "@/lib/dinero";
import { enlaceWhatsappA } from "@/lib/whatsapp";
import { normalizar } from "@/lib/buscar";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Clientes" };

const CIUDAD = `${negocio.localidad}, ${negocio.estado}, Venezuela`;

const ORDENES = {
  nombre: "Por nombre",
  ruta: "Por ruta desde la tienda",
  deuda: "Los que deben, por lo que vence antes",
} as const;
type Orden = keyof typeof ORDENES;

/**
 * La cartera de clientes. Arriba, el alta rápida: con el teléfono y la
 * dirección basta. Debajo, todos los clientes con su saldo, ordenados por
 * nombre, por la ruta de despacho o por lo que deben.
 */
/** Dos direcciones que dicen lo mismo, escritas distinto: «Carrera 19 con calle 25» y «carrera 19 con calle 25». */
function mismoTexto(a: string, b: string): boolean {
  const limpiar = (t: string) => t.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
  return limpiar(a) === limpiar(b);
}

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<ParametrosAviso>;
}) {
  const parametros = await searchParams;
  const busqueda = typeof parametros.q === "string" ? parametros.q.trim() : "";
  const orden: Orden = typeof parametros.orden === "string" && parametros.orden in ORDENES ? (parametros.orden as Orden) : "nombre";
  const nuevoId = typeof parametros.nuevo === "string" ? Number(parametros.nuevo) : 0;

  const todos = await clientesConVencimiento();
  const nuevo = todos.find((c) => c.id === nuevoId);
  // Recién guardado: si su dirección no se entiende, se avisa aquí mismo, sin deshacer nada.
  const situacionDelNuevo = nuevo ? situar(nuevo, CIUDAD) : null;
  const mapaDelNuevo = nuevo ? enlaceAlMapa(nuevo, CIUDAD) : null;
  const clave = normalizar(busqueda);
  const filtrados = clave
    ? todos.filter((c) =>
        [c.nombre, c.razon_social, c.telefono, c.cedula_rif, c.direccion, c.nota].some((campo) => normalizar(campo).includes(clave)),
      )
    : todos;

  // El orden de la ruta sirve también para saber quién no está ubicado.
  const plan = planDeDespacho({ direccion: negocio.direccion, ciudad: CIUDAD }, filtrados);
  const motivo = new Map(plan.sinUbicar.map((s) => [s.cliente.id, s.motivo]));
  let clientes: ClienteConVencimiento[];
  if (orden === "ruta") clientes = [...plan.ruta.paradas.map((p) => p.dato), ...plan.sinUbicar.map((s) => s.cliente)];
  // Los que deben, por lo que vence antes: el más atrasado arriba, después el que vence hoy, mañana…; los que no deben, al final.
  else if (orden === "deuda") clientes = [...filtrados].sort(porUrgencia);
  else clientes = filtrados;

  // Direcciones sin calle y carrera que el mapa aún no ha buscado: las de antes de tener mapa.
  const faltanDelMapa = todos.filter((c) => necesitaElMapa(c.direccion) && c.lat === null).length;
  const porPagar = redondear(todos.reduce((s, c) => s + Math.max(0, c.saldo_usd), 0));
  const vencido = redondear(todos.reduce((s, c) => s + c.vencido_usd, 0));
  const enlaceOrden = (o: Orden) => {
    const p = new URLSearchParams();
    if (busqueda) p.set("q", busqueda);
    if (o !== "nombre") p.set("orden", o);
    const cola = p.toString();
    return `/admin/clientes${cola ? `?${cola}` : ""}`;
  };

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 className={estilos.titulo}>Cartera de clientes</h1>
        <div className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
          <Link href="/admin/despacho" className="boton">
            Ruta de despacho
          </Link>
          {todos.length > 0 && (
            <a href="/admin/clientes/exportar" download className="boton boton--secundario">
              Descargar lista (Excel)
            </a>
          )}
        </div>
      </div>
      <Avisos parametros={parametros} />
      {nuevo && situacionDelNuevo && situacionDelNuevo.situada && situacionDelNuevo.origen === "mapa" && (
        <p className={estilos.ayuda} style={{ marginBottom: 0 }}>
          La dirección de {nuevo.nombre} no dice calle y carrera; el mapa la sitúa en <strong>{situacionDelNuevo.texto}</strong>
          {situacionDelNuevo.aproximada ? " (aproximado)" : ""}.{" "}
          {mapaDelNuevo && (
            <a href={mapaDelNuevo} target="_blank" rel="noopener">
              Compruébalo en el mapa
            </a>
          )}
        </p>
      )}
      {nuevo && situacionDelNuevo && !situacionDelNuevo.situada && (
        <div className="aviso aviso--aviso">
          <strong>Ojo con la dirección de {nuevo.nombre}.</strong>{" "}
          {nuevo.direccion ? `«${nuevo.direccion}» no se pudo comprobar: ` : "No tiene dirección: "}
          {explicarMotivo(situacionDelNuevo.motivo)}
          {nuevo.direccion ? " Tampoco la encuentra el mapa." : ""} El cliente quedó guardado, pero fuera de la ruta de
          despacho. Escríbela con la calle y la carrera, como «Carrera 19 con calle 25», o con el nombre del sitio o de
          la avenida como lo conoce todo el mundo.{" "}
          {mapaDelNuevo && (
            <>
              <a href={mapaDelNuevo} target="_blank" rel="noopener">
                Buscarla en el mapa
              </a>
              {" · "}
            </>
          )}
          <Link href={`/admin/clientes/${nuevo.id}#datos`}>Corregir la dirección</Link>
        </div>
      )}
      {nuevo && (
        <p className={estilos.ayuda} style={{ marginBottom: 0 }}>
          <Link href={`/admin/clientes/${nuevo.id}`}>Abrir la ficha de {nuevo.nombre}</Link> para anotarle una venta o un
          abono.
        </p>
      )}

      {faltanDelMapa > 0 && (
        <form action={situarClientesQueFaltan} className="aviso aviso--aviso" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--espacio-3)" }}>
          <span>
            {faltanDelMapa === 1 ? "Hay 1 cliente" : `Hay ${faltanDelMapa} clientes`} con una dirección sin calle y carrera que el mapa todavía no ha buscado.
          </span>
          <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
            Buscar en el mapa a los que faltan
          </button>
        </form>
      )}

      <dl className={estilos.cifras}>
        <div className={estilos.cifra}>
          <dt>Clientes</dt>
          <dd>{todos.length}</dd>
        </div>
        <div className={`${estilos.cifra} ${porPagar > 0 ? estilos["cifra--alerta"] : ""}`}>
          <dt>Te deben</dt>
          <dd>{usd(porPagar)}</dd>
        </div>
        {vencido > 0 && (
          <div className={`${estilos.cifra} ${estilos["cifra--alerta"]}`}>
            <dt>Con el plazo vencido</dt>
            <dd>{usd(vencido)}</dd>
          </div>
        )}
      </dl>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Cliente nuevo</h2>
        <form action={guardarCliente} className="formulario">
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="telefono">Teléfono</label>
              {/* Tras guardar uno, el cursor vuelve aquí para registrar el siguiente. */}
              <input
                id="telefono"
                name="telefono"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="0412-1234567"
                autoFocus={Boolean(nuevo)}
              />
            </div>
            <div className="campo">
              <label htmlFor="direccion">Dirección</label>
              <input id="direccion" name="direccion" type="text" autoComplete="off" placeholder="Carrera 19 con calle 25" />
              <span className="ayuda">Con la calle y la carrera entra en la ruta de despacho.</span>
            </div>
          </div>
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="nombre">Nombre del cliente (opcional)</label>
              <input id="nombre" name="nombre" type="text" autoComplete="off" placeholder="Luis, Panadería Tuttopan" />
              <span className="ayuda">Como lo llamas tú. Sin nombre queda con el teléfono, y se avisa.</span>
            </div>
            <div className="campo">
              <label htmlFor="razon_social">Razón social (opcional)</label>
              <input id="razon_social" name="razon_social" type="text" autoComplete="off" placeholder="Tutto Pan, C.A." />
              <span className="ayuda">El nombre legal del negocio, para la nota.</span>
            </div>
          </div>
          <details className={estilos.masDatos}>
            <summary>Más datos</summary>
            <div className="formulario" style={{ marginTop: "var(--espacio-3)" }}>
              <div className="formulario__fila">
                <div className="campo">
                  <label htmlFor="cedula_rif">Cédula o RIF</label>
                  <input id="cedula_rif" name="cedula_rif" type="text" placeholder="V-12345678" />
                </div>
              </div>
              <div className="formulario__fila">
                <div className="campo">
                  <label htmlFor="dias_credito">Días de crédito</label>
                  <input
                    id="dias_credito"
                    name="dias_credito"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="365"
                    step="1"
                    defaultValue={DIAS_DE_CREDITO_POR_DEFECTO}
                  />
                  <span className="ayuda">Pasados esos días desde la nota, lo que deba sale como vencido.</span>
                </div>
                <div className="campo">
                  <label htmlFor="nota">Nota</label>
                  <input id="nota" name="nota" type="text" placeholder="Portón azul, preguntar por María" />
                </div>
              </div>
            </div>
          </details>
          <div>
            <button type="submit" className="boton">
              Guardar cliente
            </button>
          </div>
        </form>
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>
          {busqueda ? `${clientes.length} de ${todos.length} clientes` : `Clientes (${todos.length})`}
        </h2>
        {todos.length === 0 ? (
          <p className="vacio">Todavía no hay clientes. Registra el primero arriba.</p>
        ) : (
          <>
            <form method="get" action="/admin/clientes" className={estilos.buscador} role="search">
              <label htmlFor="buscar" className="visualmente-oculto">
                Buscar cliente
              </label>
              <input
                id="buscar"
                name="q"
                type="search"
                placeholder="Nombre, teléfono o dirección"
                defaultValue={busqueda}
              />
              {orden !== "nombre" && <input type="hidden" name="orden" value={orden} />}
              <button type="submit" className="boton boton--secundario">
                Buscar
              </button>
              {busqueda && (
                <Link href={orden === "nombre" ? "/admin/clientes" : `/admin/clientes?orden=${orden}`} className={estilos.limpiar}>
                  Ver todos
                </Link>
              )}
            </form>
            <nav aria-label="Orden de la lista" className={estilos.pestanas}>
              {(Object.keys(ORDENES) as Orden[]).map((o) => (
                <Link key={o} href={enlaceOrden(o)} aria-current={o === orden ? "true" : undefined}>
                  {ORDENES[o]}
                </Link>
              ))}
            </nav>

            {clientes.length === 0 ? (
              <p className="vacio">Ningún cliente coincide con «{busqueda}».</p>
            ) : (
              <ul className={estilos.cartera}>
                {clientes.map((c, i) => {
                  const whatsapp = enlaceWhatsappA(c.telefono, "Hola, le saluda " + negocio.nombre + ".");
                  const mapa = enlaceAlMapa(c, CIUDAD);
                  const sinUbicar = motivo.get(c.id);
                  const situacion = situar(c, CIUDAD);
                  const sinNombre = esSoloUnTelefono(c.nombre);
                  return (
                    <li key={c.id} className={estilos.carteraCliente}>
                      <div className={estilos.carteraCabecera}>
                        <Link href={`/admin/clientes/${c.id}`} className={estilos.carteraNombre}>
                          {orden === "ruta" && !sinUbicar && <span className={estilos.carteraOrden}>{i + 1}</span>}
                          {c.rotulo}
                          {sinNombre && <span className={estilos.sinNombre}> · sin nombre</span>}
                        </Link>
                        <span className={c.vencido_usd > 0 ? estilos.vencida : c.saldo_usd > 0 ? estilos.deuda : estilos.saldado}>
                          {c.saldo_usd > 0 ? `Debe ${usd(c.saldo_usd)}` : c.saldo_usd < 0 ? `A favor ${usd(-c.saldo_usd)}` : "Al día"}
                        </span>
                      </div>
                      {c.vencido_usd > 0 ? (
                        <p className={`${estilos.carteraDato} ${estilos.vencida}`}>
                          {describirVencimiento(c.mayor_atraso)}: {usd(c.vencido_usd)}
                        </p>
                      ) : (
                        c.urgencia !== null && <p className={`${estilos.carteraDato} ayuda`}>{describirUrgencia(c.urgencia)}</p>
                      )}
                      <p className={estilos.carteraDato}>
                        {c.direccion || <span className="ayuda">Sin dirección</span>}
                        {sinUbicar && c.direccion && <span className="ayuda"> · Fuera de la ruta. {explicarMotivo(sinUbicar)}</span>}
                        {/* Dónde la pone la cuadrícula o el mapa, solo si añade algo a lo escrito. */}
                        {situacion.situada && (situacion.origen === "mapa" || !mismoTexto(c.direccion, situacion.texto)) && (
                          <span className="ayuda">
                            {" "}
                            · {situacion.origen === "mapa" ? "según el mapa: " : "en la cuadrícula: "}
                            {situacion.texto}
                            {situacion.origen === "mapa" && situacion.aproximada ? " (aproximado)" : ""}
                          </span>
                        )}
                      </p>
                      <p className={estilos.carteraDato}>
                        {[
                          c.razon_social && !sinNombre ? c.nombre : "",
                          c.telefono && c.telefono !== c.nombre ? c.telefono : "",
                          c.ultima_compra ? `compró el ${fechaCorta(c.ultima_compra)}` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        {c.por_entregar > 0 && (
                          <>
                            {(c.razon_social && !sinNombre) || (c.telefono && c.telefono !== c.nombre) || c.ultima_compra ? " · " : ""}
                            <Link href="/admin/despacho" className={estilos.deuda}>
                              {c.por_entregar === 1 ? "1 pedido por entregar" : `${c.por_entregar} pedidos por entregar`}
                            </Link>
                          </>
                        )}
                      </p>
                      <div className={estilos.carteraAcciones}>
                        <Link href={`/admin/ventas?cliente=${c.id}`}>Venta</Link>
                        <Link href={`/admin/clientes/${c.id}#abono`}>Abono</Link>
                        {whatsapp && (
                          <a href={whatsapp} target="_blank" rel="noopener" className={estilos.whatsapp}>
                            WhatsApp
                          </a>
                        )}
                        {mapa && (
                          <a href={mapa} target="_blank" rel="noopener">
                            Mapa
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>
    </>
  );
}
