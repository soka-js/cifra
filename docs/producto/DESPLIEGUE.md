# Despliegue de `producto-v1` a producción

Lista para SOKA, en orden. El merge de la solicitud de cambio #3 (https://github.com/soka-js/cifra/pull/3) lo hace SOKA después de las demos del 13 nov, si el ensayo sale bien.

Producción responde en `micifra.vercel.app` y `cifra-neon.vercel.app` (Vercel > `cifra` > Settings > Domains). La vista previa de esta rama es `cifra-git-producto-v1-proyects-soka.vercel.app`.

## 1. Antes del merge: variables en Vercel

En Vercel > `cifra` > Settings > Environment Variables, busca cada nombre. Así estaban el 12 nov en la noche:

| Variable | Entorno | Estado el 12 nov | Qué hacer |
| --- | --- | --- | --- |
| `ADMIN_EMAILS` | Production y Preview | Existe | Confirma que incluye tu correo, el mismo de tu cuenta de Resend. Es la única forma de ser admin. |
| `NEXT_PUBLIC_SITE_URL` | Production | Existe, solo en Production | Debe ser la dirección que va en el QR, con `https://` y sin barra final (por ejemplo `https://micifra.vercel.app`). En Preview no hace falta: la vista previa usa la dirección de su rama. |
| `RESEND_API_KEY` y `EMAIL_FROM` | Production y Preview | **No aparecen** en el proyecto `cifra` | Agrégalas en este proyecto. Sin ellas no sale ningún correo y nadie puede recuperar su clave. |
| `CRON_SECRET` | Production | **No existe** | Agrega un valor aleatorio largo (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). Vercel lo envía solo al aviso diario; sin él, `/api/cron/daily` responde 401 y el aviso no corre. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Production y Preview | No aparecen | Opcional: avisos en el celular. |
| `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` | Production y Preview | No aparecen | Opcional. El botón "Continuar con Google" solo aparece con las dos. Ver la sección 6. |

Un cambio de variables solo llega a los despliegues nuevos. Si agregas algo después del merge, redespliega producción.

Con `EMAIL_FROM=CIFRA <onboarding@resend.dev>`, Resend solo entrega al correo de la cuenta de Resend. A cualquier otra persona que pida cambiar su clave, la app le dice "No pudimos enviarte el correo para cambiar la contraseña. Inténtalo de nuevo más tarde." Para la feria hace falta un dominio verificado (sección 7).

## 2. Cambiar la clave de la base sin dejar a Vercel sin acceso

Hazlo justo antes del merge: la clave vieja deja de servir en el momento en que la cambias, y el despliegue que dispara el merge ya toma la nueva. Producción queda sin base desde que cambias la clave hasta que termina ese despliegue (unos minutos). Si prefieres no mezclarlo con el merge, haz el paso 2 completo y redespliega producción a mano (Deployments > el último de producción > Redeploy).

1. Verifica el correo de tu cuenta de Neon. Sin eso la consola de Neon no abre.
2. Vercel > `cifra` > Storage > `neon-lime-sail` > **Open in Neon**.
3. En Neon, en la rama principal (`main`, servidor `ep-square-brook…`): **Roles** > `neondb_owner` > **Reset password**. Confirma.
4. Vuelve a Vercel > Environment Variables y abre `DATABASE_URL` de Production: debe tener la clave nueva. La integración la sincroniza sola; si sigue la vieja, pega a mano la cadena nueva que muestra Neon en **Connect** (la "pooled" en `DATABASE_URL` y la directa en `DATABASE_URL_UNPOOLED`).
5. Sigue con el merge (paso 3). Si producción muestra errores de base antes de que termine el despliegue, es esta ventana.

Guía de Vercel: https://vercel.com/kb/guide/how-to-reset-a-secret-for-a-neon-integration

En Neon, los roles se copian a cada rama cuando se crea. Las ramas de vista previa que ya existen (`br-soft-sound-b89yyija` de `producto-v1`, `br-orange-brook-b8b8mc0o` de `feat/v3-valor-real` y las demás) pueden seguir aceptando la clave vieja, y tienen copia de los datos de producción. No lo pude comprobar porque la consola de Neon no me abre. Revísalo en Neon, en Roles de cada rama. Cuando ya no sirvan, borrarlas cierra esa puerta (lo decides tú).

## 3. Merge y log de producción

1. En la solicitud de cambio #3: **Create a merge commit**.
2. Vercel > Deployments > el despliegue de producción de `main` > Build Logs. Busca estas tres líneas:
   - `[migraciones] entorno: production · rama git: main`
   - `[migraciones] DATABASE_URL: ep-square-brook-…` (el servidor de producción, no `ep-proud-tooth…`)
   - `Migraciones aplicadas.`
3. Las migraciones `0007`, `0008` y `0009` cambian datos de producción (las tres autorizadas):
   - `0007` borra la clave y las sesiones de los usuarios de demostración y deja a todos con el rol `user`.
   - `0008` vacía la meta diaria y los costos fijos de fábrica de los negocios reales.
   - `0009` deja todas las ofertas sin grupo de control.

