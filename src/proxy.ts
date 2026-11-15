import { NextResponse, type NextRequest } from "next/server";

/**
 * Corta el paso a `/admin` si no hay cookie de sesión con la forma de una de verdad. Es una comprobación rápida, sin
 * la base: la firma se verifica de verdad en cada pantalla del panel (`exigirPanel`), en el layout y en cada acción del
 * servidor (`sesion.ts`), que es donde importa. Aquí solo se para lo que ni siquiera lo parece.
 */
const COOKIE_SESION = "villareal_sesion";
// El avisador (sw.js) lo pide el navegador por su cuenta y no tiene nada privado.
const RUTAS_LIBRES = ["/admin/entrar", "/admin/manifest.webmanifest", "/admin/sw.js"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (RUTAS_LIBRES.some((ruta) => pathname.startsWith(ruta))) return NextResponse.next();

  const valor = request.cookies.get(COOKIE_SESION)?.value ?? "";
  // «v2.<cuándo>.<versión>.<firma>» o, hasta el 15/12/2026, la firma del formato de antes.
  if (!/^v2\.[0-9a-z]{1,12}\.\d{1,6}\.[0-9a-f]{64}$/.test(valor) && !/^[0-9a-f]{64}$/.test(valor)) {
    const destino = new URL("/admin/entrar", request.url);
    return NextResponse.redirect(destino);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
