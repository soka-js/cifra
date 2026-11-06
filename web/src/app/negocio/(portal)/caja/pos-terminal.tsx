'use client';

import {
  Camera,
  CheckCircle2,
  QrCode,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import {
  completeRedemption,
  lookupOfferCode,
  type CodeLookupResponse,
  type PosRedeemState,
} from '@/app/actions/merchant';
import { MoneyInput } from '@/components/ui/money-input';
import { computeRedemptionSplit } from '@/lib/engine/attribution';
import { cop, parsePesosInput } from '@/lib/format';

const INITIAL_REDEEM: PosRedeemState = { status: 'idle' };
const QUICK_AMOUNTS = [10_000, 15_000, 20_000, 30_000, 50_000];

export function PosTerminal({ defaultTicketMinor }: { defaultTicketMinor: number }) {
  const [codeInput, setCodeInput] = useState('');
  const [lookup, setLookup] = useState<CodeLookupResponse | null>(null);
  const [lookupPending, startLookup] = useTransition();
  const [grossText, setGrossText] = useState(String(Math.round(defaultTicketMinor / 100)));
  const [redeemState, redeemAction, redeemPending] = useActionState(completeRedemption, INITIAL_REDEEM);

  // Escáner de cámara opcional con BarcodeDetector estándar si el navegador lo soporta
  const [scanning, setScanning] = useState(false);
  const [cameraMsg, setCameraMsg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }

  useEffect(() => {
    return () => stopCamera();
  }, []);

  async function startCameraScan() {
    setCameraMsg(null);
    const DetectorCtor = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (el: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
    if (!DetectorCtor || !navigator.mediaDevices?.getUserMedia) {
      setCameraMsg('En este navegador es más rápido escribir las 6 letras grandes que aparecen debajo del QR del cliente.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setScanning(true);

      setTimeout(async () => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new DetectorCtor({ formats: ['qr_code'] });

        const loop = async () => {
          if (!streamRef.current || !videoRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            const raw = barcodes[0]?.rawValue;
            if (raw) {
              stopCamera();
              handleCodeVerify(raw);
              return;
            }
          } catch {
            // Seguir intentando siguiente cuadro
          }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      }, 150);
    } catch {
      setCameraMsg('No se pudo abrir la cámara. Escribe las 6 letras del código del cliente.');
      stopCamera();
    }
  }

  function handleCodeVerify(rawOverride?: string) {
    const target = rawOverride ?? codeInput;
    startLookup(async () => {
      const res = await lookupOfferCode(target);
      setLookup(res);
      if (res.ok && res.code) {
        setCodeInput(res.code);
        if (res.typicalTicketMinor) {
          setGrossText(String(Math.round(res.typicalTicketMinor / 100)));
        }
      }
    });
  }

  function handleResetForNext() {
    setCodeInput('');
    setLookup(null);
    window.location.reload();
  }

  // Pantalla de éxito rotunda después de registrar la venta
  if (redeemState.status === 'ok') {
    return (
      <div className="ticket-surface space-y-5 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary-dark">
            <CheckCircle2 size={26} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[12.5px] font-bold uppercase tracking-wider text-primary-dark">
              Venta registrada en Caja
            </p>
            <h2 className="font-display text-[24px] font-bold text-ink">
              ¡Listo! Descuento aplicado a {redeemState.customerFirstName}
            </h2>
          </div>
        </div>

        <div className="rounded-2xl bg-primary-pale p-5 text-center">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-primary-dark">
            Total que cobraste al cliente
          </p>
          <p className="tnum mt-1 font-display text-[40px] font-bold leading-none text-primary-dark">
            {cop(redeemState.netPaidMinor)}
          </p>
          <p className="mt-2 text-[13.5px] text-ink-soft">
            Pedido original {cop(redeemState.grossMinor)} − Descuento {cop(redeemState.discountMinor)}
          </p>
        </div>

        <dl className="space-y-2 rounded-2xl border border-line bg-paper p-4 text-[14px]">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Comisión CIFRA (5 % sobre lo cobrado):</dt>
            <dd className="tnum font-semibold text-ink">{cop(redeemState.commissionMinor)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2">
            <dt className="font-semibold text-ink">Plata libre que te queda de esta venta:</dt>
            <dd className="tnum font-bold text-primary-dark">{cop(redeemState.merchantKeepMinor)}</dd>
          </div>
        </dl>

        <button type="button" onClick={handleResetForNext} className="btn-terra w-full text-[16px]">
          <RotateCcw size={18} aria-hidden="true" />
          Atender siguiente cliente
        </button>
      </div>
    );
  }

  const parsedGrossMinor = parsePesosInput(grossText) ?? 0;
  const liveSplit =
    lookup?.ok && lookup.discountKind
      ? computeRedemptionSplit({
          grossAmountMinor: parsedGrossMinor,
          discountKind: lookup.discountKind,
          discountPercent: lookup.discountPercent,
          discountFixedMinor: lookup.discountFixedMinor,
          maxDiscountMinor: lookup.maxDiscountMinor,
          minPurchaseMinor: lookup.minPurchaseMinor,
          commissionBps: lookup.commissionBps ?? 500,
        })
      : null;

  return (
    <div className="space-y-5">
      {/* Paso 1: Ingresar o escanear código de 6 letras */}
      <div className="surface-card space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="pos-code" className="text-[15px] font-bold text-ink">
            1. Escribe las 6 letras del código del cliente
          </label>
          <button
            type="button"
            onClick={scanning ? stopCamera : startCameraScan}
            className="btn-sm border border-line bg-paper text-ink hover:bg-paper-deep"
          >
            {scanning ? <X size={15} aria-hidden="true" /> : <Camera size={15} aria-hidden="true" />}
            {scanning ? 'Cerrar cámara' : 'Escanear QR'}
          </button>
        </div>

        {scanning && (
          <div className="overflow-hidden rounded-2xl border border-line bg-ink">
            <video ref={videoRef} className="h-56 w-full object-cover" playsInline muted />
          </div>
        )}

        {cameraMsg && (
          <p className="rounded-xl bg-paper px-3.5 py-2.5 text-[13px] text-ink-soft">{cameraMsg}</p>
        )}

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <input
            id="pos-code"
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCodeVerify();
              }
            }}
            maxLength={40}
            placeholder="EJ: 7K9M4P"
            autoComplete="off"
            className="field tnum text-center font-mono text-[26px] font-bold uppercase tracking-[0.22em] sm:flex-1"
          />
          <button
            type="button"
            disabled={lookupPending || codeInput.trim().length < 5}
            onClick={() => handleCodeVerify()}
            className="btn-ink shrink-0 px-6 text-[16px]"
          >
            <Search size={18} aria-hidden="true" />
            {lookupPending ? 'Buscando...' : 'Verificar código'}
          </button>
        </div>

        {lookup && !lookup.ok && (
          <div role="alert" className="rounded-xl border border-neg/25 bg-neg-light px-4 py-3 text-[14px] font-medium text-neg">
            {lookup.error}
          </div>
        )}
      </div>

      {/* Paso 2: Digitar valor del pedido y confirmar cobro */}
      {lookup?.ok && lookup.codeId && (
        <form action={redeemAction} className="ticket-surface space-y-5 p-5 sm:p-6">
          <input type="hidden" name="codeId" value={lookup.codeId} />

          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge-terra">
                  <QrCode size={12} aria-hidden="true" />
                  Código válido: {lookup.code}
                </span>
                {lookup.wasNewCustomer && (
                  <span className="badge-primary">
                    <Sparkles size={11} aria-hidden="true" />
                    Cliente nuevo verificado
                  </span>
                )}
              </div>
              <h2 className="mt-1.5 font-display text-[21px] font-bold text-ink">
                {lookup.customerFirstName} · {lookup.offerTitle}
              </h2>
              {lookup.minPurchaseMinor && lookup.minPurchaseMinor > 0 ? (
                <p className="mt-0.5 text-[13px] text-ink-muted">
                  Aplica para pedidos desde {cop(lookup.minPurchaseMinor)}
                </p>
              ) : null}
            </div>
          </div>

          {redeemState.status === 'error' && (
            <div role="alert" className="rounded-xl border border-neg/25 bg-neg-light px-4 py-3 text-[14px] text-neg">
              {redeemState.message}
            </div>
          )}

          <div>
            <label htmlFor="grossAmount" className="label text-[15px]">
              2. ¿Cuánto vale el pedido completo antes del descuento? ($)
            </label>
            <MoneyInput
              id="grossAmount"
              name="grossAmount"
              value={grossText}
              onChangeValue={(minor) => setGrossText(String(Math.round(minor / 100)))}
              presets={[10000, 15000, 20000, 30000, 50000]}
              className="py-3 pl-9 font-display text-[26px] font-bold"
            />
          </div>

          {liveSplit && (
            <div className="space-y-3 rounded-2xl bg-paper p-4">
              {!liveSplit.eligibleByAmount ? (
                <p className="text-[14px] font-medium text-warn">
                  El pedido debe ser de al menos {cop(lookup.minPurchaseMinor ?? 0)} para aplicar esta oferta.
                </p>
              ) : (
                <>
                  <div className="rounded-xl bg-white p-4 text-center shadow-sm">
                    <p className="text-[12px] font-bold uppercase tracking-wider text-terra-dark">
                      Cóbrale ahora al cliente en efectivo, Nequi, Bre-B o datáfono
                    </p>
                    <p className="tnum mt-1 font-display text-[36px] font-bold leading-none text-ink">
                      {cop(liveSplit.netPaidByUserMinor)}
                    </p>
                    <p className="mt-1.5 text-[13px] text-ink-muted">
                      (Pedido {cop(liveSplit.grossAmountMinor)} menos {cop(liveSplit.discountMinor)} de descuento)
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[13px] text-ink-soft">
                    <span>
                      Comisión CIFRA (5 % a fin de mes):{' '}
                      <strong className="tnum text-ink">{cop(liveSplit.cifraCommissionMinor)}</strong>
                    </span>
                    <span>
                      Te quedan libres:{' '}
                      <strong className="tnum text-primary-dark">{cop(liveSplit.merchantNetKeepMinor)}</strong>
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={redeemPending || !liveSplit?.eligibleByAmount}
            className="btn-terra w-full text-[16px]"
          >
            <CheckCircle2 size={19} aria-hidden="true" />
            {redeemPending ? 'Registrando venta...' : 'Confirmar venta y aplicar descuento'}
          </button>
        </form>
      )}
    </div>
  );
}
