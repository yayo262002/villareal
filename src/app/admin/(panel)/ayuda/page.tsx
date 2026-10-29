import Link from "next/link";
import { negocio } from "@/config/negocio";
import estilos from "../panel.module.css";

export const metadata = { title: "Cómo se usa el panel" };

/**
 * La guía rápida del panel, para el dueño y para quien lo ayude: qué se
 * hace cada día y dónde está cada cosa, en el orden en que pasa el día.
 * Sin tecnicismos; lo técnico está en el README del código.
 */
export default function PaginaAyuda() {
  return (
    <>
      <div>
        <p>
          <Link href="/admin">← Resumen</Link>
        </p>
        <h1 className={estilos.titulo}>Cómo se usa el panel</h1>
      </div>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Al empezar el día</h2>
        <ol className={estilos.pasos}>
          <li>
            Mira el <Link href="/admin">Resumen</Link>: las entregas de hoy y las atrasadas, los cobros para recordar, los clientes por llamar y lo que
            se acaba del inventario.
          </li>
          <li>
            La campanita de arriba (<Link href="/admin/avisos">Avisos</Link>) tiene lo mismo, aviso por aviso, y a las 7 de la mañana llega al
            teléfono si activaste los avisos.
          </li>
          <li>
            La tasa BCV se trae sola cada mañana. Si un día hace falta cambiarla a mano, está arriba en <Link href="/admin/productos">Productos</Link>.
          </li>
        </ol>
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Vender</h2>
        <ol className={estilos.pasos}>
          <li>
            En <Link href="/admin/ventas">Ventas</Link>, busca al cliente (sale con lo que debe) o deja «Mostrador» si paga en el momento, y pon la
            fecha de la nota de papel si no es la de hoy.
          </li>
          <li>
            Escanea cada producto con el lector o escríbelo (nombre, marca o código) y pulsa Enter: entra al carrito. Ahí se cambian los kilos, las
            piezas y el precio.
          </li>
          <li>
            Di cómo paga: todo ahora (efectivo, pago móvil, varias vías…), una parte, o queda pendiente en su cuenta. Si queda por entregar, ábrelo
            en «Entrega» y pon el día previsto; si tienes la foto de la nota firmada, ponla ahí (o después, desde la nota).
          </li>
          <li>«Confirmar venta» enseña el resumen (y cómo queda la cuenta del cliente) y guarda. Con algo cobrado sale el ticket; si no, la nota.</li>
          <li>
            Sale la nota de entrega: se imprime, se guarda en PDF o se manda por WhatsApp. La foto de la nota firmada queda en la nota, en Ventas
            y en la ficha del cliente.
          </li>
          <li>
            Para <strong>facturar</strong>, marca «Emitir factura fiscal» en la caja antes de confirmar, o pulsa «Facturar» en la nota: sale la factura
            con el IVA desglosado, para imprimirla (carta o ticket) o mandarla. El cliente necesita cédula o RIF en su ficha. Cuando la imprenta
            digital mande el número de control, se anota en la factura. En <Link href="/admin/facturas">Facturas</Link> está el libro de ventas de cada
            mes para el contador.
          </li>
          <li>Si te equivocaste, la venta se borra desde la ficha del cliente y se anota otra vez: no hay edición, así nada se cambia a medias.</li>
        </ol>
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Cobrar</h2>
        <ol className={estilos.pasos}>
          <li>
            Un abono se registra en <Link href="/admin/pagos">Abonos</Link> o en la ficha del cliente: cómo pagó, cuánto (en bolívares si fue pago
            móvil, transferencia o efectivo en Bs) y la captura del comprobante, que es obligatoria con pago móvil, transferencia, Zelle y Binance.
          </li>
          <li>Cada abono se aplica a las notas más antiguas del cliente. En su ficha ves cada abono con lo que debía y lo que quedó, y su captura.</li>
          <li>
            <Link href="/admin/cuentas">Te deben</Link> ordena a los clientes por lo que vence antes. «Recordar» abre WhatsApp con el mensaje y deja
            anotado el día.
          </li>
          <li>
            Dale a cada cliente su enlace de cuenta (en su ficha): con él ve en su teléfono lo que debe, sus notas y sus abonos, sin clave.
          </li>
        </ol>
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Repartir</h2>
        <ol className={estilos.pasos}>
          <li>
            <Link href="/admin/despacho">Despacho</Link> arma la ruta con los pedidos por entregar, dice qué cargar y la abre en Google Maps.
          </li>
          <li>En cada parada, «Avisar» manda el «vamos en camino» y «Entregado» pide la foto de la nota firmada.</li>
          <li>Las entregadas hoy quedan arriba, con su foto.</li>
        </ol>
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Clientes, proveedores e inventario</h2>
        <ol className={estilos.pasos}>
          <li>
            En <Link href="/admin/clientes">Clientes</Link> basta el teléfono y la dirección para dar de alta a uno. Con calle y carrera entra en la
            ruta.
          </li>
          <li>
            El <Link href="/admin/clientes/seguimiento">Estudio de clientes</Link> dice quién lleva una semana o más sin trato, qué suele comprar y
            cada cuánto: «Ofrecer por WhatsApp» y «Lo llamé hoy».
          </li>
          <li>
            En <Link href="/admin/proveedores">Proveedores</Link> se anota cada compra (con sus kilos por producto, que entran al inventario) y cada
            pago, con su captura.
          </li>
          <li>
            <Link href="/admin/inventario">Inventario</Link>: lo comprado menos lo vendido. Un recuento corrige lo que no cuadre. Avisa cuando queda
            poco.
          </li>
        </ol>
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Al cerrar el día</h2>
        <ol className={estilos.pasos}>
          <li>
            El <Link href="/admin/caja">Cierre del día</Link>: lo vendido, lo que entró por cada método en su moneda y lo que salió a proveedores.
          </li>
          <li>
            <Link href="/admin/estadisticas">Estadísticas</Link> para cualquier período, con descargas para Excel.
          </li>
          <li>
            La copia de seguridad se guarda sola cada mañana (se conservan 14). En el Resumen puedes descargar una cuando quieras: ese archivo es el
            negocio entero.
          </li>
        </ol>
      </section>

      <section className="tarjeta">
        <h2 className={estilos.subtitulo}>Lo que el panel hace por ti</h2>
        <ul className={estilos.pasos}>
          <li>Frena lo repetido: el mismo abono o la misma venta anotada dos veces seguidas pide confirmar antes de guardarse.</li>
          <li>Avisa cuando algo no cuadra (un precio raro, más kilos de los que hay, una foto que no es la nota) y te deja decidir.</li>
          <li>Nunca borra nada sin una pantalla de confirmación; borrar un cliente o un proveedor pide la clave.</li>
          <li>
            Los mensajes de WhatsApp (nota, recibo, recordatorio, en camino, ofrecer) salen escritos; tú los revisas y los mandas desde tu teléfono.
            Y hay <Link href="/admin/stickers">stickers de Villa Real</Link> para responder.
          </li>
          <li>
            Todo esto funciona también como app en el teléfono: <Link href="/admin/app">cómo ponerla</Link>, con los avisos.
          </li>
        </ul>
        <p className={estilos.ayuda} style={{ marginBottom: 0 }}>
          La web pública está en {negocio.web}: los clientes ven los productos con el precio del día y mandan el pedido por WhatsApp; el pedido lo
          anotas tú aquí.
        </p>
      </section>
    </>
  );
}
