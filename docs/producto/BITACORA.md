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

Escrito el 11 de noviembre de 2026 después de explorar (commit base `b709ac9`). **Aprobado por SOKA el mismo día** (detalle en "Qué aprobó SOKA"), con una condición: no se sube la rama hasta confirmar que el entorno Preview de Vercel no comparte la base de producción.

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

Fechas fijas (SOKA, 12 nov, noche): **Semana de la Innovación, con stand, el jueves 19 de noviembre**; es el primer plazo. **Pitch final: jueves 26 de noviembre.** Para la noche del **miércoles 18** debe estar en producción: etapas 1 a 4, la demo desde `/admin` (Etapa 5) y la parte de la feria que no depende de negocios reales (7a). La Etapa 6 puede quedar para el 26. Para desplegar el 18, SOKA necesita revisar la vista previa antes; las fechas de abajo dejan el 18 para su revisión, el merge y el despliegue.

| Etapa | Qué | Se cierra cuando (verificable) | Fecha |
| --- | --- | --- | --- |
| 0 | Base de trabajo: rama, fin de línea, `CLAUDE.md`, base local, plan | Hecho en esta sesión | 11 nov (hecha) |
| 1 | **Cerrar la puerta.** Sesión, admin, demo aislada, permisos por acción, borrado de acciones de plata simulada | Sin sesión: toda ruta de `/app`, `/negocio` (salvo registro y activación) y `/admin` redirige, y las API responden 401. `admin@cifra.co` con la clave publicada no entra. Un correo fuera de `ADMIN_EMAILS` no ve `/admin` ni ejecuta sus acciones. Una prueba de permisos por acción, todas en verde, más la metaprueba. La demo se abre solo desde `/admin` | 12 nov (cerrada en local) |
| 2 | **Cada número con recibo.** Pesos con punto, bloques inventados fuera, valores por defecto inventados fuera, lenguaje sin jerga | Prueba de recibo y guardián de literales en verde. Cero apariciones en pantalla de los términos de jerga del brief | 12 nov (cerrada en local) |
| 3 | **Hoy en dos pantallas** y "¿Puedo gastar?" en el sitio | Hoy mide 2 pantallas o menos a 390x844 con usuario nuevo (hoy 4,1), medido por la prueba | 12 nov (cerrada en local) |
| 4 | **Del QR a la cifra.** `/` pública, prueba sin cuenta, guardar con cuenta | Recorrido automatizado: de abrir `/` a ver la cifra sin crear cuenta; ningún monto viaja por la red antes de guardar; al crear la cuenta el Hoy muestra la misma cifra | 15 nov |
| 5 | **Demo desde `/admin`**: lanzador pulido, tablero de `/admin` honesto, ensayo | Guion del pitch recorrido de principio a fin sin tocar nada fuera de `/admin` y la demo | 16 nov |
| 7a | **Feria, sin negocios reales**: QR que lleva a `/`, embudo de la feria en `/admin`, ofertas sin grupo de control (hecho el 12 nov), y si hay ofertas de ejemplo, rotuladas como ejemplo | Lista de revisión de la feria (sin negocios) completa y recorrido del QR a la cifra en celular | 17 nov |
| — | **Producción**: SOKA revisa la vista previa, aprueba el merge a `main` y despliega | Producción con etapas 1 a 5 y 7a, revisada en celular | 18 nov, noche |
| 6 | **El tendero se registra solo**: página pública del negocio, registro corto, cuenta honesta, cámara para el QR | Recorrido automatizado en celular: de `/negocio` sin sesión a validar un código en caja | 26 nov (pitch) |
| 7b | **Feria, con negocios reales**: ofertas reales de Las Aguas, afiches de cada negocio, aviso del día de pago | Lista de revisión con negocios confirmados | Cuando haya negocios confirmados (hoy no hay ninguno) |

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

11 de noviembre de 2026, 16:25, por el cuadro de preguntas de la sesión:

| Decisión | Respuesta de SOKA |
| --- | --- |
| 1. Plan y orden | **Aprobado, sigue.** |
| 2. Migración de saneamiento en producción (`role = 'user'` a todos, usuarios demo sin clave y sin sesiones; no borra datos) | **Sí, incluirla** en la Etapa 1. Corre cuando SOKA despliegue. |
| 3. ¿Preview de Vercel tiene base propia? | **"No sé, no subas."** Trabajo con commits locales y base local. No hay `git push` ni solicitudes de cambio hasta que SOKA lo confirme en Vercel. |
| 4. Lo que se corta | **Borrar** el código (queda en el historial de Git). |

12 de noviembre de 2026, 14:00, por el cuadro de preguntas de la sesión:

| Decisión | Respuesta de SOKA |
| --- | --- |
| Volver a levantar el Postgres local que el sistema detuvo por memoria | **Sí, levántalo.** |
| Rótulo de la cifra | **"Puedes gastar hasta el…"**, el mismo en la prueba sin cuenta y en el Hoy. |
| 5. Campo opcional "¿cuánto crees que puedes gastar?" | **Se queda.** |

12 de noviembre de 2026, por el cuadro de preguntas de la sesión:

| Decisión | Respuesta de SOKA |
| --- | --- |
| Cerrar los pendientes de la Etapa 2 | **"Sí, cierra todos los pendientes."** |
| Volver a levantar el Postgres local, detenido otra vez por memoria | **Sí, levántalo.** |
| Migración `0008`: además de la estructura, vaciar en producción la meta diaria ($400.000) y los costos fijos ($4.500.000) iguales a los de fábrica, solo en negocios que no son de la demo | **Sí, borra los valores de fábrica.** Corre cuando SOKA despliegue. |

12 de noviembre de 2026, noche, por mensaje:

