# Comercializadora Villareal

Web y sistema de gestión para un local de quesos en Venezuela: queso amarillo,
mozzarella y lo que se vaya añadiendo.

Tiene dos partes:

- **La web pública** (`/`): qué se vende, precios si están puestos, y cómo
  contactar. Pensada para el teléfono.
- **El panel** (`/admin`): registrar clientes, anotar ventas, registrar pagos
  en dólares o en bolívares con la tasa del día, y ver quién debe cuánto.

## Arrancar

```
npm install
npm run dev
```

Abre http://localhost:3000. El panel está en http://localhost:3000/admin y
pide la clave que está en `.env.local` (`ADMIN_CLAVE`). Cámbiala.

No hace falta instalar ninguna base de datos: usa SQLite integrado en Node 24.
El archivo se crea solo en `datos/villareal.db` la primera vez. Ese archivo
**es el negocio entero**: haz copia de él.

## Comprobar

```
npm run verificar    typecheck + lint + pruebas unitarias
npm run build        que compila
```

## Dónde está cada cosa

```
src/config/negocio.ts     Nombre, WhatsApp, dirección, RIF. Lo que falta está vacío, no inventado
src/styles/tokens.css     Colores y medidas. Nada de colores sueltos en los componentes
src/lib/db.ts             Conexión SQLite y esquema (se crea solo)
src/lib/clientes.ts       Clientes y su saldo
src/lib/ventas.ts         Ventas con sus líneas de producto
src/lib/pagos.ts          Pagos: método, moneda, tasa, equivalente en USD
src/lib/dinero.ts         Conversión y formato de dólares y bolívares
src/lib/acciones.ts       Lo que hacen los formularios del panel
src/lib/sesion.ts         La clave del panel y la cookie
src/proxy.ts              Corta el paso a /admin sin sesión
src/app/page.tsx          La web pública
src/app/admin/            El panel
datos/                    La base de datos (fuera de Git)
```

## Cómo funcionan las cuentas

- Los precios se fijan en **dólares**.
- Cada venta suma al saldo del cliente. Cada pago resta.
- Un pago en bolívares se guarda con la **tasa del día** que se escribió al
  registrarlo, y se convierte a dólares en ese momento. Si la tasa cambia
  mañana, el pago de hoy no se mueve.
- El saldo del cliente es lo comprado menos lo pagado, en dólares.

Métodos de pago que reconoce: pago móvil, transferencia, efectivo en
bolívares (los tres piden tasa), efectivo en dólares, Zelle, Binance y otro.

## Reglas

- **No inventar.** Si el precio no está, la web dice «consulta el precio del
  día». Si el teléfono no está, la web no muestra ninguno.
- **Escribir en castellano.** Código, comentarios, mensajes y commits.
- **Móvil primero.** El dueño usa el panel desde el teléfono en el local.
- **Ninguna clave en el código.** Van en `.env.local`.

## Pendiente

- Rellenar `src/config/negocio.ts`: WhatsApp, dirección, horario, RIF.
- Poner precios reales a los productos desde el panel.
- Decidir dónde se aloja la web para que se vea desde fuera del local.
  SQLite funciona en un servidor propio o VPS; si se aloja en Vercel habrá
  que mover la base a Turso o Postgres (solo cambia `src/lib/db.ts`).
- Fotos de los productos.
- Copias de seguridad automáticas de `datos/villareal.db`.
