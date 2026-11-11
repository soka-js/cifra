# Bitácora de CIFRA

Este archivo es la memoria compartida del trabajo. Lo leen SOKA y otra instancia de Claude que revisa tu trabajo desde fuera, así que escribe para alguien que no estuvo en la sesión.

## Instrucciones para Claude Code

- Escribe el plan en la sección "Plan" antes de tocar código y marca qué aprobó SOKA.
- Mantén al día la tabla "Estado".
- Al terminar cada sesión o etapa, agrega una entrada en "Entradas", la más reciente arriba, con el formato de abajo.
- Haz commit de este archivo junto con el código que describe.
- Cifras con recibo: número de pruebas, tiempos medidos, archivos tocados. Nada estimado sin decir que es estimado.

Formato de cada entrada:

    ### AAAA-MM-DD HH:MM, Etapa N: título corto
    - Rama y commits:
    - Qué cambió (archivos principales):
    - Por qué:
    - Verificación (comando y resultado, con números):
    - Qué revisar en la vista previa:
    - Decisiones que necesito de SOKA:
    - Pendientes y riesgos:

## Plan

Escrito el 11 de noviembre de 2026 después de explorar (commit base `b709ac9`). **Aprobación de SOKA: pendiente.** Hasta tenerla solo está hecha la Etapa 0, que no cambia el producto.

### En una frase

El motor de la cifra y el flujo de caja ya funcionan y son correctos; lo que falta para que sea un producto es cerrar la puerta (hoy cualquiera es Mariana, Rosa o el admin), quitar todo número sin recibo y recortar hasta que del QR a la cifra haya un minuto. El plan es restar antes de sumar.

### Lo que comprobé yo mismo

Corrí la app compilada (`next start`) contra un Postgres local desechable y la recorrí con Chrome a 390x844, con contexto de celular, como visitante sin cookies, como usuario nuevo y como tendero nuevo.

Línea base, igual a la del brief: `tsc --noEmit` sin errores, 96 de 96 pruebas en 12 archivos (1,21 s), `next build` limpio en 43,9 s.

Confirmado del brief:

| # del brief | Qué vi | Cómo |
| --- | --- | --- |
| 1 | Un visitante sin ninguna cookie de sesión recibe HTTP 200 en `/app` (datos de Mariana), `/negocio` ("Hola, Rosa · Panadería La Espiga"), `/negocio/cuenta`, `/app/datos` y `/admin` (tablero completo). `/api/export?format=json` le entrega el perfil y los movimientos de Mariana | Recorrido automatizado; capturas `evidencia/e0-anonimo-en-negocio.jpg` y `e0-anonimo-en-admin.jpg` |
| 1 | `/entrar` ofrece tres accesos de un clic: Mariana, La Espiga y "Consola Admin" (`app/entrar/page.tsx:59-95`) | `evidencia/e0-entrar-accesos-1-clic.jpg` |
| 1 | La base queda con `admin@cifra.co`, `role = admin` y la clave publicada apenas entra el primer visitante: la siembra corre sola desde `getCurrentUser` (`lib/auth/session.ts:84`) | Consulta a la base local después del primer visitante |
| 2 | Usuario nuevo con solo 4 datos ve "Viaje a Santa Marta", "$380,000 verificado", "$185,000 en domicilios", "24 %", "+$80,250/mes" | Texto completo del Hoy volcado a archivo |
| 2 | Montos escritos a mano: 58 en `components/`, 16 en `app/` (el brief decía unos 55) | `grep` de literales `_000_00` |
| 3 | Hoy mide 6,1 pantallas con la demo y 4,1 con un usuario nuevo | `scrollHeight / 844` |
| 5, 6 | `/` redirige a `/app`; los pesos salen con comas | Recorrido |
| 8 | 206 archivos con LF en el índice y CRLF en disco | `git ls-files --eol` |

Lo que no estaba en el brief:

