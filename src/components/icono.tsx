import { ICONOS, esIcono } from "@/lib/iconos";

/** Un icono de `iconos.ts`, del color del texto. Sin título es decorativo y los lectores de pantalla lo saltan. */
export function Icono({ nombre, className, titulo }: { nombre: string; className?: string; titulo?: string }) {
  const icono = ICONOS[esIcono(nombre) ? nombre : "otros"];
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      dangerouslySetInnerHTML={{ __html: icono.trazo }}
    />
  );
}
