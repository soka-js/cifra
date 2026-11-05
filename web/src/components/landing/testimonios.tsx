import { TrackedLink } from '@/components/landing/tracked-link';

/**
 * Prueba social de la prueba de octubre: tres citas textuales y los resultados de las dos metas.
 * Las personas probaron el prototipo con sus propias cifras; no son clientes y se dice así.
 */
const CITAS = [
  {
    cita: 'Yo pensaba que esos trescientos cincuenta eran los que podía gastar.',
    quien: 'Mujer, 21 años, estudiante',
    pie: 'Creía tener $350.000. Su cifra real era $210.000.',
  },
  {
    cita: 'Antes de haber hecho el gasto que me perjudicó, pude haber usado el botón de ¿puedo hacer un gasto?',
    quien: 'Hombre, 21 años, estudiante',
    pie: 'Después de ver la simulación de un gasto.',
  },
  {
    cita: 'Lo más valioso me parece que es el feature de ver las mensualidades.',
    quien: 'Hombre, 20 años, estudiante',
    pie: 'Sobre la pantalla de cobros que se repiten.',
  },
] as const;

export function Testimonios() {
  return (
    <section id="la-prueba" className="scroll-mt-8 border-y border-line bg-paper-deep">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <h2 className="max-w-3xl font-display text-[34px] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[44px]">
          Se lo pusimos al frente a 21 personas.
        </h2>
        <p className="mt-5 max-w-prose text-[17px] leading-relaxed text-ink-muted">
          Cargamos sus cifras reales sin que vieran la pantalla y les mostramos su número sin explicarlo. Esto es lo que pasó.
        </p>

        {/* Resultados de las dos metas, fijadas antes de empezar. */}
        <dl className="mt-12 grid gap-8 sm:grid-cols-3">
          {[
            ['76 %', 'entendió qué significaba la cifra sin que se la explicáramos.'],
            ['67 %', 'dijo en el momento una decisión concreta sobre un gasto suyo.'],
            ['19 de 20', 'creían tener más plata de la que podían gastar. Ninguna creía tener menos.'],
          ].map(([n, d]) => (
            <div key={n} className="border-t-2 border-ink pt-5">
              <dt className="tnum font-display text-[44px] font-extrabold leading-none tracking-[-0.04em]">{n}</dt>
              <dd className="mt-3 text-[15.5px] leading-relaxed text-ink-muted">{d}</dd>
            </div>
          ))}
        </dl>

        {/* Citas textuales. */}
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
          Sesiones guiadas con el prototipo, Bogotá, octubre de 2026. Citas textuales de la grabación, publicadas con permiso.
          Las personas probaron el producto; todavía no son usuarias.
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
