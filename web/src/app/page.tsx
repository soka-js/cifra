import { ArrowRight, CircleHelp, Receipt, Store } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/logo';
import { TryCifra } from '@/components/probar/try-cifra';
import { getCurrentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Página pública. Su primera pantalla es la primera pregunta: quien llega (por ejemplo desde el
 * QR del stand) calcula su cifra sin crear cuenta. La cuenta se pide solo para guardarla.
 * Con sesión, la raíz abre el producto.
 */
export default async function HomePage() {
  if (await getCurrentUser()) redirect('/app');

  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex max-w-xl items-center justify-between px-4 py-4">
        <Logo />
        <Link href="/entrar" className="text-[15px] font-semibold text-primary-dark">
          Entrar
        </Link>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-16">
        <div className="pb-5 pt-1">
          <h1 className="text-balance font-display text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink sm:text-[38px]">
            ¿Cuánto puedes gastar hasta tu próximo pago?
          </h1>
          <p className="mt-2.5 text-[16px] leading-relaxed text-ink-muted">
            Cuatro preguntas y te lo decimos en un número. Sin crear cuenta.
          </p>
        </div>

        <TryCifra />

        <section className="mt-12 space-y-5" aria-labelledby="que-hace">
          <h2 id="que-hace" className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">
            Tu banco te dice cuánto tienes. CIFRA te dice cuánto puedes gastar.
          </h2>
          <ul className="space-y-4 text-[15px] leading-relaxed text-ink-muted">
            <li className="flex gap-3">
              <Receipt size={20} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
              <span>
                <strong className="font-semibold text-ink">Un número, con la resta a la vista.</strong> Lo que tienes, menos
                lo que ya está comprometido antes de tu pago, menos tu día a día.
              </span>
            </li>
            <li className="flex gap-3">
              <CircleHelp size={20} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
              <span>
                <strong className="font-semibold text-ink">«¿Puedo gastar?» antes de pagar.</strong> Escribes el gasto y te
                decimos si te alcanza y cuánto te quedaría.
              </span>
            </li>
          </ul>
        </section>

        <section className="mt-10 rounded-2xl border border-terra/25 bg-terra-pale/60 p-5" aria-labelledby="negocios">
          <h2 id="negocios" className="flex items-center gap-2 font-display text-[19px] font-bold text-ink">
            <Store size={19} className="text-terra-dark" aria-hidden="true" /> ¿Tienes un negocio de barrio?
          </h2>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-muted">
            Publica una oferta, valida el código del cliente en tu caja y paga el 5 % solo de la venta que CIFRA te trae.
          </p>
          <Link href="/negocio/unirse" className="mt-3 inline-flex items-center gap-1.5 text-[15px] font-semibold text-terra-dark">
            Registrar mi negocio <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 text-[13.5px] text-ink-muted">
          <Link href="/privacidad" className="hover:text-ink">
            Tratamiento de datos
          </Link>
          <Link href="/terminos" className="hover:text-ink">
            Términos
          </Link>
          <Link href="/entrar" className="hover:text-ink">
            Ya tengo cuenta
          </Link>
        </div>
      </footer>
    </div>
  );
}
