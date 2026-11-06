'use client';

import { BellOff, BellRing, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushToggleCard({
  vapidPublicKey,
  initialSubscribed,
}: {
  vapidPublicKey?: string;
  initialSubscribed: boolean;
}) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function enablePush() {
    setMessage(null);
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setMessage('Este navegador no admite avisos push directos; seguirás viéndolos aquí en tu buzón.');
      return;
    }
    if (!vapidPublicKey) {
      setMessage('Los avisos dentro de CIFRA están activos. Para alertas push del sistema configura las llaves VAPID del servidor.');
      return;
    }

    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setMessage('Permiso denegado en el navegador. Puedes habilitarlo cuando quieras en la barra de direcciones.');
        setBusy(false);
        return;
      }

      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });

      if (res.ok) {
        setSubscribed(true);
        setMessage('¡Listo! Solo recibirás avisos cuando haya algo accionable para tu bolsillo.');
      } else {
        setMessage('No pudimos guardar la suscripción. Intenta nuevamente.');
      }
    } catch {
      setMessage('No se pudo activar en este dispositivo.');
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setMessage(null);
    try {
      await fetch('/api/push/subscribe', { method: 'DELETE' });
      setSubscribed(false);
      setMessage('Avisos push desactivados en este navegador.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface-card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
      <div className="max-w-xl">
        <p className="flex items-center gap-2 text-[14.5px] font-bold text-ink">
          <BellRing size={16} className="text-primary-dark" aria-hidden="true" />
          Avisos inteligentes sin spam
        </p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">
          Nunca mandamos publicidad genérica. Solo avisamos en 3 momentos: si tu gasto semanal sube más de 25 %, 3 días antes de un cobro fijo grande, o cuando cerraste tu quincena/mes.
        </p>
        {message && (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-primary-dark">
            <CheckCircle2 size={14} aria-hidden="true" />
            <span>{message}</span>
          </p>
        )}
      </div>

      {subscribed ? (
        <button
          type="button"
          disabled={busy}
          onClick={disablePush}
          className="btn-sm border border-line bg-white text-ink-muted hover:text-ink"
        >
          <BellOff size={15} aria-hidden="true" />
          {busy ? 'Actualizando...' : 'Silenciar en este celular'}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={enablePush}
          className="btn-sm bg-primary text-white hover:bg-primary-dark"
        >
          <BellRing size={15} aria-hidden="true" />
          {busy ? 'Activando...' : 'Activar avisos en este dispositivo'}
        </button>
      )}
    </div>
  );
}
