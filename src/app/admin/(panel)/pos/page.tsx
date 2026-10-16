import Link from "next/link";
import { catalogoDelPos, clienteDeMostrador } from "@/lib/pos";
import { listarClientes } from "@/lib/clientes";
import { leerTasa, permitirStockNegativo } from "@/lib/ajustes";
import { preciosEspecialesPorCliente } from "@/lib/precios-especiales";
import { Avisos, type ParametrosAviso } from "@/components/avisos";
import { Pos, type ArticuloParaLaCaja } from "@/components/pos";
import estilos from "../panel.module.css";

export const metadata = { title: "Caja" };

/**
 * La caja (punto de venta): el catálogo con lo que hay de cada artículo,
 * los clientes con sus precios especiales y la tasa del día, para que la
 * pantalla trabaje sola y rápido; el cobro vuelve al servidor.
 */
export default async function PaginaPos({ searchParams }: { searchParams: Promise<ParametrosAviso> }) {
  const parametros = await searchParams;
  const [catalogo, clientes, tasa, precios, sinTope, mostrador] = await Promise.all([
    catalogoDelPos(),
    listarClientes(),
    leerTasa(),
    preciosEspecialesPorCliente(),
    permitirStockNegativo(),
    clienteDeMostrador(),
  ]);
  const paraLaCaja: ArticuloParaLaCaja[] = catalogo.map((a) => ({
    clave: a.clave,
    producto_id: a.producto_id,
    variante_id: a.variante_id,
    nombre: a.nombre,
    unidad: a.unidad as ArticuloParaLaCaja["unidad"],
    precio_usd: a.precio_usd,
    codigo_barras: a.codigo_barras,
    sku: a.sku,
    marca: a.marca,
    presentacionTexto: a.presentacionTexto,
    familia: a.familia,
    existencia: a.existencia,
    estado: a.estado,
  }));
  const listaDeClientes = [{ id: mostrador.id, rotulo: mostrador.rotulo }, ...clientes.filter((c) => c.id !== mostrador.id).map((c) => ({ id: c.id, rotulo: c.rotulo }))];
  const sinCodigo = catalogo.filter((a) => !a.codigo_barras).length;

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 className={estilos.titulo}>Caja</h1>
        <div className={estilos.accionesFila} style={{ flexWrap: "wrap" }}>
          <Link href="/admin/codigos" className="boton boton--secundario">
            Códigos de barras{sinCodigo > 0 ? ` (${sinCodigo} sin código)` : ""}
          </Link>
          <Link href="/admin/ventas" className="boton boton--secundario">
            Ventas
          </Link>
        </div>
      </div>
      <Avisos parametros={parametros} />
      <Pos
        catalogo={paraLaCaja}
        clientes={listaDeClientes}
        mostradorId={mostrador.id}
        tasa={tasa?.valor ?? null}
        preciosEspeciales={precios}
        sinTope={sinTope}
        claveDevuelta={typeof parametros.clave === "string" ? parametros.clave : undefined}
        claveVendida={typeof parametros.vendida === "string" ? parametros.vendida : undefined}
      />
    </>
  );
}
