import Link from "next/link";
import { listarFamilias } from "@/lib/familias";
import { leerTasa } from "@/lib/ajustes";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { FormularioProducto } from "@/components/formulario-producto";
import estilos from "../../panel.module.css";

export const metadata = { title: "Agregar producto" };

/** «Agregar producto»: el formulario completo, con su familia, sus otras categorías y, si hace falta, una familia nueva. */
export default async function PaginaNuevoProducto({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const [familias, tasa] = await Promise.all([listarFamilias(), leerTasa()]);
  return (
    <>
      <div>
        <p>
          <Link href="/admin/productos">← Productos</Link>
        </p>
        <h1 className={estilos.titulo}>Agregar producto</h1>
      </div>
      <Avisos parametros={parametros} />
      <section className="tarjeta">
        <p className={estilos.ayuda}>
          Si todavía no sabes el precio o no lo tienes en la tienda, guárdalo como <strong>borrador</strong>: no sale en la web hasta que lo actives.
        </p>
        <FormularioProducto producto={null} categorias={[]} familias={familias} parametros={parametros} tasa={tasa?.valor ?? null} conMarcas={false} existencia={null} />
      </section>
    </>
  );
}
