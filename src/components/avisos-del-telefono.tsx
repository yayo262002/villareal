"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import estilos from "@/app/admin/(panel)/panel.module.css";

type Estado = "mirando" | "no_soportado" | "iphone_sin_instalar" | "bloqueado" | "apagado" | "trabajando" | "encendido";

/** La clave pública VAPID viene en base64url; el navegador la quiere en bytes. */
function aBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/**
 * «Activar avisos en este teléfono»: pide permiso, registra el avisador
 * (`/admin/sw.js`), se suscribe a los avisos y le dice a la web dónde
 * mandarlos. Cada teléfono se activa por separado. En iPhone solo funciona
 * con el panel puesto en la pantalla de inicio (y desde iOS 16.4), así que
 * se avisa; en Android (Chrome) vale desde el navegador.
 */
export function AvisosDelTelefono() {
  const [estado, setEstado] = useState<Estado>("mirando");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const esIphone = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setEstado(esIphone && !instalada ? "iphone_sin_instalar" : "no_soportado");
        return;
      }
      if (Notification.permission === "denied") {
        setEstado("bloqueado");
        return;
      }
      try {
        const registro = await navigator.serviceWorker.getRegistration("/admin/");
        const suscripcion = await registro?.pushManager.getSubscription();
        setEstado(suscripcion ? "encendido" : "apagado");
      } catch {
        setEstado("apagado");
      }
    })();
  }, []);

  async function activar() {
    setEstado("trabajando");
    setError("");
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueado" : "apagado");
        return;
      }
      const respuestaClave = await fetch("/admin/telefonos", { cache: "no-store" });
      if (!respuestaClave.ok) throw new Error("La web no dio la clave de los avisos.");
      const { clavePublica } = (await respuestaClave.json()) as { clavePublica: string };
      const registro = await navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin/" });
      await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clavePublica) });
      const guardado = await fetch("/admin/telefonos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ suscripcion: suscripcion.toJSON(), aparato: navigator.userAgent.slice(0, 120) }),
      });
      if (!guardado.ok) throw new Error("La web no guardó este teléfono.");
      setEstado("encendido");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEstado("apagado");
    }
  }

  async function desactivar() {
    setEstado("trabajando");
    setError("");
    try {
      const registro = await navigator.serviceWorker.getRegistration("/admin/");
      const suscripcion = await registro?.pushManager.getSubscription();
      if (suscripcion) {
        await fetch("/admin/telefonos", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: suscripcion.endpoint }) });
        await suscripcion.unsubscribe();
      }
      setEstado("apagado");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEstado("encendido");
    }
  }

  if (estado === "mirando") return <p className="ayuda">Mirando si este teléfono puede recibir avisos…</p>;
  if (estado === "iphone_sin_instalar") {
    return (
      <p className="aviso aviso--aviso">
        En iPhone los avisos solo llegan con el panel puesto en la pantalla de inicio: ponlo (<Link href="/admin/app">cómo hacerlo</Link>), ábrelo
        desde ahí y vuelve a esta pantalla para activarlos.
      </p>
    );
  }
  if (estado === "no_soportado") {
    return <p className="aviso aviso--aviso">Este navegador no permite avisos. En Android, prueba con Chrome; en iPhone, con el panel puesto en la pantalla de inicio.</p>;
  }
  if (estado === "bloqueado") {
    return <p className="aviso aviso--error">Los avisos están bloqueados en este navegador. Permítelos en los ajustes del sitio y vuelve aquí.</p>;
  }
  return (
    <div className={estilos.accionesFila} style={{ flexWrap: "wrap", alignItems: "center" }}>
      {estado === "encendido" ? (
        <>
          <span className={`${estilos.estado} ${estilos["estado--pagada"]}`}>Avisos activados en este teléfono</span>
          <button type="button" className={`boton boton--secundario ${estilos.botonPequeno}`} onClick={desactivar}>
            Desactivar en este teléfono
          </button>
        </>
      ) : (
        <button type="button" className="boton" onClick={activar} disabled={estado === "trabajando"}>
          {estado === "trabajando" ? "Activando…" : "Activar avisos en este teléfono"}
        </button>
      )}
      {error && <span className={estilos.vencida}>{error}</span>}
    </div>
  );
}
