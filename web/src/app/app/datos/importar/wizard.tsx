'use client';

import Papa from 'papaparse';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, FileUp, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { buildTransactions, detectColumns, type Cell, type ColumnMapping } from '@/lib/import/parse';
import { shortDate, todayInBogota, addDays } from '@/lib/engine/dates';
import { identifyMerchant } from '@/lib/engine/merchant';
import { detectRecurring } from '@/lib/engine/recurring';
import { cop, parsePesosInput } from '@/lib/format';
import { gaEvent, track } from '@/lib/analytics/client';

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
  'Coopcentral / Cooperativa',
];

type Step = 'cuenta' | 'archivo' | 'clasificando' | 'revisar' | 'listo';
type AccountKind = 'ahorros' | 'corriente' | 'billetera' | 'tarjeta_credito' | 'otra';

export interface PresetAccount {
  accountId: string;
  entityName: string;
  kind: AccountKind;
  name: string;
  mask: string | null;
}

function buildSampleBancolombiaRows(): Cell[][] {
  const today = todayInBogota();
  return [
    ['Fecha', 'Descripción', 'Valor', 'Saldo'],
    [addDays(today, -65), 'ABONO NOMINA EMPRESA SAS', '3200000', '3450000'],
    [addDays(today, -63), 'PAGO PSE ENEL CODENSA', '-94000', '3356000'],
    [addDays(today, -61), 'COMPRA INTL SPOTIFY P1A2B3', '-16900', '3339100'],
    [addDays(today, -59), 'COMPRA INTL NETFLIX.COM', '-26900', '3312200'],
    [addDays(today, -58), 'DEBITO AUTOMATICO SMART FIT', '-89900', '3222300'],
    [addDays(today, -54), 'COMPRA POS KOBA COLOMBIA D1', '-68400', '3153900'],
    [addDays(today, -50), 'COMPRA POS JUAN VALDEZ', '-14500', '3139400'],
    [addDays(today, -45), 'COMPRA RAPPI RESTAURANTES', '-42000', '3097400'],
    [addDays(today, -35), 'ABONO NOMINA EMPRESA SAS', '3200000', '3680000'],
    [addDays(today, -33), 'PAGO PSE ENEL CODENSA', '-98500', '3581500'],
    [addDays(today, -31), 'COMPRA INTL SPOTIFY P1A2B3', '-16900', '3564600'],
    [addDays(today, -29), 'COMPRA INTL NETFLIX.COM', '-26900', '3537700'],
    [addDays(today, -28), 'DEBITO AUTOMATICO SMART FIT', '-89900', '3447800'],
    [addDays(today, -24), 'COMPRA POS OXXO CHAPINERO', '-12800', '3435000'],
    [addDays(today, -21), 'COMPRA POS OXXO CHAPINERO', '-11500', '3423500'],
    [addDays(today, -18), 'COMPRA POS OXXO CHAPINERO', '-14200', '3409300'],
    [addDays(today, -15), 'COMPRA POS KOBA COLOMBIA D1', '-95000', '3314300'],
    [addDays(today, -12), 'COMPRA UBER TRIP BOGOTA', '-19800', '3294500'],
    [addDays(today, -9), 'COMPRA RAPPI RESTAURANTES', '-48500', '3246000'],
    [addDays(today, -5), 'ABONO NOMINA EMPRESA SAS', '3200000', '3820000'],
    [addDays(today, -4), 'PAGO PSE CLARO MOVIL', '-49900', '3770100'],
    [addDays(today, -2), 'COMPRA POS TOSTAO CAFE Y PAN', '-9800', '3760300'],
    [addDays(today, -1), 'CUOTA DE MANEJO TARJETA DEBITO', '-14900', '1845000'],
  ];
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
      text = new TextDecoder('windows-1252').decode(buf);
    }
    const res = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
    return res.data as Cell[][];
  }
  if (name.endsWith('.xls')) {
    throw new Error('Ese es el formato viejo de Excel (.xls). Ábrelo y guárdalo como .xlsx o .csv, y súbelo otra vez.');
  }
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const { readPdfRows } = await import('@/lib/import/pdf');
    return readPdfRows(file);
  }
  throw new Error('Sube un archivo .csv, .xlsx o .pdf.');
}

export interface ManualBalance {
  id: string;
  entityName: string;
  balanceMinor: number | null;
}

