'use client';

import { Download, Share, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { track } from '@/lib/analytics/client';

/**
 * Instalar CIFRA en el celular, con su ícono, como una aplicación más.
 *
 * Android (Chrome) avisa con el evento `beforeinstallprompt` apenas carga la página, casi siempre
 * antes de que la persona llegue a la pantalla donde está el botón. `InstallCapture` va en el
 * layout raíz y lo guarda; `InstallCard` lo usa cuando la persona toca "Instalar".
 * En iPhone no existe ese aviso: se instala desde el botón Compartir de Safari, y se le dice cómo.
 */

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function InstallCapture() {
  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault(); // sin esto Chrome muestra su propia franja; el botón es nuestro
      deferred = e as InstallPromptEvent;
      notify();
    }
    function onInstalled() {
      deferred = null;
      notify();
      track('app_installed');
    }
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  return null;
}

type Mode = 'oculto' | 'boton' | 'iphone' | 'manual';

function detect(): Mode {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return 'oculto'; // ya está instalada y abierta como aplicación
  if (deferred) return 'boton';
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  if (iOS) return 'iphone';
  return 'manual';
}

export function InstallCard({ tone = 'primary' }: { tone?: 'primary' | 'terra' }) {
  const [mode, setMode] = useState<Mode>('oculto');

  useEffect(() => {
    const update = () => setMode(detect());
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  if (mode === 'oculto') return null;

  async function install() {
    const event = deferred;
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    track('app_install_prompt', { outcome });
    deferred = null;
    setMode(detect());
  }

  const chip = tone === 'terra' ? 'bg-terra-light text-terra-dark' : 'bg-primary-light text-primary-dark';

  return (
    <section data-testid="instalar" className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-start gap-3.5">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${chip}`}>
          <Smartphone size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-ink">Pon CIFRA en tu pantalla de inicio</h2>
          {mode === 'boton' && (
            <>
              <p className="mt-0.5 text-[13.5px] leading-snug text-ink-muted">Queda con su ícono, como cualquier aplicación. No ocupa espacio ni pasa por la tienda.</p>
              <button id="btn-instalar" type="button" onClick={install} className={`mt-3 ${tone === 'terra' ? 'btn-terra' : 'btn-primary'} min-h-11 px-4 text-[14.5px]`}>
                <Download size={17} aria-hidden="true" /> Instalar
              </button>
            </>
          )}
          {mode === 'iphone' && (
            <p className="mt-0.5 text-[13.5px] leading-snug text-ink-muted">
              En Safari, toca <Share size={14} className="mx-0.5 inline-block align-[-2px]" aria-label="Compartir" /> <strong className="font-semibold text-ink">Compartir</strong> y
              después <strong className="font-semibold text-ink">Agregar a inicio</strong>. Queda con su ícono, como cualquier aplicación.
            </p>
          )}
          {mode === 'manual' && (
            <p className="mt-0.5 text-[13.5px] leading-snug text-ink-muted">
              Abre el menú de tu navegador y elige <strong className="font-semibold text-ink">Agregar a la pantalla de inicio</strong> o{' '}
              <strong className="font-semibold text-ink">Instalar aplicación</strong>. Queda con su ícono, como cualquier aplicación.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
