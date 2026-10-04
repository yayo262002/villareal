import Link from "next/link";
import type { ReactNode } from "react";
import { NOMBRE_ESTADO, type EstadoCuenta } from "@/lib/cuentas";
import { describirVencimiento } from "@/lib/credito";
import { numeroDeNota, piezasDe } from "@/lib/entregas";
import { aBolivares, bs, cantidad, fechaCorta, usd } from "@/lib/dinero";
import { diasPendiente, type CuentaDelCliente, type NotaDelCliente } from "@/lib/cuenta-cliente";
import { CabeceraPublica, LineaTasa, PiePublico } from "@/components/publico";
import estilos from "./cuenta.module.css";

/**
 * Lo que comparten las páginas de la cuenta de un cliente: el marco con su
 * nombre y lo que debe, las pestañas (Resumen, Notas, Abonos, Movimientos)
 * y las piezas que se repiten: la etiqueta de estado de una nota, la barra
 * de lo pagado y la tarjeta de cada nota.
 */

export type Pestana = "resumen" | "notas" | "abonos" | "movimientos";

export function Pestanas({ enlace, actual, cuenta }: { enlace: string; actual: Pestana; cuenta: CuentaDelCliente }) {
  const pestanas: [Pestana, string, string][] = [
    ["resumen", "Resumen", `/cuenta/${enlace}`],
    ["notas", `Notas (${cuenta.notas.length})`, `/cuenta/${enlace}/notas`],
    ["abonos", `Abonos (${cuenta.pagos.length})`, `/cuenta/${enlace}/abonos`],
    ["movimientos", "Movimientos", `/cuenta/${enlace}/movimientos`],
  ];
  return (
    <nav className={estilos.pestanas} aria-label="Partes de la cuenta">
      {pestanas.map(([nombre, etiqueta, ruta]) => (
        <Link key={nombre} href={ruta} className={`${estilos.pestana} ${nombre === actual ? estilos.pestanaActiva : ""}`} aria-current={nombre === actual ? "page" : undefined}>
          {etiqueta}
        </Link>
      ))}
    </nav>
  );
}

/** La tarjeta verde con lo que debe (o «Estás al día»). */
export function TarjetaDeSaldo({ cuenta }: { cuenta: CuentaDelCliente }) {
  const { cliente, tasa, pendientes, fecha } = cuenta;
  const saldoBs = cliente.saldo_usd > 0 ? aBolivares(cliente.saldo_usd, tasa?.valor ?? null) : null;
  const vencidas = pendientes.filter((n) => n.vencida).length;
  return (
    <div className={`${estilos.saldo} ${cliente.saldo_usd > 0 ? "" : estilos.saldoAlDia}`}>
      {cliente.saldo_usd > 0 ? (
        <>
          <span className={estilos.saldoRotulo}>Tienes pendiente</span>
          <strong className={estilos.saldoCifra}>{usd(cliente.saldo_usd)}</strong>
          {saldoBs !== null && tasa && <span className={estilos.saldoBs}>{bs(saldoBs)} a la tasa de hoy</span>}
          <span className={estilos.saldoBs}>
            {pendientes.length === 1 ? "1 nota por pagar" : `${pendientes.length} notas por pagar`}
            {vencidas > 0 ? ` · ${vencidas === 1 ? "1 vencida" : `${vencidas} vencidas`}` : ""}
            {pendientes.length > 0 ? ` · la más antigua ${diasPendiente(pendientes[0].fecha, fecha).toLowerCase()}` : ""}
          </span>
        </>
      ) : cliente.saldo_usd < 0 ? (
        <>
          <span className={estilos.saldoRotulo}>Tienes a favor</span>
          <strong className={estilos.saldoCifra}>{usd(-cliente.saldo_usd)}</strong>
        </>
      ) : (
        <>
          <span className={estilos.saldoRotulo}>Estás al día</span>
          <strong className={estilos.saldoCifra}>Nada pendiente</strong>
        </>
      )}
    </div>
  );
}

