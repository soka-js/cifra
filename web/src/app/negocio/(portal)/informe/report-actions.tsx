'use client';

import { Check, Copy, MessageCircle, Printer } from 'lucide-react';
import { useState } from 'react';

export function ReportActions({ whatsappSummary }: { whatsappSummary: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(whatsappSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignorar si portapapeles no está disponible
    }
  }

  const waHref = `https://wa.me/?text=${encodeURIComponent(whatsappSummary)}`;

  return (
    <div className="no-print flex flex-wrap items-center gap-2.5">
      <button type="button" onClick={() => window.print()} className="btn-ink text-[14px]">
        <Printer size={16} aria-hidden="true" />
        Imprimir o guardar PDF (1 página)
      </button>

      <a
        href={waHref}
        target="_blank"
        rel="noreferrer"
        className="btn-primary text-[14px]"
      >
        <MessageCircle size={16} aria-hidden="true" />
        Compartir por WhatsApp
      </a>

      <button type="button" onClick={handleCopy} className="btn-ghost text-[14px]">
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        {copied ? 'Copiado' : 'Copiar resumen'}
      </button>
    </div>
  );
}
