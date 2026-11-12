import { LegalPage } from '@/components/legal/page';
import { B2B2CSimulator } from './api-playground';

export const metadata = { title: 'API y Canal B2B2C para Entidades · CIFRA' };

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-ink px-4 py-3.5 text-[13px] leading-relaxed text-white">
      <code>{children}</code>
    </pre>
  );
}

const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cifra.co';

export default function DevelopersPage() {
  return (
    <LegalPage title="API y Canal B2B2C para Entidades" updated="8 de noviembre de 2026">
      <p>
        Con esta API una cooperativa, fondo de empleados, caja de compensación, billetera digital o wallet de retail (como Starbucks) integra CIFRA dentro de su propia aplicación usando los saldos y movimientos que ya custodia. No requiere esperar regulación de finanzas abiertas: la entidad mantiene la relación con su usuario, le entrega bienestar financiero inmediato y recibe el <strong>30 % de las comisiones</strong> generadas cuando sus usuarios redimen ofertas en comercios de barrio.
      </p>


      <B2B2CSimulator />

      <h2>Autenticación y seguridad</h2>
      <p>
        Cada entidad recibe una llave secreta con prefijo <code>cfk_</code> (almacenada únicamente como hash SHA-256 en CIFRA). Viaja en el encabezado <code>Authorization</code> desde tus servidores backend, nunca desde el navegador o la app móvil.
      </p>
      <Code>{`Authorization: Bearer cfk_...`}</Code>
      <p>
        Todos los montos viajan en centavos enteros de peso colombiano (<code>amount_minor</code>): $45,000 es <code>4500000</code>. Negativo indica salida de dinero; positivo indica entrada. Límite: 600 peticiones por minuto por entidad.
      </p>

      <h2>1. Crear o actualizar un asociado</h2>
      <p>
        Llámalo cuando el asociado active CIFRA en tu app. <code>consent_at</code> registra el instante exacto de autorización Ley 1581/2012. Es idempotente.
      </p>
      <Code>{`PUT ${site}/api/v1/members/{member_id}
{
  "name": "Andrés",
  "income": { "frequency": "quincenal", "days": [15, 30] },
  "consent_at": "2026-11-06T10:00:00-05:00"
}`}</Code>

      <h2>2. Sincronizar cuenta y saldo disponible</h2>
      <Code>{`PUT ${site}/api/v1/members/{member_id}/accounts/{account_id}
{
  "kind": "ahorros",
  "name": "Ahorros a la vista",
  "mask": "7788",
  "balance": { "amount_minor": 185000000, "at": "2026-11-06T08:00:00-05:00" }
}`}</Code>
      <p>
        <code>kind</code>: <code>ahorros</code>, <code>corriente</code>, <code>billetera</code>, <code>tarjeta_credito</code> u <code>otra</code>. Los cupos de tarjeta de crédito nunca se suman como efectivo disponible.
      </p>

      <h2>3. Enviar movimientos (idempotente)</h2>
      <p>
        Hasta 1,000 movimientos por lote. Reenviar un mismo <code>id</code> externo nunca duplica registros. Recomendamos enviar 90 días al activar para detectar cobros recurrentes y luego sincronizar novedades diarias.
      </p>
      <Code>{`POST ${site}/api/v1/members/{member_id}/accounts/{account_id}/transactions
{
  "transactions": [
    { "id": "mov-20261030-001", "posted_on": "2026-10-30", "description": "PAGO NOMINA EMPRESA SAS", "amount_minor": 250000000 },
    { "id": "mov-20261031-002", "posted_on": "2026-10-31", "description": "COMPRA EN D1 CHAPINero", "amount_minor": -3450000 }
  ]
}

200 { "received": 2, "inserted": 2, "duplicates": 0 }`}</Code>

      <h2>4. Consultar la cifra calculada (headless)</h2>
      <p>Ideal para mostrar el disponible seguro directamente en la pantalla principal de la app de la entidad.</p>
      <Code>{`GET ${site}/api/v1/members/{member_id}/cifra

200 {
  "ready": true,
  "next_income_on": "2026-11-15",
  "days_left": 9,
  "balance_minor": 185000000,
  "pending_minor": 92000000,
  "projected_variable_minor": 38000000,
  "available_minor": 55000000,
  "per_day_minor": 6111111,
  "status": "holgado",
  "pending": [{ "name": "Spotify", "date": "2026-11-09", "amount_minor": 1690000, "estimated": false }],
  "warnings": []
}`}</Code>

      <h2>5. Abrir experiencia embebida con token efímero (2 minutos)</h2>
      <p>
        Cuando el asociado toca «Ver detalles, ¿Puedo? u Ofertas de barrio», tu backend solicita una sesión firmada de un solo uso que abre CIFRA en un WebView seguro. Toda oferta redimida por ese asociado queda atribuida automáticamente a tu entidad con reparto del 30 %.
      </p>
      <Code>{`POST ${site}/api/v1/members/{member_id}/sessions

201 { "url": "${site}/e/...", "expires_at": "2026-11-06T15:02:00Z" }`}</Code>

      <h2>6. Revocación inmediata (Ley 1581 de 2012)</h2>
      <p>Si el asociado revoca su autorización en tu aplicación, este llamado elimina en cascada sus cuentas, movimientos y sesiones en CIFRA.</p>
      <Code>{`DELETE ${site}/api/v1/members/{member_id}

204 No Content`}</Code>
    </LegalPage>
  );
}