| Decisión | Respuesta de SOKA |
| --- | --- |
| 3. ¿Preview de Vercel tiene base propia? | **Sí.** En Vercel, Storage > `neon-lime-sail` > conexión con `cifra`, "Create Database Branch For Deployment" está activado para Preview y apagado para Production: cada vista previa corre contra su propia rama de Neon, copia de producción. `DATABASE_URL` figura como "Production and Preview", pero la integración de Neon la reemplaza en Preview. **Autoriza `git push` de `producto-v1` y abrir la solicitud de cambio**, con una condición: antes que nada, confirmar en el log de compilación de la vista previa que las migraciones corrieron contra una rama y no contra la principal; si no se puede confirmar, parar y avisar. **No hacer merge a `main`**: lo aprueba SOKA después de ver la vista previa. |
| Admin en producción | En Vercel solo están `ADMIN_EMAILS`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_SITE_URL` y las variables de la base. No hay Google ni servicio de correo. Pide la forma más simple y segura de entrar a `/admin` en la vista previa y en producción. |
| 7. Fechas | Feria con stand el **jueves 19 de noviembre** (primer plazo); pitch final el **jueves 26**. Para la noche del 18, en producción: etapas 1 a 4, la demo desde `/admin` y lo de la feria que no dependa de negocios reales (QR a `/`, embudo de la feria en `/admin`). La Etapa 6 puede quedar para el 26. |
| Demos del viernes 13 | 10:30 con el equipo de crecimiento de Bold y 3:00 p.m. con Financiera Comultrasan, por Meet. Demo funcionando a las 10:00, preferiblemente en la vista previa; si no, local con un solo comando. Guion de 5 minutos en `docs/producto/DEMO.md`. **No construir nada nuevo para mañana.** |
| Grupo de control del 10 % en las ofertas | **Apagarlo para la feria**: todas las personas ven las ofertas. |
| 7. Negocios de Las Aguas | **Todavía no hay ninguno confirmado.** No inventar negocios; si en la feria hay ofertas de ejemplo, deben decir que son de ejemplo. |
| 6. Canales reales de pago | El mensaje traía el espacio sin llenar ("[COMPLETA AQUÍ…]"). **Sigue abierta.** Mientras tanto, la cuenta del tendero no muestra ningún canal. |
| Vistas previas viejas (`feat/fase-*`, `feat/v3-valor-real`) | Pide revisar si la protección de despliegues las deja públicas y cómo cerrarlas. |

12 de noviembre de 2026, más tarde, por mensaje:

| Decisión | Respuesta de SOKA |
| --- | --- |
| 1. Ensayo del guion en la vista previa | El mensaje trajo las dos opciones sin elegir. **No hay autorización para crear cuentas en la vista previa.** |
| 2. Correo | Dice haber agregado en Vercel (Production y Preview) `RESEND_API_KEY`, `EMAIL_FROM=CIFRA <onboarding@resend.dev>` y las tres variables VAPID. Su correo para todo es el de su cuenta de Resend. Pide comprobar en la vista previa que le llegue el correo de cambio de clave; que a otra persona la app le diga claro que no se pudo enviar, sin fallar en silencio; y una propuesta con costo para el correo de la feria. |
| 3. Google | Tiene el ID del cliente pero no el secreto, así que no lo agregó. Pregunta si el botón aparece solo con el ID y qué configurar en Google Cloud. |
| 4. Asesor con IA (Gemini) | **No se usa. Nada de asesor con IA antes de la feria.** |
| 5. Merge de la solicitud de cambio #3 | **Lo aprueba SOKA el 13 nov, después de las demos, si el ensayo sale bien.** Antes pide los pasos exactos del despliegue: cómo entrar a `/admin`, cómo cambiar la clave de la base sin dejar a Vercel sin acceso y qué revisar después. Quedaron en `docs/producto/DESPLIEGUE.md`. |
| 6. Canales reales de pago | Otra vez sin llenar. **Sigue abierta.** |

Siguen abiertas la 6 (canales reales de pago) y quién hace el ensayo del guion.

13 de noviembre de 2026, por mensaje:

| Decisión | Respuesta de SOKA |
| --- | --- |
| Merge del turno de noche y de `producto-v1` | **Hecho por SOKA a las 9:53 del 13 nov, con su OK**: la solicitud de cambio #4 (`noche-13nov` → `producto-v1`) y la #3 (`producto-v1` → `main`). |
| Despliegue a producción | Producción desplegó `bd01f17`. SOKA revisó el log: `ep-square-brook` y "Migraciones aplicadas". Sin sesión, `/app` y `/admin` llevan a `/entrar`, `/api/export` responde 401 y `/api/demo/session` responde 404. |
| Lo que sigue del despliegue | SOKA agrega las variables y cambia la clave de la base; después sigo con `DESPLIEGUE.md` desde el paso 4. |
| Vista previa de `producto-v1` | **No tocarla hasta las 4:00 p. m. del 13 nov**: SOKA tiene otra demo a las 3:00. Subir a `producto-v1` la reconstruye, así que hasta esa hora no se sube nada. |
| Solicitud de cambio #5 (`etapa-5-admin` → `producto-v1`), de Claude en la nube | Limpia `/admin`. **No tocar `src/app/admin` hoy.** Claude en la nube la mezcla a las 4:10 p. m. y la pasa a `main`. |
| Etapa 4 | Seguir en una rama nueva desde `producto-v1`: un solo formulario para la prueba sin cuenta y el modo rápido con cuenta (`try-cifra.tsx` y `bienvenida/quick-start.tsx`), con las mismas pruebas en verde. **Nada se mezcla a `producto-v1` antes de las 4:30 p. m. del 13 nov.** |

## Estado

| Etapa | Qué | Estado | Solicitud de cambio |
| --- | --- | --- | --- |
| 0 | Base de trabajo y plan | Hecha | #3, en producción desde el 13 nov |
| 1 | Cerrar la puerta (seguridad) | **En producción** (`bd01f17`, 13 nov). SOKA comprobó sin sesión `/app`, `/admin`, `/api/export` y `/api/demo/session` | #3 |
| 2 | Cada número con recibo | **En producción** (`bd01f17`) | #3 |
| 3 | Hoy en dos pantallas | **En producción** (`bd01f17`). Mide 1,58 pantallas con usuario nuevo (antes 4,1) | #3 |
| 4 | Del QR a la cifra sin cuenta | **En producción** lo principal: prueba sin cuenta en `/` y "Guardar mi cifra" hasta el Hoy. **Un solo formulario** para la prueba y el modo rápido con cuenta, en la rama `etapa-4-un-formulario` (sin mezclar). Falta medir a una persona. Meta: 15 nov | #3; la rama nueva, después de las 4:30 p. m. del 13 nov |
| 5 | Demo desde `/admin` | Avance en producción: la franja de demo ya no tapa la barra y `/admin/presentacion` quedó rehecha sin testimonios inventados. Falta el resto del tablero de `/admin`, que sigue con textos viejos ("Aliados B2B2C", "Hipótesis K", el embudo de la landing vieja). Meta: 16 nov | #4 y #3 |
| 7a | Feria sin negocios reales | En producción: ofertas sin grupo de control (`0009`), embudo "Feria: del QR a la cifra guardada" en `/admin` y la lista `docs/producto/FERIA.md`. Falta lo que esa lista marca para antes del 18, como probar el QR en dos celulares. Meta: 17 nov | #4 y #3 |
| 6 | El tendero se registra solo | **En curso** en la rama `etapa-6-tendero` (encima de `etapa-4-un-formulario`, sin subir): registro en dos pasos con autorización de datos, cámara de la caja y ubicación habilitadas, pago en línea con el monto firmado y cuenta sin porcentajes escritos a mano. El recorrido E de `seguridad.e2e.mjs` va de `/negocio` sin sesión a validar un código en caja. Plantillas de oferta según el tipo de negocio. Falta revisar el afiche y la vitrina en celular. Meta: 26 nov | Después de la de la Etapa 4 |
| 7b | Feria con negocios reales | Esperando negocios confirmados | |

## Entradas

### 2026-11-13 22:20, "app real": segunda pasada, las pantallas largas (rama `app-real`)

- Quién: Claude en la sesión de la nube de SOKA ("Continua"). Rama `app-real`, encima de la entrada de abajo. Sin mezclar.
- Qué cambió:
  - **Creador de ofertas del tendero:** quedan a la vista la idea, el título, el descuento, la compra mínima y cuánto le queda. Lo demás (oferta por horas, detalle, cupos, vigencia, tope, horario, solo clientes nuevos, costo de insumos y comisión de su app) va en "Más opciones", con los valores de la plantilla. Si la plantilla es por horas, se abre sola. Los campos siguen en el formulario aunque estén ocultos: la acción del servidor recibe lo mismo que antes.
  - **Cuenta del tendero:** la quincena se lee como una resta, igual que el Hoy de la persona: ventas con código, descuentos, cobrado en caja, comisión y "= Lo que te queda". Reemplaza cuatro tarjetas y una franja. El aviso de "al día" queda en una línea. Sin "pagar por Bre-B / Nequi" en el aviso de corte por pagar, porque todavía no hay canal publicado.
  - **Tus datos:** fuera la insignia "Ley 1581 de 2012 · Habeas Data" (la ley se nombra en el texto), fuera la zona repetida (está en Ajustes) y textos más cortos. "Bitácora de acceso a tus datos" pasa a "Quién ha visto tus datos".
  - **Ajustes:** solo títulos más cortos. Sigue midiendo 3,4 pantallas; es una pantalla de configuración y no la partí.
- Medido con `recorridos.e2e.mjs`, contra la línea base del 13 nov: ofertas del tendero 3,9 a 2,5 pantallas (352 a 227 palabras, 25 a 16 cosas para tocar); cuenta del tendero 2,8 a 1,8 (329 a 236); Tus datos 2,6 a 2,1 (311 a 209). Total de las 18 pantallas: 3.008 a 2.528 palabras.
- Verificación (nube): `npm run typecheck` 0 errores; `npm test` 192 de 192; `npm run build` sin errores; `npm run e2e`: 6 de 6, 10 de 10 (Hoy 1,86 pantallas), prueba sin cuenta en verde, recorridos 6 de 6, seguridad 31 de 31 (E2 publica la oferta con las opciones cerradas; E5 sigue cobrando $18.000 con $900 de comisión). `npm run test:int` no se repitió: no cambió ninguna acción del servidor.
- Pendiente: el texto de la política de cobro de la cuenta (`COMMISSION_POLICY`) sigue largo y nombra Bre-B y Nequi; el cuadre (2,2), la vitrina (2,8), el perfil (2,4) y el informe (2,3) del tendero.
- Decisiones que necesito de SOKA: ninguna nueva.

### 2026-11-13 21:40, "que se sienta como una app real": primera pasada (rama `app-real`)

- Quién: Claude en la sesión de la nube de SOKA, con su OK ("revisa y avanza con lo que ha avanzado Claude Code"). Rama `app-real`, encima de `etapa-6-tendero` (#8). Sin mezclar.
- Por qué: en la llamada del 13 nov, Financiera Comultrasan dijo que la app se ve muy de demo y que al entrar uno queda perdido.
- Antes de tocar nada:
  - Traje de la carpeta de SOKA las ramas `etapa-4-un-formulario` y `etapa-6-tendero`, sin cambios, y abrí #7 y #8. La entrada de las 12:22 había quedado sin verificar; en la nube pasó todo (abajo).
  - `web/e2e/recorridos.e2e.mjs` lo dejó Claude Code sin commit. Va en esta rama como línea base. Corriendo antes de `seguridad.e2e.mjs`, su negocio quedaba en Las Aguas y E4 tocaba el primer "Generar código" de la zona; E4 ahora toca el de su propio negocio.
- Qué cambió:
  - **Sin frases de propaganda dentro de la app:** "Cruce inteligente: gastos × distancia × franja horaria", "Control total de tus campañas", "Creador guiado con protección de margen", "Herramienta gratuita de mostrador y WhatsApp", "Precios directos sin sobreprecio de apps", "Termómetro de ventas de hoy", "Cuentas claras... sin enredos técnicos", "Cruce CIFRA:" y el número de cada cifra del mes ("1.", "2."...). Los textos de entrada de ¿Puedo?, Ofertas y Cobros quedaron en una o dos líneas.
  - **Sin el botón "Volver" en las pantallas que ya están en el menú de abajo** (persona: ¿Puedo?, Gastos, Ofertas, Cobros; tendero: Caja, Ofertas, Cuenta, Vitrina). Las demás lo conservan.
  - **Ofertas de la persona:** fuera el enlace "¿Tienes un negocio? Portal tendero" y, sin ofertas, ya no le pide a la persona "publicar su primera campaña".
  - **Inicio del tendero:** arriba "Hola, Carlos" y el nombre del negocio; primero "Cobrar un código", luego sus ofertas y después el cuadre. El menú de abajo queda Inicio, Caja, Ofertas, Cuenta y Vitrina; el cuadre y el informe se abren desde el inicio y desde el menú lateral.
  - **La comisión del inicio del tendero decía "(5 %)" escrito a mano;** ahora sale de `commissionBps` con `percentFromBps`, como el resto del portal desde la Etapa 6.
  - **Bienvenida en el Hoy** al llegar de la prueba o del modo rápido (`?listo=rapido`): tres renglones que dicen qué es la cifra, dónde preguntar y qué hay en el menú. No guarda nada; desaparece con "Entendido" o al volver a entrar.
- Medido con `recorridos.e2e.mjs`, antes y después (palabras en pantalla): ¿Puedo? 82 a 64, Ofertas 119 a 90, Cobros 66 a 54, inicio del tendero 226 a 177 (2,4 a 2,1 pantallas), Caja 42 a 36. Total de las 18 pantallas medidas: 3.008 a 2.852. El Hoy con la bienvenida mide 1,86 pantallas (la meta de la Etapa 3 es 2 o menos).
- Verificación (nube, Linux, Node 22, Postgres 16 local), con la rama completa:
  - `npm run typecheck`: 0 errores. `npm test`: 20 archivos, 192 de 192.
  - `npm run test:int`: 8 archivos, 278 de 278 (en `etapa-6-tendero`; esta rama no toca acciones del servidor).
  - `npm run build`: sin errores.
  - `npm run e2e`: guardar cifra 6 de 6, Hoy 10 de 10, prueba sin cuenta en verde, recorridos 6 de 6, seguridad 31 de 31.
- Qué revisar en la vista previa de `app-real`: entrar como persona y como tendero desde la demo de `/admin`, recorrer el menú de abajo y decir qué todavía suena a demo.
- Pendiente para la siguiente pasada: el creador de ofertas (3,7 pantallas), la cuenta del tendero (2,6), Ajustes (3,4) y Tus datos (2,6).
- Decisiones que necesito de SOKA: si el cuadre puede salir del menú de abajo del tendero (hoy queda en el inicio y en el menú lateral).

### 2026-11-13 12:22, Etapa 6: revisión a ojo del tendero en celular, y lo que encontró

- Rama: `etapa-6-tendero`. Sin subir ni mezclar.
- Cómo lo revisé: la app compilada, local, contra `cifra_dev`. Un guion de Playwright a 390x844 registró una peluquería de prueba y sacó capturas del registro, la primera oferta, la cuenta, la caja y la vitrina. Las capturas quedaron fuera del repositorio. Primero lo intenté con Chrome, pero esa ventana no baja de 1280 px de ancho.
- Lo que encontré y arreglé:
  - **Al tocar "Seguir" en el registro, el navegador intentaba enviar el paso 2 vacío** y mostraba "Completa este campo" sobre "Tu nombre" apenas aparecía.
    - Causa: React reusaba el mismo botón y le cambiaba el tipo a "submit" en medio del toque.
    - Arreglo: cada botón tiene su propia `key`. El de las cuatro preguntas de la Etapa 4 ya la tenía.
    - Prueba: el paso E1 de `seguridad.e2e.mjs` cuenta los eventos `invalid` del formulario al tocar "Seguir" y exige cero. Quería correrla primero contra el build anterior, para ver que falla con el error, pero esa corrida se detuvo (ver Verificación).
  - **El porcentaje se partía en dos renglones** ("5" al final de una línea y "%" en la siguiente). `percentFromBps` usa ahora un espacio de no separación.
  - En la cuenta, el título "Garantía operativa: cero cobros micro por venta individual" pasó a "Un solo cobro por quincena, no uno por venta".
- Lo que se ve bien: los dos pasos del registro y el aviso de la compra promedio; sin marcar la autorización el navegador no deja registrar; la peluquería ve tres plantillas (primera visita, tarde tranquila y monto fijo) y ninguna de "horneados"; la cuenta dice la comisión del negocio, "Lo que te queda" y no muestra ningún canal de pago inventado.
- Pendiente: el creador de ofertas es largo en el celular (tres pasos en una sola página, de unas tres pantallas y media de alto). Lo dejo anotado para después del pitch.
- Verificación, **incompleta**:
  - `npm run typecheck`: 0 errores. `npm test`: 20 archivos, **192 de 192**.
  - **Sin correr** `npm run build`, `npm run e2e` ni `npm run test:int`. A las 12:25 el sistema detuvo, por falta de memoria, la base local (`devdb`) y la corrida de punta a punta contra el build anterior. No los volví a levantar por mi cuenta.
  - Tampoco está comprobado que el control nuevo de E1 falle con el error y pase con el arreglo. Es lo primero que hay que correr cuando vuelva la base.
- Decisiones que necesito de SOKA: si puedo volver a levantar la base local (`cd devdb && npm start`) para terminar esta verificación.

### 2026-11-13 12:12, Etapa 6: el tendero puede borrar su horario y su presentación

- Rama: `etapa-6-tendero`. Sin subir ni mezclar.
- Qué cambió: `saveMerchantFeaturedItemsAction` (`web/src/app/actions/v3.ts`), que guarda la vitrina.
  - Antes, un horario o una presentación vacíos conservaban el valor anterior: el tendero no podía quitarlos, y la vitrina pública seguía mostrando un horario que ya no era cierto. Era el pendiente "el perfil no permite borrar el horario".
  - Ahora, si la pantalla manda el campo vacío, queda vacío y la vitrina no lo muestra. Si no lo manda, no se toca.
  - El horario se corta en 80 caracteres, igual que en Perfil (antes 90).
  - Importa más ahora que el registro ya no inventa un horario.
- Prueba nueva: `web/test/integration/vitrina.itest.ts` (3). Campos vacíos dejan la vitrina sin horario ni presentación; con texto, guarda lo escrito; sin los campos, no los toca. La acción sigue en la matriz de permisos como antes.
- Verificación (este equipo, `devdb` local), con toda la rama:
  - `npm run typecheck`: 0 errores. `npm test`: 20 archivos, **192 de 192**.
  - `npm run build`: sin errores.
  - `npm run e2e`: **58 de 58 pasos** (6 + 10 + 11 + 31; la prueba sin cuenta en 588 ms).
  - `npm run test:int`: 8 archivos, **276 de 276**, 272 s.
- Decisiones que necesito de SOKA: ninguna.

### 2026-11-13 12:05, Etapa 6: la comisión que se ve es la del negocio, no un "5 %" escrito a mano

- Rama: `etapa-6-tendero`. Sin subir ni mezclar.
- Qué cambió:
  - **Dentro del portal del tendero se muestra la comisión guardada en el negocio** (`merchant.commissionBps`), con `percentFromBps`.
    - La caja decía "5 % al corte quincenal" y, si el código no traía la comisión, calculaba con 500 escrito a mano. Ahora usa la del negocio.
    - El informe del mes decía "del 5 % de comisión CIFRA".
    - La activación por enlace decía "una comisión del 5 %".
  - **Las páginas públicas** (portada, `/negocio/unirse` y `/negocio/registro`) muestran la comisión de un negocio nuevo desde una sola fuente: `DEFAULT_COMMISSION_BPS` en `web/src/lib/commission.ts` (nuevo), que sale de la regla de cobro del motor.
- Prueba nueva: `web/src/lib/__tests__/comision.test.ts` (2). Comprueba que esa comisión anunciada es la misma que la base pone por defecto a un negocio y a cada venta (`commission_bps = 500`). Si alguien cambia una sin la otra, la prueba falla.
- Lo que no toqué: `/admin` (pedido de SOKA para hoy) y el ejemplo de `/desarrolladores`, que está rotulado como ejemplo.
- Verificación (este equipo, `devdb` local):
  - `npm run typecheck`: 0 errores. `npm test`: 20 archivos, **192 de 192**.
  - `npm run build`: sin errores.
  - `npm run e2e`: **58 de 58 pasos** (6 + 10 + 11 + 31). E5 sigue cobrando $18.000 con comisión de $900 en la caja.
  - `npm run test:int`: 7 archivos, **273 de 273**, 270 s.
- Decisiones que necesito de SOKA: ninguna.

### 2026-11-13 11:59, Etapa 6: plantillas de oferta según el tipo de negocio, y fuera el "OFF"

- Rama: `etapa-6-tendero`, encima de la entrada de abajo. Sin subir ni mezclar.
- Qué cambió:
  - **Las plantillas de la primera oferta dependen del tipo de negocio** (`web/src/lib/offer-templates.ts`, nuevo; las usa `web/src/app/negocio/(portal)/ofertas/offer-creator.tsx`).
    - Antes, toda tienda veía "25 % OFF en horneados y productos frescos de la tarde", aunque fuera una peluquería o una droguería.
    - Ahora la plantilla "antes del cierre" solo sale donde hay producto del día que se pierde, y nombra lo de ese negocio: pan y horneados en una panadería, onces y postres en una cafetería, el menú del día en un restaurante, frutas y verduras en un fruver, productos frescos del día en una tienda.
    - En papelería, droguería, peluquería, servicios y "otro" no sale esa plantilla.
    - El título de la plantilla de monto fijo se arma con los mismos montos que llena en el formulario.
  - **Sin "OFF" en pantalla**, en las insignias del mapa y de la lista de ofertas de la persona:
    - un porcentaje se ve "-10 %", igual que un monto fijo ya se veía "-$3.000";
    - los títulos que sugiere el cuadre del tendero y el de la oferta de ejemplo de la demo dicen "de descuento".
  - Los textos de las plantillas quedaron sin emojis ("⚡").
  - La comisión en el creador de ofertas también sale de `percentFromBps`.
- Prueba nueva: `web/src/lib/__tests__/plantillas-oferta.test.ts` (5), que comprueba:
  - todo tipo de negocio tiene plantillas;
  - "antes del cierre" solo donde corresponde, y sin "horneados" en una peluquería;
  - un tipo desconocido no hereda nada;
  - nada de "OFF" ni emojis;
  - los montos del título son los del formulario.
- Verificación (este equipo, `devdb` local):
  - `npm run typecheck`: 0 errores. `npm test`: 19 archivos, **190 de 190**.
  - `npm run build`: sin errores.
  - `npm run e2e`: **58 de 58 pasos** (6 + 10 + 11 + 31). E2 publica la primera oferta de una cafetería con la plantilla nueva.
  - `npm run test:int`: 7 archivos, **273 de 273**, 193 s.
- Decisiones que necesito de SOKA: ninguna.

### 2026-11-13 11:57, Etapa 6: el tendero se registra solo, la caja abre la cámara y el pago en línea no se puede rebajar

- Rama: `etapa-6-tendero`, creada encima de `etapa-4-un-formulario` (`4b3ef85`). Va en una solicitud de cambio aparte, después de la de la Etapa 4. Sin subir ni mezclar: mismas razones que la Etapa 4. No toqué `src/app/admin`.
- Nota de git: `git switch` no pudo reescribir `.git/HEAD` porque otro programa del equipo lo tenía abierto (parece ser VS Code). No cerré nada. Hice los commits de esta rama con `git commit-tree` y `git update-ref`, que no tocan `HEAD`, y comprobé que cada commit fuera idéntico a la carpeta de trabajo. A las 12:20 el archivo se liberó: la carpeta quedó en `etapa-6-tendero`, sin cambios pendientes.
- Qué cambió:
  - **Registro del negocio en dos pasos** (`web/src/app/negocio/unirse/register-merchant-form.tsx`):
    - Paso "Tu negocio": nombre, tipo, zona, dirección y compra promedio.
    - Paso "Tus datos": nombre, WhatsApp y, sin sesión, correo, clave y la autorización.
    - Salieron del registro el mapa, el barrio, el horario y la llave de pago; se agregan después en Perfil. El punto del mapa arranca en el centro de la zona.
    - **El horario ya no se inventa:** antes se guardaba "Lun a Sáb 7:00 a. m. – 8:00 p. m." si el tendero no escribía ninguno. Ahora queda vacío y no se muestra.
  - **Autorización de datos del tendero** (Ley 1581), en `web/src/components/negocio/merchant-consent.tsx`.
    - La piden el registro y la activación por enlace (`/negocio/activar/[token]`) cuando crean una cuenta nueva.
    - El servidor (`selfRegisterMerchant` y `redeemMerchantInvite` en `web/src/app/actions/merchant.ts`) no crea la cuenta sin ella.
    - **Antes, las dos acciones guardaban la fecha y la versión de la autorización (`consentAt`, `consentVersion`) sin haberla pedido nunca.** Ahora esa fecha corresponde a una casilla que el tendero marcó.
    - La activación por enlace pide ahora una clave de 10 caracteres, como el resto (antes 8).
  - **Cámara de la caja y "usar mi ubicación"** (`web/next.config.ts`).
    - La cabecera `Permissions-Policy` decía `camera=()` y `geolocation=()`. Con eso el navegador bloquea la cámara y la ubicación incluso para CIFRA: el botón "Escanear QR" de la caja y "usar mi ubicación" del mapa nunca podían funcionar. Era el hallazgo de gravedad 3 del plan.
    - Ahora es `camera=(self), geolocation=(self)`: solo CIFRA puede pedirlas, nunca un sitio que la meta en un marco, y el navegador igual le pregunta a la persona. El micrófono sigue cerrado.
    - Va en todo el sitio porque la app cambia de pantalla sin recargar: el permiso lo fija la primera página que se abrió.
  - **Pago de la comisión por Wompi** (`web/src/lib/payments/wompi.ts`, nuevo, y `web/src/app/api/webhooks/wompi/route.ts`). Hoy está apagado en producción, porque no están las llaves de Wompi; lo dejé seguro para cuando se prenda. Antes:
    - el enlace de pago se armaba en el navegador con el monto en la dirección y sin firma, así que un negocio podía cambiar `amount-in-cents` y pagar $1 con la referencia de su corte;
    - el aviso de Wompi marcaba el corte como pagado sin mirar cuánto llegó;
    - cada aviso repetido registraba otro pago;
    - y la firma se comparaba sin tiempo constante.
  - Ahora:
    - El enlace se arma en el servidor con la firma de integridad de Wompi (`WOMPI_INTEGRITY_SECRET`, que ya estaba en `.env.example` sin usarse). Sin esa llave no se muestra el botón de pago en línea.
    - El aviso exige que la firma cubra el id, el estado y el monto, y la compara en tiempo constante.
    - El corte se marca pagado solo si el pago es en pesos y lo cubre completo. Si no, el pago queda "reportado" con una nota de cuánto falta, el corte pasa a "en verificación" y el equipo lo revisa.
    - Un aviso repetido se registra una sola vez.
  - **La cuenta del tendero** (`/negocio/cuenta`):
    - El porcentaje de comisión sale del negocio (`commissionBps`) con `percentFromBps` (nuevo, en `web/src/lib/format.ts`). Antes decía "5 %" y "95 %" escrito a mano en cinco lugares.
    - Se quitó "($900 cada vez)", un monto escrito a mano.
    - Se quitó el botón "Autocompletar referencia de hoy", que inventaba un comprobante de pago ("BREB-…") en la cuenta de un negocio real.
- Arreglo encontrado por la prueba de punta a punta:
  - El paso 1 del registro nunca dejaba seguir: leía la compra promedio con `form.elements.namedItem('typicalTicket')`. Ese nombre lo tienen dos elementos, la caja visible (por su `id`) y el campo oculto con el valor limpio (por su `name`), y con dos resultados la lectura daba vacío.
  - Ahora lee con `FormData`, que solo mira los `name`.
- Pruebas nuevas:
  - `web/src/lib/__tests__/encabezados.test.ts` (2): cámara y ubicación solo para CIFRA, micrófono para nadie, y ninguna ruta lo vuelve a cerrar.
  - `web/src/lib/__tests__/wompi.test.ts` (11): la firma del enlace amarra el monto y el secreto no va en la dirección; un aviso con otro secreto, con el monto cambiado después de firmar o con una firma que no cubre el monto se rechaza; un pago corto, en otra moneda o sobre un corte ya pagado queda para revisar.
  - `web/test/integration/wompi.itest.ts` (5, contra la base): sin secreto, 503; con otra firma, 401 y nada cambia; un pago de $1 no marca el corte pagado; el pago completo sí, y repetido registra un solo pago; otros avisos no cambian nada.
  - `web/test/integration/acciones-publicas.itest.ts`: sin la autorización no se crea la cuenta ni el negocio (registro y activación); con una clave corta tampoco; sin horario, el negocio queda sin horario.
  - `web/e2e/seguridad.e2e.mjs`, paso E1: recorre los dos pasos, comprueba que sin compra promedio no deja seguir y marca la autorización.
- Verificación (este equipo, `devdb` local), con esta rama completa (Etapa 4 debajo):
  - `npm run typecheck`: 0 errores. `npm test`: 18 archivos, **185 de 185**.
  - `npm run test:int`: 7 archivos, **273 de 273**, 214 s.
  - `npm run build`: sin errores.
  - `npm run e2e`: **58 de 58 pasos**: guardar cifra 6 de 6, Hoy 10 de 10, prueba sin cuenta 11 de 11 (379 ms) y seguridad 31 de 31. Ahí está el recorrido E completo: registro en dos pasos, primera oferta, la persona genera su código, la caja cobra $18.000 con comisión de $900 y le quedan $17.100, el código no sirve dos veces y llega el aviso del ahorro.
  - La corrida anterior falló en E1 por el error de la compra promedio. Después del arreglo pasó todo.
- Qué revisar en la vista previa de esta rama, cuando se suba:
  1. Sin sesión, `/negocio` lleva al registro. Sin compra promedio no deja seguir. En el paso 2, sin marcar la autorización no deja registrar.
  2. Con el negocio creado, la caja: "Escanear QR" pide permiso de cámara en Android con Chrome. En iPhone no hay lector de QR en el navegador y la caja pide escribir las 6 letras.
  3. `/negocio/cuenta`: la comisión dice el porcentaje del negocio y no hay botón de autocompletar.
- Decisiones que necesito de SOKA:
  1. Cuando se prenda Wompi: agregar en Vercel `NEXT_PUBLIC_WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET` y `WOMPI_EVENTS_SECRET`, y apuntar los eventos de Wompi a `/api/webhooks/wompi`. Sin la llave de integridad no aparece el botón de pago en línea. Nada de esto es urgente.
- Pendientes y riesgos:
  - Las plantillas de oferta hablan de "horneados" aunque el negocio sea una peluquería. Hay que ajustarlas al tipo de negocio. (Resuelto en la entrada de las 11:59.)
  - Un aviso repetido se registra una sola vez porque el corte se bloquea mientras se revisa el pago. Un índice único sobre `wompi_transaction_id` lo haría más firme, pero pide una migración; queda para cuando se prenda Wompi.

### 2026-11-13 11:51, Etapa 4: el servidor lee el formulario con la misma función que la prueba

- Rama: `etapa-4-un-formulario`, encima de la entrada de abajo. Sin subir ni mezclar (mismas razones).
- Qué cambió:
  - **`saveQuickStart` (`web/src/app/app/actions.ts`) lee el formulario con `parseQuickForm` (`web/src/lib/quick-form.ts`)**, la misma función que usa la prueba sin cuenta en el navegador. Antes tenía su propia copia de esa lectura. Era el pendiente de la entrada de abajo.
  - Lo que la persona vio como su cifra en la prueba es exactamente lo que se guarda al crear la cuenta: mismos límites (el día del mes entre 1 y 31, hasta 15 cobros fijos) y mismos mensajes de error, en el mismo paso.
  - Un solo texto cambia en pantalla: con más de 15 cobros fijos, el aviso ahora es "Escribe hasta 15 cobros fijos. Los demás los puedes agregar después." Antes decía "…en Ajustes" con cuenta y no decía nada más en la prueba.
- Prueba nueva: `web/test/integration/modo-rapido.itest.ts` (2 casos).
  - Los mismos datos dan lo mismo en el navegador y en la base: frecuencia, días de pago, saldo, cobros fijos y gasto diario.
  - Un error del formulario devuelve el mismo paso y el mismo mensaje que la prueba sin cuenta, y no escribe nada.
- Verificación (este equipo, `devdb` local), con este cambio y antes de empezar el alta del tendero:
  - `npm run test:int`: 6 archivos, **265 de 265** (incluye la prueba nueva).
  - `npm run build`: sin errores.
  - `npm run e2e`: **58 de 58 pasos** (6 + 10 + 11 + 31).
  - Typecheck y unitarias, en verde otra vez con la Etapa 6 encima (entrada siguiente).
- Decisiones que necesito de SOKA: ninguna nueva.

### 2026-11-13 11:15, Etapa 4: un solo formulario para la prueba y el modo rápido

- Rama y commits: `etapa-4-un-formulario`, creada desde `producto-v1` en `69a3ef3`. Lleva también el commit de la bitácora del turno de noche (entrada de abajo). Sin mezclar: SOKA pidió no mezclar nada a `producto-v1` antes de las 4:30 p. m. del 13 nov, porque a las 3:00 hace una demo sobre esa vista previa y a las 4:10 Claude en la nube mezcla #5. No toqué `src/app/admin`.
- Qué cambió:
  - **`web/src/components/app/cifra-questions.tsx` (nuevo): las cuatro preguntas, una sola vez.** Cada cuánto te pagan, cuánto tienes hoy, qué pagas fijo y cuánto se te va en el día a día. Lo usan los dos lugares que antes tenían cada uno su copia:
    - `mode="prueba"` en la página pública (`web/src/components/probar/try-cifra.tsx`): lee y valida los datos en el navegador con `parseQuickForm` y no envía nada. Trae el campo opcional "¿cuánto crees que puedes gastar?".
    - `mode="cuenta"` en la bienvenida de una cuenta nueva (`web/src/app/app/bienvenida/quick-start.tsx`): envía el formulario a `saveQuickStart`. Trae el campo opcional "¿Dónde está esa plata?" y el enlace para subir el extracto.
  - `try-cifra.tsx` se queda con el resultado, el guardado en el dispositivo y la analítica. `quick-start.tsx` se queda con la pantalla de confianza y la zona. Pasaron de 926 a 793 líneas entre los tres archivos.
  - **Lo que cambia en pantalla, solo en el modo rápido con cuenta:** ahora usa los textos de la prueba pública, que es la que se ve en la feria:
    - "Tienes hoy" en vez de "Saldo de hoy", y "¿Cuánto tienes hoy?" sin "disponible";
    - las mismas explicaciones cortas en cada paso;
    - los mismos atajos de monto (sin los de cada cobro fijo, ni el de $80.000 al día);
    - "Ver mi cifra" en vez de "Ver mi cifra ahora".
  - **Lo que cambia en pantalla, en los dos:** el contador dice "Paso N de 4". En la prueba, al tocar un cobro sugerido, el cursor salta a su monto, como ya pasaba con cuenta.
  - Sin cambios: los nombres de los campos, lo que lee el servidor, los identificadores que usan las pruebas (`#pc-*` y `#btn-probar-*` en la prueba, `#qs-*` y `#btn-qs-*` con cuenta) y el foco del lector de pantalla al cambiar de paso.
