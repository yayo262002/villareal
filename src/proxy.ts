import { NextResponse, type NextRequest } from "next/server";

/**
 * Corta el paso a `/admin` si no hay cookie de sesión. Es una comprobación
 * rápida: solo mira que la cookie exista. La firma se verifica de verdad en
 * el layout del panel y en cada acción del servidor, que es donde importa.
 */
const COOKIE_SESION = "villareal_sesion";
const RUTAS_LIBRES = ["/admin/entrar"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (RUTAS_LIBRES.some((ruta) => pathname.startsWith(ruta))) return NextResponse.next();

  if (!request.cookies.get(COOKIE_SESION)?.value) {
    const destino = new URL("/admin/entrar", request.url);
    return NextResponse.redirect(destino);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
