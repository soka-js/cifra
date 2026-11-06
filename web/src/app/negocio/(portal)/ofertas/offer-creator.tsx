'use client';

import { CheckCircle2, Sparkles, Tag } from 'lucide-react';
import { useActionState, useState } from 'react';
import { createMerchantOffer, type MerchantActionState } from '@/app/actions/merchant';
import { computeRedemptionSplit } from '@/lib/engine/attribution';
import { cop, parsePesosInput } from '@/lib/format';

const INITIAL: MerchantActionState = { status: 'idle' };

const TEMPLATES = [
  {
    id: 'bienvenida-10',
    badge: 'Recomendada · G.10',
    title: '10 % de descuento en tu primera compra',
    description: 'Para vecinos de la zona que aún no conocen nuestro local.',
    kind: 'percent' as const,
    percent: 10,
    fixedPesos: '3000',
    minPesos: '12000',
    newOnly: true,
    hours: '',
  },
  {
    id: 'tarde-15',
    badge: 'Horas tranquilas',
    title: '15 % de descuento en tardes (2 p. m. a 5 p. m.)',
    description: 'Ideal para mover el local en las horas de menor tráfico.',
    kind: 'percent' as const,
    percent: 15,
    fixedPesos: '3000',
    minPesos: '15000',
    newOnly: true,
    hours: 'Lun a Vie 2:00 p. m. – 5:00 p. m.',
  },
  {
    id: 'bono-fijo',
    badge: 'Monto fijo en pesos',
    title: '$3.000 de descuento por compras desde $20.000',
    description: 'Descuento fijo fácil de entender en mostrador.',
    kind: 'fixed' as const,
    percent: 10,
    fixedPesos: '3000',
    minPesos: '20000',
    newOnly: true,
    hours: '',
  },
];

