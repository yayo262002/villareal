import type { ReactNode } from "react";
import { negocio, whatsappLegible } from "@/config/negocio";
import { esSoloUnTelefono } from "@/lib/whatsapp";
import estilos from "./panel.module.css";

/**
 * La cabecera de los papeles que salen del panel (la nota de entrega, el
 * estado de cuenta): a la izquierda quién lo emite y a la derecha qué papel
 * es, su número si lo tiene y su fecha.
 */
export function Membrete({ titulo, numero, fecha }: { titulo: string; numero?: ReactNode; fecha: string }) {
  return (
    <header className={estilos.notaCabecera}>
      <div className={estilos.notaEmisor}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/marca/leon.svg" alt="" width={38} height={60} />
        <div>
          <strong>{negocio.razonSocial || negocio.nombre}</strong>
          {negocio.rif && <span>RIF {negocio.rif}</span>}
          <span>
            {negocio.direccion}, {negocio.ciudad}
          </span>
          {negocio.whatsapp && <span>Teléfono {whatsappLegible()}</span>}
        </div>
      </div>
      <div className={estilos.notaNumero}>
        <span>{titulo}</span>
        {numero && <strong>{numero}</strong>}
        <span>{fecha}</span>
      </div>
    </header>
  );
}

/** Los datos del cliente, como van en la nota y en el estado de cuenta. */
export function DatosDelCliente({
  cliente,
}: {
  cliente: { nombre: string; telefono: string; cedula_rif: string; direccion: string };
}) {
  // Quien se registró solo con el teléfono lo lleva como nombre: no se repite.
  const sinNombre = esSoloUnTelefono(cliente.nombre);
  return (
    <dl className={estilos.notaCliente}>
      <div>
        <dt>Cliente</dt>
        <dd>{sinNombre ? "Sin nombre registrado" : cliente.nombre}</dd>
      </div>
      {cliente.telefono && (
        <div>
          <dt>Teléfono</dt>
          <dd>{cliente.telefono}</dd>
        </div>
      )}
      {cliente.cedula_rif && (
        <div>
          <dt>Cédula o RIF</dt>
          <dd>{cliente.cedula_rif}</dd>
        </div>
      )}
      {cliente.direccion && (
        <div>
          <dt>Dirección</dt>
          <dd>{cliente.direccion}</dd>
        </div>
      )}
    </dl>
  );
}