- Por qué: es lo que faltaba para cerrar la Etapa 4. Dos copias del mismo formulario ya se habían separado en textos y atajos, y cualquier arreglo había que hacerlo dos veces.
- Verificación (este equipo, `devdb` local), sin cambiar ninguna prueba:
  - `npm run typecheck`: 0 errores. `npm test`: 16 archivos, **171 de 171**.
  - `npm run build`: compilado sin errores.
  - `npm run e2e`: 4 archivos, **58 de 58 pasos**: guardar cifra 6 de 6, Hoy 10 de 10, prueba sin cuenta 11 de 11 (ningún monto sale del navegador; las cuatro respuestas en 328 ms) y seguridad 31 de 31.
  - `npm run test:int`: 5 archivos, **263 de 263**, 203 s. Corrió antes del último ajuste: un estado en vez de un `ref` en `quick-start.tsx`, que es de pantalla y no lo usan estas pruebas. Typecheck, unitarias, build y e2e se repitieron después, con los números de arriba.
- Qué revisar en la vista previa de esta rama, cuando se suba:
  1. En `/`, la prueba completa y "Cambiar mis datos".
  2. Con una cuenta nueva, la bienvenida: "Calcular mi cifra en 1 minuto", las cuatro preguntas con los textos de la prueba, "Atrás" desde la primera pregunta vuelve a la pantalla de confianza, y "Ver mi cifra" lleva al Hoy.
- Decisiones que necesito de SOKA: ninguna nueva.
- Pendientes y riesgos:
  - Falta medir a una persona que no sea del equipo (de abrir `/` a ver su cifra). Está en `FERIA.md`.
  - `saveQuickStart` (servidor) sigue leyendo el formulario con su propio código, igual que antes. `parseQuickForm` hace lo mismo en el navegador. Unir esas dos lecturas queda pendiente, con prueba.
  - Al mezclar después de #5: borrar `NOCHE_13NOV.md` y pasar a esta bitácora la sección que #5 le agrega.

### 2026-11-13 10:15, turno de noche (#4) y despliegue a producción