| Gravedad | Hallazgo | Dónde |
| --- | --- | --- |
| 1 | Un tendero real no puede registrarse hoy: `/negocio/unirse` lo manda a `/negocio`, donde ya "es" el dueño de La Espiga. La meta 2 está rota por el mismo hueco de seguridad | `lib/auth/session.ts:161`, recorrido |
| 1 | Un negocio puede marcar su propia factura de comisión como pagada sin pagar, y recargarse saldo prepago de la nada | `actions/v3.ts:1105` y `:1085` |
| 1 | `markOnboarded(userId)` es una acción pública sin sesión; `ensureEditableLiquidAccount(userId)` está exportada desde un archivo `'use server'` y devuelve la cuenta (con saldo) del usuario que se le pase | `actions/auth.ts:211`, `actions/v3.ts:56` |
| 1 | Cualquier usuario con sesión obtiene un enlace que lo deja dentro de la cuenta demo | `actions/v3.ts:1225` |
| 1 | `/api/demo/session?redirect=` redirige a cualquier dominio y cambia la sesión con un GET | `app/api/demo/session/route.ts:68` |
| 2 | Un tendero recién registrado ve "Mandato Autorizado Activo" (no autorizó nada) con la llave, el Nequi y la cuenta de otro negocio: `@laespiga.chapinero`, `312 456 7890`, `**** 4821`. Y como canal oficial de pago, un Nequi de relleno: `300 555 0199` | `components/merchant/auto-debit-mandate-card.tsx:278`, `:302`, `:326`; `negocio/(portal)/cuenta/page.tsx:33`; captura `evidencia/e0-tendero-nuevo-mandato-ajeno.jpg` |
| 2 | El Hoy muestra dos respuestas distintas a "cuánto por día": $275.000 (la cifra dividida entre los días) y $203.750 (un "tope de hoy" que multiplica por 0,65 sin explicación), más un tercer número para mañana | `lib/engine/daily-value.ts:38` |
| 2 | "Ahorro verificado" suma montos que manda el navegador; el plan "Plus $9,900/mes" se activa sin cobro | `actions/v3.ts:700`, `:768`, `:958` |
| 2 | Metas del negocio que nadie escribió: meta diaria de $400.000 y costos fijos de $4.500.000 salen de valores por defecto del esquema | `lib/db/schema.ts:457`, `:459` |
| 3 | El escáner de QR de la caja no puede funcionar en producción: la cabecera `Permissions-Policy: camera=()` bloquea la cámara para el propio sitio (y `geolocation=()` bloquea "cerca de mí"). El código de 6 letras sí funciona | `next.config.ts:6` |
| 3 | Entrar con Google enlaza cuentas por correo sin revisar `email_verified` | `api/auth/google/callback/route.ts:55` |
| 4 | Las vitrinas públicas `/b/demo-*` de los negocios demo las ve cualquiera | `app/b/[slug]/page.tsx` |
| 4 | `npm run db:migrate` falla en Windows; `npm run lint` no existe en Next 16; los scripts de punta a punta dependen de la puerta demo y de `/usr/bin/chromium` | `scripts/migrate.mjs:13`, `package.json`, `scripts/e2e-*.mjs` |

Lo que funciona y vale la pena, comprobado de punta a punta con cuentas reales nuevas: registro, modo rápido (saldo $1.200.000, $25.000 al día, pago en 4 días: $1.100.000), registro de negocio, publicar oferta, la persona genera el código, la caja lo valida (pedido $20.000, cobra $18.000, comisión $900, le quedan $17.100) y a la persona le llega el aviso del ahorro.

### Qué conservo

- **El motor** (`lib/engine/`): funciones puras, sin base de datos, con las 96 pruebas. Es lo único validado con gente; no cambio la definición de la cifra.
- **El modo rápido de 4 datos** y **la resta a la vista** ("De dónde sale tu cifra"). Es el producto.
- **La lectura de extractos** en el navegador, como mejora de precisión después de tener cuenta.
- **El núcleo del tendero**: registro, oferta, caja, las 4 cifras del mes, vitrina pública con afiche e informe.
- **La base técnica de sesiones**: token aleatorio guardado como hash, Argon2, límites de intentos, validación con Zod. El problema no es cómo se guarda la sesión sino el atajo que la salta.
- **La marca `is_demo`** en usuarios, negocios y aliados: las ofertas ya se filtran por ella. Sobre eso aíslo la demo.
- **El sistema visual**: tipografía, color y tarjetas están bien resueltos.
- **La API de aliados** (`/api/v1`): se queda como está, fuera del foco.

### Qué corto

Recomiendo borrar el código, no apagarlo: queda en el historial de Git, y varias de estas piezas son además huecos (acciones que escriben plata inventada).

