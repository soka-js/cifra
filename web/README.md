# CIFRA (producto)

Cuánto puedes gastar hasta tu próximo pago, en un solo número. Esta carpeta es el producto real: usuarios, base de datos,
lectura de extractos, motor de la cifra, API para entidades y la landing con analítica. El prototipo de demostración sigue en
la raíz del repositorio.

## Cómo se calcula la cifra

```
Puedes gastar = saldo
              - cobros fijos que faltan antes del próximo ingreso
              - gasto del día a día proyectado hasta el próximo ingreso
              - colchón
```

- **Saldo:** el de las cuentas que cuentan para la cifra (las tarjetas de crédito no). Si el saldo es de hace más de tres
  días, la app lo advierte y proyecta el gasto desde esa fecha.
- **Próximo ingreso:** lo que la persona configuró o, si no, el pagador cuyos abonos se repiten cada mes, quincena o semana.
- **Cobros fijos:** series del mismo comercio con intervalos regulares y montos parecidos (`src/lib/engine/recurring.ts`).
  La persona puede marcar "no es un cobro fijo".
- **Día a día:** promedio diario de las últimas 8 semanas, sin cobros fijos ni pagos de tarjeta, recortando los días por
  encima del percentil 95.
- **¿Puedo hacer este gasto?** compara el monto contra esa misma cifra: sí, justo (queda menos de tres días de gasto
  normal) o no (con cuánto falta).

El motor es TypeScript puro, sin base de datos, en `src/lib/engine`, con pruebas en `__tests__`.

## Fuentes de datos

| Fuente | Cómo llega | Estado |
| --- | --- | --- |
| Entidad aliada | La cooperativa o banco envía cuentas y movimientos por la API v1 y abre CIFRA en su app con un enlace de un solo uso | Lista |
| Extracto | La persona sube el CSV o Excel de su banco. Se lee en el navegador y solo se envían fecha, descripción y valor | Lista |
| Finanzas abiertas | La autorización se da en la app de la otra entidad; en CIFRA solo se ve qué entidad comparte qué | Modelo de datos listo; sin entidades activas |

La pantalla **Tus datos** muestra cada fuente con su entidad, qué datos trae, desde cuándo y quién los tocó, y permite borrarla.

## Correr en local

Requiere Node 20+ y Postgres 14+.

```bash
cd web
cp .env.example .env.local      # pon tu DATABASE_URL
npm install
npm run db:migrate
npm run dev                     # http://localhost:3000
npm test                        # pruebas del motor y del lector de extractos
```

## Desplegar en Vercel con Neon

1. En Vercel, **Add New Project** e importa `soka-js/cifra`. En **Root Directory** elige `web`.
2. En **Storage**, crea una base **Neon** y conéctala al proyecto. Eso agrega `DATABASE_URL` (y `DATABASE_URL_UNPOOLED`).
3. Agrega las variables: `NEXT_PUBLIC_SITE_URL` (la URL final, sin barra), `NEXT_PUBLIC_CONTACT_EMAIL`, `ADMIN_EMAILS` y,
   si quieres GA4, `NEXT_PUBLIC_GA_ID`.
4. Despliega. El script `vercel-build` aplica las migraciones antes de compilar.

## Entidades aliadas

```bash
DATABASE_URL=... npm run partner:create -- "Cooperativa Ejemplo"
```

Imprime la llave `cfk_...` una sola vez. La documentación de la API está en `/desarrolladores`.

## Métricas

`/admin` (solo para los correos en `ADMIN_EMAILS`) muestra visitantes, clics en el CTA, registros, extractos subidos,
rebote, tiempo y profundidad de scroll por variante del titular, con el valor p de la prueba A/B, las fuentes por UTM y las
entidades que pidieron demo. Los eventos se guardan en la tabla `events` con un id anónimo por navegador; los bots se descartan.

## Seguridad y datos

- Contraseñas con argon2id; sesiones con token aleatorio guardado como hash; cookies `httpOnly`, `secure` y `sameSite=lax`.
- Límite de intentos en ingreso, registro, formularios, importación y API.
- Llaves de API guardadas como hash. Enlaces embebidos de un solo uso que vencen en 2 minutos.
- Borrar la cuenta elimina en cascada usuario, fuentes, cuentas, movimientos, marcas, compromisos y registro de acceso.
- Política de datos (Ley 1581) en `/privacidad`, términos en `/terminos`.

## Pendiente conocido

- Recuperar contraseña por correo (necesita un proveedor de correo, por ejemplo Resend).
- Lectores para extractos en PDF (Nequi, Bancolombia, Davivienda) cuando tengamos muestras reales.
- Conexión de finanzas abiertas cuando la Superintendencia publique los estándares de historial transaccional.