## 4. Entrar a `/admin` en producción

1. Abre `https://micifra.vercel.app/entrar` (o la dirección de `NEXT_PUBLIC_SITE_URL`).
2. Si no tienes cuenta con tu correo de `ADMIN_EMAILS`, créala en "Créala gratis en un minuto". Registrarte no verifica el correo.
3. En `/entrar`, **"¿Olvidaste tu contraseña?"**, escribe ese correo y toca "Enviar enlace de recuperación".
4. Llega un correo de `onboarding@resend.dev` (revisa spam): **"Crear nueva contraseña"**. El enlace vale 60 minutos y una sola vez.
5. Pon la clave nueva. Entras, y el correo queda verificado.
6. Abre `/admin`.

Si el correo no llega, mira en Vercel > Logs una línea `[email:resend] No se envió "Restablece tu contraseña en CIFRA": Resend respondió …`. El código dice por qué: 401 o 403 suele ser la llave o el remitente. Plan B, sin correo: en Neon > SQL Editor, rama principal, cambia `TU_CORREO` por tu correo de `ADMIN_EMAILS` y corre

```sql
UPDATE users SET email_verified_at = now()
WHERE lower(email) = lower('TU_CORREO') AND is_demo = false AND email_verified_at IS NULL
RETURNING id, email, created_at;
```

Debe devolver una sola fila, la tuya. Luego entra con tu clave y abre `/admin`.

## 5. Qué revisar en producción después (unos 20 minutos)

En una ventana de incógnito, sin sesión:

- [ ] `/app`, `/app/gasto` y `/admin` llevan a `/entrar`. `/negocio` lleva al registro de negocio.
- [ ] `/api/export` responde 401 y `/api/demo/session` responde 404.
- [ ] `admin@cifra.co` con la clave que estuvo publicada no entra ("El correo o la contraseña no coinciden").
- [ ] `/` muestra la prueba sin cuenta y da una cifra con los datos del guion.

Con tu cuenta:

- [ ] Recorrido de la persona: prueba en `/`, "Guardar mi cifra", Hoy y "¿Puedo gastar?".
- [ ] `/admin`: reinicia la demo y ábrela como persona y como tendero. Al salir vuelves a tu cuenta.
- [ ] Pide "¿Olvidaste tu contraseña?" con un correo de otra persona que tenga cuenta (o crea una de prueba): debe decir que no se pudo enviar.

En Neon > SQL Editor, rama principal (solo lectura):

```sql
-- Llaves de aliados vigentes que no sean de la demo: revoca las que no reconozcas.
SELECT p.name, k.prefix, k.created_at
FROM partner_api_keys k JOIN partners p ON p.id = k.partner_id
WHERE p.is_demo = false AND k.revoked_at IS NULL
ORDER BY k.created_at;

-- Pagos de comisión aprobados: todos deben ser tuyos.
SELECT id, merchant_id, method, amount_minor / 100 AS pesos, reference, reviewed_at, created_at
FROM merchant_payments WHERE status = 'aprobado'
ORDER BY created_at;

-- Migraciones: deben ser 10 filas (0000 a 0009).
SELECT count(*) FROM drizzle.__drizzle_migrations;
```

En Vercel:

- [ ] Logs, filtro de errores, durante la primera hora: sin errores de base ni de `[email:resend]` para tu correo.
- [ ] Al día siguiente, después de las 8:00 a. m.: `/api/cron/daily` respondió 200 (si agregaste `CRON_SECRET`).

## 6. Google (para después)

El botón aparece solo con `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` juntos (`web/src/app/entrar/page.tsx`). Con solo el ID no aparece.

En Google Cloud Console (gratis):

1. APIs y servicios > **Pantalla de consentimiento de OAuth**: tipo Externo, alcances `openid`, `email` y `profile`. Publícala; en modo de prueba solo entran los correos de la lista de prueba.
2. **Credenciales** > el cliente OAuth tipo "Aplicación web" > **URI de redireccionamiento autorizados**:
   - `https://micifra.vercel.app/api/auth/google/callback` (o el dominio de `NEXT_PUBLIC_SITE_URL`)
   - `https://cifra-git-producto-v1-proyects-soka.vercel.app/api/auth/google/callback` (vista previa)
   - `http://localhost:3000/api/auth/google/callback` (local)
3. En ese cliente, **Agregar secreto** y cópialo una sola vez.
4. En Vercel, agrega las dos variables (Production y Preview) y redespliega.

## 7. Si hay que volver atrás

Vercel > Deployments > el despliegue de producción anterior > **Instant Rollback**. El código vuelve; las migraciones no se revierten. El código anterior espera meta diaria y costos fijos en cada negocio, y `0008` los dejó vacíos en los negocios reales: el resumen del tendero puede mostrarse mal hasta volver a desplegar `producto-v1`.
