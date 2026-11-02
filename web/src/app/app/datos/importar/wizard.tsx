'use client';

import Papa from 'papaparse';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUp, ShieldCheck } from 'lucide-react';
import { buildTransactions, detectColumns, type Cell, type ColumnMapping } from '@/lib/import/parse';
import { shortDate } from '@/lib/engine/dates';
import { cop, parsePesosInput } from '@/lib/format';
import { track } from '@/lib/analytics/client';

const ENTITIES = [
  'Bancolombia',
  'Nequi',
  'Davivienda',
  'Daviplata',
  'Banco de Bogotá',
  'BBVA',
  'Banco de Occidente',
  'Banco Popular',
  'Banco AV Villas',
  'Scotiabank Colpatria',
  'Banco Caja Social',
  'Itaú',
  'Banco Falabella',
  'Nu',
  'Lulo Bank',
];

type Step = 'cuenta' | 'archivo' | 'revisar' | 'listo';
type AccountKind = 'ahorros' | 'corriente' | 'billetera' | 'tarjeta_credito' | 'otra';

export interface PresetAccount {
  accountId: string;
  entityName: string;
  kind: AccountKind;
  name: string;
  mask: string | null;
}

async function readRows(file: File): Promise<Cell[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) {
    const { default: readXlsxFile } = await import('read-excel-file');
    return (await readXlsxFile(file)) as Cell[][];
  }
  if (name.endsWith('.csv') || name.endsWith('.txt') || file.type === 'text/csv') {
    const buf = await file.arrayBuffer();
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch {
      // Muchos bancos exportan en Windows-1252 (tildes y eñes).
      text = new TextDecoder('windows-1252').decode(buf);
    }
    const res = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' });
    return res.data as Cell[][];
  }
  if (name.endsWith('.xls')) throw new Error('Ese es el formato viejo de Excel (.xls). Ábrelo y guárdalo como .xlsx o .csv, y súbelo otra vez.');
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const { readPdfRows } = await import('@/lib/import/pdf');
    return readPdfRows(file);
  }
  throw new Error('Sube un archivo .csv, .xlsx o .pdf.');
}

