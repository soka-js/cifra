import {
  Calculator,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  PlusCircle,
  Printer,
  QrCode,
  Receipt,
  Repeat2,
  Settings,
  Sparkles,
  Tag,
  UserPlus,
  UserRound,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { logout } from '@/app/actions/auth';
import { MenuGroup, MenuRow } from '@/components/app/menu-list';
import { InstallCard } from '@/components/install';
import { requireMerchantAccess } from '@/lib/auth/session';
import { bogotaDate } from '@/lib/data';
import { cop, percentFromBps, shortDate } from '@/lib/format';
import { loadMerchantDashboard } from '@/lib/merchant-data';
import { loadMerchantBreakEvenData } from '@/lib/v3-data';

export const metadata = { title: 'Mi negocio' };

export default async function MerchantHomePage({
  searchParams,
}: {
  searchParams: Promise<{ activado?: string; oferta?: string }>;
}) {
  const sp = await searchParams;
  const access = await requireMerchantAccess();
  const [data, cuadre] = await Promise.all([
    loadMerchantDashboard(access.merchant),
    loadMerchantBreakEvenData(access.merchant),
  ]);
  const { report } = data;
  const activeOffers = data.offers.filter((o) => o.status === 'activa');
  const firstName = access.merchant.ownerName.split(' ')[0] || '';
  // Sin ninguna venta todavía: en vez de cuatro ceros, los tres pasos hasta la primera.
  const noSalesYet = report.redemptionsCount === 0 && data.recentRedemptions.length === 0 && report.organicReturnCustomersCount === 0;
  const hasOffer = activeOffers.length > 0;

  return (
    <div className="space-y-6">
      {(sp.activado === '1' || sp.oferta === 'publicada') && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-primary/30 bg-primary-pale px-4 py-3 text-[14px] font-medium text-primary-dark">
          <CheckCircle2 size={18} className="shrink-0" aria-hidden="true" />
          <span>
            {sp.oferta === 'publicada'
              ? '¡Tu oferta ya está publicada y visible para vecinos elegibles de tu zona!'
              : '¡Bienvenido! Tu negocio ya está activo en CIFRA.'}
          </span>
        </div>
      )}

      <div>
        <p className="text-[15px] text-ink-muted">{firstName ? `Hola, ${firstName}` : 'Hola'}</p>
        <h1 className="mt-0.5 font-display text-[30px] font-bold leading-tight tracking-[-0.025em] text-ink">{access.merchant.name}</h1>
      </div>

      {noSalesYet && (
        <section aria-labelledby="primera-venta" data-testid="guia-tendero" className="surface-card p-5">
          <h2 id="primera-venta" className="font-display text-[19px] font-bold text-ink">
            Tres pasos para tu primera venta con CIFRA
          </h2>
          <ol className="mt-3 space-y-1">
            <GuideStep
              n={1}
              done={hasOffer}
              href="/negocio/ofertas"
              title={hasOffer ? 'Tu oferta está publicada' : 'Publica tu primera oferta'}
              hint={hasOffer ? 'Ya la ven las personas de tu zona.' : 'Elige una idea ya escrita y publícala.'}
            />
            <GuideStep
              n={2}
              done={false}
              href="/negocio/vitrina"
              title="Pon tu afiche en el mostrador"
              hint="Trae el QR de tu negocio. Lo imprimes o lo mandas por WhatsApp."
            />
            <GuideStep
              n={3}
              done={false}
              href="/negocio/caja"
              title="Cobra el primer código"
              hint="El cliente te muestra 6 letras; la Caja te dice cuánto cobrarle."
            />
          </ol>
        </section>
      )}

      {/* Acceso gigante a Caja para mostrador */}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Link
          href="/negocio/caja"
          className="group flex items-center justify-between gap-4 rounded-2xl bg-terra p-5 text-white shadow-card transition hover:bg-terra-dark"
        >
          <div>
            <p className="font-display text-[22px] font-bold leading-snug">Cobrar un código</p>
            <p className="mt-1 text-[13.5px] text-white/85">
              Escribe o escanea las 6 letras del cliente y te decimos cuánto cobrarle.
            </p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <QrCode size={24} aria-hidden="true" />
          </span>
        </Link>

        <Link
          href="/negocio/ofertas"
          className="surface-card flex items-center justify-between gap-4 p-5 transition hover:border-line-strong"
        >
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-terra-dark">
              {activeOffers.length > 0
                ? `${activeOffers.length} ${activeOffers.length === 1 ? 'oferta encendida' : 'ofertas encendidas'}`
                : 'Aún sin oferta activa'}
            </p>
            <p className="mt-1 font-display text-[21px] font-bold leading-snug text-ink">
              {activeOffers.length > 0 ? 'Ajustar mis ofertas' : 'Publicar mi primera oferta'}
            </p>
            <p className="mt-1 text-[13.5px] text-ink-muted">
              Ofertas para clientes nuevos u ofertas por horas para los ratos tranquilos.
            </p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-terra-pale text-terra-dark">
            <PlusCircle size={23} aria-hidden="true" />
          </span>
        </Link>
      </div>

      {/* Termómetro vivo del día: valor desde el Día 1 aunque aún lleguen pocos códigos */}
      <section className="surface-card border-terra/25 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className={cuadre.summary.reachedBreakEven ? 'badge-primary' : 'badge-terra'}>
              {cuadre.summary.dailyBreakEvenMinor === null ? 'Vendido hoy' : 'Tu meta de hoy'}
            </span>
            <p className="tnum mt-2 font-display text-[26px] font-extrabold leading-none text-ink">
              {cop(cuadre.summary.todaySalesMinor)}{' '}
              {cuadre.summary.dailyBreakEvenMinor !== null && (
                <span className="text-[14px] font-normal text-ink-muted">
                  de {cop(cuadre.summary.dailyBreakEvenMinor)} ({cuadre.summary.progressPct} %)
                </span>
              )}
            </p>
            <p className="mt-1 text-[13px] text-ink-muted">
              {cuadre.summary.dailyBreakEvenMinor === null
                ? 'En el cuadre puedes escribir cuánto necesitas vender al día y te decimos cuánto te falta.'
                : cuadre.summary.reachedBreakEven
                  ? 'Ya cubriste tu meta de hoy.'
                  : `Te faltan ${cop(cuadre.summary.gapToBreakEvenMinor)} hoy. Puedes anotar ventas de mostrador o prender una oferta por horas.`}
            </p>
          </div>
          <Link href="/negocio/cuadre" className="btn-ink shrink-0 text-[13.5px]">
            Abrir el cuadre
          </Link>
        </div>
        {cuadre.summary.dailyBreakEvenMinor !== null && (
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-paper-deep">
            <div
              className={`h-full rounded-full ${cuadre.summary.reachedBreakEven ? 'bg-primary' : 'bg-terra'}`}
              style={{ width: `${Math.min(100, Math.max(4, cuadre.summary.progressPct))}%` }}
            />
          </div>
        )}
      </section>

      {!noSalesYet && (
        <>
        {/* Las 4 cifras llanas definidas en G.10 */}
        <section aria-label="Este mes con CIFRA" className="space-y-3">
          <h2 className="font-display text-[20px] font-bold text-ink">
            Este mes con CIFRA
          </h2>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="surface-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-ink-muted">
                  Ventas con oferta CIFRA
                </span>
                <Tag size={17} className="text-terra" aria-hidden="true" />
              </div>
              <p className="tnum mt-2 font-display text-[32px] font-bold text-ink">
                {report.redemptionsCount} {report.redemptionsCount === 1 ? 'compra' : 'compras'}
              </p>
              <p className="mt-1 text-[13px] text-ink-muted">
                Pedidos por valor original de{' '}
                <strong className="tnum font-semibold text-ink">{cop(report.grossAttributedSalesMinor)}</strong>
              </p>
            </div>

            <div className="surface-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-ink-muted">
                  Lo que te queda
                </span>
                <Wallet size={17} className="text-primary-dark" aria-hidden="true" />
              </div>
              <p className="tnum mt-2 font-display text-[32px] font-bold text-primary-dark">
                {cop(report.merchantNetKeptMinor)}
              </p>
              <p className="mt-1 text-[13px] text-ink-muted">
                Cobraste <span className="tnum font-medium text-ink">{cop(report.netCollectedSalesMinor)}</span> · Comisión CIFRA ({percentFromBps(access.merchant.commissionBps)}):{' '}
                <span className="tnum font-medium text-ink">{cop(report.cifraCommissionMinor)}</span>
              </p>
            </div>

            <div className="surface-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-ink-muted">
                  Clientes nuevos
                </span>
                <UserPlus size={17} className="text-terra" aria-hidden="true" />
              </div>
              <p className="tnum mt-2 font-display text-[32px] font-bold text-ink">
                {report.newCustomersCount} {report.newCustomersCount === 1 ? 'vecino nuevo' : 'vecinos nuevos'}
              </p>
              <p className="mt-1 text-[13px] text-ink-muted">
                {report.newCustomersCount > 0
                  ? `No te habían comprado en los últimos 90 días · inversión promedio ${cop(report.averageCostPerNewCustomerMinor)} por cliente nuevo`
                  : 'Apenas lleguen tus primeros clientes nuevos los verás aquí.'}
              </p>
            </div>

            <div className="surface-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-ink-muted">
                  Volvieron sin descuento
                </span>
                <Repeat2 size={17} className="text-primary-dark" aria-hidden="true" />
              </div>
              <p className="tnum mt-2 font-display text-[32px] font-bold text-primary-dark">
                {report.organicReturnCustomersCount}{' '}
                {report.organicReturnCustomersCount === 1 ? 'cliente volvió' : 'clientes volvieron'}
              </p>
              <p className="mt-1 text-[13px] text-ink-muted">
                {report.organicReturnSalesMinor > 0
                  ? `Te dejaron ${cop(report.organicReturnSalesMinor)} adicionales a precio completo y $0 de comisión.`
                  : 'Cuando quienes te conocieron con oferta vuelvan a precio normal, medimos esas compras sin cobrarte comisión.'}
              </p>
            </div>
          </div>
        </section>

        {/* Últimas ventas pasadas por Caja */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[20px] font-bold text-ink">Últimos cobros en Caja</h2>
            <Link href="/negocio/cuenta" className="text-[13.5px] font-semibold text-terra-dark hover:underline">
              Ver estado de cuenta →
            </Link>
          </div>

          {data.recentRedemptions.length === 0 ? (
            <div className="surface-card p-5 text-[14px] text-ink-muted">
              Todavía no has registrado ventas con código CIFRA. Cuando un vecino llegue a tu mostrador con un código de 6 letras, entra a{' '}
              <Link href="/negocio/caja" className="font-semibold text-terra-dark underline">
                Caja
              </Link>{' '}
              para validarlo en segundos.
            </div>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-card">
              {data.recentRedemptions.slice(0, 8).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14.5px] font-semibold text-ink">{r.customerFirstName}</p>
                      {r.isNewCustomer && (
                        <span className="badge-primary">
                          <Sparkles size={11} aria-hidden="true" />
                          Cliente nuevo
                        </span>
                      )}
                      {r.userConfirmedAt && (
                        <span className="badge-neutral">Confirmado por el cliente</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-ink-muted">
                      {shortDate(bogotaDate(r.redeemedAt))} · {r.offerTitle}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="tnum text-[15px] font-bold text-ink">
                      Cobraste {cop(r.netPaidByUserMinor)}
                    </p>
                    <p className="tnum text-[12px] text-ink-muted">
                      Te quedan {cop(r.merchantNetKeepMinor)} · Comisión {cop(r.cifraCommissionMinor)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        </>
      )}

      <MenuGroup title="Tu negocio">
        <MenuRow id="menu-afiche" href="/negocio/vitrina" icon={Printer} label="Afiche y vitrina" hint="El QR para tu mostrador y tu página pública" tone="terra" />
        <MenuRow href="/negocio/cuenta" icon={Receipt} label="Cuenta y pagos" hint="Lo vendido con CIFRA y la comisión de la quincena" tone="terra" />
        <MenuRow href="/negocio/cuadre" icon={Calculator} label="Cuadre del día" hint="Tus ventas de mostrador y tu meta diaria" tone="terra" />
        <MenuRow href="/negocio/informe" icon={FileText} label="Informe del mes" hint="Una página para imprimir o mandar por WhatsApp" tone="terra" />
        <MenuRow href="/negocio/perfil" icon={Settings} label="Datos del negocio" hint="Dirección, horario y cómo te pagan" tone="terra" />
      </MenuGroup>

      <MenuGroup>
        <MenuRow href="/app" icon={UserRound} label="Mi cifra personal" hint="Cuánto puedes gastar tú hasta tu próximo pago" />
      </MenuGroup>

      <InstallCard tone="terra" />

      <form action={logout}>
        <button type="submit" className="btn-ghost w-full">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}

function GuideStep({
  n,
  done,
  href,
  title,
  hint,
}: {
  n: number;
  done: boolean;
  href: string;
  title: string;
  hint: string;
}) {
  return (
    <li>
      <Link href={href} className="-mx-2 flex items-center gap-3.5 rounded-xl px-2 py-2.5 transition-colors active:bg-paper-warm hover:bg-paper/70">
        <span
          className={`tnum grid h-8 w-8 shrink-0 place-items-center rounded-full text-[14px] font-bold ${
            done ? 'bg-primary text-white' : 'border-2 border-terra/40 text-terra-dark'
          }`}
        >
          {done ? <Check size={17} strokeWidth={3} aria-label="Hecho" /> : n}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[15px] font-semibold ${done ? 'text-ink-muted' : 'text-ink'}`}>{title}</span>
          <span className="block text-[13px] leading-snug text-ink-muted">{hint}</span>
        </span>
        {!done && <ChevronRight size={18} className="shrink-0 text-ink-faint" aria-hidden="true" />}
      </Link>
    </li>
  );
}
