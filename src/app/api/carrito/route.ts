import { listarProductos, direccionDeFotoDeProducto } from "@/lib/productos";
import { direccionDeFotoDeVariante, listarVariantes } from "@/lib/variantes";
import { ofertasVigentes } from "@/lib/ofertas";
import { nombreDeVenta, porQueSeCobra } from "@/lib/catalogo";
import { leerTasa } from "@/lib/ajustes";
import { rutaProducto, rutaVariante } from "@/lib/enlaces";
import { dibujoComoDato } from "@/lib/dibujos";
import { hoy } from "@/lib/dinero";
import { CLAVE_VALIDA, type ProductoDelCarrito } from "@/lib/carrito";

/**
 * GET /api/carrito?claves=2,1-7,o1 dice, al día, el nombre, el precio y la
 * foto de lo que hay en el carrito, y la tasa. Solo lo que está en la web:
 * un producto escondido, un borrador, una marca escondida o un combo fuera
 * de fecha no salen (el carrito los da por no disponibles). Un producto que
 * tiene marcas se pide por su marca, no suelto. Pública, como las páginas
 * de los productos.
 */
export async function GET(request: Request): Promise<Response> {
  const claves = [...new Set((new URL(request.url).searchParams.get("claves") ?? "").split(","))].filter((c) => CLAVE_VALIDA.test(c)).slice(0, 100);
  const [productos, variantes, ofertas, tasa] = await Promise.all([listarProductos(true), listarVariantes(), ofertasVigentes(hoy()), leerTasa()]);
  const respuesta: ProductoDelCarrito[] = [];
  for (const clave of claves) {
    if (clave.startsWith("o")) {
      const oferta = ofertas.find((o) => o.id === Number(clave.slice(1)));
      if (!oferta) continue;
      respuesta.push({
        clave,
        nombre: oferta.nombre,
        porQue: "combo",
        unidad: "combo",
        precio_usd: oferta.precio_usd,
        ruta: `/ofertas#oferta-${oferta.id}`,
        foto: dibujoComoDato(oferta.nombre),
      });
      continue;
    }
    const [idProducto, idVariante] = clave.split("-").map(Number);
    const producto = productos.find((p) => p.id === idProducto);
    if (!producto) continue;
    const marcas = variantes.filter((v) => v.producto_id === producto.id && v.activo === 1);
    const variante = idVariante ? marcas.find((v) => v.id === idVariante) : null;
    if (idVariante ? !variante : marcas.length > 0) continue;
    respuesta.push({
      clave,
      nombre: nombreDeVenta(producto.nombre, variante?.nombre),
      porQue: porQueSeCobra(producto),
      unidad: producto.unidad,
      precio_usd: variante ? variante.precio_usd : producto.precio_usd,
      ruta: variante ? rutaVariante(producto, variante) : rutaProducto(producto),
      foto: (variante ? direccionDeFotoDeVariante(variante) : null) ?? direccionDeFotoDeProducto(producto) ?? dibujoComoDato(producto.nombre),
    });
  }
  return Response.json({ productos: respuesta, tasa: tasa?.valor ?? null }, { headers: { "cache-control": "no-store" } });
}
