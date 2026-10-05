import Link from "next/link";
import { notFound } from "next/navigation";
import { listarFamiliasConCuentas } from "@/lib/familias";
import { borrarFamilia } from "@/lib/acciones";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../../../panel.module.css";

export const metadata = { title: "Eliminar familia" };

/**
 * La confirmación antes de borrar una familia. Si es la principal de algún
 * producto, avisa y pide a qué familia pasan; los que solo salían en ella
 * dejan de salir, o salen en la elegida.
 */
export default async function PaginaEliminarFamilia({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ParametrosAviso> }) {
  const { id } = await params;
  const parametros = await searchParams;
  const familias = await listarFamiliasConCuentas();
  const familia = familias.find((f) => f.id === Number(id));
  if (!familia) notFound();
  const otras = familias.filter((f) => f.id !== familia.id);

  return (
    <>
      <div>
        <p>
          <Link href="/admin/familias">← Familias</Link>
        </p>
        <h1 className={estilos.titulo}>¿Eliminar la familia «{familia.nombre}»?</h1>
      </div>
      <Avisos parametros={parametros} />

      <section className="tarjeta">
        {familia.principales > 0 ? (
          <p className="aviso aviso--aviso">
            Es la familia principal de {familia.principales} {familia.principales === 1 ? "producto" : "productos"}. Antes de borrarla, elige a qué familia
            {familia.principales === 1 ? " pasa" : " pasan"}.
          </p>
        ) : (
          <p>No es la familia principal de ningún producto.</p>
        )}
        {familia.relacionados > 0 && (
          <p className={estilos.ayuda}>
            {familia.relacionados} {familia.relacionados === 1 ? "producto sale" : "productos salen"} también en ella: si eliges una familia, salen en esa; si
            no, dejan de salir aquí y siguen en la suya.
          </p>
        )}
        <form action={borrarFamilia} className="formulario" style={{ marginTop: "var(--espacio-4)" }}>
          <input type="hidden" name="id" value={familia.id} />
          <div className="campo">
            <label htmlFor="pasar-a">Pasar sus productos a</label>
            <select id="pasar-a" name="pasar_a" required={familia.principales > 0} defaultValue="">
              <option value="">{familia.principales > 0 ? "Elige una familia" : "A ninguna"}</option>
              {otras.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </div>
          <p className={estilos.ayuda}>
            <strong>No tiene vuelta atrás.</strong> Los productos no se borran.
          </p>
          <div className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
            <button type="submit" className="boton boton--peligro">
              Sí, eliminar la familia
            </button>
            <Link href="/admin/familias" className="boton boton--secundario">
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </>
  );
}