/** El marco de todas las páginas de la cuenta: cabecera, nombre, saldo, pestañas, y abajo el pie. */
export function MarcoDeCuenta({ enlace, actual, cuenta, children }: { enlace: string; actual: Pestana; cuenta: CuentaDelCliente; children: ReactNode }) {
  return (
    <>
      <CabeceraPublica />
      <main id="contenido" className={estilos.contenido}>
        <section className={estilos.seccion}>
          <p className={estilos.antetitulo}>Cuenta de</p>
          <h1 className={estilos.titulo}>{cuenta.cliente.rotulo}</h1>
          <p className={estilos.fecha}>Al {fechaCorta(cuenta.fecha)}</p>
          <TarjetaDeSaldo cuenta={cuenta} />
          <LineaTasa tasa={cuenta.tasa} className={estilos.tasa} />
          <Pestanas enlace={enlace} actual={actual} cuenta={cuenta} />
          {children}
          <p className={estilos.pie}>
            Este enlace es solo tuyo: con él ves tu cuenta sin clave. No lo compartas. Si algo no te cuadra, escríbenos por WhatsApp y lo revisamos.
          </p>
        </section>
      </main>
      <PiePublico />
    </>
  );
}

export function EstadoDeNota({ estado }: { estado: EstadoCuenta }) {
  const clase = estado === "pagada" ? estilos.estadoPagada : estado === "parcial" ? estilos.estadoParcial : estilos.estadoPorPagar;
  return <span className={`${estilos.estado} ${clase}`}>{NOMBRE_ESTADO[estado]}</span>;
}

/** Cuánto de la nota está pagado, como barra. */
export function BarraDePago({ nota }: { nota: NotaDelCliente }) {
  const total = Number(nota.total_usd);
  const parte = total > 0 ? Math.round((nota.pagado_usd / total) * 100) : 100;
  return (
    <span className={estilos.barra} role="img" aria-label={`Pagado el ${parte} %`}>
      <span className={estilos.barraRelleno} style={{ width: `${Math.min(100, parte)}%` }} />
    </span>
  );
}

/** Las líneas de una nota: «5 kg (2 pzas) Queso mozzarella × USD 7,70 = USD 38,50». */
export function LineasDeNota({ nota }: { nota: NotaDelCliente }) {
  if (nota.lineas.length === 0) return null;
  return (
    <ul className={estilos.notaLineas}>
      {nota.lineas.map((l) => (
        <li key={l.id}>{`${cantidad(l.cantidad, l.unidad)}${piezasDe(l)} ${l.producto_nombre} × ${usd(l.precio_unitario_usd)} = ${usd(l.subtotal_usd)}`}</li>
      ))}
    </ul>
  );
}

/** El plazo de una nota: cuánto lleva pendiente y cuándo vence (o desde cuándo venció). */
export function PlazoDeNota({ nota, fecha }: { nota: NotaDelCliente; fecha: string }) {
  if (nota.pendiente_usd <= 0) return <p className={estilos.plazo}>Pagada</p>;
  return (
    <p className={nota.vencida ? estilos.vencida : estilos.plazo}>
      {`${diasPendiente(nota.fecha, fecha)}${nota.vence ? ` · ${describirVencimiento(nota.atraso)}${nota.vencida ? "" : ` (${fechaCorta(nota.vence)})`}` : ""}`}
    </p>
  );
}

/** Una nota en la lista: número, fecha, estado, lo que llevaba, lo pagado y lo que queda, y el enlace a verla entera. */
export function TarjetaDeNota({ enlace, nota, fecha }: { enlace: string; nota: NotaDelCliente; fecha: string }) {
  const total = Number(nota.total_usd);
  return (
    <li className={estilos.nota}>
      <div className={estilos.notaCabecera}>
        <strong>Nota {numeroDeNota(nota.id)}</strong>
        <span>{fechaCorta(nota.fecha)}</span>
        <EstadoDeNota estado={nota.estado} />
      </div>
      <LineasDeNota nota={nota} />
      <p className={estilos.notaImporte}>
        {nota.pendiente_usd > 0 && nota.pagado_usd > 0 ? `${usd(total)} · abonado ${usd(nota.pagado_usd)} · quedan ` : nota.pendiente_usd > 0 ? "" : `${usd(total)} · `}
        <strong>{nota.pendiente_usd > 0 ? usd(nota.pendiente_usd) : "pagada"}</strong>
      </p>
      <BarraDePago nota={nota} />
      <PlazoDeNota nota={nota} fecha={fecha} />
      <Link href={`/cuenta/${enlace}/nota/${nota.id}`} className={estilos.enlaceTarjeta}>
        Ver la nota completa →
      </Link>
    </li>
  );
}