| Qué | Por qué |
| --- | --- |
| Usuario por defecto, `/api/demo/session`, `/demo`, accesos de un clic en `/entrar`, tabla de credenciales en `/admin` | Son la puerta abierta |
| Meta de ahorro, "jugadas", "misiones" y recomendaciones del Hoy | Números inventados. Vuelven cuando se calculen con datos de la persona |
| "Tope de hoy vivo" | Contradice la cifra con un factor sin recibo |
| Plan "Plus $9,900/mes" y la tarjeta de planes | No existe ese plan ni ese cobro |
| Mandato de débito automático y bolsa prepago del negocio | Simulado, muestra datos de otro negocio y deja marcar facturas como pagadas |
| "Mandato Ley 1581 con huella SHA-256" | Teatro. Lo real se queda: autorización al crear cuenta, descargar y borrar datos |
| Selector Persona/Negocio para todos | "Mi negocio" aparece solo si la persona tiene uno |
| Recorrido guiado de demo dentro de la app de todos | La demo se abre desde `/admin` |
| Vitrina de marca blanca y "lanzar sesión embebida" en `/desarrolladores` | Entregaba una sesión demo a cualquiera. La página queda como documentación |
| Admin operando como dueño de negocios reales | El admin mira desde `/admin`; no cobra ni publica a nombre de un tendero |
| Scripts de punta a punta actuales | Dependen de la puerta demo; los reemplaza la suite nueva |

### Qué construyo

1. **Sesión y permisos de verdad.** Sesión solo por cookie. Admin solo por `ADMIN_EMAILS`. Negocio solo por membresía. Una prueba por cada acción del servidor.
2. **La demo, aislada.** Un admin real, desde `/admin`, activa "ver como" sobre su propia sesión, limitado a usuarios con `is_demo`. Mientras dura hay una franja fija "Demo · datos de ejemplo" con cambio Persona/Tendero y salida. Los usuarios demo no tienen clave ni rol. Nadie más puede abrirla.
3. **Un solo número, con recibo.** La cifra validada arriba, su resta debajo y una sola equivalencia por día (la cifra dividida entre los días que faltan).
4. **Hoy en dos pantallas.** Cifra, de dónde sale, "¿Puedo gastar?" contestado ahí mismo y anotar un gasto. Lo demás, a su sección.
5. **Del QR a la cifra sin cuenta.** `/` es pública y su primera pantalla es la primera pregunta. La cuenta se pide solo para guardar.
6. **El tendero, solo y desde el celular.** Registro en dos pasos cortos, primera oferta con una plantilla, afiche con QR, caja.
7. **La suite de pruebas que faltaba**: permisos por acción, rutas sin sesión, recibos de los números y recorridos clave en celular.

### Ideas propias

- **Calcular la cifra de prueba en el navegador.** El motor es puro, así que corre en el celular: hasta que la persona decide guardar, ningún monto sale de su teléfono. La promesa "no guardamos nada hasta que tú digas" pasa a ser literal y comprobable con una prueba que revisa el tráfico de red.
- **"¿Cuánto crees que puedes gastar?" antes de mostrar la cifra.** Un campo opcional. Convierte el hallazgo de las sesiones (19 de 20 creían poder gastar más) en el momento del stand: "Creías $X. Tu cifra es $Y." Además le da a SOKA un dato en vivo para el pitch. Se queda solo si el recorrido completo sigue por debajo del minuto.
- **Prueba de recibo.** Con los 4 datos del brief, todo monto visible en el Hoy tiene que estar en el conjunto que se deriva de esos datos ($1.200.000, $25.000, $100.000, $1.100.000, $275.000 y $0). Cualquier otro número rompe la prueba. Más un guardián que falla si aparece un monto escrito a mano en `app/` o `components/`.
- **Prueba de que ninguna acción se queda sin prueba.** Una metaprueba lista los `export` de los archivos `'use server'` y falla si alguno no tiene su caso de permisos. La regla del brief deja de depender de la memoria de alguien.
- **Demo en el celular del inversor** (opcional, Etapa 5): desde `/admin`, un QR de un solo uso que abre la demo por 30 minutos en otro teléfono, sin ninguna sesión de admin detrás.
- **El regreso natural es el día de pago.** Un aviso ese día: "Te pagaron. Actualiza tu saldo y mira tu cifra nueva". Es el único recordatorio que propongo para la feria.

### Etapas y criterio de salida

Las fechas son estimadas por mí, no medidas. Pitch Day: jueves 19 de noviembre.

