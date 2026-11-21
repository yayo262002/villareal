"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { conectarWhatsapp } from "@/lib/acciones-whatsapp";

/**
 * «Conectar el número»: abre la ventana de Meta (Embedded Signup) para unir el WhatsApp Business del teléfono con la
 * web sin sacarlo del teléfono (coexistencia, `featureType: whatsapp_business_app_onboarding`). Necesita el SDK de
 * Facebook, que solo esta pantalla deja cargar (su Content-Security-Policy, en `next.config.ts`). Si se llegó aquí desde
 * otra pantalla del panel sin recargar, el navegador sigue con la política de la anterior y el SDK no carga: entonces
 * se recarga la página una vez, sola.
 */

type FB = {
  init: (opciones: Record<string, unknown>) => void;
  login: (alTerminar: (respuesta: { authResponse?: { code?: string } | null }) => void, opciones: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    FB?: FB;
    fbAsyncInit?: () => void;
  }
}

type Estado = "cargando" | "listo" | "abierto" | "guardando" | "hecho" | "error";

export function ConectarWhatsapp({ appId, configId, version }: { appId: string; configId: string; version: string }) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [mensaje, setMensaje] = useState("");
  const sesion = useRef<{ waba_id?: string; phone_number_id?: string; evento?: string }>({});
  const router = useRouter();

  useEffect(() => {
    // Lo que la ventana de Meta cuenta mientras se usa: la cuenta y el número al terminar, o que se canceló.
    const alMensaje = (e: MessageEvent) => {
      let origen = "";
      try {
        origen = new URL(e.origin).hostname;
      } catch {
        return;
      }
      if (origen !== "facebook.com" && !origen.endsWith(".facebook.com")) return;
      try {
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (d?.type !== "WA_EMBEDDED_SIGNUP") return;
        sesion.current = { ...sesion.current, ...(d.data ?? {}), evento: d.event };
        if (d.event === "CANCEL") setMensaje(`Se cerró la ventana de Meta sin terminar${d.data?.current_step ? ` (en «${d.data.current_step}»)` : ""}.`);
        if (d.event === "ERROR") setMensaje(`Meta dio un error: ${d.data?.error_message ?? "sin detalle"}${d.data?.error_code ? ` (código ${d.data.error_code})` : ""}.`);
      } catch {
        // No era de la ventana de Meta.
      }
    };
    window.addEventListener("message", alMensaje);

    const iniciar = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      setEstado("listo");
    };
    if (window.FB) iniciar();
    else {
      window.fbAsyncInit = iniciar;
      if (!document.getElementById("sdk-de-facebook")) {
        const script = document.createElement("script");
        script.id = "sdk-de-facebook";
        script.async = true;
        script.defer = true;
        script.crossOrigin = "anonymous";
        script.src = "https://connect.facebook.net/es_LA/sdk.js";
        script.onerror = () => {
          // Bloqueado por la política de la pantalla anterior: una recarga, y solo una por minuto.
          let ultima = 0;
          try {
            ultima = Number(sessionStorage.getItem("recarga-whatsapp") ?? 0);
            sessionStorage.setItem("recarga-whatsapp", String(Date.now()));
          } catch {
            // Sin memoria del navegador, no se recarga sola: lo dice abajo.
            ultima = Date.now();
          }
          if (Date.now() - ultima > 60_000) window.location.reload();
          else {
            setEstado("error");
            setMensaje("No se pudo cargar Facebook. Recarga la página (o ábrela otra vez) y prueba de nuevo.");
          }
        };
        document.body.appendChild(script);
      }
    }
    return () => window.removeEventListener("message", alMensaje);
  }, [appId, version]);

  function abrir() {
    if (!window.FB) return;
    setMensaje("");
    setEstado("abierto");
    sesion.current = {};
    window.FB.login(
      (respuesta) => {
        const code = respuesta?.authResponse?.code;
        if (!code) {
          setEstado("listo");
          setMensaje((m) => m || "No se terminó de conectar. Si cerraste la ventana sin querer, pulsa otra vez.");
          return;
        }
        setEstado("guardando");
        // La ventana manda la cuenta y el número justo antes o justo después del código: un momento de margen.
        window.setTimeout(async () => {
          try {
            const r = await conectarWhatsapp({ code, wabaId: sesion.current.waba_id ?? "", telefonoId: sesion.current.phone_number_id ?? "" });
            setEstado(r.ok ? "hecho" : "error");
            setMensaje(r.mensaje);
            // «Cómo está» arriba se pone al día.
            if (r.ok) router.refresh();
          } catch {
            setEstado("error");
            setMensaje("No se pudo guardar la conexión. Prueba otra vez.");
          }
        }, 1500);
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
      },
    );
  }

  return (
    <div>
      <button type="button" className="boton" onClick={abrir} disabled={estado !== "listo" && estado !== "error"}>
        {estado === "cargando" ? "Cargando Facebook…" : estado === "abierto" ? "Ventana de Meta abierta…" : estado === "guardando" ? "Conectando…" : estado === "hecho" ? "Conectado ✓" : "Conectar el número"}
      </button>
      {mensaje && (
        <p className={`aviso ${estado === "hecho" ? "aviso--exito" : estado === "error" ? "aviso--error" : "aviso--aviso"}`} style={{ marginTop: "var(--espacio-3)" }}>
          {mensaje}
        </p>
      )}
    </div>
  );
}