Esta entrada reemplaza `docs/producto/NOCHE_13NOV.md`, que escribió otra sesión de Claude, en la nube, entre la noche del 12 nov y la madrugada del 13, con autorización de SOKA del 12 nov a las 22:45.

Por ahora el archivo se queda. La solicitud de cambio #5 (`etapa-5-admin`, de la misma sesión en la nube) todavía le agrega una sección, y borrarlo antes haría chocar los dos cambios. Se borra después de que #5 entre a `producto-v1` (a las 4:10 p. m. del 13 nov), y su sección nueva pasa a esta bitácora.

- Rama y commits:
  - `noche-13nov`, creada desde `producto-v1` en `7d240f9`. Commits `9838c16`, `6bdeafa`, `3eb2bff`, `208140b`, `5e87426` y `74a2672`.
  - SOKA hizo los dos merges el 13 nov a las 9:53: #4 a `producto-v1` (`69a3ef3`) y #3 a `main` (`bd01f17`).
  - Producción corre `bd01f17`. Esta entrada va en un commit local de `producto-v1`, sin subir hasta las 4:00 p. m. (ver "Qué aprobó SOKA").
- Qué cambió en el turno de noche:
  - **La franja de demo ya no tapa la barra superior** (Etapa 5):
    - `DemoBar` y `AppTopBar` van ahora dentro de `StickyHeader` (`web/src/components/app/sticky-header.tsx`, nuevo), que es lo único pegado arriba. Quedan una debajo de la otra.
    - Toca `web/src/app/app/layout.tsx`, `web/src/app/negocio/(portal)/layout.tsx`, `demo-bar.tsx` y `app-top-bar.tsx`.
    - En el portal del negocio, la franja va dentro de la columna de contenido.
    - Paso nuevo **D3b** en `web/e2e/seguridad.e2e.mjs`: después de desplazar 900 px, la franja queda en y = 0 y la barra empieza donde termina la franja.
  - **Embudo de la feria en `/admin`** (Etapa 7a):
    - `web/src/lib/analytics/fair-funnel.ts` (nuevo) cuenta visitantes distintos por día de Bogotá: abrieron `/`, empezaron la prueba, vieron su cifra, tocaron "Guardar mi cifra" y crearon cuenta.
    - También cuenta cuántos creían poder gastar más, con solo la dirección y nunca el monto, y la mediana de segundos de la primera prueba del día.
    - Lo muestra la sección "Feria: del QR a la cifra guardada" (`web/src/app/admin/fair-funnel-section.tsx`): cuatro cifras de hoy y una tabla de 7 días, con cada porcentaje sobre el paso anterior.
    - Prueba nueva `web/test/integration/feria.itest.ts` (4 casos) y paso **D2b** en la e2e.
  - **`/admin/presentacion` rehecha** (Etapa 5):
    - Quitó testimonios inventados presentados como reales, métricas mal descritas, funciones que ya no existen, el grupo de control, una lista de bancos sin comprobar, "B2B2C" y el formulario comercial.
    - Ahora muestra:
      - la demo como persona o tendero;
      - el problema y lo probado con gente, cada cifra con su fuente;
      - la conversación con Karol Benavides y sus tres cambios;
      - qué hace hoy el producto y el modelo de cobro;
      - un ejemplo de caja rotulado, calculado con `computeRedemptionSplit`;
      - "lo que todavía no sabemos".
    - Se borró `web/src/components/landing/` completo, porque solo lo usaba esa página. En `recibos.test.ts`, la entrada de `receipt.tsx` cambió por la de la presentación.
  - **`/desarrolladores`** (la página de la API para cooperativas), revisada antes de la llamada con Financiera Comultrasan:
    - Los ejemplos usan `siteUrl()` en vez de `https://cifra.co`, un dominio que la app no usa.
    - Quitó "wallet de retail (como Starbucks)".
    - La calculadora dice que abre con valores de ejemplo.
    - Paso nuevo **A8** en la e2e.
  - **`docs/producto/FERIA.md`** (nuevo): lista de revisión de la feria sin negocios reales, para antes del 18, en el stand y después.
- Por qué: pendientes de las Etapas 5 y 7a. La presentación la abre SOKA frente a profesores o inversores, y la página de la API podía salir en la llamada con Comultrasan.
- Verificación:
  - **Turno de noche**, en la nube (Linux, Node 22, Postgres 16 local):
    - typecheck sin errores;
    - **171 de 171** unitarias;
    - **263 de 263** de integración (259 más 4 de `feria.itest.ts`);
    - build limpio;
    - e2e: guardar cifra 6 de 6, Hoy 10 de 10, prueba sin cuenta 11 de 11 y seguridad **31 de 31** (28 más A8, D2b y D3b).
  - **Turno de noche, revisión visual en local:**
    - la franja y la barra quedan una debajo de la otra al desplazar;
    - con eventos de ejemplo insertados solo en la base local y borrados después, el embudo mostró lo que se había insertado;
    - la presentación ya no contiene "Mariana V.", "B2B2C", "Next Best", "vampiro", "grupo de control" ni "Testimonio".
  - **Turno de noche, vistas previas:**
    - La de `noche-13nov` compiló contra su propia rama de Neon (`ep-steep-credit-b8opyfaw`) y aplicó las migraciones; no había nuevas.
    - En la de `producto-v1`, revisada a las 2:00 a. m., la prueba sin cuenta con los datos de `DEMO.md` dio **$700.000**, y "¿Puedo gastar?" con $120.000 respondió "Sí. Te quedarían $580.000 hasta el 15 nov.". No creó cuentas.
  - **Esta sesión, en este equipo, sobre `69a3ef3`** (el mismo contenido que `main`):
    - `npm run typecheck`: 0 errores. `npm test`: 16 archivos, **171 de 171**.
    - `src/components/landing/` ya no existe.
    - En `/admin/presentacion` y `/desarrolladores`, "B2B2C" solo queda en el nombre interno de un componente (`B2B2CSimulator`), no en pantalla.
    - No corrí integración ni e2e: el sistema apagó `devdb` por falta de memoria y no lo volví a levantar.
  - **Revisé el código de `fair-funnel.ts`:**
    - No mezcla datos de demostración: lo que mide sale de la página pública `/`, y la demo vive en `/app`.
    - Dos detalles menores. "Crearon cuenta" exige que la persona haya tocado Guardar y creado su cuenta el mismo día, pero no que lo haya hecho en ese orden.
    - Y los pasos no exigen el anterior: quien empieza la prueba sin que se registre su visita a `/` cuenta en "empezaron". Un porcentaje podría pasar del 100 %.
    - Ninguno de los dos cambia lo que se lee en la feria.
  - **Producción**, según SOKA: `bd01f17`, log con `ep-square-brook` y "Migraciones aplicadas". Sin sesión, `/app` y `/admin` llevan a `/entrar`, `/api/export` responde 401 y `/api/demo/session` responde 404. Son los pasos 3 y parte del 5 de `DESPLIEGUE.md`.
- Qué revisar en producción, después de que SOKA agregue las variables y cambie la clave: `DESPLIEGUE.md` desde el paso 4 (entrar a `/admin`).
- Decisiones que necesito de SOKA:
  1. `submitLead` (`web/src/app/actions/leads.ts`) quedó sin uso al borrar el formulario comercial, pero sigue siendo un endpoint público, registrado en la matriz de permisos. ¿Se borra?
  2. Canales de pago (decisión 6), sigue abierta.
- Pendientes y riesgos:
  - **La clave de la base se cambia después del despliegue, no antes como decía el plan.** Al cambiarla, el despliegue de producción que corre (`bd01f17`) se queda con la vieja y pierde la base hasta que se vuelva a desplegar. Las variables nuevas (`RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`) tampoco llegan sin un despliegue nuevo. Por eso, después de las dos cosas, hay que redesplegar producción una vez: Deployments > `bd01f17` > Redeploy.
  - La rama de Neon de `noche-13nov` es otra copia de los datos de producción. Se suma a la limpieza que decida SOKA después de la feria.
  - El resto del tablero de `/admin` sigue con textos de la versión anterior (Etapa 5).

### 2026-11-12 22:45, aviso cuando el correo no sale, enlaces de la vista previa y pasos del despliegue

- Rama y commits: `producto-v1`, `c914459` sobre `42406e9`, subido; esta entrada completa la verificación en el commit siguiente. Misma solicitud de cambio #3, sin merge.
- Qué cambió:
  - **Cambio de clave cuando el correo no sale** (`web/src/app/actions/auth.ts`):
    - En producción, si el correo no sale, la persona ve "No pudimos enviarte el correo para cambiar la contraseña. Inténtalo de nuevo más tarde." y el enlace que no salió se borra. Pasa cuando no hay servicio de correo, o cuando Resend lo rechaza: con `onboarding@resend.dev`, Resend solo entrega al correo de la cuenta de Resend.
    - Antes decía "te enviamos un enlace" aunque no hubiera salido nada.
    - Un correo sin cuenta recibe la misma respuesta de siempre. El mensaje nuevo no revela nada: el registro ya avisa "Ya hay una cuenta con este correo".
  - **Por qué no salió** (`web/src/lib/notify/email.ts`): si Resend responde con error, el registro anota el código y el tipo (por ejemplo `Resend respondió 403 (validation_error)`). No anota direcciones, aunque el mensaje de Resend las traiga.
  - **Enlaces de la vista previa** (`web/src/lib/site.ts`, nuevo):
    - Los enlaces completos que arma la app usan, en la vista previa, la dirección de su rama (`VERCEL_BRANCH_URL`). Son el correo de cambio de clave, el regreso de Google, el QR y el enlace de la cuenta del negocio, los correos del aviso diario y los enlaces de activación que manda el admin.
    - Antes usaban `NEXT_PUBLIC_SITE_URL`, que en Preview no existe, y quedaban en `http://localhost:3000`.
    - Producción y local siguen con `NEXT_PUBLIC_SITE_URL`.
  - **Cookie de sesión** (`web/src/lib/auth/session.ts`): en la vista previa, que es https, también sale marcada solo para https, como en producción.
  - `web/.env.example`: quité `GEMINI_API_KEY`, que el código no usa.
  - `docs/producto/DESPLIEGUE.md` (nuevo): variables por revisar, cambio de la clave de la base, merge y log, entrada a `/admin`, revisión después del despliegue, Google y cómo volver atrás.
  - `docs/producto/DEMO.md`: el texto exacto del aviso de correo repetido.
- **Corrección a la entrada de las 22:00 del 12 nov:**
  - `NEXT_PUBLIC_SITE_URL` está solo en Production, no en Production y Preview.
  - En la vista previa, los enlaces completos caían en `http://localhost:3000`, no en producción.
  - Queda resuelto con `site.ts`.
- **Lo que hay en Vercel** (proyecto `cifra`, 12 nov hacia las 10:30 p. m.; busqué cada nombre en Environment Variables):
  - Hay `ADMIN_EMAILS` y `NEXT_PUBLIC_CONTACT_EMAIL` (Production y Preview), `NEXT_PUBLIC_SITE_URL` y `NEXT_PUBLIC_GA_ID` (solo Production) y las variables de la base. No hay variables compartidas del equipo.
  - **No aparecen `RESEND_API_KEY`, `EMAIL_FROM` ni las variables VAPID**, que SOKA dice haber agregado: "No Results Found". Tampoco hay `CRON_SECRET` ni `GOOGLE_*`.
  - Sin `CRON_SECRET`, `/api/cron/daily` le responde 401 al cron de Vercel, así que el aviso diario no corre en producción.
  - Dominios de producción: `micifra.vercel.app` y `cifra-neon.vercel.app`.
  - No revelé el valor de `ADMIN_EMAILS`.
- Por qué: el mensaje de SOKA del 12 nov, más tarde (tabla de arriba).
- Verificación (comando y resultado):
  - `npm run typecheck`: 0 errores.
  - `npm test`: 16 archivos, **171 de 171**. Tres pruebas nuevas en `email.test.ts`: Resend rechaza el envío y el registro lo dice sin direcciones; la vista previa usa la dirección de su rama; producción y local usan `NEXT_PUBLIC_SITE_URL`.
  - `npm run test:int`: 4 archivos, **259 de 259**, 228 s. Dos pruebas nuevas en `acciones-publicas.itest.ts`: en producción, con el correo caído, la persona ve el aviso y el enlace se borra; un correo sin cuenta recibe la respuesta de siempre.
  - `npm run build`: compilado sin errores.
  - `npm run e2e`: 4 archivos, **55 de 55 pasos**.
  - **Vista previa de `c914459`**, en Vercel: "Ready", log con `entorno: preview · rama git: producto-v1`, `DATABASE_URL: ep-proud-tooth-b8u1gk85-pooler / neondb` y "Migraciones aplicadas." (no había migraciones nuevas).
  - En la vista previa pedí "¿Olvidaste tu contraseña?" con el correo de SOKA, como pidió. Respondió el mensaje de siempre ("Si existe una cuenta con ese correo…"), y en los registros de ejecución no hay ninguna línea `[email…]` (sí hay otras líneas de esos minutos). Con una cuenta y sin servicio de correo, habría salido el aviso de error y una línea "No se envió". Quedan dos opciones: **la cuenta de SOKA no existe en la base de la vista previa**, o el correo salió por Resend. Si a SOKA no le llegó nada, es la primera, y cuadra con que las variables de Resend no aparecen.
  - No creé cuentas en la vista previa, así que no pude ver ahí el aviso de error con una cuenta. Lo cubren las pruebas de integración de arriba.
- Decisiones que necesito de SOKA:
  1. Agregar `RESEND_API_KEY` y `EMAIL_FROM` en el proyecto `cifra`, que es donde no aparecen, y `CRON_SECRET` en Production. Después, redesplegar la vista previa y probar el correo con una cuenta tuya en la vista previa. Si no está en esa base, hay que crearla primero; la creas tú o me autorizas a crearla.
  2. Quién hace el ensayo del guion.
  3. Canales de pago (decisión 6).
  4. Correo para la feria: dominio propio verificado en Resend (propuesta en el mensaje de esta sesión).
- Pendientes y riesgos:
  - Con `onboarding@resend.dev`, nadie distinto de SOKA puede recuperar su clave en producción; ahora al menos lo sabe.
  - La clave de la base de producción quedó en el registro de la conversación del 12 nov. Cambiarla es el paso 2 de `DESPLIEGUE.md`. En Neon, las ramas de vista previa ya creadas pueden seguir aceptando la clave vieja; no lo pude comprobar.

### 2026-11-12 22:30, vista previa migrada y solicitud de cambio abierta

