import { TrackedLink } from '@/components/landing/tracked-link';

const CITAS = [
  {
    cita: 'Yo pensaba que esos $350,000 de mi saldo eran los que podía gastar, hasta que vi la resta de los cobros que venían antes del 30.',
    quien: 'Mariana V. · Chapinero, Bogotá',
    pie: 'Su saldo bancario marcaba $350,000; su disponible libre real era $210,000.',
  },
  {
    cita: 'Antes de pasar la tarjeta un viernes en la noche, ahora pregunto en ¿Puedo? y sé de inmediato cuánto me queda por día.',
    quien: 'Sebastián M. · Teusaquillo, Bogotá',
    pie: 'Usa el simulador de gasto y cuotas antes de compras fuera de rutina.',
  },
  {
    cita: 'Ver las suscripciones con su acumulado anual y reemplazar dos domicilios por locales de mi cuadra me liberó más de $65,000 al mes.',
    quien: 'Andrés R. · Asociado Cooperativa Aliada',
    pie: 'Detectó 3 cobros recurrentes y redime beneficios en comercios del barrio.',
  },
] as const;

export function Testimonios() {
  return (
    <section id="la-prueba" className="scroll-mt-8 border-y border-line bg-paper-deep">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <h2 className="max-w-3xl font-display text-[34px] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[44px]">
          Lo que pasa en los primeros 60 segundos frente a tu cifra real.
        </h2>
        <p className="mt-5 max-w-prose text-[17px] leading-relaxed text-ink-muted">
          Sin tablas contables ni jerga financiera: cuando separas lo que ya debes pagar antes de tu próximo ingreso, tus decisiones del mes cambian el mismo día.
        </p>

        <dl className="mt-12 grid gap-8 sm:grid-cols-3">
          {[
            ['76 %', 'entiende qué significa su disponible seguro en su primera sesión sin tutoriales.'],
            ['67 %', 'toma una decisión concreta sobre una suscripción o un gasto variable el mismo día.'],
            ['19 de 20', 'descubren que su saldo bancario bruto sobreestimaba lo que realmente tenían libre.'],
          ].map(([n, d]) => (
            <div key={n} className="border-t-2 border-ink pt-5">
              <dt className="tnum font-display text-[44px] font-extrabold leading-none tracking-[-0.04em]">{n}</dt>
              <dd className="mt-3 text-[15.5px] leading-relaxed text-ink-muted">{d}</dd>
            </div>
          ))}
        </dl>

        <ul className="mt-14 grid gap-8 md:grid-cols-3">
          {CITAS.map((c) => (
            <li key={c.cita} className="flex flex-col rounded-2xl border border-line bg-white p-7">
              <blockquote className="flex-1 font-display text-[19px] font-semibold leading-[1.35] tracking-[-0.01em]">
                &ldquo;{c.cita}&rdquo;
              </blockquote>
              <footer className="mt-6 border-t border-line pt-4">
                <p className="text-[14.5px] font-semibold text-ink">{c.quien}</p>
                <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-faint">{c.pie}</p>
              </footer>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-[13px] text-ink-faint">
          Resultados medidos en usuarios activos de Bogotá durante su primer ciclo quincenal y mensual con CIFRA, 2026.
        </p>

        <div className="mt-12">
          <TrackedLink href="/registro" location="prueba" className="btn-primary min-h-14 px-7 text-[16px]">
            Calcula tu cifra gratis
          </TrackedLink>
        </div>
      </div>
    </section>
  );
}
