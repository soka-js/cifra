'use client';

import { AlertTriangle, CheckCircle2, Sparkles, Tag, Zap } from 'lucide-react';
import { useActionState, useState } from 'react';
import { createMerchantOffer, type MerchantActionState } from '@/app/actions/merchant';
import { MoneyInput } from '@/components/ui/money-input';
import { computeRedemptionSplit } from '@/lib/engine/attribution';
import { computeHonestMerchantMargin } from '@/lib/engine/crossref';
import { cop, parsePesosInput } from '@/lib/format';

const INITIAL: MerchantActionState = { status: 'idle' };

const TEMPLATES = [
  {
    id: 'bienvenida-10',
    badge: 'Recomendada · 1ra visita',
    title: '10 % de descuento en tu primera compra',
    description: 'Para vecinos de la zona que aún no conocen nuestro local.',
    kind: 'percent' as const,
    percent: 10,
    fixedPesos: '3000',
    minPesos: '12000',
    newOnly: true,
    isFlash: false,
    startHour: '14',
    endHour: '18',
    stock: '10',
    hours: '',
  },
  {
    id: 'por-horas-cierre',
    badge: '⚡ Por horas · Antes del cierre',
    title: '25 % OFF en horneados y productos frescos de la tarde',
    description: 'Saca el inventario del día antes del cierre con cupos contados.',
    kind: 'percent' as const,
    percent: 25,
    fixedPesos: '3000',
    minPesos: '0',
    newOnly: false,
    isFlash: true,
    startHour: '16',
    endHour: '19',
    stock: '8',
    hours: '4:00 p. m. a 7:00 p. m.',
  },
  {
    id: 'por-horas-tarde',
    badge: '⚡ Por horas · Tarde tranquila',
    title: '20 % de descuento en hora tranquila de la tarde',
    description: 'Llena mesas o mostrador en las horas de menor movimiento.',
    kind: 'percent' as const,
    percent: 20,
    fixedPesos: '3000',
    minPesos: '10000',
    newOnly: false,
    isFlash: true,
    startHour: '14',
    endHour: '17',
    stock: '12',
    hours: '2:00 p. m. a 5:00 p. m.',
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
    isFlash: false,
    startHour: '14',
    endHour: '18',
    stock: '10',
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
  const [isFlash, setIsFlash] = useState(false);
  const [startHour, setStartHour] = useState('15');
  const [endHour, setEndHour] = useState('19');
  const [stockLimit, setStockLimit] = useState('10');
  // El costo de insumos y la comisión de la app los escribe el tendero: no se suponen.
  const [unitCost, setUnitCost] = useState('');
  const [appPct, setAppPct] = useState('');
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
    setIsFlash(tpl.isFlash);
    setStartHour(tpl.startHour);
    setEndHour(tpl.endHour);
    setStockLimit(tpl.stock);
    setNewCustomersOnly(tpl.newOnly);
    setActiveHoursText(tpl.hours);
  }

  // La venta de ejemplo es el ticket típico que escribió el tendero (o la compra mínima, si es mayor).
  const sampleGrossMinor = Math.max(typicalTicketMinor, parsePesosInput(minPurchase) ?? 0);
  const parsedCostMinor = parsePesosInput(unitCost);
  const appPctNum = appPct.trim() === '' ? null : Math.min(60, Math.max(0, Number(appPct.replace(',', '.')) || 0));
  const commissionLabel = `${String(commissionBps / 100).replace('.', ',')} %`;

  const previewSplit = computeRedemptionSplit({
    grossAmountMinor: sampleGrossMinor,
    discountKind,
    discountPercent,
    discountFixedMinor: parsePesosInput(discountFixed) ?? 0,
    maxDiscountMinor: parsePesosInput(maxDiscount) ?? null,
    minPurchaseMinor: parsePesosInput(minPurchase) ?? 0,
    commissionBps,
  });

  const honestMargin =
    parsedCostMinor === null
      ? null
      : computeHonestMerchantMargin({
          salePriceMinor: sampleGrossMinor,
          unitCostMinor: parsedCostMinor,
          discountKind,
          discountPercent,
          discountFixedMinor: parsePesosInput(discountFixed) ?? 0,
          commissionBps,
          deliveryAppCommissionPct: appPctNum ?? 0,
        });

  return (
    <form action={action} className="surface-card space-y-6 p-5 sm:p-7">
      <div>
        <span className="badge-terra">
          <Sparkles size={12} aria-hidden="true" />
          Creador guiado con protección de margen
        </span>
        <h2 className="mt-2 font-display text-[22px] font-bold text-ink">
          Publica una oferta para clientes nuevos o una oferta por horas
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
          Paso 1 · Elige una plantilla o escríbela a tu gusto
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
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
                <p className="mt-1 text-[13px] font-semibold leading-snug text-ink">{tpl.title}</p>
              </button>
            );
          })}
        </div>

        {/* Oferta por horas: ventana horaria y cupos */}
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50/70 p-4">
          <input
            type="checkbox"
            name="isFlash"
            checked={isFlash}
            onChange={(e) => {
              setIsFlash(e.target.checked);
              if (e.target.checked) setNewCustomersOnly(false);
            }}
            className="mt-1 h-5 w-5 rounded border-amber-400 text-terra focus:ring-terra"
          />
          <span className="text-[13.5px] leading-relaxed text-ink-soft">
            <strong className="flex items-center gap-1 font-semibold text-ink">
              <Zap size={15} className="text-amber-600" aria-hidden="true" />
              Que sea una oferta por horas, con cupos contados
            </strong>
            Sale destacada en el mapa del barrio solo en el horario que elijas, y la caja descuenta los cupos sola.
          </span>
        </label>

        {isFlash && (
          <div className="grid gap-3 rounded-2xl border border-amber-200 bg-white p-4 sm:grid-cols-3">
            <div>
              <label htmlFor="startHour" className="label">
                Hora inicio (0–23)
              </label>
              <input
                id="startHour"
                name="startHour"
                type="number"
                min={0}
                max={23}
                value={startHour}
                onChange={(e) => setStartHour(e.target.value)}
                className="field tnum"
              />
            </div>
            <div>
              <label htmlFor="endHour" className="label">
                Hora cierre (0–23)
              </label>
              <input
                id="endHour"
                name="endHour"
                type="number"
                min={0}
                max={23}
                value={endHour}
                onChange={(e) => setEndHour(e.target.value)}
                className="field tnum"
              />
            </div>
            <div>
              <label htmlFor="stockLimit" className="label">
                Cupos disponibles
              </label>
              <input
                id="stockLimit"
                name="stockLimit"
                type="number"
                min={1}
                max={200}
                value={stockLimit}
                onChange={(e) => setStockLimit(e.target.value)}
                className="field tnum"
              />
            </div>
          </div>
        )}

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

      {/* Paso 2 + Calculadora Honesta de Margen Real */}
      <div className="space-y-4 border-t border-line pt-5">
        <p className="text-[14px] font-bold text-ink">
          Paso 2 · Define el beneficio y mira cuánto te queda limpio
        </p>

        <div className="grid gap-4 sm:grid-cols-5">
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
              <option value="fixed">Valor fijo ($)</option>
            </select>
          </div>

          {discountKind === 'percent' ? (
            <div>
              <label htmlFor="discountPercent" className="label">
                Porcentaje
              </label>
              <select
                id="discountPercent"
                name="discountPercent"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="field tnum"
              >
                {[5, 8, 10, 12, 15, 20, 25, 30, 35].map((pct) => (
                  <option key={pct} value={pct}>
                    {pct} %
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="discountFixed" className="label">
                Descuento ($)
              </label>
              <MoneyInput
                id="discountFixed"
                name="discountFixed"
                value={discountFixed}
                onChangeValue={(minor) => setDiscountFixed(String(Math.round(minor / 100)))}
                presets={[2000, 3000, 5000, 10000]}
                placeholder="3.000"
              />
            </div>
          )}

          <div>
            <label htmlFor="minPurchase" className="label">
              Compra mínima ($)
            </label>
            <MoneyInput
              id="minPurchase"
              name="minPurchase"
              value={minPurchase}
              onChangeValue={(minor) => setMinPurchase(String(Math.round(minor / 100)))}
              presets={[10000, 15000, 20000, 30000]}
              placeholder="12.000"
            />
          </div>

          <div>
            <label htmlFor="unitCost" className="label">
              Costo insumos ($)
            </label>
            <MoneyInput
              id="unitCost"
              name="unitCost"
              value={unitCost}
              onChangeValue={(minor) => setUnitCost(minor ? String(Math.round(minor / 100)) : '')}
              placeholder="Por venta"
            />
          </div>

          <div>
            <label htmlFor="appPct" className="label">
              Comisión de tu app de domicilios (%) <span className="font-normal text-ink-faint">opc.</span>
            </label>
            <input
              id="appPct"
              type="text"
              inputMode="decimal"
              value={appPct}
              onChange={(e) => setAppPct(e.target.value)}
              placeholder="Si vendes por app"
              className="field tnum"
            />
          </div>
        </div>

        {/* Cuánto le queda al tendero, con sus propios números: ticket, costo de insumos y, si la escribe, la comisión de su app. */}
        <div
          className={`rounded-2xl border p-4 ${
            honestMargin?.isLosingMoney ? 'border-neg/35 bg-neg-light/70' : 'border-primary/25 bg-primary-pale/70'
          }`}
        >
          <p className="text-[12.5px] font-bold uppercase tracking-wider text-primary-dark">
            En una venta de {cop(sampleGrossMinor)}
            {parsedCostMinor !== null ? `, con ${cop(parsedCostMinor)} de insumos` : ''}
          </p>

          <div className="tnum mt-3 grid gap-2.5 text-[13px] sm:grid-cols-3">
            {honestMargin && appPctNum !== null && (
              <div className="rounded-xl border border-line bg-white p-3">
                <p className="font-semibold text-ink-muted">Por tu app de domicilios ({String(appPctNum).replace('.', ',')} %)</p>
                <p className="mt-1 font-display text-[20px] font-extrabold text-ink">{cop(honestMargin.deliveryAppProfitMinor)}</p>
                <p className="text-[11.5px] text-ink-faint">Te queda limpio después de la comisión de la app</p>
              </div>
            )}

            <div className="rounded-xl border border-primary/40 bg-white p-3 ring-1 ring-primary/20">
              <p className="font-semibold text-primary-dark">Con la oferta, primera visita</p>
              {honestMargin ? (
                <p
                  className={`mt-1 font-display text-[20px] font-extrabold ${
                    honestMargin.cifraFirstVisitProfitMinor < 0 ? 'text-neg' : 'text-primary-dark'
                  }`}
                >
                  {cop(honestMargin.cifraFirstVisitProfitMinor)}
                </p>
              ) : (
                <p className="mt-1 font-display text-[20px] font-extrabold text-primary-dark">
                  {cop(previewSplit.netPaidByUserMinor - previewSplit.cifraCommissionMinor)}
                </p>
              )}
              <p className="text-[11.5px] text-ink-muted">
                Cobras {cop(previewSplit.netPaidByUserMinor)} · Comisión {commissionLabel} ({cop(previewSplit.cifraCommissionMinor)})
                {honestMargin ? '' : ' · Te queda en caja'}
              </p>
            </div>

            {honestMargin && (
              <div className="rounded-xl border border-line bg-white p-3">
                <p className="font-semibold text-ink">Cuando el vecino vuelve</p>
                <p className="mt-1 font-display text-[20px] font-extrabold text-primary-dark">
                  {cop(honestMargin.repeatOrganicProfitMinor)}
                </p>
                <p className="text-[11.5px] text-primary-dark">Sin descuento y sin comisión</p>
              </div>
            )}
          </div>

          {!honestMargin ? (
            <p className="mt-2.5 text-[12.5px] text-ink-soft">
              Escribe cuánto te cuestan los insumos de una venta y te decimos cuánto te queda limpio y si el descuento te deja perdiendo.
            </p>
          ) : honestMargin.isLosingMoney ? (
            <p className="mt-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-neg-dark">
              <AlertTriangle size={15} aria-hidden="true" />
              Cuidado: con este descuento no cubres el costo de tus insumos. Baja el porcentaje antes de publicar.
            </p>
          ) : appPctNum !== null && honestMargin.advantageVsDeliveryMinor >= 0 ? (
            <p className="mt-2.5 text-[12.5px] text-ink-soft">
              Aun dando el descuento, te quedan {cop(honestMargin.advantageVsDeliveryMinor)} más limpios que por tu app, y el cliente conoce tu local en persona.
            </p>
          ) : (
            <p className="mt-2.5 text-[12.5px] text-ink-soft">
              Pones {cop(previewSplit.totalMerchantCacMinor)} una sola vez para traer al vecino; desde su segunda compra te queda todo (
              {cop(honestMargin.repeatOrganicProfitMinor)} limpios).
            </p>
          )}
        </div>
      </div>

      {/* Paso 3: que la oferta no se coma la clientela que ya tiene */}
      <div className="space-y-4 border-t border-line pt-5">
        <p className="text-[14px] font-bold text-ink">
          Paso 3 · Protege tu clientela actual y pon límites claros
        </p>

        {!isFlash && (
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
                Solo para clientes nuevos (recomendado en campañas permanentes)
              </strong>
              Solo ven tu oferta vecinos que no registran compras recientes en tu negocio.
            </span>
          </label>
        )}

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
              <option value="7">7 días</option>
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
              Horario visible (opc.)
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

      <button type="submit" disabled={pending || Boolean(honestMargin?.isLosingMoney)} className="btn-terra w-full sm:w-auto">
        <Tag size={17} aria-hidden="true" />
        {pending ? 'Publicando oferta...' : isFlash ? 'Encender oferta por horas' : 'Publicar oferta ahora'}
        <CheckCircle2 size={17} aria-hidden="true" />
      </button>
    </form>
  );
}
