import { Building2, FileSpreadsheet, Link2, Plus } from 'lucide-react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { bogotaDate, loadAccessLog, loadSources } from '@/lib/data';
import { shortDate } from '@/lib/engine/dates';
import { cop } from '@/lib/format';
import { toggleAccount } from '../actions';
import { BalanceForm, DeleteSource, ManualAccountForm } from './forms';

export const metadata = { title: 'Tus datos' };

const KIND = {
  entidad_aliada: { label: 'Tu entidad comparte estos datos', icon: Building2 },
  extracto: { label: 'Extracto que subiste', icon: FileSpreadsheet },
  finanzas_abiertas: { label: 'Finanzas abiertas, autorizado en la app de tu entidad', icon: Link2 },
  manual: { label: 'Datos que escribiste', icon: FileSpreadsheet },
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
    <div className="space-y-7">
      <div>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">Tus datos</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
          Cada fuente que usa CIFRA: de qué entidad viene, qué datos trae y desde cuándo. Borras cualquiera cuando quieras.
        </p>
        {sp.borrada && <p role="status" className="mt-3 rounded-xl bg-primary-light px-4 py-3 text-[14px] text-primary-dark">Borramos la fuente y sus movimientos.</p>}
      </div>

      {sources.length === 0 && (
        <p className="rounded-2xl border border-line bg-white p-5 text-[15px] text-ink-muted">
          Todavía no hay fuentes. Sube un extracto o escribe tu saldo a mano para empezar.
        </p>
      )}

      <ul className="space-y-4">
        {sources.map((s) => {
          const K = KIND[s.kind];
          return (
            <li key={s.id} className="rounded-2xl border border-line bg-white">
              <div className="flex items-start gap-3 px-5 pt-4">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-light text-primary-dark">
                  <K.icon size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-semibold">{s.entityName}</p>
                  <p className="text-[13px] text-ink-muted">{K.label}</p>
                </div>
                {s.status !== 'activa' && <span className="rounded-full bg-paper px-2.5 py-1 text-[12px] font-semibold text-ink-muted">{s.status}</span>}
              </div>
              <dl className="mx-5 mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-[13.5px]">
                <div>
                  <dt className="text-ink-faint">Qué trae</dt>
                  <dd className="font-medium">{s.scopes.map((x) => SCOPE[x] ?? x).join(' y ')}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Desde</dt>
                  <dd className="font-medium">{when(s.grantedAt)}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Movimientos entre</dt>
                  <dd className="font-medium">{s.coverageFrom && s.coverageTo ? `${shortDate(s.coverageFrom)} y ${shortDate(s.coverageTo)}` : 'sin movimientos'}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Última actualización</dt>
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
                          {a.mask && <span className="font-normal text-ink-muted"> terminada en {a.mask}</span>}
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
                        <Link href={`/app/datos/importar?cuenta=${a.id}`} className="text-[13.5px] font-semibold text-primary-dark underline-offset-2 hover:underline">
                          Subir extracto más reciente
                        </Link>
                      )}
                      {s.kind === 'manual' && (
                        <Link href="/app/datos/importar" className="text-[13.5px] font-semibold text-primary-dark underline-offset-2 hover:underline">
                          Cambiar por su extracto
                        </Link>
                      )}
                      {s.kind !== 'entidad_aliada' && <BalanceForm accountId={a.id} current={a.balanceMinor === null ? '' : String(Math.round(a.balanceMinor / 100))} />}
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
              <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line px-5 py-3">
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
        <section className="rounded-2xl bg-paper-deep px-5 py-4 text-[14px] leading-relaxed text-ink-muted">
          <h2 className="text-[15px] font-semibold text-ink">¿Y conectar mi banco directo?</h2>
          <p className="mt-1">
            Esa conexión se autoriza desde la app de tu banco, no desde CIFRA, y solo es posible cuando la entidad activa el
            intercambio de datos de finanzas abiertas. Todavía ninguna entidad lo tiene activo con CIFRA. Cuando pase, aparecerá
            aquí con el nombre de la entidad y los datos que comparte.
          </p>
        </section>
      </div>

      {log.length > 0 && (
        <section>
          <h2 className="text-[15px] font-semibold">Quién tocó tus datos</h2>
          <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-white text-[13.5px]">
            {log.map((l) => (
              <li key={l.id} className="flex justify-between gap-3 px-5 py-2.5">
                <span>
                  <span className="font-semibold capitalize">{l.actor}</span> <span className="text-ink-muted">{l.action}</span>
                </span>
                <span className="shrink-0 text-ink-faint">{when(l.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
