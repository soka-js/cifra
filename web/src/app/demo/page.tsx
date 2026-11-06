import {
  ArrowRight,
  CheckCircle2,
  LineChart,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Store,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { ensureDemoEcosystemSeeded } from '@/lib/demo-seed';
import {
  enterDemoAsDataRoom,
  enterDemoAsMerchant,
  enterDemoAsPersona,
  resetDemoData,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Modo Demo Interactivo en Vivo · CIFRA' };

export default async function DemoHubPage({
  searchParams,
}: {
  searchParams: Promise<{ reiniciado?: string }>;
}) {
  const sp = await searchParams;
  const demoInfo = await ensureDemoEcosystemSeeded(false);

  return (
    <div className="min-h-screen bg-paper px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Logo />
          <div className="flex items-center gap-3">
            <form action={resetDemoData}>
              <button
                type="submit"
                className="btn-sm border border-line bg-white text-ink-muted hover:text-ink"
                title="Restaurar estado inicial del barrio de demostración"
              >
                <RotateCcw size={14} aria-hidden="true" />
                Reiniciar datos demo
              </button>
            </form>
            <Link href="/" className="text-[14px] font-semibold text-ink-muted hover:text-ink">
              ← Volver al inicio
            </Link>
          </div>
        </header>

        {sp.reiniciado === '1' && (
          <div className="flex items-center gap-2 rounded-2xl border border-primary/25 bg-primary-pale px-4 py-3 text-[14px] font-medium text-primary-dark">
            <CheckCircle2 size={17} aria-hidden="true" />
            <span>Datos del barrio piloto reiniciados limpiamente.</span>
          </div>
        )}

        <div className="max-w-3xl">
          <span className="badge-terra">Barrio piloto en vivo · Chapinero, Parkway y Las Aguas</span>
          <h1 className="mt-3 font-display text-[34px] font-extrabold leading-[1.06] tracking-[-0.03em] text-ink sm:text-[46px]">
            Recorre los dos lados reales de CIFRA en un clic
          </h1>
          <p className="mt-3 text-[16.5px] leading-relaxed text-ink-muted">
            Sin formularios ni contraseñas. Explora cómo una persona joven conoce su disponible real antes de gastar, cómo una panadería de barrio gana clientes nuevos pagando solo después de vender, y cómo se miden las hipótesis falsables del negocio.
          </p>
        </div>

        {/* Los 3 actores interactivos */}
        <div className="grid gap-5 md:grid-cols-3">
          {/* Actor 1: Persona */}
          <div className="surface-card flex flex-col justify-between p-6">
            <div className="space-y-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-light text-primary-dark">
                <UserRound size={22} aria-hidden="true" />
              </span>
              <span className="block text-[12px] font-bold uppercase tracking-wider text-primary-dark">
                Lado 1 · Persona (B2C / B2B2C)
              </span>
              <h2 className="font-display text-[23px] font-bold leading-snug text-ink">
                Mariana Rojas · 26 años
              </h2>
              <p className="text-[14px] leading-relaxed text-ink-muted">
                Primer empleo en Chapinero, ingreso quincenal en Bancolombia. Revisa su cifra limpia, pregúntale «¿puedo gastar 150 mil el viernes?», reclasifica un gasto en 1 toque y genera un QR de descuento en su barrio.
              </p>
            </div>

            <form action={enterDemoAsPersona} className="mt-6">
              <button type="submit" className="btn-primary w-full">
                Entrar como Mariana
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </form>
          </div>

          {/* Actor 2: Micronegocio de barrio */}
          <div className="surface-card flex flex-col justify-between border-terra/35 p-6">
            <div className="space-y-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-terra-light text-terra-dark">
                <Store size={22} aria-hidden="true" />
              </span>
              <span className="block text-[12px] font-bold uppercase tracking-wider text-terra-dark">
                Lado 2 · Micronegocio de Barrio
              </span>
              <h2 className="font-display text-[23px] font-bold leading-snug text-ink">
                Rosa · Panadería La Espiga
              </h2>
              <p className="text-[14px] leading-relaxed text-ink-muted">
                Cra 9 # 58-14. Revisa las 4 cifras claras de su mes (incluyendo clientes que volvieron sin descuento), cobra en Caja el código{' '}
                <code className="rounded bg-terra-pale px-1.5 py-0.5 font-mono font-bold text-terra-dark">
                  {demoInfo.samplePendingCode}
                </code>{' '}
                y descarga su informe de 1 página.
              </p>
            </div>

            <form action={enterDemoAsMerchant} className="mt-6">
              <button type="submit" className="btn-terra w-full">
                Entrar como Rosa (Tendero)
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </form>
          </div>

          {/* Actor 3: Data Room / Jurado */}
          <div className="surface-card flex flex-col justify-between p-6">
            <div className="space-y-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-paper-deep text-ink">
                <LineChart size={22} aria-hidden="true" />
              </span>
              <span className="block text-[12px] font-bold uppercase tracking-wider text-ink-muted">
                Lado 3 · Inversión y Aliados
              </span>
              <h2 className="font-display text-[23px] font-bold leading-snug text-ink">
                Data Room e Hipótesis
              </h2>
              <p className="text-[14px] leading-relaxed text-ink-muted">
                Inspecciona en vivo los umbrales de falsación (retención ≥ 40 %, renovación ≥ 50 %, primera cifra &lt; 5 min), la comisión del 5 % y el libro de reparto del 30 % con Cooperativa Coopfuturo.
              </p>
            </div>

            <form action={enterDemoAsDataRoom} className="mt-6">
              <button type="submit" className="btn-ink w-full">
                Abrir Data Room en vivo
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>

        {/* Guía rápida de 90 segundos para demostración en vivo */}
        <section className="rounded-3xl border border-line bg-white p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-[20px] font-bold text-ink">
              Guion sugerido de 90 segundos para probar el ciclo completo en vivo
            </h2>
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary-dark">
              <ShieldCheck size={15} aria-hidden="true" />
              100 % aislado de cuentas reales
            </span>
          </div>

          <ol className="mt-4 grid gap-4 text-[14px] text-ink-soft sm:grid-cols-3">
            <li className="rounded-2xl bg-paper p-4">
              <strong className="block font-semibold text-ink">1. Entra como Mariana</strong>
              Mira su disponible real hasta el 15/30, abre <em>Ofertas</em> y toca <strong>«Generar código y QR»</strong> en <em>Panadería La Espiga</em>. Copia las 6 letras.
            </li>
            <li className="rounded-2xl bg-paper p-4">
              <strong className="block font-semibold text-ink">
                2. Cambia a Rosa y abre Caja <QrCode size={13} className="inline text-terra" />
              </strong>
              Pega las 6 letras (o usa el código listo <code>{demoInfo.samplePendingCode}</code>), digita <strong>$20.000</strong> y verifica el reparto exacto: cliente paga $18.000, comisión $900, Rosa conserva $17.100.
            </li>
            <li className="rounded-2xl bg-paper p-4">
              <strong className="block font-semibold text-ink">3. Verifica el impacto bilateral</strong>
              Vuelve a Mariana para ver los <strong>+$2.000 sumados al instante</strong> a sus pesos ahorrados, y abre el <em>Data Room</em> para ver la comisión contabilizada.
            </li>
          </ol>
        </section>
      </div>
    </div>
  );
}
