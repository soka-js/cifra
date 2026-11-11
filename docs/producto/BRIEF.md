# CIFRA: brief para Claude Code

Revisión hecha el 11 de noviembre de 2026 sobre `main` en el commit b709ac9, corriendo la app contra una base local.
Este archivo es el punto de partida. Tienes libertad para rediseñar, recortar y construir; si encuentras algo mejor que lo que dice aquí, propónlo y defiéndelo.

Todo lo que hagas lo documentas en `docs/producto/BITACORA.md` (instrucciones dentro de ese archivo).

## Contexto

- La app vive en `web/`: Next.js 16 App Router, Drizzle, Postgres (Neon), deploy en Vercel desde `main`.
- Lee `web/AGENTS.md`: esta versión de Next.js trae cambios y su documentación está en `node_modules/next/dist/docs/`.
- CIFRA le dice a una persona, en un solo número, cuánto puede gastar hoy sin quedarse corta antes del próximo pago, y le muestra de dónde sale ese número.
- Es lo único validado con gente (21 sesiones guiadas, octubre de 2026):
  - el 76 % (16 de 21) entendió la cifra sin ayuda;
  - el 67 % (14 de 21) tomó una decisión con ella;
  - 19 de 20 creían poder gastar más de lo que podían.
- Del otro lado está el negocio del barrio: publica ofertas, valida un código en caja y paga el 5 % de la venta solo cuando CIFRA se la trae.
- Los documentos del curso son contexto, no especificación.

## La meta

Un producto real, no un prototipo. Pasa la prueba cuando:

1. Alguien que pasa por el stand en la Semana de la Innovación (Universidad de los Andes) escanea un QR, tiene su cifra en un minuto con sus propios números, le gusta y quiere seguir usándola.
2. Un tendero se registra solo desde su celular, arma su tienda, publica una oferta y valida códigos en caja sin ayuda del equipo.
3. SOKA, desde su `/admin`, abre una demo llena de datos para mostrarla a un profesor o inversor. Nadie más ve ni toca esa demo.

Fechas: Pitch Day el 19 de noviembre de 2026 y luego la feria.

## Lo que encontró la revisión (verifícalo tú)

Sano:

- `tsc --noEmit` sin errores.
- 96 de 96 pruebas unitarias pasan.
- `next build` sale limpio.
- Funcionan:
  - el modo rápido de 4 datos (con saldo de $1.200.000, gasto diario de $25.000 y pago en 4 días mostró $1.100.000, correcto);
  - la lectura de extractos;
  - el portal del negocio;
  - la API de aliados.

Mal, en orden de gravedad:

| # | Problema | Dónde (web/src) | Cómo se comprobó |
| --- | --- | --- | --- |
| 1 | Sin sesión, todo visitante queda logueado como la usuaria demo Mariana | `lib/auth/session.ts:76` | Visitante nuevo en `/` quedó dentro de `/app` con sus datos |
| 1 | La demo y el admin operan como dueños todos los negocios, incluidos los reales | `lib/auth/session.ts:161` | Visitante nuevo en `/negocio` quedó como dueño de Panadería La Espiga |
| 1 | `/api/demo/session?role=admin` abre sesión de administrador real | `app/api/demo/session/route.ts:23` y `:57`; rol admin en `lib/demo-seed.ts:108` | Lectura del código |
| 1 | La clave demo está publicada | `app/admin/page.tsx:166` | Visible en `/admin` para cualquiera |
| 2 | Números inventados para un usuario nuevo: meta "Viaje a Santa Marta", $380.000 "verificados", "$185.000 en domicilios", "24 %" sin fuente | `components/app/savings-goal-nba-card.tsx:62`, `:122`, `:241` | Usuario nuevo con solo 4 datos los vio (ver `evidencia/usuario-nuevo-hoy.jpg`) |
| 2 | Unos 55 montos escritos a mano en componentes de pantalla | `components/` | Búsqueda de literales `_000_00` |
| 3 | Hoy mide unas 6 pantallas de celular y tiene más de 10 bloques | `app/app/page.tsx` | Captura a 390x844 (ver `evidencia/hoy-demo.jpg`) |
| 4 | Jerga del equipo visible: NBA, B2B2C, relámpago, intocables, y el selector Persona/Negocio para todos | varios | Recorrido como usuario |
| 5 | `/` no es pública: redirige a `/app`; la landing quedó en `/admin/presentacion` | `app/page.tsx:10` | Recorrido como visitante |
| 6 | Pesos con comas ($1,808,228); en Colombia es $1.808.228 | `lib/format.ts` | Recorrido como usuario |
| 7 | La tarjeta "Tiendas de tu cuadra" se rompe en una palabra por línea | Hoy | Captura |
| 8 | En Windows, Git marca 206 archivos como modificados solo por saltos de línea | raíz | `git diff --ignore-cr-at-eol` vacío |

## Reglas que no se negocian

- **Seguridad primero.** Nada más se publica hasta que:
  - ninguna ruta muestre datos sin sesión;
  - la demo esté aislada y solo se abra desde `/admin`;
  - el admin salga solo de `ADMIN_EMAILS`.
  
  Cada acción del servidor verifica que el recurso es de quien está en sesión, con una prueba por acción.
- **Cada número tiene recibo.** Todo peso o porcentaje en pantalla sale de los datos del usuario o va rotulado como ejemplo. Si no hay dato, no hay número.
- **Producción, intocable.** Nunca toques la base de producción ni sus variables. Usa Postgres local o una rama de desarrollo de Neon. Nunca subas secretos.
- **Lenguaje.** Español de Colombia, tuteo, sin jerga interna.
- **Revisión.** Nada llega a `main` sin la revisión de SOKA.

## Ideas del equipo (mejóralas o descártalas)

- Probar sin crear cuenta desde el QR; la cuenta se pide solo para guardar la cifra.
- "¿Puedo gastar?" como gancho justo después de la cifra.
- Ofertas reales de negocios alrededor de la universidad (ya existe la zona `las-aguas`).
- Que un tendero se registre en el stand en pocos minutos.
- Metas, misiones y recomendaciones apagadas hasta que se calculen con datos reales.

## Cómo trabajar

1. Explora antes de proponer:
   - corre la app;
   - recórrela en un celular de 390x844 como usuario nuevo y como tendero nuevo;
   - lee el código.
2. Escribe tu plan en la sección "Plan" de `docs/producto/BITACORA.md`: qué conservas, qué cortas, qué construyes, tus ideas propias y el orden. Espera la aprobación de SOKA antes de cambios grandes.
3. Trabaja en la rama `producto-v1`, con una solicitud de cambio por etapa y vista previa en Vercel.
4. Al cerrar cada etapa:
   - corre typecheck, pruebas, build y pruebas de punta a punta de los recorridos clave;
   - pega la salida en la bitácora;
   - di qué revisar en la vista previa.
5. Agrega `.gitattributes` con `* text=auto eol=lf`.
6. Deja un `CLAUDE.md` en la raíz con los principios y los comandos, para las próximas sesiones.
