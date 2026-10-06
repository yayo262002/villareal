import Link from "next/link";
import { listarFamilias } from "@/lib/familias";
import { leerTasa } from "@/lib/ajustes";
import { categoriasDeProducto, listarProductos } from "@/lib/productos";
import { variantesDeProducto } from "@/lib/variantes";
import { listarMarcas, presentacionesUsadas } from "@/lib/marcas";
import { presentacionYContenido } from "@/lib/marcas-texto";
import { NOMBRE_ESTADO_PRODUCTO, estadoDeProducto } from "@/lib/catalogo";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { FormularioProducto } from "@/components/formulario-producto";
import estilos from "../../panel.module.css";

export const metadata = { title: "Agregar producto" };

function primero(valor: string | string[] | undefined): string {
  return typeof valor === "string" ? valor : Array.isArray(valor) ? (valor[0] ?? "") : "";
}

/**
 * «Agregar producto», en el orden en que se piensa el catálogo: FAMILIA →
 * TIPO DE PRODUCTO → MARCA → PRESENTACIÓN → PRECIO, en un solo formulario.
 * Arriba se elige el tipo (Mozzarella, Suero…), agrupado por familias, o
 * «nuevo». Si es uno que ya está, lo escrito es el artículo que se le
 * añade: su marca (de la lista o una nueva), su presentación, su precio, su
 * foto y los negocios en que sale. Si es nuevo, es el tipo entero, con
 * «Crear nueva familia» dentro. Nada de esto toca el código. Con
 * `?tipo=<número>` llega con ese tipo elegido y sus categorías marcadas.
 */
export default async function PaginaNuevoProducto({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const tipo = primero(parametros.tipo);
  const [familias, tasa, productos, marcas, presentaciones] = await Promise.all([
    listarFamilias(),
    leerTasa(),
    listarProductos(),
    listarMarcas(),
    presentacionesUsadas(),
  ]);
  const existente = /^\d+$/.test(tipo) ? (productos.find((p) => p.id === Number(tipo)) ?? null) : null;
  const [variantes, categorias] = existente ? await Promise.all([variantesDeProducto(existente.id), categoriasDeProducto(existente.id)]) : [[], []];
  const familia = existente ? familias.find((f) => f.id === existente.familia_id) : undefined;
  const sinSeparar = existente !== null && variantes.length === 0 && (existente.precio_usd !== null || existente.marca_id !== null || Boolean(existente.presentacion || existente.contenido));

  return (
    <>
      <div>
        <p>
          <Link href="/admin/productos">← Productos</Link>
        </p>
        <h1 className={estilos.titulo}>Agregar producto</h1>
        <p className={estilos.ayuda}>
          El catálogo va así: familia (Quesos) → tipo de producto (Mozzarella) → marca (Guaralact) → presentación (bloque de 1 kg) → precio. Elige
          el tipo; si ya está, solo le añades la marca, la presentación y el precio; si no está, créalo aquí mismo. Lo que no exista (una familia,
          una marca, una presentación) se crea desde este formulario.
        </p>
      </div>
      <Avisos parametros={parametros} />
      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>{existente ? `Agregar a ${existente.nombre}` : "¿Qué vas a agregar?"}</h2>
        {existente && (
          <p className={estilos.ayuda}>
            {familia ? `Familia: ${familia.nombre}. ` : ""}
            {variantes.length === 0 ? "Todavía no tiene marcas ni presentaciones." : `Ya tiene: ${variantes.map((v) => v.nombre).join(" · ")}.`}{" "}
            {NOMBRE_ESTADO_PRODUCTO[estadoDeProducto(existente)]}.
          </p>
        )}
        {sinSeparar && existente && (
          <p className="aviso aviso--aviso">
            Hoy {existente.nombre} se vende sin separar marcas
            {[existente.marca, presentacionYContenido(existente)].filter(Boolean).length > 0
              ? ` (${[existente.marca, presentacionYContenido(existente)].filter(Boolean).join(", ")})`
              : ""}
            . Al guardar, eso pasa también a la lista como un artículo más, con su precio y su foto: no se pierde.
          </p>
        )}
        <FormularioProducto
          producto={null}
          categorias={categorias}
          familias={familias}
          parametros={parametros}
          tasa={tasa?.valor ?? null}
          conMarcas={false}
          existencia={null}
          listas={{ marcas, presentaciones }}
          agregar={{ productos, tipo: existente ? String(existente.id) : "nuevo" }}
        />
      </section>
    </>
  );
}
