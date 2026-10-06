import Link from "next/link";
import { direccionDeFotoDeProducto, listarProductos, type Producto } from "@/lib/productos";
import { agruparPorProducto, direccionDeFotoDeVariante, fotoDeAlgunaVariante, listarVariantes, type Variante } from "@/lib/variantes";
import { direccionDePortada, listarFamilias, type Familia } from "@/lib/familias";
import { imagenDeProducto } from "@/lib/fotos-referenciales";
import { NOMBRE_ESTADO_PRODUCTO, estadoDeProducto } from "@/lib/catalogo";
import { LADO_DE_LA_FOTO } from "@/lib/foto-producto";
import {
  cambiarFotoDeProducto,
  cambiarFotoDeVariante,
  cambiarPortadaDeFamilia,
  retirarFotoDeProducto,
  retirarFotoDeVariante,
  retirarPortadaDeFamilia,
} from "@/lib/acciones";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { EntradaFoto } from "@/components/entrada-foto";
import { FotoDeProducto } from "@/components/foto-de-producto";
import estilos from "../panel.module.css";

export const metadata = { title: "Fotos" };

const AQUI = "/admin/fotos";

/** Qué foto enseña la web de un tipo y de dónde sale. */
function origenDe(producto: Producto, suyas: Variante[]): { propia: boolean; texto: string } {
  if (producto.foto_version) return { propia: true, texto: "Tu foto" };
  const deMarca = suyas.find((v) => v.activo === 1 && v.foto_version);
  if (deMarca) return { propia: false, texto: `La de su marca ${deMarca.marca || deMarca.nombre}` };
  const imagen = imagenDeProducto(null, producto.nombre);
  return { propia: false, texto: imagen ? "Foto de referencia: no es tu mercancía" : "Sin foto" };
}

/**
 * Todas las fotos de la web en una sola pantalla, para cambiar las que no
 * gusten: la de cada tipo de producto (la suya, la de su marca o la de
 * referencia, dicho), la de cada marca y la portada de cada familia. Cada
 * una con su «Cambiar» y, si es del dueño, su «Quitar». Lo que se sube se
 * guarda como todas: centrado, sobre blanco y de 800 × 800; una foto sin
 * fondo queda sobre blanco. Las portadas, en 4:3.
 */
