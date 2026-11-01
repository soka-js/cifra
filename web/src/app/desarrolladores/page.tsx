import { LegalPage } from '@/components/legal/page';

export const metadata = { title: 'API para entidades' };

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-ink px-4 py-3.5 text-[13px] leading-relaxed text-white">
      <code>{children}</code>
    </pre>
  );
}

const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tu-dominio';

export default function DevelopersPage() {
  return (
    <LegalPage title="API para entidades" updated="1 de noviembre de 2026">
      <p>
        Con esta API una cooperativa, banco o billetera ofrece CIFRA dentro de su app usando los datos que ya tiene de sus asociados.
        No requiere finanzas abiertas: la entidad es la dueña de la relación y de los datos, y el asociado autoriza en la app de la
        entidad.
      </p>

      <h2>Autenticación</h2>
      <p>
        Cada entidad recibe una llave secreta que empieza por <code>cfk_</code>. Va en el encabezado <code>Authorization</code> y solo
        se usa desde tus servidores, nunca desde la app del celular.
      </p>
      <Code>{`Authorization: Bearer cfk_...`}</Code>
      <p>
        Los montos van en centavos de peso, como enteros (<code>amount_minor</code>): $45.000 es <code>4500000</code>. Negativo es
        plata que sale, positivo es plata que entra. Las fechas de movimiento son <code>AAAA-MM-DD</code> y los instantes van en ISO
        8601 con zona horaria. Límite: 600 peticiones por minuto por entidad.
      </p>

      <h2>1. Crear o actualizar un asociado</h2>
      <p>
        Llámalo cuando el asociado active CIFRA en tu app. <code>consent_at</code> es el momento en que aceptó el tratamiento de sus
        datos para CIFRA; guárdalo también de tu lado como prueba de la autorización. Es idempotente.
      </p>
      <Code>{`PUT ${site}/api/v1/members/{member_id}
{
  "name": "Andrés",
  "income": { "frequency": "quincenal", "days": [15, 30] },
  "consent_at": "2026-11-01T10:00:00-05:00"
}`}</Code>
      <p><code>frequency</code>: mensual, quincenal, semanal (días 1 a 7, lunes a domingo) o irregular. <code>income</code> es opcional: si no lo envías, CIFRA lo detecta en los movimientos o le pregunta al asociado.</p>

      <h2>2. Crear o actualizar una cuenta y su saldo</h2>
      <Code>{`PUT ${site}/api/v1/members/{member_id}/accounts/{account_id}
{
  "kind": "ahorros",
  "name": "Ahorros a la vista",
  "mask": "7788",
  "balance": { "amount_minor": 185000000, "at": "2026-11-01T08:00:00-05:00" }
}`}</Code>
      <p><code>kind</code>: ahorros, corriente, billetera, tarjeta_credito u otra. Las tarjetas de crédito no suman a la cifra.</p>

      <h2>3. Enviar movimientos</h2>
      <p>Hasta 1.000 por petición. Es idempotente por <code>id</code>: reenviar un movimiento no lo duplica. Lo ideal es enviar 90 días al activar y después los nuevos cada día.</p>
      <Code>{`POST ${site}/api/v1/members/{member_id}/accounts/{account_id}/transactions
{
  "transactions": [
    { "id": "mov-20261030-001", "posted_on": "2026-10-30", "description": "PAGO NOMINA EMPRESA SAS", "amount_minor": 250000000 },
    { "id": "mov-20261031-002", "posted_on": "2026-10-31", "description": "COMPRA EN D1", "amount_minor": -3450000 }
  ]
}

200 { "received": 2, "inserted": 2, "duplicates": 0 }`}</Code>

      <h2>4. Leer la cifra</h2>
      <p>Para mostrar la cifra en tu propia pantalla, sin abrir CIFRA.</p>
      <Code>{`GET ${site}/api/v1/members/{member_id}/cifra

200 {
  "ready": true,
  "next_income_on": "2026-11-15",
  "days_left": 14,
  "balance_minor": 185000000,
  "pending_minor": 113431100,
  "projected_variable_minor": 44604000,
  "available_minor": 26964900,
  "per_day_minor": 1926064,
  "status": "holgado",
  "pending": [{ "name": "Netflix", "date": "2026-11-05", "amount_minor": 2690000, "estimated": false }],
  "warnings": []
}`}</Code>

      <h2>5. Abrir CIFRA dentro de tu app</h2>
      <p>
        Cuando el asociado toque &quot;Ver mi cifra&quot;, tu servidor pide un enlace y tu app lo abre en un webview. El enlace sirve
        una sola vez y vence en 2 minutos.
      </p>
      <Code>{`POST ${site}/api/v1/members/{member_id}/sessions

201 { "url": "${site}/e/...", "expires_at": "2026-11-01T15:02:00Z" }`}</Code>

      <h2>6. Borrar un asociado</h2>
      <p>Si el asociado revoca la autorización en tu app, borra sus datos en CIFRA. Se eliminan de inmediato.</p>
      <Code>{`DELETE ${site}/api/v1/members/{member_id}

204`}</Code>

      <h2>Errores</h2>
      <Code>{`{ "error": { "code": "no_existe", "message": "No hay un asociado con ese id." } }`}</Code>
      <p>
        Códigos: <code>no_autorizado</code> (401), <code>cuerpo_invalido</code> e <code>id_invalido</code> (400),{' '}
        <code>no_existe</code> (404), <code>demasiadas_peticiones</code> (429).
      </p>

      <h2>Llaves de prueba</h2>
      <p>Para pedir una llave, usa el formulario de entidades en la página principal.</p>
    </LegalPage>
  );
}