| Etapa | Qué | Se cierra cuando (verificable) | Fecha estimada |
| --- | --- | --- | --- |
| 0 | Base de trabajo: rama, fin de línea, `CLAUDE.md`, base local, plan | Hecho en esta sesión | 11 nov |
| 1 | **Cerrar la puerta.** Sesión, admin, demo aislada, permisos por acción, borrado de acciones de plata simulada | Sin sesión: toda ruta de `/app`, `/negocio` (salvo registro y activación) y `/admin` redirige, y las API responden 401. `admin@cifra.co` con la clave publicada no entra. Un correo fuera de `ADMIN_EMAILS` no ve `/admin` ni ejecuta sus acciones. Una prueba de permisos por acción, todas en verde, más la metaprueba. La demo se abre solo desde `/admin` | 11 a 12 nov |
| 2 | **Cada número con recibo.** Pesos con punto, bloques inventados fuera, valores por defecto inventados fuera, lenguaje sin jerga | Prueba de recibo y guardián de literales en verde. Cero apariciones en pantalla de los términos de jerga del brief | 13 nov |
| 3 | **Hoy en dos pantallas** y "¿Puedo gastar?" en el sitio | Hoy mide 2 pantallas o menos a 390x844 con usuario nuevo (hoy 4,1), medido por la prueba | 14 nov |
| 4 | **Del QR a la cifra.** `/` pública, prueba sin cuenta, guardar con cuenta | Recorrido automatizado: de abrir `/` a ver la cifra sin crear cuenta; ningún monto viaja por la red antes de guardar; al crear la cuenta el Hoy muestra la misma cifra | 15 a 16 nov |
| 5 | **Demo para el Pitch Day**: lanzador pulido, tablero de `/admin` honesto, ensayo | Guion del pitch recorrido de principio a fin sin tocar nada fuera de `/admin` y la demo | 17 nov (18 de colchón) |
| 6 | **El tendero se registra solo**: página pública del negocio, registro corto, cuenta honesta, cámara para el QR | Recorrido automatizado en celular: de `/negocio` sin sesión a validar un código en caja | Después del pitch |
| 7 | **Feria**: ofertas reales de Las Aguas, afiches, aviso del día de pago, embudo de la feria en `/admin` | Lista de revisión de la feria completa | Antes de la feria |

Orden y por qué: la 1 va primero porque es regla del brief y porque sin ella la meta 2 es imposible. La 2 va antes que la 3 porque no tiene sentido diseñar el Hoy alrededor de bloques que se van. La 4 depende de la 3 porque el visitante debe caer en el Hoy nuevo. La 5 va al final del tramo del pitch porque muestra lo que dejaron las anteriores; aun así, desde la Etapa 1 SOKA tiene una demo que funciona.

### Riesgo de producción que no puede esperar al plan

Si la base de producción ya recibió una visita anónima (casi seguro), hoy cualquiera puede entrar como administrador a `cifra` en producción con el correo y la clave que la propia página publica, ver el tablero con datos reales y los contactos de `leads`, aprobar pagos y crear llaves de aliados. Además, todo visitante anónimo ha estado escribiendo sobre la misma cuenta de Mariana.

No toqué ni voy a tocar producción. Lo que propongo, a decisión de SOKA:

1. Mientras llega la Etapa 1: activar la protección de despliegues de Vercel sobre producción, o aceptar el riesgo unos días a sabiendas.
2. Con la Etapa 1: una migración que, al desplegar, deja `role = 'user'` en todos los usuarios, quita la clave a los usuarios `is_demo` y borra sus sesiones. No borra datos.
3. Después de desplegar: SOKA reinicia la demo desde `/admin` (borra y vuelve a sembrar solo lo marcado `is_demo`) y revisa en producción las llaves de aliados y los pagos aprobados que no reconozca. Le dejo las consultas de solo lectura.

### Decisiones que necesito de SOKA

1. ¿Apruebas el plan y el orden?
2. ¿Autorizas la migración de saneamiento del punto anterior?
3. **Antes de subir la rama:** ¿el entorno "Preview" de Vercel tiene su propia `DATABASE_URL` (rama de desarrollo de Neon)? `vercel-build` corre migraciones contra la base que vea la compilación; si Preview comparte la de producción, subir la rama tocaría producción. No hago `git push` hasta que lo confirmes.
4. ¿Borro el código de lo que corto (recomendado) o solo lo apago?
5. ¿Incluyo la pregunta "¿cuánto crees que puedes gastar?"?
6. Canales reales de pago de CIFRA (llave Bre-B, Nequi). Mientras no estén en variables de entorno, la cuenta del tendero no muestra ninguno.
7. Fecha de la feria y negocios reales de Las Aguas con los que se puede contar.

