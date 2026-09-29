import Link from "next/link";
import estilos from "./panel.module.css";

/** Dentro del panel: un cliente, venta, pago o foto que ya no existe. */
export default function NoEncontradoEnPanel() {
  return (
    <>
      <h1 className={estilos.titulo}>No se encontró</h1>
      <p className={estilos.ayuda}>
        Puede que ya se haya borrado, o que el enlace venga de una página que llevaba un rato abierta.
      </p>
      <div>
        <Link href="/admin" className="boton">
          Volver al resumen
        </Link>
      </div>
    </>
  );
}
