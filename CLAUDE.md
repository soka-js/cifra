# CIFRA

CIFRA le dice a una persona, en un solo número, cuánto puede gastar hoy sin quedarse corta antes del próximo pago, y le muestra de dónde sale ese número. Del otro lado, el negocio del barrio publica ofertas, valida un código en caja y paga el 5 % solo de la venta que CIFRA le trae.

Antes de tocar nada, lee:

- `docs/producto/BRIEF.md`: el encargo y la evidencia.
- `docs/producto/BITACORA.md`: el plan, el estado de cada etapa y lo que se hizo. Es la memoria del proyecto: se actualiza y se sube junto con el código que describe.
- `web/AGENTS.md`: esta versión de Next.js (16) cambió frente a lo que conoces. Consulta `web/node_modules/next/dist/docs/` antes de escribir código.

## Principios que no se negocian

1. **Seguridad primero.** Ninguna ruta muestra datos sin sesión. La sesión sale solo de la cookie `cf_session`; no hay usuario por defecto. El admin sale solo de `ADMIN_EMAILS`. La demo vive aislada (`is_demo`) y solo se abre desde `/admin`. Cada acción del servidor verifica que el recurso es de quien está en sesión y tiene una prueba que lo demuestra.
2. **Cada número tiene recibo.** Todo peso o porcentaje en pantalla sale de los datos del usuario o va rotulado como ejemplo. Si no hay dato, no hay número. Nada de montos escritos a mano en componentes.
3. **Producción, intocable.** Nunca uses la base ni las variables de producción. Trabaja contra `devdb/` (Postgres local) o una rama de desarrollo de Neon. Nunca subas secretos. Ojo: `vercel-build` corre migraciones contra la `DATABASE_URL` del entorno donde se construye.
4. **Lenguaje.** Español de Colombia, tuteo, sin jerga interna en pantalla (nada de NBA, B2B2C, relámpago, intocables). Pesos con punto de miles: `$1.808.228`.
5. **Revisión.** Nada llega a `main` sin la revisión de SOKA. Se trabaja en `producto-v1`, una solicitud de cambio por etapa.

## Mapa

- `web/`: la aplicación (Next.js 16 App Router, Drizzle, Postgres/Neon, deploy en Vercel con Root Directory = `web`).
  - `src/lib/engine/`: el motor de la cifra. Funciones puras, sin base de datos ni `server-only`, con pruebas. Es lo validado con gente: cámbialo solo con prueba.
  - `src/lib/auth/session.ts`: sesión, admin y acceso a negocio. Toda verificación de identidad pasa por aquí.
  - `src/app/app/`: la persona (Hoy, ¿Puedo?, gastos, ofertas, cobros, datos).
  - `src/app/negocio/`: el tendero (resumen, caja, ofertas, vitrina, cuenta).
  - `src/app/admin/`: operación y demo. Solo `ADMIN_EMAILS`.
  - `src/app/actions/`, `src/app/app/actions.ts`, `src/app/admin/actions.ts`: acciones del servidor. Todo `export` de un archivo `'use server'` es un endpoint público: valida sesión y dueño adentro.
  - `src/lib/db/schema.ts` y `drizzle/`: esquema y migraciones.
  - `test/integration/`: pruebas contra Postgres local. `acciones.matriz.ts` tiene una entrada por acción del servidor; una metaprueba falla si agregas una acción y no la registras ahí.
- `devdb/`: Postgres local desechable. Vive fuera de `web/` para que Vercel no lo instale.
- `docs/producto/`: brief, bitácora y evidencia.

## Comandos

Base local (una terminal aparte, se queda corriendo):

```bash
cd devdb && npm install && npm start     # 127.0.0.1:54329, bases cifra_dev y cifra_test
npm run reset                            # borra los datos locales y arranca de cero
npm run stop                             # apaga un servidor que quedó abierto
```

Aplicación:

```bash
cd web
cp .env.example .env.local    # DATABASE_URL=postgres://cifra:cifra_local@127.0.0.1:54329/cifra_dev
npm install
npm run db:migrate
npm run dev                   # http://localhost:3000
npm run typecheck             # next typegen + tsc
npm test                      # pruebas unitarias (Vitest, sin base de datos)
npm run test:int              # pruebas de permisos y sesión contra cifra_test (necesita devdb corriendo)
npm run e2e:prueba            # punta a punta de la página pública en celular (necesita la app corriendo; no usa base)
npm run build
```

No hay `npm run lint`: `next lint` ya no existe en Next.js 16.

Para entrar a `/admin` en local: pon tu correo en `ADMIN_EMAILS` de `web/.env.local`, crea la cuenta y verifica el correo con "Olvidé mi contraseña" (en desarrollo, la pantalla muestra el enlace cuando no hay servicio de correo).

## Convenciones

- Plata en centavos enteros (`*Minor`, `bigint`). Se muestra siempre con `cop()` de `src/lib/format.ts`; nunca se formatea a mano.
- Fechas del día en Bogotá: `todayInBogota()` de `src/lib/engine/dates.ts`.
- Datos de demostración: siempre con `is_demo = true` y nunca mezclados con datos reales en una consulta.
- Al cerrar una etapa: typecheck, pruebas, build y pruebas de punta a punta de los recorridos clave; se pega la salida en la bitácora y se dice qué revisar en la vista previa.
