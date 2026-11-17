import { Building2, Check, Download, FileSpreadsheet, Link2, Plus, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { bogotaDate, loadAccessLog, loadSources } from '@/lib/data';
import { shortDate } from '@/lib/engine/dates';
import { cop } from '@/lib/format';
import { toggleAccount } from '../actions';
import { DeleteAccountForm } from '../ajustes/forms';
import { BalanceForm, DeleteSource, ManualAccountForm } from './forms';

export const metadata = { title: 'Tus datos' };

const KIND = {
  entidad_aliada: { label: 'Tu entidad comparte estos datos bajo tu autorización', icon: Building2 },
  extracto: { label: 'Extracto que subiste desde tu dispositivo', icon: FileSpreadsheet },
  finanzas_abiertas: { label: 'Finanzas abiertas, autorizado en la app de tu entidad', icon: Link2 },
  manual: { label: 'Saldo escrito directamente por ti', icon: FileSpreadsheet },
} as const;

const SCOPE: Record<string, string> = { saldos: 'Saldo', movimientos: 'Movimientos' };
const ACCOUNT_KIND: Record<string, string> = {
  ahorros: 'Ahorros',
  corriente: 'Corriente',
  billetera: 'Billetera',
  tarjeta_credito: 'Tarjeta de crédito',
  otra: 'Cuenta',
};

function when(d: Date | null) {
  return d ? shortDate(bogotaDate(d)) : 'nunca';
}

export default async function DatosPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const [sources, log, sp] = await Promise.all([loadSources(user.id), loadAccessLog(user.id), searchParams]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.025em]">Tus datos</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
          Son tuyos: puedes verlos, descargarlos o borrarlos cuando quieras (Ley 1581 de 2012).
        </p>
        {sp.borrada && (
          <p role="status" className="mt-3 rounded-xl bg-primary-light px-4 py-3 text-[14px] font-medium text-primary-dark">
            Listo, borramos esa cuenta y sus movimientos.
          </p>
        )}
      </div>

      {/* Lo que más preguntan: qué queda guardado de un extracto, qué no, y cómo se borra. */}
      <section aria-labelledby="que-guardamos" data-testid="que-guardamos" className="surface-card divide-y divide-line">
        <div className="flex gap-3.5 p-5">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-light text-primary-dark">
            <Check size={17} strokeWidth={2.6} aria-hidden="true" />
          </span>
          <div>
            <h2 id="que-guardamos" className="text-[15.5px] font-semibold text-ink">Qué guardamos</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">
              Lo que tú escribes: tu saldo, tus cobros fijos y tu gasto del día a día. Si subes un extracto, de cada movimiento
              guardamos tres cosas: la fecha, la descripción y el valor.
            </p>
          </div>
        </div>
        <div className="flex gap-3.5 p-5">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-paper-deep text-ink-muted">
            <X size={17} strokeWidth={2.6} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[15.5px] font-semibold text-ink">Qué no guardamos</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">
              El archivo del extracto: se lee en tu celular y no se sube. Tampoco claves del banco, que nunca te pedimos, ni el
              número completo de tu cuenta (solo los últimos 4 dígitos, si los escribes). Los negocios con ofertas no ven nada
              de esto: en la caja solo ven un código de 6 letras.
            </p>
          </div>
        </div>
        <div className="flex gap-3.5 p-5">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neg-light text-neg">
            <Trash2 size={16} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[15.5px] font-semibold text-ink">Cómo se borra</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">
              Cada cuenta de abajo tiene su botón para borrarla con todos sus movimientos. Y con{' '}
              <a href="#borrar-cuenta" className="font-semibold text-ink underline underline-offset-2">
                Borrar mi cuenta
              </a>{' '}
              se borra todo de inmediato.
              {user.consentAt && <> Autorizaste el tratamiento de tus datos el {shortDate(bogotaDate(user.consentAt))}, al crear tu cuenta.</>}
            </p>
          </div>
        </div>
      </section>

      {/* Portabilidad en un clic (JSON completo + CSV de movimientos) */}
      <section className="surface-card p-5">
        <h2 className="font-display text-[17px] font-bold text-ink">Descargar una copia de tus datos</h2>
        <div className="mt-3.5 flex flex-wrap gap-2.5">
          <a id="btn-export-csv" href="/api/export?format=csv" className="btn-sm border border-line bg-white text-ink hover:bg-paper-warm">
            <Download size={15} aria-hidden="true" /> Movimientos, para Excel
          </a>
          <a id="btn-export-json" href="/api/export?format=json" className="btn-sm border border-line bg-white text-ink hover:bg-paper-warm">
            <Download size={15} aria-hidden="true" /> Todo lo que guardamos de ti
          </a>
        </div>
      </section>

      {sources.length === 0 && (
        <div className="surface-card p-5 text-[15px] text-ink-muted">
          Todavía no hay cuentas. Sube un extracto o escribe tu saldo para empezar.
        </div>
      )}

      <ul className="space-y-4">
        {sources.map((s) => {
          const K = KIND[s.kind];
          return (
            <li key={s.id} className="surface-card overflow-hidden">
              <div className="flex items-start gap-3 px-5 pt-4">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-light text-primary-dark">
                  <K.icon size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-bold text-ink">{s.entityName}</p>
                  <p className="text-[13px] text-ink-muted">{K.label}</p>
                </div>
                {s.status !== 'activa' && (
                  <span className="rounded-full bg-paper px-2.5 py-1 text-[12px] font-semibold text-ink-muted">{s.status}</span>
                )}
              </div>
              <dl className="mx-5 mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-[13.5px]">
                <div>
                  <dt className="text-ink-faint">Qué comparte</dt>
                  <dd className="font-medium">{s.scopes.map((x) => SCOPE[x] ?? x).join(' y ')}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Autorizado el</dt>
                  <dd className="font-medium">{when(s.grantedAt)}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Rango cubierto</dt>
                  <dd className="font-medium">
                    {s.coverageFrom && s.coverageTo
                      ? `${shortDate(s.coverageFrom)} al ${shortDate(s.coverageTo)}`
                      : 'sin movimientos'}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Última lectura</dt>
                  <dd className="font-medium">{when(s.lastSyncAt)}</dd>
                </div>
              </dl>
              <ul className="mt-3 divide-y divide-line border-t border-line">
                {s.accounts.map((a) => (
                  <li key={a.id} className="px-5 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold">
                          {a.name}
                          {a.mask && <span className="font-normal text-ink-muted"> ····{a.mask}</span>}
                        </p>
                        <p className="text-[12.5px] text-ink-faint">
                          {ACCOUNT_KIND[a.kind]}, {a.txCount} movimientos
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="tnum font-semibold">{a.balanceMinor === null ? 'Sin saldo' : cop(a.balanceMinor)}</p>
                        {a.balanceAt && <p className="text-[12px] text-ink-faint">al {when(a.balanceAt)}</p>}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                      {s.kind === 'extracto' && (
                        <Link
                          href={`/app/datos/importar?cuenta=${a.id}`}
                          className="text-[13.5px] font-semibold text-primary-dark underline-offset-2 hover:underline"
                        >
                          Subir extracto más reciente
                        </Link>
                      )}
                      {s.kind === 'manual' && (
                        <Link
                          href="/app/datos/importar"
                          className="text-[13.5px] font-semibold text-primary-dark underline-offset-2 hover:underline"
                        >
                          Cambiar por su extracto
                        </Link>
                      )}
                      {s.kind !== 'entidad_aliada' && (
                        <BalanceForm
                          accountId={a.id}
                          current={a.balanceMinor === null ? '' : String(Math.round(a.balanceMinor / 100))}
                        />
                      )}
                      <form action={toggleAccount}>
                        <input type="hidden" name="accountId" value={a.id} />
                        <input type="hidden" name="include" value={a.includeInCifra ? 'no' : 'si'} />
                        <button type="submit" className="text-[13.5px] font-semibold text-ink-muted underline-offset-2 hover:underline">
                          {a.includeInCifra ? 'No contarla en la cifra' : 'Contarla en la cifra'}
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line bg-paper/50 px-5 py-3">
                <DeleteSource sourceId={s.id} entity={s.entityName} />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="space-y-3">
        <Link href="/app/datos/importar" className="btn-ghost w-full">
          <Plus size={18} aria-hidden="true" /> Subir extracto de otra cuenta
        </Link>
        <ManualAccountForm />
      </div>

      {log.length > 0 && (
        <details className="group rounded-2xl border border-line bg-white shadow-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
            <span>Quién ha visto o cambiado tus datos</span>
            <span className="text-[13px] font-medium text-ink-muted group-open:hidden">Ver</span>
            <span className="hidden text-[13px] font-medium text-ink-muted group-open:inline">Cerrar</span>
          </summary>
          <ul className="divide-y divide-line border-t border-line text-[13.5px]">
            {log.map((l) => (
              <li key={l.id} className="flex justify-between gap-3 px-5 py-2.5">
                <span>
                  <span className="font-semibold capitalize">{l.actor}</span>{' '}
                  <span className="text-ink-muted">{l.action}</span>
                </span>
                <span className="shrink-0 text-ink-faint">{when(l.at)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <section id="borrar-cuenta" className="surface-card scroll-mt-20 p-5">
        <h2 className="font-display text-[18px] font-bold text-neg">Borrar mi cuenta</h2>
        <div className="mt-3">
          <DeleteAccountForm />
        </div>
      </section>
    </div>
  );
}
