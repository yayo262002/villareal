import Link from "next/link";
import { notFound } from "next/navigation";
import { datosDelAdjuntoDeProveedor } from "@/lib/adjuntos";
import { buscarProveedor } from "@/lib/proveedores";
import { fechaCorta, fechaDeLaBase, horaDeLaBase } from "@/lib/dinero";
import estilos from "../../../panel.module.css";

type Parametros = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Parametros) {
  const { id } = await params;
  const adjunto = await datosDelAdjuntoDeProveedor(Number(id));
  return { title: adjunto?.descripcion || "Captura" };
}

/** La captura de un pago a un proveedor, vista entera, con su fecha y la vuelta a la ficha. */
export default async function PaginaAdjuntoDeProveedor({ params, searchParams }: Parametros) {
  const { id } = await params;
  const parametros = await searchParams;
  const numero = Number(id);
  const adjunto = Number.isSafeInteger(numero) && numero > 0 ? await datosDelAdjuntoDeProveedor(numero) : null;
  if (!adjunto) notFound();
  const proveedor = await buscarProveedor(adjunto.proveedor_id);
  if (!proveedor) notFound();
  const volver = typeof parametros.volver_a === "string" && parametros.volver_a.startsWith("/admin") ? parametros.volver_a : `/admin/proveedores/${proveedor.id}`;
  const archivo = `/admin/adjuntos-proveedor/${adjunto.id}`;

  return (
    <>
      <div>
        <p>
          <Link href={volver}>← Volver</Link>
        </p>
        <h1 className={estilos.titulo}>{adjunto.descripcion || "Captura"}</h1>
      </div>
      <section className="tarjeta">
        <p className={estilos.ayuda}>
          De <Link href={`/admin/proveedores/${proveedor.id}`}>{proveedor.nombre}</Link> · guardada el {fechaCorta(fechaDeLaBase(adjunto.creado_en))} a las{" "}
          {horaDeLaBase(adjunto.creado_en)}
        </p>
        {adjunto.tipo === "application/pdf" ? (
          <p>
            <a href={archivo} target="_blank" rel="noopener" className="boton boton--secundario">
              Abrir el PDF
            </a>
          </p>
        ) : (
          <a href={archivo} target="_blank" rel="noopener" title="Abrir la captura sola, para ampliarla">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={archivo} alt={adjunto.descripcion || "Captura"} className={estilos.adjuntoEntero} />
          </a>
        )}
        <div className={estilos.accionesFila} style={{ flexWrap: "wrap", marginTop: "var(--espacio-3)" }}>
          <Link href={volver} className="boton boton--secundario">
            ← Volver
          </Link>
          <a href={archivo} target="_blank" rel="noopener" className="boton boton--secundario">
            Abrir la captura sola
          </a>
        </div>
      </section>
    </>
  );
}