export default async function PaginaFotos({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const [productos, variantes, familias] = await Promise.all([listarProductos(), listarVariantes(), listarFamilias()]);
  const variantesDe = agruparPorProducto(variantes);
  const familiaDe = new Map(familias.map((f) => [f.id, f]));
  // Primero lo que se ve en la web; los borradores y lo oculto, después. Dentro, por familia y por nombre.
  const ordenados = [...productos].sort(
    (a, b) =>
      Number(estadoDeProducto(b) === "activo") - Number(estadoDeProducto(a) === "activo") ||
      (familiaDe.get(a.familia_id ?? -1)?.orden ?? 999) - (familiaDe.get(b.familia_id ?? -1)?.orden ?? 999) ||
      a.nombre.localeCompare(b.nombre, "es"),
  );

  return (
    <>
      <div>
        <p>
          <Link href="/admin/productos">← Productos</Link>
        </p>
        <h1 className={estilos.titulo}>Fotos</h1>
        <p className={estilos.ayuda}>
          Aquí están todas las fotos que enseña la web, para cambiar las que no te gusten. Sube la foto como la tengas: se guarda sola centrada,
          sobre blanco y del mismo tamaño que todas ({LADO_DE_LA_FOTO} × {LADO_DE_LA_FOTO}). Si tu app le quita el fondo, mejor: queda sobre blanco;
          si no, basta con que el fondo sea liso y claro. Conviene el paquete entero, de frente, y que ocupe casi toda la foto.
        </p>
      </div>
      <Avisos parametros={parametros} />

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Tipos de producto y sus marcas</h2>
        <ul className={estilos.galeria}>
          {ordenados.map((p) => {
            const suyas = variantesDe.get(p.id) ?? [];
            const origen = origenDe(p, suyas);
            const imagen = imagenDeProducto(direccionDeFotoDeProducto(p), p.nombre, fotoDeAlgunaVariante(suyas));
            const estado = estadoDeProducto(p);
            return (
              <li key={p.id} id={`producto-${p.id}`} className={estilos.galeriaFicha}>
                <div className={estilos.galeriaCabecera}>
                  <FotoDeProducto imagen={imagen} nombre={p.nombre} className={estilos.galeriaFoto} tamano={160} />
                  <div>
                    <h3 className={estilos.subtituloPequeno}>
                      <Link href={`/admin/productos/${p.id}`}>{p.nombre}</Link>
                    </h3>
                    <p className={estilos.carteraDato}>
                      {familiaDe.get(p.familia_id ?? -1)?.nombre ?? "Sin familia"}
                      {estado !== "activo" ? ` · ${NOMBRE_ESTADO_PRODUCTO[estado]}` : ""}
                    </p>
                    <p className={`${estilos.carteraDato} ${origen.propia ? "" : estilos.vencida}`}>{origen.texto}</p>
                  </div>
                </div>
                <form action={cambiarFotoDeProducto} className={estilos.galeriaFormulario} encType="multipart/form-data">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="volver_a" value={`${AQUI}#producto-${p.id}`} />
                  <label htmlFor={`foto-producto-${p.id}`} className="visualmente-oculto">
                    Foto de {p.nombre}
                  </label>
                  <EntradaFoto nombre="foto" id={`foto-producto-${p.id}`} soloFoto ladoMaximo={1200} />
                  <button type="submit" className={`boton ${estilos.botonPequeno}`}>
                    {origen.propia ? "Cambiar la foto" : "Poner tu foto"}
                  </button>
                </form>
                {origen.propia && (
                  <form action={retirarFotoDeProducto}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="volver_a" value={`${AQUI}#producto-${p.id}`} />
                    <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                      Quitar la foto
                    </button>
                  </form>
                )}
                {suyas.length > 0 && (
                  <ul className={estilos.galeriaMarcas}>
                    {suyas.map((v) => {
                      const foto = direccionDeFotoDeVariante(v);
                      return (
                        <li key={v.id} id={`marca-${v.id}`} className={estilos.galeriaMarca}>
                          <FotoDeProducto imagen={foto ? { src: foto, referencial: false } : null} nombre={v.nombre} className={estilos.galeriaFotoPequena} tamano={96} />
                          <div className={estilos.galeriaMarcaTexto}>
                            <strong>{v.nombre}</strong>
                            <span className={`ayuda ${foto ? "" : estilos.vencida}`}> · {foto ? "tu foto" : "sin foto"}{v.activo ? "" : " · oculta"}</span>
                            <form action={cambiarFotoDeVariante} className={estilos.galeriaFormulario} encType="multipart/form-data">
                              <input type="hidden" name="variante_id" value={v.id} />
                              <input type="hidden" name="volver_a" value={`${AQUI}#marca-${v.id}`} />
                              <label htmlFor={`foto-marca-${v.id}`} className="visualmente-oculto">
                                Foto de {v.nombre}
                              </label>
                              <EntradaFoto nombre="foto" id={`foto-marca-${v.id}`} soloFoto ladoMaximo={1200} />
                              <button type="submit" className={`boton ${estilos.botonPequeno}`}>
                                {foto ? "Cambiar" : "Poner foto"}
                              </button>
                            </form>
                            {foto && (
                              <form action={retirarFotoDeVariante}>
                                <input type="hidden" name="variante_id" value={v.id} />
                                <input type="hidden" name="volver_a" value={`${AQUI}#marca-${v.id}`} />
                                <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                                  Quitar
                                </button>
                              </form>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Portadas de las familias y colecciones</h2>
        <p className={estilos.ayuda}>Una foto de comida, apaisada: se recorta en 4:3 y la web le pone su velo verde con el nombre encima.</p>
        <ul className={estilos.galeria}>
          {familias.map((f: Familia) => {
            const portada = direccionDePortada(f);
            return (
              <li key={f.id} id={`familia-${f.id}`} className={estilos.galeriaFicha}>
                <div className={estilos.galeriaCabecera}>
                  {portada ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={portada} alt="" width={160} height={120} className={estilos.galeriaPortada} />
                  ) : (
                    <span className={`${estilos.galeriaPortada} ${estilos.galeriaSinPortada}`} aria-hidden="true" />
                  )}
                  <div>
                    <h3 className={estilos.subtituloPequeno}>{f.nombre}</h3>
                    <p className={`${estilos.carteraDato} ${f.foto_version ? "" : estilos.vencida}`}>
                      {f.foto_version ? "Tu portada" : portada ? "Foto de referencia: no es tu mercancía" : "Sin portada: lleva su icono"}
                      {f.activa ? "" : " · escondida"}
                    </p>
                  </div>
                </div>
                <form action={cambiarPortadaDeFamilia} className={estilos.galeriaFormulario} encType="multipart/form-data">
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="volver_a" value={`${AQUI}#familia-${f.id}`} />
                  <label htmlFor={`portada-${f.id}`} className="visualmente-oculto">
                    Portada de {f.nombre}
                  </label>
                  <EntradaFoto nombre="portada" id={`portada-${f.id}`} soloFoto ladoMaximo={1400} />
                  <button type="submit" className={`boton ${estilos.botonPequeno}`}>
                    {f.foto_version ? "Cambiar la portada" : "Poner tu portada"}
                  </button>
                </form>
                {f.foto_version && (
                  <form action={retirarPortadaDeFamilia}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="volver_a" value={`${AQUI}#familia-${f.id}`} />
                    <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                      Quitar la portada
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
