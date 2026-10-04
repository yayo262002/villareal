"use client";

import { useEffect, useState } from "react";
import { aBolivares, bs, fechaCorta, redondear, usd } from "@/lib/dinero";

/**
 * Lo que el formulario de abono hace mientras se escribe, para que sea
 * difícil equivocarse: al elegir cómo pagó, el monto se pide en bolívares o
 * en dólares (y la tasa solo se enseña en bolívares); al cambiar la fecha,
 * la tasa pasa a ser la que había ese día (y se puede cambiar); y debajo
 * del monto se ve el equivalente en la otra moneda y lo que debe el
 * cliente. Lee y escribe los campos del propio formulario. Sin JavaScript
 * el formulario funciona igual y el servidor hace las mismas cuentas.
 */
type Props = {
  hoy: string;
  metodosEnBs: string[];
  metodosConComprobante: string[];
  idFecha: string;
  idMetodo: string;
  idMonto: string;
  idTasa: string;
  idCliente: string;
  idAyudaComprobante?: string;
};

type Lineas = { deuda: string; equivalente: string; tasa: string };

export function AbonoVivo({ hoy, metodosEnBs, metodosConComprobante, idFecha, idMetodo, idMonto, idTasa, idCliente, idAyudaComprobante }: Props) {
  const [lineas, setLineas] = useState<Lineas>({ deuda: "", equivalente: "", tasa: "" });

  useEffect(() => {
    const fecha = document.getElementById(idFecha) as HTMLInputElement | null;
    const metodo = document.getElementById(idMetodo) as HTMLSelectElement | null;
    const monto = document.getElementById(idMonto) as HTMLInputElement | null;
    const tasa = document.getElementById(idTasa) as HTMLInputElement | null;
    const cliente = document.getElementById(idCliente) as HTMLInputElement | HTMLSelectElement | null;
    if (!fecha || !metodo || !monto || !tasa) return;
    const rotuloDelMonto = document.querySelector<HTMLLabelElement>(`label[for="${idMonto}"]`);
    const campoDeTasa = tasa.closest<HTMLElement>(".campo");
    const ayudaComprobante = idAyudaComprobante ? document.getElementById(idAyudaComprobante) : null;

    let tasaTocada = false;
    let fechaConsultada = "";
    const estado: Lineas = { deuda: "", equivalente: "", tasa: "" };
    const pintar = () => setLineas({ ...estado });

    const leer = (campo: HTMLInputElement) => {
      const n = Number(campo.value.replace(",", "."));
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const enBs = () => metodosEnBs.includes(metodo.value);

    const saldoDelCliente = (): number | null => {
      if (!cliente) return null;
      const dato = cliente instanceof HTMLSelectElement ? cliente.selectedOptions[0]?.dataset.saldo : cliente.dataset.saldo;
      const n = Number(dato);
      return Number.isFinite(n) ? n : null;
    };

    const calcular = () => {
      const m = leer(monto);
      const t = leer(tasa);
      const saldo = saldoDelCliente();
      estado.deuda =
        saldo === null || saldo <= 0
          ? saldo !== null && saldo < 0
            ? `El cliente tiene ${usd(-saldo)} a favor.`
            : saldo === 0
              ? "El cliente está al día."
              : ""
          : `Debe ${usd(saldo)}${t ? ` (${bs(aBolivares(saldo, t) ?? 0)} a esa tasa)` : ""}.`;
      if (m === null) estado.equivalente = "";
      else if (enBs()) estado.equivalente = t ? `${bs(m)} = ${usd(redondear(m / t))} a ${bs(t)} por dólar.` : `${bs(m)}: falta la tasa para pasarlo a dólares.`;
      else estado.equivalente = `${usd(m)}${t ? ` = ${bs(aBolivares(m, t) ?? 0)} a ${bs(t)} por dólar` : ""}.`;
      pintar();
    };

    const alMetodo = () => {
      const bolivares = enBs();
      if (rotuloDelMonto) rotuloDelMonto.textContent = !metodo.value ? "Monto (elige primero cómo pagó)" : bolivares ? "Monto en bolívares (Bs)" : "Monto en dólares (USD)";
      if (campoDeTasa) campoDeTasa.hidden = Boolean(metodo.value) && !bolivares;
      monto.placeholder = !metodo.value ? "" : bolivares ? "Lo que pagó, en Bs" : "Lo que pagó, en USD";
      if (ayudaComprobante) {
        ayudaComprobante.textContent = metodo.value
          ? metodosConComprobante.includes(metodo.value)
            ? "Con este método el comprobante es obligatorio: la captura del pago. Queda guardada con el abono."
            : "En efectivo no hace falta comprobante; si lo tienes, guárdalo igual."
          : "La captura del pago. Obligatoria con pago móvil, transferencia, Zelle y Binance; en efectivo no hace falta.";
      }
      calcular();
    };

    const alFecha = async () => {
      const dia = fecha.value;
      if (!dia || dia === fechaConsultada) return;
      fechaConsultada = dia;
      if (dia === hoy) {
        estado.tasa = "";
        calcular();
        return;
      }
      try {
        const respuesta = await fetch(`/admin/tasas/${dia}`, { headers: { accept: "application/json" } });
        const t = respuesta.ok ? await respuesta.json() : null;
        if (!t || fecha.value !== dia) return;
        if (!tasaTocada) tasa.value = String(t.valor);
        estado.tasa = `Tasa del ${fechaCorta(dia)}: ${bs(t.valor)} por dólar (${t.descripcion}). Cámbiala si ese día fue otra.`;
        calcular();
      } catch {
        // Sin respuesta, se queda la tasa que había en el campo.
      }
    };

    const alTasa = () => {
      tasaTocada = true;
      calcular();
    };

    metodo.addEventListener("change", alMetodo);
    monto.addEventListener("input", calcular);
    tasa.addEventListener("input", alTasa);
    fecha.addEventListener("change", alFecha);
    cliente?.addEventListener("change", calcular);
    alMetodo();
    void alFecha();
    return () => {
      metodo.removeEventListener("change", alMetodo);
      monto.removeEventListener("input", calcular);
      tasa.removeEventListener("input", alTasa);
      fecha.removeEventListener("change", alFecha);
      cliente?.removeEventListener("change", calcular);
    };
  }, [hoy, metodosEnBs, metodosConComprobante, idFecha, idMetodo, idMonto, idTasa, idCliente, idAyudaComprobante]);

  const texto = [lineas.deuda, lineas.equivalente, lineas.tasa].filter(Boolean);
  if (texto.length === 0) return <p aria-live="polite" style={{ margin: 0, minHeight: 0 }} />;
  return (
    <p className="aviso aviso--aviso" aria-live="polite" style={{ margin: "0 0 var(--espacio-3)" }}>
      {texto.map((t, i) => (
        <span key={i} style={{ display: "block" }}>
          {t}
        </span>
      ))}
    </p>
  );
}
