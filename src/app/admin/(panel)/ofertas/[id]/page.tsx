import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarOferta } from "@/lib/ofertas";
import { listarProductos } from "@/lib/productos";
import { listarFamilias } from "@/lib/familias";
import { NOMBRE_ESTADO_PRODUCTO, estadoDeProducto } from "@/lib/catalogo";
import { leerTasa } from "@/lib/ajustes";
import { editarOferta } from "@/lib/acciones";
import { aBolivares, bs, usd } from "@/lib/dinero";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import estilos from "../../panel.module.css";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const oferta = await buscarOferta(Number(id));
  return { title: oferta?.nombre ?? "Oferta" };
}

/**
 * La ficha de una oferta: nombre, descripción, precio, fechas, estado y lo
 * que lleva, con cuánto de cada producto. Se pueden elegir productos en
 * borrador: la oferta los nombra, pero ellos no salen en la web hasta que
 * se activen.
 */
export default async function PaginaOferta({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ParametrosAviso> }) {
  const { id } = await params;
  const parametros = await searchParams;
  const numero = Number(id);
  const oferta = Number.isSafeInteger(numero) && numero > 0 ? await buscarOferta(numero) : null;
  if (!oferta) notFound();
  const [productos, familias, tasa] = await Promise.all([listarProductos(), listarFamilias(), leerTasa()]);
  const lleva = new Map(oferta.productos.map((p) => [p.producto_id, p.cantidad]));
  const enBs = oferta.precio_usd !== null ? aBolivares(oferta.precio_usd, tasa?.valor ?? null) : null;
  const borradores = oferta.productos.filter((p) => p.borrador || !p.activo);
  // Los productos por familia, en el orden de las familias; los que no tienen, al final.
  const grupos = [...familias.map((f) => ({ nombre: f.nombre, productos: productos.filter((p) => p.familia_id === f.id) })), { nombre: "Sin familia", productos: productos.filter((p) => !p.familia_id) }].filter(
    (g) => g.productos.length > 0,
  );

  return (
    <>
      <div>
        <p>
          <Link href="/admin/ofertas">← Ofertas</Link>
        </p>
        <h1 className={estilos.titulo}>{oferta.nombre}</h1>
      </div>
      <Avisos parametros={parametros} />
      {oferta.estado === "activa" && borradores.length > 0 && (
        <p className="aviso aviso--aviso">
          Lleva productos que no están en la web ({borradores.map((p) => p.nombre).join(", ")}): la oferta los nombra, pero no se pueden pedir sueltos
          hasta que los actives.
        </p>
      )}

      <section className="tarjeta">
        <form action={editarOferta} className="formulario">
          <input type="hidden" name="id" value={oferta.id} />
          <div className="campo">
            <label htmlFor="oferta-nombre">Nombre</label>
            <input id="oferta-nombre" name="nombre" type="text" required defaultValue={oferta.nombre} />
          </div>
          <div className="campo">
            <label htmlFor="oferta-descripcion">Descripción (se ve en la web)</label>
            <input id="oferta-descripcion" name="descripcion" type="text" defaultValue={oferta.descripcion} />
          </div>
          <div className="formulario__fila">
            <div className="campo">
              <label htmlFor="oferta-precio">Precio del combo, USD</label>
              <input id="oferta-precio" name="precio_usd" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={oferta.precio_usd ?? ""} />
              <span className="ayuda">
                {oferta.precio_usd !== null && enBs !== null ? `Hoy, ${usd(oferta.precio_usd)} = ${bs(enBs)}. ` : ""}Vacío: la web dice «consulta el precio».
              </span>
            </div>
            <div className="campo">
              <label htmlFor="oferta-estado">Estado</label>
              <select id="oferta-estado" name="estado" defaultValue={oferta.estado}>
                <option value="borrador">Borrador: no sale en la web</option>
                <option value="activa">Activa: sale en la web en sus fechas</option>
                <option value="inactiva">Inactiva: oculta</option>
              </select>
            </div>
          </div>
          <div className={estilos.filaTres}>
            <div className="campo">
              <label htmlFor="oferta-desde">Desde (opcional)</label>
              <input id="oferta-desde" name="desde" type="date" defaultValue={oferta.desde ?? ""} />
            </div>
            <div className="campo">
              <label htmlFor="oferta-hasta">Hasta (opcional)</label>
              <input id="oferta-hasta" name="hasta" type="date" defaultValue={oferta.hasta ?? ""} />
            </div>
            <div className="campo">
              <label htmlFor="oferta-orden">Orden</label>
              <input id="oferta-orden" name="orden" type="number" inputMode="numeric" min="0" step="1" defaultValue={oferta.orden} />
            </div>
          </div>

          <fieldset className={estilos.categoriasProducto} style={{ gridTemplateColumns: "1fr" }}>
            <legend>Lo que lleva, y cuánto de cada uno</legend>
            {grupos.map((g) => (
              <div key={g.nombre} className={estilos.grupoOferta}>
                <p className={estilos.subtituloPequeno}>{g.nombre}</p>
                {g.productos.map((p) => {
                  const estado = estadoDeProducto(p);
                  return (
                    <div key={p.id} className={estilos.lineaOferta}>
                      <label className={estilos.casilla}>
                        <input type="checkbox" name="producto" value={p.id} defaultChecked={lleva.has(p.id)} />
                        <span>
                          {p.nombre}
                          {estado !== "activo" ? <span className="ayuda"> ({NOMBRE_ESTADO_PRODUCTO[estado].toLowerCase()})</span> : null}
                        </span>
                      </label>
                      <input
                        name={`cantidad_${p.id}`}
                        type="text"
                        aria-label={`Cuánto de ${p.nombre}`}
                        placeholder="2 kg"
                        defaultValue={lleva.get(p.id) ?? ""}
                        className={estilos.entradaPequena}
                        maxLength={40}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </fieldset>

          <div>
            <button type="submit" className="boton">
              Guardar la oferta
            </button>
          </div>
        </form>
      </section>

      <section className="tarjeta">
        <Link href={`/admin/ofertas/${oferta.id}/eliminar`} className="enlace-fila">
          Eliminar la oferta
        </Link>
      </section>
    </>
  );
}