export function OfferCreator({
  typicalTicketMinor,
  commissionBps,
}: {
  typicalTicketMinor: number;
  commissionBps: number;
}) {
  const [state, action, pending] = useActionState(createMerchantOffer, INITIAL);
  const [selectedTpl, setSelectedTpl] = useState(TEMPLATES[0]!.id);
  const [title, setTitle] = useState(TEMPLATES[0]!.title);
  const [description, setDescription] = useState(TEMPLATES[0]!.description);
  const [discountKind, setDiscountKind] = useState<'percent' | 'fixed'>('percent');
  const [discountPercent, setDiscountPercent] = useState(10);
  const [discountFixed, setDiscountFixed] = useState('3000');
  const [minPurchase, setMinPurchase] = useState('12000');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [newCustomersOnly, setNewCustomersOnly] = useState(true);
  const [monthlyCap, setMonthlyCap] = useState('40');
  const [durationDays, setDurationDays] = useState('30');
  const [activeHoursText, setActiveHoursText] = useState('');

  function applyTemplate(tpl: (typeof TEMPLATES)[number]) {
    setSelectedTpl(tpl.id);
    setTitle(tpl.title);
    setDescription(tpl.description);
    setDiscountKind(tpl.kind);
    setDiscountPercent(tpl.percent);
    setDiscountFixed(tpl.fixedPesos);
    setMinPurchase(tpl.minPesos);
    setNewCustomersOnly(tpl.newOnly);
    setActiveHoursText(tpl.hours);
  }

  const sampleGrossMinor = Math.max(
    typicalTicketMinor || 2_000_000,
    parsePesosInput(minPurchase) ?? 0,
  );

  const previewSplit = computeRedemptionSplit({
    grossAmountMinor: sampleGrossMinor,
    discountKind,
    discountPercent,
    discountFixedMinor: parsePesosInput(discountFixed) ?? 300_000,
    maxDiscountMinor: parsePesosInput(maxDiscount) ?? null,
    minPurchaseMinor: parsePesosInput(minPurchase) ?? 0,
    commissionBps,
  });

  return (
    <form action={action} className="surface-card space-y-6 p-5 sm:p-7">
      <div>
        <span className="badge-terra">
          <Sparkles size={12} aria-hidden="true" />
          Creador guiado en 3 pasos
        </span>
        <h2 className="mt-2 font-display text-[22px] font-bold text-ink">
          Publica una nueva oferta para vecinos de tu barrio
        </h2>
      </div>

      {state.status === 'error' && (
        <div role="alert" className="rounded-xl border border-neg/25 bg-neg-light px-4 py-3 text-[14px] text-neg">
          {state.message}
        </div>
      )}

      {/* Paso 1 */}
      <div className="space-y-3">
        <p className="text-[14px] font-bold text-ink">
          Paso 1 · Elige una idea base o escríbela a tu gusto
        </p>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {TEMPLATES.map((tpl) => {
            const active = selectedTpl === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className={`rounded-2xl border p-3.5 text-left transition ${
                  active
                    ? 'border-terra bg-terra-pale/70 shadow-sm'
                    : 'border-line bg-paper/60 hover:border-line-strong'
                }`}
              >
                <span className="text-[11px] font-bold uppercase tracking-wider text-terra-dark">
                  {tpl.badge}
                </span>
                <p className="mt-1 text-[13.5px] font-semibold leading-snug text-ink">{tpl.title}</p>
              </button>
            );
          })}
        </div>

        <div className="grid gap-3.5 pt-1 sm:grid-cols-2">
          <div>
            <label htmlFor="offer-title" className="label">
              Título que verán los vecinos
            </label>
            <input
              id="offer-title"
              name="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="offer-desc" className="label">
              Detalle corto (opcional)
            </label>
            <input
              id="offer-desc"
              name="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Aplica en pan de masa madre y cafés"
              className="field"
            />
          </div>
        </div>
      </div>

      {/* Paso 2 + Calculadora transparente en vivo */}
      <div className="space-y-4 border-t border-line pt-5">
        <p className="text-[14px] font-bold text-ink">
          Paso 2 · Define el beneficio y revisa tus cuentas en pesos
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="discountKind" className="label">
              Tipo de descuento
            </label>
            <select
              id="discountKind"
              name="discountKind"
              value={discountKind}
              onChange={(e) => setDiscountKind(e.target.value === 'fixed' ? 'fixed' : 'percent')}
              className="field"
            >
              <option value="percent">Porcentaje (%)</option>
              <option value="fixed">Valor fijo en pesos ($)</option>
            </select>
          </div>

          {discountKind === 'percent' ? (
            <div>
              <label htmlFor="discountPercent" className="label">
                Porcentaje de descuento
              </label>
              <select
                id="discountPercent"
                name="discountPercent"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="field tnum"
              >
                {[5, 8, 10, 12, 15, 20, 25].map((pct) => (
                  <option key={pct} value={pct}>
                    {pct} %
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="discountFixed" className="label">
                Descuento en pesos ($)
              </label>
              <input
                id="discountFixed"
                name="discountFixed"
                type="text"
                inputMode="numeric"
                value={discountFixed}
                onChange={(e) => setDiscountFixed(e.target.value)}
                className="field tnum"
              />
            </div>
          )}

          <div>
            <label htmlFor="minPurchase" className="label">
              Compra mínima para aplicar ($)
            </label>
            <input
              id="minPurchase"
              name="minPurchase"
              type="text"
              inputMode="numeric"
              value={minPurchase}
              onChange={(e) => setMinPurchase(e.target.value)}
              className="field tnum"
            />
          </div>
        </div>

        {/* Simulación exacta G.10 */}
        <div className="rounded-2xl border border-primary/25 bg-primary-pale/70 p-4">
          <p className="text-[12.5px] font-bold uppercase tracking-wider text-primary-dark">
            Así te salen las cuentas en una venta de {cop(sampleGrossMinor)}
          </p>
          <div className="mt-2.5 grid gap-2 text-[13.5px] sm:grid-cols-4">
            <div className="rounded-xl bg-white p-3">
              <p className="text-[11.5px] text-ink-muted">Valor del pedido</p>
              <p className="tnum mt-0.5 text-[16px] font-bold text-ink">{cop(previewSplit.grossAmountMinor)}</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-[11.5px] text-ink-muted">El cliente te paga</p>
              <p className="tnum mt-0.5 text-[16px] font-bold text-ink">{cop(previewSplit.netPaidByUserMinor)}</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-[11.5px] text-ink-muted">Comisión CIFRA (5 %)</p>
              <p className="tnum mt-0.5 text-[16px] font-bold text-ink">{cop(previewSplit.cifraCommissionMinor)}</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-[11.5px] text-primary-dark">Te quedan libres</p>
              <p className="tnum mt-0.5 text-[16px] font-bold text-primary-dark">
                {cop(previewSplit.merchantNetKeepMinor)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[12.5px] text-ink-soft">
            Tu inversión total por traer ese cliente (descuento + comisión) es{' '}
            <strong className="tnum text-ink">{cop(previewSplit.totalMerchantCacMinor)}</strong> (
            {previewSplit.effectiveCacPercent.toString().replace('.', ',')} % del pedido), y solo ocurre cuando ya cobraste en tu caja.
          </p>
        </div>
      </div>

      {/* Paso 3: Controles anti-canibalización */}
      <div className="space-y-4 border-t border-line pt-5">
        <p className="text-[14px] font-bold text-ink">
          Paso 3 · Protege tu clientela actual y pon límites claros
        </p>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-paper p-4">
          <input
            type="checkbox"
            name="newCustomersOnly"
            checked={newCustomersOnly}
            onChange={(e) => setNewCustomersOnly(e.target.checked)}
            className="mt-1 h-5 w-5 rounded border-line-strong text-primary focus:ring-primary"
          />
          <span className="text-[13.5px] leading-relaxed text-ink-soft">
            <strong className="block font-semibold text-ink">
              Solo para clientes nuevos (recomendado)
            </strong>
            Solo ven tu oferta vecinos que no registran compras recientes en tu negocio. Así no regalas margen a quienes ya te compran siempre.
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label htmlFor="monthlyCap" className="label">
              Cupo máximo al mes
            </label>
            <input
              id="monthlyCap"
              name="monthlyCap"
              type="number"
              min={1}
              max={500}
              value={monthlyCap}
              onChange={(e) => setMonthlyCap(e.target.value)}
              placeholder="Ej. 40"
              className="field tnum"
            />
          </div>

          <div>
            <label htmlFor="durationDays" className="label">
              Vigencia (días)
            </label>
            <select
              id="durationDays"
              name="durationDays"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className="field tnum"
            >
              <option value="15">15 días</option>
              <option value="30">30 días</option>
              <option value="60">60 días</option>
              <option value="90">90 días</option>
            </select>
          </div>

          <div>
            <label htmlFor="maxDiscount" className="label">
              Tope descuento ($) opc.
            </label>
            <input
              id="maxDiscount"
              name="maxDiscount"
              type="text"
              inputMode="numeric"
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              placeholder="Sin tope"
              className="field tnum"
            />
          </div>

          <div>
            <label htmlFor="activeHoursText" className="label">
              Horario específico (opc.)
            </label>
            <input
              id="activeHoursText"
              name="activeHoursText"
              type="text"
              value={activeHoursText}
              onChange={(e) => setActiveHoursText(e.target.value)}
              placeholder="Todo el horario"
              className="field"
            />
          </div>
        </div>
      </div>

      <button type="submit" disabled={pending} className="btn-terra w-full sm:w-auto">
        <Tag size={17} aria-hidden="true" />
        {pending ? 'Publicando oferta...' : 'Publicar oferta ahora'}
        <CheckCircle2 size={17} aria-hidden="true" />
      </button>
    </form>
  );
}
