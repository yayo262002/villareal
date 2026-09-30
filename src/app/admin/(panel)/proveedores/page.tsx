import Link from "next/link";
import { proveedoresConVencimiento } from "@/lib/vencimientos";
import { guardarProveedor } from "@/lib/acciones";
import { DIAS_DE_CREDITO_POR_DEFECTO, describirVencimiento, diasEntre } from "@/lib/credito";
import { fechaCorta, hoy, redondear, usd } from "@/lib/dinero";
import { enlaceWhatsappA } from "@/lib/whatsapp";
import { negocio } from "@/config/negocio";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../panel.module.css";

export const metadata = { title: "Proveedores" };

/**
 * A quién le compra el negocio y cuánto le debe. Es la cartera al revés:
 * cada compra suma a lo que se debe y cada pago que se le hace resta. Los
 * días de crédito son los que da el proveedor; pasados, la compra que
 * quede por pagar está vencida.
 */
export default async function PaginaProveedores({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const proveedores = await proveedoresConVencimiento();
  const debo = redondear(proveedores.reduce((s, p) => s + Math.max(0, p.saldo_usd), 0));
  const vencido = redondear(proveedores.reduce((s, p) => s + p.vencido_usd, 0));
  // Primero a quien más se le debe con plazo vencido; después el resto por nombre.
  const ordenados = [...proveedores].sort((a, b) => b.vencido_usd - a.vencido_usd || b.saldo_usd - a.saldo_usd);
  const fecha = hoy();

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 className={estilos.titulo}>Proveedores</h1>
      </div>
      <Avisos parametros={parametros} />

      <dl className={estilos.cifras}>
        <div className={estilos.cifra}>
          <dt>Proveedores</dt>
          <dd>{proveedores.length}</dd>
        </div>
        <div className={`${estilos.cifra} ${debo > 0 ? estilos["cifra--alerta"] : ""}`}>
          <dt>Les debo</dt>
          <dd>{usd(debo)}</dd>
        </div>
        {vencido > 0 && (
          <div className={`${estilos.cifra} ${estilos["cifra--alerta"]}`}>
            <dt>Vencido</dt>
            <dd>{usd(vencido)}</dd>
          </div>
        )}
      </dl>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Proveedor nuevo</h2>
        <p className={estilos.ayuda}>
          Quien te vende: el de los quesos, el de los huevos. Después, desde su ficha, anotas cada compra y cada
          pago que le haces, y aquí ves cuánto le debes y desde cuándo.
        </p>
        <form action={guardarProveedor} className="formulario">
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="nombre">Nombre o empresa</label>
              <input id="nombre" name="nombre" type="text" autoComplete="off" placeholder="Quesos del Tocuyo" />
            </div>
            <div className="campo">
              <label htmlFor="telefono">Teléfono</label>
              <input id="telefono" name="telefono" type="tel" inputMode="tel" autoComplete="off" placeholder="0412-1234567" />
            </div>
          </div>
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="dias_credito">Días de crédito que te da</label>
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
              <span className="ayuda">Pasados esos días desde la compra, lo que quede por pagar sale como vencido.</span>
            </div>
            <div className="campo">
              <label htmlFor="cedula_rif">Cédula o RIF</label>
              <input id="cedula_rif" name="cedula_rif" type="text" placeholder="J-12345678-9" />
            </div>
          </div>
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="direccion">Dirección</label>
              <input id="direccion" name="direccion" type="text" autoComplete="off" />
            </div>
            <div className="campo">
              <label htmlFor="nota">Nota</label>
              <input id="nota" name="nota" type="text" placeholder="Entrega los martes" />
            </div>
          </div>
          <div>
            <button type="submit" className="boton">
              Guardar proveedor
            </button>
          </div>
        </form>
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>A quién le debo</h2>
        {proveedores.length === 0 ? (
          <p className="vacio">Todavía no hay proveedores. Registra el primero arriba.</p>
        ) : (
          <ul className={estilos.cartera}>
            {ordenados.map((p) => {
              const whatsapp = enlaceWhatsappA(p.telefono, `Hola, le saluda ${negocio.nombre}.`);
              return (
                <li key={p.id} className={estilos.carteraCliente}>
                  <div className={estilos.carteraCabecera}>
                    <Link href={`/admin/proveedores/${p.id}`} className={estilos.carteraNombre}>
                      {p.nombre}
                    </Link>
                    <span className={p.saldo_usd > 0 ? estilos.deuda : estilos.saldado}>
                      {p.saldo_usd > 0 ? `Le debo ${usd(p.saldo_usd)}` : p.saldo_usd < 0 ? `A mi favor ${usd(-p.saldo_usd)}` : "Al día"}
                    </span>
                  </div>
                  <p className={estilos.carteraDato}>
                    {p.vencido_usd > 0 ? (
                      <span className={estilos.vencida}>
                        {describirVencimiento(p.mayor_atraso)}: {usd(p.vencido_usd)}
                      </span>
                    ) : p.proximo_vencimiento ? (
                      `${describirVencimiento(diasEntre(p.proximo_vencimiento, fecha))} · `
                    ) : (
                      ""
                    )}
                    {p.vencido_usd > 0 ? " · " : ""}
                    {p.dias_credito} días de crédito
                    {p.ultima_compra ? ` · última compra el ${fechaCorta(p.ultima_compra)}` : ""}
                  </p>
                  {(p.telefono || p.nota) && (
                    <p className={estilos.carteraDato}>
                      {[p.telefono, p.nota].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <div className={estilos.carteraAcciones}>
                    <Link href={`/admin/proveedores/${p.id}#compra`}>Compra</Link>
                    <Link href={`/admin/proveedores/${p.id}#pago`}>Pago</Link>
                    {whatsapp && (
                      <a href={whatsapp} target="_blank" rel="noopener" className={estilos.whatsapp}>
                        WhatsApp
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
