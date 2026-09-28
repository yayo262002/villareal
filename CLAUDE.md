@AGENTS.md
@README.md

## Para quien trabaje en este proyecto

- Lee el README: ahí están las reglas, la estructura y lo pendiente.
- Antes de escribir código de Next, mira `node_modules/next/dist/docs/`:
  esta versión (16) usa `proxy.ts` en vez de middleware, y `params` y
  `searchParams` son promesas.
- Los formularios del panel son HTML sin JavaScript en el cliente; los
  errores y aciertos vuelven por la URL (`?error=`, `?ok=`). No añadas
  componentes cliente si no hacen falta.
- Cada acción del servidor comprueba la sesión con `exigirSesion()`.
  El proxy solo mira que la cookie exista.
- `npm run verificar` antes de dar algo por hecho.
