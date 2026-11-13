import { ArrowLeft, Store, UserRound } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { requireAdmin } from '@/lib/auth/session';
import { computeRedemptionSplit } from '@/lib/engine/attribution';
import { cop } from '@/lib/format';
import { siteUrl } from '@/lib/site';
import { openDemoAs } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Presentación · CIFRA', robots: { index: false } };

/**
 * Presentación para mostrar CIFRA a un profesor o inversor, desde /admin.
 *
 * Regla de esta página: solo dice lo que el producto hace hoy y lo que el equipo midió, con su
 * fuente. El ejemplo de la caja va rotulado como ejemplo y lo calcula el mismo motor de la app.
 */

// Ejemplo rotulado en pantalla: una compra con una oferta del 10 %, calculada con el motor.
const EXAMPLE_PURCHASE_MINOR = 20_000_00;
const EXAMPLE_DISCOUNT_PERCENT = 10;
const own = computeRedemptionSplit({
  grossAmountMinor: EXAMPLE_PURCHASE_MINOR,
  discountKind: 'percent',
  discountPercent: EXAMPLE_DISCOUNT_PERCENT,
  channel: 'propio',
});
const viaPartner = computeRedemptionSplit({
  grossAmountMinor: EXAMPLE_PURCHASE_MINOR,
  discountKind: 'percent',
  discountPercent: EXAMPLE_DISCOUNT_PERCENT,
  channel: 'aliado',
});
const commissionPct = own.commissionBps / 100;

function Stat({ value, children, source }: { value: string; children: React.ReactNode; source: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <dt className="tnum font-display text-[34px] font-bold leading-none text-ink">{value}</dt>
      <dd className="mt-2 text-[14.5px] leading-relaxed text-ink">{children}</dd>
      <dd className="mt-2 text-[12px] text-ink-muted">{source}</dd>
    </div>
  );
}