- Rama y commits: `producto-v1` subida hasta `c392eb9` (quita la pausa). Esta entrada y los ajustes de `DEMO.md` van en el commit siguiente, también subido. **Solicitud de cambio #3** (`producto-v1` → `main`): https://github.com/soka-js/cifra/pull/3. Sin merge: lo aprueba SOKA.
- Qué pasó:
  - SOKA comparó la `DATABASE_URL` de producción con la huella de la vista previa. Producción está en otro servidor, distinto de `ep-proud-tooth-b8u1gk85`. Lo confirmé con lo que pegó en el chat.
  - Quité la pausa de `web/scripts/migrate.mjs`; la huella en el log se queda.
  - `DEMO.md`: corregí los nombres de los botones y campos tal como se ven en pantalla ("Cada quincena", "Tipo de comercio", "Compra promedio de un cliente"). Agregué cómo pausar la oferta de un ensayo.
- Verificación:
  - Log de la vista previa de `c392eb9`, en Vercel: `entorno: preview · rama git: producto-v1`, `DATABASE_URL: ep-proud-tooth-b8u1gk85-pooler / neondb`, `DATABASE_URL_UNPOOLED: ep-proud-tooth-b8u1gk85 / neondb`, **"Migraciones aplicadas."**. "Provisioning Integrations" enlaza la misma rama de Neon, `br-soft-sound-b89yyija`.
  - En la vista previa (`cifra-git-producto-v1-proyects-soka.vercel.app`), con Chrome:
    - La prueba sin cuenta con los datos del guion da hoy, 12 nov, **$675.000**: $1.200.000 − $450.000 de arriendo (14 nov) − $25.000 × 3 días. Es lo mismo que calcula el motor; el 13 nov dará $700.000.
    - "¿Puedo gastar?" con $120.000 responde "Sí. Te quedarían $555.000 hasta el 15 nov."
    - "Guardar mi cifra" lleva a `/registro?desde=prueba` con el título "Guarda tu cifra".
    - Los eventos anónimos responden 204 en `/api/events`, que solo responde así después de guardar en la base: la base migrada responde.
    - `/negocio` lleva al registro de negocio.
  - **No creé cuentas en la vista previa.** No probé ahí el registro, el Hoy con cuenta, la oferta ni la caja: la dirección no es de un entorno marcado como de pruebas, y crear cuentas ahí lo decide SOKA. Esos pasos los cubren las pruebas de punta a punta locales, 55 de 55 con el mismo código, pero no contra los datos copiados de producción.
- Decisiones que necesito de SOKA:
  1. Un ensayo completo del guion en la vista previa antes de las 9:30: lo haces tú, o me autorizas a crear una persona y un negocio de prueba y pausar la oferta al final.
  2. Canales de pago (decisión 6): el mensaje volvió a traer el espacio sin llenar.
- Pendientes y riesgos:
  - **SOKA pegó en el chat la cadena de conexión completa de producción, con la clave.** No la usé, ni la copié a ningún archivo, ni la repito aquí. Quedó en el registro de esta conversación, así que recomiendo cambiar la clave del rol de la base y revisar que Vercel quede con la nueva.

### 2026-11-12 22:00, rama subida (sin migrar la vista previa), demo del 13 nov y respuestas de SOKA

SOKA confirmó que la vista previa tiene base propia y autorizó subir `producto-v1`, con una condición: antes que nada, confirmar en el log de compilación que las migraciones corren contra una rama de Neon y no contra la principal. **No pude confirmarlo del todo, así que paré antes de migrar y no abrí la solicitud de cambio.**

- Rama y commits: `producto-v1` **subida a GitHub** con `09118c5` y `7281f03` (más los 12 anteriores). Esta entrada va en un commit local que aún no subo. Sin solicitud de cambio.
- Qué cambió:
  - **Subida sin riesgo para producción** (`web/scripts/migrate.mjs`): en cada compilación de Vercel, el log muestra el entorno, la rama de git y la "huella" de la base, sin usuario ni clave. La huella es el servidor (en Neon, el `ep-…` identifica la rama) y el nombre de la base. Además, en vista previa las migraciones quedan **en pausa**: la primera compilación de `producto-v1` dejó la huella sin aplicar nada. La pausa se quita cuando se confirme la rama.
  - **Ofertas sin grupo de control** (pedido de SOKA para la feria):
    - `merchant.ts` crea las ofertas con 0 %; el esquema queda en 0 y `merchant-data.ts` también.
    - La migración nueva `web/drizzle/0009_ofertas_sin_grupo_de_control.sql` pone el valor por defecto en 0 y deja en 0 las ofertas que ya existen, también en producción cuando se despliegue.
    - El informe del negocio ya no dice "Control de incrementalidad activo" si no hay grupo.
    - La prueba E2 ahora comprueba que la oferta nace en 0 (antes lo apagaba a mano).
  - **Correo, hallazgo de seguridad** (`web/src/lib/notify/email.ts`): sin servicio de correo configurado, que es el caso de producción hoy, el texto completo de cada correo se escribía en los registros de Vercel, incluido el enlace para cambiar la clave. Quien pudiera leer esos registros podía entrar a cualquier cuenta que pidiera "Olvidé mi contraseña". En producción ahora solo se anota que el correo no salió. Prueba nueva: `web/src/lib/__tests__/email.test.ts`.
  - `web/.env.example`: el SMTP se configura con `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` y `SMTP_PASS`, que es lo que lee el código. Decía `SMTP_URL`, que no se usa; también lo dicen entradas anteriores de esta bitácora.
  - **Demo del 13 nov**:
    - `docs/producto/DEMO.md`: guion de 5 minutos. La persona va de `/` a la cifra sin cuenta, guarda, ve el Hoy y pregunta "¿Puedo gastar?". El tendero se registra, publica una oferta y valida el código en caja. No usa `/admin`, trae los números que deben salir el 13 nov y dice qué hacer si algo falla.
    - Plan B en un solo comando: `cd web && npm run demo` (`web/scripts/demo-local.mjs`, nuevo). Levanta `devdb` si hace falta, migra `cifra_dev`, compila y abre `http://localhost:3000`. Se niega a correr si `.env.local` no apunta a la base local. No es una función nueva del producto.
  - Plan y estado: las fechas nuevas (feria el 19, pitch el 26) y las respuestas de SOKA quedaron arriba, en "Etapas" y "Qué aprobó SOKA".
- Por qué: es el mensaje de SOKA del 12 nov en la noche, con sus siete puntos.
- Verificación (comando y resultado, con números):
  - `npm run typecheck`: 0 errores. `npx vitest run`: 16 archivos, **168 de 168**.
  - `npx next build`: compilado sin errores.
  - `npm run e2e`: 4 archivos, **55 de 55 pasos**.
  - `npm run test:int`: 4 archivos, **257 de 257**, 327 s.
  - `npm run demo`: con `devdb` ya corriendo, migró, compiló y quedó lista. `/` responde 200 con "¿Cada cuánto te pagan?"; `/app` y `/admin` llevan a `/entrar` y `/negocio` al registro de negocio.
  - **Vista previa de `7281f03`** (`cifra-git-producto-v1-proyects-soka.vercel.app`), leída en el panel de Vercel:
    - "Provisioning Integrations" muestra "neon-lime-sail: Create database branch for deployment" completado, con enlace a la rama de Neon `br-soft-sound-b89yyija`.
    - El log de compilación dice: `entorno: preview · rama git: producto-v1`, `DATABASE_URL: ep-proud-tooth-b8u1gk85-pooler / neondb`, `DATABASE_URL_UNPOOLED: ep-proud-tooth-b8u1gk85 / neondb` y "en pausa … No se aplicó nada".
    - **Lo que no pude comprobar:** que `ep-proud-tooth-b8u1gk85` sea el servidor de `br-soft-sound-b89yyija` y no el de la rama principal. La consola de Neon pide verificar el correo de la cuenta de Neon de SOKA. En Vercel, el servidor de la base principal solo se ve revelando el secreto de producción, y no lo hice. Tampoco corrí consultas en el editor de Vercel, que apunta a la base principal.
    - Mientras tanto, esa vista previa tiene el código nuevo sobre una base sin migrar: no sirve para la demo hasta migrarla.
  - Ramas de Neon por vista previa: los despliegues del 6 y del 9 de noviembre de `feat/v3-valor-real` enlazan la misma rama (`br-orange-brook-b8b8mc0o`). La integración crea una rama por cada rama de git y la reutiliza. Lo que se cree en la vista previa de `producto-v1` sobrevive a las siguientes subidas.
  - **Vistas previas viejas:**
    - La protección de despliegues está en "Vercel Authentication: Require Log In, Standard Protection". No hay enlaces para compartir, ni secreto de omisión para automatización, ni dominios exentos.
    - Pedí sin sesión `/admin` en 11 direcciones viejas: los 7 despliegues de `feat/v3-valor-real` y `feat/fase-5-landing-demo-qa`, más las direcciones por rama de esas dos, de `producto-real` y de `main`. Las 11 responden 302 hacia el inicio de sesión de Vercel. No quedan públicas.
    - Siguen existiendo con el código anterior al arreglo de seguridad y con ramas de Neon copiadas de producción. Hay 8 despliegues de vista previa: 5 de `feat/v3-valor-real`, 2 de `feat/fase-5-landing-demo-qa` y 1 de `producto-real`, del 1 nov.
    - La cuenta de Vercel no tiene verificación en dos pasos, y Vercel lo avisa en cada página.
- Qué revisar en la vista previa: todavía nada. Está protegida y sin migrar. Ver "Decisiones" abajo.
- Decisiones que necesito de SOKA:
  1. **Confirmar la rama, una de dos formas:**
     - (a) En Vercel, `cifra` > Settings > Environment Variables, revela `DATABASE_URL` (la de Production). Después de la `@` viene el servidor: si empieza con `ep-proud-tooth-b8u1gk85`, **es la misma base y no sigo**; si es otro `ep-…`, la vista previa usa otra base.
     - (b) Verifica el correo de tu cuenta de Neon, abre la rama `br-soft-sound-b89yyija` en la consola y mira su servidor: debe ser `ep-proud-tooth-b8u1gk85`.
     - Con eso quito la pausa, subo, reviso en el log que diga "Migraciones aplicadas" con la misma huella y abro la solicitud de cambio.
  2. **Entrar a `/admin`** (propuesta, sin código nuevo):
     - Crea tu cuenta con el correo de `ADMIN_EMAILS`.
     - Marca ese correo como verificado desde el editor SQL de Neon, en la rama que corresponda (la de la vista previa o, después de desplegar, la principal).
     - Solo puede hacerlo quien ya tiene acceso a la base. No agrega claves nuevas ni puertas en la app.
     - Antes de la feria conviene además un servicio de correo, porque hoy ninguna persona puede recuperar su clave en producción. Los pasos exactos van en el mensaje de esta sesión.
  3. Canales reales de pago (decisión 6): el mensaje traía el espacio sin llenar.
- Pendientes y riesgos:
  - **En la vista previa, `NEXT_PUBLIC_SITE_URL` es la de producción** (la variable figura para Production y Preview). Los enlaces que arma la app, como el QR del negocio o el enlace de cambio de clave si hubiera correo, apuntan a producción. No afecta el guion de mañana.
  - Las migraciones `0007`, `0008` y `0009` cambian datos de producción cuando SOKA despliegue (las tres autorizadas).
  - Para cerrar del todo las vistas previas viejas:
    - borrar sus despliegues en Vercel;
    - borrar sus ramas de Neon (`br-orange-brook-b8b8mc0o` y las de `feat/fase-5-landing-demo-qa` y `producto-real`);
    - opcional: borrar las ramas de git viejas en GitHub.
    - No lo hice: es borrado y lo decide SOKA.
  - Siguen igual los pendientes de la entrada de la Etapa 2.

### 2026-11-12 21:30, Etapa 2: cerrada

SOKA pidió cerrar todos los pendientes de la etapa. Quedan hechos y verificados en local; sigue sin subir porque falta confirmar la base de Preview.