export function ImportWizard({ preset, first, manual = [] }: { preset?: PresetAccount; first: boolean; manual?: ManualBalance[] }) {
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
  const [stageIndex, setStageIndex] = useState(0);
  const [result, setResult] = useState<{ inserted: number; duplicates: number; replaced: string | null } | null>(null);
  const [replaceId, setReplaceId] = useState<string>(manual.length === 1 ? manual[0]!.id : '');
  const started = useRef(false);

  const entityName = entity === 'otra' ? otherEntity.trim() : entity;
  const parsed = useMemo(() => (rows && map ? buildTransactions(rows, map, { invertSign: invert }) : null), [rows, map, invert]);
  const header = rows && map ? rows[map.headerRow] ?? [] : [];
  const mostlyPositive =
    parsed &&
    parsed.txs.length > 5 &&
    map?.amount !== null &&
    parsed.txs.filter((t) => t.amountMinor > 0).length / parsed.txs.length > 0.85;

  // Estadísticas en vivo de clasificación automática para que la persona vea el trabajo que CIFRA ya hizo (I.5 #2).
  const autoClassification = useMemo(() => {
    if (!parsed?.txs.length) return { merchantsCount: 0, recurringCount: 0 };
    const uniqueMerchants = new Set<string>();
    for (const t of parsed.txs) {
      const m = identifyMerchant(t.description);
      if (m.key !== 'sin_nombre') uniqueMerchants.add(m.key);
    }
    const rec = detectRecurring(
      parsed.txs.map((t) => ({ accountId: 'preview', postedOn: t.postedOn, description: t.description, amountMinor: t.amountMinor })),
      todayInBogota(),
    );
    return { merchantsCount: uniqueMerchants.size, recurringCount: rec.length };
  }, [parsed]);

  async function runClassificationTransition(r: Cell[][], name: string) {
    const detected = detectColumns(r);
    setRows(r);
    setFileName(name);
    setMap(
      detected ?? {
        headerRow: 0,
        date: 0,
        description: Math.min(1, (r[0]?.length ?? 1) - 1),
        amount: Math.min(2, (r[0]?.length ?? 1) - 1),
        debit: null,
        credit: null,
        balance: null,
      },
    );
    setInvert(false);
    const res = detected ? buildTransactions(r, detected) : null;
    setBalance(res?.latestBalanceMinor != null ? String(Math.round(res.latestBalanceMinor / 100)) : '');
    if (!detected) setError('No reconocimos las columnas automáticamente. Elígelas abajo.');

    // Pantalla breve de clasificación visible (I.5 #2: evita que parezca trabajo manual).
    setStageIndex(0);
    setStep('clasificando');
    await new Promise((resolve) => setTimeout(resolve, 350));
    setStageIndex(1);
    await new Promise((resolve) => setTimeout(resolve, 350));
    setStageIndex(2);
    await new Promise((resolve) => setTimeout(resolve, 300));
    setStep('revisar');
  }

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
      await runClassificationTransition(r, file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos leer el archivo.');
    }
  }

  async function loadSampleStatement() {
    setError(null);
    if (!entityName) setEntity('Bancolombia');
    const r = buildSampleBancolombiaRows();
    await runClassificationTransition(r, 'extracto_ejemplo_bancolombia.csv');
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
          entityName: entityName || 'Bancolombia',
          accountKind: kind,
          accountName: accountName.trim() || 'Cuenta',
          mask: /^\d{4}$/.test(mask) ? mask : null,
          balanceMinor: neg ? -minor : minor,
          replaceManualAccountId: replaceId || null,
          transactions: parsed.txs.slice(-5000).map(({ postedOn, description, amountMinor }) => ({
            postedOn,
            description,
            amountMinor,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No pudimos guardar los movimientos.');
      setResult({ inserted: data.inserted, duplicates: data.duplicates, replaced: data.replaced ?? null });
      gaEvent('import_statement', { rows: parsed.txs.length });
      setStep('listo');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos guardar los movimientos.');
    } finally {
      setBusy(false);
    }
  }

  const colOptions = header.map((h, i) => ({ i, label: `${String(h ?? '').trim() || `Columna ${i + 1}`}` }));
  const ColSelect = ({
    id,
    label,
    value,
    onChange,
    optional,
  }: {
    id: string;
    label: string;
    value: number | null;
    onChange: (v: number | null) => void;
    optional?: boolean;
  }) => (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] font-semibold">
        {label}
      </label>
      <select
        id={id}
        className="field py-2.5 text-[15px]"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      >
        {optional && <option value="">No tiene</option>}
        {colOptions.map((o) => (
          <option key={o.i} value={o.i}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  if (step === 'clasificando') {
    const stages = [
      'Leyendo fechas y montos en tu propio navegador...',
      `Reconociendo ${autoClassification.merchantsCount || 'tus'} comercios colombianos y categorías...`,
      `Detectando cobros recurrentes${autoClassification.recurringCount ? ` (${autoClassification.recurringCount} encontrados)` : ''} y descartando traslados propios...`,
    ];
    return (
      <section aria-live="polite" className="surface-card space-y-5 p-6 sm:p-8">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary-dark">
          <Loader2 size={24} className="animate-spin" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em]">
            Clasificando tus movimientos automáticamente
          </h1>
          <p className="mt-1.5 text-[14.5px] text-ink-muted">
            El archivo no sale completo de tu dispositivo: limpiamos descripciones bancarias y agrupamos tus cobros por ti.
          </p>
        </div>
        <ul className="space-y-2.5 text-[14.5px]">
          {stages.map((label, idx) => (
            <li key={label} className="flex items-center gap-2.5">
              <CheckCircle2
                size={18}
                className={idx <= stageIndex ? 'shrink-0 text-primary' : 'shrink-0 text-line-strong'}
                aria-hidden="true"
              />
              <span className={idx <= stageIndex ? 'font-medium text-ink' : 'text-ink-faint'}>{label}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (step === 'listo' && result) {
    return (
      <section className="surface-card p-6 sm:p-8">
        <span className="badge-primary">Clasificación lista</span>
        <h1 className="mt-3 font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">
          Listo, tu cifra ya está calculada.
        </h1>
        <p className="mt-3 text-[15.5px] leading-relaxed text-ink-muted">
          Guardamos <strong>{result.inserted} movimientos nuevos</strong> de {entityName || 'tu cuenta'}
          {result.duplicates > 0 ? ` y omitimos ${result.duplicates} repetidos` : ''}. Reconocimos{' '}
          <strong>{autoClassification.merchantsCount} comercios</strong>
          {autoClassification.recurringCount > 0 ? ` y ${autoClassification.recurringCount} cobros recurrentes` : ''}.
          {result.replaced ? ` Reemplazamos el saldo manual de ${result.replaced} para no contar la misma plata dos veces.` : ''}
        </p>
        <div className="mt-7 space-y-3">
          <button id="btn-import-done" type="button" className="btn-primary w-full" onClick={() => router.push('/app')}>
            Ver mi cifra
          </button>
          <button
            type="button"
            className="btn-ghost w-full"
            onClick={() => {
              setRows(null);
              setMap(null);
              setResult(null);
              setAccountId(null);
              setReplaceId('');
              setStep('cuenta');
              setEntity('');
              setMask('');
            }}
          >
            Subir otra cuenta
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">
          {first ? 'Sube tu primer extracto' : 'Subir extracto'}
        </h1>
        <p className="mt-2 flex gap-2 text-[14.5px] leading-relaxed text-ink-muted">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          <span>
            El archivo se lee aquí, en tu dispositivo. Solo guardamos fecha, descripción limpia y valor de cada movimiento; nunca contraseñas ni números completos de producto.
          </span>
        </p>
      </div>

      {step === 'cuenta' && (
        <form
          className="surface-card space-y-5 p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!entityName || entityName.length < 2) return setError('Elige la entidad de esta cuenta.');
            setError(null);
            setStep('archivo');
          }}
        >
          <div>
            <label htmlFor="entity" className="label">
              ¿De qué entidad es?
            </label>
            <select id="entity" className="field" value={entity} onChange={(e) => setEntity(e.target.value)}>
              <option value="" disabled>
                Elige tu banco, billetera o cooperativa
              </option>
              {ENTITIES.map((e) => (
                <option key={e}>{e}</option>
              ))}
              <option value="otra">Otra entidad o cooperativa</option>
            </select>
          </div>
          {entity === 'otra' && (
            <div>
              <label htmlFor="other" className="label">
                Nombre de la entidad
              </label>
              <input id="other" className="field" value={otherEntity} onChange={(e) => setOtherEntity(e.target.value)} maxLength={80} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="kind" className="label">
                Tipo de producto
              </label>
              <select
                id="kind"
                className="field"
                value={kind}
                onChange={(e) => {
                  const k = e.target.value as typeof kind;
                  setKind(k);
                  setAccountName(
                    {
                      ahorros: 'Cuenta de ahorros',
                      corriente: 'Cuenta corriente',
                      billetera: 'Billetera',
                      tarjeta_credito: 'Tarjeta de crédito',
                      otra: 'Cuenta',
                    }[k],
                  );
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
              <label htmlFor="mask" className="label">
                Últimos 4 dígitos
              </label>
              <input
                id="mask"
                inputMode="numeric"
                maxLength={4}
                placeholder="Opcional"
                className="field tnum"
                value={mask}
                onChange={(e) => setMask(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
          {kind === 'tarjeta_credito' && (
            <p className="rounded-xl bg-warn-light px-4 py-3 text-[13.5px] text-warn">
              El cupo de tarjeta de crédito no se suma como plata libre, pero sus movimientos nos permiten detectar suscripciones y cobros automáticos.
            </p>
          )}
          {error && <p role="alert" className="text-sm text-neg">{error}</p>}
          <button id="btn-import-account-next" type="submit" className="btn-primary w-full">
            Seguir
          </button>
        </form>
      )}

      {step === 'archivo' && (
        <div className="space-y-4">
          <p className="text-[15px]">
            <span className="font-semibold">{entityName}</span>, {accountName.toLowerCase()}
            {mask ? ` terminada en ${mask}` : ''}.{' '}
            <button
              type="button"
              className="font-semibold text-primary-dark underline"
              onClick={() => {
                setAccountId(null);
                setStep('cuenta');
              }}
            >
              Cambiar
            </button>
          </p>
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line-strong bg-white px-6 py-10 text-center transition-colors hover:border-primary hover:bg-primary-pale/40">
            <FileUp size={32} className="text-primary" aria-hidden="true" />
            <span className="text-[16px] font-semibold">Elige el archivo de movimientos</span>
            <span className="max-w-md text-[13.5px] leading-relaxed text-ink-muted">
              CSV, Excel (.xlsx) o PDF digital. Descárgalo desde la sucursal virtual o la app de tu banco (idealmente de los últimos 2 o 3 meses).
            </span>
            <input
              id="input-statement-file"
              type="file"
              accept=".csv,.xlsx,.pdf,.txt,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
          <div className="rounded-2xl border border-line bg-white px-4 py-3.5 text-[13.5px] text-ink-muted">
            <p className="flex flex-wrap items-center justify-between gap-2">
              <span>¿No tienes el archivo descargado en este momento?</span>
              <button
                id="btn-load-sample-statement"
                type="button"
                onClick={loadSampleStatement}
                className="inline-flex items-center gap-1.5 font-semibold text-primary-dark underline underline-offset-2"
              >
                <Sparkles size={15} aria-hidden="true" /> Probar con un extracto de ejemplo
              </button>
            </p>
          </div>
          {error && <p role="alert" className="text-sm text-neg">{error}</p>}
        </div>
      )}

      {step === 'revisar' && rows && map && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[14px] text-ink-muted">
            <span>
              Archivo: <strong className="text-ink">{fileName}</strong>
            </span>
            <button
              type="button"
              className="font-semibold text-primary-dark underline"
              onClick={() => {
                setRows(null);
                setStep('archivo');
              }}
            >
              Usar otro archivo
            </button>
          </div>

          {parsed && parsed.txs.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5">
              <div className="surface-card px-3.5 py-3">
                <p className="text-[12px] text-ink-faint">Movimientos</p>
                <p className="tnum mt-0.5 font-display text-[22px] font-bold text-ink">{parsed.txs.length}</p>
              </div>
              <div className="surface-card px-3.5 py-3">
                <p className="text-[12px] text-ink-faint">Comercios</p>
                <p className="tnum mt-0.5 font-display text-[22px] font-bold text-primary-dark">
                  {autoClassification.merchantsCount}
                </p>
              </div>
              <div className="surface-card px-3.5 py-3">
                <p className="text-[12px] text-ink-faint">Fijos detectados</p>
                <p className="tnum mt-0.5 font-display text-[22px] font-bold text-ink">
                  {autoClassification.recurringCount}
                </p>
              </div>
            </div>
          )}

          <details open={!parsed?.txs.length} className="surface-card px-4 py-3">
            <summary className="cursor-pointer text-[14.5px] font-semibold">Ajustar columnas del archivo (automático)</summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="hdr" className="mb-1 block text-[13px] font-semibold">
                  Fila de títulos
                </label>
                <select
                  id="hdr"
                  className="field py-2.5 text-[15px]"
                  value={map.headerRow}
                  onChange={(e) => setMap({ ...map, headerRow: Number(e.target.value) })}
                >
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
                <label htmlFor="c-mode" className="mb-1 block text-[13px] font-semibold">
                  Valores
                </label>
                <select
                  id="c-mode"
                  className="field py-2.5 text-[15px]"
                  value={map.amount !== null ? 'uno' : 'dos'}
                  onChange={(e) =>
                    setMap(
                      e.target.value === 'uno'
                        ? { ...map, amount: map.debit ?? 0, debit: null, credit: null }
                        : { ...map, amount: null, debit: map.amount ?? 0, credit: map.amount ?? 0 },
                    )
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
              <div className="surface-card px-4 py-4">
                <p className="text-[15px]">
                  <span className="font-semibold">Vista previa</span> ({shortDate(parsed.from!)} al {shortDate(parsed.to!)})
                  {parsed.skipped > 0 && <span className="text-ink-muted"> · Omitimos {parsed.skipped} filas de encabezado/resumen.</span>}
                </p>
                <ul className="tnum mt-3 divide-y divide-line text-[13.5px]">
                  {parsed.txs.slice(0, 6).map((t, i) => {
                    const m = identifyMerchant(t.description);
                    return (
                      <li key={i} className="flex justify-between gap-3 py-2">
                        <span className="min-w-0 truncate">
                          <span className="text-ink-faint">{shortDate(t.postedOn)}</span> ·{' '}
                          <strong className="font-semibold text-ink">{m.name}</strong>
                        </span>
                        <span className={t.amountMinor < 0 ? 'font-medium text-ink' : 'font-semibold text-primary-dark'}>
                          {cop(t.amountMinor, { sign: true })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {map.amount !== null && (
                  <label className="mt-3 flex items-start gap-2.5 text-[13.5px] text-ink-muted">
                    <input
                      type="checkbox"
                      checked={invert}
                      onChange={(e) => setInvert(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[#0B6B58]"
                    />
                    <span>
                      Las compras salen en positivo (invertir signo).
                      {mostlyPositive && !invert && (
                        <strong className="block text-warn">Casi todos los valores son positivos: revisa esta opción.</strong>
                      )}
                    </span>
                  </label>
                )}
              </div>
              <div className="surface-card p-4">
                <label htmlFor="balance" className="label">
                  ¿Cuánto tienes hoy en esta cuenta?
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">$</span>
                  <input
                    id="balance"
                    inputMode="numeric"
                    className="field tnum pl-8 font-semibold"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    placeholder="1.250.000"
                  />
                </div>
                <p className="mt-1.5 text-[13px] text-ink-faint">
                  {parsed.latestBalanceMinor !== null
                    ? `El extracto cierra el ${shortDate(parsed.to!)} con ${cop(parsed.latestBalanceMinor)}. Si moviste plata después, pon el saldo de hoy.`
                    : 'Míralo en la app de tu banco. Es el punto de partida de tu cifra.'}
                </p>
              </div>
              {manual.length > 0 && !accountId && (
                <fieldset className="surface-card p-4">
                  <legend className="label">¿Esta cuenta reemplaza un saldo que escribiste a mano?</legend>
                  <p className="-mt-0.5 mb-2.5 text-[13px] text-ink-faint">Así no contamos la misma plata dos veces.</p>
                  <div className="space-y-2">
                    {manual.map((m) => (
                      <label
                        key={m.id}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 text-[14.5px] ${
                          replaceId === m.id ? 'border-primary bg-primary-light font-semibold' : 'border-line bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="replace"
                          checked={replaceId === m.id}
                          onChange={() => setReplaceId(m.id)}
                          className="accent-[#0B6B58]"
                        />
                        <span className="min-w-0 flex-1">Sí, reemplaza {m.entityName}</span>
                        {m.balanceMinor !== null && <span className="tnum text-ink-muted">{cop(m.balanceMinor)}</span>}
                      </label>
                    ))}
                    <label
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 text-[14.5px] ${
                        replaceId === '' ? 'border-primary bg-primary-light font-semibold' : 'border-line bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="replace"
                        checked={replaceId === ''}
                        onChange={() => setReplaceId('')}
                        className="accent-[#0B6B58]"
                      />
                      No, es otra cuenta adicional
                    </label>
                  </div>
                </fieldset>
              )}
              {error && <p role="alert" className="text-sm text-neg">{error}</p>}
              <button id="btn-import-save" type="button" disabled={busy} onClick={submit} className="btn-primary w-full">
                {busy ? 'Guardando movimientos...' : `Guardar ${parsed.txs.length} movimientos y calcular mi cifra`}
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