export function ImportWizard({ preset, first }: { preset?: PresetAccount; first: boolean }) {
  const router = useRouter();
  const presetEntity = preset?.entityName;
  const [accountId, setAccountId] = useState<string | null>(preset?.accountId ?? null);
  const [step, setStep] = useState<Step>(preset ? 'archivo' : 'cuenta');
  const [entity, setEntity] = useState(presetEntity && ENTITIES.includes(presetEntity) ? presetEntity : presetEntity ? 'otra' : '');
  const [otherEntity, setOtherEntity] = useState(presetEntity && !ENTITIES.includes(presetEntity) ? presetEntity : '');
  const [kind, setKind] = useState<AccountKind>(preset?.kind ?? 'ahorros');
  const [accountName, setAccountName] = useState(preset?.name ?? 'Cuenta de ahorros');
  const [mask, setMask] = useState(preset?.mask ?? '');
  const [rows, setRows] = useState<Cell[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [map, setMap] = useState<ColumnMapping | null>(null);
  const [invert, setInvert] = useState(false);
  const [balance, setBalance] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inserted: number; duplicates: number } | null>(null);
  const started = useRef(false);

  const entityName = entity === 'otra' ? otherEntity.trim() : entity;
  const parsed = useMemo(() => (rows && map ? buildTransactions(rows, map, { invertSign: invert }) : null), [rows, map, invert]);
  const header = rows && map ? rows[map.headerRow] ?? [] : [];
  const mostlyPositive = parsed && parsed.txs.length > 5 && map?.amount !== null && parsed.txs.filter((t) => t.amountMinor > 0).length / parsed.txs.length > 0.85;

  async function onFile(file: File) {
    setError(null);
    if (!started.current) {
      started.current = true;
      track('begin_import');
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('El archivo pesa más de 8 MB. Descarga un rango de fechas más corto.');
      return;
    }
    try {
      const r = await readRows(file);
      const detected = detectColumns(r);
      setRows(r);
      setFileName(file.name);
      setMap(
        detected ?? { headerRow: 0, date: 0, description: Math.min(1, (r[0]?.length ?? 1) - 1), amount: Math.min(2, (r[0]?.length ?? 1) - 1), debit: null, credit: null, balance: null },
      );
      setInvert(false);
      const res = detected ? buildTransactions(r, detected) : null;
      setBalance(res?.latestBalanceMinor != null ? String(Math.round(res.latestBalanceMinor / 100)) : '');
      if (!detected) setError('No reconocimos las columnas automáticamente. Elígelas abajo.');
      setStep('revisar');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos leer el archivo.');
    }
  }

  async function submit() {
    if (!parsed || !parsed.txs.length) return;
    const raw = balance.trim();
    const neg = raw.startsWith('-');
    const minor = raw.replace(/^-/, '') === '0' ? 0 : parsePesosInput(raw.replace(/^-/, ''));
    if (minor === null) {
      setError('Escribe cuánto tienes hoy en esta cuenta, por ejemplo 1.250.000.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountId,
          entityName,
          accountKind: kind,
          accountName: accountName.trim() || 'Cuenta',
          mask: /^\d{4}$/.test(mask) ? mask : null,
          balanceMinor: neg ? -minor : minor,
          transactions: parsed.txs.slice(-5000).map(({ postedOn, description, amountMinor }) => ({ postedOn, description, amountMinor })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No pudimos guardar los movimientos.');
      setResult({ inserted: data.inserted, duplicates: data.duplicates });
      setStep('listo');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos guardar los movimientos.');
    } finally {
      setBusy(false);
    }
  }

  const colOptions = header.map((h, i) => ({ i, label: `${String(h ?? '').trim() || `Columna ${i + 1}`}` }));
  const ColSelect = ({ id, label, value, onChange, optional }: { id: string; label: string; value: number | null; onChange: (v: number | null) => void; optional?: boolean }) => (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] font-semibold">{label}</label>
      <select id={id} className="field py-2.5 text-[15px]" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}>
        {optional && <option value="">No tiene</option>}
        {colOptions.map((o) => (
          <option key={o.i} value={o.i}>{o.label}</option>
        ))}
      </select>
    </div>
  );

  if (step === 'listo' && result) {
    return (
      <section className="pt-4">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">Listo, tu cifra está calculada.</h1>
        <p className="mt-3 text-[16px] text-ink-muted">
          Guardamos {result.inserted} movimientos nuevos de {entityName}
          {result.duplicates > 0 ? ` y omitimos ${result.duplicates} que ya estaban` : ''}. El archivo no salió de tu dispositivo.
        </p>
        <div className="mt-7 space-y-3">
          <button type="button" className="btn-primary w-full" onClick={() => router.push('/app')}>Ver mi cifra</button>
          <button type="button" className="btn-ghost w-full" onClick={() => { setRows(null); setMap(null); setResult(null); setAccountId(null); setStep('cuenta'); setEntity(''); setMask(''); }}>
            Subir otra cuenta
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">{first ? 'Sube tu primer extracto' : 'Subir extracto'}</h1>
        <p className="mt-2 flex gap-2 text-[14.5px] leading-relaxed text-ink-muted">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          El archivo se lee aquí, en tu dispositivo. Solo guardamos fecha, descripción y valor de cada movimiento.
        </p>
      </div>

      {step === 'cuenta' && (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!entityName || entityName.length < 2) return setError('Elige la entidad de esta cuenta.');
            setError(null);
            setStep('archivo');
          }}
        >
          <div>
            <label htmlFor="entity" className="label">¿De qué entidad es?</label>
            <select id="entity" className="field" value={entity} onChange={(e) => setEntity(e.target.value)}>
              <option value="" disabled>Elige tu banco o billetera</option>
              {ENTITIES.map((e) => <option key={e}>{e}</option>)}
              <option value="otra">Otra entidad o cooperativa</option>
            </select>
          </div>
          {entity === 'otra' && (
            <div>
              <label htmlFor="other" className="label">Nombre de la entidad</label>
              <input id="other" className="field" value={otherEntity} onChange={(e) => setOtherEntity(e.target.value)} maxLength={80} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="kind" className="label">Tipo</label>
              <select
                id="kind"
                className="field"
                value={kind}
                onChange={(e) => {
                  const k = e.target.value as typeof kind;
                  setKind(k);
                  setAccountName({ ahorros: 'Cuenta de ahorros', corriente: 'Cuenta corriente', billetera: 'Billetera', tarjeta_credito: 'Tarjeta de crédito', otra: 'Cuenta' }[k]);
                }}
              >
                <option value="ahorros">Ahorros</option>
                <option value="corriente">Corriente</option>
                <option value="billetera">Billetera</option>
                <option value="tarjeta_credito">Tarjeta de crédito</option>
                <option value="otra">Otra</option>
              </select>
            </div>
            <div>
              <label htmlFor="mask" className="label">Últimos 4 dígitos</label>
              <input id="mask" inputMode="numeric" maxLength={4} placeholder="Opcional" className="field tnum" value={mask} onChange={(e) => setMask(e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>
          {kind === 'tarjeta_credito' && (
            <p className="rounded-xl bg-warn-light px-4 py-3 text-[13.5px] text-warn">
              Las tarjetas de crédito no suman a tu cifra (son deuda), pero sus compras sí ayudan a encontrar cobros que se repiten.
            </p>
          )}
          {error && <p role="alert" className="text-sm text-neg">{error}</p>}
          <button type="submit" className="btn-primary w-full">Seguir</button>
        </form>
      )}

      {step === 'archivo' && (
        <div className="space-y-4">
          <p className="text-[15px]">
            <span className="font-semibold">{entityName}</span>, {accountName.toLowerCase()}
            {mask ? ` terminada en ${mask}` : ''}.{' '}
            <button type="button" className="text-primary-dark underline" onClick={() => { setAccountId(null); setStep('cuenta'); }}>Cambiar</button>
          </p>
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line bg-white px-6 py-10 text-center hover:border-primary">
            <FileUp size={30} className="text-primary" aria-hidden="true" />
            <span className="text-[16px] font-semibold">Elige el archivo de movimientos</span>
            <span className="text-[13.5px] text-ink-muted">CSV, Excel (.xlsx) o PDF digital. Descárgalo desde la sucursal virtual o la app de tu banco, idealmente de los últimos tres meses. El PDF es nuevo: revisa los movimientos antes de guardar.</span>
            <input type="file" accept=".csv,.xlsx,.pdf,.txt,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          {error && <p role="alert" className="text-sm text-neg">{error}</p>}
        </div>
      )}

      {step === 'revisar' && rows && map && (
        <div className="space-y-5">
          <p className="text-[14.5px] text-ink-muted">
            {fileName}{' '}
            <button type="button" className="text-primary-dark underline" onClick={() => { setRows(null); setStep('archivo'); }}>Usar otro archivo</button>
          </p>
          <details open={!parsed?.txs.length} className="rounded-2xl border border-line bg-white px-4 py-3">
            <summary className="cursor-pointer text-[14.5px] font-semibold">Columnas del archivo</summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="hdr" className="mb-1 block text-[13px] font-semibold">Fila de títulos</label>
                <select id="hdr" className="field py-2.5 text-[15px]" value={map.headerRow} onChange={(e) => setMap({ ...map, headerRow: Number(e.target.value) })}>
                  {rows.slice(0, 40).map((r, i) => (
                    <option key={i} value={i}>
                      Fila {i + 1}: {r.filter(Boolean).slice(0, 3).map(String).join(', ').slice(0, 40)}
                    </option>
                  ))}
                </select>
              </div>
              <ColSelect id="c-date" label="Fecha" value={map.date} onChange={(v) => setMap({ ...map, date: v ?? 0 })} />
              <ColSelect id="c-desc" label="Descripción" value={map.description} onChange={(v) => setMap({ ...map, description: v ?? 0 })} />
              <div>
                <label htmlFor="c-mode" className="mb-1 block text-[13px] font-semibold">Valores</label>
                <select
                  id="c-mode"
                  className="field py-2.5 text-[15px]"
                  value={map.amount !== null ? 'uno' : 'dos'}
                  onChange={(e) =>
                    setMap(e.target.value === 'uno' ? { ...map, amount: map.debit ?? 0, debit: null, credit: null } : { ...map, amount: null, debit: map.amount ?? 0, credit: map.amount ?? 0 })
                  }
                >
                  <option value="uno">Una columna con signo</option>
                  <option value="dos">Salidas y entradas separadas</option>
                </select>
              </div>
              {map.amount !== null ? (
                <ColSelect id="c-amt" label="Valor" value={map.amount} onChange={(v) => setMap({ ...map, amount: v ?? 0 })} />
              ) : (
                <>
                  <ColSelect id="c-deb" label="Salidas (débitos)" value={map.debit} onChange={(v) => setMap({ ...map, debit: v })} />
                  <ColSelect id="c-cre" label="Entradas (créditos)" value={map.credit} onChange={(v) => setMap({ ...map, credit: v })} />
                </>
              )}
              <ColSelect id="c-bal" label="Saldo" value={map.balance} optional onChange={(v) => setMap({ ...map, balance: v })} />
            </div>
          </details>

          {parsed && parsed.txs.length > 0 ? (
            <>
              <div className="rounded-2xl border border-line bg-white px-4 py-4">
                <p className="text-[15px]">
                  <span className="font-semibold">{parsed.txs.length} movimientos</span> entre {shortDate(parsed.from!)} y {shortDate(parsed.to!)}
                  {parsed.skipped > 0 && <span className="text-ink-muted">. Omitimos {parsed.skipped} filas sin fecha o valor.</span>}
                </p>
                <ul className="tnum mt-3 divide-y divide-line text-[13.5px]">
                  {parsed.txs.slice(0, 6).map((t, i) => (
                    <li key={i} className="flex justify-between gap-3 py-1.5">
                      <span className="min-w-0 truncate">
                        <span className="text-ink-faint">{shortDate(t.postedOn)}</span> {t.description}
                      </span>
                      <span className={t.amountMinor < 0 ? '' : 'text-primary-dark'}>{cop(t.amountMinor, { sign: true })}</span>
                    </li>
                  ))}
                </ul>
                {(map.amount !== null) && (
                  <label className="mt-3 flex items-start gap-2.5 text-[13.5px] text-ink-muted">
                    <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0E6E63]" />
                    <span>
                      Las compras salen en positivo (en este archivo los gastos no tienen signo menos).
                      {mostlyPositive && !invert && <strong className="block text-warn">Casi todos los valores son positivos: revisa esta opción.</strong>}
                    </span>
                  </label>
                )}
              </div>
              <div>
                <label htmlFor="balance" className="label">¿Cuánto tienes hoy en esta cuenta?</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">$</span>
                  <input id="balance" inputMode="numeric" className="field tnum pl-8" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="1.250.000" />
                </div>
                <p className="mt-1.5 text-[13px] text-ink-faint">
                  {parsed.latestBalanceMinor !== null
                    ? `El extracto termina el ${shortDate(parsed.to!)} con ${cop(parsed.latestBalanceMinor)}. Si has movido plata desde entonces, escribe el saldo de hoy.`
                    : 'Míralo en la app de tu banco. Es la base de tu cifra.'}
                </p>
              </div>
              {error && <p role="alert" className="text-sm text-neg">{error}</p>}
              <button type="button" disabled={busy} onClick={submit} className="btn-primary w-full">
                {busy ? 'Guardando...' : `Guardar ${parsed.txs.length} movimientos`}
              </button>
            </>
          ) : (
            <p className="rounded-xl bg-warn-light px-4 py-3 text-[14px] text-warn">
              Con estas columnas no salen movimientos. Revisa la fila de títulos y qué columna tiene la fecha y el valor.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