- Rama y commits: `producto-v1`, un commit local sobre `390a394`. Sin subir.
- Qué cambió (36 archivos de `web/`: 35 modificados y 1 nuevo; +477 y −290 líneas en los modificados, contando pruebas):
  - **¿Puedo gastar?** (`web/src/app/app/gasto/ask.tsx`, `web/src/lib/engine/cifra.ts`):
    - La "alternativa segura" ya no multiplica por 0,65. Ahora dice "Con margen, hasta $X: te quedan $R de margen, lo que gastas en N días de tu día a día".
    - El margen es el gasto diario de la persona por los días que faltan, hasta un máximo de 3. Lo calculan dos funciones nuevas del motor: `spendReserveMinor()` y `comfortableSpendMinor()`. `canISpend` usa la misma reserva, así que la respuesta y la alternativa no se contradicen. Tienen 3 pruebas nuevas.
    - Las tasas del simulador de cuotas ya no dicen "promedio de tarjetas en Colombia" ni "cerca a usura". Quedan como "Tasa de ejemplo" (26,5 %, 30,8 % y 33,9 % E.A.).
  - **Gráfica de `/app/movimientos`** (`spending-dashboard-chart.tsx`, `web/src/lib/format.ts`):
    - Las etiquetas `$1.2M` y `$45k` se armaban a mano. Ahora salen de `milesDePesos()`, una función nueva con prueba, y el encabezado dice "en miles de pesos".
    - Quité el piso fijo de escala ($80.000) y el umbral de $500.000 para marcar días con cobros grandes: ahora se marca cualquier cobro fijo.
    - "Radiografía visual" pasó a "Tus gastos · últimos 30 días".
  - **"Lo que se repite en tus gastos"** (antes "Podrías recuperar", `detectMoneyLeaks` en `web/src/lib/engine/daily-value.ts`):
    - Ya no estima cuánto se podría recuperar. Esa estimación usaba porcentajes y montos sin recibo: 26 %, $6.500, 65 %, 80 % y 30 %.
    - Ahora muestra lo que pasó: cuánto suma, cuántas veces y en qué movimientos, más una acción concreta. Se ordena por monto.
    - El consejo del simulador de cuotas cita los intereses que él mismo calcula.
    - Salieron "3 segundos" y "(3 seg)" de los textos.
  - **Cierre del ciclo** (`closure-form.tsx`, `cierre/page.tsx`): los compromisos sugeridos salen del gasto diario de la persona. Ya no traen $100.000 ni $60.000 puestos. "Empezar en 1 minuto" pasó a "Calcular mi cifra".
  - **Negocio, metas que nadie escribió** (hallazgo de gravedad 2 del plan):
    - `web/src/lib/db/schema.ts` y la migración nueva `web/drizzle/0008_metas_del_negocio.sql`: la meta diaria y los costos fijos pueden quedar vacíos y no tienen valor por defecto.
    - La migración también vacía, en negocios que no son de la demo, los valores iguales a los de fábrica ($400.000 y $4.500.000). SOKA lo autorizó hoy.
    - `computeMerchantBreakEven` (`crossref.ts`) acepta "sin meta". El resumen y el cuadre muestran "Escribe tu meta del día" (`#btn-write-daily-goal`) en vez de un avance contra un número inventado.
    - El costo de insumos ya no se supone (antes era el 36 % o el 38 % del precio). Es obligatorio en el cuadre y en la oferta rápida.
    - La comisión de las apps de domicilio ya no viene en 28 %. Es un campo opcional, y la comparación con la app aparece solo si el tendero lo escribe.
    - La comisión de CIFRA en la calculadora sale de la configuración del negocio.
    - El registro de negocio ya no trae el ticket típico de $20.000 puesto: ahora es obligatorio.
  - **Jerga** (22 reemplazos en 12 archivos, más los de la demo):
    - "relámpago" pasó a "por horas".
    - Salieron "cero merma" y los "verificado" que nada verificaba (vitrina, "Barrio verificado" en `/b/[slug]`, el texto por defecto de las ofertas).
    - Salió el "$900" escrito a mano en `commission-cycle.ts`.
    - "B2B2C" en `/desarrolladores` pasó a "API para cooperativas, cajas y billeteras".
    - "Cliente nuevo verificado" en la caja se queda: ahí sí lo verifica el sistema.
    - No toqué `/admin`: la Etapa 5 rehace la presentación.
  - **Guardián** (`web/src/lib/__tests__/recibos.test.ts`):
    - La lista de montos escritos a mano bajó a 5 en 3 archivos: los 3 del ejemplo rotulado de la página de presentación, el mínimo de la meta del negocio y el umbral de $20.000 desde el que aparece el simulador de cuotas. Los 3 últimos son umbrales que deciden algo y no se muestran como dato.
    - Prueba nueva "sin jerga del equipo": revisa pantallas, componentes, los textos del motor y los datos de la demo (fuera de `/admin`). Falla si aparecen relámpago, cero merma, intocable, NBA o B2B2C.
  - **Pruebas actualizadas:** `cifra.test.ts`, `v3-valor-real.test.ts`, `format.test.ts`, la matriz de acciones y la prueba de acciones públicas (insumos y ticket típico ahora se envían).
  - **Paso nuevo E8** en `web/e2e/seguridad.e2e.mjs`: un tendero recién registrado no ve $400.000, $4.500.000, "28 %" ni jerga en el resumen, el cuadre y las ofertas. Escribe una meta de $350.000 y el resumen dice "de $350.000".
- Por qué: punto 2 del brief ("cada número tiene recibo") y su criterio de salida: guardián en verde y cero jerga en pantalla.
- Verificación (comando y resultado, con números), todo sobre el mismo árbol:
  - `npm run typecheck`: 0 errores.
  - `npx vitest run`: 15 archivos, **167 de 167**. Son 6 más que en la Etapa 3: 3 de la reserva de ¿Puedo?, 1 de `milesDePesos`, 1 del consejo del simulador de cuotas y la del guardián de jerga. El caso "sin meta" del negocio quedó dentro de la prueba del punto de equilibrio que ya existía, y dos pruebas se reescribieron: "Lo que se repite" sin estimar ahorros y el margen del tendero con la comisión que él escribe.
  - `npm run test:int`: 4 archivos, **257 de 257**, 299,6 s.
  - `npx next build`: sin errores.
  - `npm run e2e`: 4 archivos, **55 de 55 pasos**, 71 s: guardar cifra 6, Hoy 10, prueba sin cuenta 11, seguridad 28.
  - Migración `0008` probada en una base desechable (`cifra_mig`, ya borrada) con tres negocios:
    - uno real con los valores de fábrica: quedó vacío;
    - uno real con su propia meta: no cambió;
    - uno de la demo: no cambió.
  - Vi dos capturas rehechas. En `e1-demo-tendero.jpg` el negocio de ejemplo muestra su propia meta ($340.000 de $450.000) y "oferta por horas". En `e4-prueba-3-puedo.jpg` la prueba sin cuenta no cambió.
- Qué revisar en la vista previa: no hay vista previa. En local, con `devdb` corriendo: `cd web && npm run build && npm run e2e`. Para mirarlo a mano:
  1. Registra un negocio nuevo en `/negocio/unirse`. El resumen debe pedir "Escribe tu meta del día", sin $400.000. En Ofertas, el costo de insumos debe estar vacío y no debe aparecer ninguna app con 28 %.
  2. Con una persona, abre `/app/gasto` y pregunta por algo que sí te alcance. La alternativa debe decir "Con margen, hasta…" y explicar el margen en días de tu día a día.
  3. Abre `/app/movimientos`. Las etiquetas de la gráfica deben estar en miles de pesos, sin `M` ni `k`.
- Decisiones que necesito de SOKA: ninguna nueva. Sigue abierta la confirmación de la base de Preview para poder subir.
- Pendientes y riesgos:
  - **La migración `0008` cambia datos de producción cuando despliegues** (autorizado). Si un tendero real había escrito justo $400.000 o $4.500.000, ese valor también se vacía y tendrá que volver a escribirlo.
  - `web/src/app/admin/actions.ts:94` usa $20.000 como respaldo del ticket típico. Está en `/admin`, fuera del guardián; se revisa en la Etapa 5.
  - `/admin/presentacion` describe cosas que ya se borraron (misiones, meta de ahorro, "fugas hormiga") y usa "B2B2C". Se rehace en la Etapa 5.
  - `/app/movimientos` conserva el título "Gastos hormiga del último mes". Es una expresión de uso común, no jerga del equipo, y la dejé a propósito. Del Hoy sí está prohibida por su prueba.
  - La prueba de recibo con extracto real (cobros detectados, traslados) sigue sin automatizar.
  - Siguen igual: "Anotar un gasto" quedó debajo de la primera pantalla (Etapa 3) y falta unificar los dos formularios de la Etapa 4.

### 2026-11-12 15:30, Etapa 3: el Hoy en dos pantallas (cerrada en local)

Esta etapa empezó en una sesión que se cortó antes del commit. La retomé desde el árbol de trabajo, la revisé, corregí dos fallas que encontró la prueba nueva y corrí todo.

- Rama y commits: `producto-v1`, un commit local sobre `756c6b0`. Sin subir.
- Qué cambió (21 archivos de código: 4 nuevos, 15 modificados, 2 borrados; +217 y −419 líneas en los modificados, sin contar los nuevos, los borrados ni las capturas):
  - `web/src/app/app/page.tsx` (reescrito): el Hoy queda así: la cifra con "Puedes gastar hasta el…", una sola equivalencia por día ("Son unos $X por día durante N días"), la resta "De dónde sale", "¿Puedo gastar?" contestado ahí mismo, "Anotar un gasto" y una lista corta de accesos (extracto, cobros fijos, ofertas si hay, cierre del ciclo, próximo pago). Salieron del Hoy el mapa de ofertas y la tarjeta del "tope de hoy".
  - `web/src/components/app/cifra-hero.tsx` (nuevo, reemplaza a `cifra-privacy-hero.tsx`): la tarjeta de la cifra, con el modo discreto que ya existía.
  - `web/src/components/app/ask-inline.tsx` (nuevo): "¿Puedo gastar?" en un solo componente para la prueba sin cuenta y para el Hoy. Antes la prueba tenía su propia copia.
  - `web/src/components/app/pending-charges.tsx` (nuevo): los cobros del ciclo, para marcar uno como ya pagado, ahora debajo de su renglón de la resta.
  - **Fuera el "tope de hoy" (factor 0,65), pendiente de la Etapa 2:** borrados `computeDailyPulse` de `web/src/lib/engine/daily-value.ts`, su prueba y `daily-pulse-card.tsx`. `web/src/lib/v3-data.ts` separa `loadCycleExtras` (lo que el Hoy necesita) de `loadPersonaDailyValueBundle` (lo que usa "En qué se me va"). La gráfica de `/app/movimientos` compara contra el día a día de la cifra, no contra el tope. Los mensajes de anotar gasto, del código de oferta y del aviso de ahorro dicen "tu cifra" en vez de "tu tope de hoy".
  - **Selector Persona/Negocio** (`app-top-bar.tsx`, `layout.tsx`): ya no aparece para todos. "Mi negocio" sale solo si la persona tiene uno; desde el negocio, "Mi cifra" lleva de vuelta. Títulos sin jerga ("Mis ofertas", no "Mis ofertas y relámpago").
  - `web/e2e/hoy.e2e.mjs` (nuevo, 10 pasos) y ajustes de selectores en `prueba-sin-cuenta.e2e.mjs` y `seguridad.e2e.mjs`.
  - Lo que arreglé en esta sesión:
    1. **El "Guardar" de anotar gasto quedaba tapado por la barra de abajo.** El modal se dibujaba dentro del botón flotante, y ese contenedor fijo lo dejaba debajo de la navegación. En un celular la persona no podía guardar el gasto. Ahora `quick-capture-modal.tsx` monta el modal en `<body>` (un portal), así que ningún contenedor lo tapa, aquí ni en `/app/movimientos`.
    2. **El botón flotante "Anotar gasto" tapaba "Preguntar"** en la primera pantalla. Lo saqué: "Anotar un gasto" es un botón normal debajo de "¿Puedo gastar?". El Hoy pasó de 1,50 a 1,58 pantallas. La prueba ahora falla si aparece algo fijo dentro del contenido o si algo tapa esos dos botones.
    3. Quedaban "tope" en la gráfica de `/app/movimientos` ("Dentro del tope", "Días dentro de tu tope"): ahora dicen "tu día a día".
  - Evidencia nueva: `e3-hoy-1-arriba.jpg`, `e3-hoy-2-completo.jpg`, `e3-hoy-3-puedo.jpg`. Al correr la suite se rehicieron cinco capturas anteriores; `e1-demo-persona.jpg` y `e4-guardar-2-hoy.jpg` ahora muestran el Hoy nuevo.
- Por qué: punto 3 del brief (el Hoy medía 4,1 pantallas con un usuario nuevo y daba dos respuestas a "cuánto por día") y el hallazgo de gravedad 2 del plan sobre el factor 0,65.
- Verificación (comando y resultado, con números), todo sobre el mismo árbol:
  - `npm run typecheck`: 0 errores.
  - `npx vitest run`: 15 archivos, **161 de 161**, 1,26 s. Una menos que antes: salió la prueba de `computeDailyPulse` junto con la función. El guardián de montos sigue en verde.
  - `npm run test:int`: 4 archivos, **257 de 257**, 467 s. Tardó más del doble que la vez anterior (207 s); la máquina tenía 2,9 GB libres de 15,7.
  - `npx next build`: sin errores.
  - `npm run e2e`: 4 archivos, **54 de 54 pasos**, 42,8 s: guardar cifra 6, Hoy 10, prueba sin cuenta 11, seguridad 27. Lo que comprueba el recorrido del Hoy con los datos del brief (saldo $1.200.000, $25.000 al día, quincenal):
    - Mide **1,58 pantallas** (1.331 px a 390x844). El criterio de salida era 2 o menos; antes eran 4,1.
    - La cifra dice "Puedes gastar hasta el 15 nov" y vale saldo − día a día × días: hoy, $1.200.000 − $25.000 × 3 = $1.125.000.
    - Prueba de recibo: todo monto visible está en {$1.200.000, $25.000, $75.000, $1.125.000, $375.000, $0}. Ningún otro.
    - Una sola frase de "por día", y no aparecen "tope" ni "mañana tu".
    - No aparecen NBA, B2B, relámpago, intocables, jugada, misión, hormiga, Santa Marta ni "Negocio".
    - Nada fijo dentro del contenido; "Preguntar" y "Anotar un gasto" no quedan tapados.
    - "¿Puedo gastar?" con $120.000 dice "Sí" y deja $1.005.000; con $50.000 más que la cifra dice "No te alcanza" por $50.000.
    - Anotar "almuerzo 18000" baja la cifra exactamente $18.000.
    - El modo discreto oculta la cifra y la vuelve a mostrar.
  - La primera corrida de `hoy.e2e.mjs` dio 7 de 9: las dos fallas eran el arreglo 1 (la segunda venía en cadena, con el modal todavía abierto).
  - Vi las capturas: la primera pantalla muestra la cifra, la resta completa y "¿Puedo gastar?" con su botón, sin nada encima. En la demo de Mariana la resta cierra: $1.960.000 − $34.900 − $27.654 − $80.000 = $1.817.446, y $1.817.446 ÷ 3 = $605.815 por día.
  - El Postgres local se volvió a caer por memoria a mitad de la sesión (quedó un proceso huérfano reteniendo el puerto). Lo apagué con `npm run stop` y lo levanté de nuevo sin borrar datos, como autorizó SOKA a las 14:00.
- Qué revisar en la vista previa: no hay vista previa. En local, con `devdb` corriendo: `cd web && npm run build && npm run e2e`. Para mirarlo a mano, crea una cuenta, contesta las cuatro preguntas y abre `/app` con el navegador a 390 de ancho: en la primera pantalla deben verse la cifra, de dónde sale y "¿Puedo gastar?"; abajo, "Anotar un gasto". Toca "Anotar un gasto": el botón "Guardar" debe verse entero, encima de la barra de abajo.
- Decisiones que necesito de SOKA: ninguna nueva. Sigue abierta la confirmación de la base de Preview para poder subir.
- Pendientes y riesgos:
  - Etapa 2, sin hacer: la "alternativa segura" de `/app/gasto` sigue usando 0,65 (`web/src/app/app/gasto/ask.tsx:91`); las etiquetas `$1.2M` y `$45k` de la gráfica se arman a mano (`spending-dashboard-chart.tsx:783`); "En qué se me va" estima lo recuperable de las comisiones con otro 0,65 (`daily-value.ts:131`); siguen los valores por defecto del negocio y la pasada de lenguaje fuera del Hoy.
  - La prueba de recibo del Hoy cubre a una persona nueva del modo rápido. Con extracto (cobros detectados, traslados) solo la miré en la captura de la demo; no hay prueba automática.
  - "Anotar un gasto" quedó debajo de la primera pantalla. Si en el stand se quiere a un toque sin desplazar, hay que decidir qué baja.
  - La franja de demo y la barra superior siguen pegadas arriba (Etapa 5).

