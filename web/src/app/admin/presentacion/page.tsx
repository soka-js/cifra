import { ArrowLeft, ArrowRight, CheckCircle2, QrCode, ShieldCheck, Store } from 'lucide-react';
import { cookies, headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { Faq } from '@/components/landing/faq';
import { LeadForm } from '@/components/landing/lead-form';
import { MerchantCalculator } from '@/components/landing/merchant-calculator';
import { Receipt } from '@/components/landing/receipt';
import { Testimonios } from '@/components/landing/testimonios';
import { TrackedLink } from '@/components/landing/tracked-link';
import { Logo } from '@/components/logo';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Presentación Comercial · CIFRA', robots: { index: false } };

const HEADLINES = {
  A: 'Sabe cuánto puedes gastar antes de gastarlo.',
  B: '¿Te alcanza hasta el próximo pago? CIFRA te lo dice en un número.',
} as const;

const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export default async function PresentacionComercialPage() {
  const h = await headers();
  const jar = await cookies();
  const raw = h.get('x-cf-ab') ?? jar.get('cf_ab')?.value;
  const variant = raw === 'B' ? 'B' : 'A';

  return (
    <div className="overflow-x-clip">
      <div className="border-b border-primary/20 bg-primary-pale/80 px-4 py-2 text-[12.5px] text-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <Link href="/admin" className="inline-flex items-center gap-1.5 font-bold text-primary-dark hover:underline">
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Volver a Consola Privada (/admin)</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/app" className="font-semibold text-ink hover:text-primary-dark hover:underline">
              Ir al Producto Persona (/app) →
            </Link>
            <Link href="/negocio" className="font-semibold text-terra-dark hover:underline">
              Ir al Portal Comercio (/negocio) →
            </Link>
          </div>
        </div>
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <nav aria-label="Principal" className="flex items-center gap-1 text-[14.5px] sm:gap-3">
          <a
            href="#como-funciona"
            className="hidden sm:inline-block rounded-lg px-3 py-2 font-medium text-ink-muted transition hover:text-ink"
          >
            Para personas
          </a>
          <a
            href="#negocios"
            className="hidden sm:inline-block rounded-lg px-3 py-2 font-medium text-ink-muted transition hover:text-ink"
          >
            Para comercios
          </a>
          <a
            href="#tus-datos"
            className="hidden md:inline-block rounded-lg px-3 py-2 font-medium text-ink-muted transition hover:text-ink"
          >
            Seguridad
          </a>
          <Link
            href="/entrar"
            className="rounded-lg px-3 py-2 font-semibold text-ink-muted transition hover:bg-paper hover:text-ink"
          >
            Entrar
          </Link>
          <TrackedLink href="/app" location="header" className="btn-primary ml-1 px-4 sm:ml-2 lg:px-5">
            Abrir producto
          </TrackedLink>
        </nav>
      </header>

      <main>
        {/* Hero editorial: propuesta de valor + tiquete interactivo */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-6 sm:px-6 md:grid-cols-[1.12fr_0.95fr] md:pb-28 md:pt-10">
          <div>
            <p className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-primary-dark">
              Claridad financiera diaria · Barrio conectado en Bogotá
            </p>
            <h1 className="mt-3 text-balance font-display text-[42px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[56px] lg:text-[62px]">
              {HEADLINES[variant]}
            </h1>
            <p className="mt-5 max-w-[35rem] text-pretty text-[17.5px] leading-relaxed text-ink-muted">
              CIFRA lee tus movimientos sin pedirte la clave del banco, separa lo que ya está comprometido y te deja un solo número honesto: lo que tienes libre hasta tu próximo ingreso. Y además te conecta con beneficios reales en comercios independientes de tu cuadra.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <TrackedLink href="/app" location="hero" className="btn-primary min-h-13 px-7 text-[16px]">
                Abrir aplicación CIFRA
                <ArrowRight size={17} aria-hidden="true" />
              </TrackedLink>
              <Link
                href="/negocio"
                className="btn-ghost min-h-13 border border-line bg-white px-6 text-[15.5px] shadow-sm hover:bg-paper"
              >
                Abrir portal de comercios
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13.5px] text-ink-faint">
              <span>100 % gratis para las personas</span>
              <span>·</span>
              <span>Sin claves bancarias</span>
              <span>·</span>
              <a href="#negocios" className="font-semibold text-terra-dark hover:underline">
                ¿Tienes tienda o café? Paga 5 % solo al vender →
              </a>
            </div>
          </div>
          <Receipt />
        </section>

        {/* Evidencia empírica del problema */}
        <section className="border-y border-line bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-24">
            <h2 className="max-w-3xl font-display text-[34px] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[44px]">
              El saldo del banco dice cuánto hay. No cuánto puedes gastar.
            </h2>
            <p className="mt-5 max-w-prose text-[17px] leading-relaxed text-ink-muted">
              En el saldo de tu aplicación todavía están mezclados el arriendo, los servicios, las suscripciones automáticas y el mercado del resto de la quincena. Gastar mirando el saldo bruto hace que la plata se acabe días antes del pago.
            </p>
            <dl className="mt-12 grid gap-10 md:grid-cols-3">
              <div>
                <dt className="tnum font-display text-[56px] font-extrabold leading-none tracking-[-0.04em] text-neg">
                  41 de 48
                </dt>
                <dd className="mt-3 text-[15.5px] leading-relaxed text-ink-muted">
                  personas entrevistadas se quedaron sin liquidez antes de lo que esperaban en su ciclo.
                  <span className="mt-1 block text-[13px] text-ink-faint">
                    Investigación de campo equipo CIFRA, Bogotá, 2026.
                  </span>
                </dd>
              </div>
              <div>
                <dt className="tnum font-display text-[56px] font-extrabold leading-none tracking-[-0.04em]">
                  23 %
                </dt>
                <dd className="mt-3 text-[15.5px] leading-relaxed text-ink-muted">
                  de los adultos en Colombia sabe con exactitud cuánto gastó la semana anterior, pese a que el 94 % afirma planificar.
                  <span className="mt-1 block text-[13px] text-ink-faint">
                    Encuesta de Capacidades Financieras, Banco Mundial.
                  </span>
                </dd>
              </div>
              <div>
                <dt className="tnum font-display text-[56px] font-extrabold leading-none tracking-[-0.04em]">
                  19 de 20
                </dt>
                <dd className="mt-3 text-[15.5px] leading-relaxed text-ink-muted">
                  participantes al abrir su primera resta descubrieron que sobreestimaban cuánto dinero tenían libre para la quincena.
                  <span className="mt-1 block text-[13px] text-ink-faint">
                    Medición de activación en primer ciclo, Bogotá, 2026.
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Cómo funciona para la persona en < 5 minutos */}
        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6 md:py-28">
          <div className="max-w-2xl">
            <p className="text-[13px] font-bold uppercase tracking-wider text-primary-dark">
              Para personas · Menos de 5 minutos hasta tu primera cifra
            </p>
            <h2 className="mt-2 font-display text-[34px] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[44px]">
              Tres pasos sin hojas de cálculo ni anotar cada tinto
            </h2>
          </div>

          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {[
              {
                t: 'Dinos cuándo entra tu plata',
                d: 'Eliges si tu ingreso es quincenal, mensual o irregular. Antes de pedirte un solo dato ves exactamente cómo protegemos tu privacidad bajo Ley 1581 y el marco de Finanzas Abiertas.',
              },
              {
                t: 'Carga tu extracto o arranca en modo rápido',
                d: 'Tu CSV, Excel o PDF de Bancolombia, Nequi, Davivienda, Nu o BBVA se procesa directo en tu dispositivo. Clasificamos más de 100 comercios colombianos al instante y corriges cualquiera en 1 toque.',
              },
              {
                t: 'Cumple tus metas con tu Mejor Siguiente Acción',
                d: 'Pregunta «¿puedo gastar $150,000 el viernes?», visualiza el tablero gráfico de tu ciclo, recibe misiones semanales en pesos para tu meta y redime descuentos reales en comercios vecinos.',
              },
            ].map((s, i) => (
              <li key={s.t} className="relative border-t-2 border-ink pt-5">
                <span className="tnum font-display text-[15px] font-bold text-primary">Paso {i + 1}</span>
                <h3 className="mt-2 font-display text-[23px] font-bold tracking-[-0.015em]">{s.t}</h3>
                <p className="mt-2.5 text-[15.5px] leading-relaxed text-ink-muted">{s.d}</p>
              </li>
            ))}
          </ol>

          <div className="mt-12 flex flex-wrap gap-3">
            <TrackedLink href="/app" location="plan" className="btn-primary min-h-14 px-7 text-[16px]">
              Abrir mi cifra ahora
            </TrackedLink>
            <Link href="/registro" className="btn-ghost min-h-14 px-6 text-[16px]">
              Crear nueva cuenta
            </Link>
          </div>
        </section>

        {/* El producto en vivo */}
        <section className="bg-primary-dark text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 md:grid-cols-[1fr_1fr] md:py-28">
            <div>
              <h2 className="font-display text-[34px] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[44px]">
                Llegas al día de pago con margen y pesos ahorrados de verdad.
              </h2>
              <p className="mt-5 max-w-prose text-[17px] leading-relaxed text-white/80">
                Cero sermones y cero sustos mostrando deudas totales de golpe. CIFRA trabaja sobre el ciclo actual en el que sí puedes actuar hoy.
              </p>
              <ul className="mt-10 space-y-6">
                {[
                  {
                    t: 'La cifra con la resta abierta y tablero gráfico interactivo',
                    d: 'Saldo disponible, menos cobros fijos pendientes del ciclo, menos tu ritmo real diario y tu colchón de tranquilidad, con desglose visual por categoría y tendencia de 14 días.',
                  },
                  {
                    t: 'Metas de ahorro + Mejor Siguiente Acción (Next Best Action)',
                    d: 'Crea tu meta con fecha objetivo y recibe recomendaciones accionables en tu cuadra para redirigir fugas hormiga directamente a tu bolsillo.',
                  },
                  {
                    t: '¿Puedo hacer este gasto? y simulador de cuotas',
                    d: 'Pregunta en segundos antes de pasar la tarjeta. Ves cómo cambia tu disponible por día y cuánto pagarías en intereses reales a 3, 6 o 12 cuotas.',
                  },
                  {
                    t: 'Cobros vampiro y contador verificable de pesos ahorrados',
                    d: 'Detecta suscripciones olvidadas con guías paso a paso para cancelarlas en Colombia y suma cada ahorro real a tu contador mensual.',
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
                alt="Pantalla de cobros recurrentes en CIFRA"
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
              <figcaption className="absolute -bottom-2 left-0 text-[13px] text-white/60">
                La aplicación real sobre extractos colombianos.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* LADO 2 DEL MERCADO: MICRONEGOCIOS DE BARRIO */}
        <section id="negocios" className="scroll-mt-8 border-b border-line bg-paper-warm/70">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 md:grid-cols-[1.05fr_1fr] md:py-28">
            <div>
              <span className="badge-terra">
                <Store size={13} aria-hidden="true" />
                Para panaderías, cafés, tiendas, fruvers y comercios de barrio
              </span>
              <h2 className="mt-3 font-display text-[34px] font-bold leading-[1.08] tracking-[-0.025em] text-ink sm:text-[44px]">
                Clientes nuevos de tu propia cuadra. Pagas solo después de vender.
              </h2>
              <p className="mt-4 text-[17px] leading-relaxed text-ink-muted">
                Los anuncios en redes sociales cobran por clic aunque nadie entre al local, y los volantes terminan en la esquina. En CIFRA tu oferta le aparece únicamente a vecinos cercanos que ya compran en tu categoría pero aún no conocen tu negocio.
              </p>

              <ul className="mt-7 space-y-3.5 text-[15.5px] text-ink-soft">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-terra-dark" aria-hidden="true" />
                  <span>
                    <strong className="font-semibold text-ink">Protegemos tu clientela actual:</strong> puedes activar ofertas exclusivas para <em>clientes nuevos</em> sin regalar descuento a quienes ya te compran siempre.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <QrCode size={19} className="mt-0.5 shrink-0 text-terra-dark" aria-hidden="true" />
                  <span>
                    <strong className="font-semibold text-ink">Caja lista en 10 segundos y cortes quincenales:</strong> digitas las 6 letras del cliente en tu celular y liquidas el 5 % consolidado al corte por Bre-B, Nequi o débito automático.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <ShieldCheck size={19} className="mt-0.5 shrink-0 text-terra-dark" aria-hidden="true" />
                  <span>
                    <strong className="font-semibold text-ink">Informe mensual de 1 sola página:</strong> cuántas ventas trajo CIFRA, cuántos fueron vecinos nuevos y cuántos volvieron después a precio completo sin descuento.
                  </span>
                </li>
              </ul>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/negocio/unirse" className="btn-terra min-h-14 px-7 text-[16px]">
                  Registrar mi negocio gratis
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link href="/negocio" className="btn-ghost min-h-14 px-6 text-[15.5px]">
                  Entrar al portal de mi comercio
                </Link>
              </div>
            </div>

            <MerchantCalculator />
          </div>
        </section>

        <Testimonios />

        {/* Confianza y Ley 1581 */}
        <section id="tus-datos" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6 md:py-28">
          <div className="grid gap-12 md:grid-cols-[1fr_1.15fr]">
            <div>
              <h2 className="font-display text-[34px] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[44px]">
                Tu banco no se toca. Tus extractos nunca se venden.
              </h2>
              <p className="mt-5 max-w-prose text-[17px] leading-relaxed text-ink-muted">
                CIFRA no custodia ni mueve dinero. Ganamos una comisión transparente del 5 % pagada por los comercios cuando ahorras en ellos, nunca vendiendo tu información financiera.
              </p>
            </div>
            <ul className="divide-y divide-line border-y border-line">
              {[
                [
                  'Jamás te pedimos la clave de tu banco.',
                  'Ni usuario, ni clave dinámica, ni token. Si alguien te los pide en nombre de CIFRA, no somos nosotros.',
                ],
                [
                  'Lectura local en tu teléfono o computador.',
                  'Tu extracto PDF, Excel o CSV se interpreta en tu navegador antes de guardar únicamente fecha, concepto y monto.',
                ],
                [
                  'Los comercios nunca ven tus cuentas.',
                  'Cuando redimes una oferta en tu barrio, el negocio solo valida un código temporal de 6 letras.',
                ],
                [
                  'Control total bajo Ley 1581 de 2012.',
                  'En la sección Tus datos descargas todo tu historial en JSON o CSV y eliminas fuentes o tu cuenta completa en un clic.',
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

        {/* Preguntas frecuentes */}
        <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 md:py-28">
          <h2 className="font-display text-[34px] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[44px]">
            Preguntas frecuentes
          </h2>
          <div className="mt-10">
            <Faq
              items={[
                {
                  q: '¿Por qué CIFRA es gratis para las personas si no vende mis datos?',
                  a: 'Porque nuestro modelo se financia del lado comercial: cuando descubres y usas un beneficio real en un comercio independiente de tu barrio, ese comercio nos paga una comisión del 5 % sobre la venta efectiva en caja.',
                },
                {
                  q: '¿Con qué bancos y billeteras de Colombia funciona?',
                  a: 'Con Bancolombia, Nequi, Davivienda, DaviPlata, Nu Colombia, BBVA, Banco de Bogotá, Lulo Bank, Scotiabank Colpatria y cualquier entidad que permita descargar extractos en CSV, Excel o PDF digital. También puedes empezar en 60 segundos con el modo rápido sin subir archivos.',
                },
                {
                  q: 'Tengo una tienda, panadería o cafetería: ¿tengo que pagar mensualidad o comprar equipos?',
                  a: 'Cero pesos fijos y cero equipos nuevos. Publicas tu oferta gratis, validas los códigos desde cualquier celular en mostrador y solo pagas el 5 % al cierre del mes sobre las ventas reales cobradas por Bre-B o Nequi.',
                },
                {
                  q: '¿Cómo evitan que mis clientes de siempre usen el descuento de clientes nuevos?',
                  a: 'El motor de elegibilidad de CIFRA filtra automáticamente tu oferta para personas de la zona que no registran compras recientes en tu comercio y mantiene un grupo de control para medir cuántas ventas son genuinamente nuevas.',
                },
                {
                  q: '¿Qué pasa con mis datos si decido cerrar mi cuenta?',
                  a: 'Desde «Tus datos» puedes exportar una copia completa en CSV o JSON y borrar definitivamente tu usuario, cuentas, extractos y sesiones de forma inmediata.',
                },
              ]}
            />
          </div>
        </section>

        {/* LADO 3: CANAL B2B2C PARA COOPERATIVAS, CAJAS Y BILLETERAS */}
        <section id="cooperativas" className="scroll-mt-8 bg-ink text-white">
          <div className="mx-auto grid max-w-6xl gap-14 px-4 py-20 sm:px-6 md:grid-cols-[1fr_1.1fr] md:py-28">
            <div>
              <p className="text-[14px] font-bold uppercase tracking-wider text-primary-soft">
                Canal B2B2C · Cooperativas, fondos de empleados y billeteras
              </p>
              <h2 className="mt-3 font-display text-[34px] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[44px]">
                Entrega bienestar financiero hoy y recibe el 30 % de cada comisión.
              </h2>
              <ul className="mt-8 space-y-5 text-[16px] leading-relaxed text-white/80">
                <li>
                  <strong className="text-white">Sin esperar regulación técnica de Open Finance.</strong> Integras los saldos y movimientos que ya custodias mediante nuestra API REST y abres CIFRA dentro de tu app con sesiones efímeras de 2 minutos.
                </li>
                <li>
                  <strong className="text-white">$0 de costo para tu entidad y $0 para el asociado.</strong> Fortaleces la salud financiera de tu base, reduces mora temprana y aumentas la frecuencia de uso de tu aplicación.
                </li>
                <li>
                  <strong className="text-white">Reparto automático del 30 % (revenue share).</strong> Por cada venta atribuida que tus asociados rediman en la red de comercios de barrio de CIFRA, tu entidad recibe el 30 % de la comisión recaudada.
                </li>
              </ul>

              <div className="mt-8">
                <Link
                  href="/desarrolladores"
                  className="inline-flex items-center gap-2 text-[15px] font-semibold text-primary-soft underline underline-offset-4 hover:text-white"
                >
                  Explorar documentación API y simulador de ingresos B2B2C →
                </Link>
              </div>
            </div>
            <div>
              <h3 className="font-display text-[22px] font-bold">Conversa con nuestro equipo de alianzas</h3>
              <p className="mt-1.5 text-white/70">
                Te entregamos llaves <code>cfk_</code> de prueba y recorremos el piloto en vivo.
              </p>
              <div className="mt-6">
                <LeadForm />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 text-[14.5px] sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm leading-relaxed text-ink-muted">
              Claridad sobre tu disponible diario y red de beneficios reales en comercios independientes de barrio. CIFRA no es una entidad vigilada ni capta recursos del público.
            </p>
          </div>
          <nav aria-label="Personas" className="flex flex-col gap-2.5">
            <span className="font-semibold text-ink">Personas</span>
            <Link href="/app" className="text-ink-muted hover:text-ink">
              Abrir aplicación
            </Link>
            <Link href="/entrar" className="text-ink-muted hover:text-ink">
              Cambiar cuenta
            </Link>
          </nav>
          <nav aria-label="Comercios y Entidades" className="flex flex-col gap-2.5">
            <span className="font-semibold text-ink">Comercios y Aliados</span>
            <Link href="/negocio/unirse" className="text-ink-muted hover:text-ink">
              Registrar mi negocio
            </Link>
            <Link href="/negocio" className="text-ink-muted hover:text-ink">
              Entrar a Caja / Portal tendero
            </Link>
            <Link href="/desarrolladores" className="text-ink-muted hover:text-ink">
              API B2B2C (30 % reparto)
            </Link>
          </nav>
          <nav aria-label="Legal y contacto" className="flex flex-col gap-2.5">
            <span className="font-semibold text-ink">Legal y transparencia</span>
            <Link href="/privacidad" className="text-ink-muted hover:text-ink">
              Tratamiento de datos (Ley 1581)
            </Link>
            <Link href="/terminos" className="text-ink-muted hover:text-ink">
              Términos de uso
            </Link>
            {contact && (
              <a href={`mailto:${contact}`} className="text-ink-muted hover:text-ink">
                {contact}
              </a>
            )}
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-faint md:col-span-4">
            <p>CIFRA · Bogotá, Colombia · Fintech para el bienestar financiero diario del barrio, 2026.</p>
            <Link
              href="/admin"
              className="text-[12px] text-ink-faint/70 transition hover:text-ink-muted hover:underline"
            >
              Acceso interno · Backoffice
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
