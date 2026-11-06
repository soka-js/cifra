'use client';

import { CheckCircle2, MessageSquareText, Plus, ReceiptText, Smartphone, Sparkles, X } from 'lucide-react';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { captureQuickMovementsAction, type V3ActionState } from '@/app/actions/v3';
import { CATEGORY_LABEL } from '@/lib/engine/merchant';
import { parseChatExpenses, parseColombianBankAlert } from '@/lib/engine/quick-capture';
import { cop } from '@/lib/format';

interface QuickCaptureModalProps {
  accounts: Array<{ id: string; name: string; balanceMinor: number | null }>;
  todayIso: string;
  currentHour: number;
  buttonLabel?: string;
  buttonClassName?: string;
}

const SAMPLE_BANCOLOMBIA =
  'Bancolombia le informa Compra por $24.900,00 en JUAN VALDEZ CHAPINERO 15:20. T.Deb *4821.';
const SAMPLE_NEQUI_BREB =
  'Nequi: Pagaste $18.500,00 en CORRIENTAZO DONDE MARIA con llave Bre-B a las 13:10.';
const SAMPLE_CHAT = 'almuerzo 18k, uber 12500 y panadería 7.500';

const INITIAL_STATE: V3ActionState = { status: 'idle' };

export function QuickCaptureModal({
  accounts,
  todayIso,
  currentHour,
  buttonLabel = 'Anotar gasto o pegar SMS (3 seg)',
  buttonClassName = 'btn-ink w-full sm:w-auto',
}: QuickCaptureModalProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'rapido' | 'sms_banco' | 'comprobante'>('rapido');
  const [rawText, setRawText] = useState('');
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? '');
  const [adjustBalance, setAdjustBalance] = useState(true);
  const [state, formAction, pending] = useActionState(captureQuickMovementsAction, INITIAL_STATE);

  useEffect(() => {
    if (state.status === 'ok') {
      setRawText('');
      const timer = setTimeout(() => setOpen(false), 1400);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state]);

  const preview = useMemo(() => {
    if (rawText.trim().length < 3) return [];
    return mode === 'rapido'
      ? parseChatExpenses(rawText, todayIso, currentHour)
      : parseColombianBankAlert(rawText, todayIso, currentHour, mode);
  }, [rawText, mode, todayIso, currentHour]);

  return (
    <>
      <button
        id="btn-open-quick-capture"
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName}
      >
        <Plus size={17} aria-hidden="true" />
        <span>{buttonLabel}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-capture-title"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-line bg-paper p-5 shadow-2xl sm:rounded-3xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="badge-primary">Sin pedirte claves bancarias</span>
                <h2
                  id="quick-capture-title"
                  className="mt-2 font-display text-[23px] font-bold leading-tight text-ink"
                >
                  Actualiza tu día en 3 segundos
                </h2>
                <p className="mt-1 text-[13.5px] text-ink-muted">
                  Escribe como hablas o pega la notificación de Bancolombia, Nequi, Bre-B, Daviplata o Nu.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-line bg-white p-2 text-ink-muted hover:text-ink"
                aria-label="Cerrar"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Pestañas de modo */}
            <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-2xl border border-line bg-white p-1">
              <button
                type="button"
                onClick={() => setMode('rapido')}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[12.5px] font-semibold transition-colors ${
                  mode === 'rapido' ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <MessageSquareText size={14} aria-hidden="true" />
                Frase rápida
              </button>
              <button
                type="button"
                onClick={() => setMode('sms_banco')}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[12.5px] font-semibold transition-colors ${
                  mode === 'sms_banco' ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Smartphone size={14} aria-hidden="true" />
                Pegar SMS banco
              </button>
              <button
                type="button"
                onClick={() => setMode('comprobante')}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[12.5px] font-semibold transition-colors ${
                  mode === 'comprobante' ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <ReceiptText size={14} aria-hidden="true" />
                Comprobante
              </button>
            </div>

            <form action={formAction} className="mt-4 space-y-4">
              <input type="hidden" name="mode" value={mode} />
              <input type="hidden" name="adjustBalance" value={adjustBalance ? 'on' : 'off'} />

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="quick-raw-text" className="label mb-0">
                    {mode === 'rapido'
                      ? '¿Qué gastaste o recibiste hoy?'
                      : mode === 'sms_banco'
                        ? 'Pega uno o varios SMS / notificaciones del banco'
                        : 'Pega el texto de tu comprobante Nequi / Bre-B / PSE'}
                  </label>
                </div>

                <textarea
                  id="quick-raw-text"
                  name="rawText"
                  rows={3}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={
                    mode === 'rapido'
                      ? 'Ej.: almuerzo 18k, uber 14500 y café 6.500'
                      : mode === 'sms_banco'
                        ? 'Ej.: Bancolombia le informa Compra por $24.900,00 en...'
                        : 'Ej.: Comprobante Nequi · Para: Fruver El Parque · Valor: $32.000'
                  }
                  className="field mt-1.5 resize-none text-[15px]"
                />

                {/* Botones de ejemplo en 1 toque */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11.5px] text-ink-faint">Ejemplos en 1 toque:</span>
                  {mode === 'rapido' ? (
                    <button
                      type="button"
                      onClick={() => setRawText(SAMPLE_CHAT)}
                      className="rounded-full border border-line bg-white px-2.5 py-0.5 text-[11.5px] font-medium text-ink-soft hover:text-ink"
                    >
                      «{SAMPLE_CHAT}»
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setRawText(SAMPLE_BANCOLOMBIA)}
                        className="rounded-full border border-line bg-white px-2.5 py-0.5 text-[11.5px] font-medium text-ink-soft hover:text-ink"
                      >
                        SMS Bancolombia
                      </button>
                      <button
                        type="button"
                        onClick={() => setRawText(SAMPLE_NEQUI_BREB)}
                        className="rounded-full border border-line bg-white px-2.5 py-0.5 text-[11.5px] font-medium text-ink-soft hover:text-ink"
                      >
                        Alerta Nequi / Bre-B
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Vista previa instantánea en vivo */}
              {preview.length > 0 && (
                <div className="rounded-2xl border border-primary/25 bg-white p-3.5">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-primary-dark">
                    <Sparkles size={13} aria-hidden="true" />
                    Vista previa detectada ({preview.length})
                  </p>
                  <ul className="tnum mt-2 divide-y divide-line text-[13.5px]">
                    {preview.map((item, idx) => (
                      <li key={idx} className="flex items-center justify-between gap-2 py-1.5">
                        <div className="min-w-0">
                          <span className="font-semibold text-ink">{item.merchantName}</span>
                          <span className="ml-2 rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                            {CATEGORY_LABEL[item.category]}
                          </span>
                          {item.sourceBank && (
                            <span className="ml-1.5 text-[11px] text-ink-faint">· {item.sourceBank}</span>
                          )}
                        </div>
                        <span
                          className={`shrink-0 font-bold ${
                            item.amountMinor < 0 ? 'text-ink' : 'text-primary-dark'
                          }`}
                        >
                          {item.amountMinor < 0
                            ? `-${cop(Math.abs(item.amountMinor))}`
                            : `+${cop(item.amountMinor)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cuenta y ajuste automático de saldo */}
              <div className="grid gap-3 rounded-2xl border border-line bg-white p-3.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="quick-account" className="block text-[12px] font-semibold text-ink-muted">
                    Cuenta o billetera
                  </label>
                  {accounts.length > 0 ? (
                    <select
                      id="quick-account"
                      name="accountId"
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className="field mt-1 py-2 text-[13.5px]"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} {a.balanceMinor !== null ? `(${cop(a.balanceMinor)})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1 text-[12.5px] text-ink-soft">
                      Se creará «Billetera / Efectivo diario» automáticamente.
                    </p>
                  )}
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-soft sm:pt-4">
                  <input
                    type="checkbox"
                    checked={adjustBalance}
                    onChange={(e) => setAdjustBalance(e.target.checked)}
                    className="h-4 w-4 rounded border-line-strong text-primary focus:ring-primary"
                  />
                  <span>Descontar del saldo líquido de hoy al guardar</span>
                </label>
              </div>

              {state.status === 'error' && (
                <p className="rounded-xl bg-neg-light px-3.5 py-2.5 text-[13.5px] font-medium text-neg-dark">
                  {state.message}
                </p>
              )}
              {state.status === 'ok' && (
                <p className="flex items-center gap-2 rounded-xl bg-primary-light px-3.5 py-2.5 text-[13.5px] font-semibold text-primary-dark">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  {state.message}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
                  Cancelar
                </button>
                <button id="btn-submit-quick-capture" type="submit" disabled={pending} className="btn-primary">
                  {pending ? 'Guardando…' : 'Guardar y actualizar mi tope de hoy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
