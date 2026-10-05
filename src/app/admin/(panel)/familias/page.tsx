import Link from "next/link";
import { direccionDePortada, listarFamiliasConCuentas, type Familia } from "@/lib/familias";
import { ICONOS } from "@/lib/iconos";
import { alternarFamilia, editarFamilia, guardarFamilia, retirarPortadaDeFamilia } from "@/lib/acciones";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { EntradaFoto } from "@/components/entrada-foto";
import { Icono } from "@/components/icono";
import estilos from "../panel.module.css";

export const metadata = { title: "Familias" };

/** Los campos de una familia: nombre, descripción, icono, orden, si sale en la web y su portada. */
function CamposFamilia({ id, familia }: { id: string; familia: Familia | null }) {
  return (
    <>
      <div className="formulario__fila">
        <div className="campo">
          <label htmlFor={`${id}-nombre`}>Nombre</label>
          <input id={`${id}-nombre`} name="nombre" type="text" required defaultValue={familia?.nombre ?? ""} placeholder="Panadería" />
        </div>
        <div className="campo">
          <label htmlFor={`${id}-icono`}>Icono</label>
          <select id={`${id}-icono`} name="icono" defaultValue={familia?.icono || "otros"}>
            {Object.entries(ICONOS).map(([clave, icono]) => (
              <option key={clave} value={clave}>
                {icono.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="campo">
        <label htmlFor={`${id}-descripcion`}>Descripción (se ve en su página)</label>
        <input id={`${id}-descripcion`} name="descripcion" type="text" defaultValue={familia?.descripcion ?? ""} />
      </div>
      <div className="formulario__fila">
        <div className="campo">
          <label htmlFor={`${id}-orden`}>Orden de aparición</label>
          <input id={`${id}-orden`} name="orden" type="number" inputMode="numeric" min="0" step="1" defaultValue={familia?.orden ?? ""} placeholder="La última" />
          <span className="ayuda">1 sale primero.</span>
        </div>
        <div className="campo">
          <label htmlFor={`${id}-portada`}>{familia?.foto_version ? "Cambiar la portada" : "Imagen de portada (opcional)"}</label>
          <EntradaFoto nombre="portada" id={`${id}-portada`} opcional soloFoto ladoMaximo={1400} />
        </div>
      </div>
      <label className={estilos.casilla}>
        <input type="checkbox" name="activa" value="1" defaultChecked={familia ? familia.activa === 1 : true} />
        <span>Activa: sale en la web</span>
      </label>
    </>
  );
}

/**
 * Las familias del catálogo: cuántos productos tiene cada una (los suyos,
 * los que también salen en ella y los que se ven en la web), su orden, su
 * icono y su portada. Desde aquí se crean, se editan, se esconden y se
 * borran; al borrar una con productos, se elige antes a qué familia pasan.
 */
export default async function PaginaFamilias({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const familias = await listarFamiliasConCuentas();

  return (
    <>
      <div>
        <p>
          <Link href="/admin/productos">← Productos</Link>
        </p>
        <h1 className={estilos.titulo}>Familias y categorías</h1>
      </div>
      <Avisos parametros={parametros} />
      <p className={estilos.ayuda}>
        Cada producto tiene una familia principal y puede salir también en otras (la tocineta es de Embutidos y sale en Burger y en Pizzería) sin
        repetirse. En la web, cada familia activa con productos publicados tiene su tarjeta y su página.
      </p>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Familias ({familias.length})</h2>
        <ul className={estilos.cartera}>
          {familias.map((f) => {
            const portada = direccionDePortada(f);
            return (
              <li key={f.id} className={`${estilos.carteraCliente} ${f.activa ? "" : estilos.tarjetaApagada}`}>
                <div className={estilos.encabezado}>
                  <span className={estilos.varianteTitulo}>
                    {portada ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={portada} alt="" width={56} height={42} className={estilos.portadaFamilia} />
                    ) : (
                      <Icono nombre={f.icono} className={estilos.iconoFamilia} />
                    )}
                    <strong>
                      {f.orden}. {f.nombre}
                    </strong>
                  </span>
                  <span className={`${estilos.estado} ${f.activa ? estilos["estado--pagada"] : estilos["estado--por_pagar"]}`}>{f.activa ? "En la web" : "Escondida"}</span>
                </div>
                <p className={estilos.carteraDato}>
                  {f.principales} {f.principales === 1 ? "producto suyo" : "productos suyos"} · {f.relacionados} que también salen en ella · {f.publicados} en la web
                </p>
                <div className={estilos.carteraAcciones}>
                  <Link href={`/admin/productos?familia=${f.id}#lista`}>Sus productos</Link>
                  {f.activa ? (
                    <a href={`/categoria/${f.slug}`} target="_blank" rel="noopener">
                      Ver en la web
                    </a>
                  ) : null}
                  <form action={alternarFamilia}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="activa" value={f.activa ? "0" : "1"} />
                    <button type="submit" className={estilos.botonEnlace}>
                      {f.activa ? "Esconder" : "Activar"}
                    </button>
                  </form>
                  <Link href={`/admin/familias/${f.id}/eliminar`} className="enlace-fila">
                    Eliminar
                  </Link>
                </div>
                <details className={estilos.masDatos}>
                  <summary>Editar</summary>
                  <form action={editarFamilia} className="formulario" encType="multipart/form-data" style={{ marginTop: "var(--espacio-3)" }}>
                    <input type="hidden" name="id" value={f.id} />
                    <CamposFamilia id={`familia-${f.id}`} familia={f} />
                    <div>
                      <button type="submit" className="boton">
                        Guardar {f.nombre}
                      </button>
                    </div>
                  </form>
                  {f.foto_version && (
                    <form action={retirarPortadaDeFamilia} style={{ marginTop: "var(--espacio-3)" }}>
                      <input type="hidden" name="id" value={f.id} />
                      <button type="submit" className={`boton boton--secundario ${estilos.botonPequeno}`}>
                        Quitar la portada
                      </button>
                    </form>
                  )}
                </details>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="tarjeta" id="nueva">
        <h2 className={estilos.subtitulo}>Nueva familia</h2>
        <form action={guardarFamilia} className="formulario" encType="multipart/form-data">
          <CamposFamilia id="familia-nueva" familia={null} />
          <div>
            <button type="submit" className="boton">
              Crear familia
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
