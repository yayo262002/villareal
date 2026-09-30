import Link from "next/link";
import { negocio } from "@/config/negocio";
import { clientesConVencimiento, type ClienteConVencimiento } from "@/lib/vencimientos";
import { DIAS_DE_CREDITO_POR_DEFECTO, describirVencimiento } from "@/lib/credito";
import { guardarCliente } from "@/lib/acciones";
import { enlaceAlMapa, planDeDespacho } from "@/lib/despacho";
import { explicarMotivo } from "@/lib/direcciones";
import { fechaCorta, redondear, usd } from "@/lib/dinero";
import { enlaceWhatsappA } from "@/lib/whatsapp";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Clientes" };

const CIUDAD = `${negocio.localidad}, ${negocio.estado}, Venezuela`;

const ORDENES = {
  nombre: "Por nombre",
  ruta: "Por ruta desde la tienda",
  deuda: "Los que más deben",
} as const;
type Orden = keyof typeof ORDENES;

/** Sin tildes ni mayúsculas, para que «jose» encuentre a «José». */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * La cartera de clientes. Arriba, el alta rápida: con el teléfono y la
 * dirección basta. Debajo, todos los clientes con su saldo, ordenados por
 * nombre, por la ruta de despacho o por lo que deben.
 */
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
  const clave = normalizar(busqueda);
  const filtrados = clave
    ? todos.filter((c) =>
        [c.nombre, c.telefono, c.cedula_rif, c.direccion, c.nota].some((campo) => normalizar(campo).includes(clave)),
      )
    : todos;

  // El orden de la ruta sirve también para saber quién no está ubicado.
  const plan = planDeDespacho({ direccion: negocio.direccion, ciudad: CIUDAD }, filtrados);
  const motivo = new Map(plan.sinUbicar.map((s) => [s.cliente.id, s.motivo]));
  let clientes: ClienteConVencimiento[];
  if (orden === "ruta") clientes = [...plan.ruta.paradas.map((p) => p.dato), ...plan.sinUbicar.map((s) => s.cliente)];
  // Los que más deben: primero lo vencido, después el saldo.
  else if (orden === "deuda") clientes = [...filtrados].sort((a, b) => b.vencido_usd - a.vencido_usd || b.saldo_usd - a.saldo_usd);
  else clientes = filtrados;

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
      {nuevo && (
        <p className={estilos.ayuda} style={{ marginBottom: 0 }}>
          <Link href={`/admin/clientes/${nuevo.id}`}>Abrir la ficha de {nuevo.nombre}</Link> para anotarle una venta o un
          abono.
        </p>
      )}

      <dl className={estilos.cifras}>
        <div className={estilos.cifra}>
          <dt>Clientes</dt>
          <dd>{todos.length}</dd>
        </div>
        <div className={`${estilos.cifra} ${porPagar > 0 ? estilos["cifra--alerta"] : ""}`}>
          <dt>Por pagar</dt>
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
          <div className="campo">
            <label htmlFor="nombre">Nombre o negocio (opcional)</label>
            <input id="nombre" name="nombre" type="text" autoComplete="off" />
          </div>
          <details className={estilos.masDatos}>
            <summary>Más datos</summary>
            <div className="formulario" style={{ marginTop: "var(--espacio-3)" }}>
              <div className="formulario__fila">
                <div className="campo">
                  <label htmlFor="cedula_rif">Cédula o RIF</label>
                  <input id="cedula_rif" name="cedula_rif" type="text" placeholder="V-12345678" />
                </div>
                <div className="campo">
                  <label htmlFor="tipo">Le vendes</label>
                  <select id="tipo" name="tipo" defaultValue="detal">
                    <option value="detal">Al detal</option>
                    <option value="mayor">Al mayor</option>
                  </select>
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
                placeholder="Buscar por nombre, teléfono o dirección"
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
                  const mapa = enlaceAlMapa(c.direccion, CIUDAD);
                  const sinUbicar = motivo.get(c.id);
                  return (
                    <li key={c.id} className={estilos.carteraCliente}>
                      <div className={estilos.carteraCabecera}>
                        <Link href={`/admin/clientes/${c.id}`} className={estilos.carteraNombre}>
                          {orden === "ruta" && !sinUbicar && <span className={estilos.carteraOrden}>{i + 1}</span>}
                          {c.nombre}
                        </Link>
                        <span className={c.vencido_usd > 0 ? estilos.vencida : c.saldo_usd > 0 ? estilos.deuda : estilos.saldado}>
                          {c.saldo_usd > 0 ? `Debe ${usd(c.saldo_usd)}` : c.saldo_usd < 0 ? `A favor ${usd(-c.saldo_usd)}` : "Al día"}
                        </span>
                      </div>
                      {c.vencido_usd > 0 && (
                        <p className={`${estilos.carteraDato} ${estilos.vencida}`}>
                          {describirVencimiento(c.mayor_atraso)}: {usd(c.vencido_usd)}
                        </p>
                      )}
                      <p className={estilos.carteraDato}>
                        {c.direccion || <span className="ayuda">Sin dirección</span>}
                        {sinUbicar && c.direccion && <span className="ayuda"> · Fuera de la ruta. {explicarMotivo(sinUbicar)}</span>}
                      </p>
                      <p className={estilos.carteraDato}>
                        {c.telefono && c.telefono !== c.nombre ? `${c.telefono} · ` : ""}
                        {c.tipo === "mayor" ? "Al mayor" : "Al detal"}
                        {c.ultima_compra ? ` · compró el ${fechaCorta(c.ultima_compra)}` : ""}
                        {c.por_entregar > 0 && (
                          <>
                            {" · "}
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