### 2026-11-12 14:40, Etapa 4 (avance): "Guardar mi cifra" ya guarda

- Rama y commits: `producto-v1`, un commit local sobre `a2aab6a`. Sin subir.
- Qué cambió (5 archivos de código y 2 capturas):
  - `web/src/components/probar/trial-handoff.tsx` (nuevo): al entrar a `/app/bienvenida` con una cuenta recién creada, si en el dispositivo está lo que la persona escribió en la prueba, lo guarda con la misma acción del modo rápido (`saveQuickStart`) y la lleva al Hoy. Lo intenta una sola vez y borra lo guardado en el dispositivo. Si no hay nada, o falla, muestra las preguntas de siempre. No hay acción de servidor nueva.
  - `web/src/app/app/bienvenida/page.tsx`: usa ese puente solo para cuentas que aún no han pasado por el inicio.
  - `web/src/app/registro/page.tsx`: con `?desde=prueba` el título es "Guarda tu cifra". También quité del subtítulo normal el "en menos de 5 minutos", que nadie midió.
  - `web/e2e/guardar-cifra.e2e.mjs` (nuevo): 6 pasos.
  - Evidencia: `e4-guardar-1-registro.jpg` y `e4-guardar-2-hoy.jpg`.
- Por qué: era el tramo que faltaba de la meta 1. Sin esto, quien calculaba su cifra en el stand tenía que escribir todo otra vez después de crear la cuenta.
- Verificación (comando y resultado, con números):
  - `npx tsc --noEmit`: 0 errores. `npx next build`: sin errores.
  - `npm run e2e`: 3 archivos, **44 de 44 pasos** (6 de guardar, 11 de la prueba sin cuenta, 27 de seguridad).
  - Lo que comprueba el recorrido nuevo: con saldo $1.234.567, arriendo $654.321 y $23.456 al día, la persona ve su cifra, toca "Guardar mi cifra", crea la cuenta y llega a `/app` sin pasar por las preguntas; el Hoy muestra la misma cifra; en la base quedan el saldo, el cobro fijo, la frecuencia de pago y el gasto diario exactos; al volver a `/app/bienvenida` no se duplica nada.
  - No repetí unitarias ni integración para este cambio: no toca ninguna acción ni el motor.
- Qué revisar en la vista previa: no hay vista previa. En local, con `devdb` y la app corriendo: abre `/`, responde las cuatro preguntas, toca "Guardar mi cifra" y crea una cuenta. Debes caer en el Hoy con el mismo número.
- Decisiones que necesito de SOKA: ninguna nueva.
- Pendientes y riesgos (lo que falta de la Etapa 4):
  - Sigue habiendo dos formularios parecidos (el de la prueba y el del modo rápido con cuenta). Falta dejar uno.
  - Si la persona entra con una cuenta que ya existía en vez de crear una, lo calculado en la prueba no se guarda (a propósito: no se pisa una cuenta con datos).
  - Con "Continuar con Google" el puente debería funcionar igual (la pestaña conserva lo escrito), pero no lo probé: no hay Google configurado en local.
  - Nadie ha medido a una persona real del QR a la cifra.

### 2026-11-12 14:25, Etapa 1: cerrada

Con la base local de vuelta (SOKA autorizó levantarla) corrí todo lo que faltaba. La Etapa 1 queda cerrada en local; sigue sin subir porque falta confirmar la base de Preview.

- Rama y commits: `producto-v1`, commits locales `a99eb42` (el cambio de seguridad), `41fbceb`, `ec98abb` y el de esta entrada. Sin subir.
- Qué cambió desde la entrada anterior de esta etapa:
  - `web/e2e/run.mjs` y `npm run e2e` (nuevo): vacía y migra `cifra_test`, levanta la app compilada en el puerto 3100 contra esa base, corre cada `*.e2e.mjs` y apaga el servidor. Se niega a tocar una base que no sea local y terminada en `_test`.
  - `web/e2e/seguridad.e2e.mjs` (nuevo): 27 pasos en un celular de 390x844. `web/e2e/lib.mjs`: piezas comunes.
  - `web/test/integration/global-setup.ts`: si la base no está arriba, el mensaje ahora se ve (Vitest se tragaba el error con uno propio).
  - 5 capturas nuevas en `docs/producto/evidencia/`: `e1-entrar-sin-accesos.jpg`, `e1-admin-lanzador-demo.jpg`, `e1-demo-persona.jpg`, `e1-demo-tendero.jpg`, `e1-caja-cobrado.jpg`.
- Por qué: el brief pide cerrar cada etapa con typecheck, pruebas, build y recorridos de punta a punta.
- Verificación (comando y resultado, con números), todo sobre el mismo árbol:
  - `npm run typecheck`: 0 errores.
  - `npx vitest run`: 15 archivos, 162 de 162, 3,12 s.
  - `npm run test:int`: 4 archivos, **257 de 257**, 206,7 s. Incluye la que había quedado por repetir.
  - `npx next build`: sin errores.
  - `npm run e2e`: 2 archivos, **38 de 38 pasos**, 34,2 s en total. Los 27 de seguridad, en navegador:
    - A (7 pasos), visitante sin sesión: 12 rutas privadas llevan a `/entrar`; `/negocio` lleva al registro de negocio; `/api/export`, `/api/import`, `/api/push/subscribe` y `/api/cron/daily` responden 401; `/api/demo/session` y `/demo` responden 404; `/entrar` no muestra accesos de un clic; una cookie inventada no abre nada.
    - B (2 pasos), datos viejos: con un `admin@cifra.co` sembrado a mano con `role = admin` y la clave que estaba publicada, entrar da "no coinciden". Una persona real con `role = admin` en la base recibe 404 en `/admin`.
    - C (3 pasos), persona nueva: registro, cuatro datos, Hoy con sus números y con punto de miles; `/admin` le da 404; su descarga trae solo lo suyo.
    - D (8 pasos), admin y demo: registrarse con el correo de `ADMIN_EMAILS` da 404 en `/admin`; después de abrir el enlace de cambio de clave, `/admin` abre; "Ver como persona" muestra la franja y los datos de Mariana; pasa a "Tendero" (Panadería La Espiga) y "Salir" lo devuelve a ser admin; la vitrina del negocio de ejemplo da 404 a un visitante y a una persona con cuenta; los usuarios de ejemplo quedan sin clave y con `role = user`.
    - E (7 pasos), tendero nuevo: sin cuenta abre `/negocio`, se registra, publica una oferta, una persona genera el código y la caja cobra $18.000 de un pedido de $20.000, con comisión de $900 y $17.100 para el negocio; el mismo código no sirve dos veces; a la persona le llega "Ahorraste $2.000". La cuenta del negocio ya no muestra mandatos ni canales de pago de relleno.
  - Las dos primeras corridas de `seguridad.e2e.mjs` tuvieron fallas (5 y luego 1). Todas eran del guion, no de la app: un selector que atrapaba el anunciador de rutas de Next en vez del mensaje de error, una espera que leía el código antes de que el servidor lo creara y una expresión regular mal escapada. La tercera corrida es la de arriba.
  - Vi las capturas de la franja de demo y del lanzador de `/admin`: se ven como se describió.
- Qué revisar en la vista previa: no hay vista previa. En local: `cd devdb && npm start`, y en otra terminal `cd web && npm run build && npm run e2e`. Para mirarlo a mano, los cuatro pasos de la entrada anterior siguen valiendo.
- Decisiones que necesito de SOKA:
  1. Confirmar si Preview de Vercel tiene base propia, para poder subir la rama y abrir la solicitud de cambio de esta etapa.
  2. Antes de desplegar: cómo vas a verificar tu correo de admin en producción (Google o servicio de correo configurado). Sin eso quedas fuera de `/admin`.
- Pendientes y riesgos:
  - En el celular, la franja de demo y la barra superior de la app se pegan las dos arriba: al desplazar, la franja tapa la barra. La navegación de abajo sigue visible. Lo arreglo en la Etapa 5.
  - En la prueba E2 apago a mano el grupo de control del 10 % de la oferta (personas a las que no se les muestra, para medir). Con el valor de fábrica, 1 de cada 10 personas no vería la oferta de un negocio dado; hay que decidir si eso se quiere en la feria.
  - Lo demás de la entrada anterior sigue igual: columnas sin uso en bases existentes, webhook de Wompi sin endurecer, rol "cajero" sin diferencias y `realAdmin = true` en `/admin`.

### 2026-11-12 09:15, Etapa 4 (avance): la prueba sin cuenta en `/`

Me salí del orden del plan a propósito: con el Postgres local detenido, esta es la única pieza grande que se puede construir y comprobar en un navegador sin base, porque calcula en el celular. Las etapas 1, 2 y 3 siguen abiertas.

- Rama y commits: `producto-v1`, un commit local sobre `c8c013e`. Sin subir.
- Qué cambió (12 archivos sin contar esta bitácora: 8 nuevos, 4 modificados):
  - `web/src/app/page.tsx`: `/` ya es pública. Su primera pantalla es la primera pregunta. Con sesión sigue llevando a `/app`.
  - `web/src/components/probar/try-cifra.tsx` (nuevo): las cuatro preguntas, la cifra con su resta, "¿Puedo gastar?" contestado ahí mismo y el botón "Guardar mi cifra". Incluye, como campo opcional del último paso, "¿cuánto crees que puedes gastar?" (decisión 5, que sigue abierta: si SOKA dice que no, se quita un campo).
  - `web/src/lib/engine/quick.ts` y `web/src/lib/quick-form.ts` (nuevos): funciones puras. El cálculo es el mismo `computeCifra` de la app; no hay una segunda fórmula.
  - `web/src/lib/analytics/shared.ts`: tres eventos anónimos nuevos (`try_cifra_start`, `try_cifra_done`, `try_cifra_save`). Llevan estado y conteos, nunca montos.
  - `web/e2e/prueba-sin-cuenta.e2e.mjs` (nuevo) y `npm run e2e:prueba`: primera prueba de punta a punta del repo.
  - `web/src/lib/engine/__tests__/quick-trial.test.ts` (nuevo): 13 pruebas.
  - Evidencia: `docs/producto/evidencia/e4-prueba-1-inicio.jpg`, `e4-prueba-2-resultado.jpg`, `e4-prueba-3-puedo.jpg`.
- Por qué: es la meta 1 del brief (del QR a la cifra en un minuto, con sus propios números) y la idea del equipo de probar sin cuenta.
- Verificación (comando y resultado, con números):
  - `npx tsc --noEmit`: 0 errores. `npx vitest run`: 14 archivos, 117 de 117, 2,82 s. `npx next build`: sin errores, 28,3 s.
  - `npm run e2e:prueba` contra `next start`, Chrome a 390x844, sin base de datos: 11 de 11 pasos. Lo que comprueba:
    - `/` responde 200 sin sesión y no redirige.
    - El botón "Seguir" de la primera pregunta termina en el píxel 615 de 844: se ve sin desplazar.
    - Con saldo $1.234.567, arriendo $654.321 y $23.456 al día, la pantalla muestra exactamente saldo − fijos − día a día (hoy, a 3 días del pago: $509.878).
    - Todo monto visible en el resultado está en el conjunto que se deriva de lo escrito. Ningún otro número.
    - "¿Puedo gastar?" responde contra esa misma cifra.
    - Durante todo el recorrido el navegador solo le habla a `/api/events`, y ningún envío contiene una secuencia de cuatro dígitos o más. En una corrida de control aparte fueron 7 envíos: vista de página, inicio, fin (con estado, dirección de la diferencia y número de cobros), el veredicto de "¿Puedo?" y tres de profundidad de desplazamiento.
  - Con los datos del brief (saldo $1.200.000, $25.000 al día, quincenal): prueba unitaria con fecha fija del 11 de noviembre da $1.100.000; en el navegador hoy, 12 de noviembre, da $1.125.000 (un día menos de gasto).
  - Tiempo: el guion contesta las cuatro preguntas en 343 ms, que no dice nada de una persona. **No medí a una persona.** El mínimo es 5 toques y 2 montos escritos.
- Qué revisar en la vista previa: no hay vista previa. En local basta `cd web && npm run build && npm run start` y abrir `http://localhost:3000` en el celular o con el navegador a 390 de ancho. Las tres capturas `e4-*` muestran lo que debe verse.
- Decisiones que necesito de SOKA:
  1. Sigue pendiente lo de la entrada anterior: cuándo puedo levantar la base local.
  2. El rótulo de la cifra. En la prueba puse "Puedes gastar hasta el 15 nov". En el Hoy dice "Disponible seguro hasta el 15 nov". ¿Con cuál se hicieron las 21 sesiones? Quiero una sola frase en los dos lados.
  3. Decisión 5 del plan: el campo opcional "¿cuánto crees que puedes gastar?" ya está puesto; dime si se queda.
- Pendientes y riesgos:
  - **"Guardar mi cifra" todavía no guarda.** Lleva a `/registro?desde=prueba` y deja las respuestas en el dispositivo (`sessionStorage`), pero el registro aún no las recoge: hoy la persona tendría que volver a escribirlas después de crear la cuenta. Ese tramo escribe en la base, así que lo hago cuando vuelva Postgres.
  - El formulario de la prueba y el del modo rápido con cuenta (`web/src/app/app/bienvenida/quick-start.tsx`) son dos componentes parecidos. Al cerrar la etapa debe quedar uno solo.
  - `/api/events` no se probó con los eventos nuevos contra una base real (sin Postgres responde error; la página no depende de eso).
  - La página pública tiene solo dos secciones debajo de la prueba. La presentación larga sigue en `/admin/presentacion`.

### 2026-11-12 09:00, Etapa 2 (avance): pesos con punto y guardián de montos escritos a mano

Adelanté de la Etapa 2 solo lo que se puede verificar sin base de datos, mientras el Postgres local sigue detenido. La etapa sigue abierta.

