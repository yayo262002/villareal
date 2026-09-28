# Comercializadora Villareal

Web y sistema de gestión para un local de quesos en Venezuela: queso amarillo,
mozzarella y lo que se vaya añadiendo.

Tiene dos partes:

- **La web pública** (`/`): qué se vende, precios si están puestos, y cómo
  contactar. Pensada para el teléfono.
- **El panel** (`/admin`): registrar clientes, anotar ventas, registrar pagos
  en dólares o en bolívares con la tasa del día, ver las cuentas por pagar
  y pagadas, guardar la foto de cada nota de entrega, y un informe de
  cuánto se vende, de qué y a quién.

## Arrancar

```
npm install
npm run dev
```

Abre http://localhost:3000. El panel está en http://localhost:3000/admin y
pide la clave que está en `.env.local` (`ADMIN_CLAVE`). Cámbiala.

No hace falta instalar ninguna base de datos: es SQLite en un archivo que se
crea solo en `datos/villareal.db` la primera vez. Ese archivo **es el negocio
entero**, fotos incluidas: haz copia de él (ver más abajo).

## Comprobar

```
npm run verificar    typecheck + lint + pruebas unitarias
npm run build        que compila
```

## Copias de seguridad

```
npm run copia
```

Guarda `copias/villareal-AAAA-MM-DD-HHMM.db` (un SQLite completo, fotos
incluidas, salga del archivo local o de Turso) y borra las más viejas pasando
de 30. Si quieres que las copias vayan a una carpeta que se sincronice con
la nube, pon `CARPETA_COPIAS=` en `.env.local`.

Para que salga sola cada día a las 8 de la noche, en PowerShell (una vez,
desde la carpeta del proyecto):

```
schtasks /create /tn "Copia Villareal" /sc daily /st 20:00 /tr "cmd /c cd /d $PWD && npm run copia"
```

Desde el teléfono: en el Resumen del panel hay un botón «Descargar copia»
que baja el mismo archivo.

Para restaurar en local, para el servidor y sustituye `datos/villareal.db`
por la copia (borra también `villareal.db-wal` y `villareal.db-shm` si
existen). Para restaurar en Turso, vuelca la copia con `sqlite3 copia.db
.dump` y cárgala con `turso db shell`.

## Publicar en Vercel

La web se puede alojar gratis en Vercel, pero allí no hay disco: la base de
datos tiene que vivir en Turso, que es el mismo SQLite en la nube y también
tiene plan gratuito. Solo hay que poner dos variables; el código no cambia.

1. Crea una cuenta en https://turso.tech, una base de datos (por ejemplo
   `villareal`) y copia su URL (`libsql://...`) y un token.
2. Sube este repositorio a GitHub y crea el proyecto en https://vercel.com
   importándolo. Vercel detecta Next solo.
3. En Vercel, Settings → Environment Variables, añade:
   - `ADMIN_CLAVE`: la clave del panel.
   - `TURSO_DATABASE_URL`: la URL de Turso.
   - `TURSO_AUTH_TOKEN`: el token de Turso.
4. Despliega. La primera visita crea las tablas y los dos quesos sin precio.

Para pasar lo que ya tengas en el archivo local a Turso, instala la CLI de
Turso y ejecuta `turso db shell villareal < copia.sql`, donde `copia.sql`
sale de `sqlite3 datos/villareal.db .dump`. Si prefieres empezar de cero en
la nube, no hace falta nada.

Con las mismas dos variables en `.env.local`, `npm run dev` y `npm run copia`
trabajan contra Turso desde tu ordenador.

## Dónde está cada cosa

```
src/config/negocio.ts     Nombre, WhatsApp, dirección, RIF. Lo que falta está vacío, no inventado
src/styles/tokens.css     Colores y medidas. Nada de colores sueltos en los componentes
src/lib/db.ts             Conexión a la base (archivo local o Turso) y consultas
src/lib/esquema.ts        Las tablas (se crean solas)
src/lib/conexion.ts       Dónde está la base, según el entorno
src/lib/clientes.ts       Clientes y su saldo
src/lib/ventas.ts         Ventas con sus líneas de producto
src/lib/pagos.ts          Pagos: método, moneda, tasa, equivalente en USD
src/lib/cuentas.ts        Qué ventas están pagadas y cuáles por pagar
src/lib/adjuntos.ts       Fotos de las notas de entrega
src/lib/dinero.ts         Conversión y formato de dólares y bolívares
src/lib/acciones.ts       Lo que hacen los formularios del panel
src/lib/copias.ts         Copias de seguridad de la base de datos
scripts/copia.ts          npm run copia
src/lib/sesion.ts         La clave del panel y la cookie
src/proxy.ts              Corta el paso a /admin sin sesión
src/app/page.tsx          La web pública
src/components/entrada-foto.tsx  Reduce la foto en el teléfono antes de subirla
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
- Una venta o un pago mal anotado se **borra** desde la ficha del cliente
  (enlace «Eliminar», con pantalla de confirmación) y se registra de nuevo.
  No hay edición: es más fácil de entender y más difícil de equivocarse.
- **Cuentas por pagar y pagadas.** Los pagos van contra el cliente, no
  contra una venta. Para decir qué notas están pagadas, los pagos se aplican
  a las ventas de la más antigua a la más nueva: una venta está «Pagada» si
  los pagos ya la cubren, «Abonada» si la cubren en parte y «Por pagar» si
  no. Lo pendiente de todas suma el saldo del cliente.
- **Notas de entrega.** Por ahora no se factura. La nota en papel se
  fotografía desde la ficha del cliente y queda guardada en la base, unida
  al cliente y, si se elige, a la venta. El teléfono reduce la foto antes de
  subirla para que pese poco.
- **Lista de clientes para publicidad.** En Clientes, «Descargar lista
  (Excel)» baja un CSV con nombre, teléfono, tipo, cuánto compra y cuándo
  compró por última vez.

Métodos de pago que reconoce: pago móvil, transferencia, efectivo en
bolívares (los tres piden tasa), efectivo en dólares, Zelle, Binance y otro.

## Reglas

- **No inventar.** Si el precio no está, la web dice «consulta el precio del
  día». Si el teléfono no está, la web no muestra ninguno.
- **Escribir en castellano.** Código, comentarios, mensajes y commits.
- **Móvil primero.** El dueño usa el panel desde el teléfono en el local.
- **Ninguna clave en el código.** Van en `.env.local`.

## Pendiente

- Confirmar en `src/config/negocio.ts` qué días abre el local (el horario
  de 9 a 6, el WhatsApp, la razón social, el RIF y la dirección ya están).
- El comprobante de RIF que hay venció el 15/07/2019: conviene renovarlo en
  el SENIAT antes de imprimirlo en facturas o ponerlo en la web.
- Poner precios reales a los productos desde el panel.
- Crear la cuenta de Turso y el proyecto en Vercel (ver «Publicar en
  Vercel»). El código ya está preparado.
- Fotos de los productos.
- Programar `npm run copia` para que la copia salga sola cada día.
- Facturación, cuando el negocio empiece a facturar.
