import { cookies, headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Faq } from '@/components/landing/faq';
import { LeadForm } from '@/components/landing/lead-form';
import { Receipt } from '@/components/landing/receipt';
import { Testimonios } from '@/components/landing/testimonios';
import { TrackedLink } from '@/components/landing/tracked-link';
import { getCurrentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const HEADLINES = {
  A: 'Sabe cuánto puedes gastar antes de gastarlo.',
  B: '¿Te alcanza hasta el próximo pago? CIFRA te lo dice en un número.',
} as const;

const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export default async function Landing() {
  const h = await headers();
  const jar = await cookies();
  const raw = h.get('x-cf-ab') ?? jar.get('cf_ab')?.value;
  const variant = raw === 'B' ? 'B' : 'A';
  const user = await getCurrentUser();

  return (
    <div className="overflow-x-clip">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <nav aria-label="Principal" className="flex items-center gap-1 text-[15px] sm:gap-2">
          <a href="#como-funciona" className="hidden rounded-lg px-3 py-2 text-ink-muted hover:text-ink md:inline">
            Cómo funciona
          </a>
          <a href="#tus-datos" className="hidden rounded-lg px-3 py-2 text-ink-muted hover:text-ink md:inline">
            Tus datos
          </a>
          <a href="#cooperativas" className="hidden rounded-lg px-3 py-2 text-ink-muted hover:text-ink sm:inline">
            Para cooperativas
          </a>
          {user ? (
            <TrackedLink href="/app" location="header" className="btn-primary ml-1 sm:ml-2">
              Ir a mi cifra
            </TrackedLink>
          ) : (
            <>
              <Link href="/entrar" className="rounded-lg px-3 py-2 font-semibold text-primary-dark hover:bg-primary-light">
                Entrar
              </Link>
              {/* CTA principal arriba a la derecha; texto corto donde no cabe el largo, pero siempre visible. */}
              <TrackedLink href="/registro" location="header" className="btn-primary ml-1 px-4 sm:ml-2 lg:px-5">
                <span className="lg:hidden">Empieza gratis</span>
                <span className="hidden lg:inline">Calcula tu cifra gratis</span>
              </TrackedLink>
            </>
          )}
        </nav>
      </header>

      <main>
        {/* Encabezado: qué ofrece, a quién y qué hacer. */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-8 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pb-28 md:pt-14">
          <div>
            <h1 className="text-balance font-display text-[42px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[56px] lg:text-[64px]">
              {HEADLINES[variant]}
            </h1>
            <p className="mt-6 max-w-[34rem] text-pretty text-[18px] leading-relaxed text-ink-muted">
              CIFRA lee los movimientos de tu cuenta, resta lo que ya está comprometido y lo que gastas normalmente, y te deja
              una sola cifra: lo que de verdad tienes libre hasta que te vuelvan a pagar.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <TrackedLink href="/registro" location="hero" className="btn-primary min-h-14 px-7 text-[16px]">
                Calcula tu cifra gratis
              </TrackedLink>
              <a href="#como-funciona" className="btn-ghost min-h-14 px-6 text-[16px]">
                Ver cómo funciona
              </a>
            </div>
            <p className="mt-4 text-[14px] text-ink-faint">Gratis para ti. No te pedimos la clave de tu banco.</p>
          </div>
          <Receipt />
        </section>

        {/* Lo que está en juego si no hace nada. */}
        <section className="border-y border-line bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-24">
            <h2 className="max-w-3xl font-display text-[34px] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[44px]">
              El saldo dice cuánto hay. No cuánto puedes gastar.
            </h2>
            <p className="mt-5 max-w-prose text-[17px] leading-relaxed text-ink-muted">
              En el saldo de tu app todavía está el arriendo que sale el primero, la cuota del celular y el mercado de la semana.
              Gastas mirando ese número y, a mitad de mes, la plata ya no alcanza. Te toca pedir prestado, pagar intereses o
              llegar al día de pago contando monedas.
            </p>
            <dl className="mt-12 grid gap-10 md:grid-cols-3">
              <div>
                <dt className="tnum font-display text-[56px] font-extrabold leading-none tracking-[-0.04em] text-neg">41 de 48</dt>
                <dd className="mt-3 text-[15.5px] leading-relaxed text-ink-muted">
                  personas que entrevistamos se quedaron sin plata antes de lo que esperaban.
                  <span className="mt-1 block text-[13px] text-ink-faint">Entrevistas y formulario del equipo CIFRA, Bogotá, 2026.</span>
                </dd>
              </div>
              <div>
                <dt className="tnum font-display text-[56px] font-extrabold leading-none tracking-[-0.04em]">23 %</dt>
                <dd className="mt-3 text-[15.5px] leading-relaxed text-ink-muted">
                  de los colombianos sabía con exactitud cuánto gastó la semana anterior, aunque el 94 % dice que planifica su
                  presupuesto.
                  <span className="mt-1 block text-[13px] text-ink-faint">Encuesta de Capacidades Financieras, Banco Mundial y Gobierno de Colombia.</span>
                </dd>
              </div>
              <div>
                <dt className="tnum font-display text-[56px] font-extrabold leading-none tracking-[-0.04em]">19 de 20</dt>
                <dd className="mt-3 text-[15.5px] leading-relaxed text-ink-muted">
                  personas que dieron una cifra en nuestra prueba creían tener más plata de la que podían gastar.
                  <span className="mt-1 block text-[13px] text-ink-faint">Prueba del prototipo con 21 personas, octubre de 2026.</span>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* El plan: tres pasos. */}
        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6 md:py-28">
          <h2 className="font-display text-[34px] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[44px]">Así funciona</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {[
              { t: 'Crea tu cuenta', d: 'Con tu correo y una contraseña. Toma un minuto y dices cada cuánto te pagan.' },
              {
                t: 'Sube el extracto de tu banco',
                d: 'El CSV, Excel o PDF que descargas de la sucursal virtual o la app. Se lee en tu teléfono o computador: el archivo no se sube y nunca te pedimos la clave del banco.',
              },
              {
                t: 'Mira tu cifra y pregunta antes de pagar',
                d: 'Ves cuánto tienes libre hasta tu próximo pago y le preguntas a CIFRA si un gasto cabe. La respuesta llega en pesos.',
              },
            ].map((s, i) => (
              <li key={s.t} className="relative border-t-2 border-ink pt-5">
                <span className="tnum font-display text-[15px] font-bold text-primary">Paso {i + 1}</span>
                <h3 className="mt-2 font-display text-[23px] font-bold tracking-[-0.015em]">{s.t}</h3>
                <p className="mt-2.5 text-[15.5px] leading-relaxed text-ink-muted">{s.d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12">
            <TrackedLink href="/registro" location="plan" className="btn-primary min-h-14 px-7 text-[16px]">
              Calcula tu cifra gratis
            </TrackedLink>
          </div>
        </section>

        {/* Qué cambia: el producto, mostrado tal cual. */}
        <section className="bg-primary-dark text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 md:grid-cols-[1fr_1fr] md:py-28">
            <div>
              <h2 className="font-display text-[34px] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[44px]">
                Llegas al día de pago sabiendo cuánto te queda.
              </h2>
              <p className="mt-5 max-w-prose text-[17px] leading-relaxed text-white/80">
                Sin anotar gastos y sin gráficas. Abres CIFRA, ves tu cifra y decides. Si un gasto no cabe, lo sabes antes de
                hacerlo, no cuando ya pasó.
              </p>
              <ul className="mt-10 space-y-6">
                {[
                  {
                    t: 'La cifra, con la resta a la vista',
                    d: 'Saldo, menos los cobros fijos que faltan, menos tu gasto normal hasta el próximo pago. Ves cada parte y de dónde sale.',
                  },
                  {
                    t: '¿Puedo hacer este gasto?',
                    d: 'Escribes el monto y CIFRA te dice si cabe, cuánto te quedaría y cuánto tendrías por día.',
                  },
                  {
                    t: 'Cobros que se repiten',
                    d: 'Netflix, el gimnasio, el plan del celular, la app que ya no usas. CIFRA los encuentra en tus movimientos y suma lo que pagas al mes.',
                  },
                  {
                    t: 'Tus datos, a la vista',
                    d: 'Qué entidad, qué cuenta, qué datos y desde cuándo. Borras una fuente o toda tu cuenta con un botón.',
                  },
                ].map((f) => (
                  <li key={f.t} className="border-l-2 border-primary-soft pl-5">
                    <h3 className="font-display text-[20px] font-bold">{f.t}</h3>
                    <p className="mt-1.5 text-[15.5px] leading-relaxed text-white/75">{f.d}</p>
                  </li>
                ))}
              </ul>
            </div>
            <figure className="relative mx-auto h-[520px] w-full max-w-[460px] sm:h-[600px]">
              <Image
                src="/producto-cobros.webp"
                alt="Pantalla de cobros que se repiten en CIFRA"
                width={390}
                height={780}
                className="absolute right-0 top-10 w-[58%] rounded-[28px] border-[6px] border-white/10 shadow-2xl"
              />
              <Image
                src="/producto-hoy.webp"
                alt="Pantalla principal de CIFRA con la cifra y su resta"
                width={390}
                height={780}
                className="absolute left-0 top-0 w-[62%] rounded-[28px] border-[6px] border-white/15 shadow-2xl"
              />
              <figcaption className="absolute -bottom-2 left-0 text-[13px] text-white/60">La app real, con un extracto de prueba.</figcaption>
            </figure>
          </div>
        </section>

        <Testimonios />

        {/* Confianza. */}
        <section id="tus-datos" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6 md:py-28">
          <div className="grid gap-12 md:grid-cols-[1fr_1.15fr]">
            <div>
              <h2 className="font-display text-[34px] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[44px]">
                Tu banco no se toca.
              </h2>
              <p className="mt-5 max-w-prose text-[17px] leading-relaxed text-ink-muted">
                CIFRA no mueve tu plata ni entra a tu banco. Solo hace cuentas con los movimientos que tú decides compartir.
              </p>
            </div>
            <ul className="divide-y divide-line border-y border-line">
              {[
                ['No te pedimos la clave de tu banco.', 'Nunca. Si alguien te la pide a nombre de CIFRA, no es CIFRA.'],
                [
                  'El extracto se lee en tu dispositivo.',
                  'El archivo no sale de tu teléfono o computador. Guardamos solo fecha, descripción y valor de cada movimiento.',
                ],
                ['No vendemos tus datos.', 'No los usamos para publicidad ni se los pasamos a terceros.'],
                ['Borras todo cuando quieras.', 'Desde Ajustes, tu cuenta y todos tus movimientos se eliminan de inmediato.'],
                [
                  'Otras entidades, desde su propia app.',
                  'Cuando tu banco active el intercambio de datos de finanzas abiertas, la autorización la das dentro de la app de tu banco, no aquí. En CIFRA solo ves qué entidad comparte qué datos.',
                ],
              ].map(([t, d]) => (
                <li key={t} className="py-5">
                  <p className="text-[17px] font-semibold">{t}</p>
                  <p className="mt-1 text-[15.5px] leading-relaxed text-ink-muted">{d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Objeciones. */}
        <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 md:py-28">
          <h2 className="font-display text-[34px] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[44px]">Preguntas frecuentes</h2>
          <div className="mt-10">
            <Faq
              items={[
                { q: '¿Cuánto cuesta?', a: 'Nada. CIFRA es gratis para las personas. Lo pagan las entidades que lo ofrecen dentro de su app.' },
                {
                  q: '¿Con qué bancos funciona?',
                  a: 'Con cualquier banco o billetera que te deje descargar tus movimientos en CSV, Excel o PDF digital desde su sucursal virtual o su app. Antes de guardar ves los movimientos leídos para confirmar que quedaron bien.',
                },
                {
                  q: '¿Por qué no se conecta directo a mi banco?',
                  a: 'Porque para conectarse directo hoy habría que pedirte la clave del banco, y eso no lo vamos a hacer. En Colombia el intercambio de datos por finanzas abiertas es obligatorio desde el Decreto 368 de 2026, pero los estándares para compartir movimientos de cuentas de ahorro todavía no están listos. Cuando lo estén, la conexión se autorizará desde la app de tu banco.',
                },
                {
                  q: '¿Qué tan exacta es la cifra?',
                  a: 'Tan exacta como tus datos. Usa tu saldo, los cobros fijos que encuentra en tus movimientos y tu gasto promedio de las últimas ocho semanas. Te muestra cada parte de la resta y te avisa si tu saldo está viejo.',
                },
                { q: '¿CIFRA es un banco?', a: 'No. CIFRA no guarda ni mueve tu plata. Solo hace cuentas con tus movimientos.' },
                {
                  q: '¿Qué pasa con mis datos si borro la cuenta?',
                  a: 'Se eliminan: tu usuario, tus cuentas, tus movimientos y tus ajustes. No guardamos copias para nada más.',
                },
              ]}
            />
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-4">
            <TrackedLink href="/registro" location="faq" className="btn-primary min-h-14 px-7 text-[16px]">
              Calcula tu cifra gratis
            </TrackedLink>
            <span className="text-[14px] text-ink-faint">Toma unos cinco minutos con tu extracto a la mano.</span>
          </div>
        </section>

        {/* Para entidades. */}
        <section id="cooperativas" className="scroll-mt-8 bg-ink text-white">
          <div className="mx-auto grid max-w-6xl gap-14 px-4 py-20 sm:px-6 md:grid-cols-[1fr_1.1fr] md:py-28">
            <div>
              <p className="text-[15px] font-semibold text-primary-soft">Para cooperativas y entidades financieras</p>
              <h2 className="mt-3 font-display text-[34px] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[44px]">
                Dale a tus asociados la cifra dentro de tu app.
              </h2>
              <ul className="mt-8 space-y-5 text-[16px] leading-relaxed text-white/80">
                <li>
                  <strong className="text-white">Empiezas con los datos que ya tienes.</strong> Tus asociados ya confían en ti y
                  sus movimientos ya están contigo. No hace falta esperar a finanzas abiertas.
                </li>
                <li>
                  <strong className="text-white">Se integra con una API.</strong> Envías cuentas y movimientos, y CIFRA se abre
                  dentro de tu app con un enlace seguro de un solo uso.
                </li>
                <li>
                  <strong className="text-white">Pagas por usuario activo.</strong> Una licencia mensual por asociado que usa
                  CIFRA. El asociado no paga nada.
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-display text-[22px] font-bold">Pide una demo</h3>
              <p className="mt-1.5 text-white/70">Te mostramos CIFRA con datos de prueba y la API.</p>
              <div className="mt-6">
                <LeadForm />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 text-[14.5px] sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm leading-relaxed text-ink-muted">
              Cuánto puedes gastar hasta tu próximo pago, en un solo número. CIFRA no es una entidad financiera y no mueve tu
              dinero.
            </p>
          </div>
          <nav aria-label="Producto" className="flex flex-col gap-2.5">
            <span className="font-semibold">Producto</span>
            <Link href="/registro" className="text-ink-muted hover:text-ink">Crear cuenta</Link>
            <Link href="/entrar" className="text-ink-muted hover:text-ink">Entrar</Link>
            <a href="#cooperativas" className="text-ink-muted hover:text-ink">Para cooperativas</a>
            <Link href="/desarrolladores" className="text-ink-muted hover:text-ink">API para entidades</Link>
          </nav>
          <nav aria-label="Legal y contacto" className="flex flex-col gap-2.5">
            <span className="font-semibold">Legal y contacto</span>
            <Link href="/privacidad" className="text-ink-muted hover:text-ink">Tratamiento de datos</Link>
            <Link href="/terminos" className="text-ink-muted hover:text-ink">Términos de uso</Link>
            {contact && (
              <a href={`mailto:${contact}`} className="text-ink-muted hover:text-ink">
                {contact}
              </a>
            )}
          </nav>
          <p className="text-[13px] text-ink-faint md:col-span-3">
            Proyecto del curso Diseño de Productos e Innovación en TI, Universidad de los Andes, 2026.
          </p>
        </div>
      </footer>
    </div>
  );
}