- Rama y commits: `producto-v1`, un commit local sobre `a99eb42`. Sin subir.
- Qué cambió (26 archivos: 25 modificados, 1 nuevo; +89 y −58 líneas más la prueba nueva):
  - `web/src/lib/format.ts`: `cop()` y `formatThousands()` escriben los miles con punto (`$1.808.228`).
  - `web/src/components/ui/money-input.tsx`: el valor que viaja al servidor se limpia quitando todo lo que no sea dígito (antes solo quitaba comas).
  - `web/src/lib/engine/daily-value.ts`: un monto que se formateaba a mano con una expresión regular ahora usa `cop()`.
  - 57 cifras con coma en textos, ejemplos y campos de 21 archivos pasaron a punto (por ejemplo `placeholder="1.250.000"`). No toqué los lectores de extractos ni sus pruebas, donde `45,000.00` es un formato bancario de entrada.
  - `web/src/lib/__tests__/recibos.test.ts` (nuevo): guardián de la regla "cada número tiene recibo". Falla si en `src/app` o `src/components` aparece un monto en centavos escrito a mano, un `$` armado a mano en una plantilla, o miles con coma. Las excepciones están en una lista con su porqué, y la prueba también falla si la lista queda vieja.
  - `web/src/lib/__tests__/format.test.ts`: 5 pruebas nuevas del formato.
- Por qué: hallazgos 2 y 6 del brief. El guardián convierte la regla en algo que se rompe solo, en vez de depender de una revisión.
- Verificación (comando y resultado, con números):
  - `npx vitest run`: 13 archivos, 104 de 104 (96 anteriores, 5 de formato, 3 del guardián), 2,31 s.
  - `npx tsc --noEmit`: 0 errores.
  - Montos escritos a mano en `src/app` y `src/components`: 15 (eran 74 antes de la Etapa 1). Los 15 están en la lista del guardián: 3 son el ejemplo rotulado de la página de presentación, 1 es un umbral de validación y 11 quedan marcados como pendientes.
  - **No corrí** `next build` ni las pruebas de integración después de este cambio, ni lo vi en pantalla.
- Qué revisar en la vista previa: no hay vista previa. En local, cualquier pantalla con plata debe mostrar puntos; al escribir en un campo de monto, el número se agrupa con puntos.
- Decisiones que necesito de SOKA: ninguna nueva.
- Pendientes y riesgos (lo que falta de la Etapa 2):
  - Quitar el "tope de hoy" (factor 0,65) del Hoy y dejar una sola equivalencia por día.
  - `web/src/app/app/gasto/ask.tsx:91`: la "alternativa segura" de ¿Puedo? también usa un 0,65 sin explicar.
  - `web/src/components/app/spending-dashboard-chart.tsx`: etiquetas `$1.2M` y `$45k` armadas a mano y umbrales fijos de escala.
  - Valores por defecto inventados del negocio (meta diaria de $400.000, costos de $4.500.000), supuestos de la calculadora de ofertas (28 % de las apps, costo de insumos) y textos con montos de ejemplo sin rotular en cierre de ciclo.
  - Pasada de lenguaje para quitar la jerga.
  - Prueba de recibo en navegador con los 4 datos del brief.
  - Los avisos ya guardados en una base existente conservan las comas con que se escribieron.

### 2026-11-12 08:55, Etapa 1: cerrar la puerta (código y pruebas de permisos listos; falta el recorrido en navegador)

**La etapa no está cerrada.** El código y las pruebas de permisos están hechos y en verde, pero falta la prueba de punta a punta en un navegador. No pude hacerla: el sistema detuvo el Postgres local por falta de memoria (quedaban 1,9 GB libres de 15,7) y no lo reinicio sin que SOKA lo pida.

- Rama y commits: `producto-v1`, un commit local sobre `ebfa31d`. Sin subir.
- Qué cambió (67 archivos: 14 nuevos, 37 modificados, 16 borrados; +2.560 y −5.435 líneas):
  - **Sesión** (`web/src/lib/auth/session.ts`, reescrito): la identidad sale solo de la cookie `cf_session`. Ya no existe usuario por defecto ni se siembra la demo en una visita anónima. `web/src/proxy.ts` manda a `/entrar` a quien abre `/app`, `/negocio` o `/admin` sin cookie; `/negocio` sin sesión va a `/negocio/unirse`, así que un tendero nuevo ya puede registrarse.
  - **Admin**: `isAdmin` exige correo en `ADMIN_EMAILS`, correo verificado y que no sea usuario demo. La columna `users.role` ya no otorga nada. `requireAdmin` responde 404 a quien tiene sesión sin permiso. `/admin` completo es solo para admin; salió la pantalla y la barra de "credenciales maestras".
  - **Correo verificado** (nuevo, no estaba en el plan): el registro no comprueba de quién es el correo, así que con solo `ADMIN_EMAILS` cualquiera podía registrarse con el correo de SOKA antes que él y quedar de admin. Ahora hace falta haber entrado con Google o haber abierto el enlace de "Olvidé mi contraseña" (`users.email_verified_at`).
  - **Demo aislada**: borradas `/api/demo/session`, `/demo`, sus acciones, los accesos de un clic de `/entrar` y el recorrido guiado. La demo se abre desde `/admin` con "Ver como persona" o "Ver como tendero": queda anotado en la sesión del admin (`sessions.acting_as_user_id`) y solo vale si quien mira es admin y el destino tiene `is_demo`, revisado en cada petición. Franja negra fija "Demo · datos de ejemplo" con cambio Persona/Tendero y Salir (`web/src/components/demo/demo-bar.tsx`). Los usuarios demo se siembran sin clave y sin rol; ya no se crea `admin@cifra.co`. No pueden entrar por clave, por Google, por enlace de cambio de clave ni por enlace embebido. Las vitrinas `/b/demo-*` dan 404 fuera de la demo y una persona real no puede reclamar una oferta de ejemplo (ni al revés).
  - **Negocio**: se entra solo por membresía. El admin y la demo ya no son "dueños" de todos los negocios; salió "abrir negocio como admin". Cambiar de negocio activo valida la membresía.
  - **Acciones del servidor: de 77 a 62.** Salieron las 11 que escribían plata simulada o datos inventados (marcar la propia factura como pagada, recargar la bolsa prepago, plan Plus, meta de ahorro y "jugadas", mandato Ley 1581, sesión embebida de demo) y `markOnboarded`. `ensureEditableLiquidAccount` pasó a `web/src/lib/manual.ts`: ya no es un endpoint.
  - **Componentes borrados** (dependían de esas acciones): meta de ahorro y recomendaciones, planes, "blindaje" de consentimiento, mandato de débito, vitrina de marca blanca, recorrido guiado. La cuenta del negocio ya no muestra canales de pago de relleno: salen solo de `CIFRA_BREB_KEY` y `CIFRA_NEQUI_NUMBER`.
  - Ajuste del 12 nov, 09:20: `/admin/presentacion` no verificaba nada por sí misma (solo la frenaba el proxy cuando no había cookie); ahora llama `requireAdmin`. Revisé las 22 páginas protegidas y los 14 manejadores de ruta: todos verifican por su cuenta. Solo comprobado con typecheck.
  - Ajuste del 12 nov, 13:58: nueva prueba `web/src/lib/__tests__/rutas-protegidas.test.ts` (45 casos, sin base de datos). Lee el código y falla si una página privada o un manejador de ruta deja de verificar la sesión por su cuenta, si aparece una página nueva que nadie declaró pública, o si vuelve una ruta de demo. También prueba el proxy: sin cookie, `/app`, `/negocio/caja` y `/admin` van a `/entrar` y `/negocio` va al registro de negocio. `npx vitest run`: 15 archivos, 162 de 162.
  - **Otros cierres**: Google solo enlaza cuentas con `email_verified`; cambiar la clave cierra las demás sesiones; "borrar cuenta" no opera dentro de la demo; el cron mira al admin real.
  - **Migración** `web/drizzle/0007_seguridad.sql`: columnas `users.email_verified_at` y `sessions.acting_as_user_id`, más el saneamiento autorizado (`role = 'user'` para todos; usuarios demo sin clave, sin sesiones, sin Google, sin enlaces pendientes). No borra datos de producto.
  - **Pruebas nuevas** (`web/test/integration/`, `web/vitest.integration.config.ts`, `npm run test:int`): corren las acciones y los manejadores de ruta contra `cifra_test`. Se niegan a arrancar contra cualquier base que no sea local y terminada en `_test`.
  - `npm run typecheck` ahora es `next typegen && tsc --noEmit`; salió `npm run lint` (no existe en Next 16). `CLAUDE.md`, los README y `.env.example` quedaron al día. Borrados los 5 scripts de punta a punta viejos, que dependían de la puerta demo.
- Por qué: es la primera regla del brief y bloqueaba la meta 2 (un tendero no podía registrarse porque ya "era" el dueño de La Espiga).
- Verificación (comando y resultado, con números):
  - `npm run typecheck`: 0 errores, incluidos los archivos de prueba.
  - `npx vitest run` (unitarias): 12 archivos, 96 de 96, 1,73 s.
  - `npx next build`: sin errores, 36,9 s. La lista de rutas ya no trae `/api/demo/session` ni `/demo`.
  - Pruebas de integración, corridas archivo por archivo antes de que se detuviera la base, con el mismo código de `src/` que queda en el commit:
    - `permisos-acciones.itest.ts`: 174 de 175 en 107,9 s. Son 50 acciones con sesión, cada una probada sin sesión, con la sesión de otra persona y con la del dueño (más "persona sin negocio" en las de negocio y "dueño de negocio no es admin" en las de admin). La que falló es la metaprueba que busca los archivos de las acciones con prueba propia, que en ese momento aún no existían. Después comprobé con un script que los 12 `describe` están (12 de 12) y que las 62 acciones exportadas están cubiertas; **no la volví a correr**.
    - `sesion-admin-demo.itest.ts`: 35 de 35 en 24,0 s.
    - `acciones-publicas.itest.ts` y `rutas-api.itest.ts`: 47 de 47 en 23,8 s.
    - Total: 257 pruebas, 256 en verde y 1 pendiente de repetir.
  - Lo que estas pruebas demuestran, entre otras cosas: sin cookie no hay usuario aunque Mariana exista en la base; `role = 'admin'` en la base no da admin; registrarse con el correo de `ADMIN_EMAILS` no da admin; un usuario demo no entra ni con una clave válida guardada; "ver como" hacia una persona real se rechaza y, si alguien lo escribe a mano en la base, se ignora; reiniciar la demo no cambia un solo campo de los datos reales; `/api/export` sin sesión responde 401.
  - **Sin hacer:** recorrido de punta a punta en navegador (visitante sin sesión por todas las rutas, usuario nuevo, tendero nuevo hasta la caja, admin abriendo y cerrando la demo). No he visto con mis ojos la franja de demo ni el lanzador de `/admin`.
- Qué revisar en la vista previa: no hay vista previa (la rama no está subida). Para verlo en local: `cd devdb && npm start`; en otra terminal `cd web && npm run db:migrate && npm run dev`. Entonces:
  1. Sin sesión, abre `/app`, `/negocio/caja` y `/admin`: los tres deben llevar a `/entrar`. `/negocio` debe llevar al registro de negocio.
  2. Pon tu correo en `ADMIN_EMAILS` de `web/.env.local`, crea la cuenta, usa "Olvidé mi contraseña" (en local la pantalla muestra el enlace) y abre `/admin`.
  3. En `/admin`: "Ver como persona", pasa a "Tendero" en la franja negra, y "Salir".
  4. Con otra cuenta cualquiera, `/admin` debe dar 404.
- Decisiones que necesito de SOKA:
  1. **Avísame cuando pueda volver a levantar la base local** (o levántala tú con `cd devdb && npm start`). Con eso corro la suite completa, escribo y corro el recorrido en navegador y cierro la etapa.
  2. **Antes de desplegar esto a producción:** para entrar a `/admin` vas a necesitar el correo verificado. ¿Producción tiene "Continuar con Google" configurado, o un servicio de correo (`RESEND_API_KEY` o `SMTP_URL`) para que llegue el enlace de cambio de clave? Si no tiene ninguno de los dos, quedarías fuera de `/admin` hasta configurarlo.
  3. Siguen abiertas las decisiones 5, 6 y 7 del plan.
- Pendientes y riesgos:
  - El riesgo de producción sigue abierto hasta que esto se despliegue.
  - `/` sin sesión lleva por ahora a `/entrar`; la página pública llega en la Etapa 4.
  - El Hoy todavía muestra el "tope de hoy" con el factor 0,65 y los pesos con coma: es la Etapa 2. El selector Persona/Negocio sigue visible: Etapa 3.
  - `web/src/app/admin/page.tsx` conserva una constante `realAdmin = true` y condicionales que ya no deciden nada; se limpian en la Etapa 5, cuando se rehace el tablero.
  - En las bases que ya existen quedan sin uso las columnas `users.app_preferences`, `merchants.mandate_config` y `users.role`. No las borré.
  - No toqué: el webhook de Wompi (compara la firma sin tiempo constante y no valida el monto), la cabecera que bloquea la cámara (Etapa 6) ni la verificación del correo de las personas normales al registrarse.
  - El rol "cajero" existe en el esquema pero hoy tiene los mismos permisos que el dueño; no hay pantalla para crear cajeros.
  - La suite de integración tarda unos 2 min 35 s porque reconstruye el mundo de prueba en cada caso.

### 2026-11-11 16:20, Etapa 0: base de trabajo y plan

- Rama y commits: `producto-v1`, creada desde `main` en `b709ac9`. Commit local `8047d88` (más uno de ajuste a esta bitácora), sin subir.
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
  - Fin de línea: con `.gitattributes`, `git status` da 0 archivos modificados con `core.autocrlf` en `true`, `false` e `input` (el brief reportaba 206; el "antes" no lo medí yo).
  - Recorridos a 390x844 con Chrome: 13 rutas como visitante sin cookies, 17 pantallas como usuario nuevo, 12 como tendero nuevo y la validación en caja del código `9M6GCR`. Resultados en "Lo que comprobé yo mismo".
  - Ningún cambio en `web/src`: el producto se comporta igual que en `b709ac9`.
- Qué revisar en la vista previa: nada todavía; esta etapa no cambia la app y la rama no está subida.
- Decisiones que necesito de SOKA: las 7 de la sección "Decisiones que necesito de SOKA". Las tres primeras bloquean la Etapa 1 y la subida de la rama.
- Pendientes y riesgos:
  - El riesgo de producción descrito arriba sigue abierto hasta desplegar la Etapa 1.
  - No medí el tiempo de una persona real del QR a la cifra; hoy hay tres pantallas antes de la primera pregunta (registro, confianza, paso 1). Se mide en la Etapa 4.
  - `embedded-postgres` es una dependencia nueva solo de desarrollo (109 MB instalados en Windows), fija en la versión `18.6.0-beta.19`.
  - En esta copia, 205 archivos siguen con CRLF en disco. Git ya no los marca; pasan a LF a medida que se tocan o con un clon nuevo. No los reescribí en bloque: es una sobrescritura forzada de todo el árbol de trabajo y no hace falta.