export default async function PresentacionPage() {
  // Todo /admin es solo para un admin real, también esta presentación.
  await requireAdmin();
  const publicUrl = siteUrl();

  return (
    <div className="min-h-dvh bg-paper">
      <div className="border-b border-line bg-white px-4 py-3 text-[13px]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <Link href="/admin" className="inline-flex items-center gap-1.5 font-semibold text-ink hover:underline">
            <ArrowLeft size={14} aria-hidden="true" /> Volver a /admin
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <form action={openDemoAs}>
              <input type="hidden" name="role" value="persona" />
              <button id="btn-presentacion-demo-persona" type="submit" className="btn-sm btn-primary">
                <UserRound size={13} aria-hidden="true" /> Abrir la demo como persona
              </button>
            </form>
            <form action={openDemoAs}>
              <input type="hidden" name="role" value="tendero" />
              <button type="submit" className="btn-sm border border-line bg-white text-ink">
                <Store size={13} aria-hidden="true" /> Como tendero
              </button>
            </form>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl space-y-14 px-4 pb-20 pt-8 sm:px-6">
        <header>
          <Logo />
          <h1 className="mt-6 max-w-3xl text-balance font-display text-[34px] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink sm:text-[44px]">
            Tu banco te dice cuánto tienes. CIFRA te dice cuánto puedes gastar.
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-muted">
            Un solo número hasta tu próximo pago: lo que tienes hoy, menos lo que ya está comprometido, menos tu día a
            día. Con la resta a la vista, para que sepas de dónde sale.
          </p>
          <p className="mt-3 text-[13.5px] text-ink-muted">
            Lo que ve quien escanea el QR del stand: <span className="font-semibold text-ink">{publicUrl}</span> (ábrelo en
            una ventana de incógnito; con tu sesión abierta te lleva a tu cuenta).
          </p>
        </header>

        <section aria-labelledby="problema">
          <h2 id="problema" className="font-display text-[24px] font-bold tracking-[-0.02em] text-ink">
            El problema
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Stat value="94 % y 23 %" source="Encuesta de Capacidades Financieras de Colombia (Banco Mundial y Gobierno de Colombia).">
              El 94 % dice que planea su presupuesto, pero solo el 23 % sabe cuánto gastó la semana pasada.
            </Stat>
            <Stat value="41 de 48" source="Entrevistas del equipo CIFRA en Bogotá, 2026.">
              personas entrevistadas se quedaron sin plata antes de su siguiente pago.
            </Stat>
          </dl>
        </section>

        <section aria-labelledby="evidencia">
          <h2 id="evidencia" className="font-display text-[24px] font-bold tracking-[-0.02em] text-ink">
            Lo que probamos con gente
          </h2>
          <p className="mt-2 text-[14.5px] text-ink-muted">21 sesiones guiadas con la cifra, en octubre de 2026.</p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <Stat value="16 de 21" source="Sesiones guiadas del equipo, octubre de 2026.">
              entendieron la cifra sin ayuda.
            </Stat>
            <Stat value="14 de 21" source="Sesiones guiadas del equipo, octubre de 2026.">
              tomaron una decisión con ella.
            </Stat>
            <Stat value="19 de 20" source="Sesiones guiadas del equipo, octubre de 2026.">
              creían poder gastar más de lo que en realidad podían.
            </Stat>
          </dl>
          <figure className="mt-4 rounded-2xl border border-line bg-white p-5">
            <blockquote className="font-display text-[20px] font-bold text-ink">
              «Sin duda es una idea completamente viable.»
            </blockquote>
            <figcaption className="mt-2 text-[13px] text-ink-muted">
              Karol Benavides, asesora en finanzas abiertas. Conversación grabada del 6 de noviembre de 2026.
            </figcaption>
            <ul className="mt-4 space-y-2 text-[14.5px] text-ink">
              <li>
                <strong>Los bancos todavía no abren sus datos:</strong> por eso la persona entra con cuatro datos o con el
                extracto de su banco, sin claves.
              </li>
              <li>
                <strong>Nadie pagaría solo por ver cuánto gasta:</strong> por eso la persona no paga; paga el negocio cuando
                vende.
              </li>
              <li>
                <strong>Cobrar venta por venta es riesgoso:</strong> por eso las comisiones se cobran en un corte quincenal.
              </li>
            </ul>
          </figure>
        </section>

        <section aria-labelledby="producto">
          <h2 id="producto" className="font-display text-[24px] font-bold tracking-[-0.02em] text-ink">
            Lo que hace hoy el producto
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-line bg-white p-5">
              <h3 className="flex items-center gap-2 font-display text-[18px] font-bold text-ink">
                <UserRound size={18} aria-hidden="true" /> La persona
              </h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14.5px] leading-relaxed text-ink">
                <li>
                  Contesta cuatro preguntas en la página pública, sin crear cuenta: cada cuánto le pagan, cuánto tiene, qué
                  paga fijo y cuánto gasta al día. La cifra se calcula en su celular; ningún monto sale de ahí hasta que
                  decide guardarla.
                </li>
                <li>Pregunta «¿Puedo gastar?» antes de pagar y ve cuánto le quedaría.</li>
                <li>
                  Si guarda su cifra, la ve cada día, anota gastos, marca cobros fijos y puede subir el extracto de su banco
                  para afinarla.
                </li>
              </ol>
            </div>
            <div className="rounded-2xl border border-line bg-white p-5">
              <h3 className="flex items-center gap-2 font-display text-[18px] font-bold text-ink">
                <Store size={18} aria-hidden="true" /> El negocio del barrio
              </h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14.5px] leading-relaxed text-ink">
                <li>Se registra solo, desde el celular.</li>
                <li>Publica una oferta para las personas de su zona.</li>
                <li>Valida en su caja el código de 6 letras que trae la persona.</li>
                <li>Paga el {commissionPct} % solo de la venta que CIFRA le trajo.</li>
              </ol>
            </div>
          </div>
        </section>

        <section aria-labelledby="modelo">
          <h2 id="modelo" className="font-display text-[24px] font-bold tracking-[-0.02em] text-ink">
            Cómo gana plata CIFRA
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-line bg-white p-5">
              <dt className="text-[13px] font-semibold text-ink-muted">Persona</dt>
              <dd className="mt-1 font-display text-[22px] font-bold text-ink">Gratis</dd>
            </div>
            <div className="rounded-2xl border border-line bg-white p-5">
              <dt className="text-[13px] font-semibold text-ink-muted">Negocio</dt>
              <dd className="mt-1 font-display text-[22px] font-bold text-ink">{commissionPct} % de la venta</dd>
              <dd className="mt-1 text-[13px] text-ink-muted">Solo cuando CIFRA le trae la venta. Corte quincenal.</dd>
            </div>
            <div className="rounded-2xl border border-line bg-white p-5">
              <dt className="text-[13px] font-semibold text-ink-muted">Aliado (cooperativa, caja o billetera)</dt>
              <dd className="mt-1 font-display text-[22px] font-bold text-ink">
                {viaPartner.cifraCommissionMinor > 0
                  ? `${Math.round((viaPartner.partnerShareMinor / viaPartner.cifraCommissionMinor) * 100)} % de la comisión`
                  : 'Parte de la comisión'}
              </dd>
              <dd className="mt-1 text-[13px] text-ink-muted">Cuando la persona llega por la app del aliado.</dd>
            </div>
          </dl>
          <div className="mt-4 rounded-2xl border border-dashed border-line bg-white p-5" aria-label="Ejemplo">
            <p className="text-[12px] font-semibold text-ink-muted">Ejemplo, no son datos de una venta real</p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">
              Una compra de <strong className="tnum">{cop(own.grossAmountMinor)}</strong> con una oferta del{' '}
              {EXAMPLE_DISCOUNT_PERCENT} %: la persona paga <strong className="tnum">{cop(own.netPaidByUserMinor)}</strong>,
              CIFRA cobra <strong className="tnum">{cop(own.cifraCommissionMinor)}</strong> ({commissionPct} % de lo
              cobrado) y al negocio le quedan <strong className="tnum">{cop(own.merchantNetKeepMinor)}</strong>. Si la
              persona llegó por un aliado, el aliado recibe <strong className="tnum">{cop(viaPartner.partnerShareMinor)}</strong>{' '}
              y CIFRA se queda con <strong className="tnum">{cop(viaPartner.cifraNetRevenueMinor)}</strong>.
            </p>
          </div>
        </section>

        <section aria-labelledby="falta">
          <h2 id="falta" className="font-display text-[24px] font-bold tracking-[-0.02em] text-ink">
            Lo que todavía no sabemos
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[14.5px] leading-relaxed text-ink">
            <li>
              Si los tenderos publican ofertas sin que el equipo los acompañe. Lo vamos a medir con visitas a negocios de
              Las Aguas.
            </li>
            <li>
              Cuántas personas guardan su cifra y vuelven. El embudo de la feria en /admin lo empieza a medir desde el
              stand.
            </li>
          </ul>
        </section>

        <footer className="border-t border-line pt-6 text-[13px] leading-relaxed text-ink-muted">
          CIFRA no pide la clave del banco ni mueve plata. Cada persona descarga o borra sus datos desde la app. No es una
          entidad vigilada ni capta recursos del público.
        </footer>
      </main>
    </div>
  );
}
