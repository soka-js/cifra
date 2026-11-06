import { Building2, Download, FileSpreadsheet, Link2, Plus, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { BackButton } from '@/components/ui/back-button';
import { requireUser } from '@/lib/auth/session';
import { bogotaDate, loadAccessLog, loadSources } from '@/lib/data';
import { shortDate } from '@/lib/engine/dates';
import { cop } from '@/lib/format';
import { toggleAccount } from '../actions';
import { DeleteAccountForm, ZoneForm } from '../ajustes/forms';
import { BalanceForm, DeleteSource, ManualAccountForm } from './forms';

export const metadata = { title: 'Tus datos (Ley 1581)' };

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
      <BackButton href="/app" label="Volver a Hoy" className="mb-2" />
      <div>
        <span className="badge-primary">
          <ShieldCheck size={13} aria-hidden="true" /> Ley 1581 de 2012 · Habeas Data
        </span>
        <h1 className="mt-2.5 font-display text-[30px] font-bold leading-tight tracking-[-0.025em]">Tus datos</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
          Aquí ves cada fuente que alimenta tu cifra, quién ha tocado tus datos y puedes descargar una copia completa o borrar cualquier cuenta al instante.
        </p>
        {sp.borrada && (
          <p role="status" className="mt-3 rounded-xl bg-primary-light px-4 py-3 text-[14px] font-medium text-primary-dark">
            Borramos la fuente y todos sus movimientos asociados.
          </p>
        )}
      </div>

      {/* Portabilidad en un clic (JSON completo + CSV de movimientos) */}
      <section className="surface-card p-5">
        <h2 className="font-display text-[17px] font-bold text-ink">Descargar una copia de tus datos</h2>
        <p className="mt-1 text-[13.5px] text-ink-muted">
          Llévate tus movimientos clasificados, tus reglas personales y tu historial cuando quieras.
        </p>
        <div className="mt-3.5 flex flex-wrap gap-2.5">
          <a id="btn-export-csv" href="/api/export?format=csv" className="btn-sm border border-line bg-white text-ink hover:bg-paper-warm">
            <Download size={15} aria-hidden="true" /> Movimientos en CSV (Excel)
          </a>
          <a id="btn-export-json" href="/api/export?format=json" className="btn-sm border border-line bg-white text-ink hover:bg-paper-warm">
            <Download size={15} aria-hidden="true" /> Expediente completo en JSON
          </a>
        </div>
      </section>

      {sources.length === 0 && (
        <div className="surface-card p-5 text-[15px] text-ink-muted">
          Todavía no hay fuentes conectadas. Sube un extracto o escribe tu saldo a mano para empezar.
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

      {/* Control de ubicación aproximada */}
      <section className="surface-card p-5">
        <h2 className="font-display text-[18px] font-bold text-ink">Zona para beneficios cercanos</h2>
        <div className="mt-3">
          <ZoneForm currentZone={user.zoneSlug ?? null} />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-paper-warm px-5 py-4 text-[13.5px] leading-relaxed text-ink-muted">
        <h2 className="text-[14.5px] font-semibold text-ink">Sobre Finanzas Abiertas en Colombia</h2>
        <p className="mt-1">
          Cuando una cooperativa, billetera o banco activa el canal aliado de CIFRA o el estándar de finanzas abiertas (Decreto 1297 de 2022), la autorización ocurre siempre en la app de tu entidad y aparece aquí con botón de revocación inmediata.
        </p>
      </section>

      {log.length > 0 && (
        <section>
          <h2 className="font-display text-[17px] font-bold text-ink">Bitácora de acceso a tus datos</h2>
          <ul className="mt-2.5 divide-y divide-line rounded-2xl border border-line bg-white text-[13.5px] shadow-card">
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
        </section>
      )}

      <section className="surface-card p-5">
        <h2 className="font-display text-[18px] font-bold text-neg">Revocar todo y borrar mi cuenta</h2>
        <div className="mt-3">
          <DeleteAccountForm />
        </div>
      </section>
    </div>
  );
}