### Qué aprobó SOKA

(Nada todavía.)

## Estado

| Etapa | Qué | Estado | Solicitud de cambio |
| --- | --- | --- | --- |
| 0 | Base de trabajo y plan | Hecha, commit local en `producto-v1` | Sin subir (ver decisión 3) |
| 1 | Cerrar la puerta (seguridad) | Espera aprobación | |
| 2 | Cada número con recibo | Pendiente | |
| 3 | Hoy en dos pantallas | Pendiente | |
| 4 | Del QR a la cifra sin cuenta | Pendiente | |
| 5 | Demo para el Pitch Day | Pendiente | |
| 6 | El tendero se registra solo | Pendiente | |
| 7 | Feria | Pendiente | |

## Entradas

### 2026-11-11 16:20, Etapa 0: base de trabajo y plan

- Rama y commits: `producto-v1`, creada desde `main` en `b709ac9`. Un commit local, sin subir.
- Qué cambió (archivos principales):
  - `docs/producto/BITACORA.md`: plan, estado y esta entrada. `docs/producto/BRIEF.md` y `evidencia/` entran al repositorio; agregué 5 capturas `e0-*.jpg` de mi recorrido.
  - `.gitattributes`: `* text=auto eol=lf` y binarios declarados.
  - `CLAUDE.md`: principios, mapa, comandos y convenciones.
  - `devdb/` (`package.json`, `package-lock.json`, `start.mjs`): Postgres 18.6 local desechable en `127.0.0.1:54329` con `cifra_dev` y `cifra_test`. Fuera de `web/` para que Vercel no lo instale. `.gitignore` ignora `devdb/data/`.
  - `web/scripts/migrate.mjs`: usa `fileURLToPath` para la carpeta de migraciones.
- Por qué: el brief pide explorar y planear antes de cambios grandes, dejar `.gitattributes` y `CLAUDE.md`, y no tocar producción. Esta máquina no tenía Postgres ni Docker corriendo, así que hacía falta una base local reproducible. El arreglo de `migrate.mjs` era necesario para trabajar: en Windows `new URL(...).pathname` devuelve `/C:/...` y Drizzle respondía "Can't find meta/_journal.json file".
- Verificación (comando y resultado, con números):
  - `npx tsc --noEmit`: 0 errores.
  - `npx vitest run`: 12 archivos, 96 de 96 pruebas, 1,21 s.
  - `npx next build`: sin errores, 43,9 s.
  - `npm run db:migrate` contra la base local: "Migraciones aplicadas" (antes del arreglo fallaba).
  - `devdb`: `npm start` en una carpeta limpia crea `cifra_dev` y `cifra_test` (`show server_version` = 18.6); `npm run stop` libera el puerto.
  - Recorridos a 390x844 con Chrome: 13 rutas como visitante sin cookies, 17 pantallas como usuario nuevo, 12 como tendero nuevo y la validación en caja del código `9M6GCR`. Resultados en "Lo que comprobé yo mismo".
  - Ningún cambio en `web/src`: el producto se comporta igual que en `b709ac9`.
- Qué revisar en la vista previa: nada todavía; esta etapa no cambia la app y la rama no está subida.
- Decisiones que necesito de SOKA: las 7 de la sección "Decisiones que necesito de SOKA". Las tres primeras bloquean la Etapa 1 y la subida de la rama.
- Pendientes y riesgos:
  - El riesgo de producción descrito arriba sigue abierto hasta desplegar la Etapa 1.
  - No medí el tiempo de una persona real del QR a la cifra; hoy hay tres pantallas antes de la primera pregunta (registro, confianza, paso 1). Se mide en la Etapa 4.
  - `embedded-postgres` es una dependencia nueva solo de desarrollo (109 MB instalados en Windows), fija en la versión `18.6.0-beta.19`.
  - Los archivos de trabajo quedaron en LF después de aplicar `.gitattributes`; si otra copia del repositorio muestra archivos modificados, basta con `git add --renormalize .`.
